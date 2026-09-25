import { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '@/src/utils/config';

export interface DocumentApprovalPolicy {
  enabled: boolean;
  allowAllUsers: boolean;
  approvers: string[];
  approverNames: string[];
}

export interface StoreApprovalSettings {
  materialRequest: DocumentApprovalPolicy;
  outwardPo: DocumentApprovalPolicy;
}

export const DEFAULT_APPROVAL_SETTINGS: StoreApprovalSettings = {
  materialRequest: {
    enabled: false,
    allowAllUsers: true,
    approvers: [],
    approverNames: []
  },
  outwardPo: {
    enabled: false,
    allowAllUsers: true,
    approvers: [],
    approverNames: []
  }
};

let globalApprovalSettings: StoreApprovalSettings = { ...DEFAULT_APPROVAL_SETTINGS };

export function getGlobalApprovalSettings(): StoreApprovalSettings {
  return { ...globalApprovalSettings };
}

export function setGlobalApprovalSettings(newSettings: Partial<StoreApprovalSettings>) {
  globalApprovalSettings = {
    materialRequest: { ...DEFAULT_APPROVAL_SETTINGS.materialRequest, ...(newSettings.materialRequest || {}) },
    outwardPo: { ...DEFAULT_APPROVAL_SETTINGS.outwardPo, ...(newSettings.outwardPo || {}) }
  };
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('binserp_approval_settings_updated', { detail: globalApprovalSettings }));
  }
}

export function useStoreApprovalSettings(token?: string | null) {
  const [settings, setSettings] = useState<StoreApprovalSettings>(() => getGlobalApprovalSettings());
  const [loading, setLoading] = useState(false);

  // Listen to global custom events
  useEffect(() => {
    const handleUpdate = () => {
      setSettings(getGlobalApprovalSettings());
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('binserp_approval_settings_updated', handleUpdate);
      return () => window.removeEventListener('binserp_approval_settings_updated', handleUpdate);
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    const authToken = token || (typeof window !== 'undefined' ? localStorage.getItem('token') : null);
    if (!authToken) return;

    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/store/prefix`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.settings?.approvalSettings) {
          setGlobalApprovalSettings(data.settings.approvalSettings);
          setSettings({
            materialRequest: { ...DEFAULT_APPROVAL_SETTINGS.materialRequest, ...(data.settings.approvalSettings.materialRequest || {}) },
            outwardPo: { ...DEFAULT_APPROVAL_SETTINGS.outwardPo, ...(data.settings.approvalSettings.outwardPo || {}) }
          });
        }
      }
    } catch (err) {
      console.warn('Failed to fetch approval settings from store prefix:', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const isApprovalRequired = useCallback((docType: 'materialRequest' | 'outwardPo'): boolean => {
    return Boolean(settings[docType]?.enabled);
  }, [settings]);

  const canUserApprove = useCallback((docType: 'materialRequest' | 'outwardPo', user: any, userType?: string): boolean => {
    const policy = settings[docType];
    if (!policy || !policy.enabled) return true; // No approval required
    
    // Admin, company, or saasadmin always has approval rights
    if (userType === 'company' || userType === 'saasadmin') return true;
    const roleName = user?.role?.name || '';
    if (roleName === 'GM' || roleName === 'Admin Default Role' || roleName === 'Company Management') return true;

    // If configured to allow all users
    if (policy.allowAllUsers) return true;

    // If specific approvers configured
    const userId = user?._id || user?.id;
    if (!userId) return false;
    const userIdStr = String(userId);

    const isMatch = (policy.approvers || []).some(id => String(id) === userIdStr);
    if (isMatch) return true;

    // Check by user name or email as fallback
    const userName = (user?.name || user?.username || '').trim().toLowerCase();
    const userEmail = (user?.email || '').trim().toLowerCase();
    return (policy.approverNames || []).some(name => {
      const n = name.trim().toLowerCase();
      return n === userName || n === userEmail;
    });
  }, [settings]);

  const getApproverNames = useCallback((docType: 'materialRequest' | 'outwardPo'): string[] => {
    return settings[docType]?.approverNames || [];
  }, [settings]);

  return {
    settings,
    loading,
    refreshApprovalSettings: fetchSettings,
    isApprovalRequired,
    canUserApprove,
    getApproverNames
  };
}

export default useStoreApprovalSettings;

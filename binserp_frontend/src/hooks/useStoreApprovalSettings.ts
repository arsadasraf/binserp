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
    
    // If configured to allow all users
    if (policy.allowAllUsers) return true;

    // Strict Mode: ONLY the designated user(s) given in Store Settings can approve.
    // All other users (including admins and managers) must request approval from this user.
    const userId = user?._id || user?.id;
    const userIdStr = userId ? String(userId) : '';

    const isMatch = (policy.approvers || []).some(id => String(id) === userIdStr);
    if (isMatch) return true;

    // Check by user name or email as fallback
    const userName = (user?.name || user?.username || '').trim().toLowerCase();
    const userEmail = (user?.email || '').trim().toLowerCase();
    return (policy.approverNames || []).some(name => {
      const n = name.trim().toLowerCase();
      return (Boolean(userName) && n === userName) || (Boolean(userEmail) && n === userEmail);
    });
  }, [settings]);

  const getApproverNames = useCallback((docType: 'materialRequest' | 'outwardPo'): string[] => {
    return settings[docType]?.approverNames || [];
  }, [settings]);

  const getApproverDisplay = useCallback((docType: 'materialRequest' | 'outwardPo'): string => {
    const names = settings[docType]?.approverNames || [];
    if (names.length > 0) return names.join(', ');
    return 'Authorized Approver';
  }, [settings]);

  return {
    settings,
    loading,
    refreshApprovalSettings: fetchSettings,
    isApprovalRequired,
    canUserApprove,
    getApproverNames,
    getApproverDisplay
  };
}

export default useStoreApprovalSettings;

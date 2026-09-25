import { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '@/src/utils/config';

export const DEFAULT_TIME_LOCK_HOURS: Record<string, number> = {
  grn: 24,
  customerPo: 24,
  deliveryChallan: 24,
  invoice: 24,
  purchasePo: 24,
  jobWorkChallan: 24,
  rfqQuotation: 24,
  mrbDisposition: 24
};

let globalTimeLockPolicies: Record<string, number> = { ...DEFAULT_TIME_LOCK_HOURS };

export function getGlobalTimeLockPolicies(): Record<string, number> {
  return { ...globalTimeLockPolicies };
}

export function setGlobalTimeLockPolicies(newPolicies: Record<string, number>) {
  globalTimeLockPolicies = { ...DEFAULT_TIME_LOCK_HOURS, ...newPolicies };
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('binserp_timelock_policies_updated', { detail: globalTimeLockPolicies }));
  }
}

export function useTimeLockPolicy(token?: string | null) {
  const [policies, setPolicies] = useState<Record<string, number>>(() => getGlobalTimeLockPolicies());
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Timer tick every 30 seconds for live countdown updates
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // Listen to global changes
  useEffect(() => {
    const handleUpdate = () => {
      setPolicies(getGlobalTimeLockPolicies());
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('binserp_timelock_policies_updated', handleUpdate);
      return () => window.removeEventListener('binserp_timelock_policies_updated', handleUpdate);
    }
  }, []);

  // Fetch settings from API
  useEffect(() => {
    const authToken = token || (typeof window !== 'undefined' ? localStorage.getItem('token') : null);
    if (!authToken) return;

    let isMounted = true;
    const fetchPolicies = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE_URL}/api/store/prefix`, {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.settings?.timeLockPolicies && isMounted) {
            setGlobalTimeLockPolicies(data.settings.timeLockPolicies);
            setPolicies({ ...DEFAULT_TIME_LOCK_HOURS, ...data.settings.timeLockPolicies });
          }
        }
      } catch (err) {
        console.warn('Failed to fetch time lock policies from prefix settings, using cached/defaults:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchPolicies();
    return () => { isMounted = false; };
  }, [token]);

  const getPolicyHours = useCallback((entityKey: string): number => {
    return policies[entityKey] ?? DEFAULT_TIME_LOCK_HOURS[entityKey] ?? 24;
  }, [policies]);

  const getRemainingSeconds = useCallback((createdAt: string | Date | undefined, entityKey: string): number => {
    if (!createdAt) return 0;
    const policyHours = getPolicyHours(entityKey);

    // Unlimited
    if (policyHours === -1) {
      return Infinity;
    }

    // Locked immediately
    if (policyHours <= 0) {
      return 0;
    }

    const createdTime = new Date(createdAt).getTime();
    if (isNaN(createdTime)) return 0;

    const allowedMs = policyHours * 3600 * 1000;
    const elapsedMs = now - createdTime;
    const remainingMs = allowedMs - elapsedMs;

    return Math.max(0, Math.floor(remainingMs / 1000));
  }, [getPolicyHours, now]);

  const isTimeLockExpired = useCallback((createdAt: string | Date | undefined, entityKey: string): boolean => {
    if (!createdAt) return false;
    const policyHours = getPolicyHours(entityKey);

    // Unlimited policy: never locked by time
    if (policyHours === -1) return false;

    // Immediately locked policy
    if (policyHours <= 0) return true;

    const remainingSecs = getRemainingSeconds(createdAt, entityKey);
    return remainingSecs <= 0;
  }, [getPolicyHours, getRemainingSeconds]);

  const formatRemainingTime = useCallback((remainingSeconds: number): string => {
    if (remainingSeconds === Infinity) return 'Unlimited';
    if (remainingSeconds <= 0) return 'Expired';

    const hours = Math.floor(remainingSeconds / 3600);
    const mins = Math.floor((remainingSeconds % 3600) / 60);

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      const remHours = hours % 24;
      return `${days}d ${remHours}h`;
    }
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  }, []);

  return {
    policies,
    loading,
    getPolicyHours,
    getRemainingSeconds,
    isTimeLockExpired,
    formatRemainingTime,
  };
}

export default useTimeLockPolicy;

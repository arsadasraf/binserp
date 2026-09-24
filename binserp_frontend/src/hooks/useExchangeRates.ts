import { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '@/src/utils/config';
import { 
  getGlobalExchangeRates, 
  setGlobalExchangeRates, 
  convertToINR as coreConvertToINR,
  DEFAULT_EXCHANGE_RATES_TO_INR
} from '@/src/utils/currencyHelper';

export function useExchangeRates(token?: string | null) {
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>(() => getGlobalExchangeRates());
  const [loading, setLoading] = useState(false);

  // Sync state whenever global cache updates
  useEffect(() => {
    const handleUpdate = () => {
      setExchangeRates(getGlobalExchangeRates());
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('binserp_exchange_rates_updated', handleUpdate);
      return () => window.removeEventListener('binserp_exchange_rates_updated', handleUpdate);
    }
  }, []);

  // Fetch settings from API
  useEffect(() => {
    const authToken = token || (typeof window !== 'undefined' ? localStorage.getItem('token') : null);
    if (!authToken) return;

    let isMounted = true;
    const fetchRates = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE_URL}/api/store/prefix`, {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.settings?.exchangeRates && isMounted) {
            setGlobalExchangeRates(data.settings.exchangeRates);
            setExchangeRates({ ...DEFAULT_EXCHANGE_RATES_TO_INR, ...data.settings.exchangeRates });
          }
        }
      } catch (err) {
        console.warn('Failed to fetch exchange rates from prefix settings, using cached/defaults:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchRates();
    return () => { isMounted = false; };
  }, [token]);

  const convertToINR = useCallback((amount: number | string | undefined | null, currency?: string, customRate?: number) => {
    return coreConvertToINR(amount, currency, customRate || exchangeRates);
  }, [exchangeRates]);

  return {
    exchangeRates,
    convertToINR,
    loading
  };
}

export default useExchangeRates;

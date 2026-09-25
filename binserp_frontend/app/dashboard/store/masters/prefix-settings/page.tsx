"use client";

import React, { useState, useEffect } from 'react';
import LoadingSpinner from '@/src/components/LoadingSpinner';
import { API_BASE_URL } from '@/src/utils/config';
import { Hash, Tag, ShoppingCart, FileText, CheckCircle2, Save, IndianRupee, Globe, RefreshCw, Clock, Lock, ShieldCheck, AlertCircle, Package, Truck, Layers, Wrench, ShieldAlert, PackageCheck, UserCheck, Users, ExternalLink, X, Plus } from 'lucide-react';
import Link from 'next/link';
import { useGetUsersQuery } from '@/src/store/services/userService';
import { DEFAULT_EXCHANGE_RATES_TO_INR, setGlobalExchangeRates, CURRENCY_OPTIONS, getCurrencySymbol } from '@/src/utils/currencyHelper';
import { setGlobalTimeLockPolicies } from '@/src/hooks/useTimeLockPolicy';
import { DEFAULT_APPROVAL_SETTINGS, StoreApprovalSettings, setGlobalApprovalSettings } from '@/src/hooks/useStoreApprovalSettings';

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

export const TIME_LOCK_CONFIGS = [
  {
    key: 'grn',
    title: 'Goods Receipt Note (GRN)',
    subtitle: 'Store & Inward Material Receipts',
    icon: PackageCheck,
    description: 'Window within which Store GRNs can be edited or deleted before permanent ledger lock.'
  },
  {
    key: 'customerPo',
    title: 'Customer Purchase Order',
    subtitle: 'Sales & Incoming Orders',
    icon: ShoppingCart,
    description: 'Window allowed for revising or deleting customer PO line items and order terms.'
  },
  {
    key: 'deliveryChallan',
    title: 'Delivery Challan (DC)',
    subtitle: 'Store & Dispatch Shipments',
    icon: Truck,
    description: 'Window to modify or cancel dispatched Delivery Challans before inventory commitment.'
  },
  {
    key: 'invoice',
    title: 'Tax Invoice & Billing',
    subtitle: 'Finance & Sales Invoices',
    icon: FileText,
    description: 'Window for amending or deleting generated tax invoices and billing records.'
  },
  {
    key: 'purchasePo',
    title: 'Purchase PO (Outward)',
    subtitle: 'Procurement & Vendor Orders',
    icon: Package,
    description: 'Window for altering procurement purchase orders sent to external vendors.'
  },
  {
    key: 'jobWorkChallan',
    title: 'Job Work Challan',
    subtitle: 'Subcontracting & Outward Work',
    icon: Wrench,
    description: 'Window to adjust or delete job work outward/return challans and line items.'
  },
  {
    key: 'rfqQuotation',
    title: 'RFQ & Quotation',
    subtitle: 'Inward & Outward Sales Quotes',
    icon: Layers,
    description: 'Window for modifying RFQ estimates and approved customer quotations.'
  },
  {
    key: 'mrbDisposition',
    title: 'MRB Quality Disposition',
    subtitle: 'QA/QC Material Rejection Board',
    icon: ShieldAlert,
    description: 'Window for adjusting quality disposition decisions before non-conformance closure.'
  }
];


interface PrefixSettings {
  customerPrefix: string;
  vendorPrefix: string;
  jobWorkSupplierPrefix: string;
  categoryPrefix: string;
  partPrefix: string;
  incomingPoPrefix: string;
  outwardPoPrefix?: string;
  outgoingPoPrefix: string;
  poPrefix: string;
  incomingRfqPrefix: string;
  outgoingRfqPrefix: string;
  quotationOutwardPrefix: string;
  quotationInwardPrefix: string;
  invoicePrefix: string;
  dcPrefix: string;
  grnPrefix: string;
  rmBoGrnPrefix: string;
  fgGrnPrefix: string;
  exchangeRates?: Record<string, number>;
  timeLockPolicies?: Record<string, number>;
  approvalSettings?: StoreApprovalSettings;
}

export default function PrefixSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { data: allUsers = [] } = useGetUsersQuery();
  const [settings, setSettings] = useState<PrefixSettings>({
    customerPrefix: 'CUS',
    vendorPrefix: 'VEN',
    jobWorkSupplierPrefix: 'JWS',
    categoryPrefix: 'CAT',
    partPrefix: 'PART',
    incomingPoPrefix: 'PO-IN',
    outwardPoPrefix: 'PO-OUT',
    outgoingPoPrefix: 'PO-OUT',
    poPrefix: 'PO',
    incomingRfqPrefix: 'RFQ-IN',
    outgoingRfqPrefix: 'RFQ-OUT',
    quotationOutwardPrefix: 'QT-OUT',
    quotationInwardPrefix: 'QT-IN',
    invoicePrefix: 'INV',
    dcPrefix: 'DC',
    grnPrefix: 'GRN',
    rmBoGrnPrefix: 'GRN-RM',
    fgGrnPrefix: 'GRN-FG',
    exchangeRates: { ...DEFAULT_EXCHANGE_RATES_TO_INR },
    timeLockPolicies: { ...DEFAULT_TIME_LOCK_HOURS },
    approvalSettings: { ...DEFAULT_APPROVAL_SETTINGS },
  });

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeSubSection, setActiveSubSection] = useState<'all' | 'prefixes' | 'currency' | 'timelocks' | 'approvals'>('all');

  useEffect(() => {
    fetchPrefixSettings();
  }, []);

  const fetchPrefixSettings = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/store/prefix`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.settings) {
          const mergedRates = {
            ...DEFAULT_EXCHANGE_RATES_TO_INR,
            ...(data.settings.exchangeRates || {})
          };
          const mergedPolicies = {
            ...DEFAULT_TIME_LOCK_HOURS,
            ...(data.settings.timeLockPolicies || {})
          };
          const mergedApprovals = {
            materialRequest: {
              ...DEFAULT_APPROVAL_SETTINGS.materialRequest,
              ...(data.settings.approvalSettings?.materialRequest || {})
            },
            outwardPo: {
              ...DEFAULT_APPROVAL_SETTINGS.outwardPo,
              ...(data.settings.approvalSettings?.outwardPo || {})
            }
          };
          setSettings(prev => ({ 
            ...prev, 
            ...data.settings,
            exchangeRates: mergedRates,
            timeLockPolicies: mergedPolicies,
            approvalSettings: mergedApprovals
          }));
          setGlobalExchangeRates(mergedRates);
          setGlobalTimeLockPolicies(mergedPolicies);
          setGlobalApprovalSettings(mergedApprovals);
        }
      }
    } catch (error) {
      console.error('Failed to fetch prefix settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof PrefixSettings, value: string) => {
    setSettings(prev => ({ ...prev, [field]: value.toUpperCase() }));
  };

  const handlePolicyChange = (key: string, value: number) => {
    setSettings(prev => ({
      ...prev,
      timeLockPolicies: {
        ...(prev.timeLockPolicies || DEFAULT_TIME_LOCK_HOURS),
        [key]: value
      }
    }));
  };

  const handleRateChange = (currency: string, value: string) => {
    const num = parseFloat(value);
    setSettings(prev => ({
      ...prev,
      exchangeRates: {
        ...(prev.exchangeRates || DEFAULT_EXCHANGE_RATES_TO_INR),
        [currency]: isNaN(num) ? 0 : num
      }
    }));
  };

  const resetRatesToDefaults = () => {
    setSettings(prev => ({
      ...prev,
      exchangeRates: { ...DEFAULT_EXCHANGE_RATES_TO_INR }
    }));
    setMessage({ type: 'success', text: 'Reset exchange rates to baseline market benchmarks. Click "Save All Prefixes" to commit.' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setMessage(null);
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/store/prefix`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(settings)
      });

      const data = await res.json();
      if (res.ok) {
        if (settings.exchangeRates) {
          setGlobalExchangeRates(settings.exchangeRates);
        }
        if (settings.timeLockPolicies) {
          setGlobalTimeLockPolicies(settings.timeLockPolicies);
        }
        if (settings.approvalSettings) {
          setGlobalApprovalSettings(settings.approvalSettings);
        }
        setMessage({ type: 'success', text: 'Store settings, Currency Rates, Time-Locks, and Approval Workflows updated successfully!' });
        alert('Store settings, Currency, Time-Lock & Approval Workflows saved successfully!');
      } else {
        throw new Error(data.message || 'Failed to save prefix settings');
      }
    } catch (error: any) {
      console.error('Error saving prefix settings:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to save prefix settings' });
      alert(`Error saving settings: ${error.message || 'Failed to save prefix settings'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleApprovalToggle = (docType: 'materialRequest' | 'outwardPo', enabled: boolean) => {
    setSettings(prev => {
      const current = prev.approvalSettings || DEFAULT_APPROVAL_SETTINGS;
      return {
        ...prev,
        approvalSettings: {
          ...current,
          [docType]: {
            ...current[docType],
            enabled
          }
        }
      };
    });
  };

  const handleApprovalAllowAllToggle = (docType: 'materialRequest' | 'outwardPo', allowAllUsers: boolean) => {
    setSettings(prev => {
      const current = prev.approvalSettings || DEFAULT_APPROVAL_SETTINGS;
      return {
        ...prev,
        approvalSettings: {
          ...current,
          [docType]: {
            ...current[docType],
            allowAllUsers
          }
        }
      };
    });
  };

  const handleAddApprover = (docType: 'materialRequest' | 'outwardPo', userId: string) => {
    if (!userId) return;
    const user = (allUsers || []).find((u: any) => String(u._id) === String(userId));
    if (!user) return;

    setSettings(prev => {
      const current = prev.approvalSettings || DEFAULT_APPROVAL_SETTINGS;
      const policy = current[docType];
      if ((policy.approvers || []).some(id => String(id) === String(user._id))) {
        return prev;
      }
      return {
        ...prev,
        approvalSettings: {
          ...current,
          [docType]: {
            ...policy,
            approvers: [...(policy.approvers || []), String(user._id)],
            approverNames: [...(policy.approverNames || []), user.name || user.email || 'User']
          }
        }
      };
    });
  };

  const handleRemoveApprover = (docType: 'materialRequest' | 'outwardPo', indexToRemove: number) => {
    setSettings(prev => {
      const current = prev.approvalSettings || DEFAULT_APPROVAL_SETTINGS;
      const policy = current[docType];
      return {
        ...prev,
        approvalSettings: {
          ...current,
          [docType]: {
            ...policy,
            approvers: (policy.approvers || []).filter((_, idx) => idx !== indexToRemove),
            approverNames: (policy.approverNames || []).filter((_, idx) => idx !== indexToRemove)
          }
        }
      };
    });
  };

  if (loading) return <LoadingSpinner />;

  const renderSectionHeader = (title: string, icon: React.ReactNode, colorClass: string = "bg-indigo-600") => (
    <h3 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white mb-2 sm:mb-3 flex items-center gap-2">
      <div className={`p-1.5 rounded-lg text-white ${colorClass}`}>
        {icon}
      </div>
      <span>{title}</span>
    </h3>
  );

  return (
    <div className="w-full h-full flex-1 overflow-y-auto space-y-4 pb-28 sm:pb-16 pr-1 sm:pr-2 scroll-smooth">
      <div className="w-full space-y-3 sm:space-y-4">
        {/* Header Banner */}
        <div className="w-full bg-white dark:bg-gray-900 p-3.5 sm:p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-base sm:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2 truncate">
              <Hash className="text-indigo-600 dark:text-indigo-400 h-5 w-5 sm:h-6 sm:w-6 shrink-0" />
              <span>Store Settings & Governance</span>
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex items-center justify-center gap-1.5 sm:gap-2 px-3.5 sm:px-6 py-2 sm:py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold rounded-xl shadow-sm transition-all disabled:opacity-50 text-xs sm:text-sm cursor-pointer"
            >
              <Save size={16} />
              <span>{saving ? 'Saving...' : 'Save Settings'}</span>
            </button>
          </div>
        </div>

        {/* Quick Section Switcher Pills */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar py-0.5">
          <div className="flex items-center bg-white dark:bg-gray-900 p-1 rounded-xl border border-gray-200 dark:border-gray-800 shadow-2xs gap-1 shrink-0 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setActiveSubSection('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeSubSection === 'all'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-gray-800'
              }`}
            >
              All Settings
            </button>
            <button
              type="button"
              onClick={() => setActiveSubSection('prefixes')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                activeSubSection === 'prefixes'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-gray-800'
              }`}
            >
              <Tag size={13} />
              <span>Code Prefixes</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSubSection('currency')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                activeSubSection === 'currency'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/60 font-extrabold'
              }`}
            >
              <IndianRupee size={13} />
              <span>Currency Rates (₹)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSubSection('timelocks')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                activeSubSection === 'timelocks'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/60 font-extrabold'
              }`}
            >
              <Clock size={13} />
              <span>Lock Policies</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSubSection('approvals')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                activeSubSection === 'approvals'
                  ? 'bg-purple-600 text-white shadow-2xs'
                  : 'text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/60 font-extrabold'
              }`}
            >
              <ShieldCheck size={13} />
              <span>Approval Workflow</span>
            </button>
          </div>

          <div className="hidden sm:flex text-[11px] font-semibold text-slate-500 dark:text-slate-400 items-center gap-1 shrink-0 whitespace-nowrap pr-1">
            <Globe size={13} className="text-blue-500" />
            <span>Base: <strong>₹1.00 INR</strong></span>
          </div>
        </div>

        {message && (
          <div className={`w-full p-3 sm:p-4 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-2 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' : 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400 border border-red-200 dark:border-red-800'}`}>
            <CheckCircle2 size={16} />
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="w-full space-y-3 sm:space-y-4">
          {(activeSubSection === 'all' || activeSubSection === 'prefixes') && (
            <>
              {/* Section 1: Master Entities */}
              <div className="w-full bg-white dark:bg-gray-900 p-3.5 sm:p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs">
                {renderSectionHeader("Master Entity Prefixes", <Tag size={16} />, "bg-indigo-600")}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-4">
                  <div className="flex flex-col">
                    <label className="block text-[11px] sm:text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 truncate">Customer Prefix</label>
                    <input
                      type="text"
                      value={settings.customerPrefix || ''}
                      onChange={e => handleChange('customerPrefix', e.target.value)}
                      className="w-full px-3 py-1.5 sm:py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-gray-900 text-xs sm:text-sm font-semibold transition-all text-gray-900 dark:text-white"
                      placeholder="e.g. CUS"
                    />
                  </div>

                  <div className="flex flex-col">
                    <label className="block text-[11px] sm:text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 truncate">Vendor Prefix</label>
                    <input
                      type="text"
                      value={settings.vendorPrefix || ''}
                      onChange={e => handleChange('vendorPrefix', e.target.value)}
                      className="w-full px-3 py-1.5 sm:py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-gray-900 text-xs sm:text-sm font-semibold transition-all text-gray-900 dark:text-white"
                      placeholder="e.g. VEN"
                    />
                  </div>

                  <div className="flex flex-col">
                    <label className="block text-[11px] sm:text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 truncate">JW Supplier</label>
                    <input
                      type="text"
                      value={settings.jobWorkSupplierPrefix || ''}
                      onChange={e => handleChange('jobWorkSupplierPrefix', e.target.value)}
                      className="w-full px-3 py-1.5 sm:py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-gray-900 text-xs sm:text-sm font-semibold transition-all text-gray-900 dark:text-white"
                      placeholder="e.g. JWS"
                    />
                  </div>

                  <div className="flex flex-col">
                    <label className="block text-[11px] sm:text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 truncate">Category Prefix</label>
                    <input
                      type="text"
                      value={settings.categoryPrefix || ''}
                      onChange={e => handleChange('categoryPrefix', e.target.value)}
                      className="w-full px-3 py-1.5 sm:py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-gray-900 text-xs sm:text-sm font-semibold transition-all text-gray-900 dark:text-white"
                      placeholder="e.g. CAT"
                    />
                  </div>

                  <div className="flex flex-col">
                    <label className="block text-[11px] sm:text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 truncate">Item / Part Prefix</label>
                    <input
                      type="text"
                      value={settings.partPrefix || ''}
                      onChange={e => handleChange('partPrefix', e.target.value)}
                      className="w-full px-3 py-1.5 sm:py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-gray-900 text-xs sm:text-sm font-semibold transition-all text-gray-900 dark:text-white"
                      placeholder="e.g. PART"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Purchasing & RFQ Prefixes */}
              <div className="w-full bg-white dark:bg-gray-900 p-3.5 sm:p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs">
                {renderSectionHeader("Purchasing & RFQ Prefixes", <ShoppingCart size={16} />, "bg-purple-600")}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-4">
                  <div className="flex flex-col">
                    <label className="block text-[11px] sm:text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 truncate">Incoming PO</label>
                    <input
                      type="text"
                      value={settings.incomingPoPrefix || ''}
                      onChange={e => handleChange('incomingPoPrefix', e.target.value)}
                      className="w-full px-3 py-1.5 sm:py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:bg-white dark:focus:bg-gray-900 text-xs sm:text-sm font-semibold transition-all text-gray-900 dark:text-white"
                      placeholder="e.g. PO-IN"
                    />
                  </div>

                  <div className="flex flex-col">
                    <label className="block text-[11px] sm:text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 truncate">Outward PO</label>
                    <input
                      type="text"
                      value={settings.outwardPoPrefix || settings.outgoingPoPrefix || settings.poPrefix || ''}
                      onChange={e => {
                        handleChange('outwardPoPrefix', e.target.value);
                        handleChange('outgoingPoPrefix', e.target.value);
                        handleChange('poPrefix', e.target.value);
                      }}
                      className="w-full px-3 py-1.5 sm:py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:bg-white dark:focus:bg-gray-900 text-xs sm:text-sm font-semibold transition-all text-gray-900 dark:text-white"
                      placeholder="e.g. PO-OUT"
                    />
                  </div>

                  <div className="flex flex-col">
                    <label className="block text-[11px] sm:text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 truncate">Incoming RFQ</label>
                    <input
                      type="text"
                      value={settings.incomingRfqPrefix || ''}
                      onChange={e => handleChange('incomingRfqPrefix', e.target.value)}
                      className="w-full px-3 py-1.5 sm:py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:bg-white dark:focus:bg-gray-900 text-xs sm:text-sm font-semibold transition-all text-gray-900 dark:text-white"
                      placeholder="e.g. RFQ-IN"
                    />
                  </div>

                  <div className="flex flex-col">
                    <label className="block text-[11px] sm:text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 truncate">Outgoing RFQ / Quote</label>
                    <input
                      type="text"
                      value={settings.outgoingRfqPrefix || settings.quotationOutwardPrefix || ''}
                      onChange={e => {
                        handleChange('outgoingRfqPrefix', e.target.value);
                        handleChange('quotationOutwardPrefix', e.target.value);
                      }}
                      className="w-full px-3 py-1.5 sm:py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:bg-white dark:focus:bg-gray-900 text-xs sm:text-sm font-semibold transition-all text-gray-900 dark:text-white"
                      placeholder="e.g. QT-OUT"
                    />
                  </div>

                  <div className="flex flex-col">
                    <label className="block text-[11px] sm:text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 truncate">Inward Quotation</label>
                    <input
                      type="text"
                      value={settings.quotationInwardPrefix || ''}
                      onChange={e => handleChange('quotationInwardPrefix', e.target.value)}
                      className="w-full px-3 py-1.5 sm:py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:bg-white dark:focus:bg-gray-900 text-xs sm:text-sm font-semibold transition-all text-gray-900 dark:text-white"
                      placeholder="e.g. QT-IN"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Operations & Billing Prefixes */}
              <div className="w-full bg-white dark:bg-gray-900 p-3.5 sm:p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs">
                {renderSectionHeader("Sales, DC & Billing Prefixes", <FileText size={16} />, "bg-emerald-600")}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-4">
                  <div className="flex flex-col">
                    <label className="block text-[11px] sm:text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 truncate">Invoice Prefix</label>
                    <input
                      type="text"
                      value={settings.invoicePrefix || ''}
                      onChange={e => handleChange('invoicePrefix', e.target.value)}
                      className="w-full px-3 py-1.5 sm:py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white dark:focus:bg-gray-900 text-xs sm:text-sm font-semibold transition-all text-gray-900 dark:text-white"
                      placeholder="e.g. INV"
                    />
                  </div>

                  <div className="flex flex-col">
                    <label className="block text-[11px] sm:text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 truncate">Delivery Challan</label>
                    <input
                      type="text"
                      value={settings.dcPrefix || ''}
                      onChange={e => handleChange('dcPrefix', e.target.value)}
                      className="w-full px-3 py-1.5 sm:py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white dark:focus:bg-gray-900 text-xs sm:text-sm font-semibold transition-all text-gray-900 dark:text-white"
                      placeholder="e.g. DC"
                    />
                  </div>

                  <div className="flex flex-col">
                    <label className="block text-[11px] sm:text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 truncate">RM / BO GRN</label>
                    <input
                      type="text"
                      value={settings.rmBoGrnPrefix || settings.grnPrefix || ''}
                      onChange={e => {
                        handleChange('rmBoGrnPrefix', e.target.value);
                        handleChange('grnPrefix', e.target.value);
                      }}
                      className="w-full px-3 py-1.5 sm:py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white dark:focus:bg-gray-900 text-xs sm:text-sm font-semibold transition-all text-gray-900 dark:text-white"
                      placeholder="e.g. GRN-RM"
                    />
                  </div>

                  <div className="flex flex-col">
                    <label className="block text-[11px] sm:text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 truncate">FG Items GRN</label>
                    <input
                      type="text"
                      value={settings.fgGrnPrefix || ''}
                      onChange={e => handleChange('fgGrnPrefix', e.target.value)}
                      className="w-full px-3 py-1.5 sm:py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white dark:focus:bg-gray-900 text-xs sm:text-sm font-semibold transition-all text-gray-900 dark:text-white"
                      placeholder="e.g. GRN-FG"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Section 4: Currency Conversion Rates to INR */}
          {(activeSubSection === 'all' || activeSubSection === 'currency') && (
            <div className="w-full bg-white dark:bg-gray-900 p-3.5 sm:p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs">
              <div className="flex items-center justify-between gap-2 pb-2.5 mb-3 border-b border-gray-100 dark:border-gray-800">
                {renderSectionHeader("Currency Conversion Rates to ₹ INR", <IndianRupee size={16} />, "bg-blue-600")}
                <button
                  type="button"
                  onClick={resetRatesToDefaults}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 bg-slate-100 hover:bg-blue-50 dark:bg-slate-800 dark:hover:bg-slate-700/80 rounded-lg transition-colors cursor-pointer shrink-0"
                  title="Reset all exchange rates to standard baseline benchmarks"
                >
                  <RefreshCw size={12} />
                  <span>Reset Defaults</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-3.5">
                {CURRENCY_OPTIONS.filter(c => c.code !== 'INR').map((curr) => {
                  const currentRate = settings.exchangeRates?.[curr.code] !== undefined
                    ? settings.exchangeRates[curr.code]
                    : (DEFAULT_EXCHANGE_RATES_TO_INR[curr.code] || 1.0);

                  return (
                    <div key={curr.code} className="flex flex-col p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5 truncate">
                          <span className="w-5 h-5 rounded-md bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold text-[10px] flex items-center justify-center shrink-0">
                            {curr.symbol.trim() || curr.code}
                          </span>
                          <span className="truncate">{curr.name}</span>
                        </span>
                        <span className="text-[10px] font-mono text-gray-400 font-bold hidden sm:inline">
                          {curr.code}
                        </span>
                      </div>

                      <div className="relative flex items-center">
                        <span className="absolute left-2.5 text-xs font-bold text-gray-400 dark:text-gray-500 select-none">
                          ₹
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="0.0001"
                          value={currentRate || ''}
                          onChange={e => handleRateChange(curr.code, e.target.value)}
                          className="w-full pl-6 pr-10 py-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm font-bold text-gray-900 dark:text-white transition-all"
                          placeholder="0.00"
                        />
                        <span className="absolute right-2 text-[10px] font-bold text-gray-400 dark:text-gray-500 select-none">
                          INR
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SECTION 5: Dynamic Edit & Delete Time-Lock Policies */}
          {(activeSubSection === 'all' || activeSubSection === 'timelocks') && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-3.5 sm:p-5 border border-gray-100 dark:border-gray-700/60 shadow-xs">
              <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-gray-100 dark:border-gray-700/60 gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                    <Clock size={16} />
                  </div>
                  <h2 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <span>Edit & Delete Lock Policies</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 font-semibold">
                      Time-Bound
                    </span>
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSettings(prev => ({
                      ...prev,
                      timeLockPolicies: { ...DEFAULT_TIME_LOCK_HOURS }
                    }));
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg transition-colors cursor-pointer shrink-0"
                >
                  <RefreshCw size={12} />
                  <span>Reset to 24h</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {TIME_LOCK_CONFIGS.map(cfg => {
                  const currentVal = settings.timeLockPolicies?.[cfg.key] ?? DEFAULT_TIME_LOCK_HOURS[cfg.key] ?? 24;
                  const Icon = cfg.icon;

                  return (
                    <div
                      key={cfg.key}
                      className="p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/60 hover:bg-white dark:hover:bg-gray-800 transition-all flex flex-col justify-between gap-2.5"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5 truncate">
                            <span className="p-1 rounded-md bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 shrink-0">
                              <Icon size={14} />
                            </span>
                            <span className="truncate">{cfg.title}</span>
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                            {cfg.subtitle}
                          </span>
                          {currentVal === 0 ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 shrink-0">
                              <Lock size={10} /> Locked (0h)
                            </span>
                          ) : currentVal === -1 ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 shrink-0">
                              <ShieldCheck size={10} /> Unlimited
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 shrink-0">
                              <Clock size={10} />
                              {currentVal >= 24
                                ? `${Math.floor(currentVal / 24)}d ${currentVal % 24 > 0 ? `${currentVal % 24}h` : ''}`.trim()
                                : `${currentVal}h`}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2 pt-2 border-t border-gray-200/70 dark:border-gray-700/60">
                        {/* Presets */}
                        <div className="flex items-center gap-1 flex-wrap">
                          {[
                            { label: '0h', value: 0 },
                            { label: '12h', value: 12 },
                            { label: '24h', value: 24 },
                            { label: '48h', value: 48 },
                            { label: '72h', value: 72 },
                            { label: '∞', value: -1 }
                          ].map(preset => {
                            const isSelected = currentVal === preset.value;
                            return (
                              <button
                                key={preset.value}
                                type="button"
                                onClick={() => handlePolicyChange(cfg.key, preset.value)}
                                className={`px-2 py-0.5 text-[10px] font-semibold rounded-md transition-colors cursor-pointer ${
                                  isSelected
                                    ? 'bg-indigo-600 text-white shadow-2xs font-bold'
                                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                                }`}
                              >
                                {preset.label}
                              </button>
                            );
                          })}
                        </div>

                        {/* Custom Input */}
                        <div className="relative flex items-center">
                          <span className="absolute left-2.5 text-[11px] font-semibold text-gray-400 dark:text-gray-500 select-none flex items-center gap-1">
                            <Clock size={12} /> Custom:
                          </span>
                          <input
                            type="number"
                            step="1"
                            min="-1"
                            value={currentVal}
                            onChange={e => {
                              const parsed = parseInt(e.target.value, 10);
                              handlePolicyChange(cfg.key, isNaN(parsed) ? 0 : parsed);
                            }}
                            className="w-full pl-20 pr-12 py-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 text-xs font-bold text-gray-900 dark:text-white transition-all"
                            placeholder="e.g. 24"
                          />
                          <span className="absolute right-2 text-[10px] font-semibold text-gray-400 dark:text-gray-500 select-none">
                            {currentVal === 1 ? 'hr' : 'hrs'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SECTION 6: Document Approval Workflows & PDF Lock Gate */}
          {(activeSubSection === 'all' || activeSubSection === 'approvals') && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-3.5 sm:p-5 border border-gray-100 dark:border-gray-700/60 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2.5 border-b border-gray-100 dark:border-gray-700/60 gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                    <ShieldCheck size={16} />
                  </div>
                  <div>
                    <h2 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <span>Document Approval Workflows & PDF Lock Gate</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300 font-semibold">
                        PDF Gate
                      </span>
                    </h2>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                      Configure approval requirements before PDF creation. When enabled, official document PDFs can only be generated once authorized.
                    </p>
                  </div>
                </div>

                <Link
                  href="/dashboard/admin/users"
                  target="_blank"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 dark:hover:bg-purple-900/60 rounded-lg transition-colors cursor-pointer shrink-0 border border-purple-200 dark:border-purple-800/60 self-start sm:self-auto"
                >
                  <Users size={12} />
                  <span>Manage / Create Users</span>
                  <ExternalLink size={10} />
                </Link>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* 1. Material Request Requisition Card */}
                {(() => {
                  const mrPolicy = settings.approvalSettings?.materialRequest || DEFAULT_APPROVAL_SETTINGS.materialRequest;
                  const availableUsers = (allUsers || []).filter((u: any) => 
                    !(mrPolicy.approvers || []).some(id => String(id) === String(u._id))
                  );

                  return (
                    <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/60 hover:bg-white dark:hover:bg-gray-800 transition-all flex flex-col justify-between gap-3">
                      <div>
                        {/* Header & Toggle */}
                        <div className="flex items-center justify-between gap-3 pb-3 border-b border-gray-200/70 dark:border-gray-700/70">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 shrink-0">
                              <FileText size={16} />
                            </span>
                            <div className="min-w-0">
                              <h3 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white truncate">
                                Material Request Requisition
                              </h3>
                              <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                                Store material requisition & issuing slips
                              </p>
                            </div>
                          </div>

                          {/* Toggle switch */}
                          <label className="relative inline-flex items-center cursor-pointer shrink-0">
                            <input
                              type="checkbox"
                              checked={mrPolicy.enabled}
                              onChange={e => handleApprovalToggle('materialRequest', e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-10 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                          </label>
                        </div>

                        {/* Status banner */}
                        <div className="mt-3">
                          {mrPolicy.enabled ? (
                            <div className="p-2.5 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-300 text-[11px] flex items-start gap-2">
                              <ShieldCheck size={14} className="shrink-0 text-purple-600 dark:text-purple-400 mt-0.5" />
                              <div>
                                <span className="font-bold">Approval Mandatory: </span>
                                Requisition PDF generation is locked until approved by authorized personnel.
                              </div>
                            </div>
                          ) : (
                            <div className="p-2.5 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 text-[11px] flex items-center gap-2">
                              <Clock size={14} className="shrink-0" />
                              <span>Direct PDF generation is permitted without approval workflow.</span>
                            </div>
                          )}
                        </div>

                        {/* Approver Selection Options (only when enabled) */}
                        {mrPolicy.enabled && (
                          <div className="mt-3.5 space-y-3 pt-3 border-t border-gray-200/70 dark:border-gray-700/70">
                            <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300 block">
                              Who Can Approve Requisitions:
                            </span>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <label className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                                mrPolicy.allowAllUsers
                                  ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-300 dark:border-purple-700 text-purple-900 dark:text-purple-200 font-bold'
                                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-xs'
                              }`}>
                                <input
                                  type="radio"
                                  name="mrAllowAll"
                                  checked={mrPolicy.allowAllUsers}
                                  onChange={() => handleApprovalAllowAllToggle('materialRequest', true)}
                                  className="text-purple-600 focus:ring-purple-500"
                                />
                                <div className="text-xs">
                                  <div className="font-bold">All Created Users</div>
                                  <div className="text-[10px] text-gray-500 dark:text-gray-400 font-normal">Any active user can approve</div>
                                </div>
                              </label>

                              <label className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                                !mrPolicy.allowAllUsers
                                  ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-300 dark:border-purple-700 text-purple-900 dark:text-purple-200 font-bold'
                                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-xs'
                              }`}>
                                <input
                                  type="radio"
                                  name="mrAllowAll"
                                  checked={!mrPolicy.allowAllUsers}
                                  onChange={() => handleApprovalAllowAllToggle('materialRequest', false)}
                                  className="text-purple-600 focus:ring-purple-500"
                                />
                                <div className="text-xs">
                                  <div className="font-bold">Specific Approvers</div>
                                  <div className="text-[10px] text-gray-500 dark:text-gray-400 font-normal">Selected users only</div>
                                </div>
                              </label>
                            </div>

                            {/* Specific approvers selector */}
                            {!mrPolicy.allowAllUsers && (
                              <div className="space-y-2 mt-2 bg-white dark:bg-gray-900 p-3 rounded-xl border border-gray-200 dark:border-gray-700">
                                <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300">
                                  Select Authorized Approvers
                                </label>
                                <select
                                  onChange={e => {
                                    handleAddApprover('materialRequest', e.target.value);
                                    e.target.value = '';
                                  }}
                                  defaultValue=""
                                  className="w-full px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-semibold text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                                >
                                  <option value="" disabled>+ Add user as approver...</option>
                                  {availableUsers.map((u: any) => (
                                    <option key={u._id} value={u._id}>
                                      {u.name || u.username} {u.email ? `(${u.email})` : ''} - {typeof u.role === 'object' ? u.role?.name : u.role || 'Staff'}
                                    </option>
                                  ))}
                                </select>

                                {/* Approver chips */}
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                  {(mrPolicy.approverNames || []).map((name, idx) => (
                                    <span
                                      key={idx}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-100 dark:bg-purple-950/60 text-purple-900 dark:text-purple-200 rounded-lg text-xs font-semibold border border-purple-200 dark:border-purple-800"
                                    >
                                      <UserCheck size={11} className="text-purple-600 dark:text-purple-400" />
                                      <span>{name}</span>
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveApprover('materialRequest', idx)}
                                        className="text-purple-500 hover:text-purple-800 dark:hover:text-white p-0.5 rounded cursor-pointer"
                                        title="Remove Approver"
                                      >
                                        <X size={12} />
                                      </button>
                                    </span>
                                  ))}
                                  {(!mrPolicy.approverNames || mrPolicy.approverNames.length === 0) && (
                                    <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium italic">
                                      No approvers selected. Company Admins & GMs will retain approval rights.
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* 2. Outward Purchase Order (PO) Card */}
                {(() => {
                  const poPolicy = settings.approvalSettings?.outwardPo || DEFAULT_APPROVAL_SETTINGS.outwardPo;
                  const availableUsers = (allUsers || []).filter((u: any) => 
                    !(poPolicy.approvers || []).some(id => String(id) === String(u._id))
                  );

                  return (
                    <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/60 hover:bg-white dark:hover:bg-gray-800 transition-all flex flex-col justify-between gap-3">
                      <div>
                        {/* Header & Toggle */}
                        <div className="flex items-center justify-between gap-3 pb-3 border-b border-gray-200/70 dark:border-gray-700/70">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 shrink-0">
                              <Package size={16} />
                            </span>
                            <div className="min-w-0">
                              <h3 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white truncate">
                                Outward Purchase Order (PO)
                              </h3>
                              <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                                Procurement purchase orders sent to vendors
                              </p>
                            </div>
                          </div>

                          {/* Toggle switch */}
                          <label className="relative inline-flex items-center cursor-pointer shrink-0">
                            <input
                              type="checkbox"
                              checked={poPolicy.enabled}
                              onChange={e => handleApprovalToggle('outwardPo', e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-10 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                          </label>
                        </div>

                        {/* Status banner */}
                        <div className="mt-3">
                          {poPolicy.enabled ? (
                            <div className="p-2.5 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-300 text-[11px] flex items-start gap-2">
                              <ShieldCheck size={14} className="shrink-0 text-purple-600 dark:text-purple-400 mt-0.5" />
                              <div>
                                <span className="font-bold">Approval Mandatory: </span>
                                PO PDF generation is locked until the order status is set to Approved by authorized approver.
                              </div>
                            </div>
                          ) : (
                            <div className="p-2.5 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 text-[11px] flex items-center gap-2">
                              <Clock size={14} className="shrink-0" />
                              <span>Direct PDF generation is permitted without approval workflow.</span>
                            </div>
                          )}
                        </div>

                        {/* Approver Selection Options (only when enabled) */}
                        {poPolicy.enabled && (
                          <div className="mt-3.5 space-y-3 pt-3 border-t border-gray-200/70 dark:border-gray-700/70">
                            <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300 block">
                              Who Can Approve Outward POs:
                            </span>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <label className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                                poPolicy.allowAllUsers
                                  ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-300 dark:border-purple-700 text-purple-900 dark:text-purple-200 font-bold'
                                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-xs'
                              }`}>
                                <input
                                  type="radio"
                                  name="poAllowAll"
                                  checked={poPolicy.allowAllUsers}
                                  onChange={() => handleApprovalAllowAllToggle('outwardPo', true)}
                                  className="text-purple-600 focus:ring-purple-500"
                                />
                                <div className="text-xs">
                                  <div className="font-bold">All Created Users</div>
                                  <div className="text-[10px] text-gray-500 dark:text-gray-400 font-normal">Any active user can approve</div>
                                </div>
                              </label>

                              <label className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                                !poPolicy.allowAllUsers
                                  ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-300 dark:border-purple-700 text-purple-900 dark:text-purple-200 font-bold'
                                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-xs'
                              }`}>
                                <input
                                  type="radio"
                                  name="poAllowAll"
                                  checked={!poPolicy.allowAllUsers}
                                  onChange={() => handleApprovalAllowAllToggle('outwardPo', false)}
                                  className="text-purple-600 focus:ring-purple-500"
                                />
                                <div className="text-xs">
                                  <div className="font-bold">Specific Approvers</div>
                                  <div className="text-[10px] text-gray-500 dark:text-gray-400 font-normal">Selected users only</div>
                                </div>
                              </label>
                            </div>

                            {/* Specific approvers selector */}
                            {!poPolicy.allowAllUsers && (
                              <div className="space-y-2 mt-2 bg-white dark:bg-gray-900 p-3 rounded-xl border border-gray-200 dark:border-gray-700">
                                <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300">
                                  Select Authorized Approvers
                                </label>
                                <select
                                  onChange={e => {
                                    handleAddApprover('outwardPo', e.target.value);
                                    e.target.value = '';
                                  }}
                                  defaultValue=""
                                  className="w-full px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-semibold text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                                >
                                  <option value="" disabled>+ Add user as approver...</option>
                                  {availableUsers.map((u: any) => (
                                    <option key={u._id} value={u._id}>
                                      {u.name || u.username} {u.email ? `(${u.email})` : ''} - {typeof u.role === 'object' ? u.role?.name : u.role || 'Staff'}
                                    </option>
                                  ))}
                                </select>

                                {/* Approver chips */}
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                  {(poPolicy.approverNames || []).map((name, idx) => (
                                    <span
                                      key={idx}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-100 dark:bg-purple-950/60 text-purple-900 dark:text-purple-200 rounded-lg text-xs font-semibold border border-purple-200 dark:border-purple-800"
                                    >
                                      <UserCheck size={11} className="text-purple-600 dark:text-purple-400" />
                                      <span>{name}</span>
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveApprover('outwardPo', idx)}
                                        className="text-purple-500 hover:text-purple-800 dark:hover:text-white p-0.5 rounded cursor-pointer"
                                        title="Remove Approver"
                                      >
                                        <X size={12} />
                                      </button>
                                    </span>
                                  ))}
                                  {(!poPolicy.approverNames || poPolicy.approverNames.length === 0) && (
                                    <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium italic">
                                      No approvers selected. Company Admins & GMs will retain approval rights.
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Desktop Bottom Save Button */}
          <div className="hidden sm:flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center justify-center gap-2 px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold rounded-xl shadow-md transition-all disabled:opacity-50 text-sm cursor-pointer"
            >
              <Save size={18} />
              {saving ? 'Saving Settings...' : 'Save Store Settings'}
            </button>
          </div>

          {/* Mobile Sticky Floating Save Bar */}
          <div className="sm:hidden fixed bottom-3 inset-x-3 z-30 shadow-xl bg-white/95 dark:bg-gray-900/95 backdrop-blur-md p-2 rounded-2xl border border-gray-200 dark:border-gray-800 flex items-center justify-between gap-3">
            <span className="text-xs font-bold text-gray-700 dark:text-gray-300 pl-2">
              Store & Governance Settings
            </span>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="flex items-center justify-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold rounded-xl shadow-md text-xs cursor-pointer disabled:opacity-50"
            >
              <Save size={14} />
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

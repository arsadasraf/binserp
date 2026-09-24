"use client";

import React, { useState, useEffect } from 'react';
import LoadingSpinner from '@/src/components/LoadingSpinner';
import { API_BASE_URL } from '@/src/utils/config';
import { Hash, Tag, ShoppingCart, FileText, CheckCircle2, Save, IndianRupee, Globe, RefreshCw } from 'lucide-react';
import { DEFAULT_EXCHANGE_RATES_TO_INR, setGlobalExchangeRates, CURRENCY_OPTIONS, getCurrencySymbol } from '@/src/utils/currencyHelper';

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
}

export default function PrefixSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
  });

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeSubSection, setActiveSubSection] = useState<'all' | 'prefixes' | 'currency'>('all');

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
          setSettings(prev => ({ 
            ...prev, 
            ...data.settings,
            exchangeRates: mergedRates
          }));
          setGlobalExchangeRates(mergedRates);
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
        setMessage({ type: 'success', text: 'Prefix settings and Currency Conversion Rates updated successfully!' });
        alert('Prefix & Currency settings saved successfully!');
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

  if (loading) return <LoadingSpinner />;

  const renderSectionHeader = (title: string, icon: React.ReactNode, colorClass: string = "bg-indigo-600") => (
    <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
      <div className={`p-1.5 rounded-lg text-white ${colorClass}`}>
        {icon}
      </div>
      {title}
    </h3>
  );

  return (
    <div className="w-full min-h-full flex-1 space-y-6 pb-12 transition-all duration-300">
      <div className="w-full space-y-5">
        {/* Header Banner */}
        <div className="w-full bg-white dark:bg-gray-900 p-4 sm:p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex-1">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Hash className="text-indigo-600 dark:text-indigo-400 h-5 w-5 sm:h-6 sm:w-6" />
              Prefix Settings & Currency Conversion
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
              Configure autogenerated ID code formats and country-wise currency conversion rates against Indian Rupees (₹ INR).
            </p>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold rounded-xl shadow-md transition-all disabled:opacity-50 text-sm shrink-0 cursor-pointer"
            >
              <Save size={18} />
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>

        {/* Quick Section Switcher Pills */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center bg-white dark:bg-gray-900 p-1 rounded-xl border border-gray-200 dark:border-gray-800 shadow-2xs gap-1">
            <button
              type="button"
              onClick={() => setActiveSubSection('all')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
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
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
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
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeSubSection === 'currency'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/60 font-extrabold'
              }`}
            >
              <IndianRupee size={13} />
              <span>Currency Conversion Rates (INR ₹)</span>
            </button>
          </div>

          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Globe size={13} className="text-blue-500" />
            <span>Base Currency: <strong>Indian Rupee (₹1.00 INR)</strong></span>
          </div>
        </div>

        {/* Currency Rates Highlight Bar */}
        <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-slate-50 dark:from-blue-950/30 dark:via-indigo-950/20 dark:to-slate-900 p-3 sm:p-4 rounded-2xl border border-blue-100 dark:border-blue-900/50 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <IndianRupee size={18} />
            </div>
            <div>
              <div className="text-xs font-extrabold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                <span>Active Currency Conversion to ₹ INR</span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-200 dark:bg-blue-900 text-blue-900 dark:text-blue-100">
                  Applied in RFQs, POs & Invoices
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                {['USD', 'EUR', 'GBP', 'AED', 'CAD', 'AUD'].map(code => {
                  const rate = settings.exchangeRates?.[code] || DEFAULT_EXCHANGE_RATES_TO_INR[code] || 1;
                  const sym = getCurrencySymbol(code);
                  return (
                    <span key={code} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300">
                      <span>{sym} 1 {code}</span>
                      <span className="text-slate-400">=</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">₹{Number(rate).toFixed(2)}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setActiveSubSection('currency')}
            className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline shrink-0 flex items-center gap-1"
          >
            <span>Edit All Exchange Rates</span>
            <RefreshCw size={12} />
          </button>
        </div>

        {message && (
          <div className={`w-full p-4 rounded-xl text-sm font-medium flex items-center gap-2 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' : 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400 border border-red-200 dark:border-red-800'}`}>
            <CheckCircle2 size={18} />
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="w-full space-y-6">
          {(activeSubSection === 'all' || activeSubSection === 'prefixes') && (
            <>
          {/* Section 1: Master Entities */}
          <div className="w-full bg-white dark:bg-gray-900 p-4 sm:p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
            {renderSectionHeader("Master Entity Prefixes", <Tag size={18} />, "bg-indigo-600")}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-6">
              <div className="flex flex-col">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Customer Prefix</label>
                <input
                  type="text"
                  value={settings.customerPrefix || ''}
                  onChange={e => handleChange('customerPrefix', e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-gray-900 text-sm font-semibold transition-all text-gray-900 dark:text-white"
                  placeholder="e.g. CUS"
                />
                <span className="text-[11px] text-gray-400 dark:text-gray-500 mt-1 block">Format: CUS-001</span>
              </div>

              <div className="flex flex-col">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Vendor Prefix</label>
                <input
                  type="text"
                  value={settings.vendorPrefix || ''}
                  onChange={e => handleChange('vendorPrefix', e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-gray-900 text-sm font-semibold transition-all text-gray-900 dark:text-white"
                  placeholder="e.g. VEN"
                />
                <span className="text-[11px] text-gray-400 dark:text-gray-500 mt-1 block">Format: VEN-001</span>
              </div>

              <div className="flex flex-col">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Job Work Supplier Prefix</label>
                <input
                  type="text"
                  value={settings.jobWorkSupplierPrefix || ''}
                  onChange={e => handleChange('jobWorkSupplierPrefix', e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-gray-900 text-sm font-semibold transition-all text-gray-900 dark:text-white"
                  placeholder="e.g. JWS"
                />
                <span className="text-[11px] text-gray-400 dark:text-gray-500 mt-1 block">Format: JWS-001</span>
              </div>

              <div className="flex flex-col">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Category Prefix</label>
                <input
                  type="text"
                  value={settings.categoryPrefix || ''}
                  onChange={e => handleChange('categoryPrefix', e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-gray-900 text-sm font-semibold transition-all text-gray-900 dark:text-white"
                  placeholder="e.g. CAT"
                />
                <span className="text-[11px] text-gray-400 dark:text-gray-500 mt-1 block">Format: CAT-ABC-1234</span>
              </div>

              <div className="flex flex-col">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Item / Part Prefix</label>
                <input
                  type="text"
                  value={settings.partPrefix || ''}
                  onChange={e => handleChange('partPrefix', e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-gray-900 text-sm font-semibold transition-all text-gray-900 dark:text-white"
                  placeholder="e.g. PART"
                />
                <span className="text-[11px] text-gray-400 dark:text-gray-500 mt-1 block">Format: PART-001</span>
              </div>
            </div>
          </div>

          {/* Section 2: Purchasing & RFQ Prefixes */}
          <div className="w-full bg-white dark:bg-gray-900 p-4 sm:p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
            {renderSectionHeader("Purchasing & RFQ Prefixes", <ShoppingCart size={18} />, "bg-purple-600")}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-6">
              <div className="flex flex-col">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Incoming PO Prefix</label>
                <input
                  type="text"
                  value={settings.incomingPoPrefix || ''}
                  onChange={e => handleChange('incomingPoPrefix', e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:bg-white dark:focus:bg-gray-900 text-sm font-semibold transition-all text-gray-900 dark:text-white"
                  placeholder="e.g. PO-IN"
                />
                <span className="text-[11px] text-gray-400 dark:text-gray-500 mt-1 block">Format: PO-IN-2026-001</span>
              </div>

              <div className="flex flex-col">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Outward PO Prefix</label>
                <input
                  type="text"
                  value={settings.outwardPoPrefix || settings.outgoingPoPrefix || settings.poPrefix || ''}
                  onChange={e => {
                    handleChange('outwardPoPrefix', e.target.value);
                    handleChange('outgoingPoPrefix', e.target.value);
                    handleChange('poPrefix', e.target.value);
                  }}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:bg-white dark:focus:bg-gray-900 text-sm font-semibold transition-all text-gray-900 dark:text-white"
                  placeholder="e.g. PO-OUT"
                />
                <span className="text-[11px] text-gray-400 dark:text-gray-500 mt-1 block">Format: PO-OUT-2026-001</span>
              </div>

              <div className="flex flex-col">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Incoming RFQ Prefix</label>
                <input
                  type="text"
                  value={settings.incomingRfqPrefix || ''}
                  onChange={e => handleChange('incomingRfqPrefix', e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:bg-white dark:focus:bg-gray-900 text-sm font-semibold transition-all text-gray-900 dark:text-white"
                  placeholder="e.g. RFQ-IN"
                />
                <span className="text-[11px] text-gray-400 dark:text-gray-500 mt-1 block">Format: RFQ-IN-2026-001</span>
              </div>

              <div className="flex flex-col">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Outgoing RFQ / Quotation Outward</label>
                <input
                  type="text"
                  value={settings.outgoingRfqPrefix || settings.quotationOutwardPrefix || ''}
                  onChange={e => {
                    handleChange('outgoingRfqPrefix', e.target.value);
                    handleChange('quotationOutwardPrefix', e.target.value);
                  }}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:bg-white dark:focus:bg-gray-900 text-sm font-semibold transition-all text-gray-900 dark:text-white"
                  placeholder="e.g. QT-OUT"
                />
                <span className="text-[11px] text-gray-400 dark:text-gray-500 mt-1 block">Format: QT-OUT-2026-001</span>
              </div>

              <div className="flex flex-col">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Inward Quotation Prefix</label>
                <input
                  type="text"
                  value={settings.quotationInwardPrefix || ''}
                  onChange={e => handleChange('quotationInwardPrefix', e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:bg-white dark:focus:bg-gray-900 text-sm font-semibold transition-all text-gray-900 dark:text-white"
                  placeholder="e.g. QT-IN"
                />
                <span className="text-[11px] text-gray-400 dark:text-gray-500 mt-1 block">Format: QT-IN-2026-001</span>
              </div>
            </div>
          </div>

          {/* Section 3: Operations & Billing Prefixes */}
          <div className="w-full bg-white dark:bg-gray-900 p-4 sm:p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
            {renderSectionHeader("Sales, DC & Billing Prefixes", <FileText size={18} />, "bg-emerald-600")}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-6">
              <div className="flex flex-col">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Invoice Number Prefix</label>
                <input
                  type="text"
                  value={settings.invoicePrefix || ''}
                  onChange={e => handleChange('invoicePrefix', e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white dark:focus:bg-gray-900 text-sm font-semibold transition-all text-gray-900 dark:text-white"
                  placeholder="e.g. INV"
                />
                <span className="text-[11px] text-gray-400 dark:text-gray-500 mt-1 block">Format: INV-2026-001</span>
              </div>

              <div className="flex flex-col">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Delivery Challan (DC) Prefix</label>
                <input
                  type="text"
                  value={settings.dcPrefix || ''}
                  onChange={e => handleChange('dcPrefix', e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white dark:focus:bg-gray-900 text-sm font-semibold transition-all text-gray-900 dark:text-white"
                  placeholder="e.g. DC"
                />
                <span className="text-[11px] text-gray-400 dark:text-gray-500 mt-1 block">Format: DC-2026-001</span>
              </div>

              <div className="flex flex-col">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">RM / BO Items GRN Prefix</label>
                <input
                  type="text"
                  value={settings.rmBoGrnPrefix || settings.grnPrefix || ''}
                  onChange={e => {
                    handleChange('rmBoGrnPrefix', e.target.value);
                    handleChange('grnPrefix', e.target.value);
                  }}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white dark:focus:bg-gray-900 text-sm font-semibold transition-all text-gray-900 dark:text-white"
                  placeholder="e.g. GRN-RM"
                />
                <span className="text-[11px] text-gray-400 dark:text-gray-500 mt-1 block">Format: GRN-RM/20260808-120000</span>
              </div>

              <div className="flex flex-col">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">FG Items GRN Prefix</label>
                <input
                  type="text"
                  value={settings.fgGrnPrefix || ''}
                  onChange={e => handleChange('fgGrnPrefix', e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white dark:focus:bg-gray-900 text-sm font-semibold transition-all text-gray-900 dark:text-white"
                  placeholder="e.g. GRN-FG"
                />
                <span className="text-[11px] text-gray-400 dark:text-gray-500 mt-1 block">Format: GRN-FG/20260808-120000</span>
              </div>
            </div>
          </div>
          </>
          )}

          {/* Section 4: Currency Conversion Rates to INR */}
          {(activeSubSection === 'all' || activeSubSection === 'currency') && (
          <div className="w-full bg-white dark:bg-gray-900 p-4 sm:p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-1 border-b border-gray-100 dark:border-gray-800">
              {renderSectionHeader("Currency Conversion Rates to Indian Rupees (INR ₹)", <IndianRupee size={18} />, "bg-blue-600")}
              <button
                type="button"
                onClick={resetRatesToDefaults}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 bg-slate-100 hover:bg-blue-50 dark:bg-slate-800 dark:hover:bg-slate-700/80 rounded-xl transition-colors cursor-pointer"
                title="Reset all exchange rates to standard baseline benchmarks"
              >
                <RefreshCw size={13} />
                <span>Reset to Benchmarks</span>
              </button>
            </div>
            
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Set standard conversion exchange rates for each country/currency against <strong>₹1 INR</strong>. These company conversion rates are dynamically applied across <strong>Store &gt; Sales &gt; Inward RFQs, Customer POs, Quotations, and Billing</strong> to calculate and display consolidated Indian Rupee reporting totals.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-6 pt-2">
              {CURRENCY_OPTIONS.filter(c => c.code !== 'INR').map((curr) => {
                const currentRate = settings.exchangeRates?.[curr.code] !== undefined
                  ? settings.exchangeRates[curr.code]
                  : (DEFAULT_EXCHANGE_RATES_TO_INR[curr.code] || 1.0);

                return (
                  <div key={curr.code} className="flex flex-col p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                        <span className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold text-xs flex items-center justify-center">
                          {curr.symbol.trim() || curr.code}
                        </span>
                        {curr.name} ({curr.code})
                      </span>
                    </div>

                    <div className="relative flex items-center">
                      <span className="absolute left-3 text-xs font-semibold text-gray-400 dark:text-gray-500 select-none">
                        1 {curr.code} = ₹
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min="0.0001"
                        value={currentRate || ''}
                        onChange={e => handleRateChange(curr.code, e.target.value)}
                        className="w-full pl-24 pr-12 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm font-bold text-gray-900 dark:text-white transition-all"
                        placeholder="0.00"
                      />
                      <span className="absolute right-3 text-[11px] font-bold text-gray-400 dark:text-gray-500 select-none">
                        INR
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-1.5 block">
                      Benchmark: ₹{DEFAULT_EXCHANGE_RATES_TO_INR[curr.code] || '1.00'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none transition-all disabled:opacity-50 text-sm cursor-pointer"
            >
              <Save size={18} />
              {saving ? 'Saving Settings...' : 'Save Prefix Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

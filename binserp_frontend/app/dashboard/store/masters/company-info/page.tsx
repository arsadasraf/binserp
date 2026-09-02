"use client";

import React, { useState, useEffect } from 'react';
import LoadingSpinner from '@/src/components/LoadingSpinner';
import { API_BASE_URL } from '@/src/utils/config';
import { Building2, MapPin, Landmark, FileCheck2, ShieldCheck, CheckCircle2, Save, Upload } from 'lucide-react';

interface CompanyInfoData {
  companyName: string;
  legalName: string;
  tradeName: string;
  contactPerson: string;
  contactNumber: string;
  email: string;
  logo: string;
  gstNumber: string;
  panNumber: string;
  state: string;
  stateCode: string;
  pincode: string;
  city: string;
  district: string;
  einvoiceGstin: string;
  einvoiceUsername: string;
  einvoicePassword: string;
  ewayBillUsername: string;
  ewayBillPassword: string;
  lutNumber: string;
  billingAddress: string;
  shippingAddress: string;
  qualitySpecs: string;
  commercialTerms: string;
  bankDetails: {
    accountName: string;
    bankName: string;
    accountNumber: string;
    ifscCode: string;
    branch: string;
  };
  printSettings?: any;
}

export default function CompanyInfoPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');

  const [formData, setFormData] = useState<CompanyInfoData>({
    companyName: '',
    legalName: '',
    tradeName: '',
    contactPerson: '',
    contactNumber: '',
    email: '',
    logo: '',
    gstNumber: '',
    panNumber: '',
    state: '',
    stateCode: '',
    pincode: '',
    city: '',
    district: '',
    einvoiceGstin: '',
    einvoiceUsername: '',
    einvoicePassword: '',
    ewayBillUsername: '',
    ewayBillPassword: '',
    lutNumber: '',
    billingAddress: '',
    shippingAddress: '',
    qualitySpecs: '',
    commercialTerms: '',
    bankDetails: {
      accountName: '',
      bankName: '',
      accountNumber: '',
      ifscCode: '',
      branch: '',
    }
  });

  const [sameAsBilling, setSameAsBilling] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchCompanyInfo();
  }, []);

  const fetchCompanyInfo = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/store/company-info`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && (data.companyName || data.name)) {
          setFormData(prev => ({
            ...prev,
            ...data,
            bankDetails: {
              accountName: data.bankDetails?.accountName || '',
              bankName: data.bankDetails?.bankName || '',
              accountNumber: data.bankDetails?.accountNumber || '',
              ifscCode: data.bankDetails?.ifscCode || '',
              branch: data.bankDetails?.branch || '',
            }
          }));
          if (data.logo) {
            let fullLogo = data.logo;
            if (fullLogo && !fullLogo.startsWith('http') && !fullLogo.startsWith('data:')) {
              fullLogo = `${API_BASE_URL}${fullLogo.startsWith('/') ? '' : '/'}${fullLogo}`;
            }
            setLogoPreview(fullLogo);
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch company info:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setLogoFile(file);

      // Create base64 fallback and preview
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Str = reader.result as string;
        setLogoPreview(base64Str);
        setFormData(prev => ({ ...prev, logo: base64Str }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCopyBillingToShipping = () => {
    setSameAsBilling(!sameAsBilling);
    if (!sameAsBilling) {
      setFormData(prev => ({ ...prev, shippingAddress: prev.billingAddress }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setMessage(null);
      const token = localStorage.getItem('token');

      const submitData = new FormData();
      submitData.append('companyName', formData.companyName);
      submitData.append('legalName', formData.legalName || '');
      submitData.append('tradeName', formData.tradeName || '');
      submitData.append('contactPerson', formData.contactPerson);
      submitData.append('contactNumber', formData.contactNumber);
      submitData.append('email', formData.email || '');
      submitData.append('gstNumber', formData.gstNumber || '');
      submitData.append('panNumber', formData.panNumber || '');
      submitData.append('state', formData.state || '');
      submitData.append('stateCode', formData.stateCode || '');
      submitData.append('pincode', formData.pincode || '');
      submitData.append('city', formData.city || '');
      submitData.append('district', formData.district || '');
      submitData.append('einvoiceGstin', formData.einvoiceGstin || '');
      submitData.append('einvoiceUsername', formData.einvoiceUsername || '');
      submitData.append('einvoicePassword', formData.einvoicePassword || '');
      submitData.append('ewayBillUsername', formData.ewayBillUsername || '');
      submitData.append('ewayBillPassword', formData.ewayBillPassword || '');
      submitData.append('lutNumber', formData.lutNumber || '');
      submitData.append('billingAddress', formData.billingAddress);
      submitData.append('shippingAddress', formData.shippingAddress);
      submitData.append('qualitySpecs', formData.qualitySpecs || '');
      submitData.append('commercialTerms', formData.commercialTerms || '');
      submitData.append('bankDetails', JSON.stringify(formData.bankDetails));
      if (formData.logo) {
        submitData.append('logoStr', formData.logo);
      }

      if (logoFile) {
        submitData.append('logo', logoFile);
      }

      const res = await fetch(`${API_BASE_URL}/api/store/company-info`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: submitData
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: 'Company Information & Logo saved successfully!' });
        alert('Company Information & Logo saved successfully!');
        const updated = data.info || formData;
        if (updated.logo) {
          let fullLogo = updated.logo;
          if (fullLogo && !fullLogo.startsWith('http') && !fullLogo.startsWith('data:')) {
            fullLogo = `${API_BASE_URL}${fullLogo.startsWith('/') ? '' : '/'}${fullLogo}`;
          }
          setLogoPreview(fullLogo);
        }
        try {
          localStorage.setItem('storeCompanyInfo', JSON.stringify({ ...formData, ...(data.info || {}) }));
        } catch (e) {}
      } else {
        throw new Error(data.message || 'Failed to save company information');
      }
    } catch (error: any) {
      console.error('Error saving company info:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to save company information' });
      alert(`Error saving Company Info: ${error.message || 'Failed to save company information'}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  const renderSectionHeader = (title: string, icon: React.ReactNode, colorClass: string = "bg-indigo-600") => (
    <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
      <div className={`p-1.5 rounded-lg text-white ${colorClass}`}>
        {icon}
      </div>
      {title}
    </h3>
  );

  return (
    <div className="w-full min-h-full flex-1 space-y-6 pb-12 transition-all duration-300">
      <div className="w-full space-y-6">
        {/* Header Banner */}
        <div className="w-full bg-white dark:bg-gray-900 p-4 sm:p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex-1">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Building2 className="text-indigo-600 dark:text-indigo-400 h-5 w-5 sm:h-6 sm:w-6" />
              Company Information & Document Printing Settings
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
              Configure company details, logo for invoices/documents, and credentials for e-Invoicing & e-Way Bills.
            </p>
          </div>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold rounded-xl shadow-md transition-all disabled:opacity-50 text-sm shrink-0 cursor-pointer"
          >
            <Save size={18} />
            {saving ? 'Saving...' : 'Save Company Info'}
          </button>
        </div>

        {message && (
          <div className={`w-full p-4 rounded-xl text-sm font-medium flex items-center gap-2 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' : 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400 border border-red-200 dark:border-red-800'}`}>
            <CheckCircle2 size={18} />
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="w-full space-y-6">
          {/* Section 1: Basic Company Info & Logo */}
          <div className="w-full bg-white dark:bg-gray-900 p-4 sm:p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
            {renderSectionHeader("General Company Details & Logo", <Building2 size={18} />, "bg-indigo-600")}
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-6">
              <div className="flex flex-col">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  Company Display Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.companyName}
                  onChange={e => setFormData({ ...formData, companyName: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-gray-900 text-sm font-semibold transition-all text-gray-900 dark:text-white"
                  placeholder="e.g. Acme Manufacturing Pvt Ltd"
                />
              </div>

              <div className="flex flex-col">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Legal Name (as per GST)</label>
                <input
                  type="text"
                  value={formData.legalName}
                  onChange={e => setFormData({ ...formData, legalName: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-gray-900 text-sm font-semibold transition-all text-gray-900 dark:text-white"
                  placeholder="Legal Business Name"
                />
              </div>

              <div className="flex flex-col">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Trade Name</label>
                <input
                  type="text"
                  value={formData.tradeName}
                  onChange={e => setFormData({ ...formData, tradeName: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-gray-900 text-sm font-semibold transition-all text-gray-900 dark:text-white"
                  placeholder="Trade / Brand Name"
                />
              </div>

              <div className="flex flex-col">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  Contact Person <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.contactPerson}
                  onChange={e => setFormData({ ...formData, contactPerson: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-gray-900 text-sm font-semibold transition-all text-gray-900 dark:text-white"
                  placeholder="Contact Person Name"
                />
              </div>

              <div className="flex flex-col">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  Contact Phone Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.contactNumber}
                  onChange={e => setFormData({ ...formData, contactNumber: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-gray-900 text-sm font-semibold transition-all text-gray-900 dark:text-white"
                  placeholder="+91 9876543210"
                />
              </div>

              <div className="flex flex-col">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Email Address</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-gray-900 text-sm font-semibold transition-all text-gray-900 dark:text-white"
                  placeholder="billing@company.com"
                />
              </div>

              {/* Prominently Show GSTIN Number */}
              <div className="flex flex-col">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center justify-between">
                  <span>Company GSTIN</span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold uppercase">Printed on Header</span>
                </label>
                <input
                  type="text"
                  value={formData.gstNumber}
                  onChange={e => setFormData({ ...formData, gstNumber: e.target.value.toUpperCase() })}
                  className="w-full px-4 py-2.5 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl focus:ring-2 focus:ring-emerald-500 text-sm font-mono font-bold transition-all text-gray-900 dark:text-white tracking-wider"
                  placeholder="29AAAAA0000A1Z5"
                />
              </div>

              {/* Prominently Show PAN Number */}
              <div className="flex flex-col">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center justify-between">
                  <span>Company PAN</span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold uppercase">Printed on Header</span>
                </label>
                <input
                  type="text"
                  value={formData.panNumber}
                  onChange={e => setFormData({ ...formData, panNumber: e.target.value.toUpperCase() })}
                  className="w-full px-4 py-2.5 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl focus:ring-2 focus:ring-emerald-500 text-sm font-mono font-bold transition-all text-gray-900 dark:text-white tracking-wider"
                  placeholder="ABCDE1234F"
                />
              </div>

              {/* Logo Upload Box with Full Specifications & Instructions */}
              <div className="sm:col-span-2 md:col-span-3 lg:col-span-4 2xl:col-span-5 bg-gradient-to-br from-slate-50 to-indigo-50/30 dark:from-slate-800/60 dark:to-indigo-950/30 p-4 sm:p-5 rounded-2xl border border-indigo-100 dark:border-indigo-900/50">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex-1 space-y-1">
                    <label className="block text-xs font-black text-indigo-950 dark:text-indigo-200 uppercase tracking-wider">
                      Official Company Logo (Printed on POs, DCs & Invoices)
                    </label>
                    <div className="text-xs text-gray-600 dark:text-gray-300 space-y-1 leading-relaxed">
                      <div>• <b>Recommended Dimensions:</b> <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">300 × 100 px</span> or <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">400 × 120 px</span> (Horizontal Aspect Ratio 3:1 to 4:1).</div>
                      <div>• <b>Supported Formats:</b> <span className="font-bold">PNG</span> (recommended with transparent background), <span className="font-bold">JPEG</span>, or <span className="font-bold">WebP</span>. Max size: <b>2 MB</b>.</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <label className="cursor-pointer flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 border-2 border-dashed border-indigo-300 dark:border-indigo-700 hover:border-indigo-500 dark:hover:border-indigo-400 text-indigo-700 dark:text-indigo-300 rounded-xl font-bold text-xs shadow-sm hover:bg-indigo-50/50 transition-all">
                      <Upload size={16} />
                      <span>{logoPreview ? 'Change Logo Image' : 'Upload Logo Image'}</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        onChange={handleLogoChange}
                        className="hidden"
                      />
                    </label>

                    {logoPreview ? (
                      <div className="h-16 w-36 p-1.5 border-2 border-indigo-200 dark:border-indigo-800 rounded-xl bg-white dark:bg-gray-800 flex items-center justify-center shadow-inner overflow-hidden">
                        <img src={logoPreview} alt="Company Logo Preview" className="max-h-full max-w-full object-contain" />
                      </div>
                    ) : (
                      <div className="h-16 w-36 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl flex flex-col items-center justify-center text-[10px] text-gray-400 text-center p-1">
                        <span>No Logo Uploaded</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Live Header Preview */}
                <div className="mt-4 pt-4 border-t border-indigo-100 dark:border-indigo-900/50">
                  <div className="text-[11px] font-bold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider mb-2">
                    Live Document Header Preview:
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="space-y-1">
                      <div className="text-sm font-black text-purple-900 dark:text-purple-300 uppercase tracking-wide">
                        {formData.companyName || 'YOUR COMPANY NAME'}
                      </div>
                      <div className="text-[11px] text-gray-600 dark:text-gray-400">
                        {formData.billingAddress || 'Billing Address Line, City, State'}
                      </div>
                      <div className="text-[11px] text-gray-700 dark:text-gray-300 flex flex-wrap gap-2 pt-0.5">
                        {formData.contactPerson && <span><b>Contact:</b> {formData.contactPerson}</span>}
                        {formData.contactNumber && <span>• <b>Ph:</b> {formData.contactNumber}</span>}
                        {formData.email && <span>• <b>Email:</b> {formData.email}</span>}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 pt-0.5 font-mono">
                        <b>GSTIN:</b> {formData.gstNumber || 'N/A'} &nbsp;|&nbsp; <b>PAN:</b> {formData.panNumber || 'N/A'}
                      </div>
                    </div>

                    {logoPreview ? (
                      <div className="shrink-0 p-1 bg-white rounded-lg border border-gray-100 dark:border-gray-800">
                        <img src={logoPreview} alt="Logo Preview" className="h-12 max-w-[140px] object-contain" />
                      </div>
                    ) : (
                      <div className="text-xs italic text-gray-400">
                        [Logo will appear here]
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Address & Location Info */}
          <div className="w-full bg-white dark:bg-gray-900 p-4 sm:p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
            {renderSectionHeader("Address & Location Details", <MapPin size={18} />, "bg-purple-600")}
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-6">
              <div className="sm:col-span-2 md:col-span-3 lg:col-span-4 2xl:col-span-5">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  Billing Address <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  value={formData.billingAddress}
                  onChange={e => setFormData({ ...formData, billingAddress: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:bg-white dark:focus:bg-gray-900 text-sm font-semibold transition-all text-gray-900 dark:text-white"
                  placeholder="Full Billing Address"
                />
              </div>

              <div className="sm:col-span-2 md:col-span-3 lg:col-span-4 2xl:col-span-5">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                    Shipping Address <span className="text-red-500">*</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-purple-600 dark:text-purple-400 cursor-pointer font-bold">
                    <input
                      type="checkbox"
                      checked={sameAsBilling}
                      onChange={handleCopyBillingToShipping}
                      className="rounded border-gray-300 dark:border-gray-700 text-purple-600 focus:ring-purple-500"
                    />
                    Same as Billing Address
                  </label>
                </div>
                <textarea
                  required
                  rows={2}
                  value={formData.shippingAddress}
                  onChange={e => setFormData({ ...formData, shippingAddress: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:bg-white dark:focus:bg-gray-900 text-sm font-semibold transition-all text-gray-900 dark:text-white"
                  placeholder="Full Shipping Address"
                />
              </div>

              <div className="flex flex-col">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">City</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={e => setFormData({ ...formData, city: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:bg-white dark:focus:bg-gray-900 text-sm font-semibold transition-all text-gray-900 dark:text-white"
                  placeholder="City"
                />
              </div>

              <div className="flex flex-col">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">District</label>
                <input
                  type="text"
                  value={formData.district}
                  onChange={e => setFormData({ ...formData, district: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:bg-white dark:focus:bg-gray-900 text-sm font-semibold transition-all text-gray-900 dark:text-white"
                  placeholder="District"
                />
              </div>

              <div className="flex flex-col">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">State</label>
                <input
                  type="text"
                  value={formData.state}
                  onChange={e => setFormData({ ...formData, state: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:bg-white dark:focus:bg-gray-900 text-sm font-semibold transition-all text-gray-900 dark:text-white"
                  placeholder="e.g. Karnataka"
                />
              </div>

              <div className="flex flex-col">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">State Code (e.g. 29)</label>
                <input
                  type="text"
                  value={formData.stateCode}
                  onChange={e => setFormData({ ...formData, stateCode: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:bg-white dark:focus:bg-gray-900 text-sm font-semibold transition-all text-gray-900 dark:text-white"
                  placeholder="e.g. 29"
                />
              </div>

              <div className="flex flex-col">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Pincode / Postal Code</label>
                <input
                  type="text"
                  value={formData.pincode}
                  onChange={e => setFormData({ ...formData, pincode: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:bg-white dark:focus:bg-gray-900 text-sm font-semibold transition-all text-gray-900 dark:text-white"
                  placeholder="e.g. 560001"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Taxation, e-Invoicing & e-Way Bill Credentials */}
          <div className="w-full bg-white dark:bg-gray-900 p-4 sm:p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
            {renderSectionHeader("Taxation, e-Invoicing & e-Way Bill Integration", <ShieldCheck size={18} />, "bg-emerald-600")}
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-6">
              <div className="flex flex-col">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">GSTIN Number</label>
                <input
                  type="text"
                  value={formData.gstNumber}
                  onChange={e => setFormData({ ...formData, gstNumber: e.target.value.toUpperCase() })}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white dark:focus:bg-gray-900 text-sm font-semibold transition-all text-gray-900 dark:text-white"
                  placeholder="e.g. 29AAAAA0000A1Z5"
                />
              </div>

              <div className="flex flex-col">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">PAN Number</label>
                <input
                  type="text"
                  value={formData.panNumber}
                  onChange={e => setFormData({ ...formData, panNumber: e.target.value.toUpperCase() })}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white dark:focus:bg-gray-900 text-sm font-semibold transition-all text-gray-900 dark:text-white"
                  placeholder="e.g. ABCDE1234F"
                />
              </div>

              <div className="flex flex-col">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">LUT Number (For Export)</label>
                <input
                  type="text"
                  value={formData.lutNumber}
                  onChange={e => setFormData({ ...formData, lutNumber: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white dark:focus:bg-gray-900 text-sm font-semibold transition-all text-gray-900 dark:text-white"
                  placeholder="LUT Document Number"
                />
              </div>

              <div className="flex flex-col">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">e-Invoice Portal GSTIN</label>
                <input
                  type="text"
                  value={formData.einvoiceGstin}
                  onChange={e => setFormData({ ...formData, einvoiceGstin: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white dark:focus:bg-gray-900 text-sm font-semibold transition-all text-gray-900 dark:text-white"
                  placeholder="e-Invoice GSTIN"
                />
              </div>

              <div className="flex flex-col">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">e-Invoice API Username</label>
                <input
                  type="text"
                  value={formData.einvoiceUsername}
                  onChange={e => setFormData({ ...formData, einvoiceUsername: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white dark:focus:bg-gray-900 text-sm font-semibold transition-all text-gray-900 dark:text-white"
                  placeholder="API Username"
                />
              </div>

              <div className="flex flex-col">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">e-Invoice API Password</label>
                <input
                  type="password"
                  value={formData.einvoicePassword}
                  onChange={e => setFormData({ ...formData, einvoicePassword: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white dark:focus:bg-gray-900 text-sm font-semibold transition-all text-gray-900 dark:text-white"
                  placeholder="API Password"
                />
              </div>

              <div className="flex flex-col">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">e-Way Bill Username</label>
                <input
                  type="text"
                  value={formData.ewayBillUsername}
                  onChange={e => setFormData({ ...formData, ewayBillUsername: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white dark:focus:bg-gray-900 text-sm font-semibold transition-all text-gray-900 dark:text-white"
                  placeholder="e-Way Bill Username"
                />
              </div>

              <div className="flex flex-col">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">e-Way Bill Password</label>
                <input
                  type="password"
                  value={formData.ewayBillPassword}
                  onChange={e => setFormData({ ...formData, ewayBillPassword: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white dark:focus:bg-gray-900 text-sm font-semibold transition-all text-gray-900 dark:text-white"
                  placeholder="e-Way Bill Password"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Bank Details */}
          <div className="w-full bg-white dark:bg-gray-900 p-4 sm:p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
            {renderSectionHeader("Bank Account Details (For Printing on Invoices)", <Landmark size={18} />, "bg-blue-600")}
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-6">
              <div className="flex flex-col">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Account Name</label>
                <input
                  type="text"
                  value={formData.bankDetails.accountName}
                  onChange={e => setFormData({ ...formData, bankDetails: { ...formData.bankDetails, accountName: e.target.value } })}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-gray-900 text-sm font-semibold transition-all text-gray-900 dark:text-white"
                  placeholder="e.g. Acme Manufacturing Ltd"
                />
              </div>

              <div className="flex flex-col">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Bank Name</label>
                <input
                  type="text"
                  value={formData.bankDetails.bankName}
                  onChange={e => setFormData({ ...formData, bankDetails: { ...formData.bankDetails, bankName: e.target.value } })}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-gray-900 text-sm font-semibold transition-all text-gray-900 dark:text-white"
                  placeholder="e.g. HDFC Bank"
                />
              </div>

              <div className="flex flex-col">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Account Number</label>
                <input
                  type="text"
                  value={formData.bankDetails.accountNumber}
                  onChange={e => setFormData({ ...formData, bankDetails: { ...formData.bankDetails, accountNumber: e.target.value } })}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-gray-900 text-sm font-semibold transition-all text-gray-900 dark:text-white"
                  placeholder="Account Number"
                />
              </div>

              <div className="flex flex-col">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">IFSC Code</label>
                <input
                  type="text"
                  value={formData.bankDetails.ifscCode}
                  onChange={e => setFormData({ ...formData, bankDetails: { ...formData.bankDetails, ifscCode: e.target.value.toUpperCase() } })}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-gray-900 text-sm font-semibold transition-all text-gray-900 dark:text-white"
                  placeholder="e.g. HDFC0001234"
                />
              </div>

              <div className="flex flex-col">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Branch Name</label>
                <input
                  type="text"
                  value={formData.bankDetails.branch}
                  onChange={e => setFormData({ ...formData, bankDetails: { ...formData.bankDetails, branch: e.target.value } })}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-gray-900 text-sm font-semibold transition-all text-gray-900 dark:text-white"
                  placeholder="Branch Location"
                />
              </div>
            </div>
          </div>

          {/* Section 5: Terms & Print Specs */}
          <div className="w-full bg-white dark:bg-gray-900 p-4 sm:p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
            {renderSectionHeader("Document Printing & Terms Configuration", <FileCheck2 size={18} />, "bg-amber-600")}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <div className="flex flex-col">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Quality Specifications (Default Note)</label>
                <textarea
                  rows={3}
                  value={formData.qualitySpecs}
                  onChange={e => setFormData({ ...formData, qualitySpecs: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-amber-500 focus:bg-white dark:focus:bg-gray-900 text-sm font-semibold transition-all text-gray-900 dark:text-white"
                  placeholder="Enter default quality specs note for documents..."
                />
              </div>

              <div className="flex flex-col">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Commercial Terms & Conditions</label>
                <textarea
                  rows={3}
                  value={formData.commercialTerms}
                  onChange={e => setFormData({ ...formData, commercialTerms: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-amber-500 focus:bg-white dark:focus:bg-gray-900 text-sm font-semibold transition-all text-gray-900 dark:text-white"
                  placeholder="Enter terms & conditions printed on invoices & purchase orders..."
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none transition-all disabled:opacity-50 text-sm cursor-pointer"
            >
              <Save size={18} />
              {saving ? 'Saving Information...' : 'Save Company Information'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

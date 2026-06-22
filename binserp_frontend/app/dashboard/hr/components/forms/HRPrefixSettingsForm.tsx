"use client";
import { useState, useEffect, useRef } from 'react';
import { API_BASE_URL } from '@/src/utils/config';
import { Edit2, Save, X, Upload, Building2, FileText, Image as ImageIcon } from 'lucide-react';
import LoadingSpinner from '@/src/components/LoadingSpinner';

interface HRSettings {
    employeePrefix: string;
    offerLetterPrefix: string;
    paymentSlipPrefix: string;
    companyName: string;
    companyLogo: string;
    companyAddress: string;
    companyPhone: string;
    companyEmail: string;
    currency: string;
}

interface HRPrefixSettingsFormProps {
    token: string | null;
    onError: (message: string) => void;
    onSuccess: (message: string) => void;
}

export default function HRPrefixSettingsForm({ token, onError, onSuccess }: HRPrefixSettingsFormProps) {
    const [settings, setSettings] = useState<HRSettings>({
        employeePrefix: 'EMP',
        offerLetterPrefix: 'OL',
        paymentSlipPrefix: 'PAY',
        companyName: '',
        companyLogo: '',
        companyAddress: '',
        companyPhone: '',
        companyEmail: '',
        currency: '₹',
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [originalSettings, setOriginalSettings] = useState<HRSettings | null>(null);
    const [logoPreview, setLogoPreview] = useState<string>('');
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { fetchSettings(); }, [token]);

    const fetchSettings = async () => {
        if (!token) return;
        try {
            setLoading(true);
            const res = await fetch(`${API_BASE_URL}/api/hr-prefix`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Failed to fetch settings');
            const data = await res.json();
            if (data.settings) {
                const s: HRSettings = {
                    employeePrefix: data.settings.employeePrefix || 'EMP',
                    offerLetterPrefix: data.settings.offerLetterPrefix || 'OL',
                    paymentSlipPrefix: data.settings.paymentSlipPrefix || 'PAY',
                    companyName: data.settings.companyName || '',
                    companyLogo: data.settings.companyLogo || '',
                    companyAddress: data.settings.companyAddress || '',
                    companyPhone: data.settings.companyPhone || '',
                    companyEmail: data.settings.companyEmail || '',
                    currency: data.settings.currency || '₹',
                };
                setSettings(s);
                setOriginalSettings(s);
                if (s.companyLogo) setLogoPreview(s.companyLogo);
            }
        } catch (err: any) {
            onError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setSettings({ ...settings, [e.target.name]: e.target.value });
    };

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setLogoFile(file);
        setLogoPreview(URL.createObjectURL(file));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!token) return;
        try {
            setSaving(true);
            const formData = new FormData();
            formData.append('employeePrefix', settings.employeePrefix);
            formData.append('offerLetterPrefix', settings.offerLetterPrefix);
            formData.append('paymentSlipPrefix', settings.paymentSlipPrefix);
            formData.append('companyName', settings.companyName);
            formData.append('companyAddress', settings.companyAddress);
            formData.append('companyPhone', settings.companyPhone);
            formData.append('companyEmail', settings.companyEmail);
            formData.append('currency', settings.currency);
            if (logoFile) formData.append('logo', logoFile);

            const res = await fetch(`${API_BASE_URL}/api/hr-prefix`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || 'Failed to update settings');
            }
            const data = await res.json();
            const updated: HRSettings = {
                ...settings,
                companyLogo: data.settings?.companyLogo || settings.companyLogo,
            };
            setSettings(updated);
            setOriginalSettings(updated);
            setLogoFile(null);
            setIsEditing(false);
            onSuccess('Settings updated successfully');
        } catch (err: any) {
            onError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        if (originalSettings) {
            setSettings(originalSettings);
            setLogoPreview(originalSettings.companyLogo || '');
            setLogoFile(null);
        }
        setIsEditing(false);
    };

    if (loading) return <div className="p-8"><LoadingSpinner /></div>;

    return (
        <div className="space-y-6">

            {/* ── Branding Section ── */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                            <Building2 className="text-indigo-600 dark:text-indigo-400" size={22} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Company Branding</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Name, logo and contact info used in generated PDFs</p>
                        </div>
                    </div>
                    {!isEditing && (
                        <button
                            type="button"
                            onClick={() => setIsEditing(true)}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium text-sm transition-colors flex items-center gap-2"
                        >
                            <Edit2 size={16} /> Edit Settings
                        </button>
                    )}
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">

                    {/* Logo + Company Name row */}
                    <div className="flex flex-col sm:flex-row gap-6 items-start">
                        {/* Logo Upload */}
                        <div className="flex flex-col items-center gap-3">
                            <div
                                className={`w-28 h-28 rounded-xl border-2 border-dashed flex items-center justify-center overflow-hidden cursor-pointer transition-colors
                                    ${isEditing ? 'border-indigo-400 hover:border-indigo-600 bg-indigo-50 dark:bg-indigo-900/10' : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900'}`}
                                onClick={() => isEditing && fileInputRef.current?.click()}
                            >
                                {logoPreview ? (
                                    <img src={logoPreview} alt="Company Logo" className="w-full h-full object-contain p-1" />
                                ) : (
                                    <div className="flex flex-col items-center gap-1 text-gray-400">
                                        <ImageIcon size={28} />
                                        <span className="text-xs">Logo</span>
                                    </div>
                                )}
                            </div>
                            {isEditing && (
                                <button type="button" onClick={() => fileInputRef.current?.click()}
                                    className="text-xs text-indigo-600 dark:text-indigo-400 flex items-center gap-1 hover:underline">
                                    <Upload size={12} /> Upload Logo
                                </button>
                            )}
                            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                        </div>

                        {/* Company Name & Address */}
                        <div className="flex-1 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Company Name</label>
                                <input
                                    type="text" name="companyName" value={settings.companyName}
                                    onChange={handleChange} disabled={!isEditing} placeholder="e.g. BinsAnalytics Pvt. Ltd."
                                    className={`w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-gray-900 dark:text-gray-100 ${!isEditing && 'opacity-60 cursor-not-allowed'}`}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Address</label>
                                <textarea
                                    name="companyAddress" value={settings.companyAddress}
                                    onChange={handleChange as any} disabled={!isEditing} rows={2} placeholder="Street, City, State - Pincode"
                                    className={`w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-gray-900 dark:text-gray-100 resize-none ${!isEditing && 'opacity-60 cursor-not-allowed'}`}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
                                    <input type="text" name="companyPhone" value={settings.companyPhone}
                                        onChange={handleChange} disabled={!isEditing} placeholder="+91 XXXXX XXXXX"
                                        className={`w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-gray-900 dark:text-gray-100 ${!isEditing && 'opacity-60 cursor-not-allowed'}`}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                                    <input type="email" name="companyEmail" value={settings.companyEmail}
                                        onChange={handleChange} disabled={!isEditing} placeholder="hr@company.com"
                                        className={`w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-gray-900 dark:text-gray-100 ${!isEditing && 'opacity-60 cursor-not-allowed'}`}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── Prefix Section ── */}
                    <div className="border-t border-gray-100 dark:border-gray-700 pt-6">
                        <div className="flex items-center gap-2 mb-4">
                            <FileText size={18} className="text-indigo-500" />
                            <h3 className="font-semibold text-gray-800 dark:text-gray-100 text-sm">Document ID Prefixes</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            {[
                                { label: 'Employee ID Prefix', name: 'employeePrefix', example: '-001', ph: 'EMP' },
                                { label: 'Offer Letter Prefix', name: 'offerLetterPrefix', example: '-2024-001', ph: 'OL' },
                                { label: 'Payment Slip Prefix', name: 'paymentSlipPrefix', example: '-JAN-001', ph: 'PAY' },
                                { label: 'Currency Symbol', name: 'currency', example: ' 5,000', ph: '₹' },
                            ].map(f => (
                                <div key={f.name}>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{f.label}</label>
                                    <input
                                        type="text" name={f.name} value={(settings as any)[f.name]}
                                        onChange={handleChange} disabled={!isEditing} placeholder={`e.g. ${f.ph}`}
                                        className={`w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all uppercase text-gray-900 dark:text-gray-100 ${!isEditing && 'opacity-60 cursor-not-allowed'}`}
                                    />
                                    <p className="text-xs text-gray-400 mt-1">Example: {(settings as any)[f.name] || f.ph}{f.example}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Action Buttons */}
                    {isEditing && (
                        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                            <button type="button" onClick={handleCancel} disabled={saving}
                                className="px-5 py-2.5 bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 font-medium transition-colors flex items-center gap-2">
                                <X size={18} /> Cancel
                            </button>
                            <button type="submit" disabled={saving}
                                className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors flex items-center gap-2 disabled:opacity-70">
                                {saving ? (
                                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</>
                                ) : (
                                    <><Save size={18} /> Save Changes</>
                                )}
                            </button>
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
}

import { useState, useEffect } from 'react';
import { API_BASE_URL } from '@/src/utils/config';
import { Edit2, Save, X } from 'lucide-react';
import LoadingSpinner from '@/src/components/LoadingSpinner';

interface StorePrefixSettings {
    grnPrefix: string;
    poPrefix: string;
    dcPrefix: string;
    invoicePrefix: string;
    partPrefix: string;
    vendorPrefix: string;
    customerPrefix: string;
    jobWorkSupplierPrefix: string;
    incomingRfqPrefix: string;
    quotationOutwardPrefix: string;
    quotationInwardPrefix: string;
}

interface StorePrefixFormProps {
    token: string | null;
    onError: (message: string) => void;
    onSuccess: (message: string) => void;
}

export default function StorePrefixForm({ token, onError, onSuccess }: StorePrefixFormProps) {
    const [settings, setSettings] = useState<StorePrefixSettings>({
        grnPrefix: '',
        poPrefix: '',
        dcPrefix: '',
        invoicePrefix: '',
        partPrefix: '',
        vendorPrefix: '',
        customerPrefix: '',
        jobWorkSupplierPrefix: '',
        incomingRfqPrefix: '',
        quotationOutwardPrefix: '',
        quotationInwardPrefix: '',
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [isEditing, setIsEditing] = useState(false);
    const [originalSettings, setOriginalSettings] = useState<StorePrefixSettings | null>(null);

    useEffect(() => {
        fetchSettings();
    }, [token]);

    const fetchSettings = async () => {
        if (!token) return;
        try {
            setLoading(true);
            const response = await fetch(`${API_BASE_URL}/api/store/prefix`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Failed to fetch prefix settings');
            }
            const data = await response.json();
            if (data.settings) {
                const fetchedSettings = {
                    grnPrefix: data.settings.grnPrefix || 'GRN',
                    poPrefix: data.settings.poPrefix || 'PO',
                    dcPrefix: data.settings.dcPrefix || 'DC',
                    invoicePrefix: data.settings.invoicePrefix || 'INV',
                    partPrefix: data.settings.partPrefix || 'PART',
                    vendorPrefix: data.settings.vendorPrefix || 'VEN',
                    customerPrefix: data.settings.customerPrefix || 'CUS',
                    jobWorkSupplierPrefix: data.settings.jobWorkSupplierPrefix || 'JWS',
                    incomingRfqPrefix: data.settings.incomingRfqPrefix || 'RFQ',
                    quotationOutwardPrefix: data.settings.quotationOutwardPrefix || 'QT-OUT',
                    quotationInwardPrefix: data.settings.quotationInwardPrefix || 'QT-IN',
                };
                setSettings(fetchedSettings);
                setOriginalSettings(fetchedSettings);
            }
        } catch (error: any) {
            onError(error?.message || (typeof error === 'string' ? error : 'Failed to fetch settings'));
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!token) return;

        try {
            setSaving(true);
            const response = await fetch(`${API_BASE_URL}/api/store/prefix`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(settings)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || errorData.message || 'Failed to update settings');
            }

            onSuccess('Prefix settings updated successfully');
            setOriginalSettings(settings);
            setIsEditing(false);
        } catch (error: any) {
            onError(error?.message || (typeof error === 'string' ? error : 'Failed to update settings'));
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        if (originalSettings) {
            setSettings(originalSettings);
        }
        setIsEditing(false);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSettings({ ...settings, [e.target.name]: e.target.value });
    };

    if (loading) return <div className="p-8"><LoadingSpinner /></div>;

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 w-full">
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg text-indigo-600 dark:text-indigo-400">
                    <Edit2 size={24} />
                </div>
                <div>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Global Prefix Configuration</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Set default prefixes for auto-generated codes</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">GRN Prefix</label>
                        <div className="relative">
                            <input
                                type="text"
                                name="grnPrefix"
                                value={settings.grnPrefix}
                                onChange={handleChange}
                                disabled={!isEditing}
                                className={`w-full pl-4 pr-10 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all uppercase ${!isEditing && 'opacity-60 cursor-not-allowed'}`}
                                placeholder="e.g. GRN"
                            />
                        </div>
                        <p className="text-xs text-gray-400 mt-1">Example: {settings.grnPrefix}-2024-001</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">PO Prefix</label>
                        <div className="relative">
                            <input
                                type="text"
                                name="poPrefix"
                                value={settings.poPrefix}
                                onChange={handleChange}
                                disabled={!isEditing}
                                className={`w-full pl-4 pr-10 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all uppercase ${!isEditing ? 'opacity-60 cursor-not-allowed' : ''}`}
                                placeholder="e.g. PO"
                            />
                        </div>
                        <p className="text-xs text-gray-400 mt-1">Example: {settings.poPrefix}-2024-001</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">DC Prefix</label>
                        <div className="relative">
                            <input
                                type="text"
                                name="dcPrefix"
                                value={settings.dcPrefix}
                                onChange={handleChange}
                                disabled={!isEditing}
                                className={`w-full pl-4 pr-10 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all uppercase ${!isEditing ? 'opacity-60 cursor-not-allowed' : ''}`}
                                placeholder="e.g. DC"
                            />
                        </div>
                        <p className="text-xs text-gray-400 mt-1">Example: {settings.dcPrefix}-2024-001</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Invoice Prefix</label>
                        <div className="relative">
                            <input
                                type="text"
                                name="invoicePrefix"
                                value={settings.invoicePrefix}
                                onChange={handleChange}
                                disabled={!isEditing}
                                className={`w-full pl-4 pr-10 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all uppercase ${!isEditing ? 'opacity-60 cursor-not-allowed' : ''}`}
                                placeholder="e.g. INV"
                            />
                        </div>
                        <p className="text-xs text-gray-400 mt-1">Example: {settings.invoicePrefix}-2024-001</p>
                    </div>


                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Part/Item Code Prefix</label>
                        <div className="relative">
                            <input
                                type="text"
                                name="partPrefix"
                                value={settings.partPrefix}
                                onChange={handleChange}
                                disabled={!isEditing}
                                className={`w-full pl-4 pr-10 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all uppercase ${!isEditing ? 'opacity-60 cursor-not-allowed' : ''}`}
                                placeholder="e.g. PART"
                            />
                        </div>
                        <p className="text-xs text-gray-400 mt-1">Example: {settings.partPrefix}-001</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Vendor Prefix</label>
                        <div className="relative">
                            <input
                                type="text"
                                name="vendorPrefix"
                                value={settings.vendorPrefix}
                                onChange={handleChange}
                                disabled={!isEditing}
                                className={`w-full pl-4 pr-10 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all uppercase ${!isEditing ? 'opacity-60 cursor-not-allowed' : ''}`}
                                placeholder="e.g. VEN"
                            />
                        </div>
                        <p className="text-xs text-gray-400 mt-1">Example: {settings.vendorPrefix}-001</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Customer Prefix</label>
                        <div className="relative">
                            <input
                                type="text"
                                name="customerPrefix"
                                value={settings.customerPrefix}
                                onChange={handleChange}
                                disabled={!isEditing}
                                className={`w-full pl-4 pr-10 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all uppercase ${!isEditing && 'opacity-60 cursor-not-allowed'}`}
                                placeholder="e.g. CUS"
                            />
                        </div>
                        <p className="text-xs text-gray-400 mt-1">Example: {settings.customerPrefix}-001</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Job-Work Supplier Prefix</label>
                        <div className="relative">
                            <input
                                type="text"
                                name="jobWorkSupplierPrefix"
                                value={settings.jobWorkSupplierPrefix}
                                onChange={handleChange}
                                disabled={!isEditing}
                                className={`w-full pl-4 pr-10 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all uppercase ${!isEditing && 'opacity-60 cursor-not-allowed'}`}
                                placeholder="e.g. JWS"
                            />
                        </div>
                        <p className="text-xs text-gray-400 mt-1">Example: {settings.jobWorkSupplierPrefix}-001</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Incoming RFQ Prefix</label>
                        <div className="relative">
                            <input
                                type="text"
                                name="incomingRfqPrefix"
                                value={settings.incomingRfqPrefix}
                                onChange={handleChange}
                                disabled={!isEditing}
                                className={`w-full pl-4 pr-10 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all uppercase ${!isEditing && 'opacity-60 cursor-not-allowed'}`}
                                placeholder="e.g. RFQ"
                            />
                        </div>
                        <p className="text-xs text-gray-400 mt-1">Example: {settings.incomingRfqPrefix}-2024-001</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Outward Quotation Prefix (Sales)</label>
                        <div className="relative">
                            <input
                                type="text"
                                name="quotationOutwardPrefix"
                                value={settings.quotationOutwardPrefix}
                                onChange={handleChange}
                                disabled={!isEditing}
                                className={`w-full pl-4 pr-10 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all uppercase ${!isEditing && 'opacity-60 cursor-not-allowed'}`}
                                placeholder="e.g. QT-OUT"
                            />
                        </div>
                        <p className="text-xs text-gray-400 mt-1">Example: {settings.quotationOutwardPrefix}-2024-001</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Inward Quotation Prefix (Purchase)</label>
                        <div className="relative">
                            <input
                                type="text"
                                name="quotationInwardPrefix"
                                value={settings.quotationInwardPrefix}
                                onChange={handleChange}
                                disabled={!isEditing}
                                className={`w-full pl-4 pr-10 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all uppercase ${!isEditing && 'opacity-60 cursor-not-allowed'}`}
                                placeholder="e.g. QT-IN"
                            />
                        </div>
                        <p className="text-xs text-gray-400 mt-1">Example: {settings.quotationInwardPrefix}-2024-001</p>
                    </div>

                </div>

                <div className="flex justify-end pt-4 border-t border-gray-100 dark:border-gray-700 gap-3">
                    {!isEditing ? (
                        <button
                            type="button"
                            onClick={() => setIsEditing(true)}
                            className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 active:bg-indigo-800 font-medium transition-colors flex items-center gap-2"
                        >
                            <Edit2 size={20} />
                            <span>Edit Details</span>
                        </button>
                    ) : (
                        <>
                            <button
                                type="button"
                                onClick={handleCancel}
                                disabled={saving}
                                className="px-6 py-2.5 bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 font-medium transition-colors flex items-center gap-2"
                            >
                                <X size={20} />
                                <span>Cancel</span>
                            </button>
                            <button
                                type="submit"
                                disabled={saving}
                                className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 active:bg-indigo-800 font-medium transition-colors flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {saving ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>Saving...</span>
                                    </>
                                ) : (
                                    <>
                                        <Save size={20} />
                                        <span>Save Changes</span>
                                    </>
                                )}
                            </button>
                        </>
                    )}
                </div>
            </form>
        </div>
    );
}

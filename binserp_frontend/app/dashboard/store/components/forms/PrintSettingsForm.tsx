import React, { useState, useEffect } from 'react';
import { Save, Printer, AlignLeft, AlignCenter, AlignRight, FileText, CheckSquare, Type } from 'lucide-react';
import { CompanyInfo, PrintConfig } from '../../types/store.types';

interface PrintSettingsFormProps {
    initialData?: CompanyInfo;
    onSubmit: (data: CompanyInfo) => void;
    loading: boolean;
}

const defaultPrintConfig: PrintConfig = {
    headerAlignment: 'center',
    headerText: '',
    showCompanyDetails: true,
    footerText: '',
    termsAndConditions: ''
};

export default function PrintSettingsForm({ initialData, onSubmit, loading }: PrintSettingsFormProps) {
    const [activeTab, setActiveTab] = useState<'po' | 'dc' | 'invoice'>('po');
    const [formData, setFormData] = useState<CompanyInfo>({
        companyName: '',
        contactPerson: '',
        contactNumber: '',
        email: '',
        billingAddress: '',
        shippingAddress: '',
        printSettings: {
            po: { ...defaultPrintConfig },
            dc: { ...defaultPrintConfig },
            invoice: { ...defaultPrintConfig }
        }
    });

    useEffect(() => {
        if (initialData) {
            setFormData(prev => ({
                ...prev,
                ...initialData,
                printSettings: {
                    po: { ...defaultPrintConfig, ...initialData.printSettings?.po },
                    dc: { ...defaultPrintConfig, ...initialData.printSettings?.dc },
                    invoice: { ...defaultPrintConfig, ...initialData.printSettings?.invoice }
                }
            }));
        }
    }, [initialData]);

    const handleConfigChange = (field: keyof PrintConfig, value: any) => {
        setFormData(prev => ({
            ...prev,
            printSettings: {
                ...prev.printSettings!,
                [activeTab]: {
                    ...prev.printSettings![activeTab],
                    [field]: value
                }
            }
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(formData);
    };

    const currentConfig = formData.printSettings?.[activeTab] || defaultPrintConfig;

    return (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4 flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Printer size={24} />
                        Print Settings
                    </h2>
                    <p className="text-purple-100 text-sm mt-1">
                        Configure print layouts for PO, DC, and Invoices
                    </p>
                </div>
                <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center gap-2 px-6 py-2.5 bg-white text-purple-600 rounded-lg font-semibold hover:bg-purple-50 transition-colors shadow-lg disabled:opacity-75"
                >
                    <Save size={18} />
                    {loading ? 'Saving...' : 'Save Configuration'}
                </button>
            </div>

            {/* Document Tabs */}
            <div className="border-b border-gray-200 bg-gray-50 flex px-6">
                {(['po', 'dc', 'invoice'] as const).map((tab) => (
                    <button
                        key={tab}
                        type="button"
                        onClick={() => setActiveTab(tab)}
                        className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === tab
                            ? 'border-purple-600 text-purple-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                    >
                        <FileText size={16} />
                        {tab === 'po' ? 'Purchase Order' : tab === 'dc' ? 'Delivery Challan' : 'Invoice / Bill'}
                    </button>
                ))}
            </div>

            <div className="p-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Visual Settings */}
                    <div className="space-y-6">
                        <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <AlignLeft size={20} className="text-purple-600" />
                                Header Alignment
                            </h3>
                            <div className="grid grid-cols-3 gap-4">
                                {[
                                    { value: 'left', icon: AlignLeft, label: 'Left' },
                                    { value: 'center', icon: AlignCenter, label: 'Center' },
                                    { value: 'right', icon: AlignRight, label: 'Right' }
                                ].map((align) => (
                                    <button
                                        key={align.value}
                                        type="button"
                                        onClick={() => handleConfigChange('headerAlignment', align.value)}
                                        className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all ${currentConfig.headerAlignment === align.value
                                            ? 'border-purple-600 bg-purple-50 text-purple-700'
                                            : 'border-gray-200 hover:border-purple-100 hover:bg-gray-50'
                                            }`}
                                    >
                                        <align.icon size={24} className="mb-2" />
                                        <span className="text-sm font-medium">{align.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <CheckSquare size={20} className="text-purple-600" />
                                Display Options
                            </h3>
                            <label className="flex items-center gap-3 p-4 bg-white rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={currentConfig.showCompanyDetails}
                                    onChange={(e) => handleConfigChange('showCompanyDetails', e.target.checked)}
                                    className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500 border-gray-300"
                                />
                                <span className="font-medium text-gray-700">Show Company Details in Header</span>
                            </label>
                        </div>
                    </div>

                    {/* text Settings */}
                    <div className="space-y-6">
                        <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <Type size={20} className="text-purple-600" />
                                Content Configuration
                            </h3>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Custom Header Title (Optional)</label>
                                    <input
                                        type="text"
                                        value={currentConfig.headerText}
                                        onChange={(e) => handleConfigChange('headerText', e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                        placeholder={`e.g. ${activeTab === 'po' ? 'PURCHASE ORDER' : activeTab === 'dc' ? 'DELIVERY CHALLAN' : 'TAX INVOICE'}`}
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Leave blank to use default document title</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Footer Text</label>
                                    <textarea
                                        rows={2}
                                        value={currentConfig.footerText}
                                        onChange={(e) => handleConfigChange('footerText', e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                        placeholder="Text to appear at the bottom of every page..."
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Terms & Conditions</label>
                                    <textarea
                                        rows={4}
                                        value={currentConfig.termsAndConditions}
                                        onChange={(e) => handleConfigChange('termsAndConditions', e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 font-mono text-sm"
                                        placeholder="Enter default terms and conditions..."
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </form>
    );
}

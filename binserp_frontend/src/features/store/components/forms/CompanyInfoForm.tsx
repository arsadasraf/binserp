/**
 * CompanyInfoForm Component
 * 
 * Form to manage company information for PO documents.
 * Includes fields for company details, addresses, and terms.
 * Features read-only mode by default with an "Edit" toggle.
 * Supports Logo file upload.
 */

import React, { useState, useEffect } from 'react';
import { Save, Upload, Building2, Phone, Mail, FileText, MapPin, Edit2, CreditCard } from 'lucide-react';
import { CompanyInfo } from '../../types/store.types';

interface CompanyInfoFormProps {
    initialData?: CompanyInfo;
    onSubmit: (data: FormData | CompanyInfo) => Promise<void> | void;
    loading: boolean;
}

export default function CompanyInfoForm({ initialData, onSubmit, loading }: CompanyInfoFormProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState<CompanyInfo>({
        companyName: '',
        contactPerson: '',
        contactNumber: '',
        email: '',
        logo: '',
        gstNumber: '',
        billingAddress: '',
        shippingAddress: '',
        qualitySpecs: '',
        commercialTerms: '',
        bankDetails: {
            accountName: '',
            bankName: '',
            accountNumber: '',
            ifscCode: '',
            branch: ''
        }
    });
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string>('');

    useEffect(() => {
        if (initialData) {
            setFormData({
                companyName: initialData.companyName || '',
                contactPerson: initialData.contactPerson || '',
                contactNumber: initialData.contactNumber || '',
                email: initialData.email || '',
                logo: initialData.logo || '',
                gstNumber: initialData.gstNumber || '',
                billingAddress: initialData.billingAddress || '',
                shippingAddress: initialData.shippingAddress || '',
                qualitySpecs: initialData.qualitySpecs || '',
                commercialTerms: initialData.commercialTerms || '',
                bankDetails: {
                    accountName: initialData.bankDetails?.accountName || '',
                    bankName: initialData.bankDetails?.bankName || '',
                    accountNumber: initialData.bankDetails?.accountNumber || '',
                    ifscCode: initialData.bankDetails?.ifscCode || '',
                    branch: initialData.bankDetails?.branch || ''
                }
            });
            if (initialData.logo) {
                setPreviewUrl(initialData.logo);
            }
        }
    }, [initialData]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleBankChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            bankDetails: {
                ...(prev.bankDetails || {
                    accountName: '',
                    bankName: '',
                    accountNumber: '',
                    ifscCode: '',
                    branch: ''
                }),
                [name]: value
            }
        }));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setLogoFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            if (logoFile) {
                const data = new FormData();
                Object.entries(formData).forEach(([key, value]) => {
                    if (key === 'bankDetails' && value) {
                        data.append('bankDetails', JSON.stringify(value));
                    } else {
                        data.append(key, value as string);
                    }
                });
                data.append('logo', logoFile);
                await onSubmit(data);
            } else {
                await onSubmit(formData);
            }
            setIsEditing(false);
        } catch (error) {
            console.error("Failed to save company info:", error);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Building2 size={24} />
                        Company Information
                    </h2>
                    <p className="text-blue-100 text-sm mt-1">
                        Manage your company details for Purchase Orders and documents
                    </p>
                </div>
                <div className="flex gap-3">
                    {!isEditing ? (
                        <button
                            type="button"
                            onClick={() => setIsEditing(true)}
                            className="flex items-center gap-2 px-6 py-2.5 bg-white text-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition-colors shadow-lg"
                        >
                            <Edit2 size={18} />
                            Edit Details
                        </button>
                    ) : (
                        <>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsEditing(false);
                                    if (initialData) {
                                        setFormData(initialData);
                                        setPreviewUrl(initialData.logo || '');
                                    }
                                    setLogoFile(null);
                                }}
                                className="px-4 py-2.5 bg-blue-700 text-white rounded-lg font-semibold hover:bg-blue-800 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex items-center gap-2 px-6 py-2.5 bg-white text-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition-colors shadow-lg disabled:opacity-75"
                            >
                                <Save size={18} />
                                {loading ? 'Saving...' : 'Save Changes'}
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column: Basic Info & Logo */}
                <div className="space-y-6">
                    <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <Building2 size={20} className="text-blue-600" />
                            Basic Details
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                                <input
                                    type="text"
                                    name="companyName"
                                    required
                                    disabled={!isEditing}
                                    value={formData.companyName}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                                    placeholder="Enter company name"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">GST Number</label>
                                    <input
                                        type="text"
                                        name="gstNumber"
                                        disabled={!isEditing}
                                        value={formData.gstNumber}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                                        placeholder="GSTIN"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Company Logo</label>
                                    <div className="flex items-center gap-4">
                                        {previewUrl && (
                                            <img
                                                src={previewUrl}
                                                alt="Logo Preview"
                                                className="h-10 w-10 object-contain rounded border border-gray-200"
                                            />
                                        )}
                                        {isEditing ? (
                                            <label className="flex-1 cursor-pointer">
                                                <div className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-600">
                                                    <Upload size={18} />
                                                    <span className="text-sm">Upload Logo</span>
                                                </div>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handleFileChange}
                                                    className="hidden"
                                                />
                                            </label>
                                        ) : (
                                            <div className="flex-1 px-4 py-2 border border-gray-200 rounded-lg bg-gray-100 text-gray-500 text-sm">
                                                {formData.logo ? 'Logo Uploaded' : 'No Logo'}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <Phone size={20} className="text-blue-600" />
                            Contact Information
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
                                <input
                                    type="text"
                                    name="contactPerson"
                                    required
                                    disabled={!isEditing}
                                    value={formData.contactPerson}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                                    placeholder="Name of contact person"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Contact Number</label>
                                    <input
                                        type="text"
                                        name="contactNumber"
                                        required
                                        disabled={!isEditing}
                                        value={formData.contactNumber}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                                        placeholder="+91..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                    <input
                                        type="email"
                                        name="email"
                                        disabled={!isEditing}
                                        value={formData.email}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                                        placeholder="email@company.com"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Addresses & Terms */}
                <div className="space-y-6">
                    <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <MapPin size={20} className="text-blue-600" />
                            Addresses
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Billing Address</label>
                                <textarea
                                    name="billingAddress"
                                    required
                                    disabled={!isEditing}
                                    rows={3}
                                    value={formData.billingAddress}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                                    placeholder="Enter billing address"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Shipping Address</label>
                                <textarea
                                    name="shippingAddress"
                                    required
                                    disabled={!isEditing}
                                    rows={3}
                                    value={formData.shippingAddress}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                                    placeholder="Enter shipping address"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <FileText size={20} className="text-blue-600" />
                            Terms & Specifications
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Quality & Specifications</label>
                                <textarea
                                    name="qualitySpecs"
                                    disabled={!isEditing}
                                    rows={3}
                                    value={formData.qualitySpecs}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                                    placeholder="Standard quality specs..."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Commercial Terms</label>
                                <textarea
                                    name="commercialTerms"
                                    disabled={!isEditing}
                                    rows={3}
                                    value={formData.commercialTerms}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                                    placeholder="Payment terms, delivery terms..."
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bank Details Section */}
                <div className="col-span-1 lg:col-span-2">
                    <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <CreditCard size={20} className="text-blue-600" />
                            Bank Details (For Invoicing)
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
                                <input
                                    type="text"
                                    name="bankName"
                                    disabled={!isEditing}
                                    value={formData.bankDetails?.bankName ?? ''}
                                    onChange={handleBankChange}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                                    placeholder="Bank Name"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
                                <input
                                    type="text"
                                    name="accountNumber"
                                    disabled={!isEditing}
                                    value={formData.bankDetails?.accountNumber ?? ''}
                                    onChange={handleBankChange}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                                    placeholder="Account Number"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">IFSC Code</label>
                                <input
                                    type="text"
                                    name="ifscCode"
                                    disabled={!isEditing}
                                    value={formData.bankDetails?.ifscCode ?? ''}
                                    onChange={handleBankChange}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                                    placeholder="IFSC Code"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Branch Name</label>
                                <input
                                    type="text"
                                    name="branch"
                                    disabled={!isEditing}
                                    value={formData.bankDetails?.branch ?? ''}
                                    onChange={handleBankChange}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                                    placeholder="Branch Name"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Account Name</label>
                                <input
                                    type="text"
                                    name="accountName"
                                    disabled={!isEditing}
                                    value={formData.bankDetails?.accountName ?? ''}
                                    onChange={handleBankChange}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                                    placeholder="Name on Account"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </form>
    );
}

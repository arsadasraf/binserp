"use client";

import React, { useState } from 'react';
import { 
    X, Download, Edit3, Trash2, Building2, User, Phone, Mail, Globe, 
    MapPin, CreditCard, ShieldCheck, Tag, Layers, Box, Package, 
    Calendar, CheckCircle2, AlertCircle, FileText, Printer, FileSpreadsheet,
    Eye, ExternalLink, Hash, Info, Layers3
} from 'lucide-react';
import { generateMasterRecordPDF } from '@/src/utils/masterPdfHelper';
import { useGetStoreDataQuery } from '@/src/store/services/storeService';

export interface MasterDetailPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: any | null;
    masterTab: 'vendor' | 'customer' | 'location' | 'category' | 'rm-bo-item' | 'fg-items' | 'fg-item' | 'materials' | string;
    onEdit?: (item: any) => void;
    onDelete?: (id: string) => void;
    companyInfo?: any;
}

export default function MasterDetailPreviewModal({
    isOpen,
    onClose,
    item,
    masterTab,
    onEdit,
    onDelete,
    companyInfo: initialCompanyInfo
}: MasterDetailPreviewModalProps) {
    const { data: fetchedCompanyInfo } = useGetStoreDataQuery("company-info", { skip: !isOpen });
    const companyInfo = initialCompanyInfo || fetchedCompanyInfo;

    const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

    if (!isOpen || !item) return null;

    const tabKey = (masterTab || '').toLowerCase();

    // Determine color schemes and icons per master type
    let theme = {
        title: 'Master Record Preview',
        subtitle: 'Store Master Information Sheet',
        badge: 'Master Record',
        headerGradient: 'from-slate-900 via-slate-800 to-slate-950',
        borderColor: 'border-slate-700',
        badgeBg: 'bg-slate-500/20 text-slate-300 border-slate-400/30',
        icon: Building2,
        accentColor: 'text-slate-400',
        btnBg: 'bg-slate-700 hover:bg-slate-600',
    };

    if (tabKey === 'vendor' || tabKey === 'vendors') {
        theme = {
            title: item.name || 'Vendor Details',
            subtitle: `Vendor Code: ${item.code || 'N/A'} • ${item.vendorType || 'Rm Vendor'}`,
            badge: item.vendorType || 'Vendor',
            headerGradient: 'from-emerald-950 via-teal-900 to-emerald-900',
            borderColor: 'border-emerald-700',
            badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30',
            icon: Building2,
            accentColor: 'text-emerald-400',
            btnBg: 'bg-emerald-600 hover:bg-emerald-700',
        };
    } else if (tabKey === 'customer' || tabKey === 'customers') {
        theme = {
            title: item.name || 'Customer Details',
            subtitle: `Customer Code: ${item.code || 'N/A'} • ${item.customerType || 'Manufacturing Sales'}`,
            badge: item.customerType || 'Customer',
            headerGradient: 'from-indigo-950 via-blue-900 to-indigo-900',
            borderColor: 'border-indigo-700',
            badgeBg: 'bg-indigo-500/20 text-indigo-300 border-indigo-400/30',
            icon: User,
            accentColor: 'text-indigo-400',
            btnBg: 'bg-indigo-600 hover:bg-indigo-700',
        };
    } else if (tabKey === 'rm-bo-item' || tabKey === 'materials' || tabKey === 'material') {
        const cat = typeof item.categoryId === 'object' ? item.categoryId?.name : item.category;
        theme = {
            title: item.name || item.materialName || 'RM/BO Item Details',
            subtitle: `Item Code: ${item.code || item.materialCode || 'N/A'} • Category: ${cat || 'Raw Material'}`,
            badge: cat || 'Raw Material',
            headerGradient: 'from-blue-950 via-indigo-900 to-blue-900',
            borderColor: 'border-blue-700',
            badgeBg: 'bg-blue-500/20 text-blue-300 border-blue-400/30',
            icon: Box,
            accentColor: 'text-blue-400',
            btnBg: 'bg-blue-600 hover:bg-blue-700',
        };
    } else if (tabKey === 'fg-items' || tabKey === 'fg-item' || tabKey === 'finished-goods') {
        theme = {
            title: item.name || item.productName || 'Finished Goods Details',
            subtitle: `FG Code: ${item.code || item.productCode || 'N/A'} • Type: ${item.type || item.category || 'Assembly'}`,
            badge: item.type || 'Assembly',
            headerGradient: 'from-purple-950 via-violet-900 to-purple-900',
            borderColor: 'border-purple-700',
            badgeBg: 'bg-purple-500/20 text-purple-300 border-purple-400/30',
            icon: Layers,
            accentColor: 'text-purple-400',
            btnBg: 'bg-purple-600 hover:bg-purple-700',
        };
    } else if (tabKey === 'location' || tabKey === 'locations') {
        theme = {
            title: item.name || 'Storage Location',
            subtitle: `Location Code: ${item.code || 'N/A'} • Type: ${item.type || 'Rack'}`,
            badge: item.type || 'Location',
            headerGradient: 'from-cyan-950 via-sky-900 to-cyan-900',
            borderColor: 'border-sky-700',
            badgeBg: 'bg-sky-500/20 text-sky-300 border-sky-400/30',
            icon: MapPin,
            accentColor: 'text-sky-400',
            btnBg: 'bg-sky-600 hover:bg-sky-700',
        };
    } else if (tabKey === 'category' || tabKey === 'categories') {
        theme = {
            title: item.name || 'Material Category',
            subtitle: `Category Code: ${item.code || 'N/A'} • Unit: ${item.unit || 'PCS'}`,
            badge: item.type || 'Category',
            headerGradient: 'from-amber-950 via-orange-900 to-amber-900',
            borderColor: 'border-amber-700',
            badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-400/30',
            icon: Tag,
            accentColor: 'text-amber-400',
            btnBg: 'bg-amber-600 hover:bg-amber-700',
        };
    }

    const Icon = theme.icon;

    const handleDownloadPDF = () => {
        generateMasterRecordPDF({ masterTab, item, companyInfo });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-4xl my-auto overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh]">
                
                {/* Modal Header */}
                <div className={`p-5 sm:p-6 bg-gradient-to-r ${theme.headerGradient} text-white flex justify-between items-center flex-shrink-0 border-b ${theme.borderColor}`}>
                    <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20 shadow-inner shrink-0">
                            <Icon className="w-6 h-6 text-white" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2.5 flex-wrap">
                                <h2 className="text-xl font-extrabold tracking-tight text-white truncate max-w-md">
                                    {theme.title}
                                </h2>
                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider border ${theme.badgeBg}`}>
                                    {theme.badge}
                                </span>
                            </div>
                            <p className="text-xs text-slate-300 mt-0.5 truncate">
                                {theme.subtitle}
                            </p>
                        </div>
                    </div>

                    {/* Header Action Buttons */}
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            onClick={handleDownloadPDF}
                            className={`px-3.5 py-2 ${theme.btnBg} text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-1.5 border border-white/20 hover:scale-105 active:scale-95`}
                            title="Generate & Download Printable PDF Specification Sheet"
                        >
                            <Download size={15} />
                            <span className="hidden sm:inline">Download PDF</span>
                        </button>

                        {onEdit && (
                            <button
                                onClick={() => {
                                    onClose();
                                    onEdit(item);
                                }}
                                className="px-3 py-2 bg-white/15 hover:bg-white/25 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 border border-white/20"
                                title="Edit this record"
                            >
                                <Edit3 size={15} />
                                <span className="hidden sm:inline">Edit</span>
                            </button>
                        )}

                        <button
                            onClick={onClose}
                            className="w-9 h-9 rounded-full bg-black/30 hover:bg-black/50 transition-all flex items-center justify-center text-white border border-white/20"
                            title="Close preview"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Modal Body */}
                <div className="p-6 sm:p-7 overflow-y-auto flex-1 space-y-6">
                    
                    {/* VENDOR & CUSTOMER VIEW */}
                    {(tabKey === 'vendor' || tabKey === 'vendors' || tabKey === 'customer' || tabKey === 'customers') && (
                        <div className="space-y-6">
                            {/* Grid 1: Basic & Contact Info */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {/* Card 1: Core Information */}
                                <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-3">
                                    <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                        <Building2 size={14} className={theme.accentColor} /> Identification & Category
                                    </div>
                                    <div className="space-y-2 text-xs">
                                        <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                                            <span className="text-slate-500 dark:text-slate-400">Name:</span>
                                            <span className="font-extrabold text-slate-900 dark:text-white">{item.name || '-'}</span>
                                        </div>
                                        <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                                            <span className="text-slate-500 dark:text-slate-400">Code:</span>
                                            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{item.code || '-'}</span>
                                        </div>
                                        <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                                            <span className="text-slate-500 dark:text-slate-400">Type / Classification:</span>
                                            <span className="font-bold text-slate-800 dark:text-slate-200">{item.vendorType || item.customerType || '-'}</span>
                                        </div>
                                        <div className="flex justify-between py-1">
                                            <span className="text-slate-500 dark:text-slate-400">Registration Status:</span>
                                            <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-bold rounded-md text-[11px]">
                                                Active
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Card 2: Contact Communication */}
                                <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-3">
                                    <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                        <User size={14} className={theme.accentColor} /> Contact & Communication
                                    </div>
                                    <div className="space-y-2 text-xs">
                                        <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                                            <span className="text-slate-500 dark:text-slate-400">Contact Person:</span>
                                            <span className="font-bold text-slate-900 dark:text-white">{item.contactPerson || '-'}</span>
                                        </div>
                                        <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                                            <span className="text-slate-500 dark:text-slate-400">Phone Number:</span>
                                            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{item.phone || '-'}</span>
                                        </div>
                                        <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                                            <span className="text-slate-500 dark:text-slate-400">Email Address:</span>
                                            <span className="font-bold text-slate-800 dark:text-slate-200">{item.email || '-'}</span>
                                        </div>
                                        <div className="flex justify-between py-1">
                                            <span className="text-slate-500 dark:text-slate-400">Website:</span>
                                            <span className="text-slate-700 dark:text-slate-300">{item.website || '-'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Grid 2: Tax & Addresses */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {/* Card 3: Tax & Legal Identifiers */}
                                <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-3">
                                    <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                        <ShieldCheck size={14} className={theme.accentColor} /> Tax & Regulatory Identifiers
                                    </div>
                                    <div className="space-y-2 text-xs">
                                        <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                                            <span className="text-slate-500 dark:text-slate-400">GSTIN / Tax No:</span>
                                            <span className="font-mono font-bold text-slate-900 dark:text-white bg-slate-200/60 dark:bg-slate-700 px-2 py-0.5 rounded">
                                                {item.gst || item.gstNumber || '-'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between py-1">
                                            <span className="text-slate-500 dark:text-slate-400">PAN Number:</span>
                                            <span className="font-mono font-bold text-slate-900 dark:text-white bg-slate-200/60 dark:bg-slate-700 px-2 py-0.5 rounded">
                                                {item.pan || '-'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Card 4: Banking Details */}
                                <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-3">
                                    <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                        <CreditCard size={14} className={theme.accentColor} /> Banking & Payment Details
                                    </div>
                                    <div className="space-y-2 text-xs">
                                        <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                                            <span className="text-slate-500 dark:text-slate-400">Bank Name:</span>
                                            <span className="font-bold text-slate-900 dark:text-white">{item.bankDetails?.bankName || '-'}</span>
                                        </div>
                                        <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                                            <span className="text-slate-500 dark:text-slate-400">Account Number:</span>
                                            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{item.bankDetails?.accountNumber || '-'}</span>
                                        </div>
                                        <div className="flex justify-between py-1">
                                            <span className="text-slate-500 dark:text-slate-400">IFSC Code:</span>
                                            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{item.bankDetails?.ifscCode || '-'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Card 5: Full Address Details */}
                            <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-3">
                                <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                    <MapPin size={14} className={theme.accentColor} /> Address Locations
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                                    <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                                        <strong className="text-slate-900 dark:text-white block text-[11px] uppercase tracking-wider">Billing / Registered Address</strong>
                                        <p className="text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                                            {item.billingAddress || item.address || 'No address provided'}
                                        </p>
                                        <div className="pt-2 text-[11px] text-slate-500 border-t border-slate-100 dark:border-slate-700">
                                            <b>City/State:</b> {item.billingCity || item.city || '-'}, {item.billingState || item.state || '-'} ({item.billingPincode || item.pincode || '-'})
                                        </div>
                                    </div>

                                    <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                                        <strong className="text-slate-900 dark:text-white block text-[11px] uppercase tracking-wider">Shipping / Delivery Address</strong>
                                        <p className="text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                                            {item.shippingAddress || item.address || 'Same as billing address'}
                                        </p>
                                        <div className="pt-2 text-[11px] text-slate-500 border-t border-slate-100 dark:border-slate-700">
                                            <b>City/State:</b> {item.shippingCity || item.city || '-'}, {item.shippingState || item.state || '-'} ({item.shippingPincode || item.pincode || '-'})
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* RM/BO ITEM VIEW */}
                    {(tabKey === 'rm-bo-item' || tabKey === 'materials' || tabKey === 'material') && (
                        <div className="space-y-6">
                            {/* Grid 1: Core Specifications */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-3">
                                    <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                        <Box size={14} className={theme.accentColor} /> Item Specifications
                                    </div>
                                    <div className="space-y-2 text-xs">
                                        <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                                            <span className="text-slate-500 dark:text-slate-400">Item Name:</span>
                                            <span className="font-extrabold text-slate-900 dark:text-white">{item.name || item.materialName || '-'}</span>
                                        </div>
                                        <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                                            <span className="text-slate-500 dark:text-slate-400">Item Code:</span>
                                            <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{item.code || item.materialCode || '-'}</span>
                                        </div>
                                        <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                                            <span className="text-slate-500 dark:text-slate-400">Category:</span>
                                            <span className="font-bold text-slate-900 dark:text-white">
                                                {typeof item.categoryId === 'object' ? item.categoryId?.name : (item.category || '-')}
                                            </span>
                                        </div>
                                        <div className="flex justify-between py-1">
                                            <span className="text-slate-500 dark:text-slate-400">Default Unit:</span>
                                            <span className="font-bold text-slate-800 dark:text-slate-200">
                                                {item.unit || (typeof item.categoryId === 'object' ? item.categoryId?.unit : 'PCS')}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-3">
                                    <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                        <MapPin size={14} className={theme.accentColor} /> Storage & Stock Limits
                                    </div>
                                    <div className="space-y-2 text-xs">
                                        <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                                            <span className="text-slate-500 dark:text-slate-400">Minimum Stock (Safety):</span>
                                            <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                                                {item.minimumStock ?? item.minStock ?? 0} {item.unit || 'PCS'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                                            <span className="text-slate-500 dark:text-slate-400">Storage Location:</span>
                                            <span className="font-bold text-slate-800 dark:text-slate-200">
                                                {typeof item.locationId === 'object' ? item.locationId?.name : (typeof item.location === 'object' ? item.location?.name : (item.storageLocation || item.location || '-'))}
                                            </span>
                                        </div>
                                        <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                                            <span className="text-slate-500 dark:text-slate-400">HSN Code:</span>
                                            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                                                {typeof item.categoryId === 'object' ? item.categoryId?.hsnCode : (item.hsnCode || '-')}
                                            </span>
                                        </div>
                                        <div className="flex justify-between py-1">
                                            <span className="text-slate-500 dark:text-slate-400">Standard Rate:</span>
                                            <span className="font-bold text-slate-800 dark:text-slate-200">{item.rate ? `₹ ${item.rate}` : '-'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Photos / Attachments */}
                            {item.photos && item.photos.length > 0 && (
                                <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-3">
                                    <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                        <Eye size={14} className={theme.accentColor} /> Attached Photos & Documents
                                    </div>
                                    <div className="flex flex-wrap gap-4">
                                        {item.photos.map((photo: any, idx: number) => {
                                            const photoUrl = typeof photo === 'string' ? photo : '';
                                            const isPdf = photoUrl.toLowerCase().includes('.pdf');
                                            return (
                                                <div 
                                                    key={idx} 
                                                    onClick={() => window.open(photoUrl, '_blank')}
                                                    className="w-32 h-32 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden relative cursor-pointer hover:border-indigo-500 group shadow-sm flex flex-col items-center justify-center p-2"
                                                >
                                                    {isPdf ? (
                                                        <div className="text-center">
                                                            <FileText size={32} className="text-red-500 mx-auto mb-1" />
                                                            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">View PDF</span>
                                                        </div>
                                                    ) : (
                                                        <img src={photoUrl} alt="Item Attachment" className="w-full h-full object-cover rounded-lg group-hover:scale-105 transition-transform" />
                                                    )}
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1">
                                                        <ExternalLink size={14} /> Open
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Description */}
                            <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-2">
                                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Description & Technical Details</span>
                                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                                    {item.descriptions || item.description || 'No additional technical specifications provided.'}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* FINISHED GOODS (FG ITEM) VIEW */}
                    {(tabKey === 'fg-items' || tabKey === 'fg-item' || tabKey === 'finished-goods') && (
                        <div className="space-y-6">
                            {/* Master Summary Bar */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 text-center">
                                    <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Item Type</div>
                                    <div className="text-sm font-extrabold font-mono text-purple-600 dark:text-purple-400 mt-1">
                                        {item.type || item.category || 'Component'}
                                    </div>
                                </div>

                                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 text-center">
                                    <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Primary Unit</div>
                                    <div className="text-sm font-extrabold font-mono text-slate-900 dark:text-white mt-1">
                                        {item.unit || 'Nos'}
                                    </div>
                                </div>

                                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 text-center">
                                    <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Location</div>
                                    <div className="text-sm font-extrabold text-slate-800 dark:text-slate-200 mt-1 truncate">
                                        {typeof item.location === 'object' ? item.location?.name : (typeof item.locationId === 'object' ? item.locationId?.name : (item.location || '-'))}
                                    </div>
                                </div>

                                <div className="p-4 bg-amber-50 dark:bg-amber-950/40 rounded-2xl border border-amber-200 dark:border-amber-900/50 text-center">
                                    <div className="text-[11px] font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-400">BOM Components</div>
                                    <div className="text-sm font-extrabold font-mono text-amber-800 dark:text-amber-300 mt-1">
                                        {Array.isArray(item.bom) ? item.bom.length : 0} Items
                                    </div>
                                </div>
                            </div>

                            {/* Core Specs */}
                            <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-3">
                                <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                    <Layers size={14} className={theme.accentColor} /> Product Specifications
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
                                    <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                                        <span className="text-slate-500 dark:text-slate-400">Product Name:</span>
                                        <span className="font-extrabold text-slate-900 dark:text-white">{item.name || item.productName || '-'}</span>
                                    </div>
                                    <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                                        <span className="text-slate-500 dark:text-slate-400">Product Code / Part No:</span>
                                        <span className="font-mono font-bold text-purple-600 dark:text-purple-400">{item.code || item.productCode || '-'}</span>
                                    </div>
                                    <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                                        <span className="text-slate-500 dark:text-slate-400">Type / Classification:</span>
                                        <span className="font-bold text-slate-800 dark:text-slate-200">{item.type || item.category || 'Component'}</span>
                                    </div>
                                    <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                                        <span className="text-slate-500 dark:text-slate-400">Storage Location:</span>
                                        <span className="font-bold text-slate-800 dark:text-slate-200">
                                            {typeof item.location === 'object' ? item.location?.name : (typeof item.locationId === 'object' ? item.locationId?.name : (item.location || '-'))}
                                        </span>
                                    </div>
                                    <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                                        <span className="text-slate-500 dark:text-slate-400">Revision Number:</span>
                                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{item.revisionNumber || '-'}</span>
                                    </div>
                                    <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                                        <span className="text-slate-500 dark:text-slate-400">Reorder Level / Min Stock:</span>
                                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{item.reorderLevel !== undefined ? `${item.reorderLevel} ${item.unit || 'Nos'}` : '-'}</span>
                                    </div>
                                </div>
                            </div>

                            {/* BOM Table */}
                            {item.bom && item.bom.length > 0 && (
                                <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-3">
                                    <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                        <Layers3 size={14} className={theme.accentColor} /> Bill of Materials (BOM)
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs text-left">
                                            <thead className="text-[10px] text-slate-500 uppercase bg-slate-200/60 dark:bg-slate-700/60 rounded-lg">
                                                <tr>
                                                    <th className="px-3 py-2">#</th>
                                                    <th className="px-3 py-2">Component / Item Name</th>
                                                    <th className="px-3 py-2">Item Type</th>
                                                    <th className="px-3 py-2 text-right">Quantity Required</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200/60 dark:divide-slate-700/60">
                                                {item.bom.map((b: any, idx: number) => (
                                                    <tr key={idx}>
                                                        <td className="px-3 py-2 font-mono text-slate-400">{idx + 1}</td>
                                                        <td className="px-3 py-2 font-bold text-slate-900 dark:text-white">{b.itemName || '-'}</td>
                                                        <td className="px-3 py-2">
                                                            <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-bold rounded text-[10px]">
                                                                {b.itemType || 'Material'}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-2 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                                                            {b.quantity || 1} {b.unit || 'Nos'}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Description */}
                            <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-2">
                                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Description & Technical Notes</span>
                                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                                    {item.description || 'No additional specifications provided.'}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* LOCATION & CATEGORY VIEW */}
                    {(tabKey === 'location' || tabKey === 'locations' || tabKey === 'category' || tabKey === 'categories') && (
                        <div className="space-y-6">
                            <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-3">
                                <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                    <Info size={14} className={theme.accentColor} /> Record Details
                                </div>
                                <div className="space-y-2 text-xs">
                                    <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                                        <span className="text-slate-500 dark:text-slate-400">Name:</span>
                                        <span className="font-extrabold text-slate-900 dark:text-white">{item.name || '-'}</span>
                                    </div>
                                    <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                                        <span className="text-slate-500 dark:text-slate-400">Code:</span>
                                        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{item.code || '-'}</span>
                                    </div>
                                    {item.type && (
                                        <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                                            <span className="text-slate-500 dark:text-slate-400">Type / Classification:</span>
                                            <span className="font-bold text-slate-800 dark:text-slate-200">{item.type}</span>
                                        </div>
                                    )}
                                    {item.unit && (
                                        <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                                            <span className="text-slate-500 dark:text-slate-400">Standard Unit:</span>
                                            <span className="font-bold text-slate-800 dark:text-slate-200">{item.unit}</span>
                                        </div>
                                    )}
                                    {item.hsnCode && (
                                        <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                                            <span className="text-slate-500 dark:text-slate-400">HSN Code:</span>
                                            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{item.hsnCode}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-2">
                                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Description & Location Notes</span>
                                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                                    {item.description || 'No additional notes provided.'}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Metadata Footer */}
                    <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-[11px] text-slate-400">
                        <div>
                            Record ID: <span className="font-mono text-slate-500">{item._id || 'N/A'}</span>
                        </div>
                        <div>
                            Last Updated: <span className="text-slate-600 dark:text-slate-300 font-medium">{item.updatedAt ? new Date(item.updatedAt).toLocaleString() : 'Recent'}</span>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}

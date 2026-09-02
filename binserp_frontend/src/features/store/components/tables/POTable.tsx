/**
 * POTable Component
 * 
 * Displays Purchase Order history in the PO tab
 * Features:
 * - PO list with clickable preview modal & client-side PDF/Excel export
 * - Interactive status update selector
 * - User audit & activity history tracking (createdBy, updatedBy, status logs)
 * - Linked Inventory GRN Receipts & Timeline
 * - 24-hour delete restriction
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Edit2, Trash2, Download, FileSpreadsheet, Eye, X, Printer, Building2, ShoppingCart, Search, Clock, User, ShieldCheck, History, Truck, Plus, Lock } from 'lucide-react';
import * as XLSX from 'xlsx';
import { generateDocument } from '@/src/utils/documentHelper';
import { generateFrontendPoPDF } from '@/src/utils/frontendPdfHelper';
import { CompanyInfo } from "@/src/features/store/types/store.types";
import { API_BASE_URL } from '@/src/utils/config';
import MasterExcelImportModal from '../modals/MasterExcelImportModal';
import { downloadMasterExcelTemplate } from '@/src/utils/excelMasterHelper';

interface POTableProps {
    data: any[];
    vendors?: any[];
    companyInfo?: CompanyInfo;
    onEdit: (item: any) => void;
    onDelete: (id: string) => void;
    onCreatePO?: () => void;
    onStatusChange?: (id: string, newStatus: string) => Promise<void>;
}

const isWithin24Hours = (createdAt: string | Date): boolean => {
    if (!createdAt) return true;
    const now = new Date().getTime();
    const created = new Date(createdAt).getTime();
    const hoursDiff = (now - created) / (1000 * 60 * 60);
    return hoursDiff <= 24;
};

// Safe helper functions for extracting string values from potential Mongoose populated objects
const getVendorNameStr = (item: any): string => {
    if (!item) return '-';
    if (typeof item.vendorName === 'string' && item.vendorName.trim()) return item.vendorName;
    if (typeof item.vendor === 'object' && item.vendor?.name) return String(item.vendor.name);
    if (typeof item.vendor === 'string') return item.vendor;
    return 'Supplier';
};

const getMaterialNameStr = (item: any): string => {
    if (!item) return '-';
    if (Array.isArray(item.items) && item.items.length > 0) {
        const first = item.items[0];
        if (typeof first?.materialName === 'string') return first.materialName;
        if (typeof first?.material === 'object' && first.material?.name) return String(first.material.name);
        if (typeof first?.material === 'string') return first.material;
    }
    if (typeof item.materialName === 'string') return item.materialName;
    if (typeof item.material === 'object' && item.material?.name) return String(item.material.name);
    if (typeof item.material === 'string') return item.material;
    return 'Material Item';
};

const getVendorAddressStr = (vendorObj: any): string => {
    if (!vendorObj || typeof vendorObj !== 'object') return '';
    return vendorObj.address || vendorObj.billingAddress || vendorObj.street || '';
};

const getVendorGstStr = (vendorObj: any): string => {
    if (!vendorObj || typeof vendorObj !== 'object') return '';
    return vendorObj.gst || vendorObj.gstNumber || vendorObj.gstin || '';
};

export default function POTable({ data = [], onEdit, onDelete, onCreatePO, vendors = [], companyInfo, onStatusChange }: POTableProps) {
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [selectedPoPreview, setSelectedPoPreview] = useState<any | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterVendor, setFilterVendor] = useState<string>('All');
    const [filterStatus, setFilterStatus] = useState<string>('All');
    const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
    const [fetchedCompanyInfo, setFetchedCompanyInfo] = useState<any>(null);

    // Fetch company info if not passed
    useEffect(() => {
        if (!companyInfo || !companyInfo.companyName) {
            const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
            if (token) {
                fetch(`${API_BASE_URL}/api/store/company-info`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
                .then(res => res.json())
                .then(info => {
                    if (info && (info.companyName || info.name)) {
                        setFetchedCompanyInfo(info);
                        try {
                            localStorage.setItem('storeCompanyInfo', JSON.stringify(info));
                        } catch (e) {}
                    }
                })
                .catch(() => {});
            }
        }
    }, [companyInfo]);

    // Live 1-second ticking timer for 24h edit/delete countdown
    const [nowTime, setNowTime] = useState(Date.now());
    useEffect(() => {
        const timer = setInterval(() => setNowTime(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    const getRemainingEditSeconds = (createdAt: string | Date | undefined) => {
        if (!createdAt) return 0;
        const created = new Date(createdAt).getTime();
        const elapsed = Math.floor((nowTime - created) / 1000);
        const limit = 24 * 3600;
        return Math.max(0, limit - elapsed);
    };

    const formatRemainingTime = (totalSeconds: number) => {
        if (totalSeconds <= 0) return '00:00:00';
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };

    const handleDeleteSafe = (item: any) => {
        const rem = getRemainingEditSeconds(item.createdAt || item.date);
        if (rem <= 0) {
            alert("This Purchase Order cannot be deleted because the 24-hour edit window has expired.");
            return;
        }
        if (window.confirm(`Are you sure you want to delete Outward PO #${item.poNumber || ''}?`)) {
            onDelete(item._id);
        }
    };

    const downloadPOAsPDF = async (po: any) => {
        const vendorId = typeof po.vendor === 'object' ? (po.vendor?._id || po.vendor?.id) : (po.vendor || po.vendorId);
        const resolvedVendor = vendors?.find((v: any) => (v._id || v.id) === vendorId) || (typeof po.vendor === 'object' ? po.vendor : null);

        let resolvedCompany = companyInfo || fetchedCompanyInfo;
        
        // Ensure fresh company info from API if missing logo or GSTIN
        if (!resolvedCompany || !resolvedCompany.companyName || !resolvedCompany.gstNumber || !resolvedCompany.logo) {
            const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
            if (token) {
                try {
                    const res = await fetch(`${API_BASE_URL}/api/store/company-info`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (res.ok) {
                        const info = await res.json();
                        if (info && (info.companyName || info.name)) {
                            resolvedCompany = { ...(resolvedCompany || {}), ...info };
                            setFetchedCompanyInfo(resolvedCompany);
                            try { localStorage.setItem('storeCompanyInfo', JSON.stringify(resolvedCompany)); } catch (e) {}
                        }
                    }
                } catch (e) {
                    console.error("Failed to fetch fresh company-info for PDF:", e);
                }
            }
        }

        if (!resolvedCompany || !resolvedCompany.companyName) {
            try {
                const cached = localStorage.getItem("storeCompanyInfo") || localStorage.getItem("companyInfo");
                if (cached) resolvedCompany = JSON.parse(cached);
                if (!resolvedCompany || !resolvedCompany.companyName) {
                    const userRaw = localStorage.getItem("userInfo");
                    if (userRaw) {
                        const parsedUser = JSON.parse(userRaw);
                        resolvedCompany = parsedUser.company || parsedUser;
                    }
                }
            } catch (e) {}
        }

        generateFrontendPoPDF({ po, vendor: resolvedVendor, companyInfo: resolvedCompany });
    };

    const downloadPOAsExcel = async (po: any) => {
        await generateDocument('excel', 'Invoices', [po]);
    };

    const handleUpdateStatus = async (poId: string, newStatus: string) => {
        setUpdatingStatusId(poId);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_BASE_URL}/api/purchase/po/${poId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ status: newStatus })
            });

            if (res.ok) {
                const json = await res.json();
                const updatedPO = json.data || json;

                if (selectedPoPreview && (selectedPoPreview._id === poId || selectedPoPreview.id === poId)) {
                    setSelectedPoPreview((prev: any) => ({
                        ...prev,
                        status: newStatus,
                        updatedByName: updatedPO.updatedByName || 'You',
                        updatedAt: new Date().toISOString(),
                        history: updatedPO.history || [
                            ...(prev?.history || []),
                            { status: newStatus, updatedBy: 'You', updatedAt: new Date().toISOString() }
                        ]
                    }));
                }

                if (onStatusChange) {
                    await onStatusChange(poId, newStatus);
                } else {
                    window.location.reload();
                }
            } else {
                alert("Failed to update PO status");
            }
        } catch (e) {
            console.error("Failed to update status:", e);
            alert("Error updating status");
        } finally {
            setUpdatingStatusId(null);
        }
    };

    const statusCounts = useMemo(() => {
        const counts: Record<string, number> = {
            'All': Array.isArray(data) ? data.length : 0,
            'Released': 0,
            'Approved': 0,
            'Partially Received': 0,
            'Completed': 0,
            'Cancelled': 0
        };
        if (Array.isArray(data)) {
            data.forEach((po: any) => {
                const st = po.status || 'Released';
                if (counts[st] !== undefined) {
                    counts[st]++;
                }
            });
        }
        return counts;
    }, [data]);

    const filteredData = useMemo(() => {
        if (!Array.isArray(data)) return [];
        return data.filter(item => {
            const vName = getVendorNameStr(item);
            const mName = getMaterialNameStr(item);
            const poNo = item.poNumber || '';

            const matchSearch = 
                poNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                vName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                mName.toLowerCase().includes(searchTerm.toLowerCase());

            const matchStatus = filterStatus === 'All' || (item.status || 'Released') === filterStatus;

            let matchVendor = true;
            if (filterVendor !== 'All') {
                const vId = typeof item.vendor === 'string' ? item.vendor : (item.vendor?._id || item.vendorId);
                matchVendor = vId?.toString() === filterVendor?.toString() || vName.toLowerCase().includes(filterVendor.toLowerCase());
            }

            return matchSearch && matchStatus && matchVendor;
        });
    }, [data, searchTerm, filterStatus, filterVendor]);

    const metrics = useMemo(() => {
        let totalItemsCount = 0;
        let totalPiecesCount = 0;
        let totalQuantity = 0;
        let totalPOValue = 0;

        filteredData.forEach((po: any) => {
            const items = Array.isArray(po.items) && po.items.length > 0 
                ? po.items 
                : [{
                    quantity: po.quantity || 1,
                    pieceCount: po.pieceCount || po.count || 0
                }];
            
            totalItemsCount += items.length;
            items.forEach((it: any) => {
                totalPiecesCount += Number(it.pieceCount || it.count || 0);
                totalQuantity += Number(it.quantity || 0);
            });

            totalPOValue += Number(po.grandTotal || po.totalAmount || po.amount || 0);
        });

        return {
            totalPOs: Array.isArray(data) ? data.length : 0,
            filteredCount: filteredData.length,
            totalItemsCount,
            totalPiecesCount,
            totalQuantity,
            totalPOValue
        };
    }, [data, filteredData]);

    const exportPOListToExcel = () => {
        const exportData = filteredData.map((po: any, idx: number) => {
            const items = Array.isArray(po.items) && po.items.length > 0 ? po.items : [];
            let pcs = 0;
            items.forEach((it: any) => pcs += Number(it.pieceCount || it.count || 0));

            return {
                'S.No': idx + 1,
                'PO Number': po.poNumber || '-',
                'PO Date': new Date(po.date || Date.now()).toLocaleDateString('en-GB'),
                'Vendor Name': getVendorNameStr(po),
                'Items Count': items.length || 1,
                'Total Piece Count': pcs > 0 ? `${pcs} Pcs` : '-',
                'Grand Total (₹)': po.grandTotal || po.totalAmount || 0,
                'Status': po.status || 'Released',
                'Created By': po.createdByName || po.createdBy?.name || 'Admin User'
            };
        });

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Purchase Orders');
        XLSX.writeFile(wb, `Purchase_Orders_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    return (
        <div className="w-full space-y-4">

            {/* Top Summary Metrics & KPI Cards Banner */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
                    <div>
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Outward POs</span>
                        <div className="flex items-baseline gap-2 mt-0.5">
                            <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">{metrics.totalPOs}</span>
                            {(searchTerm || filterStatus !== 'All' || filterVendor !== 'All') && (
                                <span className="text-xs text-purple-600 dark:text-purple-400 font-bold bg-purple-50 dark:bg-purple-950/60 px-1.5 py-0.5 rounded-md">
                                    Matched: {metrics.filteredCount}
                                </span>
                            )}
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-0.5 font-medium">All recorded PO documents</span>
                    </div>
                    <div className="w-11 h-11 rounded-2xl bg-purple-50 dark:bg-purple-950/50 flex items-center justify-center text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/40 shrink-0">
                        <ShoppingCart size={22} />
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
                    <div>
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Piece Count</span>
                        <div className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono mt-0.5">
                            {metrics.totalPiecesCount > 0 ? `${metrics.totalPiecesCount} Pcs` : `${metrics.totalItemsCount} Items`}
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-0.5 font-medium">Across {metrics.filteredCount} visible PO(s)</span>
                    </div>
                    <div className="w-11 h-11 rounded-2xl bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/40 shrink-0">
                        <Building2 size={22} />
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
                    <div>
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Material Quantity</span>
                        <div className="text-2xl font-black text-cyan-600 dark:text-cyan-400 font-mono mt-0.5">
                            {metrics.totalQuantity.toLocaleString()} <span className="text-xs font-normal text-slate-400">Units</span>
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-0.5 font-medium">{metrics.totalItemsCount} total line item entries</span>
                    </div>
                    <div className="w-11 h-11 rounded-2xl bg-cyan-50 dark:bg-cyan-950/50 flex items-center justify-center text-cyan-600 dark:text-cyan-400 border border-cyan-100 dark:border-cyan-900/40 shrink-0">
                        <Truck size={22} />
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
                    <div>
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Filtered Value</span>
                        <div className="text-2xl font-black text-purple-700 dark:text-purple-300 font-mono mt-0.5">
                            ₹{metrics.totalPOValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </div>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold block mt-0.5">Pre-tax + GST & Freight</span>
                    </div>
                    <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40 shrink-0">
                        <ShieldCheck size={22} />
                    </div>
                </div>
            </div>
            
            {/* Search, Filter & Action Toolbar */}
            <div className="bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm flex flex-col xl:flex-row justify-between items-stretch xl:items-center gap-3">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 min-w-0">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="Search PO #, Vendor, or Material..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 bg-slate-50/50 dark:bg-slate-800/50"
                        />
                    </div>

                    {/* Vendor Selector */}
                    <div className="flex items-center gap-2 shrink-0">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">Vendor:</label>
                        <select
                            value={filterVendor}
                            onChange={(e) => setFilterVendor(e.target.value)}
                            className="w-full sm:w-auto px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl border border-gray-200 dark:border-slate-700 outline-none cursor-pointer focus:ring-2 focus:ring-purple-500/20 max-w-[220px] truncate"
                        >
                            <option value="All">All Vendors ({vendors.length})</option>
                            {(Array.isArray(vendors) ? vendors : []).map((v: any) => (
                                <option key={v._id || v.id} value={(v._id || v.id)?.toString()}>
                                    {v.name || v.companyName}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Right Side: Status Buttons & Action Buttons */}
                <div className="flex flex-wrap sm:flex-nowrap items-center justify-between sm:justify-end gap-2 shrink-0">
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold overflow-x-auto no-scrollbar max-w-full shrink-0 gap-0.5">
                        {['All', 'Released', 'Approved', 'Partially Received', 'Completed', 'Cancelled'].map(status => (
                            <button
                                key={status}
                                onClick={() => setFilterStatus(status)}
                                className={`px-2.5 py-1.5 rounded-lg whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                                    filterStatus === status
                                        ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-300 shadow-sm font-bold'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                                }`}
                            >
                                <span>{status}</span>
                                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                                    filterStatus === status 
                                        ? 'bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300' 
                                        : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                                }`}>
                                    {statusCounts[status] || 0}
                                </span>
                            </button>
                        ))}
                    </div>

                    {onCreatePO && (
                        <button
                            onClick={onCreatePO}
                            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                        >
                            <Plus size={15} /> Create Outward PO
                        </button>
                    )}
                </div>
            </div>

            {/* Filter and Search Match Count Bar */}
            <div className="flex items-center justify-between text-xs px-1 text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-2">
                    <span>
                        Showing <strong className="text-slate-900 dark:text-white font-bold">{filteredData.length}</strong> of <strong className="text-slate-900 dark:text-white font-bold">{data.length}</strong> Purchase Orders
                    </span>
                    {(searchTerm || filterStatus !== 'All' || filterVendor !== 'All') && (
                        <span className="text-[11px] text-purple-600 dark:text-purple-400 font-semibold">
                            (Filtered Results)
                        </span>
                    )}
                </div>
                {(searchTerm || filterStatus !== 'All' || filterVendor !== 'All') && (
                    <button
                        onClick={() => { setSearchTerm(''); setFilterStatus('All'); setFilterVendor('All'); }}
                        className="text-purple-600 dark:text-purple-400 hover:underline font-bold text-[11px] cursor-pointer"
                    >
                        Clear Filters
                    </button>
                )}
            </div>

            {filteredData.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 p-12 text-center rounded-2xl border border-gray-200 dark:border-slate-800 text-gray-500">
                    <ShoppingCart className="mx-auto mb-3 text-slate-300" size={32} />
                    <p className="font-medium text-sm">No Purchase Orders found matching current search or filters.</p>
                </div>
            ) : (
                <>
                    {/* Desktop Table View */}
                    <div className="hidden md:block bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-gray-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-[11px] uppercase font-bold text-gray-500 dark:text-slate-400 tracking-wider">
                                    <th className="px-6 py-3.5">PO Details</th>
                                    <th className="px-6 py-3.5">Vendor / Supplier</th>
                                    <th className="px-6 py-3.5">Items & Piece Count</th>
                                    <th className="px-6 py-3.5 text-right">Total Value</th>
                                    <th className="px-6 py-3.5 text-center">Status</th>
                                    <th className="px-6 py-3.5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-sm">
                                {filteredData.map((item) => {
                                    const vendorName = getVendorNameStr(item);
                                    const materialName = getMaterialNameStr(item);
                                    const amount = Number(item.grandTotal || item.totalAmount || item.amount || 0);
                                    const poDate = new Date(item.date || item.createdAt || Date.now()).toLocaleDateString('en-GB');

                                    const itemsList = Array.isArray(item.items) && item.items.length > 0 ? item.items : [];
                                    let rowPieceCount = 0;
                                    let rowQuantity = 0;
                                    itemsList.forEach((it: any) => {
                                        rowPieceCount += Number(it.pieceCount || it.count || 0);
                                        rowQuantity += Number(it.quantity || 0);
                                    });

                                    return (
                                        <tr key={item._id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span 
                                                        onClick={() => setSelectedPoPreview(item)}
                                                        className="font-mono font-extrabold text-purple-600 dark:text-purple-400 cursor-pointer hover:underline text-sm"
                                                        title="Click to preview PO details"
                                                    >
                                                        PO #{item.poNumber || '-'}
                                                    </span>
                                                    <span className="text-xs text-gray-500 font-medium mt-0.5">{poDate}</span>
                                                    {(item.createdByName || item.createdBy?.name) && (
                                                        <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                                                            <User size={10} /> {item.createdByName || item.createdBy?.name}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">
                                                {vendorName}
                                            </td>

                                            <td className="px-6 py-4 text-gray-600 dark:text-slate-300 font-medium">
                                                <div className="font-bold text-slate-900 dark:text-white">{materialName}</div>
                                                <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                                                    {rowPieceCount > 0 && (
                                                        <span className="font-mono font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.2 rounded">
                                                            {rowPieceCount} Pcs
                                                        </span>
                                                    )}
                                                    {rowQuantity > 0 && <span>Qty: {rowQuantity.toLocaleString()}</span>}
                                                    {itemsList.length > 1 && (
                                                        <span className="text-xs text-purple-600 dark:text-purple-400 font-bold">({itemsList.length} items)</span>
                                                    )}
                                                </div>
                                            </td>

                                            <td className="px-6 py-4 text-right text-gray-900 dark:text-white font-extrabold font-mono text-sm">
                                                ₹ {amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </td>

                                            <td className="px-6 py-4 text-center">
                                                <div className="flex flex-col items-center gap-1">
                                                    <select
                                                        disabled={updatingStatusId === item._id}
                                                        value={item.status || 'Released'}
                                                        onChange={(e) => handleUpdateStatus(item._id, e.target.value)}
                                                        className={`px-2.5 py-1 rounded-full text-xs font-bold border outline-none cursor-pointer shadow-sm transition-all ${
                                                            item.status === 'Released' || item.status === 'Approved' ? 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950 dark:text-purple-300' :
                                                            item.status === 'Completed' ? 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300' :
                                                            item.status === 'Partially Received' ? 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-300' :
                                                            item.status === 'Cancelled' ? 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950 dark:text-rose-300' :
                                                            'bg-gray-100 text-gray-800 border-gray-200'
                                                        }`}
                                                    >
                                                        <option value="Released">Released</option>
                                                        <option value="Approved">Approved</option>
                                                        <option value="Partially Received">Partially Received</option>
                                                        <option value="Completed">Completed</option>
                                                        <option value="Cancelled">Cancelled</option>
                                                    </select>
                                                    <span className="text-[10px] text-slate-400 font-medium">
                                                        Updated {new Date(item.updatedAt || item.date || Date.now()).toLocaleDateString('en-GB')}
                                                    </span>
                                                </div>
                                            </td>

                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-1.5">
                                                    <button 
                                                        onClick={() => setSelectedPoPreview(item)} 
                                                        className="p-1.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 rounded-lg transition-colors" 
                                                        title="Preview PO Details"
                                                    >
                                                        <Eye size={16} />
                                                    </button>

                                                    <button 
                                                        onClick={() => downloadPOAsPDF(item)} 
                                                        className="p-1.5 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/40 rounded-lg transition-colors" 
                                                        title="Download Frontend PDF"
                                                    >
                                                        <Download size={16} />
                                                    </button>

                                                    {(() => {
                                                        const remainingSecs = getRemainingEditSeconds(item.createdAt || item.date);
                                                        const isWithin24h = remainingSecs > 0;

                                                        return isWithin24h ? (
                                                            <>
                                                                <span 
                                                                    title={`Edit and delete allowed for another ${formatRemainingTime(remainingSecs)}`}
                                                                    className="px-2 py-1 bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 rounded-xl font-mono text-[10px] font-bold border border-amber-200 dark:border-amber-800 inline-flex items-center gap-1 shrink-0"
                                                                >
                                                                    <Clock size={11} className="text-amber-600 animate-pulse" />
                                                                    {formatRemainingTime(remainingSecs)}
                                                                </span>

                                                                <button 
                                                                    onClick={() => onEdit(item)} 
                                                                    className="p-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition-colors cursor-pointer" 
                                                                    title={`Edit PO (${formatRemainingTime(remainingSecs)} left)`}
                                                                >
                                                                    <Edit2 size={16} />
                                                                </button>

                                                                <button 
                                                                    onClick={() => handleDeleteSafe(item)} 
                                                                    className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer" 
                                                                    title={`Delete PO (${formatRemainingTime(remainingSecs)} left)`}
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <span 
                                                                title="Editing and deleting window expired (24h limit)" 
                                                                className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-400 text-[10px] font-semibold rounded-xl inline-flex items-center gap-1 opacity-70"
                                                            >
                                                                <Lock size={11} /> Locked
                                                            </span>
                                                        );
                                                    })()}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            {/* Sticky Table Footer Summary Row */}
                            <tfoot className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50/90 dark:bg-slate-800/90 font-bold text-xs text-slate-700 dark:text-slate-200">
                                <tr>
                                    <td className="px-6 py-3.5 text-slate-900 dark:text-white" colSpan={2}>
                                        <div className="flex items-center gap-2">
                                            <span>Summary Total:</span>
                                            <span className="font-mono bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full text-[11px]">
                                                {metrics.filteredCount} / {metrics.totalPOs} PO(s)
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-3.5">
                                        <div className="flex items-center gap-2">
                                            {metrics.totalPiecesCount > 0 && (
                                                <span className="font-mono text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded font-bold">
                                                    {metrics.totalPiecesCount} Pcs
                                                </span>
                                            )}
                                            <span>• {metrics.totalQuantity.toLocaleString()} Total Qty ({metrics.totalItemsCount} items)</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-3.5 text-right font-black font-mono text-purple-700 dark:text-purple-300 text-sm">
                                        ₹{metrics.totalPOValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-6 py-3.5" colSpan={2}></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="block md:hidden space-y-3 pb-28 sm:pb-20">
                        {filteredData.map((item) => {
                            const vendorName = getVendorNameStr(item);
                            const materialName = getMaterialNameStr(item);
                            const amount = Number(item.grandTotal || item.totalAmount || item.amount || 0);
                            const poDate = new Date(item.date || item.createdAt || Date.now()).toLocaleDateString('en-GB');
                            const remainingSecs = getRemainingEditSeconds(item.createdAt || item.date);
                            const isWithin24h = remainingSecs > 0;

                            const itemsList = Array.isArray(item.items) && item.items.length > 0 ? item.items : [];
                            let rowPieceCount = 0;
                            let rowQuantity = 0;
                            itemsList.forEach((it: any) => {
                                rowPieceCount += Number(it.pieceCount || it.count || 0);
                                rowQuantity += Number(it.quantity || 0);
                            });

                            return (
                                <div key={item._id} className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800 flex flex-col gap-3">
                                    <div className="flex justify-between items-start border-b border-gray-100 dark:border-slate-800 pb-2.5">
                                        <div>
                                            <span onClick={() => setSelectedPoPreview(item)} className="text-xs font-mono font-extrabold text-purple-600 dark:text-purple-400 cursor-pointer block mb-0.5">
                                                PO #{item.poNumber || '-'}
                                            </span>
                                            <h4 className="font-bold text-gray-900 dark:text-white text-sm">{vendorName}</h4>
                                            <div className="text-[11px] text-gray-500 dark:text-slate-400 font-medium">{poDate}</div>
                                        </div>
                                        <select
                                            disabled={updatingStatusId === item._id}
                                            value={item.status || 'Released'}
                                            onChange={(e) => handleUpdateStatus(item._id, e.target.value)}
                                            className={`px-2.5 py-1 rounded-full text-xs font-bold border outline-none cursor-pointer shadow-sm ${
                                                item.status === 'Released' || item.status === 'Approved' ? 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950 dark:text-purple-300' :
                                                item.status === 'Completed' ? 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300' :
                                                item.status === 'Partially Received' ? 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-300' :
                                                item.status === 'Cancelled' ? 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950 dark:text-rose-300' :
                                                'bg-gray-100 text-gray-800 border-gray-200'
                                            }`}
                                        >
                                            <option value="Released">Released</option>
                                            <option value="Approved">Approved</option>
                                            <option value="Partially Received">Partially Received</option>
                                            <option value="Completed">Completed</option>
                                            <option value="Cancelled">Cancelled</option>
                                        </select>
                                    </div>

                                    {/* Items & Amount Summary */}
                                    <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl text-xs space-y-1.5 border border-slate-100 dark:border-slate-800">
                                        <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                                            <span className="font-semibold text-slate-500">Items:</span>
                                            <div className="text-right">
                                                <div className="font-bold truncate max-w-[200px]">
                                                    {materialName} {itemsList.length > 1 && `(+${itemsList.length - 1} more)`}
                                                </div>
                                                <div className="text-[10.5px] text-slate-400 flex justify-end gap-1.5 mt-0.5">
                                                    {rowPieceCount > 0 && <span className="text-amber-700 dark:text-amber-300 font-bold">{rowPieceCount} Pcs</span>}
                                                    {rowQuantity > 0 && <span>• Qty: {rowQuantity}</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                                            <span className="font-bold text-slate-700 dark:text-slate-300">Total Value:</span>
                                            <span className="font-extrabold text-purple-600 dark:text-purple-400 font-mono text-sm">
                                                ₹ {amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Action Buttons & Countdown */}
                                    <div className="flex items-center justify-between gap-1.5 pt-1">
                                        <div className="flex items-center gap-1.5 flex-1">
                                            <button onClick={() => setSelectedPoPreview(item)} className="flex-1 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 rounded-xl flex items-center justify-center gap-1">
                                                <Eye size={14} /> View
                                            </button>
                                            <button onClick={() => downloadPOAsPDF(item)} className="flex-1 py-2 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-xl flex items-center justify-center gap-1 shadow-sm">
                                                <Download size={14} /> PDF
                                            </button>
                                        </div>

                                        {isWithin24h ? (
                                            <div className="flex items-center gap-1 shrink-0">
                                                <span 
                                                    className="px-2 py-1 bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 rounded-xl font-mono text-[10px] font-bold border border-amber-200 dark:border-amber-800 inline-flex items-center gap-1"
                                                >
                                                    <Clock size={11} className="text-amber-600 animate-pulse" />
                                                    {formatRemainingTime(remainingSecs)}
                                                </span>
                                                <button onClick={() => onEdit(item)} className="p-2 text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 rounded-xl flex items-center justify-center" title="Edit">
                                                    <Edit2 size={15} />
                                                </button>
                                                <button onClick={() => handleDeleteSafe(item)} className="p-2 text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 rounded-xl flex items-center justify-center" title="Delete">
                                                    <Trash2 size={15} />
                                                </button>
                                            </div>
                                        ) : (
                                            <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-400 text-[10px] font-semibold rounded-xl inline-flex items-center gap-1 opacity-70">
                                                <Lock size={11} /> Locked
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {/* Clickable Outward PO Preview Modal with User History & Audit */}
            {selectedPoPreview && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-[95vw] lg:max-w-6xl xl:max-w-7xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh]">
                        
                        {/* Modal Header */}
                        <div className="p-6 bg-purple-950 text-white flex justify-between items-center flex-shrink-0 border-b border-purple-900">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-purple-900 rounded-xl flex items-center justify-center border border-purple-700">
                                    <ShoppingCart size={20} className="text-purple-300" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-mono font-extrabold tracking-tight text-purple-200">{selectedPoPreview.poNumber || 'PO Preview'}</h2>
                                    <p className="text-xs text-purple-300/80 mt-0.5">Purchase Order Details & Audit Trail</p>
                                </div>
                            </div>
                            <button onClick={() => setSelectedPoPreview(null)} className="w-8 h-8 rounded-full bg-purple-900 hover:bg-purple-800 flex items-center justify-center text-white transition-colors">
                                <X size={18} />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 overflow-y-auto space-y-6">
                            
                            {/* Company (Buyer) & Vendor Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="bg-gradient-to-br from-purple-50/70 to-slate-50 dark:from-slate-800/80 dark:to-slate-900 p-4 rounded-2xl border border-purple-200/70 dark:border-slate-700 text-xs space-y-1.5 shadow-sm">
                                    <div className="flex justify-between items-center">
                                        <span className="text-purple-700 dark:text-purple-300 font-extrabold uppercase block text-[10px] tracking-wider">
                                            BUYER / ISSUING COMPANY
                                        </span>
                                        <span className="text-[9.5px] bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded font-mono font-bold">
                                            ISSUER
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between gap-2 pt-0.5">
                                        <div className="text-sm font-black text-slate-900 dark:text-white">
                                            {(companyInfo || fetchedCompanyInfo)?.companyName || 'BINSERP ENTERPRISE'}
                                        </div>
                                        {((companyInfo || fetchedCompanyInfo)?.logo) && (
                                            <div className="p-1 bg-white dark:bg-slate-800 rounded-lg border border-purple-100 dark:border-slate-700 shrink-0">
                                                <img 
                                                    src={((companyInfo || fetchedCompanyInfo)?.logo?.startsWith('http') || (companyInfo || fetchedCompanyInfo)?.logo?.startsWith('data:')) 
                                                        ? (companyInfo || fetchedCompanyInfo)?.logo 
                                                        : `${API_BASE_URL}${(companyInfo || fetchedCompanyInfo)?.logo?.startsWith('/') ? '' : '/'}${(companyInfo || fetchedCompanyInfo)?.logo}`}
                                                    alt="Company Logo"
                                                    className="h-7 max-w-[90px] object-contain"
                                                />
                                            </div>
                                        )}
                                    </div>
                                    {((companyInfo || fetchedCompanyInfo)?.billingAddress || (companyInfo || fetchedCompanyInfo)?.address) && (
                                        <div className="text-slate-500 dark:text-slate-400 text-[11px]">
                                            {(companyInfo || fetchedCompanyInfo)?.billingAddress || (companyInfo || fetchedCompanyInfo)?.address}
                                        </div>
                                    )}
                                    <div className="flex flex-wrap gap-2 pt-1 font-mono text-[10px] text-slate-600 dark:text-slate-300 bg-white/70 dark:bg-slate-950/40 p-2 rounded-lg border border-purple-100 dark:border-slate-800">
                                        <span><b>GSTIN:</b> {(companyInfo || fetchedCompanyInfo)?.gstNumber || (companyInfo || fetchedCompanyInfo)?.gstin || 'N/A'}</span>
                                        <span>• <b>PAN:</b> {(companyInfo || fetchedCompanyInfo)?.panNumber || (companyInfo || fetchedCompanyInfo)?.pan || 'N/A'}</span>
                                        {((companyInfo || fetchedCompanyInfo)?.contactPerson) && <span>• <b>Contact:</b> {(companyInfo || fetchedCompanyInfo)?.contactPerson}</span>}
                                    </div>
                                </div>

                                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs space-y-1.5">
                                    <div className="flex justify-between items-center">
                                        <span className="text-purple-600 dark:text-purple-400 font-bold uppercase block text-[10px] tracking-wider">
                                            TARGET VENDOR / SUPPLIER
                                        </span>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-slate-400">Status:</span>
                                            <select
                                                value={selectedPoPreview.status || 'Released'}
                                                onChange={(e) => handleUpdateStatus(selectedPoPreview._id, e.target.value)}
                                                className="px-2 py-0.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md font-bold text-[11px] text-purple-700 dark:text-purple-300 outline-none cursor-pointer"
                                            >
                                                <option value="Released">Released</option>
                                                <option value="Approved">Approved</option>
                                                <option value="Partially Received">Partially Received</option>
                                                <option value="Completed">Completed</option>
                                                <option value="Cancelled">Cancelled</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="text-sm font-extrabold text-slate-900 dark:text-white mt-0.5">{getVendorNameStr(selectedPoPreview)}</div>
                                    {getVendorAddressStr(selectedPoPreview.vendor) && <div className="text-slate-500 dark:text-slate-400 text-[11px]">{getVendorAddressStr(selectedPoPreview.vendor)}</div>}
                                    <div className="flex flex-wrap gap-2 pt-1 font-mono text-[10px] text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200/80 dark:border-slate-800">
                                        <span><b>GSTIN:</b> {getVendorGstStr(selectedPoPreview.vendor) || 'N/A'}</span>
                                        {selectedPoPreview.vendor?.pan && <span>• <b>PAN:</b> {selectedPoPreview.vendor.pan}</span>}
                                        {selectedPoPreview.vendor?.contactPerson && <span>• <b>Contact:</b> {selectedPoPreview.vendor.contactPerson}</span>}
                                    </div>
                                    <div className="flex items-center gap-3 pt-1 text-[11px] text-slate-500">
                                        <span><b>PO Date:</b> {new Date(selectedPoPreview.date || Date.now()).toLocaleDateString('en-GB')}</span>
                                        {selectedPoPreview.quotationNumber && <span>• <b>Ref Quote:</b> {selectedPoPreview.quotationNumber}</span>}
                                    </div>
                                </div>
                            </div>

                            {/* User Audit & Activity Log Card */}
                            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs space-y-3">
                                <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-2">
                                    <span className="font-extrabold text-purple-600 uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                                        <ShieldCheck size={14} /> USER AUDIT & CREATION HISTORY
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="flex items-start gap-2.5">
                                        <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">
                                            <User size={14} />
                                        </div>
                                        <div>
                                            <span className="text-slate-400 block text-[10px]">Created By:</span>
                                            <strong className="text-slate-800 dark:text-slate-200 text-xs">
                                                {selectedPoPreview.createdByName || selectedPoPreview.createdBy?.name || selectedPoPreview.createdBy?.username || selectedPoPreview.createdBy?.email || 'Admin User'}
                                            </strong>
                                            <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">
                                                {new Date(selectedPoPreview.createdAt || selectedPoPreview.date || Date.now()).toLocaleString('en-GB')}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-2.5">
                                        <div className="w-7 h-7 rounded-full bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300 flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">
                                            <Clock size={14} />
                                        </div>
                                        <div>
                                            <span className="text-slate-400 block text-[10px]">Last Updated By:</span>
                                            <strong className="text-slate-800 dark:text-slate-200 text-xs">
                                                {selectedPoPreview.updatedByName || selectedPoPreview.updatedBy?.name || selectedPoPreview.updatedBy?.username || selectedPoPreview.updatedBy?.email || 'Admin User'}
                                            </strong>
                                            <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">
                                                {new Date(selectedPoPreview.updatedAt || Date.now()).toLocaleString('en-GB')}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Status Audit History Log Timeline */}
                                {Array.isArray(selectedPoPreview.history) && selectedPoPreview.history.length > 0 && (
                                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-2">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                                            <History size={12} /> Status Change Audit Trail ({selectedPoPreview.history.length})
                                        </span>
                                        <div className="max-h-32 overflow-y-auto space-y-1.5 pr-1">
                                            {selectedPoPreview.history.map((hist: any, hIdx: number) => (
                                                <div key={hIdx} className="flex justify-between items-center bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200/80 dark:border-slate-800 text-[11px]">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                                            hist.status === 'Released' || hist.status === 'Approved' ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300' :
                                                            hist.status === 'Completed' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                                                            hist.status === 'Partially Received' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' :
                                                            hist.status === 'Cancelled' ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300' :
                                                            'bg-gray-100 text-gray-800'
                                                        }`}>
                                                            {hist.status}
                                                        </span>
                                                        <span className="text-slate-600 dark:text-slate-300 font-medium">Changed by <b>{hist.updatedBy || 'User'}</b></span>
                                                    </div>
                                                    <span className="text-slate-400 font-mono text-[10px]">{new Date(hist.updatedAt || Date.now()).toLocaleString('en-GB')}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Linked Inventory GRN Receipts & Timeline */}
                            <div className="bg-gradient-to-br from-purple-50/70 to-slate-50 dark:from-slate-800/80 dark:to-slate-900 p-4 rounded-2xl border border-purple-200/80 dark:border-slate-700 text-xs space-y-4 shadow-sm">
                                <div className="flex justify-between items-center border-b border-purple-200 dark:border-slate-700 pb-2.5">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 bg-purple-600 text-white rounded-lg">
                                            <Truck size={14} />
                                        </div>
                                        <div>
                                            <h5 className="font-extrabold text-slate-900 dark:text-white text-xs uppercase tracking-wider">LINKED INVENTORY GRN RECEIPTS & TIMELINE</h5>
                                            <p className="text-[10px] text-slate-500 dark:text-slate-400">Stock entries linked to PO #{selectedPoPreview.poNumber}</p>
                                        </div>
                                    </div>
                                    <span className="px-2.5 py-1 bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 font-extrabold text-[10px] rounded-full">
                                        {(selectedPoPreview.linkedGrns || selectedPoPreview.transactions || []).length} GRN Record(s)
                                    </span>
                                </div>

                                {/* GRN Summary Metrics */}
                                {(() => {
                                    const linkedGrnList = selectedPoPreview.linkedGrns || selectedPoPreview.transactions || [];
                                    let totalOrderedQty = 0;
                                    (selectedPoPreview.items || []).forEach((it: any) => totalOrderedQty += Number(it.quantity || 0));
                                    
                                    let totalReceivedQty = 0;
                                    linkedGrnList.forEach((grn: any) => {
                                        (grn.items || []).forEach((it: any) => {
                                            totalReceivedQty += Number(it.receivedQuantity || it.quantity || 0);
                                        });
                                    });
                                    const pendingQty = Math.max(0, totalOrderedQty - totalReceivedQty);

                                    return (
                                        <div className="grid grid-cols-3 gap-3 text-center bg-white dark:bg-slate-900 p-3 rounded-xl border border-purple-100 dark:border-slate-800 font-mono">
                                            <div>
                                                <span className="text-[10px] text-slate-400 font-sans block uppercase">Total Ordered</span>
                                                <strong className="text-slate-900 dark:text-white text-sm font-extrabold">{totalOrderedQty} PCS</strong>
                                            </div>
                                            <div>
                                                <span className="text-[10px] text-slate-400 font-sans block uppercase">Received via GRN</span>
                                                <strong className="text-emerald-600 dark:text-emerald-400 text-sm font-extrabold">{totalReceivedQty} PCS</strong>
                                            </div>
                                            <div>
                                                <span className="text-[10px] text-slate-400 font-sans block uppercase">Pending Balance</span>
                                                <strong className={`text-sm font-extrabold ${pendingQty > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>{pendingQty} PCS</strong>
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Chronological Timeline List */}
                                {(() => {
                                    const linkedGrnList = selectedPoPreview.linkedGrns || selectedPoPreview.transactions || [];
                                    if (linkedGrnList.length === 0) {
                                        return (
                                            <div className="p-4 text-center bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-800 text-slate-400 text-xs">
                                                <Clock className="mx-auto mb-1 opacity-50" size={18} />
                                                <p className="font-semibold">No Goods Receipts (GRN) logged yet for this PO.</p>
                                                <span className="text-[10px] text-slate-400">Stock entries will automatically show here once created under Store GRN.</span>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div className="space-y-3 relative pl-4 border-l-2 border-purple-300 dark:border-purple-800/80 my-2">
                                            {linkedGrnList.map((grn: any, gIdx: number) => {
                                                const grnDateStr = new Date(grn.date || grn.createdAt || Date.now()).toLocaleString('en-GB');
                                                const receiverName = grn.receivedBy?.name || grn.receivedBy?.username || grn.receivedBy || 'Store Admin';
                                                const itemsReceived = Array.isArray(grn.items) ? grn.items : [];

                                                return (
                                                    <div key={gIdx} className="relative group">
                                                        {/* Timeline Dot */}
                                                        <div className="absolute -left-[23px] top-1.5 w-3 h-3 rounded-full bg-purple-600 border-2 border-white dark:border-slate-900 shadow-sm" />

                                                        <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 shadow-sm">
                                                            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-1.5">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="px-2 py-0.5 bg-purple-600 text-white font-mono font-extrabold text-[11px] rounded-md">
                                                                        {grn.grnNumber || 'GRN-Doc'}
                                                                    </span>
                                                                    <span className="text-[10px] text-slate-400 font-mono">{grnDateStr}</span>
                                                                </div>

                                                                <div className="flex items-center gap-2">
                                                                    <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                                                        grn.qcStatus === 'Completed' || grn.qcStatus === 'Accepted' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                                                                        grn.qcStatus === 'Skipped' ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' :
                                                                        'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                                                    }`}>
                                                                        QC: {grn.qcStatus || 'Skipped'}
                                                                    </span>
                                                                    <span className="text-[10px] text-slate-500 font-medium">Logged by <b>{receiverName}</b></span>
                                                                </div>
                                                            </div>

                                                            {/* Items Breakdown */}
                                                            {itemsReceived.length > 0 && (
                                                                <div className="space-y-1 pt-1">
                                                                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Received Items:</span>
                                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                                                        {itemsReceived.map((it: any, itIdx: number) => (
                                                                            <div key={itIdx} className="bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg text-[11px] flex justify-between items-center">
                                                                                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{it.materialName || 'Material'}</span>
                                                                                <div className="text-right font-mono font-extrabold text-emerald-600 dark:text-emerald-400 ml-2 whitespace-nowrap">
                                                                                    +{it.receivedQuantity || it.quantity || 0} {it.unit || 'PCS'}
                                                                                    {Number(it.rejectedQuantity || 0) > 0 && (
                                                                                        <span className="text-rose-500 text-[10px] block font-normal">({it.rejectedQuantity} rej)</span>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* Materials Table */}
                            <div className="space-y-2">
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Purchase Order Line Items</h4>
                                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-purple-50 dark:bg-slate-800 font-bold text-purple-900 dark:text-purple-300 uppercase">
                                            <tr>
                                                <th className="p-3 text-center w-10">S.No</th>
                                                <th className="p-3">Item & Specifications</th>
                                                <th className="p-3 text-center">HSN</th>
                                                <th className="p-3 text-center">Count</th>
                                                <th className="p-3 text-center">Qty</th>
                                                <th className="p-3 text-right">Unit Rate (₹)</th>
                                                <th className="p-3 text-right">Amount (₹)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                            {(Array.isArray(selectedPoPreview.items) && selectedPoPreview.items.length > 0 
                                                ? selectedPoPreview.items 
                                                : [{
                                                    materialName: getMaterialNameStr(selectedPoPreview),
                                                    description: selectedPoPreview.description || selectedPoPreview.remarks || selectedPoPreview.specifications || '',
                                                    hsnCode: selectedPoPreview.hsnCode || '',
                                                    pieceCount: selectedPoPreview.pieceCount || 0,
                                                    quantity: selectedPoPreview.quantity || 1,
                                                    unit: selectedPoPreview.unit || 'PCS',
                                                    rate: selectedPoPreview.rate || selectedPoPreview.amount || 0,
                                                    taxRate: selectedPoPreview.taxRate != null ? selectedPoPreview.taxRate : 18,
                                                    amount: selectedPoPreview.amount || 0
                                                }]
                                            ).map((it: any, idx: number) => {
                                                const itemName = getMaterialNameStr(it);
                                                const qty = Number(it.quantity || 1);
                                                const pieceCount = Number(it.pieceCount || it.count || 0);
                                                const unit = it.unit || it.uom || 'PCS';
                                                const rate = Number(it.rate || it.unitPrice || 0);
                                                const lineNet = qty * rate; // Actual amount without tax
                                                const itemDesc = it.description || it.itemDescription || it.remarks || it.specifications || it.material?.description || (idx === 0 ? (selectedPoPreview.description || selectedPoPreview.remarks) : '') || '';

                                                return (
                                                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                                        <td className="p-3 text-center text-slate-500 font-bold">{idx + 1}</td>
                                                        <td className="p-3">
                                                            <div className="font-bold text-slate-900 dark:text-white">{itemName}</div>
                                                            {itemDesc && <div className="text-[11px] text-slate-500 dark:text-slate-400 italic mt-0.5">{itemDesc}</div>}
                                                        </td>
                                                        <td className="p-3 text-center font-mono font-semibold text-slate-600 dark:text-slate-300">{it.hsnCode || '-'}</td>
                                                        <td className="p-3 text-center font-bold text-amber-700 dark:text-amber-300">{pieceCount > 0 ? `${pieceCount} Pcs` : '-'}</td>
                                                        <td className="p-3 text-center font-bold text-slate-700 dark:text-slate-300">{qty} {unit}</td>
                                                        <td className="p-3 text-right font-semibold">₹{rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                                        <td className="p-3 text-right font-extrabold text-purple-600 dark:text-purple-400 font-mono">
                                                            ₹{lineNet.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Logistics & Summary Card */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                                    <h5 className="font-extrabold text-purple-600 uppercase text-[10px]">LOGISTICS & FREIGHT</h5>
                                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                        <span>Transport Type:</span>
                                        <strong className="text-slate-900 dark:text-white">{selectedPoPreview.transportType || 'Road Freight'}</strong>
                                    </div>
                                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                        <span>Freight Charges:</span>
                                        <strong className="text-cyan-600 font-mono">₹{Number(selectedPoPreview.transportCharge || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                                    </div>
                                    <div className="flex justify-between text-slate-600 dark:text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-700">
                                        <span>Packing Type:</span>
                                        <strong className="text-slate-900 dark:text-white">{selectedPoPreview.packingType || 'Standard Packaging'}</strong>
                                    </div>
                                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                        <span>Packing Charges:</span>
                                        <strong className="text-indigo-600 font-mono">₹{Number(selectedPoPreview.packingCharge || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                                    </div>
                                </div>

                                <div className="bg-purple-50/60 dark:bg-purple-950/40 p-4 rounded-2xl border border-purple-200 dark:border-purple-800/50 space-y-2 text-xs">
                                    <h5 className="font-extrabold text-purple-700 dark:text-purple-300 uppercase text-[10px]">PAYABLE BREAKDOWN</h5>
                                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                        <span>Items Subtotal:</span>
                                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                                            ₹{(selectedPoPreview.subtotal || selectedPoPreview.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>

                                    {/* Separate CGST/SGST or IGST Rows with explicit Rates */}
                                    {(() => {
                                        const prevTaxRate = selectedPoPreview.taxRate != null ? Number(selectedPoPreview.taxRate) : 18;
                                        const isInterState = selectedPoPreview.gstType === 'inter_state';
                                        const prevCgstRate = selectedPoPreview.cgstRate != null ? Number(selectedPoPreview.cgstRate) : (prevTaxRate / 2);
                                        const prevSgstRate = selectedPoPreview.sgstRate != null ? Number(selectedPoPreview.sgstRate) : (prevTaxRate / 2);
                                        const prevIgstRate = selectedPoPreview.igstRate != null ? Number(selectedPoPreview.igstRate) : prevTaxRate;

                                        return isInterState ? (
                                            <div className="flex justify-between text-cyan-700 dark:text-cyan-300 font-bold bg-cyan-100/50 dark:bg-cyan-950/40 px-2.5 py-1 rounded-lg">
                                                <span>Integrated GST (IGST @ {prevIgstRate}%):</span>
                                                <span className="font-mono">
                                                    ₹{(Number(selectedPoPreview.igstAmount) || Number(selectedPoPreview.totalTax) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex justify-between text-cyan-700 dark:text-cyan-300 font-bold bg-cyan-100/50 dark:bg-cyan-950/40 px-2.5 py-1 rounded-lg">
                                                    <span>Central GST (CGST @ {prevCgstRate}%):</span>
                                                    <span className="font-mono">
                                                        ₹{(Number(selectedPoPreview.cgstAmount) || (Number(selectedPoPreview.totalTax || 0) / 2)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between text-indigo-700 dark:text-indigo-300 font-bold bg-indigo-100/50 dark:bg-indigo-950/40 px-2.5 py-1 rounded-lg">
                                                    <span>State GST (SGST @ {prevSgstRate}%):</span>
                                                    <span className="font-mono">
                                                        ₹{(Number(selectedPoPreview.sgstAmount) || (Number(selectedPoPreview.totalTax || 0) / 2)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                    </span>
                                                </div>
                                            </>
                                        );
                                    })()}

                                    <div className="flex justify-between text-slate-600 dark:text-slate-400 pt-1 border-t border-purple-200/60 dark:border-purple-800/60">
                                        <span>Total GST Tax ({selectedPoPreview.taxRate != null ? selectedPoPreview.taxRate : 18}%):</span>
                                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                                            ₹{(selectedPoPreview.totalTax || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-purple-900 dark:text-purple-200 pt-2 border-t border-purple-200 dark:border-purple-800 font-black text-sm">
                                        <span>Grand Total PO Value:</span>
                                        <span className="font-mono text-purple-700 dark:text-purple-300">
                                            ₹{Number(selectedPoPreview.grandTotal || selectedPoPreview.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                </div>
                            </div>

                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 bg-slate-50 dark:bg-slate-800 flex justify-between items-center border-t border-slate-200 dark:border-slate-700">
                            <button onClick={() => setSelectedPoPreview(null)} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl">
                                Close
                            </button>

                            <button 
                                onClick={() => downloadPOAsPDF(selectedPoPreview)} 
                                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-purple-600/20 flex items-center gap-2"
                            >
                                <Printer size={15} /> Print / Save PO PDF (Frontend)
                            </button>
                        </div>

                    </div>
                </div>
            )}

        </div>
    );
}

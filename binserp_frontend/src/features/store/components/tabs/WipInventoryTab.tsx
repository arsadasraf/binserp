"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Layers, 
  Search, 
  Factory, 
  Eye, 
  RefreshCw, 
  Boxes, 
  Package, 
  ShoppingCart, 
  CheckCircle2, 
  Clock, 
  ArrowUpRight, 
  ArrowDownLeft,
  FileText,
  Filter,
  Warehouse,
  History,
  Download
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { apiGet } from '@/src/lib/api';
import WipLedgerDrawer from '../modals/WipLedgerDrawer';

export type WipSubTabType = 'rm' | 'bo' | 'fg' | 'mrp' | 'ledger' | 'mrp-buckets';

interface WipInventoryTabProps {
    token: string | null;
    companyInfo?: any;
    activeSubTab?: WipSubTabType;
    title?: string;
    description?: string;
    onError: (msg: string) => void;
    onSuccess: (msg: string) => void;
}

export default function WipInventoryTab({ 
    token, 
    companyInfo, 
    activeSubTab = 'rm',
    title,
    description,
    onError, 
    onSuccess 
}: WipInventoryTabProps) {
    const router = useRouter();
    const [wipType, setWipType] = useState<WipSubTabType>(activeSubTab === 'mrp-buckets' ? 'mrp' : activeSubTab);
    const [loading, setLoading] = useState(true);
    const [wipItems, setWipItems] = useState<any[]>([]);
    const [mrpBuckets, setMrpBuckets] = useState<any[]>([]);
    const [ledgerTransactions, setLedgerTransactions] = useState<any[]>([]);
    const [summary, setSummary] = useState({
        totalItems: 0,
        totalActiveWipItems: 0,
        totalIssuedQty: 0,
        totalJobWorkSentQty: 0,
        totalReturnedQty: 0,
        totalFgConsumedQty: 0,
        netPendingWipQty: 0,
        shopfloorWipQty: 0,
        jobWorkWipQty: 0
    });

    // Filter States
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [filterMrp, setFilterMrp] = useState('');
    const [filterStatus, setFilterStatus] = useState<'All' | 'Active WIP Only' | 'WIP Zero' | 'Completed'>('All');

    // Ledger Drawer State
    const [selectedWipItem, setSelectedWipItem] = useState<any | null>(null);
    const [isLedgerOpen, setIsLedgerOpen] = useState(false);

    useEffect(() => {
        if (activeSubTab) {
            setWipType(activeSubTab === 'mrp-buckets' ? 'mrp' : activeSubTab);
        }
    }, [activeSubTab]);

    const fetchWipInventory = async () => {
        if (!token) return;
        try {
            setLoading(true);
            const backendType = wipType === 'mrp' ? 'mrp-buckets' : wipType;
            const res = await apiGet(`/api/store/wip/inventory?type=${backendType}`, token);
            setWipItems(res.wipItems || []);
            setMrpBuckets(res.mrpBuckets || []);
            setLedgerTransactions(res.ledger || []);
            if (res.summary) setSummary(res.summary);
        } catch (err: any) {
            console.error("Failed to fetch WIP inventory:", err);
            onError(err.message || 'Failed to fetch WIP Inventory');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchWipInventory();
    }, [token, wipType]);

    // Unique Categories list for filter dropdown
    const categoriesList = useMemo(() => {
        const set = new Map();
        wipItems.forEach(item => {
            if (item.categoryName) set.set(item.categoryName, item.categoryName);
        });
        return Array.from(set.values());
    }, [wipItems]);

    // Unique MRP Numbers list for filter dropdown
    const mrpList = useMemo(() => {
        const set = new Map();
        mrpBuckets.forEach(bucket => {
            if (bucket.mrpNumber) set.set(bucket.mrpNumber, bucket.mrpNumber);
        });
        return Array.from(set.values());
    }, [mrpBuckets]);

    // Filtered Items for standard RM/BO/FG WIP tabs
    const filteredItems = useMemo(() => {
        return wipItems.filter(item => {
            const matchSearch =
                (item.materialName && item.materialName.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (item.materialCode && item.materialCode.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (item.materialDescription && item.materialDescription.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (item.categoryName && item.categoryName.toLowerCase().includes(searchTerm.toLowerCase()));

            const matchCategory = !filterCategory || item.categoryName === filterCategory;
            
            let matchStatus = true;
            if (filterStatus === 'Active WIP Only') {
                matchStatus = item.pendingWipQty > 0;
            } else if (filterStatus === 'WIP Zero') {
                matchStatus = item.pendingWipQty <= 0;
            }

            return matchSearch && matchCategory && matchStatus;
        });
    }, [wipItems, searchTerm, filterCategory, filterStatus]);

    // Filtered MRP Buckets for MRP WIP Inventory tab
    const filteredMrpBuckets = useMemo(() => {
        return mrpBuckets.filter(bucket => {
            const matchSearch =
                (bucket.mrpNumber && bucket.mrpNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (bucket.customerName && bucket.customerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (bucket.items && bucket.items.some((it: any) => it.materialName?.toLowerCase().includes(searchTerm.toLowerCase())));

            const matchMrp = !filterMrp || bucket.mrpNumber === filterMrp;
            const matchStatus = filterStatus === 'All' || 
                (filterStatus === 'Completed' ? bucket.status === 'Completed' : bucket.status !== 'Completed');

            return matchSearch && matchMrp && matchStatus;
        });
    }, [mrpBuckets, searchTerm, filterMrp, filterStatus]);

    // Filtered Ledger Transactions
    const filteredLedger = useMemo(() => {
        return ledgerTransactions.filter(tx => {
            const matchSearch =
                (tx.materialName && tx.materialName.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (tx.docNumber && tx.docNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (tx.mrpNumber && tx.mrpNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (tx.type && tx.type.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (tx.processType && tx.processType.toLowerCase().includes(searchTerm.toLowerCase()));

            const matchMrp = !filterMrp || tx.mrpNumber === filterMrp;
            return matchSearch && matchMrp;
        });
    }, [ledgerTransactions, searchTerm, filterMrp]);

    const openLedger = (item: any) => {
        setSelectedWipItem(item);
        setIsLedgerOpen(true);
    };

    // Excel Export Function for All Stock Details
    const exportToExcel = () => {
        const wb = XLSX.utils.book_new();
        const dateStr = new Date().toISOString().split('T')[0];

        if (wipType === 'mrp') {
            const rows = filteredMrpBuckets.map((bucket, idx) => ({
                'S.No': idx + 1,
                'MRP Number': bucket.mrpNumber || '-',
                'Customer / Reference': bucket.customerName || '-',
                'Status': bucket.status || 'Planned',
                'RM Issued': bucket.totalRmIssued || 0,
                'BO Issued': bucket.totalBoIssued || 0,
                'FG / Comp Issued': bucket.totalFgIssued || 0,
                'FG Produced': bucket.totalFgProduced || 0,
                'Net Pending WIP Units': bucket.netPendingWipCount || 0,
                'Items in WIP': (bucket.items || []).map((it: any) => `${it.materialName} (${it.pendingQty} ${it.unit})`).join('; ')
            }));
            const ws = XLSX.utils.json_to_sheet(rows);
            XLSX.utils.book_append_sheet(wb, ws, 'MRP_WIP_Inventory');
            XLSX.writeFile(wb, `MRP_WIP_Inventory_${dateStr}.xlsx`);
        } else if (wipType === 'ledger') {
            const rows = filteredLedger.map((tx, idx) => ({
                'S.No': idx + 1,
                'Date & Time': tx.date ? new Date(tx.date).toLocaleString() : '-',
                'Document #': tx.docNumber || '-',
                'MRP Reference': tx.mrpNumber || 'Direct Issue',
                'Material Name': tx.materialName || '-',
                'Material Code': tx.materialCode || '-',
                'Movement Type': tx.type || '-',
                'Process / Vendor': tx.processType || tx.vendorName || '-',
                'WIP Inward (+)': tx.sentQty > 0 ? tx.sentQty : 0,
                'WIP Consumed (-)': tx.receivedQty > 0 ? tx.receivedQty : 0,
                'Unit': tx.unit || 'PCS',
                'Status': tx.status || 'Recorded'
            }));
            const ws = XLSX.utils.json_to_sheet(rows);
            XLSX.utils.book_append_sheet(wb, ws, 'WIP_Movement_Ledger');
            XLSX.writeFile(wb, `WIP_Movement_Ledger_${dateStr}.xlsx`);
        } else {
            const typeLabel = wipType === 'rm' ? 'Raw_Materials' : wipType === 'bo' ? 'Bought_Out' : 'Finished_Goods';
            const rows = filteredItems.map((item, idx) => {
                const rowObj: Record<string, any> = {
                    'S.No': idx + 1,
                    'Material Name': item.materialName || '-',
                    'Description': item.materialDescription || '-',
                    'Material Code': item.materialCode || '-',
                    'Category / Node': item.categoryName || '-',
                    'Unit': item.unit || 'PCS',
                    'Main Store Stock': item.mainStoreStock || 0,
                    'Store Outward (WIP Inward)': (item.totalIssuedQty || 0) + (item.totalJobWorkSentQty || 0),
                    'FG GRN Consumed': item.totalReturnedQty || 0,
                    'Shopfloor WIP': item.shopfloorWipQty || 0
                };
                if (wipType === 'rm') {
                    rowObj['Job Work WIP'] = item.jobWorkWipQty || 0;
                }
                rowObj['Net Total WIP'] = item.pendingWipQty || 0;
                rowObj['Status'] = item.status || (item.pendingWipQty > 0 ? 'In WIP' : 'WIP Zero');
                rowObj['Last Movement Date'] = item.lastMovementDate ? new Date(item.lastMovementDate).toLocaleDateString() : '-';
                return rowObj;
            });
            const ws = XLSX.utils.json_to_sheet(rows);
            XLSX.utils.book_append_sheet(wb, ws, `${typeLabel}_WIP`);
            XLSX.writeFile(wb, `${typeLabel}_WIP_Inventory_${dateStr}.xlsx`);
        }
    };

    return (
        <div className="space-y-4 animate-in fade-in duration-300">
            
            {/* Summary Banner Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
                    <span className="text-[11px] font-bold uppercase text-slate-400 block tracking-wider">
                        {wipType === 'mrp' ? 'Total MRP WIP Plans' : wipType === 'ledger' ? 'Total Movement Docs' : 'Master Catalog Items'}
                    </span>
                    <div className="mt-1 flex items-baseline gap-2">
                        <span className="text-2xl font-black text-slate-900 dark:text-white">
                            {wipType === 'mrp' ? mrpBuckets.length : wipType === 'ledger' ? ledgerTransactions.length : summary.totalItems}
                        </span>
                        <span className="text-xs text-slate-400 font-semibold">
                            {wipType === 'mrp' ? 'Plans' : wipType === 'ledger' ? 'Docs' : 'Items'}
                        </span>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
                    <span className="text-[11px] font-bold uppercase text-amber-500 block tracking-wider">Store Outward (WIP Inward)</span>
                    <div className="mt-1 flex items-baseline gap-2">
                        <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
                            {summary.totalIssuedQty + summary.totalJobWorkSentQty}
                        </span>
                        <span className="text-xs text-slate-400 font-semibold">Units Issued</span>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
                    <span className="text-[11px] font-bold uppercase text-emerald-500 block tracking-wider">FG GRN Consumed (WIP Outward)</span>
                    <div className="mt-1 flex items-baseline gap-2">
                        <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                            {summary.totalReturnedQty}
                        </span>
                        <span className="text-xs text-slate-400 font-semibold">Units Consumed</span>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/20 shadow-xs">
                    <span className="text-[11px] font-bold uppercase text-indigo-600 dark:text-indigo-400 block tracking-wider">Net Active Total WIP</span>
                    <div className="mt-1 flex items-baseline gap-2">
                        <span className="text-2xl font-black text-indigo-700 dark:text-indigo-300 font-mono">
                            {summary.netPendingWipQty}
                        </span>
                        <span className="text-xs text-indigo-600/70 font-semibold">Units in WIP</span>
                    </div>
                </div>
            </div>

            {/* Filter & Action Toolbar */}
            <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
                <div className="flex-1 flex flex-wrap gap-2.5 items-center">
                    {/* Search Input */}
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                        <input
                            type="text"
                            placeholder={wipType === 'mrp' ? "Search MRP #, customer, FG name..." : "Search material name, description, category..."}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-900 dark:text-white font-medium"
                        />
                    </div>

                    {/* Category Filter for RM/BO/FG */}
                    {wipType !== 'mrp' && wipType !== 'ledger' && categoriesList.length > 0 && (
                        <select
                            value={filterCategory}
                            onChange={(e) => setFilterCategory(e.target.value)}
                            className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold focus:outline-none"
                        >
                            <option value="">All Categories</option>
                            {categoriesList.map((cat: any) => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    )}

                    {/* MRP Plan Filter */}
                    {(wipType === 'mrp' || wipType === 'ledger') && mrpList.length > 0 && (
                        <select
                            value={filterMrp}
                            onChange={(e) => setFilterMrp(e.target.value)}
                            className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold focus:outline-none"
                        >
                            <option value="">All MRP Plans</option>
                            {mrpList.map((mrp: any) => (
                                <option key={mrp} value={mrp}>{mrp}</option>
                            ))}
                        </select>
                    )}

                    {/* Status Filter */}
                    {wipType !== 'ledger' && (
                        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl gap-1">
                            {(wipType === 'mrp' 
                                ? (['All', 'In Production', 'Completed'] as const) 
                                : (['All', 'Active WIP Only', 'WIP Zero'] as const)
                            ).map((st) => (
                                <button
                                    key={st}
                                    onClick={() => setFilterStatus(st as any)}
                                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                                        filterStatus === st 
                                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs' 
                                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                                    }`}
                                >
                                    {st}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Refresh Data Button */}
                    <button
                        onClick={fetchWipInventory}
                        disabled={loading}
                        className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                    >
                        <RefreshCw size={13} className={loading ? "animate-spin text-indigo-600 dark:text-indigo-400" : "text-slate-500 dark:text-slate-400"} />
                        <span>Refresh Data</span>
                    </button>

                    {/* Excel Export Button */}
                    <button
                        onClick={exportToExcel}
                        className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:hover:bg-emerald-900 dark:text-emerald-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 border border-emerald-200/60 dark:border-emerald-800"
                    >
                        <Download size={13} />
                        <span>Export Excel</span>
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            {loading ? (
                <div className="flex justify-center p-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
            ) : wipType === 'mrp' ? (
                /* MRP WIP Inventory View */
                filteredMrpBuckets.length === 0 ? (
                    <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                        <Package className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                        <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                            No MRP WIP Inventory Records Found
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">Materials issued against an MRP Number will aggregate into their dedicated MRP WIP inventory here.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredMrpBuckets.map((bucket) => {
                            const isCompleted = bucket.status === 'Completed' || (bucket.items && bucket.items.length > 0 && bucket.netPendingWipCount <= 0);

                            return (
                                <div 
                                    key={bucket.mrpNumber} 
                                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden p-5 space-y-4 hover:border-indigo-300 transition-colors"
                                >
                                    {/* Bucket Header */}
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold border border-indigo-100 dark:border-indigo-900">
                                                <Package size={20} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="text-sm font-black text-slate-900 dark:text-white font-mono">
                                                        MRP: {bucket.mrpNumber}
                                                    </h3>
                                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                                        isCompleted
                                                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900'
                                                            : bucket.status === 'Planned'
                                                                ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                                                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-900'
                                                    }`}>
                                                        {isCompleted ? '✓ Completed' : (bucket.status || 'In Production')}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-500 mt-0.5">
                                                    Customer / Reference: <span className="font-semibold text-slate-700 dark:text-slate-300">{bucket.customerName}</span>
                                                </p>
                                            </div>
                                        </div>

                                        {/* Action to view MRP movements */}
                                        <button
                                            onClick={() => openLedger({
                                                sentItemName: `MRP WIP Plan: ${bucket.mrpNumber}`,
                                                vendorName: bucket.customerName,
                                                processType: "MRP Production & WIP Lifecycle",
                                                unit: "Units",
                                                totalIssuedQty: bucket.totalRmIssued + bucket.totalBoIssued + bucket.totalFgIssued,
                                                totalReturnedQty: bucket.totalFgProduced,
                                                pendingWipQty: bucket.netPendingWipCount,
                                                transactions: bucket.transactions
                                            })}
                                            className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:hover:bg-indigo-900 dark:text-indigo-300 text-xs font-bold rounded-xl transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                                        >
                                            <Eye size={14} /> View WIP Movements
                                        </button>
                                    </div>

                                    {/* Bucket Metrics */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl text-xs">
                                        <div>
                                            <span className="text-[10px] font-bold uppercase text-blue-500 block">RM Issued</span>
                                            <span className="text-sm font-black text-slate-800 dark:text-white font-mono">{bucket.totalRmIssued}</span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold uppercase text-emerald-500 block">BO Issued</span>
                                            <span className="text-sm font-black text-slate-800 dark:text-white font-mono">{bucket.totalBoIssued}</span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold uppercase text-purple-500 block">FG / Comp Issued</span>
                                            <span className="text-sm font-black text-slate-800 dark:text-white font-mono">{bucket.totalFgIssued}</span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold uppercase text-indigo-600 block">FG GRN Produced</span>
                                            <span className="text-sm font-black text-indigo-600 dark:text-indigo-400 font-mono">{bucket.totalFgProduced}</span>
                                        </div>
                                    </div>

                                    {/* Items Inside this MRP Bucket */}
                                    <div className="space-y-2">
                                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Items in MRP WIP Inventory</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                                            {(bucket.items || []).map((it: any, i: number) => (
                                                <div key={i} className="p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 flex justify-between items-center text-xs">
                                                    <div className="min-w-0 pr-2">
                                                        <span className="font-bold text-slate-900 dark:text-white block truncate">{it.materialName}</span>
                                                        <span className="text-[10px] text-slate-400 block mt-0.5">{it.category || '-'}</span>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 block">
                                                            {it.pendingQty} <span className="text-[10px] font-normal text-slate-400">{it.unit}</span>
                                                        </span>
                                                        <span className="text-[10px] text-slate-400">
                                                            Issued: {it.issuedQty}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )
            ) : wipType === 'ledger' ? (
                /* WIP Movement Ledger View */
                filteredLedger.length === 0 ? (
                    <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                        <History className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                        <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                            No WIP Movement Transactions Found
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">Material issues, job work shipments, and FG GRN consumption movements will record here.</p>
                    </div>
                ) : (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                                    <tr>
                                        <th className="px-5 py-3.5">Date & Time</th>
                                        <th className="px-5 py-3.5">Document #</th>
                                        <th className="px-5 py-3.5">MRP Reference</th>
                                        <th className="px-5 py-3.5">Material Name</th>
                                        <th className="px-5 py-3.5">Process / Vendor</th>
                                        <th className="px-5 py-3.5">Movement Type</th>
                                        <th className="px-5 py-3.5 text-center">WIP Inward (+)</th>
                                        <th className="px-5 py-3.5 text-center">WIP Consumed (-)</th>
                                        <th className="px-5 py-3.5 text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                                    {filteredLedger.map((tx: any, idx: number) => (
                                        <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                                            <td className="px-5 py-3.5 text-slate-500 font-mono">
                                                {new Date(tx.date).toLocaleDateString()} {new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td className="px-5 py-3.5 font-bold font-mono text-slate-900 dark:text-white">
                                                {tx.docNumber}
                                            </td>
                                            <td className="px-5 py-3.5">
                                                {tx.mrpNumber ? (
                                                    <span className="font-mono font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                                                        {tx.mrpNumber}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 italic">Direct Store Issue</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-3.5 font-semibold text-slate-900 dark:text-white max-w-[200px]">
                                                <div className="font-bold">{tx.materialName}</div>
                                            </td>
                                            <td className="px-5 py-3.5 text-xs text-slate-600 dark:text-slate-400">
                                                <span className="text-slate-700 dark:text-slate-300 font-medium block">{tx.processType || tx.vendorName || '-'}</span>
                                            </td>
                                            <td className="px-5 py-3.5 text-slate-600 dark:text-slate-400">
                                                <span className="font-semibold block text-slate-800 dark:text-slate-200">{tx.type}</span>
                                            </td>
                                            <td className="px-5 py-3.5 text-center font-bold text-amber-600 dark:text-amber-400 font-mono">
                                                {tx.sentQty > 0 ? `+${tx.sentQty} ${tx.unit}` : '-'}
                                            </td>
                                            <td className="px-5 py-3.5 text-center font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                                                {tx.receivedQty > 0 ? `-${tx.receivedQty} ${tx.unit}` : '-'}
                                            </td>
                                            <td className="px-5 py-3.5 text-center">
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                                    {tx.status || 'Recorded'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )
            ) : (
                /* Master-Driven RM / BO / FG Table View */
                filteredItems.length === 0 ? (
                    <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                        <Layers className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                        <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                            No {wipType === 'rm' ? 'Raw Material (RM)' : wipType === 'bo' ? 'Bought Out (BO)' : 'Finished Goods (FG)'} Catalog Items Found
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">Master catalog items will track perpetual WIP balances here.</p>
                    </div>
                ) : (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                        {/* Desktop Table View */}
                        <div className="hidden lg:block overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                                    <tr>
                                        <th className="px-4 py-3.5">Material & Description</th>
                                        <th className="px-4 py-3.5">Category</th>
                                        <th className="px-4 py-3.5 text-center">Main Store Stock</th>
                                        <th className="px-4 py-3.5 text-center">Store Outward (WIP Inward)</th>
                                        <th className="px-4 py-3.5 text-center">FG GRN Consumed</th>
                                        <th className="px-4 py-3.5 text-center">Shopfloor WIP</th>
                                        {wipType === 'rm' && <th className="px-4 py-3.5 text-center">Job Work WIP</th>}
                                        <th className="px-4 py-3.5 text-center">Net Total WIP</th>
                                        <th className="px-4 py-3.5 text-center">Status</th>
                                        <th className="px-4 py-3.5 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                    {filteredItems.map((item) => {
                                        return (
                                            <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                                                <td className="px-4 py-3.5 font-bold text-slate-900 dark:text-white max-w-[280px]">
                                                    <div className="font-bold text-slate-900 dark:text-white leading-snug">{item.materialName}</div>
                                                    {item.materialDescription && (
                                                        <span className="block text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[260px] font-normal mt-0.5" title={item.materialDescription}>
                                                            {item.materialDescription}
                                                        </span>
                                                    )}
                                                </td>

                                                <td className="px-4 py-3.5 text-xs text-slate-700 dark:text-slate-300 font-semibold">
                                                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                                                        {item.categoryName || '-'}
                                                    </span>
                                                </td>

                                                <td className="px-4 py-3.5 text-center font-bold text-slate-700 dark:text-slate-300 font-mono">
                                                    {item.mainStoreStock} <span className="text-[10px] font-normal text-slate-400">{item.unit}</span>
                                                </td>

                                                <td className="px-4 py-3.5 text-center font-bold text-amber-600 dark:text-amber-400 font-mono">
                                                    {item.totalIssuedQty + item.totalJobWorkSentQty} <span className="text-[10px] font-normal text-slate-400">{item.unit}</span>
                                                </td>

                                                <td className="px-4 py-3.5 text-center font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                                                    {item.totalReturnedQty} <span className="text-[10px] font-normal text-slate-400">{item.unit}</span>
                                                </td>

                                                <td className="px-4 py-3.5 text-center font-bold text-slate-900 dark:text-white font-mono">
                                                    {item.shopfloorWipQty} <span className="text-[10px] font-normal text-slate-400">{item.unit}</span>
                                                </td>

                                                {wipType === 'rm' && (
                                                    <td className="px-4 py-3.5 text-center font-bold text-purple-600 dark:text-purple-400 font-mono">
                                                        {item.jobWorkWipQty} <span className="text-[10px] font-normal text-slate-400">{item.unit}</span>
                                                    </td>
                                                )}

                                                <td className="px-4 py-3.5 text-center">
                                                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-black font-mono ${
                                                        item.pendingWipQty > 0 
                                                            ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800' 
                                                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                                    }`}>
                                                        {item.pendingWipQty} {item.unit}
                                                    </span>
                                                </td>

                                                <td className="px-4 py-3.5 text-center">
                                                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                                        item.pendingWipQty > 0 
                                                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-900' 
                                                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                                                    }`}>
                                                        {item.pendingWipQty > 0 ? 'In WIP' : 'WIP Zero'}
                                                    </span>
                                                </td>

                                                <td className="px-4 py-3.5 text-right">
                                                    <button
                                                        onClick={() => openLedger(item)}
                                                        className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:hover:bg-indigo-900 dark:text-indigo-300 text-xs font-bold rounded-xl transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                                                    >
                                                        <Eye size={14} /> Ledger
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Responsive Mobile / Tablet Card View */}
                        <div className="lg:hidden flex flex-col divide-y divide-slate-100 dark:divide-slate-800 pb-20">
                            {filteredItems.map((item) => (
                                <div key={item.id} className="p-4 flex flex-col gap-3 bg-white dark:bg-slate-900">
                                    <div className="flex justify-between items-start gap-2">
                                        <div>
                                            <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                                                {item.materialName}
                                            </h4>
                                            {item.materialDescription && (
                                                <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5" title={item.materialDescription}>
                                                    {item.materialDescription}
                                                </p>
                                            )}
                                            <div className="mt-1">
                                                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{item.categoryName || '-'}</span>
                                            </div>
                                        </div>
                                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                                            item.pendingWipQty > 0 
                                                ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300' 
                                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                        }`}>
                                            {item.pendingWipQty > 0 ? 'In WIP' : 'WIP Zero'}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-4 gap-2 p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 text-center text-xs">
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-400 block">Store Stock</span>
                                            <span className="font-bold text-slate-700 dark:text-slate-300 font-mono">{item.mainStoreStock}</span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold text-amber-600 block">Issued</span>
                                            <span className="font-bold text-amber-600 font-mono">{item.totalIssuedQty + item.totalJobWorkSentQty}</span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold text-emerald-600 block">Consumed</span>
                                            <span className="font-bold text-emerald-600 font-mono">{item.totalReturnedQty}</span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold text-indigo-600 block">Net WIP</span>
                                            <span className="font-black text-indigo-600 font-mono">{item.pendingWipQty}</span>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => openLedger(item)}
                                        className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:hover:bg-indigo-900 dark:text-indigo-300 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                                    >
                                        <Eye size={14} /> View WIP Ledger ({item.transactions.length} docs)
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )
            )}

            {/* Ledger Drawer Component */}
            {isLedgerOpen && selectedWipItem && (
                <WipLedgerDrawer
                    isOpen={isLedgerOpen}
                    onClose={() => setIsLedgerOpen(false)}
                    wipItem={selectedWipItem}
                />
            )}
        </div>
    );
}

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Layers, 
  Search, 
  Factory, 
  Eye, 
  RefreshCw, 
  Boxes, 
  Package, 
  ShieldCheck, 
  ShoppingCart, 
  CheckCircle2, 
  Clock, 
  ArrowUpRight, 
  ArrowDownLeft 
} from 'lucide-react';
import { apiGet } from '@/src/lib/api';
import WipLedgerDrawer from '../modals/WipLedgerDrawer';

interface WipInventoryTabProps {
    token: string | null;
    companyInfo?: any;
    onError: (msg: string) => void;
    onSuccess: (msg: string) => void;
}

export default function WipInventoryTab({ token, companyInfo, onError, onSuccess }: WipInventoryTabProps) {
    const [wipType, setWipType] = useState<'rm' | 'bo' | 'fg' | 'mrp-buckets'>('rm');
    const [loading, setLoading] = useState(true);
    const [wipItems, setWipItems] = useState<any[]>([]);
    const [mrpBuckets, setMrpBuckets] = useState<any[]>([]);
    const [summary, setSummary] = useState({
        totalItems: 0,
        totalIssuedQty: 0,
        totalJobWorkSentQty: 0,
        totalReturnedQty: 0,
        totalFgConsumedQty: 0,
        netPendingWipQty: 0
    });

    // Filter States
    const [searchTerm, setSearchTerm] = useState('');
    const [filterVendor, setFilterVendor] = useState('');
    const [filterMrp, setFilterMrp] = useState('');
    const [filterStatus, setFilterStatus] = useState<'All' | 'In-Process' | 'Completed'>('In-Process');

    // Ledger Drawer State
    const [selectedWipItem, setSelectedWipItem] = useState<any | null>(null);
    const [isLedgerOpen, setIsLedgerOpen] = useState(false);

    const fetchWipInventory = async () => {
        if (!token) return;
        try {
            setLoading(true);
            const res = await apiGet(`/api/store/wip/inventory?type=${wipType}`, token);
            setWipItems(res.wipItems || []);
            setMrpBuckets(res.mrpBuckets || []);
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

    // Unique Destination / Department list for filter dropdown
    const vendorsList = useMemo(() => {
        const set = new Map();
        wipItems.forEach(item => {
            if (item.vendorName) set.set(item.vendorName, item.vendorName);
        });
        return Array.from(set.values());
    }, [wipItems]);

    // Unique MRP Numbers list for filter dropdown
    const mrpList = useMemo(() => {
        const set = new Map();
        wipItems.forEach(item => {
            if (item.mrpNumber) set.set(item.mrpNumber, item.mrpNumber);
        });
        mrpBuckets.forEach(bucket => {
            if (bucket.mrpNumber) set.set(bucket.mrpNumber, bucket.mrpNumber);
        });
        return Array.from(set.values());
    }, [wipItems, mrpBuckets]);

    // Filtered Items for standard RM/BO/FG WIP tabs
    const filteredItems = useMemo(() => {
        return wipItems.filter(item => {
            const matchSearch =
                (item.sentItemName && item.sentItemName.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (item.receivedItemName && item.receivedItemName.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (item.materialCode && item.materialCode.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (item.vendorName && item.vendorName.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (item.mrpNumber && item.mrpNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (item.processType && item.processType.toLowerCase().includes(searchTerm.toLowerCase()));

            const matchVendor = !filterVendor || item.vendorName === filterVendor;
            const matchMrp = !filterMrp || (filterMrp === 'none' ? !item.mrpNumber : item.mrpNumber === filterMrp);
            const matchStatus = filterStatus === 'All' || item.status === filterStatus;

            return matchSearch && matchVendor && matchMrp && matchStatus;
        });
    }, [wipItems, searchTerm, filterVendor, filterMrp, filterStatus]);

    // Filtered MRP Buckets for MRP Buckets tab
    const filteredMrpBuckets = useMemo(() => {
        return mrpBuckets.filter(bucket => {
            const matchSearch =
                (bucket.mrpNumber && bucket.mrpNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (bucket.customerName && bucket.customerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (bucket.items && bucket.items.some((it: any) => it.materialName?.toLowerCase().includes(searchTerm.toLowerCase())));

            const matchMrp = !filterMrp || bucket.mrpNumber === filterMrp;
            const matchStatus = filterStatus === 'All' || (filterStatus === 'Completed' ? bucket.netPendingWipCount <= 0 : bucket.netPendingWipCount > 0);

            return matchSearch && matchMrp && matchStatus;
        });
    }, [mrpBuckets, searchTerm, filterMrp, filterStatus]);

    const openLedger = (item: any) => {
        setSelectedWipItem(item);
        setIsLedgerOpen(true);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            
            {/* Top Sub-Tab Switcher: 4 Categories (RM, BO, FG, MRP Buckets) */}
            <div className="bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2">
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl gap-1 overflow-x-auto no-scrollbar flex-1 sm:flex-none">
                    {/* RM WIP Button */}
                    <button
                        onClick={() => { setWipType('rm'); setSearchTerm(''); setFilterVendor(''); setFilterMrp(''); }}
                        className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                            wipType === 'rm'
                                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-200 dark:shadow-none'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                    >
                        <Layers size={15} /> Raw Materials (RM) WIP
                    </button>

                    {/* BO WIP Button */}
                    <button
                        onClick={() => { setWipType('bo'); setSearchTerm(''); setFilterVendor(''); setFilterMrp(''); }}
                        className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                            wipType === 'bo'
                                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-200 dark:shadow-none'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                    >
                        <ShoppingCart size={15} /> Bought Out (BO) WIP
                    </button>

                    {/* FG WIP Button */}
                    <button
                        onClick={() => { setWipType('fg'); setSearchTerm(''); setFilterVendor(''); setFilterMrp(''); }}
                        className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                            wipType === 'fg'
                                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-200 dark:shadow-none'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                    >
                        <Boxes size={15} /> FG / Component WIP
                    </button>

                    {/* MRP Production Buckets Button */}
                    <button
                        onClick={() => { setWipType('mrp-buckets'); setSearchTerm(''); setFilterVendor(''); setFilterMrp(''); }}
                        className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                            wipType === 'mrp-buckets'
                                ? 'bg-gradient-to-r from-slate-900 to-indigo-950 text-white shadow-md shadow-slate-300 dark:shadow-none'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                    >
                        <Package size={15} /> MRP Production Buckets
                    </button>
                </div>

                <div className="text-xs text-slate-500 font-medium px-4 py-1 flex items-center gap-2 shrink-0">
                    <ShieldCheck size={16} className="text-emerald-500" />
                    <span>Store issue credits WIP • FG GRN reduces WIP</span>
                </div>
            </div>

            {/* Summary Banner Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
                    <span className="text-[11px] font-bold uppercase text-slate-400 block tracking-wider">
                        {wipType === 'mrp-buckets' ? 'Active MRP Buckets' : 'WIP Tracked Items'}
                    </span>
                    <div className="mt-1 flex items-baseline gap-2">
                        <span className="text-2xl font-black text-slate-900 dark:text-white">
                            {wipType === 'mrp-buckets' ? mrpBuckets.length : summary.totalItems}
                        </span>
                        <span className="text-xs text-slate-400 font-semibold">{wipType === 'mrp-buckets' ? 'Plans' : 'Items'}</span>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
                    <span className="text-[11px] font-bold uppercase text-amber-500 block tracking-wider">Total Store Outward</span>
                    <div className="mt-1 flex items-baseline gap-2">
                        <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
                            {summary.totalIssuedQty + summary.totalJobWorkSentQty}
                        </span>
                        <span className="text-xs text-slate-400 font-semibold">Units Issued</span>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
                    <span className="text-[11px] font-bold uppercase text-emerald-500 block tracking-wider">FG GRN Consumed / Returned</span>
                    <div className="mt-1 flex items-baseline gap-2">
                        <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                            {summary.totalReturnedQty}
                        </span>
                        <span className="text-xs text-slate-400 font-semibold">Units Completed</span>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/20 shadow-xs">
                    <span className="text-[11px] font-bold uppercase text-indigo-600 dark:text-indigo-400 block tracking-wider">Net Active Shopfloor WIP</span>
                    <div className="mt-1 flex items-baseline gap-2">
                        <span className="text-2xl font-black text-indigo-700 dark:text-indigo-300 font-mono">
                            {summary.netPendingWipQty}
                        </span>
                        <span className="text-xs text-indigo-500 font-semibold">Pending Units</span>
                    </div>
                </div>
            </div>

            {/* Filter Toolbar */}
            <div className="bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 min-w-0">
                    {/* Search Input */}
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="Search by item name, material code, MRP #, customer..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-slate-50/50 dark:bg-slate-800/50"
                        />
                    </div>

                    {/* MRP Plan # Filter */}
                    <select
                        value={filterMrp}
                        onChange={(e) => setFilterMrp(e.target.value)}
                        className="w-full sm:w-auto px-3.5 py-2 text-xs font-bold border border-indigo-200 dark:border-indigo-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 max-w-[220px] truncate cursor-pointer"
                    >
                        <option value="">All MRP Plans</option>
                        <option value="none">Direct Store Issues (No MRP)</option>
                        {mrpList.map(mrp => (
                            <option key={mrp} value={mrp}>MRP: {mrp}</option>
                        ))}
                    </select>

                    {/* Status Filter Tabs */}
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold overflow-x-auto no-scrollbar max-w-full shrink-0">
                        <button
                            onClick={() => setFilterStatus('In-Process')}
                            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all cursor-pointer ${filterStatus === 'In-Process' ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-xs font-bold' : 'text-slate-500'}`}
                        >
                            In-Process
                        </button>
                        <button
                            onClick={() => setFilterStatus('Completed')}
                            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all cursor-pointer ${filterStatus === 'Completed' ? 'bg-white dark:bg-slate-900 text-emerald-600 shadow-xs font-bold' : 'text-slate-500'}`}
                        >
                            Completed
                        </button>
                        <button
                            onClick={() => setFilterStatus('All')}
                            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all cursor-pointer ${filterStatus === 'All' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold' : 'text-slate-500'}`}
                        >
                            All Status
                        </button>
                    </div>
                </div>

                {/* Refresh Button */}
                <button
                    onClick={fetchWipInventory}
                    className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 text-xs font-bold cursor-pointer shrink-0"
                    title="Refresh WIP Inventory"
                >
                    <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Refresh
                </button>
            </div>

            {/* Main WIP Inventory Content */}
            {loading ? (
                <div className="flex justify-center p-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
            ) : wipType === 'mrp-buckets' ? (
                /* MRP Production Buckets View */
                filteredMrpBuckets.length === 0 ? (
                    <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                        <Package className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                        <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                            No Active MRP Production Buckets
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">Materials issued against an MRP Number will aggregate into a dedicated production bucket here.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredMrpBuckets.map((bucket) => (
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
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                    bucket.netPendingWipCount > 0
                                                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                                }`}>
                                                    {bucket.netPendingWipCount > 0 ? 'In Production' : 'Completed'}
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
                                            sentItemName: `MRP Plan Bucket: ${bucket.mrpNumber}`,
                                            vendorName: bucket.customerName,
                                            processType: "MRP Production Lifecycle",
                                            unit: "Units",
                                            totalIssuedQty: bucket.totalRmIssued + bucket.totalBoIssued + bucket.totalFgIssued,
                                            totalReturnedQty: bucket.totalFgProduced,
                                            pendingWipQty: bucket.netPendingWipCount,
                                            transactions: bucket.transactions
                                        })}
                                        className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:hover:bg-indigo-900 dark:text-indigo-300 text-xs font-bold rounded-xl transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                                    >
                                        <Eye size={14} /> View Bucket Movements
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
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Items in Production Bucket</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                                        {(bucket.items || []).map((it: any, i: number) => (
                                            <div key={i} className="p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 flex justify-between items-center text-xs">
                                                <div className="min-w-0 pr-2">
                                                    <span className="font-bold text-slate-900 dark:text-white block truncate">{it.materialName}</span>
                                                    <span className="text-[10px] text-slate-400">{it.category}</span>
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
                        ))}
                    </div>
                )
            ) : (
                /* Standard RM / BO / FG Table View */
                filteredItems.length === 0 ? (
                    <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                        <Layers className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                        <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                            No {wipType === 'rm' ? 'Raw Material (RM)' : wipType === 'bo' ? 'Bought Out (BO)' : 'Finished Goods (FG)'} WIP Items
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">Material Issues & Job-Work Dispatches will automatically record here when stock is reduced from store.</p>
                    </div>
                ) : (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                        {/* Desktop Table View */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                                    <tr>
                                        <th className="px-5 py-3.5">Sent / Issued Material</th>
                                        <th className="px-5 py-3.5">MRP Plan #</th>
                                        <th className="px-5 py-3.5">Destination / Department</th>
                                        <th className="px-5 py-3.5">Process / Purpose</th>
                                        <th className="px-5 py-3.5 text-center">Store Deductions</th>
                                        <th className="px-5 py-3.5 text-center">FG GRN Consumed</th>
                                        <th className="px-5 py-3.5 text-center">Net Pending WIP</th>
                                        <th className="px-5 py-3.5 text-center">Status</th>
                                        <th className="px-5 py-3.5 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                    {filteredItems.map((item) => {
                                        const totalOutward = (item.totalIssuedQty || 0) + (item.totalJobWorkSentQty || 0) || item.totalSentQty || 0;
                                        const totalReturned = item.totalReturnedQty || item.totalReceivedQty || 0;

                                        return (
                                            <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                                                <td className="px-5 py-4 font-bold text-slate-900 dark:text-white">
                                                    {item.sentItemName}
                                                    <span className="block text-[10px] text-slate-400 font-normal uppercase mt-0.5">Category: {item.categoryType || item.itemType}</span>
                                                </td>

                                                <td className="px-5 py-4">
                                                    {item.mrpNumber ? (
                                                        <span className="text-xs font-mono font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/80 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800 inline-block shadow-2xs">
                                                            {item.mrpNumber}
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-slate-400 italic">Direct / No MRP</span>
                                                    )}
                                                </td>

                                                <td className="px-5 py-4 text-slate-700 dark:text-slate-300 font-medium">
                                                    <div className="flex items-center gap-1.5">
                                                        <Factory size={14} className="text-slate-400 flex-shrink-0" />
                                                        {item.vendorName}
                                                    </div>
                                                </td>

                                                <td className="px-5 py-4 text-xs font-semibold text-slate-600 dark:text-slate-400">
                                                    {item.processType}
                                                </td>

                                                <td className="px-5 py-4 text-center font-bold text-amber-600 dark:text-amber-400">
                                                    {totalOutward} <span className="text-xs font-normal text-slate-400">{item.unit}</span>
                                                </td>

                                                <td className="px-5 py-4 text-center font-bold text-emerald-600 dark:text-emerald-400">
                                                    {totalReturned} <span className="text-xs font-normal text-slate-400">{item.receivingUnit || item.unit}</span>
                                                </td>

                                                <td className="px-5 py-4 text-center">
                                                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-black font-mono ${
                                                        item.pendingWipQty > 0 
                                                            ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800' 
                                                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                                    }`}>
                                                        {item.pendingWipQty} {item.receivingUnit || item.unit}
                                                    </span>
                                                </td>

                                                <td className="px-5 py-4 text-center">
                                                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                                        item.status === 'In-Process' 
                                                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' 
                                                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                                    }`}>
                                                        {item.status}
                                                    </span>
                                                </td>

                                                <td className="px-5 py-4 text-right">
                                                    <button
                                                        onClick={() => openLedger(item)}
                                                        className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:hover:bg-indigo-900 dark:text-indigo-300 text-xs font-bold rounded-xl transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                                                    >
                                                        <Eye size={14} /> View Ledger
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Card View */}
                        <div className="md:hidden flex flex-col divide-y divide-slate-100 dark:divide-slate-800 pb-28 sm:pb-20">
                            {filteredItems.map((item) => {
                                const totalOutward = (item.totalIssuedQty || 0) + (item.totalJobWorkSentQty || 0) || item.totalSentQty || 0;
                                const totalReturned = item.totalReturnedQty || item.totalReceivedQty || 0;

                                return (
                                    <div
                                        key={item.id}
                                        className="p-4 flex flex-col gap-3 bg-white dark:bg-slate-900 active:bg-slate-50 dark:active:bg-slate-800/60 transition-colors"
                                    >
                                        <div className="flex justify-between items-start gap-2">
                                            <div className="min-w-0">
                                                <h4 className="font-bold text-slate-900 dark:text-white text-sm truncate">
                                                    {item.sentItemName}
                                                </h4>
                                                <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                    {item.mrpNumber && (
                                                        <span className="font-mono text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                                                            MRP: {item.mrpNumber}
                                                        </span>
                                                    )}
                                                    <div className="flex items-center gap-1">
                                                        <Factory size={13} className="text-slate-400 shrink-0" />
                                                        <span className="truncate">{item.vendorName || 'Department'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold shrink-0 ${
                                                item.status === 'In-Process' 
                                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' 
                                                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                            }`}>
                                                {item.status}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-3 gap-2 p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 text-center">
                                            <div>
                                                <span className="text-[10px] uppercase font-bold text-slate-400 block">Outward</span>
                                                <span className="text-xs font-black text-amber-600 dark:text-amber-400">
                                                    {totalOutward} <span className="text-[10px] font-normal text-slate-400">{item.unit}</span>
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-[10px] uppercase font-bold text-slate-400 block">Consumed</span>
                                                <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                                                    {totalReturned} <span className="text-[10px] font-normal text-slate-400">{item.receivingUnit || item.unit}</span>
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-[10px] uppercase font-bold text-slate-400 block">Pending WIP</span>
                                                <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 font-mono">
                                                    {item.pendingWipQty} <span className="text-[10px] font-normal text-slate-400">{item.receivingUnit || item.unit}</span>
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex justify-end pt-1">
                                            <button
                                                onClick={() => openLedger(item)}
                                                className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:hover:bg-indigo-900 dark:text-indigo-300 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                                            >
                                                <Eye size={14} /> View WIP Ledger & Transactions
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
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

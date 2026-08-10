import React, { useState, useEffect, useMemo } from 'react';
import { Layers, Search, Factory, ArrowUpRight, ArrowDownLeft, CheckCircle2, Clock, Eye, RefreshCw, Filter, Boxes, Package, ShieldCheck } from 'lucide-react';
import { apiGet } from '@/src/lib/api';
import WipLedgerDrawer from '../modals/WipLedgerDrawer';

interface WipInventoryTabProps {
    token: string | null;
    companyInfo?: any;
    onError: (msg: string) => void;
    onSuccess: (msg: string) => void;
}

export default function WipInventoryTab({ token, companyInfo, onError, onSuccess }: WipInventoryTabProps) {
    const [wipType, setWipType] = useState<'rm-bo' | 'fg'>('rm-bo');
    const [loading, setLoading] = useState(true);
    const [wipItems, setWipItems] = useState<any[]>([]);
    const [summary, setSummary] = useState({
        totalItems: 0,
        totalIssuedQty: 0,
        totalJobWorkSentQty: 0,
        totalReturnedQty: 0,
        netPendingWipQty: 0
    });

    // Filter States
    const [searchTerm, setSearchTerm] = useState('');
    const [filterVendor, setFilterVendor] = useState('');
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
            if (res.summary) setSummary(res.summary);
        } catch (err: any) {
            console.error(err);
            onError(err.message || 'Failed to fetch WIP Inventory');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchWipInventory();
    }, [token, wipType]);

    // Unique Destination (Vendor/Department) list for filter dropdown
    const vendorsList = useMemo(() => {
        const set = new Map();
        wipItems.forEach(item => {
            if (item.vendorName) set.set(item.vendorName, item.vendorName);
        });
        return Array.from(set.values());
    }, [wipItems]);

    // Filtered Items
    const filteredItems = useMemo(() => {
        return wipItems.filter(item => {
            const matchSearch =
                (item.sentItemName && item.sentItemName.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (item.receivedItemName && item.receivedItemName.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (item.vendorName && item.vendorName.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (item.processType && item.processType.toLowerCase().includes(searchTerm.toLowerCase()));

            const matchVendor = !filterVendor || item.vendorName === filterVendor;
            const matchStatus = filterStatus === 'All' || item.status === filterStatus;

            return matchSearch && matchVendor && matchStatus;
        });
    }, [wipItems, searchTerm, filterVendor, filterStatus]);

    const openLedger = (item: any) => {
        setSelectedWipItem(item);
        setIsLedgerOpen(true);
    };

    const totalOutwardQty = (summary.totalIssuedQty || 0) + (summary.totalJobWorkSentQty || 0);

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            
            {/* Top Sub-Tab Switcher: RM/BO WIP vs FG WIP */}
            <div className="bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2">
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl gap-1 flex-1 sm:flex-none">
                    <button
                        onClick={() => { setWipType('rm-bo'); setSearchTerm(''); setFilterVendor(''); }}
                        className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex-1 sm:flex-none ${
                            wipType === 'rm-bo'
                                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-200 dark:shadow-none'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                    >
                        <Package size={16} /> RM / BO WIP Inventory
                    </button>
                    <button
                        onClick={() => { setWipType('fg'); setSearchTerm(''); setFilterVendor(''); }}
                        className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex-1 sm:flex-none ${
                            wipType === 'fg'
                                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-200 dark:shadow-none'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                    >
                        <Boxes size={16} /> FG / In-House WIP Inventory
                    </button>
                </div>

                <div className="text-xs text-slate-500 font-medium px-4 py-1 flex items-center gap-2">
                    <ShieldCheck size={16} className="text-emerald-500" />
                    <span>Auto-records all main store stock deductions</span>
                </div>
            </div>

            {/* KPI Metrics Dashboard Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* Card 1: Total Active WIP Items */}
                <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
                    <div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Active WIP Items</span>
                        <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                            {summary.totalItems}
                        </h3>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800">
                        <Boxes size={22} />
                    </div>
                </div>

                {/* Card 2: Total Store Deductions (Issued + Dispatched) */}
                <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
                    <div>
                        <span className="text-xs font-bold text-amber-500 uppercase tracking-wider block">Total Outward Store Deductions</span>
                        <h3 className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
                            {totalOutwardQty.toLocaleString()}
                        </h3>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/60 flex items-center justify-center text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-800">
                        <ArrowUpRight size={22} />
                    </div>
                </div>

                {/* Card 3: Total Returned Qty */}
                <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
                    <div>
                        <span className="text-xs font-bold text-emerald-500 uppercase tracking-wider block">Returned / Completed</span>
                        <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                            {summary.totalReturnedQty.toLocaleString()}
                        </h3>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800">
                        <ArrowDownLeft size={22} />
                    </div>
                </div>

                {/* Card 4: Net Pending In-Process Stock */}
                <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 shadow-md flex items-center justify-between">
                    <div>
                        <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider block">Net Pending WIP Stock</span>
                        <h3 className="text-2xl font-black text-indigo-100 mt-1">
                            {summary.netPendingWipQty.toLocaleString()}
                        </h3>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-indigo-900/90 flex items-center justify-center text-indigo-300 border border-indigo-700">
                        <Layers size={22} />
                    </div>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
                
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    {/* Search */}
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="Search item, department or subcontractor..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-slate-50/50 dark:bg-slate-800/50"
                        />
                    </div>

                    {/* Destination Filter */}
                    <select
                        value={filterVendor}
                        onChange={(e) => setFilterVendor(e.target.value)}
                        className="px-3.5 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                    >
                        <option value="">All Destinations</option>
                        {vendorsList.map(v => (
                            <option key={v} value={v}>{v}</option>
                        ))}
                    </select>

                    {/* Status Filter Tabs */}
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold">
                        <button
                            onClick={() => setFilterStatus('In-Process')}
                            className={`px-3 py-1.5 rounded-lg transition-all ${filterStatus === 'In-Process' ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                        >
                            In-Process
                        </button>
                        <button
                            onClick={() => setFilterStatus('Completed')}
                            className={`px-3 py-1.5 rounded-lg transition-all ${filterStatus === 'Completed' ? 'bg-white dark:bg-slate-900 text-emerald-600 shadow-sm' : 'text-slate-500'}`}
                        >
                            Completed
                        </button>
                        <button
                            onClick={() => setFilterStatus('All')}
                            className={`px-3 py-1.5 rounded-lg transition-all ${filterStatus === 'All' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'}`}
                        >
                            All Status
                        </button>
                    </div>
                </div>

                {/* Refresh Button */}
                <button
                    onClick={fetchWipInventory}
                    className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 text-xs font-bold"
                    title="Refresh WIP Inventory"
                >
                    <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Refresh
                </button>
            </div>

            {/* Main WIP Inventory Table */}
            {loading ? (
                <div className="flex justify-center p-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
            ) : filteredItems.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                    <Layers className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No {wipType === 'rm-bo' ? 'RM/BO' : 'FG'} WIP Inventory Items</h3>
                    <p className="text-xs text-slate-500 mt-1">Material Issues & Job-Work Dispatches will automatically record here when stock is reduced from main store.</p>
                </div>
            ) : (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                                <tr>
                                    <th className="px-5 py-3.5">Sent / Issued Material</th>
                                    <th className="px-5 py-3.5">Destination / Department</th>
                                    <th className="px-5 py-3.5">Process / Purpose</th>
                                    <th className="px-5 py-3.5 text-center">Store Deductions</th>
                                    <th className="px-5 py-3.5 text-center">Returned / Completed</th>
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
                                                <span className="block text-[10px] text-slate-400 font-normal uppercase">Category: {item.categoryType || item.itemType}</span>
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
                                                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:hover:bg-indigo-900 dark:text-indigo-300 text-xs font-bold rounded-xl transition-colors inline-flex items-center gap-1.5"
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
                </div>
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

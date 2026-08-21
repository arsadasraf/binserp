import React, { useState, useEffect, useMemo } from 'react';
import { Layers, Search, Factory, ArrowUpRight, ArrowDownLeft, CheckCircle2, Clock, Eye, RefreshCw, Filter, Boxes, Package, ShieldCheck, Sparkles } from 'lucide-react';
import { apiGet } from '@/src/lib/api';
import WipLedgerDrawer from '../modals/WipLedgerDrawer';

interface WipInventoryTabProps {
    token: string | null;
    companyInfo?: any;
    onError: (msg: string) => void;
    onSuccess: (msg: string) => void;
}

export default function WipInventoryTab({ token, companyInfo, onError, onSuccess }: WipInventoryTabProps) {
    const [wipType, setWipType] = useState<'consumable' | 'rm-bo' | 'fg'>('consumable');
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

    // Unique MRP Numbers list for filter dropdown
    const mrpList = useMemo(() => {
        const set = new Map();
        wipItems.forEach(item => {
            if (item.mrpNumber) set.set(item.mrpNumber, item.mrpNumber);
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
                (item.mrpNumber && item.mrpNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (item.processType && item.processType.toLowerCase().includes(searchTerm.toLowerCase()));

            const matchVendor = !filterVendor || item.vendorName === filterVendor;
            const matchMrp = !filterMrp || (filterMrp === 'none' ? !item.mrpNumber : item.mrpNumber === filterMrp);
            const matchStatus = filterStatus === 'All' || item.status === filterStatus;

            return matchSearch && matchVendor && matchMrp && matchStatus;
        });
    }, [wipItems, searchTerm, filterVendor, filterMrp, filterStatus]);

    const openLedger = (item: any) => {
        setSelectedWipItem(item);
        setIsLedgerOpen(true);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            
            {/* Top Sub-Tab Switcher: Consumables vs RM/BO vs FG WIP */}
            <div className="bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2">
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl gap-1 overflow-x-auto no-scrollbar flex-1 sm:flex-none">
                    <button
                        onClick={() => { setWipType('consumable'); setSearchTerm(''); setFilterVendor(''); setFilterMrp(''); }}
                        className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                            wipType === 'consumable'
                                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-md shadow-amber-200 dark:shadow-none'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                    >
                        <Sparkles size={16} /> Consumables WIP
                    </button>
                    <button
                        onClick={() => { setWipType('rm-bo'); setSearchTerm(''); setFilterVendor(''); setFilterMrp(''); }}
                        className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                            wipType === 'rm-bo'
                                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-200 dark:shadow-none'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                    >
                        <Package size={16} /> RM / BO WIP
                    </button>
                    <button
                        onClick={() => { setWipType('fg'); setSearchTerm(''); setFilterVendor(''); setFilterMrp(''); }}
                        className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                            wipType === 'fg'
                                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-200 dark:shadow-none'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                    >
                        <Boxes size={16} /> FG / In-House WIP
                    </button>
                </div>

                <div className="text-xs text-slate-500 font-medium px-4 py-1 flex items-center gap-2 shrink-0">
                    <ShieldCheck size={16} className="text-emerald-500" />
                    <span>Auto-records all store stock deductions</span>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3">
                
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 min-w-0">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="Search item, MRP #, department or subcontractor..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-slate-50/50 dark:bg-slate-800/50"
                        />
                    </div>

                    {/* MRP Plan # Filter */}
                    <select
                        value={filterMrp}
                        onChange={(e) => setFilterMrp(e.target.value)}
                        className="w-full sm:w-auto px-3.5 py-2 text-xs font-bold border border-indigo-200 dark:border-indigo-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 max-w-[220px] truncate"
                    >
                        <option value="">All MRP Plans</option>
                        <option value="none">Direct Store Issues (No MRP)</option>
                        {mrpList.map(mrp => (
                            <option key={mrp} value={mrp}>MRP: {mrp}</option>
                        ))}
                    </select>

                    {/* Destination Filter */}
                    <select
                        value={filterVendor}
                        onChange={(e) => setFilterVendor(e.target.value)}
                        className="w-full sm:w-auto px-3.5 py-2 text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 max-w-[200px] truncate"
                    >
                        <option value="">All Destinations</option>
                        {vendorsList.map(v => (
                            <option key={v} value={v}>{v}</option>
                        ))}
                    </select>

                    {/* Status Filter Tabs - Scrollable on mobile */}
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold overflow-x-auto no-scrollbar max-w-full shrink-0">
                        <button
                            onClick={() => setFilterStatus('In-Process')}
                            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${filterStatus === 'In-Process' ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-sm font-bold' : 'text-slate-500'}`}
                        >
                            In-Process
                        </button>
                        <button
                            onClick={() => setFilterStatus('Completed')}
                            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${filterStatus === 'Completed' ? 'bg-white dark:bg-slate-900 text-emerald-600 shadow-sm font-bold' : 'text-slate-500'}`}
                        >
                            Completed
                        </button>
                        <button
                            onClick={() => setFilterStatus('All')}
                            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${filterStatus === 'All' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm font-bold' : 'text-slate-500'}`}
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

            {/* Main WIP Inventory Content */}
            {loading ? (
                <div className="flex justify-center p-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
            ) : filteredItems.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                    <Layers className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                        No {wipType === 'consumable' ? 'Consumable' : wipType === 'rm-bo' ? 'RM/BO' : 'FG'} WIP Inventory Items
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">Material Issues & Job-Work Dispatches will automatically record here when stock is reduced from main store.</p>
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
                                    {/* Card Top: Item & Status */}
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
                                                {item.processType && (
                                                    <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0">
                                                        {item.processType}
                                                    </span>
                                                )}
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

                                    {/* Metrics Grid */}
                                    <div className="grid grid-cols-3 gap-2 p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 text-center">
                                        <div>
                                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Outward</span>
                                            <span className="text-xs font-black text-amber-600 dark:text-amber-400">
                                                {totalOutward} <span className="text-[10px] font-normal text-slate-400">{item.unit}</span>
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Returned</span>
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

                                    {/* Card Footer Actions */}
                                    <div className="flex justify-end pt-1">
                                        <button
                                            onClick={() => openLedger(item)}
                                            className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:hover:bg-indigo-900 dark:text-indigo-300 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                                        >
                                            <Eye size={14} /> View WIP Ledger & Transactions
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
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

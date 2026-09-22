import React, { useState, useEffect, useMemo } from 'react';
import { 
    Plus, Search, Eye, Factory, Calendar, Truck, CheckCircle2, 
    FileText, FileSpreadsheet, Clock, Edit2, Trash2, Lock, 
    AlertTriangle, ArrowRight, Layers, RefreshCw, X, ShieldAlert 
} from 'lucide-react';
import { JobWorkChallan, Vendor, JobWorkSupplier } from "@/src/features/store/types/store.types";
import JobWorkForm from '../forms/JobWorkForm';
import JobWorkReceiveModal from '../modals/JobWorkReceiveModal';
import JobWorkPreviewModal from '../modals/JobWorkPreviewModal';
import RejectionReworkHub from './RejectionReworkHub';

import { apiGet, apiDelete } from '@/src/lib/api';
import { generateDocument } from '@/src/utils/documentHelper';

interface JobWorkStoreProps {
    vendors: Vendor[];
    jobWorkSuppliers?: JobWorkSupplier[];
    rawMaterials?: any[];
    boughtOuts?: any[];
    materials?: any[];
    inventoryList?: any[];
    inHouseItems?: any[];
    mrpPlans?: any[];
    activeTab: string;
    token: string | null;
    companyInfo?: any;
    onError: (msg: string) => void;
    onSuccess: (msg: string) => void;
}

const getItemDescription = (item: any): string => {
    if (!item) return '';
    if (typeof item.description === 'string' && item.description.trim()) return item.description.trim();
    if (typeof item.descriptions === 'string' && item.descriptions.trim()) return item.descriptions.trim();
    if (typeof item.specification === 'string' && item.specification.trim()) return item.specification.trim();
    return '';
};

const formatDateTime = (dateStr?: string | Date): string => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
};

export default function JobWorkStore({ 
    vendors, 
    jobWorkSuppliers = [], 
    rawMaterials = [], 
    boughtOuts = [], 
    materials = [], 
    inventoryList = [], 
    inHouseItems = [], 
    mrpPlans = [], 
    token, 
    companyInfo, 
    onError, 
    onSuccess 
}: JobWorkStoreProps) {
    const [challans, setChallans] = useState<JobWorkChallan[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Sub-Tabs: All, Active / In-Process, History / Received, Overdue Return, Rejections
    const [subTab, setSubTab] = useState<'all' | 'active' | 'received' | 'overdue' | 'rejections'>('active');

    // Filter States
    const [filterMode, setFilterMode] = useState<'daily' | 'monthly' | 'yearly'>('daily');
    const [filterDate, setFilterDate] = useState('');
    const [filterSupplier, setFilterSupplier] = useState('');
    const [workflowFilter, setWorkflowFilter] = useState<'all' | 'store-conversion' | 'store-to-wip' | 'wip-to-wip' | 'route-card'>('all');

    // Prefill data for editing
    const [prefillData, setPrefillData] = useState<any>(null);

    // Modal States
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
    const [selectedChallan, setSelectedChallan] = useState<JobWorkChallan | null>(null);

    // Preview Modal State
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [previewChallan, setPreviewChallan] = useState<JobWorkChallan | null>(null);

    // Live 1-second ticking timer for 24-hour edit/delete countdown
    const [nowTime, setNowTime] = useState(Date.now());
    useEffect(() => {
        const timer = setInterval(() => setNowTime(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    const getRemainingEditSeconds = (createdAt?: string | Date) => {
        if (!createdAt) return 0;
        const created = new Date(createdAt).getTime();
        if (isNaN(created)) return 0;
        const elapsed = Math.floor((nowTime - created) / 1000);
        const limit = 24 * 3600; // 24 hours in seconds
        return Math.max(0, limit - elapsed);
    };

    const formatRemainingTime = (totalSeconds: number) => {
        if (totalSeconds <= 0) return '00:00:00';
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };

    const openPreview = (challan: JobWorkChallan) => {
        setPreviewChallan(challan);
        setIsPreviewOpen(true);
    };

    const fetchChallans = async () => {
        if (!token) return;
        try {
            setLoading(true);
            const data = await apiGet('/api/store/jobwork/all', token);
            setChallans(data.challans || []);
        } catch (error: any) {
            console.error(error);
            onError(error.message || 'Failed to load job work data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchChallans();
    }, []);

    const handleCreateSuccess = () => {
        setIsFormOpen(false);
        setPrefillData(null);
        fetchChallans();
        onSuccess('Job Work Challan saved successfully');
    };

    const handleReceiveSuccess = () => {
        setIsReceiveModalOpen(false);
        setSelectedChallan(null);
        fetchChallans();
        onSuccess('Items received successfully');
    };

    const openReceiveModal = (challan: JobWorkChallan) => {
        setSelectedChallan(challan);
        setIsReceiveModalOpen(true);
    };

    const handleCreateChallan = () => {
        setPrefillData(null);
        setIsFormOpen(true);
    };

    const handleDelete = async (id: string, challanNumber?: string) => {
        const confirmMsg = challanNumber 
            ? `Are you sure you want to delete Returnable DC #${challanNumber}? Outward stock will be safely restored.`
            : 'Are you sure you want to delete this challan? Outward stock will be restored.';
        if (!window.confirm(confirmMsg)) return;

        try {
            await apiDelete(`/api/store/jobwork/delete/${id}`, token!);
            onSuccess('Challan deleted and inventory restored successfully');
            fetchChallans();
        } catch (error: any) {
            onError(error.message || 'Failed to delete challan');
        }
    };

    const exportChallanToPDF = async (challan: JobWorkChallan) => {
        try {
            await generateDocument('pdf', 'returnable_dc', { doc: challan, companyInfo, vendors: [...jobWorkSuppliers, ...vendors] });
        } catch (error) {
            onError('Failed to generate PDF');
        }
    };

    const exportChallanToExcel = async (challan: JobWorkChallan) => {
        try {
            await generateDocument('excel', 'Returnable DC', [challan]);
        } catch (error) {
            onError('Failed to generate Excel');
        }
    };

    // Tab counts calculation
    const tabCounts = useMemo(() => {
        const now = new Date();
        let active = 0;
        let received = 0;
        let overdue = 0;

        challans.forEach(c => {
            const isClosed = c.status === 'Closed';
            if (!isClosed) active++;
            if (isClosed) received++;
            if (!isClosed && c.expectedReturnDate && new Date(c.expectedReturnDate) < now) {
                overdue++;
            }
        });

        return {
            all: challans.length,
            active,
            received,
            overdue
        };
    }, [challans]);

    // Available years from challan dates
    const availableYears = useMemo(() => {
        const currentYear = new Date().getFullYear();
        const years = new Set<number>([currentYear]);
        challans.forEach(c => {
            if (c.date) {
                const yr = new Date(c.date).getFullYear();
                if (!isNaN(yr)) years.add(yr);
            }
        });
        return Array.from(years).sort((a, b) => b - a);
    }, [challans]);

    // Filter Logic
    const filteredChallans = useMemo(() => {
        return challans.filter(c => {
            const matchesSearch =
                c.challanNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (c.vendor?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (c.mrpNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (c.items || []).some((it: any) => (it.itemName || '').toLowerCase().includes(searchTerm.toLowerCase()));

            if (!matchesSearch) return false;

            if (workflowFilter !== 'all') {
                const type = c.jobWorkType || 'store-conversion';
                if (type !== workflowFilter) return false;
            }

            if (filterSupplier && c.vendor?._id !== filterSupplier) return false;

            // Date Filter Logic (Day / Month / Year)
            if (filterDate) {
                const challanDateObj = new Date(c.date);
                if (!isNaN(challanDateObj.getTime())) {
                    if (filterMode === 'daily') {
                        const challanDay = challanDateObj.toISOString().slice(0, 10);
                        if (challanDay !== filterDate) return false;
                    } else if (filterMode === 'monthly') {
                        const challanMonth = challanDateObj.toISOString().slice(0, 7);
                        if (challanMonth !== filterDate) return false;
                    } else if (filterMode === 'yearly') {
                        const challanYear = String(challanDateObj.getFullYear());
                        if (challanYear !== filterDate) return false;
                    }
                }
            }

            // SubTab status filtering
            if (subTab === 'active') {
                if (c.status === 'Closed') return false;
            } else if (subTab === 'received') {
                if (c.status !== 'Closed') return false;
            } else if (subTab === 'overdue') {
                if (c.status === 'Closed') return false;
                if (!c.expectedReturnDate) return false;
                if (new Date(c.expectedReturnDate) >= new Date()) return false;
            }
            // 'all' includes everything matching filters

            return true;
        });
    }, [challans, searchTerm, workflowFilter, filterSupplier, filterDate, filterMode, subTab]);

    // Render dynamic date input based on selected mode
    const renderDateFilterInput = () => {
        if (filterMode === 'daily') {
            return (
                <input
                    type="date"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="h-9 px-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                />
            );
        }
        if (filterMode === 'monthly') {
            return (
                <input
                    type="month"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="h-9 px-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                />
            );
        }
        return (
            <select
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="h-9 px-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
            >
                <option value="">All Years</option>
                {availableYears.map((year: number) => (
                    <option key={year} value={String(year)}>
                        {year}
                    </option>
                ))}
            </select>
        );
    };

    return (
        <div className="animate-in fade-in duration-300 space-y-4">
            
            {/* Top Row: Sub-Tabs & Action Button */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                {/* Sub-Tabs with Counter Badges */}
                <div className="flex bg-gray-100 dark:bg-gray-800/60 p-1 rounded-xl backdrop-blur-sm overflow-x-auto no-scrollbar gap-1 max-w-full">
                    <button
                        onClick={() => setSubTab('all')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                            subTab === 'all'
                                ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                        }`}
                    >
                        <span>All Challans</span>
                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${subTab === 'all' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300' : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
                            {tabCounts.all}
                        </span>
                    </button>

                    <button
                        onClick={() => setSubTab('active')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                            subTab === 'active'
                                ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                        }`}
                    >
                        <span>Active / In-Process</span>
                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${subTab === 'active' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300' : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
                            {tabCounts.active}
                        </span>
                    </button>

                    <button
                        onClick={() => setSubTab('received')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                            subTab === 'received'
                                ? 'bg-white dark:bg-gray-700 text-emerald-600 dark:text-emerald-300 shadow-xs'
                                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                        }`}
                    >
                        <span>History / Received</span>
                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${subTab === 'received' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300' : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
                            {tabCounts.received}
                        </span>
                    </button>

                    <button
                        onClick={() => setSubTab('overdue')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                            subTab === 'overdue'
                                ? 'bg-white dark:bg-gray-700 text-red-600 dark:text-red-300 shadow-xs'
                                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                        }`}
                    >
                        <span>Overdue Return</span>
                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${subTab === 'overdue' ? 'bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300' : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
                            {tabCounts.overdue}
                        </span>
                    </button>

                    <button
                        onClick={() => setSubTab('rejections')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                            subTab === 'rejections'
                                ? 'bg-white dark:bg-gray-700 text-rose-600 dark:text-rose-400 shadow-xs'
                                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                        }`}
                    >
                        <ShieldAlert size={14} className="text-rose-500" />
                        <span>Rejection Bin (DC Return)</span>
                    </button>
                </div>

                {/* Primary Action Button */}
                <button
                    onClick={() => handleCreateChallan()}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer shrink-0"
                >
                    <Plus size={15} />
                    <span>Create Returnable DC</span>
                </button>
            </div>

            {subTab === 'rejections' ? (
                <div className="pt-1">
                    <RejectionReworkHub context="wip-jobwork" />
                </div>
            ) : (
                <>
                    {/* Single-Line Unified Toolbar: Search + Workflow + Supplier + Date Switcher & Picker + Count */}
                    <div className="bg-white dark:bg-gray-900 p-2.5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                    
                    {/* Left: Search & Selectors */}
                    <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
                        {/* Search Input */}
                        <div className="relative flex-1 min-w-[180px] max-w-xs">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                            <input
                                type="text"
                                placeholder="Search Challan #, Vendor, Item, MRP #..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full h-9 pl-9 pr-7 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                            />
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 cursor-pointer text-xs font-bold"
                                >
                                    ✕
                                </button>
                            )}
                        </div>

                        {/* Workflow Type Selector */}
                        <select
                            value={workflowFilter}
                            onChange={(e) => setWorkflowFilter(e.target.value as any)}
                            className="h-9 px-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer max-w-[200px] truncate"
                        >
                            <option value="all">📦 All DC Types</option>
                            <option value="store-conversion">🏭 Store Conversion</option>
                            <option value="store-to-wip">🔄 Store to WIP</option>
                            <option value="wip-to-wip">📦 WIP to WIP (Coating)</option>
                            <option value="route-card">⚙️ Route-Card Op</option>
                        </select>

                        {/* Supplier Filter */}
                        <select
                            value={filterSupplier}
                            onChange={(e) => setFilterSupplier(e.target.value)}
                            className="h-9 px-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer max-w-[180px] truncate"
                        >
                            <option value="">🏢 All Vendors</option>
                            {Array.from(new Set(challans.filter(c => c.vendor).map(c => c.vendor!._id))).map(id => {
                                const vendor = challans.find(c => c.vendor?._id === id)?.vendor;
                                if (!vendor) return null;
                                return <option key={vendor._id} value={vendor._id}>{vendor.name}</option>;
                            })}
                        </select>
                    </div>

                    {/* Right: Date Mode Switcher + Dynamic Date Picker + Live Count */}
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Day / Month / Year Mode Switcher */}
                        <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-800 p-0.5 rounded-xl border border-gray-200/60 dark:border-gray-700">
                            {[
                                { id: 'daily', label: 'Day' },
                                { id: 'monthly', label: 'Month' },
                                { id: 'yearly', label: 'Year' }
                            ].map((type) => (
                                <button
                                    key={type.id}
                                    onClick={() => { setFilterMode(type.id as any); setFilterDate(''); }}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                        filterMode === type.id
                                            ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-300 shadow-xs'
                                            : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                                    }`}
                                >
                                    {type.label}
                                </button>
                            ))}
                        </div>

                        {/* Date Picker Input */}
                        <div className="flex items-center gap-1">
                            {renderDateFilterInput()}
                            {filterDate && (
                                <button
                                    onClick={() => setFilterDate('')}
                                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition-colors cursor-pointer text-xs font-bold"
                                    title="Clear date filter"
                                >
                                    ✕
                                </button>
                            )}
                        </div>

                        {/* Total Count Badge */}
                        <div className="h-9 px-3 flex items-center text-xs font-bold text-gray-600 dark:text-gray-300 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-xl border border-indigo-100 dark:border-indigo-900/60 whitespace-nowrap">
                            Total: <span className="text-indigo-700 dark:text-indigo-300 font-black ml-1.5">{filteredChallans.length}</span>
                        </div>
                    </div>

                </div>
            </div>

            {/* Content Logic: High-Density ERP Data Table */}
            {loading ? (
                <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>
            ) : filteredChallans.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/40 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 pb-28 sm:pb-20">
                    <Truck className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600 mb-3" />
                    <p className="text-gray-500 dark:text-gray-400 font-medium text-sm">No returnable delivery challans found matching current filters</p>
                    <div className="mt-4">
                        <button
                            onClick={() => handleCreateChallan()}
                            className="text-indigo-600 dark:text-indigo-400 font-bold text-xs hover:underline"
                        >
                            + Create New Returnable DC
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    {/* Desktop ERP Data Table */}
                    <div className="hidden md:block bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left border-collapse">
                                <thead className="bg-slate-50 dark:bg-slate-800/80 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                                    <tr>
                                        <th className="px-3.5 py-3 text-center w-12">#</th>
                                        <th className="px-4 py-3">Challan Details</th>
                                        <th className="px-4 py-3">Subcontractor / Vendor</th>
                                        <th className="px-3.5 py-3">MRP Plan Ref</th>
                                        <th className="px-4 py-3">Outward Material Sent</th>
                                        <th className="px-4 py-3">Expected Return Item(s)</th>
                                        <th className="px-3.5 py-3">Dates & Status</th>
                                        <th className="px-4 py-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {filteredChallans.map((challan, idx) => {
                                        const remainingSecs = getRemainingEditSeconds(challan.createdAt || challan.date);
                                        const isActionable = remainingSecs > 0 && challan.status !== 'Closed' && challan.status !== 'Partial';
                                        const isOverdue = challan.expectedReturnDate && new Date(challan.expectedReturnDate) < new Date() && challan.status !== 'Closed';

                                        // Material Sent Summary
                                        const isAssembly = challan.operationMode === 'assembly';
                                        const primarySentItem = challan.items?.[0];
                                        const sentItemCount = challan.items?.length || 0;
                                        const totalSentQty = (challan.items || []).reduce((acc, it) => acc + (Number(it.quantitySent) || 0), 0);
                                        const sentUnit = primarySentItem?.unit || 'PCS';
                                        const sentProcessType = primarySentItem?.processType || (isAssembly ? 'Assembly / Welding' : 'Job Work');
                                        const sentRate = Number(primarySentItem?.processRate != null ? primarySentItem.processRate : primarySentItem?.unitPrice) || 0;
                                        const sentDesc = getItemDescription(primarySentItem);

                                        // Returning Item Summary
                                        let retName = '-';
                                        let retDesc = '';
                                        let expQty = 0;
                                        let recvQty = 0;
                                        let pendingQty = 0;
                                        let retUnit = 'PCS';

                                        if (isAssembly) {
                                            if (challan.assemblyGroups && challan.assemblyGroups.length > 0) {
                                                const firstGrp = challan.assemblyGroups[0];
                                                const out = firstGrp.assemblyOutputItem;
                                                const extraCount = challan.assemblyGroups.length - 1;
                                                retName = out?.itemName || 'Assembled Product';
                                                if (extraCount > 0) {
                                                    retName = `${retName} (+${extraCount} more sets)`;
                                                }
                                                retDesc = getItemDescription(out);
                                                expQty = challan.assemblyGroups.reduce((acc, g) => acc + (Number(g.assemblyOutputItem?.quantityToBeReceived) || 0), 0);
                                                recvQty = challan.assemblyGroups.reduce((acc, g) => acc + (Number(g.assemblyOutputItem?.quantityReceived) || 0), 0);
                                                pendingQty = Math.max(0, expQty - recvQty);
                                                retUnit = out?.receivingUnit || 'PCS';
                                            } else if (challan.assemblyOutputItem) {
                                                const out = challan.assemblyOutputItem;
                                                retName = out.itemName || 'Assembled / Welded Product';
                                                retDesc = getItemDescription(out);
                                                expQty = Number(out.quantityToBeReceived) || 0;
                                                recvQty = Number(out.quantityReceived) || 0;
                                                pendingQty = Math.max(0, expQty - recvQty);
                                                retUnit = out.receivingUnit || 'PCS';
                                            }
                                        } else if (primarySentItem) {
                                            const firstRet = primarySentItem.returningItems?.[0];
                                            retName = firstRet?.receivedItemName || primarySentItem.itemName || 'Converted Item';
                                            retDesc = getItemDescription(firstRet);
                                            expQty = Number(firstRet?.quantityToBeReceived || primarySentItem.quantitySent) || 0;
                                            recvQty = Number(firstRet?.quantityReceived || primarySentItem.quantityReceived) || 0;
                                            pendingQty = Math.max(0, expQty - recvQty);
                                            retUnit = firstRet?.receivingUnit || primarySentItem.unit || 'PCS';
                                        }

                                        return (
                                            <tr key={challan._id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors group">
                                                {/* 1. Row Index */}
                                                <td className="px-3.5 py-3 text-center text-xs font-mono font-bold text-slate-400">
                                                    {idx + 1}
                                                </td>

                                                {/* 2. Challan Details */}
                                                <td className="px-4 py-3">
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center gap-1.5">
                                                            <button
                                                                onClick={() => openPreview(challan)}
                                                                className="text-xs font-black text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 hover:underline flex items-center gap-1 cursor-pointer font-mono"
                                                                title="Click to preview complete DC details"
                                                            >
                                                                {challan.challanNumber}
                                                                <Eye size={12} className="opacity-70 group-hover:opacity-100" />
                                                            </button>
                                                        </div>
                                                        <div className="flex flex-wrap items-center gap-1">
                                                            {/* DC Type Badge */}
                                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold border ${
                                                                challan.jobWorkType === 'route-card'
                                                                    ? 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                                                                    : challan.jobWorkType === 'store-to-wip'
                                                                        ? 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                                                                        : challan.jobWorkType === 'wip-to-wip'
                                                                            ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                                                                            : 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800'
                                                            }`}>
                                                                {challan.jobWorkType === 'route-card' ? 'Route-Card' :
                                                                 challan.jobWorkType === 'store-to-wip' ? 'Store ➔ WIP' :
                                                                 challan.jobWorkType === 'wip-to-wip' ? 'WIP ➔ WIP' : 'RM Conv.'}
                                                            </span>

                                                            {/* Mode Badge */}
                                                            {isAssembly ? (
                                                                <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-200 dark:border-amber-800 uppercase tracking-tight" title="Many components welded / assembled into 1 return item">
                                                                    Many ➔ 1 Kit
                                                                </span>
                                                            ) : (
                                                                <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                                                    1 ➔ Many
                                                                </span>
                                                            )}

                                                            {/* E-Way Bill */}
                                                            {challan.ewayBillNo && (
                                                                <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 font-semibold" title={`E-Way Bill: ${challan.ewayBillNo}`}>
                                                                    EW: {challan.ewayBillNo.slice(-6)}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* 3. Subcontractor / Vendor */}
                                                <td className="px-4 py-3">
                                                    <div className="font-bold text-xs text-slate-900 dark:text-slate-100 line-clamp-1">
                                                        {challan.vendor?.name || 'Unknown Vendor'}
                                                    </div>
                                                    {challan.vendor?.city && (
                                                        <div className="text-[11px] text-slate-400">
                                                            {challan.vendor.city}
                                                        </div>
                                                    )}
                                                </td>

                                                {/* 4. MRP Plan Ref */}
                                                <td className="px-3.5 py-3 text-xs">
                                                    {challan.mrpNumber ? (
                                                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-[11px] font-mono font-bold">
                                                            {challan.mrpNumber}
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-400 text-xs">-</span>
                                                    )}
                                                </td>

                                                {/* 5. Outward Material(s) Sent (Strict AGENTS.md compliance: Name bold, description italic) */}
                                                <td className="px-4 py-3 max-w-xs">
                                                    <div>
                                                        <div className="font-bold text-xs text-slate-900 dark:text-white line-clamp-1">
                                                            {primarySentItem?.itemName || 'Material Item'}
                                                        </div>
                                                        {sentDesc && (
                                                            <div className="text-[11px] text-slate-500 italic mt-0.5 line-clamp-1">
                                                                {sentDesc}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-1.5 mt-1 text-xs">
                                                        <span className="font-extrabold text-slate-800 dark:text-slate-200">
                                                            {isAssembly ? `${totalSentQty} ${sentUnit} (Total)` : `${primarySentItem?.quantitySent || 0} ${sentUnit}`}
                                                        </span>
                                                        {sentItemCount > 1 && (
                                                            <span 
                                                                className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900 cursor-help"
                                                                title={`Kit contains ${sentItemCount} items: ${(challan.items || []).map(it => it.itemName).join(', ')}`}
                                                            >
                                                                +{sentItemCount - 1} more items
                                                            </span>
                                                        )}
                                                        {sentRate > 0 && (
                                                            <span className="text-[11px] font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                                                @ ₹{sentRate.toFixed(2)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* 6. Expected Converted / Return Item(s) */}
                                                <td className="px-4 py-3 max-w-xs">
                                                    <div>
                                                        <div className="font-bold text-xs text-indigo-700 dark:text-indigo-300 line-clamp-1">
                                                            {retName}
                                                        </div>
                                                        {retDesc && (
                                                            <div className="text-[11px] text-slate-500 italic mt-0.5 line-clamp-1">
                                                                {retDesc}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-1 text-xs font-semibold">
                                                        <span className="text-slate-500">Exp: <b className="text-slate-800 dark:text-slate-200">{expQty}</b></span>
                                                        <span className="text-slate-300">•</span>
                                                        <span className="text-emerald-600">Recv: <b>{recvQty}</b></span>
                                                        <span className="text-slate-300">•</span>
                                                        <span className={`font-bold ${pendingQty > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>
                                                            Pend: {pendingQty} {retUnit}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* 7. Dates & Status */}
                                                <td className="px-3.5 py-3 whitespace-nowrap">
                                                    <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
                                                        Sent: {formatDateTime(challan.date)}
                                                    </div>
                                                    {challan.expectedReturnDate && (
                                                        <div className={`text-[11px] font-semibold mt-0.5 flex items-center gap-1 ${
                                                            isOverdue ? 'text-red-600 font-bold' : 'text-slate-500'
                                                        }`}>
                                                            {isOverdue && <AlertTriangle size={11} className="text-red-500 shrink-0" />}
                                                            Due: {formatDateTime(challan.expectedReturnDate)}
                                                        </div>
                                                    )}
                                                    <div className="mt-1">
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                                                            challan.status === 'Open' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' :
                                                            challan.status === 'Partial' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' :
                                                            challan.status === 'Closed' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                                                            'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                                                        }`}>
                                                            {challan.status}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* 8. Quick Actions & 24h Countdown Timer */}
                                                <td className="px-4 py-3 text-right whitespace-nowrap">
                                                    <div className="flex justify-end items-center gap-1.5">
                                                        {/* Preview Action */}
                                                        <button 
                                                            onClick={() => openPreview(challan)} 
                                                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition-colors cursor-pointer border border-indigo-200 dark:border-indigo-800" 
                                                            title="Preview Challan (Details, PDF, Excel)"
                                                        >
                                                            <Eye size={14} />
                                                        </button>

                                                        {/* Mark Return / Receive Action */}
                                                        {challan.status !== 'Closed' && (
                                                            <button 
                                                                onClick={() => openReceiveModal(challan)} 
                                                                className="px-2.5 py-1.5 bg-gray-900 hover:bg-black text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow-xs cursor-pointer" 
                                                                title="Mark Received / Return Items"
                                                            >
                                                                <Truck size={13} />
                                                                <span>Return</span>
                                                            </button>
                                                        )}

                                                        {/* Direct Print PDF */}
                                                        <button 
                                                            onClick={() => exportChallanToPDF(challan)} 
                                                            className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors cursor-pointer border border-blue-200 dark:border-blue-800" 
                                                            title="Download PDF"
                                                        >
                                                            <FileText size={14} />
                                                        </button>

                                                        {/* Excel Export */}
                                                        <button 
                                                            onClick={() => exportChallanToExcel(challan)} 
                                                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition-colors cursor-pointer border border-emerald-200 dark:border-emerald-800" 
                                                            title="Download Excel"
                                                        >
                                                            <FileSpreadsheet size={14} />
                                                        </button>

                                                        {/* 24-Hour Edit/Delete Countdown Timer */}
                                                        {isActionable ? (
                                                            <div className="flex items-center gap-1 shrink-0 ml-0.5">
                                                                <span 
                                                                    title={`Edit and delete allowed for another ${formatRemainingTime(remainingSecs)}`}
                                                                    className="px-2 py-1 bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 rounded-xl font-mono text-[10px] font-bold border border-amber-200 dark:border-amber-800 inline-flex items-center gap-1 shrink-0"
                                                                >
                                                                    <Clock size={11} className="text-amber-600 animate-pulse" />
                                                                    {formatRemainingTime(remainingSecs)}
                                                                </span>

                                                                <button 
                                                                    onClick={() => { setPrefillData(challan); setIsFormOpen(true); }} 
                                                                    className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors cursor-pointer border border-blue-200 dark:border-blue-800" 
                                                                    title={`Edit Returnable DC (${formatRemainingTime(remainingSecs)} left)`}
                                                                >
                                                                    <Edit2 size={13} />
                                                                </button>

                                                                <button 
                                                                    onClick={() => handleDelete(challan._id, challan.challanNumber)} 
                                                                    className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer border border-rose-200 dark:border-rose-800" 
                                                                    title={`Delete Returnable DC (${formatRemainingTime(remainingSecs)} left)`}
                                                                >
                                                                    <Trash2 size={13} />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <span 
                                                                title={challan.status === 'Closed' ? 'Challan is fully closed and locked' : challan.status === 'Partial' ? 'Challan has received items and cannot be edited' : 'Action window expired (24 hours elapsed)'}
                                                                className="px-2 py-1 bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 rounded-xl text-[10px] font-semibold inline-flex items-center gap-1 border border-slate-200 dark:border-slate-700"
                                                            >
                                                                <Lock size={11} /> Locked
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Mobile Card View (Responsive for Phone/Tablet) */}
                    <div className="md:hidden flex flex-col gap-3 pb-28 sm:pb-20">
                        {filteredChallans.map((challan) => {
                            const remainingSecs = getRemainingEditSeconds(challan.createdAt || challan.date);
                            const isActionable = remainingSecs > 0 && challan.status !== 'Closed' && challan.status !== 'Partial';
                            const isOverdue = challan.expectedReturnDate && new Date(challan.expectedReturnDate) < new Date() && challan.status !== 'Closed';

                            const isAssembly = challan.operationMode === 'assembly';
                            const primarySentItem = challan.items?.[0];
                            const sentItemCount = challan.items?.length || 0;
                            const totalSentQty = (challan.items || []).reduce((acc, it) => acc + (Number(it.quantitySent) || 0), 0);
                            const sentUnit = primarySentItem?.unit || 'PCS';

                            let retName = '-';
                            let expQty = 0;
                            let recvQty = 0;
                            let pendingQty = 0;

                            if (isAssembly) {
                                if (challan.assemblyGroups && challan.assemblyGroups.length > 0) {
                                    const firstGrp = challan.assemblyGroups[0];
                                    const out = firstGrp.assemblyOutputItem;
                                    const extraCount = challan.assemblyGroups.length - 1;
                                    retName = out?.itemName || 'Assembled Product';
                                    if (extraCount > 0) {
                                        retName = `${retName} (+${extraCount} more sets)`;
                                    }
                                    expQty = challan.assemblyGroups.reduce((acc, g) => acc + (Number(g.assemblyOutputItem?.quantityToBeReceived) || 0), 0);
                                    recvQty = challan.assemblyGroups.reduce((acc, g) => acc + (Number(g.assemblyOutputItem?.quantityReceived) || 0), 0);
                                    pendingQty = Math.max(0, expQty - recvQty);
                                } else if (challan.assemblyOutputItem) {
                                    const out = challan.assemblyOutputItem;
                                    retName = out.itemName || 'Assembled Product';
                                    expQty = Number(out.quantityToBeReceived) || 0;
                                    recvQty = Number(out.quantityReceived) || 0;
                                    pendingQty = Math.max(0, expQty - recvQty);
                                }
                            } else if (primarySentItem) {
                                const firstRet = primarySentItem.returningItems?.[0];
                                retName = firstRet?.receivedItemName || primarySentItem.itemName || 'Converted Item';
                                expQty = Number(firstRet?.quantityToBeReceived || primarySentItem.quantitySent) || 0;
                                recvQty = Number(firstRet?.quantityReceived || primarySentItem.quantityReceived) || 0;
                                pendingQty = Math.max(0, expQty - recvQty);
                            }

                            return (
                                <div key={challan._id} className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col gap-3">
                                    <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-800 pb-2">
                                        <div>
                                            <span 
                                                onClick={() => openPreview(challan)} 
                                                className="text-xs font-mono text-indigo-600 dark:text-indigo-400 font-bold block mb-0.5 cursor-pointer hover:underline"
                                            >
                                                DC #{challan.challanNumber}
                                            </span>
                                            <h4 className="font-bold text-slate-900 dark:text-white text-xs">
                                                {challan.vendor?.name || 'Vendor'}
                                            </h4>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                challan.status === 'Open' ? 'bg-blue-100 text-blue-800' :
                                                challan.status === 'Partial' ? 'bg-amber-100 text-amber-800' :
                                                challan.status === 'Closed' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                            }`}>
                                                {challan.status}
                                            </span>
                                            {challan.mrpNumber && (
                                                <span className="text-[10px] font-mono font-semibold text-slate-500">
                                                    MRP: {challan.mrpNumber}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="text-xs space-y-1.5 text-slate-600 dark:text-slate-300">
                                        <div className="flex justify-between">
                                            <span className="text-slate-400">Outward Item:</span>
                                            <span className="font-bold text-slate-800 dark:text-slate-200 text-right">
                                                {primarySentItem?.itemName || '-'}
                                                {sentItemCount > 1 && ` (+${sentItemCount - 1} more)`}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-400">Sent Qty:</span>
                                            <span className="font-bold text-slate-700 dark:text-slate-200">
                                                {isAssembly ? totalSentQty : (primarySentItem?.quantitySent || 0)} {sentUnit}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-400">Inward Return:</span>
                                            <span className="font-semibold text-indigo-700 dark:text-indigo-400 text-right">
                                                {retName}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-400">Exp / Recv / Pend:</span>
                                            <span className="font-bold">
                                                {expQty} / <span className="text-emerald-600">{recvQty}</span> / <span className="text-amber-600">{pendingQty}</span>
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-400">Sent Date:</span>
                                            <span>{formatDateTime(challan.date)}</span>
                                        </div>
                                        {challan.expectedReturnDate && (
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">Due Date:</span>
                                                <span className={isOverdue ? 'text-red-600 font-bold' : ''}>
                                                    {formatDateTime(challan.expectedReturnDate)}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Mobile Actions */}
                                    <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex items-center gap-1">
                                            <button 
                                                onClick={() => openPreview(challan)} 
                                                className="px-2.5 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100 flex items-center gap-1 cursor-pointer"
                                            >
                                                <Eye size={13} /> Preview
                                            </button>
                                            <button 
                                                onClick={() => exportChallanToPDF(challan)} 
                                                className="p-1.5 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 cursor-pointer"
                                                title="PDF"
                                            >
                                                <FileText size={13} />
                                            </button>
                                        </div>

                                        <div className="flex items-center gap-1.5">
                                            {challan.status !== 'Closed' && (
                                                <button 
                                                    onClick={() => openReceiveModal(challan)} 
                                                    className="px-3 py-1.5 bg-gray-900 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer shadow-xs"
                                                >
                                                    <Truck size={13} /> Return
                                                </button>
                                            )}

                                            {isActionable ? (
                                                <div className="flex items-center gap-1">
                                                    <span className="px-1.5 py-1 bg-amber-50 text-amber-700 rounded font-mono text-[9px] font-bold border border-amber-200">
                                                        {formatRemainingTime(remainingSecs)}
                                                    </span>
                                                    <button 
                                                        onClick={() => { setPrefillData(challan); setIsFormOpen(true); }} 
                                                        className="p-1.5 text-blue-600 bg-blue-50 rounded-lg cursor-pointer"
                                                    >
                                                        <Edit2 size={12} />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDelete(challan._id, challan.challanNumber)} 
                                                        className="p-1.5 text-rose-600 bg-rose-50 rounded-lg cursor-pointer"
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="px-1.5 py-1 bg-slate-100 text-slate-400 rounded text-[10px] font-semibold flex items-center gap-1">
                                                    <Lock size={10} /> Locked
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
                </>
            )}

            {/* Forms & Modals */}
            <JobWorkForm
                isOpen={isFormOpen}
                isModal={true}
                onClose={() => { setIsFormOpen(false); setPrefillData(null); }}
                onSuccess={handleCreateSuccess}
                onError={onError}
                vendors={vendors}
                jobWorkSuppliers={jobWorkSuppliers}
                rawMaterials={rawMaterials}
                boughtOuts={boughtOuts}
                materials={materials}
                inventoryList={inventoryList}
                inHouseItems={inHouseItems}
                mrpPlans={mrpPlans}
                initialData={prefillData}
                token={token}
                companyInfo={companyInfo}
            />

            {/* Modals */}
            {isReceiveModalOpen && selectedChallan && (
                <JobWorkReceiveModal
                    isOpen={isReceiveModalOpen}
                    onClose={() => setIsReceiveModalOpen(false)}
                    onSuccess={handleReceiveSuccess}
                    onError={onError}
                    challan={selectedChallan}
                    token={token}
                />
            )}

            {isPreviewOpen && previewChallan && (
                <JobWorkPreviewModal
                    isOpen={isPreviewOpen}
                    onClose={() => setIsPreviewOpen(false)}
                    challan={previewChallan}
                    vendors={vendors}
                    jobWorkSuppliers={jobWorkSuppliers}
                    companyInfo={companyInfo}
                    onEdit={(c) => { setPrefillData(c); setIsPreviewOpen(false); setIsFormOpen(true); }}
                    onReceive={(c) => { setIsPreviewOpen(false); openReceiveModal(c); }}
                    onDelete={(id) => { setIsPreviewOpen(false); handleDelete(id, previewChallan.challanNumber); }}
                />
            )}
        </div>
    );
}

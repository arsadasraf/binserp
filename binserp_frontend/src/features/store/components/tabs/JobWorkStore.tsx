import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Eye, Factory, Calendar, Truck, CheckCircle2, FileText, FileSpreadsheet } from 'lucide-react';
import { JobWorkChallan, Vendor, JobWorkSupplier } from "@/src/features/store/types/store.types";
import JobWorkForm from '../forms/JobWorkForm';
import JobWorkReceiveModal from '../modals/JobWorkReceiveModal';
import JobWorkPreviewModal from '../modals/JobWorkPreviewModal';

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

export default function JobWorkStore({ vendors, jobWorkSuppliers = [], rawMaterials = [], boughtOuts = [], materials = [], inventoryList = [], inHouseItems = [], mrpPlans = [], activeTab, token, companyInfo, onError, onSuccess }: JobWorkStoreProps) {
    const [challans, setChallans] = useState<JobWorkChallan[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    // User requested "Challan" tab. Replacing 'sent'/'create' with 'challan'.
    const [subTab, setSubTab] = useState<'challan' | 'received' | 'overdue'>('challan');

    // Filter States
    const [filterMode, setFilterMode] = useState<'daily' | 'monthly' | 'yearly'>('daily');
    const [filterDate, setFilterDate] = useState('');
    const [filterSupplier, setFilterSupplier] = useState('');
    const [workflowFilter, setWorkflowFilter] = useState<'all' | 'store-conversion' | 'store-to-wip' | 'wip-to-wip' | 'route-card'>('all');

    // New State for Pending Jobs
    const [prefillData, setPrefillData] = useState<any>(null);

    // Modal States
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
    const [selectedChallan, setSelectedChallan] = useState<JobWorkChallan | null>(null);

    // Preview Modal State
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [previewChallan, setPreviewChallan] = useState<JobWorkChallan | null>(null);

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
    }, [subTab]);

    const handleCreateSuccess = () => {
        setIsFormOpen(false);
        fetchChallans();
        onSuccess('Job Work Challan created successfully');
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

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this challan?')) return;
        try {
            await apiDelete(`/api/store/jobwork/delete/${id}`, token!);
            onSuccess('Challan deleted successfully');
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
    const filteredChallans = challans.filter(c => {
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
        if (subTab === 'challan') return c.status !== 'Closed';
        if (subTab === 'received') return c.status === 'Closed' || c.status === 'Partial';
        if (subTab === 'overdue') {
            if (c.status === 'Closed') return false;
            if (!c.expectedReturnDate) return false;
            return new Date(c.expectedReturnDate) < new Date();
        }
        return true;
    });

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
                {/* Sub-Tabs */}
                <div className="flex bg-gray-100 dark:bg-gray-800/60 p-1 rounded-xl backdrop-blur-sm overflow-x-auto no-scrollbar">
                    <button
                        onClick={() => setSubTab('challan')}
                        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                            subTab === 'challan'
                                ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                        }`}
                    >
                        Active Challans
                    </button>

                    <button
                        onClick={() => setSubTab('received')}
                        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                            subTab === 'received'
                                ? 'bg-white dark:bg-gray-700 text-emerald-600 dark:text-emerald-300 shadow-xs'
                                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                        }`}
                    >
                        History / Received
                    </button>

                    <button
                        onClick={() => setSubTab('overdue')}
                        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                            subTab === 'overdue'
                                ? 'bg-white dark:bg-gray-700 text-red-600 dark:text-red-300 shadow-xs'
                                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                        }`}
                    >
                        Overdue Return
                    </button>
                </div>

                {/* Primary Action Button */}
                <button
                    onClick={() => handleCreateChallan()}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer"
                >
                    <Plus size={15} />
                    <span>Create Returnable DC</span>
                </button>
            </div>

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


            {/* Content Logic */}
            {loading ? (
                <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>
            ) : filteredChallans.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200 pb-28 sm:pb-20">
                    <Truck className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                    <p className="text-gray-500">No job work items found</p>
                    {subTab === 'challan' && (
                        <div className="mt-4">
                            <button
                                onClick={() => handleCreateChallan()}
                                className="text-indigo-600 font-medium hover:underline"
                            >
                                Create your first challan
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4 pb-28 sm:pb-20">
                    {filteredChallans.map(challan => (
                        <div key={challan._id} className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow group">
                            {/* Clickable Card Header */}
                            <div
                                onClick={() => openPreview(challan)}
                                className="flex flex-col sm:flex-row justify-between gap-3 mb-4 border-b border-gray-50 pb-3 cursor-pointer hover:bg-slate-50/80 -mx-4 -mt-4 p-4 rounded-t-2xl transition-colors"
                                title="Click to view full challan details preview"
                            >
                                <div>
                                    <div className="flex items-center gap-2.5 mb-1 flex-wrap">
                                        <span className="font-extrabold text-gray-900 group-hover:text-indigo-600 transition-colors flex items-center gap-1.5 text-sm sm:text-base">
                                            {challan.challanNumber}
                                            <Eye size={15} className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity hidden sm:inline" />
                                        </span>
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${challan.status === 'Open' ? 'bg-blue-100 text-blue-800' :
                                            challan.status === 'Partial' ? 'bg-amber-100 text-amber-800' :
                                                challan.status === 'Closed' ? 'bg-green-100 text-green-800' :
                                                    'bg-red-100 text-red-800'
                                            }`}>{challan.status}</span>
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                            challan.jobWorkType === 'route-card'
                                                ? 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                                                : challan.jobWorkType === 'store-to-wip'
                                                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                                                    : 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                                        }`}>
                                            {challan.jobWorkType === 'route-card' ? 'PPC Route-Card (WIP)' : challan.jobWorkType === 'store-to-wip' ? 'Store to WIP' : 'RM Conversion'}
                                        </span>
                                        {challan.ewayBillNo && (
                                            <span className="bg-indigo-50 text-indigo-700 font-mono text-[11px] px-2 py-0.5 rounded border border-indigo-100">
                                                E-Way: {challan.ewayBillNo}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-xs sm:text-sm text-gray-600 flex items-center gap-1.5">
                                        <Factory size={14} className="text-slate-400 shrink-0" /> <span className="font-semibold">{challan.vendor?.name || 'Unknown Vendor'}</span>
                                    </div>
                                </div>
                                <div className="text-left sm:text-right text-xs text-gray-500 flex sm:flex-col justify-between items-center sm:items-end gap-1">
                                    <div className="flex items-center gap-1"><Calendar size={13} /> Sent: {new Date(challan.date).toLocaleDateString()}</div>
                                    {challan.expectedReturnDate && (
                                        <div className={`font-semibold ${new Date(challan.expectedReturnDate) < new Date() && challan.status !== 'Closed' ? 'text-red-500' : 'text-gray-500'}`}>
                                            Due: {new Date(challan.expectedReturnDate).toLocaleDateString()}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Desktop Items Table */}
                            <div className="hidden md:block overflow-x-auto cursor-pointer" onClick={() => openPreview(challan)}>
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                                        <tr>
                                            <th className="px-3 py-2 text-left">Item Sent</th>
                                            <th className="px-3 py-2 text-left">Material to be Received</th>
                                            <th className="px-3 py-2 text-left">Process / Rate</th>
                                            <th className="px-3 py-2 text-center">Sent Qty</th>
                                            <th className="px-3 py-2 text-center">Recv Qty</th>
                                            <th className="px-3 py-2 text-center">Pending</th>
                                            <th className="px-3 py-2 text-right">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {challan.items.map((item, idx) => {
                                            const retList = (item.returningItems && item.returningItems.length > 0) ? item.returningItems : [{
                                                receivedItemName: item.receivedItemName || item.itemToBeReceived || item.itemName,
                                                quantityToBeReceived: item.quantityToBeReceived || item.quantitySent,
                                                quantityReceived: item.quantityReceived || 0,
                                                receivingUnit: item.receivingUnit || item.unit || 'PCS',
                                                status: item.status
                                            }];

                                            return retList.map((ret, rIdx) => {
                                                const expQty = Number(ret.quantityToBeReceived) || 0;
                                                const recvQty = Number(ret.quantityReceived) || 0;
                                                const pending = expQty - recvQty;
                                                const rate = Number(item.processRate != null ? item.processRate : item.unitPrice) || 0;

                                                return (
                                                    <tr key={`${idx}_${rIdx}`}>
                                                        {rIdx === 0 && (
                                                             <td rowSpan={retList.length} className="px-3 py-2 font-semibold text-gray-900 border-r border-gray-100 align-top">
                                                                {item.itemName}
                                                            </td>
                                                        )}
                                                        <td className="px-3 py-2 text-indigo-700 font-semibold">
                                                            {ret.receivedItemName || item.itemName}
                                                        </td>
                                                        {rIdx === 0 && (
                                                            <td rowSpan={retList.length} className="px-3 py-2 text-gray-600 border-r border-gray-100 align-top">
                                                                <div className="font-semibold text-slate-800 dark:text-slate-200">{item.processType || 'Job Work'}</div>
                                                                {rate > 0 && (
                                                                    <div className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                                                                        ₹{rate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {item.unit || 'PCS'}
                                                                    </div>
                                                                )}
                                                            </td>
                                                        )}
                                                        {rIdx === 0 && (
                                                            <td rowSpan={retList.length} className="px-3 py-2 text-center border-r border-gray-100 align-top">
                                                                {item.quantitySent} {item.unit}
                                                            </td>
                                                        )}
                                                        <td className="px-3 py-2 text-center text-slate-700 font-bold">
                                                            {recvQty}
                                                        </td>
                                                        <td className="px-3 py-2 text-center text-indigo-600 font-bold">
                                                            {pending > 0 ? pending : 0}
                                                        </td>
                                                        <td className="px-3 py-2 text-right">
                                                            {ret.status === 'Completed' || pending <= 0 ? <CheckCircle2 size={16} className="text-emerald-500 ml-auto" /> :
                                                                <span className="text-xs text-amber-600 font-medium">{ret.status || 'Sent'}</span>}
                                                        </td>
                                                    </tr>
                                                );
                                            });
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile Items Card View */}
                            <div className="md:hidden flex flex-col gap-2.5 cursor-pointer" onClick={() => openPreview(challan)}>
                                {challan.items.map((item, idx) => {
                                    const retList = (item.returningItems && item.returningItems.length > 0) ? item.returningItems : [{
                                        receivedItemName: item.receivedItemName || item.itemToBeReceived || item.itemName,
                                        quantityToBeReceived: item.quantityToBeReceived || item.quantitySent,
                                        quantityReceived: item.quantityReceived || 0,
                                        receivingUnit: item.receivingUnit || item.unit || 'PCS',
                                        status: item.status
                                    }];

                                    return (
                                        <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Sent Item</span>
                                                    <span className="font-bold text-slate-900 text-xs">{item.itemName}</span>
                                                    <span className="text-[11px] text-indigo-600 font-medium block">
                                                        Process: {item.processType} {(item.processRate || item.unitPrice) ? `(₹${item.processRate || item.unitPrice}/${item.unit || 'PCS'})` : ''}
                                                    </span>
                                                </div>
                                                <span className="px-2 py-0.5 bg-slate-200 text-slate-800 rounded text-[11px] font-bold">
                                                    {item.quantitySent} {item.unit}
                                                </span>
                                            </div>

                                            {retList.map((ret, rIdx) => {
                                                const expQty = Number(ret.quantityToBeReceived) || 0;
                                                const recvQty = Number(ret.quantityReceived) || 0;
                                                const pending = expQty - recvQty;

                                                return (
                                                    <div key={rIdx} className="pt-2 border-t border-slate-200/60 flex justify-between items-center text-xs">
                                                        <div>
                                                            <span className="text-[10px] text-slate-400 uppercase block">Returning</span>
                                                            <span className="font-semibold text-indigo-700">{ret.receivedItemName || item.itemName}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-right">
                                                            <div>
                                                                <span className="text-[10px] text-slate-400 block">Recv / Pend</span>
                                                                <span className="font-bold text-slate-800">{recvQty} / <strong className="text-indigo-600">{pending > 0 ? pending : 0}</strong></span>
                                                            </div>
                                                            {ret.status === 'Completed' || pending <= 0 ? (
                                                                <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                                                            ) : (
                                                                <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded text-[10px] font-bold">In WIP</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Receive Timeline */}
                            {(challan as any).receiveHistory && (challan as any).receiveHistory.length > 0 && (
                                <div className="mt-3 bg-gray-50 rounded-lg p-3 text-xs">
                                    <h4 className="font-semibold text-gray-700 mb-2">Receive Timeline:</h4>
                                    <ul className="space-y-1">
                                        {(challan as any).receiveHistory.map((hist: any, i: number) => {
                                            const itemName = challan.items.find((it: any) => it._id === hist.itemId)?.itemName || 'Unknown Item';
                                            return (
                                                <li key={i} className="text-gray-600 flex gap-2">
                                                    <span className="text-gray-400">{new Date(hist.date).toLocaleString()}</span>
                                                    <span>-</span>
                                                    <span className="font-medium text-gray-800">{hist.quantity}</span>
                                                    <span>x {itemName}</span>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            )}

                            {/* Actions - Responsive Grid on Mobile */}
                            <div className="mt-4 pt-3 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2.5">
                                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                                    <button onClick={() => openPreview(challan)} className="px-3 py-1.5 text-xs sm:text-sm font-semibold text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors flex items-center gap-1">
                                        <Eye size={14} /> Preview
                                    </button>
                                    {challan.status !== 'Partial' && challan.status !== 'Closed' && (
                                        (() => {
                                            const createdAtTime = (challan as any).createdAt ? new Date((challan as any).createdAt).getTime() : 0;
                                            const isWithinTwoHours = createdAtTime ? (Date.now() - createdAtTime) <= (2 * 60 * 60 * 1000) : true;

                                            if (isWithinTwoHours) {
                                                return (
                                                    <>
                                                        <button onClick={() => { setPrefillData(challan); setIsFormOpen(true); }} className="px-3 py-1.5 text-xs sm:text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">Edit</button>
                                                        <button onClick={() => handleDelete(challan._id)} className="px-3 py-1.5 text-xs sm:text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors">Delete</button>
                                                    </>
                                                );
                                            }
                                            return null;
                                        })()
                                    )}
                                    <button onClick={() => exportChallanToPDF(challan)} className="px-2.5 py-1.5 text-xs sm:text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1" title="Download PDF"><FileText size={15}/></button>
                                    <button onClick={() => exportChallanToExcel(challan)} className="px-2.5 py-1.5 text-xs sm:text-sm font-medium text-green-600 bg-green-50 rounded-lg hover:bg-green-100 transition-colors flex items-center gap-1" title="Download Excel"><FileSpreadsheet size={15}/></button>
                                </div>
                                {challan.status !== 'Closed' && (
                                    <button
                                        onClick={() => openReceiveModal(challan)}
                                        className="w-full sm:w-auto px-4 py-2 bg-gray-900 text-white text-xs sm:text-sm font-bold rounded-xl hover:bg-black transition-colors flex items-center justify-center gap-2 shadow-sm"
                                    >
                                        <Truck size={15} /> Mark Received / Return
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Forms & Modals */}
            <JobWorkForm
                isOpen={isFormOpen}
                isModal={true}
                onClose={() => setIsFormOpen(false)}
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
                    onEdit={(c) => { setPrefillData(c); setIsFormOpen(true); }}
                    onReceive={(c) => openReceiveModal(c)}
                    onDelete={(id) => handleDelete(id)}
                />
            )}
        </div>
    );
}

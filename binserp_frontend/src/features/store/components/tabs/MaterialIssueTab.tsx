import React, { useState } from 'react';
import { Calendar, XCircle, Layers, ShoppingCart, Package, Boxes, LayoutGrid } from 'lucide-react';
import MaterialRequestTable from '../tables/MaterialRequestTable';
import MaterialIssueHistoryTable from '../tables/MaterialIssueHistoryTable';
import MaterialRequestModal from '../modals/MaterialRequestModal';
import MaterialRequestDetailsModal from '../modals/MaterialRequestDetailsModal';
import MaterialIssueDetailsModal from '../modals/MaterialIssueDetailsModal';

interface MaterialIssueTabProps {
    storeData: any;
    token: string | null;
    activeSubTab: 'requests' | 'history';
    requestTypeFilter?: 'all' | 'rm' | 'bo' | 'rm-bo' | 'consumable' | 'fg' | 'inhouse';
    title?: string;
    description?: string;
}

export default function MaterialIssueTab({ storeData, token, activeSubTab, requestTypeFilter = 'all', title, description }: MaterialIssueTabProps) {
    const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
    const [viewRequest, setViewRequest] = useState<any>(null);
    const [viewIssue, setViewIssue] = useState<any>(null);

    // Filter States for history
    const [filterType, setFilterType] = useState<'daily' | 'monthly' | 'yearly'>('daily');
    const [filterDate, setFilterDate] = useState<string>('');
    const [historyTypeFilter, setHistoryTypeFilter] = useState<'all' | 'rm' | 'bo' | 'consumable' | 'fg'>('all');

    // Destructure needed data and handlers
    const {
        materialRequests = [],
        data: issueHistory = [],
        createMaterialRequest,
        updateMaterialRequest,
        createMaterialIssue,
        rawMaterials = [],
        boughtOuts = [],
        materials = [],
        consumables = [],
        inventoryList = [],
        inHouseComponents = [],
        fgItems = [],
        salesOrders = [],
        loading
    } = storeData;

    // Filter pending requests strictly by category
    const pendingRequests = materialRequests.filter((r: any) => {
        const isPending = r.status === 'Pending' || r.status === 'Approved';
        if (!isPending) return false;

        if (!requestTypeFilter || requestTypeFilter === 'all') return true;

        const rType = (r.type || 'rm').toLowerCase();
        if (requestTypeFilter === 'consumable') return rType === 'consumable';
        if (requestTypeFilter === 'fg' || requestTypeFilter === 'inhouse') return rType === 'fg' || rType === 'inhouse';
        if (requestTypeFilter === 'bo') return rType === 'bo' || rType === 'bought-out';
        if (requestTypeFilter === 'rm') {
            return rType === 'rm' || rType === 'raw-material' || (!r.type && rType !== 'bo' && rType !== 'bought-out' && rType !== 'consumable' && rType !== 'fg' && rType !== 'inhouse');
        }
        if (requestTypeFilter === 'rm-bo') {
            return rType === 'bo' || rType === 'bought-out' || rType === 'rm' || rType === 'raw-material' || (!r.type && rType !== 'consumable' && rType !== 'fg' && rType !== 'inhouse');
        }
        return true;
    });

    // Filter History: Day-wise, Month-wise, Year-wise + Type-wise
    const filteredHistory = issueHistory?.filter((issue: any) => {
        // 1. Type filter
        if (historyTypeFilter !== 'all') {
            const iType = (issue.type || 'rm').toLowerCase();
            if (historyTypeFilter === 'consumable' && iType !== 'consumable') return false;
            if (historyTypeFilter === 'fg' && (iType !== 'fg' && iType !== 'inhouse')) return false;
            if (historyTypeFilter === 'bo' && (iType !== 'bo' && iType !== 'bought-out')) return false;
            if (historyTypeFilter === 'rm' && (iType !== 'rm' && iType !== 'raw-material' && iType !== '')) return false;
        }

        // 2. Date filter
        if (!filterDate) return true;
        const issueDate = new Date(issue.date);

        if (filterType === 'daily') {
            // Match exact day YYYY-MM-DD
            const issueDay = issueDate.toISOString().slice(0, 10);
            return issueDay === filterDate;
        } else if (filterType === 'monthly') {
            // Match Month YYYY-MM
            const issueMonth = issueDate.toISOString().slice(0, 7);
            return issueMonth === filterDate;
        } else if (filterType === 'yearly') {
            // Match Year YYYY
            const issueYear = issueDate.getFullYear().toString();
            return issueYear === filterDate;
        }
        return true;
    }) || [];

    const handleCreateRequest = async (formData: any) => {
        try {
            await createMaterialRequest(formData);
            setIsRequestModalOpen(false);
        } catch (error) {
            console.error("Create request failed", error);
        }
    };

    const handleRejectRequest = async (request: any) => {
        if (!confirm("Are you sure you want to reject this request?")) return;
        try {
            await updateMaterialRequest(request._id, { status: 'Rejected' });
        } catch (error) {
            console.error("Reject failed", error);
        }
    };

    const handleIssueRequest = async (request: any) => {
        if (!confirm(`Confirm issue of materials for Request ${request.requestNumber}? Inventory will be deducted.`)) return;

        try {
            const rType = (request.type || 'rm').toLowerCase();
            const isInhouse = rType === 'fg' || rType === 'inhouse';
            const isConsumable = rType === 'consumable';

            const issueData = {
                issueNumber: request.requestNumber.replace('REQ', 'ISS'),
                department: request.department || 'General Store',
                type: rType,
                issuedTo: request.requestedBy?._id,
                items: (request.items || []).map((item: any) => ({
                    material: item.material || (!isInhouse && !isConsumable ? item._id : undefined),
                    consumable: item.consumable || (isConsumable ? (item.material || item._id) : undefined),
                    component: item.component || item.fgItem || (isInhouse ? (item.material || item._id) : undefined),
                    fgItem: item.fgItem || (isInhouse ? (item.material || item._id) : undefined),
                    materialName: item.materialName,
                    materialCode: item.materialCode,
                    quantity: Number(item.quantity) || 1,
                    unit: item.unit || 'PCS',
                    purpose: item.purpose || ''
                })),
                date: new Date().toISOString(),
                status: 'Issued',
            };

            await createMaterialIssue(issueData);
            await updateMaterialRequest(request._id, { status: 'Issued', skipInventoryUpdate: true });

        } catch (error) {
            console.error("Issue failed", error);
            alert("Failed to issue material. Check stock or try again.");
        }
    };

    // Helper to render filter input based on type
    const renderFilterInput = () => {
        const inputClass = "w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer";
        const currentYear = new Date().getFullYear();
        const years = Array.from({ length: 6 }, (_, i) => currentYear - i);

        const months = [
            { val: '01', label: 'January' }, { val: '02', label: 'February' },
            { val: '03', label: 'March' }, { val: '04', label: 'April' },
            { val: '05', label: 'May' }, { val: '06', label: 'June' },
            { val: '07', label: 'July' }, { val: '08', label: 'August' },
            { val: '09', label: 'September' }, { val: '10', label: 'October' },
            { val: '11', label: 'November' }, { val: '12', label: 'December' }
        ];

        switch (filterType) {
            case 'daily':
                return (
                    <div className="relative w-full">
                        <input
                            type="date"
                            value={filterDate}
                            onChange={(e) => setFilterDate(e.target.value)}
                            className={inputClass}
                        />
                    </div>
                );

            case 'monthly':
                const [selYear, selMonth] = filterDate ? filterDate.split('-') : ['', ''];

                const updateMonth = (newMonth: string) => {
                    const y = selYear || currentYear.toString();
                    setFilterDate(`${y}-${newMonth}`);
                };

                const updateYear = (newYear: string) => {
                    const m = selMonth || '01';
                    setFilterDate(`${newYear}-${m}`);
                };

                return (
                    <div className="flex gap-2 w-full">
                        <div className="relative flex-1">
                            <select
                                value={selMonth}
                                onChange={(e) => updateMonth(e.target.value)}
                                className={inputClass}
                            >
                                <option value="" disabled>Month</option>
                                {months.map(m => (
                                    <option key={m.val} value={m.val}>{m.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="relative w-28">
                            <select
                                value={selYear}
                                onChange={(e) => updateYear(e.target.value)}
                                className={inputClass}
                            >
                                {years.map(year => (
                                    <option key={year} value={year}>{year}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                );

            case 'yearly':
                return (
                    <div className="relative w-full">
                        <select
                            value={filterDate}
                            onChange={(e) => setFilterDate(e.target.value)}
                            className={inputClass}
                        >
                            <option value="">Select Year</option>
                            {years.map(year => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="space-y-4">
            {/* Content Container */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
                {activeSubTab === 'requests' ? (
                    <div className="p-1">
                        <MaterialRequestTable
                            requests={pendingRequests}
                            onIssue={handleIssueRequest}
                            onReject={handleRejectRequest}
                            onView={(req) => setViewRequest(req)}
                        />
                    </div>
                ) : (
                    <div className="flex flex-col h-full">
                        {/* Day-Wise & Type-Wise Filter Bar */}
                        <div className="p-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/40 dark:bg-gray-800/40 space-y-3">
                            
                            {/* Row 1: Type-Wise Filter Chips */}
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="flex flex-wrap items-center gap-1.5 bg-gray-100/80 dark:bg-gray-800 p-1 rounded-xl">
                                    <button
                                        onClick={() => setHistoryTypeFilter('all')}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                            historyTypeFilter === 'all'
                                                ? 'bg-white dark:bg-gray-700 text-slate-900 dark:text-white shadow-xs'
                                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                        }`}
                                    >
                                        <LayoutGrid size={13} /> All Types
                                    </button>
                                    <button
                                        onClick={() => setHistoryTypeFilter('rm')}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                            historyTypeFilter === 'rm'
                                                ? 'bg-blue-600 text-white shadow-xs'
                                                : 'text-gray-600 dark:text-gray-400 hover:text-blue-600'
                                        }`}
                                    >
                                        <Layers size={13} /> Raw Materials (RM)
                                    </button>
                                    <button
                                        onClick={() => setHistoryTypeFilter('bo')}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                            historyTypeFilter === 'bo'
                                                ? 'bg-emerald-600 text-white shadow-xs'
                                                : 'text-gray-600 dark:text-gray-400 hover:text-emerald-600'
                                        }`}
                                    >
                                        <ShoppingCart size={13} /> Bought Out (BO)
                                    </button>
                                    <button
                                        onClick={() => setHistoryTypeFilter('consumable')}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                            historyTypeFilter === 'consumable'
                                                ? 'bg-amber-500 text-white shadow-xs'
                                                : 'text-gray-600 dark:text-gray-400 hover:text-amber-500'
                                        }`}
                                    >
                                        <Package size={13} /> Consumables
                                    </button>
                                    <button
                                        onClick={() => setHistoryTypeFilter('fg')}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                            historyTypeFilter === 'fg'
                                                ? 'bg-purple-600 text-white shadow-xs'
                                                : 'text-gray-600 dark:text-gray-400 hover:text-purple-600'
                                        }`}
                                    >
                                        <Boxes size={13} /> Finished Goods (FG)
                                    </button>
                                </div>

                                <div className="text-xs font-bold text-gray-500 bg-blue-50/50 dark:bg-blue-950/40 px-3 py-1.5 rounded-xl border border-blue-100 dark:border-blue-900/60 whitespace-nowrap">
                                    Total Filtered Issues: <span className="text-blue-700 dark:text-blue-300 font-black ml-1">{filteredHistory.length}</span>
                                </div>
                            </div>

                            {/* Row 2: Day-Wise / Monthly / Yearly Date Filter */}
                            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between pt-1">
                                <div className="flex items-center gap-1 bg-gray-100/80 dark:bg-gray-800 p-1 rounded-xl">
                                    {[
                                        { id: 'daily', label: 'Day-Wise / Date' },
                                        { id: 'monthly', label: 'Monthly' },
                                        { id: 'yearly', label: 'Yearly' }
                                    ].map((type) => (
                                        <button
                                            key={type.id}
                                            onClick={() => { setFilterType(type.id as any); setFilterDate(''); }}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                                                filterType === type.id
                                                    ? 'bg-white dark:bg-gray-700 text-blue-700 dark:text-blue-300 shadow-xs'
                                                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                                            }`}
                                        >
                                            {type.label}
                                        </button>
                                    ))}
                                </div>

                                <div className="relative w-full sm:max-w-xs flex items-center gap-2">
                                    <div className="hidden sm:flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-500 shrink-0">
                                        <Calendar size={16} />
                                    </div>
                                    {renderFilterInput()}

                                    {filterDate && (
                                        <button
                                            onClick={() => setFilterDate('')}
                                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors cursor-pointer shrink-0"
                                            title="Clear date filter"
                                        >
                                            <XCircle size={18} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Table Area */}
                        <MaterialIssueHistoryTable
                            issues={filteredHistory}
                            onView={(issue) => setViewIssue(issue)}
                        />
                    </div>
                )}
            </div>

            {/* Modals */}
            <MaterialRequestModal
                isOpen={isRequestModalOpen}
                onClose={() => setIsRequestModalOpen(false)}
                onSubmit={handleCreateRequest}
                rawMaterials={rawMaterials}
                boughtOuts={boughtOuts}
                materials={materials}
                consumables={consumables}
                fgItems={fgItems}
                inventoryList={inventoryList}
                loading={loading}
                inHouseComponents={inHouseComponents}
                salesOrders={salesOrders}
                defaultType={requestTypeFilter === 'all' ? 'rm' : (requestTypeFilter as any)}
            />

            <MaterialRequestDetailsModal
                isOpen={!!viewRequest}
                onClose={() => setViewRequest(null)}
                request={viewRequest}
            />

            <MaterialIssueDetailsModal
                isOpen={!!viewIssue}
                onClose={() => setViewIssue(null)}
                issue={viewIssue}
            />
        </div>
    );
}

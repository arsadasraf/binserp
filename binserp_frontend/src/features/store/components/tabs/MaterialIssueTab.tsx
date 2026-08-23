import React, { useState, useMemo } from 'react';
import { Search, Calendar, XCircle, Filter, Package } from 'lucide-react';
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
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [historyTypeFilter, setHistoryTypeFilter] = useState<'all' | 'rm' | 'bo' | 'consumable' | 'fg'>('all');
    const [filterType, setFilterType] = useState<'daily' | 'monthly' | 'yearly'>('daily');
    const [filterDate, setFilterDate] = useState<string>('');

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
    const pendingRequests = useMemo(() => {
        return (materialRequests || []).filter((r: any) => {
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
    }, [materialRequests, requestTypeFilter]);

    // Filter History: Search + Type-wise Dropdown + Day-wise / Month-wise / Year-wise Date
    const filteredHistory = useMemo(() => {
        return (issueHistory || []).filter((issue: any) => {
            // 1. Text Search Filter (Issue #, Material Name, Code, Issued To, Department)
            if (searchQuery.trim()) {
                const query = searchQuery.toLowerCase().trim();
                const issueNo = (issue.issueNumber || '').toLowerCase();
                const dept = (issue.department || '').toLowerCase();
                const receiver = (typeof issue.issuedTo === 'object' ? issue.issuedTo?.name : issue.issuedTo || '').toLowerCase();
                const matchesItem = Array.isArray(issue.items) && issue.items.some((item: any) => {
                    const name = (item.materialName || '').toLowerCase();
                    const code = (item.materialCode || '').toLowerCase();
                    const purpose = (item.purpose || '').toLowerCase();
                    return name.includes(query) || code.includes(query) || purpose.includes(query);
                });

                const matchesGeneral = issueNo.includes(query) || dept.includes(query) || receiver.includes(query);
                if (!matchesGeneral && !matchesItem) return false;
            }

            // 2. Type Dropdown Filter
            if (historyTypeFilter !== 'all') {
                const iType = (issue.type || 'rm').toLowerCase();
                if (historyTypeFilter === 'consumable' && iType !== 'consumable') return false;
                if (historyTypeFilter === 'fg' && (iType !== 'fg' && iType !== 'inhouse')) return false;
                if (historyTypeFilter === 'bo' && (iType !== 'bo' && iType !== 'bought-out')) return false;
                if (historyTypeFilter === 'rm' && (iType !== 'rm' && iType !== 'raw-material' && iType !== '')) return false;
            }

            // 3. Date Filter (Day, Month, Year)
            if (!filterDate) return true;
            const issueDate = new Date(issue.date);

            if (filterType === 'daily') {
                const issueDay = issueDate.toISOString().slice(0, 10);
                return issueDay === filterDate;
            } else if (filterType === 'monthly') {
                const issueMonth = issueDate.toISOString().slice(0, 7);
                return issueMonth === filterDate;
            } else if (filterType === 'yearly') {
                const issueYear = issueDate.getFullYear().toString();
                return issueYear === filterDate;
            }
            return true;
        });
    }, [issueHistory, searchQuery, historyTypeFilter, filterType, filterDate]);

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
                mrpPlan: request.mrpPlan || undefined,
                mrpNumber: request.mrpNumber || undefined,
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
        const inputClass = "h-9 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer";
        const currentYear = new Date().getFullYear();
        const years = Array.from({ length: 6 }, (_, i) => currentYear - i);

        const months = [
            { val: '01', label: 'Jan' }, { val: '02', label: 'Feb' },
            { val: '03', label: 'Mar' }, { val: '04', label: 'Apr' },
            { val: '05', label: 'May' }, { val: '06', label: 'Jun' },
            { val: '07', label: 'Jul' }, { val: '08', label: 'Aug' },
            { val: '09', label: 'Sep' }, { val: '10', label: 'Oct' },
            { val: '11', label: 'Nov' }, { val: '12', label: 'Dec' }
        ];

        switch (filterType) {
            case 'daily':
                return (
                    <input
                        type="date"
                        value={filterDate}
                        onChange={(e) => setFilterDate(e.target.value)}
                        className={inputClass}
                    />
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
                    <div className="flex items-center gap-1.5">
                        <select
                            value={selMonth}
                            onChange={(e) => updateMonth(e.target.value)}
                            className={`${inputClass} w-20`}
                        >
                            <option value="" disabled>Month</option>
                            {months.map(m => (
                                <option key={m.val} value={m.val}>{m.label}</option>
                            ))}
                        </select>
                        <select
                            value={selYear}
                            onChange={(e) => updateYear(e.target.value)}
                            className={`${inputClass} w-20`}
                        >
                            {years.map(year => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>
                    </div>
                );

            case 'yearly':
                return (
                    <select
                        value={filterDate}
                        onChange={(e) => setFilterDate(e.target.value)}
                        className={`${inputClass} w-28`}
                    >
                        <option value="">Select Year</option>
                        {years.map(year => (
                            <option key={year} value={year}>{year}</option>
                        ))}
                    </select>
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
                        {/* Unified Single-Line Filter Toolbar for Issue History */}
                        <div className="p-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40">
                            <div className="flex flex-wrap items-center justify-between gap-2.5">
                                
                                {/* Left Section: Search Input + Type Dropdown */}
                                <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[300px]">
                                    {/* Search Bar */}
                                    <div className="relative flex-1 min-w-[200px] max-w-sm">
                                        <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Search Issue #, material, person, dept..."
                                            className="w-full h-9 pl-9 pr-7 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder-gray-400"
                                        />
                                        {searchQuery && (
                                            <button
                                                onClick={() => setSearchQuery('')}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 cursor-pointer"
                                            >
                                                <XCircle size={14} />
                                            </button>
                                        )}
                                    </div>

                                    {/* Type Dropdown */}
                                    <div className="relative">
                                        <select
                                            value={historyTypeFilter}
                                            onChange={(e) => setHistoryTypeFilter(e.target.value as any)}
                                            className="h-9 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                                        >
                                            <option value="all">📦 All Inventory Types</option>
                                            <option value="rm">🔵 Raw Materials (RM)</option>
                                            <option value="bo">🟢 Bought Out (BO)</option>
                                            <option value="consumable">🟡 Consumables</option>
                                            <option value="fg">🟣 Finished Goods (FG)</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Right Section: Date Mode Switcher + Date Picker + Count Badge */}
                                <div className="flex flex-wrap items-center gap-2 shrink-0">
                                    {/* Daily / Monthly / Yearly Switcher */}
                                    <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
                                        {[
                                            { id: 'daily', label: 'Day' },
                                            { id: 'monthly', label: 'Month' },
                                            { id: 'yearly', label: 'Year' }
                                        ].map((type) => (
                                            <button
                                                key={type.id}
                                                onClick={() => { setFilterType(type.id as any); setFilterDate(''); }}
                                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                                    filterType === type.id
                                                        ? 'bg-white dark:bg-gray-700 text-blue-700 dark:text-blue-300 shadow-xs'
                                                        : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                                                }`}
                                            >
                                                {type.label}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Dynamic Date Selector */}
                                    <div className="flex items-center gap-1.5">
                                        {renderFilterInput()}
                                        {filterDate && (
                                            <button
                                                onClick={() => setFilterDate('')}
                                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition-colors cursor-pointer"
                                                title="Clear date filter"
                                            >
                                                <XCircle size={16} />
                                            </button>
                                        )}
                                    </div>

                                    {/* Total Count Badge */}
                                    <div className="h-9 px-3 flex items-center text-xs font-bold text-gray-600 dark:text-gray-300 bg-blue-50/70 dark:bg-blue-950/40 rounded-xl border border-blue-100 dark:border-blue-900/60 whitespace-nowrap">
                                        Total: <span className="text-blue-700 dark:text-blue-300 font-black ml-1.5">{filteredHistory.length}</span>
                                    </div>
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

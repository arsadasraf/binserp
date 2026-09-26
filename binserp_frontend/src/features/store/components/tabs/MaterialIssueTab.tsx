import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, Calendar, XCircle, Filter, Package, Layers, ShoppingCart, Boxes, ChevronDown, Check, SlidersHorizontal } from 'lucide-react';
import MaterialRequestTable from '../tables/MaterialRequestTable';
import MaterialIssueHistoryTable, { resolveIssueType } from '../tables/MaterialIssueHistoryTable';
import MaterialRequestModal from '../modals/MaterialRequestModal';
import MaterialRequestDetailsModal from '../modals/MaterialRequestDetailsModal';
import MaterialIssueDetailsModal from '../modals/MaterialIssueDetailsModal';

export type RequestTypeOption = 'rm' | 'bo' | 'consumable' | 'fg';

export const REQUEST_TYPE_CONFIG: {
    key: RequestTypeOption;
    label: string;
    shortLabel: string;
    badgeColor: string;
    dotColor: string;
    icon: any;
}[] = [
    { key: 'rm', label: 'Raw Materials (RM)', shortLabel: 'RM', badgeColor: 'bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 border-blue-200 dark:border-blue-800', dotColor: 'bg-blue-600', icon: Layers },
    { key: 'bo', label: 'Bought Out (BO)', shortLabel: 'BO', badgeColor: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800', dotColor: 'bg-emerald-600', icon: ShoppingCart },
    { key: 'consumable', label: 'Consumables', shortLabel: 'Consumables', badgeColor: 'bg-amber-50 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300 border-amber-200 dark:border-amber-800', dotColor: 'bg-amber-500', icon: Package },
    { key: 'fg', label: 'Finished Goods / FG', shortLabel: 'FG / In-House', badgeColor: 'bg-purple-50 text-purple-700 dark:bg-purple-950/70 dark:text-purple-300 border-purple-200 dark:border-purple-800', dotColor: 'bg-purple-600', icon: Boxes },
];

export function normalizeRequestType(r: any): RequestTypeOption {
    const rType = (r?.type || 'rm').toLowerCase();
    if (rType === 'consumable') return 'consumable';
    if (rType === 'fg' || rType === 'inhouse') return 'fg';
    if (rType === 'bo' || rType === 'bought-out') return 'bo';
    return 'rm';
}

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

    // Filter States for requests
    const [requestSearchQuery, setRequestSearchQuery] = useState<string>('');
    const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
    const typeDropdownRef = useRef<HTMLDivElement>(null);

    const [selectedRequestTypes, setSelectedRequestTypes] = useState<RequestTypeOption[]>(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const typesParam = params.get('types') || params.get('type');
            if (typesParam) {
                const split = typesParam.split(',').map(s => s.trim().toLowerCase());
                const matched = split.map(t => {
                    if (t === 'inhouse') return 'fg';
                    if (t === 'bought-out') return 'bo';
                    if (t === 'raw-material') return 'rm';
                    return t;
                }).filter((t): t is RequestTypeOption => ['rm', 'bo', 'consumable', 'fg'].includes(t as any));
                if (matched.length > 0) return matched;
            }
        }
        if (requestTypeFilter && requestTypeFilter !== 'all') {
            if (requestTypeFilter === 'inhouse') return ['fg'];
            if (requestTypeFilter === 'rm-bo') return ['rm', 'bo'];
            return [requestTypeFilter as RequestTypeOption];
        }
        return ['rm', 'bo', 'consumable', 'fg'];
    });

    // Close type dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (typeDropdownRef.current && !typeDropdownRef.current.contains(event.target as Node)) {
                setIsTypeDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

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

    // Counts per category for pending requests
    const typeCounts = useMemo(() => {
        const counts: Record<RequestTypeOption, number> = { rm: 0, bo: 0, consumable: 0, fg: 0 };
        (materialRequests || []).forEach((r: any) => {
            if (r.status === 'Pending' || r.status === 'Approved') {
                const t = normalizeRequestType(r);
                counts[t] = (counts[t] || 0) + 1;
            }
        });
        return counts;
    }, [materialRequests]);

    const totalPendingCount = useMemo(() => {
        return (materialRequests || []).filter((r: any) => r.status === 'Pending' || r.status === 'Approved').length;
    }, [materialRequests]);

    const toggleRequestType = (typeKey: RequestTypeOption) => {
        setSelectedRequestTypes(prev => {
            if (prev.includes(typeKey)) {
                // If removing would make it empty, keep at least this or allow empty
                return prev.filter(t => t !== typeKey);
            } else {
                return [...prev, typeKey];
            }
        });
    };

    const selectAllTypes = () => {
        setSelectedRequestTypes(['rm', 'bo', 'consumable', 'fg']);
    };

    const clearAllTypes = () => {
        setSelectedRequestTypes([]);
    };

    const getTypeDropdownLabel = () => {
        if (selectedRequestTypes.length === 4) return 'All Types (4)';
        if (selectedRequestTypes.length === 0) return 'No Types (0)';
        if (selectedRequestTypes.length === 1) {
            const conf = REQUEST_TYPE_CONFIG.find(c => c.key === selectedRequestTypes[0]);
            return conf ? conf.shortLabel : '1 Type';
        }
        return `Types: ${selectedRequestTypes.map(k => {
            const conf = REQUEST_TYPE_CONFIG.find(c => c.key === k);
            return conf ? conf.shortLabel : k;
        }).join(', ')} (${selectedRequestTypes.length})`;
    };

    // Filter pending requests strictly by multiple selected types and search
    const pendingRequests = useMemo(() => {
        return (materialRequests || []).filter((r: any) => {
            const isPending = r.status === 'Pending' || r.status === 'Approved';
            if (!isPending) return false;

            const normType = normalizeRequestType(r);
            if (selectedRequestTypes.length > 0 && !selectedRequestTypes.includes(normType)) {
                return false;
            }
            if (selectedRequestTypes.length === 0) {
                return false;
            }

            if (requestSearchQuery.trim()) {
                const query = requestSearchQuery.toLowerCase().trim();
                const reqNo = (r.requestNumber || '').toLowerCase();
                const targetNo = (r.mrpNumber || r.soNumber || r.salesOrder?.orderNumber || '').toLowerCase();
                const requester = (typeof r.requestedBy === 'object' ? r.requestedBy?.name : r.requestedBy || r.createdByName || '').toLowerCase();
                const dept = (r.department || '').toLowerCase();
                const matchesItems = Array.isArray(r.items) && r.items.some((it: any) => {
                    const name = (it.materialName || it.name || '').toLowerCase();
                    const desc = (it.description || it.descriptions || it.materialDescription || '').toLowerCase();
                    return name.includes(query) || desc.includes(query);
                });
                const matches = reqNo.includes(query) || targetNo.includes(query) || requester.includes(query) || dept.includes(query) || matchesItems;
                if (!matches) return false;
            }

            return true;
        });
    }, [materialRequests, selectedRequestTypes, requestSearchQuery]);

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
                const resolved = resolveIssueType(issue);
                if (historyTypeFilter !== resolved.typeKey) {
                    return false;
                }
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

            // Generate clean issueNumber (replace REQ, PR, MR with ISS, or fallback to ISS-<timestamp>)
            let issueNum = request.requestNumber
                ? request.requestNumber.replace(/^(REQ|PR|MR)-?/i, 'ISS-')
                : `ISS-${Date.now()}`;
            if (issueNum === request.requestNumber) {
                issueNum = `ISS-${request.requestNumber}`;
            }

            const issuedToId = typeof request.requestedBy === 'object'
                ? (request.requestedBy?._id || request.requestedBy?.id)
                : request.requestedBy;

            const issueData = {
                issueNumber: issueNum,
                department: request.department || 'General Store',
                type: rType,
                issuedTo: issuedToId || undefined,
                mrpPlan: typeof request.mrpPlan === 'object' ? request.mrpPlan?._id : request.mrpPlan || undefined,
                mrpNumber: request.mrpNumber || undefined,
                materialRequest: request._id,
                requestNumber: request.requestNumber,
                items: (request.items || []).map((item: any) => {
                    const masterId = item.material?._id || item.material || item.consumable?._id || item.consumable || item.component?._id || item.component || item.fgItem?._id || item.fgItem;
                    const hasSec = Boolean(item.hasSecondaryUnit);
                    const secUnit = item.secondaryUnit || '';
                    const convFactor = Number(item.conversionFactor) || 0;
                    const priQty = Number(item.quantity) || 1;
                    const secQty = hasSec ? Number(item.secondaryQuantity || (priQty * convFactor)) : 0;

                    return {
                        material: !isInhouse && !isConsumable ? masterId : undefined,
                        consumable: isConsumable ? masterId : undefined,
                        component: isInhouse ? masterId : undefined,
                        fgItem: isInhouse ? masterId : undefined,
                        materialRequestItemId: item._id,
                        requestedQuantity: priQty,
                        materialName: item.materialName || item.name || '',
                        materialCode: item.materialCode || item.code || '',
                        quantity: priQty,
                        unit: item.unit || 'PCS',
                        hasSecondaryUnit: hasSec,
                        secondaryUnit: secUnit,
                        conversionFactor: convFactor,
                        secondaryQuantity: secQty,
                        purpose: item.purpose || ''
                    };
                }),
                date: new Date().toISOString(),
                status: 'Issued',
            };

            await createMaterialIssue(issueData);
            await updateMaterialRequest(request._id, { status: 'Issued', skipInventoryUpdate: true });

        } catch (error: any) {
            console.error("Issue failed", error);
            const errorMsg = error?.data?.message || error?.response?.data?.message || error?.message || "Failed to issue material. Check stock or try again.";
            alert(errorMsg);
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
        <div className="space-y-4 flex-1 min-h-0 flex flex-col">
            {/* Content Container */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col flex-1 min-h-0 overflow-hidden">
                {activeSubTab === 'requests' ? (
                    <div className="flex flex-col h-full flex-1 min-h-0">
                        {/* Header & Filter Bar for Requests */}
                        <div className="p-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40 shrink-0">
                            <div className="flex flex-wrap items-center justify-between gap-2.5">
                                <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[260px]">
                                    {/* Search Bar */}
                                    <div className="relative flex-1 min-w-[180px] max-w-sm">
                                        <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                        <input
                                            type="text"
                                            value={requestSearchQuery}
                                            onChange={(e) => setRequestSearchQuery(e.target.value)}
                                            placeholder="Search Request #, SO/MRP, material, requester..."
                                            className="w-full h-9 pl-9 pr-7 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder-gray-400"
                                        />
                                        {requestSearchQuery && (
                                            <button
                                                onClick={() => setRequestSearchQuery('')}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 cursor-pointer"
                                            >
                                                <XCircle size={14} />
                                            </button>
                                        )}
                                    </div>

                                    {/* Multi-Select Request Type Dropdown */}
                                    <div className="relative" ref={typeDropdownRef}>
                                        <button
                                            type="button"
                                            onClick={() => setIsTypeDropdownOpen(!isTypeDropdownOpen)}
                                            className="h-9 px-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-750 flex items-center gap-2 cursor-pointer transition-colors shadow-2xs"
                                        >
                                            <Filter size={13} className="text-gray-400" />
                                            <span>{getTypeDropdownLabel()}</span>
                                            <div className="flex items-center -space-x-1 ml-0.5">
                                                {selectedRequestTypes.map(k => {
                                                    const conf = REQUEST_TYPE_CONFIG.find(c => c.key === k);
                                                    return conf ? <span key={k} className={`w-2 h-2 rounded-full ring-1 ring-white dark:ring-gray-800 ${conf.dotColor}`} /> : null;
                                                })}
                                            </div>
                                            <ChevronDown size={14} className={`text-gray-400 transition-transform ${isTypeDropdownOpen ? 'rotate-180' : ''}`} />
                                        </button>

                                        {isTypeDropdownOpen && (
                                            <div className="absolute left-0 mt-1.5 w-64 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl z-50 p-2 animate-in fade-in slide-in-from-top-2 duration-150">
                                                <div className="flex items-center justify-between px-2 py-1.5 border-b border-gray-100 dark:border-gray-800 mb-1">
                                                    <span className="text-[11px] font-extrabold text-gray-500 uppercase tracking-wider">Request Types</span>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={selectAllTypes}
                                                            className="text-[11px] font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
                                                        >
                                                            Select All
                                                        </button>
                                                        <span className="text-gray-300">|</span>
                                                        <button
                                                            type="button"
                                                            onClick={clearAllTypes}
                                                            className="text-[11px] font-bold text-gray-400 hover:text-gray-600 cursor-pointer"
                                                        >
                                                            Clear
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="space-y-0.5">
                                                    {REQUEST_TYPE_CONFIG.map((conf) => {
                                                        const isSelected = selectedRequestTypes.includes(conf.key);
                                                        const count = typeCounts[conf.key] || 0;
                                                        const Icon = conf.icon;
                                                        return (
                                                            <button
                                                                key={conf.key}
                                                                type="button"
                                                                onClick={() => toggleRequestType(conf.key)}
                                                                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                                                                    isSelected ? 'bg-blue-50/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                                                                }`}
                                                            >
                                                                <div className="flex items-center gap-2.5">
                                                                    <div className={`w-4 h-4 rounded-md flex items-center justify-center border transition-colors ${
                                                                        isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'
                                                                    }`}>
                                                                        {isSelected && <Check size={11} strokeWidth={3} />}
                                                                    </div>
                                                                    <Icon size={14} className={conf.dotColor.replace('bg-', 'text-')} />
                                                                    <span>{conf.label}</span>
                                                                </div>
                                                                <span className="text-[11px] font-bold px-1.5 py-0.2 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-500">
                                                                    {count}
                                                                </span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-xs font-bold text-slate-500">Showing:</span>
                                    <span className="px-2.5 py-1 rounded-lg text-xs font-extrabold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                        {pendingRequests.length} of {totalPendingCount} Requests
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="p-1 flex-1 min-h-0 flex flex-col">
                            <MaterialRequestTable
                                requests={pendingRequests}
                                onIssue={handleIssueRequest}
                                onReject={handleRejectRequest}
                                onView={(req) => setViewRequest(req)}
                            />
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col h-full flex-1 min-h-0">
                        {/* Unified Single-Line Filter Toolbar for Issue History */}
                        <div className="p-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40 shrink-0">
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
                        <div className="p-1 flex-1 min-h-0 flex flex-col">
                            <MaterialIssueHistoryTable
                                issues={filteredHistory}
                                onView={(issue) => setViewIssue(issue)}
                            />
                        </div>
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

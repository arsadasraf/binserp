import React, { useState, useMemo, useRef, useEffect } from 'react';
import { FileText, ClipboardList, Filter, X, Search, Check, RotateCcw } from 'lucide-react';

export function resolveIssueType(issue: any): {
    typeKey: 'rm' | 'bo' | 'consumable' | 'fg';
    label: string;
    shortLabel: string;
    badgeClass: string;
} {
    let rawType = (issue?.type || '').toString().trim().toLowerCase();

    // If rawType is generic, check items to disambiguate
    if (!rawType || rawType === 'rm-bo' || rawType === 'general' || rawType === 'store') {
        const firstItem = issue?.items?.[0];
        const itemType = (firstItem?.itemType || firstItem?.material?.itemType || firstItem?.category || '').toString().toLowerCase();
        const code = (firstItem?.materialCode || firstItem?.material?.code || '').toString().toUpperCase();

        if (itemType.includes('bought') || itemType === 'bo' || code.startsWith('BO-')) {
            rawType = 'bo';
        } else if (itemType.includes('consumable') || firstItem?.consumable) {
            rawType = 'consumable';
        } else if (itemType.includes('fg') || itemType.includes('inhouse') || itemType.includes('component') || firstItem?.fgItem || firstItem?.component) {
            rawType = 'fg';
        } else {
            rawType = 'rm';
        }
    }

    if (rawType === 'bo' || rawType === 'bought-out' || rawType === 'bought out') {
        return {
            typeKey: 'bo',
            label: 'Bought Out (BO)',
            shortLabel: 'BO',
            badgeClass: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
        };
    }

    if (rawType === 'consumable') {
        return {
            typeKey: 'consumable',
            label: 'Consumable',
            shortLabel: 'Consumable',
            badgeClass: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
        };
    }

    if (rawType === 'fg' || rawType === 'inhouse' || rawType === 'finished-goods' || rawType === 'finished goods') {
        return {
            typeKey: 'fg',
            label: 'Finished Goods (FG)',
            shortLabel: 'FG',
            badgeClass: 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
        };
    }

    // Default is Raw Material (RM)
    return {
        typeKey: 'rm',
        label: 'Raw Material (RM)',
        shortLabel: 'RM',
        badgeClass: 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
    };
}

export function formatDateTime(dateStr: any): string {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '-';
    const dateFormatted = d.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
    const timeFormatted = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    return `${dateFormatted}, ${timeFormatted}`;
}

interface MaterialIssueHistoryTableProps {
    issues: any[];
    onView?: (issue: any) => void;
}

export default function MaterialIssueHistoryTable({ issues, onView }: MaterialIssueHistoryTableProps) {
    // Excel-style column filter states
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
    const [dropdownSearch, setDropdownSearch] = useState<string>('');
    const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setActiveDropdown(null);
                setDropdownSearch('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Extract raw string values for each column from an issue object
    const getColumnValue = (issue: any, colKey: string): string => {
        switch (colKey) {
            case 'issueNumber':
                return issue.issueNumber || 'N/A';
            case 'type':
                return resolveIssueType(issue).label;
            case 'date':
                return issue.date ? new Date(issue.date).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';
            case 'department':
                return issue.department || 'General Store';
            case 'issuedTo':
                return typeof issue.issuedTo === 'object' ? (issue.issuedTo?.name || 'Unknown') : (issue.issuedTo || 'Unknown');
            case 'items':
                return issue.items && issue.items.length > 0 ? (issue.items[0]?.materialName || 'Material') : 'Empty';
            case 'issuedBy':
                return typeof issue.issuedBy === 'object' ? (issue.issuedBy?.name || issue.issuedBy?.username || 'System') : (issue.issuedBy || 'System');
            case 'status':
                return issue.status || 'Issued';
            default:
                return '';
        }
    };

    // Compute distinct values per column
    const columnUniqueValues = useMemo(() => {
        const result: Record<string, string[]> = {
            issueNumber: [],
            type: [],
            date: [],
            department: [],
            issuedTo: [],
            items: [],
            issuedBy: [],
            status: []
        };

        (issues || []).forEach((issue) => {
            Object.keys(result).forEach((key) => {
                const val = getColumnValue(issue, key);
                if (val && !result[key].includes(val)) {
                    result[key].push(val);
                }
            });
        });

        // Sort unique values
        Object.keys(result).forEach((key) => {
            result[key].sort((a, b) => a.localeCompare(b));
        });

        return result;
    }, [issues]);

    // Filter issues by column filters
    const filteredIssues = useMemo(() => {
        return (issues || []).filter((issue) => {
            for (const [colKey, selectedValues] of Object.entries(columnFilters)) {
                if (selectedValues && selectedValues.length > 0) {
                    const rowVal = getColumnValue(issue, colKey);
                    if (!selectedValues.includes(rowVal)) {
                        return false;
                    }
                }
            }
            return true;
        });
    }, [issues, columnFilters]);

    const handleToggleFilterValue = (colKey: string, value: string) => {
        setColumnFilters((prev) => {
            const currentSelected = prev[colKey] || [];
            let updated: string[];
            if (currentSelected.includes(value)) {
                updated = currentSelected.filter((v) => v !== value);
            } else {
                updated = [...currentSelected, value];
            }

            if (updated.length === 0) {
                const copy = { ...prev };
                delete copy[colKey];
                return copy;
            }
            return { ...prev, [colKey]: updated };
        });
    };

    const handleSelectAll = (colKey: string, allValues: string[]) => {
        setColumnFilters((prev) => {
            const currentSelected = prev[colKey] || [];
            // If already all selected, clear filter
            if (currentSelected.length === allValues.length) {
                const copy = { ...prev };
                delete copy[colKey];
                return copy;
            }
            // Otherwise select all
            return { ...prev, [colKey]: [...allValues] };
        });
    };

    const handleClearColumnFilter = (colKey: string) => {
        setColumnFilters((prev) => {
            const copy = { ...prev };
            delete copy[colKey];
            return copy;
        });
    };

    const handleClearAllFilters = () => {
        setColumnFilters({});
        setActiveDropdown(null);
        setDropdownSearch('');
    };

    const activeFilterCount = Object.keys(columnFilters).length;

    // Excel Column Header with Filter Dropdown
    const renderColumnHeader = (colKey: string, title: string, align: 'left' | 'center' | 'right' = 'left') => {
        const isFiltered = !!columnFilters[colKey] && columnFilters[colKey].length > 0;
        const isOpen = activeDropdown === colKey;
        const allValues = columnUniqueValues[colKey] || [];
        const filteredDropdownValues = allValues.filter((v) =>
            v.toLowerCase().includes(dropdownSearch.toLowerCase().trim())
        );
        const selectedValues = columnFilters[colKey] || [];
        const isAllSelected = selectedValues.length === allValues.length && allValues.length > 0;

        return (
            <th className={`px-4 py-3.5 text-${align} text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider relative select-none`}>
                <div className="flex items-center gap-1.5 justify-between group">
                    <span className="font-bold">{title}</span>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (isOpen) {
                                setActiveDropdown(null);
                                setDropdownSearch('');
                            } else {
                                setActiveDropdown(colKey);
                                setDropdownSearch('');
                            }
                        }}
                        className={`p-1 rounded-md transition-all cursor-pointer ${
                            isFiltered
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                        title={`Filter by ${title}`}
                    >
                        <Filter size={12} className={isFiltered ? 'fill-current' : ''} />
                    </button>
                </div>

                {/* Dropdown Popover */}
                {isOpen && (
                    <div
                        ref={dropdownRef}
                        onClick={(e) => e.stopPropagation()}
                        className="absolute left-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-3 z-50 normal-case font-normal text-left animate-in fade-in zoom-in-95 duration-150"
                        style={{ minWidth: '220px' }}
                    >
                        {/* Search in Dropdown */}
                        <div className="relative mb-2">
                            <Search size={12} className="absolute left-2.5 top-2.5 text-gray-400" />
                            <input
                                type="text"
                                placeholder={`Search ${title}...`}
                                value={dropdownSearch}
                                onChange={(e) => setDropdownSearch(e.target.value)}
                                className="w-full pl-7 pr-2 py-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-800 dark:text-gray-200"
                                autoFocus
                            />
                        </div>

                        {/* Select All Toggle */}
                        <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-gray-100 dark:border-gray-700 text-xs">
                            <label className="flex items-center gap-2 cursor-pointer text-gray-700 dark:text-gray-300 font-semibold">
                                <input
                                    type="checkbox"
                                    checked={isAllSelected}
                                    onChange={() => handleSelectAll(colKey, allValues)}
                                    className="rounded text-blue-600 focus:ring-0 cursor-pointer"
                                />
                                <span>(Select All)</span>
                            </label>
                            {isFiltered && (
                                <button
                                    onClick={() => handleClearColumnFilter(colKey)}
                                    className="text-[10px] text-rose-600 dark:text-rose-400 font-bold hover:underline cursor-pointer"
                                >
                                    Clear
                                </button>
                            )}
                        </div>

                        {/* List of Unique Values */}
                        <div className="max-h-44 overflow-y-auto space-y-1 pr-1 text-xs">
                            {filteredDropdownValues.length === 0 ? (
                                <div className="p-2 text-center text-gray-400 text-xs">No matching values</div>
                            ) : (
                                filteredDropdownValues.map((val) => {
                                    const isChecked = selectedValues.includes(val);
                                    return (
                                        <label
                                            key={val}
                                            className="flex items-center gap-2 px-1.5 py-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-gray-800 dark:text-gray-200 text-xs truncate"
                                            title={val}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={() => handleToggleFilterValue(colKey, val)}
                                                className="rounded text-blue-600 focus:ring-0 cursor-pointer"
                                            />
                                            <span className="truncate">{val}</span>
                                        </label>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}
            </th>
        );
    };

    if (!issues || issues.length === 0) {
        return (
            <div className="text-center py-12 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                <div className="bg-gray-50 dark:bg-gray-800 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <ClipboardList className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">No Issue History</h3>
                <p className="text-gray-500 text-sm mt-1">Material issues will appear here once processed.</p>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
            {/* Active Column Filters Banner */}
            {activeFilterCount > 0 && (
                <div className="px-4 py-2.5 bg-blue-50 dark:bg-blue-950/40 border-b border-blue-100 dark:border-blue-900/50 flex items-center justify-between text-xs animate-in fade-in">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                            <Filter size={13} className="text-blue-600" />
                            Active Column Filters ({activeFilterCount}):
                        </span>
                        {Object.entries(columnFilters).map(([k, vals]) => (
                            <span
                                key={k}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 font-semibold text-[11px]"
                            >
                                <span className="capitalize">{k}</span>: {vals.length} selected
                                <button
                                    onClick={() => handleClearColumnFilter(k)}
                                    className="hover:text-red-500 cursor-pointer ml-0.5"
                                >
                                    <X size={11} />
                                </button>
                            </span>
                        ))}
                    </div>
                    <button
                        onClick={handleClearAllFilters}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                    >
                        <RotateCcw size={12} /> Clear All Filters
                    </button>
                </div>
            )}

            {/* Desktop Table View with Excel Column Filters */}
            <div className="hidden md:block overflow-x-auto min-h-[350px]">
                <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-800 text-left border-collapse">
                    <thead className="bg-gray-50/80 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-800">
                        <tr>
                            {renderColumnHeader('issueNumber', 'Issue #')}
                            {renderColumnHeader('type', 'Type')}
                            {renderColumnHeader('date', 'Date & Time')}
                            {renderColumnHeader('department', 'Department')}
                            {renderColumnHeader('issuedTo', 'Issued To')}
                            {renderColumnHeader('items', 'Items Summary')}
                            {renderColumnHeader('issuedBy', 'Issued By')}
                            {renderColumnHeader('status', 'Status')}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
                        {filteredIssues.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="p-12 text-center text-gray-400 text-xs">
                                    No records match the active column filter criteria.{' '}
                                    <button
                                        onClick={handleClearAllFilters}
                                        className="text-blue-600 dark:text-blue-400 font-bold underline cursor-pointer"
                                    >
                                        Clear filters
                                    </button>
                                </td>
                            </tr>
                        ) : (
                            filteredIssues.map((issue) => {
                                const typeInfo = resolveIssueType(issue);

                                return (
                                    <tr
                                        key={issue._id}
                                        onClick={() => onView && onView(issue)}
                                        className="hover:bg-gray-50/80 dark:hover:bg-gray-800/50 transition-colors cursor-pointer active:bg-gray-100"
                                    >
                                        <td className="px-4 py-3.5 whitespace-nowrap text-xs font-bold text-gray-900 dark:text-gray-100 font-mono">
                                            {issue.issueNumber}
                                        </td>
                                        <td className="px-4 py-3.5 whitespace-nowrap">
                                            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${typeInfo.badgeClass}`}>
                                                {typeInfo.label}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3.5 whitespace-nowrap text-xs text-gray-600 dark:text-gray-300 font-mono">
                                            {formatDateTime(issue.date)}
                                        </td>
                                        <td className="px-4 py-3.5 whitespace-nowrap text-xs font-medium text-gray-700 dark:text-gray-300">
                                            {issue.department || 'General Store'}
                                        </td>
                                        <td className="px-4 py-3.5 whitespace-nowrap text-xs font-semibold text-gray-900 dark:text-gray-100">
                                            {issue.issuedTo?.name || (typeof issue.issuedTo === 'string' ? issue.issuedTo : 'Unknown')}
                                        </td>
                                        <td className="px-4 py-3.5 text-xs text-gray-600 dark:text-gray-300">
                                            <div className="max-w-xs truncate">
                                                {issue.items?.length > 0 ? (
                                                    <>
                                                        <span className="font-bold text-gray-900 dark:text-white">{issue.items[0].materialName}</span>
                                                        <span className="text-gray-400 text-xs ml-1 font-mono">({issue.items[0].quantity} {issue.items[0].unit})</span>
                                                        {issue.items.length > 1 && (
                                                            <span className="text-blue-600 dark:text-blue-400 text-xs font-bold ml-1">
                                                                +{issue.items.length - 1} more
                                                            </span>
                                                        )}
                                                    </>
                                                ) : '-'}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3.5 whitespace-nowrap text-xs font-bold text-indigo-600 dark:text-indigo-400">
                                            {issue.issuedBy?.name || issue.issuedBy?.username || (typeof issue.issuedBy === 'string' ? issue.issuedBy : 'System')}
                                        </td>
                                        <td className="px-4 py-3.5 whitespace-nowrap">
                                            <span className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-bold rounded-full ${
                                                issue.status === 'Issued'
                                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                                    : issue.status === 'Returned'
                                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                                                    : 'bg-gray-100 text-gray-800 border border-gray-200'
                                            }`}>
                                                {issue.status || 'Issued'}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden flex flex-col divide-y divide-gray-100 dark:divide-gray-800 pb-28 sm:pb-20">
                {filteredIssues.map((issue) => {
                    const typeInfo = resolveIssueType(issue);

                    return (
                        <div
                            key={issue._id}
                            onClick={() => onView && onView(issue)}
                            className="p-4 flex flex-col gap-3 active:bg-gray-50 dark:active:bg-gray-800/50 transition-all cursor-pointer"
                        >
                            {/* Card Header */}
                            <div className="flex justify-between items-start">
                                <div>
                                    <span className="text-xs font-mono font-bold text-gray-500 block mb-1">Issue #{issue.issueNumber}</span>
                                    <div className="flex items-center gap-2">
                                        <h4 className="font-bold text-gray-900 dark:text-white">{issue.department || 'General Store'}</h4>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wide ${typeInfo.badgeClass}`}>
                                            {typeInfo.shortLabel}
                                        </span>
                                    </div>
                                </div>
                                <span className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-bold rounded-full ${
                                    issue.status === 'Issued'
                                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                        : issue.status === 'Returned'
                                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                        : 'bg-gray-100 text-gray-800'
                                }`}>
                                    {issue.status}
                                </span>
                            </div>

                            {/* Card Content Details */}
                            <div className="text-xs space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Date & Time:</span>
                                    <span className="font-mono font-medium text-gray-800 dark:text-gray-200">{formatDateTime(issue.date)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Issued To:</span>
                                    <span className="font-bold text-gray-900 dark:text-gray-100">{issue.issuedTo?.name || (typeof issue.issuedTo === 'string' ? issue.issuedTo : 'Unknown')}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Issued By:</span>
                                    <span className="font-bold text-indigo-600 dark:text-indigo-400">{issue.issuedBy?.name || issue.issuedBy?.username || (typeof issue.issuedBy === 'string' ? issue.issuedBy : 'System')}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Items:</span>
                                    <div className="text-right">
                                        {issue.items?.length > 0 ? (
                                            <>
                                                <span className="font-bold text-gray-900 dark:text-white block">{issue.items[0].materialName} ({issue.items[0].quantity} {issue.items[0].unit})</span>
                                                {issue.items.length > 1 && <span className="text-blue-600 dark:text-blue-400 text-[11px] font-semibold block">+{issue.items.length - 1} more items</span>}
                                            </>
                                        ) : '-'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

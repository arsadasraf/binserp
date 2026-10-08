"use client";

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Filter, ArrowUp, ArrowDown, Search, X, Check } from 'lucide-react';

interface ExcelColumnFilterProps<T> {
    title: string;
    columnKey: string;
    data: T[];
    getValue: (item: T) => any;
    selectedValues: string[];
    onFilterChange: (selected: string[]) => void;
    sortConfig?: { key: string; direction: 'asc' | 'desc' } | null;
    onSortChange?: (sort: { key: string; direction: 'asc' | 'desc' } | null) => void;
    align?: 'left' | 'center' | 'right';
    className?: string;
}

export default function ExcelColumnFilter<T>({
    title,
    columnKey,
    data,
    getValue,
    selectedValues,
    onFilterChange,
    sortConfig,
    onSortChange,
    align = 'left',
    className = ''
}: ExcelColumnFilterProps<T>) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const popoverRef = useRef<HTMLDivElement>(null);

    // Compute distinct values and counts across the dataset
    const distinctValuesMap = useMemo(() => {
        const counts = new Map<string, number>();
        (data || []).forEach(item => {
            const raw = getValue(item);
            const strVal = (raw === null || raw === undefined || raw === '') ? '(Blanks)' : String(raw).trim();
            counts.set(strVal, (counts.get(strVal) || 0) + 1);
        });
        return counts;
    }, [data, getValue]);

    const allDistinctValues = useMemo(() => {
        return Array.from(distinctValuesMap.keys()).sort((a, b) => {
            if (a === '(Blanks)') return 1;
            if (b === '(Blanks)') return -1;
            return a.localeCompare(b, undefined, { numeric: true });
        });
    }, [distinctValuesMap]);

    // Filter distinct values based on popover search
    const filteredDistinctValues = useMemo(() => {
        if (!searchTerm.trim()) return allDistinctValues;
        const term = searchTerm.toLowerCase();
        return allDistinctValues.filter(val => val.toLowerCase().includes(term));
    }, [allDistinctValues, searchTerm]);

    // Check if filter is active
    const isFilterActive = selectedValues && selectedValues.length > 0;
    const isSortedAsc = sortConfig?.key === columnKey && sortConfig?.direction === 'asc';
    const isSortedDesc = sortConfig?.key === columnKey && sortConfig?.direction === 'desc';

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handleToggleValue = (val: string) => {
        let updated: string[];
        if (isFilterActive) {
            if (selectedValues.includes(val)) {
                updated = selectedValues.filter(v => v !== val);
            } else {
                updated = [...selectedValues, val];
            }
        } else {
            // When currently no filter (all visible), unchecking one means selecting all EXCEPT this one
            updated = allDistinctValues.filter(v => v !== val);
        }
        onFilterChange(updated);
    };

    const handleSelectAll = () => {
        // Clear filter to show all
        onFilterChange([]);
    };

    const handleClearAll = () => {
        // Select none (or empty filter)
        onFilterChange(['__NONE__']);
    };

    const handleSort = (direction: 'asc' | 'desc') => {
        if (!onSortChange) return;
        if ((direction === 'asc' && isSortedAsc) || (direction === 'desc' && isSortedDesc)) {
            onSortChange(null);
        } else {
            onSortChange({ key: columnKey, direction });
        }
        setIsOpen(false);
    };

    const isAllSelected = !isFilterActive || (selectedValues.length === allDistinctValues.length && allDistinctValues.length > 0);

    return (
        <div className={`relative inline-flex items-center gap-1.5 select-none ${className}`}>
            <span 
                className="cursor-pointer font-bold tracking-wider hover:text-slate-900 dark:hover:text-white transition-colors"
                onClick={() => {
                    if (onSortChange) {
                        if (isSortedAsc) handleSort('desc');
                        else if (isSortedDesc) onSortChange(null);
                        else handleSort('asc');
                    }
                }}
            >
                {title}
            </span>

            {/* Sort direction indicator */}
            {isSortedAsc && (
                <ArrowUp size={12} className="text-blue-600 dark:text-blue-400 font-bold" />
            )}
            {isSortedDesc && (
                <ArrowDown size={12} className="text-blue-600 dark:text-blue-400 font-bold" />
            )}

            {/* Filter Toggle Button */}
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(!isOpen);
                }}
                className={`p-1 rounded transition-all duration-150 relative ${
                    isFilterActive 
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 ring-1 ring-blue-400' 
                        : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-500'
                }`}
                title={`Filter & sort ${title}`}
            >
                <Filter size={12} className={isFilterActive ? 'fill-blue-500 dark:fill-blue-400 text-blue-600' : ''} />
                {isFilterActive && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-600 rounded-full ring-2 ring-white dark:ring-slate-900" />
                )}
            </button>

            {/* Filter Popover Dropdown */}
            {isOpen && (
                <div
                    ref={popoverRef}
                    onClick={(e) => e.stopPropagation()}
                    className={`absolute top-full mt-1.5 z-50 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden text-xs text-slate-700 dark:text-slate-200 animate-in fade-in zoom-in-95 duration-150 ${
                        align === 'right' ? 'right-0' : 'left-0'
                    }`}
                >
                    {/* Header info */}
                    <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                        <span className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                            Filter: {title}
                        </span>
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded"
                        >
                            <X size={13} />
                        </button>
                    </div>

                    {/* Sorting Options */}
                    {onSortChange && (
                        <div className="p-2 border-b border-slate-100 dark:border-slate-800 flex gap-1">
                            <button
                                type="button"
                                onClick={() => handleSort('asc')}
                                className={`flex-1 py-1.5 px-2 rounded flex items-center justify-center gap-1.5 font-medium transition-colors ${
                                    isSortedAsc 
                                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 font-bold' 
                                        : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
                                }`}
                            >
                                <ArrowUp size={12} /> Sort A → Z
                            </button>
                            <button
                                type="button"
                                onClick={() => handleSort('desc')}
                                className={`flex-1 py-1.5 px-2 rounded flex items-center justify-center gap-1.5 font-medium transition-colors ${
                                    isSortedDesc 
                                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 font-bold' 
                                        : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
                                }`}
                            >
                                <ArrowDown size={12} /> Sort Z → A
                            </button>
                        </div>
                    )}

                    {/* Search inside column values */}
                    <div className="p-2 border-b border-slate-100 dark:border-slate-800">
                        <div className="relative">
                            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search values..."
                                className="w-full pl-7 pr-6 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500 dark:text-white"
                                autoFocus
                            />
                            {searchTerm && (
                                <button
                                    type="button"
                                    onClick={() => setSearchTerm('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    <X size={10} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Quick Select All / Clear All toggles */}
                    <div className="px-3 py-1.5 bg-slate-50/50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center text-[11px]">
                        <button
                            type="button"
                            onClick={handleSelectAll}
                            className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                        >
                            Select All
                        </button>
                        <button
                            type="button"
                            onClick={handleClearAll}
                            className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                        >
                            Clear All
                        </button>
                    </div>

                    {/* Distinct Values Checklist */}
                    <div className="max-h-48 overflow-y-auto p-1.5 divide-y divide-slate-50 dark:divide-slate-800/60 custom-scrollbar">
                        {filteredDistinctValues.length === 0 ? (
                            <div className="py-4 text-center text-slate-400 text-xs italic">
                                No matching values
                            </div>
                        ) : (
                            filteredDistinctValues.map(val => {
                                const isChecked = !isFilterActive || selectedValues.includes(val);
                                const count = distinctValuesMap.get(val) || 0;
                                return (
                                    <label
                                        key={val}
                                        className="flex items-center justify-between px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded cursor-pointer transition-colors"
                                    >
                                        <div className="flex items-center gap-2 truncate pr-2">
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={() => handleToggleValue(val)}
                                                className="w-3.5 h-3.5 rounded text-blue-600 border-slate-300 dark:border-slate-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                                            />
                                            <span className={`truncate text-xs ${val === '(Blanks)' ? 'text-slate-400 italic' : 'text-slate-700 dark:text-slate-200'}`}>
                                                {val}
                                            </span>
                                        </div>
                                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                                            {count}
                                        </span>
                                    </label>
                                );
                            })
                        )}
                    </div>

                    {/* Footer / Apply */}
                    <div className="p-2 bg-slate-50 dark:bg-slate-800/70 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center gap-2">
                        {isFilterActive ? (
                            <button
                                type="button"
                                onClick={() => {
                                    onFilterChange([]);
                                    setIsOpen(false);
                                }}
                                className="text-[11px] text-red-600 dark:text-red-400 hover:underline font-medium"
                            >
                                Reset Filter
                            </button>
                        ) : (
                            <span className="text-[10px] text-slate-400">
                                {allDistinctValues.length} unique values
                            </span>
                        )}
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-sm transition-colors"
                        >
                            Done
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

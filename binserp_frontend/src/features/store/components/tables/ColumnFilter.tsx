'use client';

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Filter, Search, X, ArrowUpAZ, ArrowDownZA, ArrowUp10, ArrowDown10 } from 'lucide-react';

interface ColumnFilterProps {
    column: string;
    title: string;
    data: any[];
    currentFilters: string[];
    onFilterChange: (selectedValues: string[]) => void;
    getValue?: (item: any) => string;
    sortConfig?: { key: string; direction: 'asc' | 'desc' } | null;
    onSortChange?: (key: string, direction: 'asc' | 'desc') => void;
    enableSort?: boolean;
    isNumeric?: boolean;
    numericCondition?: 'all' | 'gt0' | 'eq0';
    onNumericConditionChange?: (condition: 'all' | 'gt0' | 'eq0') => void;
}

export default function ColumnFilter({
    column,
    title,
    data,
    currentFilters,
    onFilterChange,
    getValue,
    sortConfig,
    onSortChange,
    enableSort = true,
    isNumeric = false,
    numericCondition = 'all',
    onNumericConditionChange
}: ColumnFilterProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [mounted, setMounted] = useState(false);
    const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
    const buttonRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Calculate fixed viewport position for portal dropdown
    const updatePosition = useCallback(() => {
        if (!buttonRef.current) return;
        const rect = buttonRef.current.getBoundingClientRect();
        const popoverWidth = 270;
        const popoverHeight = 380;

        // Calculate horizontal position (stay strictly inside viewport)
        let left = rect.left;
        if (left + popoverWidth > window.innerWidth - 12) {
            left = Math.max(12, rect.right - popoverWidth);
        }
        if (left < 12) left = 12;

        // Calculate vertical position ("open with top" if tight below or closer to bottom)
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;

        let top = rect.bottom + 6;
        let maxHeight = 390;

        if (spaceBelow < 310 && spaceAbove > spaceBelow) {
            // Open above the header button
            maxHeight = Math.min(390, spaceAbove - 16);
            top = Math.max(12, rect.top - maxHeight - 6);
        } else {
            maxHeight = Math.min(390, spaceBelow - 16);
        }

        setDropdownStyle({
            position: 'fixed',
            top: `${top}px`,
            left: `${left}px`,
            width: `${popoverWidth}px`,
            maxHeight: `${maxHeight}px`,
            zIndex: 99999,
        });
    }, []);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(target) &&
                buttonRef.current &&
                !buttonRef.current.contains(target)
            ) {
                setIsOpen(false);
                setSearchTerm('');
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    // Keep dropdown anchored during scroll or window resize
    useEffect(() => {
        if (!isOpen) return;
        updatePosition();

        const handleScrollOrResize = () => {
            updatePosition();
        };

        window.addEventListener('resize', handleScrollOrResize);
        window.addEventListener('scroll', handleScrollOrResize, true);
        return () => {
            window.removeEventListener('resize', handleScrollOrResize);
            window.removeEventListener('scroll', handleScrollOrResize, true);
        };
    }, [isOpen, updatePosition]);

    // Extract unique values and counts from data
    const uniqueValuesWithCounts = useMemo(() => {
        const counts = new Map<string, number>();
        data.forEach(item => {
            let val = '';
            if (getValue) {
                val = getValue(item);
            } else {
                val = String(item[column] !== undefined && item[column] !== null && item[column] !== '' ? item[column] : '-');
            }
            if (!val) val = '-';
            counts.set(val, (counts.get(val) || 0) + 1);
        });

        return Array.from(counts.entries()).map(([value, count]) => ({
            value,
            count
        })).sort((a, b) => {
            if (a.value === '-') return 1;
            if (b.value === '-') return -1;
            return a.value.localeCompare(b.value, undefined, { numeric: true, sensitivity: 'base' });
        });
    }, [data, column, getValue]);

    // Filter values based on search term
    const filteredValues = useMemo(() => {
        if (!searchTerm) return uniqueValuesWithCounts;
        const lower = searchTerm.toLowerCase();
        return uniqueValuesWithCounts.filter(item =>
            item.value.toLowerCase().includes(lower)
        );
    }, [uniqueValuesWithCounts, searchTerm]);

    const handleCheckboxChange = (value: string) => {
        const newFilters = currentFilters.includes(value)
            ? currentFilters.filter(f => f !== value)
            : [...currentFilters, value];
        onFilterChange(newFilters);
    };

    const handleSelectAll = () => {
        if (filteredValues.length === 0) return;
        const allFilteredSelected = filteredValues.every(item => currentFilters.includes(item.value));

        if (allFilteredSelected) {
            const filteredSet = new Set(filteredValues.map(v => v.value));
            const newFilters = currentFilters.filter(f => !filteredSet.has(f));
            onFilterChange(newFilters);
        } else {
            const newFilters = [...currentFilters];
            filteredValues.forEach(item => {
                if (!newFilters.includes(item.value)) newFilters.push(item.value);
            });
            onFilterChange(newFilters);
        }
    };

    const handleClear = () => {
        onFilterChange([]);
        if (onNumericConditionChange) onNumericConditionChange('all');
        setSearchTerm('');
    };

    const isFiltered = currentFilters.length > 0 || (isNumeric && numericCondition && numericCondition !== 'all');
    const isSorted = sortConfig?.key === column;

    return (
        <div className="relative inline-flex items-center gap-1.5">
            <span className="font-semibold text-gray-900 dark:text-gray-100 select-none">{title}</span>
            <button
                ref={buttonRef}
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    if (!isOpen) {
                        updatePosition();
                    }
                    setIsOpen(!isOpen);
                }}
                className={`p-1 rounded-md transition-colors cursor-pointer ${
                    isFiltered || isSorted
                        ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300 font-bold shadow-xs'
                        : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200/60 dark:hover:bg-slate-700'
                }`}
                title={`Filter & Sort ${title}`}
            >
                <Filter size={13} className={isFiltered ? 'fill-indigo-600 text-indigo-600 dark:fill-indigo-400 dark:text-indigo-400' : ''} />
            </button>

            {/* Portal Dropdown Rendered directly into document.body with fixed position & high z-index */}
            {isOpen && mounted && typeof document !== 'undefined' && createPortal(
                <div
                    ref={dropdownRef}
                    style={dropdownStyle}
                    className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-200 dark:border-slate-700 p-3 text-xs normal-case font-normal animate-in fade-in zoom-in-95 duration-150 flex flex-col"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-slate-700 mb-2 shrink-0">
                        <span className="font-bold text-gray-800 dark:text-gray-200 text-xs truncate mr-2">Filter: {title}</span>
                        <button 
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer shrink-0"
                        >
                            <X size={14} />
                        </button>
                    </div>

                    {/* Sort Buttons */}
                    {enableSort && onSortChange && (
                        <div className="grid grid-cols-2 gap-1.5 pb-2.5 border-b border-gray-100 dark:border-slate-700 mb-2.5 shrink-0">
                            <button
                                type="button"
                                onClick={() => onSortChange(column, 'asc')}
                                className={`flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border font-semibold text-[11px] transition-all cursor-pointer ${
                                    sortConfig?.key === column && sortConfig?.direction === 'asc'
                                        ? 'bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-950/60 dark:border-indigo-700 dark:text-indigo-300'
                                        : 'bg-gray-50 border-gray-200 text-gray-700 dark:bg-slate-700/50 dark:border-slate-600 dark:text-gray-300 hover:bg-gray-100'
                                }`}
                            >
                                {isNumeric ? <ArrowUp10 size={13} /> : <ArrowUpAZ size={13} />}
                                <span>{isNumeric ? 'Smallest ↑' : 'Sort A ➔ Z'}</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => onSortChange(column, 'desc')}
                                className={`flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border font-semibold text-[11px] transition-all cursor-pointer ${
                                    sortConfig?.key === column && sortConfig?.direction === 'desc'
                                        ? 'bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-950/60 dark:border-indigo-700 dark:text-indigo-300'
                                        : 'bg-gray-50 border-gray-200 text-gray-700 dark:bg-slate-700/50 dark:border-slate-600 dark:text-gray-300 hover:bg-gray-100'
                                }`}
                            >
                                {isNumeric ? <ArrowDown10 size={13} /> : <ArrowDownZA size={13} />}
                                <span>{isNumeric ? 'Largest ↓' : 'Sort Z ➔ A'}</span>
                            </button>
                        </div>
                    )}

                    {/* Numeric Condition Presets */}
                    {isNumeric && onNumericConditionChange && (
                        <div className="pb-2.5 border-b border-gray-100 dark:border-slate-700 mb-2.5 space-y-1 shrink-0">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Condition Preset</span>
                            <div className="grid grid-cols-3 gap-1">
                                <button
                                    type="button"
                                    onClick={() => onNumericConditionChange('all')}
                                    className={`px-1.5 py-1 rounded text-[10px] font-bold transition-all cursor-pointer ${
                                        (!numericCondition || numericCondition === 'all')
                                            ? 'bg-indigo-600 text-white shadow-2xs'
                                            : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
                                    }`}
                                >
                                    All
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onNumericConditionChange('gt0')}
                                    className={`px-1.5 py-1 rounded text-[10px] font-bold transition-all cursor-pointer ${
                                        numericCondition === 'gt0'
                                            ? 'bg-indigo-600 text-white shadow-2xs'
                                            : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
                                    }`}
                                    title="Show only rows where value > 0"
                                >
                                    &gt; 0 Only
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onNumericConditionChange('eq0')}
                                    className={`px-1.5 py-1 rounded text-[10px] font-bold transition-all cursor-pointer ${
                                        numericCondition === 'eq0'
                                            ? 'bg-indigo-600 text-white shadow-2xs'
                                            : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
                                    }`}
                                    title="Show only rows where value = 0"
                                >
                                    = 0 Only
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Search Input */}
                    <div className="relative mb-2 shrink-0">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
                        <input
                            type="text"
                            placeholder="Search values..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-7 pr-2 py-1 text-xs border border-gray-200 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-700/50 text-gray-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                    </div>

                    {/* Quick Selection Actions */}
                    <div className="flex items-center justify-between px-1 mb-1.5 text-[11px] shrink-0">
                        <button
                            type="button"
                            onClick={handleSelectAll}
                            className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold cursor-pointer"
                        >
                            Select All
                        </button>
                        <button
                            type="button"
                            onClick={handleClear}
                            className="text-rose-600 dark:text-rose-400 hover:underline font-semibold cursor-pointer"
                        >
                            Clear
                        </button>
                    </div>

                    {/* Checkbox List */}
                    <div className="flex-1 min-h-0 max-h-44 overflow-y-auto space-y-1 pr-1 border border-gray-100 dark:border-slate-700/60 rounded-lg p-1.5 bg-gray-50/40 dark:bg-slate-900/30">
                        {filteredValues.length === 0 ? (
                            <div className="text-center py-3 text-gray-400 text-xs">No matching values</div>
                        ) : (
                            filteredValues.map(({ value, count }) => {
                                const isChecked = currentFilters.includes(value);

                                return (
                                    <label
                                        key={value}
                                        className="flex items-center justify-between px-2 py-1 hover:bg-gray-100 dark:hover:bg-slate-700/60 rounded-md cursor-pointer text-xs group"
                                    >
                                        <div className="flex items-center gap-2 min-w-0 pr-2">
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={() => handleCheckboxChange(value)}
                                                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                                            />
                                            <span className="truncate text-gray-700 dark:text-gray-200 font-medium">
                                                {value}
                                            </span>
                                        </div>
                                        <span className="text-[10px] text-gray-400 font-mono bg-gray-100 dark:bg-slate-700 px-1 rounded shrink-0">
                                            {count}
                                        </span>
                                    </label>
                                );
                            })
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex justify-end pt-2 mt-2 border-t border-gray-100 dark:border-slate-700 shrink-0">
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                        >
                            Apply
                        </button>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}


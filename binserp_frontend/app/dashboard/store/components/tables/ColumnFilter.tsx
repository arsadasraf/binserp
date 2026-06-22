
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Filter, Search, X } from 'lucide-react';

interface ColumnFilterProps {
    column: string;
    title: string;
    data: any[];
    currentFilters: string[];
    onFilterChange: (selectedValues: string[]) => void;
    getValue?: (item: any) => string;
}

export default function ColumnFilter({
    column,
    title,
    data,
    currentFilters,
    onFilterChange,
    getValue
}: ColumnFilterProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
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

    // Extract unique values from data
    const uniqueValues = useMemo(() => {
        const values = new Set<string>();
        data.forEach(item => {
            let val = '';
            if (getValue) {
                val = getValue(item);
            } else {
                val = String(item[column] || '');
            }
            if (val) values.add(val);
        });
        return Array.from(values).sort();
    }, [data, column, getValue]);

    // Filter values based on search term
    const filteredValues = useMemo(() => {
        if (!searchTerm) return uniqueValues;
        return uniqueValues.filter(val =>
            val.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [uniqueValues, searchTerm]);

    const handleCheckboxChange = (value: string) => {
        const newFilters = currentFilters.includes(value)
            ? currentFilters.filter(f => f !== value)
            : [...currentFilters, value];
        onFilterChange(newFilters);
    };

    const handleSelectAll = () => {
        if (filteredValues.length === 0) return;

        // If all filtered values are already selected, clear them
        // If some or none are selected, select all filtered values
        const allFilteredSelected = filteredValues.every(val => currentFilters.includes(val));

        if (allFilteredSelected) {
            const newFilters = currentFilters.filter(f => !filteredValues.includes(f));
            onFilterChange(newFilters);
        } else {
            // Add any filtered values that aren't already selected
            const newFilters = [...currentFilters];
            filteredValues.forEach(val => {
                if (!newFilters.includes(val)) newFilters.push(val);
            });
            onFilterChange(newFilters);
        }
    };

    const handleClear = () => {
        onFilterChange([]);
        setSearchTerm('');
    };

    // Check if filter is active for styling
    const isActive = currentFilters.length > 0;

    return (
        <div className="relative inline-flex items-center gap-1.5" ref={containerRef}>
            <span className="font-semibold text-gray-900">{title}</span>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(!isOpen);
                }}
                className={`p-1 rounded-md transition-colors ${isActive ? 'bg-indigo-100 text-indigo-600' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
                title={`Filter ${title}`}
            >
                <Filter size={14} strokeWidth={isActive ? 2.5 : 2} />
            </button>

            {isOpen && (
                <div
                    className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-200 z-50 flex flex-col overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="p-3 border-b border-gray-100 bg-gray-50/50">
                        <div className="relative">
                            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                autoFocus
                            />
                        </div>
                    </div>

                    <div className="max-h-60 overflow-y-auto p-2 space-y-0.5 custom-scrollbar">
                        <label className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded-lg cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={filteredValues.length > 0 && filteredValues.every(val => currentFilters.includes(val))}
                                ref={input => {
                                    if (input) {
                                        input.indeterminate = filteredValues.some(val => currentFilters.includes(val)) && !filteredValues.every(val => currentFilters.includes(val));
                                    }
                                }}
                                onChange={handleSelectAll}
                                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-sm font-medium text-gray-700">(Select All)</span>
                        </label>
                        <hr className="my-1 border-gray-100" />

                        {filteredValues.length === 0 ? (
                            <div className="text-center py-4 text-xs text-gray-400">No items found</div>
                        ) : (
                            filteredValues.map((value) => (
                                <label key={value} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded-lg cursor-pointer select-none group">
                                    <input
                                        type="checkbox"
                                        checked={currentFilters.includes(value)}
                                        onChange={() => handleCheckboxChange(value)}
                                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span className="text-sm text-gray-600 group-hover:text-gray-900">{value}</span>
                                </label>
                            ))
                        )}
                    </div>

                    <div className="p-3 border-t border-gray-100 bg-gray-50 flex justify-between items-center gap-2">
                        <button
                            onClick={handleClear}
                            disabled={!isActive}
                            className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50 transition-colors"
                        >
                            Clear Filter
                        </button>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                        >
                            Done
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

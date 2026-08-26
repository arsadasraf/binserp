"use client";

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  Settings2, 
  Filter, 
  ArrowUpAZ, 
  ArrowDownZA, 
  RotateCcw, 
  Check,
  X
} from 'lucide-react';

export interface ColumnDef<T> {
  id: string;
  label: string;
  isVisible?: boolean; // defaults to true if undefined
  render?: (item: T) => React.ReactNode;
  getValue?: (item: T) => any;
  enableFilter?: boolean;
  enableSort?: boolean;
}

interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  onRowClick?: (item: T) => void;
  searchPlaceholder?: string;
  searchableKeys?: (keyof T)[];
  itemsPerPage?: number;
  enableColumnToggle?: boolean;
  enableColumnFilter?: boolean;
  actionButton?: React.ReactNode;
}

export default function DataTable<T extends Record<string, any>>({
  columns,
  data,
  onRowClick,
  searchPlaceholder = "Search...",
  searchableKeys = [],
  itemsPerPage = 10,
  enableColumnToggle = true,
  enableColumnFilter = true,
  actionButton
}: DataTableProps<T>) {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(itemsPerPage);
  const [showSettings, setShowSettings] = useState(false);
  
  // Track hidden columns instead of visible to keep default true
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());

  // Excel Filter & Sorting States
  const [openFilterCol, setOpenFilterCol] = useState<string | null>(null);
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  const [colFilterSearch, setColFilterSearch] = useState<string>('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  const filterMenuRef = useRef<HTMLDivElement>(null);

  // Close filter dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (filterMenuRef.current && !filterMenuRef.current.contains(event.target as Node)) {
        setOpenFilterCol(null);
        setColFilterSearch('');
      }
    }
    if (openFilterCol) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openFilterCol]);

  // Helper to extract raw value for sorting and filtering
  const getRawValue = (item: T, col: ColumnDef<T>): string => {
    if (col.getValue) {
      const val = col.getValue(item);
      if (val === undefined || val === null || val === '') return '(Blanks)';
      return String(val);
    }
    const val = item[col.id as keyof T];
    if (val === undefined || val === null || val === '') return '(Blanks)';
    if (typeof val === 'object') {
      return (val as any).name || (val as any).label || (val as any).title || JSON.stringify(val);
    }
    return String(val);
  };

  // Compute unique values and their frequencies for the open filter column
  const activeColDef = useMemo(() => {
    return columns.find(c => c.id === openFilterCol);
  }, [columns, openFilterCol]);

  const uniqueColumnValues = useMemo(() => {
    if (!openFilterCol || !activeColDef) return [];
    const counts = new Map<string, number>();
    
    // We compute distinct values from data based on other column filters (or base data)
    data.forEach(item => {
      const val = getRawValue(item, activeColDef);
      counts.set(val, (counts.get(val) || 0) + 1);
    });

    const list = Array.from(counts.entries()).map(([value, count]) => ({
      value,
      count
    }));

    // Sort alphabetically with (Blanks) at the end
    return list.sort((a, b) => {
      if (a.value === '(Blanks)') return 1;
      if (b.value === '(Blanks)') return -1;
      return a.value.localeCompare(b.value, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [data, openFilterCol, activeColDef]);

  // Filtered distinct values matching the search inside filter popup
  const filteredUniqueValues = useMemo(() => {
    if (!colFilterSearch) return uniqueColumnValues;
    const lower = colFilterSearch.toLowerCase();
    return uniqueColumnValues.filter(item => item.value.toLowerCase().includes(lower));
  }, [uniqueColumnValues, colFilterSearch]);

  // Handle Global Search + Excel Column Filters + Sorting
  const filteredData = useMemo(() => {
    let result = [...data];

    // 1. Global Search
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      result = result.filter(item => {
        if (searchableKeys.length > 0) {
          return searchableKeys.some(key => {
            const val = item[key];
            return val && String(val).toLowerCase().includes(lowerSearch);
          });
        }
        return Object.values(item).some(val => 
          val && (typeof val === 'string' || typeof val === 'number') && String(val).toLowerCase().includes(lowerSearch)
        );
      });
    }

    // 2. Excel Column Filters
    Object.entries(columnFilters).forEach(([colId, selectedValues]) => {
      if (!selectedValues || selectedValues.length === 0) return;
      const colDef = columns.find(c => c.id === colId);
      if (!colDef) return;

      const valueSet = new Set(selectedValues);
      result = result.filter(item => {
        const val = getRawValue(item, colDef);
        return valueSet.has(val);
      });
    });

    // 3. Sorting
    if (sortConfig) {
      const { key, direction } = sortConfig;
      const colDef = columns.find(c => c.id === key);
      result.sort((a, b) => {
        const valA = colDef ? getRawValue(a, colDef) : String(a[key] || '');
        const valB = colDef ? getRawValue(b, colDef) : String(b[key] || '');

        const numA = Number(valA);
        const numB = Number(valB);

        let cmp = 0;
        if (!isNaN(numA) && !isNaN(numB)) {
          cmp = numA - numB;
        } else {
          cmp = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
        }

        return direction === 'asc' ? cmp : -cmp;
      });
    }

    return result;
  }, [data, searchTerm, searchableKeys, columnFilters, sortConfig, columns]);

  // Handle Pagination
  const totalPages = Math.ceil(filteredData.length / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  const startEntry = filteredData.length === 0 ? 0 : ((currentPage - 1) * pageSize) + 1;
  const endEntry = Math.min(currentPage * pageSize, filteredData.length);
  const totalCount = filteredData.length;

  const toggleColumn = (colId: string) => {
    setHiddenColumns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(colId)) {
        newSet.delete(colId);
      } else {
        newSet.add(colId);
      }
      return newSet;
    });
  };

  const visibleColumns = columns.filter(c => !hiddenColumns.has(c.id));

  // Check if any column filters or sorts are active
  const activeFiltersCount = Object.keys(columnFilters).length;
  const isFilteringOrSorting = activeFiltersCount > 0 || sortConfig !== null;

  const clearAllFilters = () => {
    setColumnFilters({});
    setSortConfig(null);
    setCurrentPage(1);
  };

  const handleToggleValueSelection = (colId: string, val: string) => {
    const currentSelected = columnFilters[colId] || uniqueColumnValues.map(v => v.value);
    let updated: string[];
    if (currentSelected.includes(val)) {
      updated = currentSelected.filter(v => v !== val);
    } else {
      updated = [...currentSelected, val];
    }
    
    // If all are selected, remove the filter key (no filter)
    if (updated.length === uniqueColumnValues.length) {
      const newFilters = { ...columnFilters };
      delete newFilters[colId];
      setColumnFilters(newFilters);
    } else {
      setColumnFilters({
        ...columnFilters,
        [colId]: updated
      });
    }
    setCurrentPage(1);
  };

  const handleSelectAllValues = (colId: string) => {
    const newFilters = { ...columnFilters };
    delete newFilters[colId];
    setColumnFilters(newFilters);
    setCurrentPage(1);
  };

  const handleClearColumnValues = (colId: string) => {
    setColumnFilters({
      ...columnFilters,
      [colId]: []
    });
    setCurrentPage(1);
  };

  const handleSort = (colId: string, direction: 'asc' | 'desc') => {
    if (sortConfig?.key === colId && sortConfig?.direction === direction) {
      setSortConfig(null); // Toggle off
    } else {
      setSortConfig({ key: colId, direction });
    }
    setCurrentPage(1);
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800 flex flex-col h-full overflow-hidden">
      {/* Top Bar: Column Filter, Count & Page Change on Left | Search, Excel Actions & Add Button on Right */}
      <div className="p-3.5 sm:p-4 border-b border-gray-200 dark:border-slate-800 flex flex-col xl:flex-row justify-between items-stretch xl:items-center bg-gray-50/50 dark:bg-slate-800/40 gap-3">
        {/* Left Side: Column Toggle, Count, Active Filters & Page Change Controls */}
        <div className="flex items-center flex-wrap gap-2 sm:gap-2.5">
          {enableColumnToggle && (
            <div className="relative hidden md:block">
              <button
                onClick={() => setShowSettings(!showSettings)}
                type="button"
                className={`px-3 py-2 border rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm ${
                  showSettings
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800'
                    : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-700'
                }`}
                title="Toggle visible columns"
              >
                <Settings2 size={15} className="text-gray-500 dark:text-gray-400" />
                <span>Columns</span>
              </button>

              {showSettings && (
                <div className="absolute left-0 mt-2 w-52 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-200 dark:border-slate-700 z-50 p-2 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="text-[10px] font-extrabold text-gray-400 mb-2 px-2 uppercase tracking-wider">Visible Columns</div>
                  <div className="max-h-60 overflow-y-auto space-y-1">
                    {columns.map(col => (
                      <label key={col.id} className="flex items-center px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-slate-700/50 rounded-lg cursor-pointer gap-2 text-xs font-semibold text-gray-700 dark:text-gray-200">
                        <input
                          type="checkbox"
                          checked={!hiddenColumns.has(col.id)}
                          onChange={() => toggleColumn(col.id)}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                        />
                        <span className="select-none">{col.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Active Filter Clear Tag */}
          {isFilteringOrSorting && (
            <button
              onClick={clearAllFilters}
              type="button"
              className="px-2.5 py-1.5 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
              title="Reset all column filters and sorting"
            >
              <RotateCcw size={13} />
              <span>Reset Filters</span>
              {activeFiltersCount > 0 && (
                <span className="bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100 px-1.5 py-0.2 rounded-full text-[10px]">
                  {activeFiltersCount}
                </span>
              )}
            </button>
          )}

          {/* Count Badge */}
          <div className="flex items-center px-2.5 sm:px-3 py-1.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-sm text-xs text-gray-600 dark:text-gray-300 font-medium whitespace-nowrap">
            <span className="hidden md:inline">
              Showing <span className="font-bold text-gray-900 dark:text-white">{startEntry}</span>–<span className="font-bold text-gray-900 dark:text-white">{endEntry}</span> of <span className="font-bold text-indigo-600 dark:text-indigo-400">{totalCount}</span>
            </span>
            <span className="inline md:hidden font-semibold">
              <span className="text-indigo-600 dark:text-indigo-400 font-bold">{filteredData.length}</span> records
            </span>
          </div>

          {/* Top Page Change Controls (Desktop only) */}
          <div className="hidden md:flex items-center bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden p-0.5">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              type="button"
              className="p-1 sm:p-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-gray-900 dark:hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed rounded-lg transition-colors"
              title="Previous Page"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="px-2 sm:px-2.5 text-xs font-semibold text-gray-700 dark:text-gray-200 whitespace-nowrap">
              Page <span className="text-indigo-600 dark:text-indigo-400">{currentPage}</span> / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              type="button"
              className="p-1 sm:p-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-gray-900 dark:hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed rounded-lg transition-colors"
              title="Next Page"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Page Size Selector (Desktop only) */}
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="hidden md:block bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-200 text-xs font-semibold rounded-xl px-2 py-1.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            title="Rows per page"
          >
            <option value={10}>10 / page</option>
            <option value={25}>25 / page</option>
            <option value={50}>50 / page</option>
            <option value={100}>100 / page</option>
            <option value={250}>250 / page</option>
            <option value={500}>500 / page</option>
          </select>
        </div>

        {/* Right Side: Search Bar, Excel Actions, Add Button */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full xl:w-auto justify-end flex-wrap">
          <div className="relative flex-1 sm:w-64 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-4 py-2 text-xs border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm text-gray-900 dark:text-white transition-colors"
            />
          </div>
          {actionButton && <div className="flex items-center gap-2 flex-wrap">{actionButton}</div>}
        </div>
      </div>

      {/* Desktop Table View with Excel-Style Column Filters */}
      <div className="hidden md:block overflow-x-auto flex-1 relative">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-gray-700 dark:text-gray-300 uppercase bg-gray-50 dark:bg-slate-800/80 border-b border-gray-200 dark:border-slate-700 sticky top-0 z-10">
            <tr>
              {visibleColumns.map((col) => {
                const isFiltered = Boolean(columnFilters[col.id] && columnFilters[col.id].length < uniqueColumnValues.length);
                const isSorted = sortConfig?.key === col.id;
                const isFilterable = enableColumnFilter && col.enableFilter !== false && col.id !== 'actions' && col.id !== 'photos' && col.id !== 'photo';
                const isSortable = col.enableSort !== false && col.id !== 'actions' && col.id !== 'photos' && col.id !== 'photo';

                return (
                  <th 
                    key={col.id} 
                    className="px-5 py-3 font-semibold text-gray-900 dark:text-white whitespace-nowrap select-none"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate">{col.label}</span>
                      
                      {/* Column Filter & Sort Trigger */}
                      {isFilterable && (
                        <div className="relative">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (openFilterCol === col.id) {
                                setOpenFilterCol(null);
                                setColFilterSearch('');
                              } else {
                                setOpenFilterCol(col.id);
                                setColFilterSearch('');
                              }
                            }}
                            className={`p-1 rounded-md transition-colors ${
                              isFiltered || isSorted
                                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300 font-bold shadow-xs'
                                : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200/60 dark:hover:bg-slate-700'
                            }`}
                            title={`Filter & Sort ${col.label}`}
                          >
                            <Filter size={13} className={isFiltered ? 'fill-indigo-600 text-indigo-600 dark:fill-indigo-400 dark:text-indigo-400' : ''} />
                          </button>

                          {/* Excel-Style Filter Popover */}
                          {openFilterCol === col.id && (
                            <div 
                              ref={filterMenuRef}
                              onClick={(e) => e.stopPropagation()}
                              className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-200 dark:border-slate-700 z-50 p-3 text-xs normal-case font-normal animate-in fade-in zoom-in-95 duration-150"
                            >
                              {/* Header: Title & Close */}
                              <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-slate-700 mb-2">
                                <span className="font-bold text-gray-800 dark:text-gray-200 text-xs">Filter: {col.label}</span>
                                <button 
                                  onClick={() => setOpenFilterCol(null)}
                                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                                >
                                  <X size={14} />
                                </button>
                              </div>

                              {/* Sort Buttons */}
                              {isSortable && (
                                <div className="grid grid-cols-2 gap-1.5 pb-2.5 border-b border-gray-100 dark:border-slate-700 mb-2.5">
                                  <button
                                    type="button"
                                    onClick={() => handleSort(col.id, 'asc')}
                                    className={`flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border font-semibold text-[11px] transition-all ${
                                      sortConfig?.key === col.id && sortConfig?.direction === 'asc'
                                        ? 'bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-950/60 dark:border-indigo-700 dark:text-indigo-300'
                                        : 'bg-gray-50 border-gray-200 text-gray-700 dark:bg-slate-700/50 dark:border-slate-600 dark:text-gray-300 hover:bg-gray-100'
                                    }`}
                                  >
                                    <ArrowUpAZ size={13} /> Sort A ➔ Z
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSort(col.id, 'desc')}
                                    className={`flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border font-semibold text-[11px] transition-all ${
                                      sortConfig?.key === col.id && sortConfig?.direction === 'desc'
                                        ? 'bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-950/60 dark:border-indigo-700 dark:text-indigo-300'
                                        : 'bg-gray-50 border-gray-200 text-gray-700 dark:bg-slate-700/50 dark:border-slate-600 dark:text-gray-300 hover:bg-gray-100'
                                    }`}
                                  >
                                    <ArrowDownZA size={13} /> Sort Z ➔ A
                                  </button>
                                </div>
                              )}

                              {/* Filter Search Input */}
                              <div className="relative mb-2">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
                                <input
                                  type="text"
                                  placeholder="Search values..."
                                  value={colFilterSearch}
                                  onChange={(e) => setColFilterSearch(e.target.value)}
                                  className="w-full pl-7 pr-2 py-1 text-xs border border-gray-200 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-700/50 text-gray-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                              </div>

                              {/* Quick Actions: Select All / Clear */}
                              <div className="flex items-center justify-between px-1 mb-1.5 text-[11px]">
                                <button
                                  type="button"
                                  onClick={() => handleSelectAllValues(col.id)}
                                  className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
                                >
                                  Select All
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleClearColumnValues(col.id)}
                                  className="text-rose-600 dark:text-rose-400 hover:underline font-semibold"
                                >
                                  Clear
                                </button>
                              </div>

                              {/* Value Checkbox List */}
                              <div className="max-h-48 overflow-y-auto space-y-1 pr-1 border border-gray-100 dark:border-slate-700/60 rounded-lg p-1.5 bg-gray-50/40 dark:bg-slate-900/30">
                                {filteredUniqueValues.length === 0 ? (
                                  <div className="text-center py-3 text-gray-400 text-xs">No matching values</div>
                                ) : (
                                  filteredUniqueValues.map(({ value, count }) => {
                                    const selectedValues = columnFilters[col.id] || uniqueColumnValues.map(v => v.value);
                                    const isChecked = selectedValues.includes(value);

                                    return (
                                      <label
                                        key={value}
                                        className="flex items-center justify-between px-2 py-1 hover:bg-gray-100 dark:hover:bg-slate-700/60 rounded-md cursor-pointer text-xs group"
                                      >
                                        <div className="flex items-center gap-2 min-w-0 pr-2">
                                          <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={() => handleToggleValueSelection(col.id, value)}
                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                                          />
                                          <span className={`truncate ${value === '(Blanks)' ? 'italic text-gray-400' : 'text-gray-700 dark:text-gray-200 font-medium'}`}>
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

                              {/* Footer Action */}
                              <div className="flex justify-end pt-2.5 mt-2 border-t border-gray-100 dark:border-slate-700">
                                <button
                                  type="button"
                                  onClick={() => setOpenFilterCol(null)}
                                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors"
                                >
                                  Apply
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <span className="text-sm font-semibold">No records found</span>
                    {isFilteringOrSorting && (
                      <button
                        onClick={clearAllFilters}
                        type="button"
                        className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-bold"
                      >
                        Reset active filters
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              paginatedData.map((item, index) => (
                <tr
                  key={(item as any)._id || index}
                  onClick={() => onRowClick && onRowClick(item)}
                  className={`transition-colors ${
                    onRowClick ? 'cursor-pointer hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20' : 'hover:bg-gray-50/70 dark:hover:bg-slate-800/50'
                  }`}
                >
                  {visibleColumns.map((col) => (
                    <td key={col.id} className="px-5 py-3.5 text-gray-600 dark:text-gray-300 text-xs">
                      {col.render ? col.render(item) : (item[col.id as keyof T] as React.ReactNode) || '-'}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View (Visible on screens smaller than md) */}
      <div className="block md:hidden flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50/60 dark:bg-slate-900/60 pb-28 sm:pb-20">
        {filteredData.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-8 text-center text-gray-500 text-sm shadow-sm">
            No records found.
          </div>
        ) : (
          filteredData.map((item, index) => {
            const actionsCol = visibleColumns.find(c => c.id === 'actions');
            const photoCol = visibleColumns.find(c => c.id === 'photo' || c.id === 'photos' || c.id === 'image');
            const nonActionCols = visibleColumns.filter(c => c.id !== 'actions' && c.id !== 'photo' && c.id !== 'photos' && c.id !== 'image');
            const primaryCol = nonActionCols[0];
            const secondaryCols = nonActionCols.slice(1);

            return (
              <div
                key={(item as any)._id || index}
                onClick={() => onRowClick && onRowClick(item)}
                className={`bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm p-4 transition-all ${
                  onRowClick ? 'cursor-pointer active:scale-[0.99] hover:border-indigo-300 hover:shadow-md' : ''
                }`}
              >
                {/* Card Top: Photo (if any) + Primary Title + Actions */}
                <div className="flex items-start justify-between gap-3 pb-3 border-b border-gray-100 dark:border-slate-700">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {photoCol && (
                      <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                        {photoCol.render ? photoCol.render(item) : (item[photoCol.id as keyof T] as React.ReactNode)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      {primaryCol && (
                        <div className="font-bold text-gray-900 dark:text-white text-sm sm:text-base truncate">
                          {primaryCol.render ? primaryCol.render(item) : (item[primaryCol.id as keyof T] as React.ReactNode) || '-'}
                        </div>
                      )}
                    </div>
                  </div>

                  {actionsCol && (
                    <div
                      className="shrink-0 flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {actionsCol.render ? actionsCol.render(item) : (item[actionsCol.id as keyof T] as React.ReactNode)}
                    </div>
                  )}
                </div>

                {/* Card Body: Key-Value Details Grid */}
                <div className="grid grid-cols-2 gap-2.5 pt-3 text-xs">
                  {secondaryCols
                    .filter(c => c.id !== 'code')
                    .map((col) => {
                      const val = col.render ? col.render(item) : (item[col.id as keyof T] as React.ReactNode);
                      if (val === undefined || val === null || val === '') return null;

                      return (
                        <div key={col.id} className="flex flex-col bg-gray-50/70 dark:bg-slate-700/30 p-2 rounded-lg border border-gray-100 dark:border-slate-700/50">
                          <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-0.5">
                            {col.label}
                          </span>
                          <span className="font-semibold text-gray-800 dark:text-gray-200 break-words line-clamp-2">
                            {val || '-'}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

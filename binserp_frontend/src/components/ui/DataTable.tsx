import React, { useState, useMemo } from 'react';
import { Search, ChevronLeft, ChevronRight, Settings2 } from 'lucide-react';

export interface ColumnDef<T> {
  id: string;
  label: string;
  isVisible?: boolean; // defaults to true if undefined
  render?: (item: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  onRowClick?: (item: T) => void;
  searchPlaceholder?: string;
  searchableKeys?: (keyof T)[];
  itemsPerPage?: number;
  enableColumnToggle?: boolean;
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
  actionButton
}: DataTableProps<T>) {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(itemsPerPage);
  const [showSettings, setShowSettings] = useState(false);
  
  // Track hidden columns instead of visible to keep default true
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());

  // Handle Search
  const filteredData = useMemo(() => {
    let result = data;
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      result = result.filter(item => {
        // If searchableKeys are provided, search only those
        if (searchableKeys.length > 0) {
          return searchableKeys.some(key => {
            const val = item[key];
            return val && String(val).toLowerCase().includes(lowerSearch);
          });
        }
        // Otherwise search all string/number values
        return Object.values(item).some(val => 
          val && (typeof val === 'string' || typeof val === 'number') && String(val).toLowerCase().includes(lowerSearch)
        );
      });
    }
    return result;
  }, [data, searchTerm, searchableKeys]);

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

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-full overflow-hidden">
      {/* Top Bar: Column Filter, Count & Page Change on Left | Search, Excel Actions & Add Button on Right */}
      <div className="p-3.5 sm:p-4 border-b border-gray-200 flex flex-col xl:flex-row justify-between items-stretch xl:items-center bg-gray-50/50 gap-3">
        {/* Left Side: Column Filter, Count & Page Change Controls */}
        <div className="flex items-center flex-wrap gap-2 sm:gap-2.5">
          {enableColumnToggle && (
            <div className="relative hidden md:block">
              <button
                onClick={() => setShowSettings(!showSettings)}
                type="button"
                className={`px-3 py-2 border rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm ${
                  showSettings
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100 hover:text-gray-900'
                }`}
                title="Toggle visible columns"
              >
                <Settings2 size={15} className="text-gray-500" />
                <span>Columns</span>
              </button>

              {showSettings && (
                <div className="absolute left-0 mt-2 w-52 bg-white rounded-xl shadow-xl border border-gray-200 z-50 p-2 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="text-[10px] font-extrabold text-gray-400 mb-2 px-2 uppercase tracking-wider">Visible Columns</div>
                  <div className="max-h-60 overflow-y-auto space-y-1">
                    {columns.map(col => (
                      <label key={col.id} className="flex items-center px-2 py-1.5 hover:bg-gray-50 rounded-lg cursor-pointer gap-2 text-xs font-semibold text-gray-700">
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

          {/* Count Badge */}
          <div className="flex items-center px-2.5 sm:px-3 py-1.5 bg-white border border-gray-200 rounded-xl shadow-sm text-xs text-gray-600 font-medium whitespace-nowrap">
            <span className="hidden md:inline">
              Showing <span className="font-bold text-gray-900">{startEntry}</span>–<span className="font-bold text-gray-900">{endEntry}</span> of <span className="font-bold text-indigo-600">{totalCount}</span>
            </span>
            <span className="inline md:hidden font-semibold">
              <span className="text-indigo-600 font-bold">{filteredData.length}</span> records
            </span>
          </div>

          {/* Top Page Change Controls (Desktop only) */}
          <div className="hidden md:flex items-center bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden p-0.5">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              type="button"
              className="p-1 sm:p-1.5 text-gray-600 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed rounded-lg transition-colors"
              title="Previous Page"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="px-2 sm:px-2.5 text-xs font-semibold text-gray-700 whitespace-nowrap">
              Page <span className="text-indigo-600">{currentPage}</span> / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              type="button"
              className="p-1 sm:p-1.5 text-gray-600 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed rounded-lg transition-colors"
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
            className="hidden md:block bg-white border border-gray-200 text-gray-700 text-xs font-semibold rounded-xl px-2 py-1.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            title="Rows per page"
          >
            <option value={10}>10 / page</option>
            <option value={25}>25 / page</option>
            <option value={50}>50 / page</option>
            <option value={100}>100 / page</option>
            <option value={250}>250 / page</option>
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
              className="w-full pl-9 pr-4 py-2 text-xs border border-gray-200 bg-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm text-gray-900 transition-colors"
            />
          </div>
          {actionButton && <div className="flex items-center gap-2 flex-wrap">{actionButton}</div>}
        </div>
      </div>

      {/* Desktop Table View (Hidden on mobile) */}
      <div className="hidden md:block overflow-x-auto flex-1">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200">
            <tr>
              {visibleColumns.map((col) => (
                <th key={col.id} className="px-6 py-3 font-semibold text-gray-900 whitespace-nowrap">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length} className="px-6 py-8 text-center text-gray-500">
                  No records found.
                </td>
              </tr>
            ) : (
              paginatedData.map((item, index) => (
                <tr
                  key={(item as any)._id || index}
                  onClick={() => onRowClick && onRowClick(item)}
                  className={`transition-colors ${onRowClick ? 'cursor-pointer hover:bg-indigo-50/50' : 'hover:bg-gray-50'}`}
                >
                  {visibleColumns.map((col) => (
                    <td key={col.id} className="px-6 py-4 text-gray-600">
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
      <div className="block md:hidden flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50/60 pb-28 sm:pb-20">
        {filteredData.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500 text-sm shadow-sm">
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
                className={`bg-white rounded-xl border border-gray-200 shadow-sm p-4 transition-all ${
                  onRowClick ? 'cursor-pointer active:scale-[0.99] hover:border-indigo-300 hover:shadow-md' : ''
                }`}
              >
                {/* Card Top: Photo (if any) + Primary Title + Actions */}
                <div className="flex items-start justify-between gap-3 pb-3 border-b border-gray-100">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {photoCol && (
                      <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                        {photoCol.render ? photoCol.render(item) : (item[photoCol.id as keyof T] as React.ReactNode)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      {primaryCol && (
                        <div className="font-bold text-gray-900 text-sm sm:text-base truncate">
                          {primaryCol.render ? primaryCol.render(item) : (item[primaryCol.id as keyof T] as React.ReactNode) || '-'}
                        </div>
                      )}
                      {secondaryCols.length > 0 && secondaryCols[0].id === 'code' && (
                        <div className="text-xs font-mono text-indigo-600 font-semibold mt-0.5">
                          {secondaryCols[0].render ? secondaryCols[0].render(item) : (item[secondaryCols[0].id as keyof T] as React.ReactNode)}
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
                        <div key={col.id} className="flex flex-col bg-gray-50/70 p-2 rounded-lg border border-gray-100">
                          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">
                            {col.label}
                          </span>
                          <span className="font-semibold text-gray-800 break-words line-clamp-2">
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

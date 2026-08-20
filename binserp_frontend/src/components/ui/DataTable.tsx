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
  const totalPages = Math.ceil(filteredData.length / itemsPerPage) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(start, start + itemsPerPage);
  }, [filteredData, currentPage, itemsPerPage]);

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
      {/* Top Bar: Column Filter on Left | Search, Excel Actions & Add Button on Right */}
      <div className="p-4 border-b border-gray-200 flex flex-col md:flex-row justify-between items-stretch md:items-center bg-gray-50/50 gap-3">
        {/* Left Side: Column Filter / Settings */}
        <div className="flex items-center gap-2">
          {enableColumnToggle && (
            <div className="relative">
              <button
                onClick={() => setShowSettings(!showSettings)}
                type="button"
                className={`px-3.5 py-2 border rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm ${
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
        </div>

        {/* Right Side: Search Bar, Excel Actions, Add Button */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full md:w-auto justify-end flex-wrap">
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

      {/* Table */}
      <div className="overflow-x-auto flex-1">
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
          <span className="text-sm text-gray-600">
            Showing <span className="font-medium">{filteredData.length === 0 ? 0 : ((currentPage - 1) * itemsPerPage) + 1}</span> to <span className="font-medium">{Math.min(currentPage * itemsPerPage, filteredData.length)}</span> of <span className="font-medium">{filteredData.length}</span> entries
          </span>
          
          <div className="flex gap-1">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1 rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="px-3 py-1 text-sm font-medium text-gray-700">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1 rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

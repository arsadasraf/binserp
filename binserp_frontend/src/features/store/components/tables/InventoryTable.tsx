/**
 * InventoryTable Component
 * 
 * Displays inventory data in a table format with Excel-style column filters & sorting.
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { InventoryItem } from "@/src/features/store/types/store.types";
import { Package, Factory, Download, Search, Edit2, FileSpreadsheet, ChevronDown, FileDown, RotateCcw, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx';
import ColumnFilter from './ColumnFilter';
import { apiPost } from '@/src/lib/api';
import MasterExcelImportModal from '../modals/MasterExcelImportModal';
import { downloadMasterExcelTemplate } from '@/src/utils/excelMasterHelper';

interface InventoryTableProps {
    data: InventoryItem[];
    inHouseData?: any[];
    onEdit: (item: InventoryItem) => void;
    onDelete: (id: string) => void;
    activeSubTab: 'bo' | 'inhouse' | 'consumable' | string;
    onSubTabChange: (tab: any) => void;
    hideTabs?: boolean;
    onItemClick?: (item: InventoryItem) => void;
    refetch?: () => void;
    onCreateGRN?: () => void;
}

export default function InventoryTable({
    data,
    inHouseData = [],
    onEdit,
    onDelete,
    activeSubTab,
    onSubTabChange,
    hideTabs,
    onItemClick,
    refetch,
    onCreateGRN
}: InventoryTableProps) {
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isExcelMenuOpen, setIsExcelMenuOpen] = useState(false);
    const [filters, setFilters] = useState<Record<string, string[]>>({});
    const [searchQuery, setSearchQuery] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

    const [editingStockId, setEditingStockId] = useState<string | null>(null);
    const [editingStockValue, setEditingStockValue] = useState<number>(0);
    const [isUpdating, setIsUpdating] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleRefresh = async () => {
        if (refetch) {
            setIsRefreshing(true);
            try {
                await refetch();
            } finally {
                setTimeout(() => setIsRefreshing(false), 500);
            }
        }
    };

    const excelMenuRef = useRef<HTMLDivElement>(null);

    // Close Excel menu on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (excelMenuRef.current && !excelMenuRef.current.contains(event.target as Node)) {
                setIsExcelMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleOpeningStockEditClick = (e: React.MouseEvent, item: any) => {
        e.stopPropagation();
        setEditingStockId(item._id);
        setEditingStockValue(item.monthlyData?.openingStock || 0);
    };

    const handleOpeningStockSave = async (e: React.MouseEvent | React.KeyboardEvent, item: any) => {
        e.stopPropagation();
        setIsUpdating(true);
        try {
            const token = localStorage.getItem('token');
            const currentDate = new Date();
            const currentMonthStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

            const endpoint = activeSubTab === 'bo' ? '/api/store/monthly-inventory/rm' : '/api/store/monthly-inventory/fg';
            const payload = activeSubTab === 'bo' ? {
                materialId: item.material || item._id,
                month: currentMonthStr,
                openingStock: editingStockValue
            } : {
                fgItemId: item._id,
                month: currentMonthStr,
                openingStock: editingStockValue
            };

            await apiPost(endpoint, payload, token);

            if (refetch) refetch();
        } catch (error) {
            console.error("Failed to update opening stock", error);
        } finally {
            setIsUpdating(false);
            setEditingStockId(null);
        }
    };

    const handleFilterChange = (column: string, values: string[]) => {
        setFilters(prev => {
            const updated = { ...prev };
            if (values.length === 0) {
                delete updated[column];
            } else {
                updated[column] = values;
            }
            return updated;
        });
    };

    const handleSortChange = (column: string, direction: 'asc' | 'desc') => {
        if (sortConfig?.key === column && sortConfig?.direction === direction) {
            setSortConfig(null);
        } else {
            setSortConfig({ key: column, direction });
        }
    };

    const clearAllFilters = () => {
        setFilters({});
        setSortConfig(null);
        setSearchQuery('');
    };

    // Helpers to extract column string/number values
    const getCategoryValue = (item: any) =>
        (typeof item.categoryId === 'object' && item.categoryId?.name) ||
        (typeof item.category === 'object' && item.category?.name) ||
        item.category?.name || item.category || '-';

    const getLocationValue = (item: any) => {
        if (!item.location && !item.locationId) return '-';
        return (typeof item.locationId === 'object' ? item.locationId?.name : (typeof item.location === 'object' ? item.location?.name : (item.location || item.locationId || '-')));
    };

    const getDescriptionValue = (item: any) => item.descriptions || item.description || '-';
    const getStockValue = (item: any) => String(item.currentStock ?? item.quantity ?? 0);
    const getMonthlyFlowValue = (item: any) => {
        if (!item.monthlyData) return '-';
        return `+${item.monthlyData.totalInwardQuantity || 0} / -${item.monthlyData.totalOutwardQuantity || 0}`;
    };

    const applyFiltersAndSort = (items: any[], isInHouse: boolean = false) => {
        let result = items.filter(item => {
            // Global Search Filter (Name or Description)
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                const name = (item.materialName || item.componentName || item.name || '').toLowerCase();
                const desc = (item.descriptions || item.description || '').toLowerCase();

                if (!name.includes(query) && !desc.includes(query)) {
                    return false;
                }
            }

            // Column Filters
            return Object.entries(filters).every(([key, selectedValues]) => {
                if (!selectedValues || selectedValues.length === 0) return true;

                let itemValue = '';
                if (key === 'category') {
                    itemValue = getCategoryValue(item);
                } else if (key === 'location') {
                    itemValue = getLocationValue(item);
                } else if (key === 'materialName' || key === 'name') {
                    itemValue = item.materialName || item.componentName || item.name || '-';
                } else if (key === 'descriptions' || key === 'description') {
                    itemValue = getDescriptionValue(item);
                } else if (key === 'currentStock' || key === 'quantity') {
                    itemValue = getStockValue(item);
                } else if (key === 'monthlyFlow') {
                    itemValue = getMonthlyFlowValue(item);
                } else if (key === 'unit') {
                    itemValue = item.unit || '-';
                } else if (key === 'type') {
                    itemValue = item.type || '-';
                } else if (key === 'allocatedQuantity') {
                    itemValue = String(item.allocatedQuantity || 0);
                } else {
                    itemValue = String(item[key] || '-');
                }

                return selectedValues.includes(itemValue);
            });
        });

        // Column Sorting
        if (sortConfig) {
            const { key, direction } = sortConfig;
            result.sort((a, b) => {
                let valA = '';
                let valB = '';

                if (key === 'category') {
                    valA = getCategoryValue(a);
                    valB = getCategoryValue(b);
                } else if (key === 'location') {
                    valA = getLocationValue(a);
                    valB = getLocationValue(b);
                } else if (key === 'materialName' || key === 'name') {
                    valA = a.materialName || a.componentName || a.name || '';
                    valB = b.materialName || b.componentName || b.name || '';
                } else if (key === 'descriptions' || key === 'description') {
                    valA = getDescriptionValue(a);
                    valB = getDescriptionValue(b);
                } else if (key === 'currentStock' || key === 'quantity') {
                    valA = String(a.currentStock ?? a.quantity ?? 0);
                    valB = String(b.currentStock ?? b.quantity ?? 0);
                } else if (key === 'allocatedQuantity') {
                    valA = String(a.allocatedQuantity ?? 0);
                    valB = String(b.allocatedQuantity ?? 0);
                } else if (key === 'unit') {
                    valA = a.unit || '';
                    valB = b.unit || '';
                } else if (key === 'type') {
                    valA = a.type || '';
                    valB = b.type || '';
                } else {
                    valA = String(a[key] || '');
                    valB = String(b[key] || '');
                }

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
    };

    const filteredData = useMemo(() => applyFiltersAndSort(data, false), [data, filters, searchQuery, sortConfig]);
    const filteredInHouseData = useMemo(() => applyFiltersAndSort(inHouseData, true), [inHouseData, filters, searchQuery, sortConfig]);

    const isFilterOrSortActive = Object.keys(filters).length > 0 || sortConfig !== null || searchQuery !== '';
    const activeFilterCount = Object.keys(filters).length;

    const exportToExcel = () => {
        const currentData = activeSubTab !== 'inhouse' ? filteredData : filteredInHouseData;
        const exportData = currentData.map((item, idx) => ({
            'S.No': idx + 1,
            'Material Name': item.materialName || item.componentName || item.name || '-',
            'Description': item.descriptions || item.description || '-',
            'Stock': item.currentStock ?? item.quantity ?? 0,
            'Unit': item.unit || '-',
            'Category': getCategoryValue(item),
            'Location': getLocationValue(item)
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        const sheetName = activeSubTab === 'bo' ? 'BO Items' : (activeSubTab === 'consumable' ? 'Consumables' : (activeSubTab === 'inhouse' ? 'FG Items' : 'RM Items'));
        XLSX.utils.book_append_sheet(wb, ws, sheetName);

        const fileName = `${sheetName.replace(/\s+/g, '_')}_Inventory_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, fileName);
    };

    return (
        <div className="w-full bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
            {/* Top Toolbar */}
            <div className="p-3.5 sm:p-4 border-b border-gray-200 dark:border-gray-800 flex flex-col xl:flex-row justify-between items-stretch xl:items-center gap-3 bg-gray-50/50 dark:bg-gray-900/50">
                {/* Left side: Count & Reset Filters */}
                <div className="flex items-center flex-wrap gap-2.5">
                    <span className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                        Showing <span className="font-bold text-gray-900 dark:text-gray-100">{activeSubTab === 'inhouse' ? filteredInHouseData.length : filteredData.length}</span> items
                    </span>

                    {/* Reset Filters Chip */}
                    {isFilterOrSortActive && (
                        <button
                            type="button"
                            onClick={clearAllFilters}
                            className="px-2.5 py-1.5 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                            title="Reset all column filters and sorting"
                        >
                            <RotateCcw size={13} />
                            <span>Reset Filters</span>
                            {activeFilterCount > 0 && (
                                <span className="bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100 px-1.5 py-0.2 rounded-full text-[10px]">
                                    {activeFilterCount}
                                </span>
                            )}
                        </button>
                    )}
                </div>

                {/* Right side: Search, Create GRN, Excel Actions */}
                <div className="flex flex-wrap items-center gap-2.5 justify-end">
                    {/* Search Bar */}
                    <div className="relative flex-1 sm:w-64 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            type="text"
                            placeholder="Search by Name or Description..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm text-gray-900 dark:text-gray-100 placeholder-gray-400"
                        />
                    </div>

                    {/* Refresh Data Button */}
                    {refetch && (
                        <button
                            type="button"
                            onClick={handleRefresh}
                            disabled={isRefreshing}
                            className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0 border border-slate-200/60 dark:border-slate-700 shadow-sm"
                            title="Refresh latest inventory data"
                        >
                            <RefreshCw size={13} className={isRefreshing ? "animate-spin text-indigo-600 dark:text-indigo-400" : "text-slate-500 dark:text-slate-400"} />
                            <span>Refresh Data</span>
                        </button>
                    )}

                    {/* Create GRN Button */}
                    {onCreateGRN && (
                        <button
                            onClick={onCreateGRN}
                            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm transition-all font-bold text-xs active:scale-95 whitespace-nowrap cursor-pointer"
                            title="Create a new Goods Receipt Note (GRN)"
                        >
                            <Package size={15} />
                            <span>Create GRN</span>
                        </button>
                    )}

                    {/* Single Excel Actions Dropdown Button (Desktop only) */}
                    <div className="relative hidden md:block" ref={excelMenuRef}>
                        <button
                            onClick={() => setIsExcelMenuOpen(!isExcelMenuOpen)}
                            className="flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer whitespace-nowrap"
                            title="Excel Import, Export, and Template options"
                        >
                            <FileSpreadsheet size={15} />
                            <span>Excel Actions</span>
                            <ChevronDown size={14} className={`transition-transform duration-200 ${isExcelMenuOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {/* Dropdown Options Menu */}
                        {isExcelMenuOpen && (
                            <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 py-1.5 z-30 animate-in fade-in slide-in-from-top-2 duration-150">
                                <button
                                    onClick={() => {
                                        exportToExcel();
                                        setIsExcelMenuOpen(false);
                                    }}
                                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 transition-colors text-left cursor-pointer"
                                >
                                    <Download size={15} className="text-emerald-600" />
                                    <span>Export List (Excel)</span>
                                </button>
                                <button
                                    onClick={() => {
                                        setIsImportModalOpen(true);
                                        setIsExcelMenuOpen(false);
                                    }}
                                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-700 transition-colors text-left cursor-pointer"
                                >
                                    <FileSpreadsheet size={15} className="text-blue-600" />
                                    <span>Import Excel</span>
                                </button>
                                <div className="my-1 border-t border-gray-100 dark:border-gray-700" />
                                <button
                                    onClick={() => {
                                        downloadMasterExcelTemplate(activeSubTab === 'consumable' ? 'consumable-item' : activeSubTab === 'bo' ? 'rm-bo-item' : 'inhouse-items');
                                        setIsExcelMenuOpen(false);
                                    }}
                                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-700 transition-colors text-left cursor-pointer"
                                >
                                    <FileDown size={15} className="text-indigo-600" />
                                    <span>Download Template</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Sub Tabs (if not hidden by parent) */}
            {!hideTabs && (
                <div className="flex border-b border-gray-200 px-6">
                    <button
                        onClick={() => {
                            onSubTabChange('bo');
                            clearAllFilters();
                        }}
                        className={`flex items-center gap-2 py-4 px-4 text-sm font-medium border-b-2 transition-colors ${activeSubTab === 'bo'
                            ? 'border-indigo-600 text-indigo-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                    >
                        <Package size={18} />
                        BO
                    </button>
                    <button
                        onClick={() => {
                            onSubTabChange('inhouse');
                            clearAllFilters();
                        }}
                        className={`flex items-center gap-2 py-4 px-4 text-sm font-medium border-b-2 transition-colors ${activeSubTab === 'inhouse'
                            ? 'border-indigo-600 text-indigo-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                    >
                        <Factory size={18} />
                        In-House
                    </button>
                </div>
            )}

            {/* Display Content */}
            {activeSubTab !== 'inhouse' ? (
                // Inventory Table (RM/BO & Consumables)
                <>
                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto min-h-[400px]">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 dark:bg-slate-800/80 border-b border-gray-200 dark:border-slate-700 text-xs text-gray-700 dark:text-gray-300 uppercase sticky top-0 z-10">
                                <tr>
                                    <th className="px-5 py-3 text-left">
                                        <ColumnFilter
                                            column="materialName"
                                            title="Material Name"
                                            data={data}
                                            currentFilters={filters['materialName'] || []}
                                            onFilterChange={(vals) => handleFilterChange('materialName', vals)}
                                            getValue={(item) => item.materialName || item.name || '-'}
                                            sortConfig={sortConfig}
                                            onSortChange={handleSortChange}
                                        />
                                    </th>
                                    <th className="px-5 py-3 text-left">
                                        <ColumnFilter
                                            column="descriptions"
                                            title="Description"
                                            data={data}
                                            currentFilters={filters['descriptions'] || []}
                                            onFilterChange={(vals) => handleFilterChange('descriptions', vals)}
                                            getValue={getDescriptionValue}
                                            sortConfig={sortConfig}
                                            onSortChange={handleSortChange}
                                        />
                                    </th>
                                    <th className="px-5 py-3 text-left">
                                        <ColumnFilter
                                            column="currentStock"
                                            title="Stock"
                                            data={data}
                                            currentFilters={filters['currentStock'] || []}
                                            onFilterChange={(vals) => handleFilterChange('currentStock', vals)}
                                            getValue={getStockValue}
                                            sortConfig={sortConfig}
                                            onSortChange={handleSortChange}
                                        />
                                    </th>
                                    <th className="px-5 py-3 text-left">
                                        <ColumnFilter
                                            column="monthlyFlow"
                                            title="Monthly Flow"
                                            data={data}
                                            currentFilters={filters['monthlyFlow'] || []}
                                            onFilterChange={(vals) => handleFilterChange('monthlyFlow', vals)}
                                            getValue={getMonthlyFlowValue}
                                            sortConfig={sortConfig}
                                            onSortChange={handleSortChange}
                                        />
                                    </th>
                                    <th className="px-5 py-3 text-left">
                                        <ColumnFilter
                                            column="unit"
                                            title="Unit"
                                            data={data}
                                            currentFilters={filters['unit'] || []}
                                            onFilterChange={(vals) => handleFilterChange('unit', vals)}
                                            getValue={(item) => item.unit || '-'}
                                            sortConfig={sortConfig}
                                            onSortChange={handleSortChange}
                                        />
                                    </th>
                                    <th className="px-5 py-3 text-left">
                                        <ColumnFilter
                                            column="category"
                                            title="Category"
                                            data={data}
                                            currentFilters={filters['category'] || []}
                                            onFilterChange={(vals) => handleFilterChange('category', vals)}
                                            getValue={getCategoryValue}
                                            sortConfig={sortConfig}
                                            onSortChange={handleSortChange}
                                        />
                                    </th>
                                    <th className="px-5 py-3 text-left">
                                        <ColumnFilter
                                            column="location"
                                            title="Location"
                                            data={data}
                                            currentFilters={filters['location'] || []}
                                            onFilterChange={(vals) => handleFilterChange('location', vals)}
                                            getValue={getLocationValue}
                                            sortConfig={sortConfig}
                                            onSortChange={handleSortChange}
                                        />
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-slate-800 text-xs">
                                {filteredData.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                                            No inventory items match the current filters.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredData.map((item, index) => (
                                        <tr
                                            key={`${item._id}-${index}`}
                                            onClick={() => onItemClick && onItemClick(item)}
                                            className="hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 transition-colors cursor-pointer"
                                        >
                                            <td className="px-5 py-3.5 font-bold text-gray-900 dark:text-white">
                                                {item.materialName || item.name || '-'}
                                            </td>
                                            <td className="px-5 py-3.5 text-gray-600 dark:text-gray-300 max-w-xs truncate" title={item.descriptions || item.description || '-'}>
                                                {item.descriptions || item.description || '-'}
                                            </td>
                                            <td className={`px-5 py-3.5 font-mono font-bold ${item.currentStock < item.reorderLevel ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                                                {item.currentStock}
                                                {item.qcPendingStock ? <span className="text-gray-400 text-xs ml-1 font-normal" title="Pending QC">({item.qcPendingStock})</span> : null}
                                            </td>
                                            <td className="px-5 py-3.5" onDoubleClick={(e) => handleOpeningStockEditClick(e, item)}>
                                                {editingStockId === item._id ? (
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="number"
                                                            value={editingStockValue}
                                                            onChange={(e) => setEditingStockValue(Number(e.target.value))}
                                                            className="w-20 px-2 py-1 border rounded text-xs text-gray-900"
                                                            onClick={e => e.stopPropagation()}
                                                            onKeyDown={(e) => e.key === 'Enter' && handleOpeningStockSave(e, item)}
                                                            autoFocus
                                                        />
                                                        <button
                                                            onClick={(e) => handleOpeningStockSave(e, item)}
                                                            disabled={isUpdating}
                                                            className="px-2 py-1 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-700"
                                                        >
                                                            {isUpdating ? '...' : 'Save'}
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setEditingStockId(null); }}
                                                            className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300"
                                                        >
                                                            X
                                                        </button>
                                                    </div>
                                                ) : item.monthlyData ? (
                                                    <span className="flex items-center gap-1 font-medium text-gray-700 dark:text-gray-300 cursor-pointer" title="Double click to edit opening stock">
                                                        <span className="text-emerald-600 font-bold" title="Inward">(+{item.monthlyData.totalInwardQuantity || item.monthlyData.received || 0})</span>
                                                        <span className="text-rose-600 font-bold" title="Outward">(-{item.monthlyData.totalOutwardQuantity || item.monthlyData.issued || 0})</span>
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400 cursor-pointer hover:text-gray-600" title="Double click to edit opening stock">-</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-3.5 text-gray-600 dark:text-gray-300">{item.unit || '-'}</td>
                                            <td className="px-5 py-3.5 text-gray-600 dark:text-gray-300">
                                                {getCategoryValue(item)}
                                            </td>
                                            <td className="px-5 py-3.5 text-gray-600 dark:text-gray-300">
                                                {getLocationValue(item)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden flex flex-col gap-3 p-3 sm:p-4 pb-28 sm:pb-20">
                        {filteredData.length === 0 ? (
                            <div className="text-center text-gray-500 py-8">No inventory items found.</div>
                        ) : (
                            filteredData.map((item, index) => (
                                <div
                                    key={`${item._id}-${index}`}
                                    onClick={() => onItemClick && onItemClick(item)}
                                    className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col gap-2 active:scale-95 transition-transform"
                                >
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h4 className="font-bold text-gray-900 dark:text-white text-sm">{item.materialName || item.name}</h4>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">{item.descriptions || item.description || '-'}</p>
                                        </div>
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${item.currentStock <= item.reorderLevel ? "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"}`}>
                                            {item.currentStock} {item.qcPendingStock ? `(${item.qcPendingStock})` : ''} {item.unit}
                                        </span>
                                    </div>

                                    {item.monthlyData && (
                                        <div className="flex items-center gap-2 text-xs mt-1 bg-gray-50 dark:bg-gray-700/40 p-1.5 rounded-lg border border-gray-100 dark:border-gray-700 w-fit group">
                                            {editingStockId === item._id ? (
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="number"
                                                        value={editingStockValue}
                                                        onChange={(e) => setEditingStockValue(Number(e.target.value))}
                                                        className="w-16 px-1 py-1 border rounded text-xs text-gray-900"
                                                        onClick={e => e.stopPropagation()}
                                                        onKeyDown={(e) => e.key === 'Enter' && handleOpeningStockSave(e, item)}
                                                        autoFocus
                                                    />
                                                    <button onClick={(e) => handleOpeningStockSave(e, item)} disabled={isUpdating} className="px-2 py-1 bg-indigo-600 text-white rounded text-[10px]">Save</button>
                                                    <button onClick={(e) => { e.stopPropagation(); setEditingStockId(null); }} className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-[10px]">X</button>
                                                </div>
                                            ) : (
                                                <>
                                                    <span className="text-gray-500 dark:text-gray-400 font-medium">Opening:</span>
                                                    <span className="font-bold text-gray-800 dark:text-gray-200">{item.monthlyData.openingStock}</span>
                                                    <button
                                                        onClick={(e) => handleOpeningStockEditClick(e, item)}
                                                        className="p-1 text-gray-400 hover:text-indigo-600 rounded hover:bg-indigo-50 transition-colors opacity-60 group-hover:opacity-100"
                                                        title="Edit opening stock"
                                                    >
                                                        <Edit2 size={12} />
                                                    </button>
                                                    <span className="text-emerald-600 font-medium ml-1">(+{item.monthlyData.totalInwardQuantity || item.monthlyData.received || 0})</span>
                                                    <span className="text-rose-600 font-medium">(-{item.monthlyData.totalOutwardQuantity || item.monthlyData.issued || 0})</span>
                                                </>
                                            )}
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-gray-50 dark:border-gray-700 text-xs">
                                        <div>
                                            <span className="text-gray-500 dark:text-gray-400 block text-[10px] uppercase font-bold">Category</span>
                                            <span className="text-gray-700 dark:text-gray-200 font-medium">
                                                {getCategoryValue(item)}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-gray-500 dark:text-gray-400 block text-[10px] uppercase font-bold">Location</span>
                                            <span className="text-gray-700 dark:text-gray-200 font-medium">
                                                {getLocationValue(item)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </>
            ) : (
                // InHouse Table (FG Components)
                <>
                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto min-h-[400px]">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 dark:bg-slate-800/80 border-b border-gray-200 dark:border-slate-700 text-xs text-gray-700 dark:text-gray-300 uppercase sticky top-0 z-10">
                                <tr>
                                    <th className="px-5 py-3 text-left">
                                        <ColumnFilter
                                            column="name"
                                            title="Product Name"
                                            data={inHouseData}
                                            currentFilters={filters['name'] || []}
                                            onFilterChange={(vals) => handleFilterChange('name', vals)}
                                            getValue={(item) => item.name || item.componentName || '-'}
                                            sortConfig={sortConfig}
                                            onSortChange={handleSortChange}
                                        />
                                    </th>
                                    <th className="px-5 py-3 text-left">
                                        <ColumnFilter
                                            column="description"
                                            title="Description"
                                            data={inHouseData}
                                            currentFilters={filters['description'] || []}
                                            onFilterChange={(vals) => handleFilterChange('description', vals)}
                                            getValue={(item) => item.description || '-'}
                                            sortConfig={sortConfig}
                                            onSortChange={handleSortChange}
                                        />
                                    </th>
                                    <th className="px-5 py-3 text-left">
                                        <ColumnFilter
                                            column="type"
                                            title="Classification"
                                            data={inHouseData}
                                            currentFilters={filters['type'] || []}
                                            onFilterChange={(vals) => handleFilterChange('type', vals)}
                                            getValue={(item) => item.type || '-'}
                                            sortConfig={sortConfig}
                                            onSortChange={handleSortChange}
                                        />
                                    </th>
                                    <th className="px-5 py-3 text-left">
                                        <ColumnFilter
                                            column="quantity"
                                            title="Total Stock"
                                            data={inHouseData}
                                            currentFilters={filters['quantity'] || []}
                                            onFilterChange={(vals) => handleFilterChange('quantity', vals)}
                                            getValue={(item) => String(item.quantity || 0)}
                                            sortConfig={sortConfig}
                                            onSortChange={handleSortChange}
                                        />
                                    </th>
                                    <th className="px-5 py-3 text-left">
                                        <ColumnFilter
                                            column="monthlyFlow"
                                            title="Monthly Flow"
                                            data={inHouseData}
                                            currentFilters={filters['monthlyFlow'] || []}
                                            onFilterChange={(vals) => handleFilterChange('monthlyFlow', vals)}
                                            getValue={getMonthlyFlowValue}
                                            sortConfig={sortConfig}
                                            onSortChange={handleSortChange}
                                        />
                                    </th>
                                    <th className="px-5 py-3 text-left">
                                        <ColumnFilter
                                            column="unit"
                                            title="Unit"
                                            data={inHouseData}
                                            currentFilters={filters['unit'] || []}
                                            onFilterChange={(vals) => handleFilterChange('unit', vals)}
                                            getValue={(item) => item.unit || '-'}
                                            sortConfig={sortConfig}
                                            onSortChange={handleSortChange}
                                        />
                                    </th>
                                    <th className="px-5 py-3 text-left">
                                        <ColumnFilter
                                            column="location"
                                            title="Location"
                                            data={inHouseData}
                                            currentFilters={filters['location'] || []}
                                            onFilterChange={(vals) => handleFilterChange('location', vals)}
                                            getValue={getLocationValue}
                                            sortConfig={sortConfig}
                                            onSortChange={handleSortChange}
                                        />
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-slate-800 text-xs">
                                {filteredInHouseData.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                                            No In-House components found matching current filters.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredInHouseData.map((item, index) => (
                                        <tr
                                            key={`${item._id}-${index}`}
                                            onClick={() => onItemClick && onItemClick(item)}
                                            className="hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 transition-colors cursor-pointer"
                                        >
                                            <td className="px-5 py-3.5 font-bold text-gray-900 dark:text-white">{item.name || item.componentName || '-'}</td>
                                            <td className="px-5 py-3.5 text-gray-600 dark:text-gray-300 truncate max-w-xs" title={item.description}>{item.description || '-'}</td>
                                            <td className="px-5 py-3.5 text-gray-600 dark:text-gray-300">
                                                <span className="px-2 py-0.5 rounded-full text-xs font-semibold border bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800">
                                                    {item.type || 'Component'}
                                                </span>
                                            </td>
                                            <td className={`px-5 py-3.5 font-mono font-bold ${item.quantity <= (item.reorderLevel || 0) ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                                                {item.quantity}
                                            </td>
                                            <td className="px-5 py-3.5">
                                                {editingStockId === item._id ? (
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="number"
                                                            value={editingStockValue}
                                                            onChange={(e) => setEditingStockValue(Number(e.target.value))}
                                                            className="w-20 px-2 py-1 border rounded text-xs text-gray-900"
                                                            onClick={e => e.stopPropagation()}
                                                            onKeyDown={(e) => e.key === 'Enter' && handleOpeningStockSave(e, item)}
                                                            autoFocus
                                                        />
                                                        <button
                                                            onClick={(e) => handleOpeningStockSave(e, item)}
                                                            disabled={isUpdating}
                                                            className="px-2 py-1 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-700"
                                                        >
                                                            {isUpdating ? '...' : 'Save'}
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setEditingStockId(null); }}
                                                            className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300"
                                                        >
                                                            X
                                                        </button>
                                                    </div>
                                                ) : item.monthlyData ? (
                                                    <div className="flex items-center gap-1 font-medium text-gray-700 dark:text-gray-300">
                                                        <span className="text-emerald-600 font-bold" title="Inward">(+{item.monthlyData.totalInwardQuantity || 0})</span>
                                                        <span className="text-rose-600 font-bold" title="Outward">(-{item.monthlyData.totalOutwardQuantity || 0})</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-400">-</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-3.5 text-gray-600 dark:text-gray-300">{item.unit || '-'}</td>
                                            <td className="px-5 py-3.5 text-gray-600 dark:text-gray-300">
                                                {getLocationValue(item)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden flex flex-col gap-3 p-3 sm:p-4 pb-28 sm:pb-20">
                        {filteredInHouseData.length === 0 ? (
                            <div className="text-center text-gray-500 py-8">No In-House components found.</div>
                        ) : (
                            filteredInHouseData.map((item, index) => (
                                <div
                                    key={`${item._id}-${index}`}
                                    onClick={() => onItemClick && onItemClick(item)}
                                    className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col gap-2 active:scale-95 transition-transform"
                                >
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h4 className="font-bold text-gray-900 dark:text-white text-sm">{item.name || item.componentName}</h4>
                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800 mt-1 inline-block">
                                                {item.type || "Component"}
                                            </span>
                                        </div>
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${item.quantity <= (item.reorderLevel || 0) ? "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"}`}>
                                            {item.quantity} {item.unit || ''}
                                        </span>
                                    </div>

                                    {item.monthlyData && (
                                        <div className="flex items-center gap-2 text-xs mt-1 bg-gray-50 dark:bg-gray-700/40 p-1.5 rounded-lg border border-gray-100 dark:border-gray-700 w-fit group">
                                            {editingStockId === item._id ? (
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="number"
                                                        value={editingStockValue}
                                                        onChange={(e) => setEditingStockValue(Number(e.target.value))}
                                                        className="w-16 px-1 py-1 border rounded text-xs text-gray-900"
                                                        onClick={e => e.stopPropagation()}
                                                        onKeyDown={(e) => e.key === 'Enter' && handleOpeningStockSave(e, item)}
                                                        autoFocus
                                                    />
                                                    <button onClick={(e) => handleOpeningStockSave(e, item)} disabled={isUpdating} className="px-2 py-1 bg-indigo-600 text-white rounded text-[10px]">Save</button>
                                                    <button onClick={(e) => { e.stopPropagation(); setEditingStockId(null); }} className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-[10px]">X</button>
                                                </div>
                                            ) : (
                                                <>
                                                    <span className="text-gray-500 dark:text-gray-400 font-medium">Opening:</span>
                                                    <span className="font-bold text-gray-800 dark:text-gray-200">{item.monthlyData.openingStock}</span>
                                                    <button
                                                        onClick={(e) => handleOpeningStockEditClick(e, item)}
                                                        className="p-1 text-gray-400 hover:text-indigo-600 rounded hover:bg-indigo-50 transition-colors opacity-60 group-hover:opacity-100"
                                                        title="Edit opening stock"
                                                    >
                                                        <Edit2 size={12} />
                                                    </button>
                                                    <span className="text-emerald-600 font-medium ml-1">(+{item.monthlyData.totalInwardQuantity || 0})</span>
                                                    <span className="text-rose-600 font-medium">(-{item.monthlyData.totalOutwardQuantity || 0})</span>
                                                </>
                                            )}
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-gray-50 dark:border-gray-700 text-xs">
                                        <div>
                                            <span className="text-gray-500 dark:text-gray-400 block text-[10px] uppercase font-bold">Description</span>
                                            <span className="text-gray-700 dark:text-gray-200 font-medium truncate" title={item.description}>
                                                {item.description || '-'}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-gray-500 dark:text-gray-400 block text-[10px] uppercase font-bold">Location</span>
                                            <span className="text-gray-700 dark:text-gray-200 font-medium">
                                                {getLocationValue(item)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </>
            )}

            <MasterExcelImportModal
                isOpen={isImportModalOpen}
                masterTab={activeSubTab === 'consumable' ? 'consumable-item' : activeSubTab === 'bo' ? 'rm-bo-item' : 'inhouse-items'}
                onClose={() => setIsImportModalOpen(false)}
                onSuccess={() => {
                    if (refetch) refetch();
                }}
            />
        </div>
    );
}

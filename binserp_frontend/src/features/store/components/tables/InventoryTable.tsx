/**
 * InventoryTable Component
 * 
 * Displays inventory data in a table format with Excel-style column filters & sorting.
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { InventoryItem } from "@/src/features/store/types/store.types";
import { Package, Factory, Download, Search, FileSpreadsheet, ChevronDown, ChevronLeft, ChevronRight, FileDown, RotateCcw, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx';
import ColumnFilter from './ColumnFilter';
import MasterExcelImportModal from '../modals/MasterExcelImportModal';
import { downloadMasterExcelTemplate } from '@/src/utils/excelMasterHelper';
import { ItemNameAndDescription } from '@/src/utils/itemDisplayHelper';

const getPageNumbers = (current: number, total: number): (number | string)[] => {
  if (total <= 5) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  if (current <= 3) {
    return [1, 2, 3, 4, '...', total];
  }
  if (current >= total - 2) {
    return [1, '...', total - 3, total - 2, total - 1, total];
  }
  return [1, '...', current - 1, current, current + 1, '...', total];
};

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

    // Format quantities cleanly (up to 3 decimal places without trailing zeros)
    const formatQty = (val: number | string | undefined | null): string => {
        if (val === undefined || val === null || val === '') return '0';
        const num = Number(val);
        if (isNaN(num)) return '0';
        return Number(num.toFixed(3)).toString();
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
    
    const getStockValue = (item: any) => {
        const stock = Number(item.currentStock ?? item.quantity ?? 0);
        return `${formatQty(stock)} ${item.unit || 'PCS'}`;
    };
    const getPrimaryStockValue = getStockValue;

    const getSecondaryStockValue = (item: any) => {
        if (!item.hasSecondaryUnit || !item.secondaryUnit) return '-';
        const factor = Number(item.conversionFactor) || 1;
        const stock = Number(item.currentStock ?? item.quantity ?? 0);
        return `${formatQty(stock * factor)} ${item.secondaryUnit}`;
    };

    const getMonthlyFlowValue = (item: any) => {
        if (!item.monthlyData) return '-';
        const inQty = item.monthlyData.totalInwardQuantity || item.monthlyData.received || 0;
        const outQty = item.monthlyData.totalOutwardQuantity || item.monthlyData.issued || 0;
        let flowStr = `+${formatQty(inQty)} / -${formatQty(outQty)} ${item.unit || 'PCS'}`;
        if (item.hasSecondaryUnit && item.secondaryUnit) {
            const factor = Number(item.conversionFactor) || 1;
            flowStr += ` (+${formatQty(inQty * factor)} / -${formatQty(outQty * factor)} ${item.secondaryUnit})`;
        }
        return flowStr;
    };

    const getMinStockValue = (item: any) => {
        const min = Number(item.reorderLevel ?? item.minimumStock ?? 0);
        let minStr = `${formatQty(min)} ${item.unit || 'PCS'}`;
        if (item.hasSecondaryUnit && item.secondaryUnit) {
            const factor = Number(item.conversionFactor) || 1;
            minStr += ` (${formatQty(min * factor)} ${item.secondaryUnit})`;
        }
        return minStr;
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
                } else if (key === 'secondaryStock') {
                    itemValue = getSecondaryStockValue(item);
                } else if (key === 'monthlyFlow') {
                    itemValue = getMonthlyFlowValue(item);
                } else if (key === 'reorderLevel') {
                    itemValue = getMinStockValue(item);
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
                let valA: any = '';
                let valB: any = '';

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
                    valA = Number(a.currentStock ?? a.quantity ?? 0);
                    valB = Number(b.currentStock ?? b.quantity ?? 0);
                    return direction === 'asc' ? valA - valB : valB - valA;
                } else if (key === 'secondaryStock') {
                    const factorA = a.hasSecondaryUnit ? (Number(a.conversionFactor) || 1) : 0;
                    const factorB = b.hasSecondaryUnit ? (Number(b.conversionFactor) || 1) : 0;
                    valA = Number(a.currentStock ?? a.quantity ?? 0) * factorA;
                    valB = Number(b.currentStock ?? b.quantity ?? 0) * factorB;
                    return direction === 'asc' ? valA - valB : valB - valA;
                } else if (key === 'reorderLevel') {
                    valA = Number(a.reorderLevel ?? a.minimumStock ?? 0);
                    valB = Number(b.reorderLevel ?? b.minimumStock ?? 0);
                    return direction === 'asc' ? valA - valB : valB - valA;
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
                    cmp = String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: 'base' });
                }

                return direction === 'asc' ? cmp : -cmp;
            });
        }

        return result;
    };

    const filteredData = useMemo(() => applyFiltersAndSort(data, false), [data, filters, searchQuery, sortConfig]);
    const filteredInHouseData = useMemo(() => applyFiltersAndSort(inHouseData, true), [inHouseData, filters, searchQuery, sortConfig]);

    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);

    // Active dataset based on subtab
    const activeData = activeSubTab === 'inhouse' ? filteredInHouseData : filteredData;
    const totalCount = activeData.length;
    const totalPages = Math.ceil(totalCount / pageSize) || 1;

    // Paginated datasets for high-performance rendering
    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredData.slice(start, start + pageSize);
    }, [filteredData, currentPage, pageSize]);

    const paginatedInHouseData = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredInHouseData.slice(start, start + pageSize);
    }, [filteredInHouseData, currentPage, pageSize]);

    const startEntry = totalCount === 0 ? 0 : ((currentPage - 1) * pageSize) + 1;
    const endEntry = Math.min(currentPage * pageSize, totalCount);

    // Reset pagination when filters, search, or subtab change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, filters, sortConfig, activeSubTab]);

    const isFilterOrSortActive = Object.keys(filters).length > 0 || sortConfig !== null || searchQuery !== '';
    const activeFilterCount = Object.keys(filters).length;

    const exportToExcel = () => {
        const currentData = activeSubTab !== 'inhouse' ? filteredData : filteredInHouseData;
        const exportData = currentData.map((item, idx) => {
            const hasSec = Boolean(item.hasSecondaryUnit && item.secondaryUnit);
            const factor = Number(item.conversionFactor) || 1;
            const currentStock = Number(item.currentStock ?? item.quantity ?? 0);
            const reorderLevel = Number(item.reorderLevel ?? item.minimumStock ?? 0);
            const inward = Number(item.monthlyData?.totalInwardQuantity || item.monthlyData?.received || 0);
            const outward = Number(item.monthlyData?.totalOutwardQuantity || item.monthlyData?.issued || 0);

            return {
                'S.No': idx + 1,
                'Item Name': item.materialName || item.componentName || item.name || '-',
                'Description': item.descriptions || item.description || '-',
                'Category': getCategoryValue(item),
                'Location': getLocationValue(item),
                'Primary Stock': currentStock,
                'Primary Unit': item.unit || 'PCS',
                'Secondary Stock': hasSec ? formatQty(currentStock * factor) : '-',
                'Secondary Unit': hasSec ? item.secondaryUnit : '-',
                'Conversion Factor': hasSec ? `1 ${item.unit || 'Unit'} = ${factor} ${item.secondaryUnit}` : '-',
                'Monthly Inward (Primary)': inward,
                'Monthly Outward (Primary)': outward,
                'Monthly Inward (Secondary)': hasSec ? formatQty(inward * factor) : '-',
                'Monthly Outward (Secondary)': hasSec ? formatQty(outward * factor) : '-',
                'Min Stock (Primary)': reorderLevel,
                'Min Stock (Secondary)': hasSec ? formatQty(reorderLevel * factor) : '-',
            };
        });

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        const sheetName = activeSubTab === 'bo' ? 'BO Items' : (activeSubTab === 'consumable' ? 'Consumables' : (activeSubTab === 'inhouse' ? 'FG Items' : 'RM Items'));
        XLSX.utils.book_append_sheet(wb, ws, sheetName);

        const fileName = `${sheetName.replace(/\s+/g, '_')}_Inventory_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, fileName);
    };

    return (
        <div className="w-full h-full bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden">
            {/* Top Toolbar */}
            <div className="p-3.5 sm:p-4 border-b border-gray-200 dark:border-gray-800 flex flex-col xl:flex-row justify-between items-stretch xl:items-center gap-3 bg-gray-50/50 dark:bg-gray-900/50 shrink-0">
                {/* Left side: Count & Reset Filters */}
                <div className="flex items-center flex-wrap gap-2.5">
                    <span className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                        Showing <span className="font-bold text-gray-900 dark:text-gray-100">{startEntry}</span>–<span className="font-bold text-gray-900 dark:text-gray-100">{endEntry}</span> of <span className="font-bold text-indigo-600 dark:text-indigo-400">{totalCount}</span> items
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
                            className="px-2.5 sm:px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0 border border-slate-200/60 dark:border-slate-700 shadow-sm"
                            title="Refresh latest inventory data"
                        >
                            <RefreshCw size={13} className={isRefreshing ? "animate-spin text-indigo-600 dark:text-indigo-400" : "text-slate-500 dark:text-slate-400"} />
                            <span className="hidden sm:inline">Refresh Data</span>
                        </button>
                    )}

                    {/* Create GRN Button */}
                    {onCreateGRN && (
                        <button
                            onClick={onCreateGRN}
                            className="flex items-center gap-1.5 px-3 sm:px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm transition-all font-bold text-xs active:scale-95 whitespace-nowrap cursor-pointer shrink-0"
                            title="Create a new Goods Receipt Note (GRN)"
                        >
                            <Package size={15} />
                            <span className="hidden xs:inline">Create </span><span>GRN</span>
                        </button>
                    )}

                    {/* Single Excel Actions Dropdown Button (Desktop only) */}
                    <div className="relative hidden md:block shrink-0" ref={excelMenuRef}>
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
                    <div className="hidden md:block overflow-x-auto flex-1 relative">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 dark:bg-slate-800/80 border-b border-gray-200 dark:border-slate-700 text-xs text-gray-700 dark:text-gray-300 uppercase sticky top-0 z-10">
                                <tr>
                                    <th className="px-5 py-3 text-left">
                                        <ColumnFilter
                                            column="materialName"
                                            title="Item Details"
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
                                    <th className="px-5 py-3 text-left">
                                        <ColumnFilter
                                            column="currentStock"
                                            title="Primary Stock"
                                            data={data}
                                            currentFilters={filters['currentStock'] || []}
                                            onFilterChange={(vals) => handleFilterChange('currentStock', vals)}
                                            getValue={getPrimaryStockValue}
                                            sortConfig={sortConfig}
                                            onSortChange={handleSortChange}
                                        />
                                    </th>
                                    <th className="px-5 py-3 text-left">
                                        <ColumnFilter
                                            column="secondaryStock"
                                            title="Secondary Stock"
                                            data={data}
                                            currentFilters={filters['secondaryStock'] || []}
                                            onFilterChange={(vals) => handleFilterChange('secondaryStock', vals)}
                                            getValue={getSecondaryStockValue}
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
                                            column="reorderLevel"
                                            title="Min Stock"
                                            data={data}
                                            currentFilters={filters['reorderLevel'] || []}
                                            onFilterChange={(vals) => handleFilterChange('reorderLevel', vals)}
                                            getValue={getMinStockValue}
                                            sortConfig={sortConfig}
                                            onSortChange={handleSortChange}
                                        />
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-slate-800 text-xs">
                                {paginatedData.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                                            No inventory items match the current filters.
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedData.map((item, index) => {
                                        const isLowStock = (item.currentStock || 0) < (item.reorderLevel || 0);
                                        const hasSec = item.hasSecondaryUnit && item.secondaryUnit && (item.conversionFactor || 0) > 0;
                                        const secStock = hasSec ? (item.currentStock || 0) * (item.conversionFactor || 1) : 0;
                                        const inward = item.monthlyData?.totalInwardQuantity || item.monthlyData?.received || 0;
                                        const outward = item.monthlyData?.totalOutwardQuantity || item.monthlyData?.issued || 0;

                                        return (
                                            <tr
                                                key={`${item._id}-${index}`}
                                                onClick={() => onItemClick && onItemClick(item)}
                                                className="hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 transition-colors cursor-pointer"
                                            >
                                                {/* 1. Item Details */}
                                                <td className="px-5 py-3.5 max-w-xs">
                                                    <ItemNameAndDescription
                                                        name={item.materialName || item.name || '-'}
                                                        description={item.descriptions || item.description || ''}
                                                    />
                                                </td>

                                                {/* 2. Category */}
                                                <td className="px-5 py-3.5 text-gray-600 dark:text-gray-300">
                                                    {getCategoryValue(item)}
                                                </td>

                                                {/* 3. Location */}
                                                <td className="px-5 py-3.5 text-gray-600 dark:text-gray-300">
                                                    {getLocationValue(item)}
                                                </td>

                                                {/* 4. Primary Stock */}
                                                <td className="px-5 py-3.5 font-mono">
                                                    <span className={`font-bold ${isLowStock ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                                                        {formatQty(item.currentStock)} {item.unit || ''}
                                                    </span>
                                                    {item.qcPendingStock ? (
                                                        <span className="text-gray-400 text-xs ml-1 font-normal" title="Pending QC">
                                                            (+{formatQty(item.qcPendingStock)} QC)
                                                        </span>
                                                    ) : null}
                                                </td>

                                                {/* 5. Secondary Stock */}
                                                <td className="px-5 py-3.5">
                                                    {hasSec ? (
                                                        <div className="flex flex-col">
                                                            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                                                {formatQty(secStock)} {item.secondaryUnit}
                                                            </span>
                                                            <span className="text-[10px] text-gray-400 font-mono">
                                                                1 {item.unit} = {item.conversionFactor} {item.secondaryUnit}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-400 font-mono text-xs">-</span>
                                                    )}
                                                </td>

                                                {/* 6. Monthly Flow */}
                                                <td className="px-5 py-3.5">
                                                    {item.monthlyData ? (
                                                        <div className="flex flex-col gap-0.5">
                                                            <div className="flex items-center gap-1 font-medium text-xs font-mono">
                                                                <span className="text-emerald-600 font-bold" title="Inward">
                                                                    (+{formatQty(inward)})
                                                                </span>
                                                                <span className="text-rose-600 font-bold" title="Outward">
                                                                    (-{formatQty(outward)})
                                                                </span>
                                                                <span className="text-gray-500 text-[11px] font-normal">{item.unit || ''}</span>
                                                            </div>
                                                            {hasSec && (
                                                                <div className="flex items-center gap-1 text-[11px] font-mono text-gray-500 dark:text-gray-400">
                                                                    <span className="text-emerald-500" title="Secondary Inward">
                                                                        (+{formatQty(inward * (item.conversionFactor || 1))})
                                                                    </span>
                                                                    <span className="text-rose-500" title="Secondary Outward">
                                                                        (-{formatQty(outward * (item.conversionFactor || 1))})
                                                                    </span>
                                                                    <span className="text-[10px]">{item.secondaryUnit}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-400">-</span>
                                                    )}
                                                </td>

                                                {/* 7. Min Stock */}
                                                <td className="px-5 py-3.5 font-mono">
                                                    <div className="font-bold text-gray-700 dark:text-gray-300">
                                                        {formatQty(item.reorderLevel || 0)} {item.unit || ''}
                                                    </div>
                                                    {hasSec && (
                                                        <div className="text-[11px] text-gray-400 font-normal">
                                                            {formatQty((item.reorderLevel || 0) * (item.conversionFactor || 1))} {item.secondaryUnit}
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden flex-1 overflow-y-auto flex flex-col gap-3 p-3 sm:p-4 pb-20">
                        {paginatedData.length === 0 ? (
                            <div className="text-center text-gray-500 py-8">No inventory items found.</div>
                        ) : (
                            paginatedData.map((item, index) => {
                                const isLowStock = (item.currentStock || 0) <= (item.reorderLevel || 0);
                                const hasSec = item.hasSecondaryUnit && item.secondaryUnit && (item.conversionFactor || 0) > 0;
                                const inward = item.monthlyData?.totalInwardQuantity || item.monthlyData?.received || 0;
                                const outward = item.monthlyData?.totalOutwardQuantity || item.monthlyData?.issued || 0;

                                return (
                                    <div
                                        key={`${item._id}-${index}`}
                                        onClick={() => onItemClick && onItemClick(item)}
                                        className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col gap-2.5 active:scale-95 transition-transform"
                                    >
                                        <div className="flex justify-between items-start gap-2">
                                            <div className="flex-1">
                                                <ItemNameAndDescription
                                                    name={item.materialName || item.name || '-'}
                                                    description={item.descriptions || item.description || ''}
                                                />
                                            </div>
                                            <div className="flex flex-col items-end gap-1 shrink-0">
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold font-mono ${isLowStock ? "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"}`}>
                                                    {formatQty(item.currentStock)} {item.qcPendingStock ? `(+${formatQty(item.qcPendingStock)} QC)` : ''} {item.unit}
                                                </span>
                                                {hasSec && (
                                                    <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                                                        {formatQty((item.currentStock || 0) * (item.conversionFactor || 1))} {item.secondaryUnit}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Monthly Flow (Both Units) */}
                                        {item.monthlyData && (
                                            <div className="flex flex-col gap-1 bg-gray-50 dark:bg-gray-700/40 p-2 rounded-lg border border-gray-100 dark:border-gray-700 text-xs">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-gray-500 dark:text-gray-400 font-medium">Monthly Flow:</span>
                                                    <div className="flex items-center gap-1 font-mono">
                                                        <span className="text-emerald-600 font-bold" title="Inward">(+{formatQty(inward)})</span>
                                                        <span className="text-rose-600 font-bold" title="Outward">(-{formatQty(outward)})</span>
                                                        <span className="text-gray-500 text-[10px]">{item.unit}</span>
                                                    </div>
                                                </div>
                                                {hasSec && (
                                                    <div className="flex items-center justify-end gap-1 font-mono text-[11px] text-gray-500">
                                                        <span className="text-emerald-500">(+{formatQty(inward * (item.conversionFactor || 1))})</span>
                                                        <span className="text-rose-500">(-{formatQty(outward * (item.conversionFactor || 1))})</span>
                                                        <span className="text-[10px]">{item.secondaryUnit}</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <div className="grid grid-cols-3 gap-2 mt-1 pt-2 border-t border-gray-50 dark:border-gray-700 text-xs">
                                            <div>
                                                <span className="text-gray-500 dark:text-gray-400 block text-[10px] uppercase font-bold">Category</span>
                                                <span className="text-gray-700 dark:text-gray-200 font-medium truncate block">
                                                    {getCategoryValue(item)}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-gray-500 dark:text-gray-400 block text-[10px] uppercase font-bold">Location</span>
                                                <span className="text-gray-700 dark:text-gray-200 font-medium truncate block">
                                                    {getLocationValue(item)}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-gray-500 dark:text-gray-400 block text-[10px] uppercase font-bold">Min Stock</span>
                                                <span className="text-gray-700 dark:text-gray-200 font-medium font-mono block">
                                                    {formatQty(item.reorderLevel || 0)} {item.unit}
                                                    {hasSec && (
                                                        <span className="block text-[10px] text-gray-400 font-normal">
                                                            {formatQty((item.reorderLevel || 0) * (item.conversionFactor || 1))} {item.secondaryUnit}
                                                        </span>
                                                    )}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </>
            ) : (
                // InHouse Table (FG Components)
                <>
                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto flex-1 relative">
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
                                {paginatedInHouseData.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                                            No In-House components found matching current filters.
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedInHouseData.map((item, index) => (
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
                                            <td className="px-5 py-3.5">
                                                <div className="flex flex-col">
                                                    <span className={`font-mono font-bold ${item.quantity <= (item.reorderLevel || 0) ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                                                        {item.quantity} {item.unit || 'Nos'}
                                                    </span>
                                                    {item.hasSecondaryUnit && item.secondaryUnit && (item.conversionFactor || 0) > 0 && (
                                                        <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 font-mono mt-0.5">
                                                            {formatQty((item.quantity || 0) * (item.conversionFactor || 1))} {item.secondaryUnit}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                {item.monthlyData ? (
                                                    <div className="flex flex-col gap-0.5">
                                                        <div className="flex items-center gap-1 font-medium text-gray-700 dark:text-gray-300 text-xs">
                                                            <span className="text-emerald-600 font-bold" title="Inward">(+{item.monthlyData.totalInwardQuantity || 0})</span>
                                                            <span className="text-rose-600 font-bold" title="Outward">(-{item.monthlyData.totalOutwardQuantity || 0})</span>
                                                            <span className="text-gray-400 text-[10px]">{item.unit || 'Nos'}</span>
                                                        </div>
                                                        {item.hasSecondaryUnit && item.secondaryUnit && (
                                                            <div className="flex items-center gap-1 text-[10px] text-gray-500 font-mono">
                                                                <span className="text-emerald-500">(+{formatQty((item.monthlyData.totalInwardQuantity || 0) * (item.conversionFactor || 1))})</span>
                                                                <span className="text-rose-500">(-{formatQty((item.monthlyData.totalOutwardQuantity || 0) * (item.conversionFactor || 1))})</span>
                                                                <span>{item.secondaryUnit}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-400">-</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-3.5 text-gray-600 dark:text-gray-300">
                                                <div className="flex flex-col">
                                                    <span className="font-semibold">{item.unit || '-'}</span>
                                                    {item.hasSecondaryUnit && item.secondaryUnit && (
                                                        <span className="text-[10px] text-purple-600 dark:text-purple-400 font-mono" title={`1 ${item.unit} = ${item.conversionFactor} ${item.secondaryUnit}`}>
                                                            1 = {item.conversionFactor} {item.secondaryUnit}
                                                        </span>
                                                    )}
                                                </div>
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
                    <div className="md:hidden flex-1 overflow-y-auto flex flex-col gap-3 p-3 sm:p-4 pb-20">
                        {paginatedInHouseData.length === 0 ? (
                            <div className="text-center text-gray-500 py-8">No In-House components found.</div>
                        ) : (
                            paginatedInHouseData.map((item, index) => (
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
                                        <div className="flex flex-col items-end gap-1">
                                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${item.quantity <= (item.reorderLevel || 0) ? "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"}`}>
                                                {item.quantity} {item.unit || ''}
                                            </span>
                                            {item.hasSecondaryUnit && item.secondaryUnit && (item.conversionFactor || 0) > 0 && (
                                                <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                                                    {formatQty((item.quantity || 0) * (item.conversionFactor || 1))} {item.secondaryUnit}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {item.monthlyData && (
                                        <div className="flex flex-col gap-0.5 text-xs mt-1 bg-gray-50 dark:bg-gray-700/40 p-1.5 rounded-lg border border-gray-100 dark:border-gray-700 w-fit">
                                            <div className="flex items-center gap-2">
                                                <span className="text-emerald-600 font-medium">(+{item.monthlyData.totalInwardQuantity || 0})</span>
                                                <span className="text-rose-600 font-medium">(-{item.monthlyData.totalOutwardQuantity || 0})</span>
                                                <span className="text-gray-400 text-[10px]">{item.unit || 'Nos'}</span>
                                            </div>
                                            {item.hasSecondaryUnit && item.secondaryUnit && (
                                                <div className="flex items-center gap-1 text-[10px] text-gray-500 font-mono">
                                                    <span className="text-emerald-500">(+{formatQty((item.monthlyData.totalInwardQuantity || 0) * (item.conversionFactor || 1))})</span>
                                                    <span className="text-rose-500">(-{formatQty((item.monthlyData.totalOutwardQuantity || 0) * (item.conversionFactor || 1))})</span>
                                                    <span>{item.secondaryUnit}</span>
                                                </div>
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

            {/* Unified Bottom Sticky Pagination Toolbar */}
            <div className="px-3 py-2 sm:px-4 sm:py-3 border-t border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 select-none z-10">
                {/* Mobile View (< sm) */}
                <div className="flex sm:hidden items-center justify-between gap-2 text-xs">
                    <div className="text-gray-500 dark:text-slate-400 font-semibold truncate text-[11px]">
                        <span className="text-indigo-600 dark:text-indigo-400 font-bold">{startEntry}–{endEntry}</span> / {totalCount}
                    </div>

                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage <= 1}
                            type="button"
                            className="p-1.5 px-2.5 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-200 bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-white dark:disabled:hover:bg-slate-800 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                            title="Previous Page"
                        >
                            <ChevronLeft size={14} />
                            <span>Prev</span>
                        </button>

                        <span className="px-2 py-1 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-bold rounded-md text-[11px]">
                            {currentPage}/{totalPages}
                        </span>

                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage >= totalPages}
                            type="button"
                            className="p-1.5 px-2.5 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-200 bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-white dark:disabled:hover:bg-slate-800 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                            title="Next Page"
                        >
                            <span>Next</span>
                            <ChevronRight size={14} />
                        </button>

                        <select
                            value={pageSize}
                            onChange={(e) => {
                                setPageSize(Number(e.target.value));
                                setCurrentPage(1);
                            }}
                            className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-200 text-[11px] font-bold rounded-lg px-1.5 py-1.5 shadow-2xs focus:outline-none cursor-pointer ml-1"
                            title="Rows per page"
                        >
                            <option value={10}>10</option>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                        </select>
                    </div>
                </div>

                {/* Desktop View (>= sm) */}
                <div className="hidden sm:flex items-center justify-between gap-3 text-xs">
                    {/* Left: Entries Info */}
                    <div className="text-gray-500 dark:text-slate-400 font-medium">
                        Showing <span className="font-bold text-gray-900 dark:text-white">{startEntry}</span> to <span className="font-bold text-gray-900 dark:text-white">{endEntry}</span> of <span className="font-bold text-indigo-600 dark:text-indigo-400">{totalCount}</span> items
                    </div>

                    {/* Center: Pagination Buttons */}
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage <= 1}
                            type="button"
                            className="px-2.5 py-1.5 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-200 bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-white dark:disabled:hover:bg-slate-800 disabled:cursor-not-allowed rounded-lg font-medium transition-colors flex items-center gap-1 cursor-pointer"
                            title="Previous Page"
                        >
                            <ChevronLeft size={15} />
                            <span className="hidden sm:inline">Prev</span>
                        </button>

                        {/* Dynamic Page Number Buttons */}
                        <div className="flex items-center gap-1">
                            {getPageNumbers(currentPage, totalPages).map((pageNum, idx) => {
                                if (pageNum === '...') {
                                    return (
                                        <span key={`ellipsis-${idx}`} className="px-1.5 py-1 text-gray-400 dark:text-slate-500 font-bold">
                                            ...
                                        </span>
                                    );
                                }
                                const isCurrent = currentPage === pageNum;
                                return (
                                    <button
                                        key={`page-${pageNum}`}
                                        type="button"
                                        onClick={() => setCurrentPage(Number(pageNum))}
                                        className={`min-w-[30px] h-7.5 px-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                                            isCurrent
                                                ? 'bg-indigo-600 text-white shadow-xs'
                                                : 'border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-200 bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700'
                                        }`}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}
                        </div>

                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage >= totalPages}
                            type="button"
                            className="px-2.5 py-1.5 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-200 bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-white dark:disabled:hover:bg-slate-800 disabled:cursor-not-allowed rounded-lg font-medium transition-colors flex items-center gap-1 cursor-pointer"
                            title="Next Page"
                        >
                            <span className="hidden sm:inline">Next</span>
                            <ChevronRight size={15} />
                        </button>
                    </div>

                    {/* Right: Page Size Selector */}
                    <div className="flex items-center gap-2">
                        <span className="text-gray-500 dark:text-slate-400 font-medium hidden sm:inline">Per page:</span>
                        <select
                            value={pageSize}
                            onChange={(e) => {
                                setPageSize(Number(e.target.value));
                                setCurrentPage(1);
                            }}
                            className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-200 text-xs font-semibold rounded-lg px-2.5 py-1.5 shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                            title="Rows per page"
                        >
                            <option value={10}>10 / page</option>
                            <option value={25}>25 / page</option>
                            <option value={50}>50 / page</option>
                            <option value={100}>100 / page</option>
                            <option value={250}>250 / page</option>
                        </select>
                    </div>
                </div>
            </div>

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

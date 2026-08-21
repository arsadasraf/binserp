/**
 * InventoryTable Component
 * 
 * Displays inventory data in a table format with columns for:
 * - Material name
 * - Material code  
 * - Current stock (color-coded based on reorder level)
 * - Unit
 * - Category (from master data)
 * - Location (from master data)
 * 
 * @param data - Array of inventory items to display
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { InventoryItem, MasterType } from "@/src/features/store/types/store.types";
import { Package, Factory, Download, Search, Edit2, FileSpreadsheet, ChevronDown, FileDown } from 'lucide-react';
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

    const [editingStockId, setEditingStockId] = useState<string | null>(null);
    const [editingStockValue, setEditingStockValue] = useState<number>(0);
    const [isUpdating, setIsUpdating] = useState(false);

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
        setFilters(prev => ({
            ...prev,
            [column]: values
        }));
    };

    const applyFilters = (items: any[]) => {
        return items.filter(item => {
            // Global Search Filter (Name, Code, or Description)
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                const name = (item.materialName || item.componentName || '').toLowerCase();
                const code = (item.materialCode || item.componentCode || item.code || '').toLowerCase();
                const desc = (item.descriptions || item.description || '').toLowerCase();

                if (!name.includes(query) && !code.includes(query) && !desc.includes(query)) {
                    return false;
                }
            }

            // Column Filters
            return Object.entries(filters).every(([key, selectedValues]) => {
                if (selectedValues.length === 0) return true;

                let itemValue = '';
                // Handle nested properties based on key
                if (key === 'category') {
                    itemValue = (typeof item.categoryId === 'object' && item.categoryId?.name) ||
                        (typeof item.category === 'object' && item.category?.name) ||
                        item.category?.name || item.category || '-';
                } else if (key === 'location') {
                    itemValue = (typeof item.locationId === 'object' && item.locationId?.name) ||
                        (typeof item.location === 'object' && item.location?.name) ||
                        item.location?.name || item.location || '-';
                } else if (key === 'materialName') {
                    itemValue = item.materialName || item.componentName || '-';
                } else if (key === 'unit') {
                    itemValue = item.unit || '-';
                } else {
                    itemValue = String(item[key] || '');
                }

                return selectedValues.includes(itemValue);
            });
        });
    };

    const filteredData = useMemo(() => applyFilters(data), [data, filters, searchQuery]);
    const filteredInHouseData = useMemo(() => applyFilters(inHouseData), [inHouseData, filters, searchQuery]);

    // Helpers to get values for ColumnFilter
    const getCategoryValue = (item: any) =>
        (typeof item.categoryId === 'object' && item.categoryId?.name) ||
        (typeof item.category === 'object' && item.category?.name) ||
        item.category?.name || item.category || '-';

    const getLocationValue = (item: any) => {
        if (!item.location) return '-';
        return typeof item.location === 'object' ? item.location.name : item.location;
    };

    const exportToExcel = () => {
        const currentData = activeSubTab !== 'inhouse' ? filteredData : filteredInHouseData;
        const exportData = currentData.map(item => ({
            'Material Name': item.materialName || item.componentName || '-',
            'Code': item.materialCode || '-',
            'Description': item.descriptions || item.description || '-',
            'Stock': item.currentStock ?? item.quantity ?? 0,
            'Unit': item.unit || '-',
            'Category': getCategoryValue(item),
            'Location': getLocationValue(item)
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, activeSubTab === 'bo' ? 'BO Items' : 'In-house Items');

        const fileName = `${activeSubTab === 'bo' ? 'BO_Inventory' : 'Inhouse_Inventory'}_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, fileName);
    };

    return (
        <div className="w-full bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-gray-50/50 dark:bg-gray-900/50">
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Showing <span className="font-bold text-gray-900 dark:text-gray-100">{activeSubTab === 'bo' ? filteredData.length : filteredInHouseData.length}</span> items
                </span>
                <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                    {/* Search Bar */}
                    <div className="relative flex-1 sm:flex-initial">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            type="text"
                            placeholder="Search by Name, Code, Description..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full sm:w-64 pl-9 pr-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm text-gray-900 dark:text-gray-100 placeholder-gray-400"
                        />
                    </div>

                    {/* Create GRN Button - Next to Search Button */}
                    {onCreateGRN && (
                        <button
                            onClick={onCreateGRN}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-xl shadow-sm hover:shadow-indigo-200 dark:hover:shadow-none transition-all font-medium text-sm active:scale-95 whitespace-nowrap cursor-pointer"
                            title="Create a new Goods Receipt Note (GRN)"
                        >
                            <Package size={17} />
                            <span>Create GRN</span>
                        </button>
                    )}

                    {/* Single Excel Actions Dropdown Button (Desktop only) */}
                    <div className="relative hidden md:block" ref={excelMenuRef}>
                        <button
                            onClick={() => setIsExcelMenuOpen(!isExcelMenuOpen)}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm rounded-xl shadow-sm hover:shadow-emerald-200 dark:hover:shadow-none transition-all active:scale-95 cursor-pointer whitespace-nowrap"
                            title="Excel Import, Export, and Template options"
                        >
                            <FileSpreadsheet size={17} />
                            <span>Excel Actions</span>
                            <ChevronDown size={15} className={`transition-transform duration-200 ${isExcelMenuOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {/* Dropdown Options Menu */}
                        {isExcelMenuOpen && (
                            <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 py-1.5 z-30 animate-in fade-in slide-in-from-top-2 duration-150">
                                <button
                                    onClick={() => {
                                        exportToExcel();
                                        setIsExcelMenuOpen(false);
                                    }}
                                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 transition-colors text-left"
                                >
                                    <Download size={15} className="text-emerald-600" />
                                    <span>Export List (Excel)</span>
                                </button>
                                <button
                                    onClick={() => {
                                        setIsImportModalOpen(true);
                                        setIsExcelMenuOpen(false);
                                    }}
                                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-700 transition-colors text-left"
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
                                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-700 transition-colors text-left"
                                >
                                    <FileDown size={15} className="text-indigo-600" />
                                    <span>Download Template</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            {/* Sub Tabs */}
            {!hideTabs && (
                <div className="flex border-b border-gray-200 px-6">
                    <button
                        onClick={() => {
                            onSubTabChange('bo');
                            setFilters({}); // Clear filters on tab switch
                            setSearchQuery(''); // Clear search on tab switch
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
                            setFilters({}); // Clear filters on tab switch
                            setSearchQuery(''); // Clear search on tab switch
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
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-3 text-left">
                                        <ColumnFilter
                                            column="materialName"
                                            title="Material"
                                            data={data}
                                            currentFilters={filters['materialName'] || []}
                                            onFilterChange={(vals) => handleFilterChange('materialName', vals)}
                                        />
                                    </th>
                                    <th className="px-6 py-3 text-left font-semibold text-gray-900">Description</th>
                                    <th className="px-6 py-3 text-left font-semibold text-gray-900">Stock</th>
                                    <th className="px-6 py-3 text-left font-semibold text-gray-900">Monthly Flow</th>
                                    <th className="px-6 py-3 text-left">
                                        <ColumnFilter
                                            column="unit"
                                            title="Unit"
                                            data={data}
                                            currentFilters={filters['unit'] || []}
                                            onFilterChange={(vals) => handleFilterChange('unit', vals)}
                                        />
                                    </th>
                                    <th className="px-6 py-3 text-left">
                                        <ColumnFilter
                                            column="category"
                                            title="Category"
                                            data={data}
                                            currentFilters={filters['category'] || []}
                                            onFilterChange={(vals) => handleFilterChange('category', vals)}
                                            getValue={getCategoryValue}
                                        />
                                    </th>
                                    <th className="px-6 py-3 text-left">
                                        <ColumnFilter
                                            column="location"
                                            title="Location"
                                            data={data}
                                            currentFilters={filters['location'] || []}
                                            onFilterChange={(vals) => handleFilterChange('location', vals)}
                                            getValue={getLocationValue}
                                        />
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {filteredData.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                                            No Bought Out items found.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredData.map((item, index) => (
                                        <tr
                                            key={`${item._id}-${index}`}
                                            onClick={() => onItemClick && onItemClick(item)}
                                            className="hover:bg-gray-50 transition-colors cursor-pointer"
                                        >
                                            <td className="px-6 py-4 font-medium text-gray-900">
                                                <div>{item.materialName}</div>
                                                {item.materialCode && item.materialCode !== 'N/A' && (
                                                    <div className="text-xs text-gray-400 font-mono">{item.materialCode}</div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-gray-600 max-w-xs truncate" title={item.descriptions || item.description || '-'}>
                                                {item.descriptions || item.description || '-'}
                                            </td>
                                            <td className={`px-6 py-4 font-medium ${item.currentStock < item.reorderLevel ? "text-red-600" : "text-green-600"}`}>
                                                {item.currentStock}
                                                {item.qcPendingStock ? <span className="text-gray-400 text-xs ml-1 font-normal" title="Pending QC">({item.qcPendingStock})</span> : null}
                                            </td>
                                            <td className="px-6 py-4" onDoubleClick={(e) => handleOpeningStockEditClick(e, item)}>
                                                {editingStockId === item._id ? (
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="number"
                                                            value={editingStockValue}
                                                            onChange={(e) => setEditingStockValue(Number(e.target.value))}
                                                            className="w-20 px-2 py-1 border rounded text-sm text-gray-900"
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
                                                    <span className="flex items-center gap-1 font-medium text-gray-700 cursor-pointer" title="Double click to edit opening stock">
                                                        <span className="text-green-600 text-xs" title="Inward">(+{item.monthlyData.totalInwardQuantity})</span>
                                                        <span className="text-red-600 text-xs" title="Outward">(-{item.monthlyData.totalOutwardQuantity})</span>
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400 cursor-pointer hover:text-gray-600" title="Double click to edit opening stock">-</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-gray-600">{item.unit}</td>
                                            <td className="px-6 py-4 text-gray-600">
                                                {getCategoryValue(item)}
                                            </td>
                                            <td className="px-6 py-4 text-gray-600">
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
                            <div className="text-center text-gray-500 py-8">No Bought Out items found.</div>
                        ) : (
                            filteredData.map((item, index) => (
                                <div
                                    key={`${item._id}-${index}`}
                                    onClick={() => onItemClick && onItemClick(item)}
                                    className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-2 active:scale-95 transition-transform"
                                >
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h4 className="font-bold text-gray-900">{item.materialName}</h4>
                                            <p className="text-xs text-gray-500">{item.materialCode || "No Code"}</p>
                                        </div>
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${item.currentStock <= item.reorderLevel ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                                            {item.currentStock} {item.qcPendingStock ? `(${item.qcPendingStock})` : ''} {item.unit}
                                        </span>
                                    </div>

                                    {item.monthlyData && (
                                        <div className="flex items-center gap-2 text-xs mt-1 bg-gray-50 p-1.5 rounded-lg border border-gray-100 w-fit group">
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
                                                    <span className="text-gray-500 font-medium">Opening:</span>
                                                    <span className="font-bold">{item.monthlyData.openingStock}</span>
                                                    <button
                                                        onClick={(e) => handleOpeningStockEditClick(e, item)}
                                                        className="p-1 text-gray-400 hover:text-indigo-600 rounded hover:bg-indigo-50 transition-colors opacity-60 group-hover:opacity-100"
                                                        title="Edit opening stock"
                                                    >
                                                        <Edit2 size={12} />
                                                    </button>
                                                    <span className="text-green-600 font-medium ml-1">(+{item.monthlyData.totalInwardQuantity})</span>
                                                    <span className="text-red-600 font-medium">(-{item.monthlyData.totalOutwardQuantity})</span>
                                                </>
                                            )}
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-gray-50 text-sm">
                                        <div>
                                            <span className="text-gray-500 block text-xs">Category</span>
                                            <span className="text-gray-700 font-medium">
                                                {getCategoryValue(item)}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-gray-500 block text-xs">Location</span>
                                            <span className="text-gray-700 font-medium">
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
                // InHouse Table (Components)
                <>
                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto min-h-[400px]">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-3 text-left">
                                        <ColumnFilter
                                            column="name"
                                            title="Name"
                                            data={inHouseData}
                                            currentFilters={filters['name'] || []}
                                            onFilterChange={(vals) => handleFilterChange('name', vals)}
                                            getValue={(item) => item.name || item.componentName || '-'}
                                        />
                                    </th>
                                    <th className="px-6 py-3 text-left">
                                        <ColumnFilter
                                            column="type"
                                            title="Type"
                                            data={inHouseData}
                                            currentFilters={filters['type'] || []}
                                            onFilterChange={(vals) => handleFilterChange('type', vals)}
                                            getValue={(item) => item.type || '-'}
                                        />
                                    </th>
                                    <th className="px-6 py-3 text-left font-semibold text-gray-900">Description</th>
                                    <th className="px-6 py-3 text-left font-semibold text-gray-900">Total Stock</th>
                                    <th className="px-6 py-3 text-left font-semibold text-gray-900">Reserved Stock</th>
                                    <th className="px-6 py-3 text-left font-semibold text-gray-900">Monthly Flow</th>
                                    <th className="px-6 py-3 text-left">
                                        <ColumnFilter
                                            column="unit"
                                            title="Unit"
                                            data={inHouseData}
                                            currentFilters={filters['unit'] || []}
                                            onFilterChange={(vals) => handleFilterChange('unit', vals)}
                                        />
                                    </th>
                                    <th className="px-6 py-3 text-left">
                                        <ColumnFilter
                                            column="location"
                                            title="Location"
                                            data={inHouseData}
                                            currentFilters={filters['location'] || []}
                                            onFilterChange={(vals) => handleFilterChange('location', vals)}
                                            getValue={getLocationValue}
                                        />
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {filteredInHouseData.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                                            No InHouse components found.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredInHouseData.map((item, index) => (
                                        <tr
                                            key={`${item._id}-${index}`}
                                            onClick={() => onItemClick && onItemClick(item)}
                                            className="hover:bg-gray-50 transition-colors cursor-pointer"
                                        >
                                            <td className="px-6 py-4 font-medium text-gray-900">{item.name || item.componentName}</td>
                                            <td className="px-6 py-4 text-gray-600">{item.type || '-'}</td>
                                            <td className="px-6 py-4 text-gray-600 truncate max-w-xs" title={item.description}>{item.description || '-'}</td>
                                            <td className={`px-6 py-4 font-medium ${item.quantity <= (item.reorderLevel || 0) ? "text-red-600" : "text-green-600"}`}>
                                                {item.quantity}
                                            </td>
                                            <td className="px-6 py-4">
                                                {(() => {
                                                    const allocQty = item.allocatedQuantity || 0;
                                                    const breakdown = item.reservedBreakdown || item.allocations || [];
                                                    const tooltipText = breakdown.length > 0
                                                        ? breakdown.map((a: any) => `#${a.orderNumber || a.salesOrderNo || 'SO'}${a.poReference ? ` [PO: ${a.poReference}]` : ''}: ${a.reservedQuantity || a.allocatedQty} PCS (${a.customerName || 'Customer'})`).join(' | ')
                                                        : 'No active PO/SO stock allocations';

                                                    return (
                                                        <div className="flex items-center gap-1 cursor-help" title={tooltipText}>
                                                            <span className={`px-2 py-0.5 rounded-full text-xs font-black font-mono border ${
                                                                allocQty > 0 
                                                                    ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800 shadow-xs'
                                                                    : 'bg-slate-100 text-slate-500 border-slate-200'
                                                            }`}>
                                                                {allocQty} {item.unit || 'PCS'}
                                                            </span>
                                                        </div>
                                                    );
                                                })()}
                                            </td>
                                            <td className="px-6 py-4">
                                                {editingStockId === item._id ? (
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="number"
                                                            value={editingStockValue}
                                                            onChange={(e) => setEditingStockValue(Number(e.target.value))}
                                                            className="w-20 px-2 py-1 border rounded text-sm text-gray-900"
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
                                                    <div className="flex items-center gap-1 font-medium text-gray-700 group">
                                                        <span className="text-green-600 text-xs" title="Inward">(+{item.monthlyData.totalInwardQuantity})</span>
                                                        <span className="text-red-600 text-xs" title="Outward">(-{item.monthlyData.totalOutwardQuantity})</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-400">-</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-gray-600">{item.unit || '-'}</td>
                                            <td className="px-6 py-4 text-gray-600">
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
                            <div className="text-center text-gray-500 py-8">No InHouse components found.</div>
                        ) : (
                            filteredInHouseData.map((item, index) => (
                                <div
                                    key={`${item._id}-${index}`}
                                    onClick={() => onItemClick && onItemClick(item)}
                                    className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-2 active:scale-95 transition-transform"
                                >
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h4 className="font-bold text-gray-900">{item.name || item.componentName}</h4>
                                            <p className="text-xs text-gray-500 font-mono">{item.type || "No Type"}</p>
                                        </div>
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${item.quantity <= (item.reorderLevel || 0) ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                                            {item.quantity} {item.unit || ''}
                                        </span>
                                    </div>

                                    {item.monthlyData && (
                                        <div className="flex items-center gap-2 text-xs mt-1 bg-gray-50 p-1.5 rounded-lg border border-gray-100 w-fit group">
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
                                                    <span className="text-gray-500 font-medium">Opening:</span>
                                                    <span className="font-bold">{item.monthlyData.openingStock}</span>
                                                    <button
                                                        onClick={(e) => handleOpeningStockEditClick(e, item)}
                                                        className="p-1 text-gray-400 hover:text-indigo-600 rounded hover:bg-indigo-50 transition-colors opacity-60 group-hover:opacity-100"
                                                        title="Edit opening stock"
                                                    >
                                                        <Edit2 size={12} />
                                                    </button>
                                                    <span className="text-green-600 font-medium ml-1">(+{item.monthlyData.totalInwardQuantity})</span>
                                                    <span className="text-red-600 font-medium">(-{item.monthlyData.totalOutwardQuantity})</span>
                                                </>
                                            )}
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-gray-50 text-sm">
                                        <div>
                                            <span className="text-gray-500 block text-xs">Description</span>
                                            <span className="text-gray-700 font-medium truncate" title={item.description}>
                                                {item.description || '-'}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-gray-500 block text-xs">Location</span>
                                            <span className="text-gray-700 font-medium">
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

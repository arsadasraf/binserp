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

import React, { useState, useMemo } from 'react';
import { InventoryItem } from '../../types/store.types';
import { Package, Factory, Download, Search } from 'lucide-react';
import * as XLSX from 'xlsx';
import ColumnFilter from './ColumnFilter';

interface InventoryTableProps {
    data: InventoryItem[];
    inHouseData?: any[];
    onEdit: (item: InventoryItem) => void;
    onDelete: (id: string) => void;
    activeSubTab: 'bo' | 'inhouse';
    onSubTabChange: (tab: 'bo' | 'inhouse') => void;
    hideTabs?: boolean;
    onItemClick?: (item: InventoryItem) => void;
}

export default function InventoryTable({
    data,
    inHouseData = [],
    onEdit,
    onDelete,
    activeSubTab,
    onSubTabChange,
    hideTabs,
    onItemClick
}: InventoryTableProps) {
    const [filters, setFilters] = useState<Record<string, string[]>>({});
    const [searchQuery, setSearchQuery] = useState('');

    const handleFilterChange = (column: string, values: string[]) => {
        setFilters(prev => ({
            ...prev,
            [column]: values
        }));
    };

    const applyFilters = (items: any[]) => {
        return items.filter(item => {
            // Global Search Filter (Name or Code)
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                const name = (item.materialName || item.componentName || '').toLowerCase();
                const code = (item.materialCode || item.componentCode || item.code || '').toLowerCase();

                if (!name.includes(query) && !code.includes(query)) {
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
        const currentData = activeSubTab === 'bo' ? filteredData : filteredInHouseData;
        const exportData = currentData.map(item => ({
            'Material Name': item.materialName || item.componentName || '-',
            'Code': item.materialCode || '-',
            'Stock': item.currentStock,
            'Unit': item.unit,
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
        <div className="w-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50/50">
                <span className="text-sm text-gray-500">
                    Showing {activeSubTab === 'bo' ? filteredData.length : filteredInHouseData.length} items
                </span>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            type="text"
                            placeholder="Search by Name or Code..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-64"
                        />
                    </div>
                    <button
                        onClick={exportToExcel}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors border border-green-200"
                        title="Download Excel"
                    >
                        <Download size={16} />
                        Export List
                    </button>
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
            {activeSubTab === 'bo' ? (
                // Existing Inventory Table (BO)
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
                                    <th className="px-6 py-3 text-left font-semibold text-gray-900">Stock</th>
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
                                        <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                                            No Bought Out items found.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredData.map((item) => (
                                        <tr
                                            key={item._id}
                                            onClick={() => onItemClick && onItemClick(item)}
                                            className="hover:bg-gray-50 transition-colors cursor-pointer"
                                        >
                                            <td className="px-6 py-4 font-medium text-gray-900">{item.materialName}</td>
                                            <td className={`px-6 py-4 font-medium ${item.currentStock <= item.reorderLevel ? "text-red-600" : "text-green-600"}`}>
                                                {item.currentStock}
                                                {item.qcPendingStock ? <span className="text-gray-400 text-xs ml-1 font-normal" title="Pending QC">({item.qcPendingStock})</span> : null}
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
                    <div className="md:hidden flex flex-col gap-3 p-4">
                        {filteredData.length === 0 ? (
                            <div className="text-center text-gray-500 py-8">No Bought Out items found.</div>
                        ) : (
                            filteredData.map((item) => (
                                <div
                                    key={item._id}
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
                                    <th className="px-6 py-3 text-left font-semibold text-gray-900">Stock</th>
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
                                        <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                                            No InHouse components found.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredInHouseData.map((item) => (
                                        <tr
                                            key={item._id}
                                            onClick={() => onItemClick && onItemClick(item)}
                                            className="hover:bg-gray-50 transition-colors cursor-pointer"
                                        >
                                            <td className="px-6 py-4 font-medium text-gray-900">{item.name || item.componentName}</td>
                                            <td className="px-6 py-4 text-gray-600">{item.type || '-'}</td>
                                            <td className="px-6 py-4 text-gray-600 truncate max-w-xs" title={item.description}>{item.description || '-'}</td>
                                            <td className={`px-6 py-4 font-medium ${item.quantity <= (item.reorderLevel || 0) ? "text-red-600" : "text-green-600"}`}>
                                                {item.quantity}
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
                    <div className="md:hidden flex flex-col gap-3 p-4">
                        {filteredInHouseData.length === 0 ? (
                            <div className="text-center text-gray-500 py-8">No InHouse components found.</div>
                        ) : (
                            filteredInHouseData.map((item) => (
                                <div
                                    key={item._id}
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
        </div>
    );
}

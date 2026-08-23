"use client";

import React from 'react';
import DataTable, { ColumnDef } from '@/src/components/ui/DataTable';
import { Edit2, Trash2, Plus, Eye } from 'lucide-react';
import * as XLSX from 'xlsx';
import StoreMasterExcelActions from '../StoreMasterExcelActions';

interface MaterialTableProps {
  data: any[];
  onEdit: (item: any) => void;
  onDelete: (id: string) => void;
  onView?: (item: any) => void;
  onAdd?: () => void;
  masterTab?: string;
  itemTypeLabel?: string;
}

export default function MaterialTable({ 
  data, 
  onEdit, 
  onDelete, 
  onView, 
  onAdd, 
  masterTab = "rm-bo-item",
  itemTypeLabel = "Material"
}: MaterialTableProps) {
  const isBO = masterTab === "bought-out" || masterTab === "bo-item" || itemTypeLabel === "Bought Out";
  const isRM = masterTab === "raw-material" || masterTab === "raw-materials" || masterTab === "rm-item" || itemTypeLabel === "Raw Material";
  
  const displayLabel = isBO ? "Bought Out Item" : (isRM ? "Raw Material" : "Material");

  const exportToExcel = () => {
    const exportData = (data || []).map((item, idx) => ({
      'S.No': idx + 1,
      'Item Name': item.name || item.materialName || '-',
      'Item Code': item.code || item.materialCode || '-',
      'Item Type': item.itemType || (isBO ? 'Bought Out' : 'Raw Material'),
      'Category': item.category || (typeof item.categoryId === 'object' ? item.categoryId?.name : item.categoryId) || '-',
      'Unit': item.unit || '-',
      'Opening Stock': item.openingStock || 0,
      'Min Stock': item.minimumStock ?? item.minStock ?? 0,
      'Max Stock': item.maxStock || 0,
      'Rate': item.rate || 0,
      'GST Rate': item.gstRate || 18,
      'HSN Code': item.hsnCode || '-',
      'Location': item.storageLocation || (typeof item.location === 'object' ? item.location?.name : item.location) || (typeof item.locationId === 'object' ? item.locationId?.name : item.locationId) || '-',
      'Description': item.descriptions || item.description || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    const sheetName = isBO ? 'Bought_Out_Items' : (isRM ? 'Raw_Materials' : 'Materials');
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${sheetName}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const columns: ColumnDef<any>[] = [
    {
      id: 'name',
      label: `${displayLabel} Name`,
      render: (item) => (
        <div className="flex items-center gap-2.5">
          {item.photos && item.photos.length > 0 ? (
            <img
              src={item.photos[0]}
              alt={item.name || item.materialName}
              className="w-8 h-8 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0"
            />
          ) : (
            <div className={`w-8 h-8 rounded-lg ${isBO ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400' : 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400'} border flex items-center justify-center text-xs font-black shrink-0`}>
              {((item.name || item.materialName || (isBO ? 'BO' : 'RM')).slice(0, 2)).toUpperCase()}
            </div>
          )}
          <span className="font-bold text-slate-900 dark:text-white">
            {item.name || item.materialName || '-'}
          </span>
        </div>
      )
    },
    {
      id: 'descriptions',
      label: 'Description',
      render: (item) => (
        <span className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 max-w-[280px] block" title={item.descriptions || item.description || ''}>
          {item.descriptions || item.description || '-'}
        </span>
      )
    },
    {
      id: 'category',
      label: 'Category',
      render: (item) => {
        const catName = (typeof item.categoryId === 'object' ? item.categoryId?.name : item.categoryId) || item.category || '-';
        return (
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold border bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
            {catName}
          </span>
        );
      }
    },
    {
      id: 'unit',
      label: 'Unit',
      render: (item) => (
        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
          {item.unit || item.categoryId?.unit || '-'}
        </span>
      )
    },
    {
      id: 'location',
      label: 'Location',
      render: (item) => (
        <span className="text-xs text-slate-600 dark:text-slate-400">
          {item.locationId?.name || (typeof item.location === 'object' ? item.location?.name : item.location) || item.storageLocation || '-'}
        </span>
      )
    },
    {
      id: 'minimumStock',
      label: 'Min Stock',
      render: (item) => (
        <span className="text-xs font-mono font-semibold text-slate-700 dark:text-slate-300">
          {item.minimumStock ?? item.minStock ?? '-'}
        </span>
      )
    },
    {
      id: 'actions',
      label: 'Actions',
      render: (item) => (
        <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          {onView && (
            <button
              onClick={() => onView(item)}
              className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-lg transition-colors"
              title="View Complete Profile & PDF"
            >
              <Eye size={16} />
            </button>
          )}
          <button
            onClick={() => onEdit(item)}
            className="p-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg transition-colors"
            title="Edit"
          >
            <Edit2 size={16} />
          </button>
          <button
            onClick={() => onDelete(item._id)}
            className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition-colors"
            title="Delete"
          >
            <Trash2 size={16} />
          </button>
        </div>
      )
    }
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      onRowClick={onView}
      searchPlaceholder={`Search ${displayLabel.toLowerCase()}s...`}
      searchableKeys={['name', 'descriptions', 'category', 'unit']}
      actionButton={
        <div className="flex flex-wrap items-center gap-2">
          <StoreMasterExcelActions
            masterTab={masterTab}
            onExport={exportToExcel}
          />
          {onAdd && (
            <button
              onClick={onAdd}
              className={`px-4 py-2 ${isBO ? 'bg-amber-600 hover:bg-amber-700' : 'bg-indigo-600 hover:bg-indigo-700'} text-white rounded-lg whitespace-nowrap text-xs font-bold transition-colors flex items-center gap-1 shadow-sm`}
            >
              <Plus size={14} /> Add {displayLabel}
            </button>
          )}
        </div>
      }
    />
  );
}

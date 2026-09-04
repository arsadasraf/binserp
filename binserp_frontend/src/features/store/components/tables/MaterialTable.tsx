"use client";

import React from 'react';
import DataTable, { ColumnDef } from '@/src/components/ui/DataTable';
import { Edit2, Trash2, Plus, Eye, Power, CheckCircle2, AlertCircle, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import StoreMasterExcelActions from '../StoreMasterExcelActions';

export interface RowNotice {
  itemId: string;
  message: string;
  type: 'error' | 'success';
}

interface MaterialTableProps {
  data: any[];
  onEdit: (item: any) => void;
  onDelete: (id: string) => void;
  onView?: (item: any) => void;
  onAdd?: () => void;
  onToggleStatus?: (item: any) => void;
  masterTab?: string;
  itemTypeLabel?: string;
  rowNotice?: RowNotice | null;
  onClearRowNotice?: () => void;
}

export default function MaterialTable({ 
  data, 
  onEdit, 
  onDelete, 
  onView, 
  onAdd, 
  onToggleStatus,
  masterTab = "rm-bo-item",
  itemTypeLabel = "Material",
  rowNotice = null,
  onClearRowNotice
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
      'Status': item.status || (item.isActive === false ? 'Deactivated' : 'Active'),
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
      getValue: (item) => item.name || item.materialName || '-',
      render: (item) => {
        const isInactive = item.isActive === false || item.status === 'Inactive' || item.status === 'Deactivated';
        return (
          <div className={`flex items-center gap-2.5 ${isInactive ? 'opacity-60' : ''}`}>
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
            <div>
              <span className="font-bold text-slate-900 dark:text-white block">
                {item.name || item.materialName || '-'}
              </span>
            </div>
          </div>
        );
      }
    },
    {
      id: 'descriptions',
      label: 'Description',
      getValue: (item) => item.descriptions || item.description || '-',
      render: (item) => (
        <span className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 max-w-[280px] block" title={item.descriptions || item.description || ''}>
          {item.descriptions || item.description || '-'}
        </span>
      )
    },
    {
      id: 'category',
      label: 'Category',
      getValue: (item) => (typeof item.categoryId === 'object' ? item.categoryId?.name : item.categoryId) || item.category || '-',
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
      getValue: (item) => item.unit || '-',
      render: (item) => (
        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
          {item.unit || '-'}
        </span>
      )
    },
    {
      id: 'hsnCode',
      label: 'HSN Code',
      getValue: (item) => item.hsnCode || '-',
      render: (item) => (
        <span className="text-xs font-mono font-medium text-slate-600 dark:text-slate-400">
          {item.hsnCode || '-'}
        </span>
      )
    },
    {
      id: 'location',
      label: 'Location',
      getValue: (item) => item.locationId?.name || (typeof item.location === 'object' ? item.location?.name : item.location) || item.storageLocation || '-',
      render: (item) => (
        <span className="text-xs text-slate-600 dark:text-slate-400">
          {item.locationId?.name || (typeof item.location === 'object' ? item.location?.name : item.location) || item.storageLocation || '-'}
        </span>
      )
    },
    {
      id: 'minimumStock',
      label: 'Min Stock',
      getValue: (item) => String(item.minimumStock ?? item.minStock ?? 0),
      render: (item) => (
        <span className="text-xs font-mono font-semibold text-slate-700 dark:text-slate-300">
          {item.minimumStock ?? item.minStock ?? '-'}
        </span>
      )
    },
    {
      id: 'status',
      label: 'Status',
      getValue: (item) => (item.isActive === false || item.status === 'Inactive' || item.status === 'Deactivated') ? 'Deactivated' : 'Active',
      render: (item) => {
        const isInactive = item.isActive === false || item.status === 'Inactive' || item.status === 'Deactivated';
        return (
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 border ${
            isInactive
              ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
              : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isInactive ? 'bg-rose-500' : 'bg-emerald-500'}`} />
            {isInactive ? 'Deactivated' : 'Active'}
          </span>
        );
      }
    },
    {
      id: 'actions',
      label: 'Actions',
      enableFilter: false,
      enableSort: false,
      render: (item) => {
        const isInactive = item.isActive === false || item.status === 'Inactive' || item.status === 'Deactivated';
        const hasStockOrTransactions = (Number(item.quantity || item.currentStock || 0) > 0 || Number(item.qcPendingStock || 0) > 0 || Boolean(item.hasTransactions));

        return (
          <div className="flex justify-end items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            {onView && (
              <button
                onClick={() => onView(item)}
                className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-lg transition-colors cursor-pointer"
                title="View Complete Profile & PDF"
              >
                <Eye size={15} />
              </button>
            )}
            <button
              onClick={() => onEdit(item)}
              className="p-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg transition-colors cursor-pointer"
              title="Edit"
            >
              <Edit2 size={15} />
            </button>

            {/* Smart Deactivate / Status Toggle Button when transactions/stock exist or when deactivated */}
            {(hasStockOrTransactions || isInactive || onToggleStatus) && onToggleStatus && (
              <button
                onClick={() => onToggleStatus(item)}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  isInactive
                    ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50'
                    : 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/50'
                }`}
                title={isInactive ? "Reactivate Item" : "Deactivate Item (Requires 0 stock & not in BOM)"}
              >
                {isInactive ? <CheckCircle2 size={15} /> : <Power size={15} />}
              </button>
            )}

            {/* Hard Delete Button: only shown if NO active transactions/stock and item is active */}
            {!hasStockOrTransactions && !isInactive && (
              <button
                onClick={() => onDelete(item._id)}
                className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition-colors cursor-pointer"
                title="Delete Item"
              >
                <Trash2 size={15} />
              </button>
            )}

            {/* Popover Alert Message anchored right near the button */}
            {rowNotice && rowNotice.itemId === item._id && (
              <div 
                className={`absolute right-0 top-full mt-2 z-50 w-72 sm:w-84 p-3 rounded-xl shadow-2xl border backdrop-blur-md flex items-start gap-2.5 animate-in fade-in slide-in-from-top-1 duration-200 text-left ${
                  rowNotice.type === 'success'
                    ? 'bg-emerald-900/95 dark:bg-emerald-950/95 border-emerald-600/80 text-white'
                    : 'bg-rose-900/95 dark:bg-rose-950/95 border-rose-600/80 text-white'
                }`}
                style={{ minWidth: '270px', maxWidth: '340px' }}
              >
                {/* Speech Bubble Arrow pointing to the buttons */}
                <div 
                  className={`absolute -top-1.5 right-4 w-3 h-3 rotate-45 ${
                    rowNotice.type === 'success'
                      ? 'bg-emerald-900 dark:bg-emerald-950 border-l border-t border-emerald-600/80'
                      : 'bg-rose-900 dark:bg-rose-950 border-l border-t border-rose-600/80'
                  }`} 
                />

                {rowNotice.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-300 shrink-0 mt-0.5" />
                )}

                <div className="flex-1 text-xs leading-snug">
                  <div className="font-semibold text-rose-200 mb-0.5">
                    {rowNotice.type === 'success' ? 'Status Updated' : 'Cannot Deactivate / Delete'}
                  </div>
                  <div className="text-white select-text break-words leading-relaxed">{rowNotice.message}</div>
                </div>

                <button
                  type="button"
                  onClick={() => onClearRowNotice?.()}
                  className="p-1 text-rose-300 hover:text-white rounded-md hover:bg-white/10 transition-colors shrink-0"
                  title="Close"
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </div>
        );
      }
    }
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      onRowClick={onView}
      searchPlaceholder={`Search ${displayLabel.toLowerCase()}s...`}
      searchableKeys={['name', 'descriptions', 'category', 'unit', 'hsnCode']}
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

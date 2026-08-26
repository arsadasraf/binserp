"use client";

import React from 'react';
import DataTable, { ColumnDef } from '@/src/components/ui/DataTable';
import { Edit2, Trash2, Plus, Eye, Package, Power, CheckCircle2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import StoreMasterExcelActions from '../StoreMasterExcelActions';

interface ConsumableTableProps {
  data: any[];
  onEdit: (item: any) => void;
  onDelete: (id: string) => void;
  onView?: (item: any) => void;
  onAdd?: () => void;
  onToggleStatus?: (item: any) => void;
}

export default function ConsumableTable({ data, onEdit, onDelete, onView, onAdd, onToggleStatus }: ConsumableTableProps) {
  const exportToExcel = () => {
    const exportData = (data || []).map((item, idx) => ({
      'S.No': idx + 1,
      'Consumable Name': item.name || '-',
      'Consumable Code': item.code || '-',
      'Category': item.category || (typeof item.categoryId === 'object' ? item.categoryId?.name : item.categoryId) || '-',
      'Unit': item.unit || '-',
      'Min Stock': item.minimumStock ?? item.minStock ?? 0,
      'Storage Location': item.storageLocation || (typeof item.locationId === 'object' ? item.locationId?.name : (typeof item.location === 'object' ? item.location?.name : item.location)) || '-',
      'Description': item.descriptions || item.description || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Consumables');
    XLSX.writeFile(wb, `Consumable_Items_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const columns: ColumnDef<any>[] = [
    {
      id: 'name',
      label: 'Consumable Name',
      getValue: (item) => item.name || '-',
      render: (item) => {
        const isInactive = item.isActive === false || item.status === 'Inactive' || item.status === 'Deactivated';
        return (
          <div className={`flex items-center gap-2.5 ${isInactive ? 'opacity-60' : ''}`}>
            {item.photos && item.photos.length > 0 ? (
              <img
                src={item.photos[0]}
                alt={item.name}
                className="w-8 h-8 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 flex items-center justify-center text-xs font-black text-teal-600 dark:text-teal-400 shrink-0">
                {((item.name || 'CN').slice(0, 2)).toUpperCase()}
              </div>
            )}
            <div>
              <span className="font-bold text-slate-900 dark:text-white block">
                {item.name || '-'}
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
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold border bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-800">
            {catName}
          </span>
        );
      }
    },
    {
      id: 'unit',
      label: 'Unit',
      getValue: (item) => item.unit || item.categoryId?.unit || 'PCS',
      render: (item) => (
        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
          {item.unit || item.categoryId?.unit || 'PCS'}
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
          {item.minimumStock ?? item.minStock ?? 0}
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
              : 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isInactive ? 'bg-rose-500' : 'bg-teal-500'}`} />
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
                className="p-1.5 text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/50 rounded-lg transition-colors cursor-pointer"
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
                title={isInactive ? "Reactivate Consumable" : "Deactivate Consumable (Has Stock / Transactions)"}
              >
                {isInactive ? <CheckCircle2 size={15} /> : <Power size={15} />}
              </button>
            )}

            {/* Hard Delete Button: only shown if NO active transactions/stock and item is active */}
            {!hasStockOrTransactions && !isInactive && (
              <button
                onClick={() => onDelete(item._id)}
                className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition-colors cursor-pointer"
                title="Delete Consumable"
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        );
      }
    }
  ];

  return (
    <div className="space-y-4">
      {/* Desktop / Responsive Table View */}
      <DataTable
        columns={columns}
        data={data}
        onRowClick={onView}
        searchPlaceholder="Search consumable items..."
        searchableKeys={['name', 'descriptions', 'category', 'unit']}
        actionButton={
          <div className="flex flex-wrap items-center gap-2">
            <StoreMasterExcelActions
              masterTab="consumable-item"
              onExport={exportToExcel}
            />
            {onAdd && (
              <button
                onClick={onAdd}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 whitespace-nowrap text-xs font-bold transition-colors flex items-center gap-1 shadow-sm"
              >
                <Plus size={14} /> Add Consumable
              </button>
            )}
          </div>
        }
      />
    </div>
  );
}

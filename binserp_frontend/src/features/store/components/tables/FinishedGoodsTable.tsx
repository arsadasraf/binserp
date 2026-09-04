"use client";

import React from 'react';
import DataTable, { ColumnDef } from '@/src/components/ui/DataTable';
import { Edit2, Trash2, Plus, Eye, Layers, ShieldCheck, Power, CheckCircle2, AlertCircle, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import StoreMasterExcelActions from '../StoreMasterExcelActions';
import { RowNotice } from './MaterialTable';

interface FinishedGoodsTableProps {
  data: any[];
  onEdit: (item: any) => void;
  onDelete: (id: string) => void;
  onView?: (item: any) => void;
  onAdd?: () => void;
  onToggleStatus?: (item: any) => void;
  rowNotice?: RowNotice | null;
  onClearRowNotice?: () => void;
}

export default function FinishedGoodsTable({ 
  data, 
  onEdit, 
  onDelete, 
  onView, 
  onAdd, 
  onToggleStatus,
  rowNotice = null,
  onClearRowNotice
}: FinishedGoodsTableProps) {
  const exportToExcel = () => {
    const exportData = (data || []).map((item, idx) => ({
      'S.No': idx + 1,
      'Product Name': item.name || '-',
      'Item Code': item.code || '-',
      'Type': item.type || '-',
      'Unit': item.unit || 'Nos',
      'HSN Code': item.hsnCode || '-',
      'Status': item.status || (item.isActive === false ? 'Deactivated' : 'Active'),
      'Min Stock': item.minimumStock || item.reorderLevel || 0,
      'Storage Location': item.location?.name || item.locationId?.name || (typeof item.location === 'string' ? item.location : '') || '-',
      'Revision No': item.revisionNumber || '-',
      'BOM Items Count': Array.isArray(item.bom) ? item.bom.length : 0,
      'Description': item.description || item.descriptions || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Finished_Goods');
    XLSX.writeFile(wb, `Finished_Goods_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const columns: ColumnDef<any>[] = [
    {
      id: 'name',
      label: 'Product Name',
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
              <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 flex items-center justify-center text-xs font-black text-purple-600 dark:text-purple-400 shrink-0">
                {((item.name || 'FG').slice(0, 2)).toUpperCase()}
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
      id: 'description',
      label: 'Description & Revision',
      getValue: (item) => {
        const desc = item.description || item.descriptions || '';
        const rev = item.revisionNumber ? `Rev ${item.revisionNumber}` : '';
        return rev ? `${rev} - ${desc}` : (desc || '-');
      },
      render: (item) => {
        const desc = item.description || item.descriptions || '-';
        const rev = item.revisionNumber ? String(item.revisionNumber).trim() : '';
        return (
          <div className="space-y-1 max-w-[300px]">
            {rev && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shadow-2xs">
                Rev: {rev}
              </span>
            )}
            <span className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 block" title={desc !== '-' ? desc : ''}>
              {desc}
            </span>
          </div>
        );
      }
    },
    {
      id: 'type',
      label: 'Classification',
      getValue: (item) => item.type || 'Component',
      render: (item) => (
        <span className="px-2 py-0.5 rounded-full text-xs font-semibold border bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800">
          {item.type || 'Component'}
        </span>
      )
    },
    {
      id: 'unit',
      label: 'Unit',
      getValue: (item) => item.unit || 'Nos',
      render: (item) => (
        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
          {item.unit || 'Nos'}
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
      id: 'status',
      label: 'Status',
      getValue: (item) => (item.isActive === false || item.status === 'Inactive' || item.status === 'Deactivated') ? 'Deactivated' : 'Active',
      render: (item) => {
        const isInactive = item.isActive === false || item.status === 'Inactive' || item.status === 'Deactivated';
        return (
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 border ${
            isInactive
              ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
              : 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isInactive ? 'bg-rose-500' : 'bg-purple-500'}`} />
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
        const hasStockOrTransactions = (Number(item.quantity || item.currentStock || 0) > 0 || Number(item.allocatedQuantity || 0) > 0 || Boolean(item.hasTransactions));

        return (
          <div className="flex justify-end items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            {onView && (
              <button
                onClick={() => onView(item)}
                className="p-1.5 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/50 rounded-lg transition-colors cursor-pointer"
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
                title={isInactive ? "Reactivate FG Item" : "Deactivate FG Item (Requires 0 stock & not in parent BOM)"}
              >
                {isInactive ? <CheckCircle2 size={15} /> : <Power size={15} />}
              </button>
            )}

            {/* Hard Delete Button: only shown if NO active transactions/stock and item is active */}
            {!hasStockOrTransactions && !isInactive && (
              <button
                onClick={() => onDelete(item._id)}
                className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition-colors cursor-pointer"
                title="Delete FG Item"
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
    <>
      <DataTable
        columns={columns}
        data={data}
        onRowClick={onView}
        searchPlaceholder="Search finished goods..."
        searchableKeys={['name', 'description', 'descriptions', 'type', 'revisionNumber', 'unit', 'hsnCode']}
        actionButton={
          <div className="flex flex-wrap items-center gap-2">
            <StoreMasterExcelActions
              masterTab="fg-items"
              onExport={exportToExcel}
            />
            {onAdd && (
              <button
                onClick={onAdd}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 whitespace-nowrap text-xs font-bold transition-colors flex items-center gap-1 shadow-sm"
              >
                <Plus size={14} /> Add Finished Good
              </button>
            )}
          </div>
        }
      />
    </>
  );
}

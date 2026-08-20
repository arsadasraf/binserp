"use client";

import React, { useState } from 'react';
import DataTable, { ColumnDef } from '@/src/components/ui/DataTable';
import { Edit2, Trash2, Download, FileSpreadsheet, Plus, Eye } from 'lucide-react';
import * as XLSX from 'xlsx';
import StoreMasterExcelActions from '../StoreMasterExcelActions';


interface FinishedGoodsTableProps {
  data: any[];
  onEdit: (item: any) => void;
  onDelete: (id: string) => void;
  onView?: (item: any) => void;
  onAdd?: () => void;
}

export default function FinishedGoodsTable({ data, onEdit, onDelete, onView, onAdd }: FinishedGoodsTableProps) {
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const exportToExcel = () => {
    const exportData = (data || []).map((item, idx) => ({
      'S.No': idx + 1,
      'FG Name': item.name || item.productName || '-',
      'FG Code': item.code || item.productCode || '-',
      'Description': item.description || '-',
      'Type': item.type || item.category || '-',
      'Unit': item.unit || 'NOS',
      'Location': item.location?.name || item.locationId?.name || (typeof item.location === 'string' ? item.location : '') || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Finished Goods');
    XLSX.writeFile(wb, `Finished_Goods_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const columns: ColumnDef<any>[] = [
    { id: 'name', label: 'Item Name' },
    { id: 'code', label: 'Item Code', render: (item) => item.code || item.productCode || '-' },
    { id: 'description', label: 'Description', render: (item) => item.description || '-' },
    { id: 'type', label: 'Type', render: (item) => item.type || item.category || '-' },
    { id: 'unit', label: 'Unit', render: (item) => item.unit || '-' },
    {
      id: 'totalQuantity',
      label: 'Total Stock',
      render: (item) => (
        <span className="font-extrabold text-slate-900 dark:text-white font-mono">
          {item.quantity || 0} {item.unit || 'PCS'}
        </span>
      )
    },
    {
      id: 'allocatedQuantity',
      label: 'Allocated Stock',
      render: (item) => {
        const allocQty = item.allocatedQuantity || 0;
        const breakdown = item.reservedBreakdown || item.allocations || [];
        const tooltipText = breakdown.length > 0
          ? breakdown.map((a: any) => `#${a.orderNumber || a.salesOrderNo || 'SO'}${a.poReference ? ` [PO: ${a.poReference}]` : ''}: ${a.reservedQuantity || a.allocatedQty} PCS (${a.customerName || 'Customer'})`).join(' | ')
          : 'No active PO/SO stock allocations';

        return (
          <div className="flex items-center gap-1 group relative cursor-help" title={tooltipText}>
            <span className={`px-2 py-0.5 rounded-full text-xs font-black font-mono border transition-all ${
              allocQty > 0 
                ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800 shadow-xs'
                : 'bg-slate-100 text-slate-500 border-slate-200'
            }`}>
              {allocQty} {item.unit || 'PCS'}
            </span>
          </div>
        );
      }
    },
    {
      id: 'availableQuantity',
      label: 'Available Stock',
      render: (item) => {
        const total = Number(item.quantity || 0);
        const alloc = Number(item.allocatedQuantity || 0);
        const free = Math.max(0, total - alloc);
        return (
          <span className={`font-mono font-extrabold px-2 py-0.5 rounded-lg text-xs border ${
            free > 0
              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
              : 'bg-rose-50 text-rose-600 border-rose-200'
          }`}>
            {free} {item.unit || 'PCS'}
          </span>
        );
      }
    },
    { id: 'location', label: 'Location', render: (item) => item.location?.name || item.locationId?.name || (typeof item.location === 'string' ? item.location : '') || '-' },
    {
      id: 'actions',
      label: 'Actions',
      render: (item) => (
        <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          {onView && (
            <button
              onClick={() => onView(item)}
              className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
              title="View Complete Profile & PDF"
            >
              <Eye size={16} />
            </button>
          )}
          <button
            onClick={() => onEdit(item)}
            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
            title="Edit"
          >
            <Edit2 size={16} />
          </button>
          <button
            onClick={() => onDelete(item._id)}
            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete"
          >
            <Trash2 size={16} />
          </button>
        </div>
      )
    }
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        onRowClick={onView}
        searchPlaceholder="Search finished goods..."
        searchableKeys={['name', 'code', 'description', 'type']}
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


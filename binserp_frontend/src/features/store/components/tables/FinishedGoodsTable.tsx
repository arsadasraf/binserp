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
      'Type': item.type || item.category || '-',
      'Unit': item.unit || 'NOS',
      'Location': item.location?.name || item.locationId?.name || (typeof item.location === 'string' ? item.location : '') || '-',
      'Revision No': item.revisionNumber || '-',
      'BOM Components Count': Array.isArray(item.bom) ? item.bom.length : 0,
      'Description': item.description || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Finished Goods Master');
    XLSX.writeFile(wb, `Finished_Goods_Master_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const columns: ColumnDef<any>[] = [
    {
      id: 'name',
      label: 'Item Name',
      render: (item) => (
        <div className="flex items-center gap-2.5">
          {item.photos && item.photos.length > 0 ? (
            <img
              src={item.photos[0]}
              alt={item.name}
              className="w-8 h-8 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-xs font-black text-indigo-600 dark:text-indigo-400 shrink-0">
              {(item.name || 'FG').slice(0, 2).toUpperCase()}
            </div>
          )}
          <span className="font-bold text-slate-900 dark:text-white">{item.name || '-'}</span>
        </div>
      )
    },
    {
      id: 'description',
      label: 'Description',
      render: (item) => (
        <span className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 max-w-[280px] block" title={item.description || ''}>
          {item.description || '-'}
        </span>
      )
    },
    {
      id: 'type',
      label: 'Type',
      render: (item) => {
        const type = item.type || item.category || 'Component';
        const colorClass =
          type === 'Assembly'
            ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800'
            : type === 'Sub Assembly'
            ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800'
            : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800';
        return (
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${colorClass}`}>
            {type}
          </span>
        );
      }
    },
    {
      id: 'unit',
      label: 'Unit',
      render: (item) => (
        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
          {item.unit || 'Nos'}
        </span>
      )
    },
    {
      id: 'location',
      label: 'Location',
      render: (item) => (
        <span className="text-xs text-slate-600 dark:text-slate-400">
          {item.location?.name || item.locationId?.name || (typeof item.location === 'string' ? item.location : '') || '-'}
        </span>
      )
    },
    {
      id: 'revisionNumber',
      label: 'Revision',
      render: (item) => (
        <span className="text-xs font-mono font-semibold text-slate-700 dark:text-slate-300">
          {item.revisionNumber || '-'}
        </span>
      )
    },
    {
      id: 'bom',
      label: 'BOM Structure',
      render: (item) => {
        const count = Array.isArray(item.bom) ? item.bom.length : 0;
        return count > 0 ? (
          <span className="px-2 py-0.5 rounded-md text-xs font-bold font-mono bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            {count} {count === 1 ? 'Item' : 'Items'}
          </span>
        ) : (
          <span className="text-xs text-slate-400">-</span>
        );
      }
    },
    {
      id: 'actions',
      label: 'Actions',
      render: (item) => (
        <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          {onView && (
            <button
              onClick={() => onView(item)}
              className="p-1.5 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/50 rounded-lg transition-colors"
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
    <>
      <DataTable
        columns={columns}
        data={data}
        onRowClick={onView}
        searchPlaceholder="Search finished goods..."
        searchableKeys={['name', 'description', 'type', 'revisionNumber']}
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


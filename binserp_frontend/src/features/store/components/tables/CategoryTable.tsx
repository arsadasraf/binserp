"use client";

import React, { useState } from 'react';
import DataTable, { ColumnDef } from '@/src/components/ui/DataTable';
import { Edit2, Trash2, Download, FileSpreadsheet, Plus, Eye } from 'lucide-react';
import * as XLSX from 'xlsx';
import StoreMasterExcelActions from '../StoreMasterExcelActions';

interface CategoryTableProps {
  data: any[];
  onEdit: (item: any) => void;
  onDelete: (id: string) => void;
  onView?: (item: any) => void;
  onAdd?: () => void;
}

export default function CategoryTable({ data, onEdit, onDelete, onView, onAdd }: CategoryTableProps) {
  const exportToExcel = () => {
    const exportData = (data || []).map((item, idx) => ({
      'S.No': idx + 1,
      'Category Name': item.name || '-',
      'Category Code': item.code || '-',
      'Type': item.type || 'Raw Material',
      'Description': item.description || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Categories');
    XLSX.writeFile(wb, `Categories_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const columns: ColumnDef<any>[] = [
    {
      id: 'name',
      label: 'Category Name',
      render: (item) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-xs font-black text-amber-600 dark:text-amber-400 shrink-0">
            {((item.name || 'CAT').slice(0, 2)).toUpperCase()}
          </div>
          <span className="font-bold text-slate-900 dark:text-white">
            {item.name || '-'}
          </span>
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
      id: 'unit',
      label: 'Default Unit',
      render: (item) => (
        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
          {item.unit || '-'}
        </span>
      )
    },
    {
      id: 'hsnCode',
      label: 'HSN / SAC',
      render: (item) => (
        <span className="text-xs font-mono font-medium text-slate-600 dark:text-slate-400">
          {item.hsnCode || '-'}
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
              className="p-1.5 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/50 rounded-lg transition-colors"
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
      searchPlaceholder="Search categories..."
      searchableKeys={['name', 'description', 'unit', 'hsnCode']}
      actionButton={
        <div className="flex flex-wrap items-center gap-2">
          <StoreMasterExcelActions
            masterTab="category"
            onExport={exportToExcel}
          />
          {onAdd && (
            <button
              onClick={onAdd}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 whitespace-nowrap text-xs font-bold transition-colors flex items-center gap-1 shadow-sm"
            >
              <Plus size={14} /> Add Category
            </button>
          )}
        </div>
      }
    />
  );
}


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
}

export default function MaterialTable({ data, onEdit, onDelete, onView, onAdd }: MaterialTableProps) {
  const exportToExcel = () => {
    const exportData = (data || []).map((item, idx) => ({
      'S.No': idx + 1,
      'Item Name': item.name || item.materialName || '-',
      'Item Code': item.code || item.materialCode || '-',
      'Category': item.category || (typeof item.categoryId === 'object' ? item.categoryId?.name : item.categoryId) || '-',
      'Unit': item.unit || '-',
      'Opening Stock': item.openingStock || 0,
      'Min Stock': item.minStock || 0,
      'Max Stock': item.maxStock || 0,
      'Rate': item.rate || 0,
      'GST Rate': item.gstRate || 18,
      'HSN Code': item.hsnCode || '-',
      'Location': item.storageLocation || (typeof item.location === 'object' ? item.location?.name : item.location) || '-',
      'Description': item.descriptions || item.description || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Materials');
    XLSX.writeFile(wb, `Materials_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const columns: ColumnDef<any>[] = [
    { id: 'name', label: 'Material Name', render: (item) => item.name || item.materialName || '-' },
    { id: 'code', label: 'Material Code', render: (item) => item.code || item.materialCode || '-' },
    { id: 'category', label: 'Category', render: (item) => item.category || (typeof item.categoryId === 'object' ? item.categoryId?.name : item.categoryId) || '-' },
    { id: 'unit', label: 'Unit', render: (item) => item.unit || '-' },
    { id: 'descriptions', label: 'Description', render: (item) => item.descriptions || item.description || '-' },
    {
      id: 'actions',
      label: 'Actions',
      render: (item) => (
        <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          {onView && (
            <button
              onClick={() => onView(item)}
              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
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
    <DataTable
      columns={columns}
      data={data}
      onRowClick={onView}
      searchPlaceholder="Search materials..."
      searchableKeys={['name', 'code', 'descriptions']}
      actionButton={
        <div className="flex flex-wrap items-center gap-2">
          <StoreMasterExcelActions
            masterTab="rm-bo-item"
            onExport={exportToExcel}
          />
          {onAdd && (
            <button
              onClick={onAdd}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 whitespace-nowrap text-xs font-bold transition-colors flex items-center gap-1 shadow-sm"
            >
              <Plus size={14} /> Add Material
            </button>
          )}
        </div>
      }
    />
  );
}

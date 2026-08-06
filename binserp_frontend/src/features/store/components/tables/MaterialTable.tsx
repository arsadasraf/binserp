"use client";

import React from 'react';
import DataTable, { ColumnDef } from '@/src/components/ui/DataTable';
import { Edit2, Trash2 } from 'lucide-react';

interface MaterialTableProps {
  data: any[];
  onEdit: (item: any) => void;
  onDelete: (id: string) => void;
  onAdd?: () => void;
}

export default function MaterialTable({ data, onEdit, onDelete, onAdd }: MaterialTableProps) {
  const columns: ColumnDef<any>[] = [
    { id: 'name', label: 'Material Name' },
    { id: 'description', label: 'Description', render: (item) => item.descriptions || '-' },
    { id: 'minimumStock', label: 'Min Stock', render: (item) => item.minimumStock ?? '-' },
    { id: 'unit', label: 'Unit', render: (item) => item.categoryId?.unit || item.category?.unit || item.unit || '-' },
    { id: 'category', label: 'Category', render: (item) => item.categoryId?.name || item.category?.name || '-' },
    { id: 'location', label: 'Location', render: (item) => item.locationId?.name || item.location?.name || '-' },
    {
      id: 'actions',
      label: 'Actions',
      render: (item) => (
        <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
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
      searchPlaceholder="Search materials..."
      searchableKeys={['name', 'descriptions']}
    
      actionButton={
        onAdd && (
          <button
            onClick={onAdd}
            className="w-full sm:w-auto px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 whitespace-nowrap text-sm font-medium transition-colors"
          >
            + Add Material
          </button>
        )
      }
    />
  );
}

"use client";

import React from 'react';
import DataTable, { ColumnDef } from '@/src/components/ui/DataTable';
import { Edit2, Trash2 } from 'lucide-react';

interface VendorTableProps {
  data: any[];
  onEdit: (item: any) => void;
  onDelete: (id: string) => void;
  onAdd?: () => void;
}

export default function VendorTable({ data, onEdit, onDelete, onAdd }: VendorTableProps) {
  const columns: ColumnDef<any>[] = [
    { id: 'name', label: 'Vendor Name' },
    { id: 'code', label: 'Code' },
    { id: 'contactPerson', label: 'Contact', render: (item) => item.contactPerson || '-' },
    { id: 'email', label: 'Email', render: (item) => item.email || '-' },
    { id: 'vendorType', label: 'Type', render: (item) => item.vendorType || '-' },
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
      searchPlaceholder="Search vendors..."
      searchableKeys={['name', 'code', 'contactPerson', 'email']}
      actionButton={
        onAdd && (
          <button
            onClick={onAdd}
            className="w-full sm:w-auto px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 whitespace-nowrap text-sm font-medium transition-colors"
          >
            + Add Vendor
          </button>
        )
      }
    />
  );
}

"use client";

import React from 'react';
import DataTable, { ColumnDef } from '@/src/components/ui/DataTable';
import { Edit2, Trash2, Plus, Eye, Power, CheckCircle2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import StoreMasterExcelActions from '../StoreMasterExcelActions';

interface CustomerTableProps {
  data: any[];
  onEdit: (item: any) => void;
  onDelete: (id: string) => void;
  onView?: (item: any) => void;
  onAdd?: () => void;
  onToggleStatus?: (item: any) => void;
}

export default function CustomerTable({ data, onEdit, onDelete, onView, onAdd, onToggleStatus }: CustomerTableProps) {
  const exportToExcel = () => {
    const exportData = (data || []).map((item, idx) => ({
      'S.No': idx + 1,
      'Customer Name': item.name || '-',
      'Customer Code': item.code || '-',
      'Customer Type': item.customerType || 'Manufacturing Sales',
      'Contact Person': item.contactPerson || '-',
      'Phone': item.phone || '-',
      'Email': item.email || '-',
      'GSTIN': item.gst || '-',
      'PAN': item.pan || '-',
      'Address': item.address || '-',
      'City': item.city || '-',
      'State': item.state || '-',
      'Pincode': item.pincode || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Customers');
    XLSX.writeFile(wb, `Customers_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const columns: ColumnDef<any>[] = [
    { 
      id: 'name', 
      label: 'Customer Name',
      render: (item) => {
        const isInactive = item.isActive === false || item.status === 'Inactive' || item.status === 'Deactivated';
        return (
          <span className={`font-bold text-slate-900 dark:text-white ${isInactive ? 'opacity-60' : ''}`}>
            {item.name || '-'}
          </span>
        );
      }
    },
    { id: 'code', label: 'Code', render: (item) => item.code || '-' },
    { 
      id: 'customerType', 
      label: 'Customer Type', 
      render: (item) => {
        const type = item.customerType || 'Manufacturing Sales';
        const badgeStyle = type === 'Labor-Job Sales'
          ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
          : "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800";

        return (
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${badgeStyle}`}>
            {type}
          </span>
        );
      }
    },
    { id: 'contactPerson', label: 'Contact Person', render: (item) => item.contactPerson || '-' },
    { id: 'phone', label: 'Phone', render: (item) => item.phone || '-' },
    { id: 'email', label: 'Email', render: (item) => item.email || '-' },
    { id: 'city', label: 'City', render: (item) => item.city || '-' },
    {
      id: 'status',
      label: 'Status',
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
      render: (item) => {
        const isInactive = item.isActive === false || item.status === 'Inactive' || item.status === 'Deactivated';
        const hasTransactions = Boolean(item.hasTransactions);

        return (
          <div className="flex justify-end items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            {onView && (
              <button
                onClick={() => onView(item)}
                className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                title="View Complete Profile & PDF"
              >
                <Eye size={15} />
              </button>
            )}
            <button
              onClick={() => onEdit(item)}
              className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
              title="Edit"
            >
              <Edit2 size={15} />
            </button>

            {/* Smart Deactivate / Status Toggle Button when transactions exist or when deactivated */}
            {(hasTransactions || isInactive || onToggleStatus) && onToggleStatus && (
              <button
                onClick={() => onToggleStatus(item)}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  isInactive
                    ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50'
                    : 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/50'
                }`}
                title={isInactive ? "Reactivate Customer" : "Deactivate Customer"}
              >
                {isInactive ? <CheckCircle2 size={15} /> : <Power size={15} />}
              </button>
            )}

            {/* Hard Delete Button: only shown if NO active transactions and item is active */}
            {!hasTransactions && !isInactive && (
              <button
                onClick={() => onDelete(item._id)}
                className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                title="Delete Customer"
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
    <DataTable
      columns={columns}
      data={data}
      onRowClick={onView}
      searchPlaceholder="Search customers..."
      searchableKeys={['name', 'code', 'customerType', 'contactPerson', 'email']}
      actionButton={
        <div className="flex flex-wrap items-center gap-2">
          <StoreMasterExcelActions
            masterTab="customer"
            onExport={exportToExcel}
          />
          {onAdd && (
            <button
              onClick={onAdd}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 whitespace-nowrap text-xs font-bold transition-colors flex items-center gap-1 shadow-sm"
            >
              <Plus size={14} /> Add Customer
            </button>
          )}
        </div>
      }
    />
  );
}

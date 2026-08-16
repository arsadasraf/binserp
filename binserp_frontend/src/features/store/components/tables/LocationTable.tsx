"use client";

import React, { useState } from 'react';
import DataTable, { ColumnDef } from '@/src/components/ui/DataTable';
import { Edit2, Trash2, Download, FileSpreadsheet, Plus } from 'lucide-react';
import * as XLSX from 'xlsx';
import MasterExcelImportModal from '../modals/MasterExcelImportModal';
import { downloadMasterExcelTemplate } from '@/src/utils/excelMasterHelper';

interface LocationTableProps {
  data: any[];
  onEdit: (item: any) => void;
  onDelete: (id: string) => void;
  onAdd?: () => void;
}

export default function LocationTable({ data, onEdit, onDelete, onAdd }: LocationTableProps) {
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const exportToExcel = () => {
    const exportData = (data || []).map((item, idx) => ({
      'S.No': idx + 1,
      'Location Name': item.name || '-',
      'Location Code': item.code || '-',
      'Rack Number': item.rackNumber || '-',
      'Bin Number': item.binNumber || '-',
      'Description': item.description || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Storage Locations');
    XLSX.writeFile(wb, `Storage_Locations_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const columns: ColumnDef<any>[] = [
    { id: 'name', label: 'Location Name' },
    { id: 'code', label: 'Code', render: (item) => item.code || '-' },
    { id: 'rackNumber', label: 'Rack No', render: (item) => item.rackNumber || '-' },
    { id: 'binNumber', label: 'Bin No', render: (item) => item.binNumber || '-' },
    { id: 'description', label: 'Description', render: (item) => item.description || '-' },
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
    <>
      <DataTable
        columns={columns}
        data={data}
        searchPlaceholder="Search locations..."
        searchableKeys={['name', 'code', 'description']}
        actionButton={
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => downloadMasterExcelTemplate('location')}
              className="px-3 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all border border-slate-200 flex items-center gap-1.5 shadow-sm"
              title="Download standard Excel template format"
            >
              <Download size={14} className="text-emerald-600" />
              Template
            </button>
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-all flex items-center gap-1.5 shadow-sm"
              title="Import Locations from Excel"
            >
              <FileSpreadsheet size={14} />
              Import Excel
            </button>
            <button
              onClick={exportToExcel}
              className="px-3 py-2 text-xs font-bold text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-all border border-green-200 flex items-center gap-1.5"
              title="Export to Excel"
            >
              <Download size={14} />
              Excel
            </button>
            {onAdd && (
              <button
                onClick={onAdd}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 whitespace-nowrap text-xs font-bold transition-colors flex items-center gap-1"
              >
                <Plus size={14} /> Add Location
              </button>
            )}
          </div>
        }
      />

      <MasterExcelImportModal
        isOpen={isImportModalOpen}
        masterTab="location"
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => window.location.reload()}
      />
    </>
  );
}

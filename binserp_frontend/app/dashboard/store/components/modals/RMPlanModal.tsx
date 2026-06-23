"use client";

import React, { useMemo } from 'react';
import { X, FileSpreadsheet, FileText, AlertCircle, CheckCircle, ClipboardList } from 'lucide-react';
import { useGetMaterialPlanQuery } from '@/src/store/services/ppcService';
import LoadingSpinner from '@/src/components/LoadingSpinner';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { UserOptions } from 'jspdf-autotable';

interface jsPDFWithPlugin extends jsPDF {
  autoTable: (options: UserOptions) => jsPDF;
}

interface RMPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string | null;
  orderNumber: string;
}

export default function RMPlanModal({ isOpen, onClose, orderId, orderNumber }: RMPlanModalProps) {
  const { data: materialPlan, isLoading } = useGetMaterialPlanQuery(orderId!, {
    skip: !orderId || !isOpen,
  });

  const items = useMemo(() => {
    return materialPlan?.items || [];
  }, [materialPlan]);

  if (!isOpen) return null;

  const handleExportExcel = () => {
    const dataToExport = items.map((item: any) => ({
      "Material Name": item.materialName || (item.material && item.material.materialName) || "Unknown",
      "Required Qty": item.requiredQuantity,
      "Available Stock": item.stockAvailable,
      "Shortage": item.shortage,
      "Unit": item.unit || "Nos",
      "Status": item.status,
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "RM Requirements");
    XLSX.writeFile(wb, `RM_Plan_Order_${orderNumber}.xlsx`);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF() as jsPDFWithPlugin;
    doc.text(`RM Requirements - Order #${orderNumber}`, 14, 15);

    const tableColumn = ["Material Name", "Required Qty", "Available Stock", "Shortage", "Unit", "Status"];
    const tableRows = items.map((item: any) => [
      item.materialName || (item.material && item.material.materialName) || "Unknown",
      item.requiredQuantity,
      item.stockAvailable,
      item.shortage,
      item.unit || "Nos",
      item.status
    ]);

    doc.autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 20
    });

    doc.save(`RM_Plan_Order_${orderNumber}.pdf`);
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white/95 backdrop-blur-xl rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-white/50">
        
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-600 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-200">
              <ClipboardList className="text-white" size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600">
                Material Requirements Plan (MRP)
              </h2>
              <p className="text-gray-500 text-sm mt-1 font-medium">
                Auto-generated for Order: <span className="text-indigo-600 font-bold">{orderNumber}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {items.length > 0 && (
              <div className="flex gap-3">
                <button
                  onClick={handleExportExcel}
                  className="flex items-center gap-2 px-4 py-2.5 bg-green-50 text-green-700 rounded-xl text-sm font-bold hover:bg-green-100 transition-colors border border-green-200 shadow-sm"
                >
                  <FileSpreadsheet className="w-5 h-5" /> Export Excel
                </button>
                <button
                  onClick={handleExportPDF}
                  className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-xl text-sm font-bold hover:from-indigo-700 hover:to-blue-700 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                >
                  <FileText className="w-5 h-5" /> Download PDF
                </button>
              </div>
            )}
            <button
              onClick={onClose}
              className="p-2.5 bg-gray-50 hover:bg-red-50 hover:text-red-600 rounded-full transition-all duration-200 text-gray-400 group ml-2"
            >
              <X size={20} className="group-hover:rotate-90 transition-transform duration-300" />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {isLoading ? (
            <div className="flex justify-center py-12"><LoadingSpinner /></div>
          ) : items.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
                <FileText className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No RM Plan Found</h3>
              <p className="text-gray-500">A material plan has not been generated or this order requires no materials.</p>
            </div>
          ) : (
            <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-medium border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-6 py-4">Material Name</th>
                    <th className="px-6 py-4 text-center">Required Qty</th>
                    <th className="px-6 py-4 text-center">Available Stock</th>
                    <th className="px-6 py-4 text-center">Shortage</th>
                    <th className="px-6 py-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
                  {items.map((item: any, idx: number) => (
                    <tr key={item._id || idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                        {item.materialName || (item.material && item.material.materialName) || "Unknown Material"}
                      </td>
                      <td className="px-6 py-4 text-center text-gray-700 dark:text-gray-300">
                        {item.requiredQuantity} <span className="text-xs text-gray-400">{item.unit || 'Nos'}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${item.stockAvailable >= item.requiredQuantity ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                          {item.stockAvailable || 0}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center font-bold">
                        {item.shortage > 0 ? (
                          <span className="text-red-600 flex items-center justify-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5" /> {item.shortage}
                          </span>
                        ) : (
                          <span className="text-green-600 flex items-center justify-center gap-1.5">
                            <CheckCircle className="w-3.5 h-3.5" /> 0
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className={`w-fit px-2.5 py-1 rounded-full text-xs font-semibold border ${
                          item.status === 'Fulfilled' ? 'bg-green-50 text-green-700 border-green-200' :
                          item.status === 'PR Raised' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {item.status || "Pending"}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

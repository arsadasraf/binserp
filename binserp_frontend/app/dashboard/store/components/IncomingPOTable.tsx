import React, { useState } from "react";
import { Plus, Edit2, Trash2, Search, FileText, ShoppingCart } from "lucide-react";
import Swal from "sweetalert2";

interface IncomingPOTableProps {
  pos: any[];
  customers: any[];
  onCreate: () => void;
  onEdit: (po: any) => void;
  onView: (po: any) => void;
  onDelete: (id: string, name: string) => void;
  onGenerateOrder: (id: string) => void;
  isGeneratingOrder: boolean;
}

export const IncomingPOTable: React.FC<IncomingPOTableProps> = ({ 
  pos, 
  customers, 
  onCreate, 
  onEdit, 
  onView, 
  onDelete, 
  onGenerateOrder,
  isGeneratingOrder
}) => {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredPos = pos?.filter((po) =>
    po.poNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    po.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div className="bg-white dark:bg-gray-900 shadow-sm border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
      <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-indigo-500" />
          Customer Purchase Orders
        </h2>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="w-full sm:w-64 relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search POs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>
          <button
            onClick={onCreate}
            className="flex-shrink-0 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white font-medium text-sm rounded-lg shadow-sm hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Create PO</span>
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-gray-800/50">
            <tr>
              <th className="px-6 py-4 font-medium">PO Number</th>
              <th className="px-6 py-4 font-medium">Date</th>
              <th className="px-6 py-4 font-medium">Customer</th>
              <th className="px-6 py-4 font-medium">Total Amount</th>
              <th className="px-6 py-4 font-medium">Status</th>
              <th className="px-6 py-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {filteredPos.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
                    <ShoppingCart className="w-12 h-12 mb-4 text-gray-300 dark:text-gray-600" />
                    <p className="text-base font-medium text-gray-900 dark:text-gray-100">No incoming POs found</p>
                    <p className="text-sm mt-1">Get started by creating a new Customer Purchase Order.</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredPos.map((po) => (
                <tr key={po._id} onClick={() => onView(po)} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group cursor-pointer">
                  <td className="px-6 py-4">
                    <span className="font-medium text-gray-900 dark:text-white">{po.poNumber}</span>
                  </td>
                  <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                    {new Date(po.date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-gray-900 dark:text-white">{po.customer?.name}</span>
                  </td>
                  <td className="px-6 py-4 text-gray-900 dark:text-white font-medium">
                    ₹{po.totalAmount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      po.status === 'Received' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' :
                      po.status === 'Accepted' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400' :
                      po.status === 'Sales Order Generated' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                      'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                    }`}>
                      {po.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {(po.status === 'Received' || po.status === 'Accepted') && (
                        <button
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            if(!isGeneratingOrder) onGenerateOrder(po._id); 
                          }}
                          disabled={isGeneratingOrder}
                          className="px-3 py-1 bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/40 rounded-lg text-xs font-medium transition-colors"
                          title="Generate Sales Order"
                        >
                          Generate SO
                        </button>
                      )}
                      
                      <button
                        onClick={(e) => { e.stopPropagation(); onEdit(po); }}
                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                        title="Edit PO"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onDelete(po._id, po.poNumber); }}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Delete PO"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

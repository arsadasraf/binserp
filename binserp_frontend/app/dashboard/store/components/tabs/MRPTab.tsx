import React, { useState } from 'react';
import { useGetGlobalMRPQuery, useUpdateMRPItemMutation } from '@/src/store/services/ppcService';
import LoadingSpinner from '@/src/components/LoadingSpinner';
import { Search, Save, AlertCircle, CheckCircle2, ClipboardList } from 'lucide-react';
import Swal from 'sweetalert2';

export default function MRPTab() {
  const { data: mrpItems = [], isLoading, isFetching } = useGetGlobalMRPQuery();
  const [updateMRPItem, { isLoading: isUpdating }] = useUpdateMRPItemMutation();
  const [searchTerm, setSearchTerm] = useState('');
  const [editQuantities, setEditQuantities] = useState<Record<string, number>>({});
  const [editStatuses, setEditStatuses] = useState<Record<string, string>>({});

  const filteredItems = mrpItems.filter(item => 
    item.materialName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.orderNumber?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleQuantityChange = (id: string, val: string) => {
    setEditQuantities(prev => ({ ...prev, [id]: Number(val) }));
  };

  const handleStatusChange = (id: string, val: string) => {
    setEditStatuses(prev => ({ ...prev, [id]: val }));
  };

  const handleSave = async (item: any) => {
    const prQuantity = editQuantities[item.itemId] !== undefined ? editQuantities[item.itemId] : item.prQuantity;
    const status = editStatuses[item.itemId] || item.status;

    try {
      await updateMRPItem({
        itemId: item.itemId,
        prQuantity,
        status
      }).unwrap();
      
      Swal.fire({
        icon: 'success',
        title: 'Updated',
        text: 'MRP item updated successfully',
        timer: 1500,
        showConfirmButton: false
      });
      
      // Clear local edit state so it reflects API data
      const newQuantities = { ...editQuantities };
      delete newQuantities[item.itemId];
      setEditQuantities(newQuantities);

      const newStatuses = { ...editStatuses };
      delete newStatuses[item.itemId];
      setEditStatuses(newStatuses);

    } catch (error: any) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error?.data?.message || 'Failed to update MRP item'
      });
    }
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><LoadingSpinner /></div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
            <ClipboardList size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Material Requirements Planning</h2>
            <p className="text-sm text-gray-500">Manage required materials and PR quantities across all orders</p>
          </div>
        </div>

        <div className="relative w-full sm:w-72">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-xl text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            placeholder="Search material or order..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50/80 text-gray-600 font-medium border-b border-gray-200">
              <tr>
                <th className="px-6 py-4">Material / Component</th>
                <th className="px-6 py-4">Source Order</th>
                <th className="px-6 py-4 text-center">Required</th>
                <th className="px-6 py-4 text-center">Available</th>
                <th className="px-6 py-4 text-center">Shortage</th>
                <th className="px-6 py-4 text-center">PR Quantity</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {filteredItems.length > 0 ? (
                filteredItems.map((item, idx) => (
                  <tr key={item.itemId || idx} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {item.materialName || 'Unknown Material'}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 font-medium text-xs border border-indigo-100">
                        {item.orderNumber}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center font-semibold text-gray-700">
                      {item.requiredQuantity} <span className="text-xs font-normal text-gray-400">{item.unit || 'Nos'}</span>
                    </td>
                    <td className="px-6 py-4 text-center text-gray-600">
                      {item.stockAvailable}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {item.shortage > 0 ? (
                        <span className="text-red-600 font-bold bg-red-50 px-2 py-1 rounded-md border border-red-100 inline-flex items-center gap-1">
                          <AlertCircle size={14} /> {item.shortage}
                        </span>
                      ) : (
                        <span className="text-green-600 font-bold bg-green-50 px-2 py-1 rounded-md border border-green-100 inline-flex items-center gap-1">
                          <CheckCircle2 size={14} /> 0
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <input 
                        type="number"
                        min="0"
                        className="w-20 px-2 py-1.5 text-center text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-inner"
                        value={editQuantities[item.itemId] !== undefined ? editQuantities[item.itemId] : (item.prQuantity || 0)}
                        onChange={(e) => handleQuantityChange(item.itemId, e.target.value)}
                      />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <select
                        className={`text-xs font-medium px-2 py-1.5 border rounded-lg outline-none transition-all cursor-pointer ${
                          (editStatuses[item.itemId] || item.status) === 'PR Raised' ? 'bg-blue-50 text-blue-700 border-blue-200' : 
                          (editStatuses[item.itemId] || item.status) === 'Fulfilled' ? 'bg-green-50 text-green-700 border-green-200' :
                          'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                        value={editStatuses[item.itemId] || item.status || 'Pending'}
                        onChange={(e) => handleStatusChange(item.itemId, e.target.value)}
                      >
                        <option value="Pending">Pending</option>
                        <option value="PR Raised">PR Raised</option>
                        <option value="Fulfilled">Fulfilled</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleSave(item)}
                        disabled={isUpdating}
                        className="inline-flex items-center justify-center p-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Save Changes"
                      >
                        <Save size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center">
                      <ClipboardList className="h-10 w-10 text-gray-300 mb-3" />
                      <p className="text-base font-medium text-gray-900">No Material Requirements Found</p>
                      <p className="text-sm mt-1">There are currently no active material requirements matching your criteria.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

"use client";

import React, { useState } from 'react';
import { useGetStoreFulfillmentsQuery, useReserveFulfillmentQuantityMutation, useMoveFulfillmentToMRPMutation } from "@/src/store/services/storeService";
import { Search, Package, Factory, Calendar, Clock, AlertTriangle } from 'lucide-react';
import LoadingSpinner from '@/src/components/LoadingSpinner';

export default function StoreFulfillmentTab() {
  const { data: fulfillments = [], isLoading, refetch } = useGetStoreFulfillmentsQuery();
  const [reserveMutation] = useReserveFulfillmentQuantityMutation();
  const [mrpMutation] = useMoveFulfillmentToMRPMutation();

  const [searchTerm, setSearchTerm] = useState("");
  const [actionModal, setActionModal] = useState<{
    isOpen: boolean;
    type: 'reserve' | 'mrp';
    fulfillmentId: string;
    maxQty: number;
    title: string;
    item: string;
  }>({
    isOpen: false,
    type: 'reserve',
    fulfillmentId: '',
    maxQty: 0,
    title: '',
    item: ''
  });
  const [inputQty, setInputQty] = useState<number | ''>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredData = fulfillments.filter((f: any) =>
    f.storeOrder?.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.fgItem?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.storeOrder?.customerName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAction = async () => {
    if (!inputQty || inputQty <= 0 || inputQty > actionModal.maxQty) return;
    
    setIsSubmitting(true);
    try {
      if (actionModal.type === 'reserve') {
        await reserveMutation({ id: actionModal.fulfillmentId, quantity: Number(inputQty) }).unwrap();
        alert("Stock reserved successfully!");
      } else {
        await mrpMutation({ id: actionModal.fulfillmentId, quantity: Number(inputQty) }).unwrap();
        alert("Quantity moved to MRP successfully!");
      }
      refetch();
      setActionModal(prev => ({ ...prev, isOpen: false }));
      setInputQty('');
    } catch (err: any) {
      alert(err.data?.message || err.message || "Action failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search by Order No, Customer, or Item..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 font-medium">
              <tr>
                <th className="px-6 py-4">Order Details</th>
                <th className="px-6 py-4">Item</th>
                <th className="px-6 py-4 text-center">Quantities</th>
                <th className="px-6 py-4 text-center">Available Stock</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    No fulfillments found.
                  </td>
                </tr>
              ) : (
                filteredData.map((f: any) => {
                  const remaining = f.orderedQuantity - f.dispatchedQuantity - f.mrpMovedQuantity - f.reservedQuantity;
                  
                  return (
                    <tr key={f._id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {f.storeOrder?.orderNumber || "N/A"}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            f.status === 'Moved MRP' ? 'bg-purple-100 text-purple-700' :
                            f.status === 'Fulfilled' ? 'bg-green-100 text-green-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {f.status || 'Pending'}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                          <Calendar size={12} />
                          {f.targetDate ? new Date(f.targetDate).toLocaleDateString() : "No Date"}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-800 dark:text-gray-200">{f.fgItem?.name}</div>
                        <div className="text-xs text-gray-500">{f.fgItem?.code}</div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex flex-col gap-1 items-center">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-700">Ordered: {f.orderedQuantity}</span>
                          {f.dispatchedQuantity > 0 && <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700">Dispatched: {f.dispatchedQuantity}</span>}
                          {f.reservedQuantity > 0 && <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">Reserved: {f.reservedQuantity}</span>}
                          {f.mrpMovedQuantity > 0 && <span className="text-xs font-semibold px-2 py-0.5 rounded bg-purple-50 text-purple-700">To MRP: {f.mrpMovedQuantity}</span>}
                          {remaining > 0 && <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">Remaining: {remaining}</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-bold ${
                          f.availableStock >= remaining && remaining > 0 ? 'bg-green-50 text-green-700 border-green-200' : 
                          f.availableStock > 0 ? 'bg-amber-50 text-amber-700 border-amber-200' : 
                          'bg-red-50 text-red-700 border-red-200'
                        }`}>
                          <Package size={16} />
                          {f.availableStock}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          {remaining > 0 && f.availableStock > 0 && (
                            <button
                              onClick={() => {
                                setActionModal({
                                  isOpen: true,
                                  type: 'reserve',
                                  fulfillmentId: f._id,
                                  maxQty: Math.min(remaining, f.availableStock),
                                  title: 'Reserve Stock',
                                  item: f.fgItem?.name
                                });
                                setInputQty(Math.min(remaining, f.availableStock));
                              }}
                              className="px-3 py-1.5 text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg transition-colors flex items-center gap-1"
                            >
                              <Clock size={14} /> Reserve
                            </button>
                          )}
                          {remaining > 0 && (
                            <button
                              onClick={() => {
                                setActionModal({
                                  isOpen: true,
                                  type: 'mrp',
                                  fulfillmentId: f._id,
                                  maxQty: remaining - (f.availableStock > 0 ? 0 : 0), // They can push however much shortage they want, up to remaining
                                  title: 'Move to MRP',
                                  item: f.fgItem?.name
                                });
                                setInputQty(remaining);
                              }}
                              className="px-3 py-1.5 text-xs font-semibold bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-lg transition-colors flex items-center gap-1"
                            >
                              <Factory size={14} /> Move to MRP
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Modal */}
      {actionModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-gray-100 dark:border-gray-800">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
              {actionModal.type === 'reserve' ? <Clock className="text-indigo-500"/> : <Factory className="text-purple-500"/>}
              {actionModal.title}
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              Item: <span className="font-semibold text-gray-700 dark:text-gray-300">{actionModal.item}</span>
            </p>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Quantity</label>
              <input
                type="number"
                value={inputQty}
                onChange={(e) => setInputQty(e.target.value === '' ? '' : Number(e.target.value))}
                min="1"
                max={actionModal.maxQty}
                className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-xs text-gray-500 mt-2">Max allowed: {actionModal.maxQty}</p>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setActionModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleAction}
                disabled={isSubmitting || !inputQty || inputQty <= 0 || inputQty > actionModal.maxQty}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
                  actionModal.type === 'reserve' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-purple-600 hover:bg-purple-700'
                } disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2`}
              >
                {isSubmitting && <LoadingSpinner />}
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

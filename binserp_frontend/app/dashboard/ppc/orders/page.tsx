"use client";

import React, { useState, useEffect } from 'react';
import PPCTabs from "../components/PPCTabs";
import { 
  useGetProductionOrdersQuery, 
  useGetPpcOrdersQuery, 
  useDeleteOrderMutation,
  useUpdatePpcOrderStatusMutation
} from "@/src/store/services/ppcService";
import { useHeader } from "@/src/context/HeaderContext";
import { FileText, Hammer, Plus, Eye, Edit2, Trash2, ChevronRight, CheckCircle2, Clock } from 'lucide-react';
import CreateOrderModal from "../components/CreateOrderModal";
import OrderDetailModal from "../components/OrderDetailModal";
import MoveToManufacturingModal from "../components/MoveToManufacturingModal";
import LoadingSpinner from '@/src/components/LoadingSpinner';

type OrderSubTab = "production-orders" | "manufacturing-orders";

export default function PPCOrdersPage() {
  const { setHeader } = useHeader();
  const [subTab, setSubTab] = useState<OrderSubTab>("production-orders");

  const { data: productionOrders = [], isLoading: loadingProd, refetch: refetchProd } = useGetProductionOrdersQuery();
  const { data: ppcOrders = [], isLoading: loadingPpc, refetch: refetchPpc } = useGetPpcOrdersQuery();

  const [deleteOrder] = useDeleteOrderMutation();
  const [updatePpcOrderStatus] = useUpdatePpcOrderStatusMutation();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [viewingOrder, setViewingOrder] = useState<any>(null);
  const [moveToMfgOrder, setMoveToMfgOrder] = useState<any>(null);

  useEffect(() => {
    setHeader("Production & Manufacturing Orders", "Manage customer sales/production orders and shop floor manufacturing orders.");
  }, [setHeader]);

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this order?")) {
      try {
        await deleteOrder(id).unwrap();
        refetchProd();
      } catch (err: any) {
        alert(err?.data?.message || "Failed to delete order");
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-950 pb-24 sm:pb-8">
      <div className="p-4 max-w-[1600px] mx-auto">
        <PPCTabs activeTab="orders" />

        <div className="mt-4 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          {/* Toolbar: SubTabs & Action */}
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-white dark:bg-gray-900 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
            <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit">
              <button
                onClick={() => setSubTab("production-orders")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                  subTab === "production-orders"
                    ? "bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-300 shadow-sm"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
                }`}
              >
                <FileText size={16} />
                Production Orders ({productionOrders.length})
              </button>
              <button
                onClick={() => setSubTab("manufacturing-orders")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                  subTab === "manufacturing-orders"
                    ? "bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-300 shadow-sm"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
                }`}
              >
                <Hammer size={16} />
                Manufacturing Orders ({ppcOrders.length})
              </button>
            </div>

            {subTab === "production-orders" && (
              <button
                onClick={() => {
                  setEditingOrder(null);
                  setIsCreateOpen(true);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs flex items-center gap-2 shadow-sm transition-all justify-center"
              >
                <Plus size={16} />
                <span>Create Production Order</span>
              </button>
            )}
          </div>

          {/* SubTab Content */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-4 sm:p-6">
            {subTab === "production-orders" ? (
              loadingProd ? (
                <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 uppercase font-bold">
                      <tr>
                        <th className="px-4 py-3">Order Number</th>
                        <th className="px-4 py-3">Customer</th>
                        <th className="px-4 py-3">PO Reference</th>
                        <th className="px-4 py-3">Delivery Date</th>
                        <th className="px-4 py-3 text-center">Status</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {productionOrders.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                            No production orders found. Click "+ Create Production Order" to add one.
                          </td>
                        </tr>
                      ) : (
                        productionOrders.map((ord: any) => (
                          <tr key={ord._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                            <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">
                              {ord.orderNumber}
                            </td>
                            <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                              {ord.customerName || "N/A"}
                            </td>
                            <td className="px-4 py-3 text-gray-500 font-mono">
                              {ord.poReference || "—"}
                            </td>
                            <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                              {ord.deliveryDate ? new Date(ord.deliveryDate).toLocaleDateString() : "N/A"}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                ord.status === 'Completed' ? 'bg-green-100 text-green-700' :
                                ord.status === 'In-Progress' || ord.status === 'Manufacturing' ? 'bg-blue-100 text-blue-700' :
                                'bg-amber-100 text-amber-700'
                              }`}>
                                {ord.status || 'Pending'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => setViewingOrder(ord)}
                                  title="View Details"
                                  className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                                >
                                  <Eye size={15} />
                                </button>
                                <button
                                  onClick={() => setMoveToMfgOrder(ord)}
                                  title="Move to Manufacturing"
                                  className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg flex items-center gap-1 text-xs font-semibold"
                                >
                                  <Hammer size={14} />
                                  <span>Move to Mfg</span>
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingOrder(ord);
                                    setIsCreateOpen(true);
                                  }}
                                  title="Edit Order"
                                  className="p-1.5 text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg"
                                >
                                  <Edit2 size={15} />
                                </button>
                                <button
                                  onClick={() => handleDelete(ord._id)}
                                  title="Delete Order"
                                  className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )
            ) : (
              loadingPpc ? (
                <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 uppercase font-bold">
                      <tr>
                        <th className="px-4 py-3">Manufacturing Order</th>
                        <th className="px-4 py-3">Product Name</th>
                        <th className="px-4 py-3 text-right">Quantity</th>
                        <th className="px-4 py-3">Target Date</th>
                        <th className="px-4 py-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {ppcOrders.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-10 text-center text-gray-400">
                            No active manufacturing orders.
                          </td>
                        </tr>
                      ) : (
                        ppcOrders.map((mo: any) => (
                          <tr key={mo._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                            <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">
                              {mo.orderNumber || mo._id}
                            </td>
                            <td className="px-4 py-3 text-gray-700 dark:text-gray-300 font-semibold">
                              {mo.productName || mo.product?.name || "FG Item"}
                            </td>
                            <td className="px-4 py-3 text-right font-medium">{mo.quantity || 1}</td>
                            <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                              {mo.deliveryDate ? new Date(mo.deliveryDate).toLocaleDateString() : "N/A"}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                mo.status === 'Completed' ? 'bg-green-100 text-green-700' :
                                mo.status === 'In Progress' || mo.status === 'InProgress' ? 'bg-blue-100 text-blue-700' :
                                'bg-amber-100 text-amber-700'
                              }`}>
                                {mo.status || 'Planned'}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>
        </div>

        {/* Modals */}
        {isCreateOpen && (
          <CreateOrderModal
            isOpen={isCreateOpen}
            initialOrder={editingOrder}
            onClose={() => {
              setIsCreateOpen(false);
              setEditingOrder(null);
            }}
            onSuccess={(msg) => {
              setIsCreateOpen(false);
              setEditingOrder(null);
              refetchProd();
            }}
          />
        )}

        {viewingOrder && (
          <OrderDetailModal
            isOpen={!!viewingOrder}
            order={viewingOrder}
            onClose={() => setViewingOrder(null)}
          />
        )}

        {moveToMfgOrder && (
          <MoveToManufacturingModal
            isOpen={!!moveToMfgOrder}
            order={moveToMfgOrder}
            onClose={() => setMoveToMfgOrder(null)}
            onSuccess={() => {
              setMoveToMfgOrder(null);
              refetchProd();
              refetchPpc();
            }}
          />
        )}
      </div>
    </div>
  );
}

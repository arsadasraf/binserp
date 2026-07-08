"use client";

import React, { useState, useMemo } from 'react';
import { 
  useGetStoreDataQuery,
  useDeleteStoreRecordMutation,
  useUpdateStoreRecordMutation
} from "@/src/store/services/storeService";
import { Search, FileSpreadsheet, FileText, Plus, Edit2, Trash2, Calendar, Filter, X, Truck } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { UserOptions } from 'jspdf-autotable';
import LoadingSpinner from '@/src/components/LoadingSpinner';

import StoreCreateOrderModal from "../modals/StoreCreateOrderModal";
import StoreOrderDetailModal from "../modals/StoreOrderDetailModal";
import RMPlanModal from "../modals/RMPlanModal";
import StoreCreateDispatchModal from "../modals/StoreCreateDispatchModal";
import StoreFulfillmentTab from "./StoreFulfillmentTab";
import StoreMRPTab from "./StoreMRPTab";

interface jsPDFWithPlugin extends jsPDF {
  autoTable: (options: UserOptions) => jsPDF;
}

interface Order {
  _id: string;
  orderNumber: string;
  customerName: string;
  productName?: string;
  productCode?: string;
  quantity?: number;
  status: string;
  completionPercentage?: number;
  dispatchDate?: string;
  deliveryDate?: string;
  createdAt: string;
  poReference?: string;
  remarks?: string;
  items?: { fgItem: any; name?: string; quantity: number; }[];
}

type OrderSubTab = "new-order" | "history" | "fulfillment" | "mrp";

export default function StoreOrdersTab() {
  const [currentSubTab, setCurrentSubTab] = useState<OrderSubTab>("new-order");
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleEditOrder = (order: Order) => {
    setEditingOrder(order);
    setShowCreateModal(true);
  };

  const handleCreateOrder = () => {
    setEditingOrder(null);
    setShowCreateModal(true);
  };

  const handleSuccess = (msg: string) => {
    alert(msg); // Or use a proper toast/alert system
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div>
      {/* Order Sub-Tabs */}
      <div className="flex gap-2 mb-6 p-1 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 w-fit shadow-sm">
        <button
          onClick={() => setCurrentSubTab("new-order")}
          className={`px-5 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${currentSubTab === "new-order"
            ? "bg-indigo-600 text-white shadow-md"
            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            }`}
        >
          New / Active Orders
        </button>
        <button
          onClick={() => setCurrentSubTab("history")}
          className={`px-5 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${currentSubTab === "history"
            ? "bg-indigo-600 text-white shadow-md"
            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            }`}
        >
          Order History
        </button>
        <button
          onClick={() => setCurrentSubTab("fulfillment")}
          className={`px-5 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${currentSubTab === "fulfillment"
            ? "bg-indigo-600 text-white shadow-md"
            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            }`}
        >
          Fulfillment
        </button>
        <button
          onClick={() => setCurrentSubTab("mrp")}
          className={`px-5 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${currentSubTab === "mrp"
            ? "bg-indigo-600 text-white shadow-md"
            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            }`}
        >
          Store MRP Queue
        </button>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-6">
        {currentSubTab === "fulfillment" ? (
          <StoreFulfillmentTab />
        ) : currentSubTab === "mrp" ? (
          <StoreMRPTab />
        ) : (
          <OrderListTab
            key={refreshKey}
            currentSubTab={currentSubTab}
            onEditOrder={handleEditOrder}
            onCreateOrder={handleCreateOrder}
          />
        )}
      </div>

      <StoreCreateOrderModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleSuccess}
        initialOrder={editingOrder}
      />
    </div>
  );
}

// Internal Order List Component
function OrderListTab({ currentSubTab, onEditOrder, onCreateOrder }: { currentSubTab: OrderSubTab; onEditOrder: (order: Order) => void; onCreateOrder: () => void }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCustomer, setFilterCustomer] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [rmPlanOpen, setRmPlanOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedRmOrder, setSelectedRmOrder] = useState<Order | null>(null);
  const [dispatchingOrder, setDispatchingOrder] = useState<Order | null>(null);
  const [showDispatchModal, setShowDispatchModal] = useState(false);

  const { data: orders = [], isLoading: loading, refetch } = useGetStoreDataQuery('order');

  const filteredOrders = useMemo(() => {
    if (!orders.length) return [];

    const lowerTerm = searchTerm.toLowerCase();
    let result = orders.filter(
      (o: any) =>
        o.orderNumber.toLowerCase().includes(lowerTerm) ||
        (o.customer?.name || "").toLowerCase().includes(lowerTerm)
    );

    if (currentSubTab === "history") {
      result = result.filter((o: any) => ["Completed", "Dispatched", "Cancelled"].includes(o.status));
    } else {
      result = result.filter((o: any) => !["Completed", "Dispatched", "Cancelled"].includes(o.status));
    }

    if (filterMonth) {
      result = result.filter((o: any) => (o.targetDate && o.targetDate.startsWith(filterMonth)));
    }
    
    if (filterStatus) {
      result = result.filter((o: any) => o.status === filterStatus);
    }
    
    if (filterCustomer) {
      result = result.filter((o: any) => (o.customer?.name || "") === filterCustomer);
    }

    return result;
  }, [searchTerm, filterMonth, filterStatus, filterCustomer, orders, currentSubTab]);

  const uniqueMonths = useMemo(() => {
    const months = new Set<string>();
    orders.forEach((o: any) => {
      if (o.targetDate) months.add(o.targetDate.substring(0, 7)); // YYYY-MM
    });
    return Array.from(months).sort().reverse();
  }, [orders]);

  const uniqueStatuses = useMemo(() => {
    return Array.from(new Set(orders.map((o: any) => o.status))).sort();
  }, [orders]);

  const uniqueCustomers = useMemo(() => {
    const customers = new Set<string>();
    orders.forEach((o: any) => {
      if (o.customer?.name) customers.add(o.customer.name);
    });
    return Array.from(customers).sort();
  }, [orders]);

  const handleExportExcel = () => {
    const dataToExport = filteredOrders.map(o => ({
      "Order Number": o.orderNumber,
      "Customer": o.customer?.name || "",
      "Product": o.items && o.items.length > 0 ? (o.items[0].name || "Multiple Items") : (o.productName || ""),
      "Quantity": o.items ? o.items.reduce((sum: number, i: any) => sum + i.quantity, 0) : (o.quantity || 0),
      "Status": o.status,
      "Target Date": o.targetDate ? new Date(o.targetDate).toLocaleDateString() : "",
      "PO Reference": o.poReference || ""
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Orders");
    XLSX.writeFile(wb, "Store_Orders.xlsx");
  };

  const handleExportPDF = () => {
    const doc = new jsPDF() as jsPDFWithPlugin;
    doc.text("Store Orders List", 14, 15);

    const tableColumn = ["Order #", "Customer", "Product", "Qty", "Status", "Date"];
    const tableRows = filteredOrders.map(o => [
      o.orderNumber,
      o.customer?.name || "",
      o.items && o.items.length > 0 ? (o.items[0].name || "Multiple Items") : (o.productName || ""),
      o.items ? o.items.reduce((sum: number, i: any) => sum + i.quantity, 0) : (o.quantity || 0),
      o.status,
      o.targetDate ? new Date(o.targetDate).toLocaleDateString() : ""
    ]);

    doc.autoTable({
      head: [tableColumn],
      body: tableRows as any[][],
      startY: 20
    });

    doc.save("Store_Orders.pdf");
  };

  const [deleteOrder] = useDeleteStoreRecordMutation();
  const [updateStatus] = useUpdateStoreRecordMutation();

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this order?")) return;
    try {
      await deleteOrder({ tab: 'order', id }).unwrap();
    } catch (error: any) {
      console.log("Delete error details:", error);
      const errorMessage = error?.data?.message || error?.error || error?.message || "An unexpected error occurred while deleting the order.";
      alert(errorMessage);
    }
  };

  const handleStatusUpdate = async (orderId: string, newStatus: string) => {
    try {
      await updateStatus({ tab: 'order', id: orderId, body: { status: newStatus } }).unwrap();
      if (selectedOrder && selectedOrder._id === orderId) {
        setSelectedOrder({ ...selectedOrder, status: newStatus });
      }
    } catch (error: any) {
      console.log("Status update error details:", error);
      const errorMessage = error?.data?.message || error?.error || error?.message || "Failed to update order status.";
      alert(errorMessage);
    }
  };



  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-center w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search orders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Filter className="w-4 h-4 text-gray-400 hidden md:block" />
            <div className="relative flex items-center bg-gray-50 border border-gray-200 rounded-lg group hover:border-indigo-300 transition-colors w-full md:w-auto h-[38px] overflow-hidden">
              <div className="pl-3 pr-2 text-gray-400 group-focus-within:text-indigo-500 transition-colors">
                <Calendar className="w-4 h-4" />
              </div>
              <input
                type="month"
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                className="bg-transparent py-2 pr-3 text-sm focus:outline-none text-gray-700 w-full cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer relative"
                title="Filter by Month & Year"
              />
              {filterMonth && (
                <button
                  type="button"
                  onClick={() => setFilterMonth("")}
                  className="pr-3 text-gray-400 hover:text-red-500 transition-colors z-10 bg-gray-50"
                  title="Clear Month Filter"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-700 w-full md:w-auto"
            >
              <option value="">All Statuses</option>
              {uniqueStatuses.map((s: any) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select
              value={filterCustomer}
              onChange={(e) => setFilterCustomer(e.target.value)}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-700 w-full md:w-auto"
            >
              <option value="">All Customers</option>
              {uniqueCustomers.map((c: any) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExportExcel} className="flex items-center gap-2 px-3 py-2 bg-green-50 text-green-700 rounded-lg text-sm font-medium hover:bg-green-100 transition-colors">
            <FileSpreadsheet className="w-4 h-4" /> Export Excel
          </button>
          {currentSubTab === 'history' && (
            <button onClick={handleExportPDF} className="flex items-center gap-2 px-3 py-2 bg-red-50 text-red-700 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors">
              <FileText className="w-4 h-4" /> Export PDF
            </button>
          )}
          <button onClick={onCreateOrder} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> Create Order
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-500 font-medium">
            <tr>
              <th className="px-6 py-3">Order #</th>
              <th className="px-6 py-3">Customer</th>
              <th className="px-6 py-3">Product</th>
              <th className="px-6 py-3">Entry Date</th>
              <th className="px-6 py-3">Target Date</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 border-t border-gray-100">
            {filteredOrders.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-gray-500">No orders found.</td></tr>
            ) : (
              filteredOrders.map((order) => (
                <tr
                  key={order._id}
                  onClick={() => {
                    setSelectedOrder(order);
                    setDetailsOpen(true);
                  }}
                  className="hover:bg-gray-50 transition-colors group cursor-pointer"
                >
                  <td className="px-6 py-4 font-medium text-gray-900">{order.orderNumber}</td>
                  <td className="px-6 py-4">{order.customer?.name || ""}</td>
                  <td className="px-6 py-4">
                    {order.items && order.items.length > 0 ? (
                      <div>
                        <div className="font-medium text-gray-800">{order.items[0].name || (order.items[0].fgItem && order.items[0].fgItem.name) || "Product"}</div>
                        {order.items.length > 1 && <div className="text-xs text-gray-500 italic">+{order.items.length - 1} more items</div>}
                        <div className="text-xs text-gray-500">Qty: {order.items.reduce((sum: number, i: any) => sum + i.quantity, 0)}</div>
                      </div>
                    ) : (
                      <div>
                        <div>{order.productName || "N/A"}</div>
                        <div className="text-xs text-gray-500">Qty: {order.quantity || 0}</div>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-gray-600 flex items-center gap-2">
                    <Calendar className="w-3 h-3 text-gray-400" />
                    {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "N/A"}
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3 h-3 text-gray-400" />
                      {order.targetDate ? new Date(order.targetDate).toLocaleDateString() : "N/A"}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className={`w-fit px-2.5 py-1 rounded-full text-xs font-semibold border ${
                      order.status === 'Dispatched' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                      order.status === 'Partially Dispatched' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                      order.status === 'Completed' ? 'bg-green-50 text-green-700 border-green-200' :
                      order.status === 'InProgress' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                      'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                      {order.status}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2 items-center">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 ml-2">
                        {order.status !== 'Completed' && order.status !== 'Dispatched' && order.status !== 'Cancelled' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setDispatchingOrder(order); setShowDispatchModal(true); }}
                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Dispatch Order"
                          >
                            <Truck size={16} />
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); onEditOrder(order); }}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit Order"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(order._id); }}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <StoreOrderDetailModal
        isOpen={detailsOpen}
        order={selectedOrder}
        onClose={() => {
          setDetailsOpen(false);
          setSelectedOrder(null);
        }}
        onUpdateStatus={handleStatusUpdate}
        storeView={true}
      />
      
      <RMPlanModal
        isOpen={rmPlanOpen}
        onClose={() => {
          setRmPlanOpen(false);
          setSelectedRmOrder(null);
        }}
        orderId={selectedRmOrder?._id || null}
        orderNumber={selectedRmOrder?.orderNumber || ""}
      />

      {showDispatchModal && dispatchingOrder && (
        <StoreCreateDispatchModal
          isOpen={showDispatchModal}
          onClose={() => setShowDispatchModal(false)}
          order={dispatchingOrder}
          onSuccess={(msg) => {
            alert(msg);
            refetch();
          }}
        />
      )}
    </div>
  );
}

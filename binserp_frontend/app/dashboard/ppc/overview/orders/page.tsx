"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { API_BASE_URL } from "@/src/utils/config";
import PPCTabs from "../../components/PPCTabs";
import PPCOverviewNav from "../components/PPCOverviewNav";
import PPCEntityDrawer, { DrawerEntity } from "../components/PPCEntityDrawer";
import { PackageCheck, Search, Filter, PlayCircle, Clock, CheckCircle2 } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";

export default function ManufacturingOrdersOverviewPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const searchParams = useSearchParams();
  const router = useRouter();

  const selectedId = searchParams.get("id");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      const res = await axios.get(`${API_BASE_URL}/api/ppc/ppc-order`, { headers }).catch(() =>
        axios.get(`${API_BASE_URL}/api/ppc/order`, { headers }).catch(() => ({ data: [] }))
      );

      const list = Array.isArray(res.data) ? res.data : res.data.orders || res.data.data || [];
      setOrders(list);
    } catch (err) {
      console.error("Failed to fetch manufacturing orders data:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = orders.filter((o) => {
    const searchMatch =
      o.orderNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.partName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.poNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    const statusMatch = statusFilter === "all" || (o.status || "In Production").toLowerCase() === statusFilter.toLowerCase();
    return searchMatch && statusMatch;
  });

  const selectedOrder = selectedId ? orders.find((o) => o._id === selectedId || o.orderNumber === selectedId) : null;

  const drawerEntity: DrawerEntity | null = selectedOrder
    ? {
        id: selectedOrder._id,
        name: `MO: ${selectedOrder.orderNumber || "MO-ORD"}`,
        code: selectedOrder.orderNumber,
        type: "order",
        status: selectedOrder.status || "In Production",
        subtitle: `Customer: ${selectedOrder.customerName || "Standard Customer"} • PO: ${selectedOrder.poNumber || "N/A"}`,
        targetQuantity: selectedOrder.targetQuantity || selectedOrder.quantity || 100,
        completedQuantity: selectedOrder.completedQuantity || 45,
        currentJob: {
          jobId: "J-MO-ACTIVE",
          jobNumber: selectedOrder.orderNumber || "MO-ACTIVE",
          partName: selectedOrder.partName || (selectedOrder.items && selectedOrder.items[0]?.partName) || "Manufacturing Part",
          operationName: "CNC Milling & Turning",
          operatorName: "Senior Machinist",
          machineName: "VMC-01 Workstation",
          startTime: new Date().toISOString(),
          progressPercentage: Math.round(
            ((selectedOrder.completedQuantity || 45) / (selectedOrder.targetQuantity || selectedOrder.quantity || 100)) * 100
          ),
          status: "InProgress",
        },
        pendingQueue: [
          {
            jobId: "MO-NEXT-1",
            jobNumber: selectedOrder.orderNumber || "MO-PENDING",
            partName: selectedOrder.partName || "Next Operation Component",
            operationName: "Surface Grinding & Deburring",
            priority: "High",
          },
          {
            jobId: "MO-NEXT-2",
            jobNumber: selectedOrder.orderNumber || "MO-PENDING",
            partName: selectedOrder.partName || "Final Process",
            operationName: "Quality Inspection & CMM",
            priority: "Medium",
          },
        ],
        completedHistory: [
          {
            jobId: "MO-DONE-1",
            jobNumber: selectedOrder.orderNumber || "MO-DONE",
            partName: selectedOrder.partName || "Raw Stock Prep",
            operationName: "Raw Material Cutting",
            completedAt: new Date().toISOString(),
            quantityProduced: selectedOrder.targetQuantity || selectedOrder.quantity || 100,
          },
        ],
      }
    : null;

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-950 pb-24 sm:pb-8">
      <div className="p-4 max-w-[1600px] mx-auto">
        <PPCTabs activeTab="overview" />
        <PPCOverviewNav />

        {/* Search & Filter Header */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-4 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-3 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search manufacturing orders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-gray-800 rounded-xl text-xs font-bold text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="text-gray-400" size={16} />
            <span className="text-xs font-bold text-gray-500">Filter:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 dark:bg-gray-800 text-xs font-extrabold text-gray-900 dark:text-white px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 focus:outline-none"
            >
              <option value="all">All Orders</option>
              <option value="In Production">In Production</option>
              <option value="Scheduled">Scheduled</option>
              <option value="Completed">Completed</option>
            </select>
          </div>
        </div>

        {/* Manufacturing Orders Grid */}
        {loading ? (
          <div className="py-20 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-12 text-center border border-dashed border-gray-200 dark:border-gray-800">
            <PackageCheck className="mx-auto text-gray-300 dark:text-gray-600 mb-3" size={40} />
            <h3 className="text-base font-extrabold text-gray-900 dark:text-white">No Orders Found</h3>
            <p className="text-xs text-gray-500 mt-1">No manufacturing orders match your search criteria.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredOrders.map((order) => {
              const status = order.status || "In Production";
              const target = order.targetQuantity || order.quantity || 100;
              const completed = order.completedQuantity || Math.floor(target * 0.45);
              const pct = Math.min(100, Math.round((completed / target) * 100));

              return (
                <div
                  key={order._id}
                  onClick={() => router.push(`/dashboard/ppc/overview/orders?id=${order._id}`)}
                  className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md transition-all cursor-pointer group hover:border-indigo-500/50 relative overflow-hidden"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                      <PackageCheck size={20} />
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        status === "Completed"
                          ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                          : status === "In Production"
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                          : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300"
                      }`}
                    >
                      {status}
                    </span>
                  </div>

                  <h3 className="text-base font-extrabold text-gray-900 dark:text-white group-hover:text-indigo-600 transition-colors">
                    {order.orderNumber || "MO-ORD"}
                  </h3>
                  <p className="text-xs text-gray-500 mb-1">{order.customerName || "Standard Customer"}</p>
                  <p className="text-xs text-gray-400 font-mono mb-4">
                    Part: {order.partName || (order.items && order.items[0]?.partName) || "Assembly Component"}
                  </p>

                  {/* Qty Progress Bar */}
                  <div className="space-y-1.5 mb-4">
                    <div className="flex justify-between text-[11px] font-bold text-gray-600 dark:text-gray-400">
                      <span>Progress: {completed} / {target} pcs</span>
                      <span className="text-indigo-600 dark:text-indigo-400">{pct}%</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs text-gray-500">
                    <span>Click to view process history</span>
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">Preview →</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Slide-over Detail Drawer */}
        <PPCEntityDrawer
          isOpen={!!selectedId}
          onClose={() => router.push("/dashboard/ppc/overview/orders")}
          entity={drawerEntity}
        />
      </div>
    </div>
  );
}

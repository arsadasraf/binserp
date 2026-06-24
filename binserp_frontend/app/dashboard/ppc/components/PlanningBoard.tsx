"use client";

import React, { useState } from "react";
import {
  Loader2, FileText, Cpu, Layers, Wrench, Users,
  ChevronDown, ChevronRight, Package, AlertCircle, CheckCircle2, Clock
} from "lucide-react";
import {
  useGetProductionOrdersQuery,
  useGetProcessesQuery,
  useGetMachineCategoriesQuery,
  useGetMachinesQuery,
  useGetManpowerQuery
} from "@/src/store/services/ppcService";

type BoardTab = "orders" | "processes" | "machine-categories" | "machines" | "manpower";

const STATUS_COLORS: Record<string, string> = {
  Available: "bg-emerald-100 text-emerald-700",
  Busy: "bg-amber-100 text-amber-800",
  Maintenance: "bg-red-100 text-red-700",
  Breakdown: "bg-red-200 text-red-800",
  Pending: "bg-gray-100 text-gray-600",
  Planning: "bg-blue-100 text-blue-700",
  InProduction: "bg-indigo-100 text-indigo-700",
  InProgress: "bg-indigo-100 text-indigo-700",
  Completed: "bg-green-100 text-green-700",
  Confirmed: "bg-teal-100 text-teal-700",
  OnLeave: "bg-yellow-100 text-yellow-700",
  Absent: "bg-red-100 text-red-700",
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] || "bg-gray-100 text-gray-600";
  return <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${cls}`}>{status}</span>;
}

// ─── ORDERS TAB ───────────────────────────────────────────
function OrdersTab() {
  const { data: orders = [], isLoading: loading } = useGetProductionOrdersQuery();
  const [expanded, setExpanded] = useState<string | null>(null);

  if (loading) return <Loader2 className="animate-spin mx-auto mt-12 text-indigo-500" />;

  return (
    <div className="space-y-3">
      {orders.length === 0 && <p className="text-center text-gray-400 py-12">No orders found.</p>}
      {orders.map((order: any) => {
        const isOpen = expanded === order._id;
        return (
          <div key={order._id} className="border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden">
            {/* Order Header */}
            <button
              onClick={() => setExpanded(isOpen ? null : order._id)}
              className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <FileText size={16} className="text-indigo-500 shrink-0" />
                <div>
                  <div className="font-bold text-sm text-gray-900 dark:text-white">{order.orderNumber}</div>
                  <div className="text-xs text-gray-500">{order.customerName} · {order.items?.length || 0} items · Due: {order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString() : "N/A"}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={order.status} />
                {isOpen ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
              </div>
            </button>

            {/* Order Items */}
            {isOpen && (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {(order.items || []).map((item: any, idx: number) => (
                  <div key={idx} className="p-4 bg-white dark:bg-gray-900">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="font-semibold text-gray-800 dark:text-white">{item.productName}</div>
                        <div className="text-xs text-gray-500">Code: {item.productCode} · Qty: {item.quantity}</div>
                      </div>
                    </div>

                    {/* Processes */}
                    {item.processSnapshot?.length > 0 && (
                      <div className="mb-3">
                        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1"><Cpu size={12} />Processes</div>
                        <div className="space-y-2">
                          {item.processSnapshot.map((proc: any, pi: number) => (
                            <div key={pi} className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-3">
                              <div className="flex justify-between items-center">
                                <span className="text-sm font-semibold text-indigo-800 dark:text-indigo-300">
                                  {pi + 1}. {proc.processName}
                                </span>
                                <StatusBadge status={proc.status || "Pending"} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── GENERIC GRID TAB ──────────────────────────────────────
function GridTab({ type }: { type: BoardTab }) {
  const { data: processes = [], isLoading: pLoading } = useGetProcessesQuery(undefined, { skip: type !== 'processes' });
  const { data: categories = [], isLoading: cLoading } = useGetMachineCategoriesQuery(undefined, { skip: type !== 'machine-categories' });
  const { data: machines = [], isLoading: mLoading } = useGetMachinesQuery(undefined, { skip: type !== 'machines' });
  const { data: manpower = [], isLoading: mpLoading } = useGetManpowerQuery(undefined, { skip: type !== 'manpower' });

  const loading = pLoading || cLoading || mLoading || mpLoading;

  let items: any[] = [];
  let icon = <Layers />;
  let titleField = "name";
  let subtitleField = "code";

  if (type === "processes") {
    items = processes; icon = <Cpu size={18} />; titleField = "processName"; subtitleField = "processCode";
  } else if (type === "machine-categories") {
    items = categories; icon = <Layers size={18} />; titleField = "categoryName"; subtitleField = "description";
  } else if (type === "machines") {
    items = machines; icon = <Wrench size={18} />; titleField = "machineName"; subtitleField = "machineCode";
  } else if (type === "manpower") {
    items = manpower; icon = <Users size={18} />; titleField = "name"; subtitleField = "employeeId";
  }

  if (loading) return <Loader2 className="animate-spin mx-auto mt-12 text-indigo-500" />;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((item: any, idx: number) => (
        <div key={idx} className="p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl">
              {icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-gray-900 dark:text-white truncate">{item[titleField]}</div>
              <div className="text-xs text-gray-500 truncate">{item[subtitleField] || "No Code"}</div>
            </div>
          </div>
          <div className="flex justify-between items-center pt-3 border-t border-gray-50 dark:border-gray-700">
             <StatusBadge status={item.status || "Available"} />
             {type === "manpower" && <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">{item.designation}</div>}
             {type === "machines" && <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">{item.machineType}</div>}
          </div>
        </div>
      ))}
      {items.length === 0 && <div className="col-span-full text-center py-12 text-gray-400">No records found.</div>}
    </div>
  );
}

export default function PlanningBoard() {
  const [activeTab, setActiveTab] = useState<BoardTab>("orders");

  const tabs: { id: BoardTab; label: string; icon: any }[] = [
    { id: "orders", label: "Orders", icon: <FileText size={16} /> },
    { id: "processes", label: "Processes", icon: <Cpu size={16} /> },
    { id: "machine-categories", label: "Categories", icon: <Layers size={16} /> },
    { id: "machines", label: "Machines", icon: <Wrench size={16} /> },
    { id: "manpower", label: "Manpower", icon: <Users size={16} /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${activeTab === tab.id
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none"
                : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-100 dark:border-gray-700"
              }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="min-h-[400px]">
        {activeTab === "orders" ? <OrdersTab /> : <GridTab type={activeTab} />}
      </div>
    </div>
  );
}

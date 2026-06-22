"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  useGetMachinesQuery, 
  useGetManpowerQuery, 
  useGetPpcOrdersQuery,
  useDeleteOrderMutation,
  useUpdatePpcOrderStatusMutation
} from "@/src/store/services/ppcService";
import {
  LayoutDashboard,
  ClipboardList,
  Settings,
  Users,
  Calendar,
  Search,
  FileSpreadsheet,
  FileText,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Edit,
  Edit2,
  Eye,
  Hammer,
  Cpu,
  Package,
  Store,
  Clock // Added Clock icon
} from 'lucide-react';
import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import LoadingSpinner from '@/src/components/LoadingSpinner';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { UserOptions } from 'jspdf-autotable'; // Type import if needed, or just standard import

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
  priority?: string;
  remarks?: string;
  photos?: string[];
  components?: any[];
  items?: { product: any; productName?: string; quantity: number; trackingType?: string }[];
  jobs?: any[];
}

// Extend jsPDF for autotable
interface jsPDFWithPlugin extends jsPDF {
  autoTable: (options: UserOptions) => jsPDF;
}
import ErrorAlert from "@/src/components/ErrorAlert";
import SuccessAlert from "@/src/components/SuccessAlert";
import PPCTabs from "./components/PPCTabs";
import PPCStoreTab from "./components/PPCStoreTab";
import PPCMachinesTab from "./components/PPCMachinesTab"; // Import the new component
import PPCManpowerTab from "./components/PPCManpowerTab";
import PPCProductsTab from "./components/PPCProductsTab";
import PPCShiftTab from "./components/PPCShiftTab"; // Import PPCShiftTab
import PPCTraceTab from "./components/PPCTraceTab";
import OrderDetailModal from "./components/OrderDetailModal";
import CreateOrderModal from "./components/CreateOrderModal";
import OrderActionModal from "./components/OrderActionModal";
import PlanningBoard from "./components/PlanningBoard";
import ProcurementDashboard from "./components/ProcurementDashboard"; // New Import
import DispatchTab from "./components/DispatchTab"; // New Import
import { API_BASE_URL } from "@/src/utils/config";

// Define Tab Types
import OperatorExecution from "./components/OperatorExecution";
import ProductionReports from "./components/ProductionReports";
import PPCPlanningTab from "./components/PPCPlanningTab"; // New Import

type PPCTab = "overview" | "orders" | "planning" | "master";
type OrderSubTab = "new-order" | "history";
type MasterSubTab = "machine-list" | "products" | "store" | "manpower" | "shift-management";

import { useHeader } from "@/src/context/HeaderContext";

// ...

export default function PPCPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setHeader } = useHeader();

  useEffect(() => {
    setHeader("Production Control", "Manage manufacturing, orders, and planning efficiently.");
  }, [setHeader]);

  // Parse tabs from URL or default
  const tab = (searchParams.get("tab") as PPCTab) || "overview";
  const subTab = searchParams.get("subTab");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const userType = localStorage.getItem("userType");
    const userInfoStr = localStorage.getItem("userInfo");

    if (!token) {
      router.push("/login");
      return;
    }

    if (userType === "user" && userInfoStr) {
      const user = JSON.parse(userInfoStr);
      // Allow access if department is PPC, CEO, MD, Manager or if user is Company Admin
      const allowedDepartments = ["PPC", "CEO", "MD", "Manager", "Admin"];
      if (!allowedDepartments.includes(user.department)) {
        setError("Access denied. You don't have permission to access PPC module.");
        setTimeout(() => {
          router.push("/dashboard");
        }, 2000);
        return;
      }
    }

    setLoading(false);
  }, [router]);

  // Helper to update URL with tab and subTab
  const navigateTo = (newTab: PPCTab, newSubTab?: string) => {
    const params = new URLSearchParams();
    params.set("tab", newTab);
    if (newSubTab) params.set("subTab", newSubTab);
    router.push(`/dashboard/ppc?${params.toString()}`);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-950 pb-24 sm:pb-8">
      <div className="p-4 max-w-[1600px] mx-auto">
        {/* Header removed */}

        {/* Alerts */}
        <div className="max-w-4xl">
          {error && <ErrorAlert message={error} onClose={() => setError("")} />}
          {success && <SuccessAlert message={success} onClose={() => setSuccess("")} />}
        </div>

        {/* Main Tabs Navigation */}
        <PPCTabs activeTab={tab} />

        {/* Tab Content */}
        <div className="mt-4 animate-in fade-in slide-in-from-bottom-4 duration-500">

          {/* OVERVIEW TAB */}
          {tab === "overview" && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-4 sm:p-6">
              <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Shop Floor Live Status</h2>
              <HomeTab />
            </div>
          )}

          {/* ORDERS TAB */}
          {tab === "orders" && (
            <OrdersLayout
              currentSubTab={(subTab as OrderSubTab) || "new-order"}
              onChangeSubTab={(st) => navigateTo("orders", st)}
              setSuccess={setSuccess}
              setError={setError}
            />
          )}

          {/* PLANNING TAB */}
          {tab === "planning" && <PPCPlanningTab />}

          {/* MASTER TAB */}
          {tab === "master" && (
            <div className="flex flex-col gap-6">
              {/* Primary Master Sub-tabs: Shopfloor, Products, Store */}
              <div className="flex flex-wrap gap-2 mb-2 items-center bg-white dark:bg-gray-900 p-1.5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 w-fit">
                {[
                  { id: "shopfloor", label: "Shopfloor", icon: Hammer },
                  { id: "products", label: "Products", icon: Package },
                  { id: "store", label: "Store", icon: Store },
                ].map((primaryTab) => {
                  let isActive = false;
                  if (primaryTab.id === "products") isActive = subTab === "products";
                  else if (primaryTab.id === "store") isActive = subTab === "store";
                  else isActive = !subTab || ["machine-list", "machines", "manpower", "shift-management", "shopfloor"].includes(subTab);

                  const Icon = primaryTab.icon;
                  return (
                    <button
                      key={primaryTab.id}
                      onClick={() => navigateTo("master", primaryTab.id === "shopfloor" ? "machine-list" : primaryTab.id)}
                      className={`relative flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all duration-300 ${isActive ? "text-white shadow-md" : "text-gray-500 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800"
                        }`}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="activeMasterPrimaryTab"
                          className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-violet-600 rounded-xl"
                          initial={false}
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        />
                      )}
                      <div className="relative z-10 flex items-center gap-2">
                        <Icon size={18} />
                        {primaryTab.label}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Secondary Tabs for Shopfloor */}
              {(!subTab || ["machine-list", "machines", "manpower", "shift-management", "shopfloor"].includes(subTab)) && (
                <div className="flex flex-wrap gap-2 mb-2 items-center bg-gray-50 dark:bg-gray-800/50 p-1 rounded-xl border border-gray-100 dark:border-gray-800 w-fit">
                  {[
                    { id: "machine-list", label: "Machines", icon: Cpu },
                    { id: "manpower", label: "Employees", icon: Users },
                    { id: "shift-management", label: "Shifts", icon: Clock },
                  ].map((secondaryTab) => {
                    const isActive = subTab === secondaryTab.id || (secondaryTab.id === "machine-list" && (!subTab || subTab === "machines" || subTab === "shopfloor"));
                    const Icon = secondaryTab.icon;
                    return (
                      <button
                        key={secondaryTab.id}
                        onClick={() => navigateTo("master", secondaryTab.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${isActive
                          ? "bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm border border-gray-200 dark:border-gray-600"
                          : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
                          }`}
                      >
                        <Icon size={16} />
                        {secondaryTab.label}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-6">
                {subTab === "products" ? (
                  <PPCProductsTab />
                ) : subTab === "manpower" ? (
                  <PPCManpowerTab />
                ) : subTab === "store" ? (
                  <PPCStoreTab />
                ) : subTab === "shift-management" ? (
                  <PPCShiftTab />
                ) : (
                  <PPCMachinesTab initialTab="machine-list" />
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ==================== SUB-COMPONENTS ====================

// Home Tab Component
type ShopFloorTab = "machines" | "employees" | "inprogress" | "scheduled" | "qc" | "vendor";

function HomeTab() {
  const [subTab, setSubTab] = useState<ShopFloorTab>("machines");
  const [selected, setSelected] = useState<any>(null);

  const tabs: { id: ShopFloorTab; label: string }[] = [
    { id: "machines", label: "Machines" },
    { id: "employees", label: "Manpower" },
    { id: "inprogress", label: "In-Progress" },
    { id: "scheduled", label: "Scheduled" },
    { id: "qc", label: "QC Pending" },
    { id: "vendor", label: "Vendor Jobs" },
  ];

  const { data: machines = [], isLoading: loadingMachines } = useGetMachinesQuery(undefined, { skip: subTab !== "machines" });
  const { data: manpower = [], isLoading: loadingManpower } = useGetManpowerQuery(undefined, { skip: subTab !== "employees" });
  const { data: allOrders = [], isLoading: loadingOrders } = useGetPpcOrdersQuery();

  const loading = loadingMachines || loadingManpower || (loadingOrders && subTab !== "machines" && subTab !== "employees");

  const data = useMemo(() => {
    if (subTab === "machines") return machines;
    if (subTab === "employees") return manpower;
    if (subTab === "inprogress") return allOrders.filter(o => o.status === "InProgress");
    if (subTab === "scheduled") return allOrders.filter(o => o.status === "Planning");
    if (subTab === "qc") return allOrders.filter(o => o.status === "QC_Pending");
    if (subTab === "vendor") return allOrders.filter(o => o.status === "InProduction");
    return [];
  }, [subTab, machines, manpower, allOrders]);

  useEffect(() => {
    setSelected(null);
  }, [subTab]);


  const statusColor = (status: string) => {
    const map: Record<string, string> = {
      Available: "bg-green-100 text-green-700",
      Busy: "bg-amber-100 text-amber-800",
      Maintenance: "bg-red-100 text-red-700",
      InProgress: "bg-indigo-100 text-indigo-700",
      Planning: "bg-blue-100 text-blue-700",
      QC_Pending: "bg-orange-100 text-orange-700",
      InProduction: "bg-violet-100 text-violet-700",
      Completed: "bg-green-100 text-green-700",
      Pending: "bg-gray-100 text-gray-600",
    };
    return map[status] || "bg-gray-100 text-gray-600";
  };

  return (
    <div>
      {/* Tab Strip */}
      <div className="flex overflow-x-auto gap-1 mb-4 p-1 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 w-fit max-w-full">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={`px-4 py-1.5 rounded-lg font-medium text-sm whitespace-nowrap transition-all duration-200 ${
              subTab === t.id
                ? "bg-indigo-600 text-white shadow-md"
                : "text-gray-600 hover:bg-white hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-10"><LoadingSpinner /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {data.length === 0 && (
            <p className="text-gray-400 text-center py-10 col-span-3">No records found.</p>
          )}

          {/* MACHINES */}
          {subTab === "machines" && data.map((m: any) => (
            <div
              key={m._id}
              onClick={() => setSelected(selected?._id === m._id ? null : m)}
              className={`p-4 border rounded-xl cursor-pointer transition-all duration-200 ${selected?._id === m._id ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 shadow-sm" : "border-gray-100 dark:border-gray-800 hover:border-indigo-200 hover:shadow-sm"}`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-bold text-gray-900 dark:text-white">{m.machineName}</p>
                  <p className="text-xs text-gray-500 font-mono">{m.machineCode}</p>
                  <p className="text-xs text-gray-400 mt-1 uppercase tracking-wide">{m.machineType}</p>
                </div>
                <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${statusColor(m.status)}`}>{m.status}</span>
              </div>
              {selected?._id === m._id && (
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400 space-y-1">
                  <div className="flex justify-between"><span>Location</span><span className="font-medium">{m.location || "—"}</span></div>
                  <div className="flex justify-between"><span>Make</span><span className="font-medium">{m.make || "—"}</span></div>
                  {m.availability !== undefined && (
                    <>
                      <div className="flex justify-between"><span>Availability</span><span className="font-medium">{m.availability}%</span></div>
                      <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full mt-1">
                        <div className={`h-full rounded-full ${m.availability > 60 ? "bg-emerald-500" : m.availability > 30 ? "bg-amber-400" : "bg-red-500"}`} style={{ width: `${m.availability}%` }} />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* EMPLOYEES */}
          {subTab === "employees" && data.map((emp: any) => (
            <div
              key={emp._id}
              onClick={() => setSelected(selected?._id === emp._id ? null : emp)}
              className={`p-4 border rounded-xl cursor-pointer transition-all duration-200 ${selected?._id === emp._id ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 shadow-sm" : "border-gray-100 dark:border-gray-800 hover:border-indigo-200 hover:shadow-sm"}`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-bold text-gray-900 dark:text-white">{emp.employee?.name || "N/A"}</p>
                  <p className="text-xs text-gray-500">{emp.employee?.employeeId || "—"}</p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {emp.skills?.slice(0,3).map((s: any, i: number) => (
                      <span key={i} className="text-[10px] bg-violet-50 text-violet-600 dark:bg-violet-900/20 px-1.5 py-0.5 rounded-full">{s.name}</span>
                    ))}
                  </div>
                </div>
                <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${statusColor(emp.status)}`}>{emp.status}</span>
              </div>
              {selected?._id === emp._id && (
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 text-xs space-y-1">
                  <div className="flex justify-between text-gray-500"><span>Current Load</span><span className="font-medium text-gray-800 dark:text-gray-200">{emp.currentLoad || 0}%</span></div>
                  <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full">
                    <div className={`h-full rounded-full ${(emp.currentLoad||0) > 80 ? "bg-red-500" : (emp.currentLoad||0) > 50 ? "bg-amber-400" : "bg-emerald-500"}`} style={{ width: `${Math.min(emp.currentLoad||0,100)}%` }} />
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* ORDER STATUS TABS: InProgress, Scheduled, QC, Vendor */}
          {["inprogress","scheduled","qc","vendor"].includes(subTab) && data.map((order: any) => (
            <div
              key={order._id}
              onClick={() => setSelected(selected?._id === order._id ? null : order)}
              className={`p-4 border rounded-xl cursor-pointer transition-all duration-200 ${selected?._id === order._id ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 shadow-sm" : "border-gray-100 dark:border-gray-800 hover:border-indigo-200 hover:shadow-sm"}`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-bold text-gray-900 dark:text-white">{order.orderNumber}</p>
                  <p className="text-xs text-gray-500">{order.customerName}</p>
                  <p className="text-xs text-gray-400 mt-1">{order.items?.length || 0} item(s)</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${statusColor(order.status)}`}>{order.status}</span>
                  <span className="text-[10px] text-gray-400">{order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString() : "—"}</span>
                </div>
              </div>
              {selected?._id === order._id && (
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 space-y-2">
                  {order.items?.map((item: any, i: number) => (
                    <div key={i} className="text-xs bg-white dark:bg-gray-800 rounded-lg p-2 border border-gray-100 dark:border-gray-700">
                      <div className="flex justify-between font-semibold text-gray-800 dark:text-gray-200">
                        <span>{item.productName}</span>
                        <span>Qty: {item.quantity}</span>
                      </div>
                      {item.processSnapshot?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {item.processSnapshot.map((p: any, pi: number) => (
                            <span key={pi} className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-full">{pi+1}. {p.processName}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}



// Orders Layout Component
// Orders Layout Component
function OrdersLayout({ currentSubTab, onChangeSubTab, setSuccess, setError }: {
  currentSubTab: OrderSubTab;
  onChangeSubTab: (tab: OrderSubTab) => void;
  setSuccess: (msg: string) => void;
  setError: (msg: string) => void;
}) {
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
    setSuccess(msg);
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div>
      {/* Order Sub-Tabs */}
      <div className="flex gap-2 mb-6 p-1 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 w-fit shadow-sm">
        <button
          onClick={() => onChangeSubTab("new-order")}
          className={`px-5 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${currentSubTab === "new-order"
            ? "bg-indigo-600 text-white shadow-md"
            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            }`}
        >
          New / Active Orders
        </button>
        <button
          onClick={() => onChangeSubTab("history")}
          className={`px-5 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${currentSubTab === "history"
            ? "bg-indigo-600 text-white shadow-md"
            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            }`}
        >
          Order History
        </button>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-6">
        <OrderListTab
          key={refreshKey}
          currentSubTab={currentSubTab}
          onChangeSubTab={onChangeSubTab}
          onEditOrder={handleEditOrder}
          onCreateOrder={handleCreateOrder}
        />
      </div>

      <CreateOrderModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleSuccess}
        initialOrder={editingOrder}
      />
    </div>
  );
}

// Order List Tab Component with Search, Export, and Details
// Order List Tab Component with Search, Export, and Details
// Order List Tab Component with Search, Export, and Details
function OrderListTab({ currentSubTab, onChangeSubTab, onEditOrder, onCreateOrder }: { currentSubTab: OrderSubTab; onChangeSubTab: (t: any) => void; onEditOrder: (order: Order) => void; onCreateOrder: () => void }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const { data: orders = [], isLoading: loading } = useGetPpcOrdersQuery();

  const filteredOrders = useMemo(() => {
    if (!orders.length) return [];

    const lowerTerm = searchTerm.toLowerCase();
    let result = orders.filter(
      (o: any) =>
        o.orderNumber.toLowerCase().includes(lowerTerm) ||
        o.customerName.toLowerCase().includes(lowerTerm)
    );

    if (currentSubTab === "history") {
      result = result.filter((o: any) => ["Completed", "Dispatched", "Cancelled"].includes(o.status));
    } else {
      result = result.filter((o: any) => !["Completed", "Dispatched", "Cancelled"].includes(o.status));
    }

    return result;
  }, [searchTerm, orders, currentSubTab]);


  const handleExportExcel = () => {
    const dataToExport = filteredOrders.map(o => ({
      "Order Number": o.orderNumber,
      "Customer": o.customerName,
      "Product": o.items && o.items.length > 0 ? (o.items[0].productName || "Multiple Items") : (o.productName || ""),
      "Quantity": o.items ? o.items.reduce((sum: number, i: any) => sum + i.quantity, 0) : (o.quantity || 0),
      "Status": o.status,
      "Dispatch Date": o.dispatchDate ? new Date(o.dispatchDate).toLocaleDateString() : (o.deliveryDate ? new Date(o.deliveryDate).toLocaleDateString() : ""),
      "PO Reference": o.poReference || ""
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Orders");
    XLSX.writeFile(wb, "PPC_Orders.xlsx");
  };

  const handleExportPDF = () => {
    const doc = new jsPDF() as jsPDFWithPlugin;
    doc.text("PPC Orders List", 14, 15);

    const tableColumn = ["Order #", "Customer", "Product", "Qty", "Status", "Date"];
    const tableRows = filteredOrders.map(o => [
      o.orderNumber,
      o.customerName,
      o.items && o.items.length > 0 ? (o.items[0].productName || "Multiple Items") : (o.productName || ""),
      o.items ? o.items.reduce((sum: number, i: any) => sum + i.quantity, 0) : (o.quantity || 0),
      o.status,
      o.dispatchDate ? new Date(o.dispatchDate).toLocaleDateString() : (o.deliveryDate ? new Date(o.deliveryDate).toLocaleDateString() : "")
    ]);

    doc.autoTable({
      head: [tableColumn],
      body: tableRows as any[][], // Type casting to resolve potential TS issues with RowInput
      startY: 20
    });

    doc.save("PPC_Orders.pdf");
  };

  const [deleteOrder] = useDeleteOrderMutation();
  const [updateStatus] = useUpdatePpcOrderStatusMutation();

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this order?")) return;
    try {
      await deleteOrder(id).unwrap();
    } catch (error: any) {
      console.error("Delete error full details:", error);
      const errorMessage = error?.data?.message || error?.message || "An unexpected error occurred while deleting the order.";
      alert(errorMessage);
    }
  };

  const handleStatusUpdate = async (orderId: string, newStatus: string) => {
    try {
      await updateStatus({ id: orderId, status: newStatus }).unwrap();
      // Update selectedOrder if it's the one being modified
      if (selectedOrder && selectedOrder._id === orderId) {
        setSelectedOrder({ ...selectedOrder, status: newStatus });
      }
    } catch (error: any) {
      console.error("Failed to update status full details:", error);
      const errorMessage = error?.data?.message || error?.message || "Failed to update order status.";
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
      <div className="flex justify-between items-center mb-6">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search orders..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
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
                  <td className="px-6 py-4">{order.customerName}</td>
                  <td className="px-6 py-4">
                    {order.items && order.items.length > 0 ? (
                      <div>
                        <div className="font-medium text-gray-800">{order.items[0].productName || (order.items[0].product && order.items[0].product.componentName) || "Product"}</div>
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
                    {order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString() : (order.dispatchDate ? new Date(order.dispatchDate).toLocaleDateString() : "N/A")}
                  </td>
                  <td className="px-6 py-4">
                    <div className={`w-fit px-2.5 py-1 rounded-full text-xs font-semibold border ${order.status === 'Dispatched' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                      order.status === 'Completed' ? 'bg-green-50 text-green-700 border-green-200' :
                        order.status === 'InProgress' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                      {order.status}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => { e.stopPropagation(); onEditOrder(order); }}
                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(order._id); }}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <OrderDetailModal
        isOpen={detailsOpen}
        order={selectedOrder}
        onClose={() => {
          setDetailsOpen(false);
          setSelectedOrder(null);
        }}
        onUpdateStatus={handleStatusUpdate}
      />
    </div>
  );
}



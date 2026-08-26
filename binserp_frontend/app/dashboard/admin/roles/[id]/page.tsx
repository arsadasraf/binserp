"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Swal from "sweetalert2";
import { 
  Save, 
  ArrowLeft, 
  Check, 
  Shield, 
  ShieldCheck, 
  Layers, 
  RotateCcw,
  CheckCircle2,
  Package,
  Users,
  Cpu,
  Lock,
  Building2,
  PhoneCall,
  DollarSign,
  Wrench,
  CheckSquare,
  Square,
  SlidersHorizontal,
  Info
} from "lucide-react";
import Link from "next/link";
import { API_BASE_URL } from "@/src/utils/config";
import { useHeader } from "@/src/context/HeaderContext";

interface TabItem {
  id: string;
  label: string;
  description?: string;
  route?: string;
}

interface ModuleSchema {
  name: string;
  label: string;
  icon?: any;
  color?: string;
  tabs: TabItem[];
}

const MODULE_DEFINITIONS: ModuleSchema[] = [
  {
    name: "Store",
    label: "Store & Inventory",
    icon: Package,
    color: "from-blue-600 to-cyan-600",
    tabs: [
      { id: "inventory", label: "Inventory", description: "RM & BO Stock, In-House Stock, GRN & FG GRN History", route: "/dashboard/store/inventory/rm-bo-stock" },
      { id: "purchase", label: "Purchase", description: "Purchase Orders (PO), MRP Planning, Vendor Quotes, Purchase Bills", route: "/dashboard/store/purchase/po" },
      { id: "sales", label: "Sales", description: "Sales Orders, Quotations, Invoices, Delivery Challans, Price List, RFQ", route: "/dashboard/store/sales/orders" },
      { id: "wip", label: "WIP", description: "WIP Material Requests, Job Work & Material Issue History", route: "/dashboard/store/wip/requests" },
      { id: "masters", label: "Masters", description: "Materials, Vendors, Customers, Categories, Locations, Finished Goods", route: "/dashboard/store/masters/vendors" }
    ]
  },
  {
    name: "HR",
    label: "Human Resources",
    icon: Users,
    color: "from-emerald-600 to-teal-600",
    tabs: [
      { id: "overview", label: "Overview", description: "HR Dashboard, Attendance Analytics & Summary", route: "/dashboard/hr?tab=home" },
      { id: "kiosk", label: "Attendance Kiosk", description: "Live Camera & Manual Check-in Kiosk", route: "/dashboard/hr?tab=attendance" },
      { id: "present", label: "Present Log", description: "Live Attendance & Daily Presence Records", route: "/dashboard/hr?tab=present" },
      { id: "salaries", label: "Salaries & Payroll", description: "Salaries, Overtime & Payout Slips", route: "/dashboard/hr?tab=salaries" },
      { id: "masters", label: "HR Masters", description: "Employees, Departments, Designations, Holidays, Settings", route: "/dashboard/hr?tab=master" }
    ]
  },
  {
    name: "PPC",
    label: "Production (PPC)",
    icon: Cpu,
    color: "from-purple-600 to-indigo-600",
    tabs: [
      { id: "overview", label: "Overview", description: "Production Analytics & KPIs", route: "/dashboard/ppc/overview" },
      { id: "orders", label: "Orders List", description: "PPC Production Orders & Batches", route: "/dashboard/ppc/orders" },
      { id: "planning", label: "Planning", description: "Machine & Material Scheduling", route: "/dashboard/ppc/planning" },
      { id: "tracing", label: "Traceability", description: "Route Cards & Work-in-Progress Tracking", route: "/dashboard/ppc/tracing" },
      { id: "masters", label: "PPC Masters", description: "Work Centers, Machines & Routing Masters", route: "/dashboard/ppc/master" }
    ]
  },
  {
    name: "Security",
    label: "Gate Security & Entry",
    icon: Shield,
    color: "from-amber-600 to-orange-600",
    tabs: [
      { id: "overview", label: "Overview", description: "Gate Entry Real-Time Overview", route: "/dashboard/gate-entry?tab=overview" },
      { id: "kiosk", label: "Kiosk Mode", description: "Gate Face & Manual Attendance Kiosks", route: "/dashboard/gate-entry?tab=kiosk" },
      { id: "visitor", label: "Visitor Log", description: "Active Visitor Passes & History", route: "/dashboard/gate-entry?tab=visitor" },
      { id: "vehicle", label: "Vehicle Log", description: "Loading & Unloading Gate Vehicle Movement", route: "/dashboard/gate-entry?tab=vehicle" },
      { id: "employee-movement", label: "Employee Movement", description: "Gate In/Out Activity Log", route: "/dashboard/gate-entry?tab=employee-movement" }
    ]
  },
  {
    name: "Quality",
    label: "Quality Control",
    icon: CheckCircle2,
    color: "from-teal-600 to-emerald-600",
    tabs: [
      { id: "overview", label: "Overview", description: "Quality KPIs, Inspection Analytics & Rejection Rates", route: "/dashboard/quality/overview" },
      { id: "incoming", label: "Incoming QC", description: "RM & BO Purchase GRN Quality Inspections & SCN Reports", route: "/dashboard/quality/incoming" },
      { id: "process", label: "Process QC", description: "In-Process Quality Checks & Production Line Inspections", route: "/dashboard/quality/process" },
      { id: "jobwork-qc", label: "Job Work QC", description: "Subcontractor Inward Quality Inspection & Approvals", route: "/dashboard/quality/jobwork-qc" },
      { id: "fg-qc", label: "FG QC & PDI", description: "Finished Goods PDI & Final Product Quality Certifications", route: "/dashboard/quality/fg-qc" },
      { id: "master", label: "Quality Masters", description: "Inspection Parameters, Instruments & Tolerance Standards", route: "/dashboard/quality/master" }
    ]
  },
  {
    name: "Admin",
    label: "Admin & User Management",
    icon: Lock,
    color: "from-rose-600 to-pink-600",
    tabs: [
      { id: "overview", label: "Overview", description: "Company Profile & Overview", route: "/dashboard/admin/overview" },
      { id: "users", label: "User Management", description: "User Accounts & Credentials", route: "/dashboard/admin" },
      { id: "roles", label: "Role Management", description: "Roles & RBAC Access Control", route: "/dashboard/admin/roles" }
    ]
  },
  {
    name: "CRM",
    label: "CRM & Sales",
    icon: PhoneCall,
    color: "from-blue-500 to-indigo-500",
    tabs: [{ id: "overview", label: "CRM Overview", description: "Lead Pipeline, Customers & Deals", route: "/dashboard/crm" }]
  },
  {
    name: "Accounts",
    label: "Accounts & Finance",
    icon: DollarSign,
    color: "from-green-600 to-emerald-600",
    tabs: [{ id: "overview", label: "Accounts Overview", description: "Ledgers, Receivables & Payables", route: "/dashboard/accounts" }]
  },
  {
    name: "Maintenance",
    label: "Maintenance",
    icon: Wrench,
    color: "from-slate-600 to-gray-700",
    tabs: [{ id: "overview", label: "Maintenance Overview", description: "Equipment Status & Preventive Schedules", route: "/dashboard/maintenance" }]
  },
  {
    name: "Reports",
    label: "Reports & Analytics",
    icon: Building2,
    color: "from-violet-600 to-purple-600",
    tabs: [{ id: "overview", label: "Reports Overview", description: "Cross-departmental BI & Export Reports", route: "/dashboard/reports" }]
  }
];

// Helper to normalize legacy tab strings to clean main tab IDs
function normalizeTabId(moduleName: string, rawTab: string): string {
  const t = rawTab.toLowerCase();
  if (moduleName.toLowerCase() === "store") {
    if (t.startsWith("inventory") || t === "home" || t.includes("stock") || t.includes("grn")) return "inventory";
    if (t.startsWith("purchase") || t.includes("po") || t.includes("mrp") || t.includes("vendor-price")) return "purchase";
    if (t.startsWith("sales") || t.includes("order") || t.includes("quotation") || t.includes("billing") || t.includes("dc") || t.includes("rfq")) return "sales";
    if (t.startsWith("wip") || t.includes("request") || t.includes("job-work") || t.includes("material-issue")) return "wip";
    if (t.startsWith("masters") || t.includes("master")) return "masters";
  }
  if (moduleName.toLowerCase() === "hr") {
    if (t.includes("kiosk") || t.includes("attendance")) return "kiosk";
    if (t.includes("present")) return "present";
    if (t.includes("salar") || t.includes("payroll")) return "salaries";
    if (t.includes("master")) return "masters";
    return "overview";
  }
  if (moduleName.toLowerCase() === "ppc") {
    if (t.includes("order")) return "orders";
    if (t.includes("planning")) return "planning";
    if (t.includes("tracing") || t.includes("trace")) return "tracing";
    if (t.includes("master")) return "masters";
    return "overview";
  }
  if (moduleName.toLowerCase() === "security") {
    if (t.includes("kiosk")) return "kiosk";
    if (t.includes("visitor")) return "visitor";
    if (t.includes("vehicle")) return "vehicle";
    if (t.includes("movement")) return "employee-movement";
    return "overview";
  }
  if (moduleName.toLowerCase() === "quality") {
    if (t.includes("incoming") || t.includes("inward") || t.includes("scn")) return "incoming";
    if (t.includes("process") || t.includes("line")) return "process";
    if (t.includes("jobwork") || t.includes("jw")) return "jobwork-qc";
    if (t.includes("fg") || t.includes("pdi") || t.includes("finished")) return "fg-qc";
    if (t.includes("master")) return "master";
    return "overview";
  }
  if (moduleName.toLowerCase() === "admin") {
    if (t.includes("user")) return "users";
    if (t.includes("role")) return "roles";
    return "overview";
  }
  return "overview";
}

export default function RoleEditorPage() {
  const { setHeader } = useHeader();
  const params = useParams();
  const router = useRouter();
  const isNew = params.id === "new";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);

  // Active module currently selected in UI
  const [activeModule, setActiveModule] = useState<string>("Store");

  // Format: { "Store": ["inventory", "purchase"], "HR": ["overview"] }
  const [permissions, setPermissions] = useState<Record<string, string[]>>({});

  useEffect(() => {
    setHeader?.(
      isNew ? "Create Role" : "Edit Role",
      "Configure role details and select main tabs for each module."
    );
  }, [setHeader, isNew]);

  useEffect(() => {
    if (!isNew) {
      fetchRole();
    } else {
      setLoading(false);
    }
  }, [params.id]);

  const fetchRole = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/roles/${params.id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      const data = await res.json();
      if (res.ok) {
        setName(data.data.name || "");
        setDescription(data.data.description || "");
        setIsActive(data.data.isActive ?? true);

        // Normalize backend policies to clean main tabs
        const perms: Record<string, string[]> = {};
        if (Array.isArray(data.data.policies)) {
          data.data.policies.forEach((policy: any) => {
            if (policy.module && Array.isArray(policy.tabs)) {
              const cleanTabs = new Set<string>();
              policy.tabs.forEach((rawTab: any) => {
                const tabString = typeof rawTab === "string" ? rawTab : (rawTab.id || rawTab.name || "");
                if (tabString) {
                  cleanTabs.add(normalizeTabId(policy.module, tabString));
                }
              });
              if (cleanTabs.size > 0) {
                perms[policy.module] = Array.from(cleanTabs);
              }
            }
          });
        }
        setPermissions(perms);
      } else {
        Swal.fire("Error", data.message || "Failed to load role", "error");
        router.push("/dashboard/admin/roles");
      }
    } catch (err) {
      Swal.fire("Error", "Error loading role", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleTabToggle = (moduleName: string, tabId: string) => {
    setPermissions(prev => {
      const currentTabs = prev[moduleName] || [];
      const exists = currentTabs.includes(tabId);
      const updatedTabs = exists ? currentTabs.filter(id => id !== tabId) : [...currentTabs, tabId];

      const newPerms = { ...prev };
      if (updatedTabs.length === 0) {
        delete newPerms[moduleName];
      } else {
        newPerms[moduleName] = updatedTabs;
      }
      return newPerms;
    });
  };

  const handleSelectAllModuleTabs = (moduleSchema: ModuleSchema) => {
    const allTabIds = moduleSchema.tabs.map(t => t.id);
    const currentTabs = permissions[moduleSchema.name] || [];
    const isAllSelected = allTabIds.every(id => currentTabs.includes(id));

    setPermissions(prev => {
      const newPerms = { ...prev };
      if (isAllSelected) {
        delete newPerms[moduleSchema.name];
      } else {
        newPerms[moduleSchema.name] = allTabIds;
      }
      return newPerms;
    });
  };

  const currentModuleSchema = useMemo(() => {
    return MODULE_DEFINITIONS.find(m => m.name === activeModule) || MODULE_DEFINITIONS[0];
  }, [activeModule]);

  const activeModuleTabs = permissions[currentModuleSchema.name] || [];
  const isCurrentModuleAllSelected = currentModuleSchema.tabs.length > 0 && currentModuleSchema.tabs.every(t => activeModuleTabs.includes(t.id));

  // Metrics
  const totalSelectedTabs = useMemo(() => {
    return Object.values(permissions).reduce((sum, tabs) => sum + tabs.length, 0);
  }, [permissions]);

  const selectedModulesCount = useMemo(() => {
    return Object.keys(permissions).length;
  }, [permissions]);

  const handleSave = async () => {
    if (!name.trim()) {
      Swal.fire("Validation Error", "Please enter a role name", "warning");
      return;
    }

    setSaving(true);

    // Convert permissions object to backend policies array
    const policies = Object.entries(permissions).map(([moduleName, tabs]) => ({
      module: moduleName,
      tabs
    }));

    const payload = {
      name,
      description,
      isActive,
      policies
    };

    try {
      const url = isNew ? `${API_BASE_URL}/api/roles` : `${API_BASE_URL}/api/roles/${params.id}`;
      const method = isNew ? "POST" : "PUT";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok) {
        Swal.fire({
          icon: "success",
          title: isNew ? "Role Created" : "Role Updated",
          text: `Role "${name}" was saved successfully with ${totalSelectedTabs} tab permissions!`,
          confirmButtonColor: "#4f46e5"
        });
        router.push("/dashboard/admin/roles");
      } else {
        Swal.fire("Error", data.message || "Failed to save role", "error");
      }
    } catch (err) {
      Swal.fire("Error", "An error occurred while saving the role", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-[60vh] gap-4 w-full">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-500 font-medium text-sm animate-pulse">Loading role definition and access controls...</p>
      </div>
    );
  }

  return (
    <div className="w-full min-h-full pb-24 px-3 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 space-y-6">
      
      {/* ─── Header Navigation & Identity ────────────────────────────── */}
      <div className="w-full relative group overflow-hidden rounded-3xl p-0.5 bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-pink-500/20 shadow-md">
        <div className="relative bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl rounded-[1.4rem] p-5 sm:p-7 border border-white/60 dark:border-slate-800/60 transition-all duration-300">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            
            <div className="flex items-center gap-4">
              <Link 
                href="/dashboard/admin/roles" 
                className="p-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-2xl transition-all"
                title="Back to Roles List"
              >
                <ArrowLeft size={20} />
              </Link>
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                    {isNew ? "Create New Role" : `Edit Role: ${name || "Untitled"}`}
                  </h1>
                  <span className="inline-flex items-center gap-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800/50">
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" /> Main Tabs Access
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium">
                  Select which modules and main tabs (e.g. Purchase & Inventory in Store) this role can access.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white font-bold px-7 py-3 rounded-xl shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30 transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer hover:-translate-y-0.5 active:translate-y-0 text-sm disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    <span>{isNew ? "Create Role" : "Save Changes"}</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* ─── Role Basic Information Card ─────────────────────────────── */}
      <div className="w-full bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-7 border border-gray-200/80 dark:border-slate-800 shadow-sm space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">Role Identity</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Specify role title, description, and status</p>
            </div>
          </div>

          <div className="text-xs font-bold px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/50 flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-indigo-600" />
            <span>{selectedModulesCount} Modules Active ({totalSelectedTabs} Main Tabs)</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Role Name */}
          <div className="space-y-1.5">
            <label className="block text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">
              Role Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Store Purchase Officer, HR Payroll Executive"
              className="w-full px-4 py-2.5 bg-gray-50/50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 text-sm text-gray-900 dark:text-white transition shadow-sm outline-none font-medium"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="block text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">
              Role Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Can access store purchase orders, vendor quotations and stock inventory"
              className="w-full px-4 py-2.5 bg-gray-50/50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 text-sm text-gray-900 dark:text-white transition shadow-sm outline-none font-medium"
            />
          </div>
        </div>

        {/* Active Switch */}
        <div className="pt-1 flex items-center justify-between">
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              id="isActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4.5 h-4.5 text-indigo-600 rounded focus:ring-indigo-500 border-gray-300 dark:border-slate-700 cursor-pointer"
            />
            <div>
              <span className="text-sm font-bold text-gray-800 dark:text-gray-200 block">Active Status</span>
              <span className="text-xs text-gray-400">Users assigned to inactive roles will be blocked from accessing ERP</span>
            </div>
          </label>
        </div>
      </div>

      {/* ─── Main Tabs Role Builder ───────────────────────────────────── */}
      <div className="w-full bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200/80 dark:border-slate-800 overflow-hidden">
        
        {/* Module Header Bar */}
        <div className="p-5 sm:p-6 border-b border-gray-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-50/50 dark:bg-slate-800/30">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-500" /> 1. Choose Module to Configure Access
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Click a module below, then select the main tabs you want this role to access.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleSelectAllModuleTabs(currentModuleSchema)}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 hover:bg-gray-50 dark:hover:bg-slate-700 transition cursor-pointer flex items-center gap-2"
            >
              {isCurrentModuleAllSelected ? <CheckSquare size={15} /> : <Square size={15} />}
              <span>{isCurrentModuleAllSelected ? `Deselect All ${currentModuleSchema.label} Tabs` : `Select All ${currentModuleSchema.label} Tabs`}</span>
            </button>
          </div>
        </div>

        {/* Horizontal Module Selector Pills */}
        <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/40">
          <div className="flex items-center gap-2.5 overflow-x-auto pb-2 scrollbar-thin">
            {MODULE_DEFINITIONS.map((mod) => {
              const modTabs = permissions[mod.name] || [];
              const hasAccess = modTabs.length > 0;
              const isSelected = activeModule === mod.name;
              const Icon = mod.icon || Layers;

              return (
                <button
                  key={mod.name}
                  type="button"
                  onClick={() => setActiveModule(mod.name)}
                  className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm whitespace-nowrap transition-all duration-150 cursor-pointer shrink-0 border ${
                    isSelected
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20 scale-[1.02]"
                      : hasAccess
                      ? "bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900/60 shadow-sm"
                      : "bg-white dark:bg-slate-800/80 text-gray-600 dark:text-gray-400 border-gray-200/80 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-700"
                  }`}
                >
                  <Icon size={16} />
                  <span>{mod.label}</span>
                  {hasAccess && (
                    <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${
                      isSelected ? "bg-white/25 text-white" : "bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300"
                    }`}>
                      {modTabs.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Module Main Tabs Section */}
        <div className="p-5 sm:p-7 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                <span>{currentModuleSchema.label} Main Tabs</span>
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                  ({activeModuleTabs.length} of {currentModuleSchema.tabs.length} selected)
                </span>
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Check the specific main tab buttons you want to show on this user's top navigation bar:
              </p>
            </div>
          </div>

          {/* Clean Main Tab Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 pt-2">
            {currentModuleSchema.tabs.map((tab) => {
              const isChecked = activeModuleTabs.includes(tab.id);

              return (
                <div
                  key={tab.id}
                  onClick={() => handleTabToggle(currentModuleSchema.name, tab.id)}
                  className={`flex flex-col justify-between p-5 rounded-2xl border-2 cursor-pointer transition-all duration-200 select-none relative group ${
                    isChecked
                      ? 'bg-indigo-50/90 border-indigo-600 text-indigo-950 dark:bg-indigo-950/50 dark:border-indigo-500 dark:text-indigo-100 shadow-md shadow-indigo-500/10 scale-[1.02]'
                      : 'bg-white border-gray-200 text-gray-700 hover:border-indigo-300 dark:bg-slate-900 dark:border-slate-800 dark:text-gray-400 hover:bg-slate-50/80 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-base font-black text-gray-900 dark:text-white flex items-center gap-2">
                        {tab.label}
                      </span>
                      
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center border-2 transition-all ${
                        isChecked
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                          : 'border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                      }`}>
                        {isChecked && <Check size={14} strokeWidth={3} />}
                      </div>
                    </div>

                    {tab.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                        {tab.description}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono truncate max-w-[130px]" title={tab.route}>
                      {tab.route}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                      isChecked 
                        ? 'bg-indigo-600 text-white' 
                        : 'bg-gray-100 dark:bg-slate-800 text-gray-400'
                    }`}>
                      {isChecked ? "ACCESS ENABLED" : "DISABLED"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick instructions tip */}
          <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 flex items-start gap-3 mt-4">
            <Info size={18} className="text-blue-600 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed font-medium">
              <strong>Example:</strong> For a Purchase Officer, click the <strong>Store & Inventory</strong> module above and select only <strong>Inventory</strong> and <strong>Purchase</strong>. When this user logs in, only those two main tabs will appear in their Store navigation bar.
            </p>
          </div>

        </div>

      </div>

      {/* ─── Selected Permissions Summary & Bottom Actions ───────────── */}
      <div className="w-full bg-white dark:bg-slate-900 rounded-2xl p-5 border border-gray-200/80 dark:border-slate-800 shadow-sm space-y-4">
        <div>
          <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Current Role Access Summary
          </h4>
          <div className="flex flex-wrap gap-2 mt-2">
            {Object.keys(permissions).length === 0 ? (
              <span className="text-xs text-gray-400 italic">No module tabs selected yet. Click any tab above to grant access.</span>
            ) : (
              Object.entries(permissions).map(([modName, tabIds]) => (
                <div key={modName} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900/50 text-indigo-800 dark:text-indigo-200 text-xs font-semibold">
                  <span className="font-bold">{modName}:</span>
                  <span>{tabIds.join(", ")}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="pt-3 border-t border-gray-100 dark:border-slate-800 flex flex-col-reverse sm:flex-row items-center justify-between gap-4">
          <Link
            href="/dashboard/admin/roles"
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 font-semibold text-sm transition flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Cancel & Return</span>
          </Link>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white font-bold px-8 py-3 rounded-xl shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30 transition duration-150 flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5 active:translate-y-0 text-sm"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Saving Role...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>{isNew ? "Create Role" : "Save Role Settings"}</span>
              </>
            )}
          </button>
        </div>
      </div>

    </div>
  );
}



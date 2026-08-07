"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Swal from "sweetalert2";
import { Save, ArrowLeft, Check, ChevronDown, ChevronRight, CheckSquare, Square } from "lucide-react";
import Link from "next/link";
import { API_BASE_URL } from "@/src/utils/config";

interface TabItem {
  id: string;
  label: string;
  route?: string;
}

interface ModuleSchema {
  name: string;
  label: string;
  tabs: TabItem[];
}

const FALLBACK_MODULES: ModuleSchema[] = [
  {
    name: "Admin",
    label: "Admin & User Management",
    tabs: [
      { id: "overview", label: "Overview" },
      { id: "users", label: "User Management" },
      { id: "roles", label: "Role Management" }
    ]
  },
  {
    name: "Store",
    label: "Store & Inventory",
    tabs: [
      { id: "home", label: "Inventory Overview" },
      { id: "material-issue", label: "Material Issue" },
      { id: "job-work", label: "Job Work" },
      { id: "dc", label: "Bills / DC" },
      { id: "masters/materials", label: "Materials Master" },
      { id: "masters/vendors", label: "Vendors Master" },
      { id: "masters/customers", label: "Customers Master" },
      { id: "masters/categories", label: "Categories Master" },
      { id: "masters/locations", label: "Locations Master" },
      { id: "masters/finished-goods", label: "Finished Goods Master" }
    ]
  },
  {
    name: "HR",
    label: "Human Resources",
    tabs: [
      { id: "home", label: "Overview" },
      { id: "attendance", label: "Attendance Kiosk" },
      { id: "present", label: "Present Log" },
      { id: "salaries", label: "Salaries & Payroll" },
      { id: "master", label: "HR Masters" }
    ]
  },
  {
    name: "PPC",
    label: "PPC (Production Planning)",
    tabs: [
      { id: "overview", label: "Overview" },
      { id: "orders", label: "Orders List" },
      { id: "planning", label: "Planning" },
      { id: "master", label: "PPC Masters" }
    ]
  },
  {
    name: "Security",
    label: "Gate Security & Entry",
    tabs: [
      { id: "overview", label: "Overview" },
      { id: "kiosk", label: "Kiosk Mode" },
      { id: "visitor", label: "Visitor Log" },
      { id: "vehicle", label: "Vehicle Log" }
    ]
  },
  {
    name: "CRM",
    label: "CRM & Sales",
    tabs: [{ id: "overview", label: "Overview" }]
  },
  {
    name: "Accounts",
    label: "Accounts & Finance",
    tabs: [{ id: "overview", label: "Overview" }]
  },
  {
    name: "Maintenance",
    label: "Maintenance",
    tabs: [{ id: "overview", label: "Overview" }]
  },
  {
    name: "Quality",
    label: "Quality Control",
    tabs: [{ id: "overview", label: "Overview" }]
  },
  {
    name: "Reports",
    label: "Reports & Analytics",
    tabs: [{ id: "overview", label: "Overview" }]
  }
];

export default function RoleEditorPage() {
  const params = useParams();
  const router = useRouter();
  const isNew = params.id === "new";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [modulesList, setModulesList] = useState<ModuleSchema[]>(FALLBACK_MODULES);

  // Format: { "Store": ["home", "material-issue", "masters/materials"], "HR": ["home"] }
  const [permissions, setPermissions] = useState<Record<string, string[]>>({});
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});

  const toggleModuleAccordion = (moduleName: string) => {
    setExpandedModules(prev => ({
      ...prev,
      [moduleName]: !prev[moduleName]
    }));
  };

  useEffect(() => {
    fetchSchemaAndRole();
  }, [params.id]);

  const fetchSchemaAndRole = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      // 1. Fetch backend central permissions schema
      const schemaRes = await fetch(`${API_BASE_URL}/api/roles/schema`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (schemaRes.ok) {
        const schemaData = await schemaRes.json();
        if (Array.isArray(schemaData.data)) {
          const formatted: ModuleSchema[] = schemaData.data.map((mod: any) => ({
            name: mod.module,
            label: mod.label || mod.module,
            tabs: mod.tabs.map((t: any) => 
              typeof t === "string" 
                ? { id: t, label: t } 
                : { id: t.id || t.name, label: t.label || t.name, route: t.route }
            )
          }));
          setModulesList(formatted);
          
          // Expand all module cards by default
          const expanded: Record<string, boolean> = {};
          formatted.forEach(m => { expanded[m.name] = true; });
          setExpandedModules(expanded);
        }
      }

      // 2. Fetch role if editing
      if (!isNew) {
        await fetchRole();
      }
    } catch (err) {
      console.error("Error fetching schema or role:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRole = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/roles/${params.id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      const data = await res.json();
      if (res.ok) {
        setName(data.data.name);
        setDescription(data.data.description);
        setIsActive(data.data.isActive);

        // Map backend policies array to simple frontend object { "Store": ["home", "masters/materials"] }
        const perms: Record<string, string[]> = {};
        if (Array.isArray(data.data.policies)) {
          data.data.policies.forEach((policy: any) => {
            if (policy.module && Array.isArray(policy.tabs)) {
              perms[policy.module] = policy.tabs.map((t: any) => typeof t === "string" ? t : (t.id || t.name));
            }
          });
        }
        setPermissions(perms);
      } else {
        Swal.fire("Error", "Failed to load role", "error");
        router.push("/dashboard/admin/roles");
      }
    } catch (err) {
      Swal.fire("Error", "Error loading role", "error");
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

  const handleSelectAllModule = (moduleSchema: ModuleSchema) => {
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

  const handleSave = async () => {
    if (!name.trim()) {
      Swal.fire("Error", "Role name is required", "error");
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
        Swal.fire("Success", isNew ? "Role created successfully" : "Role updated successfully", "success");
        router.push("/dashboard/admin/roles");
      } else {
        Swal.fire("Error", data.message || "Failed to save role", "error");
      }
    } catch (err) {
      Swal.fire("Error", "An error occurred while saving", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 flex justify-center">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/admin/roles" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {isNew ? "Create Role" : "Edit Role"}
            </h1>
            <p className="text-gray-500">Configure real module tabs and sub-route permissions</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-colors disabled:opacity-70"
        >
          {saving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={18} />}
          {isNew ? "Create Role" : "Save Changes"}
        </button>
      </div>

      {/* Basic Info */}
      <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 space-y-4">
        <h2 className="text-lg font-bold">Role Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Role Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Store Executive, HR Manager"
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of responsibilities"
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <input
            type="checkbox"
            id="isActive"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="w-4 h-4 text-indigo-600 rounded"
          />
          <label htmlFor="isActive" className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Active Role
          </label>
        </div>
      </div>

      {/* Permissions Checkbox Matrix */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold">Real Module Tabs & Sub-Routes</h2>
            <p className="text-sm text-gray-500">Check the registered tabs and master sub-routes this role can access.</p>
          </div>
        </div>

        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {modulesList.map((mod) => {
            const currentTabs = permissions[mod.name] || [];
            const allTabIds = mod.tabs.map(t => t.id);
            const isAllSelected = allTabIds.length > 0 && allTabIds.every(id => currentTabs.includes(id));
            const isSomeSelected = currentTabs.length > 0;

            return (
              <div key={mod.name} className="hover:bg-gray-50/30 dark:hover:bg-gray-800/10 transition-colors">
                <div className="p-6 flex items-center justify-between">
                  <button
                    onClick={() => toggleModuleAccordion(mod.name)}
                    className="flex items-center gap-3 text-left focus:outline-none"
                  >
                    <div className={`w-2.5 h-2.5 rounded-full ${isSomeSelected ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-700'}`}></div>
                    <div>
                      <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        {mod.label}
                        {isSomeSelected && (
                          <span className="text-xs bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 px-2 py-0.5 rounded-full font-normal">
                            {currentTabs.length} / {allTabIds.length} tabs
                          </span>
                        )}
                      </h3>
                    </div>
                  </button>

                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => handleSelectAllModule(mod)}
                      className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1.5"
                    >
                      {isAllSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                      {isAllSelected ? "Deselect All" : "Select All Tabs"}
                    </button>
                    <button onClick={() => toggleModuleAccordion(mod.name)} className="text-gray-400">
                      {expandedModules[mod.name] ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                    </button>
                  </div>
                </div>

                {expandedModules[mod.name] && (
                  <div className="px-6 pb-6 pt-0 ml-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {mod.tabs.map(tab => {
                      const isChecked = currentTabs.includes(tab.id);
                      return (
                        <label
                          key={tab.id}
                          onClick={() => handleTabToggle(mod.name, tab.id)}
                          className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all select-none ${
                            isChecked
                              ? 'bg-indigo-50/70 border-indigo-200 text-indigo-900 dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-300 font-medium'
                              : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300 dark:bg-gray-800/50 dark:border-gray-700 dark:text-gray-400'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded flex items-center justify-center border transition-all ${
                            isChecked
                              ? 'bg-indigo-600 border-indigo-600 text-white'
                              : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'
                          }`}>
                            {isChecked && <Check size={12} strokeWidth={3} />}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm">{tab.label}</span>
                            {tab.route && (
                              <span className="text-[11px] text-gray-400 dark:text-gray-500 font-mono">{tab.route}</span>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

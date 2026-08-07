"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Swal from "sweetalert2";
import { Save, ArrowLeft, Check, X, ChevronDown, ChevronRight } from "lucide-react";
import Link from "next/link";
import { API_BASE_URL } from "@/src/utils/config";

const AVAILABLE_MODULES = [
  {
    name: "Store",
    tabs: ["home", "inventory", "masters", "job-work", "material-issue", "dc"]
  },
  {
    name: "HR",
    tabs: ["home", "attendance", "salaries", "master", "present"]
  },
  {
    name: "PPC",
    tabs: ["overview", "orders", "planning", "master"]
  },
  {
    name: "Security",
    tabs: ["overview", "kiosk", "visitor", "vehicle"]
  },
  {
    name: "Maintenance",
    tabs: ["overview", "tickets", "assets", "schedule"] // Placeholder tabs
  },
  {
    name: "CRM",
    tabs: ["all"]
  },
  {
    name: "Accounts",
    tabs: ["all"]
  },
  {
    name: "Admin",
    tabs: ["all"]
  }
];

const AVAILABLE_ACTIONS = ["read", "create", "update", "delete", "all"];

export default function RoleEditorPage() {
  const params = useParams();
  const router = useRouter();
  const isNew = params.id === "new";

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  
  // Format: { "Store": { "inventory": ["read", "create"], ... } }
  const [permissions, setPermissions] = useState<Record<string, Record<string, string[]>>>({});
  
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});

  const toggleModule = (moduleName: string) => {
    setExpandedModules(prev => ({
      ...prev,
      [moduleName]: !prev[moduleName]
    }));
  };

  useEffect(() => {
    if (!isNew) {
      fetchRole();
    }
  }, [isNew]);

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
        
        // Map backend policies array to frontend state object
        const perms: Record<string, Record<string, string[]>> = {};
        data.data.policies.forEach((policy: any) => {
          perms[policy.module] = {};
          policy.tabs.forEach((tab: any) => {
            perms[policy.module][tab.name] = tab.actions;
          });
        });
        setPermissions(perms);
      } else {
        Swal.fire("Error", "Failed to load role", "error");
        router.push("/dashboard/admin/roles");
      }
    } catch (err) {
      Swal.fire("Error", "Error loading role", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleActionToggle = (moduleName: string, tabName: string, action: string) => {
    setPermissions(prev => {
      const newPerms = { ...prev };
      if (!newPerms[moduleName]) newPerms[moduleName] = {};
      if (!newPerms[moduleName][tabName]) newPerms[moduleName][tabName] = [];
      
      const currentActions = newPerms[moduleName][tabName];
      
      if (action === "all") {
        if (currentActions.includes("all")) {
           newPerms[moduleName][tabName] = [];
        } else {
           newPerms[moduleName][tabName] = ["all"];
        }
      } else {
         if (currentActions.includes("all")) {
            // Remove 'all', add specific
            newPerms[moduleName][tabName] = [action];
         } else if (currentActions.includes(action)) {
            newPerms[moduleName][tabName] = currentActions.filter(a => a !== action);
         } else {
            newPerms[moduleName][tabName] = [...currentActions, action];
         }
      }
      
      // Clean up empty objects
      if (newPerms[moduleName][tabName].length === 0) {
        delete newPerms[moduleName][tabName];
      }
      if (Object.keys(newPerms[moduleName]).length === 0) {
        delete newPerms[moduleName];
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
    
    // Convert permissions object back to backend policies array
    const policies = Object.entries(permissions).map(([moduleName, tabs]) => ({
      module: moduleName,
      tabs: Object.entries(tabs).map(([tabName, actions]) => ({
        name: tabName,
        actions
      }))
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
      Swal.fire("Error", "An error occurred", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-12 flex justify-center"><div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div></div>;
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
            <p className="text-gray-500">Configure access policies for this role</p>
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
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Role Name</label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Inventory Manager"
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
            <input 
              type="text" 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of responsibilities"
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none"
            />
          </div>
        </div>
        <div className="flex items-center gap-3 pt-2">
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="sr-only peer" />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
          </label>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Role is Active</span>
        </div>
      </div>

      {/* Permissions Matrix */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="p-6 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-bold">Permissions Policies</h2>
          <p className="text-sm text-gray-500">Select the modules and specific tabs this role can access.</p>
        </div>
        
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {AVAILABLE_MODULES.map((module) => (
            <div key={module.name} className="hover:bg-gray-50/30 dark:hover:bg-gray-800/10 transition-colors">
              <button
                onClick={() => toggleModule(module.name)}
                className="w-full p-6 flex items-center justify-between text-left focus:outline-none"
              >
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                  <h3 className="font-bold text-gray-900 dark:text-white">
                    {module.name}
                  </h3>
                </div>
                <div className="text-gray-400">
                  {expandedModules[module.name] ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                </div>
              </button>
              
              {expandedModules[module.name] && (
                <div className="px-6 pb-6 pt-0 ml-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {module.tabs.map(tab => (
                    <div key={tab} className="flex flex-col gap-4 p-4 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
                      <span className="font-medium text-sm text-gray-700 dark:text-gray-300 capitalize">{tab} Tab</span>
                      
                      <div className="flex flex-wrap gap-2">
                        {AVAILABLE_ACTIONS.map(action => {
                          const isSelected = permissions[module.name]?.[tab]?.includes(action) || permissions[module.name]?.[tab]?.includes("all");
                          return (
                            <button
                              key={action}
                              onClick={() => handleActionToggle(module.name, tab, action)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-all ${
                                isSelected 
                                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-400' 
                                  : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-300 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:border-indigo-700'
                              }`}
                            >
                              {isSelected ? <Check size={14} /> : <div className="w-3.5" />}
                              <span className="capitalize">{action}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

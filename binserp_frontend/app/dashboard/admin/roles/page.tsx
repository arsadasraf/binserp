"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { 
  Plus, 
  Edit, 
  Trash2, 
  Shield, 
  ShieldCheck, 
  Users, 
  Lock, 
  Search, 
  SlidersHorizontal,
  Layers,
  KeyRound,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import Swal from "sweetalert2";
import { API_BASE_URL } from "@/src/utils/config";
import { useHeader } from "@/src/context/HeaderContext";

interface Role {
  _id: string;
  name: string;
  description?: string;
  isActive?: boolean;
  isDefault?: boolean;
  policies?: { module: string; tabs: string[] }[];
  createdAt?: string;
}

export default function RolesPage() {
  const { setHeader } = useHeader();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "system">("all");

  useEffect(() => {
    setHeader?.("Roles & Permissions", "Manage system access policies and granular role definitions.");
  }, [setHeader]);

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/roles?_t=${Date.now()}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        cache: 'no-store'
      });
      const data = await res.json();
      if (res.ok) {
        setRoles(data.data || []);
      } else {
        Swal.fire("Error", data.message || "Failed to fetch roles", "error");
      }
    } catch (err) {
      Swal.fire("Error", "An error occurred while loading roles", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, roleName: string) => {
    const result = await Swal.fire({
      title: "Delete Role?",
      text: `Are you sure you want to delete "${roleName}"? Users assigned to this role may lose their permissions.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Yes, Delete Role",
      cancelButtonText: "Cancel",
      customClass: {
        popup: "rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-800 dark:bg-slate-900",
        title: "text-xl font-bold text-gray-900 dark:text-white",
        htmlContainer: "text-gray-600 dark:text-gray-300"
      }
    });

    if (!result.isConfirmed) return;
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/roles/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (res.ok) {
        Swal.fire({
          icon: "success",
          title: "Role Deleted",
          text: `"${roleName}" was removed successfully.`,
          confirmButtonColor: "#4f46e5",
          timer: 2000
        });
        fetchRoles();
      } else {
        const data = await res.json();
        Swal.fire("Error", data.message || "Failed to delete role", "error");
      }
    } catch (err) {
      Swal.fire("Error", "An error occurred while deleting the role", "error");
    }
  };

  // Filtered roles
  const filteredRoles = useMemo(() => {
    return roles.filter((role) => {
      const matchesSearch = 
        role.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (role.description && role.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (role.policies && role.policies.some(p => p.module.toLowerCase().includes(searchTerm.toLowerCase())));

      if (!matchesSearch) return false;

      if (filterStatus === "active") return role.isActive;
      if (filterStatus === "system") return role.isDefault || role.name === "GM" || role.name === "Admin Default Role";

      return true;
    });
  }, [roles, searchTerm, filterStatus]);

  // Metrics
  const activeCount = useMemo(() => roles.filter(r => r.isActive).length, [roles]);
  const systemCount = useMemo(() => roles.filter(r => r.isDefault || r.name === "GM" || r.name === "Admin Default Role").length, [roles]);
  const customCount = useMemo(() => roles.length - systemCount, [roles, systemCount]);

  return (
    <div className="w-full min-h-full pb-20 px-3 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 space-y-6">
      
      {/* ─── Hero Overview Banner (Full Width Responsive) ──────────────── */}
      <div className="w-full relative group overflow-hidden rounded-3xl p-0.5 bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-pink-500/20 shadow-md">
        <div className="relative bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl rounded-[1.4rem] p-5 sm:p-7 border border-white/60 dark:border-slate-800/60 transition-all duration-300">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            
            {/* Header Identity */}
            <div className="flex items-center gap-4 sm:gap-6">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-indigo-600 via-purple-700 to-indigo-800 rounded-2xl flex items-center justify-center text-white text-2xl sm:text-3xl font-black shadow-lg shadow-indigo-500/25 shrink-0 ring-4 ring-indigo-50 dark:ring-indigo-950/50">
                <ShieldCheck className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                    Roles & Permissions
                  </h1>
                  <span className="inline-flex items-center gap-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800/50">
                    <Lock className="w-3.5 h-3.5 text-indigo-500" /> RBAC Engine
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium">
                  Configure role-based access control, modular tab visibility, and operational permissions.
                </p>
              </div>
            </div>

            {/* Action CTA */}
            <div className="w-full lg:w-auto shrink-0 flex items-center gap-3">
              <Link 
                href="/dashboard/admin/roles/new" 
                className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white font-bold px-6 py-3 rounded-xl shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30 transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer hover:-translate-y-0.5 active:translate-y-0 text-sm"
              >
                <Plus size={18} />
                <span>Create New Role</span>
              </Link>
            </div>

          </div>
        </div>
      </div>

      {/* ─── Metric Cards Strip (Full Width Responsive) ─────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 w-full">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-gray-200/80 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Shield className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">Total Roles</span>
            <p className="text-xl font-extrabold text-gray-900 dark:text-white">
              {loading ? "..." : roles.length}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-gray-200/80 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">Active Roles</span>
            <p className="text-xl font-extrabold text-gray-900 dark:text-white">
              {loading ? "..." : activeCount}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-gray-200/80 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <KeyRound className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">System Defaults</span>
            <p className="text-xl font-extrabold text-gray-900 dark:text-white">
              {loading ? "..." : systemCount}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-gray-200/80 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
            <Layers className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">Custom Defined</span>
            <p className="text-xl font-extrabold text-gray-900 dark:text-white">
              {loading ? "..." : customCount}
            </p>
          </div>
        </div>
      </div>

      {/* ─── Search and Filters Bar ──────────────────────────────────── */}
      <div className="w-full bg-white dark:bg-slate-900 rounded-2xl p-4 border border-gray-200/80 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        
        {/* Search Input */}
        <div className="relative w-full sm:w-80 lg:w-96">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search roles, modules, or description..."
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50/50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 text-sm text-gray-900 dark:text-white transition shadow-sm outline-none font-medium"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setFilterStatus("all")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
              filterStatus === "all"
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-700"
            }`}
          >
            All Roles ({roles.length})
          </button>
          <button
            onClick={() => setFilterStatus("active")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
              filterStatus === "active"
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-700"
            }`}
          >
            Active ({activeCount})
          </button>
          <button
            onClick={() => setFilterStatus("system")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
              filterStatus === "system"
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-700"
            }`}
          >
            System Defaults ({systemCount})
          </button>
        </div>

      </div>

      {/* ─── Table Section (Full Width Desktop Responsive) ──────────── */}
      {loading ? (
        <div className="flex flex-col justify-center items-center h-64 gap-4 w-full bg-white dark:bg-slate-900 rounded-2xl border border-gray-200/80 dark:border-slate-800">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-500 font-medium text-sm">Loading roles & permissions...</p>
        </div>
      ) : (
        <div className="w-full bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200/80 dark:border-slate-800 overflow-hidden">
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/80 dark:bg-slate-800/60 border-b border-gray-200/80 dark:border-slate-800 text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wider font-semibold">
                  <th className="px-6 py-4">Role Name</th>
                  <th className="px-6 py-4">Description</th>
                  <th className="px-6 py-4">Module Permissions</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-sm">
                {filteredRoles.map((role: any) => {
                  const isSysRole = role.isDefault || role.name === "GM" || role.name === "Admin Default Role";
                  const policiesCount = role.policies?.length || 0;
                  const totalTabsCount = role.policies?.reduce((acc: number, p: any) => acc + (p.tabs?.length || 0), 0) || 0;

                  return (
                    <tr key={role._id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      
                      {/* Role Name */}
                      <td className="px-6 py-4.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-sm shrink-0 border border-indigo-100 dark:border-indigo-900/50">
                            {role.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                              <span>{role.name}</span>
                              {isSysRole && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/70 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-800">
                                  System
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-gray-400 font-mono">ID: {role._id.slice(-6)}</span>
                          </div>
                        </div>
                      </td>

                      {/* Description */}
                      <td className="px-6 py-4.5 text-gray-600 dark:text-gray-300 max-w-xs">
                        <p className="line-clamp-2 text-xs sm:text-sm">
                          {role.description || "No description provided."}
                        </p>
                      </td>

                      {/* Module Permissions */}
                      <td className="px-6 py-4.5">
                        {isSysRole ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200/70 dark:border-purple-800/40">
                            <KeyRound className="w-3.5 h-3.5" /> Full Operational Access
                          </span>
                        ) : policiesCount > 0 ? (
                          <div className="flex flex-wrap gap-1.5 max-w-md">
                            {role.policies.slice(0, 3).map((pol: any) => (
                              <span
                                key={pol.module}
                                className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                              >
                                {pol.module} ({pol.tabs?.length || 0})
                              </span>
                            ))}
                            {policiesCount > 3 && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-gray-400">
                                +{policiesCount - 3} more
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">No modules granted</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4.5">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                          role.isActive 
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800/40' 
                            : 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-gray-400 border border-gray-200 dark:border-slate-700'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${role.isActive ? 'bg-emerald-500' : 'bg-gray-400'}`}></span>
                          {role.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link 
                            href={`/dashboard/admin/roles/${role._id}`} 
                            className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-xl transition-all"
                            title="Edit Role & Permissions"
                          >
                            <Edit size={17} />
                          </Link>
                          {!isSysRole && (
                            <button 
                              onClick={() => handleDelete(role._id, role.name)} 
                              className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-xl transition-all cursor-pointer"
                              title="Delete Role"
                            >
                              <Trash2 size={17} />
                            </button>
                          )}
                        </div>
                      </td>

                    </tr>
                  );
                })}

                {filteredRoles.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <AlertCircle className="w-8 h-8 text-gray-400" />
                        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">No roles matched your criteria</p>
                        {searchTerm && (
                          <button
                            onClick={() => setSearchTerm("")}
                            className="text-xs font-semibold text-indigo-600 hover:underline cursor-pointer"
                          >
                            Clear search filter
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}


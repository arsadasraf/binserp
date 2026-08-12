"use client";

import React, { useState, useEffect } from "react";
import { saasAdminAuth } from "@/lib/saasAdminAuth";
import {
  Building2,
  Users,
  ShieldAlert,
  Search,
  Lock,
  Unlock,
  KeyRound,
  Trash2,
  ChevronRight,
  Shield,
  CheckCircle2,
  X,
  LayoutDashboard,
  MapPin,
  Mail,
  Phone,
  Calendar,
  Briefcase,
  FileText,
} from "lucide-react";

interface DashboardStats {
  totalCompanies: number;
  verifiedCompanies: number;
  unverifiedCompanies: number;
  suspendedCompanies: number;
  totalUsers: number;
  recentCompanies: number;
  companiesByMonth: Array<{ _id: { year: number; month: number }; count: number }>;
  recentRegistrations: Array<any>;
}

interface Company {
  _id: string;
  companyName: string;
  companyId?: string;
  companyType?: string;
  service?: string | string[];
  dbName?: string;
  email: string;
  contactNumber: string;
  city: string;
  state?: string;
  pincode?: string;
  country?: string;
  billingAddress?: string;
  shippingAddress?: string;
  logo?: string;
  isVerified: boolean;
  isSuspended?: boolean;
  suspensionReason?: string;
  createdAt: string;
  userCount?: number;
  staffCount?: number;
  employeeCount?: number;
}

interface GlobalUser {
  _id: string;
  name: string;
  userId: string;
  email: string;
  department: string;
  roleName: string;
  userType: "staff" | "employee";
  isEmployee: boolean;
  isActive: boolean;
  company: {
    _id: string;
    companyName: string;
    companyId?: string;
  };
  createdAt: string;
}

interface CompanyRole {
  _id: string;
  name: string;
  description?: string;
  isDefault?: boolean;
  isActive?: boolean;
  policies?: Array<{ module: string; tabs: string[] }>;
}

/* ─────────────────────────── Company Deep-Dive Drawer ───────────────────── */
function CompanyDetailDrawer({
  companyId,
  onClose,
  onRefresh,
}: {
  companyId: string;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [company, setCompany] = useState<Company | null>(null);
  const [users, setUsers] = useState<GlobalUser[]>([]);
  const [roles, setRoles] = useState<CompanyRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<"profile" | "users" | "roles">("profile");

  useEffect(() => {
    loadFullCompanyData();
  }, [companyId]);

  const loadFullCompanyData = async () => {
    setLoading(true);
    try {
      const [compRes, userRes, roleRes] = await Promise.all([
        saasAdminAuth.fetchWithAuth(`/companies/${companyId}`),
        saasAdminAuth.fetchWithAuth(`/users?companyId=${companyId}`),
        saasAdminAuth.getCompanyRoles(companyId),
      ]);
      setCompany(compRes.data || null);
      setUsers(userRes.data || []);
      setRoles(roleRes.data?.roles || []);
    } catch (err) {
      console.error("Failed to load company deep-dive data", err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleUserBlock = async (user: GlobalUser) => {
    try {
      await saasAdminAuth.toggleUserBlock(user._id, companyId, user.isEmployee);
      loadFullCompanyData();
      onRefresh();
    } catch (err: any) {
      alert(err.message || "Failed to toggle user block status");
    }
  };

  const handleToggleCompanySuspend = async () => {
    if (!company) return;
    try {
      await saasAdminAuth.toggleCompanySuspend(company._id, !!company.isSuspended);
      onRefresh();
      onClose();
    } catch (err: any) {
      alert(err.message || "Failed to update company status");
    }
  };

  if (loading && !company) {
    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end">
        <div className="w-full max-w-2xl bg-white dark:bg-gray-900 h-full p-12 flex justify-center items-center">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (!company) return null;

  const servicesList = Array.isArray(company.service)
    ? company.service.join(", ")
    : company.service || "N/A";

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
      <div className="w-full max-w-3xl bg-white dark:bg-gray-900 h-full shadow-2xl flex flex-col border-l border-gray-100 dark:border-gray-800 animate-in slide-in-from-right duration-300">
        {/* Drawer Header */}
        <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-900/50">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-indigo-500/20">
              {company.companyName.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-extrabold text-gray-900 dark:text-white leading-tight">{company.companyName}</h2>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                    company.isSuspended
                      ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                      : "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                  }`}
                >
                  {company.isSuspended ? "Suspended" : "Active"}
                </span>
              </div>
              <p className="text-xs text-indigo-600 dark:text-indigo-400 font-mono font-bold mt-0.5">
                ID: {company.companyId || company._id} • DB: {company.dbName || "Default Tenant DB"}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Action Bar */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-gray-800/40 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-gray-600 dark:text-gray-400">
              Total Users: <strong className="text-gray-900 dark:text-white">{company.userCount || users.length}</strong> (Staff: {company.staffCount || 0}, Employees: {company.employeeCount || 0})
            </span>
          </div>

          <button
            onClick={handleToggleCompanySuspend}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-sm ${
              company.isSuspended ? "bg-green-600 text-white hover:bg-green-700" : "bg-red-600 text-white hover:bg-red-700"
            }`}
          >
            {company.isSuspended ? <Unlock size={14} /> : <Lock size={14} />}
            {company.isSuspended ? "Unblock Company" : "Block Company"}
          </button>
        </div>

        {/* Drawer Sub-Tabs */}
        <div className="flex border-b border-gray-100 dark:border-gray-800 px-6 gap-6">
          <button
            onClick={() => setActiveSubTab("profile")}
            className={`py-3.5 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${
              activeSubTab === "profile"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-gray-500 hover:text-gray-900"
            }`}
          >
            <FileText size={16} /> Registration Profile
          </button>
          <button
            onClick={() => setActiveSubTab("users")}
            className={`py-3.5 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${
              activeSubTab === "users"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-gray-500 hover:text-gray-900"
            }`}
          >
            <Users size={16} /> Company Users ({users.length})
          </button>
          <button
            onClick={() => setActiveSubTab("roles")}
            className={`py-3.5 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${
              activeSubTab === "roles"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-gray-500 hover:text-gray-900"
            }`}
          >
            <Shield size={16} /> Roles & Policies ({roles.length})
          </button>
        </div>

        {/* Drawer Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeSubTab === "profile" ? (
            <div className="space-y-6">
              {/* Registration Fields Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-800">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Company Type</p>
                  <p className="text-sm font-extrabold text-gray-900 dark:text-white">{company.companyType || "N/A"}</p>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-800">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Industry Services</p>
                  <p className="text-sm font-extrabold text-gray-900 dark:text-white">{servicesList}</p>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-800">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Email Address</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5 truncate">
                    <Mail size={14} className="text-indigo-500" /> {company.email}
                  </p>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-800">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">WhatsApp / Contact</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5 truncate">
                    <Phone size={14} className="text-green-500" /> {company.contactNumber}
                  </p>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-800">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">City & State</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                    <MapPin size={14} className="text-rose-500" /> {company.city}, {company.state || "N/A"}
                  </p>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-800">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Pincode & Country</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">
                    {company.pincode || "N/A"} • {company.country || "India"}
                  </p>
                </div>
              </div>

              {/* Address details */}
              {(company.billingAddress || company.shippingAddress) && (
                <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 space-y-3">
                  {company.billingAddress && (
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Billing Address</p>
                      <p className="text-xs text-gray-800 dark:text-gray-200">{company.billingAddress}</p>
                    </div>
                  )}
                  {company.shippingAddress && (
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Shipping Address</p>
                      <p className="text-xs text-gray-800 dark:text-gray-200">{company.shippingAddress}</p>
                    </div>
                  )}
                </div>
              )}

              {/* System Metadata */}
              <div className="p-4 bg-indigo-50/50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50 rounded-2xl flex items-center justify-between text-xs">
                <span className="text-gray-600 dark:text-gray-300 font-medium">
                  Registered On: <strong>{new Date(company.createdAt).toLocaleDateString("en-IN", { dateStyle: "long" })}</strong>
                </span>
                <span className="text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-wider text-[10px]">
                  Email Verified: {company.isVerified ? "YES" : "NO"}
                </span>
              </div>
            </div>
          ) : activeSubTab === "users" ? (
            users.length === 0 ? (
              <p className="text-center py-12 text-gray-400 text-xs font-medium">No users created in this company yet</p>
            ) : (
              users.map((u) => (
                <div
                  key={u._id}
                  className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/40 rounded-2xl border border-gray-100 dark:border-gray-800"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-gray-900 dark:text-white text-sm">{u.name}</p>
                      <span
                        className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase ${
                          u.isEmployee
                            ? "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"
                            : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                        }`}
                      >
                        {u.userType}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5">
                      ID: {u.userId} • Dept: {u.department} • Role: {u.roleName}
                    </p>
                  </div>

                  <button
                    onClick={() => handleToggleUserBlock(u)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                      u.isActive
                        ? "bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400"
                        : "bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400"
                    }`}
                  >
                    {u.isActive ? <Lock size={12} /> : <Unlock size={12} />}
                    {u.isActive ? "Block" : "Unblock"}
                  </button>
                </div>
              ))
            )
          ) : roles.length === 0 ? (
            <p className="text-center py-12 text-gray-400 text-xs font-medium">No roles created in this company yet</p>
          ) : (
            roles.map((r) => (
              <div key={r._id} className="p-4 bg-gray-50 dark:bg-gray-800/40 rounded-2xl border border-gray-100 dark:border-gray-800">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-gray-900 dark:text-white text-sm">{r.name}</h4>
                  {r.isDefault && (
                    <span className="text-[10px] font-extrabold px-2 py-0.5 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 rounded-md">
                      Default Role
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{r.description || "No description provided"}</p>
                <div className="flex flex-wrap gap-1.5">
                  {r.policies?.map((p, idx) => (
                    <span
                      key={idx}
                      className="text-[10px] font-bold px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md"
                    >
                      {p.module}
                    </span>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── Main SaaS Admin Dashboard ─────────────────────── */
type TabId = "overview" | "companies" | "users";

export default function SaasDashboard() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<GlobalUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [userTypeFilter, setUserTypeFilter] = useState<"all" | "staff" | "employee">("all");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardStats();
  }, []);

  useEffect(() => {
    if (activeTab === "companies") loadCompanies();
    if (activeTab === "users") loadUsers();
  }, [activeTab]);

  const loadDashboardStats = async () => {
    setLoading(true);
    try {
      const r = await saasAdminAuth.fetchWithAuth("/dashboard-stats");
      setStats(r.data);
    } catch {
      /* Handled */
    } finally {
      setLoading(false);
    }
  };

  const loadCompanies = async () => {
    setLoading(true);
    try {
      const r = await saasAdminAuth.fetchWithAuth("/companies");
      setCompanies(r.data || []);
    } catch {
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const r = await saasAdminAuth.fetchWithAuth("/users");
      setUsers(r.data || []);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleCompanySuspend = async (companyId: string, isSuspended: boolean) => {
    try {
      await saasAdminAuth.toggleCompanySuspend(companyId, isSuspended);
      loadCompanies();
      loadDashboardStats();
    } catch (err: any) {
      alert(err.message || "Failed to update company suspension status");
    }
  };

  const handleToggleUserBlock = async (user: GlobalUser) => {
    try {
      await saasAdminAuth.toggleUserBlock(user._id, user.company._id, user.isEmployee);
      loadUsers();
    } catch (err: any) {
      alert(err.message || "Failed to update user status");
    }
  };

  const filteredCompanies = companies.filter(
    (c) =>
      !searchTerm ||
      c.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.companyId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.companyType?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      !searchTerm ||
      u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.userId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.company?.companyName?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = userTypeFilter === "all" || u.userType === userTypeFilter;

    return matchesSearch && matchesType;
  });

  const tabs: { id: TabId; label: string; icon: any }[] = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "companies", label: "Company Directory", icon: Building2 },
    { id: "users", label: "Global Users", icon: Users },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Company Deep Dive Drawer */}
      {selectedCompanyId && (
        <CompanyDetailDrawer
          companyId={selectedCompanyId}
          onClose={() => setSelectedCompanyId(null)}
          onRefresh={() => {
            loadCompanies();
            loadDashboardStats();
          }}
        />
      )}

      {/* Navigation Bar */}
      <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 p-2">
        <div className="grid grid-cols-3 gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setSearchTerm("");
                }}
                className={`flex items-center justify-center gap-2 py-3 px-4 rounded-2xl font-extrabold text-xs transition-all ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                    : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab 1: Overview */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {stats && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-3xl p-6 text-white shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-200">Total Companies</span>
                  <div className="p-3 bg-white/10 rounded-2xl">
                    <Building2 size={22} />
                  </div>
                </div>
                <p className="text-3xl font-black">{stats.totalCompanies}</p>
                <p className="text-xs text-indigo-200 mt-1 font-medium">{stats.recentCompanies} registered in last 30 days</p>
              </div>

              <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-3xl p-6 text-white shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-200">Active Companies</span>
                  <div className="p-3 bg-white/10 rounded-2xl">
                    <CheckCircle2 size={22} />
                  </div>
                </div>
                <p className="text-3xl font-black">{stats.verifiedCompanies}</p>
                <p className="text-xs text-emerald-200 mt-1 font-medium">Operational tenant platforms</p>
              </div>

              <div className="bg-gradient-to-br from-rose-600 to-pink-700 rounded-3xl p-6 text-white shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-rose-200">Blocked / Suspended</span>
                  <div className="p-3 bg-white/10 rounded-2xl">
                    <ShieldAlert size={22} />
                  </div>
                </div>
                <p className="text-3xl font-black">{stats.suspendedCompanies || 0}</p>
                <p className="text-xs text-rose-200 mt-1 font-medium">Blocked by platform admin</p>
              </div>

              <div className="bg-gradient-to-br from-purple-600 to-violet-700 rounded-3xl p-6 text-white shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-purple-200">Total System Users</span>
                  <div className="p-3 bg-white/10 rounded-2xl">
                    <Users size={22} />
                  </div>
                </div>
                <p className="text-3xl font-black">{stats.totalUsers}</p>
                <p className="text-xs text-purple-200 mt-1 font-medium">Staff & Employee accounts</p>
              </div>
            </div>
          )}

          {/* Recent Registrations Table */}
          <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm p-6">
            <h3 className="text-lg font-extrabold text-gray-900 dark:text-white mb-6">Recent Tenant Registrations</h3>

            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {stats?.recentRegistrations.map((c) => (
                <div
                  key={c._id}
                  onClick={() => setSelectedCompanyId(c._id)}
                  className="py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 px-4 rounded-2xl transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/50 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">
                      {c.companyName.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 dark:text-white text-sm">{c.companyName}</p>
                      <p className="text-xs text-gray-400">{c.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-semibold text-gray-500">{c.city}</span>
                    <ChevronRight size={18} className="text-gray-400" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Companies Directory */}
      {activeTab === "companies" && (
        <div className="space-y-4">
          <div className="relative">
            <Search size={18} className="absolute left-4 top-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by company name, ID, email, city, or company type..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredCompanies.map((c) => (
              <div
                key={c._id}
                className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 p-6 flex flex-col justify-between space-y-4 hover:shadow-lg transition-all"
              >
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/40 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-extrabold text-lg">
                      {c.companyName.charAt(0)}
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                        c.isSuspended
                          ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                          : "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                      }`}
                    >
                      {c.isSuspended ? "Suspended" : "Active"}
                    </span>
                  </div>

                  <h3 className="font-extrabold text-gray-900 dark:text-white text-lg leading-tight mb-1">{c.companyName}</h3>
                  <p className="text-xs text-indigo-600 dark:text-indigo-400 font-mono font-bold mb-2">ID: {c.companyId || c._id}</p>

                  <div className="space-y-1 text-xs text-gray-600 dark:text-gray-300">
                    <p className="font-medium text-purple-600 dark:text-purple-400">🏢 {c.companyType || "Standard Tenant"}</p>
                    <p className="truncate">✉️ {c.email}</p>
                    <p>📞 {c.contactNumber}</p>
                    <p>📍 {c.city}{c.state ? `, ${c.state}` : ""}</p>
                    <p className="text-gray-400 font-semibold pt-1">
                      👥 Users: <strong>{c.userCount || 0}</strong> (Staff: {c.staffCount || 0}, Employees: {c.employeeCount || 0})
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                  <button
                    onClick={() => setSelectedCompanyId(c._id)}
                    className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                  >
                    View All Details <ChevronRight size={14} />
                  </button>

                  <button
                    onClick={() => handleToggleCompanySuspend(c._id, !!c.isSuspended)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors ${
                      c.isSuspended
                        ? "bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400"
                    }`}
                  >
                    {c.isSuspended ? <Unlock size={14} /> : <Lock size={14} />}
                    {c.isSuspended ? "Unblock" : "Block"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Global Users */}
      {activeTab === "users" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative flex-1 w-full">
              <Search size={18} className="absolute left-4 top-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search users by name, user ID, email, or company..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div className="flex bg-white dark:bg-gray-900 p-1 rounded-2xl border border-gray-100 dark:border-gray-800">
              <button
                onClick={() => setUserTypeFilter("all")}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  userTypeFilter === "all" ? "bg-indigo-600 text-white" : "text-gray-500 hover:text-gray-900"
                }`}
              >
                All ({users.length})
              </button>
              <button
                onClick={() => setUserTypeFilter("staff")}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  userTypeFilter === "staff" ? "bg-indigo-600 text-white" : "text-gray-500 hover:text-gray-900"
                }`}
              >
                Staff Roles ({users.filter((u) => u.userType === "staff").length})
              </button>
              <button
                onClick={() => setUserTypeFilter("employee")}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  userTypeFilter === "employee" ? "bg-indigo-600 text-white" : "text-gray-500 hover:text-gray-900"
                }`}
              >
                Employees ({users.filter((u) => u.userType === "employee").length})
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800 text-[10px] uppercase font-bold text-gray-400">
                    <th className="p-4">User Details</th>
                    <th className="p-4">Tenant Company</th>
                    <th className="p-4">Type & Department</th>
                    <th className="p-4">Role Designation</th>
                    <th className="p-4 text-right">Block Status & Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-sm">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-gray-400 text-xs font-medium">
                        No users found
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => (
                      <tr key={u._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                        <td className="p-4">
                          <p className="font-bold text-gray-900 dark:text-white text-sm">{u.name}</p>
                          <p className="text-xs text-gray-400 font-mono">
                            ID: {u.userId} • {u.email}
                          </p>
                        </td>
                        <td className="p-4 font-semibold text-gray-700 dark:text-gray-300 text-xs">{u.company.companyName}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-md uppercase ${
                                u.isEmployee
                                  ? "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"
                                  : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                              }`}
                            >
                              {u.userType}
                            </span>
                            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{u.department}</span>
                          </div>
                        </td>
                        <td className="p-4 font-bold text-xs text-gray-800 dark:text-gray-200">{u.roleName}</td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => handleToggleUserBlock(u)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-all ${
                              u.isActive
                                ? "bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400"
                                : "bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400"
                            }`}
                          >
                            {u.isActive ? <Lock size={14} /> : <Unlock size={14} />}
                            {u.isActive ? "Block User" : "Unblock User"}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

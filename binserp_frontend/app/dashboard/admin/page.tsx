"use client";

import { useState, useMemo, useEffect } from "react";
import LoadingSpinner from "@/src/components/LoadingSpinner";
import ErrorAlert from "@/src/components/ErrorAlert";
import SuccessAlert from "@/src/components/SuccessAlert";
import { useHeader } from "@/src/context/HeaderContext";

export const dynamic = "force-dynamic";

import {
  useGetUsersQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useDeleteUserMutation,
  useToggleUserStatusMutation,
} from "@/src/store/services/userService";
import UserFormModal from "./components/UserFormModal";
import ActiveSessionsTable from "./components/ActiveSessionsTable";
import { 
  Users, 
  UserPlus, 
  Search, 
  Shield, 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  Activity, 
  MapPin, 
  Globe, 
  Edit, 
  Trash2, 
  Power,
  SlidersHorizontal,
  Mail,
  Hash,
  AlertCircle
} from "lucide-react";
import Swal from "sweetalert2";

interface User {
  _id: string;
  name: string;
  userId: string;
  email: string;
  role?: { _id: string, name: string };
  roleLevel: number;
  allowedIP?: string;
  allowedLocation?: {
    lat: number;
    lng: number;
    radius: number;
  };
  isActive?: boolean;
  createdAt?: string;
}

export default function AdminDashboard() {
  const { setHeader } = useHeader();
  const { data: users = [], isFetching, refetch } = useGetUsersQuery();
  const [createUser, { isLoading: isCreating }] = useCreateUserMutation();
  const [updateUser, { isLoading: isUpdating }] = useUpdateUserMutation();
  const [deleteUser, { isLoading: isDeleting }] = useDeleteUserMutation();
  const [toggleUserStatus, { isLoading: isToggling }] = useToggleUserStatusMutation();

  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState<"users" | "sessions">("users");
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [globalSearch, setGlobalSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  useEffect(() => {
    setHeader?.("User Management", "Manage user credentials, security constraints, and live sessions.");
  }, [setHeader]);

  // Extract unique roles for quick filter
  const uniqueRoles = useMemo(() => {
    const roleNames = users.map((u: User) => u.role?.name).filter(Boolean) as string[];
    return Array.from(new Set(roleNames));
  }, [users]);

  // Metrics
  const totalUsers = users.length;
  const activeUsersCount = useMemo(() => users.filter((u: User) => u.isActive !== false).length, [users]);
  const inactiveUsersCount = totalUsers - activeUsersCount;
  const assignedRolesCount = useMemo(() => users.filter((u: User) => !!u.role?.name).length, [users]);

  const filteredUsers = useMemo(() => {
    return users.filter((u: User) => {
      const s = globalSearch.toLowerCase().trim();
      const matchSearch = s === "" || 
        u.name.toLowerCase().includes(s) || 
        u.userId.toLowerCase().includes(s) || 
        (u.email && u.email.toLowerCase().includes(s)) ||
        (u.role?.name.toLowerCase().includes(s) ?? false);
      
      const matchRole = roleFilter === "all" || (u.role?.name === roleFilter);
      const matchStatus = 
        statusFilter === "all" || 
        (statusFilter === "active" && u.isActive !== false) || 
        (statusFilter === "inactive" && u.isActive === false);

      return matchSearch && matchRole && matchStatus;
    });
  }, [users, globalSearch, roleFilter, statusFilter]);

  const handleCreateUser = async (formData: any) => {
    setError("");
    setSuccess("");

    try {
      await createUser(formData).unwrap();
      Swal.fire({
        icon: "success",
        title: "User Created",
        text: `User "${formData.name}" was registered successfully!`,
        confirmButtonColor: "#4f46e5"
      });
      handleCloseModal();
      refetch();
    } catch (err: any) {
      const errMsg = err.data?.message || err.message || "Failed to create user. Please try again.";
      setError(errMsg);
      Swal.fire("Error", errMsg, "error");
    }
  };

  const handleUpdateUser = async (formData: any) => {
    setError("");
    setSuccess("");

    if (!editingUser) return;

    try {
      const updateData: any = {
        name: formData.name,
        role: formData.role,
        allowedIP: formData.allowedIP,
        allowedLocation: {
          lat: Number(formData.allowedLat),
          lng: Number(formData.allowedLng),
          radius: Number(formData.allowedRadius)
        }
      };

      if (formData.password && formData.password.trim() !== "") {
        updateData.password = formData.password;
      }

      await updateUser({ id: editingUser._id, body: updateData }).unwrap();
      Swal.fire({
        icon: "success",
        title: "User Updated",
        text: `User "${formData.name}" was updated successfully!`,
        confirmButtonColor: "#4f46e5"
      });
      handleCloseModal();
      refetch();
    } catch (err: any) {
      const errMsg = err.data?.message || err.message || "Failed to update user. Please try again.";
      setError(errMsg);
      Swal.fire("Error", errMsg, "error");
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    const result = await Swal.fire({
      title: "Delete User?",
      text: `Are you sure you want to permanently remove "${userName}"? This action cannot be undone.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Yes, Delete User",
      cancelButtonText: "Cancel",
      customClass: {
        popup: "rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-800 dark:bg-slate-900",
        title: "text-xl font-bold text-gray-900 dark:text-white",
        htmlContainer: "text-gray-600 dark:text-gray-300"
      }
    });

    if (!result.isConfirmed) return;

    try {
      await deleteUser(userId).unwrap();
      Swal.fire({
        icon: "success",
        title: "User Deleted",
        text: `User "${userName}" was removed successfully.`,
        confirmButtonColor: "#4f46e5",
        timer: 2000
      });
      refetch();
    } catch (err: any) {
      const errMsg = err.data?.message || err.message || "Failed to delete user. Please try again.";
      setError(errMsg);
      Swal.fire("Error", errMsg, "error");
    }
  };

  const handleToggleStatus = async (user: User) => {
    const action = user.isActive !== false ? "deactivate" : "activate";
    const result = await Swal.fire({
      title: `${action === 'activate' ? 'Activate' : 'Deactivate'} User?`,
      text: `Are you sure you want to ${action} ${user.name}? ${action === 'deactivate' ? 'They will not be able to log in until reactivated.' : 'They will regain system access.'}`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: action === 'activate' ? "#10b981" : "#f59e0b",
      cancelButtonColor: "#6b7280",
      confirmButtonText: `Yes, ${action.charAt(0).toUpperCase() + action.slice(1)}`,
      cancelButtonText: "Cancel"
    });

    if (!result.isConfirmed) return;

    try {
      await toggleUserStatus(user._id).unwrap();
      Swal.fire({
        icon: "success",
        title: `User ${action.charAt(0).toUpperCase() + action.slice(1)}d`,
        text: `User "${user.name}" status has been updated.`,
        confirmButtonColor: "#4f46e5",
        timer: 2000
      });
      refetch();
    } catch (err: any) {
      const errMsg = err.data?.message || err.message || `Failed to ${action} user. Please try again.`;
      setError(errMsg);
      Swal.fire("Error", errMsg, "error");
    }
  };

  const isUserDeletable = (user: User) => {
    if (!user.createdAt) return true;
    const createdTime = new Date(user.createdAt).getTime();
    const currentTime = new Date().getTime();
    const hoursDifference = (currentTime - createdTime) / (1000 * 60 * 60);
    return hoursDifference <= 24;
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setShowForm(true);
    setError("");
    setSuccess("");
  };

  const handleCloseModal = () => {
    setShowForm(false);
    setEditingUser(null);
  };

  return (
    <div className="w-full min-h-full pb-20 px-3 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 space-y-6">
      
      {error && <ErrorAlert message={error} onClose={() => setError("")} />}
      {success && <SuccessAlert message={success} onClose={() => setSuccess("")} />}

      <UserFormModal
        isOpen={showForm}
        onClose={handleCloseModal}
        onSubmit={editingUser ? handleUpdateUser : handleCreateUser}
        editingUser={editingUser}
        isLoading={isCreating || isUpdating}
      />

      {/* ─── Hero Overview Banner (Full Width Responsive) ──────────────── */}
      <div className="w-full relative group overflow-hidden rounded-3xl p-0.5 bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-pink-500/20 shadow-md">
        <div className="relative bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl rounded-[1.4rem] p-5 sm:p-7 border border-white/60 dark:border-slate-800/60 transition-all duration-300">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            
            {/* Header Identity */}
            <div className="flex items-center gap-4 sm:gap-6">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-indigo-600 via-purple-700 to-indigo-800 rounded-2xl flex items-center justify-center text-white text-2xl sm:text-3xl font-black shadow-lg shadow-indigo-500/25 shrink-0 ring-4 ring-indigo-50 dark:ring-indigo-950/50">
                <Users className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                    User Accounts & Security
                  </h1>
                  <span className="inline-flex items-center gap-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800/50">
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" /> Identity Engine
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium">
                  Provision employee logins, assign RBAC access roles, and set IP & Geo-fencing security parameters.
                </p>
              </div>
            </div>

            {/* Action CTA */}
            <div className="w-full lg:w-auto shrink-0 flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setEditingUser(null);
                  setShowForm(true);
                  setError("");
                  setSuccess("");
                }}
                className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white font-bold px-6 py-3 rounded-xl shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30 transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer hover:-translate-y-0.5 active:translate-y-0 text-sm"
              >
                <UserPlus size={18} />
                <span>Create New User</span>
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* ─── Metric Cards Strip (Full Width Responsive) ─────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 w-full">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-gray-200/80 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">Total Users</span>
            <p className="text-xl font-extrabold text-gray-900 dark:text-white">
              {isFetching ? "..." : totalUsers}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-gray-200/80 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">Active Accounts</span>
            <p className="text-xl font-extrabold text-gray-900 dark:text-white">
              {isFetching ? "..." : activeUsersCount}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-gray-200/80 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <XCircle className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">Inactive Accounts</span>
            <p className="text-xl font-extrabold text-gray-900 dark:text-white">
              {isFetching ? "..." : inactiveUsersCount}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-gray-200/80 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <Shield className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">Assigned Roles</span>
            <p className="text-xl font-extrabold text-gray-900 dark:text-white">
              {isFetching ? "..." : assignedRolesCount}
            </p>
          </div>
        </div>
      </div>

      {/* ─── Interactive Tab Bar ─────────────────────────────────────── */}
      <div className="flex border-b border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl p-1.5 shadow-sm">
        <button
          onClick={() => setActiveTab("users")}
          className={`flex-1 sm:flex-none py-2.5 px-6 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === "users"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-slate-800"
          }`}
        >
          <Users size={16} />
          <span>User Accounts ({users.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("sessions")}
          className={`flex-1 sm:flex-none py-2.5 px-6 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === "sessions"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-slate-800"
          }`}
        >
          <Activity size={16} />
          <span>Active Sessions</span>
        </button>
      </div>

      {activeTab === "users" ? (
        <>
          {/* ─── Search & Filters Bar ──────────────────────────────────── */}
          <div className="w-full bg-white dark:bg-slate-900 rounded-2xl p-4 border border-gray-200/80 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
            
            {/* Search Input */}
            <div className="relative w-full md:w-80 lg:w-96">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder="Search user name, ID, email, or role..."
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50/50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 text-sm text-gray-900 dark:text-white transition shadow-sm outline-none font-medium"
              />
            </div>

            {/* Role & Status Filter Pills */}
            <div className="flex items-center gap-2.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 flex-wrap sm:flex-nowrap">
              
              {/* Role Dropdown */}
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="all">All Roles</option>
                {uniqueRoles.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>

              {/* Status Pills */}
              <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-800/80 p-1 rounded-xl">
                <button
                  onClick={() => setStatusFilter("all")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    statusFilter === "all"
                      ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
                  }`}
                >
                  All ({users.length})
                </button>
                <button
                  onClick={() => setStatusFilter("active")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    statusFilter === "active"
                      ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
                  }`}
                >
                  Active ({activeUsersCount})
                </button>
                <button
                  onClick={() => setStatusFilter("inactive")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    statusFilter === "inactive"
                      ? "bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-sm"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
                  }`}
                >
                  Inactive ({inactiveUsersCount})
                </button>
              </div>

            </div>

          </div>

          {/* ─── Data Table Section (Full Width Desktop Responsive) ────── */}
          <div className="w-full bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200/80 dark:border-slate-800 overflow-hidden">
            <div className="w-full overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-gray-50/80 dark:bg-slate-800/60 border-b border-gray-200/80 dark:border-slate-800 text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wider font-semibold">
                    <th className="px-6 py-4">User Profile</th>
                    <th className="px-6 py-4">User ID & Contact</th>
                    <th className="px-6 py-4">Assigned Role</th>
                    <th className="px-6 py-4">Security Rules</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-sm">
                  {isFetching ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-16 text-center">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <LoadingSpinner size="md" />
                          <p className="text-gray-500 font-medium text-xs">Loading user directory...</p>
                        </div>
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-16 text-center">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <AlertCircle className="w-8 h-8 text-gray-400" />
                          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">No users match your criteria</p>
                          {(globalSearch || roleFilter !== "all" || statusFilter !== "all") && (
                            <button
                              onClick={() => {
                                setGlobalSearch("");
                                setRoleFilter("all");
                                setStatusFilter("all");
                              }}
                              className="text-xs font-semibold text-indigo-600 hover:underline cursor-pointer"
                            >
                              Reset filters
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user: User) => {
                      const isOnline = user.isActive !== false;
                      const hasGeoFence = Boolean(user.allowedLocation?.lat && user.allowedLocation?.lng);
                      const hasIPLimit = Boolean(user.allowedIP);

                      return (
                        <tr key={user._id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                          
                          {/* User Profile */}
                          <td className="px-6 py-4.5">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-extrabold text-sm shrink-0 shadow-sm shadow-indigo-500/20">
                                {user.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <span className="font-bold text-gray-900 dark:text-white block">{user.name}</span>
                                <span className="text-xs text-gray-400 font-medium flex items-center gap-1">
                                  <Mail className="w-3 h-3 text-gray-400" /> {user.email || "No email"}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* User ID */}
                          <td className="px-6 py-4.5">
                            <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-gray-700 dark:text-gray-300">
                              <Hash className="w-3.5 h-3.5 text-indigo-500" />
                              <span>{user.userId}</span>
                            </div>
                          </td>

                          {/* Assigned Role */}
                          <td className="px-6 py-4.5">
                            {user.role?.name ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800/50">
                                <Shield className="w-3 h-3 text-indigo-500" />
                                {user.role.name}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400 italic">Unassigned Role</span>
                            )}
                          </td>

                          {/* Security Rules */}
                          <td className="px-6 py-4.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {hasIPLimit && (
                                <span 
                                  className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-md bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                  title={`IP Restricted: ${user.allowedIP}`}
                                >
                                  <Globe className="w-3 h-3 text-sky-500" /> IP Bound
                                </span>
                              )}
                              {hasGeoFence && (
                                <span 
                                  className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-md bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                  title="Geo-fenced with radius boundary"
                                >
                                  <MapPin className="w-3 h-3 text-purple-500" /> Geo-Fenced
                                </span>
                              )}
                              {!hasIPLimit && !hasGeoFence && (
                                <span className="text-xs text-gray-400 font-mono">Standard</span>
                              )}
                            </div>
                          </td>

                          {/* Status */}
                          <td className="px-6 py-4.5">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                              isOnline
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800/40' 
                                : 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-gray-400 border border-gray-200 dark:border-slate-700'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-gray-400'}`}></span>
                              {isOnline ? 'Active' : 'Inactive'}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="px-6 py-4.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleEditUser(user)}
                                className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-xl transition-all cursor-pointer"
                                title="Edit User Details & Permissions"
                              >
                                <Edit size={17} />
                              </button>

                              <button
                                onClick={() => handleToggleStatus(user)}
                                className={`p-2 rounded-xl transition-all cursor-pointer ${
                                  isOnline
                                    ? "text-gray-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/50"
                                    : "text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
                                }`}
                                title={isOnline ? "Deactivate User" : "Activate User"}
                              >
                                <Power size={17} />
                              </button>

                              {isUserDeletable(user) && (
                                <button
                                  onClick={() => handleDeleteUser(user._id, user.name)}
                                  className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-xl transition-all cursor-pointer"
                                  title="Delete User"
                                >
                                  <Trash2 size={17} />
                                </button>
                              )}
                            </div>
                          </td>

                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <ActiveSessionsTable />
      )}

    </div>
  );
}


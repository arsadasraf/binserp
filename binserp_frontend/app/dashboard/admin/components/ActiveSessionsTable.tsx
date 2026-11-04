import { useState, useMemo } from "react";
import LoadingSpinner from "@/src/components/LoadingSpinner";
import { useGetActiveSessionsQuery, useForceLogoutUserMutation } from "@/src/store/services/userService";
import Image from "next/image";
import SessionHistoryModal from "./SessionHistoryModal";
import Swal from "sweetalert2";
import {
  Search,
  AlertCircle,
  RefreshCw,
  Smartphone,
  Tablet,
  Monitor,
  Globe,
  AppWindow,
  LogOut,
  History,
  Clock,
} from "lucide-react";

function formatTimeAgo(dateString?: string | null) {
  if (!dateString) return "Never";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "Never";
  const now = new Date();
  const diffInSeconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));

  if (diffInSeconds < 60) return `${diffInSeconds}s ago`;

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;

  return `${Math.floor(diffInHours / 24)}d ago`;
}

export function renderDeviceIcon(deviceType?: string, size = 15) {
  if (deviceType === "Phone") return <Smartphone size={size} />;
  if (deviceType === "Tablet") return <Tablet size={size} />;
  return <Monitor size={size} />;
}

export default function ActiveSessionsTable() {
  const { data: sessions = [], isFetching, refetch } = useGetActiveSessionsQuery(undefined, {
    pollingInterval: 30000,
  });
  const [forceLogoutUser, { isLoading: isForcingLogout }] = useForceLogoutUserMutation();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "online" | "offline">("all");
  const [selectedUser, setSelectedUser] = useState<any | null>(null);

  const onlineCount = useMemo(() => sessions.filter((s: any) => s.isOnline).length, [sessions]);
  const offlineCount = useMemo(() => sessions.length - onlineCount, [sessions, onlineCount]);

  const filteredSessions = useMemo(() => {
    return sessions.filter((s: any) => {
      const q = search.toLowerCase().trim();
      const devSummary = (s.currentDevice?.summary || s.lastDevice?.summary || "").toLowerCase();
      const matchSearch =
        !q ||
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.userId && s.userId.toLowerCase().includes(q)) ||
        (s.department && s.department.toLowerCase().includes(q)) ||
        devSummary.includes(q);

      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "online" && s.isOnline) ||
        (statusFilter === "offline" && !s.isOnline);

      return matchSearch && matchStatus;
    });
  }, [sessions, search, statusFilter]);

  const handleForceLogout = async (session: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    const confirm = await Swal.fire({
      icon: "warning",
      title: "Force Logout User?",
      text: `Are you sure you want to immediately terminate ${session.name}'s active session (${session.currentDevice?.categoryLabel || "Active Device"})?`,
      showCancelButton: true,
      confirmButtonColor: "#e11d48",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Yes, Force Logout",
    });

    if (!confirm.isConfirmed) return;

    try {
      await forceLogoutUser({ id: session.id || session._id || session.userId, userType: session.type }).unwrap();
      await Swal.fire({
        icon: "success",
        title: "Session Terminated",
        text: `${session.name} has been logged out immediately.`,
        timer: 1800,
        showConfirmButton: false,
      });
      refetch();
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Failed",
        text: err?.data?.message || "Could not force logout this user.",
      });
    }
  };

  // Keep selectedUser synced with latest query data
  const activeSelectedUser = useMemo(() => {
    if (!selectedUser) return null;
    return sessions.find((s: any) => s.userId === selectedUser.userId && s.type === selectedUser.type) || selectedUser;
  }, [selectedUser, sessions]);

  return (
    <div className="w-full space-y-4">
      {/* Search, Filter Pills, and Refresh Bar */}
      <div className="w-full bg-white dark:bg-slate-900 rounded-2xl p-4 border border-gray-200/80 dark:border-slate-800 shadow-sm flex flex-col lg:flex-row items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search user, ID, dept, or device..."
              className="w-full pl-10 pr-4 py-2 bg-gray-50/50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 text-xs sm:text-sm text-gray-900 dark:text-white transition shadow-sm outline-none font-medium"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Segmented Floating Pill Filter */}
          <div className="flex overflow-x-auto max-w-full no-scrollbar bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/80 dark:border-slate-700 gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                statusFilter === "all"
                  ? "bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              All Users ({sessions.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("online")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                statusFilter === "online"
                  ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Active ({onlineCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("offline")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                statusFilter === "offline"
                  ? "bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Offline ({offlineCount})
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full lg:w-auto justify-end">
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
            Click any user row to view complete login history
          </span>
          <button
            onClick={() => refetch()}
            className="p-2.5 rounded-xl border border-gray-200 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-600 dark:text-gray-400 transition cursor-pointer"
            title="Refresh sessions now"
          >
            <RefreshCw size={16} className={isFetching ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Table Section */}
      <div className="w-full bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200/80 dark:border-slate-800 overflow-hidden">
        <div className="w-full overflow-x-auto min-h-[300px]">
          <table className="w-full text-left border-collapse min-w-[920px]">
            <thead>
              <tr className="bg-gray-50/80 dark:bg-slate-800/60 border-b border-gray-200/80 dark:border-slate-800 text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wider font-semibold">
                <th className="px-5 py-3.5">User / Employee</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5">Device &amp; Access Mode</th>
                <th className="px-4 py-3.5">Session Policy</th>
                <th className="px-4 py-3.5">Department</th>
                <th className="px-4 py-3.5">Last Activity</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-sm">
              {isFetching && !sessions.length ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <LoadingSpinner size="md" />
                      <p className="text-gray-500 font-medium text-xs">Loading user sessions and device telemetry...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertCircle className="w-8 h-8 text-gray-400" />
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">No users matching filter</p>
                      {(search || statusFilter !== "all") && (
                        <button
                          onClick={() => {
                            setSearch("");
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
                filteredSessions.map((session: any) => {
                  const dev = session.currentDevice || session.lastDevice || null;
                  const isApp = dev?.accessMode === "App";
                  const categoryLabel =
                    dev?.categoryLabel ||
                    (dev?.deviceType ? `${dev.deviceType} ${dev.accessMode || "Browser"}` : null);

                  return (
                    <tr
                      key={`${session.type}_${session.id || session.userId}`}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                      onClick={() => setSelectedUser(session)}
                    >
                      {/* User */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="relative flex-shrink-0 h-10 w-10 rounded-2xl overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-sm text-white font-bold text-sm">
                            {session.photo ? (
                              <Image src={session.photo} alt={session.name} fill sizes="40px" className="object-cover" />
                            ) : (
                              <span>{session.name?.charAt(0)?.toUpperCase() || "U"}</span>
                            )}
                            <div
                              className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white dark:border-slate-800 ${
                                session.isOnline ? "bg-emerald-500" : "bg-slate-400"
                              }`}
                            />
                          </div>
                          <div>
                            <div className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                              <span>{session.name}</span>
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${
                                  session.type === "user"
                                    ? "bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300"
                                    : "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300"
                                }`}
                              >
                                {session.type === "user" ? "User" : "Employee"}
                              </span>
                            </div>
                            <div className="text-xs text-gray-400 font-mono">{session.userId}</div>
                          </div>
                        </div>
                      </td>

                      {/* Active / Offline Badge */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {session.isOnline ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                            </span>
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                            <span className="h-2 w-2 rounded-full bg-slate-400" />
                            Offline
                          </span>
                        )}
                      </td>

                      {/* Device & Access Mode */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {categoryLabel ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-bold ${
                                  isApp
                                    ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800/50"
                                    : "bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300 border border-sky-200/70 dark:border-sky-800/50"
                                }`}
                              >
                                {renderDeviceIcon(dev?.deviceType, 13)}
                                <span>{categoryLabel}</span>
                              </span>
                              {!session.isOnline && (
                                <span className="text-[10px] text-slate-400 italic">(Last used)</span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              {[dev?.browser, dev?.os].filter(Boolean).join(" • ")}
                              {dev?.ipAddress ? ` • IP: ${dev.ipAddress}` : ""}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">No login recorded yet</span>
                        )}
                      </td>

                      {/* Session Policy */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {session.isOnline ? (
                          isApp ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                              <AppWindow size={13} /> Permanent (App)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                              <Globe size={13} /> 24h Max (Browser)
                            </span>
                          )
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>

                      {/* Department */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-xs font-semibold text-gray-700 dark:text-gray-300">
                        {session.department || "General Access"}
                      </td>

                      {/* Last Activity */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                          <Clock size={13} className="text-slate-400" />
                          <span>{formatTimeAgo(session.lastActiveAt)}</span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 whitespace-nowrap text-right space-x-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setSelectedUser(session)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 transition cursor-pointer"
                          title="View complete login & logout history"
                        >
                          <History size={13} />
                          <span>History</span>
                        </button>

                        {session.isOnline && (
                          <button
                            type="button"
                            disabled={isForcingLogout}
                            onClick={(e) => handleForceLogout(session, e)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 border border-rose-200/70 dark:border-rose-800/50 transition cursor-pointer disabled:opacity-50"
                            title="Force logout this user from active device"
                          >
                            <LogOut size={13} />
                            <span>Force Logout</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <SessionHistoryModal
        isOpen={!!activeSelectedUser}
        onClose={() => setSelectedUser(null)}
        userId={activeSelectedUser?.userId || null}
        userName={activeSelectedUser?.name || ""}
        userSession={activeSelectedUser}
        onForceLogout={handleForceLogout}
      />
    </div>
  );
}

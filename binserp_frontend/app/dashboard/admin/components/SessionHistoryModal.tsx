import {
  X,
  MapPin,
  Monitor,
  Smartphone,
  Tablet,
  LogIn,
  LogOut,
  ShieldAlert,
  AppWindow,
  Globe,
} from "lucide-react";
import LoadingSpinner from "@/src/components/LoadingSpinner";
import { useGetSessionHistoryQuery } from "@/src/store/services/userService";
import { useEffect } from "react";

interface SessionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string | null;
  userName: string;
  userSession?: any;
  onForceLogout?: (session: any, e?: React.MouseEvent) => void;
}

function formatDateTime(dateString: string) {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function getDeviceIcon(deviceType?: string, size = 14) {
  if (deviceType === "Phone") return <Smartphone size={size} />;
  if (deviceType === "Tablet") return <Tablet size={size} />;
  return <Monitor size={size} />;
}

export default function SessionHistoryModal({
  isOpen,
  onClose,
  userId,
  userName,
  userSession,
  onForceLogout,
}: SessionHistoryModalProps) {
  const { data: history = [], isFetching, refetch } = useGetSessionHistoryQuery(userId || "", {
    skip: !isOpen || !userId,
  });

  useEffect(() => {
    if (isOpen && userId) {
      refetch();
    }
  }, [isOpen, userId, refetch]);

  if (!isOpen) return null;

  const isOnline = Boolean(userSession?.isOnline);
  const currentDevice = userSession?.currentDevice || null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden z-10">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-indigo-50/70 to-blue-50/70 dark:from-slate-800/80 dark:to-slate-800/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-500/25 shrink-0">
              <Monitor size={20} />
            </div>
            <div>
              <div className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2.5">
                <span>{userName}</span>
                {isOnline ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                    Active Now
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-200/80 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                    Offline
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                ID: <span className="font-mono font-semibold">{userId}</span>
                {userSession?.department ? ` • ${userSession.department}` : ""}
                {` • Complete Session History (${history.length} records)`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-white dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Active Session Banner (when user is currently logged in) */}
        {isOnline && (
          <div className="mx-6 mt-4 p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-extrabold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                {getDeviceIcon(currentDevice?.deviceType, 14)}
                <span>
                  Current Active Device: {currentDevice?.categoryLabel || "Logged In Session"}
                </span>
                {currentDevice?.accessMode === "App" ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300 text-[10px] font-bold">
                    <AppWindow size={11} /> Permanent App Session
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 text-[10px] font-bold">
                    <Globe size={11} /> 24h Browser Session
                  </span>
                )}
              </div>
              <div className="text-xs text-emerald-700 dark:text-emerald-400">
                {[currentDevice?.browser, currentDevice?.os].filter(Boolean).join(" • ") || "Web Session"}
                {currentDevice?.ipAddress ? ` • IP: ${currentDevice.ipAddress}` : ""}
                {currentDevice?.loggedInAt ? ` • Logged in: ${formatDateTime(currentDevice.loggedInAt)}` : ""}
              </div>
            </div>

            {onForceLogout && userSession && (
              <button
                type="button"
                onClick={(e) => onForceLogout(userSession, e)}
                className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer shrink-0"
              >
                <LogOut size={13} />
                <span>Force Logout</span>
              </button>
            )}
          </div>
        )}

        {/* Complete Session History Timeline */}
        <div className="p-6 overflow-y-auto flex-1">
          {isFetching ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner size="md" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400">
              No login or logout history found for this user yet.
            </div>
          ) : (
            <div className="space-y-5">
              {history.map((record: any, index: number) => {
                const dev = record.deviceInfo || {};
                const categoryLabel =
                  dev.categoryLabel ||
                  (dev.deviceType ? `${dev.deviceType} ${dev.accessMode || "Browser"}` : "Browser / Device");
                const isLogin = record.action === "login";
                const isForceLogout = record.action === "force_logout";

                return (
                  <div key={record._id || index} className="relative flex gap-4">
                    {index !== history.length - 1 && (
                      <div className="absolute left-[19px] top-10 bottom-[-20px] w-0.5 bg-slate-200 dark:bg-slate-700" />
                    )}

                    {/* Action Icon */}
                    <div
                      className={`relative z-10 flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center border-4 border-white dark:border-slate-900 ${
                        isLogin
                          ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400"
                          : isForceLogout
                          ? "bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400"
                          : "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400"
                      }`}
                    >
                      {isLogin ? (
                        <LogIn size={16} />
                      ) : isForceLogout ? (
                        <ShieldAlert size={16} />
                      ) : (
                        <LogOut size={16} />
                      )}
                    </div>

                    {/* Details Card */}
                    <div className="flex-1 pt-0.5 pb-1">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900 dark:text-white">
                            {isLogin
                              ? "Logged In"
                              : isForceLogout
                              ? "Force Logged Out by Admin"
                              : "Logged Out"}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold ${
                              dev.accessMode === "App"
                                ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800/50"
                                : "bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200/70 dark:border-sky-800/50"
                            }`}
                          >
                            {getDeviceIcon(dev.deviceType, 12)}
                            <span>{categoryLabel}</span>
                          </span>
                        </div>

                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">
                          {formatDateTime(record.createdAt || record.timestamp)}
                        </span>
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-200/70 dark:border-slate-700/50 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <Monitor size={13} className="text-slate-400 shrink-0" />
                          <span className="text-slate-400 font-medium">Platform:</span>
                          <span className="font-semibold">
                            {[dev.browser, dev.os].filter(Boolean).join(" on ") || "Standard Web"}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Globe size={13} className="text-slate-400 shrink-0" />
                          <span className="text-slate-400 font-medium">IP Address:</span>
                          <span className="font-mono font-semibold">{record.ipAddress || "Unknown"}</span>
                        </div>

                        {record.location && (record.location.lat || record.location.city) && (
                          <div className="flex items-center gap-1.5 sm:col-span-2">
                            <MapPin size={13} className="text-slate-400 shrink-0" />
                            <span className="text-slate-400 font-medium">Location:</span>
                            <span>
                              {record.location.city
                                ? `${record.location.city}${record.location.region ? `, ${record.location.region}` : ""}`
                                : `${Number(record.location.lat).toFixed(4)}, ${Number(record.location.lng).toFixed(4)}`}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import LoadingSpinner from "@/src/components/LoadingSpinner";
import { useGetActiveSessionsQuery } from "@/src/store/services/userService";
import Image from "next/image";
import SessionHistoryModal from "./SessionHistoryModal";
import { Search, Activity, Clock, Shield, AlertCircle, RefreshCw } from "lucide-react";

function formatTimeAgo(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  
  return `${Math.floor(diffInHours / 24)}d ago`;
}

export default function ActiveSessionsTable() {
  const { data: sessions = [], isFetching, refetch } = useGetActiveSessionsQuery(undefined, { pollingInterval: 60000 }); // Poll every minute
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<{ id: string; name: string } | null>(null);

  const filteredSessions = sessions.filter((s: any) => 
    (s.name && s.name.toLowerCase().includes(search.toLowerCase())) || 
    (s.userId && s.userId.toLowerCase().includes(search.toLowerCase())) || 
    (s.department && s.department.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="w-full space-y-4">
      {/* Search and Refresh Bar */}
      <div className="w-full bg-white dark:bg-slate-900 rounded-2xl p-4 border border-gray-200/80 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80 lg:w-96">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search active users, ID, or department..."
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50/50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 text-sm text-gray-900 dark:text-white transition shadow-sm outline-none font-medium"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
            Live auto-poll active (every 60s)
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
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-gray-50/80 dark:bg-slate-800/60 border-b border-gray-200/80 dark:border-slate-800 text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wider font-semibold">
                <th className="px-6 py-4">Logged In User</th>
                <th className="px-6 py-4">Account Type</th>
                <th className="px-6 py-4">Department / Module</th>
                <th className="px-6 py-4">Heartbeat Activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-sm">
              {isFetching && !sessions.length ? (
                <tr>
                  <td colSpan={4} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <LoadingSpinner size="md" />
                      <p className="text-gray-500 font-medium text-xs">Fetching active telemetry sessions...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertCircle className="w-8 h-8 text-gray-400" />
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">No active sessions found</p>
                      {search && (
                        <button
                          onClick={() => setSearch("")}
                          className="text-xs font-semibold text-indigo-600 hover:underline cursor-pointer"
                        >
                          Clear search filter
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredSessions.map((session: any) => (
                  <tr 
                    key={session.id || session.userId} 
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                    onClick={() => setSelectedUser({ id: session.userId, name: session.name })}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="relative flex-shrink-0 h-10 w-10 rounded-2xl overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-sm text-white font-bold text-sm">
                          {session.photo ? (
                            <Image src={session.photo} alt={session.name} fill className="object-cover" />
                          ) : (
                            <span>{session.name?.charAt(0)?.toUpperCase() || "U"}</span>
                          )}
                          <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-800"></div>
                        </div>
                        <div>
                          <div className="font-bold text-gray-900 dark:text-white">{session.name}</div>
                          <div className="text-xs text-gray-400 font-mono">{session.userId}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-lg ${
                        session.type === 'user' 
                          ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200/70 dark:border-purple-800/40' 
                          : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800/40'
                      }`}>
                        {session.type === 'user' ? 'SaaS Account' : 'Portal Employee'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-700 dark:text-gray-300">
                      {session.department || "General Access"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-emerald-600 dark:text-emerald-400 font-semibold text-xs">
                        <span className="relative flex h-2.5 w-2.5 mr-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                        </span>
                        <span>{formatTimeAgo(session.lastActiveAt)}</span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <SessionHistoryModal 
        isOpen={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        userId={selectedUser?.id || null}
        userName={selectedUser?.name || ""}
      />
    </div>
  );
}


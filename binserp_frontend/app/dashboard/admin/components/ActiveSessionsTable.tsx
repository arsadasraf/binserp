import { useState } from "react";
import LoadingSpinner from "@/src/components/LoadingSpinner";
import { useGetActiveSessionsQuery } from "@/src/store/services/userService";
import Image from "next/image";

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
  const { data: sessions = [], isFetching } = useGetActiveSessionsQuery(undefined, { pollingInterval: 60000 }); // Poll every minute
  const [search, setSearch] = useState("");

  const filteredSessions = sessions.filter((s: any) => 
    s.name.toLowerCase().includes(search.toLowerCase()) || 
    s.userId.toLowerCase().includes(search.toLowerCase()) || 
    s.department.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white h-auto p-2 rounded-md shadow-sm border border-gray-200 dark:border-slate-700 flex sm:flex-row items-center justify-between">
        <div className="flex flex-1 gap-1 w-full sm:w-96">
          <input
            type="text"
            placeholder="Search active sessions..."
            className="w-full h-auto pl-2 pr-2 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all dark:bg-slate-900 dark:text-white"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 shadow-lg rounded-xl overflow-hidden border border-gray-200 dark:border-slate-700">
        <div className="overflow-x-auto min-h-[300px]">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
            <thead className="bg-gray-50 dark:bg-slate-800/50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Role Type
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Department
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Last Active
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
              {isFetching && !sessions.length ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <LoadingSpinner size="md" />
                  </td>
                </tr>
              ) : filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    No active sessions found.
                  </td>
                </tr>
              ) : (
                filteredSessions.map((session: any) => (
                  <tr key={session.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center relative shadow-sm border border-gray-200">
                          {session.photo ? (
                            <Image src={session.photo} alt={session.name} fill className="object-cover" />
                          ) : (
                            <span className="text-gray-500 font-bold text-lg">{session.name.charAt(0)}</span>
                          )}
                          <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-white dark:border-slate-800"></div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">{session.name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{session.userId}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${session.type === 'user' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                        {session.type === 'user' ? 'SaaS User' : 'Employee'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {session.department}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex items-center text-green-600 dark:text-green-400 font-medium">
                        <span className="relative flex h-2.5 w-2.5 mr-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                        </span>
                        {formatTimeAgo(session.lastActiveAt)}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

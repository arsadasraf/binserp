import { X, MapPin, Monitor, LogIn, LogOut } from "lucide-react";
import LoadingSpinner from "@/src/components/LoadingSpinner";
import { useGetSessionHistoryQuery } from "@/src/store/services/userService";
import { useEffect } from "react";

interface SessionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string | null;
  userName: string;
}

function formatTime(dateString: string) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hour12: true,
  }).format(date);
}

export default function SessionHistoryModal({ isOpen, onClose, userId, userName }: SessionHistoryModalProps) {
  const { data: history = [], isFetching, refetch } = useGetSessionHistoryQuery(userId || "", {
    skip: !isOpen || !userId,
  });

  useEffect(() => {
    if (isOpen && userId) {
      refetch();
    }
  }, [isOpen, userId, refetch]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg border border-gray-100 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-gray-50/50 dark:bg-slate-900/50">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Monitor size={20} className="text-indigo-500" />
              Session History
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Recent logins and logouts for <span className="font-semibold text-gray-700 dark:text-gray-200">{userName}</span></p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
          {isFetching ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner size="md" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-10 text-gray-500 dark:text-gray-400">
              No recent session history found.
            </div>
          ) : (
            <div className="space-y-6">
              {history.map((record: any, index: number) => (
                <div key={record._id || index} className="relative flex gap-4">
                  {/* Timeline line */}
                  {index !== history.length - 1 && (
                    <div className="absolute left-[19px] top-10 bottom-[-24px] w-0.5 bg-gray-200 dark:bg-slate-700" />
                  )}
                  
                  {/* Icon */}
                  <div className={`relative z-10 flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center border-4 border-white dark:border-slate-900 ${
                    record.action === "login" 
                      ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" 
                      : "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
                  }`}>
                    {record.action === "login" ? <LogIn size={16} /> : <LogOut size={16} />}
                  </div>

                  {/* Details */}
                  <div className="flex-1 pt-1 pb-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-gray-900 dark:text-white capitalize">
                        {record.action}
                      </span>
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-slate-800 px-2 py-1 rounded-full">
                        {formatTime(record.createdAt || record.timestamp)}
                      </span>
                    </div>
                    
                    <div className="mt-2 space-y-1.5 bg-gray-50 dark:bg-slate-800/50 rounded-xl p-3 border border-gray-100 dark:border-slate-700/50">
                      <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                        <Monitor size={14} className="mr-2 text-gray-400" />
                        <span className="text-xs font-medium text-gray-500 mr-1">IP:</span> 
                        <span className="font-mono text-xs">{record.ipAddress || "Unknown"}</span>
                      </div>
                      
                      {record.location && (record.location.lat || record.location.city) && (
                        <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                          <MapPin size={14} className="mr-2 text-gray-400" />
                          <span className="text-xs font-medium text-gray-500 mr-1">Location:</span> 
                          <span className="text-xs">
                            {record.location.city 
                              ? `${record.location.city}${record.location.region ? `, ${record.location.region}` : ''}`
                              : `${record.location.lat.toFixed(4)}, ${record.location.lng.toFixed(4)}`}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

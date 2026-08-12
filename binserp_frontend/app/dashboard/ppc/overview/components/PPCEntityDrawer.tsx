"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  PlayCircle,
  Clock,
  CheckCircle2,
  Cpu,
  User,
  Package,
  Layers,
  AlertCircle,
  Calendar,
} from "lucide-react";

export interface DrawerEntity {
  id: string;
  name: string;
  code?: string;
  type: "workstation" | "employee" | "order";
  status: string;
  subtitle?: string;
  photo?: string;
  department?: string;
  location?: string;
  customerName?: string;
  targetQuantity?: number;
  completedQuantity?: number;
  currentJob?: {
    jobId: string;
    jobNumber: string;
    partName: string;
    operationName?: string;
    operatorName?: string;
    machineName?: string;
    startTime?: string;
    progressPercentage?: number;
    status: string;
  } | null;
  pendingQueue?: Array<{
    jobId: string;
    jobNumber: string;
    partName: string;
    operationName?: string;
    scheduledDate?: string;
    priority?: string;
    quantity?: number;
  }>;
  completedHistory?: Array<{
    jobId: string;
    jobNumber: string;
    partName: string;
    operationName?: string;
    operatorName?: string;
    machineName?: string;
    completedAt?: string;
    quantityProduced?: number;
    durationMinutes?: number;
  }>;
}

interface PPCEntityDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  entity: DrawerEntity | null;
}

export default function PPCEntityDrawer({ isOpen, onClose, entity }: PPCEntityDrawerProps) {
  if (!isOpen || !entity) return null;

  const currentJob = entity.currentJob;
  const pendingQueue = entity.pendingQueue || [];
  const completedHistory = entity.completedHistory || [];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-hidden">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        />

        <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="w-screen max-w-2xl bg-white dark:bg-gray-900 shadow-2xl flex flex-col border-l border-gray-200 dark:border-gray-800"
          >
            {/* Drawer Header */}
            <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-start justify-between bg-slate-50/50 dark:bg-gray-800/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                  {entity.type === "workstation" ? (
                    <Cpu size={24} />
                  ) : entity.type === "employee" ? (
                    <User size={24} />
                  ) : (
                    <Package size={24} />
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">
                      {entity.name}
                    </h2>
                    <span
                      className={`px-3 py-0.5 rounded-full text-xs font-extrabold uppercase ${
                        entity.status === "Running" || entity.status === "Active" || entity.status === "In Production"
                          ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                          : entity.status === "Maintenance" || entity.status === "Delayed"
                          ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
                          : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300"
                      }`}
                    >
                      {entity.status}
                    </span>
                  </div>

                  {entity.code && (
                    <p className="text-xs text-gray-500 font-mono mt-0.5">ID: {entity.code}</p>
                  )}
                  {entity.subtitle && (
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{entity.subtitle}</p>
                  )}
                </div>
              </div>

              <button
                onClick={onClose}
                className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Drawer Body - Scrollable */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {/* ⚡ SECTION 1: CURRENTLY RUNNING JOB */}
              <div className="space-y-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
                  <PlayCircle size={16} /> Currently Running Job
                </h3>

                {currentJob ? (
                  <div className="bg-gradient-to-br from-indigo-50/80 to-blue-50/50 dark:from-indigo-950/30 dark:to-blue-950/20 border border-indigo-200 dark:border-indigo-800 rounded-2xl p-5 shadow-sm space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider font-mono">
                          {currentJob.jobNumber}
                        </span>
                        <h4 className="text-base font-extrabold text-gray-900 dark:text-white">
                          {currentJob.partName}
                        </h4>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-xs font-black bg-indigo-600 text-white shadow-sm">
                        ACTIVE
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      {currentJob.operationName && (
                        <div className="bg-white/80 dark:bg-gray-900/80 p-2.5 rounded-xl border border-indigo-100 dark:border-gray-800">
                          <p className="text-[10px] font-bold text-gray-400 uppercase">Operation</p>
                          <p className="font-extrabold text-gray-900 dark:text-white">{currentJob.operationName}</p>
                        </div>
                      )}
                      {currentJob.operatorName && (
                        <div className="bg-white/80 dark:bg-gray-900/80 p-2.5 rounded-xl border border-indigo-100 dark:border-gray-800">
                          <p className="text-[10px] font-bold text-gray-400 uppercase">Operator</p>
                          <p className="font-extrabold text-gray-900 dark:text-white">{currentJob.operatorName}</p>
                        </div>
                      )}
                      {currentJob.machineName && (
                        <div className="bg-white/80 dark:bg-gray-900/80 p-2.5 rounded-xl border border-indigo-100 dark:border-gray-800">
                          <p className="text-[10px] font-bold text-gray-400 uppercase">Workstation</p>
                          <p className="font-extrabold text-gray-900 dark:text-white">{currentJob.machineName}</p>
                        </div>
                      )}
                      {currentJob.startTime && (
                        <div className="bg-white/80 dark:bg-gray-900/80 p-2.5 rounded-xl border border-indigo-100 dark:border-gray-800">
                          <p className="text-[10px] font-bold text-gray-400 uppercase">Started At</p>
                          <p className="font-mono font-bold text-gray-900 dark:text-white">
                            {new Date(currentJob.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Progress Bar */}
                    {typeof currentJob.progressPercentage === "number" && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] font-bold">
                          <span className="text-gray-500">Execution Progress</span>
                          <span className="text-indigo-600 dark:text-indigo-400">{currentJob.progressPercentage}%</span>
                        </div>
                        <div className="w-full h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                            style={{ width: `${currentJob.progressPercentage}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-6 text-center bg-gray-50 dark:bg-gray-800/40 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800">
                    <AlertCircle className="mx-auto text-gray-300 dark:text-gray-600 mb-2" size={24} />
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">No job currently running on this item.</p>
                  </div>
                )}
              </div>

              {/* ⏳ SECTION 2: ASSIGNED / PENDING JOB QUEUE */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-2">
                    <Clock size={16} /> Assigned / Pending Queue
                  </h3>
                  <span className="text-xs font-bold text-gray-400">{pendingQueue.length} Jobs Queued</span>
                </div>

                {pendingQueue.length > 0 ? (
                  <div className="space-y-2.5">
                    {pendingQueue.map((item, idx) => (
                      <div
                        key={item.jobId || idx}
                        className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 rounded-xl flex items-center justify-between hover:border-indigo-300 transition-colors"
                      >
                        <div>
                          <span className="text-[10px] font-mono text-gray-400">{item.jobNumber}</span>
                          <h5 className="text-xs font-extrabold text-gray-900 dark:text-white">{item.partName}</h5>
                          {item.operationName && (
                            <p className="text-[11px] text-gray-500 mt-0.5">Op: {item.operationName}</p>
                          )}
                        </div>

                        <div className="text-right space-y-1">
                          {item.priority && (
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                item.priority === "Urgent"
                                  ? "bg-red-100 text-red-700"
                                  : item.priority === "High"
                                  ? "bg-orange-100 text-orange-700"
                                  : "bg-blue-100 text-blue-700"
                              }`}
                            >
                              {item.priority}
                            </span>
                          )}
                          {item.scheduledDate && (
                            <p className="text-[10px] text-gray-400 font-mono">
                              {new Date(item.scheduledDate).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-center bg-gray-50 dark:bg-gray-800/40 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800">
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">No pending queue assigned.</p>
                  </div>
                )}
              </div>

              {/* ✅ SECTION 3: COMPLETED JOB HISTORY */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                    <CheckCircle2 size={16} /> Completed Job History
                  </h3>
                  <span className="text-xs font-bold text-gray-400">{completedHistory.length} Jobs Finished</span>
                </div>

                {completedHistory.length > 0 ? (
                  <div className="space-y-2.5">
                    {completedHistory.map((item, idx) => (
                      <div
                        key={item.jobId || idx}
                        className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 rounded-xl flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                            <CheckCircle2 size={16} />
                          </div>
                          <div>
                            <span className="text-[10px] font-mono text-gray-400">{item.jobNumber}</span>
                            <h5 className="text-xs font-extrabold text-gray-900 dark:text-white">{item.partName}</h5>
                            {item.operationName && (
                              <p className="text-[11px] text-gray-500 mt-0.5">Op: {item.operationName}</p>
                            )}
                          </div>
                        </div>

                        <div className="text-right">
                          {item.completedAt && (
                            <p className="text-[11px] font-extrabold text-gray-900 dark:text-white">
                              {new Date(item.completedAt).toLocaleDateString()}
                            </p>
                          )}
                          {item.quantityProduced && (
                            <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                              Output: {item.quantityProduced} pcs
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-center bg-gray-50 dark:bg-gray-800/40 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800">
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">No completed job history recorded yet.</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
}

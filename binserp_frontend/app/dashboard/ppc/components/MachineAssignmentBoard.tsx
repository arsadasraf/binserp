"use client";
import React, { useState, useCallback } from "react";
import { Plus, X, ChevronLeft, ChevronRight, CheckCircle, Clock, User, Users } from "lucide-react";
import LoadingSpinner from "@/src/components/LoadingSpinner";
import {
  useGetMachinesQuery,
  useGetManpowerMasterQuery,
  useGetJobsQuery,
  useGetProcessesQuery,
  useGetMachineAssignmentsQuery,
  useCreateMachineAssignmentMutation,
  useUpdateMachineAssignmentMutation,
  useDeleteMachineAssignmentMutation,
} from "@/src/store/services/ppcService";

// ─── Types ──────────────────────────────────────────────────────────────────
interface Machine { _id: string; machineName: string; machineCode: string; machineType: string; status: string; category?: any; }
interface Employee { _id: string; name: string; employeeId: string; }
interface ManpowerItem { employeeId: string; name: string; designation?: string; manpowerId: string | null; internalEmployeeId?: string; }
interface Job { _id: string; jobNumber: string; partName?: string; status: string; }
interface Process { _id: string; processName: string; processCode: string; }
interface Assignment {
  _id: string;
  machine: string | Machine;
  date: string;
  shift: Shift;
  startTime?: string;
  endTime?: string;
  operator: string | Employee;
  helpers?: (string | Employee)[];
  job?: string | Job;
  jobDetail?: string;
  targetQuantity?: number;
  process?: string | Process;
  processName?: string;
  status: "Planned" | "InProgress" | "Completed" | "Cancelled";
  remarks?: string;
}

type Shift = "Morning" | "Afternoon" | "Night" | "General";

const SHIFTS: Shift[] = ["Morning", "Afternoon", "Night", "General"];

const SHIFT_META: Record<Shift, { color: string; bg: string; border: string; time: string }> = {
  Morning:   { color: "text-amber-700",  bg: "bg-amber-50",  border: "border-amber-200",  time: "06:00 – 14:00" },
  Afternoon: { color: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200", time: "14:00 – 22:00" },
  Night:     { color: "text-indigo-700", bg: "bg-indigo-50", border: "border-indigo-200", time: "22:00 – 06:00" },
  General:   { color: "text-teal-700",   bg: "bg-teal-50",   border: "border-teal-200",   time: "09:00 – 18:00" },
};

const STATUS_COLORS: Record<string, string> = {
  Planned:    "bg-blue-100 text-blue-700",
  InProgress: "bg-amber-100 text-amber-700",
  Completed:  "bg-green-100 text-green-700",
  Cancelled:  "bg-gray-100 text-gray-500",
};

function fmtDate(d: Date) { return d.toISOString().slice(0, 10); }
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }

// ─── Main Component ──────────────────────────────────────────────────────────
export default function MachineAssignmentBoard() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showModal, setShowModal] = useState(false);
  const [modalCtx, setModalCtx] = useState<{ machine: Machine; shift: Shift } | null>(null);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [form, setForm] = useState<Partial<Assignment & { operator: string; helpers: string[]; job: string; process: string }>>({
    shift: "Morning", status: "Planned",
  });
  const [submitting, setSubmitting] = useState(false);

  // RTK Query hooks
  const { data: machines = [] } = useGetMachinesQuery();
  const { data: employees = [] } = useGetManpowerMasterQuery();
  const { data: allJobs = [] } = useGetJobsQuery();
  const { data: processes = [] } = useGetProcessesQuery();
  const { data: assignments = [], isLoading: loading } = useGetMachineAssignmentsQuery(fmtDate(selectedDate));
  const [createAssignment] = useCreateMachineAssignmentMutation();
  const [updateAssignment] = useUpdateMachineAssignmentMutation();
  const [deleteAssignment] = useDeleteMachineAssignmentMutation();

  const jobs = (allJobs as Job[]).filter((j) => j.status !== "Completed" && j.status !== "Cancelled");

  const empName = (id: string) => (employees as ManpowerItem[]).find((e) => e.internalEmployeeId === id || e.manpowerId === id)?.name || id;
  const getAssignment = useCallback((machineId: string, shift: Shift) => {
    return assignments.find(a => {
      const mid = typeof a.machine === "string" ? a.machine : a.machine?._id;
      return mid === machineId && a.shift === shift;
    });
  }, [assignments]);

  // ─── Open modal for a cell ───────────────────────────────────────────────
  const openAssign = (machine: Machine, shift: Shift) => {
    const existing = getAssignment(machine._id, shift);
    setModalCtx({ machine, shift });
    setEditingAssignment(existing || null);
    setForm(existing ? {
      ...existing,
      operator: typeof existing.operator === "string" ? existing.operator : existing.operator?._id || "",
      helpers: (existing.helpers || []).map((h: any) => typeof h === "string" ? h : h._id),
      job: existing.job ? (typeof existing.job === "string" ? existing.job : (existing.job as Job)._id) : "",
      process: existing.process ? (typeof existing.process === "string" ? existing.process : (existing.process as Process)._id) : "",
    } : { shift, status: "Planned" });
    setShowModal(true);
  };

  // ─── Submit assignment ───────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalCtx) return;
    setSubmitting(true);
    try {
      const payload = { ...form, machine: modalCtx.machine._id, date: fmtDate(selectedDate), shift: modalCtx.shift };
      if (editingAssignment) {
        await updateAssignment({ id: editingAssignment._id, body: payload });
      } else {
        await createAssignment(payload);
      }
      setShowModal(false);
    } catch (e) { console.error(e); }
    finally { setSubmitting(false); }
  };

  // ─── Delete ──────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!editingAssignment) return;
    if (!confirm("Remove this assignment?")) return;
    setSubmitting(true);
    try {
      await deleteAssignment(editingAssignment._id);
      setShowModal(false);
    } catch (e) { console.error(e); }
    finally { setSubmitting(false); }
  };


  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Date Navigator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => setSelectedDate(d => addDays(d, -1))}
            className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
            <ChevronLeft size={16} />
          </button>
          <div className="text-center">
            <p className="font-bold text-gray-900 dark:text-white text-lg">
              {selectedDate.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "long", year: "numeric" })}
            </p>
            {fmtDate(selectedDate) === fmtDate(new Date()) && (
              <span className="text-xs text-indigo-600 font-semibold">Today</span>
            )}
          </div>
          <button onClick={() => setSelectedDate(d => addDays(d, 1))}
            className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setSelectedDate(new Date())}
            className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium">
            Today
          </button>
          <input type="date" value={fmtDate(selectedDate)}
            onChange={e => setSelectedDate(new Date(e.target.value))}
            className="border rounded-lg px-2 py-1 text-xs text-gray-700 focus:ring-indigo-500 focus:border-indigo-500" />
        </div>
      </div>

      {/* Shift Legend */}
      <div className="flex flex-wrap gap-2">
        {SHIFTS.map(s => (
          <span key={s} className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${SHIFT_META[s].bg} ${SHIFT_META[s].color} ${SHIFT_META[s].border} border`}>
            {s} · {SHIFT_META[s].time}
          </span>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner /></div>
      ) : machines.length === 0 ? (
        <div className="text-center py-16 text-gray-400">No machines found. Add machines in Master → Shopfloor first.</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-100 shadow-sm">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-48 sticky left-0 bg-gray-50 dark:bg-gray-800/60">
                  Machine
                </th>
                {SHIFTS.map(s => (
                  <th key={s} className={`px-3 py-3 text-xs font-semibold uppercase tracking-wider text-center ${SHIFT_META[s].color}`}>
                    {s}<span className="font-normal text-gray-400 ml-1 normal-case">({SHIFT_META[s].time})</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {machines.map(machine => (
                <tr key={machine._id} className="group hover:bg-gray-50/60 transition-colors">
                  {/* Machine Name Cell */}
                  <td className="px-4 py-3 sticky left-0 bg-white group-hover:bg-gray-50/60 transition-colors">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${machine.status === "Available" ? "bg-green-400" : machine.status === "Busy" ? "bg-amber-400" : machine.status === "Breakdown" ? "bg-red-400" : "bg-gray-300"}`} />
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{machine.machineName}</p>
                        <p className="text-[10px] text-gray-400 font-mono">{machine.machineCode} · {machine.machineType}</p>
                      </div>
                    </div>
                  </td>

                  {/* Shift Cells */}
                  {SHIFTS.map(shift => {
                    const asgn = getAssignment(machine._id, shift);
                    return (
                      <td key={shift} className="px-2 py-2 text-center">
                        {asgn ? (
                          <button onClick={() => openAssign(machine, shift)}
                            className={`w-full text-left p-2.5 rounded-xl border ${SHIFT_META[shift].border} ${SHIFT_META[shift].bg} transition-all hover:shadow-md hover:scale-[1.02] active:scale-100`}>
                            <div className="flex items-start justify-between gap-1 mb-1">
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${STATUS_COLORS[asgn.status]}`}>
                                {asgn.status}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <User size={10} className="text-gray-500 flex-shrink-0" />
                              <p className="text-[11px] font-semibold text-gray-800 truncate">
                                {typeof asgn.operator === "object" ? asgn.operator?.name : empName(asgn.operator as string)}
                              </p>
                            </div>
                            {asgn.processName && (
                              <p className="text-[10px] text-gray-500 mt-0.5 truncate">{asgn.processName}</p>
                            )}
                            {typeof asgn.job === "object" && asgn.job?.jobNumber && (
                              <p className="text-[10px] text-indigo-600 font-mono mt-0.5">{asgn.job.jobNumber}</p>
                            )}
                          </button>
                        ) : (
                          <button onClick={() => openAssign(machine, shift)}
                            className="w-full h-16 rounded-xl border-2 border-dashed border-gray-200 text-gray-300 hover:border-indigo-300 hover:text-indigo-400 hover:bg-indigo-50/30 transition-all flex items-center justify-center">
                            <Plus size={16} />
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary Bar */}
      {!loading && assignments.length > 0 && (
        <div className="flex flex-wrap gap-3 pt-2">
          {(["Planned", "InProgress", "Completed", "Cancelled"] as const).map(s => {
            const count = assignments.filter(a => a.status === s).length;
            if (count === 0) return null;
            return (
              <div key={s} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold ${STATUS_COLORS[s]}`}>
                {s === "Completed" ? <CheckCircle size={12} /> : <Clock size={12} />}
                {count} {s}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Assign Modal ─────────────────────────────────────────────────── */}
      {showModal && modalCtx && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className={`px-6 py-4 rounded-t-3xl flex items-start justify-between ${SHIFT_META[modalCtx.shift].bg}`}>
              <div>
                <p className={`text-xs font-bold uppercase tracking-wider ${SHIFT_META[modalCtx.shift].color}`}>
                  {modalCtx.shift} Shift · {SHIFT_META[modalCtx.shift].time}
                </p>
                <h3 className="text-lg font-bold text-gray-900 mt-0.5">{modalCtx.machine.machineName}</h3>
                <p className="text-xs text-gray-400 font-mono">{modalCtx.machine.machineCode} · {selectedDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-xl hover:bg-black/10 transition-colors"><X size={18} /></button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Operator */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">
                  <User size={12} /> Primary Operator <span className="text-red-500">*</span>
                </label>
                <select required value={form.operator as string || ""} onChange={e => setForm({ ...form, operator: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 bg-gray-50">
                  <option value="">Select Operator</option>
                  {employees.map((e, idx) => {
                    const id = e.manpowerId || e.internalEmployeeId || (e as any)._id || `emp-${idx}`;
                    const val = e.manpowerId || e.internalEmployeeId || (e as any)._id || "";
                    return (
                      <option key={id} value={val}>
                        {e.name} ({e.employeeId})
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Helpers */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">
                  <Users size={12} /> Helpers (optional)
                </label>
                <div className="bg-gray-50 rounded-xl border border-gray-200 p-3 space-y-2 max-h-36 overflow-y-auto">
                  {employees.map((e, idx) => {
                    const val = e.manpowerId || e.internalEmployeeId || (e as any)._id || "";
                    const keyId = val || `emp-${idx}`;
                    const isHelper = (form.helpers as string[] || []).includes(val);
                    const isOperator = form.operator === val;
                    return (
                      <label key={keyId} className={`flex items-center gap-2 cursor-pointer ${isOperator ? "opacity-40 pointer-events-none" : ""}`}>
                        <input type="checkbox" checked={isHelper} disabled={isOperator}
                          onChange={() => {
                            const cur = (form.helpers as string[] || []);
                            setForm({ ...form, helpers: isHelper ? cur.filter(h => h !== val) : [...cur, val] });
                          }}
                          className="rounded text-indigo-600 focus:ring-indigo-500" />
                        <span className="text-sm text-gray-700">{e.name} <span className="text-xs text-gray-400">({e.employeeId})</span></span>
                      </label>
                    );
                  })}
                  {employees.length === 0 && <p className="text-xs text-gray-400 text-center">No employees found</p>}
                </div>
              </div>

              {/* Process */}
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider block">Process / Operation</label>
                <select value={form.process as string || ""} onChange={e => {
                  const p = processes.find(x => x._id === e.target.value);
                  setForm({ ...form, process: e.target.value, processName: p?.processName });
                }} className="w-full border border-gray-200 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 bg-gray-50">
                  <option value="">Select Process</option>
                  {processes.map(p => <option key={p._id} value={p._id}>{p.processName}</option>)}
                </select>
              </div>

              {/* Job Assignment */}
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider block">Link to Job (optional)</label>
                <select value={form.job as string || ""} onChange={e => setForm({ ...form, job: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 bg-gray-50">
                  <option value="">No Job / Free Task</option>
                  {jobs.map(j => <option key={j._id} value={j._id}>{j.jobNumber}{j.partName ? ` · ${j.partName}` : ""}</option>)}
                </select>
              </div>

              {/* Free-text task if no job */}
              {!form.job && (
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider block">Task Description</label>
                  <input type="text" value={form.jobDetail || ""} onChange={e => setForm({ ...form, jobDetail: e.target.value })}
                    placeholder="e.g. Rough turning – batch 50 pieces"
                    className="w-full border border-gray-200 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 bg-gray-50" />
                </div>
              )}

              {/* Target Qty & Custom Time */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider block">Target Qty</label>
                  <input type="number" value={form.targetQuantity || ""} onChange={e => setForm({ ...form, targetQuantity: parseInt(e.target.value) || undefined })}
                    className="w-full border border-gray-200 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-indigo-400 bg-gray-50" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider block">Start</label>
                  <input type="time" value={form.startTime || ""} onChange={e => setForm({ ...form, startTime: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-indigo-400 bg-gray-50" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider block">End</label>
                  <input type="time" value={form.endTime || ""} onChange={e => setForm({ ...form, endTime: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-indigo-400 bg-gray-50" />
                </div>
              </div>

              {/* Status (only for edit) */}
              {editingAssignment && (
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider block">Status</label>
                  <div className="flex gap-2 flex-wrap">
                    {(["Planned", "InProgress", "Completed", "Cancelled"] as const).map(s => (
                      <button type="button" key={s} onClick={() => setForm({ ...form, status: s })}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${form.status === s ? STATUS_COLORS[s] + " border-current shadow-sm" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Remarks */}
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider block">Remarks</label>
                <textarea rows={2} value={form.remarks || ""} onChange={e => setForm({ ...form, remarks: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-indigo-400 bg-gray-50 resize-none" />
              </div>

              {/* Footer */}
              <div className="flex gap-2 pt-2 border-t border-gray-100">
                {editingAssignment && (
                  <button type="button" onClick={handleDelete} disabled={submitting}
                    className="px-4 py-2.5 text-sm font-semibold text-red-600 bg-red-50 rounded-xl hover:bg-red-100 transition-colors">
                    Remove
                  </button>
                )}
                <button type="button" onClick={() => setShowModal(false)} className="ml-auto px-4 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={submitting}
                  className="px-6 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-60 flex items-center gap-2">
                  {submitting ? <><LoadingSpinner size="sm" color="white" /> Saving...</> : (editingAssignment ? "Update" : "Assign Shift")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

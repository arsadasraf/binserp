"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Check,
  Clock,
  Calendar,
  AlertCircle,
  Save,
  CheckCircle,
  Sparkles,
  Zap,
  UserCheck,
} from "lucide-react";
import axios from "axios";
import { API_BASE_URL } from "@/src/utils/config";
import LoadingSpinner from "@/src/components/LoadingSpinner";
import { formatWorkDuration } from "@/src/utils/attendanceUtils";

interface MonthlyAttendanceValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeId: string | null;
  month: string;
  year: number;
  onSaved?: () => void;
  onGenerateSalary?: (employeeId: string) => void;
}

export default function MonthlyAttendanceValidationModal({
  isOpen,
  onClose,
  employeeId,
  month,
  year,
  onSaved,
  onGenerateSalary,
}: MonthlyAttendanceValidationModalProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<any>(null);
  const [days, setDays] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen && employeeId) {
      fetchMonthlyData();
    } else {
      setData(null);
      setDays([]);
    }
  }, [isOpen, employeeId, month, year]);

  const fetchMonthlyData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(
        `${API_BASE_URL}/api/hr/attendance-validation/monthly`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: { employeeId, month, year },
        }
      );
      if (res.data?.success) {
        setData(res.data);
        setDays(res.data.days || []);
      }
    } catch (err) {
      console.error("Error fetching monthly attendance validation:", err);
    } finally {
      setLoading(false);
    }
  };

  const emp = data?.employee;
  const isOT = Boolean(emp?.isOTApplicable);

  const formatPunchTime = (timeStr?: string | Date) => {
    if (!timeStr) return "-";
    try {
      const d = new Date(timeStr);
      if (isNaN(d.getTime())) return "-";
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
    } catch {
      return "-";
    }
  };

  const getDailyOtHours = (hours: number, dayName: string, isHoliday: boolean) => {
    if (!emp?.isOTApplicable) return 0;
    const standardHours = emp?.standardWorkingHours || 9;
    const weeklyOff = Array.isArray(emp?.weeklyOff) ? emp.weeklyOff : [emp?.weeklyOff || "Sunday"];
    const holidayWorkPolicy = emp?.holidayWorkPolicy || "Overtime";
    const weekOffWorkPolicy = emp?.weekOffWorkPolicy || "Overtime";

    const daysMap: Record<string, string> = {
      Sun: "Sunday",
      Mon: "Monday",
      Tue: "Tuesday",
      Wed: "Wednesday",
      Thu: "Thursday",
      Fri: "Friday",
      Sat: "Saturday",
    };
    const fullDayName = daysMap[dayName] || dayName;
    const isWeeklyOff = weeklyOff.includes(fullDayName);

    if (isWeeklyOff) {
      return weekOffWorkPolicy === "Overtime" ? Number(hours.toFixed(2)) : 0;
    }
    if (isHoliday) {
      return holidayWorkPolicy === "Overtime" ? Number(hours.toFixed(2)) : 0;
    }
    return Math.max(0, Number((hours - standardHours).toFixed(2)));
  };

  const updateDayField = (index: number, field: string, value: any) => {
    const updated = [...days];
    const item = { ...updated[index], [field]: value };

    const standardHours = emp?.standardWorkingHours || 9;

    if (field === "status") {
      if (value === "Present" && (item.dutyHours === 0 || !item.dutyHours)) {
        item.dutyHours = standardHours;
      } else if (value === "HalfDay" && (item.dutyHours === 0 || !item.dutyHours)) {
        item.dutyHours = standardHours / 2;
      } else if (["Absent", "Holiday", "WeeklyOff", "CL", "SL", "CompOff"].includes(value)) {
        item.dutyHours = 0;
      }
    }

    if (field === "dutyHours" || field === "status") {
      item.otHours = getDailyOtHours(
        Number(item.dutyHours) || 0,
        item.dayName,
        item.status === "Holiday" || item.isHoliday
      );
    }

    updated[index] = item;
    setDays(updated);
  };

  // Quick Action: Autofill all unvalidated days with raw punch values
  const handleAutofillRaw = () => {
    const updated = days.map((day) => {
      const rawIn = day.rawAttendance?.checkIn;
      const rawOut = day.rawAttendance?.checkOut;
      let status = day.status;
      let dutyHours = day.dutyHours;

      if (!day.isValidated) {
        if (rawIn) {
          status = day.rawAttendance?.status || "Present";
          dutyHours = day.rawAttendance?.hoursWorked || emp?.standardWorkingHours || 9;
        } else if (day.isHoliday) {
          status = "Holiday";
          dutyHours = 0;
        } else if (day.isWeeklyOff) {
          status = "WeeklyOff";
          dutyHours = 0;
        } else {
          status = "Absent";
          dutyHours = 0;
        }
      }

      const ot = getDailyOtHours(dutyHours, day.dayName, status === "Holiday" || day.isHoliday);

      return {
        ...day,
        status,
        checkIn: day.checkIn || rawIn || null,
        checkOut: day.checkOut || rawOut || null,
        dutyHours,
        otHours: ot,
        isValidated: true,
      };
    });
    setDays(updated);
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${API_BASE_URL}/api/hr/attendance-validation/monthly`,
        {
          employeeId,
          month,
          year,
          days: days.map((d) => ({
            date: d.date,
            day: d.day,
            dayName: d.dayName,
            rawAttendance: d.rawAttendance,
            status: d.status,
            checkIn: d.checkIn,
            checkOut: d.checkOut,
            dutyHours: Number(d.dutyHours) || 0,
            otHours: Number(d.otHours) || 0,
            remarks: d.remarks || "",
          })),
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (onSaved) onSaved();
      onClose();
    } catch (err: any) {
      console.error("Error saving monthly validation:", err);
      alert(err.response?.data?.message || "Failed to save monthly validation.");
    } finally {
      setSaving(false);
    }
  };

  // Recalculate summary metrics from current state
  const computedSummary = React.useMemo(() => {
    let worked = 0;
    let payable = 0;
    let absent = 0;
    let totalDuty = 0;
    let totalOt = 0;
    let validatedCount = 0;

    days.forEach((d) => {
      if (d.isValidated) validatedCount++;
      totalDuty += Number(d.dutyHours) || 0;
      totalOt += Number(d.otHours) || 0;

      if (["Present", "HalfDay"].includes(d.status)) {
        const factor = d.status === "HalfDay" ? 0.5 : 1;
        worked += factor;
        payable += factor;
      } else if (["WeeklyOff", "Holiday", "CL", "SL", "CompOff", "OnDuty"].includes(d.status)) {
        payable += 1;
      } else if (d.status === "Absent") {
        absent += 1;
      }
    });

    return {
      worked,
      payable,
      absent,
      totalDuty: Number(totalDuty.toFixed(2)),
      totalOt: Number(totalOt.toFixed(2)),
      validatedCount,
      totalDays: days.length,
      isFullyValidated: validatedCount === days.length && days.length > 0,
    };
  }, [days]);

  if (!isOpen || !employeeId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700 flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold shadow-sm">
              <Calendar size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                Monthly Attendance Validation Preview
                <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                  {month} {year}
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Employee:{" "}
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {emp?.name || "Loading..."}
                </span>{" "}
                ({emp?.employeeId}) &bull; {emp?.department || "General"} &bull;{" "}
                {emp?.designation || "Staff"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleAutofillRaw}
              className="px-3 py-1.5 rounded-xl border border-blue-200 text-blue-600 bg-blue-50/50 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-400 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              title="Autofill unvalidated days with raw biometric/kiosk punches"
            >
              <Sparkles size={14} /> Auto-fill from Punches
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Summary Metric Ribbon */}
        <div className="px-6 py-2.5 bg-slate-100/70 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <span className="text-slate-500 dark:text-slate-400">Month Days: </span>
              <span className="font-bold text-slate-800 dark:text-white">{computedSummary.totalDays}</span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">Validated: </span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {computedSummary.validatedCount} / {computedSummary.totalDays}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">Payable Days: </span>
              <span className="font-bold text-blue-600 dark:text-blue-400">{computedSummary.payable}</span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">Worked: </span>
              <span className="font-bold text-slate-700 dark:text-slate-200">{computedSummary.worked}</span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">Absent: </span>
              <span className="font-bold text-rose-600 dark:text-rose-400">{computedSummary.absent}</span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">Duty Hours: </span>
              <span className="font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                {computedSummary.totalDuty}h
              </span>
            </div>
            {isOT && (
              <div>
                <span className="text-slate-500 dark:text-slate-400">OT Hours: </span>
                <span className="font-bold text-purple-600 dark:text-purple-400 font-mono">
                  +{computedSummary.totalOt}h
                </span>
              </div>
            )}
          </div>

          <div>
            {computedSummary.isFullyValidated ? (
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 flex items-center gap-1">
                <CheckCircle size={13} /> 100% Validated
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 flex items-center gap-1">
                <AlertCircle size={13} /> {computedSummary.totalDays - computedSummary.validatedCount} Days Pending
              </span>
            )}
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {loading ? (
            <div className="py-20 text-center">
              <LoadingSpinner />
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Loading employee working days preview...
              </p>
            </div>
          ) : days.length === 0 ? (
            <div className="py-20 text-center text-slate-500 dark:text-slate-400 text-sm">
              No daily logs available.
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase text-[10.5px] font-semibold sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-3 py-2.5">Date & Day</th>
                  <th className="px-3 py-2.5">Raw Kiosk Punch</th>
                  <th className="px-3 py-2.5">Raw Status</th>
                  <th className="px-3 py-2.5">Validated Status</th>
                  <th className="px-3 py-2.5">Duty Hours</th>
                  {isOT && <th className="px-3 py-2.5">OT Hours</th>}
                  <th className="px-3 py-2.5">Remarks / Reason</th>
                  <th className="px-3 py-2.5 min-w-[130px]">Validated By</th>
                  <th className="px-3 py-2.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {days.map((day, idx) => {
                  const isOff = day.isWeeklyOff || day.dayName === "Sun";
                  const isHol = day.isHoliday;
                  const rawIn = day.rawAttendance?.checkIn;
                  const rawOut = day.rawAttendance?.checkOut;

                  return (
                    <tr
                      key={day.date}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                        isOff
                          ? "bg-slate-50/60 dark:bg-slate-900/40"
                          : isHol
                          ? "bg-purple-50/30 dark:bg-purple-950/10"
                          : ""
                      }`}
                    >
                      {/* Date & Day */}
                      <td className="px-3 py-2 font-mono whitespace-nowrap">
                        <div className="font-bold text-slate-800 dark:text-slate-200">
                          {day.date}
                        </div>
                        <div
                          className={`text-[10px] font-semibold ${
                            isOff ? "text-rose-500" : isHol ? "text-purple-600" : "text-slate-400"
                          }`}
                        >
                          {day.dayName} {isHol && `• ${day.holidayName || "Holiday"}`}
                        </div>
                      </td>

                      {/* Raw Kiosk Punch */}
                      <td className="px-3 py-2 font-mono text-[11px]">
                        {rawIn ? (
                          <div className="space-y-0.5">
                            <span className="text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                              {formatPunchTime(rawIn)}
                            </span>
                            <span className="text-slate-400 mx-1">&rarr;</span>
                            <span className="text-rose-700 dark:text-rose-400 font-bold bg-rose-50 dark:bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-800">
                              {formatPunchTime(rawOut)}
                            </span>
                            <span className="text-slate-400 ml-1">
                              ({(day.rawAttendance?.hoursWorked || 0).toFixed(1)}h)
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">No Kiosk Punch</span>
                        )}
                      </td>

                      {/* Raw Status */}
                      <td className="px-3 py-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            day.rawAttendance?.status === "Present"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                              : day.rawAttendance?.status === "HalfDay"
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                              : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                          }`}
                        >
                          {day.rawAttendance?.status || (isOff ? "Weekly Off" : isHol ? "Holiday" : "Absent")}
                        </span>
                      </td>

                      {/* Validated Status Dropdown */}
                      <td className="px-3 py-2">
                        <select
                          value={day.status}
                          onChange={(e) => updateDayField(idx, "status", e.target.value)}
                          className="px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-slate-200"
                        >
                          <option value="Present">Present</option>
                          <option value="Absent">Absent</option>
                          <option value="HalfDay">Half Day</option>
                          <option value="WeeklyOff">Weekly Off</option>
                          <option value="Holiday">Holiday</option>
                          <option value="CL">Casual Leave (CL)</option>
                          <option value="SL">Sick Leave (SL)</option>
                          <option value="CompOff">Comp Off (CO)</option>
                          <option value="OnDuty">On Duty (OD)</option>
                        </select>
                      </td>

                      {/* Duty Hours */}
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="24"
                          value={day.dutyHours}
                          onChange={(e) => updateDayField(idx, "dutyHours", parseFloat(e.target.value) || 0)}
                          className="w-16 px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>

                      {/* OT Hours */}
                      {isOT && (
                        <td className="px-3 py-2 font-mono">
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            max="24"
                            value={day.otHours || 0}
                            onChange={(e) => updateDayField(idx, "otHours", parseFloat(e.target.value) || 0)}
                            className="w-16 px-2 py-1 rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300 text-xs font-mono font-bold outline-none focus:ring-1 focus:ring-purple-500"
                          />
                        </td>
                      )}

                      {/* Remarks */}
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          placeholder="e.g. Approved by HR..."
                          value={day.remarks || ""}
                          onChange={(e) => updateDayField(idx, "remarks", e.target.value)}
                          className="w-full px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>

                      {/* Validated By Username & Timestamp */}
                      <td className="px-3 py-2 whitespace-nowrap">
                        {day.isValidated ? (
                          <div className="flex flex-col">
                            <span className="font-semibold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                              <UserCheck size={12} className="text-emerald-600 dark:text-emerald-400" />
                              {day.validatedByUsername || "Admin"}
                            </span>
                            {day.validatedAt && (
                              <span className="text-[9.5px] text-slate-400 mt-0.5">
                                {new Date(day.validatedAt).toLocaleDateString([], { day: "2-digit", month: "short" })}{" "}
                                {new Date(day.validatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic font-medium">-</span>
                        )}
                      </td>

                      {/* Validated Indicator */}
                      <td className="px-3 py-2 text-center">
                        {day.isValidated ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                            <Check size={13} /> Validated
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                            Pending
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/90 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={saving}
              className="px-5 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {saving ? <LoadingSpinner /> : <Save size={15} />}
              Save & Validate Month
            </button>

            {onGenerateSalary && computedSummary.isFullyValidated && (
              <button
                type="button"
                onClick={async () => {
                  await handleSaveAll();
                  if (employeeId) onGenerateSalary(employeeId);
                }}
                disabled={saving}
                className="px-5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/20 flex items-center gap-2 transition-all disabled:opacity-50"
              >
                <CheckCircle size={15} />
                Validate & Generate Salary
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { API_BASE_URL } from "@/src/utils/config";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Calendar,
  Briefcase,
  Clock,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Filter,
  CalendarDays,
} from "lucide-react";
import ErrorAlert from "@/src/components/ErrorAlert";
import { formatWorkDuration, getWorkDurationMinutes } from "@/src/utils/attendanceUtils";

interface EmployeeData {
  employee: {
    name: string;
    designation: string;
    department: string;
    joiningDate: string;
    employeeId?: string;
    photo?: string;
    weeklyOff?: string | string[];
  };
  attendance: any[];
  holidays?: any[];
  assignedJobs: any[];
  employeeJobs?: any[];
  salarySlips: any[];
  roster?: any[];
}

export default function EmployeeDashboard() {
  const [data, setData] = useState<EmployeeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attendanceView, setAttendanceView] = useState<"month" | "day">("month");

  // Date selection states
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());
  const [selectedDayDate, setSelectedDayDate] = useState<string>(""); // YYYY-MM-DD for day selector

  const router = useRouter();
  const searchParams = useSearchParams();

  // Active tab from URL query params (default to 'work')
  const activeTab = (searchParams.get("tab") as "work" | "roster" | "attendance") || "work";

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async (monthParam?: string) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      const url = monthParam
        ? `${API_BASE_URL}/api/hr/dashboard/me?month=${monthParam}`
        : `${API_BASE_URL}/api/hr/dashboard/me`;

      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const dashboardData = response.data;

      // If fetching a specific older month, merge into existing data
      if (monthParam) {
        setData((prevData) => {
          if (!prevData) return dashboardData;
          const existingIds = new Set((prevData.attendance || []).map((a: any) => a._id?.toString()));
          const newRecords = (dashboardData.attendance || []).filter(
            (a: any) => !existingIds.has(a._id?.toString())
          );
          const mergedAttendance = [...(prevData.attendance || []), ...newRecords];

          const existingHolidayIds = new Set((prevData.holidays || []).map((h: any) => h._id?.toString()));
          const newHolidays = (dashboardData.holidays || []).filter(
            (h: any) => !existingHolidayIds.has(h._id?.toString())
          );
          const mergedHolidays = [...(prevData.holidays || []), ...newHolidays];

          return {
            ...prevData,
            attendance: mergedAttendance,
            holidays: mergedHolidays,
          };
        });
        return;
      }

      // Fetch Roster Data
      const empId = dashboardData.employee?._id || dashboardData._id;
      if (empId) {
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

        try {
          const rosterRes = await axios.get(`${API_BASE_URL}/api/ppc/allotment`, {
            headers: { Authorization: `Bearer ${token}` },
            params: {
              employee: empId,
              startDate: startOfMonth.toISOString(),
              endDate: endOfMonth.toISOString(),
            },
          });
          dashboardData.roster = rosterRes.data.allotments || [];
        } catch (rosterErr) {
          console.error("Failed to fetch roster", rosterErr);
        }
      }

      setData(dashboardData);
    } catch (err: any) {
      console.error("Dashboard Error:", err);
      if (err.response?.status === 401 || err.response?.status === 403) {
        localStorage.removeItem("token");
        router.push("/login");
      }
      setError("Failed to load dashboard data. " + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  // Quick 3 Months Options (Current Month, 1 Month Ago, 2 Months Ago)
  const quickMonths = useMemo(() => {
    const list = [];
    const now = new Date();
    for (let i = 0; i < 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mIdx = d.getMonth();
      const yr = d.getFullYear();
      const name = monthNames[mIdx];
      let label = `${name} ${yr}`;
      if (i === 0) label = `Current (${name.slice(0, 3)} ${yr})`;
      else if (i === 1) label = `Last (${name.slice(0, 3)} ${yr})`;
      else label = `${name.slice(0, 3)} ${yr}`;
      list.push({
        label,
        month: mIdx,
        year: yr,
      });
    }
    return list;
  }, []);

  const selectQuickMonth = (m: number, y: number) => {
    setSelectedMonth(m);
    setSelectedYear(y);
  };

  // On-demand fetch if selected month is outside the default 3-month window
  useEffect(() => {
    if (!data) return;
    const now = new Date();
    const currentMonthIdx = now.getFullYear() * 12 + now.getMonth();
    const selectedMonthIdx = selectedYear * 12 + selectedMonth;
    if (selectedMonthIdx < currentMonthIdx - 2 || selectedMonthIdx > currentMonthIdx) {
      const formatted = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}`;
      const hasDataForMonth = (data.attendance || []).some((rec: any) => {
        const d = new Date(rec.date);
        return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
      });
      if (!hasDataForMonth) {
        fetchDashboardData(formatted);
      }
    }
  }, [selectedMonth, selectedYear, data]);

  // Full Month Matrix (Days 1 to 28/30/31) with complete statuses: Present, Absent, Week Off, Holiday, Upcoming
  const fullMonthDays = useMemo(() => {
    if (!data) return [];
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();

    // Safe weekly-off checker (supports array e.g. ['Sunday'], string, or fallback)
    const isWeeklyOffDay = (dayOfWeekName: string): boolean => {
      const raw = data.employee?.weeklyOff;
      const target = dayOfWeekName.toLowerCase().trim();
      if (!raw) return target === "sunday";
      if (Array.isArray(raw)) {
        return raw.some((w: any) => typeof w === "string" && w.toLowerCase().trim() === target);
      }
      if (typeof raw === "string") {
        return raw
          .split(",")
          .map((s) => s.toLowerCase().trim())
          .includes(target);
      }
      return target === "sunday";
    };

    // Map attendance records by local YYYY-MM-DD
    const attMap = new Map<string, any>();
    (data.attendance || []).forEach((rec: any) => {
      if (!rec?.date) return;
      const d = new Date(rec.date);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const dt = String(d.getDate()).padStart(2, "0");
      attMap.set(`${y}-${m}-${dt}`, rec);
    });

    // Map holidays by local YYYY-MM-DD
    const holMap = new Map<string, string>();
    (data.holidays || []).forEach((h: any) => {
      if (!h?.date) return;
      const d = new Date(h.date);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const dt = String(d.getDate()).padStart(2, "0");
      holMap.set(`${y}-${m}-${dt}`, h.name || "Holiday");
    });

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    const days = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(selectedYear, selectedMonth, day);
      const dateKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const dayName = dateObj.toLocaleDateString("en-US", { weekday: "long" });
      const isWeeklyOff = isWeeklyOffDay(dayName);
      const isHoliday = holMap.has(dateKey);
      const holidayName = holMap.get(dateKey);
      const rec = attMap.get(dateKey);
      const isToday = dateKey === todayStr;
      const isFuture = dateKey > todayStr;

      let displayStatus: "Present" | "Half Day" | "Late" | "Absent" | "Week Off" | "Holiday" | "Upcoming" = "Absent";
      if (rec) {
        displayStatus = rec.status;
      } else if (isFuture) {
        displayStatus = "Upcoming";
      } else if (isHoliday) {
        displayStatus = "Holiday";
      } else if (isWeeklyOff) {
        displayStatus = "Week Off";
      } else {
        displayStatus = "Absent";
      }

      days.push({
        dayNumber: day,
        dateKey,
        dateObj,
        dayName,
        isWeeklyOff,
        isHoliday,
        holidayName,
        rec,
        isToday,
        isFuture,
        status: displayStatus,
      });
    }

    return days;
  }, [data, selectedMonth, selectedYear]);

  // Aggregate stats across the full month
  const monthlyStats = useMemo(() => {
    let presentCount = 0;
    let absentCount = 0;
    let halfDayCount = 0;
    let weekOffCount = 0;
    let holidayCount = 0;
    let totalMinutesWorked = 0;

    fullMonthDays.forEach((d) => {
      if (d.status === "Present") {
        presentCount++;
      } else if (d.status === "Absent") {
        absentCount++;
      } else if (d.status === "Half Day" || d.status === "Late") {
        halfDayCount++;
      } else if (d.status === "Week Off") {
        weekOffCount++;
      } else if (d.status === "Holiday") {
        holidayCount++;
      }

      if (d.rec) {
        totalMinutesWorked += getWorkDurationMinutes(d.rec);
      }
    });

    return {
      presentCount,
      absentCount,
      halfDayCount,
      weekOffCount,
      holidayCount,
      totalMinutesWorked,
    };
  }, [fullMonthDays]);

  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  const handleMonthInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      const [y, m] = e.target.value.split("-");
      setSelectedYear(parseInt(y, 10));
      setSelectedMonth(parseInt(m, 10) - 1);
    }
  };

  const formattedMonthInputVal = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}`;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!data) return null;

  const attendanceList = data.attendance || [];
  const filteredDailyAttendance = selectedDayDate
    ? attendanceList.filter((rec: any) => {
        const dStr = new Date(rec.date).toISOString().split("T")[0];
        return dStr === selectedDayDate;
      })
    : attendanceList;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950 font-sans text-gray-900 dark:text-gray-100 pb-24 sm:pb-12">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {error && (
          <div className="mb-6">
            <ErrorAlert message={error} onClose={() => setError("")} />
          </div>
        )}

        {/* 💻 Desktop Top Navigation Header */}
        <div className="hidden sm:block bg-white dark:bg-gray-900 p-2 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 mb-6">
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => router.push("/dashboard/employee?tab=work")}
              className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl font-extrabold text-sm transition-all ${
                activeTab === "work"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              <Briefcase className="h-4 w-4" />
              <span>Job / Work</span>
            </button>

            <button
              onClick={() => router.push("/dashboard/employee?tab=roster")}
              className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl font-extrabold text-sm transition-all ${
                activeTab === "roster"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              <Clock className="h-4 w-4" />
              <span>My Roster</span>
            </button>

            <button
              onClick={() => router.push("/dashboard/employee?tab=attendance")}
              className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl font-extrabold text-sm transition-all ${
                activeTab === "attendance"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              <Calendar className="h-4 w-4" />
              <span>Attendance</span>
            </button>
          </div>
        </div>

        {/* Dynamic Tab Content Area */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* ──────────────────────── TAB 1: JOB / TASKS ──────────────────────── */}
          {activeTab === "work" && (
            <div className="space-y-6">
              {data.employeeJobs && data.employeeJobs.length > 0 && (
                <div>
                  <h3 className="text-base font-extrabold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Briefcase size={18} className="text-indigo-600" /> Assigned Shop Floor Tasks
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {data.employeeJobs.map((job: any) => (
                      <div
                        key={job._id}
                        className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-5 hover:shadow-md transition-all relative overflow-hidden"
                      >
                        <div
                          className={`absolute top-0 left-0 w-1.5 h-full ${
                            job.priority === "Urgent"
                              ? "bg-red-500"
                              : job.priority === "High"
                              ? "bg-orange-500"
                              : job.priority === "Medium"
                              ? "bg-blue-500"
                              : "bg-gray-400"
                          }`}
                        />

                        <div className="flex justify-between items-start mb-3 pl-2">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              job.status === "Completed"
                                ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                                : job.status === "InProgress"
                                ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                                : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300"
                            }`}
                          >
                            {job.status}
                          </span>
                          <span className="text-xs text-gray-400 font-mono">
                            Due: {job.dueDate ? new Date(job.dueDate).toLocaleDateString() : "N/A"}
                          </span>
                        </div>

                        <h3 className="text-base font-extrabold text-gray-900 dark:text-white mb-1 pl-2">{job.title}</h3>
                        {job.description && (
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-4 pl-2 line-clamp-2">{job.description}</p>
                        )}

                        {job.status !== "Completed" && (
                          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex justify-end">
                            <button
                              className="text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-xl transition-all shadow-sm shadow-indigo-500/20"
                              onClick={async () => {
                                if (!confirm("Mark this job as completed?")) return;
                                try {
                                  const token = localStorage.getItem("token");
                                  await axios.put(
                                    `${API_BASE_URL}/api/hr/job/${job._id}/status`,
                                    { status: "Completed" },
                                    { headers: { Authorization: `Bearer ${token}` } }
                                  );
                                  fetchDashboardData();
                                } catch (err) {
                                  alert("Failed to update status");
                                }
                              }}
                            >
                              Mark Complete
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* PPC Work Jobs */}
              {data.assignedJobs && data.assignedJobs.length > 0 && !data.employeeJobs?.length && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {data.assignedJobs.map((job: any) => (
                    <div
                      key={job._id}
                      className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-5 hover:shadow-md transition-all"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            job.status === "Completed"
                              ? "bg-green-100 text-green-800"
                              : job.status === "InProgress"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {job.status}
                        </span>
                        <span className="text-xs text-gray-400 font-mono">{job.jobNumber}</span>
                      </div>
                      <h3 className="text-base font-extrabold text-gray-900 dark:text-white mb-1">{job.partName}</h3>
                      <p className="text-xs text-gray-500 mb-4">{job.customerName}</p>

                      <div className="space-y-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                        {job.myTasks && job.myTasks.length > 0 ? (
                          job.myTasks.map((task: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center text-xs">
                              <span className="text-gray-700 dark:text-gray-300 font-medium">{task.operationName}</span>
                              <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded font-bold">
                                {task.status}
                              </span>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-gray-400 italic">No specific personal tasks assigned.</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Empty Work State */}
              {!data.assignedJobs?.length && !data.employeeJobs?.length && (
                <div className="text-center py-16 bg-white dark:bg-gray-900 rounded-3xl border border-dashed border-gray-200 dark:border-gray-800">
                  <Briefcase className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                  <h3 className="text-base font-extrabold text-gray-900 dark:text-white">No Pending Work</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">You don't have any assigned jobs right now.</p>
                </div>
              )}
            </div>
          )}

          {/* ──────────────────────── TAB 2: MY ROSTER ──────────────────────── */}
          {activeTab === "roster" && (
            <div className="space-y-6">
              <h3 className="text-base font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                <Clock size={18} className="text-indigo-600" /> Shift Roster ({monthNames[selectedMonth]} {selectedYear})
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {data.roster && data.roster.length > 0 ? (
                  data.roster.map((slot: any) => {
                    const isToday = new Date(slot.date).toDateString() === new Date().toDateString();
                    return (
                      <div
                        key={slot._id}
                        className={`p-4 rounded-2xl border transition-all ${
                          isToday
                            ? "bg-indigo-50/80 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800 ring-2 ring-indigo-500/20"
                            : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800"
                        }`}
                      >
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-extrabold text-gray-900 dark:text-white">
                            {new Date(slot.date).toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" })}
                          </span>
                          {isToday && (
                            <span className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded-full font-black uppercase">
                              TODAY
                            </span>
                          )}
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-300">
                            <Clock size={14} className="text-indigo-500" />
                            <span>{slot.shift}</span>
                            {slot.shift === "Custom" && slot.startTime && (
                              <span className="text-[10px] text-gray-400">
                                ({slot.startTime} - {slot.endTime})
                              </span>
                            )}
                          </div>
                          {slot.machines && slot.machines.length > 0 && (
                            <div className="text-xs text-gray-600 dark:text-gray-400 pl-5">
                              {slot.machines.map((m: any) => m.machineName).join(", ")}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="col-span-full py-16 text-center bg-white dark:bg-gray-900 rounded-3xl border border-dashed border-gray-200 dark:border-gray-800">
                    <Calendar className="h-10 w-10 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                    <p className="text-xs text-gray-500 dark:text-gray-400">No shift roster assigned for this month.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ──────────────────────── TAB 3: ATTENDANCE (MONTH-WISE & DAY-WISE SELECTORS) ──────────────────────── */}
          {activeTab === "attendance" && (
            <div className="space-y-6">
              {/* Attendance View Switcher & Month Selectors */}
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-3">
                  <div className="flex bg-slate-100 dark:bg-gray-800 p-1 rounded-xl">
                    <button
                      onClick={() => setAttendanceView("month")}
                      className={`px-3 sm:px-4 py-2 rounded-lg text-xs font-extrabold transition-all ${
                        attendanceView === "month"
                          ? "bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                          : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
                      }`}
                    >
                      📅 Month-Wise View
                    </button>
                    <button
                      onClick={() => setAttendanceView("day")}
                      className={`px-3 sm:px-4 py-2 rounded-lg text-xs font-extrabold transition-all ${
                        attendanceView === "day"
                          ? "bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                          : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
                      }`}
                    >
                      📆 Day-Wise View
                    </button>
                  </div>
                </div>

                {/* Selective Month Picker (in Month View) */}
                {attendanceView === "month" && (
                  <div className="flex flex-wrap items-center gap-2 justify-between lg:justify-end">
                    {/* Quick 3 Months Pills */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {quickMonths.map((qm) => {
                        const isSelected = selectedMonth === qm.month && selectedYear === qm.year;
                        return (
                          <button
                            key={`${qm.year}-${qm.month}`}
                            type="button"
                            onClick={() => selectQuickMonth(qm.month, qm.year)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                              isSelected
                                ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/25 ring-2 ring-indigo-400"
                                : "bg-slate-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-gray-700"
                            }`}
                          >
                            <CalendarDays size={13} className={isSelected ? "text-white" : "text-gray-400"} />
                            <span>{qm.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex items-center gap-1.5 ml-auto sm:ml-0">
                      <button
                        onClick={handlePrevMonth}
                        className="p-2 rounded-xl bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
                        title="Previous Month"
                      >
                        <ChevronLeft size={16} />
                      </button>

                      <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-gray-800 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700">
                        <CalendarDays size={15} className="text-indigo-500" />
                        <input
                          type="month"
                          value={formattedMonthInputVal}
                          onChange={handleMonthInput}
                          className="bg-transparent text-xs font-extrabold text-gray-900 dark:text-white focus:outline-none cursor-pointer"
                        />
                      </div>

                      <button
                        onClick={handleNextMonth}
                        className="p-2 rounded-xl bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
                        title="Next Month"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                )}

                {/* Selective Day Picker (in Day View) */}
                {attendanceView === "day" && (
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                    <div className="flex items-center gap-2 bg-slate-50 dark:bg-gray-800 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700">
                      <Calendar size={16} className="text-indigo-500" />
                      <span className="text-xs font-bold text-gray-500 dark:text-gray-400">Select Day:</span>
                      <input
                        type="date"
                        value={selectedDayDate}
                        onChange={(e) => setSelectedDayDate(e.target.value)}
                        className="bg-transparent text-xs font-extrabold text-gray-900 dark:text-white focus:outline-none cursor-pointer"
                      />
                    </div>

                    {selectedDayDate && (
                      <button
                        onClick={() => setSelectedDayDate("")}
                        className="text-[10px] font-extrabold px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-300"
                      >
                        Reset Day
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* SUB-VIEW 1: MONTH-WISE SUMMARY */}
              {attendanceView === "month" && (
                <div className="space-y-6">
                  {/* Monthly Summary Cards (5-metric grid) */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
                    <div className="bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl p-4 text-white shadow-sm flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-100">Present</span>
                        <CheckCircle2 size={18} />
                      </div>
                      <div>
                        <p className="text-2xl font-black">{monthlyStats.presentCount} Days</p>
                        <p className="text-[11px] text-emerald-100 mt-0.5">Punch Recorded</p>
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-rose-500 to-red-600 rounded-2xl p-4 text-white shadow-sm flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-rose-100">Absent</span>
                        <XCircle size={18} />
                      </div>
                      <div>
                        <p className="text-2xl font-black">{monthlyStats.absentCount} Days</p>
                        <p className="text-[11px] text-rose-100 mt-0.5">Past Unpunched</p>
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-4 text-white shadow-sm flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-100">Late / Half Day</span>
                        <AlertCircle size={18} />
                      </div>
                      <div>
                        <p className="text-2xl font-black">{monthlyStats.halfDayCount} Days</p>
                        <p className="text-[11px] text-amber-100 mt-0.5">Partial Shift</p>
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-sky-500 to-blue-600 rounded-2xl p-4 text-white shadow-sm flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-sky-100">Week Off / Holiday</span>
                        <CalendarDays size={18} />
                      </div>
                      <div>
                        <p className="text-2xl font-black">{monthlyStats.weekOffCount + monthlyStats.holidayCount} Days</p>
                        <p className="text-[11px] text-sky-100 mt-0.5">
                          {monthlyStats.weekOffCount} Off • {monthlyStats.holidayCount} Holiday
                        </p>
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-4 text-white shadow-sm col-span-2 sm:col-span-1 flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-100">Total Hours</span>
                        <Clock size={18} />
                      </div>
                      <div>
                        <p className="text-2xl font-black">{formatWorkDuration(monthlyStats.totalMinutesWorked)}</p>
                        <p className="text-[11px] text-indigo-100 mt-0.5">Calculated Working Time</p>
                      </div>
                    </div>
                  </div>

                  {/* Monthly Calendar Table - All days of selected month */}
                  <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="font-extrabold text-xs text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                        <Calendar size={15} className="text-indigo-600" />
                        <span>
                          Monthly Attendance Matrix — {monthNames[selectedMonth]} {selectedYear} ({fullMonthDays.length} Days)
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-500 dark:text-gray-400">
                        Designated Weekly Off:{" "}
                        <span className="font-bold text-indigo-600 dark:text-indigo-400 capitalize">
                          {Array.isArray(data.employee?.weeklyOff)
                            ? data.employee.weeklyOff.join(", ")
                            : (data.employee?.weeklyOff || "Sunday")}
                        </span>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-gray-800/50 text-[10px] font-extrabold uppercase text-gray-400 border-b border-gray-100 dark:border-gray-800">
                            <th className="p-4">Day & Date</th>
                            <th className="p-4">Status</th>
                            <th className="p-4">In-Time</th>
                            <th className="p-4">Out-Time</th>
                            <th className="p-4 text-right">Hours Worked</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-xs">
                          {fullMonthDays.map((day) => {
                            const rec = day.rec;
                            return (
                              <tr
                                key={day.dateKey}
                                className={`transition-colors ${
                                  day.isToday
                                    ? "bg-indigo-50/60 dark:bg-indigo-950/30 font-medium"
                                    : day.isWeeklyOff
                                    ? "bg-slate-50/50 dark:bg-gray-900/30"
                                    : day.isHoliday
                                    ? "bg-purple-50/40 dark:bg-purple-950/20"
                                    : "hover:bg-slate-50 dark:hover:bg-gray-800/40"
                                }`}
                              >
                                <td className="p-4 font-bold text-gray-900 dark:text-white">
                                  <div className="flex items-center gap-2.5">
                                    <span
                                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-extrabold ${
                                        day.isToday
                                          ? "bg-indigo-600 text-white shadow-sm"
                                          : day.isWeeklyOff
                                          ? "bg-slate-200 dark:bg-gray-800 text-slate-700 dark:text-gray-300"
                                          : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                                      }`}
                                    >
                                      {day.dayNumber}
                                    </span>
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <span>
                                          {day.dateObj.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                                        </span>
                                        {day.isToday && (
                                          <span className="text-[9px] uppercase font-black px-1.5 py-0.5 rounded bg-indigo-600 text-white shadow-xs">
                                            Today
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-[10px] text-gray-400 font-normal">
                                        {day.dayName}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="p-4">
                                  {day.status === "Present" && (
                                    <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 border border-green-200 dark:border-green-800">
                                      Present
                                    </span>
                                  )}
                                  {day.status === "Absent" && (
                                    <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border border-red-200 dark:border-red-800">
                                      Absent
                                    </span>
                                  )}
                                  {(day.status === "Half Day" || day.status === "Late") && (
                                    <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                      {day.status}
                                    </span>
                                  )}
                                  {day.status === "Week Off" && (
                                    <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                      Week Off
                                    </span>
                                  )}
                                  {day.status === "Holiday" && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                      <span>🎉</span> {day.holidayName || "Holiday"}
                                    </span>
                                  )}
                                  {day.status === "Upcoming" && (
                                    <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500">
                                      Upcoming
                                    </span>
                                  )}
                                </td>
                                <td className="p-4 font-mono text-gray-600 dark:text-gray-300">
                                  {rec?.checkIn?.time ? (
                                    new Date(rec.checkIn.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                                  ) : (
                                    <span className="text-gray-400 text-xs">—</span>
                                  )}
                                </td>
                                <td className="p-4 font-mono text-gray-600 dark:text-gray-300">
                                  {rec?.checkOut?.time ? (
                                    new Date(rec.checkOut.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                                  ) : (
                                    <span className="text-gray-400 text-xs">—</span>
                                  )}
                                </td>
                                <td className="p-4 text-right font-extrabold text-gray-900 dark:text-white">
                                  {rec ? formatWorkDuration(rec) : <span className="text-gray-400 font-normal">—</span>}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* SUB-VIEW 2: DAY-WISE PUNCH LOGS */}
              {attendanceView === "day" && (
                <div className="space-y-4">
                  <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                      <h4 className="font-extrabold text-xs text-gray-900 dark:text-white uppercase tracking-wider">
                        {selectedDayDate
                          ? `Punch Logs for ${new Date(selectedDayDate).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" })}`
                          : "Daily Punch Logs & Entry History"}
                      </h4>
                      <span className="text-xs text-gray-400 font-medium">
                        Showing {filteredDailyAttendance.length} logs
                      </span>
                    </div>

                    <div className="divide-y divide-gray-100 dark:divide-gray-800">
                      {filteredDailyAttendance.length === 0 ? (
                        <div className="p-12 text-center text-gray-400 text-xs font-medium">
                          No punch logs found for the selected day.
                        </div>
                      ) : (
                        filteredDailyAttendance.map((rec) => (
                          <div
                            key={rec._id}
                            className="p-4 hover:bg-slate-50 dark:hover:bg-gray-800/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                                  rec.status === "Present"
                                    ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                                    : rec.status === "Absent"
                                    ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                                    : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300"
                                }`}
                              >
                                {new Date(rec.date).getDate()}
                              </div>
                              <div>
                                <p className="font-extrabold text-gray-900 dark:text-white text-sm">
                                  {new Date(rec.date).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" })}
                                </p>
                                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5">
                                  <span>In: {rec.checkIn?.time ? new Date(rec.checkIn.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-"}</span>
                                  <span>•</span>
                                  <span>Out: {rec.checkOut?.time ? new Date(rec.checkOut.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-"}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-2 sm:pt-0 border-gray-100 dark:border-gray-800">
                              <div className="text-left sm:text-right">
                                <p className="text-[10px] font-bold text-gray-400 uppercase">Hours Worked</p>
                                <p className="text-xs font-extrabold text-gray-900 dark:text-white">{formatWorkDuration(rec)}</p>
                              </div>
                              <span
                                className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                                  rec.status === "Present"
                                    ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                                    : rec.status === "Absent"
                                    ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
                                    : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300"
                                }`}
                              >
                                {rec.status}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </main>

      {/* 📱 FIXED MOBILE BOTTOM NAVIGATION BAR */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-gray-900/95 backdrop-blur-lg border-t border-gray-200 dark:border-gray-800 px-4 py-2.5 flex items-center justify-around shadow-2xl">
        <button
          onClick={() => router.push("/dashboard/employee?tab=work")}
          className={`flex flex-col items-center gap-1 transition-all ${
            activeTab === "work" ? "text-indigo-600 dark:text-indigo-400 font-extrabold scale-105" : "text-gray-400"
          }`}
        >
          <Briefcase className="h-5 w-5" />
          <span className="text-[10px] tracking-tight">Job / Work</span>
        </button>

        <button
          onClick={() => router.push("/dashboard/employee?tab=roster")}
          className={`flex flex-col items-center gap-1 transition-all ${
            activeTab === "roster" ? "text-indigo-600 dark:text-indigo-400 font-extrabold scale-105" : "text-gray-400"
          }`}
        >
          <Clock className="h-5 w-5" />
          <span className="text-[10px] tracking-tight">My Roster</span>
        </button>

        <button
          onClick={() => router.push("/dashboard/employee?tab=attendance")}
          className={`flex flex-col items-center gap-1 transition-all ${
            activeTab === "attendance" ? "text-indigo-600 dark:text-indigo-400 font-extrabold scale-105" : "text-gray-400"
          }`}
        >
          <Calendar className="h-5 w-5" />
          <span className="text-[10px] tracking-tight">Attendance</span>
        </button>
      </div>
    </div>
  );
}

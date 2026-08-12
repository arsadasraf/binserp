"use client";

import { useState, useEffect } from "react";
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

interface EmployeeData {
  employee: {
    name: string;
    designation: string;
    department: string;
    joiningDate: string;
    employeeId?: string;
    photo?: string;
  };
  attendance: any[];
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

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      const response = await axios.get(`${API_BASE_URL}/api/hr/dashboard/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const dashboardData = response.data;

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!data) return null;

  // Process Attendance Records
  const attendanceList = data.attendance || [];

  // Filter attendance for selected month & year
  const filteredMonthlyAttendance = attendanceList.filter((rec) => {
    const d = new Date(rec.date);
    return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
  });

  // Filter attendance for selected specific day if picked
  const filteredDailyAttendance = selectedDayDate
    ? attendanceList.filter((rec) => {
        const dStr = new Date(rec.date).toISOString().split("T")[0];
        return dStr === selectedDayDate;
      })
    : attendanceList;

  const presentCount = filteredMonthlyAttendance.filter((r) => r.status === "Present").length;
  const absentCount = filteredMonthlyAttendance.filter((r) => r.status === "Absent").length;
  const halfDayCount = filteredMonthlyAttendance.filter((r) => r.status === "Half Day" || r.status === "Late").length;
  const totalHours = filteredMonthlyAttendance.reduce((acc, r) => acc + (parseFloat(r.hoursWorked) || 0), 0);

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

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
              {/* Attendance View Switcher */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800">
                <div className="flex bg-slate-100 dark:bg-gray-800 p-1 rounded-xl w-full sm:w-auto">
                  <button
                    onClick={() => setAttendanceView("month")}
                    className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-extrabold transition-all ${
                      attendanceView === "month"
                        ? "bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                        : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
                    }`}
                  >
                    📅 Month-Wise View
                  </button>
                  <button
                    onClick={() => setAttendanceView("day")}
                    className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-extrabold transition-all ${
                      attendanceView === "day"
                        ? "bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                        : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
                    }`}
                  >
                    📆 Day-Wise View
                  </button>
                </div>

                {/* Selective Month Picker (in Month View) */}
                {attendanceView === "month" && (
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                    <button
                      onClick={handlePrevMonth}
                      className="p-2 rounded-xl bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
                    >
                      <ChevronLeft size={16} />
                    </button>

                    <div className="flex items-center gap-2 bg-slate-50 dark:bg-gray-800 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700">
                      <CalendarDays size={16} className="text-indigo-500" />
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
                    >
                      <ChevronRight size={16} />
                    </button>
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
                  {/* Monthly Summary Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl p-4 text-white shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-100">Present</span>
                        <CheckCircle2 size={18} />
                      </div>
                      <p className="text-2xl font-black">{presentCount} Days</p>
                    </div>

                    <div className="bg-gradient-to-br from-rose-500 to-red-600 rounded-2xl p-4 text-white shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-rose-100">Absent</span>
                        <XCircle size={18} />
                      </div>
                      <p className="text-2xl font-black">{absentCount} Days</p>
                    </div>

                    <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-4 text-white shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-100">Late / Half Day</span>
                        <AlertCircle size={18} />
                      </div>
                      <p className="text-2xl font-black">{halfDayCount} Days</p>
                    </div>

                    <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-4 text-white shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-100">Total Hours</span>
                        <Clock size={18} />
                      </div>
                      <p className="text-2xl font-black">{totalHours.toFixed(1)} hrs</p>
                    </div>
                  </div>

                  {/* Monthly Calendar Table */}
                  <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-gray-100 dark:border-gray-800 font-extrabold text-xs text-gray-900 dark:text-white uppercase tracking-wider">
                      Monthly Summary Grid ({monthNames[selectedMonth]} {selectedYear})
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-gray-800/50 text-[10px] font-extrabold uppercase text-gray-400 border-b border-gray-100 dark:border-gray-800">
                            <th className="p-4">Date</th>
                            <th className="p-4">Status</th>
                            <th className="p-4">In-Time</th>
                            <th className="p-4">Out-Time</th>
                            <th className="p-4 text-right">Hours Worked</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-xs">
                          {filteredMonthlyAttendance.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="p-8 text-center text-gray-400 font-medium">
                                No attendance records found for {monthNames[selectedMonth]} {selectedYear}.
                              </td>
                            </tr>
                          ) : (
                            filteredMonthlyAttendance.map((rec) => (
                              <tr key={rec._id} className="hover:bg-slate-50 dark:hover:bg-gray-800/40 transition-colors">
                                <td className="p-4 font-extrabold text-gray-900 dark:text-white">
                                  {new Date(rec.date).toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" })}
                                </td>
                                <td className="p-4">
                                  <span
                                    className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                                      rec.status === "Present"
                                        ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                                        : rec.status === "Absent"
                                        ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
                                        : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300"
                                    }`}
                                  >
                                    {rec.status}
                                  </span>
                                </td>
                                <td className="p-4 font-mono text-gray-600 dark:text-gray-300">
                                  {rec.checkIn?.time ? new Date(rec.checkIn.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-"}
                                </td>
                                <td className="p-4 font-mono text-gray-600 dark:text-gray-300">
                                  {rec.checkOut?.time ? new Date(rec.checkOut.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-"}
                                </td>
                                <td className="p-4 text-right font-extrabold text-gray-900 dark:text-white">
                                  {rec.hoursWorked || "-"}
                                </td>
                              </tr>
                            ))
                          )}
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
                                <p className="text-xs font-extrabold text-gray-900 dark:text-white">{rec.hoursWorked || "-"} hrs</p>
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

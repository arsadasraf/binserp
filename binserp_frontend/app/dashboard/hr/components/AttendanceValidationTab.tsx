"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Calendar,
  CheckCircle,
  AlertCircle,
  Save,
  Search,
  Filter,
  RefreshCw,
  Clock,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  Eye,
  EyeOff,
  CheckSquare,
  Square,
  Users,
  Briefcase,
  Layers,
  X,
} from "lucide-react";
import axios from "axios";
import { API_BASE_URL } from "@/src/utils/config";
import LoadingSpinner from "@/src/components/LoadingSpinner";
import MonthlyAttendanceValidationModal from "./modals/MonthlyAttendanceValidationModal";
import ExcelColumnFilter from "./ExcelColumnFilter";

const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

interface AttendanceValidationTabProps {
  initialMonth?: string;
  initialYear?: number;
  onViewSavedSalaries?: () => void;
  onSalaryGenerated?: () => void;
  onOpenBulkGenerate?: (employeeIds?: string[]) => void;
  onNavigateToSalaryCalculation?: (employeeId?: string) => void;
}

export default function AttendanceValidationTab({
  initialMonth,
  initialYear,
  onViewSavedSalaries,
  onSalaryGenerated,
  onOpenBulkGenerate,
  onNavigateToSalaryCalculation,
}: AttendanceValidationTabProps) {
  // Navigation: "daily" (End of Day) | "monthly" (Month Preview)
  const [viewMode, setViewMode] = useState<"daily" | "monthly">("daily");

  // Date selection for Daily Mode (Defaults to today in YYYY-MM-DD)
  const getTodayStr = () => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const [selectedDate, setSelectedDate] = useState<string>(getTodayStr());

  // Period selection for Monthly Mode
  const [selectedMonth, setSelectedMonth] = useState<string>(
    initialMonth || months[new Date().getMonth()]
  );
  const [selectedYear, setSelectedYear] = useState<number>(
    initialYear || new Date().getFullYear()
  );

  // Daily Mode State
  const [dailyData, setDailyData] = useState<any[]>([]);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [dailySaving, setDailySaving] = useState(false);
  const [savingRowId, setSavingRowId] = useState<string | null>(null);
  const [dailySummary, setDailySummary] = useState<any>(null);

  // Monthly Summary State
  const [monthlySummaries, setMonthlySummaries] = useState<any[]>([]);
  const [monthlyLoading, setMonthlyLoading] = useState(false);

  // Filters & Excel Column Filters
  const [searchTerm, setSearchTerm] = useState("");

  // Daily Excel Column Filters State
  const [colFilterDailyEmployee, setColFilterDailyEmployee] = useState<string[]>([]);
  const [colFilterDailyDept, setColFilterDailyDept] = useState<string[]>([]);
  const [colFilterDailyType, setColFilterDailyType] = useState<string[]>([]);
  const [colFilterDailyStatus, setColFilterDailyStatus] = useState<string[]>([]);
  const [colFilterDailyValidation, setColFilterDailyValidation] = useState<string[]>([]);
  const [dailySortConfig, setDailySortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);

  // Monthly Excel Column Filters State
  const [colFilterMonthlyEmployee, setColFilterMonthlyEmployee] = useState<string[]>([]);
  const [colFilterMonthlyDept, setColFilterMonthlyDept] = useState<string[]>([]);
  const [colFilterMonthlyType, setColFilterMonthlyType] = useState<string[]>([]);
  const [colFilterMonthlyProgress, setColFilterMonthlyProgress] = useState<string[]>([]);
  const [monthlySortConfig, setMonthlySortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);

  // User Requirement: Hide day-wise selector and KPI dashboard by default
  const [showDaySelector, setShowDaySelector] = useState(false);
  const [showDailyDashboard, setShowDailyDashboard] = useState(false);

  // Selection for bulk action in Daily View
  const [selectedEmpIds, setSelectedEmpIds] = useState<string[]>([]);

  // Monthly Preview Modal
  const [previewEmployeeId, setPreviewEmployeeId] = useState<string | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  // Number of days in the month of selectedDate
  const daysInCurrentMonth = useMemo(() => {
    if (!selectedDate) return 30;
    const parts = selectedDate.split("-");
    if (parts.length < 2) return 30;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    return new Date(y, m, 0).getDate();
  }, [selectedDate]);

  // ==================== FETCH DAILY DATA ====================
  const fetchDailyAttendance = async () => {
    setDailyLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(
        `${API_BASE_URL}/api/hr/attendance-validation/daily`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: { date: selectedDate },
        }
      );

      if (res.data?.success) {
        setDailyData(res.data.items || []);
        setDailySummary(res.data.summary || null);
        setSelectedEmpIds([]);
      }
    } catch (err) {
      console.error("Error fetching daily validation attendance:", err);
    } finally {
      setDailyLoading(false);
    }
  };

  // ==================== FETCH MONTHLY SUMMARIES ====================
  const fetchMonthlySummaries = async () => {
    setMonthlyLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(
        `${API_BASE_URL}/api/hr/attendance-validation/month-summary`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: { month: selectedMonth, year: selectedYear },
        }
      );

      if (res.data?.success) {
        setMonthlySummaries(res.data.summaries || []);
      }
    } catch (err) {
      console.error("Error fetching monthly validation summaries:", err);
    } finally {
      setMonthlyLoading(false);
    }
  };

  useEffect(() => {
    if (viewMode === "daily") {
      fetchDailyAttendance();
    } else {
      fetchMonthlySummaries();
    }
  }, [viewMode, selectedDate, selectedMonth, selectedYear]);

  // Date Shift Helpers
  const shiftDay = (daysOffset: number) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + daysOffset);
    const yyyy = current.getFullYear();
    const mm = String(current.getMonth() + 1).padStart(2, "0");
    const dd = String(current.getDate()).padStart(2, "0");
    setSelectedDate(`${yyyy}-${mm}-${dd}`);
  };

  const setQuickDate = (which: "today" | "yesterday") => {
    const now = new Date();
    if (which === "yesterday") now.setDate(now.getDate() - 1);
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    setSelectedDate(`${yyyy}-${mm}-${dd}`);
  };

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

  // ==================== DAILY ROW MODIFICATIONS ====================
  const updateDailyField = (empId: string, field: string, value: any) => {
    setDailyData((prev) =>
      prev.map((row) => {
        if (row.employee._id !== empId) return row;

        const updatedVal = { ...row.validated, [field]: value };
        const stdHours = row.employee.standardWorkingHours || 9;

        if (field === "status") {
          if (value === "Present" && (!updatedVal.dutyHours || updatedVal.dutyHours === 0)) {
            updatedVal.dutyHours = stdHours;
          } else if (value === "HalfDay" && (!updatedVal.dutyHours || updatedVal.dutyHours === 0)) {
            updatedVal.dutyHours = stdHours / 2;
          } else if (["Absent", "Holiday", "WeeklyOff", "CL", "SL", "CompOff"].includes(value)) {
            updatedVal.dutyHours = 0;
          }
        }

        // Recompute OT
        if (row.employee.isOTApplicable && (field === "dutyHours" || field === "status")) {
          const isOffOrHol = updatedVal.status === "Holiday" || row.isHoliday || row.isWeeklyOff;
          const h = Number(updatedVal.dutyHours) || 0;
          if (isOffOrHol) {
            updatedVal.otHours = h;
          } else {
            updatedVal.otHours = Math.max(0, Number((h - stdHours).toFixed(2)));
          }
        }

        return {
          ...row,
          validated: updatedVal,
        };
      })
    );
  };

  // Auto-fill unvalidated rows with raw kiosk punches
  const handleAutofillRawDaily = () => {
    setDailyData((prev) =>
      prev.map((row) => {
        if (row.isValidated) return row;

        const rawIn = row.rawAttendance?.checkIn;
        const rawOut = row.rawAttendance?.checkOut;
        let status = "Absent";
        let dutyHours = 0;

        if (rawIn) {
          status = row.rawAttendance?.status || "Present";
          dutyHours = row.rawAttendance?.hoursWorked || row.employee.standardWorkingHours || 9;
        } else if (row.isHoliday) {
          status = "Holiday";
          dutyHours = 0;
        } else if (row.isWeeklyOff) {
          status = "WeeklyOff";
          dutyHours = 0;
        }

        const stdHours = row.employee.standardWorkingHours || 9;
        let ot = 0;
        if (row.employee.isOTApplicable) {
          const isOffOrHol = status === "Holiday" || row.isHoliday || row.isWeeklyOff;
          ot = isOffOrHol ? dutyHours : Math.max(0, Number((dutyHours - stdHours).toFixed(2)));
        }

        return {
          ...row,
          validated: {
            ...row.validated,
            status,
            checkIn: rawIn || null,
            checkOut: rawOut || null,
            dutyHours,
            otHours: ot,
            isValidated: true,
          },
        };
      })
    );
  };

  // Save single employee validation
  const handleSaveSingleEmployee = async (row: any) => {
    setSavingRowId(row.employee._id);
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${API_BASE_URL}/api/hr/attendance-validation/daily`,
        {
          date: selectedDate,
          validations: [
            {
              employeeId: row.employee._id,
              rawAttendanceId: row.rawAttendance?.id,
              rawCheckIn: row.rawAttendance?.checkIn,
              rawCheckOut: row.rawAttendance?.checkOut,
              rawStatus: row.rawAttendance?.status,
              rawHoursWorked: row.rawAttendance?.hoursWorked,
              status: row.validated.status,
              checkIn: row.validated.checkIn,
              checkOut: row.validated.checkOut,
              dutyHours: Number(row.validated.dutyHours) || 0,
              otHours: Number(row.validated.otHours) || 0,
              remarks: row.validated.remarks || "",
            },
          ],
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Re-fetch daily data so the updated validatedByUsername and timestamp immediately display
      await fetchDailyAttendance();
    } catch (err: any) {
      console.error("Error saving single attendance validation:", err);
      alert(err.response?.data?.message || "Failed to save validation.");
    } finally {
      setSavingRowId(null);
    }
  };

  // Validate & Save All
  const handleSaveAllDaily = async () => {
    setDailySaving(true);
    try {
      const token = localStorage.getItem("token");
      const payload = {
        date: selectedDate,
        validations: dailyData.map((row) => ({
          employeeId: row.employee._id,
          rawAttendanceId: row.rawAttendance?.id,
          rawCheckIn: row.rawAttendance?.checkIn,
          rawCheckOut: row.rawAttendance?.checkOut,
          rawStatus: row.rawAttendance?.status,
          rawHoursWorked: row.rawAttendance?.hoursWorked,
          status: row.validated.status,
          checkIn: row.validated.checkIn,
          checkOut: row.validated.checkOut,
          dutyHours: Number(row.validated.dutyHours) || 0,
          otHours: Number(row.validated.otHours) || 0,
          remarks: row.validated.remarks || "",
        })),
      };

      await axios.post(
        `${API_BASE_URL}/api/hr/attendance-validation/daily`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      alert(`Successfully validated and saved attendance for ${selectedDate}!`);
      fetchDailyAttendance();
    } catch (err: any) {
      console.error("Error saving all daily validations:", err);
      alert(err.response?.data?.message || "Failed to save attendance validations.");
    } finally {
      setDailySaving(false);
    }
  };

  // Open Month Preview for an employee
  const handleOpenMonthPreview = (empId: string) => {
    setPreviewEmployeeId(empId);
    setIsPreviewModalOpen(true);
  };

  // Unique departments for filter
  // Check if any filters are active
  const isAnyDailyFilterActive = useMemo(() => {
    return Boolean(
      searchTerm.trim() ||
      colFilterDailyEmployee.length > 0 ||
      colFilterDailyDept.length > 0 ||
      colFilterDailyType.length > 0 ||
      colFilterDailyStatus.length > 0 ||
      colFilterDailyValidation.length > 0 ||
      dailySortConfig
    );
  }, [
    searchTerm,
    colFilterDailyEmployee,
    colFilterDailyDept,
    colFilterDailyType,
    colFilterDailyStatus,
    colFilterDailyValidation,
    dailySortConfig,
  ]);

  const handleResetDailyFilters = () => {
    setSearchTerm("");
    setColFilterDailyEmployee([]);
    setColFilterDailyDept([]);
    setColFilterDailyType([]);
    setColFilterDailyStatus([]);
    setColFilterDailyValidation([]);
    setDailySortConfig(null);
  };

  const isAnyMonthlyFilterActive = useMemo(() => {
    return Boolean(
      searchTerm.trim() ||
      colFilterMonthlyEmployee.length > 0 ||
      colFilterMonthlyDept.length > 0 ||
      colFilterMonthlyType.length > 0 ||
      colFilterMonthlyProgress.length > 0 ||
      monthlySortConfig
    );
  }, [
    searchTerm,
    colFilterMonthlyEmployee,
    colFilterMonthlyDept,
    colFilterMonthlyType,
    colFilterMonthlyProgress,
    monthlySortConfig,
  ]);

  const handleResetMonthlyFilters = () => {
    setSearchTerm("");
    setColFilterMonthlyEmployee([]);
    setColFilterMonthlyDept([]);
    setColFilterMonthlyType([]);
    setColFilterMonthlyProgress([]);
    setMonthlySortConfig(null);
  };

  // Filtered Daily Rows
  const filteredDailyRows = useMemo(() => {
    let list = dailyData.filter((row) => {
      const emp = row.employee;
      const val = row.validated;
      const isVal = Boolean(row.isValidated || val?.isValidated);
      const valState = isVal ? "Validated" : "Pending";
      const empType = emp.employeeType || "Full-Time";
      const dept = emp.department || "(Blanks)";
      const statusVal = val.status || (row.isHoliday ? "Holiday" : row.isWeeklyOff ? "WeeklyOff" : "Absent");

      // Global Search
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matches =
          emp.name?.toLowerCase().includes(term) ||
          emp.employeeId?.toLowerCase().includes(term) ||
          (emp.designation || "").toLowerCase().includes(term) ||
          (emp.department || "").toLowerCase().includes(term) ||
          (emp.employeeType || "").toLowerCase().includes(term) ||
          (val.remarks || "").toLowerCase().includes(term) ||
          statusVal.toLowerCase().includes(term) ||
          valState.toLowerCase().includes(term);
        if (!matches) return false;
      }

      // Column Filters
      if (colFilterDailyEmployee.length > 0 && !colFilterDailyEmployee.includes(emp.name)) return false;
      if (colFilterDailyDept.length > 0 && !colFilterDailyDept.includes(dept)) return false;
      if (colFilterDailyType.length > 0 && !colFilterDailyType.includes(empType)) return false;
      if (colFilterDailyStatus.length > 0 && !colFilterDailyStatus.includes(statusVal)) return false;
      if (colFilterDailyValidation.length > 0 && !colFilterDailyValidation.includes(valState)) return false;

      return true;
    });

    // Sorting
    if (dailySortConfig) {
      const { key, direction } = dailySortConfig;
      list = [...list].sort((a, b) => {
        let valA: any = "";
        let valB: any = "";

        if (key === "employee") {
          valA = (a.employee?.name || "").toLowerCase();
          valB = (b.employee?.name || "").toLowerCase();
        } else if (key === "department") {
          valA = (a.employee?.department || "").toLowerCase();
          valB = (b.employee?.department || "").toLowerCase();
        } else if (key === "employeeType") {
          valA = (a.employee?.employeeType || "Full-Time").toLowerCase();
          valB = (b.employee?.employeeType || "Full-Time").toLowerCase();
        } else if (key === "status") {
          valA = (a.validated?.status || "").toLowerCase();
          valB = (b.validated?.status || "").toLowerCase();
        } else if (key === "validationState") {
          valA = Boolean(a.isValidated || a.validated?.isValidated) ? "Validated" : "Pending";
          valB = Boolean(b.isValidated || b.validated?.isValidated) ? "Validated" : "Pending";
        }

        if (valA < valB) return direction === "asc" ? -1 : 1;
        if (valA > valB) return direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return list;
  }, [
    dailyData,
    searchTerm,
    colFilterDailyEmployee,
    colFilterDailyDept,
    colFilterDailyType,
    colFilterDailyStatus,
    colFilterDailyValidation,
    dailySortConfig,
  ]);

  // Filtered Monthly Summaries
  const filteredMonthlySummaries = useMemo(() => {
    let list = monthlySummaries.filter((row) => {
      const empType = row.employeeType || "Full-Time";
      const dept = row.department || "(Blanks)";
      const progState = row.isFullyValidated ? "Fully Validated" : "Pending Review";

      // Global Search
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matches =
          row.name?.toLowerCase().includes(term) ||
          row.employeeCode?.toLowerCase().includes(term) ||
          (row.designation || "").toLowerCase().includes(term) ||
          (row.department || "").toLowerCase().includes(term) ||
          (row.employeeType || "").toLowerCase().includes(term) ||
          progState.toLowerCase().includes(term);
        if (!matches) return false;
      }

      // Column Filters
      if (colFilterMonthlyEmployee.length > 0 && !colFilterMonthlyEmployee.includes(row.name)) return false;
      if (colFilterMonthlyDept.length > 0 && !colFilterMonthlyDept.includes(dept)) return false;
      if (colFilterMonthlyType.length > 0 && !colFilterMonthlyType.includes(empType)) return false;
      if (colFilterMonthlyProgress.length > 0 && !colFilterMonthlyProgress.includes(progState)) return false;

      return true;
    });

    // Sorting
    if (monthlySortConfig) {
      const { key, direction } = monthlySortConfig;
      list = [...list].sort((a, b) => {
        let valA: any = "";
        let valB: any = "";

        if (key === "employee") {
          valA = (a.name || "").toLowerCase();
          valB = (b.name || "").toLowerCase();
        } else if (key === "department") {
          valA = (a.department || "").toLowerCase();
          valB = (b.department || "").toLowerCase();
        } else if (key === "employeeType") {
          valA = (a.employeeType || "Full-Time").toLowerCase();
          valB = (b.employeeType || "Full-Time").toLowerCase();
        } else if (key === "progress") {
          valA = a.validatedDays / (a.totalMonthDays || 1);
          valB = b.validatedDays / (b.totalMonthDays || 1);
        } else if (key === "payableDays") {
          valA = a.payableDays;
          valB = b.payableDays;
        }

        if (valA < valB) return direction === "asc" ? -1 : 1;
        if (valA > valB) return direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return list;
  }, [
    monthlySummaries,
    searchTerm,
    colFilterMonthlyEmployee,
    colFilterMonthlyDept,
    colFilterMonthlyType,
    colFilterMonthlyProgress,
    monthlySortConfig,
  ]);

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* View Switcher & Top Toolbar */}
      <div className="bg-white border border-slate-200 dark:bg-slate-800 dark:border-slate-700 p-4 rounded-2xl shadow-sm flex flex-col xl:flex-row justify-between items-center gap-4">
        {/* Sub-view switcher */}
        <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl w-full xl:w-auto">
          <button
            onClick={() => setViewMode("daily")}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 flex-1 xl:flex-none ${
              viewMode === "daily"
                ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            <Clock size={15} /> End-of-Day Daily Validation
          </button>
          <button
            onClick={() => setViewMode("monthly")}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 flex-1 xl:flex-none ${
              viewMode === "monthly"
                ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            <Calendar size={15} /> Monthly Employee Preview
          </button>
        </div>

        {/* Date / Month Controls */}
        <div className="flex flex-wrap items-center gap-2.5 w-full xl:w-auto justify-end">
          {viewMode === "daily" ? (
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                onClick={() => shiftDay(-1)}
                className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-500"
                title="Previous Day"
              >
                <ChevronLeft size={16} />
              </button>

              <Calendar size={15} className="text-blue-500" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent font-bold text-xs sm:text-sm text-slate-800 dark:text-white outline-none cursor-pointer"
              />

              <button
                onClick={() => shiftDay(1)}
                className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-500"
                title="Next Day"
              >
                <ChevronRight size={16} />
              </button>

              <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1" />

              <button
                onClick={() => setQuickDate("today")}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                  selectedDate === getTodayStr()
                    ? "bg-blue-600 text-white"
                    : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300"
                }`}
              >
                Today
              </button>
              <button
                onClick={() => setQuickDate("yesterday")}
                className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300 transition-colors"
              >
                Yesterday
              </button>

              <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1" />

              {/* Toggle Day Selector Ribbon */}
              <button
                type="button"
                onClick={() => setShowDaySelector((p) => !p)}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors flex items-center gap-1 ${
                  showDaySelector
                    ? "bg-blue-600 text-white"
                    : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300"
                }`}
                title={showDaySelector ? "Hide Day-by-Day Selector" : "Show Day-by-Day Selector"}
              >
                <Calendar size={11} />
                <span>{showDaySelector ? "Hide Days" : "Day Selector"}</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
              <Calendar size={15} className="text-blue-500" />
              <span className="text-xs font-semibold text-slate-500 uppercase">Period:</span>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent font-bold text-xs sm:text-sm text-slate-800 dark:text-white outline-none cursor-pointer"
              >
                {months.map((m) => (
                  <option key={m} value={m} className="dark:bg-slate-900">
                    {m}
                  </option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="bg-transparent font-bold text-xs sm:text-sm text-slate-800 dark:text-white outline-none cursor-pointer"
              >
                {Array.from({ length: 4 }, (_, i) => 2024 + i).map((y) => (
                  <option key={y} value={y} className="dark:bg-slate-900">
                    {y}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Toggle Daily Metrics Dashboard */}
          {viewMode === "daily" && (
            <button
              type="button"
              onClick={() => setShowDailyDashboard((p) => !p)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                showDailyDashboard
                  ? "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300"
                  : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
              }`}
              title={showDailyDashboard ? "Hide Metrics Dashboard" : "Show Metrics Dashboard"}
            >
              {showDailyDashboard ? <EyeOff size={13} /> : <Eye size={13} />}
              <span>{showDailyDashboard ? "Hide Metrics" : "Show Metrics"}</span>
            </button>
          )}

          <button
            onClick={() => (viewMode === "daily" ? fetchDailyAttendance() : fetchMonthlySummaries())}
            disabled={dailyLoading || monthlyLoading}
            className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={16} className={dailyLoading || monthlyLoading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Holiday Master Banner */}
      {viewMode === "daily" && (dailySummary?.isHoliday || dailyData.some((r) => r.isHoliday)) && (
        <div className="bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-2xl p-3.5 flex items-center justify-between shadow-sm animate-in fade-in duration-150">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-300 flex items-center justify-center font-bold">
              <Sparkles size={18} />
            </div>
            <div>
              <div className="text-xs font-bold text-purple-900 dark:text-purple-200 flex items-center gap-2">
                <span>Public Holiday: {dailySummary?.holidayName || dailyData.find((r) => r.isHoliday)?.holidayName || "Public Holiday"}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300">
                  Holiday Master
                </span>
              </div>
              <div className="text-[11px] text-purple-600 dark:text-purple-400 mt-0.5">
                This date is configured as an official holiday in Holiday Master. Attendance statuses default to Holiday.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Day Quick-Selector Ribbon for Day-wise Daily Mode (Hidden by default) */}
      {viewMode === "daily" && showDaySelector && (
        <div className="bg-white border border-slate-200 dark:bg-slate-800 dark:border-slate-700 p-2.5 rounded-2xl shadow-sm animate-in fade-in duration-150">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
              <Calendar size={13} className="text-blue-500" />
              Day-by-Day Selector &bull; {months[new Date(selectedDate).getMonth()]} {new Date(selectedDate).getFullYear()}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              Active Day:{" "}
              <span className="font-bold text-blue-600 dark:text-blue-400">
                {new Date(selectedDate).toLocaleDateString(undefined, {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })}
              </span>
            </span>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
            {Array.from({ length: daysInCurrentMonth }, (_, i) => i + 1).map((dNum) => {
              const [y, m] = selectedDate.split("-");
              const dayDateStr = `${y}-${m}-${String(dNum).padStart(2, "0")}`;
              const isSelected = selectedDate === dayDateStr;
              const dObj = new Date(Number(y), Number(m) - 1, dNum);
              const dayShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dObj.getDay()];
              const isSunday = dObj.getDay() === 0;

              return (
                <button
                  key={dNum}
                  type="button"
                  onClick={() => setSelectedDate(dayDateStr)}
                  className={`flex flex-col items-center justify-center min-w-[42px] py-1.5 px-1 rounded-xl text-xs font-bold transition-all border ${
                    isSelected
                      ? "bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-400/40 scale-105"
                      : isSunday
                      ? "bg-rose-50/60 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/50 hover:bg-rose-100/50"
                      : "bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <span className="text-[9.5px] uppercase font-semibold opacity-75">{dayShort}</span>
                  <span className="text-xs font-extrabold">{dNum}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* KPI Stats Ribbon (Hidden by default) */}
      {viewMode === "daily" && showDailyDashboard && dailySummary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 flex items-center gap-3 shadow-sm">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <Users size={18} />
            </div>
            <div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Total Employees</div>
              <div className="text-base font-bold text-slate-800 dark:text-white">{dailySummary.totalEmployees}</div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 flex items-center gap-3 shadow-sm">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <CheckCircle size={18} />
            </div>
            <div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Validated by HR</div>
              <div className="text-base font-bold text-emerald-600 dark:text-emerald-400">{dailySummary.validatedCount}</div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 flex items-center gap-3 shadow-sm">
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <AlertCircle size={18} />
            </div>
            <div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Pending Review</div>
              <div className="text-base font-bold text-amber-600 dark:text-amber-400">{dailySummary.pendingCount}</div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 flex items-center gap-3 shadow-sm">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              <UserCheck size={18} />
            </div>
            <div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Present / HalfDay</div>
              <div className="text-base font-bold text-indigo-600 dark:text-indigo-400">{dailySummary.presentCount}</div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 flex items-center gap-3 shadow-sm">
            <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold">
              <Clock size={18} />
            </div>
            <div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Absent</div>
              <div className="text-base font-bold text-rose-600 dark:text-rose-400">{dailySummary.absentCount}</div>
            </div>
          </div>
        </div>
      )}

      {/* Top Search & Action Bar */}
      <div className="bg-white border border-slate-200 dark:bg-slate-800 dark:border-slate-700 p-3.5 sm:p-4 rounded-2xl shadow-sm flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
        {/* Search Bar on Top */}
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={
              viewMode === "daily"
                ? "Search employee name, department, employee type, status, or remarks..."
                : "Search employee name, department, employee type, or designation..."
            }
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-9 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-white"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Action Controls & Filter Status */}
        <div className="flex flex-wrap items-center justify-between md:justify-end gap-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Showing{" "}
              <span className="font-bold text-slate-800 dark:text-white">
                {viewMode === "daily" ? filteredDailyRows.length : filteredMonthlySummaries.length}
              </span>{" "}
              of {viewMode === "daily" ? dailyData.length : monthlySummaries.length}
            </span>

            {((viewMode === "daily" && isAnyDailyFilterActive) || (viewMode === "monthly" && isAnyMonthlyFilterActive)) && (
              <button
                onClick={viewMode === "daily" ? handleResetDailyFilters : handleResetMonthlyFilters}
                className="text-xs text-rose-600 hover:text-rose-700 dark:text-rose-400 font-semibold flex items-center gap-1 hover:underline ml-1"
              >
                <X size={13} /> Clear Filters
              </button>
            )}
          </div>

          {/* Action Buttons for Daily View */}
          {viewMode === "daily" && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleAutofillRawDaily}
                className="px-3 py-1.5 rounded-xl border border-blue-200 text-blue-600 bg-blue-50/50 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-400 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                title="Copy raw kiosk/camera punches into all unvalidated rows"
              >
                <Sparkles size={14} /> Fill Punches
              </button>

              <button
                onClick={handleSaveAllDaily}
                disabled={dailySaving || dailyData.length === 0}
                className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 flex items-center gap-1.5 transition-all disabled:opacity-50"
              >
                {dailySaving ? <LoadingSpinner /> : <Save size={14} />}
                Save All Validations
              </button>
            </div>
          )}

          {/* Action Buttons for Monthly View */}
          {viewMode === "monthly" && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (onNavigateToSalaryCalculation) {
                    onNavigateToSalaryCalculation();
                  } else if (onOpenBulkGenerate) {
                    onOpenBulkGenerate();
                  }
                }}
                className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-500/20 flex items-center gap-1.5 transition-all"
                title="Open complete salary calculation page derived from Employee Master and validated attendance"
              >
                <Sparkles size={14} />
                Generate Month Salaries
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Holiday Master Notification Banner */}
      {viewMode === "daily" && dailySummary?.isHoliday && (
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-300 dark:border-amber-700/60 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold shrink-0">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-amber-900 dark:text-amber-200">
                  🎉 Holiday Master: {dailySummary.holidayName || "Company / Public Holiday"}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 uppercase tracking-wide">
                  {dailySummary.holidayType || "Official"} Holiday
                </span>
              </div>
              <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                This date is declared a holiday in the Holiday Master. Employee attendance defaults to <strong>Holiday</strong> unless manual duty hours or OT were worked.
              </p>
            </div>
          </div>
          <div className="text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-100/80 dark:bg-amber-900/40 px-3 py-1.5 rounded-xl border border-amber-200 dark:border-amber-800 shrink-0">
            {selectedDate}
          </div>
        </div>
      )}

      {/* ==================== VIEW 1: DAILY ATTENDANCE ==================== */}
      {viewMode === "daily" && (
        <>
          {dailyLoading ? (
            <div className="bg-white border border-slate-200 dark:bg-slate-800 dark:border-slate-700 rounded-2xl py-20 text-center shadow-sm">
              <LoadingSpinner />
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Loading daily employee attendance...</p>
            </div>
          ) : filteredDailyRows.length === 0 ? (
            <div className="bg-white border border-slate-200 dark:bg-slate-800 dark:border-slate-700 rounded-2xl py-16 text-center text-slate-500 dark:text-slate-400 text-xs shadow-sm">
              <p className="font-semibold text-sm text-slate-700 dark:text-slate-300">No employees found matching the active filters.</p>
              {isAnyDailyFilterActive && (
                <button
                  onClick={handleResetDailyFilters}
                  className="mt-3 px-3.5 py-1.5 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300 rounded-xl text-xs font-semibold hover:bg-blue-100 transition-colors"
                >
                  Clear All Filters
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop Table (Non-scrollable horizontally and vertically) */}
              <div className="hidden md:block bg-white border border-slate-200 dark:bg-slate-800 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden">
                <table className="w-full text-left text-xs border-collapse table-fixed">
                  <thead className="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 uppercase text-[10.5px] font-semibold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      {/* Employee */}
                      <th className="px-3.5 py-2.5 w-[20%]">
                        <ExcelColumnFilter
                          title="Employee"
                          columnKey="employee"
                          data={dailyData}
                          getValue={(r) => r.employee.name}
                          selectedValues={colFilterDailyEmployee}
                          onFilterChange={setColFilterDailyEmployee}
                          sortConfig={dailySortConfig}
                          onSortChange={setDailySortConfig}
                        />
                      </th>

                      {/* Department */}
                      <th className="px-2.5 py-2.5 w-[11%]">
                        <ExcelColumnFilter
                          title="Department"
                          columnKey="department"
                          data={dailyData}
                          getValue={(r) => r.employee.department || "(Blanks)"}
                          selectedValues={colFilterDailyDept}
                          onFilterChange={setColFilterDailyDept}
                          sortConfig={dailySortConfig}
                          onSortChange={setDailySortConfig}
                        />
                      </th>

                      {/* Employee Type */}
                      <th className="px-2.5 py-2.5 w-[10%]">
                        <ExcelColumnFilter
                          title="Emp Type"
                          columnKey="employeeType"
                          data={dailyData}
                          getValue={(r) => r.employee.employeeType || "Full-Time"}
                          selectedValues={colFilterDailyType}
                          onFilterChange={setColFilterDailyType}
                          sortConfig={dailySortConfig}
                          onSortChange={setDailySortConfig}
                        />
                      </th>

                      {/* Raw Punch */}
                      <th className="px-2.5 py-2.5 w-[13%]">Raw Punch</th>

                      {/* Validated Status */}
                      <th className="px-2.5 py-2.5 w-[12%]">
                        <ExcelColumnFilter
                          title="Validated Status"
                          columnKey="status"
                          data={dailyData}
                          getValue={(r) =>
                            r.validated?.status || (r.isHoliday ? "Holiday" : r.isWeeklyOff ? "WeeklyOff" : "Absent")
                          }
                          selectedValues={colFilterDailyStatus}
                          onFilterChange={setColFilterDailyStatus}
                          sortConfig={dailySortConfig}
                          onSortChange={setDailySortConfig}
                        />
                      </th>

                      {/* Duty & OT (Combined Compact Column) */}
                      <th className="px-2.5 py-2.5 w-[13%]">Duty & OT</th>

                      {/* Remarks */}
                      <th className="px-2.5 py-2.5 w-[10%]">Remarks</th>

                      {/* Validation Review State */}
                      <th className="px-2.5 py-2.5 w-[6%] text-center">
                        <ExcelColumnFilter
                          title="Review"
                          columnKey="validationState"
                          data={dailyData}
                          getValue={(r) =>
                            Boolean(r.isValidated || r.validated?.isValidated) ? "Validated" : "Pending"
                          }
                          selectedValues={colFilterDailyValidation}
                          onFilterChange={setColFilterDailyValidation}
                          sortConfig={dailySortConfig}
                          onSortChange={setDailySortConfig}
                          align="center"
                        />
                      </th>

                      {/* Actions */}
                      <th className="px-3 py-2.5 w-[5%] text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredDailyRows.map((row) => {
                      const emp = row.employee;
                      const val = row.validated;
                      const rawIn = row.rawAttendance?.checkIn;
                      const rawOut = row.rawAttendance?.checkOut;
                      const isVal = Boolean(row.isValidated || val?.isValidated);
                      const isSavingThis = savingRowId === emp._id;

                      return (
                        <tr
                          key={emp._id}
                          className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                            row.isWeeklyOff ? "bg-slate-50/50 dark:bg-slate-900/30" : ""
                          }`}
                        >
                          {/* Employee Name & Description Standard */}
                          <td className="px-3.5 py-2.5">
                            <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate" title={emp.name}>
                              {emp.name || "N/A"}
                            </div>
                            <div className="text-[11px] text-slate-500 italic mt-0.5 truncate" title={emp.designation || "Staff"}>
                              {emp.designation || "Staff"}
                            </div>
                          </td>

                          {/* Department */}
                          <td className="px-2.5 py-2.5 text-slate-600 dark:text-slate-400 truncate" title={emp.department || "General"}>
                            <span className="font-medium text-xs">{emp.department || "General"}</span>
                          </td>

                          {/* Employee Type */}
                          <td className="px-2.5 py-2.5">
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 truncate max-w-full">
                              {emp.employeeType || "Full-Time"}
                            </span>
                          </td>

                          {/* Raw Punch Details */}
                          <td className="px-2.5 py-2.5 font-mono text-[11px]">
                            {rawIn ? (
                              <div>
                                <div className="flex items-center gap-1 font-bold text-[10.5px]">
                                  <span className="text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                                    {formatPunchTime(rawIn)}
                                  </span>
                                  <span className="text-slate-400">&rarr;</span>
                                  <span className="text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-1 py-0.5 rounded border border-rose-200 dark:border-rose-800">
                                    {formatPunchTime(rawOut)}
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-400 font-sans mt-0.5 truncate">
                                  {(row.rawAttendance?.hoursWorked || 0).toFixed(1)}h worked
                                </div>
                              </div>
                            ) : (
                              <div className="text-slate-400 italic text-[11px] truncate">
                                {row.isHoliday ? (
                                  <span className="text-purple-600 dark:text-purple-400 font-semibold">Holiday</span>
                                ) : row.isWeeklyOff ? (
                                  "Weekly Off"
                                ) : (
                                  "No Punch"
                                )}
                              </div>
                            )}
                          </td>

                          {/* Validated Status Dropdown */}
                          <td className="px-2.5 py-2.5">
                            <select
                              value={val.status}
                              onChange={(e) => updateDailyField(emp._id, "status", e.target.value)}
                              className="w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-slate-200"
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

                          {/* Duty & OT (Combined Compact Column) */}
                          <td className="px-2.5 py-2.5">
                            <div className="flex items-center gap-1.5">
                              <div className="flex-1">
                                <div className="text-[9.5px] uppercase text-slate-400 font-semibold mb-0.5">Duty</div>
                                <input
                                  type="number"
                                  step="0.5"
                                  min="0"
                                  max="24"
                                  value={val.dutyHours}
                                  onChange={(e) => updateDailyField(emp._id, "dutyHours", parseFloat(e.target.value) || 0)}
                                  className="w-full px-1.5 py-0.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-blue-500"
                                />
                              </div>
                              <div className="flex-1">
                                <div className="text-[9.5px] uppercase text-purple-500 font-semibold mb-0.5">OT</div>
                                {emp.isOTApplicable ? (
                                  <input
                                    type="number"
                                    step="0.5"
                                    min="0"
                                    max="24"
                                    value={val.otHours || 0}
                                    onChange={(e) => updateDailyField(emp._id, "otHours", parseFloat(e.target.value) || 0)}
                                    className="w-full px-1.5 py-0.5 rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300 text-xs font-mono font-bold outline-none focus:ring-1 focus:ring-purple-500"
                                  />
                                ) : (
                                  <div className="text-slate-400 text-xs py-0.5 text-center">-</div>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Remarks */}
                          <td className="px-2.5 py-2.5">
                            <input
                              type="text"
                              placeholder="Remarks..."
                              value={val.remarks || ""}
                              onChange={(e) => updateDailyField(emp._id, "remarks", e.target.value)}
                              className="w-full px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-400"
                            />
                          </td>

                          {/* Validation Status Badge */}
                          <td className="px-2.5 py-2.5 text-center">
                            {isVal ? (
                              <div className="flex flex-col items-center">
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                                  <CheckCircle size={11} className="shrink-0" /> Validated
                                </span>
                                <span className="text-[9.5px] text-slate-400 truncate max-w-[80px]" title={val.validatedByUsername || "Admin"}>
                                  {val.validatedByUsername || "Admin"}
                                </span>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                                <AlertCircle size={11} className="shrink-0" /> Pending
                              </span>
                            )}
                          </td>

                          {/* Row Actions */}
                          <td className="px-3 py-2.5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => handleSaveSingleEmployee(row)}
                                disabled={isSavingThis}
                                className="px-2 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/50 rounded-lg transition-colors shadow-sm"
                                title="Save"
                              >
                                {isSavingThis ? "..." : "Save"}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleOpenMonthPreview(emp._id)}
                                className="p-1 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                                title="Employee Month Preview"
                              >
                                <Eye size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Phone Cards (Shown on < md screens) */}
              <div className="block md:hidden space-y-3">
                {filteredDailyRows.map((row) => {
                  const emp = row.employee;
                  const val = row.validated;
                  const rawIn = row.rawAttendance?.checkIn;
                  const rawOut = row.rawAttendance?.checkOut;
                  const isVal = Boolean(row.isValidated || val?.isValidated);
                  const isSavingThis = savingRowId === emp._id;

                  return (
                    <div
                      key={emp._id}
                      className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm space-y-3"
                    >
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-700 pb-2.5">
                        <div>
                          <div className="font-bold text-sm text-slate-900 dark:text-white">
                            {emp.name || "N/A"}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                              {emp.department || "General"}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                              {emp.employeeType || "Full-Time"}
                            </span>
                            <span className="text-[11px] text-slate-500 italic">
                              {emp.designation || "Staff"}
                            </span>
                          </div>
                        </div>
                        <div>
                          {isVal ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                              <CheckCircle size={11} /> Validated
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                              <AlertCircle size={11} /> Pending
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Raw Punch Info */}
                      <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-2.5 text-xs">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                          Raw Biometric Punch
                        </div>
                        {rawIn ? (
                          <div className="flex flex-wrap items-center justify-between gap-1">
                            <div className="flex items-center gap-1.5 font-mono text-[11px]">
                              <span className="text-emerald-600 font-bold">{formatPunchTime(rawIn)}</span>
                              <span className="text-slate-400">&rarr;</span>
                              <span className="text-rose-600 font-bold">{formatPunchTime(rawOut)}</span>
                            </div>
                            <div className="text-[11px] text-slate-500 font-medium">
                              {(row.rawAttendance?.hoursWorked || 0).toFixed(1)}h worked ({row.rawAttendance?.status || "Present"})
                            </div>
                          </div>
                        ) : (
                          <div className="text-slate-400 italic text-[11px]">
                            {row.isHoliday
                              ? `Public Holiday (${row.holidayName || "Holiday Master"})`
                              : row.isWeeklyOff
                              ? `Weekly Off (${row.fullDayName})`
                              : "No punch recorded"}
                          </div>
                        )}
                      </div>

                      {/* Validation Inputs Grid */}
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="col-span-2">
                          <label className="text-[10.5px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                            Attendance Status
                          </label>
                          <select
                            value={val.status}
                            onChange={(e) => updateDailyField(emp._id, "status", e.target.value)}
                            className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-slate-200"
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
                        </div>

                        <div>
                          <label className="text-[10.5px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                            Duty Hours
                          </label>
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            max="24"
                            value={val.dutyHours}
                            onChange={(e) => updateDailyField(emp._id, "dutyHours", parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-bold outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <label className="text-[10.5px] font-bold text-purple-600 dark:text-purple-400 block mb-1">
                            Overtime (OT)
                          </label>
                          {emp.isOTApplicable ? (
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              max="24"
                              value={val.otHours || 0}
                              onChange={(e) => updateDailyField(emp._id, "otHours", parseFloat(e.target.value) || 0)}
                              className="w-full px-3 py-1.5 rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300 text-xs font-mono font-bold outline-none focus:ring-1 focus:ring-purple-500"
                            />
                          ) : (
                            <div className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-400 text-xs text-center">
                              Not Applicable
                            </div>
                          )}
                        </div>

                        <div className="col-span-2">
                          <label className="text-[10.5px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                            Remarks
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Approved late punch..."
                            value={val.remarks || ""}
                            onChange={(e) => updateDailyField(emp._id, "remarks", e.target.value)}
                            className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-white placeholder:text-slate-400"
                          />
                        </div>
                      </div>

                      {/* Card Footer Actions */}
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                        <div className="text-[10px] text-slate-400">
                          {isVal && val.validatedByUsername && (
                            <span>Validated by {val.validatedByUsername}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenMonthPreview(emp._id)}
                            className="px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-400 rounded-xl transition-colors"
                          >
                            Month Preview
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveSingleEmployee(row)}
                            disabled={isSavingThis}
                            className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-sm flex items-center gap-1"
                          >
                            <Save size={12} /> {isSavingThis ? "Saving..." : "Save"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      {/* ==================== VIEW 2: MONTHLY SUMMARIES ==================== */}
      {viewMode === "monthly" && (
        <>
          {monthlyLoading ? (
            <div className="bg-white border border-slate-200 dark:bg-slate-800 dark:border-slate-700 rounded-2xl py-20 text-center shadow-sm">
              <LoadingSpinner />
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Loading monthly validation summaries...</p>
            </div>
          ) : filteredMonthlySummaries.length === 0 ? (
            <div className="bg-white border border-slate-200 dark:bg-slate-800 dark:border-slate-700 rounded-2xl py-16 text-center text-slate-500 dark:text-slate-400 text-xs shadow-sm">
              <p className="font-semibold text-sm text-slate-700 dark:text-slate-300">
                No employees found for {selectedMonth} {selectedYear}.
              </p>
              {isAnyMonthlyFilterActive && (
                <button
                  onClick={handleResetMonthlyFilters}
                  className="mt-3 px-3.5 py-1.5 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300 rounded-xl text-xs font-semibold hover:bg-blue-100 transition-colors"
                >
                  Clear All Filters
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop Table (Non-scrollable horizontally and vertically) */}
              <div className="hidden md:block bg-white border border-slate-200 dark:bg-slate-800 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden">
                <table className="w-full text-left text-xs border-collapse table-fixed">
                  <thead className="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 uppercase text-[10.5px] font-semibold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      {/* Employee */}
                      <th className="px-3.5 py-2.5 w-[24%]">
                        <ExcelColumnFilter
                          title="Employee"
                          columnKey="employee"
                          data={monthlySummaries}
                          getValue={(r) => r.name}
                          selectedValues={colFilterMonthlyEmployee}
                          onFilterChange={setColFilterMonthlyEmployee}
                          sortConfig={monthlySortConfig}
                          onSortChange={setMonthlySortConfig}
                        />
                      </th>

                      {/* Department */}
                      <th className="px-3 py-2.5 w-[13%]">
                        <ExcelColumnFilter
                          title="Department"
                          columnKey="department"
                          data={monthlySummaries}
                          getValue={(r) => r.department || "(Blanks)"}
                          selectedValues={colFilterMonthlyDept}
                          onFilterChange={setColFilterMonthlyDept}
                          sortConfig={monthlySortConfig}
                          onSortChange={setMonthlySortConfig}
                        />
                      </th>

                      {/* Employee Type */}
                      <th className="px-3 py-2.5 w-[11%]">
                        <ExcelColumnFilter
                          title="Emp Type"
                          columnKey="employeeType"
                          data={monthlySummaries}
                          getValue={(r) => r.employeeType || "Full-Time"}
                          selectedValues={colFilterMonthlyType}
                          onFilterChange={setColFilterMonthlyType}
                          sortConfig={monthlySortConfig}
                          onSortChange={setMonthlySortConfig}
                        />
                      </th>

                      {/* Validation Progress */}
                      <th className="px-3 py-2.5 w-[18%]">
                        <ExcelColumnFilter
                          title="Validation Progress"
                          columnKey="progress"
                          data={monthlySummaries}
                          getValue={(r) => (r.isFullyValidated ? "Fully Validated" : "Pending Review")}
                          selectedValues={colFilterMonthlyProgress}
                          onFilterChange={setColFilterMonthlyProgress}
                          sortConfig={monthlySortConfig}
                          onSortChange={setMonthlySortConfig}
                        />
                      </th>

                      {/* Payable Days */}
                      <th className="px-3 py-2.5 w-[10%]">Payable Days</th>

                      {/* Duty & OT Hours */}
                      <th className="px-3 py-2.5 w-[12%]">Duty & OT Hours</th>

                      {/* Actions */}
                      <th className="px-3.5 py-2.5 w-[12%] text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredMonthlySummaries.map((row) => {
                      const percent = Math.round((row.validatedDays / row.totalMonthDays) * 100) || 0;

                      return (
                        <tr key={row.employeeId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          {/* Employee Name & Description Standard */}
                          <td className="px-3.5 py-2.5">
                            <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate" title={row.name}>
                              {row.name || "N/A"}
                            </div>
                            <div className="text-[11px] text-slate-500 italic mt-0.5 truncate" title={row.designation || "Staff"}>
                              {row.designation || "Staff"}
                            </div>
                          </td>

                          {/* Department */}
                          <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400 truncate" title={row.department || "General"}>
                            <span className="font-medium text-xs">{row.department || "General"}</span>
                          </td>

                          {/* Employee Type */}
                          <td className="px-3 py-2.5">
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 truncate max-w-full">
                              {row.employeeType || "Full-Time"}
                            </span>
                          </td>

                          {/* Progress */}
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden min-w-[50px]">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    row.isFullyValidated ? "bg-emerald-500" : "bg-amber-500"
                                  }`}
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                {row.validatedDays}/{row.totalMonthDays}d
                              </span>
                            </div>
                            <div className="mt-0.5">
                              {row.isFullyValidated ? (
                                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                                  <CheckCircle size={10} /> Fully Validated
                                </span>
                              ) : (
                                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                                  <AlertCircle size={10} /> {row.pendingDays}d pending
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Payable Days */}
                          <td className="px-3 py-2.5 font-semibold text-slate-800 dark:text-slate-200">
                            {row.payableDays} Days
                          </td>

                          {/* Duty & OT Hours */}
                          <td className="px-3 py-2.5 font-mono text-xs">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">{row.totalDutyHours}h</span>
                            {row.totalOtHours > 0 && (
                              <span className="ml-1.5 text-purple-600 dark:text-purple-400 font-bold">
                                +{row.totalOtHours}h
                              </span>
                            )}
                          </td>

                          {/* Action */}
                          <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenMonthPreview(row.employeeId)}
                                className="px-2.5 py-1 text-xs font-bold rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-400 dark:hover:bg-blue-900/50 transition-colors flex items-center gap-1"
                              >
                                <Eye size={12} /> Preview
                              </button>
                              {onNavigateToSalaryCalculation ? (
                                <button
                                  type="button"
                                  onClick={() => onNavigateToSalaryCalculation(row.employeeId)}
                                  className="px-2.5 py-1 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors flex items-center gap-1 shadow-sm"
                                  title="Open salary edit & review for this employee"
                                >
                                  <Sparkles size={12} /> Generate
                                </button>
                              ) : row.isFullyValidated && onOpenBulkGenerate ? (
                                <button
                                  type="button"
                                  onClick={() => onOpenBulkGenerate([row.employeeId])}
                                  className="px-2.5 py-1 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors flex items-center gap-1 shadow-sm"
                                  title="Generate salary for this employee"
                                >
                                  <Sparkles size={12} /> Generate
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Phone Cards (Shown on < md screens) */}
              <div className="block md:hidden space-y-3">
                {filteredMonthlySummaries.map((row) => {
                  const percent = Math.round((row.validatedDays / row.totalMonthDays) * 100) || 0;

                  return (
                    <div
                      key={row.employeeId}
                      className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm space-y-3"
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-700 pb-2.5">
                        <div>
                          <div className="font-bold text-sm text-slate-900 dark:text-white">
                            {row.name || "N/A"}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                              {row.department || "General"}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                              {row.employeeType || "Full-Time"}
                            </span>
                            <span className="text-[11px] text-slate-500 italic">
                              {row.designation || "Staff"}
                            </span>
                          </div>
                        </div>
                        <div>
                          {row.isFullyValidated ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                              <CheckCircle size={10} /> Fully Validated
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                              <AlertCircle size={10} /> {row.pendingDays}d pending
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-slate-500 font-medium">Validation Progress</span>
                          <span className="font-bold text-slate-800 dark:text-white">
                            {row.validatedDays}/{row.totalMonthDays} Days ({percent}%)
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              row.isFullyValidated ? "bg-emerald-500" : "bg-amber-500"
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>

                      {/* 3 Metrics Grid */}
                      <div className="grid grid-cols-3 gap-2 bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-xl text-center">
                        <div>
                          <div className="text-[10px] uppercase font-semibold text-slate-400">Payable</div>
                          <div className="font-bold text-xs text-slate-800 dark:text-white mt-0.5">{row.payableDays} Days</div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase font-semibold text-slate-400">Duty Hrs</div>
                          <div className="font-bold text-xs font-mono text-slate-800 dark:text-white mt-0.5">{row.totalDutyHours}h</div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase font-semibold text-purple-500">OT Hrs</div>
                          <div className="font-bold text-xs font-mono text-purple-600 dark:text-purple-400 mt-0.5">
                            {row.totalOtHours > 0 ? `+${row.totalOtHours}h` : "-"}
                          </div>
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100 dark:border-slate-700">
                        <button
                          type="button"
                          onClick={() => handleOpenMonthPreview(row.employeeId)}
                          className="px-3 py-1.5 text-xs font-bold rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-400 transition-colors flex items-center gap-1"
                        >
                          <Eye size={12} /> Preview & Validate
                        </button>
                        {onNavigateToSalaryCalculation ? (
                          <button
                            type="button"
                            onClick={() => onNavigateToSalaryCalculation(row.employeeId)}
                            className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center gap-1 shadow-sm"
                          >
                            <Sparkles size={12} /> Generate
                          </button>
                        ) : row.isFullyValidated && onOpenBulkGenerate ? (
                          <button
                            type="button"
                            onClick={() => onOpenBulkGenerate([row.employeeId])}
                            className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center gap-1 shadow-sm"
                          >
                            <Sparkles size={12} /> Generate
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      {/* Monthly Attendance Validation Modal */}
      <MonthlyAttendanceValidationModal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        employeeId={previewEmployeeId}
        month={viewMode === "daily" ? months[new Date(selectedDate).getMonth()] : selectedMonth}
        year={viewMode === "daily" ? new Date(selectedDate).getFullYear() : selectedYear}
        onSaved={() => {
          if (viewMode === "daily") fetchDailyAttendance();
          else fetchMonthlySummaries();
        }}
        onGenerateSalary={onOpenBulkGenerate ? (empId) => onOpenBulkGenerate([empId]) : undefined}
      />
    </div>
  );
}

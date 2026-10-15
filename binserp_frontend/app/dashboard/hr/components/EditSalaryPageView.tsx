"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  ChevronLeft,
  Save,
  Calculator,
  IndianRupee,
  Clock,
  Calendar,
  CheckCircle,
  AlertCircle,
  Sparkles,
  RefreshCw,
  UserCheck,
  Check,
  ArrowRight,
  ShieldCheck,
  FileText,
} from "lucide-react";
import axios from "axios";
import { API_BASE_URL } from "@/src/utils/config";
import LoadingSpinner from "@/src/components/LoadingSpinner";
import { Employee } from "../types/hr.types";

export interface DayStatusLog {
  date: string; // YYYY-MM-DD
  day: number;
  dayName: string;
  originalStatus: string;
  originalCheckIn?: string;
  originalCheckOut?: string;
  originalHours?: number;
  otHours?: number;
  manualStatus: string;
  manualHours: number;
  manualOtHours?: number;
  useManual: boolean;
  remarks?: string;
}

export interface EnrichedEmployeeRow {
  employee: Employee;
  calendarData: any[];
  totalMonthDays: number;
  workedDays: number;
  payableDays: number;
  actualAbsentDays: number;
  weeklyOffsCount: number;
  holidaysCount: number;
  isOTApplicable: boolean;
  totalOtHours: number;
  otPay: number;
  grossPay: number;
  baseGrossSalary: number;
  baseSalary?: number;
  perDaySalary?: number;
  otHourlyRate?: number;
  otMultiplier?: number;
  dailyDivisorBasis?: string;
  divisor?: number;
  standardHours?: number;
  pfDeduction: number;
  esiDeduction: number;
  employerPF: number;
  employerESI: number;
  professionalTax: number;
  netPay: number;
  hasGenerated: boolean;
  existingSalaryId?: string;
  totalDutyHours: number;
  baseHourlyRate: number;
  casualLeaveConsumed: number;
  sickLeaveConsumed: number;
  compOffConsumed: number;
  compOffAccrued: number;
  validationStatus?: {
    isFullyValidated: boolean;
    validatedDays: number;
    pendingDays: number;
  };
}

interface EditSalaryPageViewProps {
  row: EnrichedEmployeeRow;
  month: string;
  year: number;
  employees: Employee[];
  onBack: () => void;
  onSuccess: () => void;
}

export default function EditSalaryPageView({
  row,
  month,
  year,
  employees,
  onBack,
  onSuccess,
}: EditSalaryPageViewProps) {
  const [calendarData, setCalendarData] = useState<DayStatusLog[]>([]);
  const [baseSalary, setBaseSalary] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const [customPf, setCustomPf] = useState<number | null>(null);
  const [customEsi, setCustomEsi] = useState<number | null>(null);
  const [customPt, setCustomPt] = useState<number | null>(null);

  const emp = useMemo(() => {
    return (
      (employees.find((e) => e._id === row.employee._id) as any) ||
      (row.employee as any)
    );
  }, [employees, row.employee]);

  const standardHours = emp?.standardWorkingHours || 9;
  const isOT = Boolean(emp?.isOTApplicable);

  // Time formatter
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

  // Helper for computing OT hours
  const getDailyOtHours = (
    hours: number,
    dayName: string,
    isHoliday: boolean,
    targetEmp: any
  ) => {
    if (!targetEmp?.isOTApplicable) return 0;
    const stdHrs = targetEmp?.standardWorkingHours || 9;
    const weeklyOff = Array.isArray(targetEmp?.weeklyOff)
      ? targetEmp.weeklyOff
      : [targetEmp?.weeklyOff || "Sunday"];
    const holidayWorkPolicy = targetEmp?.holidayWorkPolicy || "Overtime";
    const weekOffWorkPolicy = targetEmp?.weekOffWorkPolicy || "Overtime";

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
      return weekOffWorkPolicy === "Overtime" ? hours : 0;
    }
    if (isHoliday) {
      return holidayWorkPolicy === "Overtime" ? hours : 0;
    }
    return Math.max(0, Number((hours - stdHrs).toFixed(2)));
  };

  // Initialize Calendar Logs & Base Salary
  const initializeData = () => {
    const rawLogs = row.calendarData || [];
    const enriched: DayStatusLog[] = rawLogs.map((log: any) => {
      const computedHours = log.originalHours ?? log.hoursWorked ?? 0;
      const dailyOt =
        log.otHours !== undefined
          ? log.otHours
          : getDailyOtHours(computedHours, log.dayName, log.originalStatus === "Holiday", emp);

      const manualHours = log.manualHours ?? computedHours;
      const manualOt =
        log.manualOtHours !== undefined
          ? log.manualOtHours
          : getDailyOtHours(
              manualHours,
              log.dayName,
              log.manualStatus === "Holiday" || log.originalStatus === "Holiday",
              emp
            );

      return {
        date: log.date,
        day: log.day,
        dayName: log.dayName,
        originalStatus: log.originalStatus || log.status || "Present",
        originalCheckIn: log.originalCheckIn || log.rawAttendance?.checkIn || log.checkIn,
        originalCheckOut: log.originalCheckOut || log.rawAttendance?.checkOut || log.checkOut,
        originalHours: computedHours,
        otHours: dailyOt,
        manualStatus: log.manualStatus || log.originalStatus || log.status || "Present",
        manualHours,
        manualOtHours: manualOt,
        useManual: Boolean(log.useManual),
        remarks: log.remarks || "",
      };
    });

    setCalendarData(enriched);

    // Compute Base Salary
    if (emp?.salary) {
      const basis = emp.salary.perDayCalculationBasis || "Gross";
      if (basis === "Basic") setBaseSalary(emp.salary.basic || 0);
      else if (basis === "Net") setBaseSalary(emp.salary.netSalary || 0);
      else setBaseSalary(emp.salary.grossSalary || 0);
    } else {
      setBaseSalary(row.baseGrossSalary || 0);
    }

    setCustomPf(null);
    setCustomEsi(null);
    setCustomPt(null);
  };

  useEffect(() => {
    initializeData();
  }, [row, emp]);

  // Live Recalculation Engine
  const totals = useMemo(() => {
    let totalDutyHours = 0;
    let totalOtHours = 0;
    let compOffAccrued = 0;
    let weeklyOffsCount = 0;
    let actualAbsentDays = 0;
    let workedDays = 0;

    const weeklyOff = Array.isArray(emp?.weeklyOff)
      ? emp.weeklyOff
      : [emp?.weeklyOff || "Sunday"];
    const holidayWorkPolicy = emp?.holidayWorkPolicy || "Overtime";
    const weekOffWorkPolicy = emp?.weekOffWorkPolicy || "Overtime";

    calendarData.forEach((day) => {
      const dateObj = new Date(day.date);
      const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const isWeeklyOff = weeklyOff.includes(days[dateObj.getDay()]);
      if (isWeeklyOff) weeklyOffsCount++;

      const status = day.useManual ? day.manualStatus : day.originalStatus;
      const hours = day.useManual ? day.manualHours : day.originalHours || 0;

      totalDutyHours += hours;

      const isPublicHoliday = day.originalStatus === "Holiday";

      if (!isWeeklyOff && !isPublicHoliday) {
        if (status === "Absent") actualAbsentDays += 1;
        else if (status === "HalfDay") actualAbsentDays += 0.5;
      }

      if (status === "Present") workedDays += 1;
      else if (status === "HalfDay") workedDays += 0.5;

      // Overtime & CompOff Accrual
      if (isWeeklyOff) {
        if (hours > 0) {
          if (weekOffWorkPolicy === "Overtime") totalOtHours += hours;
          else compOffAccrued += hours / standardHours;
        }
      } else if (isPublicHoliday) {
        if (hours > 0) {
          if (holidayWorkPolicy === "Overtime") totalOtHours += hours;
          else compOffAccrued += hours / standardHours;
        }
      } else {
        if (hours > standardHours) {
          totalOtHours += hours - standardHours;
        }
      }
    });

    const totalMonthDays = calendarData.length || row.totalMonthDays || 30;
    const effectiveWorkingDays = totalMonthDays - weeklyOffsCount;

    const dailyDivisorBasis = emp?.salary?.dailyDivisorBasis || "TotalMonthDays";
    const divisor = dailyDivisorBasis === "TotalMonthDays" ? totalMonthDays : effectiveWorkingDays;

    // Payable Days
    const payableDays = Math.max(0, divisor - actualAbsentDays);
    const absentHours = actualAbsentDays * standardHours;

    // Per Day Salary & Base Hourly Rate
    const perDaySalary = divisor > 0 ? baseSalary / divisor : 0;
    const baseHourlyRate =
      divisor > 0 && standardHours > 0 ? (baseSalary / divisor) / standardHours : 0;

    // Overtime Calculations
    const otCompensateForAbsent = emp?.otCompensateForAbsent ?? true;
    const mainOTRateMultiplier = emp?.salary?.otRate || 1.0;
    const absentOTRateMultiplier = emp?.absentOTRate || 1.0;

    const otCalcBasis = emp?.salary?.otCalculationBasis || "Basic";
    let otBaseSalary = 0;
    if (otCalcBasis === "Basic") otBaseSalary = emp?.salary?.basic || 0;
    else if (otCalcBasis === "Gross") otBaseSalary = emp?.salary?.grossSalary || 0;
    else if (otCalcBasis === "Net") otBaseSalary = emp?.salary?.netSalary || 0;

    const otDivBasis = emp?.salary?.otDivisorBasis || "TotalMonthDays";
    const otDivisor = otDivBasis === "TotalMonthDays" ? totalMonthDays : effectiveWorkingDays;
    const otHourlyRate =
      otDivisor > 0 && standardHours > 0 ? (otBaseSalary / otDivisor) / standardHours : 0;

    const mainOtHourlyRate = otHourlyRate * mainOTRateMultiplier;
    const absentOtHourlyRate = otHourlyRate * absentOTRateMultiplier;

    let compensatedHours = 0;
    let mainOtHours = 0;
    let absentOtHours = 0;
    let otPay = 0;
    let otCompensatedPay = 0;
    let mainOtPay = 0;

    if (emp?.isOTApplicable) {
      if (otCompensateForAbsent) {
        compensatedHours = Math.min(totalOtHours, absentHours);
        mainOtHours = totalOtHours - compensatedHours;
        otCompensatedPay = compensatedHours * otHourlyRate * 1.0;
        mainOtPay = mainOtHours * mainOtHourlyRate;
        otPay = otCompensatedPay + mainOtPay;
      } else {
        absentOtHours = Math.min(totalOtHours, absentHours);
        mainOtHours = totalOtHours - absentOtHours;
        otCompensatedPay = absentOtHours * absentOtHourlyRate;
        mainOtPay = mainOtHours * mainOtHourlyRate;
        otPay = otCompensatedPay + mainOtPay;
      }
    }

    // Leaves Consumed
    let casualLeaveConsumed = 0;
    let sickLeaveConsumed = 0;
    let compOffConsumed = 0;
    let holidaysCount = 0;

    calendarData.forEach((day) => {
      const status = day.useManual ? day.manualStatus : day.originalStatus;
      if (status === "CL") casualLeaveConsumed += 1;
      if (status === "SL") sickLeaveConsumed += 1;
      if (status === "CO" || status === "CompOff") compOffConsumed += 1;
      if (status === "Holiday") holidaysCount += 1;
    });

    // Deductions & Pay
    const ratio = divisor > 0 ? payableDays / divisor : 0;
    const earnedBasic = (emp?.salary?.basic || 0) * ratio;
    const earnedGross = (emp?.salary?.grossSalary || 0) * ratio;

    const isPFApplicable = emp?.salary?.isPFApplicable || false;
    const isESIApplicable = emp?.salary?.isESIApplicable || false;
    const isPTApplicable = emp?.salary?.isPTApplicable || false;

    // PF Calculation
    const defaultPf =
      emp?.salary?.pf && emp.salary.pf > 0
        ? emp.salary.pf
        : isPFApplicable
        ? earnedBasic * 0.12
        : 0;
    const pfDeduction = customPf !== null ? customPf : defaultPf;

    // ESI Calculation
    const defaultEsi =
      emp?.salary?.esi && emp.salary.esi > 0
        ? emp.salary.esi
        : isESIApplicable
        ? earnedGross * 0.0075
        : 0;
    const esiDeduction = customEsi !== null ? customEsi : defaultEsi;

    // PT Calculation
    const defaultPt =
      emp?.salary?.professionalTax && emp.salary.professionalTax > 0
        ? emp.salary.professionalTax
        : isPTApplicable
        ? 200
        : 0;
    const ptDeduction = customPt !== null ? customPt : defaultPt;

    const employerPF = isPFApplicable ? earnedBasic * 0.12 : 0;
    const employerESI = isESIApplicable ? earnedGross * 0.0325 : 0;

    const grossPay = divisor > 0 ? (baseSalary / divisor) * payableDays : 0;
    const totalDeductions = pfDeduction + esiDeduction + ptDeduction;
    const netPay = Math.round(grossPay + otPay - totalDeductions);

    return {
      presentDays: Math.round(payableDays * 10) / 10,
      workedDays,
      totalMonthDays,
      effectiveWorkingDays,
      divisor,
      dailyDivisorBasis,
      actualAbsentDays,
      absentHours,
      perDaySalary: Math.round(perDaySalary * 100) / 100,
      baseHourlyRate: Math.round(baseHourlyRate * 100) / 100,
      mainOtHourlyRate: Math.round(mainOtHourlyRate * 100) / 100,
      absentOtHourlyRate: Math.round(absentOtHourlyRate * 100) / 100,
      totalDutyHours: Math.round(totalDutyHours * 10) / 10,
      totalOtHours: Math.round(totalOtHours * 10) / 10,
      compensatedHours: Math.round(compensatedHours * 10) / 10,
      mainOtHours: Math.round(mainOtHours * 10) / 10,
      otCompensatedPay: Math.round(otCompensatedPay),
      mainOtPay: Math.round(mainOtPay),
      otPay: Math.round(otPay),
      earnedBasic: Math.round(earnedBasic),
      earnedGross: Math.round(earnedGross),
      grossPay: Math.round(grossPay),
      pfDeduction: Math.round(pfDeduction),
      esiDeduction: Math.round(esiDeduction),
      employerPF: Math.round(employerPF),
      employerESI: Math.round(employerESI),
      professionalTax: ptDeduction,
      totalDeductions: Math.round(totalDeductions),
      netPay,
      casualLeaveConsumed,
      sickLeaveConsumed,
      compOffConsumed,
      compOffAccrued: Math.round(compOffAccrued * 10) / 10,
      weeklyOffsCount,
      holidaysCount,
    };
  }, [calendarData, baseSalary, emp, customPf, customEsi, customPt, row.totalMonthDays, standardHours]);

  // Toggle manual override on a day
  const toggleManualDay = (index: number) => {
    const updated = [...calendarData];
    updated[index].useManual = !updated[index].useManual;
    setCalendarData(updated);
  };

  // Update a field in day status log
  const updateDayField = (index: number, field: keyof DayStatusLog, value: any) => {
    const updated = [...calendarData];
    updated[index] = { ...updated[index], [field]: value };

    if (field === "manualStatus") {
      if (value === "Present" && updated[index].manualHours === 0) {
        updated[index].manualHours = standardHours;
      } else if (value === "HalfDay" && updated[index].manualHours === 0) {
        updated[index].manualHours = standardHours / 2;
      } else if (["Absent", "Holiday", "CL", "SL", "CO", "CompOff", "WeeklyOff"].includes(value)) {
        updated[index].manualHours = 0;
      }
    }

    // Recompute manual OT
    updated[index].manualOtHours = getDailyOtHours(
      updated[index].manualHours || 0,
      updated[index].dayName,
      updated[index].manualStatus === "Holiday" || updated[index].originalStatus === "Holiday",
      emp
    );

    setCalendarData(updated);
  };

  // Save / Generate Salary API call
  const handleSaveSalary = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const payload = {
        employeeId: emp._id,
        month,
        year,
        presentDays: totals.presentDays,
        totalDutyHours: totals.totalDutyHours,
        totalOtHours: totals.totalOtHours,
        otRatePH: totals.baseHourlyRate,
        grossPay: totals.grossPay,
        otPay: totals.otPay,
        netPay: totals.netPay,
        dailyLogs: calendarData,
        leavesConsumed: {
          casualLeave: totals.casualLeaveConsumed,
          sickLeave: totals.sickLeaveConsumed,
          compOff: totals.compOffConsumed,
        },
        compOffAccrued: totals.compOffAccrued,
        salaryComponents: {
          pf: totals.pfDeduction,
          esi: totals.esiDeduction,
          professionalTax: totals.professionalTax,
        },
        employerContributions: {
          pf: totals.employerPF,
          esi: totals.employerESI,
        },
      };

      if (row.hasGenerated && row.existingSalaryId) {
        await axios.put(`${API_BASE_URL}/api/hr/salary/${row.existingSalaryId}`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        alert(`Salary successfully updated for ${emp.name}!`);
      } else {
        await axios.post(`${API_BASE_URL}/api/hr/salary`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        alert(`Salary successfully generated for ${emp.name}!`);
      }

      onSuccess();
    } catch (err: any) {
      console.error("Error saving salary:", err);
      alert(err.response?.data?.message || err.message || "Failed to generate salary.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Top Navigation Bar with Back Button */}
      <div className="bg-white border border-slate-200 dark:bg-slate-800 dark:border-slate-700 p-4 rounded-2xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-1.5 transition-all shadow-sm"
          >
            <ChevronLeft size={16} /> Back to Monthwise Salaries
          </button>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Edit & Review Salary:</span>
              <span className="text-blue-600 dark:text-blue-400">{emp?.name || "Employee"}</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                {month} {year}
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {emp?.designation || "Staff"} &bull; {emp?.department || "General"} &bull;{" "}
              {emp?.employeeType || "Full-Time"} &bull; Standard Shift: {standardHours}h/day
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
          <button
            type="button"
            onClick={initializeData}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            title="Reset to Master Defaults"
          >
            <RefreshCw size={13} /> Reset Defaults
          </button>

          <button
            type="button"
            onClick={handleSaveSalary}
            disabled={saving}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 flex items-center gap-2 transition-all disabled:opacity-50 active:scale-95 cursor-pointer"
          >
            {saving ? <LoadingSpinner /> : <Save size={15} />}
            <span>{row.hasGenerated ? "Update Generated Salary" : "Save & Generate Salary"}</span>
          </button>
        </div>
      </div>

      {/* Grid of Key Analysis Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Card 1: Master Salary & Live Rates */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
              <IndianRupee size={15} className="text-blue-500" />
              Master Salary & Policy
            </h3>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
              Employee Master
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Master Gross Salary</span>
              <span className="font-bold text-slate-800 dark:text-white">
                ₹ {(emp?.salary?.grossSalary || baseSalary || 0).toLocaleString("en-IN")}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Master Basic</span>
              <span className="font-bold text-slate-700 dark:text-slate-300">
                ₹ {(emp?.salary?.basic || 0).toLocaleString("en-IN")}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Daily Divisor Policy</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {totals.dailyDivisorBasis === "TotalMonthDays"
                  ? `Total Month Days (${totals.divisor}d)`
                  : `Working Days (${totals.divisor}d)`}
              </span>
            </div>
            <div className="flex justify-between items-center pt-1.5 border-t border-slate-100 dark:border-slate-700">
              <span className="text-blue-600 dark:text-blue-400 font-bold">Per Day Salary</span>
              <span className="font-extrabold text-blue-700 dark:text-blue-300 text-sm font-mono">
                ₹ {totals.perDaySalary.toLocaleString("en-IN")}/d
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Standard Hourly Rate</span>
              <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                ₹ {totals.baseHourlyRate}/h
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Attendance & Absence Days */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
              <Calendar size={15} className="text-emerald-500" />
              Attendance & Days
            </h3>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              Validated Log
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Total Month Days</span>
              <span className="font-bold text-slate-800 dark:text-white">{totals.totalMonthDays} Days</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Actual Worked Days</span>
              <span className="font-bold text-slate-700 dark:text-slate-300">{totals.workedDays} Days</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Weekly Offs + Holidays</span>
              <span className="font-bold text-slate-700 dark:text-slate-300">
                {totals.weeklyOffsCount + totals.holidaysCount} Days
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-rose-600 dark:text-rose-400 font-semibold">Total Absent Days</span>
              <span className="font-bold text-rose-600 dark:text-rose-400">
                {totals.actualAbsentDays}d ({totals.absentHours}h)
              </span>
            </div>
            <div className="flex justify-between items-center pt-1.5 border-t border-slate-100 dark:border-slate-700">
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">Total Payable Days</span>
              <span className="font-extrabold text-emerald-700 dark:text-emerald-300 text-sm">
                {totals.presentDays} Days
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Overtime Rates & Hours */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
              <Clock size={15} className="text-purple-500" />
              Overtime (OT) Analysis
            </h3>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
              {isOT ? "OT Active" : "No OT"}
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Main OT Hourly Rate</span>
              <span className="font-mono font-bold text-purple-700 dark:text-purple-300">
                {isOT ? `₹ ${totals.mainOtHourlyRate}/h` : "-"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Total Duty Hours</span>
              <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                {totals.totalDutyHours}h
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Total OT Hours</span>
              <span className="font-mono font-bold text-purple-600 dark:text-purple-400">
                {totals.totalOtHours}h
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Compensated for Absences</span>
              <span className="font-mono font-semibold text-orange-600 dark:text-orange-400">
                {totals.compensatedHours}h (₹{totals.otCompensatedPay})
              </span>
            </div>
            <div className="flex justify-between items-center pt-1.5 border-t border-slate-100 dark:border-slate-700">
              <span className="text-purple-600 dark:text-purple-400 font-bold">Total OT Earnings</span>
              <span className="font-extrabold text-purple-700 dark:text-purple-300 text-sm font-mono">
                ₹ {totals.otPay.toLocaleString("en-IN")}
              </span>
            </div>
          </div>
        </div>

        {/* Card 4: Deductions & Net Take-Home */}
        <div className="bg-gradient-to-br from-white to-emerald-50/30 dark:from-slate-800 dark:to-emerald-950/20 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
              <Calculator size={15} className="text-emerald-600" />
              Final Take-Home Pay
            </h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
              Net Summary
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Earned Gross Pay</span>
              <span className="font-bold text-slate-800 dark:text-white">
                ₹ {totals.grossPay.toLocaleString("en-IN")}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">OT Pay Added</span>
              <span className="font-bold text-purple-600 dark:text-purple-400">
                + ₹ {totals.otPay.toLocaleString("en-IN")}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Statutory Deductions</span>
              <span className="font-bold text-rose-600 dark:text-rose-400">
                - ₹ {totals.totalDeductions.toLocaleString("en-IN")}
              </span>
            </div>
            <div className="text-[10.5px] text-slate-400">
              PF: ₹{totals.pfDeduction} &bull; ESI: ₹{totals.esiDeduction} &bull; PT: ₹{totals.professionalTax}
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-700">
              <span className="text-slate-900 dark:text-white font-bold text-sm">Net Payable Salary</span>
              <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-lg font-mono">
                ₹ {totals.netPay.toLocaleString("en-IN")}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Deductions & Statutory Overrides Card */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm">
        <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1.5 mb-3">
          <ShieldCheck size={16} className="text-blue-500" />
          Statutory Deductions & Contributions
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {/* Employee PF */}
          <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="text-[11px] font-semibold text-slate-500 mb-1 flex items-center justify-between">
              <span>Employee PF</span>
              <span className="text-[9.5px] text-slate-400 font-normal">12% Basic</span>
            </div>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">₹</span>
              <input
                type="number"
                min="0"
                value={customPf !== null ? customPf : totals.pfDeduction}
                onChange={(e) => setCustomPf(parseFloat(e.target.value) || 0)}
                className="w-full pl-6 pr-2 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-bold font-mono outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-white"
              />
            </div>
          </div>

          {/* Employee ESI */}
          <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="text-[11px] font-semibold text-slate-500 mb-1 flex items-center justify-between">
              <span>Employee ESI</span>
              <span className="text-[9.5px] text-slate-400 font-normal">0.75% Gross</span>
            </div>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">₹</span>
              <input
                type="number"
                min="0"
                value={customEsi !== null ? customEsi : totals.esiDeduction}
                onChange={(e) => setCustomEsi(parseFloat(e.target.value) || 0)}
                className="w-full pl-6 pr-2 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-bold font-mono outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-white"
              />
            </div>
          </div>

          {/* Professional Tax */}
          <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="text-[11px] font-semibold text-slate-500 mb-1 flex items-center justify-between">
              <span>Professional Tax (PT)</span>
              <span className="text-[9.5px] text-slate-400 font-normal">State Slab</span>
            </div>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">₹</span>
              <input
                type="number"
                min="0"
                value={customPt !== null ? customPt : totals.professionalTax}
                onChange={(e) => setCustomPt(parseFloat(e.target.value) || 0)}
                className="w-full pl-6 pr-2 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-bold font-mono outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-white"
              />
            </div>
          </div>

          {/* Employer PF */}
          <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="text-[11px] font-semibold text-slate-500 mb-1 flex items-center justify-between">
              <span>Employer PF</span>
              <span className="text-[9.5px] text-slate-400 font-normal">12% Contribution</span>
            </div>
            <div className="text-xs font-bold font-mono text-slate-700 dark:text-slate-300 py-1">
              ₹ {totals.employerPF.toLocaleString("en-IN")}
            </div>
          </div>

          {/* Employer ESI */}
          <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="text-[11px] font-semibold text-slate-500 mb-1 flex items-center justify-between">
              <span>Employer ESI</span>
              <span className="text-[9.5px] text-slate-400 font-normal">3.25% Contribution</span>
            </div>
            <div className="text-xs font-bold font-mono text-slate-700 dark:text-slate-300 py-1">
              ₹ {totals.employerESI.toLocaleString("en-IN")}
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Day-by-Day Calendar Grid */}
      <div className="bg-white border border-slate-200 dark:bg-slate-800 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText size={16} className="text-blue-500" />
              Day-by-Day Attendance Verification & Overrides
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Review daily biometric punches and validated statuses. Toggle the manual checkbox to override any day if adjustments are needed.
            </p>
          </div>
          <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/50 px-3 py-1 rounded-xl">
            {calendarData.length} Days in {month}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 uppercase text-[10.5px] font-semibold border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-3.5 py-2.5 w-24">Date & Day</th>
                <th className="px-3.5 py-2.5 min-w-[140px]">Raw Punch Time</th>
                <th className="px-3 py-2.5 w-24">Raw Status</th>
                <th className="px-3 py-2.5 w-20 text-center">Override</th>
                <th className="px-3.5 py-2.5 min-w-[140px]">Working Status</th>
                <th className="px-3 py-2.5 w-24">Duty Hrs</th>
                {isOT && <th className="px-3 py-2.5 w-24">OT Hrs</th>}
                <th className="px-3.5 py-2.5 min-w-[150px]">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {calendarData.map((day, idx) => {
                const dateObj = new Date(day.date);
                const isSunday = dateObj.getDay() === 0;
                const isOff = day.originalStatus === "WeeklyOff" || isSunday;
                const isHol = day.originalStatus === "Holiday";
                const isManualActive = day.useManual;
                const currentStatus = isManualActive ? day.manualStatus : day.originalStatus;
                const currentHours = isManualActive ? day.manualHours : day.originalHours || 0;
                const currentOt = isManualActive ? day.manualOtHours : day.otHours || 0;

                return (
                  <tr
                    key={day.date}
                    className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                      isOff
                        ? "bg-slate-50/50 dark:bg-slate-900/30"
                        : isHol
                        ? "bg-purple-50/30 dark:bg-purple-950/10"
                        : ""
                    }`}
                  >
                    {/* Date & Day */}
                    <td className="px-3.5 py-2">
                      <div className="font-bold text-slate-800 dark:text-slate-200">
                        {String(day.day).padStart(2, "0")} {month.slice(0, 3)}
                      </div>
                      <div
                        className={`text-[10px] font-semibold uppercase ${
                          isSunday
                            ? "text-rose-600 dark:text-rose-400"
                            : "text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        {day.dayName}
                      </div>
                    </td>

                    {/* Raw Punch */}
                    <td className="px-3.5 py-2 font-mono text-[11px]">
                      {day.originalCheckIn ? (
                        <div className="flex items-center gap-1 font-bold">
                          <span className="text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                            {formatPunchTime(day.originalCheckIn)}
                          </span>
                          <span className="text-slate-400">&rarr;</span>
                          <span className="text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-1 py-0.5 rounded border border-rose-200 dark:border-rose-800">
                            {formatPunchTime(day.originalCheckOut)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">
                          {isHol ? "Public Holiday" : isOff ? "Weekly Off" : "No Punch"}
                        </span>
                      )}
                    </td>

                    {/* Raw Status */}
                    <td className="px-3 py-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          day.originalStatus === "Present"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                            : day.originalStatus === "HalfDay"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
                            : day.originalStatus === "Holiday"
                            ? "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300"
                            : day.originalStatus === "WeeklyOff"
                            ? "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                            : "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                        }`}
                      >
                        {day.originalStatus}
                      </span>
                    </td>

                    {/* Override Toggle Checkbox */}
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={isManualActive}
                        onChange={() => toggleManualDay(idx)}
                        className="w-4 h-4 rounded text-blue-600 border-slate-300 dark:border-slate-600 focus:ring-0 cursor-pointer"
                        title="Enable manual adjustment for this date"
                      />
                    </td>

                    {/* Working Status Dropdown */}
                    <td className="px-3.5 py-2">
                      {isManualActive ? (
                        <select
                          value={day.manualStatus}
                          onChange={(e) => updateDayField(idx, "manualStatus", e.target.value)}
                          className="px-2 py-1 rounded-lg border border-blue-400 dark:border-blue-600 bg-white dark:bg-slate-800 text-xs font-semibold outline-none focus:ring-1 focus:ring-blue-500 text-blue-700 dark:text-blue-300"
                        >
                          <option value="Present">Present</option>
                          <option value="Absent">Absent</option>
                          <option value="HalfDay">Half Day</option>
                          <option value="WeeklyOff">Weekly Off</option>
                          <option value="Holiday">Holiday</option>
                          <option value="CL">Casual Leave (CL)</option>
                          <option value="SL">Sick Leave (SL)</option>
                          <option value="CO">Comp Off (CO)</option>
                          <option value="OnDuty">On Duty (OD)</option>
                        </select>
                      ) : (
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {currentStatus}
                        </span>
                      )}
                    </td>

                    {/* Duty Hours */}
                    <td className="px-3 py-2 font-mono">
                      {isManualActive ? (
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="24"
                          value={day.manualHours}
                          onChange={(e) =>
                            updateDayField(idx, "manualHours", parseFloat(e.target.value) || 0)
                          }
                          className="w-16 px-1.5 py-0.5 rounded border border-blue-400 dark:border-blue-600 bg-white dark:bg-slate-800 text-xs font-mono font-bold text-blue-700 dark:text-blue-300 outline-none"
                        />
                      ) : (
                        <span className="font-bold text-slate-700 dark:text-slate-300">
                          {currentHours}h
                        </span>
                      )}
                    </td>

                    {/* OT Hours */}
                    {isOT && (
                      <td className="px-3 py-2 font-mono">
                        {isManualActive ? (
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            max="24"
                            value={day.manualOtHours || 0}
                            onChange={(e) =>
                              updateDayField(idx, "manualOtHours", parseFloat(e.target.value) || 0)
                            }
                            className="w-16 px-1.5 py-0.5 rounded border border-purple-400 dark:border-purple-600 bg-purple-50/50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300 text-xs font-mono font-bold outline-none"
                          />
                        ) : (
                          <span
                            className={`font-semibold ${
                              (currentOt || 0) > 0
                                ? "text-purple-600 dark:text-purple-400 font-bold"
                                : "text-slate-400"
                            }`}
                          >
                            {(currentOt || 0) > 0 ? `+${currentOt}h` : "-"}
                          </span>
                        )}
                      </td>
                    )}

                    {/* Remarks */}
                    <td className="px-3.5 py-2">
                      {isManualActive ? (
                        <input
                          type="text"
                          placeholder="Override reason..."
                          value={day.remarks || ""}
                          onChange={(e) => updateDayField(idx, "remarks", e.target.value)}
                          className="w-full px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">
                          {day.remarks || "-"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sticky Bottom Action Controls Bar */}
      <div className="bg-white border border-slate-200 dark:bg-slate-800 dark:border-slate-700 p-4 rounded-2xl shadow-lg flex flex-col sm:flex-row justify-between items-center gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-sm"
          >
            Cancel & Return
          </button>
          <span className="text-xs text-slate-500">
            {emp?.name} &bull; Net Take-Home:{" "}
            <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-sm">
              ₹ {totals.netPay.toLocaleString("en-IN")}
            </span>
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={initializeData}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 text-xs font-semibold transition-colors"
          >
            Reset Defaults
          </button>

          <button
            type="button"
            onClick={handleSaveSalary}
            disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/25 flex items-center gap-2 transition-all disabled:opacity-50 active:scale-95 cursor-pointer"
          >
            {saving ? <LoadingSpinner /> : <Save size={15} />}
            <span>{row.hasGenerated ? "Update Generated Salary" : "Save & Generate Salary"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

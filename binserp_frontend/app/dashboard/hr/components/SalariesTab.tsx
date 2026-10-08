"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { 
    Search, FileSpreadsheet, FileText, Calendar, IndianRupee, 
    Calculator, RefreshCw, CheckSquare, Square, Download, 
    AlertCircle, CheckCircle, ChevronDown, Clock, Users, 
    Layers, Briefcase, Zap, ShieldAlert, Edit, Trash2, 
    Filter, X, Check, ArrowUpRight, Eye, EyeOff, LayoutDashboard
} from 'lucide-react';
import axios from 'axios';
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { Employee, Salary } from '../types/hr.types';
import LoadingSpinner from '@/src/components/LoadingSpinner';
import EditSalaryModal from './modals/EditSalaryModal';
import DailyLogsModal, { DayStatus } from './modals/DailyLogsModal';
import ExcelColumnFilter from './ExcelColumnFilter';
import { API_BASE_URL } from '@/src/utils/config';
import { formatWorkDuration } from '@/src/utils/attendanceUtils';
import { exportAllSalariesCompanyExcel, exportSingleSalaryCompanyExcel } from '@/src/utils/companySalaryExcelHelper';
import { exportAllSalariesCompanyPDF, exportSingleSalaryCompanyPDF } from '@/src/utils/companySalaryPdfHelper';

const months = [
    "January", "February", "March", "April", "May", "June", 
    "July", "August", "September", "October", "November", "December"
];

interface EnrichedEmployeeRow {
    employee: Employee;
    calendarData: DayStatus[];
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
}

export default function SalariesTab() {
    // 1. Navigation & Period Selection
    const [activeMainTab, setActiveMainTab] = useState<'generator' | 'saved'>('generator');
    const [month, setMonth] = useState(months[new Date().getMonth()]);
    const [year, setYear] = useState(new Date().getFullYear());
    const [showDashboard, setShowDashboard] = useState(false);

    // 2. Raw Data State
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
    const [holidays, setHolidays] = useState<any[]>([]);
    const [savedSalaries, setSavedSalaries] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingSaved, setLoadingSaved] = useState(false);

    // Overrides for manual punches per employee before generating
    const [employeeOverrides, setEmployeeOverrides] = useState<Record<string, DayStatus[]>>({});

    // 3. Selection State for Bulk Generation
    const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
    const [isGeneratingBulk, setIsGeneratingBulk] = useState(false);
    const [overwriteExisting, setOverwriteExisting] = useState(false);
    const [bulkGenerationResult, setBulkGenerationResult] = useState<any>(null);

    // 4. Modals State
    const [editingSalaryData, setEditingSalaryData] = useState<any>(null);
    const [dailyLogsModalEmployee, setDailyLogsModalEmployee] = useState<Employee | null>(null);

    // 5. Company Branding State
    const [companyLogo, setCompanyLogo] = useState<string | null>(null);
    const [companyName, setCompanyName] = useState<string | null>(null);
    const [companyAddress, setCompanyAddress] = useState<string | null>(null);
    const [currency, setCurrency] = useState('₹');

    // 6. Excel Column Filters State for GENERATOR Tab
    const [genSortConfig, setGenSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
    const [colFilterGenEmployee, setColFilterGenEmployee] = useState<string[]>([]);
    const [colFilterGenType, setColFilterGenType] = useState<string[]>([]);
    const [colFilterGenDept, setColFilterGenDept] = useState<string[]>([]);
    const [colFilterGenDesig, setColFilterGenDesig] = useState<string[]>([]);
    // User requirement: status active & inactive, by default should be ACTIVE
    const [colFilterGenStatus, setColFilterGenStatus] = useState<string[]>(['Active']);
    const [colFilterGenDays, setColFilterGenDays] = useState<string[]>([]);
    const [colFilterGenOT, setColFilterGenOT] = useState<string[]>([]);
    const [colFilterGenGross, setColFilterGenGross] = useState<string[]>([]);
    const [colFilterGenNet, setColFilterGenNet] = useState<string[]>([]);
    const [colFilterGenGenStatus, setColFilterGenGenStatus] = useState<string[]>([]);

    // 7. Excel Column Filters State for SAVED Tab
    const [savedSortConfig, setSavedSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
    const [colFilterSavedEmployee, setColFilterSavedEmployee] = useState<string[]>([]);
    const [colFilterSavedType, setColFilterSavedType] = useState<string[]>([]);
    const [colFilterSavedDept, setColFilterSavedDept] = useState<string[]>([]);
    const [colFilterSavedDesig, setColFilterSavedDesig] = useState<string[]>([]);
    const [colFilterSavedDays, setColFilterSavedDays] = useState<string[]>([]);
    const [colFilterSavedOT, setColFilterSavedOT] = useState<string[]>([]);
    const [colFilterSavedBasic, setColFilterSavedBasic] = useState<string[]>([]);
    const [colFilterSavedOTPay, setColFilterSavedOTPay] = useState<string[]>([]);
    const [colFilterSavedNet, setColFilterSavedNet] = useState<string[]>([]);
    const [colFilterSavedRecordStatus, setColFilterSavedRecordStatus] = useState<string[]>([]);
    const [savedSearchTerm, setSavedSearchTerm] = useState('');

    const formatPunchTime = (timeStr?: string | Date) => {
        if (!timeStr) return '-';
        try {
            const d = new Date(timeStr);
            if (isNaN(d.getTime())) return '-';
            return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
        } catch {
            return '-';
        }
    };

    const getDailyOtHours = (hours: number, dayName: string, isHoliday: boolean, emp: any) => {
        if (!emp?.isOTApplicable) return 0;
        const standardHours = emp?.standardWorkingHours || 9;
        const weeklyOff = Array.isArray(emp?.weeklyOff) ? emp.weeklyOff : [emp?.weeklyOff || "Sunday"];
        const holidayWorkPolicy = emp?.holidayWorkPolicy || "Overtime";
        const weekOffWorkPolicy = emp?.weekOffWorkPolicy || "Overtime";

        const daysMap: Record<string, string> = {
            'Sun': 'Sunday', 'Mon': 'Monday', 'Tue': 'Tuesday',
            'Wed': 'Wednesday', 'Thu': 'Thursday', 'Fri': 'Friday', 'Sat': 'Saturday'
        };
        const fullDayName = daysMap[dayName] || dayName;
        const isWeeklyOff = weeklyOff.includes(fullDayName);

        if (isWeeklyOff) {
            return weekOffWorkPolicy === "Overtime" ? hours : 0;
        }
        if (isHoliday) {
            return holidayWorkPolicy === "Overtime" ? hours : 0;
        }
        return Math.max(0, Number((hours - standardHours).toFixed(2)));
    };

    // Fetch Initial Employees & Branding
    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const token = localStorage.getItem('token');
                const [empRes, compRes, prefixRes] = await Promise.all([
                    axios.get(`${API_BASE_URL}/api/hr/employee`, { headers: { Authorization: `Bearer ${token}` } }),
                    axios.get(`${API_BASE_URL}/api/company/me`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
                    axios.get(`${API_BASE_URL}/api/hr-prefix`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null)
                ]);
                setEmployees(empRes.data.employees || []);
                if (prefixRes?.data?.settings?.companyName) {
                    setCompanyName(prefixRes.data.settings.companyName);
                } else if (compRes?.data?.companyName) {
                    setCompanyName(compRes.data.companyName);
                } else if (compRes?.data?.name) {
                    setCompanyName(compRes.data.name);
                }
                if (prefixRes?.data?.settings?.companyLogo) setCompanyLogo(prefixRes.data.settings.companyLogo);
                if (prefixRes?.data?.settings?.companyAddress) setCompanyAddress(prefixRes.data.settings.companyAddress);
                if (prefixRes?.data?.settings?.currency) setCurrency(prefixRes.data.settings.currency);
                else setCurrency('₹');
            } catch (err) {
                console.error("Error loading initial data", err);
            }
        };
        fetchInitialData();
    }, []);

    // Load Month Attendance, Holidays, and Saved Salaries whenever Month or Year changes
    const fetchMonthData = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const monthIndex = months.indexOf(month);
            const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

            const start = new Date(year, monthIndex, 1).toISOString();
            const end = new Date(year, monthIndex, daysInMonth, 23, 59, 59).toISOString();

            const [attRes, holRes, salRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/api/hr/attendance`, {
                    headers: { Authorization: `Bearer ${token}` },
                    params: { startDate: start, endDate: end }
                }),
                axios.get(`${API_BASE_URL}/api/hr/holiday?year=${year}&month=${monthIndex + 1}`, {
                    headers: { Authorization: `Bearer ${token}` }
                }).catch(() => ({ data: [] })),
                axios.get(`${API_BASE_URL}/api/hr/salary`, {
                    headers: { Authorization: `Bearer ${token}` },
                    params: { month, year }
                }).catch(() => ({ data: [] }))
            ]);

            setAttendanceRecords(attRes.data.attendance || []);
            setHolidays(holRes.data || []);
            setSavedSalaries(salRes.data || []);
        } catch (error) {
            console.error("Error loading monthly attendance & salary data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMonthData();
    }, [month, year]);

    // Live multi-employee calculation engine
    const calculatedRows: EnrichedEmployeeRow[] = useMemo(() => {
        const monthIndex = months.indexOf(month);
        const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

        // Index attendance by employee ID
        const attByEmp = new Map<string, any[]>();
        attendanceRecords.forEach(rec => {
            const empId = rec.employee?._id || (typeof rec.employee === 'string' ? rec.employee : null);
            if (empId) {
                if (!attByEmp.has(empId)) attByEmp.set(empId, []);
                attByEmp.get(empId)!.push(rec);
            }
        });

        // Index saved salaries by employee ID
        const savedByEmp = new Map<string, any>();
        savedSalaries.forEach(sal => {
            const empId = sal.employee?._id || (typeof sal.employee === 'string' ? sal.employee : null);
            if (empId) savedByEmp.set(empId, sal);
        });

        return employees.map(emp => {
            const empId = emp._id;
            const empAttList = attByEmp.get(empId) || [];
            const savedSal = savedByEmp.get(empId);

            // If manual overrides exist for this employee, use them; otherwise construct calendar from DB
            let calendar: DayStatus[] = [];
            if (employeeOverrides[empId] && employeeOverrides[empId].length === daysInMonth) {
                calendar = employeeOverrides[empId];
            } else {
                for (let d = 1; d <= daysInMonth; d++) {
                    const dateObj = new Date(year, monthIndex, d);
                    const dateStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });

                    const record = empAttList.find((r: any) => {
                        const rDate = new Date(r.date);
                        return rDate.getDate() === d &&
                            rDate.getMonth() === monthIndex &&
                            rDate.getFullYear() === year;
                    });

                    const holiday = holidays.find(h => {
                        const hDate = new Date(h.date);
                        return hDate.getDate() === d &&
                            hDate.getMonth() === monthIndex &&
                            hDate.getFullYear() === year;
                    });

                    let defaultStatus = record ? record.status : 'Absent';
                    if (!record && holiday) defaultStatus = 'Holiday';

                    let computedHours = record?.hoursWorked || 0;
                    if (!computedHours && record?.checkIn?.time && record?.checkOut?.time) {
                        const diff = new Date(record.checkOut.time).getTime() - new Date(record.checkIn.time).getTime();
                        computedHours = Number((diff / (1000 * 60 * 60)).toFixed(2));
                    }

                    const dailyOt = getDailyOtHours(computedHours, dayName, Boolean(holiday), emp);

                    calendar.push({
                        date: dateStr,
                        day: d,
                        dayName: dayName,
                        originalStatus: defaultStatus,
                        originalCheckIn: record?.checkIn?.time,
                        originalCheckOut: record?.checkOut?.time,
                        originalHours: computedHours,
                        otHours: dailyOt,
                        manualStatus: defaultStatus,
                        manualHours: computedHours,
                        manualOtHours: dailyOt,
                        useManual: false
                    });
                }
            }

            // Calculate Employee Month Stats
            const standardHours = emp?.standardWorkingHours || 9;
            const weeklyOff = Array.isArray(emp?.weeklyOff) ? emp.weeklyOff : [emp?.weeklyOff || "Sunday"];
            const holidayWorkPolicy = emp?.holidayWorkPolicy || "Overtime";
            const weekOffWorkPolicy = emp?.weekOffWorkPolicy || "Overtime";

            let weeklyOffsCount = 0;
            let actualAbsentDays = 0;
            let workedDays = 0;
            let totalDutyHours = 0;
            let totalOtHours = 0;
            let compOffAccrued = 0;
            let casualLeaveConsumed = 0;
            let sickLeaveConsumed = 0;
            let compOffConsumed = 0;
            let holidaysCount = 0;

            calendar.forEach(day => {
                const dateObj = new Date(day.date);
                const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
                const isWeeklyOff = weeklyOff.includes(days[dateObj.getDay()]);
                if (isWeeklyOff) weeklyOffsCount++;

                const status = day.useManual ? day.manualStatus : day.originalStatus;
                const hours = day.useManual ? day.manualHours : (day.originalHours || 0);

                totalDutyHours += hours;

                const isPublicHoliday = day.originalStatus === 'Holiday' || day.manualStatus === 'Holiday';
                if (isPublicHoliday) holidaysCount++;

                if (!isWeeklyOff && !isPublicHoliday) {
                    if (status === 'Absent') actualAbsentDays += 1;
                    else if (status === 'HalfDay') actualAbsentDays += 0.5;
                }

                if (status === 'Present') workedDays += 1;
                else if (status === 'HalfDay') workedDays += 0.5;

                if (status === 'CL') casualLeaveConsumed += 1;
                if (status === 'SL') sickLeaveConsumed += 1;
                if (status === 'CO') compOffConsumed += 1;

                if (isWeeklyOff) {
                    if (hours > 0) {
                        if (weekOffWorkPolicy === "Overtime") totalOtHours += hours;
                        else compOffAccrued += (hours / standardHours);
                    }
                } else if (isPublicHoliday) {
                    if (hours > 0) {
                        if (holidayWorkPolicy === "Overtime") totalOtHours += hours;
                        else compOffAccrued += (hours / standardHours);
                    }
                } else {
                    if (hours > standardHours) {
                        totalOtHours += (hours - standardHours);
                    }
                }
            });

            const effectiveWorkingDays = daysInMonth - weeklyOffsCount;
            const dailyDivisorBasis = emp?.salary?.dailyDivisorBasis || 'TotalMonthDays';
            const divisor = dailyDivisorBasis === 'TotalMonthDays' ? daysInMonth : effectiveWorkingDays;

            const payableDays = Math.max(0, divisor - actualAbsentDays);
            const absentHours = actualAbsentDays * standardHours;

            // Salary Base
            const perDayBasis = emp?.salary?.perDayCalculationBasis || 'Gross';
            let baseSalary = 0;
            if (perDayBasis === 'Basic') baseSalary = emp?.salary?.basic || 0;
            else if (perDayBasis === 'Net') baseSalary = emp?.salary?.netSalary || 0;
            else baseSalary = emp?.salary?.grossSalary || 0;

            const baseHourlyRate = divisor > 0 && standardHours > 0 ? (baseSalary / divisor) / standardHours : 0;

            // Overtime Pay Calculation
            const isOT = Boolean(emp?.isOTApplicable);
            const otCompensateForAbsent = emp?.otCompensateForAbsent ?? true;
            const mainOTRateMultiplier = emp?.salary?.otRate || 1.0;
            const absentOTRateMultiplier = emp?.absentOTRate || 1.0;

            const otCalcBasis = emp?.salary?.otCalculationBasis || 'Basic';
            let otBaseSalary = 0;
            if (otCalcBasis === 'Basic') otBaseSalary = emp?.salary?.basic || 0;
            else if (otCalcBasis === 'Gross') otBaseSalary = emp?.salary?.grossSalary || 0;
            else if (otCalcBasis === 'Net') otBaseSalary = emp?.salary?.netSalary || 0;

            const otDivBasis = emp?.salary?.otDivisorBasis || 'TotalMonthDays';
            const otDivisor = otDivBasis === 'TotalMonthDays' ? daysInMonth : effectiveWorkingDays;
            const otHourlyRate = otDivisor > 0 && standardHours > 0 ? (otBaseSalary / otDivisor) / standardHours : 0;

            let otPay = 0;
            if (isOT) {
                if (otCompensateForAbsent) {
                    const compensatedHours = Math.min(totalOtHours, absentHours);
                    const mainOtHours = totalOtHours - compensatedHours;
                    otPay = (compensatedHours * otHourlyRate * 1.0) + (mainOtHours * otHourlyRate * mainOTRateMultiplier);
                } else {
                    const absentOtHours = Math.min(totalOtHours, absentHours);
                    const mainOtHours = totalOtHours - absentOtHours;
                    otPay = (absentOtHours * otHourlyRate * absentOTRateMultiplier) + (mainOtHours * otHourlyRate * mainOTRateMultiplier);
                }
            }

            // Deductions & Pay
            const ratio = divisor > 0 ? (payableDays / divisor) : 0;
            const earnedBasic = (emp?.salary?.basic || 0) * ratio;
            const earnedGross = (emp?.salary?.grossSalary || 0) * ratio;

            const isPFApplicable = emp?.salary?.isPFApplicable || false;
            const isESIApplicable = emp?.salary?.isESIApplicable || false;
            const isPTApplicable = emp?.salary?.isPTApplicable || false;

            const pfDeduction = (emp?.salary?.pf && emp.salary.pf > 0)
                ? emp.salary.pf
                : (isPFApplicable ? earnedBasic * 0.12 : 0);

            const esiDeduction = (emp?.salary?.esi && emp.salary.esi > 0)
                ? emp.salary.esi
                : (isESIApplicable ? earnedGross * 0.0075 : 0);

            const employerPF = isPFApplicable ? earnedBasic * 0.12 : 0;
            const employerESI = isESIApplicable ? earnedGross * 0.0325 : 0;

            const pt = (emp?.salary?.professionalTax && emp.salary.professionalTax > 0)
                ? emp.salary.professionalTax
                : (isPTApplicable ? 200 : 0);

            const grossPay = divisor > 0 ? (baseSalary / divisor) * payableDays : 0;
            const netPay = Math.round(grossPay + otPay - (pfDeduction + esiDeduction + pt));

            return {
                employee: emp,
                calendarData: calendar,
                totalMonthDays: daysInMonth,
                workedDays,
                payableDays: Math.round(payableDays * 10) / 10,
                actualAbsentDays,
                weeklyOffsCount,
                holidaysCount,
                isOTApplicable: isOT,
                totalOtHours: Math.round(totalOtHours * 10) / 10,
                otPay: Math.round(otPay),
                grossPay: Math.round(grossPay),
                baseGrossSalary: emp?.salary?.grossSalary || baseSalary,
                pfDeduction: Math.round(pfDeduction),
                esiDeduction: Math.round(esiDeduction),
                employerPF: Math.round(employerPF),
                employerESI: Math.round(employerESI),
                professionalTax: pt,
                netPay,
                hasGenerated: Boolean(savedSal),
                existingSalaryId: savedSal?._id,
                totalDutyHours: Math.round(totalDutyHours * 10) / 10,
                baseHourlyRate,
                casualLeaveConsumed,
                sickLeaveConsumed,
                compOffConsumed,
                compOffAccrued
            };
        });
    }, [employees, attendanceRecords, holidays, savedSalaries, employeeOverrides, month, year]);

    // Check if any filter is active in generator
    const isAnyGenFilterActive = useMemo(() => {
        return (
            colFilterGenEmployee.length > 0 ||
            colFilterGenType.length > 0 ||
            colFilterGenDept.length > 0 ||
            colFilterGenDesig.length > 0 ||
            colFilterGenStatus.length > 0 ||
            colFilterGenDays.length > 0 ||
            colFilterGenOT.length > 0 ||
            colFilterGenGross.length > 0 ||
            colFilterGenNet.length > 0 ||
            colFilterGenGenStatus.length > 0 ||
            Boolean(genSortConfig)
        );
    }, [
        colFilterGenEmployee, colFilterGenType, colFilterGenDept, colFilterGenDesig,
        colFilterGenStatus, colFilterGenDays, colFilterGenOT, colFilterGenGross,
        colFilterGenNet, colFilterGenGenStatus, genSortConfig
    ]);

    const handleResetGenFilters = () => {
        setColFilterGenEmployee([]);
        setColFilterGenType([]);
        setColFilterGenDept([]);
        setColFilterGenDesig([]);
        setColFilterGenStatus(['Active']); // keep active as default
        setColFilterGenDays([]);
        setColFilterGenOT([]);
        setColFilterGenGross([]);
        setColFilterGenNet([]);
        setColFilterGenGenStatus([]);
        setGenSortConfig(null);
    };

    // Filter & Sort for Generator Table
    const filteredGeneratorRows = useMemo(() => {
        let list = calculatedRows.filter(row => {
            const emp = row.employee;
            const empDisplay = `${emp.name} (${emp.employeeId})`;
            const empType = emp.employeeType || 'Full-Time';
            const dept = emp.department || '(Blanks)';
            const desig = emp.designation || '(Blanks)';
            const st = emp.status || (emp.isActive ? 'Active' : 'Inactive');
            const daysStr = `${row.payableDays} Days`;
            const otStr = row.isOTApplicable ? 'Yes' : 'No';
            const genStr = row.hasGenerated ? 'Generated' : 'Pending';

            if (colFilterGenEmployee.length > 0 && !colFilterGenEmployee.includes(empDisplay) && !colFilterGenEmployee.includes(emp.name)) return false;
            if (colFilterGenType.length > 0 && !colFilterGenType.includes(empType)) return false;
            if (colFilterGenDept.length > 0 && !colFilterGenDept.includes(dept)) return false;
            if (colFilterGenDesig.length > 0 && !colFilterGenDesig.includes(desig)) return false;
            if (colFilterGenStatus.length > 0 && !colFilterGenStatus.includes(st)) return false;
            if (colFilterGenDays.length > 0 && !colFilterGenDays.includes(daysStr)) return false;
            if (colFilterGenOT.length > 0 && !colFilterGenOT.includes(otStr)) return false;
            if (colFilterGenGenStatus.length > 0 && !colFilterGenGenStatus.includes(genStr)) return false;

            return true;
        });

        // Sorting
        if (genSortConfig) {
            const { key, direction } = genSortConfig;
            list = [...list].sort((a, b) => {
                let valA: any = '';
                let valB: any = '';

                if (key === 'employee') {
                    valA = a.employee.name.toLowerCase();
                    valB = b.employee.name.toLowerCase();
                } else if (key === 'employeeType') {
                    valA = (a.employee.employeeType || '').toLowerCase();
                    valB = (b.employee.employeeType || '').toLowerCase();
                } else if (key === 'department') {
                    valA = (a.employee.department || '').toLowerCase();
                    valB = (b.employee.department || '').toLowerCase();
                } else if (key === 'designation') {
                    valA = (a.employee.designation || '').toLowerCase();
                    valB = (b.employee.designation || '').toLowerCase();
                } else if (key === 'status') {
                    valA = (a.employee.status || '').toLowerCase();
                    valB = (b.employee.status || '').toLowerCase();
                } else if (key === 'workingDays') {
                    valA = a.payableDays;
                    valB = b.payableDays;
                } else if (key === 'otApplied') {
                    valA = a.isOTApplicable ? 1 : 0;
                    valB = b.isOTApplicable ? 1 : 0;
                } else if (key === 'grossPay') {
                    valA = a.grossPay;
                    valB = b.grossPay;
                } else if (key === 'netPay') {
                    valA = a.netPay;
                    valB = b.netPay;
                } else if (key === 'genStatus') {
                    valA = a.hasGenerated ? 1 : 0;
                    valB = b.hasGenerated ? 1 : 0;
                }

                if (typeof valA === 'number' && typeof valB === 'number') {
                    return direction === 'asc' ? valA - valB : valB - valA;
                }
                return direction === 'asc' ? String(valA).localeCompare(String(valB)) : String(valB).localeCompare(String(valA));
            });
        }

        return list;
    }, [
        calculatedRows, colFilterGenEmployee, colFilterGenType, colFilterGenDept,
        colFilterGenDesig, colFilterGenStatus, colFilterGenDays, colFilterGenOT,
        colFilterGenGenStatus, genSortConfig
    ]);

    // Checkbox multi-select logic
    const isAllVisibleSelected = useMemo(() => {
        if (filteredGeneratorRows.length === 0) return false;
        return filteredGeneratorRows.every(r => selectedEmployeeIds.includes(r.employee._id));
    }, [filteredGeneratorRows, selectedEmployeeIds]);

    const handleToggleSelectAllVisible = () => {
        if (isAllVisibleSelected) {
            const visibleIds = new Set(filteredGeneratorRows.map(r => r.employee._id));
            setSelectedEmployeeIds(prev => prev.filter(id => !visibleIds.has(id)));
        } else {
            const newSelected = new Set(selectedEmployeeIds);
            filteredGeneratorRows.forEach(r => newSelected.add(r.employee._id));
            setSelectedEmployeeIds(Array.from(newSelected));
        }
    };

    const handleToggleSelectRow = (empId: string) => {
        setSelectedEmployeeIds(prev => 
            prev.includes(empId) ? prev.filter(id => id !== empId) : [...prev, empId]
        );
    };

    const handleSelectAllActivePending = () => {
        const pendingActive = calculatedRows
            .filter(r => (r.employee.status === 'Active' || r.employee.isActive) && !r.hasGenerated)
            .map(r => r.employee._id);
        setSelectedEmployeeIds(pendingActive);
    };

    // Bulk Generation Handlers
    const handleTriggerBulkGenerate = () => {
        if (selectedEmployeeIds.length === 0) {
            alert("Please select at least one employee from the list to generate salaries.");
            return;
        }
        setBulkGenerationResult(null);
        setIsBulkModalOpen(true);
    };

    const handleConfirmBulkGenerate = async () => {
        setIsGeneratingBulk(true);
        try {
            const token = localStorage.getItem('token');
            const selectedRows = calculatedRows.filter(r => selectedEmployeeIds.includes(r.employee._id));

            const payloads = selectedRows.map(row => ({
                employeeId: row.employee._id,
                month,
                year,
                workingDays: row.totalMonthDays,
                presentDays: row.payableDays,
                totalDutyHours: row.totalDutyHours,
                totalOtHours: row.totalOtHours,
                otRatePH: row.baseHourlyRate,
                grossPay: row.grossPay,
                otPay: row.otPay,
                netPay: row.netPay,
                dailyLogs: row.calendarData,
                leavesConsumed: {
                    casualLeave: row.casualLeaveConsumed,
                    sickLeave: row.sickLeaveConsumed,
                    compOff: row.compOffConsumed
                },
                compOffAccrued: row.compOffAccrued,
                salaryComponents: {
                    basic: row.employee.salary?.basic || 0,
                    hra: row.employee.salary?.hra || 0,
                    conveyance: row.employee.salary?.conveyance || 0,
                    medical: row.employee.salary?.medical || 0,
                    specialAllowance: row.employee.salary?.specialAllowance || 0,
                    pf: row.pfDeduction,
                    esi: row.esiDeduction,
                    professionalTax: row.professionalTax
                },
                employerContributions: {
                    pf: row.employerPF,
                    esi: row.employerESI
                }
            }));

            const res = await axios.post(`${API_BASE_URL}/api/hr/salary/bulk`, {
                month,
                year,
                salaries: payloads,
                overwrite: overwriteExisting
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setBulkGenerationResult(res.data);
            await fetchMonthData();
        } catch (error: any) {
            console.error("Bulk generation error:", error);
            const msg = error.response?.data?.message || error.message || "Failed to generate salaries";
            alert(`Bulk generation error: ${msg}`);
        } finally {
            setIsGeneratingBulk(false);
        }
    };

    // Filter & Sort for SAVED SALARIES Table
    const isAnySavedFilterActive = useMemo(() => {
        return (
            colFilterSavedEmployee.length > 0 ||
            colFilterSavedType.length > 0 ||
            colFilterSavedDept.length > 0 ||
            colFilterSavedDesig.length > 0 ||
            colFilterSavedDays.length > 0 ||
            colFilterSavedOT.length > 0 ||
            colFilterSavedBasic.length > 0 ||
            colFilterSavedOTPay.length > 0 ||
            colFilterSavedNet.length > 0 ||
            colFilterSavedRecordStatus.length > 0 ||
            Boolean(savedSearchTerm) ||
            Boolean(savedSortConfig)
        );
    }, [
        colFilterSavedEmployee, colFilterSavedType, colFilterSavedDept, colFilterSavedDesig,
        colFilterSavedDays, colFilterSavedOT, colFilterSavedBasic, colFilterSavedOTPay,
        colFilterSavedNet, colFilterSavedRecordStatus, savedSearchTerm, savedSortConfig
    ]);

    const handleResetSavedFilters = () => {
        setColFilterSavedEmployee([]);
        setColFilterSavedType([]);
        setColFilterSavedDept([]);
        setColFilterSavedDesig([]);
        setColFilterSavedDays([]);
        setColFilterSavedOT([]);
        setColFilterSavedBasic([]);
        setColFilterSavedOTPay([]);
        setColFilterSavedNet([]);
        setColFilterSavedRecordStatus([]);
        setSavedSearchTerm('');
        setSavedSortConfig(null);
    };

    const filteredSavedSalaries = useMemo(() => {
        let list = savedSalaries.filter(sal => {
            const emp = typeof sal.employee === 'string' 
                ? employees.find(e => e._id === sal.employee) || {} 
                : sal.employee || {};

            const empName = emp.name || 'Unknown';
            const empId = emp.employeeId || '';
            const empDisplay = `${empName} (${empId})`;
            const empType = emp.employeeType || 'Full-Time';
            const dept = emp.department || '(Blanks)';
            const desig = emp.designation || '(Blanks)';
            const daysStr = `${sal.presentDays} Days`;
            const otStr = emp.isOTApplicable ? 'Yes' : 'No';
            const recStatus = sal.status || 'Draft';

            // Global search input
            if (savedSearchTerm) {
                const term = savedSearchTerm.toLowerCase();
                const matchName = empName.toLowerCase().includes(term);
                const matchId = empId.toLowerCase().includes(term);
                const matchDept = dept.toLowerCase().includes(term);
                if (!matchName && !matchId && !matchDept) return false;
            }

            if (colFilterSavedEmployee.length > 0 && !colFilterSavedEmployee.includes(empDisplay) && !colFilterSavedEmployee.includes(empName)) return false;
            if (colFilterSavedType.length > 0 && !colFilterSavedType.includes(empType)) return false;
            if (colFilterSavedDept.length > 0 && !colFilterSavedDept.includes(dept)) return false;
            if (colFilterSavedDesig.length > 0 && !colFilterSavedDesig.includes(desig)) return false;
            if (colFilterSavedDays.length > 0 && !colFilterSavedDays.includes(daysStr)) return false;
            if (colFilterSavedOT.length > 0 && !colFilterSavedOT.includes(otStr)) return false;
            if (colFilterSavedRecordStatus.length > 0 && !colFilterSavedRecordStatus.includes(recStatus)) return false;

            return true;
        });

        // Saved Sorting
        if (savedSortConfig) {
            const { key, direction } = savedSortConfig;
            list = [...list].sort((a, b) => {
                const empA = typeof a.employee === 'string' ? employees.find(e => e._id === a.employee) : a.employee;
                const empB = typeof b.employee === 'string' ? employees.find(e => e._id === b.employee) : b.employee;

                let valA: any = '';
                let valB: any = '';

                if (key === 'employee') {
                    valA = (empA?.name || '').toLowerCase();
                    valB = (empB?.name || '').toLowerCase();
                } else if (key === 'department') {
                    valA = (empA?.department || '').toLowerCase();
                    valB = (empB?.department || '').toLowerCase();
                } else if (key === 'designation') {
                    valA = (empA?.designation || '').toLowerCase();
                    valB = (empB?.designation || '').toLowerCase();
                } else if (key === 'employeeType') {
                    valA = (empA?.employeeType || '').toLowerCase();
                    valB = (empB?.employeeType || '').toLowerCase();
                } else if (key === 'presentDays') {
                    valA = a.presentDays || 0;
                    valB = b.presentDays || 0;
                } else if (key === 'basicPay') {
                    valA = a.grossSalary || 0;
                    valB = b.grossSalary || 0;
                } else if (key === 'otPay') {
                    valA = a.overtime?.amount || 0;
                    valB = b.overtime?.amount || 0;
                } else if (key === 'netPay') {
                    valA = a.netSalary || 0;
                    valB = b.netSalary || 0;
                } else if (key === 'recordStatus') {
                    valA = (a.status || '').toLowerCase();
                    valB = (b.status || '').toLowerCase();
                } else if (key === 'createdAt') {
                    valA = new Date(a.createdAt || 0).getTime();
                    valB = new Date(b.createdAt || 0).getTime();
                }

                if (typeof valA === 'number' && typeof valB === 'number') {
                    return direction === 'asc' ? valA - valB : valB - valA;
                }
                return direction === 'asc' ? String(valA).localeCompare(String(valB)) : String(valB).localeCompare(String(valA));
            });
        }

        return list;
    }, [
        savedSalaries, employees, savedSearchTerm, colFilterSavedEmployee,
        colFilterSavedType, colFilterSavedDept, colFilterSavedDesig, colFilterSavedDays,
        colFilterSavedOT, colFilterSavedRecordStatus, savedSortConfig
    ]);

    // EXCEL EXPORT for Saved Salaries
    const handleDownloadSavedExcel = () => {
        if (filteredSavedSalaries.length === 0) {
            alert("No saved salary records found to export.");
            return;
        }

        const excelRows = filteredSavedSalaries.map((sal, index) => {
            const empId = typeof sal.employee === 'string' ? sal.employee : sal.employee?._id;
            const fullEmp = employees.find(e => e._id === empId) || sal.employee || {};

            return {
                "S.No": index + 1,
                "Employee ID": fullEmp.employeeId || "-",
                "Employee Name": fullEmp.name || "Unknown",
                "Employee Type": fullEmp.employeeType || "Full-Time",
                "Department": fullEmp.department || "-",
                "Designation": fullEmp.designation || "-",
                "Month": sal.month,
                "Year": sal.year,
                "Present Days": sal.presentDays || 0,
                "Duty Hours": sal.totalDutyHours || 0,
                "OT Applicable": fullEmp.isOTApplicable ? "Yes" : "No",
                "OT Hours": sal.overtime?.hours || 0,
                "OT Hourly Rate (₹)": sal.otRatePH || sal.overtime?.rate || 0,
                "OT Pay (₹)": sal.overtime?.amount || 0,
                "Basic Pay (₹)": sal.salaryComponents?.basic || fullEmp.salary?.basic || 0,
                "HRA (₹)": sal.salaryComponents?.hra || fullEmp.salary?.hra || 0,
                "Conveyance (₹)": sal.salaryComponents?.conveyance || fullEmp.salary?.conveyance || 0,
                "Medical (₹)": sal.salaryComponents?.medical || fullEmp.salary?.medical || 0,
                "Special Allowance (₹)": sal.salaryComponents?.specialAllowance || fullEmp.salary?.specialAllowance || 0,
                "Gross Salary (₹)": sal.grossSalary || 0,
                "Employee PF (₹)": sal.salaryComponents?.pf || 0,
                "Employee ESI (₹)": sal.salaryComponents?.esi || 0,
                "Professional Tax (₹)": sal.salaryComponents?.professionalTax || 0,
                "Employer PF (₹)": sal.employerContributions?.pf || 0,
                "Employer ESI (₹)": sal.employerContributions?.esi || 0,
                "Net Salary (₹)": sal.netSalary || 0,
                "Status": sal.status || "Draft",
                "Generated Date": sal.createdAt ? new Date(sal.createdAt).toLocaleDateString() : "-",
                "Generated By": sal.generatedBy?.name || "System"
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(excelRows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, `Salaries_${month}_${year}`);
        XLSX.writeFile(workbook, `Payroll_Salaries_${month}_${year}.xlsx`);
    };

    // PDF Slip Download
    const handleDownloadSavedPDF = (salary: any, slipType: 'Combined' | 'Salary' | 'Overtime') => {
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const empId = typeof salary.employee === 'string' ? salary.employee : salary.employee?._id;
        const fullEmpData = employees.find(e => e._id === empId);
        const emp = fullEmpData || salary.employee;
        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();
        const margin = 10;

        const isOT = Boolean(emp?.isOTApplicable);
        const cur = (currency === '₹' || !currency) ? 'Rs.' : currency;

        const primaryColor: [number, number, number] = [30, 41, 59];
        const neutralBg: [number, number, number] = [248, 250, 252];
        const lightBorder: [number, number, number] = [226, 232, 240];

        const drawHeader = () => {
            doc.setFillColor(...primaryColor);
            doc.rect(0, 0, pageW, 20, 'F');
            doc.setTextColor(255, 255, 255);

            const hasLogo = !!companyLogo;
            const logoSize = 14;
            const logoX = margin;
            const logoY = 3;

            if (hasLogo) {
                try {
                    doc.addImage(companyLogo!, 'JPEG', logoX, logoY, logoSize, logoSize, undefined, 'FAST');
                } catch { }
            }

            const nameX = hasLogo ? margin + logoSize + 3 : margin;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(13);
            doc.text(companyName || 'Company', nameX, 10);

            if (companyAddress) {
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(6.5);
                doc.text(companyAddress, nameX, 16, { maxWidth: 75 });
            }

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10.5);
            const title = slipType === 'Overtime' 
                ? 'Monthly Overtime Statement' 
                : slipType === 'Salary' 
                ? 'Monthly Salary Slip' 
                : 'Monthly Salary & Overtime Slip';
            doc.text(title, pageW / 2, 11, { align: 'center' });

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8.5);
            doc.text(`${salary.month} ${salary.year}`, pageW - margin, 9, { align: 'right' });
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6.5);
            doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, pageW - margin, 15, { align: 'right' });

            doc.setFillColor(...neutralBg);
            doc.rect(0, 20, pageW, 12, 'F');
            doc.setDrawColor(...lightBorder);
            doc.line(0, 32, pageW, 32);

            doc.setTextColor(15, 23, 42);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.text(emp?.name || '-', margin, 27.5);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor(71, 85, 105);
            const empInfo = `ID: ${emp?.employeeId || '-'}  |  Dept: ${emp?.department || '-'}  |  Desig: ${emp?.designation || '-'}`;
            doc.text(empInfo, pageW - margin, 27.5, { align: 'right' });
        };

        drawHeader();

        let displayGrossPay = salary.grossSalary || 0;
        let displayOtPay = salary.overtime?.amount || 0;

        if (slipType === 'Overtime') displayGrossPay = 0;
        else if (slipType === 'Salary') displayOtPay = 0;
        
        const displayNetPay = displayGrossPay + displayOtPay;

        const basicPay = emp?.salary?.basic || 0;
        const hra = emp?.salary?.hra || 0;
        const conv = emp?.salary?.conveyance || 0;
        const med = emp?.salary?.medical || 0;
        const spl = emp?.salary?.specialAllowance || 0;

        const pfDeduction = salary.salaryComponents?.pf || 0;
        const esiDeduction = salary.salaryComponents?.esi || 0;
        const pt = salary.salaryComponents?.professionalTax || 0;

        const employerPF = salary.employerContributions?.pf || 0;
        const employerESI = salary.employerContributions?.esi || 0;

        if (slipType !== 'Overtime') {
            const earningsRows: [string, string, string, string][] = [
                ['Basic Pay', `${cur} ${basicPay.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, 'Provident Fund (PF)', `${cur} ${pfDeduction.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`],
                ['HRA', `${cur} ${hra.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, 'ESI', `${cur} ${esiDeduction.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`],
                ['Conveyance', `${cur} ${conv.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, 'Professional Tax', `${cur} ${pt.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`],
                ['Medical', `${cur} ${med.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, '', ''],
                ['Special Allowance', `${cur} ${spl.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, '', ''],
            ];

            if (slipType === 'Combined' && isOT) {
                earningsRows.push(['Overtime Pay', `${cur} ${displayOtPay.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, '', '']);
            }

            earningsRows.push([
                'Total Earnings', 
                `${cur} ${(displayGrossPay + (slipType === 'Combined' ? displayOtPay : 0)).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, 
                'Total Deductions', 
                `${cur} ${(pfDeduction + esiDeduction + pt).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
            ]);

            autoTable(doc, {
                startY: 36,
                margin: { left: margin, right: margin },
                head: [['Earnings Component', 'Amount', 'Deductions Component', 'Amount']],
                body: earningsRows,
                theme: 'grid',
                headStyles: { fillColor: [241, 245, 249], textColor: [51, 65, 85], fontStyle: 'bold', fontSize: 7.5 },
                styles: { fontSize: 7, cellPadding: 1.5, valign: 'middle' },
                columnStyles: {
                    0: { fontStyle: 'bold' },
                    1: { halign: 'right' },
                    2: { fontStyle: 'bold' },
                    3: { halign: 'right' },
                },
                didParseCell: (data) => {
                    if (data.row.index === earningsRows.length - 1) {
                        data.cell.styles.fontStyle = 'bold';
                        data.cell.styles.fillColor = [248, 250, 252];
                    }
                }
            });

            const nextY = (doc as any).lastAutoTable.finalY + 3;

            if (employerPF > 0 || employerESI > 0) {
                autoTable(doc, {
                    startY: nextY,
                    margin: { left: margin, right: margin },
                    head: [['Employer Contributions (Not Deducted from Net Pay)', 'Amount']],
                    body: [
                        ['Employer PF (12%)', `${cur} ${employerPF.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`],
                        ['Employer ESI (3.25%)', `${cur} ${employerESI.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`],
                    ],
                    theme: 'grid',
                    headStyles: { fillColor: [241, 245, 249], textColor: [51, 65, 85], fontStyle: 'bold', fontSize: 7 },
                    styles: { fontSize: 6.8, cellPadding: 1.2 },
                    columnStyles: { 1: { halign: 'right' } }
                });
            }
        }

        const netY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 4 : 36;
        doc.setFillColor(238, 242, 255);
        doc.rect(margin, netY, pageW - 2 * margin, 8, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(30, 41, 59);
        doc.text('NET SALARY PAYABLE:', margin + 4, netY + 5.5);
        doc.setTextColor(79, 70, 229);
        doc.text(
            `${cur} ${displayNetPay.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`,
            pageW - margin - 4,
            netY + 5.5,
            { align: 'right' }
        );

        // Daily logs breakdown
        const tableBody = (salary.dailyLogs || []).map((d: any) => {
            const finalStatus = d.useManual ? d.manualStatus : d.originalStatus;
            const finalHours = d.useManual ? (d.manualHours ?? 0) : (d.originalHours ?? 0);
            const checkInFormatted = formatPunchTime(d.originalCheckIn);
            const checkOutFormatted = formatPunchTime(d.originalCheckOut);
            
            const dailyOt = d.useManual 
                ? (d.manualOtHours ?? getDailyOtHours(finalHours, d.dayName, d.manualStatus === 'Holiday' || d.originalStatus === 'Holiday', emp))
                : (d.otHours ?? getDailyOtHours(finalHours, d.dayName, d.originalStatus === 'Holiday', emp));

            const statusText = d.useManual ? `${finalStatus} (M)` : (finalStatus || 'Absent');

            if (isOT) {
                return [
                    d.date, d.dayName, checkInFormatted, checkOutFormatted, statusText,
                    finalHours > 0 ? `${finalHours.toFixed(1)}h` : '0h',
                    dailyOt > 0 ? `${dailyOt.toFixed(1)}h` : '-',
                ];
            } else {
                return [
                    d.date, d.dayName, checkInFormatted, checkOutFormatted, statusText,
                    finalHours > 0 ? `${finalHours.toFixed(1)}h` : '0h',
                ];
            }
        });

        const tableHead = isOT
            ? [['Date', 'Day', 'Check-In', 'Check-Out', 'Status', 'Total Duty Hrs', 'OT Hrs']]
            : [['Date', 'Day', 'Check-In', 'Check-Out', 'Status', 'Total Duty Hrs']];

        autoTable(doc, {
            startY: netY + 11,
            margin: { left: margin, right: margin },
            head: tableHead,
            body: tableBody,
            theme: 'grid',
            styles: { 
                fontSize: 6.5, cellPadding: 1.1, halign: 'center', valign: 'middle',
                textColor: [30, 41, 59], lineColor: [226, 232, 240], lineWidth: 0.1
            },
            headStyles: { 
                fillColor: [71, 85, 105], textColor: 255, fontStyle: 'bold', fontSize: 6.8, cellPadding: 1.4 
            },
            columnStyles: isOT ? {
                0: { cellWidth: 26 }, 1: { cellWidth: 16 }, 2: { cellWidth: 26 },
                3: { cellWidth: 26 }, 4: { cellWidth: 36 }, 5: { cellWidth: 30, fontStyle: 'bold' },
                6: { cellWidth: 30, fontStyle: 'bold', textColor: [124, 58, 237] },
            } : {
                0: { cellWidth: 30 }, 1: { cellWidth: 20 }, 2: { cellWidth: 32 },
                3: { cellWidth: 32 }, 4: { cellWidth: 42 }, 5: { cellWidth: 34, fontStyle: 'bold' },
            }
        });

        const finalY = (doc as any).lastAutoTable?.finalY || pageH - 15;
        if (finalY + 12 < pageH) {
            doc.setDrawColor(200, 200, 200);
            doc.line(margin, finalY + 5, pageW - margin, finalY + 5);
            doc.setFontSize(6.5);
            doc.setTextColor(140);
            doc.text('This is a computer-generated document and does not require a physical signature.', margin, finalY + 9.5);
            doc.text(companyName || '', pageW - margin, finalY + 9.5, { align: 'right' });
        }

        const filePrefix = slipType === 'Combined' ? 'Salary_OT_Slip' : slipType === 'Overtime' ? 'OT_Statement' : 'SalarySlip';
        doc.save(`${filePrefix}_${emp?.name || 'Employee'}_${salary.month}_${salary.year}.pdf`);
    };

    const handleDeleteSavedSalary = async (id: string) => {
        if (!confirm("Are you sure you want to delete this salary record?")) return;
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`${API_BASE_URL}/api/hr/salary/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSavedSalaries(prev => prev.filter(s => s._id !== id));
            alert("Salary record deleted.");
        } catch (error) {
            console.error("Error deleting salary:", error);
            alert("Failed to delete salary record.");
        }
    };

    // Quick single employee generation
    const handleGenerateSingle = async (row: EnrichedEmployeeRow) => {
        try {
            const token = localStorage.getItem('token');
            const payload = {
                employeeId: row.employee._id,
                month,
                year,
                presentDays: row.payableDays,
                totalDutyHours: row.totalDutyHours,
                totalOtHours: row.totalOtHours,
                otRatePH: row.baseHourlyRate,
                grossPay: row.grossPay,
                otPay: row.otPay,
                netPay: row.netPay,
                dailyLogs: row.calendarData,
                leavesConsumed: {
                    casualLeave: row.casualLeaveConsumed,
                    sickLeave: row.sickLeaveConsumed,
                    compOff: row.compOffConsumed
                },
                compOffAccrued: row.compOffAccrued,
                salaryComponents: {
                    pf: row.pfDeduction,
                    esi: row.esiDeduction,
                    professionalTax: row.professionalTax
                },
                employerContributions: {
                    pf: row.employerPF,
                    esi: row.employerESI
                }
            };

            if (row.existingSalaryId) {
                await axios.put(`${API_BASE_URL}/api/hr/salary/${row.existingSalaryId}`, payload, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                alert(`Salary updated for ${row.employee.name}!`);
            } else {
                await axios.post(`${API_BASE_URL}/api/hr/salary`, payload, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                alert(`Salary generated for ${row.employee.name}!`);
            }
            await fetchMonthData();
        } catch (error: any) {
            console.error("Error generating single salary:", error);
            alert(`Failed to save salary: ${error.response?.data?.message || error.message}`);
        }
    };

    // Computed Counts for Metric Cards
    const totalEmployeesCount = employees.length;
    const activeEmployeesCount = employees.filter(e => e.status === 'Active' || e.isActive).length;
    const generatedCount = calculatedRows.filter(r => r.hasGenerated).length;
    const pendingCount = calculatedRows.filter(r => !r.hasGenerated).length;

    return (
        <div className="animate-in duration-300 fade-in space-y-6">
            
            {/* Top Bar: Tabs & Period Selector */}
            <div className="bg-white border border-slate-200 dark:bg-slate-800 dark:border-slate-700 p-4 rounded-2xl shadow-sm flex flex-col xl:flex-row justify-between items-center gap-4 relative z-20">
                <div className="flex gap-2 w-full xl:w-auto">
                    <button 
                        onClick={() => setActiveMainTab('generator')}
                        className={`px-4 py-2 text-sm font-semibold rounded-xl transition-all flex items-center gap-2 flex-1 xl:flex-none ${
                            activeMainTab === 'generator' 
                                ? 'bg-blue-600 text-white shadow-md' 
                                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
                        }`}
                    >
                        <Calculator size={16} /> Salary Generator
                    </button>
                    <button 
                        onClick={() => setActiveMainTab('saved')}
                        className={`px-4 py-2 text-sm font-semibold rounded-xl transition-all flex items-center gap-2 flex-1 xl:flex-none ${
                            activeMainTab === 'saved' 
                                ? 'bg-blue-600 text-white shadow-md' 
                                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
                        }`}
                    >
                        <FileSpreadsheet size={16} /> Saved Salaries ({savedSalaries.length})
                    </button>
                </div>
                
                <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto justify-end">
                    {/* Period Selector */}
                    <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                        <Calendar size={15} className="text-blue-500" />
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Period:</span>
                        <select
                            className="bg-transparent font-bold text-sm text-slate-800 dark:text-white outline-none cursor-pointer"
                            value={month}
                            onChange={(e) => setMonth(e.target.value)}
                        >
                            {months.map(m => (
                                <option key={m} value={m} className="dark:bg-slate-900">{m}</option>
                            ))}
                        </select>
                        <select
                            className="bg-transparent font-bold text-sm text-slate-800 dark:text-white outline-none cursor-pointer"
                            value={year}
                            onChange={(e) => setYear(Number(e.target.value))}
                        >
                            {Array.from({ length: new Date().getFullYear() - 2023 + 2 }, (_, i) => 2023 + i).map(y => (
                                <option key={y} value={y} className="dark:bg-slate-900">{y}</option>
                            ))}
                        </select>
                    </div>

                    {/* Toggle Dashboard Button */}
                    <button
                        type="button"
                        onClick={() => setShowDashboard(prev => !prev)}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                            showDashboard
                                ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300'
                                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                        title={showDashboard ? "Hide Metrics Dashboard" : "Show Metrics Dashboard"}
                    >
                        {showDashboard ? <EyeOff size={14} /> : <Eye size={14} />}
                        <span>{showDashboard ? "Hide Dashboard" : "Show Dashboard"}</span>
                    </button>

                    <button
                        onClick={fetchMonthData}
                        disabled={loading}
                        className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                        title="Refresh data"
                    >
                        <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                    </button>
                </div>
            </div>

            {/* Quick Metrics Bar (Hidden by default, toggled via Show/Hide Dashboard) */}
            {showDashboard && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex items-center gap-3 shadow-sm">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                            <Users size={20} />
                        </div>
                        <div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Employees</div>
                            <div className="text-lg font-bold text-slate-800 dark:text-white">{totalEmployeesCount}</div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex items-center gap-3 shadow-sm">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                            <CheckCircle size={20} />
                        </div>
                        <div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Active Employees</div>
                            <div className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{activeEmployeesCount}</div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex items-center gap-3 shadow-sm">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                            <FileText size={20} />
                        </div>
                        <div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Salaries Generated</div>
                            <div className="text-lg font-bold text-indigo-700 dark:text-indigo-300">{generatedCount}</div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex items-center gap-3 shadow-sm">
                        <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                            <Clock size={20} />
                        </div>
                        <div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Pending Generation</div>
                            <div className="text-lg font-bold text-amber-700 dark:text-amber-300">{pendingCount}</div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 1: SALARIES GENERATOR */}
            {activeMainTab === 'generator' && (
                <div className="bg-white border border-slate-200 dark:bg-slate-800 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                    {/* Generator Table Header Controls */}
                    <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex flex-wrap items-center gap-3">
                            <span className="font-bold text-sm text-slate-800 dark:text-slate-200">
                                Employees for {month} {year}
                            </span>
                            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                Showing {filteredGeneratorRows.length} of {calculatedRows.length}
                            </span>
                            {selectedEmployeeIds.length > 0 && (
                                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                    {selectedEmployeeIds.length} Selected
                                </span>
                            )}
                            {isAnyGenFilterActive && (
                                <button
                                    onClick={handleResetGenFilters}
                                    className="text-xs text-red-600 hover:text-red-700 dark:text-red-400 font-medium flex items-center gap-1 hover:underline ml-2"
                                >
                                    <X size={13} /> Reset Filters
                                </button>
                            )}
                        </div>

                        {/* Top Action Buttons */}
                        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
                            <button
                                type="button"
                                onClick={handleSelectAllActivePending}
                                className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
                            >
                                Select All Active Pending ({pendingCount})
                            </button>

                            {/* MAIN BULK GENERATE BUTTON */}
                            <button
                                type="button"
                                onClick={handleTriggerBulkGenerate}
                                disabled={selectedEmployeeIds.length === 0}
                                className={`px-4 py-2 text-xs font-bold rounded-xl flex items-center gap-2 shadow-md transition-all ${
                                    selectedEmployeeIds.length > 0
                                        ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer active:scale-95'
                                        : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed shadow-none'
                                }`}
                            >
                                <Zap size={14} className="fill-current" />
                                Generate Whole Month Salaries ({selectedEmployeeIds.length})
                            </button>
                        </div>
                    </div>

                    {/* Table View */}
                    {loading ? (
                        <div className="py-20 text-center">
                            <LoadingSpinner />
                            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Computing monthly employee working days and overtime...</p>
                        </div>
                    ) : filteredGeneratorRows.length === 0 ? (
                        <div className="py-16 text-center text-slate-500 dark:text-slate-400">
                            <p className="font-semibold text-base">No employees found matching the active filters.</p>
                            <p className="text-xs mt-1">Try resetting the status or column filters above.</p>
                            <button
                                onClick={handleResetGenFilters}
                                className="mt-3 px-4 py-1.5 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300 rounded-lg text-xs font-semibold hover:bg-blue-100 transition-colors"
                            >
                                Clear All Filters
                            </button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead className="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 uppercase text-[11px] font-semibold border-b border-slate-200 dark:border-slate-700">
                                    <tr>
                                        {/* Master Checkbox */}
                                        <th className="px-3.5 py-3 w-10 text-center">
                                            <input
                                                type="checkbox"
                                                checked={isAllVisibleSelected}
                                                onChange={handleToggleSelectAllVisible}
                                                className="w-4 h-4 rounded text-blue-600 border-slate-300 dark:border-slate-600 focus:ring-0 cursor-pointer"
                                                title="Select all visible"
                                            />
                                        </th>

                                        {/* Employee */}
                                        <th className="px-4 py-3 min-w-[180px]">
                                            <ExcelColumnFilter
                                                title="Employee"
                                                columnKey="employee"
                                                data={calculatedRows}
                                                getValue={(r) => `${r.employee.name} (${r.employee.employeeId})`}
                                                selectedValues={colFilterGenEmployee}
                                                onFilterChange={setColFilterGenEmployee}
                                                sortConfig={genSortConfig}
                                                onSortChange={setGenSortConfig}
                                            />
                                        </th>

                                        {/* Employee Type */}
                                        <th className="px-3.5 py-3 min-w-[120px]">
                                            <ExcelColumnFilter
                                                title="Employee Type"
                                                columnKey="employeeType"
                                                data={calculatedRows}
                                                getValue={(r) => r.employee.employeeType || 'Full-Time'}
                                                selectedValues={colFilterGenType}
                                                onFilterChange={setColFilterGenType}
                                                sortConfig={genSortConfig}
                                                onSortChange={setGenSortConfig}
                                            />
                                        </th>

                                        {/* Department / Destination */}
                                        <th className="px-3.5 py-3 min-w-[130px]">
                                            <ExcelColumnFilter
                                                title="Department"
                                                columnKey="department"
                                                data={calculatedRows}
                                                getValue={(r) => r.employee.department || '(Blanks)'}
                                                selectedValues={colFilterGenDept}
                                                onFilterChange={setColFilterGenDept}
                                                sortConfig={genSortConfig}
                                                onSortChange={setGenSortConfig}
                                            />
                                        </th>

                                        {/* Designation */}
                                        <th className="px-3.5 py-3 min-w-[130px]">
                                            <ExcelColumnFilter
                                                title="Designation"
                                                columnKey="designation"
                                                data={calculatedRows}
                                                getValue={(r) => r.employee.designation || '(Blanks)'}
                                                selectedValues={colFilterGenDesig}
                                                onFilterChange={setColFilterGenDesig}
                                                sortConfig={genSortConfig}
                                                onSortChange={setGenSortConfig}
                                            />
                                        </th>

                                        {/* Status (Default Active) */}
                                        <th className="px-3.5 py-3 min-w-[110px]">
                                            <ExcelColumnFilter
                                                title="Status"
                                                columnKey="status"
                                                data={calculatedRows}
                                                getValue={(r) => r.employee.status || (r.employee.isActive ? 'Active' : 'Inactive')}
                                                selectedValues={colFilterGenStatus}
                                                onFilterChange={setColFilterGenStatus}
                                                sortConfig={genSortConfig}
                                                onSortChange={setGenSortConfig}
                                            />
                                        </th>

                                        {/* Total Working Days */}
                                        <th className="px-3.5 py-3 min-w-[140px]">
                                            <ExcelColumnFilter
                                                title="Working Days"
                                                columnKey="workingDays"
                                                data={calculatedRows}
                                                getValue={(r) => `${r.payableDays} Days`}
                                                selectedValues={colFilterGenDays}
                                                onFilterChange={setColFilterGenDays}
                                                sortConfig={genSortConfig}
                                                onSortChange={setGenSortConfig}
                                            />
                                        </th>

                                        {/* OT Applied or Not */}
                                        <th className="px-3.5 py-3 min-w-[120px]">
                                            <ExcelColumnFilter
                                                title="OT Applied"
                                                columnKey="otApplied"
                                                data={calculatedRows}
                                                getValue={(r) => r.isOTApplicable ? 'Yes' : 'No'}
                                                selectedValues={colFilterGenOT}
                                                onFilterChange={setColFilterGenOT}
                                                sortConfig={genSortConfig}
                                                onSortChange={setGenSortConfig}
                                            />
                                        </th>

                                        {/* Gross Base Pay */}
                                        <th className="px-3.5 py-3 min-w-[110px] text-right">
                                            <ExcelColumnFilter
                                                title="Gross Pay"
                                                columnKey="grossPay"
                                                data={calculatedRows}
                                                getValue={(r) => `₹ ${r.grossPay.toLocaleString('en-IN')}`}
                                                selectedValues={colFilterGenGross}
                                                onFilterChange={setColFilterGenGross}
                                                sortConfig={genSortConfig}
                                                onSortChange={setGenSortConfig}
                                                align="right"
                                            />
                                        </th>

                                        {/* Net Pay Preview */}
                                        <th className="px-3.5 py-3 min-w-[110px] text-right">
                                            <ExcelColumnFilter
                                                title="Net Pay"
                                                columnKey="netPay"
                                                data={calculatedRows}
                                                getValue={(r) => `₹ ${r.netPay.toLocaleString('en-IN')}`}
                                                selectedValues={colFilterGenNet}
                                                onFilterChange={setColFilterGenNet}
                                                sortConfig={genSortConfig}
                                                onSortChange={setGenSortConfig}
                                                align="right"
                                            />
                                        </th>

                                        {/* Generation Status */}
                                        <th className="px-3.5 py-3 min-w-[110px]">
                                            <ExcelColumnFilter
                                                title="Gen Status"
                                                columnKey="genStatus"
                                                data={calculatedRows}
                                                getValue={(r) => r.hasGenerated ? 'Generated' : 'Pending'}
                                                selectedValues={colFilterGenGenStatus}
                                                onFilterChange={setColFilterGenGenStatus}
                                                sortConfig={genSortConfig}
                                                onSortChange={setGenSortConfig}
                                            />
                                        </th>

                                        {/* Actions */}
                                        <th className="px-4 py-3 text-right min-w-[130px]">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {filteredGeneratorRows.map(row => {
                                        const emp = row.employee;
                                        const isSelected = selectedEmployeeIds.includes(emp._id);

                                        return (
                                            <tr
                                                key={emp._id}
                                                className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                                                    isSelected ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''
                                                }`}
                                            >
                                                {/* Checkbox */}
                                                <td className="px-3.5 py-3 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => handleToggleSelectRow(emp._id)}
                                                        className="w-4 h-4 rounded text-blue-600 border-slate-300 dark:border-slate-600 focus:ring-0 cursor-pointer"
                                                    />
                                                </td>

                                                {/* Employee Name & ID */}
                                                <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">
                                                    <div className="font-bold text-xs">{emp.name}</div>
                                                    <div className="text-[11px] text-slate-500 font-mono">{emp.employeeId}</div>
                                                </td>

                                                {/* Employee Type */}
                                                <td className="px-3.5 py-3 text-slate-600 dark:text-slate-300">
                                                    <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[11px] font-medium">
                                                        {emp.employeeType || 'Full-Time'}
                                                    </span>
                                                </td>

                                                {/* Department */}
                                                <td className="px-3.5 py-3 text-slate-700 dark:text-slate-300">
                                                    {emp.department || '-'}
                                                </td>

                                                {/* Designation */}
                                                <td className="px-3.5 py-3 text-slate-700 dark:text-slate-300">
                                                    {emp.designation || '-'}
                                                </td>

                                                {/* Status */}
                                                <td className="px-3.5 py-3">
                                                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                                        (emp.status === 'Active' || emp.isActive)
                                                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                                                            : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                                    }`}>
                                                        {emp.status || (emp.isActive ? 'Active' : 'Inactive')}
                                                    </span>
                                                </td>

                                                {/* Total Working Days */}
                                                <td className="px-3.5 py-3 font-medium">
                                                    <div className="text-slate-800 dark:text-slate-200 font-bold">
                                                        {row.payableDays} <span className="text-[10px] text-slate-400 font-normal">/ {row.totalMonthDays} Days</span>
                                                    </div>
                                                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                                                        Worked: {row.workedDays}d &bull; Off: {row.weeklyOffsCount + row.holidaysCount}d
                                                    </div>
                                                </td>

                                                {/* OT Applied or Not */}
                                                <td className="px-3.5 py-3">
                                                    {row.isOTApplicable ? (
                                                        <div className="flex flex-col gap-0.5">
                                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 w-fit">
                                                                Yes (Active)
                                                            </span>
                                                            {row.totalOtHours > 0 && (
                                                                <span className="text-[10px] text-purple-600 dark:text-purple-400 font-mono font-semibold">
                                                                    +{row.totalOtHours}h (₹{row.otPay})
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-400 text-xs">No</span>
                                                    )}
                                                </td>

                                                {/* Gross Pay */}
                                                <td className="px-3.5 py-3 text-right font-mono font-medium text-slate-700 dark:text-slate-300">
                                                    ₹ {row.grossPay.toLocaleString('en-IN')}
                                                </td>

                                                {/* Net Pay */}
                                                <td className="px-3.5 py-3 text-right font-mono font-bold text-slate-900 dark:text-emerald-400">
                                                    ₹ {row.netPay.toLocaleString('en-IN')}
                                                </td>

                                                {/* Generation Status */}
                                                <td className="px-3.5 py-3">
                                                    {row.hasGenerated ? (
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300 flex items-center gap-1 w-fit">
                                                            <Check size={11} /> Generated
                                                        </span>
                                                    ) : (
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 w-fit">
                                                            Pending
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Row Actions */}
                                                <td className="px-4 py-3 text-right space-x-1 whitespace-nowrap">
                                                    <button
                                                        type="button"
                                                        onClick={() => setDailyLogsModalEmployee(emp)}
                                                        className="px-2 py-1 text-[11px] font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-slate-700 rounded transition-colors"
                                                        title="Inspect or override daily attendance logs"
                                                    >
                                                        Adjust Logs
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleGenerateSingle(row)}
                                                        className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-blue-600 hover:text-white dark:bg-slate-700 dark:hover:bg-blue-600 text-slate-700 dark:text-slate-200 rounded transition-colors shadow-sm"
                                                        title="Generate or update single salary"
                                                    >
                                                        {row.hasGenerated ? "Update" : "Generate"}
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* TAB 2: SAVED SALARIES */}
            {activeMainTab === 'saved' && (
                <div className="bg-white border border-slate-200 dark:bg-slate-800 dark:border-slate-700 rounded-2xl shadow-sm p-5 space-y-4">
                    {/* Header Controls */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h3 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <FileSpreadsheet size={18} className="text-blue-600" />
                                Saved Salaries for {month} {year}
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                Total {savedSalaries.length} records saved in database. Download Excel or PDF slips anytime.
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                            {/* Search box */}
                            <div className="relative w-full md:w-60">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    value={savedSearchTerm}
                                    onChange={(e) => setSavedSearchTerm(e.target.value)}
                                    placeholder="Search by name, ID, dept..."
                                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                                />
                            </div>

                            {/* EXPORT ALL-IN-ONE EXCEL (COMPANY FORMAT) */}
                            <button
                                type="button"
                                onClick={() => exportAllSalariesCompanyExcel(filteredSavedSalaries, employees, month, year, companyName || "EXCEL WIRECUT INC")}
                                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition-colors"
                                title="Export single Excel workbook containing each generated employee on their own sheet + Master summary"
                            >
                                <FileSpreadsheet size={14} /> All-in-One Excel
                            </button>

                            {/* EXPORT ALL SLIPS PDF (COMPANY FORMAT) */}
                            <button
                                type="button"
                                onClick={() => exportAllSalariesCompanyPDF(filteredSavedSalaries, employees, month, year, companyName || "EXCEL WIRECUT INC")}
                                className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition-colors"
                                title="Export all generated employee salary slips in company format into a single multi-page PDF"
                            >
                                <FileText size={14} /> All Slips PDF
                            </button>

                            {/* Standard Table Excel */}
                            <button
                                type="button"
                                onClick={handleDownloadSavedExcel}
                                className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                                title="Download table data as Excel"
                            >
                                <Download size={13} /> Table Excel
                            </button>

                            {isAnySavedFilterActive && (
                                <button
                                    onClick={handleResetSavedFilters}
                                    className="text-xs text-red-600 hover:text-red-700 dark:text-red-400 font-medium flex items-center gap-1 hover:underline"
                                >
                                    <X size={13} /> Reset Filters
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Saved Table View */}
                    {loadingSaved ? (
                        <div className="py-20 text-center">
                            <LoadingSpinner />
                            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Loading saved salary records...</p>
                        </div>
                    ) : filteredSavedSalaries.length === 0 ? (
                        <div className="py-16 text-center text-slate-500 dark:text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                            <p className="font-semibold text-base">No saved salary records found.</p>
                            <p className="text-xs mt-1">Switch to the Salary Generator tab to calculate and save salaries for {month} {year}.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead className="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 uppercase text-[11px] font-semibold border-b border-slate-200 dark:border-slate-700">
                                    <tr>
                                        {/* Employee */}
                                        <th className="px-4 py-3 min-w-[180px]">
                                            <ExcelColumnFilter
                                                title="Employee"
                                                columnKey="employee"
                                                data={savedSalaries}
                                                getValue={(s) => {
                                                    const emp = typeof s.employee === 'string' ? employees.find(e => e._id === s.employee) : s.employee;
                                                    return emp ? `${emp.name} (${emp.employeeId})` : 'Unknown';
                                                }}
                                                selectedValues={colFilterSavedEmployee}
                                                onFilterChange={setColFilterSavedEmployee}
                                                sortConfig={savedSortConfig}
                                                onSortChange={setSavedSortConfig}
                                            />
                                        </th>

                                        {/* Department */}
                                        <th className="px-3.5 py-3 min-w-[130px]">
                                            <ExcelColumnFilter
                                                title="Department"
                                                columnKey="department"
                                                data={savedSalaries}
                                                getValue={(s) => {
                                                    const emp = typeof s.employee === 'string' ? employees.find(e => e._id === s.employee) : s.employee;
                                                    return emp?.department || '(Blanks)';
                                                }}
                                                selectedValues={colFilterSavedDept}
                                                onFilterChange={setColFilterSavedDept}
                                                sortConfig={savedSortConfig}
                                                onSortChange={setSavedSortConfig}
                                            />
                                        </th>

                                        {/* Designation */}
                                        <th className="px-3.5 py-3 min-w-[130px]">
                                            <ExcelColumnFilter
                                                title="Designation"
                                                columnKey="designation"
                                                data={savedSalaries}
                                                getValue={(s) => {
                                                    const emp = typeof s.employee === 'string' ? employees.find(e => e._id === s.employee) : s.employee;
                                                    return emp?.designation || '(Blanks)';
                                                }}
                                                selectedValues={colFilterSavedDesig}
                                                onFilterChange={setColFilterSavedDesig}
                                                sortConfig={savedSortConfig}
                                                onSortChange={setSavedSortConfig}
                                            />
                                        </th>

                                        {/* Present Days */}
                                        <th className="px-3.5 py-3 min-w-[110px]">
                                            <ExcelColumnFilter
                                                title="Present Days"
                                                columnKey="presentDays"
                                                data={savedSalaries}
                                                getValue={(s) => `${s.presentDays} Days`}
                                                selectedValues={colFilterSavedDays}
                                                onFilterChange={setColFilterSavedDays}
                                                sortConfig={savedSortConfig}
                                                onSortChange={setSavedSortConfig}
                                            />
                                        </th>

                                        {/* OT Applied */}
                                        <th className="px-3.5 py-3 min-w-[100px]">
                                            <ExcelColumnFilter
                                                title="OT Applied"
                                                columnKey="otApplied"
                                                data={savedSalaries}
                                                getValue={(s) => {
                                                    const emp = typeof s.employee === 'string' ? employees.find(e => e._id === s.employee) : s.employee;
                                                    return emp?.isOTApplicable ? 'Yes' : 'No';
                                                }}
                                                selectedValues={colFilterSavedOT}
                                                onFilterChange={setColFilterSavedOT}
                                                sortConfig={savedSortConfig}
                                                onSortChange={setSavedSortConfig}
                                            />
                                        </th>

                                        {/* Basic / Gross */}
                                        <th className="px-3.5 py-3 min-w-[110px] text-right">
                                            <ExcelColumnFilter
                                                title="Gross Pay"
                                                columnKey="basicPay"
                                                data={savedSalaries}
                                                getValue={(s) => `₹ ${(s.grossSalary || 0).toLocaleString('en-IN')}`}
                                                selectedValues={colFilterSavedBasic}
                                                onFilterChange={setColFilterSavedBasic}
                                                sortConfig={savedSortConfig}
                                                onSortChange={setSavedSortConfig}
                                                align="right"
                                            />
                                        </th>

                                        {/* OT Pay */}
                                        <th className="px-3.5 py-3 min-w-[100px] text-right">
                                            <ExcelColumnFilter
                                                title="OT Pay"
                                                columnKey="otPay"
                                                data={savedSalaries}
                                                getValue={(s) => `₹ ${(s.overtime?.amount || 0).toLocaleString('en-IN')}`}
                                                selectedValues={colFilterSavedOTPay}
                                                onFilterChange={setColFilterSavedOTPay}
                                                sortConfig={savedSortConfig}
                                                onSortChange={setSavedSortConfig}
                                                align="right"
                                            />
                                        </th>

                                        {/* Net Pay */}
                                        <th className="px-3.5 py-3 min-w-[110px] text-right">
                                            <ExcelColumnFilter
                                                title="Net Pay"
                                                columnKey="netPay"
                                                data={savedSalaries}
                                                getValue={(s) => `₹ ${(s.netSalary || 0).toLocaleString('en-IN')}`}
                                                selectedValues={colFilterSavedNet}
                                                onFilterChange={setColFilterSavedNet}
                                                sortConfig={savedSortConfig}
                                                onSortChange={setSavedSortConfig}
                                                align="right"
                                            />
                                        </th>

                                        {/* Record Status */}
                                        <th className="px-3.5 py-3 min-w-[100px]">
                                            <ExcelColumnFilter
                                                title="Status"
                                                columnKey="recordStatus"
                                                data={savedSalaries}
                                                getValue={(s) => s.status || 'Draft'}
                                                selectedValues={colFilterSavedRecordStatus}
                                                onFilterChange={setColFilterSavedRecordStatus}
                                                sortConfig={savedSortConfig}
                                                onSortChange={setSavedSortConfig}
                                            />
                                        </th>

                                        {/* Actions */}
                                        <th className="px-4 py-3 text-right min-w-[180px]">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {filteredSavedSalaries.map(salary => {
                                        const empId = typeof salary.employee === 'string' ? salary.employee : salary.employee?._id;
                                        const fullEmp = employees.find(e => e._id === empId) || salary.employee || {};
                                        const isOT = Boolean(fullEmp.isOTApplicable);

                                        return (
                                            <tr key={salary._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                                                {/* Employee */}
                                                <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">
                                                    <div className="font-bold text-xs">{fullEmp.name || 'Unknown'}</div>
                                                    <div className="text-[11px] text-slate-500 font-mono">{fullEmp.employeeId || '-'}</div>
                                                </td>

                                                {/* Department */}
                                                <td className="px-3.5 py-3 text-slate-700 dark:text-slate-300">
                                                    {fullEmp.department || '-'}
                                                </td>

                                                {/* Designation */}
                                                <td className="px-3.5 py-3 text-slate-700 dark:text-slate-300">
                                                    {fullEmp.designation || '-'}
                                                </td>

                                                {/* Present Days */}
                                                <td className="px-3.5 py-3 font-semibold text-slate-700 dark:text-slate-300">
                                                    {salary.presentDays} Days
                                                </td>

                                                {/* OT Applied */}
                                                <td className="px-3.5 py-3">
                                                    {isOT ? (
                                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">
                                                            Yes
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-400 text-xs">No</span>
                                                    )}
                                                </td>

                                                {/* Gross Pay */}
                                                <td className="px-3.5 py-3 text-right font-mono text-slate-700 dark:text-slate-300">
                                                    ₹ {(salary.grossSalary || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                                </td>

                                                {/* OT Pay */}
                                                <td className="px-3.5 py-3 text-right font-mono text-slate-700 dark:text-slate-300">
                                                    {isOT && (salary.overtime?.amount || 0) > 0 ? (
                                                        <span className="text-purple-700 dark:text-purple-300 font-semibold">
                                                            ₹ {(salary.overtime?.amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                                        </span>
                                                    ) : (
                                                        '₹ 0'
                                                    )}
                                                </td>

                                                {/* Net Pay */}
                                                <td className="px-3.5 py-3 text-right font-mono font-bold text-slate-900 dark:text-emerald-400">
                                                    ₹ {(salary.netSalary || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                                </td>

                                                {/* Status */}
                                                <td className="px-3.5 py-3">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                                        salary.status === 'Paid'
                                                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                                                            : 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                                                    }`}>
                                                        {salary.status || 'Draft'}
                                                    </span>
                                                </td>

                                                {/* Actions */}
                                                <td className="px-4 py-3 text-right space-x-1.5 whitespace-nowrap">
                                                    {/* Company Format Single Exports */}
                                                    <button
                                                        type="button"
                                                        onClick={() => exportSingleSalaryCompanyExcel(salary, fullEmp, month, year, companyName || "EXCEL WIRECUT INC")}
                                                        className="px-1.5 py-0.5 hover:bg-emerald-50 dark:hover:bg-slate-700 text-emerald-700 dark:text-emerald-400 font-bold text-[10px] rounded border border-emerald-300 dark:border-emerald-700"
                                                        title="Download Company Excel Statement"
                                                    >
                                                        XLS
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => exportSingleSalaryCompanyPDF(salary, fullEmp, month, year, companyName || "EXCEL WIRECUT INC")}
                                                        className="px-1.5 py-0.5 hover:bg-red-50 dark:hover:bg-slate-700 text-red-600 dark:text-red-400 font-bold text-[10px] rounded border border-red-300 dark:border-red-700"
                                                        title="Download Company PDF Statement"
                                                    >
                                                        Slip
                                                    </button>

                                                    {/* Edit */}
                                                    <button
                                                        type="button"
                                                        onClick={() => setEditingSalaryData(salary)}
                                                        className="px-2 py-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-700 rounded transition-colors"
                                                    >
                                                        Edit
                                                    </button>

                                                    {/* PDF Slips */}
                                                    {isOT ? (
                                                        <div className="inline-flex items-center rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[10px] overflow-hidden">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDownloadSavedPDF(salary, 'Combined')}
                                                                className="px-1.5 py-0.5 hover:bg-slate-100 dark:hover:bg-slate-700 text-indigo-600 font-bold"
                                                                title="Combined PDF"
                                                            >
                                                                Comb
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDownloadSavedPDF(salary, 'Salary')}
                                                                className="px-1.5 py-0.5 hover:bg-slate-100 dark:hover:bg-slate-700 text-emerald-600 border-l border-slate-200 dark:border-slate-700 font-bold"
                                                                title="Salary Slip PDF"
                                                            >
                                                                Sal
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDownloadSavedPDF(salary, 'Overtime')}
                                                                className="px-1.5 py-0.5 hover:bg-slate-100 dark:hover:bg-slate-700 text-purple-600 border-l border-slate-200 dark:border-slate-700 font-bold"
                                                                title="Overtime Statement PDF"
                                                            >
                                                                OT
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDownloadSavedPDF(salary, 'Salary')}
                                                            className="px-2 py-1 text-[11px] font-semibold text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 dark:hover:bg-slate-700 rounded transition-colors"
                                                            title="Download Salary PDF"
                                                        >
                                                            PDF
                                                        </button>
                                                    )}

                                                    {/* Delete */}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteSavedSalary(salary._id)}
                                                        className="px-1.5 py-1 text-[11px] text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded transition-colors"
                                                        title="Delete salary record"
                                                    >
                                                        <Trash2 size={13} className="inline" />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* BULK GENERATION CONFIRMATION & PROGRESS MODAL */}
            {isBulkModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-5">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                                <Zap size={24} />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-slate-800 dark:text-white">
                                    Generate Whole Month Salaries
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Period: <span className="font-semibold text-slate-700 dark:text-slate-200">{month} {year}</span> &bull; {selectedEmployeeIds.length} employees selected
                                </p>
                            </div>
                        </div>

                        {!bulkGenerationResult ? (
                            <>
                                <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3 text-xs text-slate-600 dark:text-slate-300">
                                    <p>
                                        You are about to generate monthly salary slips for <strong>{selectedEmployeeIds.length} selected employees</strong> based on real-time attendance, overtime policies, and statutory deductions.
                                    </p>
                                    <label className="flex items-start gap-2 pt-2 border-t border-slate-200 dark:border-slate-700 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={overwriteExisting}
                                            onChange={(e) => setOverwriteExisting(e.target.checked)}
                                            className="w-4 h-4 rounded text-blue-600 border-slate-300 dark:border-slate-600 focus:ring-0 cursor-pointer mt-0.5"
                                        />
                                        <span>
                                            <strong className="text-slate-800 dark:text-white">Overwrite existing records:</strong> If checked, recalculates and updates salaries that were already saved for this month. If unchecked, skips existing records.
                                        </span>
                                    </label>
                                </div>

                                <div className="flex justify-end gap-2.5 pt-2">
                                    <button
                                        type="button"
                                        disabled={isGeneratingBulk}
                                        onClick={() => setIsBulkModalOpen(false)}
                                        className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        disabled={isGeneratingBulk}
                                        onClick={handleConfirmBulkGenerate}
                                        className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-2 transition-colors disabled:opacity-50"
                                    >
                                        {isGeneratingBulk ? (
                                            <>
                                                <RefreshCw size={14} className="animate-spin" />
                                                Generating...
                                            </>
                                        ) : (
                                            <>
                                                <Zap size={14} /> Start Batch Generation
                                            </>
                                        )}
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="space-y-4">
                                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 space-y-2">
                                    <div className="flex items-center gap-2 font-bold text-sm">
                                        <CheckCircle size={18} className="text-emerald-600" />
                                        Batch Generation Complete!
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-emerald-200 dark:border-emerald-800">
                                        <div>Created: <strong className="text-sm font-bold">{bulkGenerationResult.createdCount}</strong></div>
                                        <div>Updated: <strong className="text-sm font-bold">{bulkGenerationResult.updatedCount}</strong></div>
                                        <div>Skipped: <strong className="text-sm font-bold">{bulkGenerationResult.skippedCount}</strong></div>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsBulkModalOpen(false);
                                            setBulkGenerationResult(null);
                                        }}
                                        className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                    >
                                        Stay on Generator
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsBulkModalOpen(false);
                                            setBulkGenerationResult(null);
                                            setActiveMainTab('saved');
                                        }}
                                        className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-1.5 transition-colors"
                                    >
                                        <ArrowUpRight size={14} /> View in Saved Salaries
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* EDIT SALARY MODAL */}
            <EditSalaryModal 
                isOpen={!!editingSalaryData}
                onClose={() => setEditingSalaryData(null)}
                salary={editingSalaryData}
                employees={employees}
                onSuccess={() => {
                    setEditingSalaryData(null);
                    fetchMonthData();
                }}
            />

            {/* DAILY PUNCH OVERRIDES MODAL */}
            <DailyLogsModal
                isOpen={!!dailyLogsModalEmployee}
                onClose={() => setDailyLogsModalEmployee(null)}
                employee={dailyLogsModalEmployee}
                month={month}
                year={year}
                initialLogs={
                    dailyLogsModalEmployee 
                        ? (employeeOverrides[dailyLogsModalEmployee._id] || calculatedRows.find(r => r.employee._id === dailyLogsModalEmployee._id)?.calendarData || [])
                        : []
                }
                onSaveLogs={(empId, updatedLogs) => {
                    setEmployeeOverrides(prev => ({ ...prev, [empId]: updatedLogs }));
                }}
            />
        </div>
    );
}

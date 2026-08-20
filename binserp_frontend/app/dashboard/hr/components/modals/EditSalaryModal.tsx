import React, { useState, useEffect, useMemo } from 'react';
import { X, Save, IndianRupee, Calculator, RefreshCw } from 'lucide-react';
import axios from 'axios';
import { Employee, Salary } from '../../types/hr.types';
import LoadingSpinner from '@/src/components/LoadingSpinner';
import { API_BASE_URL } from '@/src/utils/config';

interface DayStatus {
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
}

interface EditSalaryModalProps {
    isOpen: boolean;
    onClose: () => void;
    salary: any;
    employees: Employee[];
    onSuccess: () => void;
}

export default function EditSalaryModal({ isOpen, onClose, salary, employees, onSuccess }: EditSalaryModalProps) {
    const [calendarData, setCalendarData] = useState<DayStatus[]>([]);
    const [baseSalary, setBaseSalary] = useState(0);
    const [otRatePH, setOtRatePH] = useState(0);
    const [saving, setSaving] = useState(false);

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

    useEffect(() => {
        if (isOpen && salary) {
            const emp = employees.find(e => e._id === salary?.employee?._id) as any;
            const standardHours = emp?.standardWorkingHours || 9;

            const enrichedLogs = (salary.dailyLogs || []).map((log: any) => {
                const computedHours = log.originalHours ?? 0;
                const dailyOt = log.otHours !== undefined 
                    ? log.otHours 
                    : getDailyOtHours(computedHours, log.dayName, log.originalStatus === 'Holiday', emp);
                
                const manualHours = log.manualHours ?? computedHours;
                const manualOt = log.manualOtHours !== undefined
                    ? log.manualOtHours
                    : getDailyOtHours(manualHours, log.dayName, log.manualStatus === 'Holiday' || log.originalStatus === 'Holiday', emp);

                return {
                    ...log,
                    originalHours: computedHours,
                    otHours: dailyOt,
                    manualHours: manualHours,
                    manualOtHours: manualOt,
                };
            });

            setCalendarData(enrichedLogs);
            
            if (emp?.salary) {
                const basis = emp.salary.perDayCalculationBasis || 'Basic';
                if (basis === 'Gross') {
                    setBaseSalary(emp.salary.grossSalary || 0);
                } else if (basis === 'Net') {
                    setBaseSalary(emp.salary.netSalary || 0);
                } else {
                    setBaseSalary(emp.salary.basic || 0);
                }
            } else {
                setBaseSalary(salary.salaryComponents?.basic || 0);
            }
            
            setOtRatePH(salary.otRatePH || 0);
        }
    }, [isOpen, salary, employees]);

    // Calculate Totals Live
    const totals = useMemo(() => {
        let presentDays = 0;
        let totalOtHours = 0;
        let totalDutyHours = 0;
        let compOffAccrued = 0;

        const emp = employees.find(e => e._id === salary?.employee?._id) as any;
        const standardHours = emp?.standardWorkingHours || 9;
        const weeklyOff = Array.isArray(emp?.weeklyOff) ? emp.weeklyOff : [emp?.weeklyOff || "Sunday"];
        const holidayWorkPolicy = emp?.holidayWorkPolicy || "Overtime";
        const weekOffWorkPolicy = emp?.weekOffWorkPolicy || "Overtime";

        let weeklyOffsCount = 0;

        let actualAbsentDays = 0;
        let workedDays = 0;

        calendarData.forEach(day => {
            const dateObj = new Date(day.date);
            const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
            const isWeeklyOff = weeklyOff.includes(days[dateObj.getDay()]);
            if (isWeeklyOff) weeklyOffsCount++;

            const status = day.useManual ? day.manualStatus : day.originalStatus;
            const hours = day.useManual ? day.manualHours : (day.originalHours || 0);

            totalDutyHours += hours;

            const isPublicHoliday = day.originalStatus === 'Holiday';

            // Tracking absences and worked days
            if (!isWeeklyOff && !isPublicHoliday) {
                if (status === 'Absent') actualAbsentDays += 1;
                else if (status === 'HalfDay') actualAbsentDays += 0.5;
            }
            
            if (status === 'Present') workedDays += 1;
            else if (status === 'HalfDay') workedDays += 0.5;

            // Overtime & CompOff Accrual logic
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

        const effectiveWorkingDays = calendarData.length - weeklyOffsCount;
        
        const dailyDivisorBasis = emp?.salary?.dailyDivisorBasis || 'TotalMonthDays';
        const totalMonthDays = calendarData.length;
        const divisor = dailyDivisorBasis === 'TotalMonthDays' ? totalMonthDays : effectiveWorkingDays;

        // Payable days
        const payableDays = Math.max(0, divisor - actualAbsentDays);
        const absentHours = actualAbsentDays * standardHours;

        // OT Multiplier Logic
        const otCompensateForAbsent = emp?.otCompensateForAbsent ?? true;
        const mainOTRateMultiplier = emp?.salary?.otRate || 1.0;
        const absentOTRateMultiplier = emp?.absentOTRate || 1.0;
        
        let compensatedHours = 0;
        let mainOtHours = 0;
        let absentOtHours = 0;
        let otPay = 0;
        let otCompensatedPay = 0;
        let mainOtPay = 0;


        const baseHourlyRate = divisor > 0 && standardHours > 0 ? (baseSalary / divisor) / standardHours : 0;
        
        // --- Decoupled OT Calculation ---
        const otCalcBasis = emp?.salary?.otCalculationBasis || 'Basic';
        let otBaseSalary = 0;
        if (otCalcBasis === 'Basic') otBaseSalary = emp?.salary?.basic || 0;
        else if (otCalcBasis === 'Gross') otBaseSalary = emp?.salary?.grossSalary || 0;
        else if (otCalcBasis === 'Net') otBaseSalary = emp?.salary?.netSalary || 0;
        
        const otDivBasis = emp?.salary?.otDivisorBasis || 'TotalMonthDays';
        const otDivisor = otDivBasis === 'TotalMonthDays' ? totalMonthDays : effectiveWorkingDays;
        
        const otHourlyRate = otDivisor > 0 && standardHours > 0 ? (otBaseSalary / otDivisor) / standardHours : 0;
        // --------------------------------

        if (emp?.isOTApplicable) {
            if (otCompensateForAbsent) {
                compensatedHours = Math.min(totalOtHours, absentHours);
                mainOtHours = totalOtHours - compensatedHours;
                otCompensatedPay = compensatedHours * otHourlyRate * 1.0;
                mainOtPay = mainOtHours * otHourlyRate * mainOTRateMultiplier;
                otPay = otCompensatedPay + mainOtPay;
            } else {
                absentOtHours = Math.min(totalOtHours, absentHours);
                mainOtHours = totalOtHours - absentOtHours;
                otCompensatedPay = absentOtHours * otHourlyRate * absentOTRateMultiplier;
                mainOtPay = mainOtHours * otHourlyRate * mainOTRateMultiplier;
                otPay = otCompensatedPay + mainOtPay;
            }
        } else {
            otPay = 0;
        }

        let casualLeaveConsumed = 0;
        let sickLeaveConsumed = 0;
        let compOffConsumed = 0;
        let holidaysCount = 0;

        calendarData.forEach(day => {
            const status = day.useManual ? day.manualStatus : day.originalStatus;
            if (status === 'CL') casualLeaveConsumed += 1;
            if (status === 'SL') sickLeaveConsumed += 1;
            if (status === 'CO') compOffConsumed += 1;
            if (status === 'Holiday') holidaysCount += 1;
        });

        const ratio = divisor > 0 ? (payableDays / divisor) : 0;
        const earnedBasic = (emp?.salary?.basic || 0) * ratio;
        const earnedGross = (emp?.salary?.grossSalary || 0) * ratio;

        const isPFApplicable = emp?.salary?.isPFApplicable || false;
        const isESIApplicable = emp?.salary?.isESIApplicable || false;
        const isPTApplicable = emp?.salary?.isPTApplicable || false;

        // Manual PF overrides auto-calc
        let pfDeduction = (emp?.salary?.pf && emp.salary.pf > 0) 
            ? emp.salary.pf 
            : (isPFApplicable ? earnedBasic * 0.12 : 0);

        let esiDeduction = (emp?.salary?.esi && emp.salary.esi > 0)
            ? emp.salary.esi
            : (isESIApplicable ? earnedGross * 0.0075 : 0);
        
        let employerPF = isPFApplicable ? earnedBasic * 0.12 : 0;
        let employerESI = isESIApplicable ? earnedGross * 0.0325 : 0;
        
        const pt = (emp?.salary?.professionalTax && emp.salary.professionalTax > 0)
            ? emp.salary.professionalTax
            : (isPTApplicable ? 200 : 0);

        const grossPay = divisor > 0 ? (baseSalary / divisor) * payableDays : 0;
        const netPay = grossPay + otPay - (pfDeduction + esiDeduction + pt);

        return { 
            presentDays: payableDays, 
            workedDays,
            totalOtHours, 
            totalDutyHours, 
            grossPay, 
            pfDeduction,
            esiDeduction,
            employerPF,
            employerESI,
            professionalTax: pt,
            otPay, 
            otCompensatedPay,
            mainOtPay, 
            netPay, 
            casualLeaveConsumed, 
            sickLeaveConsumed,
            compOffConsumed,
            compOffAccrued,
            holidaysCount,
            effectiveWorkingDays,
            weeklyOffsCount,
            absentHours,
            compensatedHours,
            mainOtHours,
            absentOtHours,
            baseHourlyRate
        };
    }, [calendarData, baseSalary, employees, salary]);

    const toggleManual = (index: number) => {
        const newData = [...calendarData];
        newData[index].useManual = !newData[index].useManual;
        setCalendarData(newData);
    };

    const updateManualField = (index: number, field: keyof DayStatus, value: any) => {
        const newData = [...calendarData];
        newData[index] = { ...newData[index], [field]: value };
        
        const emp = employees.find(e => e._id === salary?.employee?._id) as any;
        const standardHours = emp?.standardWorkingHours || 9;

        // Auto-fill hours if changing status
        if (field === 'manualStatus') {
            if (value === 'Present' && newData[index].manualHours === 0) {
                newData[index].manualHours = standardHours;
            } else if (value === 'HalfDay' && newData[index].manualHours === 0) {
                newData[index].manualHours = standardHours / 2;
            } else if (value === 'Absent' || value === 'Holiday' || value === 'CL' || value === 'SL' || value === 'CO') {
                newData[index].manualHours = 0;
            }
        }
        
        // Recalculate manual OT hours live
        newData[index].manualOtHours = getDailyOtHours(
            newData[index].manualHours || 0,
            newData[index].dayName,
            newData[index].manualStatus === 'Holiday' || newData[index].originalStatus === 'Holiday',
            emp
        );

        setCalendarData(newData);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const token = localStorage.getItem('token');
            const payload = {
                // keep necessary fields
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
                    compOff: totals.compOffConsumed 
                },
                compOffAccrued: totals.compOffAccrued,
                salaryComponents: {
                    ...salary.salaryComponents,
                    pf: totals.pfDeduction,
                    esi: totals.esiDeduction,
                    professionalTax: totals.professionalTax,
                    basic: baseSalary
                },
                employerContributions: {
                    ...salary.employerContributions,
                    pf: totals.employerPF,
                    esi: totals.employerESI
                }
            };

            await axios.put(`${API_BASE_URL}/api/hr/salary/${salary._id}`, payload, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error("Error updating salary:", error);
            const msg = error.response?.data?.message || error.message || "Unknown error";
            alert(`Failed to update salary record: ${msg}`);
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen || !salary) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                onClick={onClose}
            ></div>

            {/* Modal Content */}
            <div className="relative bg-white dark:bg-slate-900 w-full max-w-6xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col mx-4 overflow-hidden border border-slate-200 dark:border-slate-800">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                            Edit Salary: {salary.employee?.name}
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            {salary.month} {salary.year}
                        </p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-8">
                    {/* Top Row: Config & Totals */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Config Inputs */}
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-xl border border-slate-100 dark:border-slate-700 space-y-4">
                            <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                <Calculator size={18} className="text-blue-500" />
                                Configuration
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                                        Base Salary (Month)
                                    </label>
                                    <div className="relative opacity-70">
                                        <IndianRupee size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input 
                                            type="number"
                                            value={baseSalary || ''}
                                            readOnly
                                            disabled
                                            className="w-full pl-8 pr-3 py-2 bg-gray-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm cursor-not-allowed text-slate-500"
                                        />
                                    </div>
                                </div>
                                {(() => {
                                    const emp = employees.find(e => e._id === salary?.employee?._id) as any;
                                    if (emp?.isOTApplicable) {
                                        return (
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="bg-blue-50 border border-blue-100 dark:bg-blue-900/20 dark:border-blue-800/30 p-2 rounded-lg">
                                                    <p className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase">Main OT Rate</p>
                                                    <p className="text-sm font-bold text-blue-900 dark:text-blue-100">₹ {Math.round(totals.baseHourlyRate * (emp?.salary?.otRate || 1.0))}/hr</p>
                                                </div>
                                                <div className="bg-red-50 border border-red-100 dark:bg-red-900/20 dark:border-red-800/30 p-2 rounded-lg">
                                                    <p className="text-[10px] font-semibold text-red-600 dark:text-red-400 uppercase">Absent OT Rate</p>
                                                    <p className="text-sm font-bold text-red-900 dark:text-red-100">₹ {Math.round(totals.baseHourlyRate * (emp?.absentOTRate || 1.0))}/hr</p>
                                                </div>
                                            </div>
                                        );
                                    }
                                    return null;
                                })()}
                            </div>
                        </div>

                        {/* Summary Display */}
                        <div className="lg:col-span-2 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm">
                            <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4 text-sm flex items-center gap-2">
                                <Calculator size={16} className="text-blue-500" />
                                Detailed Calculation Summary
                            </h3>
                            
                            {(() => {
                                const emp = employees.find(e => e._id === salary?.employee?._id) as any;
                                const isOT = emp?.isOTApplicable;

                                if (!isOT) {
                                    return (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                            <div className="space-y-2.5">
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-slate-500 font-medium">Total Month Days</span>
                                                    <span className="font-bold text-slate-700 dark:text-slate-300">{calendarData.length}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-slate-500 font-medium">Applicable Days</span>
                                                    <span className="font-bold text-slate-700 dark:text-slate-300">{totals.effectiveWorkingDays}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-slate-500 font-medium">Worked Days</span>
                                                    <span className="font-bold text-slate-600 dark:text-slate-400">{totals.workedDays}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-slate-500 font-medium">Payable Days</span>
                                                    <span className="font-bold text-blue-600 dark:text-blue-400">{totals.presentDays}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-slate-500 font-medium">Absent Days</span>
                                                    <span className="font-bold text-red-600 dark:text-red-400">{totals.effectiveWorkingDays - totals.presentDays}</span>
                                                </div>
                                            </div>

                                            <div className="space-y-2.5">
                                                {totals.casualLeaveConsumed > 0 && (
                                                    <div className="flex justify-between items-center text-xs">
                                                        <span className="text-slate-500 font-medium">CL Applied</span>
                                                        <span className="font-bold text-purple-600 dark:text-purple-400">{totals.casualLeaveConsumed}</span>
                                                    </div>
                                                )}
                                                {totals.sickLeaveConsumed > 0 && (
                                                    <div className="flex justify-between items-center text-xs">
                                                        <span className="text-slate-500 font-medium">SL Applied</span>
                                                        <span className="font-bold text-purple-600 dark:text-purple-400">{totals.sickLeaveConsumed}</span>
                                                    </div>
                                                )}
                                                {totals.compOffConsumed > 0 && (
                                                    <div className="flex justify-between items-center text-xs">
                                                        <span className="text-slate-500 font-medium">CO Applied</span>
                                                        <span className="font-bold text-teal-600 dark:text-teal-400">{totals.compOffConsumed}</span>
                                                    </div>
                                                )}
                                                {totals.compOffAccrued > 0 && (
                                                    <div className="flex justify-between items-center text-xs">
                                                        <span className="text-slate-500 font-medium">CO Accrued</span>
                                                        <span className="font-bold text-teal-600 dark:text-teal-400">{totals.compOffAccrued.toFixed(1)}</span>
                                                    </div>
                                                )}
                                                {totals.holidaysCount > 0 && (
                                                    <div className="flex justify-between items-center text-xs">
                                                        <span className="text-slate-500 font-medium">Holidays</span>
                                                        <span className="font-bold text-sky-600 dark:text-sky-400">{totals.holidaysCount}</span>
                                                    </div>
                                                )}
                                                {totals.casualLeaveConsumed === 0 && totals.sickLeaveConsumed === 0 && totals.compOffConsumed === 0 && totals.compOffAccrued === 0 && totals.holidaysCount === 0 && (
                                                    <div className="text-slate-400 text-xs italic text-center py-2">No leaves or holidays</div>
                                                )}
                                            </div>

                                            <div className="space-y-2.5">
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-slate-500 font-medium">Gross Salary</span>
                                                    <span className="font-bold text-slate-700 dark:text-slate-300">₹ {Math.round(totals.grossPay).toLocaleString()}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-sm font-bold pt-1 border-t border-slate-100 dark:border-slate-700 mt-1">
                                                    <span className="text-slate-700 dark:text-slate-200">Net Payable</span>
                                                    <span className="text-emerald-600 dark:text-emerald-400">₹ {Math.round(totals.netPay).toLocaleString()}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }

                                return (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                        {/* Days Column */}
                                        <div className="space-y-2.5">
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="text-slate-500 font-medium">Applicable Divisor</span>
                                                <span className="font-bold text-slate-700 dark:text-slate-300">
                                                    {(() => {
                                                        const emp = employees.find(e => e._id === salary?.employee?._id) as any;
                                                        return emp?.salary?.dailyDivisorBasis === 'TotalMonthDays' ? calendarData.length : totals.effectiveWorkingDays;
                                                    })()}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="text-slate-500 font-medium">Worked Days</span>
                                                <span className="font-bold text-slate-600 dark:text-slate-400">{totals.workedDays}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="text-slate-500 font-medium">Payable Days</span>
                                                <span className="font-bold text-blue-600 dark:text-blue-400">{totals.presentDays}</span>
                                            </div>
                                        </div>

                                        {/* Hours Column */}
                                        <div className="space-y-2.5">
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="text-slate-500 font-medium">Applicable Hrs</span>
                                                <span className="font-bold text-slate-700 dark:text-slate-300">
                                                    {(() => {
                                                        const emp = employees.find(e => e._id === salary?.employee?._id) as any;
                                                        return (totals.effectiveWorkingDays * (emp?.standardWorkingHours || 9)).toFixed(1);
                                                    })()}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="text-slate-500 font-medium">Total Work Hrs</span>
                                                <span className="font-bold text-blue-600 dark:text-blue-400">{totals.totalDutyHours.toFixed(1)}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="text-slate-500 font-medium">Total Absent Hrs</span>
                                                <span className="font-bold text-red-600 dark:text-red-400">{totals.absentHours.toFixed(1)}</span>
                                            </div>
                                        </div>

                                        {/* OT Column */}
                                        <div className="space-y-2.5">
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="text-slate-500 font-medium">Total OT Hrs</span>
                                                <span className="font-bold text-purple-600 dark:text-purple-400">{totals.totalOtHours.toFixed(1)}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="text-slate-500 font-medium">OT Compensated</span>
                                                <span className="font-bold text-orange-600 dark:text-orange-400">{totals.compensatedHours.toFixed(1)}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="text-slate-500 font-medium">Main OT Hrs</span>
                                                <span className="font-bold text-indigo-600 dark:text-indigo-400">{totals.mainOtHours.toFixed(1)}</span>
                                            </div>
                                        </div>

                                        {/* Pay Column */}
                                        <div className="space-y-2.5">
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="text-slate-500 font-medium">Gross Salary</span>
                                                <span className="font-bold text-slate-700 dark:text-slate-300">₹ {Math.round(totals.grossPay).toLocaleString()}</span>
                                            </div>
                                            {(() => {
                                                const emp = employees.find(e => e._id === salary?.employee?._id) as any;
                                                if (emp?.isOTApplicable) {
                                                    return (
                                                        <>
                                                            <div className="flex justify-between items-center text-xs">
                                                                <span className="text-slate-500 font-medium">OT Compensate Pay</span>
                                                                <span className="font-bold text-orange-600 dark:text-orange-400">₹ {Math.round(totals.otCompensatedPay).toLocaleString()}</span>
                                                            </div>
                                                            <div className="flex justify-between items-center text-xs">
                                                                <span className="text-slate-500 font-medium">Main OT Pay</span>
                                                                <span className="font-bold text-indigo-600 dark:text-indigo-400">₹ {Math.round(totals.mainOtPay).toLocaleString()}</span>
                                                            </div>
                                                            <div className="flex justify-between items-center text-sm pt-1">
                                                                <span className="text-slate-500 font-medium">Total OT Pay</span>
                                                                <span className="font-bold text-emerald-600 dark:text-emerald-400">₹ {Math.round(totals.otPay).toLocaleString()}</span>
                                                            </div>
                                                        </>
                                                    );
                                                }
                                                return null;
                                            })()}
                                            <div className="flex justify-between items-center text-sm font-bold pt-1 border-t border-slate-100 dark:border-slate-700 mt-1">
                                                <span className="text-slate-700 dark:text-slate-200">Net Payable</span>
                                                <span className="text-emerald-600 dark:text-emerald-400">₹ {Math.round(totals.netPay).toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>

                    {/* Calendar Grid */}
                    <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left whitespace-nowrap">
                                <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                                    <tr>
                                        <th className="px-3.5 py-3 font-semibold">Date</th>
                                        <th className="px-3 py-3 font-semibold">Day</th>
                                        <th className="px-3 py-3 font-semibold">Check-In</th>
                                        <th className="px-3 py-3 font-semibold">Check-Out</th>
                                        <th className="px-3 py-3 font-semibold">DB Status</th>
                                        <th className="px-3 py-3 font-semibold">Total Duty Hrs</th>
                                        {(() => {
                                            const emp = employees.find(e => e._id === salary?.employee?._id) as any;
                                            return emp?.isOTApplicable ? <th className="px-3 py-3 font-semibold text-purple-600 dark:text-purple-400">OT Hrs</th> : null;
                                        })()}
                                        <th className="px-3 py-3 font-semibold text-center">Override</th>
                                        <th className="px-3 py-3 font-semibold">Final Status</th>
                                        <th className="px-3 py-3 font-semibold">Final Duty Hrs</th>
                                        {(() => {
                                            const emp = employees.find(e => e._id === salary?.employee?._id) as any;
                                            return emp?.isOTApplicable ? <th className="px-3 py-3 font-semibold text-purple-600 dark:text-purple-400">Final OT Hrs</th> : null;
                                        })()}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-xs">
                                    {calendarData.map((d, idx) => {
                                        const emp = employees.find(e => e._id === salary?.employee?._id) as any;
                                        const isOT = Boolean(emp?.isOTApplicable);

                                        return (
                                            <tr key={d.date} className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors ${
                                                d.useManual ? 'bg-amber-50/30 dark:bg-amber-950/20' : d.dayName === 'Sun' || d.originalStatus === 'Holiday' ? 'bg-red-50/30 dark:bg-red-900/5' : ''
                                            }`}>
                                                {/* Date */}
                                                <td className="px-3.5 py-2.5 font-medium text-slate-700 dark:text-slate-300 font-mono">
                                                    {d.date}
                                                </td>

                                                {/* Day */}
                                                <td className={`px-3 py-2.5 font-bold ${d.dayName === 'Sun' || d.originalStatus === 'Holiday' ? 'text-red-500' : 'text-slate-500 dark:text-slate-400'}`}>
                                                    {d.dayName}
                                                </td>

                                                {/* Check-In */}
                                                <td className="px-3 py-2.5 font-mono">
                                                    {d.originalCheckIn ? (
                                                        <span className="text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                                                            {formatPunchTime(d.originalCheckIn)}
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-400">-</span>
                                                    )}
                                                </td>

                                                {/* Check-Out */}
                                                <td className="px-3 py-2.5 font-mono">
                                                    {d.originalCheckOut ? (
                                                        <span className="text-rose-700 dark:text-rose-400 font-bold bg-rose-50 dark:bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-800">
                                                            {formatPunchTime(d.originalCheckOut)}
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-400">-</span>
                                                    )}
                                                </td>

                                                {/* Original DB Status */}
                                                <td className="px-3 py-2.5">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded font-medium text-[11px] ${
                                                        d.originalStatus === 'Present' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                                        d.originalStatus === 'Holiday' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                                        d.originalStatus === 'HalfDay' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                                        ['CL', 'SL'].includes(d.originalStatus) ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                                                        'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                                    }`}>
                                                        {d.originalStatus || 'Absent'}
                                                    </span>
                                                </td>

                                                {/* Total Duty Hours */}
                                                <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300 font-mono font-bold">
                                                    {d.originalHours ? `${d.originalHours.toFixed(1)}h` : '0h'}
                                                </td>

                                                {/* OT Hours */}
                                                {isOT && (
                                                    <td className="px-3 py-2.5 font-mono">
                                                        {(d.otHours ?? 0) > 0 ? (
                                                            <span className="px-2 py-0.5 rounded font-bold bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                                                +{(d.otHours ?? 0).toFixed(1)}h
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-400">-</span>
                                                        )}
                                                    </td>
                                                )}

                                                {/* Override Button */}
                                                <td className="px-3 py-2.5 text-center">
                                                    <button
                                                        onClick={() => toggleManual(idx)}
                                                        className={`p-1.5 rounded-md transition-colors ${
                                                            d.useManual 
                                                                ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-400' 
                                                                : 'bg-slate-100 text-slate-400 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700'
                                                        }`}
                                                        title={d.useManual ? "Revert to Original" : "Override manually"}
                                                    >
                                                        <RefreshCw size={14} className={d.useManual ? "animate-spin-once" : ""} />
                                                    </button>
                                                </td>

                                                {/* Final Status */}
                                                <td className="px-3 py-2.5">
                                                    {d.useManual ? (
                                                        <select
                                                            value={d.manualStatus}
                                                            onChange={(e) => updateManualField(idx, 'manualStatus', e.target.value)}
                                                            className="w-32 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700/50 text-slate-700 dark:text-slate-200 text-xs rounded-md focus:ring-amber-500 focus:border-amber-500 px-2 py-1 font-bold"
                                                        >
                                                            <option value="Present">Present</option>
                                                            <option value="Absent">Absent</option>
                                                            <option value="HalfDay">HalfDay</option>
                                                            <option value="Holiday">Holiday</option>
                                                            <option value="CL">CL</option>
                                                            <option value="SL">SL</option>
                                                            <option value="CO">Comp Off (CO)</option>
                                                        </select>
                                                    ) : (
                                                        <span className="text-slate-500 dark:text-slate-400 text-xs">-</span>
                                                    )}
                                                </td>

                                                {/* Final Duty Hours Input */}
                                                <td className="px-3 py-2.5">
                                                    {d.useManual ? (
                                                        <div className="flex items-center gap-1 w-24">
                                                            <input
                                                                type="number"
                                                                value={d.manualHours || 0}
                                                                onChange={(e) => updateManualField(idx, 'manualHours', Number(e.target.value))}
                                                                className="w-full bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700/50 text-slate-700 dark:text-slate-200 text-xs rounded-md focus:ring-amber-500 focus:border-amber-500 px-2 py-1 font-mono font-bold"
                                                                step="0.5"
                                                            />
                                                            <span className="text-xs text-slate-400">h</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-500 dark:text-slate-400 text-xs">-</span>
                                                    )}
                                                </td>

                                                {/* Final OT Hours */}
                                                {isOT && (
                                                    <td className="px-3 py-2.5 font-mono">
                                                        {d.useManual ? (
                                                            (d.manualOtHours ?? 0) > 0 ? (
                                                                <span className="px-2 py-0.5 rounded font-bold bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                                                    +{(d.manualOtHours ?? 0).toFixed(1)}h
                                                                </span>
                                                            ) : (
                                                                <span className="text-slate-400">0h</span>
                                                            )
                                                        ) : (
                                                            <span className="text-slate-400">-</span>
                                                        )}
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-end gap-3 rounded-b-2xl">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                        disabled={saving}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-70"
                    >
                        {saving ? (
                            <><LoadingSpinner size="sm" /> Updating...</>
                        ) : (
                            <><Save size={16} /> Update Salary</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

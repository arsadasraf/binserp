"use client";

import React, { useState, useEffect } from 'react';
import { X, Check, Clock, Calendar, User, AlertCircle, Save } from 'lucide-react';
import { formatWorkDuration } from '@/src/utils/attendanceUtils';

export interface DayStatus {
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

interface DailyLogsModalProps {
    isOpen: boolean;
    onClose: () => void;
    employee: any;
    month: string;
    year: number;
    initialLogs: DayStatus[];
    onSaveLogs: (employeeId: string, updatedLogs: DayStatus[]) => void;
}

export default function DailyLogsModal({
    isOpen,
    onClose,
    employee,
    month,
    year,
    initialLogs,
    onSaveLogs
}: DailyLogsModalProps) {
    const [calendarData, setCalendarData] = useState<DayStatus[]>([]);

    useEffect(() => {
        if (isOpen && initialLogs) {
            setCalendarData(JSON.parse(JSON.stringify(initialLogs)));
        }
    }, [isOpen, initialLogs]);

    if (!isOpen || !employee) return null;

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

    const toggleManual = (index: number) => {
        const newData = [...calendarData];
        newData[index].useManual = !newData[index].useManual;
        setCalendarData(newData);
    };

    const updateManualField = (index: number, field: keyof DayStatus, value: any) => {
        const newData = [...calendarData];
        newData[index] = { ...newData[index], [field]: value };

        const standardHours = employee?.standardWorkingHours || 9;

        if (field === 'manualStatus') {
            if (value === 'Present' && newData[index].manualHours === 0) {
                newData[index].manualHours = standardHours;
            } else if (value === 'HalfDay' && newData[index].manualHours === 0) {
                newData[index].manualHours = standardHours / 2;
            } else if (['Absent', 'Holiday', 'CL', 'SL', 'CO'].includes(value)) {
                newData[index].manualHours = 0;
            }
        }

        newData[index].manualOtHours = getDailyOtHours(
            newData[index].manualHours || 0,
            newData[index].dayName,
            newData[index].manualStatus === 'Holiday' || newData[index].originalStatus === 'Holiday',
            employee
        );

        setCalendarData(newData);
    };

    const handleApply = () => {
        onSaveLogs(employee._id, calendarData);
        onClose();
    };

    const isOT = Boolean(employee?.isOTApplicable);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
                {/* Modal Header */}
                <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                            <Clock size={20} />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                Daily Attendance & Punch Overrides
                                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                                    {month} {year}
                                </span>
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Employee: <span className="font-semibold text-slate-700 dark:text-slate-200">{employee.name}</span> ({employee.employeeId}) &bull; {employee.department || 'General'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Info Note */}
                <div className="px-6 py-2.5 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-900/40 flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300">
                    <AlertCircle size={15} className="shrink-0" />
                    <span>Toggle manual override to adjust punches, leaves (CL/SL), or duty hours for specific dates. Changes will update salary calculations for this employee.</span>
                </div>

                {/* Table Content */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase text-[11px] font-semibold sticky top-0 z-10">
                            <tr>
                                <th className="px-3.5 py-2.5">Date</th>
                                <th className="px-3.5 py-2.5">Day</th>
                                <th className="px-3.5 py-2.5">Check-In</th>
                                <th className="px-3.5 py-2.5">Check-Out</th>
                                <th className="px-3.5 py-2.5">Original Status</th>
                                <th className="px-3.5 py-2.5">Duty Hrs</th>
                                {isOT && <th className="px-3.5 py-2.5">OT Hrs</th>}
                                <th className="px-3.5 py-2.5 text-center">Override?</th>
                                <th className="px-3.5 py-2.5">Manual Status</th>
                                <th className="px-3.5 py-2.5">Manual Duty Hrs</th>
                                {isOT && <th className="px-3.5 py-2.5">Manual OT</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {calendarData.map((day, idx) => (
                                <tr
                                    key={day.date}
                                    className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                                        day.useManual ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''
                                    }`}
                                >
                                    <td className="px-3.5 py-2 font-mono text-slate-700 dark:text-slate-300">
                                        {day.date}
                                    </td>
                                    <td className={`px-3.5 py-2 font-semibold ${day.dayName === 'Sun' || day.originalStatus === 'Holiday' ? 'text-red-500' : 'text-slate-500 dark:text-slate-400'}`}>
                                        {day.dayName}
                                    </td>
                                    <td className="px-3.5 py-2 font-mono">
                                        {day.originalCheckIn ? (
                                            <span className="text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                                                {formatPunchTime(day.originalCheckIn)}
                                            </span>
                                        ) : (
                                            <span className="text-slate-400">-</span>
                                        )}
                                    </td>
                                    <td className="px-3.5 py-2 font-mono">
                                        {day.originalCheckOut ? (
                                            <span className="text-rose-700 dark:text-rose-400 font-bold bg-rose-50 dark:bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-800">
                                                {formatPunchTime(day.originalCheckOut)}
                                            </span>
                                        ) : (
                                            <span className="text-slate-400">-</span>
                                        )}
                                    </td>
                                    <td className="px-3.5 py-2">
                                        <span className={`px-2 py-0.5 rounded font-medium text-[11px] ${
                                            day.originalStatus === 'Present' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                            day.originalStatus === 'Holiday' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                            day.originalStatus === 'HalfDay' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                            ['CL', 'SL'].includes(day.originalStatus) ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' :
                                            'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                        }`}>
                                            {day.originalStatus || 'Absent'}
                                        </span>
                                    </td>
                                    <td className="px-3.5 py-2 font-mono font-bold text-slate-700 dark:text-slate-300">
                                        {formatWorkDuration({ checkIn: { time: day.originalCheckIn }, checkOut: { time: day.originalCheckOut }, hoursWorked: day.originalHours }, { zeroPlaceholder: '0h' })}
                                    </td>
                                    {isOT && (
                                        <td className="px-3.5 py-2 font-mono">
                                            {(day.otHours ?? 0) > 0 ? (
                                                <span className="px-2 py-0.5 rounded font-bold bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                                    +{(day.otHours ?? 0).toFixed(1)}h
                                                </span>
                                            ) : (
                                                <span className="text-slate-400">-</span>
                                            )}
                                        </td>
                                    )}
                                    <td className="px-3.5 py-2 text-center">
                                        <button
                                            type="button"
                                            onClick={() => toggleManual(idx)}
                                            className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 ease-in-out ${day.useManual ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`}
                                            title={day.useManual ? "Revert to Original" : "Override manually"}
                                        >
                                            <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform duration-200 ease-in-out ${day.useManual ? 'translate-x-4' : ''}`}></div>
                                        </button>
                                    </td>
                                    <td className="px-3.5 py-2">
                                        <select
                                            disabled={!day.useManual}
                                            value={day.manualStatus}
                                            onChange={(e) => updateManualField(idx, 'manualStatus', e.target.value)}
                                            className={`w-28 px-2 py-1 rounded border text-xs outline-none ${
                                                day.useManual
                                                    ? 'bg-white border-blue-400 dark:bg-slate-900 dark:border-blue-600 dark:text-white font-bold'
                                                    : 'bg-slate-100 border-transparent opacity-50 dark:bg-slate-800'
                                            }`}
                                        >
                                            <option value="Present">Present</option>
                                            <option value="Absent">Absent</option>
                                            <option value="HalfDay">Half Day</option>
                                            <option value="Holiday">Holiday</option>
                                            {employee?.leaves?.casualLeave > 0 && <option value="CL">CL</option>}
                                            {employee?.leaves?.sickLeave > 0 && <option value="SL">SL</option>}
                                            <option value="CO">Comp Off (CO)</option>
                                        </select>
                                    </td>
                                    <td className="px-3.5 py-2">
                                        <div className="flex items-center gap-1">
                                            <input
                                                type="number"
                                                step="0.5"
                                                disabled={!day.useManual}
                                                value={day.useManual ? day.manualHours : (day.originalHours || 0)}
                                                onChange={(e) => updateManualField(idx, 'manualHours', Number(e.target.value))}
                                                className={`w-16 px-2 py-1 rounded border text-xs outline-none font-mono ${
                                                    day.useManual
                                                        ? 'bg-white border-blue-400 dark:bg-slate-900 dark:border-blue-600 dark:text-white font-bold'
                                                        : 'bg-slate-100 border-transparent opacity-50 dark:bg-slate-800'
                                                }`}
                                            />
                                            <span className="text-[10px] text-slate-400">h</span>
                                        </div>
                                    </td>
                                    {isOT && (
                                        <td className="px-3.5 py-2 font-mono">
                                            {day.useManual ? (
                                                (day.manualOtHours ?? 0) > 0 ? (
                                                    <span className="px-2 py-0.5 rounded font-bold bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                                        +{(day.manualOtHours ?? 0).toFixed(1)}h
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
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Footer */}
                <div className="px-6 py-3 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                        Total Days: <span className="font-semibold text-slate-700 dark:text-slate-200">{calendarData.length}</span> &bull; Overridden: <span className="font-semibold text-blue-600 dark:text-blue-400">{calendarData.filter(d => d.useManual).length}</span>
                    </span>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleApply}
                            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-md flex items-center gap-1.5 transition-colors"
                        >
                            <Save size={14} /> Apply Overrides
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

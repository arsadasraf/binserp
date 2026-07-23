"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Search, FileSpreadsheet, FileText, Calendar, IndianRupee, Calculator, RefreshCw } from 'lucide-react';
import axios from 'axios';
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { Employee, Salary } from '../types/hr.types';
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

    // Overrides
    manualStatus: string; // "Present", "Absent", "HalfDay"
    manualHours: number;
    useManual: boolean;
}

export default function SalariesTab() {
    // 1. Top Level Tab & Date Selection
    const [activeMainTab, setActiveMainTab] = useState<'generator' | 'saved'>('generator');
    const [month, setMonth] = useState(new Date().toLocaleString('default', { month: 'long' }));
    const [year, setYear] = useState(new Date().getFullYear());

    // 2. Employee Selection (For Generator)
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [employeeSearchTerm, setEmployeeSearchTerm] = useState("");
    
    // Derived values for search
    const filteredEmployees = employees.filter(e => 
        e.name.toLowerCase().includes(employeeSearchTerm.toLowerCase()) || 
        e.employeeId.toLowerCase().includes(employeeSearchTerm.toLowerCase())
    );
    const selectedEmployeeDisplay = employees.find(e => e._id === selectedEmployeeId)?.name 
        ? `${employees.find(e => e._id === selectedEmployeeId)?.name} (${employees.find(e => e._id === selectedEmployeeId)?.employeeId})`
        : "-- Select Employee --";

    // 3. Data State
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [calendarData, setCalendarData] = useState<DayStatus[]>([]);
    const [existingSalaryId, setExistingSalaryId] = useState<string | null>(null);

    // 4. Saved Salaries Tab State
    const [savedSalaries, setSavedSalaries] = useState<any[]>([]);
    const [loadingSaved, setLoadingSaved] = useState(false);
    const [savedSalarySearchTerm, setSavedSalarySearchTerm] = useState("");

    const filteredSavedSalaries = useMemo(() => {
        let filtered = savedSalaries;
        if (selectedEmployeeId) {
            filtered = filtered.filter(salary => salary.employee?._id === selectedEmployeeId);
        }
        if (savedSalarySearchTerm) {
            const term = savedSalarySearchTerm.toLowerCase();
            filtered = filtered.filter(salary => 
                (salary.employee?.name || '').toLowerCase().includes(term) || 
                (salary.employee?.employeeId || '').toLowerCase().includes(term)
            );
        }
        return filtered;
    }, [savedSalaries, savedSalarySearchTerm, selectedEmployeeId]);

    // 5. Salary Config
    const [baseSalary, setBaseSalary] = useState(0);
    const [otRatePH, setOtRatePH] = useState(0);
    const [companyLogo, setCompanyLogo] = useState<string | null>(null);
    const [companyName, setCompanyName] = useState<string | null>(null);
    const [companyAddress, setCompanyAddress] = useState<string | null>(null);
    const [currency, setCurrency] = useState('₹');

    // Fetch Employees and Company Branding on Mount
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
                // Company name: prefer HR settings branding, fallback to company profile
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

    // Load Data when selection changes
    useEffect(() => {
        if (selectedEmployeeId && month && year && activeMainTab === 'generator') {
            loadAttendanceData();

            // Auto-fill salary config from employee profile
            const emp = employees.find(e => e._id === selectedEmployeeId);
            if (emp?.salary) {
                const basis = emp.salary.perDayCalculationBasis || 'Basic';
                if (basis === 'Gross') {
                    setBaseSalary(emp.salary.grossSalary || 0);
                } else if (basis === 'Net') {
                    setBaseSalary(emp.salary.netSalary || 0);
                } else {
                    setBaseSalary(emp.salary.basic || 0);
                }
                
                // Set OT Rate from employee profile, fallback to old logic if 0
                setOtRatePH(emp.salary.otRate || Math.round((emp.salary.basic || 0) / 30 / 8));
            }
        }
    }, [selectedEmployeeId, month, year, employees, activeMainTab]);

    useEffect(() => {
        if (activeMainTab === 'saved') {
            fetchSavedSalaries();
        }
    }, [month, year, activeMainTab]);

    const fetchSavedSalaries = async () => {
        setLoadingSaved(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_BASE_URL}/api/hr/salary`, {
                headers: { Authorization: `Bearer ${token}` },
                params: { month, year }
            });
            setSavedSalaries(res.data || []);
        } catch (error) {
            console.error("Error fetching saved salaries:", error);
        } finally {
            setLoadingSaved(false);
        }
    };

    const loadAttendanceData = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const monthIndex = new Date(`${month} 1, ${year}`).getMonth();
            const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

            const start = new Date(year, monthIndex, 1).toISOString();
            const end = new Date(year, monthIndex, daysInMonth, 23, 59, 59).toISOString();

            // NO longer checking for saved salary here. 
            // The generator pulls fresh real-time data always.
            setExistingSalaryId(null);

            // Fetch DB Attendance and Holidays
            const [attRes, holRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/api/hr/attendance`, {
                    headers: { Authorization: `Bearer ${token}` },
                    params: {
                        startDate: start,
                        endDate: end,
                        employeeId: selectedEmployeeId
                    }
                }),
                axios.get(`${API_BASE_URL}/api/hr/holiday?year=${year}&month=${monthIndex + 1}`, {
                    headers: { Authorization: `Bearer ${token}` }
                })
            ]);

            const attendanceRecords: any[] = attRes.data.attendance || [];
            const holidays: any[] = holRes.data || [];

            // Build Calendar Grid
            const newCalendar: DayStatus[] = [];

            for (let d = 1; d <= daysInMonth; d++) {
                const dateObj = new Date(year, monthIndex, d);
                const dateStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

                // Find existing record (robust date matching)
                const record = attendanceRecords.find((r: any) => {
                    const rDate = new Date(r.date);
                    return rDate.getDate() === d &&
                        rDate.getMonth() === monthIndex &&
                        rDate.getFullYear() === year;
                });

                // Find holiday
                const holiday = holidays.find(h => {
                    const hDate = new Date(h.date);
                    return hDate.getDate() === d &&
                        hDate.getMonth() === monthIndex &&
                        hDate.getFullYear() === year;
                });

                let defaultStatus = record ? record.status : 'Absent';
                if (!record && holiday) {
                    defaultStatus = 'Holiday';
                }

                // Calculate hours fallback if missing
                let computedHours = record?.hoursWorked || 0;
                if (!computedHours && record?.checkIn?.time && record?.checkOut?.time) {
                    const diff = new Date(record.checkOut.time).getTime() - new Date(record.checkIn.time).getTime();
                    computedHours = Number((diff / (1000 * 60 * 60)).toFixed(2));
                }

                newCalendar.push({
                    date: dateStr,
                    day: d,
                    dayName: dateObj.toLocaleDateString('en-US', { weekday: 'short' }),
                    originalStatus: defaultStatus,
                    originalCheckIn: record?.checkIn?.time,
                    originalCheckOut: record?.checkOut?.time,
                    originalHours: computedHours,

                    // Defaults for manual override
                    manualStatus: defaultStatus,
                    manualHours: record?.hoursWorked || 0,
                    useManual: false
                });
            }
            setCalendarData(newCalendar);

        } catch (error) {
            console.error("Error loading attendance data", error);
        } finally {
            setLoading(false);
        }
    };

    // Calculate Totals Live
    const totals = useMemo(() => {
        let presentDays = 0;
        let totalOtHours = 0;
        let totalDutyHours = 0;
        let compOffAccrued = 0;

        const emp = employees.find(e => e._id === selectedEmployeeId);
        const standardHours = (emp as any)?.standardWorkingHours || 9;
        const weeklyOff = (emp as any)?.weeklyOff || "Sunday";
        const holidayWorkPolicy = (emp as any)?.holidayWorkPolicy || "Overtime";
        const weekOffWorkPolicy = (emp as any)?.weekOffWorkPolicy || "Overtime";

        let weeklyOffsCount = 0;

        calendarData.forEach(day => {
            const dateObj = new Date(day.date);
            const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
            const isWeeklyOff = days[dateObj.getDay()] === weeklyOff;
            if (isWeeklyOff) weeklyOffsCount++;

            const status = day.useManual ? day.manualStatus : day.originalStatus;
            const hours = day.useManual ? day.manualHours : (day.originalHours || 0);

            totalDutyHours += hours;

            const isPublicHoliday = day.originalStatus === 'Holiday';

            if (isWeeklyOff) {
                if (hours > 0) {
                    if (weekOffWorkPolicy === "Overtime") totalOtHours += hours;
                    else compOffAccrued += (hours / standardHours);
                }
            } else if (isPublicHoliday) {
                presentDays += 1;
                if (hours > 0) {
                    if (holidayWorkPolicy === "Overtime") totalOtHours += hours;
                    else compOffAccrued += (hours / standardHours);
                }
            } else {
                if (status === 'Present' || status === 'CL' || status === 'SL') presentDays += 1;
                else if (status === 'HalfDay') presentDays += 0.5;
                
                if (hours > standardHours) {
                    totalOtHours += (hours - standardHours);
                }
            }
        });

        const effectiveWorkingDays = calendarData.length - weeklyOffsCount;

        let casualLeaveConsumed = 0;
        let sickLeaveConsumed = 0;

        calendarData.forEach(day => {
            const status = day.useManual ? day.manualStatus : day.originalStatus;
            if (status === 'CL') casualLeaveConsumed += 1;
            if (status === 'SL') sickLeaveConsumed += 1;
        });

        const grossPay = effectiveWorkingDays > 0 ? (baseSalary / effectiveWorkingDays) * presentDays : 0;
        const otPay = totalOtHours * otRatePH;
        const netPay = grossPay + otPay;

        return { 
            presentDays, 
            totalOtHours, 
            totalDutyHours, 
            grossPay, 
            otPay, 
            netPay, 
            casualLeaveConsumed, 
            sickLeaveConsumed,
            compOffAccrued,
            effectiveWorkingDays,
            weeklyOffsCount
        };
    }, [calendarData, baseSalary, otRatePH, employees, selectedEmployeeId]);


    // Handlers
    const toggleManual = (index: number) => {
        const newData = [...calendarData];
        newData[index].useManual = !newData[index].useManual;
        setCalendarData(newData);
    };

    const updateManualField = (index: number, field: keyof DayStatus, value: any) => {
        const newData = [...calendarData];
        newData[index] = { ...newData[index], [field]: value };
        setCalendarData(newData);
    };

    const saveSalary = async () => {
        setSaving(true);
        try {
            const token = localStorage.getItem('token');
            const payload = {
                employeeId: selectedEmployeeId,
                month,
                year,
                presentDays: totals.presentDays,
                totalDutyHours: totals.totalDutyHours,
                totalOtHours: totals.totalOtHours,
                otRatePH: otRatePH,
                grossPay: totals.grossPay,
                otPay: totals.otPay,
                netPay: totals.netPay,
                dailyLogs: calendarData,
                leavesConsumed: { casualLeave: totals.casualLeaveConsumed, sickLeave: totals.sickLeaveConsumed },
                compOffAccrued: totals.compOffAccrued
            };

            if (existingSalaryId) {
                // Update
                await axios.put(`${API_BASE_URL}/api/hr/salary/${existingSalaryId}`, payload, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                alert("Salary record updated successfully!");
            } else {
                // Create
                const res = await axios.post(`${API_BASE_URL}/api/hr/salary`, payload, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setExistingSalaryId(res.data._id);
                alert("Salary record saved successfully!");
            }
        } catch (error: any) {
            console.error("Error saving salary:", error);
            const msg = error.response?.data?.message || error.message || "Unknown error";
            alert(`Failed to save salary record: ${msg}`);
        } finally {
            setSaving(false);
        }
    };

    const handleEditSavedSalary = (salary: any) => {
        setSelectedEmployeeId(salary.employee._id);
        setExistingSalaryId(salary._id);
        setCalendarData(salary.dailyLogs || []);
        if (salary.salaryComponents?.basic) {
            setBaseSalary(salary.salaryComponents.basic);
        }
        if (salary.otRatePH) setOtRatePH(salary.otRatePH);
        setActiveMainTab('generator');
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

    const handleDownloadSavedPDF = (salary: any, slipType: 'Combined' | 'Salary' | 'Overtime') => {
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const emp = salary.employee;
        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();
        const margin = 10;

        const drawHeader = () => {
            doc.setFillColor(37, 99, 235);
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
            doc.setFontSize(10);
            const titleSuffix = slipType === 'Combined' ? '' : ` (${slipType})`;
            doc.text(`Monthly Salary Slip${titleSuffix}`, pageW / 2, 10, { align: 'center' });

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.text(`${salary.month} ${salary.year}`, pageW - margin, 10, { align: 'right' });
            doc.setFontSize(7);
            doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, pageW - margin, 16, { align: 'right' });

            doc.setFillColor(219, 234, 254);
            doc.rect(0, 20, pageW, 12, 'F');
            doc.setTextColor(30, 58, 138);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.text(emp?.name || '-', margin, 27);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor(55, 65, 81);
            const empInfo = `ID: ${emp?.employeeId || '-'}  |  Dept: ${emp?.department || '-'}  |  Desig: ${emp?.designation || '-'}`;
            doc.text(empInfo, pageW - margin, 27, { align: 'right' });
        };

        drawHeader();

        doc.setTextColor(30, 30, 30);
        doc.setFillColor(241, 245, 249);
        doc.rect(0, 32, pageW, 16, 'F');

        const cur = (currency === '₹' || !currency) ? 'Rs.' : currency;
        
        let displayGrossPay = salary.grossSalary || 0;
        let displayOtPay = salary.overtime?.amount || 0;

        if (slipType === 'Overtime') {
            displayGrossPay = 0;
        } else if (slipType === 'Salary') {
            displayOtPay = 0;
        }
        
        const displayNetPay = displayGrossPay + displayOtPay;

        const summaryItems = [
            { label: 'Present Days', value: String(salary.presentDays || 0) },
            { label: 'Duty Hours',   value: String(salary.totalDutyHours || 0) },
            { label: 'OT Hours',     value: Number(salary.overtime?.hours || salary.totalOtHours || 0).toFixed(2) },
            { label: 'Basic Pay',    value: `${cur} ${displayGrossPay.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` },
            { label: 'OT Pay',       value: `${cur} ${displayOtPay.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` },
            { label: 'Net Payable',  value: `${cur} ${displayNetPay.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` },
        ];
        const sw = (pageW - 2 * margin) / summaryItems.length;
        summaryItems.forEach((item, i) => {
            const cx = margin + sw * i + sw / 2;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(30, 30, 30);
            doc.text(item.value, cx, 39, { align: 'center' });
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6.5);
            doc.setTextColor(100, 116, 139);
            doc.text(item.label, cx, 45, { align: 'center' });
        });
        doc.setTextColor(30, 30, 30);

        const tableBody = (salary.dailyLogs || []).map((d: any) => {
            const finalStatus = d.useManual ? d.manualStatus : d.originalStatus;
            const finalHours  = d.useManual ? d.manualHours  : (d.originalHours ?? 0);
            return [
                d.date,
                d.dayName,
                d.originalStatus || 'Absent',
                d.originalHours != null ? `${d.originalHours}h` : '-',
                d.useManual ? `${d.manualStatus} (M)` : finalStatus,
                finalHours != null ? `${finalHours}h` : '-',
            ];
        });

        autoTable(doc, {
            startY: 50,
            margin: { left: margin, right: margin },
            head: [['Date', 'Day', 'DB Status', 'DB Hrs', 'Final Status', 'Final Hrs']],
            body: tableBody,
            theme: 'grid',
            pageBreak: 'avoid',
            styles: { fontSize: 6.5, cellPadding: 1.2, halign: 'center', valign: 'middle', overflow: 'linebreak' },
            headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold', fontSize: 7, cellPadding: 1.5 },
            columnStyles: {
                0: { cellWidth: 26 }, 1: { cellWidth: 12 }, 2: { cellWidth: 32 },
                3: { cellWidth: 18 }, 4: { cellWidth: 56 }, 5: { cellWidth: 46 },
            },
            didParseCell: (data) => {
                if (data.section === 'body') {
                    const day = (salary.dailyLogs || [])[data.row.index];
                    if (day && ['Sat', 'Sun'].includes(day.dayName)) {
                        data.cell.styles.fillColor = [254, 242, 242];
                    }
                    if (data.column.index === 4) {
                        const s = day?.useManual ? day.manualStatus : day?.originalStatus;
                        if (s === 'Present')  data.cell.styles.textColor = [22, 163, 74];
                        else if (s === 'HalfDay') data.cell.styles.textColor = [217, 119, 6];
                        else if (s === 'Holiday') data.cell.styles.textColor = [37, 99, 235];
                        else if (s === 'CL') data.cell.styles.textColor = [79, 70, 229];
                        else if (s === 'SL') data.cell.styles.textColor = [147, 51, 234];
                        else                  data.cell.styles.textColor = [220, 38, 38];
                    }
                }
            },
        });

        const finalY = (doc as any).lastAutoTable?.finalY || pageH - 15;
        if (finalY + 14 < pageH) {
            doc.setDrawColor(200, 200, 200);
            doc.line(margin, finalY + 6, pageW - margin, finalY + 6);
            doc.setFontSize(7);
            doc.setTextColor(160);
            doc.text('This is a system-generated document.', margin, finalY + 11);
            doc.text(companyName || '', pageW - margin, finalY + 11, { align: 'right' });
        }

        doc.save(`Salary_${emp?.name}_${salary.month}_${salary.year}.pdf`);
    };



    return (
        <div className="animate-in duration-300 fade-in space-y-6">
            
            <div className="bg-white border border-gray-100 dark:bg-slate-800 dark:border-slate-700 p-4 rounded-xl shadow-sm flex flex-col xl:flex-row justify-between items-center gap-4 relative z-20">
                <div className="flex gap-2 w-full xl:w-auto">
                    <button 
                        onClick={() => setActiveMainTab('generator')}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex-1 xl:flex-none ${activeMainTab === 'generator' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' : 'text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-slate-700'}`}
                    >
                        Salary Generator
                    </button>
                    <button 
                        onClick={() => setActiveMainTab('saved')}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex-1 xl:flex-none ${activeMainTab === 'saved' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' : 'text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-slate-700'}`}
                    >
                        Saved Salaries
                    </button>
                </div>
                
                <div className="flex flex-col md:flex-row items-center gap-4 w-full xl:w-auto">
                    {/* GLOBAL EMPLOYEE SEARCH */}
                    <div className="relative w-full md:w-64">
                        <div className="flex items-center gap-2">
                            <label className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase hidden md:block">Employee:</label>
                            <div 
                                className="bg-gray-50 border border-gray-200 dark:bg-slate-900 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none px-3 py-2 rounded-lg w-full dark:text-white cursor-pointer flex justify-between items-center text-sm"
                                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            >
                                <span className="truncate">{selectedEmployeeDisplay}</span>
                                <span className="text-gray-400 text-xs ml-2">▼</span>
                            </div>
                        </div>
                        {isDropdownOpen && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setIsDropdownOpen(false)}></div>
                                <div className="absolute z-20 w-full md:w-80 right-0 mt-1 bg-white border border-gray-200 dark:bg-slate-800 dark:border-slate-700 rounded-lg shadow-lg overflow-hidden flex flex-col max-h-80">
                                    <div className="p-2 border-b border-gray-100 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800">
                                        <input 
                                            type="text" 
                                            className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-600 rounded px-3 py-2 text-sm outline-none focus:border-blue-500 dark:text-white"
                                            placeholder="Search employee..."
                                            value={employeeSearchTerm}
                                            onChange={(e) => setEmployeeSearchTerm(e.target.value)}
                                            onClick={(e) => e.stopPropagation()}
                                            autoFocus
                                        />
                                    </div>
                                    <div className="overflow-y-auto custom-scrollbar">
                                        <div 
                                            className={`px-4 py-2 cursor-pointer text-sm hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors ${!selectedEmployeeId ? 'bg-blue-100 dark:bg-slate-600 font-medium text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-200'}`}
                                            onClick={() => {
                                                setSelectedEmployeeId("");
                                                setIsDropdownOpen(false);
                                                setEmployeeSearchTerm("");
                                            }}
                                        >
                                            <span className="font-semibold">All Employees</span> (Saved DB Only)
                                        </div>
                                        <div className="h-px bg-gray-100 dark:bg-slate-700 w-full"></div>
                                        
                                        {filteredEmployees.length > 0 ? filteredEmployees.map(e => (
                                            <div 
                                                key={e._id} 
                                                className={`px-4 py-2 cursor-pointer text-sm hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors ${e._id === selectedEmployeeId ? 'bg-blue-100 dark:bg-slate-600 font-medium text-blue-700 dark:text-blue-300' : 'dark:text-gray-200'}`}
                                                onClick={() => {
                                                    setSelectedEmployeeId(e._id);
                                                    setIsDropdownOpen(false);
                                                    setEmployeeSearchTerm("");
                                                }}
                                            >
                                                {e.name} ({e.employeeId})
                                            </div>
                                        )) : (
                                            <div className="px-4 py-3 text-sm text-gray-500 text-center">No matching employees</div>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="hidden md:block h-8 w-px bg-gray-200 dark:bg-slate-700"></div>

                    {/* PERIOD SECTION */}
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <label className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase hidden md:block">Period:</label>
                        <select
                            className="bg-gray-50 border border-gray-200 dark:bg-slate-900 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none px-3 py-2 rounded-lg text-sm dark:text-white w-full md:w-auto"
                            value={month}
                            onChange={(e) => setMonth(e.target.value)}
                        >
                            {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map(m => (
                                <option key={m} value={m}>{m}</option>
                            ))}
                        </select>
                        <select
                            className="bg-gray-50 border border-gray-200 dark:bg-slate-900 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none px-3 py-2 rounded-lg text-sm dark:text-white w-full md:w-auto"
                            value={year}
                            onChange={(e) => setYear(Number(e.target.value))}
                        >
                            {Array.from({ length: new Date().getFullYear() - 2023 + 1 }, (_, i) => 2023 + i).map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* GENERATOR TAB CONTENT */}
            {activeMainTab === 'generator' && (
            <>


            {loading && (
                <div className="bg-white dark:bg-slate-800 p-12 rounded-xl shadow-sm text-center">
                    <LoadingSpinner />
                    <p className="dark:text-gray-400 mt-2 text-gray-500">Loading attendance records...</p>
                </div>
            )}

            {!loading && selectedEmployeeId && calendarData.length > 0 && (
                <div className="gap-6 grid grid-cols-1 lg:grid-cols-3">

                    {/* 2. Main Daily Log Table (2 Cols) */}
                    <div className="bg-white border border-gray-100 dark:bg-slate-800 dark:border-slate-700 lg:col-span-2 overflow-hidden rounded-xl shadow-sm">
                        <div className="bg-gray-50 border-b border-gray-100 dark:bg-slate-800/50 dark:border-slate-700 flex items-center justify-between p-4">
                            <h3 className="dark:text-gray-200 flex font-bold gap-2 items-center text-gray-700">
                                <Calendar size={18} /> Daily Attendance Log
                            </h3>
                            <span className="bg-blue-50 border border-blue-100 px-2 py-1 rounded text-blue-600 text-xs">
                                Toggle "Manual" to edit specific days
                            </span>
                        </div>

                        <div className="max-h-[600px] overflow-x-auto overflow-y-auto">
                            <table className="text-left text-sm w-full">
                                <thead className="bg-gray-50 dark:bg-slate-800/50 dark:text-gray-400 shadow-sm sticky text-gray-500 text-xs top-0 uppercase z-10">
                                    <tr>
                                        <th className="px-4 py-3">Date</th>
                                        <th className="px-4 py-3">Day</th>
                                        <th className="px-4 py-3">DB Status</th>
                                        <th className="px-4 py-3">DB Hours</th>
                                        <th className="px-4 py-3 text-center">Edit</th>
                                        <th className="px-4 py-3">Manual Status</th>
                                        <th className="px-4 py-3">Manual Hours</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-gray-100 divide-y">
                                    {calendarData.map((day, idx) => (
                                        <tr key={day.date} className={`hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors ${day.useManual ? 'bg-blue-50/30 dark:bg-blue-900/30' : ''}`}>
                                            <td className="dark:text-gray-200 font-medium px-4 py-3 text-gray-700">{day.date}</td>
                                            <td className={`px-4 py-3 ${['Sat', 'Sun'].includes(day.dayName) ? 'text-red-500 font-bold' : 'text-gray-500 dark:text-gray-400'}`}>
                                                {day.dayName}
                                            </td>

                                            {/* Original Data View */}
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-0.5 rounded text-xs ${
                                                    day.originalStatus === 'Present' ? 'bg-green-100 text-green-700' : 
                                                    day.originalStatus === 'Holiday' ? 'bg-blue-100 text-blue-700' :
                                                    day.originalStatus === 'CL' ? 'bg-indigo-100 text-indigo-700' :
                                                    day.originalStatus === 'SL' ? 'bg-purple-100 text-purple-700' :
                                                    'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-gray-300'
                                                }`}>
                                                    {day.originalStatus}
                                                </span>
                                            </td>
                                            <td className="dark:text-gray-300 font-mono px-4 py-3 text-gray-600 text-xs">
                                                {day.originalHours ? `${day.originalHours}h` : '-'}
                                            </td>

                                            {/* Toggle Switch */}
                                            <td className="px-4 py-3 text-center">
                                                <button
                                                    onClick={() => toggleManual(idx)}
                                                    className={`w-10 h-6 rounded-full p-1 transition-colors duration-200 ease-in-out ${day.useManual ? 'bg-blue-600' : 'bg-gray-200 dark:bg-slate-600'}`}
                                                >
                                                    <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform duration-200 ease-in-out ${day.useManual ? 'translate-x-4' : ''}`}></div>
                                                </button>
                                            </td>

                                            {/* Manual Config */}
                                            <td className="px-4 py-3">
                                                <select
                                                    disabled={!day.useManual}
                                                    value={day.manualStatus}
                                                    onChange={(e) => updateManualField(idx, 'manualStatus', e.target.value)}
                                                    className={`w-28 px-2 py-1 rounded border text-xs outline-none focus:ring-1 focus:ring-blue-500 ${day.useManual ? 'bg-white border-gray-300 dark:bg-slate-900 dark:border-slate-700 dark:text-white' : 'bg-gray-100 border-transparent opacity-50 dark:bg-slate-800'}`}
                                                >
                                                    <option value="Present">Present</option>
                                                    <option value="Absent">Absent</option>
                                                    <option value="HalfDay">Half Day</option>
                                                    <option value="Holiday">Holiday</option>
                                                    {(() => {
                                                        const emp = employees.find(e => e._id === selectedEmployeeId);
                                                        const leaves = (emp as any)?.leaves;
                                                        return (
                                                            <>
                                                                {leaves?.casualLeave > 0 && <option value="CL">CL</option>}
                                                                {leaves?.sickLeave > 0 && <option value="SL">SL</option>}
                                                            </>
                                                        );
                                                    })()}
                                                </select>
                                            </td>
                                            <td className="px-4 py-3">
                                                <input
                                                    type="number"
                                                    step="0.5"
                                                    disabled={!day.useManual}
                                                    value={day.manualHours}
                                                    onChange={(e) => updateManualField(idx, 'manualHours', Number(e.target.value))}
                                                    className={`w-16 px-2 py-1 rounded border text-xs outline-none focus:ring-1 focus:ring-blue-500 ${day.useManual ? 'bg-white border-gray-300 dark:bg-slate-900 dark:border-slate-700 dark:text-white' : 'bg-gray-100 border-transparent opacity-50 dark:bg-slate-800'}`}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* 3. Calculations Panel (1 Col) */}
                    <div className="space-y-6">

                        {/* Config Card */}
                        <div className="bg-white border border-gray-100 dark:bg-slate-800 dark:border-slate-700 p-6 rounded-xl shadow-sm">
                            <h4 className="dark:text-gray-100 flex font-bold gap-2 items-center mb-4 text-gray-800">
                                <IndianRupee size={18} /> Salary Configuration
                            </h4>
                            <div className="space-y-4">
                                <div>
                                    <label className="block dark:text-gray-400 font-semibold mb-1 text-gray-500 text-xs uppercase">Base Salary For Calculation</label>
                                    <div className="relative">
                                        <span className="-translate-y-1/2 absolute dark:text-gray-500 left-3 text-gray-400 top-1/2">₹</span>
                                        <input
                                            type="number"
                                            value={baseSalary}
                                            onChange={(e) => setBaseSalary(Number(e.target.value))}
                                            className="border border-gray-200 dark:border-slate-600 focus:ring-2 focus:ring-blue-500 outline-none pl-7 pr-3 py-2 rounded-lg w-full bg-gray-50"
                                            disabled
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block dark:text-gray-400 font-semibold mb-1 text-gray-500 text-xs uppercase">OT Rate (Per Hour)</label>
                                    <div className="relative">
                                        <span className="-translate-y-1/2 absolute dark:text-gray-500 left-3 text-gray-400 top-1/2">₹</span>
                                        <input
                                            type="number"
                                            value={otRatePH}
                                            onChange={(e) => setOtRatePH(Number(e.target.value))}
                                            className="border border-gray-200 dark:border-slate-600 focus:ring-2 focus:ring-blue-500 outline-none pl-7 pr-3 py-2 rounded-lg w-full"
                                        />
                                    </div>
                                </div>

                            </div>
                        </div>

                        {/* Summary Card */}
                        <div className="bg-gradient-to-br from-indigo-600 p-6 rounded-xl shadow-lg text-white to-blue-700">
                            <h4 className="flex font-bold gap-2 items-center mb-6 text-blue-100">
                                <Calculator size={18} /> Pay Summary
                            </h4>

                            <div className="mb-6 space-y-3">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-blue-200">Total Present Days</span>
                                    <span className="font-bold text-lg">{totals.presentDays}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-blue-200">Total Duty Hours</span>
                                    <span className="font-bold text-lg">{totals.totalDutyHours}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-blue-200">Total OT Hours</span>
                                    <span className="font-bold text-lg">{totals.totalOtHours}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-blue-200">Effective Working Days</span>
                                    <span className="font-bold text-lg">{totals.effectiveWorkingDays}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-blue-200">Weekly Offs</span>
                                    <span className="font-bold text-lg">{totals.weeklyOffsCount}</span>
                                </div>
                                {totals.compOffAccrued > 0 && (
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-green-200">Comp Off Accrued</span>
                                        <span className="font-bold text-lg text-green-100">+{totals.compOffAccrued} Days</span>
                                    </div>
                                )}
                                {totals.casualLeaveConsumed > 0 && (
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-indigo-200">Casual Leaves (CL)</span>
                                        <span className="font-bold text-lg text-indigo-100">{totals.casualLeaveConsumed}</span>
                                    </div>
                                )}
                                {totals.sickLeaveConsumed > 0 && (
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-purple-200">Sick Leaves (SL)</span>
                                        <span className="font-bold text-lg text-purple-100">{totals.sickLeaveConsumed}</span>
                                    </div>
                                )}
                            </div>

                            <div className="border-t border-white/20 pt-4 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="opacity-80">Basic Pay</span>
                                    <span>₹ {totals.grossPay.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="opacity-80">OT Pay</span>
                                    <span>₹ {totals.otPay.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                                </div>
                                <div className="border-t border-white/20 flex items-center justify-between mt-2 pt-2">
                                    <span className="font-bold text-lg">Net Payable</span>
                                    <span className="font-bold text-2xl">₹ {totals.netPay.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                                </div>
                            </div>
                            <button
                                onClick={saveSalary}
                                disabled={saving}
                                className="w-full mt-6 bg-white text-indigo-700 font-bold py-3 rounded-lg hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50"
                            >
                                {saving ? "Saving..." : existingSalaryId ? "Update Salary Record" : "Save Salary Record"}
                            </button>
                        </div>

                        <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl">
                            <h5 className="flex font-bold gap-2 items-center mb-2 text-blue-800 text-sm"><RefreshCw size={14} /> Auto-Calculation</h5>
                            <p className="leading-relaxed text-blue-600 text-xs">
                                Calculations are done in real-time based on the table entries.
                                You can save these calculations to the database using the button above.
                            </p>
                        </div>

                    </div>
                </div>
            )}

            {!selectedEmployeeId && !loading && (
                <div className="bg-gray-50 border-2 border-dashed border-gray-200 dark:bg-slate-800/50 dark:border-slate-600 py-20 rounded-xl text-center">
                    <div className="bg-white dark:bg-slate-800 inline-block mb-4 p-4 rounded-full shadow-sm">
                        <IndianRupee size={32} className="text-green-500" />
                    </div>
                    <h3 className="dark:text-gray-200 font-bold text-gray-700 text-lg">Salary Calculator</h3>
                    <p className="dark:text-gray-400 mt-1 text-gray-500 text-sm">Select an employee and period to start generating salary slips.</p>
                </div>
            )}
            </>
            )}

            {/* SAVED DATABASE TAB CONTENT */}
            {activeMainTab === 'saved' && (
                <div className="bg-white border border-gray-100 dark:bg-slate-800 dark:border-slate-700 p-6 rounded-xl shadow-sm">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
                        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">Saved Salaries for {month} {year}</h3>
                        <div className="relative w-full md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input 
                                type="text"
                                placeholder="Search by name or ID..."
                                className="w-full bg-gray-50 border border-gray-200 dark:bg-slate-900 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none pl-9 pr-3 py-2 rounded-lg text-sm dark:text-white"
                                value={savedSalarySearchTerm}
                                onChange={(e) => setSavedSalarySearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                    {loadingSaved ? (
                        <div className="py-12 text-center">
                            <LoadingSpinner />
                            <p className="dark:text-gray-400 mt-2 text-gray-500 text-sm">Loading saved records...</p>
                        </div>
                    ) : filteredSavedSalaries.length === 0 ? (
                        <div className="py-12 text-center text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-lg">
                            No salary records found matching your search.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 dark:bg-slate-900 dark:text-gray-400 text-gray-500 uppercase text-xs">
                                    <tr>
                                        <th className="px-4 py-3">Employee</th>
                                        <th className="px-4 py-3">Present Days</th>
                                        <th className="px-4 py-3">Basic Pay</th>
                                        <th className="px-4 py-3">OT Pay</th>
                                        <th className="px-4 py-3">Net Pay</th>
                                        <th className="px-4 py-3">Status</th>
                                        <th className="px-4 py-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                                    {filteredSavedSalaries.map(salary => (
                                        <tr key={salary._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                            <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">
                                                {salary.employee?.name || 'Unknown'} <br/>
                                                <span className="text-xs text-gray-500 dark:text-gray-400">{salary.employee?.employeeId}</span>
                                            </td>
                                            <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{salary.presentDays}</td>
                                            <td className="px-4 py-3 text-gray-600 dark:text-gray-300">₹ {salary.grossSalary?.toLocaleString(undefined, {maximumFractionDigits: 2}) || '0'}</td>
                                            <td className="px-4 py-3 text-gray-600 dark:text-gray-300">₹ {salary.overtime?.amount?.toLocaleString(undefined, {maximumFractionDigits: 2}) || '0'}</td>
                                            <td className="px-4 py-3 font-semibold text-gray-800 dark:text-gray-200">₹ {salary.netSalary?.toLocaleString(undefined, {maximumFractionDigits: 2}) || '0'}</td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 text-xs rounded-full ${salary.status === 'Paid' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600 dark:bg-slate-600 dark:text-gray-300'}`}>
                                                    {salary.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right space-x-2">
                                                <button 
                                                    onClick={() => handleEditSavedSalary(salary)}
                                                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-xs font-medium"
                                                >
                                                    Edit Data
                                                </button>
                                                <div className="flex items-center gap-2 justify-end">
                                                    <span className="text-[10px] uppercase font-bold text-gray-400 dark:text-gray-500">PDF:</span>
                                                    <button 
                                                        onClick={() => handleDownloadSavedPDF(salary, 'Combined')}
                                                        className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 text-xs font-medium px-1"
                                                        title="Combined PDF"
                                                    >
                                                        Comb
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDownloadSavedPDF(salary, 'Salary')}
                                                        className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 text-xs font-medium px-1 border-l border-gray-200 dark:border-gray-700"
                                                        title="Standard Salary PDF"
                                                    >
                                                        Sal
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDownloadSavedPDF(salary, 'Overtime')}
                                                        className="text-orange-600 hover:text-orange-800 dark:text-orange-400 dark:hover:text-orange-300 text-xs font-medium px-1 border-l border-gray-200 dark:border-gray-700"
                                                        title="Overtime PDF"
                                                    >
                                                        OT
                                                    </button>
                                                </div>
                                                <button 
                                                    onClick={() => handleDeleteSavedSalary(salary._id)}
                                                    className="text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 text-xs font-medium mt-2"
                                                >
                                                    Delete
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

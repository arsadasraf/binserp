"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { UserCheck, Clock, Calendar, Search, FileDown, FileSpreadsheet } from "lucide-react";
import { API_BASE_URL } from "@/src/utils/config";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

interface AttendanceRecord {
    _id: string;
    employee: {
        _id: string;
        name: string;
        employeeId: string;
        department: string;
    };
    date: string;
    checkIn?: {
        time: string;
        location?: string;
        markedBy?: { name: string };
        method?: string;
    };
    checkOut?: {
        time: string;
        markedBy?: { name: string };
        method?: string;
    };
    verificationMethod?: string;
    status: string;
    hoursWorked?: number;
}

export default function PresentTab() {
    const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
    const [filteredAttendance, setFilteredAttendance] = useState<AttendanceRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");

    // Default to current month YYYY-MM
    const getCurrentMonth = () => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    };
    const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [filterType, setFilterType] = useState<"month" | "day">("month");

    const [companyName, setCompanyName] = useState('');
    const [companyLogo, setCompanyLogo] = useState('');
    const [companyAddress, setCompanyAddress] = useState('');

    useEffect(() => {
        const fetchCompanyDetails = async () => {
            try {
                const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
                if (!token) return;
                const [compRes, prefixRes] = await Promise.all([
                    axios.get(`${API_BASE_URL}/api/company/me`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
                    axios.get(`${API_BASE_URL}/api/hr-prefix`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null)
                ]);
                if (prefixRes?.data?.settings?.companyName) {
                    setCompanyName(prefixRes.data.settings.companyName);
                } else if (compRes?.data?.companyName) {
                    setCompanyName(compRes.data.companyName);
                } else if (compRes?.data?.name) {
                    setCompanyName(compRes.data.name);
                }
                if (prefixRes?.data?.settings?.companyLogo) setCompanyLogo(prefixRes.data.settings.companyLogo);
                if (prefixRes?.data?.settings?.companyAddress) setCompanyAddress(prefixRes.data.settings.companyAddress);
            } catch (err) {
                console.error("Error loading company data", err);
            }
        };
        fetchCompanyDetails();
    }, []);

    useEffect(() => {
        fetchAttendance();
    }, [selectedMonth, selectedDate, filterType]);

    useEffect(() => {
        let filtered = attendance;

        if (statusFilter === "in_only") {
            filtered = filtered.filter(record => record.checkIn?.time && !record.checkOut?.time);
        } else if (statusFilter === "completed") {
            filtered = filtered.filter(record => record.checkOut?.time);
        }

        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            filtered = filtered.filter(
                (record) =>
                    record.employee?.name?.toLowerCase().includes(lowerTerm) ||
                    record.employee?.employeeId?.toLowerCase().includes(lowerTerm) ||
                    record.employee?.department?.toLowerCase().includes(lowerTerm)
            );
        }
        setFilteredAttendance(filtered);
    }, [searchTerm, statusFilter, attendance]);

    const fetchAttendance = async () => {
        try {
            setLoading(true);
            const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
            if (!token) return;

            const [year, month] = selectedMonth.split('-').map(Number);
            let start, end;

            if (filterType === 'month') {
                // Start of month
                start = new Date(year, month - 1, 1, 0, 0, 0, 0);
                // End of month
                end = new Date(year, month, 0, 23, 59, 59, 999);
            } else {
                // Specific day
                const [y, m, d] = selectedDate.split('-').map(Number);
                start = new Date(y, m - 1, d, 0, 0, 0, 0);
                end = new Date(y, m - 1, d, 23, 59, 59, 999);
            }

            const response = await axios.get(
                `${API_BASE_URL}/api/hr/attendance?startDate=${start.toISOString()}&endDate=${end.toISOString()}`,
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );

            // Sort chronologically by check-in time (newest check-in first)
            const sorted = (response.data.attendance || []).sort((a: any, b: any) => {
                const timeA = a.checkIn?.time ? new Date(a.checkIn.time).getTime() : (a.date ? new Date(a.date).getTime() : 0);
                const timeB = b.checkIn?.time ? new Date(b.checkIn.time).getTime() : (b.date ? new Date(b.date).getTime() : 0);
                return timeB - timeA;
            });

            setAttendance(sorted);
            setFilteredAttendance(sorted);
        } catch (error) {
            console.error("Error fetching attendance:", error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusInfo = (record: AttendanceRecord) => {
        const hasCheckIn = Boolean(record.checkIn?.time);
        const hasCheckOut = Boolean(record.checkOut?.time);

        if (hasCheckIn && !hasCheckOut) {
            return {
                label: "Check-In Only",
                badgeClass: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
            };
        }
        if (hasCheckIn && hasCheckOut) {
            return {
                label: "Completed",
                badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
            };
        }
        return {
            label: record.status || "Present",
            badgeClass: record.status === 'Present'
                ? "bg-green-100 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-300"
                : "bg-gray-100 text-gray-700 border-gray-200 dark:bg-slate-800 dark:text-gray-300"
        };
    };

    const downloadPDF = () => {
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();
        const margin = 10;
        const periodText = filterType === 'month' ? selectedMonth : selectedDate;

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
                    doc.addImage(companyLogo, 'JPEG', logoX, logoY, logoSize, logoSize, undefined, 'FAST');
                } catch { /* skip if load fails */ }
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
            doc.text('Attendance Report', pageW / 2, 10, { align: 'center' });

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.text(periodText, pageW - margin, 10, { align: 'right' });
            doc.setFontSize(7);
            doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, pageW - margin, 16, { align: 'right' });

            // Light blue strip
            doc.setFillColor(219, 234, 254);
            doc.rect(0, 20, pageW, 8, 'F');

            doc.setTextColor(30, 58, 138); 
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.text(`Total Records: ${filteredAttendance.length}`, margin, 25);
        };

        drawHeader();

        const tableBody = filteredAttendance.map((record, idx) => [
            String(idx + 1),
            new Date(record.date).toLocaleDateString(),
            record.employee?.employeeId || '-',
            record.employee?.name || '-',
            record.employee?.department || '-',
            record.checkIn?.time ? new Date(record.checkIn.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
            record.checkOut?.time ? new Date(record.checkOut.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
            record.hoursWorked ? `${record.hoursWorked}h` : '-',
            getStatusInfo(record).label
        ]);

        autoTable(doc, {
            startY: 32,
            margin: { left: margin, right: margin },
            head: [['#', 'Date', 'ID', 'Name', 'Dept', 'Check In', 'Check Out', 'Hours', 'Status']],
            body: tableBody,
            theme: 'grid',
            styles: {
                fontSize: 6.5,
                cellPadding: 1.2,
                halign: 'center',
                valign: 'middle',
                overflow: 'linebreak',
            },
            headStyles: {
                fillColor: [37, 99, 235],
                textColor: 255,
                fontStyle: 'bold',
                fontSize: 7,
                cellPadding: 1.5,
            },
            didParseCell: (data) => {
                if (data.section === 'body' && data.column.index === 8) {
                    const status = data.cell.raw;
                    if (status === 'Completed' || status === 'Present')  data.cell.styles.textColor = [22, 163, 74];
                    else if (status === 'Check-In Only') data.cell.styles.textColor = [217, 119, 6];
                    else data.cell.styles.textColor = [220, 38, 38];
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

        doc.save(`Attendance_${periodText}.pdf`);
    };

    const downloadExcel = () => {
        const periodText = filterType === 'month' ? selectedMonth : selectedDate;

        const aoa: any[][] = [];

        // Branding Header
        aoa.push([companyName || 'Company', '', '', '', '', `Generated: ${new Date().toLocaleDateString('en-IN')}`]);
        if (companyAddress) aoa.push([companyAddress]);
        aoa.push([]); 
        
        // Title & Period
        aoa.push(['ATTENDANCE REPORT', '', '', '', '', periodText]);
        aoa.push([`Total Records: ${filteredAttendance.length}`]);
        aoa.push([]);

        // Table Header
        aoa.push(['#', 'Date', 'Employee ID', 'Name', 'Department', 'Check In', 'Check Out', 'Hours', 'Status']);
        
        filteredAttendance.forEach((record, idx) => {
            aoa.push([
                idx + 1,
                new Date(record.date).toLocaleDateString(),
                record.employee?.employeeId || '-',
                record.employee?.name || '-',
                record.employee?.department || '-',
                record.checkIn?.time ? new Date(record.checkIn.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
                record.checkOut?.time ? new Date(record.checkOut.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
                record.hoursWorked || '-',
                getStatusInfo(record).label
            ]);
        });

        aoa.push([]);
        aoa.push(['This is a system-generated document.']);

        const ws = XLSX.utils.aoa_to_sheet(aoa);

        ws['!cols'] = [
            { wch: 6 },  // #
            { wch: 15 }, // Date
            { wch: 15 }, // ID
            { wch: 25 }, // Name
            { wch: 20 }, // Dept
            { wch: 15 }, // Check In
            { wch: 15 }, // Check Out
            { wch: 10 }, // Hours
            { wch: 18 }  // Status
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Attendance Report");
        XLSX.writeFile(wb, `Attendance_${periodText}.xlsx`);
    };

    return (
        <div className="bg-white border border-gray-100 dark:bg-slate-800 dark:border-slate-700 overflow-hidden rounded-xl shadow-sm">
            <div className="bg-gray-50 border-b border-gray-100 dark:bg-slate-800/50 dark:border-slate-700 flex flex-col gap-4 justify-between lg:flex-row lg:items-center p-6">
                <div>
                    <h3 className="dark:text-gray-100 flex font-bold gap-2 items-center text-gray-800 text-lg">
                        <UserCheck className="text-green-600" size={20} />
                        Attendance Records
                    </h3>
                    <p className="dark:text-gray-400 text-gray-500 text-sm">View and export chronological attendance logs (ordered by Check-In)</p>
                </div>

                <div className="flex flex-col gap-3 lg:w-auto md:flex-row w-full">

                    {/* Filter Type Toggle */}
                    <div className="bg-gray-100 dark:bg-slate-700 flex p-1 rounded-lg">
                        <button
                            onClick={() => setFilterType("month")}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${filterType === "month"
                                ? "bg-white text-gray-800 dark:bg-slate-800 dark:text-white shadow-sm"
                                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                }`}
                        >
                            Monthly
                        </button>
                        <button
                            onClick={() => setFilterType("day")}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${filterType === "day"
                                ? "bg-white text-gray-800 dark:bg-slate-800 dark:text-white shadow-sm"
                                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                }`}
                        >
                            Daily
                        </button>
                    </div>

                    {/* Date/Month Picker */}
                    {filterType === "month" ? (
                        <input
                            type="month"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="border border-gray-200 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 px-3 py-2 rounded-lg shadow-sm text-sm"
                        />
                    ) : (
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="border border-gray-200 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 px-3 py-2 rounded-lg shadow-sm text-sm"
                        />
                    )}

                    {/* Status Filter */}
                    <div className="relative">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="border border-gray-200 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 px-3 py-2 rounded-lg shadow-sm text-sm appearance-none bg-white dark:bg-slate-700 dark:text-white pr-8 h-[38px]"
                        >
                            <option value="all">All Status</option>
                            <option value="in_only">Check-In Only (Active)</option>
                            <option value="completed">Completed</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                            <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                        </div>
                    </div>

                    {/* Search */}
                    <div className="md:w-64 relative w-full">
                        <Search className="-translate-y-1/2 absolute dark:text-gray-500 left-3 text-gray-400 top-1/2" size={16} />
                        <input
                            type="text"
                            placeholder="Search by Name, ID, Dept..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="border border-gray-200 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 pl-9 pr-4 py-2 rounded-lg shadow-sm text-sm w-full"
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                        <button
                            onClick={downloadPDF}
                            className="bg-red-50 border border-red-100 flex font-medium gap-2 hover:bg-red-100 items-center px-3 py-2 rounded-lg text-red-600 text-sm transition-colors"
                            title="Export PDF"
                        >
                            <FileDown size={18} /> PDF
                        </button>
                        <button
                            onClick={downloadExcel}
                            className="bg-green-50 border border-green-100 flex font-medium gap-2 hover:bg-green-100 items-center px-3 py-2 rounded-lg text-green-600 text-sm transition-colors"
                            title="Export Excel"
                        >
                            <FileSpreadsheet size={18} /> Excel
                        </button>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="bg-gray-50/50 min-h-[300px]">
                {loading ? (
                    <div className="p-6 space-y-4">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="animate-pulse bg-white border border-gray-100 dark:bg-slate-800 dark:border-slate-700 h-24 p-4 rounded-xl shadow-sm"></div>
                        ))}
                    </div>
                ) : filteredAttendance.length === 0 ? (
                    <div className="dark:text-gray-500 flex flex-col gap-3 items-center p-12 text-center text-gray-400">
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-full shadow-sm">
                            <Clock size={32} className="opacity-40" />
                        </div>
                        <p className="font-medium">{searchTerm ? "No employees found matching your search." : "No attendance records found for this period."}</p>
                    </div>
                ) : (
                    <>
                        {/* Desktop Table View */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="border-collapse text-left w-full">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200 dark:bg-slate-800/50 dark:border-slate-600 dark:text-gray-300 text-gray-600 text-sm uppercase">
                                        <th className="font-semibold px-4 py-4 w-12 text-center">#</th>
                                        <th className="font-semibold px-6 py-4">Date</th>
                                        <th className="font-semibold px-6 py-4">Employee</th>
                                        <th className="font-semibold px-6 py-4">Department</th>
                                        <th className="font-semibold px-6 py-4">Check-In</th>
                                        <th className="font-semibold px-6 py-4">Check-Out</th>
                                        <th className="font-semibold px-6 py-4">Work Hrs</th>
                                        <th className="font-semibold px-6 py-4">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-slate-800 divide-gray-100 divide-y">
                                    {filteredAttendance.map((record, idx) => {
                                        const statusInfo = getStatusInfo(record);
                                        return (
                                            <tr key={record._id} className="dark:hover:bg-slate-700 hover:bg-gray-50 transition-colors">
                                                <td className="px-4 py-4 text-center font-mono text-xs text-gray-400 dark:text-gray-500 font-semibold">
                                                    {idx + 1}
                                                </td>
                                                <td className="dark:text-gray-300 px-6 py-4 text-gray-600 text-sm whitespace-nowrap">
                                                    {new Date(record.date).toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div>
                                                        <p className="dark:text-gray-100 font-semibold text-gray-800">{record.employee?.name || "Unknown"}</p>
                                                        <p className="dark:text-gray-400 font-mono text-gray-500 text-xs">{record.employee?.employeeId}</p>
                                                    </div>
                                                </td>
                                                <td className="dark:text-gray-300 px-6 py-4 text-gray-600">
                                                    <span className="bg-blue-50 border border-blue-100 font-semibold px-2.5 py-1 rounded-md text-blue-700 text-xs dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800">
                                                        {record.employee?.department || "N/A"}
                                                    </span>
                                                </td>
                                                <td className="dark:text-gray-200 font-mono px-6 py-4 text-gray-700 text-sm">
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center gap-1.5">
                                                            <div className="bg-green-50 dark:bg-green-950/40 flex font-medium gap-1.5 items-center px-2 py-1 rounded text-green-700 dark:text-green-400 w-fit">
                                                                <div className="bg-green-500 h-1.5 rounded-full w-1.5"></div>
                                                                {record.checkIn?.time ? new Date(record.checkIn.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-"}
                                                            </div>
                                                            {(record.checkIn?.method || (record.verificationMethod === "Face" ? "Face" : record.checkIn?.time ? "Manual" : null)) && (
                                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                                                                    (record.checkIn?.method === "Face" || record.verificationMethod === "Face")
                                                                        ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800"
                                                                        : "bg-gray-100 text-gray-600 border-gray-200 dark:bg-slate-800 dark:text-gray-300 dark:border-slate-700"
                                                                }`}>
                                                                    {(record.checkIn?.method === "Face" || record.verificationMethod === "Face") ? "📸 Face" : "👤 Manual"}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {record.checkIn?.markedBy && <div className="text-[10px] text-gray-500 ml-1">by {record.checkIn.markedBy.name}</div>}
                                                    </div>
                                                </td>
                                                <td className="dark:text-gray-200 font-mono px-6 py-4 text-gray-700 text-sm">
                                                    {record.checkOut?.time ? (
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex items-center gap-1.5">
                                                                <div className="bg-red-50 dark:bg-red-950/40 flex font-medium gap-1.5 items-center px-2 py-1 rounded text-red-700 dark:text-red-400 w-fit">
                                                                    <div className="bg-red-500 h-1.5 rounded-full w-1.5"></div>
                                                                    {new Date(record.checkOut.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                </div>
                                                                {(record.checkOut?.method || (record.verificationMethod === "Face" ? "Face" : record.checkOut?.time ? "Manual" : null)) && (
                                                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                                                                        (record.checkOut?.method === "Face" || record.verificationMethod === "Face")
                                                                            ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800"
                                                                            : "bg-gray-100 text-gray-600 border-gray-200 dark:bg-slate-800 dark:text-gray-300 dark:border-slate-700"
                                                                    }`}>
                                                                        {(record.checkOut?.method === "Face" || record.verificationMethod === "Face") ? "📸 Face" : "👤 Manual"}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {record.checkOut?.markedBy && <div className="text-[10px] text-gray-500 ml-1">by {record.checkOut.markedBy.name}</div>}
                                                        </div>
                                                    ) : (
                                                        <span className="dark:text-amber-400 font-semibold text-amber-600 text-xs bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                                                            Checked In
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="dark:text-gray-200 font-medium font-mono px-6 py-4 text-gray-700 text-sm">
                                                    {record.hoursWorked ? `${record.hoursWorked} h` : "-"}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${statusInfo.badgeClass}`}>
                                                        {statusInfo.label}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Card View */}
                        <div className="flex flex-col gap-3 md:hidden p-4">
                            {filteredAttendance.map((record, idx) => {
                                const statusInfo = getStatusInfo(record);
                                return (
                                    <div key={record._id} className="bg-white border border-gray-100 dark:bg-slate-800 dark:border-slate-700 flex flex-col gap-3 p-4 rounded-xl shadow-sm">
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="w-6 h-6 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400 font-mono text-[11px] font-bold flex items-center justify-center shrink-0">
                                                    {idx + 1}
                                                </span>
                                                <div>
                                                    <h4 className="dark:text-white font-bold text-gray-900">{record.employee?.name || "Unknown"}</h4>
                                                    <p className="dark:text-gray-400 font-mono text-gray-500 text-xs">{record.employee?.employeeId}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="dark:text-gray-400 mb-1 text-gray-500 text-xs">{new Date(record.date).toLocaleDateString()}</div>
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${statusInfo.badgeClass}`}>
                                                    {statusInfo.label}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex gap-2 items-center">
                                            <span className="bg-blue-50 border border-blue-100 font-semibold px-2 py-0.5 rounded text-[10px] text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800">
                                                {record.employee?.department || "N/A"}
                                            </span>
                                            {record.hoursWorked ? (
                                                <span className="bg-amber-50 border border-amber-100 font-semibold px-2 py-0.5 rounded text-[10px] text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
                                                    {record.hoursWorked} hrs
                                                </span>
                                            ) : null}
                                        </div>

                                        <div className="border-gray-50 border-t dark:border-slate-800/50 gap-3 grid grid-cols-2 mt-1 pt-3">
                                            <div className="flex flex-col">
                                                <span className="dark:text-gray-500 font-semibold text-[10px] text-gray-400 uppercase">Check In</span>
                                                <div className="flex items-center gap-1 mt-0.5">
                                                    <span className="font-medium font-mono text-green-700 text-sm">
                                                        {record.checkIn?.time ? new Date(record.checkIn.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-"}
                                                    </span>
                                                    {(record.checkIn?.method || (record.verificationMethod === "Face" ? "Face" : record.checkIn?.time ? "Manual" : null)) && (
                                                        <span className={`text-[9px] font-bold px-1 py-0.2 rounded border ${
                                                            (record.checkIn?.method === "Face" || record.verificationMethod === "Face")
                                                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                                                : "bg-gray-100 text-gray-600 border-gray-200"
                                                        }`}>
                                                            {(record.checkIn?.method === "Face" || record.verificationMethod === "Face") ? "📸 Face" : "👤 Manual"}
                                                        </span>
                                                    )}
                                                </div>
                                                {record.checkIn?.markedBy && <span className="text-[10px] text-gray-500 mt-0.5">by {record.checkIn.markedBy.name}</span>}
                                            </div>
                                            <div className="flex flex-col text-right items-end">
                                                <span className="dark:text-gray-500 font-semibold text-[10px] text-gray-400 uppercase">Check Out</span>
                                                <div className="flex items-center gap-1 mt-0.5">
                                                    <span className="font-medium font-mono text-red-700 text-sm">
                                                        {record.checkOut?.time ? new Date(record.checkOut.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "--:--"}
                                                    </span>
                                                    {record.checkOut?.time && (
                                                        <span className={`text-[9px] font-bold px-1 py-0.2 rounded border ${
                                                            (record.checkOut?.method === "Face" || record.verificationMethod === "Face")
                                                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                                                : "bg-gray-100 text-gray-600 border-gray-200"
                                                        }`}>
                                                            {(record.checkOut?.method === "Face" || record.verificationMethod === "Face") ? "📸 Face" : "👤 Manual"}
                                                        </span>
                                                    )}
                                                </div>
                                                {record.checkOut?.markedBy && <span className="text-[10px] text-gray-500 mt-0.5">by {record.checkOut.markedBy.name}</span>}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

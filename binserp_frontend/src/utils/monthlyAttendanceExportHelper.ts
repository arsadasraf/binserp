import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { formatWorkDuration, getWorkDurationMinutes } from "@/src/utils/attendanceUtils";

export interface MonthlyExportEmployee {
    _id: string;
    employeeId: string;
    name: string;
    department?: string;
    designation?: string;
    employeeType?: string;
    status?: string;
}

export interface MonthlyExportAttendanceRecord {
    _id: string;
    employee?: {
        _id?: string;
        name?: string;
        employeeId?: string;
        department?: string;
        designation?: string;
        employeeType?: string;
    };
    date: string;
    checkIn?: {
        time?: string;
        location?: string;
        markedBy?: { name?: string };
        method?: string;
    };
    checkOut?: {
        time?: string;
        location?: string;
        markedBy?: { name?: string };
        method?: string;
    };
    verificationMethod?: string;
    status?: string;
    hoursWorked?: number;
    durationMinutes?: number;
    workedText?: string;
    remarks?: string;
}

export interface DayAttendanceDetail {
    day: number;
    dateStr: string;
    dayName: string;
    checkInStr: string;
    checkOutStr: string;
    durationStr: string;
    durationMinutes: number;
    methodStr: string;
    status: string;
    isSunday: boolean;
    isPast: boolean;
    isFuture: boolean;
}

export interface EmployeeMonthlySummary {
    employee: MonthlyExportEmployee;
    days: DayAttendanceDetail[];
    totalDays: number;
    presentDays: number;
    completedDays: number;
    inOnlyDays: number;
    weeklyOffDays: number;
    absentDays: number;
    totalDurationMinutes: number;
    totalHoursText: string;
}

export interface MonthlyExportFilterInfo {
    department?: string;
    designation?: string;
    employeeType?: string;
    searchTerm?: string;
}

export interface CompanyBrandingInfo {
    companyName?: string;
    companyLogo?: string;
    companyAddress?: string;
}

const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

/**
 * Builds day-by-day attendance details and summaries for each employee for the whole month
 */
export function buildEmployeeMonthlyData(
    attendanceRecords: MonthlyExportAttendanceRecord[],
    allEmployees: MonthlyExportEmployee[],
    selectedMonth: string, // YYYY-MM
    filters?: MonthlyExportFilterInfo
): { year: number; month: number; monthName: string; daysInMonth: number; employeeData: EmployeeMonthlySummary[] } {
    const [year, month] = selectedMonth.split('-').map(Number);
    const monthIndex = month - 1;
    const daysInMonth = new Date(year, month, 0).getDate();
    const monthName = MONTH_NAMES[monthIndex] || `Month ${month}`;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Group records by employee (using both _id and employeeId)
    const recordsByEmpId = new Map<string, MonthlyExportAttendanceRecord[]>();
    attendanceRecords.forEach((rec) => {
        const idKey = rec.employee?._id || rec.employee?.employeeId;
        if (!idKey) return;
        const list = recordsByEmpId.get(idKey) || [];
        list.push(rec);
        recordsByEmpId.set(idKey, list);

        // Also index by employeeId string if available
        if (rec.employee?.employeeId && rec.employee._id && rec.employee.employeeId !== rec.employee._id) {
            const listByCustomId = recordsByEmpId.get(rec.employee.employeeId) || [];
            listByCustomId.push(rec);
            recordsByEmpId.set(rec.employee.employeeId, listByCustomId);
        }
    });

    // 2. Identify all candidate employees: combine allEmployees plus any employee appearing in attendance
    const empMap = new Map<string, MonthlyExportEmployee>();

    allEmployees.forEach((emp) => {
        if (emp._id) empMap.set(emp._id, emp);
        else if (emp.employeeId) empMap.set(emp.employeeId, emp);
    });

    attendanceRecords.forEach((rec) => {
        if (rec.employee?._id && !empMap.has(rec.employee._id)) {
            empMap.set(rec.employee._id, {
                _id: rec.employee._id,
                employeeId: rec.employee.employeeId || "-",
                name: rec.employee.name || "Unknown",
                department: rec.employee.department,
                designation: rec.employee.designation,
                employeeType: rec.employee.employeeType,
                status: "Active"
            });
        }
    });

    // 3. Filter employees based on active filters
    let candidateEmployees = Array.from(empMap.values());

    if (filters?.department && filters.department !== "all") {
        candidateEmployees = candidateEmployees.filter(
            (e) => (e.department || "").toLowerCase() === filters.department!.toLowerCase()
        );
    }

    if (filters?.designation && filters.designation !== "all") {
        candidateEmployees = candidateEmployees.filter(
            (e) => (e.designation || "").toLowerCase() === filters.designation!.toLowerCase()
        );
    }

    if (filters?.employeeType && filters.employeeType !== "all") {
        candidateEmployees = candidateEmployees.filter(
            (e) => (e.employeeType || "").toLowerCase() === filters.employeeType!.toLowerCase()
        );
    }

    if (filters?.searchTerm && filters.searchTerm.trim() !== "") {
        const term = filters.searchTerm.toLowerCase().trim();
        candidateEmployees = candidateEmployees.filter(
            (e) =>
                (e.name || "").toLowerCase().includes(term) ||
                (e.employeeId || "").toLowerCase().includes(term) ||
                (e.department || "").toLowerCase().includes(term)
        );
    }

    // Sort employees alphabetically by name
    candidateEmployees.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    // 4. Build day-by-day matrix for each employee
    const employeeData: EmployeeMonthlySummary[] = candidateEmployees.map((emp) => {
        const empRecords = recordsByEmpId.get(emp._id) || recordsByEmpId.get(emp.employeeId) || [];

        const days: DayAttendanceDetail[] = [];
        let presentDays = 0;
        let completedDays = 0;
        let inOnlyDays = 0;
        let weeklyOffDays = 0;
        let absentDays = 0;
        let totalDurationMinutes = 0;

        for (let d = 1; d <= daysInMonth; d++) {
            const dateObj = new Date(year, monthIndex, d);
            const dateStr = `${String(d).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
            const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
            const isSunday = dateObj.getDay() === 0;

            const dayDateOnly = new Date(year, monthIndex, d);
            const isPast = dayDateOnly < today;
            const isFuture = dayDateOnly > today;

            // Find matching record on this day
            const record = empRecords.find((r) => {
                const targetTime = r.checkIn?.time || r.date;
                if (!targetTime) return false;
                const rDate = new Date(targetTime);
                return (
                    rDate.getDate() === d &&
                    rDate.getMonth() === monthIndex &&
                    rDate.getFullYear() === year
                );
            });

            let checkInStr = "-";
            let checkOutStr = "-";
            let durationStr = "-";
            let durationMins = 0;
            let methodStr = "-";
            let status = "-";

            if (record) {
                presentDays++;
                if (record.checkIn?.time) {
                    try {
                        checkInStr = new Date(record.checkIn.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
                    } catch {
                        checkInStr = "-";
                    }
                }

                if (record.checkOut?.time) {
                    try {
                        checkOutStr = new Date(record.checkOut.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
                    } catch {
                        checkOutStr = "-";
                    }
                }

                durationMins = getWorkDurationMinutes(record);
                totalDurationMinutes += durationMins;
                durationStr = formatWorkDuration(record);

                const method = record.checkIn?.method || record.verificationMethod || (record.checkIn?.time ? "Manual" : "-");
                methodStr = method === "Face" ? "Face" : method === "Manual" ? "Manual" : method;

                if (record.checkIn?.time && record.checkOut?.time) {
                    completedDays++;
                    status = "Completed";
                } else if (record.checkIn?.time) {
                    inOnlyDays++;
                    status = "Check-In Only";
                } else {
                    status = record.status || "Present";
                }
            } else {
                if (isSunday) {
                    weeklyOffDays++;
                    status = "Weekly Off";
                } else if (isPast) {
                    absentDays++;
                    status = "Absent";
                } else {
                    status = "-";
                }
            }

            days.push({
                day: d,
                dateStr,
                dayName,
                checkInStr,
                checkOutStr,
                durationStr,
                durationMinutes: durationMins,
                methodStr,
                status,
                isSunday,
                isPast,
                isFuture
            });
        }

        const totalHours = Math.floor(totalDurationMinutes / 60);
        const remMinutes = totalDurationMinutes % 60;
        const totalHoursText = totalHours > 0 || remMinutes > 0 ? `${totalHours}h ${remMinutes}m` : "0h";

        return {
            employee: emp,
            days,
            totalDays: daysInMonth,
            presentDays,
            completedDays,
            inOnlyDays,
            weeklyOffDays,
            absentDays,
            totalDurationMinutes,
            totalHoursText
        };
    });

    return {
        year,
        month,
        monthName,
        daysInMonth,
        employeeData
    };
}

/**
 * Exports all employees into ONE single Excel sheet, each employee having:
 * - Header with Name, ID, Department, Designation, Employee Type
 * - Full 1..DaysInMonth table
 * - Monthly summary row
 * - 3 blank spacer rows before the next employee
 */
export function exportMonthlyAttendanceExcel(
    attendanceRecords: MonthlyExportAttendanceRecord[],
    allEmployees: MonthlyExportEmployee[],
    selectedMonth: string,
    branding?: CompanyBrandingInfo,
    filters?: MonthlyExportFilterInfo
) {
    const { monthName, year, daysInMonth, employeeData } = buildEmployeeMonthlyData(
        attendanceRecords,
        allEmployees,
        selectedMonth,
        filters
    );

    const aoa: any[][] = [];

    // 1. Company & Document Branding Header
    aoa.push([branding?.companyName || "BINS ERP", "", "", "", "", "", "", `Generated: ${new Date().toLocaleDateString('en-IN')}`]);
    if (branding?.companyAddress) {
        aoa.push([branding.companyAddress]);
    }
    aoa.push([`MONTHLY EMPLOYEE ATTENDANCE REPORT — ${monthName.toUpperCase()} ${year}`]);
    aoa.push([
        `Filters: Dept: ${filters?.department && filters.department !== 'all' ? filters.department : 'All'} | ` +
        `Desig: ${filters?.designation && filters.designation !== 'all' ? filters.designation : 'All'} | ` +
        `Type: ${filters?.employeeType && filters.employeeType !== 'all' ? filters.employeeType : 'All'} | ` +
        `Total Employees: ${employeeData.length}`
    ]);
    aoa.push([]); // blank row

    // 2. Loop through each employee and add their block
    employeeData.forEach((item, empIndex) => {
        const emp = item.employee;

        // Employee Info Banner Header
        aoa.push([
            `EMPLOYEE ${empIndex + 1}: ${emp.name}`,
            "",
            `EMP ID: ${emp.employeeId || "-"}`,
            "",
            `DEPT: ${emp.department || "-"}`,
            `DESIGNATION: ${emp.designation || "-"}`,
            `TYPE: ${emp.employeeType || "-"}`,
            `MONTH: ${monthName} ${year}`
        ]);

        // Daily Table Column Headers
        aoa.push([
            "#",
            "Date",
            "Day",
            "Check-In",
            "Check-Out",
            "Work Duration",
            "Verification",
            "Status",
            "Remarks"
        ]);

        // Daily Rows (Day 1 to daysInMonth)
        item.days.forEach((dayDetail) => {
            aoa.push([
                dayDetail.day,
                dayDetail.dateStr,
                dayDetail.dayName,
                dayDetail.checkInStr,
                dayDetail.checkOutStr,
                dayDetail.durationStr,
                dayDetail.methodStr,
                dayDetail.status,
                ""
            ]);
        });

        // Summary Row
        aoa.push([
            "SUMMARY",
            "",
            `Present: ${item.presentDays} Days`,
            `Completed: ${item.completedDays}`,
            `In-Only: ${item.inOnlyDays}`,
            `Offs: ${item.weeklyOffDays}`,
            `Absent: ${item.absentDays}`,
            `Total Work Hours: ${item.totalHoursText}`,
            ""
        ]);

        // Spacer Rows between employees (3 blank rows as requested)
        aoa.push([]);
        aoa.push([]);
        aoa.push([]);
    });

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Set column widths for comfortable viewing
    ws['!cols'] = [
        { wch: 6 },  // #
        { wch: 14 }, // Date
        { wch: 8 },  // Day
        { wch: 15 }, // Check-In
        { wch: 15 }, // Check-Out
        { wch: 18 }, // Work Duration
        { wch: 15 }, // Verification
        { wch: 18 }, // Status
        { wch: 16 }  // Remarks
    ];

    const wb = XLSX.utils.book_new();
    const sheetName = `Monthly_${selectedMonth}`;
    XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31));

    const filterTag = filters?.department && filters.department !== "all" ? `_${filters.department}` : "";
    XLSX.writeFile(wb, `Monthly_Attendance_${selectedMonth}${filterTag}.xlsx`);
}

/**
 * Exports all employees into a multi-page PDF register, with 1 Employee per Page
 */
export function exportMonthlyAttendancePDF(
    attendanceRecords: MonthlyExportAttendanceRecord[],
    allEmployees: MonthlyExportEmployee[],
    selectedMonth: string,
    branding?: CompanyBrandingInfo,
    filters?: MonthlyExportFilterInfo
) {
    const { monthName, year, daysInMonth, employeeData } = buildEmployeeMonthlyData(
        attendanceRecords,
        allEmployees,
        selectedMonth,
        filters
    );

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 10;

    if (employeeData.length === 0) {
        doc.setFontSize(14);
        doc.text("No employees found matching the selected filters.", pageW / 2, 50, { align: "center" });
        doc.save(`Monthly_Attendance_${selectedMonth}.pdf`);
        return;
    }

    employeeData.forEach((item, empIndex) => {
        if (empIndex > 0) {
            doc.addPage();
        }

        const emp = item.employee;

        // Top Header Banner
        doc.setFillColor(37, 99, 235); // Blue primary
        doc.rect(0, 0, pageW, 18, 'F');

        // Company Logo & Name
        const hasLogo = Boolean(branding?.companyLogo);
        const logoSize = 12;
        const logoX = margin;
        const logoY = 3;

        if (hasLogo && branding?.companyLogo) {
            try {
                doc.addImage(branding.companyLogo, 'JPEG', logoX, logoY, logoSize, logoSize, undefined, 'FAST');
            } catch {
                // skip if image fails to load
            }
        }

        const nameX = hasLogo ? margin + logoSize + 3 : margin;
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text(branding?.companyName || 'Company', nameX, 9);

        if (branding?.companyAddress) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6);
            doc.text(branding.companyAddress, nameX, 14, { maxWidth: 65 });
        }

        // Center Title
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text("MONTHLY ATTENDANCE REGISTER", pageW / 2, 9, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.text(`${monthName.toUpperCase()} ${year}`, pageW / 2, 14, { align: 'center' });

        // Right details
        doc.setFontSize(7);
        doc.text(`Employee ${empIndex + 1} of ${employeeData.length}`, pageW - margin, 8, { align: 'right' });
        doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, pageW - margin, 14, { align: 'right' });

        // Employee Info Card (Grey box with subtle blue left-border)
        const cardY = 21;
        const cardH = 14;
        doc.setFillColor(248, 250, 252); // slate-50
        doc.roundedRect(margin, cardY, pageW - 2 * margin, cardH, 1.5, 1.5, 'F');
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(margin, cardY, pageW - 2 * margin, cardH, 1.5, 1.5, 'S');

        // Left blue highlight bar
        doc.setFillColor(37, 99, 235);
        doc.roundedRect(margin, cardY, 2, cardH, 1, 1, 'F');

        // Employee Text
        doc.setTextColor(15, 23, 42); // slate-900
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.text(emp.name || 'Unknown', margin + 5, cardY + 5.5);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(71, 85, 105); // slate-600
        doc.text(`ID: ${emp.employeeId || "-"}`, margin + 5, cardY + 10.5);
        doc.text(`Dept: ${emp.department || "-"}`, margin + 35, cardY + 10.5);
        doc.text(`Desig: ${emp.designation || "-"}`, margin + 75, cardY + 10.5);
        doc.text(`Type: ${emp.employeeType || "-"}`, margin + 115, cardY + 10.5);

        // Right summary chips inside card
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(22, 101, 52); // green-800
        doc.text(`Present: ${item.presentDays}/${daysInMonth} Days`, pageW - margin - 4, cardY + 5.5, { align: 'right' });
        doc.setTextColor(30, 64, 175); // blue-800
        doc.text(`Work Hours: ${item.totalHoursText}`, pageW - margin - 4, cardY + 10.5, { align: 'right' });

        // Table Rows
        const tableBody = item.days.map((d) => [
            String(d.day),
            d.dateStr,
            d.dayName,
            d.checkInStr,
            d.checkOutStr,
            d.durationStr,
            d.methodStr,
            d.status
        ]);

        autoTable(doc, {
            startY: cardY + cardH + 3,
            margin: { left: margin, right: margin },
            head: [['#', 'Date', 'Day', 'Check In', 'Check Out', 'Hours', 'Method', 'Status']],
            body: tableBody,
            theme: 'grid',
            styles: {
                fontSize: 6.5,
                cellPadding: 1.1,
                halign: 'center',
                valign: 'middle',
                overflow: 'linebreak'
            },
            headStyles: {
                fillColor: [37, 99, 235],
                textColor: 255,
                fontStyle: 'bold',
                fontSize: 7,
                cellPadding: 1.3
            },
            columnStyles: {
                0: { cellWidth: 8 },
                1: { cellWidth: 24 },
                2: { cellWidth: 16 },
                3: { cellWidth: 28 },
                4: { cellWidth: 28 },
                5: { cellWidth: 28 },
                6: { cellWidth: 24 },
                7: { cellWidth: 'auto' }
            },
            didParseCell: (data) => {
                if (data.section === 'body' && data.column.index === 7) {
                    const statusVal = String(data.cell.raw);
                    if (statusVal === 'Completed' || statusVal === 'Present') {
                        data.cell.styles.textColor = [22, 163, 74]; // Green
                        data.cell.styles.fontStyle = 'bold';
                    } else if (statusVal === 'Check-In Only') {
                        data.cell.styles.textColor = [217, 119, 6]; // Amber
                        data.cell.styles.fontStyle = 'bold';
                    } else if (statusVal === 'Weekly Off') {
                        data.cell.styles.textColor = [100, 116, 139]; // Slate
                    } else if (statusVal === 'Absent') {
                        data.cell.styles.textColor = [220, 38, 38]; // Red
                        data.cell.styles.fontStyle = 'bold';
                    }
                }
            }
        });

        const finalY = (doc as any).lastAutoTable?.finalY || pageH - 18;

        // Footer summary bar
        doc.setFillColor(241, 245, 249); // slate-100
        doc.rect(margin, finalY + 2, pageW - 2 * margin, 8, 'F');
        doc.setDrawColor(203, 213, 225);
        doc.rect(margin, finalY + 2, pageW - 2 * margin, 8, 'S');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.8);
        doc.setTextColor(30, 41, 59);
        doc.text(
            `SUMMARY: Present: ${item.presentDays} | Completed: ${item.completedDays} | In-Only: ${item.inOnlyDays} | Weekly Off: ${item.weeklyOffDays} | Absent: ${item.absentDays} | Total Work Hours: ${item.totalHoursText}`,
            margin + 3,
            finalY + 7
        );

        // Signatures / document note
        if (finalY + 18 < pageH) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6);
            doc.setTextColor(148, 163, 184);
            doc.text("System-generated Monthly Attendance Register.", margin, pageH - 4);
            doc.text(`Page ${empIndex + 1} of ${employeeData.length}`, pageW - margin, pageH - 4, { align: 'right' });
        }
    });

    const filterTag = filters?.department && filters.department !== "all" ? `_${filters.department}` : "";
    doc.save(`Monthly_Attendance_${selectedMonth}${filterTag}.pdf`);
}

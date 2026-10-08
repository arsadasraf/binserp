import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface DailyLogItem {
    date: string;
    day: number;
    dayName: string;
    originalStatus: string;
    originalCheckIn?: string;
    originalCheckOut?: string;
    originalHours?: number;
    otHours?: number;
    manualStatus?: string;
    manualHours?: number;
    manualOtHours?: number;
    useManual?: boolean;
}

const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

const formatPunchTime = (timeStr?: string | Date) => {
    if (!timeStr) return '';
    try {
        const d = new Date(timeStr);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    } catch {
        return '';
    }
};

/**
 * Draws a single employee company statement on the active page of doc
 */
export function drawCompanyFormatPage(
    doc: jsPDF,
    salary: any,
    employee: any,
    month: string,
    year: number,
    companyName: string = "EXCEL WIRECUT INC"
) {
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 10;
    const contentW = pageW - 2 * margin;

    const monthIndex = MONTH_NAMES.findIndex(m => m.toLowerCase() === String(month).toLowerCase());
    const validMonthIndex = monthIndex >= 0 ? monthIndex : new Date().getMonth();
    const daysInMonth = new Date(year, validMonthIndex + 1, 0).getDate();
    const monthShort = MONTH_NAMES[validMonthIndex].substring(0, 3).toUpperCase();

    const empId = employee?.employeeId || salary.employee?.employeeId || "-";
    const empName = employee?.name || salary.employee?.name || "Unknown";
    const designation = employee?.designation || salary.employee?.designation || "-";

    const dailyLogs: DailyLogItem[] = salary.dailyLogs || [];

    // Red theme token matching user's template
    const redColor: [number, number, number] = [185, 28, 28]; // #b91c1c
    const blackColor: [number, number, number] = [15, 23, 42];
    const lightBorder: [number, number, number] = [100, 116, 139];

    // 1. HEADER SECTION
    let curY = 10;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...redColor);
    doc.text(companyName || "EXCEL WIRECUT INC", pageW / 2, curY, { align: "center" });

    curY += 4.5;
    doc.setFontSize(9.5);
    doc.text(`ATTENDANCE FOR THE MONTH OF ${monthShort}-${year}`, pageW / 2, curY, { align: "center" });

    curY += 4.5;
    doc.setFontSize(8.5);
    doc.setTextColor(...blackColor);
    doc.text(empId, margin, curY);

    curY += 4.5;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...redColor);
    doc.text("Name of the Employ: ", margin, curY);
    const nameLabelW = doc.getTextWidth("Name of the Employ: ");

    doc.setFont("helvetica", "bold");
    doc.setTextColor(...blackColor);
    doc.text(empName, margin + nameLabelW, curY);

    // Designation on right
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...redColor);
    doc.text("Designatin: ", pageW / 2 + 30, curY);
    const desigLabelW = doc.getTextWidth("Designatin: ");
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...blackColor);
    doc.text(designation, pageW / 2 + 30 + desigLabelW, curY);

    curY += 4.5;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...redColor);
    doc.text("Working Time: ", margin, curY);

    // 2. DUAL-COLUMN ATTENDANCE TABLE
    curY += 2;

    const getDayDetails = (d: number) => {
        if (d > daysInMonth) return null;
        const log = dailyLogs.find(l => l.day === d) || dailyLogs[d - 1];
        const dateObj = new Date(year, validMonthIndex, d);
        const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
        const isSunday = dayName === 'Sun';

        const finalStatus = log?.useManual ? log.manualStatus : log?.originalStatus;
        const finalHours = log?.useManual ? (log.manualHours ?? 0) : (log?.originalHours ?? 0);
        const dailyOt = log?.useManual ? (log.manualOtHours ?? 0) : (log?.otHours ?? 0);
        const isHoliday = finalStatus === 'Holiday' || log?.originalStatus === 'Holiday';

        let inTime = formatPunchTime(log?.originalCheckIn);
        let outTime = formatPunchTime(log?.originalCheckOut);
        let statusVal: number | string = "-";
        let otVal: number | string = "-";

        if (isSunday) {
            inTime = "SUNDAY";
            outTime = "";
            statusVal = 1.0;
            otVal = dailyOt > 0 ? dailyOt : "-";
        } else if (isHoliday) {
            outTime = outTime ? `${outTime} HOLIDAY` : "HOLIDAY";
            statusVal = 1.0;
            otVal = dailyOt > 0 ? dailyOt : "-";
        } else if (finalStatus === 'Present') {
            statusVal = 1.0;
            otVal = dailyOt > 0 ? dailyOt : "-";
        } else if (finalStatus === 'HalfDay') {
            statusVal = 0.5;
            otVal = dailyOt > 0 ? dailyOt : "-";
        } else if (finalStatus === 'CL' || finalStatus === 'SL' || finalStatus === 'CO') {
            statusVal = 1.0;
            inTime = finalStatus;
            otVal = "-";
        }

        const numericPresent = typeof statusVal === 'number' ? statusVal : 0;
        const numericOt = typeof otVal === 'number' ? otVal : 0;

        return {
            day: d,
            inTime,
            outTime,
            totalHours: finalHours > 0 ? finalHours.toFixed(1) : "",
            presentAbsent: typeof statusVal === 'number' ? statusVal.toFixed(2) : statusVal,
            otHours: typeof otVal === 'number' ? otVal.toFixed(2) : otVal,
            numericPresent,
            numericOt
        };
    };

    let leftPresentSum = 0;
    let leftOtSum = 0;
    let rightPresentSum = 0;
    let rightOtSum = 0;

    const tableBody: any[][] = [];

    for (let i = 1; i <= 15; i++) {
        const leftDay = getDayDetails(i);
        const rightDay = getDayDetails(i + 15);

        if (leftDay) {
            leftPresentSum += leftDay.numericPresent;
            leftOtSum += leftDay.numericOt;
        }
        if (rightDay) {
            rightPresentSum += rightDay.numericPresent;
            rightOtSum += rightDay.numericOt;
        }

        tableBody.push([
            leftDay ? String(leftDay.day) : "",
            leftDay ? leftDay.inTime : "",
            leftDay ? leftDay.outTime : "",
            leftDay ? leftDay.totalHours : "",
            leftDay ? String(leftDay.presentAbsent) : "",
            leftDay ? String(leftDay.otHours) : "",
            rightDay ? String(rightDay.day) : "",
            rightDay ? rightDay.inTime : "",
            rightDay ? rightDay.outTime : "",
            rightDay ? rightDay.totalHours : "",
            rightDay ? String(rightDay.presentAbsent) : "",
            rightDay ? String(rightDay.otHours) : ""
        ]);
    }

    if (daysInMonth >= 31) {
        const day31 = getDayDetails(31);
        if (day31) {
            rightPresentSum += day31.numericPresent;
            rightOtSum += day31.numericOt;
        }
        tableBody.push([
            "", "", "", "", "", "",
            day31 ? String(day31.day) : "31",
            day31 ? day31.inTime : "",
            day31 ? day31.outTime : "",
            day31 ? day31.totalHours : "",
            day31 ? String(day31.presentAbsent) : "",
            day31 ? String(day31.otHours) : ""
        ]);
    }

    // Subtotal Row
    tableBody.push([
        { content: "No of days present and OT hours", colSpan: 4, styles: { fontStyle: 'bold', halign: 'center' } },
        { content: leftPresentSum.toFixed(2), styles: { fontStyle: 'bold', halign: 'right' } },
        { content: leftOtSum > 0 ? leftOtSum.toFixed(2) : "-", styles: { fontStyle: 'bold', halign: 'right' } },
        { content: "", colSpan: 4 },
        { content: rightPresentSum.toFixed(2), styles: { fontStyle: 'bold', halign: 'right' } },
        { content: rightOtSum > 0 ? rightOtSum.toFixed(2) : "-", styles: { fontStyle: 'bold', halign: 'right' } }
    ]);

    // Grand Total Row
    const totalPresentAll = leftPresentSum + rightPresentSum;
    const totalOtAll = leftOtSum + rightOtSum;

    tableBody.push([
        { content: "TOTAL DAYS AND OT HOURS", colSpan: 10, styles: { fontStyle: 'bold', halign: 'center' } },
        { content: totalPresentAll.toFixed(2), styles: { fontStyle: 'bold', halign: 'right' } },
        { content: totalOtAll > 0 ? totalOtAll.toFixed(2) : "-", styles: { fontStyle: 'bold', halign: 'right' } }
    ]);

    const halfW = contentW / 2;
    const colW_Date = 10;
    const colW_Punch = 25;
    const colW_Total = 18;
    const colW_Pres = 24;
    const colW_OT = 16.5;

    autoTable(doc, {
        startY: curY,
        margin: { left: margin, right: margin },
        head: [[
            "DATE", "PUNCH TIME IN", "PUNCH TIME OUT", "Total Hours", "Present / Absent", "OT Hours",
            "DATE", "PUNCH TIME IN", "PUNCH TIME OUT", "Total Hours", "Present / Absent", "OT Hours"
        ]],
        body: tableBody,
        theme: "grid",
        styles: {
            fontSize: 6.5,
            cellPadding: 0.9,
            halign: "center",
            valign: "middle",
            lineColor: [0, 0, 0],
            lineWidth: 0.1,
            textColor: [0, 0, 0]
        },
        headStyles: {
            fillColor: [255, 255, 255],
            textColor: [0, 0, 0],
            fontStyle: "bold",
            lineWidth: 0.15,
            lineColor: [0, 0, 0]
        },
        columnStyles: {
            0: { cellWidth: colW_Date, fontStyle: 'bold' },
            1: { cellWidth: colW_Punch },
            2: { cellWidth: colW_Punch },
            3: { cellWidth: colW_Total },
            4: { cellWidth: colW_Pres, halign: 'right' },
            5: { cellWidth: colW_OT, halign: 'right' },
            6: { cellWidth: colW_Date, fontStyle: 'bold' },
            7: { cellWidth: colW_Punch },
            8: { cellWidth: colW_Punch },
            9: { cellWidth: colW_Total },
            10: { cellWidth: colW_Pres, halign: 'right' },
            11: { cellWidth: colW_OT, halign: 'right' }
        },
        didParseCell: (data) => {
            const raw = String(data.cell.raw);
            if (raw === "SUNDAY" || raw.includes("HOLIDAY")) {
                data.cell.styles.fontStyle = 'bold';
            }
        }
    });

    const afterTableY = (doc as any).lastAutoTable.finalY + 3;

    // 3. BOTTOM SECTION: 3 SIDE-BY-SIDE TABLES
    const blockW = (contentW - 4) / 3;

    const grossSalary = salary.grossSalary || employee?.salary?.grossSalary || 0;
    const basicPay = salary.salaryComponents?.basic || employee?.salary?.basic || Math.round(grossSalary * 0.6);
    const da = salary.salaryComponents?.specialAllowance || Math.round(grossSalary * 0.3);
    const hra = salary.salaryComponents?.hra || employee?.salary?.hra || Math.round(grossSalary * 0.05);
    const conv = salary.salaryComponents?.conveyance || employee?.salary?.conveyance || Math.round(grossSalary * 0.05);
    const totalSalaryCalc = basicPay + da + hra + conv;

    const presentDays = salary.presentDays || totalPresentAll;
    const perDayAmount = daysInMonth > 0 ? (grossSalary / daysInMonth) : 0;
    const salaryEarned = Math.round(perDayAmount * presentDays);

    const otAmount = salary.overtime?.amount || (salary.otPay || 0);
    const ptAmount = salary.salaryComponents?.professionalTax || 200;
    const totalPayable = salary.netSalary || (salaryEarned + otAmount - ptAmount);

    const clUsed = salary.leavesConsumed?.casualLeave || 0;
    const slUsed = salary.leavesConsumed?.sickLeave || 0;
    const totalLeavesUsed = clUsed + slUsed;

    // Block 1 (Left): Salary Calculation
    const leftBody: any[] = [
        [{ content: "Fixed Salary", styles: { textColor: redColor, fontStyle: 'bold' } }, { content: Number(grossSalary).toLocaleString('en-IN'), styles: { halign: 'right', fontStyle: 'bold' } }],
        [{ content: "Salary Calculation", colSpan: 2, styles: { textColor: redColor, fontStyle: 'bold', halign: 'center' } }],
        [{ content: "Basic", styles: { textColor: redColor } }, { content: Number(basicPay).toLocaleString('en-IN'), styles: { halign: 'right' } }],
        [{ content: "DA", styles: { textColor: redColor } }, { content: Number(da).toLocaleString('en-IN'), styles: { halign: 'right' } }],
        [{ content: "HRA", styles: { textColor: redColor } }, { content: Number(hra).toLocaleString('en-IN'), styles: { halign: 'right' } }],
        [{ content: "Conveyance", styles: { textColor: redColor } }, { content: Number(conv).toLocaleString('en-IN'), styles: { halign: 'right' } }],
        [{ content: "Food", styles: { textColor: redColor } }, { content: "-", styles: { halign: 'right' } }],
        [{ content: "Room Rent", styles: { textColor: redColor } }, { content: "-", styles: { halign: 'right' } }],
        [{ content: "Total Salary", styles: { textColor: redColor, fontStyle: 'bold' } }, { content: Number(totalSalaryCalc).toLocaleString('en-IN'), styles: { halign: 'right', fontStyle: 'bold' } }]
    ];

    autoTable(doc, {
        startY: afterTableY,
        margin: { left: margin, right: pageW - margin - blockW },
        body: leftBody as any,
        theme: "grid",
        styles: { fontSize: 6.5, cellPadding: 1, lineColor: [0, 0, 0], lineWidth: 0.1 },
        columnStyles: { 0: { cellWidth: blockW * 0.55 }, 1: { cellWidth: blockW * 0.45 } }
    });

    // Block 2 (Center): Days/Hrs & Total Payable
    const middleBody: any[] = [
        [
            { content: "Days/ Hrs", styles: { fontStyle: 'bold', halign: 'center' } },
            { content: "Amount", styles: { fontStyle: 'bold', halign: 'center' } },
            { content: "Total", styles: { fontStyle: 'bold', halign: 'center' } }
        ],
        [
            { content: "Salary", styles: { fontStyle: 'bold' } },
            { content: `${presentDays.toFixed(2)}`, styles: { halign: 'center' } },
            { content: Number(salaryEarned).toLocaleString('en-IN'), styles: { halign: 'right', fontStyle: 'bold' } }
        ],
        [{ content: "Increment", styles: { textColor: redColor } }, { content: "-", styles: { halign: 'center' } }, { content: "-", styles: { halign: 'right' } }],
        [{ content: "OT- Single", styles: { textColor: redColor } }, { content: "-", styles: { halign: 'center' } }, { content: "-", styles: { halign: 'right' } }],
        [{ content: "OT - 1.5", styles: { textColor: redColor } }, { content: otAmount > 0 ? Number(otAmount).toLocaleString('en-IN') : "-", styles: { halign: 'center' } }, { content: "-", styles: { halign: 'right' } }],
        [{ content: "PT", styles: { textColor: redColor } }, { content: "", styles: { halign: 'center' } }, { content: `-${ptAmount}`, styles: { halign: 'right', fontStyle: 'bold' } }],
        [{ content: "Advance", styles: { textColor: redColor } }, { content: "", styles: { halign: 'center' } }, { content: "-", styles: { halign: 'right' } }],
        [
            { content: "Total Payable", colSpan: 2, styles: { textColor: redColor, fontStyle: 'bold' } },
            { content: Number(totalPayable).toLocaleString('en-IN'), styles: { halign: 'right', fontStyle: 'bold' } }
        ]
    ];

    const midX = margin + blockW + 2;
    autoTable(doc, {
        startY: afterTableY,
        margin: { left: midX, right: pageW - midX - blockW },
        body: middleBody as any,
        theme: "grid",
        styles: { fontSize: 6.5, cellPadding: 1, lineColor: [0, 0, 0], lineWidth: 0.1 },
        columnStyles: { 0: { cellWidth: blockW * 0.4 }, 1: { cellWidth: blockW * 0.28 }, 2: { cellWidth: blockW * 0.32 } }
    });

    // Block 3 (Right): Leaves Details & Signatures
    const rightX = midX + blockW + 2;
    const rightBody: any[] = [
        [{ content: "LEAVE DETAILS", colSpan: 4, styles: { textColor: redColor, fontStyle: 'bold', halign: 'center' } }],
        [
            { content: "OB", styles: { textColor: redColor, halign: 'center', fontStyle: 'bold' } },
            { content: "CREDIT", styles: { textColor: redColor, halign: 'center', fontStyle: 'bold' } },
            { content: "USED", styles: { textColor: redColor, halign: 'center', fontStyle: 'bold' } },
            { content: "CB", styles: { textColor: redColor, halign: 'center', fontStyle: 'bold' } }
        ],
        [
            { content: "-", styles: { halign: 'center' } },
            { content: "-", styles: { halign: 'center' } },
            { content: totalLeavesUsed > 0 ? String(totalLeavesUsed) : "-", styles: { halign: 'center' } },
            { content: "-", styles: { halign: 'center' } }
        ],
        [{ content: "", colSpan: 4, styles: { minCellHeight: 6 } }],
        [
            { content: "Accountant Signature", colSpan: 2, styles: { textColor: redColor, fontStyle: 'bold', halign: 'center', minCellHeight: 9, valign: 'bottom' } },
            { content: "Approver Signature", styles: { textColor: redColor, fontStyle: 'bold', halign: 'center', minCellHeight: 9, valign: 'bottom' } },
            { content: "Receiver Signature", styles: { textColor: redColor, fontStyle: 'bold', halign: 'center', minCellHeight: 9, valign: 'bottom' } }
        ]
    ];

    autoTable(doc, {
        startY: afterTableY,
        margin: { left: rightX, right: margin },
        body: rightBody as any,
        theme: "grid",
        styles: { fontSize: 6.5, cellPadding: 1, lineColor: [0, 0, 0], lineWidth: 0.1 },
        columnStyles: { 0: { cellWidth: blockW * 0.25 }, 1: { cellWidth: blockW * 0.25 }, 2: { cellWidth: blockW * 0.25 }, 3: { cellWidth: blockW * 0.25 } }
    });
}

/**
 * Downloads a single employee company statement PDF
 */
export function exportSingleSalaryCompanyPDF(
    salary: any,
    employee: any,
    month: string,
    year: number,
    companyName: string = "EXCEL WIRECUT INC"
) {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    drawCompanyFormatPage(doc, salary, employee, month, year, companyName);

    const empId = employee?.employeeId || salary.employee?.employeeId || "";
    const empName = employee?.name || salary.employee?.name || "Emp";
    doc.save(`Attendance_Salary_${empId}_${empName}_${month}_${year}.pdf`);
}

/**
 * Downloads an All-In-One PDF containing each generated employee on their own page
 */
export function exportAllSalariesCompanyPDF(
    savedSalaries: any[],
    employees: any[],
    month: string,
    year: number,
    companyName: string = "EXCEL WIRECUT INC"
) {
    if (!savedSalaries || savedSalaries.length === 0) {
        alert("No saved salary records found to export.");
        return;
    }

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

    savedSalaries.forEach((sal, index) => {
        if (index > 0) doc.addPage("a4", "landscape");
        const empId = typeof sal.employee === 'string' ? sal.employee : sal.employee?._id;
        const fullEmp = employees.find(e => e._id === empId) || sal.employee || {};
        drawCompanyFormatPage(doc, sal, fullEmp, month, year, companyName);
    });

    doc.save(`Attendance_Salaries_All_${month}_${year}.pdf`);
}

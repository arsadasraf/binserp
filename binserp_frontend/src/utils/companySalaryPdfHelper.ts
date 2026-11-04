import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
    computeCompanySalarySheetData,
    computeMonthlyStatementData,
    StatementExportMode
} from "./companySalaryExcelHelper";

/**
 * Draws a single employee company statement on the active page of doc
 * using the exact 14-column company attendance & salary format.
 */
export function drawCompanyFormatPage(
    doc: jsPDF,
    salary: any,
    employee: any,
    month: string,
    year: number,
    companyName: string = ""
) {
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 8;
    const contentW = pageW - 2 * margin;

    const data = computeCompanySalarySheetData(salary, employee, month, year);
    const {
        daysInMonth,
        monthShort,
        empId,
        empName,
        designation,
        workingTimeStr,
        dayDetailsMap,
        leftPresentSum,
        leftOtSum,
        rightPresentSum,
        rightOtSum,
        totalPresentAll,
        totalOtAll,
        fixedSalary,
        basicPay,
        da,
        hra,
        conv,
        food,
        roomRent,
        totalSalaryCalc,
        perDayAmount,
        salaryEarned,
        incrementAmount,
        singleOtHours,
        singleOtRate,
        singleOtPay,
        multOtHours,
        multOtRate,
        multOtPay,
        ptAmount,
        advanceAmount,
        totalPayable,
        leaveOB,
        leaveCredit,
        leaveUsed,
        leaveCB,
    } = data;

    // Red & Black theme matching the template
    const redColor: [number, number, number] = [200, 16, 16];
    const blackColor: [number, number, number] = [15, 23, 42];

    // 1. HEADER SECTION
    let curY = 9;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12.5);
    doc.setTextColor(...redColor);
    doc.text((companyName || "COMPANY NAME").toUpperCase(), pageW / 2, curY, { align: "center" });

    curY += 4.5;
    doc.setFontSize(9.5);
    doc.text(`ATTENDANCE FOR THE MONTH OF ${monthShort}-${year}`, pageW / 2, curY, { align: "center" });

    curY += 4.2;
    doc.setFontSize(9);
    doc.setTextColor(...redColor);
    doc.text(String(empId), pageW / 2 + 12, curY, { align: "center" });

    curY += 4.2;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.2);
    doc.setTextColor(...redColor);
    doc.text("Name of the Employee:", margin, curY);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(...blackColor);
    doc.text(empName, margin + 45, curY);

    curY += 4;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...redColor);
    doc.text("Designatin:", pageW * 0.65, curY);
    doc.setTextColor(...blackColor);
    doc.text(designation || "", pageW * 0.65 + 20, curY);

    curY += 4;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...redColor);
    doc.text("Working  Time:", margin + 16, curY);
    doc.setTextColor(...blackColor);
    doc.text(workingTimeStr, margin + 45, curY);

    // 2. 14-COLUMN DUAL ATTENDANCE TABLE
    curY += 2;

    const tableBody: any[][] = [];

    for (let i = 1; i <= 15; i++) {
        const leftDay = dayDetailsMap.get(i);
        const rightDay = dayDetailsMap.get(i + 15);

        const rowCells: any[] = [];

        // Left side (7 cols)
        if (leftDay) {
            rowCells.push(String(leftDay.day));
            if (leftDay.isWeeklyOff && !leftDay.outTime) {
                rowCells.push({ content: leftDay.inTime, colSpan: 2, styles: { halign: "center", fontStyle: "bold" } });
            } else {
                rowCells.push({ content: leftDay.inTime, styles: { fontStyle: "bold" } });
                rowCells.push({ content: leftDay.outTime, styles: { fontStyle: "bold" } });
            }
            rowCells.push({ content: leftDay.noteText, styles: { halign: "center", fontSize: 6 } });
            rowCells.push(leftDay.totalHours);
            rowCells.push({ content: String(leftDay.presentAbsent), styles: { halign: "right" } });
            rowCells.push({ content: String(leftDay.otHours), styles: { halign: "right" } });
        } else {
            rowCells.push("", "", "", "", "", "", "");
        }

        // Right side (7 cols)
        if (rightDay) {
            rowCells.push(String(rightDay.day));
            if (rightDay.isWeeklyOff && !rightDay.outTime) {
                rowCells.push({ content: rightDay.inTime, colSpan: 2, styles: { halign: "center", fontStyle: "bold" } });
            } else {
                rowCells.push({ content: rightDay.inTime, styles: { fontStyle: "bold" } });
                rowCells.push({ content: rightDay.outTime, styles: { fontStyle: "bold" } });
            }
            rowCells.push({ content: rightDay.noteText, styles: { halign: "center", fontSize: 6 } });
            rowCells.push(rightDay.totalHours);
            rowCells.push({ content: String(rightDay.presentAbsent), styles: { halign: "right" } });
            rowCells.push({ content: String(rightDay.otHours), styles: { halign: "right" } });
        } else {
            rowCells.push("", "", "", "", "", "", "");
        }

        tableBody.push(rowCells);
    }

    // Extra row for Day 31
    if (daysInMonth >= 31) {
        const day31 = dayDetailsMap.get(31);
        const row31: any[] = [
            "", "", "", "", "",
            { content: "-", styles: { halign: "center", fontStyle: "bold" } },
            "",
            "31"
        ];
        if (day31) {
            if (day31.isWeeklyOff && !day31.outTime) {
                row31.push({ content: day31.inTime, colSpan: 2, styles: { halign: "center", fontStyle: "bold" } });
            } else {
                row31.push({ content: day31.inTime, styles: { fontStyle: "bold" } });
                row31.push({ content: day31.outTime, styles: { fontStyle: "bold" } });
            }
            row31.push({ content: day31.noteText, styles: { halign: "center", fontSize: 6 } });
            row31.push(day31.totalHours);
            row31.push({ content: String(day31.presentAbsent), styles: { halign: "right" } });
            row31.push({ content: String(day31.otHours), styles: { halign: "right" } });
        } else {
            row31.push("", "", "", "", "", "");
        }
        tableBody.push(row31);
    }

    // Subtotal Row: "No of days present and OT hours"
    tableBody.push([
        "",
        { content: "No of days present and OT hours", colSpan: 4, styles: { fontStyle: "bold", halign: "center" } },
        { content: leftPresentSum.toFixed(2), styles: { fontStyle: "bold", halign: "right" } },
        { content: leftOtSum > 0 ? leftOtSum.toFixed(2) : "-", styles: { fontStyle: "bold", halign: "right" } },
        "", "", "", "", "",
        { content: rightPresentSum.toFixed(2), styles: { fontStyle: "bold", halign: "right" } },
        { content: rightOtSum > 0 ? rightOtSum.toFixed(2) : "-", styles: { fontStyle: "bold", halign: "right" } },
    ]);

    // Grand Total Row: "TOTAL DAYS AND OT HOURS"
    tableBody.push([
        "",
        { content: "TOTAL DAYS AND OT HOURS", colSpan: 4, styles: { fontStyle: "bold", halign: "center" } },
        "", "", "", "", "", "", "",
        { content: totalPresentAll.toFixed(2), styles: { fontStyle: "bold", halign: "right" } },
        { content: totalOtAll > 0 ? totalOtAll.toFixed(2) : "-", styles: { fontStyle: "bold", halign: "right" } },
    ]);

    // Column widths summing to contentW (~281mm on A4 landscape)
    // Left 7 cols (~139mm) + Right 7 cols (~142mm)
    autoTable(doc, {
        startY: curY,
        margin: { left: margin, right: margin },
        head: [
            [
                { content: "DATE", rowSpan: 2, styles: { valign: "middle", halign: "center" } },
                { content: "PUNCH TIME", colSpan: 3, styles: { halign: "center" } },
                { content: "Total Hours", rowSpan: 2, styles: { valign: "middle", halign: "center" } },
                { content: "Present /", styles: { halign: "center" } },
                { content: "OT", styles: { halign: "center" } },
                { content: "DATE", rowSpan: 2, styles: { valign: "middle", halign: "center" } },
                { content: "PUNCH TIME", colSpan: 3, styles: { halign: "center" } },
                { content: "Total Hours", rowSpan: 2, styles: { valign: "middle", halign: "center" } },
                { content: "Present /", styles: { halign: "center" } },
                { content: "OT", styles: { halign: "center" } },
            ],
            [
                { content: "IN", styles: { halign: "center" } },
                { content: "OUT", styles: { halign: "center" } },
                { content: "", styles: { halign: "center" } },
                { content: "Absent", styles: { halign: "center" } },
                { content: "Hours", styles: { halign: "center" } },
                { content: "IN", styles: { halign: "center" } },
                { content: "OUT", styles: { halign: "center" } },
                { content: "", styles: { halign: "center" } },
                { content: "Absent", styles: { halign: "center" } },
                { content: "Hours", styles: { halign: "center" } },
            ]
        ],
        body: tableBody,
        theme: "grid",
        styles: {
            fontSize: 6.4,
            cellPadding: 0.75,
            halign: "center",
            valign: "middle",
            lineColor: [80, 80, 80],
            lineWidth: 0.1,
            textColor: [0, 0, 0]
        },
        headStyles: {
            fillColor: [255, 255, 255],
            textColor: [0, 0, 0],
            fontStyle: "bold",
            fontSize: 6.4,
            cellPadding: 0.75,
            lineWidth: 0.12,
            lineColor: [60, 60, 60]
        },
        columnStyles: {
            0: { cellWidth: contentW * 0.045 },
            1: { cellWidth: contentW * 0.055 },
            2: { cellWidth: contentW * 0.065 },
            3: { cellWidth: contentW * 0.115 },
            4: { cellWidth: contentW * 0.065 },
            5: { cellWidth: contentW * 0.070 },
            6: { cellWidth: contentW * 0.065 },
            7: { cellWidth: contentW * 0.045 },
            8: { cellWidth: contentW * 0.055 },
            9: { cellWidth: contentW * 0.055 },
            10: { cellWidth: contentW * 0.160 },
            11: { cellWidth: contentW * 0.065 },
            12: { cellWidth: contentW * 0.070 },
            13: { cellWidth: contentW * 0.070 },
        }
    });

    const afterTableY = (doc as any).lastAutoTable.finalY + 2.5;

    // 3. UNIFIED BOTTOM TABLE (Matching the exact 3-Block Company Layout)
    const bottomBody: any[][] = [
        // Row 1: Fixed Salary | Days/ Hrs | Amount | Total | LEAVE DETAILS
        [
            { content: "Fixed Salary", styles: { textColor: redColor, fontStyle: "bold", halign: "center" } },
            { content: Number(fixedSalary).toLocaleString("en-IN"), styles: { textColor: redColor, fontStyle: "bold", halign: "right" } },
            { content: "" },
            { content: "Days/ Hrs", styles: { textColor: redColor, fontStyle: "bold", halign: "center" } },
            { content: "Amount", styles: { textColor: redColor, fontStyle: "bold", halign: "center" } },
            { content: "Total", styles: { textColor: redColor, fontStyle: "bold", halign: "center" } },
            { content: "LEAVE DETAILS", colSpan: 4, styles: { textColor: redColor, fontStyle: "bold", halign: "center" } },
        ],
        // Row 2: Salary Calculation | Salary | Days | Rate | Total | OB | CREDIT | USED | CB
        [
            { content: "Salary Calculation", colSpan: 2, styles: { textColor: redColor, fontStyle: "bold", halign: "center" } },
            { content: "Salary", styles: { textColor: blackColor, halign: "center" } },
            { content: totalPresentAll.toFixed(2), styles: { textColor: blackColor, halign: "right" } },
            { content: perDayAmount.toFixed(2), styles: { textColor: blackColor, halign: "right" } },
            { content: Number(salaryEarned).toLocaleString("en-IN"), styles: { textColor: blackColor, fontStyle: "bold", halign: "right" } },
            { content: "OB", styles: { textColor: redColor, fontStyle: "bold", halign: "center" } },
            { content: "CREDIT", styles: { textColor: redColor, fontStyle: "bold", halign: "center" } },
            { content: "USED", styles: { textColor: redColor, fontStyle: "bold", halign: "center" } },
            { content: "CB", styles: { textColor: redColor, fontStyle: "bold", halign: "center" } },
        ],
        // Row 3: Basic | Increment | Leave Values
        [
            { content: "Basic", styles: { textColor: redColor, fontStyle: "bold", halign: "center" } },
            { content: Number(basicPay).toLocaleString("en-IN"), styles: { textColor: redColor, fontStyle: "bold", halign: "right" } },
            { content: "Increment", styles: { textColor: redColor, fontStyle: "bold", halign: "center" } },
            { content: "" },
            { content: "" },
            { content: incrementAmount > 0 ? Number(incrementAmount).toLocaleString("en-IN") : "-", styles: { textColor: redColor, halign: "center" } },
            { content: String(leaveOB), styles: { halign: "center" } },
            { content: String(leaveCredit), styles: { halign: "center" } },
            { content: String(leaveUsed), styles: { halign: "center" } },
            { content: String(leaveCB), styles: { halign: "center" } },
        ],
        // Row 4: DA | OT- Single
        [
            { content: "DA", styles: { textColor: redColor, fontStyle: "bold", halign: "center" } },
            { content: da > 0 ? Number(da).toLocaleString("en-IN") : "-", styles: { textColor: redColor, fontStyle: "bold", halign: "right" } },
            { content: "OT- Single", styles: { textColor: redColor, fontStyle: "bold", halign: "center" } },
            { content: singleOtHours > 0 ? singleOtHours.toFixed(2) : "", styles: { textColor: blackColor, halign: "right" } },
            { content: singleOtHours > 0 ? singleOtRate.toFixed(2) : "", styles: { textColor: blackColor, halign: "right" } },
            { content: singleOtPay > 0 ? Number(singleOtPay).toLocaleString("en-IN") : "", styles: { textColor: blackColor, fontStyle: "bold", halign: "right" } },
            { content: "" },
            { content: "" },
            { content: "" },
            { content: "" },
        ],
        // Row 5: HRA | OT - 1.5
        [
            { content: "HRA", styles: { textColor: redColor, fontStyle: "bold", halign: "center" } },
            { content: hra > 0 ? Number(hra).toLocaleString("en-IN") : "-", styles: { textColor: redColor, fontStyle: "bold", halign: "right" } },
            { content: "OT - 1.5", styles: { textColor: redColor, fontStyle: "bold", halign: "center" } },
            { content: multOtHours > 0 ? multOtHours.toFixed(2) : "", styles: { textColor: blackColor, halign: "right" } },
            { content: multOtHours > 0 ? multOtRate.toFixed(2) : "", styles: { textColor: blackColor, halign: "right" } },
            { content: multOtPay > 0 ? Number(multOtPay).toLocaleString("en-IN") : "", styles: { textColor: blackColor, fontStyle: "bold", halign: "right" } },
            { content: "" },
            { content: "" },
            { content: "" },
            { content: "" },
        ],
        // Row 6: Conveyance | PT
        [
            { content: "Conveyance", styles: { textColor: redColor, fontStyle: "bold", halign: "center" } },
            { content: conv > 0 ? Number(conv).toLocaleString("en-IN") : "-", styles: { textColor: redColor, fontStyle: "bold", halign: "right" } },
            { content: "PT", styles: { textColor: redColor, fontStyle: "bold", halign: "center" } },
            { content: "" },
            { content: "" },
            { content: ptAmount > 0 ? `-${ptAmount}` : "-", styles: { textColor: blackColor, fontStyle: "bold", halign: "center" } },
            { content: "" },
            { content: "" },
            { content: "" },
            { content: "" },
        ],
        // Row 7: Food | Advance
        [
            { content: "Food", styles: { textColor: redColor, fontStyle: "bold", halign: "center" } },
            { content: food > 0 ? Number(food).toLocaleString("en-IN") : "-", styles: { textColor: redColor, fontStyle: "bold", halign: "center" } },
            { content: "Advance", styles: { textColor: redColor, fontStyle: "bold", halign: "center" } },
            { content: "" },
            { content: "" },
            { content: advanceAmount > 0 ? `-${Number(advanceAmount).toLocaleString("en-IN")}` : "", styles: { textColor: blackColor, fontStyle: "bold", halign: "right" } },
            { content: "" },
            { content: "" },
            { content: "" },
            { content: "" },
        ],
        // Row 8: Room Rent | Total Payable | Accountant | Approver | Receiver
        [
            { content: "Room Rent", styles: { textColor: redColor, fontStyle: "bold", halign: "center" } },
            { content: roomRent > 0 ? Number(roomRent).toLocaleString("en-IN") : "-", styles: { textColor: blackColor, halign: "center" } },
            { content: "Total Payable", colSpan: 3, styles: { textColor: redColor, fontStyle: "bold", halign: "center" } },
            { content: Number(totalPayable).toLocaleString("en-IN"), styles: { textColor: redColor, fontStyle: "bold", halign: "right" } },
            { content: "Accountant", colSpan: 2, styles: { textColor: redColor, fontStyle: "bold", halign: "center" } },
            { content: "Approver", styles: { textColor: redColor, fontStyle: "bold", halign: "center" } },
            { content: "Receiver", styles: { textColor: redColor, fontStyle: "bold", halign: "center" } },
        ],
        // Row 9: Total Salary | Signatures
        [
            { content: "Total Salary", styles: { textColor: redColor, fontStyle: "bold", halign: "center" } },
            { content: Number(totalSalaryCalc).toLocaleString("en-IN"), styles: { textColor: redColor, fontStyle: "bold", halign: "right" } },
            { content: "", colSpan: 4 },
            { content: "Signature", colSpan: 2, styles: { textColor: redColor, fontStyle: "bold", halign: "center" } },
            { content: "Signature", styles: { textColor: redColor, fontStyle: "bold", halign: "center" } },
            { content: "Signature", styles: { textColor: redColor, fontStyle: "bold", halign: "center" } },
        ],
    ];

    autoTable(doc, {
        startY: afterTableY,
        margin: { left: margin, right: margin },
        body: bottomBody,
        theme: "grid",
        styles: {
            fontSize: 6.8,
            cellPadding: 0.85,
            valign: "middle",
            lineColor: [80, 80, 80],
            lineWidth: 0.1,
            textColor: [0, 0, 0],
        },
        columnStyles: {
            0: { cellWidth: contentW * 0.18 },
            1: { cellWidth: contentW * 0.11 },
            2: { cellWidth: contentW * 0.09 },
            3: { cellWidth: contentW * 0.065 },
            4: { cellWidth: contentW * 0.065 },
            5: { cellWidth: contentW * 0.07 },
            6: { cellWidth: contentW * 0.08 },
            7: { cellWidth: contentW * 0.14 },
            8: { cellWidth: contentW * 0.10 },
            9: { cellWidth: contentW * 0.10 },
        },
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
    companyName: string = ""
) {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    drawCompanyFormatPage(doc, salary, employee, month, year, companyName);

    const empId = employee?.employeeId || salary?.employee?.employeeId || "";
    const empName = employee?.name || salary?.employee?.name || "Emp";
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
    companyName: string = ""
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

/**
 * Downloads the Monthly Salary Statement PDF (A4 Landscape, Clean Light Grid)
 * for the selected mode:
 * - 'salary': Only Salaries (21 columns)
 * - 'ot': Only OT (17 columns, OT-applicable employees)
 * - 'total': Total (Salary + OT, 21 columns)
 */
export function exportMonthlySalaryStatementPDF(
    savedSalaries: any[],
    employees: any[],
    month: string,
    year: number,
    companyName: string = "",
    mode: StatementExportMode = 'total'
) {
    if (!savedSalaries || savedSalaries.length === 0) {
        alert("No saved salary records found to export.");
        return;
    }

    const { rows, totals } = computeMonthlyStatementData(savedSalaries, employees, month, year, mode);
    if (rows.length === 0) {
        alert(mode === 'ot' ? "No overtime-applicable employee records found for this period." : "No records found to export.");
        return;
    }

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const margin = 5;

    const fmtNum = (val: number) => (val && val !== 0 ? Number(val).toLocaleString("en-IN") : "-");

    if (mode === 'ot') {
        const titleText = companyName
            ? `${companyName.toUpperCase()} — OVERTIME STATEMENT FOR THE MONTH OF ${String(month).toUpperCase()} ${year}`
            : `OVERTIME STATEMENT FOR THE MONTH OF ${String(month).toUpperCase()} ${year}`;

        const head = [
            [
                { content: titleText, colSpan: 17, styles: { halign: "center" as const, fontStyle: "bold" as const, fontSize: 9.5, fillColor: [255, 255, 255] as [number, number, number] } }
            ],
            [
                "SL NO.",
                "NAME OF THE EMPLOYEES",
                "DEPARTMENT",
                "DESIGNATION",
                "NO OF DAYS WORK",
                "PRESENT DAY WORK",
                "FIXED SALARY",
                "BASIC",
                "OT - SINGLE HRS",
                "OT - SINGLE RATE",
                "OT - SINGLE PAY",
                "OT - 1.5 HRS",
                "OT - 1.5 RATE",
                "OT - 1.5 PAY",
                "TOTAL OT HOURS",
                "TOTAL OT PAY",
                "Remark",
            ]
        ];

        const body: any[][] = rows.map((r) => [
            { content: String(r.slNo), styles: { halign: "center" } },
            { content: r.empName, styles: { halign: "left" } },
            { content: r.department, styles: { halign: "left" } },
            { content: r.designation, styles: { halign: "left" } },
            { content: String(r.daysInMonth), styles: { halign: "center" } },
            { content: String(r.presentDays), styles: { halign: "center" } },
            { content: fmtNum(r.fixedSalary), styles: { halign: "right" } },
            { content: fmtNum(r.masterBasic), styles: { halign: "right" } },
            { content: r.singleOtHours > 0 ? r.singleOtHours.toFixed(2) : "-", styles: { halign: "right" } },
            { content: r.singleOtHours > 0 ? r.singleOtRate.toFixed(2) : "-", styles: { halign: "right" } },
            { content: fmtNum(r.singleOtPay), styles: { halign: "right" } },
            { content: r.multOtHours > 0 ? r.multOtHours.toFixed(2) : "-", styles: { halign: "right" } },
            { content: r.multOtHours > 0 ? r.multOtRate.toFixed(2) : "-", styles: { halign: "right" } },
            { content: fmtNum(r.multOtPay), styles: { halign: "right" } },
            { content: r.totalOtHours > 0 ? r.totalOtHours.toFixed(2) : "-", styles: { halign: "right", fontStyle: "bold" } },
            { content: fmtNum(r.totalOtPay), styles: { halign: "right", fontStyle: "bold" } },
            { content: r.remark || "", styles: { halign: "left" } },
        ]);

        // Blank spacer row
        body.push(new Array(17).fill(""));

        // TOTAL row
        body.push([
            { content: "", styles: { fontStyle: "bold" } },
            { content: "TOTAL", styles: { fontStyle: "bold", halign: "left" } },
            { content: "" },
            { content: "" },
            { content: "" },
            { content: "" },
            { content: fmtNum(totals.fixedSalary), styles: { fontStyle: "bold", halign: "right" } },
            { content: fmtNum(totals.masterBasic), styles: { fontStyle: "bold", halign: "right" } },
            { content: totals.singleOtHours > 0 ? totals.singleOtHours.toFixed(2) : "-", styles: { fontStyle: "bold", halign: "right" } },
            { content: "" },
            { content: fmtNum(totals.singleOtPay), styles: { fontStyle: "bold", halign: "right" } },
            { content: totals.multOtHours > 0 ? totals.multOtHours.toFixed(2) : "-", styles: { fontStyle: "bold", halign: "right" } },
            { content: "" },
            { content: fmtNum(totals.multOtPay), styles: { fontStyle: "bold", halign: "right" } },
            { content: totals.totalOtHours > 0 ? totals.totalOtHours.toFixed(2) : "-", styles: { fontStyle: "bold", halign: "right" } },
            { content: fmtNum(totals.totalOtPay), styles: { fontStyle: "bold", halign: "right" } },
            { content: "" },
        ]);

        autoTable(doc, {
            startY: 7,
            margin: { left: margin, right: margin },
            head,
            body,
            theme: "grid",
            styles: {
                fontSize: 6.4,
                cellPadding: 1.0,
                valign: "middle",
                lineColor: [70, 70, 70],
                lineWidth: 0.12,
                textColor: [0, 0, 0],
            },
            headStyles: {
                fillColor: [255, 255, 255],
                textColor: [0, 0, 0],
                fontStyle: "bold",
                fontSize: 6.2,
                halign: "center",
                valign: "middle",
                cellPadding: 1.1,
                lineColor: [50, 50, 50],
                lineWidth: 0.16,
            },
        });

        doc.save(`Salary_Statement_Only_OT_${month}_${year}.pdf`);
        return;
    }

    // Mode 'salary' or 'total' — 21-column Company Salary Statement layout
    const titleText = companyName
        ? `${companyName.toUpperCase()} — SALARY STATEMENT FOR THE MONTH OF ${String(month).toUpperCase()} ${year}`
        : `SALARY STATEMENT FOR THE MONTH OF ${String(month).toUpperCase()} ${year}`;

    const head = [
        [
            { content: titleText, colSpan: 18, styles: { halign: "center" as const, fontStyle: "bold" as const, fontSize: 9.5, fillColor: [255, 255, 255] as [number, number, number] } },
            { content: "", styles: { fillColor: [255, 255, 255] as [number, number, number] } },
            { content: "", styles: { fillColor: [255, 255, 255] as [number, number, number] } },
            { content: "", styles: { fillColor: [255, 255, 255] as [number, number, number] } },
        ],
        [
            "SL NO.",
            "NAME OF THE\nEMPLOYEES",
            "DEPARTMENT",
            "DESIGNATION",
            "NO OF\nDAYS\nWORK",
            "PRESENT\nDAY\nWORK",
            "FIXED\nSALARY",
            "PER DAY\nSALARY",
            "SALARY FOR\nTHE\nMONTH",
            "BASIC",
            "DA",
            "HRA",
            "CONVEY\nANCE",
            "GROSS\nSALARY",
            "ARREARS\n& OT\nDriving",
            "ADVANC\nE",
            "PT",
            "NET\nSALARY",
            "Remark",
            "ESI",
            "TOTAL NET\nSALARY",
        ]
    ];

    const body: any[][] = rows.map((r) => [
        { content: String(r.slNo), styles: { halign: "center" } },
        { content: r.empName, styles: { halign: "left" } },
        { content: r.department, styles: { halign: "left" } },
        { content: r.designation, styles: { halign: "left" } },
        { content: String(r.daysInMonth), styles: { halign: "center" } },
        { content: String(r.presentDays), styles: { halign: "center" } },
        { content: fmtNum(r.fixedSalary), styles: { halign: "right" } },
        { content: fmtNum(r.perDaySalary), styles: { halign: "right" } },
        { content: fmtNum(r.salaryForMonth), styles: { halign: "right" } },
        { content: fmtNum(r.basic), styles: { halign: "right" } },
        { content: fmtNum(r.da), styles: { halign: "right" } },
        { content: fmtNum(r.hra), styles: { halign: "right" } },
        { content: fmtNum(r.conveyance), styles: { halign: "right" } },
        { content: fmtNum(r.grossSalary), styles: { halign: "right" } },
        { content: fmtNum(r.arrearsAndOt), styles: { halign: r.arrearsAndOt > 0 ? "right" : "center" } },
        { content: fmtNum(r.advance), styles: { halign: r.advance > 0 ? "right" : "center" } },
        { content: fmtNum(r.pt), styles: { halign: r.pt > 0 ? "right" : "center" } },
        { content: fmtNum(r.netSalary), styles: { halign: "right" } },
        { content: r.remark || "", styles: { halign: "left" } },
        { content: fmtNum(r.esi), styles: { halign: r.esi > 0 ? "right" : "center" } },
        { content: fmtNum(r.totalNetSalary), styles: { halign: "right" } },
    ]);

    // Blank spacer row before TOTAL
    body.push(new Array(21).fill(""));

    // Bottom TOTAL row matching screenshot
    body.push([
        { content: "", styles: { fontStyle: "bold" } },
        { content: "TOTAL", styles: { fontStyle: "bold", halign: "left" } },
        { content: "" },
        { content: "" },
        { content: "" },
        { content: "" },
        { content: fmtNum(totals.fixedSalary), styles: { fontStyle: "bold", halign: "right" } },
        { content: fmtNum(totals.perDaySalary), styles: { fontStyle: "bold", halign: "right" } },
        { content: fmtNum(totals.salaryForMonth), styles: { fontStyle: "bold", halign: "right" } },
        { content: fmtNum(totals.basic), styles: { fontStyle: "bold", halign: "right" } },
        { content: fmtNum(totals.da), styles: { fontStyle: "bold", halign: "right" } },
        { content: fmtNum(totals.hra), styles: { fontStyle: "bold", halign: "right" } },
        { content: fmtNum(totals.conveyance), styles: { fontStyle: "bold", halign: "right" } },
        { content: fmtNum(totals.grossSalary), styles: { fontStyle: "bold", halign: "right" } },
        { content: fmtNum(totals.arrearsAndOt), styles: { fontStyle: "bold", halign: "right" } },
        { content: fmtNum(totals.advance), styles: { fontStyle: "bold", halign: "right" } },
        { content: fmtNum(totals.pt), styles: { fontStyle: "bold", halign: "right" } },
        { content: fmtNum(totals.netSalary), styles: { fontStyle: "bold", halign: "right" } },
        { content: "" },
        { content: fmtNum(totals.esi), styles: { fontStyle: "bold", halign: "right" } },
        { content: fmtNum(totals.totalNetSalary), styles: { fontStyle: "bold", halign: "right" } },
    ]);

    autoTable(doc, {
        startY: 7,
        margin: { left: margin, right: margin },
        head,
        body,
        theme: "grid",
        styles: {
            fontSize: 5.9,
            cellPadding: 0.85,
            valign: "middle",
            lineColor: [70, 70, 70],
            lineWidth: 0.12,
            textColor: [0, 0, 0],
        },
        headStyles: {
            fillColor: [255, 255, 255],
            textColor: [0, 0, 0],
            fontStyle: "bold",
            fontSize: 5.8,
            halign: "center",
            valign: "middle",
            cellPadding: 0.9,
            lineColor: [50, 50, 50],
            lineWidth: 0.16,
        },
    });

    const filePrefix = mode === 'salary'
        ? "Salary_Statement_Only_Salaries"
        : "Salary_Statement_Total";

    doc.save(`${filePrefix}_${month}_${year}.pdf`);
}

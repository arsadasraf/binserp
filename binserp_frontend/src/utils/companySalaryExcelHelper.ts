import * as XLSX from "xlsx";

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
 * Builds the exact 12-column AOA (Array of Arrays) and merges for a single employee sheet
 */
export function buildCompanyFormatAOA(
    salary: any,
    employee: any,
    month: string,
    year: number,
    companyName: string
): { aoa: any[][]; merges: XLSX.Range[]; cols: { wch: number }[] } {
    const monthIndex = MONTH_NAMES.findIndex(m => m.toLowerCase() === String(month).toLowerCase());
    const validMonthIndex = monthIndex >= 0 ? monthIndex : new Date().getMonth();
    const daysInMonth = new Date(year, validMonthIndex + 1, 0).getDate();
    const monthShort = MONTH_NAMES[validMonthIndex].substring(0, 3).toUpperCase();

    const empId = employee?.employeeId || salary.employee?.employeeId || "-";
    const empName = employee?.name || salary.employee?.name || "Unknown";
    const designation = employee?.designation || salary.employee?.designation || "-";

    const dailyLogs: DailyLogItem[] = salary.dailyLogs || [];

    const aoa: any[][] = [];
    const merges: XLSX.Range[] = [];

    // Helper to push row and track row index
    const addRow = (row: any[]) => {
        aoa.push(row);
        return aoa.length - 1;
    };

    // Row 0: Company Title (Merged A1:L1)
    const r0 = addRow([companyName || "EXCEL WIRECUT INC", "", "", "", "", "", "", "", "", "", "", ""]);
    merges.push({ s: { r: r0, c: 0 }, e: { r: r0, c: 11 } });

    // Row 1: Document Subtitle (Merged A2:L2)
    const r1 = addRow([`ATTENDANCE FOR THE MONTH OF ${monthShort}-${year}`, "", "", "", "", "", "", "", "", "", "", ""]);
    merges.push({ s: { r: r1, c: 0 }, e: { r: r1, c: 11 } });

    // Row 2: Employee ID (e.g. 76)
    const r2 = addRow([empId, "", "", "", "", "", "", "", "", "", "", ""]);
    merges.push({ s: { r: r2, c: 0 }, e: { r: r2, c: 3 } });

    // Row 3: Name & Designation
    const r3 = addRow([
        `Name of the Employ: ${empName}`, "", "", "", "", "",
        `Designatin: ${designation}`, "", "", "", "", ""
    ]);
    merges.push({ s: { r: r3, c: 0 }, e: { r: r3, c: 5 } });
    merges.push({ s: { r: r3, c: 6 }, e: { r: r3, c: 11 } });

    // Row 4: Working Time Header
    addRow(["Working Time:", "", "", "", "", "", "", "", "", "", "", ""]);

    // Row 5: Column Headers (Left: Days 1-15, Right: Days 16-31)
    addRow([
        "DATE", "PUNCH TIME IN", "PUNCH TIME OUT", "Total Hours", "Present / Absent", "OT Hours",
        "DATE", "PUNCH TIME IN", "PUNCH TIME OUT", "Total Hours", "Present / Absent", "OT Hours"
    ]);

    // Track subtotals
    let leftPresentSum = 0;
    let leftOtSum = 0;
    let rightPresentSum = 0;
    let rightOtSum = 0;

    // Helper to get daily details for day d
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
        } else {
            statusVal = "-";
            otVal = "-";
        }

        const numericPresent = typeof statusVal === 'number' ? statusVal : 0;
        const numericOt = typeof otVal === 'number' ? otVal : 0;

        return {
            day: d,
            inTime,
            outTime,
            totalHours: finalHours > 0 ? finalHours : "",
            presentAbsent: typeof statusVal === 'number' ? statusVal.toFixed(2) : statusVal,
            otHours: typeof otVal === 'number' ? otVal.toFixed(2) : otVal,
            numericPresent,
            numericOt
        };
    };

    // Rows 6 to 20: Days 1 to 15 (left) and Days 16 to 30 (right)
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

        const rowCells = [
            leftDay ? leftDay.day : "",
            leftDay ? leftDay.inTime : "",
            leftDay ? leftDay.outTime : "",
            leftDay ? leftDay.totalHours : "",
            leftDay ? leftDay.presentAbsent : "",
            leftDay ? leftDay.otHours : "",
            rightDay ? rightDay.day : "",
            rightDay ? rightDay.inTime : "",
            rightDay ? rightDay.outTime : "",
            rightDay ? rightDay.totalHours : "",
            rightDay ? rightDay.presentAbsent : "",
            rightDay ? rightDay.otHours : ""
        ];

        addRow(rowCells);
    }

    // If month has 31 days, add Day 31 row
    if (daysInMonth >= 31) {
        const day31 = getDayDetails(31);
        if (day31) {
            rightPresentSum += day31.numericPresent;
            rightOtSum += day31.numericOt;
        }

        addRow([
            "", "", "", "", "", "",
            day31 ? day31.day : 31,
            day31 ? day31.inTime : "",
            day31 ? day31.outTime : "",
            day31 ? day31.totalHours : "",
            day31 ? day31.presentAbsent : "",
            day31 ? day31.otHours : ""
        ]);
    }

    // Subtotal Row: "No of days present and OT hours"
    const subtotalRowIndex = addRow([
        "No of days present and OT hours", "", "", "",
        leftPresentSum.toFixed(2), leftOtSum > 0 ? leftOtSum.toFixed(2) : "-",
        "", "", "", "",
        rightPresentSum.toFixed(2), rightOtSum > 0 ? rightOtSum.toFixed(2) : "-"
    ]);
    merges.push({ s: { r: subtotalRowIndex, c: 0 }, e: { r: subtotalRowIndex, c: 3 } });
    merges.push({ s: { r: subtotalRowIndex, c: 6 }, e: { r: subtotalRowIndex, c: 9 } });

    // Grand Total Row: "TOTAL DAYS AND OT HOURS"
    const totalPresentAll = (leftPresentSum + rightPresentSum);
    const totalOtAll = (leftOtSum + rightOtSum);

    const grandTotalRowIndex = addRow([
        "TOTAL DAYS AND OT HOURS", "", "", "", "", "", "", "", "", "",
        totalPresentAll.toFixed(2), totalOtAll > 0 ? totalOtAll.toFixed(2) : "-"
    ]);
    merges.push({ s: { r: grandTotalRowIndex, c: 0 }, e: { r: grandTotalRowIndex, c: 9 } });

    // Blank row separator
    addRow(["", "", "", "", "", "", "", "", "", "", "", ""]);

    // Financial calculations
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

    // Bottom 3-Block Section Rows (Rows 1 to 9)
    // Row 1
    addRow([
        "Fixed Salary", Number(grossSalary).toLocaleString('en-IN'), "", "",
        "Days/ Hrs", "Amount", "Total", "",
        "LEAVE DETAILS", "", "", ""
    ]);
    const bRow1 = aoa.length - 1;
    merges.push({ s: { r: bRow1, c: 1 }, e: { r: bRow1, c: 3 } });
    merges.push({ s: { r: bRow1, c: 6 }, e: { r: bRow1, c: 7 } });
    merges.push({ s: { r: bRow1, c: 8 }, e: { r: bRow1, c: 11 } });

    // Row 2
    addRow([
        "Salary Calculation", "", "", "",
        "Salary", presentDays.toFixed(2), perDayAmount.toFixed(2), Number(salaryEarned).toLocaleString('en-IN'),
        "OB", "CREDIT", "USED", "CB"
    ]);
    const bRow2 = aoa.length - 1;
    merges.push({ s: { r: bRow2, c: 0 }, e: { r: bRow2, c: 3 } });

    // Row 3
    addRow([
        "Basic", Number(basicPay).toLocaleString('en-IN'), "", "",
        "Increment", "-", "-", "",
        "-", "-", totalLeavesUsed > 0 ? totalLeavesUsed : "-", "-"
    ]);
    const bRow3 = aoa.length - 1;
    merges.push({ s: { r: bRow3, c: 1 }, e: { r: bRow3, c: 3 } });
    merges.push({ s: { r: bRow3, c: 6 }, e: { r: bRow3, c: 7 } });

    // Row 4
    addRow([
        "DA", Number(da).toLocaleString('en-IN'), "", "",
        "OT- Single", "-", "-", "",
        "", "", "", ""
    ]);
    const bRow4 = aoa.length - 1;
    merges.push({ s: { r: bRow4, c: 1 }, e: { r: bRow4, c: 3 } });
    merges.push({ s: { r: bRow4, c: 6 }, e: { r: bRow4, c: 7 } });

    // Row 5
    addRow([
        "HRA", Number(hra).toLocaleString('en-IN'), "", "",
        "OT - 1.5", otAmount > 0 ? Number(otAmount).toLocaleString('en-IN') : "-", "-", "",
        "", "", "", ""
    ]);
    const bRow5 = aoa.length - 1;
    merges.push({ s: { r: bRow5, c: 1 }, e: { r: bRow5, c: 3 } });
    merges.push({ s: { r: bRow5, c: 6 }, e: { r: bRow5, c: 7 } });

    // Row 6
    addRow([
        "Conveyance", Number(conv).toLocaleString('en-IN'), "", "",
        "PT", "", `-${ptAmount}`, "",
        "", "", "", ""
    ]);
    const bRow6 = aoa.length - 1;
    merges.push({ s: { r: bRow6, c: 1 }, e: { r: bRow6, c: 3 } });
    merges.push({ s: { r: bRow6, c: 6 }, e: { r: bRow6, c: 7 } });

    // Row 7
    addRow([
        "Food", "-", "", "",
        "Advance", "", "-", "",
        "", "", "", ""
    ]);
    const bRow7 = aoa.length - 1;
    merges.push({ s: { r: bRow7, c: 1 }, e: { r: bRow7, c: 3 } });
    merges.push({ s: { r: bRow7, c: 6 }, e: { r: bRow7, c: 7 } });

    // Row 8
    addRow([
        "Room Rent", "-", "", "",
        "Total Payable", "", Number(totalPayable).toLocaleString('en-IN'), "",
        "Accountant Signature", "", "Approver Signature", "Receiver Signature"
    ]);
    const bRow8 = aoa.length - 1;
    merges.push({ s: { r: bRow8, c: 1 }, e: { r: bRow8, c: 3 } });
    merges.push({ s: { r: bRow8, c: 4 }, e: { r: bRow8, c: 5 } });
    merges.push({ s: { r: bRow8, c: 6 }, e: { r: bRow8, c: 7 } });
    merges.push({ s: { r: bRow8, c: 8 }, e: { r: bRow8, c: 9 } });

    // Row 9
    addRow([
        "Total Salary", Number(totalSalaryCalc).toLocaleString('en-IN'), "", "",
        "", "", "", "",
        "", "", "", ""
    ]);
    const bRow9 = aoa.length - 1;
    merges.push({ s: { r: bRow9, c: 1 }, e: { r: bRow9, c: 3 } });

    const cols = [
        { wch: 6 },  // Date
        { wch: 14 }, // Punch In
        { wch: 15 }, // Punch Out
        { wch: 11 }, // Total Hours
        { wch: 15 }, // Present/Absent
        { wch: 10 }, // OT Hours
        { wch: 6 },  // Date
        { wch: 14 }, // Punch In
        { wch: 15 }, // Punch Out
        { wch: 11 }, // Total Hours
        { wch: 15 }, // Present/Absent
        { wch: 10 }  // OT Hours
    ];

    return { aoa, merges, cols };
}

/**
 * Generates and downloads an All-In-One Excel workbook with:
 * - Sheet 1: Master Summary of all generated employees
 * - Sheets 2..N: One sheet per employee in the exact company format
 */
export function exportAllSalariesCompanyExcel(
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

    const wb = XLSX.utils.book_new();

    // 1. Build Master Summary Sheet (Sheet 1)
    const summaryRows = savedSalaries.map((sal, index) => {
        const empId = typeof sal.employee === 'string' ? sal.employee : sal.employee?._id;
        const fullEmp = employees.find(e => e._id === empId) || sal.employee || {};

        return {
            "S.No": index + 1,
            "Emp ID": fullEmp.employeeId || "-",
            "Employee Name": fullEmp.name || "Unknown",
            "Department": fullEmp.department || "-",
            "Designation": fullEmp.designation || "-",
            "Present Days": sal.presentDays || 0,
            "OT Hours": sal.overtime?.hours || 0,
            "Fixed Salary (₹)": sal.grossSalary || 0,
            "Basic (₹)": sal.salaryComponents?.basic || 0,
            "HRA (₹)": sal.salaryComponents?.hra || 0,
            "Conveyance (₹)": sal.salaryComponents?.conveyance || 0,
            "OT Pay (₹)": sal.overtime?.amount || 0,
            "PT Deduction (₹)": sal.salaryComponents?.professionalTax || 0,
            "Net Payable (₹)": sal.netSalary || 0,
            "Signature": ""
        };
    });

    const summaryWs = XLSX.utils.json_to_sheet(summaryRows);
    summaryWs['!cols'] = [
        { wch: 6 },  // S.No
        { wch: 10 }, // Emp ID
        { wch: 22 }, // Name
        { wch: 16 }, // Dept
        { wch: 16 }, // Desig
        { wch: 12 }, // Present Days
        { wch: 10 }, // OT Hours
        { wch: 15 }, // Fixed Salary
        { wch: 12 }, // Basic
        { wch: 10 }, // HRA
        { wch: 14 }, // Conveyance
        { wch: 12 }, // OT Pay
        { wch: 14 }, // PT
        { wch: 16 }, // Net Payable
        { wch: 16 }  // Signature
    ];
    XLSX.utils.book_append_sheet(wb, summaryWs, "Master Summary");

    // 2. Build one sheet for each employee
    const usedSheetNames = new Set<string>();

    savedSalaries.forEach((sal) => {
        const empId = typeof sal.employee === 'string' ? sal.employee : sal.employee?._id;
        const fullEmp = employees.find(e => e._id === empId) || sal.employee || {};

        const { aoa, merges, cols } = buildCompanyFormatAOA(sal, fullEmp, month, year, companyName);
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        ws['!merges'] = merges;
        ws['!cols'] = cols;

        // Clean sheet name: max 31 chars, no special characters [: \ / ? * [ ]]
        let rawName = `${fullEmp.employeeId || 'EMP'}_${fullEmp.name || 'Staff'}`.replace(/[:\\/?*\[\]]/g, "_");
        if (rawName.length > 28) rawName = rawName.substring(0, 28);
        let finalSheetName = rawName;
        let counter = 1;
        while (usedSheetNames.has(finalSheetName)) {
            finalSheetName = `${rawName.substring(0, 25)}_${counter++}`;
        }
        usedSheetNames.add(finalSheetName);

        XLSX.utils.book_append_sheet(wb, ws, finalSheetName);
    });

    const fileName = `Monthly_Salaries_All_${month}_${year}.xlsx`;
    XLSX.writeFile(wb, fileName);
}

/**
 * Exports a single employee's statement in company format
 */
export function exportSingleSalaryCompanyExcel(
    salary: any,
    employee: any,
    month: string,
    year: number,
    companyName: string = "EXCEL WIRECUT INC"
) {
    const wb = XLSX.utils.book_new();
    const { aoa, merges, cols } = buildCompanyFormatAOA(salary, employee, month, year, companyName);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!merges'] = merges;
    ws['!cols'] = cols;

    const sheetName = `${employee?.name || 'Employee'}`.substring(0, 31).replace(/[:\\/?*\[\]]/g, "_");
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    const fileName = `Salary_Statement_${employee?.employeeId || ''}_${employee?.name || 'Emp'}_${month}_${year}.xlsx`;
    XLSX.writeFile(wb, fileName);
}

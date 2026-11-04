import * as XLSX from "xlsx";

export interface DailyLogItem {
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
    remarks?: string;
}

export interface ComputedDayCell {
    day: number;
    isWeeklyOff: boolean;
    isHoliday: boolean;
    inTime: string;
    outTime: string;
    noteText: string;
    totalHours: string;
    presentAbsent: string;
    otHours: string;
    numericPresent: number;
    numericOt: number;
}

export interface ComputedCompanySalaryData {
    daysInMonth: number;
    monthShort: string;
    empId: string;
    empName: string;
    designation: string;
    workingTimeStr: string;
    isOTApplicable: boolean;
    standardHours: number;
    dayDetailsMap: Map<number, ComputedDayCell>;
    leftPresentSum: number;
    leftOtSum: number;
    rightPresentSum: number;
    rightOtSum: number;
    totalPresentAll: number;
    totalOtAll: number;
    activeWorkingDays: number;
    paidWeekOffDays: number;
    totalWeekOffs: number;
    actualAbsentDays: number;
    fixedSalary: number;
    basicPay: number;
    da: number;
    hra: number;
    conv: number;
    food: number;
    roomRent: number;
    totalSalaryCalc: number;
    perDayAmount: number;
    salaryEarned: number;
    incrementAmount: number;
    singleOtHours: number;
    singleOtRate: number;
    singleOtPay: number;
    multOtHours: number;
    multOtRate: number;
    multOtPay: number;
    mainOTRateMultiplier: number;
    absentOTRateMultiplier: number;
    totalOtPay: number;
    ptAmount: number;
    advanceAmount: number;
    totalPayable: number;
    leaveOB: number | string;
    leaveCredit: number | string;
    leaveUsed: number | string;
    leaveCB: number | string;
}

const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

const DAYS_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const formatPunchTime = (timeStr?: string | Date) => {
    if (!timeStr) return '';
    try {
        if (typeof timeStr === 'string' && /^\d{1,2}:\d{2}/.test(timeStr.trim())) {
            return timeStr.trim();
        }
        const d = new Date(timeStr);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    } catch {
        return '';
    }
};

/**
 * Core unified calculation engine used by both Excel and PDF Slip generators
 * (and aligned with Salary Generation)
 */
export function computeCompanySalarySheetData(
    salary: any,
    employee: any,
    month: string,
    year: number
): ComputedCompanySalaryData {
    const monthIndex = MONTH_NAMES.findIndex(m => m.toLowerCase() === String(month).toLowerCase());
    const validMonthIndex = monthIndex >= 0 ? monthIndex : new Date().getMonth();
    const daysInMonth = new Date(year, validMonthIndex + 1, 0).getDate();
    const monthShort = MONTH_NAMES[validMonthIndex].substring(0, 3).toUpperCase();

    const empObj = employee || salary?.employee || {};
    const empId = empObj?.employeeId || salary?.employee?.employeeId || "-";
    const empName = empObj?.name || salary?.employee?.name || "Unknown";
    const designation = empObj?.designation || salary?.employee?.designation || "";

    const isOTApplicable = Boolean(empObj?.isOTApplicable ?? salary?.employee?.isOTApplicable);
    const standardHours = Number(empObj?.standardWorkingHours || salary?.employee?.standardWorkingHours) || 9;
    const workingTimeStr = `${standardHours} Hrs`;

    const weeklyOffRaw = empObj?.weeklyOff || salary?.employee?.weeklyOff || ["Sunday"];
    const weeklyOffList: string[] = Array.isArray(weeklyOffRaw) ? weeklyOffRaw : [weeklyOffRaw];

    const dailyLogs: DailyLogItem[] = salary?.dailyLogs || [];

    // Step 1: First pass over 1..daysInMonth to count activeWorkingDays, totalWeekOffs, and actualAbsentDays
    let activeWorkingDays = 0;
    let totalWeekOffs = 0;
    let actualAbsentDays = 0;

    for (let d = 1; d <= daysInMonth; d++) {
        const log = dailyLogs.find(l => Number(l.day) === d) || dailyLogs[d - 1];
        const dateObj = new Date(year, validMonthIndex, d);
        const fullDayName = DAYS_FULL[dateObj.getDay()];
        const isWeeklyOff = weeklyOffList.includes(fullDayName);

        const finalStatus = log?.useManual ? log.manualStatus : log?.originalStatus;
        const isHoliday = finalStatus === 'Holiday' || log?.originalStatus === 'Holiday';

        if (isWeeklyOff) {
            totalWeekOffs += 1;
        } else if (isHoliday) {
            activeWorkingDays += 1;
        } else if (finalStatus === 'Present') {
            activeWorkingDays += 1;
        } else if (finalStatus === 'HalfDay') {
            activeWorkingDays += 0.5;
            actualAbsentDays += 0.5;
        } else if (finalStatus === 'CL' || finalStatus === 'SL' || finalStatus === 'CO' || finalStatus === 'CompOff') {
            activeWorkingDays += 1;
        } else {
            // Absent
            actualAbsentDays += 1;
        }
    }

    // Step 2: Apply Proportionate Week-Off Rule
    // If activeWorkingDays > 20 -> all week-offs in the month are paid
    // If activeWorkingDays <= 20 -> 1 paid week-off per 6 working days
    const paidWeekOffDays = activeWorkingDays > 20
        ? totalWeekOffs
        : Math.min(totalWeekOffs, Math.floor(activeWorkingDays / 6));

    // Step 3: Build daily cell details (1..daysInMonth)
    const dayDetailsMap = new Map<number, ComputedDayCell>();
    let weekOffsAssignedCount = 0;
    let leftPresentSum = 0;
    let leftOtSum = 0;
    let rightPresentSum = 0;
    let rightOtSum = 0;

    for (let d = 1; d <= daysInMonth; d++) {
        const log = dailyLogs.find(l => Number(l.day) === d) || dailyLogs[d - 1];
        const dateObj = new Date(year, validMonthIndex, d);
        const fullDayName = DAYS_FULL[dateObj.getDay()];
        const isWeeklyOff = weeklyOffList.includes(fullDayName);

        const finalStatus = log?.useManual ? log.manualStatus : log?.originalStatus;
        const finalHours = log?.useManual ? (log.manualHours ?? 0) : (log?.originalHours ?? 0);
        const rawDailyOt = log?.useManual ? (log.manualOtHours ?? 0) : (log?.otHours ?? 0);
        const dailyOt = isOTApplicable ? Math.max(0, Number(rawDailyOt) || 0) : 0;

        const isHoliday = finalStatus === 'Holiday' || log?.originalStatus === 'Holiday';

        let inTime = formatPunchTime(log?.originalCheckIn);
        let outTime = formatPunchTime(log?.originalCheckOut);
        let noteText = (log?.remarks || "").trim();
        let statusVal: number | string = "-";
        let otVal: number | string = "-";

        if (isWeeklyOff) {
            weekOffsAssignedCount += 1;
            const isPaidWeekOff = weekOffsAssignedCount <= paidWeekOffDays;
            if (!inTime && !outTime) {
                inTime = fullDayName.toUpperCase();
                outTime = "";
            } else if (!noteText) {
                noteText = fullDayName.toUpperCase();
            }
            statusVal = isPaidWeekOff ? 1.0 : "-";
            otVal = (isOTApplicable && dailyOt > 0) ? dailyOt : "-";
        } else if (isHoliday) {
            if (!noteText) noteText = "HOLIDAY";
            if (!inTime && !outTime) {
                inTime = "HOLIDAY";
            }
            statusVal = 1.0;
            otVal = (isOTApplicable && dailyOt > 0) ? dailyOt : "-";
        } else if (finalStatus === 'Present') {
            statusVal = 1.0;
            otVal = (isOTApplicable && dailyOt > 0) ? dailyOt : "-";
        } else if (finalStatus === 'HalfDay') {
            statusVal = 0.5;
            otVal = (isOTApplicable && dailyOt > 0) ? dailyOt : "-";
        } else if (finalStatus === 'CL' || finalStatus === 'SL' || finalStatus === 'CO' || finalStatus === 'CompOff') {
            statusVal = 1.0;
            if (!inTime) inTime = finalStatus;
            otVal = "-";
        } else {
            statusVal = "-";
            otVal = "-";
        }

        const numericPresent = typeof statusVal === 'number' ? statusVal : 0;
        const numericOt = typeof otVal === 'number' ? otVal : 0;

        if (d <= 15) {
            leftPresentSum += numericPresent;
            leftOtSum += numericOt;
        } else {
            rightPresentSum += numericPresent;
            rightOtSum += numericOt;
        }

        dayDetailsMap.set(d, {
            day: d,
            isWeeklyOff,
            isHoliday,
            inTime,
            outTime,
            noteText,
            totalHours: finalHours > 0 ? String(Number(finalHours.toFixed(2))) : "",
            presentAbsent: typeof statusVal === 'number' ? statusVal.toFixed(2) : statusVal,
            otHours: typeof otVal === 'number' ? otVal.toFixed(2) : otVal,
            numericPresent,
            numericOt,
        });
    }

    const totalPresentAll = leftPresentSum + rightPresentSum;
    const totalOtAll = isOTApplicable ? (leftOtSum + rightOtSum) : 0;

    // Step 4: Rule 1 — Fetch Payment Structure strictly from Employee Master
    // Mapping: basic -> Basic, specialAllowance (or da) -> DA, hra -> HRA, conveyance -> Conveyance, medical (or food) -> Food
    const masterSal = empObj?.salary || salary?.employee?.salary || {};
    const compSal = salary?.salaryComponents || {};

    const basicPay = Number(masterSal.basic ?? compSal.basic) || 0;
    const da = Number(masterSal.da ?? masterSal.specialAllowance ?? compSal.da ?? compSal.specialAllowance) || 0;
    const hra = Number(masterSal.hra ?? compSal.hra) || 0;
    const conv = Number(masterSal.conveyance ?? compSal.conveyance) || 0;
    const food = Number(masterSal.food ?? masterSal.medical ?? compSal.food ?? compSal.medical) || 0;
    const roomRent = Number(masterSal.roomRent ?? compSal.roomRent) || 0;

    const masterComponentSum = basicPay + da + hra + conv + food + roomRent;

    const fixedSalary =
        masterComponentSum > 0
            ? masterComponentSum
            : (Number(masterSal.grossSalary) ||
               Number(salary?.baseGrossSalary) ||
               Number(salary?.grossSalary) ||
               0);

    const totalSalaryCalc = masterComponentSum > 0 ? masterComponentSum : fixedSalary;

    // Step 5: Rule 2 — Per Day Salary = Fixed Salary / Total Calendar Days in Month
    const perDayAmount = daysInMonth > 0 ? (fixedSalary / daysInMonth) : 0;
    const salaryEarned = totalPresentAll >= daysInMonth
        ? fixedSalary
        : Math.round(perDayAmount * totalPresentAll);

    // Step 6: Rule 4 — OT Calculation (Only when isOTApplicable === true)
    // Base OT Hourly Rate = (Basic Salary / Total Days of Month) / Applicable Working Hours
    // Absent working hours shift from Main OT Multiplier to Absent OT Rate Multiplier
    const mainOTRateMultiplier = Number(masterSal.otRate) || 1.5;
    const absentOTRateMultiplier = Number(empObj?.absentOTRate ?? salary?.employee?.absentOTRate) || 1.0;

    let singleOtHours = 0;
    let singleOtRate = 0;
    let singleOtPay = 0;
    let multOtHours = 0;
    let multOtRate = 0;
    let multOtPay = 0;
    let totalOtPay = 0;

    if (isOTApplicable && totalOtAll > 0) {
        const baseOtHourlyRate = (daysInMonth > 0 && standardHours > 0)
            ? (basicPay / daysInMonth) / standardHours
            : 0;

        const absentWorkingHours = actualAbsentDays * standardHours;
        const shiftedToAbsentHours = actualAbsentDays > 0
            ? Math.min(totalOtAll, absentWorkingHours)
            : 0;
        const remainingMainHours = Math.max(0, totalOtAll - shiftedToAbsentHours);

        if (mainOTRateMultiplier <= 1.0) {
            singleOtHours = totalOtAll;
            singleOtRate = baseOtHourlyRate * mainOTRateMultiplier;
            singleOtPay = Math.round(singleOtHours * singleOtRate);
        } else {
            singleOtHours = shiftedToAbsentHours;
            singleOtRate = baseOtHourlyRate * absentOTRateMultiplier;
            singleOtPay = Math.round(singleOtHours * singleOtRate);

            multOtHours = remainingMainHours;
            multOtRate = baseOtHourlyRate * mainOTRateMultiplier;
            multOtPay = Math.round(multOtHours * multOtRate);
        }

        totalOtPay = singleOtPay + multOtPay;
    }

    const incrementAmount = Number(salary?.incentives) || 0;
    const isPTApplicable = Boolean(masterSal.isPTApplicable ?? (Number(compSal.professionalTax) > 0));
    const ptAmount = Number(compSal.professionalTax ?? masterSal.professionalTax) || (isPTApplicable ? 200 : 0);
    const advanceAmount = Number(salary?.deductions) || 0;

    const totalPayable = Math.round(salaryEarned + incrementAmount + totalOtPay - ptAmount - advanceAmount);

    const clUsed = Number(salary?.leavesConsumed?.casualLeave) || 0;
    const slUsed = Number(salary?.leavesConsumed?.sickLeave) || 0;
    const coUsed = Number(salary?.leavesConsumed?.compOff) || 0;
    const totalLeavesUsed = clUsed + slUsed + coUsed;

    return {
        daysInMonth,
        monthShort,
        empId,
        empName,
        designation,
        workingTimeStr,
        isOTApplicable,
        standardHours,
        dayDetailsMap,
        leftPresentSum,
        leftOtSum,
        rightPresentSum,
        rightOtSum,
        totalPresentAll,
        totalOtAll,
        activeWorkingDays,
        paidWeekOffDays,
        totalWeekOffs,
        actualAbsentDays,
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
        mainOTRateMultiplier,
        absentOTRateMultiplier,
        totalOtPay,
        ptAmount,
        advanceAmount,
        totalPayable,
        leaveOB: "-",
        leaveCredit: "-",
        leaveUsed: totalLeavesUsed > 0 ? totalLeavesUsed : "-",
        leaveCB: "-",
    };
}

/**
 * Builds the exact 14-column AOA (Array of Arrays) and merges for a single employee sheet
 * matching the company Attendance & Salary format.
 */
export function buildCompanyFormatAOA(
    salary: any,
    employee: any,
    month: string,
    year: number,
    companyName: string
): { aoa: any[][]; merges: XLSX.Range[]; cols: { wch: number }[] } {
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

    const aoa: any[][] = [];
    const merges: XLSX.Range[] = [];

    const addRow = (row: any[]) => {
        aoa.push(row);
        return aoa.length - 1;
    };

    // Row 0: Company Title from Master (Merged A1:N1)
    const r0 = addRow([companyName || "COMPANY NAME", "", "", "", "", "", "", "", "", "", "", "", "", ""]);
    merges.push({ s: { r: r0, c: 0 }, e: { r: r0, c: 13 } });

    // Row 1: Document Subtitle (Merged A2:N2)
    const r1 = addRow([`ATTENDANCE FOR THE MONTH OF ${monthShort}-${year}`, "", "", "", "", "", "", "", "", "", "", "", "", ""]);
    merges.push({ s: { r: r1, c: 0 }, e: { r: r1, c: 13 } });

    // Row 2: Employee ID centered (Merged A3:N3)
    const r2 = addRow([empId, "", "", "", "", "", "", "", "", "", "", "", "", ""]);
    merges.push({ s: { r: r2, c: 0 }, e: { r: r2, c: 13 } });

    // Row 3: Name of the Employee
    const r3 = addRow([
        "Name of the Employee:", "", empName, "", "", "", "",
        "", "", "", "", "", "", ""
    ]);
    merges.push({ s: { r: r3, c: 0 }, e: { r: r3, c: 1 } });
    merges.push({ s: { r: r3, c: 2 }, e: { r: r3, c: 6 } });

    // Row 4: Designation
    const r4 = addRow([
        "", "", "", "", "", "", "",
        "", "Designatin:", designation, "", "", "", ""
    ]);
    merges.push({ s: { r: r4, c: 9 }, e: { r: r4, c: 13 } });

    // Row 5: Working Time
    const r5 = addRow([
        "Working  Time:", "", workingTimeStr, "", "", "", "",
        "", "", "", "", "", "", ""
    ]);
    merges.push({ s: { r: r5, c: 0 }, e: { r: r5, c: 1 } });

    // Row 6 & Row 7: 2-Row Table Header (14 Columns: 0..6 Left, 7..13 Right)
    const rHeader1 = addRow([
        "DATE", "PUNCH TIME", "", "", "Total Hours", "Present /", "OT",
        "DATE", "PUNCH TIME", "", "", "Total Hours", "Present /", "OT"
    ]);
    const rHeader2 = addRow([
        "", "IN", "OUT", "", "", "Absent", "Hours",
        "", "IN", "OUT", "", "", "Absent", "Hours"
    ]);
    // Vertical & horizontal merges for the 2-row header
    merges.push({ s: { r: rHeader1, c: 0 }, e: { r: rHeader2, c: 0 } }); // Left DATE
    merges.push({ s: { r: rHeader1, c: 1 }, e: { r: rHeader1, c: 3 } }); // Left PUNCH TIME
    merges.push({ s: { r: rHeader1, c: 4 }, e: { r: rHeader2, c: 4 } }); // Left Total Hours
    merges.push({ s: { r: rHeader1, c: 7 }, e: { r: rHeader2, c: 7 } }); // Right DATE
    merges.push({ s: { r: rHeader1, c: 8 }, e: { r: rHeader1, c: 10 } }); // Right PUNCH TIME
    merges.push({ s: { r: rHeader1, c: 11 }, e: { r: rHeader2, c: 11 } }); // Right Total Hours

    // Days 1 to 15 (left) and Days 16 to 30 (right)
    for (let i = 1; i <= 15; i++) {
        const leftDay = dayDetailsMap.get(i);
        const rightDay = dayDetailsMap.get(i + 15);

        const rIdx = addRow([
            leftDay ? leftDay.day : "",
            leftDay ? leftDay.inTime : "",
            leftDay ? leftDay.outTime : "",
            leftDay ? leftDay.noteText : "",
            leftDay ? leftDay.totalHours : "",
            leftDay ? leftDay.presentAbsent : "",
            leftDay ? leftDay.otHours : "",
            rightDay ? rightDay.day : "",
            rightDay ? rightDay.inTime : "",
            rightDay ? rightDay.outTime : "",
            rightDay ? rightDay.noteText : "",
            rightDay ? rightDay.totalHours : "",
            rightDay ? rightDay.presentAbsent : "",
            rightDay ? rightDay.otHours : ""
        ]);

        // Merge IN & OUT when SUNDAY is displayed across both punch cells
        if (leftDay?.isWeeklyOff && !leftDay.outTime) {
            merges.push({ s: { r: rIdx, c: 1 }, e: { r: rIdx, c: 2 } });
        }
        if (rightDay?.isWeeklyOff && !rightDay.outTime) {
            merges.push({ s: { r: rIdx, c: 8 }, e: { r: rIdx, c: 9 } });
        }
    }

    // Extra row for Day 31 (or '-' placeholder on left)
    if (daysInMonth >= 31) {
        const day31 = dayDetailsMap.get(31);
        const r31 = addRow([
            "", "", "", "", "", "-", "",
            31,
            day31 ? day31.inTime : "",
            day31 ? day31.outTime : "",
            day31 ? day31.noteText : "",
            day31 ? day31.totalHours : "",
            day31 ? day31.presentAbsent : "",
            day31 ? day31.otHours : ""
        ]);
        if (day31?.isWeeklyOff && !day31.outTime) {
            merges.push({ s: { r: r31, c: 8 }, e: { r: r31, c: 9 } });
        }
    }

    // Subtotal Row: "No of days present and OT hours"
    const subtotalRowIndex = addRow([
        "", "No of days present and OT hours", "", "", "",
        leftPresentSum.toFixed(2),
        leftOtSum > 0 ? leftOtSum.toFixed(2) : "-",
        "", "", "", "", "",
        rightPresentSum.toFixed(2),
        rightOtSum > 0 ? rightOtSum.toFixed(2) : "-"
    ]);
    merges.push({ s: { r: subtotalRowIndex, c: 1 }, e: { r: subtotalRowIndex, c: 4 } });

    // Grand Total Row: "TOTAL DAYS AND OT HOURS"
    const grandTotalRowIndex = addRow([
        "", "TOTAL DAYS AND OT HOURS", "", "", "", "", "", "", "", "", "", "",
        totalPresentAll.toFixed(2),
        totalOtAll > 0 ? totalOtAll.toFixed(2) : "-"
    ]);
    merges.push({ s: { r: grandTotalRowIndex, c: 1 }, e: { r: grandTotalRowIndex, c: 4 } });

    // Blank row separator
    addRow(["", "", "", "", "", "", "", "", "", "", "", "", "", ""]);

    // Bottom 3-Part Summary Section (Aligned to 14 columns A..N)
    // Row 1: Fixed Salary | Days/ Hrs | Amount | Total | LEAVE DETAILS
    const bRow1 = addRow([
        "Fixed Salary", "", "", Number(fixedSalary).toLocaleString('en-IN'), "",
        "Days/ Hrs", "Amount", "Total",
        "LEAVE DETAILS", "", "", "", "", ""
    ]);
    merges.push({ s: { r: bRow1, c: 0 }, e: { r: bRow1, c: 1 } });
    merges.push({ s: { r: bRow1, c: 8 }, e: { r: bRow1, c: 12 } });

    // Row 2: Salary Calculation | Salary | <Payable Days> | <Per Day Amount> | <Salary Earned> | OB | CREDIT | USED | CB
    const bRow2 = addRow([
        "Salary Calculation", "", "", "",
        "Salary",
        totalPresentAll.toFixed(2),
        perDayAmount.toFixed(2),
        Number(salaryEarned).toLocaleString('en-IN'),
        "OB", "", "CREDIT", "USED", "CB", ""
    ]);
    merges.push({ s: { r: bRow2, c: 0 }, e: { r: bRow2, c: 3 } });
    merges.push({ s: { r: bRow2, c: 8 }, e: { r: bRow2, c: 9 } });

    // Row 3: Basic | Increment | Leave Values
    const bRow3 = addRow([
        "Basic", "", "", Number(basicPay).toLocaleString('en-IN'),
        "Increment",
        "",
        "",
        incrementAmount > 0 ? Number(incrementAmount).toLocaleString('en-IN') : "-",
        leaveOB, "", leaveCredit, leaveUsed, leaveCB, ""
    ]);
    merges.push({ s: { r: bRow3, c: 0 }, e: { r: bRow3, c: 1 } });
    merges.push({ s: { r: bRow3, c: 8 }, e: { r: bRow3, c: 9 } });

    // Row 4: DA | OT- Single
    const bRow4 = addRow([
        "DA", "", "", da > 0 ? Number(da).toLocaleString('en-IN') : "-",
        "OT- Single",
        singleOtHours > 0 ? singleOtHours.toFixed(2) : "",
        singleOtHours > 0 ? singleOtRate.toFixed(2) : "",
        singleOtPay > 0 ? Number(singleOtPay).toLocaleString('en-IN') : "",
        "", "", "", "", "", ""
    ]);
    merges.push({ s: { r: bRow4, c: 0 }, e: { r: bRow4, c: 1 } });

    // Row 5: HRA | OT - 1.5
    const bRow5 = addRow([
        "HRA", "", "", hra > 0 ? Number(hra).toLocaleString('en-IN') : "-",
        "OT - 1.5",
        multOtHours > 0 ? multOtHours.toFixed(2) : "",
        multOtHours > 0 ? multOtRate.toFixed(2) : "",
        multOtPay > 0 ? Number(multOtPay).toLocaleString('en-IN') : "",
        "", "", "", "", "", ""
    ]);
    merges.push({ s: { r: bRow5, c: 0 }, e: { r: bRow5, c: 1 } });

    // Row 6: Conveyance | PT
    const bRow6 = addRow([
        "Conveyance", "", "", conv > 0 ? Number(conv).toLocaleString('en-IN') : "-",
        "PT",
        "",
        "",
        ptAmount > 0 ? `-${ptAmount}` : "-",
        "", "", "", "", "", ""
    ]);
    merges.push({ s: { r: bRow6, c: 0 }, e: { r: bRow6, c: 1 } });

    // Row 7: Food | Advance
    const bRow7 = addRow([
        "Food", "", "", food > 0 ? Number(food).toLocaleString('en-IN') : "-",
        "Advance",
        "",
        "",
        advanceAmount > 0 ? `-${Number(advanceAmount).toLocaleString('en-IN')}` : "",
        "", "", "", "", "", ""
    ]);
    merges.push({ s: { r: bRow7, c: 0 }, e: { r: bRow7, c: 1 } });

    // Row 8: Room Rent | Total Payable | Accountant | Approver | Receiver
    const bRow8 = addRow([
        "Room Rent", "", "", roomRent > 0 ? Number(roomRent).toLocaleString('en-IN') : "-",
        "Total Payable", "", "",
        Number(totalPayable).toLocaleString('en-IN'),
        "Accountant", "", "", "Approver", "", "Receiver"
    ]);
    merges.push({ s: { r: bRow8, c: 0 }, e: { r: bRow8, c: 1 } });
    merges.push({ s: { r: bRow8, c: 4 }, e: { r: bRow8, c: 6 } });
    merges.push({ s: { r: bRow8, c: 8 }, e: { r: bRow8, c: 10 } });
    merges.push({ s: { r: bRow8, c: 11 }, e: { r: bRow8, c: 12 } });

    // Row 9: Total Salary | Signatures
    const bRow9 = addRow([
        "Total Salary", "", "", Number(totalSalaryCalc).toLocaleString('en-IN'),
        "", "", "", "",
        "Signature", "", "", "Signature", "", "Signature"
    ]);
    merges.push({ s: { r: bRow9, c: 0 }, e: { r: bRow9, c: 1 } });
    merges.push({ s: { r: bRow9, c: 8 }, e: { r: bRow9, c: 10 } });
    merges.push({ s: { r: bRow9, c: 11 }, e: { r: bRow9, c: 12 } });

    const cols = [
        { wch: 6 },  // Col 0 (A): Left Date
        { wch: 9 },  // Col 1 (B): Left Punch IN
        { wch: 9 },  // Col 2 (C): Left Punch OUT
        { wch: 16 }, // Col 3 (D): Left Note / Remarks
        { wch: 11 }, // Col 4 (E): Left Total Hours
        { wch: 10 }, // Col 5 (F): Left Present / Absent
        { wch: 9 },  // Col 6 (G): Left OT Hours
        { wch: 6 },  // Col 7 (H): Right Date
        { wch: 9 },  // Col 8 (I): Right Punch IN
        { wch: 9 },  // Col 9 (J): Right Punch OUT
        { wch: 22 }, // Col 10 (K): Right Note / Remarks
        { wch: 11 }, // Col 11 (L): Right Total Hours
        { wch: 10 }, // Col 12 (M): Right Present / Absent
        { wch: 9 },  // Col 13 (N): Right OT Hours
    ];

    return { aoa, merges, cols };
}

export type StatementExportMode = 'salary' | 'ot' | 'total';

export interface MonthlyStatementRow {
    slNo: string | number;
    empName: string;
    department: string;
    designation: string;
    daysInMonth: number;
    presentDays: number;
    fixedSalary: number;
    perDaySalary: number;
    salaryForMonth: number;
    basic: number;
    da: number;
    hra: number;
    conveyance: number;
    grossSalary: number;
    arrearsAndOt: number;
    advance: number;
    pt: number;
    netSalary: number;
    remark: string;
    esi: number;
    totalNetSalary: number;
    // OT-specific fields for 'ot' mode
    isOTApplicable: boolean;
    masterBasic: number;
    singleOtHours: number;
    singleOtRate: number;
    singleOtPay: number;
    multOtHours: number;
    multOtRate: number;
    multOtPay: number;
    totalOtHours: number;
    totalOtPay: number;
}

export function computeMonthlyStatementData(
    savedSalaries: any[],
    employees: any[],
    month: string,
    year: number,
    mode: StatementExportMode = 'total'
): {
    rows: MonthlyStatementRow[];
    totals: {
        fixedSalary: number;
        perDaySalary: number;
        salaryForMonth: number;
        basic: number;
        da: number;
        hra: number;
        conveyance: number;
        grossSalary: number;
        arrearsAndOt: number;
        advance: number;
        pt: number;
        netSalary: number;
        esi: number;
        totalNetSalary: number;
        masterBasic: number;
        singleOtHours: number;
        singleOtPay: number;
        multOtHours: number;
        multOtPay: number;
        totalOtHours: number;
        totalOtPay: number;
    };
} {
    const allComputed: MonthlyStatementRow[] = savedSalaries.map((sal, index) => {
        const empId = typeof sal.employee === 'string' ? sal.employee : sal.employee?._id;
        const fullEmp = employees.find(e => e._id === empId) || sal.employee || {};
        const calc = computeCompanySalarySheetData(sal, fullEmp, month, year);

        const daysInMonth = calc.daysInMonth || 30;
        const presentDays = calc.totalPresentAll;
        const fixedSalary = Math.round(calc.fixedSalary);
        const exactPerDay = daysInMonth > 0 ? fixedSalary / daysInMonth : 0;
        const perDaySalary = Math.round(exactPerDay);

        const exactEarned = presentDays >= daysInMonth ? fixedSalary : exactPerDay * presentDays;
        const salaryForMonth = Math.round(exactEarned);

        // Fetch strictly from Employee Master payment structure and pro-rate by (presentDays / daysInMonth)
        const proRateRatio = daysInMonth > 0
            ? (presentDays >= daysInMonth ? 1 : presentDays / daysInMonth)
            : 0;
        const basic = Math.round(calc.basicPay * proRateRatio);
        const da = Math.round(calc.da * proRateRatio);
        const hra = Math.round(calc.hra * proRateRatio);
        const conveyance = Math.round((calc.conv + calc.food + calc.roomRent) * proRateRatio);
        const grossSalary = salaryForMonth;

        const arrearsAndOt = mode === 'salary'
            ? Math.round(calc.incrementAmount)
            : Math.round(calc.incrementAmount + (calc.isOTApplicable ? calc.totalOtPay : 0));

        const advance = Math.round(calc.advanceAmount);
        const pt = Math.round(calc.ptAmount);
        const netSalary = Math.round(grossSalary + arrearsAndOt - advance - pt);

        const savedEsi = Number(sal?.salaryComponents?.esi) || 0;
        const isEsiApplicable = Boolean(
            fullEmp?.salary?.isESIApplicable ??
            sal?.employee?.salary?.isESIApplicable ??
            (savedEsi > 0)
        );
        const exactEsi = savedEsi > 0
            ? savedEsi
            : (isEsiApplicable ? exactEarned * 0.0075 : 0);
        const esi = Math.round(exactEsi);

        const pf = Math.round(Number(sal?.salaryComponents?.pf) || 0);
        const totalNetSalary = Math.round(netSalary - exactEsi - pf);

        const rawEmpCode = String(calc.empId || '').trim();
        const slNo = rawEmpCode && rawEmpCode !== '-' ? rawEmpCode : index + 1;

        return {
            slNo,
            empName: calc.empName,
            department: fullEmp?.department || sal?.employee?.department || '-',
            designation: calc.designation || '-',
            daysInMonth,
            presentDays,
            fixedSalary,
            perDaySalary,
            salaryForMonth,
            basic,
            da,
            hra,
            conveyance,
            grossSalary,
            arrearsAndOt,
            advance,
            pt,
            netSalary,
            remark: sal?.remarks || sal?.paymentMode || fullEmp?.paymentMode || '',
            esi,
            totalNetSalary,
            isOTApplicable: calc.isOTApplicable,
            masterBasic: Math.round(calc.basicPay),
            singleOtHours: calc.singleOtHours,
            singleOtRate: calc.singleOtRate,
            singleOtPay: Math.round(calc.singleOtPay),
            multOtHours: calc.multOtHours,
            multOtRate: calc.multOtRate,
            multOtPay: Math.round(calc.multOtPay),
            totalOtHours: calc.totalOtAll,
            totalOtPay: Math.round(calc.totalOtPay),
        };
    });

    const rows = mode === 'ot'
        ? allComputed.filter(r => r.isOTApplicable || r.totalOtHours > 0)
        : allComputed;

    const totals = rows.reduce(
        (acc, r) => {
            acc.fixedSalary += r.fixedSalary;
            acc.perDaySalary += r.perDaySalary;
            acc.salaryForMonth += r.salaryForMonth;
            acc.basic += r.basic;
            acc.da += r.da;
            acc.hra += r.hra;
            acc.conveyance += r.conveyance;
            acc.grossSalary += r.grossSalary;
            acc.arrearsAndOt += r.arrearsAndOt;
            acc.advance += r.advance;
            acc.pt += r.pt;
            acc.netSalary += r.netSalary;
            acc.esi += r.esi;
            acc.totalNetSalary += r.totalNetSalary;
            acc.masterBasic += r.masterBasic;
            acc.singleOtHours += r.singleOtHours;
            acc.singleOtPay += r.singleOtPay;
            acc.multOtHours += r.multOtHours;
            acc.multOtPay += r.multOtPay;
            acc.totalOtHours += r.totalOtHours;
            acc.totalOtPay += r.totalOtPay;
            return acc;
        },
        {
            fixedSalary: 0,
            perDaySalary: 0,
            salaryForMonth: 0,
            basic: 0,
            da: 0,
            hra: 0,
            conveyance: 0,
            grossSalary: 0,
            arrearsAndOt: 0,
            advance: 0,
            pt: 0,
            netSalary: 0,
            esi: 0,
            totalNetSalary: 0,
            masterBasic: 0,
            singleOtHours: 0,
            singleOtPay: 0,
            multOtHours: 0,
            multOtPay: 0,
            totalOtHours: 0,
            totalOtPay: 0,
        }
    );

    return { rows, totals };
}

export function buildMonthlyStatementAOA(
    savedSalaries: any[],
    employees: any[],
    month: string,
    year: number,
    companyName: string = "",
    mode: StatementExportMode = 'total'
): { aoa: any[][]; merges: XLSX.Range[]; cols: { wch: number }[]; rowCount: number } {
    const { rows, totals } = computeMonthlyStatementData(savedSalaries, employees, month, year, mode);
    const aoa: any[][] = [];
    const merges: XLSX.Range[] = [];

    const fmtZeroDash = (val: number) => (val && val !== 0 ? val : "-");

    if (mode === 'ot') {
        const colCount = 17;
        const titleText = companyName
            ? `${companyName.toUpperCase()} — OVERTIME STATEMENT FOR THE MONTH OF ${String(month).toUpperCase()} ${year}`
            : `OVERTIME STATEMENT FOR THE MONTH OF ${String(month).toUpperCase()} ${year}`;

        const titleRow = new Array(colCount).fill("");
        titleRow[0] = titleText;
        aoa.push(titleRow);
        merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } });

        aoa.push([
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
        ]);

        rows.forEach((r) => {
            aoa.push([
                r.slNo,
                r.empName,
                r.department,
                r.designation,
                r.daysInMonth,
                r.presentDays,
                r.fixedSalary,
                r.masterBasic,
                r.singleOtHours > 0 ? Number(r.singleOtHours.toFixed(2)) : "-",
                r.singleOtHours > 0 ? Number(r.singleOtRate.toFixed(2)) : "-",
                fmtZeroDash(r.singleOtPay),
                r.multOtHours > 0 ? Number(r.multOtHours.toFixed(2)) : "-",
                r.multOtHours > 0 ? Number(r.multOtRate.toFixed(2)) : "-",
                fmtZeroDash(r.multOtPay),
                r.totalOtHours > 0 ? Number(r.totalOtHours.toFixed(2)) : "-",
                fmtZeroDash(r.totalOtPay),
                r.remark || "",
            ]);
        });

        // Blank row before TOTAL
        aoa.push(new Array(colCount).fill(""));

        // TOTAL row
        aoa.push([
            "",
            "TOTAL",
            "",
            "",
            "",
            "",
            totals.fixedSalary,
            totals.masterBasic,
            Number(totals.singleOtHours.toFixed(2)),
            "",
            totals.singleOtPay,
            Number(totals.multOtHours.toFixed(2)),
            "",
            totals.multOtPay,
            Number(totals.totalOtHours.toFixed(2)),
            totals.totalOtPay,
            "",
        ]);

        const cols = [
            { wch: 8 },  // SL NO.
            { wch: 24 }, // NAME OF THE EMPLOYEES
            { wch: 16 }, // DEPARTMENT
            { wch: 18 }, // DESIGNATION
            { wch: 12 }, // NO OF DAYS WORK
            { wch: 12 }, // PRESENT DAY WORK
            { wch: 14 }, // FIXED SALARY
            { wch: 13 }, // BASIC
            { wch: 14 }, // OT - SINGLE HRS
            { wch: 14 }, // OT - SINGLE RATE
            { wch: 14 }, // OT - SINGLE PAY
            { wch: 14 }, // OT - 1.5 HRS
            { wch: 14 }, // OT - 1.5 RATE
            { wch: 14 }, // OT - 1.5 PAY
            { wch: 15 }, // TOTAL OT HOURS
            { wch: 15 }, // TOTAL OT PAY
            { wch: 14 }, // Remark
        ];

        return { aoa, merges, cols, rowCount: rows.length };
    }

    // Mode 'salary' or 'total' — 21-column Company Salary Statement layout
    const colCount = 21;
    const titleLabel = mode === 'salary'
        ? `SALARY STATEMENT FOR THE MONTH OF ${String(month).toUpperCase()} ${year}`
        : `SALARY STATEMENT FOR THE MONTH OF ${String(month).toUpperCase()} ${year}`;
    const fullTitle = companyName
        ? `${companyName.toUpperCase()} — ${titleLabel}`
        : titleLabel;

    const titleRow = new Array(colCount).fill("");
    titleRow[0] = fullTitle;
    aoa.push(titleRow);
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 17 } });

    aoa.push([
        "SL NO.",
        "NAME OF THE EMPLOYEES",
        "DEPARTMENT",
        "DESIGNATION",
        "NO OF DAYS WORK",
        "PRESENT DAY WORK",
        "FIXED SALARY",
        "PER DAY SALARY",
        "SALARY FOR THE MONTH",
        "BASIC",
        "DA",
        "HRA",
        "CONVEYANCE",
        "GROSS SALARY",
        "ARREARS & OT Driving",
        "ADVANCE",
        "PT",
        "NET SALARY",
        "Remark",
        "ESI",
        "TOTAL NET SALARY",
    ]);

    rows.forEach((r) => {
        aoa.push([
            r.slNo,
            r.empName,
            r.department,
            r.designation,
            r.daysInMonth,
            r.presentDays,
            r.fixedSalary,
            r.perDaySalary,
            r.salaryForMonth,
            r.basic,
            r.da,
            r.hra,
            r.conveyance,
            r.grossSalary,
            fmtZeroDash(r.arrearsAndOt),
            fmtZeroDash(r.advance),
            fmtZeroDash(r.pt),
            r.netSalary,
            r.remark || "",
            fmtZeroDash(r.esi),
            r.totalNetSalary,
        ]);
    });

    // Blank separator row before TOTAL
    aoa.push(new Array(colCount).fill(""));

    // TOTAL row
    aoa.push([
        "",
        "TOTAL",
        "",
        "",
        "",
        "",
        totals.fixedSalary,
        totals.perDaySalary,
        totals.salaryForMonth,
        totals.basic,
        totals.da,
        totals.hra,
        totals.conveyance,
        totals.grossSalary,
        fmtZeroDash(totals.arrearsAndOt),
        fmtZeroDash(totals.advance),
        fmtZeroDash(totals.pt),
        totals.netSalary,
        "",
        fmtZeroDash(totals.esi),
        totals.totalNetSalary,
    ]);

    const cols = [
        { wch: 7 },  // SL NO.
        { wch: 24 }, // NAME OF THE EMPLOYEES
        { wch: 15 }, // DEPARTMENT
        { wch: 18 }, // DESIGNATION
        { wch: 11 }, // NO OF DAYS WORK
        { wch: 11 }, // PRESENT DAY WORK
        { wch: 13 }, // FIXED SALARY
        { wch: 12 }, // PER DAY SALARY
        { wch: 15 }, // SALARY FOR THE MONTH
        { wch: 12 }, // BASIC
        { wch: 11 }, // DA
        { wch: 10 }, // HRA
        { wch: 12 }, // CONVEYANCE
        { wch: 14 }, // GROSS SALARY
        { wch: 15 }, // ARREARS & OT Driving
        { wch: 11 }, // ADVANCE
        { wch: 9 },  // PT
        { wch: 14 }, // NET SALARY
        { wch: 12 }, // Remark
        { wch: 9 },  // ESI
        { wch: 16 }, // TOTAL NET SALARY
    ];

    return { aoa, merges, cols, rowCount: rows.length };
}

/**
 * Exports the Monthly Salary Statement in Excel (.xlsx) for the selected mode:
 * - 'salary': Only Salaries
 * - 'ot': Only OT
 * - 'total': Total (Salary + OT)
 */
export function exportMonthlySalaryStatementExcel(
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

    const { aoa, merges, cols, rowCount } = buildMonthlyStatementAOA(
        savedSalaries,
        employees,
        month,
        year,
        companyName,
        mode
    );

    if (rowCount === 0) {
        alert(mode === 'ot' ? "No overtime-applicable employee records found for this period." : "No records found to export.");
        return;
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!merges'] = merges;
    ws['!cols'] = cols;

    const sheetLabel = mode === 'salary'
        ? "Salary Statement"
        : mode === 'ot'
        ? "OT Statement"
        : "Total Wage Statement";

    XLSX.utils.book_append_sheet(wb, ws, sheetLabel);

    const filePrefix = mode === 'salary'
        ? "Salary_Statement_Only_Salaries"
        : mode === 'ot'
        ? "Salary_Statement_Only_OT"
        : "Salary_Statement_Total";

    XLSX.writeFile(wb, `${filePrefix}_${month}_${year}.xlsx`);
}

/**
 * Generates and downloads an All-In-One Excel workbook with:
 * - Sheet 1: Master Summary of all generated employees in the 21-column Salary Statement format
 * - Sheets 2..N: One sheet per employee in the exact company format
 */
export function exportAllSalariesCompanyExcel(
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

    const wb = XLSX.utils.book_new();

    // 1. Build Master Summary Sheet (Sheet 1) in the 21-column Salary Statement format
    const summaryData = buildMonthlyStatementAOA(savedSalaries, employees, month, year, companyName, 'total');
    const summaryWs = XLSX.utils.aoa_to_sheet(summaryData.aoa);
    summaryWs['!merges'] = summaryData.merges;
    summaryWs['!cols'] = summaryData.cols;
    XLSX.utils.book_append_sheet(wb, summaryWs, "Salary Statement");

    // 2. Build one sheet for each employee
    const usedSheetNames = new Set<string>();

    savedSalaries.forEach((sal) => {
        const empId = typeof sal.employee === 'string' ? sal.employee : sal.employee?._id;
        const fullEmp = employees.find(e => e._id === empId) || sal.employee || {};

        const { aoa, merges, cols } = buildCompanyFormatAOA(sal, fullEmp, month, year, companyName);
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        ws['!merges'] = merges;
        ws['!cols'] = cols;

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
    companyName: string = ""
) {
    const wb = XLSX.utils.book_new();
    const { aoa, merges, cols } = buildCompanyFormatAOA(salary, employee, month, year, companyName);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!merges'] = merges;
    ws['!cols'] = cols;

    const sheetName = `${employee?.name || salary?.employee?.name || 'Employee'}`.substring(0, 31).replace(/[:\\/?*\[\]]/g, "_");
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    const empCode = employee?.employeeId || salary?.employee?.employeeId || '';
    const empName = employee?.name || salary?.employee?.name || 'Emp';
    const fileName = `Salary_Statement_${empCode}_${empName}_${month}_${year}.xlsx`;
    XLSX.writeFile(wb, fileName);
}

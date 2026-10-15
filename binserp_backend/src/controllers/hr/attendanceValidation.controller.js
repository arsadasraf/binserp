import {
  employeeSchema,
  attendanceSchema,
  holidaySchema,
  attendanceValidationSchema,
} from "../../models/hr/index.js";
import mongoose from "mongoose";

const getCompanyId = (req) => {
  if (req.company) return req.company._id;
  if (!req.user) throw new Error("User context missing in request");

  if (req.userType === "company") {
    return req.user.id;
  } else if (
    req.userType === "user" ||
    req.userType === "saasadmin" ||
    req.userType === "employee"
  ) {
    if (req.user.company && req.user.company._id) return req.user.company._id;
    if (req.user.company) return req.user.company;
  }

  throw new Error("Could not resolve company ID from request context");
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const computeOtHours = (hours, dayName, isHoliday, employee) => {
  if (!employee?.isOTApplicable) return 0;
  const standardHours = employee?.standardWorkingHours || 9;
  const weeklyOff = Array.isArray(employee?.weeklyOff)
    ? employee.weeklyOff
    : [employee?.weeklyOff || "Sunday"];
  const holidayWorkPolicy = employee?.holidayWorkPolicy || "Overtime";
  const weekOffWorkPolicy = employee?.weekOffWorkPolicy || "Overtime";

  const fullDay = DAYS_FULL.find(
    (d) => d.toLowerCase() === dayName.toLowerCase() || d.startsWith(dayName)
  ) || dayName;
  const isWeeklyOff = weeklyOff.includes(fullDay);

  if (isWeeklyOff) {
    return weekOffWorkPolicy === "Overtime" ? Number(hours.toFixed(2)) : 0;
  }
  if (isHoliday) {
    return holidayWorkPolicy === "Overtime" ? Number(hours.toFixed(2)) : 0;
  }
  return Math.max(0, Number((hours - standardHours).toFixed(2)));
};

/**
 * 1. GET /api/hr/attendance-validation/daily?date=YYYY-MM-DD
 * Lists all active employees with raw punches & validated records for the given date.
 */
export const getDailyAttendanceForValidation = async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const dateStr = req.query.date || new Date().toISOString().split("T")[0];

    const [yearStr, monthStr, dayStr] = dateStr.split("-");
    const year = parseInt(yearStr, 10);
    const monthIndex = parseInt(monthStr, 10) - 1;
    const day = parseInt(dayStr, 10);
    const monthName = MONTH_NAMES[monthIndex];

    const targetDate = new Date(year, monthIndex, day);
    const dayOfWeek = targetDate.getDay();
    const dayName = DAYS_SHORT[dayOfWeek];
    const fullDayName = DAYS_FULL[dayOfWeek];

    const startOfDay = new Date(year, monthIndex, day, 0, 0, 0, 0);
    const endOfDay = new Date(year, monthIndex, day, 23, 59, 59, 999);

    const Employee = req.getModel("Employee", employeeSchema);
    const Attendance = req.getModel("Attendance", attendanceSchema);
    const Holiday = req.getModel("Holiday", holidaySchema);
    const AttendanceValidation = req.getModel(
      "AttendanceValidation",
      attendanceValidationSchema
    );

    // 1. Fetch active employees
    const employees = await Employee.find({
      company: companyId,
      status: { $in: ["Active", "OnLeave"] },
      isActive: true,
    }).sort({ name: 1 });

    // 2. Fetch raw attendance records for this date
    const rawAttendanceRecords = await Attendance.find({
      company: companyId,
      date: { $gte: startOfDay, $lte: endOfDay },
    });
    const rawMap = new Map();
    rawAttendanceRecords.forEach((att) => {
      rawMap.set(att.employee.toString(), att);
    });

    // 3. Fetch public/company holidays on this date from Holiday Master
    const holidays = await Holiday.find({
      company: companyId,
      isActive: true,
      date: {
        $gte: new Date(year, monthIndex, day - 1, 0, 0, 0, 0),
        $lte: new Date(year, monthIndex, day + 1, 23, 59, 59, 999),
      },
    });

    const holidayRecord = holidays.find((h) => {
      const d = new Date(h.date);
      const utcStr = d.toISOString().split("T")[0];
      const localY = d.getFullYear();
      const localM = String(d.getMonth() + 1).padStart(2, "0");
      const localD = String(d.getDate()).padStart(2, "0");
      const localStr = `${localY}-${localM}-${localD}`;
      return utcStr === dateStr || localStr === dateStr;
    });

    // 4. Fetch already saved AttendanceValidation records for this date
    const savedValidations = await AttendanceValidation.find({
      company: companyId,
      date: dateStr,
    }).populate("validatedBy", "name username");
    const validationMap = new Map();
    savedValidations.forEach((val) => {
      validationMap.set(val.employee.toString(), val);
    });

    // 5. Merge per employee
    let validatedCount = 0;
    let pendingCount = 0;
    let presentCount = 0;
    let absentCount = 0;

    const items = employees.map((emp) => {
      const empIdStr = emp._id.toString();
      const raw = rawMap.get(empIdStr);
      const existingVal = validationMap.get(empIdStr);

      const weeklyOff = Array.isArray(emp.weeklyOff)
        ? emp.weeklyOff
        : [emp.weeklyOff || "Sunday"];
      const isWeeklyOff = weeklyOff.includes(fullDayName);
      const isHoliday = Boolean(holidayRecord);

      let record;

      if (existingVal) {
        validatedCount++;
        if (["Present", "HalfDay"].includes(existingVal.status)) presentCount++;
        else if (existingVal.status === "Absent") absentCount++;

        record = {
          employee: {
            _id: emp._id,
            employeeId: emp.employeeId,
            name: emp.name,
            department: emp.department,
            designation: emp.designation,
            employeeType: emp.employeeType,
            standardWorkingHours: emp.standardWorkingHours || 9,
            isOTApplicable: Boolean(emp.isOTApplicable),
            photo: emp.photo || null,
          },
          date: dateStr,
          day,
          dayName,
          fullDayName,
          isWeeklyOff,
          isHoliday,
          holidayName: holidayRecord?.name || null,
          rawAttendance: {
            id: raw?._id || existingVal.rawAttendance || null,
            checkIn: existingVal.rawPunches?.checkIn || raw?.checkIn?.time || null,
            checkOut: existingVal.rawPunches?.checkOut || raw?.checkOut?.time || null,
            status: existingVal.rawPunches?.status || raw?.status || null,
            hoursWorked: existingVal.rawPunches?.hoursWorked || raw?.hoursWorked || 0,
          },
          validated: {
            id: existingVal._id,
            status: existingVal.status,
            checkIn: existingVal.checkIn,
            checkOut: existingVal.checkOut,
            dutyHours: existingVal.dutyHours,
            otHours: existingVal.otHours,
            isOvertime: existingVal.isOvertime,
            remarks: existingVal.remarks || "",
            isValidated: true,
            validatedAt: existingVal.validatedAt,
            validatedBy: existingVal.validatedBy,
            validatedByUsername: existingVal.validatedByUsername || existingVal.validatedBy?.username || existingVal.validatedBy?.name || "Admin",
          },
          isValidated: true,
        };
      } else {
        pendingCount++;

        // Compute proposed defaults
        let defaultStatus = "Absent";
        let defaultDutyHours = 0;
        let defaultCheckIn = raw?.checkIn?.time || null;
        let defaultCheckOut = raw?.checkOut?.time || null;

        if (raw?.checkIn?.time) {
          defaultStatus = raw.status || "Present";
          defaultDutyHours = raw.hoursWorked || 0;
          if (defaultDutyHours === 0 && defaultCheckIn && defaultCheckOut) {
            const diffMs = new Date(defaultCheckOut) - new Date(defaultCheckIn);
            defaultDutyHours = Math.max(0, Number((diffMs / 3600000).toFixed(2)));
          }
          if (defaultDutyHours === 0) {
            defaultDutyHours = emp.standardWorkingHours || 9;
          }
        } else if (isHoliday) {
          defaultStatus = "Holiday";
          defaultDutyHours = 0;
        } else if (isWeeklyOff) {
          defaultStatus = "WeeklyOff";
          defaultDutyHours = 0;
        }

        if (["Present", "HalfDay"].includes(defaultStatus)) presentCount++;
        else if (defaultStatus === "Absent") absentCount++;

        const defaultOt = computeOtHours(defaultDutyHours, dayName, isHoliday, emp);

        record = {
          employee: {
            _id: emp._id,
            employeeId: emp.employeeId,
            name: emp.name,
            department: emp.department,
            designation: emp.designation,
            employeeType: emp.employeeType,
            standardWorkingHours: emp.standardWorkingHours || 9,
            isOTApplicable: Boolean(emp.isOTApplicable),
            photo: emp.photo || null,
          },
          date: dateStr,
          day,
          dayName,
          fullDayName,
          isWeeklyOff,
          isHoliday,
          holidayName: holidayRecord?.name || null,
          rawAttendance: {
            id: raw?._id || null,
            checkIn: raw?.checkIn?.time || null,
            checkOut: raw?.checkOut?.time || null,
            status: raw?.status || null,
            hoursWorked: raw?.hoursWorked || 0,
          },
          validated: {
            id: null,
            status: defaultStatus,
            checkIn: defaultCheckIn,
            checkOut: defaultCheckOut,
            dutyHours: defaultDutyHours,
            otHours: defaultOt,
            isOvertime: defaultOt > 0,
            remarks: "",
            isValidated: false,
            validatedAt: null,
            validatedBy: null,
            validatedByUsername: null,
          },
          isValidated: false,
        };
      }

      return record;
    });

    return res.status(200).json({
      success: true,
      date: dateStr,
      day,
      dayName,
      fullDayName,
      month: monthName,
      year,
      summary: {
        totalEmployees: employees.length,
        validatedCount,
        pendingCount,
        presentCount,
        absentCount,
        isHoliday: Boolean(holidayRecord),
        holidayName: holidayRecord?.name || null,
        holidayType: holidayRecord?.type || null,
      },
      items,
    });
  } catch (error) {
    console.error("Error in getDailyAttendanceForValidation:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch daily attendance validation.",
    });
  }
};

/**
 * 2. POST /api/hr/attendance-validation/daily
 * Bulk-saves validated attendance records for one or multiple employees for a specific date.
 */
export const saveDailyAttendanceValidation = async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const { date, validations } = req.body;

    if (!date || !Array.isArray(validations) || validations.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Date and a non-empty array of validations are required.",
      });
    }

    const [yearStr, monthStr, dayStr] = date.split("-");
    const year = parseInt(yearStr, 10);
    const monthIndex = parseInt(monthStr, 10) - 1;
    const day = parseInt(dayStr, 10);
    const monthName = MONTH_NAMES[monthIndex];

    const targetDate = new Date(year, monthIndex, day);
    const dayName = DAYS_SHORT[targetDate.getDay()];

    const AttendanceValidation = req.getModel(
      "AttendanceValidation",
      attendanceValidationSchema
    );

    const currentUsername =
      req.user?.username ||
      req.user?.name ||
      req.user?.companyName ||
      (req.userType === "company" ? "Company Admin" : "Admin");

    const bulkOps = validations.map((val) => {
      const dutyHours = Number(val.dutyHours) || 0;
      const otHours = Number(val.otHours) || 0;

      return {
        updateOne: {
          filter: {
            company: companyId,
            employee: val.employeeId,
            date,
          },
          update: {
            $set: {
              company: companyId,
              employee: val.employeeId,
              date,
              year,
              month: monthName,
              monthIndex,
              day,
              dayName,
              rawAttendance: val.rawAttendanceId || null,
              rawPunches: {
                checkIn: val.rawCheckIn ? new Date(val.rawCheckIn) : null,
                checkOut: val.rawCheckOut ? new Date(val.rawCheckOut) : null,
                status: val.rawStatus || null,
                hoursWorked: Number(val.rawHoursWorked) || 0,
              },
              status: val.status || "Present",
              checkIn: val.checkIn ? new Date(val.checkIn) : null,
              checkOut: val.checkOut ? new Date(val.checkOut) : null,
              dutyHours,
              otHours,
              isOvertime: otHours > 0,
              remarks: val.remarks || "",
              isValidated: true,
              validatedBy: req.user?._id || null,
              validatedByUsername: currentUsername,
              validatedAt: new Date(),
            },
          },
          upsert: true,
        },
      };
    });

    const result = await AttendanceValidation.bulkWrite(bulkOps);

    return res.status(200).json({
      success: true,
      message: `Successfully validated and saved ${validations.length} employee attendance records for ${date}.`,
      upsertedCount: result.upsertedCount,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Error in saveDailyAttendanceValidation:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to save daily attendance validations.",
    });
  }
};

/**
 * 3. GET /api/hr/attendance-validation/monthly?employeeId=...&month=...&year=...
 * Generates the complete 1..31 working day preview for an employee with raw vs validated logs.
 */
export const getMonthlyAttendanceForValidation = async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const { employeeId, month, year } = req.query;

    if (!employeeId || !month || !year) {
      return res.status(400).json({
        success: false,
        message: "employeeId, month, and year are required query parameters.",
      });
    }

    const Employee = req.getModel("Employee", employeeSchema);
    const Attendance = req.getModel("Attendance", attendanceSchema);
    const Holiday = req.getModel("Holiday", holidaySchema);
    const AttendanceValidation = req.getModel(
      "AttendanceValidation",
      attendanceValidationSchema
    );

    const employee = await Employee.findOne({
      _id: employeeId,
      company: companyId,
    });
    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee not found." });
    }

    const monthIndex = MONTH_NAMES.findIndex(
      (m) => m.toLowerCase() === month.toLowerCase()
    );
    if (monthIndex === -1) {
      return res.status(400).json({ success: false, message: "Invalid month name." });
    }

    const numYear = parseInt(year, 10);
    const daysInMonth = new Date(numYear, monthIndex + 1, 0).getDate();

    const startOfMonth = new Date(numYear, monthIndex, 1, 0, 0, 0, 0);
    const endOfMonth = new Date(numYear, monthIndex, daysInMonth, 23, 59, 59, 999);

    // 1. Fetch raw punches for this employee in this month
    const rawPunches = await Attendance.find({
      company: companyId,
      employee: employeeId,
      date: { $gte: startOfMonth, $lte: endOfMonth },
    });
    const rawMap = new Map();
    rawPunches.forEach((p) => {
      const d = new Date(p.date);
      const dayNum = d.getDate();
      rawMap.set(dayNum, p);
    });

    // 2. Fetch holidays from Holiday Master (buffer boundaries to prevent UTC offset shifts)
    const holidays = await Holiday.find({
      company: companyId,
      isActive: true,
      date: {
        $gte: new Date(numYear, monthIndex, 0, 0, 0, 0),
        $lte: new Date(numYear, monthIndex + 1, 1, 23, 59, 59, 999),
      },
    });
    const holidayMap = new Map();
    holidays.forEach((h) => {
      const d = new Date(h.date);
      if (d.getUTCFullYear() === numYear && d.getUTCMonth() === monthIndex) {
        holidayMap.set(d.getUTCDate(), h);
      }
      if (d.getFullYear() === numYear && d.getMonth() === monthIndex) {
        holidayMap.set(d.getDate(), h);
      }
    });

    // 3. Fetch already saved AttendanceValidation records for this employee & month
    const savedValidations = await AttendanceValidation.find({
      company: companyId,
      employee: employeeId,
      year: numYear,
      monthIndex,
    }).populate("validatedBy", "name username");
    const valMap = new Map();
    savedValidations.forEach((v) => {
      valMap.set(v.day, v);
    });

    const weeklyOff = Array.isArray(employee.weeklyOff)
      ? employee.weeklyOff
      : [employee.weeklyOff || "Sunday"];

    let totalDutyHours = 0;
    let totalOtHours = 0;
    let workedDays = 0;
    let payableDays = 0;
    let absentDays = 0;
    let weeklyOffCount = 0;
    let holidayCount = 0;
    let validatedDaysCount = 0;

    const days = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(numYear, monthIndex, day);
      const dayOfWeek = d.getDay();
      const dayName = DAYS_SHORT[dayOfWeek];
      const fullDayName = DAYS_FULL[dayOfWeek];
      const isWeeklyOff = weeklyOff.includes(fullDayName);
      const holiday = holidayMap.get(day);
      const isHoliday = Boolean(holiday);

      const yyyy = numYear;
      const mm = String(monthIndex + 1).padStart(2, "0");
      const dd = String(day).padStart(2, "0");
      const dateStr = `${yyyy}-${mm}-${dd}`;

      const raw = rawMap.get(day);
      const existingVal = valMap.get(day);

      if (existingVal) {
        validatedDaysCount++;
        totalDutyHours += existingVal.dutyHours || 0;
        totalOtHours += existingVal.otHours || 0;

        if (["Present", "HalfDay"].includes(existingVal.status)) {
          workedDays += existingVal.status === "HalfDay" ? 0.5 : 1;
          payableDays += existingVal.status === "HalfDay" ? 0.5 : 1;
        } else if (["WeeklyOff", "Holiday", "CL", "SL", "CompOff", "OnDuty"].includes(existingVal.status)) {
          payableDays += 1;
        } else if (existingVal.status === "Absent") {
          absentDays += 1;
        }

        if (existingVal.status === "WeeklyOff") weeklyOffCount++;
        if (existingVal.status === "Holiday") holidayCount++;

        days.push({
          date: dateStr,
          day,
          dayName,
          fullDayName,
          isWeeklyOff,
          isHoliday,
          holidayName: holiday?.name || null,
          rawAttendance: {
            id: raw?._id || existingVal.rawAttendance || null,
            checkIn: existingVal.rawPunches?.checkIn || raw?.checkIn?.time || null,
            checkOut: existingVal.rawPunches?.checkOut || raw?.checkOut?.time || null,
            status: existingVal.rawPunches?.status || raw?.status || null,
            hoursWorked: existingVal.rawPunches?.hoursWorked || raw?.hoursWorked || 0,
          },
          status: existingVal.status,
          checkIn: existingVal.checkIn,
          checkOut: existingVal.checkOut,
          dutyHours: existingVal.dutyHours,
          otHours: existingVal.otHours,
          isOvertime: existingVal.isOvertime,
          remarks: existingVal.remarks || "",
          isValidated: true,
          validatedAt: existingVal.validatedAt,
          validatedBy: existingVal.validatedBy,
          validatedByUsername: existingVal.validatedByUsername || existingVal.validatedBy?.username || existingVal.validatedBy?.name || "Admin",
        });
      } else {
        // Proposed default
        let defaultStatus = "Absent";
        let defaultDutyHours = 0;
        let defaultCheckIn = raw?.checkIn?.time || null;
        let defaultCheckOut = raw?.checkOut?.time || null;

        if (raw?.checkIn?.time) {
          defaultStatus = raw.status || "Present";
          defaultDutyHours = raw.hoursWorked || 0;
          if (defaultDutyHours === 0 && defaultCheckIn && defaultCheckOut) {
            const diffMs = new Date(defaultCheckOut) - new Date(defaultCheckIn);
            defaultDutyHours = Math.max(0, Number((diffMs / 3600000).toFixed(2)));
          }
          if (defaultDutyHours === 0) {
            defaultDutyHours = employee.standardWorkingHours || 9;
          }
        } else if (isHoliday) {
          defaultStatus = "Holiday";
          holidayCount++;
          payableDays += 1;
        } else if (isWeeklyOff) {
          defaultStatus = "WeeklyOff";
          weeklyOffCount++;
          payableDays += 1;
        } else {
          absentDays += 1;
        }

        if (["Present", "HalfDay"].includes(defaultStatus)) {
          workedDays += defaultStatus === "HalfDay" ? 0.5 : 1;
          payableDays += defaultStatus === "HalfDay" ? 0.5 : 1;
        }

        const defaultOt = computeOtHours(defaultDutyHours, dayName, isHoliday, employee);
        totalDutyHours += defaultDutyHours;
        totalOtHours += defaultOt;

        days.push({
          date: dateStr,
          day,
          dayName,
          fullDayName,
          isWeeklyOff,
          isHoliday,
          holidayName: holiday?.name || null,
          rawAttendance: {
            id: raw?._id || null,
            checkIn: raw?.checkIn?.time || null,
            checkOut: raw?.checkOut?.time || null,
            status: raw?.status || null,
            hoursWorked: raw?.hoursWorked || 0,
          },
          status: defaultStatus,
          checkIn: defaultCheckIn,
          checkOut: defaultCheckOut,
          dutyHours: defaultDutyHours,
          otHours: defaultOt,
          isOvertime: defaultOt > 0,
          remarks: "",
          isValidated: false,
          validatedAt: null,
        });
      }
    }

    const isFullyValidated = validatedDaysCount === daysInMonth;

    return res.status(200).json({
      success: true,
      employee: {
        _id: employee._id,
        employeeId: employee.employeeId,
        name: employee.name,
        department: employee.department,
        designation: employee.designation,
        employeeType: employee.employeeType,
        standardWorkingHours: employee.standardWorkingHours || 9,
        isOTApplicable: Boolean(employee.isOTApplicable),
        leaves: employee.leaves || { casualLeave: 0, sickLeave: 0 },
        compOffBalance: employee.compOffBalance || 0,
        photo: employee.photo || null,
      },
      month,
      year: numYear,
      summary: {
        totalMonthDays: daysInMonth,
        validatedDaysCount,
        pendingDaysCount: daysInMonth - validatedDaysCount,
        isFullyValidated,
        workedDays,
        payableDays,
        absentDays,
        weeklyOffCount,
        holidayCount,
        totalDutyHours: Number(totalDutyHours.toFixed(2)),
        totalOtHours: Number(totalOtHours.toFixed(2)),
      },
      days,
    });
  } catch (error) {
    console.error("Error in getMonthlyAttendanceForValidation:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch monthly attendance validation.",
    });
  }
};

/**
 * 4. POST /api/hr/attendance-validation/monthly
 * Saves/updates all daily validation records for an employee for a specific month.
 */
export const saveMonthlyAttendanceValidation = async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const { employeeId, month, year, days } = req.body;

    if (!employeeId || !month || !year || !Array.isArray(days) || days.length === 0) {
      return res.status(400).json({
        success: false,
        message: "employeeId, month, year, and days array are required.",
      });
    }

    const monthIndex = MONTH_NAMES.findIndex(
      (m) => m.toLowerCase() === month.toLowerCase()
    );
    if (monthIndex === -1) {
      return res.status(400).json({ success: false, message: "Invalid month name." });
    }

    const numYear = parseInt(year, 10);
    const AttendanceValidation = req.getModel(
      "AttendanceValidation",
      attendanceValidationSchema
    );

    const currentUsername =
      req.user?.username ||
      req.user?.name ||
      req.user?.companyName ||
      (req.userType === "company" ? "Company Admin" : "Admin");

    const bulkOps = days.map((d) => {
      const dutyHours = Number(d.dutyHours) || 0;
      const otHours = Number(d.otHours) || 0;

      return {
        updateOne: {
          filter: {
            company: companyId,
            employee: employeeId,
            date: d.date,
          },
          update: {
            $set: {
              company: companyId,
              employee: employeeId,
              date: d.date,
              year: numYear,
              month,
              monthIndex,
              day: d.day,
              dayName: d.dayName,
              rawAttendance: d.rawAttendance?.id || null,
              rawPunches: {
                checkIn: d.rawAttendance?.checkIn ? new Date(d.rawAttendance.checkIn) : null,
                checkOut: d.rawAttendance?.checkOut ? new Date(d.rawAttendance.checkOut) : null,
                status: d.rawAttendance?.status || null,
                hoursWorked: Number(d.rawAttendance?.hoursWorked) || 0,
              },
              status: d.status || "Present",
              checkIn: d.checkIn ? new Date(d.checkIn) : null,
              checkOut: d.checkOut ? new Date(d.checkOut) : null,
              dutyHours,
              otHours,
              isOvertime: otHours > 0,
              remarks: d.remarks || "",
              isValidated: true,
              validatedBy: req.user?._id || null,
              validatedByUsername: currentUsername,
              validatedAt: new Date(),
            },
          },
          upsert: true,
        },
      };
    });

    const result = await AttendanceValidation.bulkWrite(bulkOps);

    return res.status(200).json({
      success: true,
      message: `Successfully validated ${days.length} days for ${month} ${year}.`,
      upsertedCount: result.upsertedCount,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Error in saveMonthlyAttendanceValidation:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to save monthly attendance validation.",
    });
  }
};

/**
 * 5. GET /api/hr/attendance-validation/month-summary?month=...&year=...
 * Returns validation stats for all active employees for the month.
 * Used by the Salary Generator to show validation status pills and enforce Strict Mode.
 */
export const getMonthlyValidationSummary = async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const { month, year } = req.query;

    if (!month || !year) {
      return res.status(400).json({
        success: false,
        message: "month and year are required query parameters.",
      });
    }

    const monthIndex = MONTH_NAMES.findIndex(
      (m) => m.toLowerCase() === month.toLowerCase()
    );
    if (monthIndex === -1) {
      return res.status(400).json({ success: false, message: "Invalid month name." });
    }

    const numYear = parseInt(year, 10);
    const daysInMonth = new Date(numYear, monthIndex + 1, 0).getDate();

    const Employee = req.getModel("Employee", employeeSchema);
    const AttendanceValidation = req.getModel(
      "AttendanceValidation",
      attendanceValidationSchema
    );

    const employees = await Employee.find({
      company: companyId,
      status: { $in: ["Active", "OnLeave"] },
      isActive: true,
    }).sort({ name: 1 });

    const validations = await AttendanceValidation.find({
      company: companyId,
      year: numYear,
      monthIndex,
    });

    // Group validations by employee
    const valByEmp = new Map();
    validations.forEach((v) => {
      const empIdStr = v.employee.toString();
      if (!valByEmp.has(empIdStr)) {
        valByEmp.set(empIdStr, []);
      }
      valByEmp.get(empIdStr).push(v);
    });

    const summaries = employees.map((emp) => {
      const empIdStr = emp._id.toString();
      const empVals = valByEmp.get(empIdStr) || [];
      const validatedDays = empVals.length;
      const pendingDays = Math.max(0, daysInMonth - validatedDays);
      const isFullyValidated = validatedDays >= daysInMonth;

      let payableDays = 0;
      let workedDays = 0;
      let absentDays = 0;
      let totalDutyHours = 0;
      let totalOtHours = 0;

      empVals.forEach((v) => {
        totalDutyHours += v.dutyHours || 0;
        totalOtHours += v.otHours || 0;
        if (["Present", "HalfDay"].includes(v.status)) {
          workedDays += v.status === "HalfDay" ? 0.5 : 1;
          payableDays += v.status === "HalfDay" ? 0.5 : 1;
        } else if (["WeeklyOff", "Holiday", "CL", "SL", "CompOff", "OnDuty"].includes(v.status)) {
          payableDays += 1;
        } else if (v.status === "Absent") {
          absentDays += 1;
        }
      });

      return {
        employeeId: emp._id,
        employeeCode: emp.employeeId,
        name: emp.name,
        department: emp.department,
        designation: emp.designation,
        employeeType: emp.employeeType,
        totalMonthDays: daysInMonth,
        validatedDays,
        pendingDays,
        isFullyValidated,
        workedDays,
        payableDays,
        absentDays,
        totalDutyHours: Number(totalDutyHours.toFixed(2)),
        totalOtHours: Number(totalOtHours.toFixed(2)),
        validatedLogs: empVals,
      };
    });

    const fullyValidatedCount = summaries.filter((s) => s.isFullyValidated).length;

    return res.status(200).json({
      success: true,
      month,
      year: numYear,
      daysInMonth,
      totalEmployees: employees.length,
      fullyValidatedCount,
      pendingValidationCount: employees.length - fullyValidatedCount,
      summaries,
    });
  } catch (error) {
    console.error("Error in getMonthlyValidationSummary:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch monthly validation summary.",
    });
  }
};

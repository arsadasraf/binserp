import { salarySchema, employeeSchema, attendanceSchema, holidaySchema } from "../../models/hr/index.js";

// Same helper as hr.controller.js - resolves company _id from JWT user context
const getCompanyId = (req) => {
    if (!req.user) throw new Error("User context missing in request");
    if (req.userType === "company") return req.user.id;
    if (req.userType === "user" || req.userType === "saasadmin" || req.userType === "employee") {
        if (req.user.company && req.user.company._id) return req.user.company._id;
        if (req.user.company) return req.user.company;
    }
    throw new Error("Could not resolve company ID from request context");
};

const getDayOfWeek = (date) => {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return days[date.getDay()];
};

export const getSalaryGenerationStats = async (req, res) => {
    try {
        const companyId = getCompanyId(req);
        const { employeeId, month, year } = req.query;
        
        const Employee = req.getModel('Employee', employeeSchema);
        const Attendance = req.getModel('Attendance', attendanceSchema);
        const Holiday = req.getModel('Holiday', holidaySchema);

        if (!employeeId || !month || !year) {
            return res.status(400).json({ message: "Missing required params" });
        }

        const employee = await Employee.findOne({ _id: employeeId, company: companyId });
        if (!employee) return res.status(404).json({ message: "Employee not found" });

        const standardHours = employee.standardWorkingHours || 9;
        const weeklyOff = employee.weeklyOff || "Sunday";
        const holidayWorkPolicy = employee.holidayWorkPolicy || "Overtime";
        const weekOffWorkPolicy = employee.weekOffWorkPolicy || "Overtime";

        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const monthIndex = monthNames.findIndex(m => m.toLowerCase() === month.toLowerCase());
        if (monthIndex === -1) return res.status(400).json({ message: "Invalid month name" });

        const startDate = new Date(year, monthIndex, 1);
        const endDate = new Date(year, monthIndex + 1, 0);
        const totalDaysInMonth = endDate.getDate();

        // Get holidays for the month
        const holidays = await Holiday.find({
            company: companyId,
            isActive: true,
            date: { $gte: startDate, $lte: endDate }
        });
        const holidayDates = holidays.map(h => h.date.toISOString().split('T')[0]);

        const attendanceRecords = await Attendance.find({
            company: companyId,
            employee: employeeId,
            date: { $gte: startDate, $lte: endDate }
        });
        
        const attendanceMap = {};
        attendanceRecords.forEach(r => {
            attendanceMap[r.date.toISOString().split('T')[0]] = r;
        });

        let presentDays = 0;
        let totalOvertimeHours = 0;
        let compOffAccrued = 0;
        let weeklyOffsCount = 0;
        let holidaysCount = 0;
        const dailyStats = {};

        for (let day = 1; day <= totalDaysInMonth; day++) {
            const currentDate = new Date(year, monthIndex, day);
            const dateStr = currentDate.toISOString().split('T')[0];
            const isWeeklyOff = getDayOfWeek(currentDate) === weeklyOff;
            const isHoliday = holidayDates.includes(dateStr);
            const record = attendanceMap[dateStr];
            
            const hoursWorked = record ? record.hoursWorked : 0;
            
            dailyStats[dateStr] = {
                status: record ? record.status : (isWeeklyOff ? 'WeekOff' : (isHoliday ? 'Holiday' : 'Absent')),
                hoursWorked: hoursWorked,
                checkIn: record?.checkIn?.time,
                checkOut: record?.checkOut?.time,
                isWeeklyOff,
                isHoliday
            };

            if (isWeeklyOff) {
                weeklyOffsCount++;
                if (hoursWorked > 0) {
                    if (weekOffWorkPolicy === "Overtime") totalOvertimeHours += hoursWorked;
                    else compOffAccrued += (hoursWorked / standardHours);
                }
            } else if (isHoliday) {
                holidaysCount++;
                presentDays += 1; // Holidays are paid
                if (hoursWorked > 0) {
                    if (holidayWorkPolicy === "Overtime") totalOvertimeHours += hoursWorked;
                    else compOffAccrued += (hoursWorked / standardHours);
                }
            } else {
                // Regular Day
                if (record) {
                    if (record.status === "Present") presentDays += 1;
                    else if (record.status === "HalfDay") presentDays += 0.5;
                    
                    if (hoursWorked > standardHours) {
                        totalOvertimeHours += (hoursWorked - standardHours);
                    }
                }
            }
        }

        const effectiveWorkingDays = totalDaysInMonth - weeklyOffsCount;
        const absentDays = effectiveWorkingDays - presentDays;

        res.status(200).json({
            presentDays,
            absentDays: Math.max(0, absentDays),
            totalDays: totalDaysInMonth,
            effectiveWorkingDays,
            weeklyOffsCount,
            holidaysCount,
            totalOvertimeHours: Math.round(totalOvertimeHours * 100) / 100,
            compOffAccrued: Math.round(compOffAccrued * 100) / 100,
            dailyStats
        });

    } catch (error) {
        console.error("Error fetching salary stats:", error);
        res.status(500).json({ message: "Error fetching stats" });
    }
};

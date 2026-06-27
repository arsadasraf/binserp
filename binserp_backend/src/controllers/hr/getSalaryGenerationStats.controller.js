import { salarySchema, employeeSchema, attendanceSchema } from "../../models/hr/index.js";

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

// Create Salary Slip (Save from frontend with manual logs)

export const getSalaryGenerationStats = async (req, res) => {
    try {
        const companyId = getCompanyId(req);
        const { employeeId, month, year } = req.query;
        const Attendance = req.getModel('Attendance', attendanceSchema);

        if (!employeeId || !month || !year) {
            return res.status(400).json({ message: "Missing required params" });
        }

        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const monthIndex = monthNames.findIndex(m => m.toLowerCase() === month.toLowerCase());
        if (monthIndex === -1) return res.status(400).json({ message: "Invalid month name" });

        const startDate = new Date(year, monthIndex, 1);
        const endDate = new Date(year, monthIndex + 1, 0);

        const attendanceRecords = await Attendance.find({
            company: companyId,
            employee: employeeId,
            date: { $gte: startDate, $lte: endDate }
        }).sort({ date: 1 });

        let presentDays = 0;
        let totalOvertimeHours = 0;
        const dailyStats = {};
        const formatDate = (d) => d.toISOString().split('T')[0];
        const STANDARD_HOURS = 9;

        attendanceRecords.forEach(record => {
            if (record.status === "Present") presentDays += 1;
            else if (record.status === "HalfDay") presentDays += 0.5;
            if (record.hoursWorked > STANDARD_HOURS) {
                totalOvertimeHours += (record.hoursWorked - STANDARD_HOURS);
            }
            dailyStats[formatDate(record.date)] = {
                status: record.status,
                hoursWorked: record.hoursWorked,
                checkIn: record.checkIn?.time,
                checkOut: record.checkOut?.time
            };
        });

        totalOvertimeHours = Math.round(totalOvertimeHours * 100) / 100;
        const totalDaysInMonth = new Date(year, monthIndex + 1, 0).getDate();
        const absentDays = totalDaysInMonth - presentDays;

        res.status(200).json({
            presentDays,
            absentDays: Math.max(0, absentDays),
            totalDays: totalDaysInMonth,
            totalOvertimeHours,
            dailyStats
        });

    } catch (error) {
        console.error("Error fetching salary stats:", error);
        res.status(500).json({ message: "Error fetching stats" });
    }
};

// Get Salaries (with filters)

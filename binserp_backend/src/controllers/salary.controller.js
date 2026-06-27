import { salarySchema, employeeSchema, attendanceSchema } from "../models/hr/index.js";

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
export const createSalarySlip = async (req, res) => {
    try {
        const companyId = getCompanyId(req);
        const {
            employeeId, month, year, presentDays, totalDutyHours,
            totalOtHours, otRatePH, grossPay, otPay, netPay, dailyLogs
        } = req.body;

        const Employee = req.getModel('Employee', employeeSchema);
        const Salary = req.getModel('Salary', salarySchema);

        const employee = await Employee.findOne({ _id: employeeId, company: companyId });
        if (!employee) {
            return res.status(404).json({ message: "Employee not found" });
        }

        const existing = await Salary.findOne({ company: companyId, employee: employeeId, month, year });
        if (existing) {
            return res.status(400).json({ message: "Salary record already exists for this month. Please update it instead." });
        }

        const newSalary = new Salary({
            company: companyId,
            employee: employeeId,
            month,
            year,
            workingDays: 30,
            presentDays: presentDays || 0,
            totalDutyHours: totalDutyHours || 0,
            otRatePH: otRatePH || 0,
            salaryComponents: {
                basic: employee.salary?.basic || 0,
                hra: employee.salary?.hra || 0,
                conveyance: employee.salary?.conveyance || 0,
                medical: employee.salary?.medical || 0,
                specialAllowance: employee.salary?.specialAllowance || 0,
                pf: employee.salary?.pf || 0,
                professionalTax: employee.salary?.professionalTax || 0
            },
            overtime: {
                hours: totalOtHours || 0,
                rate: otRatePH || 0,
                amount: otPay || 0
            },
            grossSalary: grossPay || 0,
            netSalary: netPay || 0,
            dailyLogs: dailyLogs || [],
            status: "Draft",
            remarks: `Manually saved for ${presentDays} present days.`
        });

        await newSalary.save();
        res.status(201).json(newSalary);

    } catch (error) {
        console.error("Error generating salary:", error);
        res.status(500).json({ message: "Server error generating salary" });
    }
};

// Get salary generation stats
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
export const getSalaries = async (req, res) => {
    try {
        const companyId = getCompanyId(req);
        const { month, year, employeeId } = req.query;
        const Salary = req.getModel('Salary', salarySchema);

        let query = { company: companyId };
        if (month) query.month = month;
        if (year) query.year = Number(year);
        if (employeeId) query.employee = employeeId;

        const salaries = await Salary.find(query)
            .populate('employee', 'name employeeId department designation paymentDetails')
            .sort({ createdAt: -1 });

        res.status(200).json(salaries);
    } catch (error) {
        console.error("Error fetching salaries:", error);
        res.status(500).json({ message: "Error fetching salaries" });
    }
};

// Update Salary (edit logs, mark Paid, recalculate)
export const updateSalary = async (req, res) => {
    try {
        const { id } = req.params;
        const companyId = getCompanyId(req);
        const Salary = req.getModel('Salary', salarySchema);

        const updates = { ...req.body };

        if (req.body.totalOtHours !== undefined) {
            updates.overtime = {
                hours: req.body.totalOtHours || 0,
                rate: req.body.otRatePH || 0,
                amount: req.body.otPay || 0
            };
        }
        if (req.body.grossPay !== undefined) updates.grossSalary = req.body.grossPay;
        if (req.body.netPay !== undefined) updates.netSalary = req.body.netPay;

        if (updates.status === 'Paid' && !updates.paymentDate) {
            updates.paymentDate = new Date();
        }

        const salary = await Salary.findOneAndUpdate(
            { _id: id, company: companyId },
            updates,
            { new: true }
        );

        if (!salary) return res.status(404).json({ message: "Salary record not found" });
        res.status(200).json(salary);
    } catch (error) {
        console.error("Error updating salary:", error);
        res.status(500).json({ message: "Error updating salary" });
    }
};

// Delete Salary
export const deleteSalary = async (req, res) => {
    try {
        const { id } = req.params;
        const companyId = getCompanyId(req);
        const Salary = req.getModel('Salary', salarySchema);
        const salary = await Salary.findOneAndDelete({ _id: id, company: companyId });

        if (!salary) return res.status(404).json({ message: "Salary record not found" });
        res.status(200).json({ message: "Salary record deleted" });
    } catch (error) {
        console.error("Error deleting salary:", error);
        res.status(500).json({ message: "Error deleting salary" });
    }
};

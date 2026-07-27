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

export const createSalarySlip = async (req, res) => {
    try {
        const companyId = getCompanyId(req);
        const {
            employeeId, month, year, presentDays, totalDutyHours,
            totalOtHours, otRatePH, grossPay, otPay, netPay, dailyLogs, leavesConsumed,
            generationType, compOffAccrued
        } = req.body;

        const Employee = req.getModel('Employee', employeeSchema);
        const Salary = req.getModel('Salary', salarySchema);

        const employee = await Employee.findOne({ _id: employeeId, company: companyId });
        if (!employee) {
            return res.status(404).json({ message: "Employee not found" });
        }

        const recordType = generationType || "Combined";

        const existing = await Salary.findOne({ company: companyId, employee: employeeId, month, year });
        if (existing) {
            return res.status(400).json({ message: `A salary record already exists for this month. Please update it instead.` });
        }

        const newSalary = new Salary({
            company: companyId,
            employee: employeeId,
            month,
            year,
            workingDays: 30, // Could be derived dynamically
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
            leavesConsumed: leavesConsumed || { casualLeave: 0, sickLeave: 0, compOff: 0 },
            compOffAccrued: compOffAccrued || 0,
            status: "Draft",
            recordType: "Combined",
            remarks: `Manually saved for ${presentDays} present days.`,
            generatedBy: req.user._id,
            updatedBy: req.user._id
        });

        await newSalary.save();

        // Update employee leaves and history and comp off
        let employeeUpdated = false;
        
        if (compOffAccrued && compOffAccrued > 0) {
            employee.compOffBalance = (employee.compOffBalance || 0) + compOffAccrued;
            employeeUpdated = true;
        }

        if (leavesConsumed && (leavesConsumed.casualLeave > 0 || leavesConsumed.sickLeave > 0 || leavesConsumed.compOff > 0)) {
            if (employee.leaves) {
                employee.leaves.casualLeave = Math.max(0, employee.leaves.casualLeave - (leavesConsumed.casualLeave || 0));
                employee.leaves.sickLeave = Math.max(0, employee.leaves.sickLeave - (leavesConsumed.sickLeave || 0));
            }
            if (leavesConsumed.compOff > 0) {
                employee.compOffBalance = Math.max(0, (employee.compOffBalance || 0) - leavesConsumed.compOff);
            }
            employeeUpdated = true;
        }
            
        // Build history
        if (dailyLogs && Array.isArray(dailyLogs)) {
            const standardHours = employee.standardWorkingHours || 9;
            const weeklyOff = employee.weeklyOff || "Sunday";
            const weekOffWorkPolicy = employee.weekOffWorkPolicy || "Overtime";
            const holidayWorkPolicy = employee.holidayWorkPolicy || "Overtime";

            dailyLogs.forEach(log => {
                const dateObj = new Date(log.date);
                const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
                const isWeeklyOff = days[dateObj.getDay()] === weeklyOff;
                const isPublicHoliday = log.originalStatus === 'Holiday';

                const status = log.useManual ? log.manualStatus : log.originalStatus;
                const hours = log.useManual ? log.manualHours : (log.originalHours || 0);

                if (log.useManual && (log.manualStatus === 'CL' || log.manualStatus === 'SL' || log.manualStatus === 'CO')) {
                    employee.leaveHistory.push({
                        date: log.date,
                        type: log.manualStatus,
                        month: month,
                        year: Number(year)
                    });
                }
                
                if (status === 'CO') {
                    employee.compOffHistory.push({
                        date: log.date,
                        transactionType: 'Consumed',
                        amount: 1,
                        month: month,
                        year: Number(year)
                    });
                }

                if (isWeeklyOff && hours > 0 && weekOffWorkPolicy === "CompOff") {
                    employee.compOffHistory.push({
                        date: log.date,
                        transactionType: 'Earned',
                        amount: hours / standardHours,
                        month: month,
                        year: Number(year)
                    });
                } else if (isPublicHoliday && hours > 0 && holidayWorkPolicy === "CompOff") {
                    employee.compOffHistory.push({
                        date: log.date,
                        transactionType: 'Earned',
                        amount: hours / standardHours,
                        month: month,
                        year: Number(year)
                    });
                }
            });
            employeeUpdated = true;
        }

        if (employeeUpdated) {
            await Employee.updateOne(
                { _id: employee._id },
                { 
                    $set: { 
                        compOffBalance: employee.compOffBalance,
                        leaves: employee.leaves,
                        leaveHistory: employee.leaveHistory,
                        compOffHistory: employee.compOffHistory
                    } 
                }
            );
        }

        res.status(201).json(newSalary);

    } catch (error) {
        console.error("Error generating salary:", error);
        res.status(500).json({ message: `Server error generating salary: ${error.message}` });
    }
};

// Get salary generation stats

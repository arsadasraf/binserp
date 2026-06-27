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

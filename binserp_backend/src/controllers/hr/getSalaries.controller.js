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

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

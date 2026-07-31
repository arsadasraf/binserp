import { employeeMovementSchema } from "../../models/hr/index.js";

// Helper to get company from request
const getCompanyId = (req) => {
    if (req.userType === "company") return req.user._id;
    return req.user.company?._id || req.user.company;
};

export const createEmployeeOut = async (req, res) => {
    try {
        const { employee, reason, notes, approvedBy } = req.body;
        const companyId = getCompanyId(req);
        const EmployeeMovement = req.getModel('EmployeeMovement', employeeMovementSchema);

        if (!employee || !reason) {
            return res.status(400).json({ message: "Employee and Reason are required" });
        }

        // Check if employee is already outside
        const existingOut = await EmployeeMovement.findOne({ employee, status: "Outside", company: companyId });
        if (existingOut) {
            return res.status(400).json({ message: "Employee is already marked as outside" });
        }

        const movement = new EmployeeMovement({
            company: companyId,
            employee,
            reason,
            notes,
            approvedBy,
            createdBy: req.user._id,
            status: "Outside"
        });

        await movement.save();

        res.status(201).json({ message: "Employee exit recorded successfully", movement });
    } catch (error) {
        console.error("Error recording employee exit:", error);
        res.status(500).json({ message: "Server error recording employee exit" });
    }
};

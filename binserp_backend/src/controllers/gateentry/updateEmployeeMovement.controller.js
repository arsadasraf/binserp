import { employeeMovementSchema } from "../../models/hr/index.js";

// Helper to get company from request
const getCompanyId = (req) => {
    if (req.userType === "company") return req.user._id;
    return req.user.company?._id || req.user.company;
};

export const updateEmployeeMovement = async (req, res) => {
    try {
        const { id } = req.params;
        const companyId = getCompanyId(req);
        const EmployeeMovement = req.getModel('EmployeeMovement', employeeMovementSchema);

        const movement = await EmployeeMovement.findOne({ _id: id, company: companyId });
        if (!movement) {
            return res.status(404).json({ message: "Employee movement log not found" });
        }

        // Check 5-minute window from creation / outTime
        const referenceTime = movement.createdAt || movement.outTime;
        const diffMins = (Date.now() - new Date(referenceTime).getTime()) / (60 * 1000);

        if (diffMins > 5) {
            return res.status(400).json({
                message: `Edit window (5 minutes) has expired. This log was created ${Math.floor(diffMins)} minutes ago and can no longer be edited.`
            });
        }

        const { employee, reason, approvedBy, notes } = req.body;

        if (employee) movement.employee = employee;
        if (reason) movement.reason = reason;
        if (approvedBy !== undefined) movement.approvedBy = approvedBy.trim();
        if (notes !== undefined) movement.notes = notes.trim();

        await movement.save();

        res.status(200).json({ message: "Employee movement updated successfully", movement });
    } catch (error) {
        console.error("Error updating employee movement:", error);
        res.status(500).json({ message: "Server error updating employee movement" });
    }
};

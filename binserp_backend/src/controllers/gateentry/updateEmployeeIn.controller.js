import { employeeMovementSchema } from "../../models/hr/index.js";

// Helper to get company from request
const getCompanyId = (req) => {
    if (req.userType === "company") return req.user._id;
    return req.user.company?._id || req.user.company;
};

export const updateEmployeeIn = async (req, res) => {
    try {
        const { id } = req.params;
        const EmployeeMovement = req.getModel('EmployeeMovement', employeeMovementSchema);
        const movement = await EmployeeMovement.findById(id);

        if (!movement) {
            return res.status(404).json({ message: "Movement record not found" });
        }

        if (movement.status === "Inside") {
            return res.status(400).json({ message: "Employee has already returned" });
        }

        movement.status = "Inside";
        movement.inTime = new Date();
        movement.checkedInBy = req.user._id;

        // Calculate duration in minutes
        const diffMs = movement.inTime - movement.outTime;
        movement.duration = Math.round(diffMs / 60000);

        await movement.save();

        res.status(200).json({ message: "Employee return recorded successfully", movement });
    } catch (error) {
        console.error("Error recording employee return:", error);
        res.status(500).json({ message: "Server error recording employee return" });
    }
};

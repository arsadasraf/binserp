import { employeeMovementSchema } from "../../models/hr/index.js";
import { employeeSchema } from "../../models/hr/index.js";
import { userSchema } from "../../models/user/index.js";

// Helper to get company from request
const getCompanyId = (req) => {
    if (req.userType === "company") return req.user._id;
    return req.user.company?._id || req.user.company;
};

export const getActiveEmployeeMovements = async (req, res) => {
    try {
        const companyId = getCompanyId(req);
        const EmployeeMovement = req.getModel('EmployeeMovement', employeeMovementSchema);
        // Ensure Employee model is registered for populate
        req.getModel('Employee', employeeSchema);
        // Ensure User model is registered for populate
        req.getModel('User', userSchema);

        const movements = await EmployeeMovement.find({ company: companyId, status: "Outside" })
            .populate('employee', 'name employeeId department designation')
            .populate('createdBy', 'name')
            .populate('checkedInBy', 'name')
            .sort({ outTime: -1 });

        res.status(200).json({ movements });
    } catch (error) {
        console.error("Error fetching active employee movements:", error);
        res.status(500).json({ message: "Server error fetching active employee movements" });
    }
};

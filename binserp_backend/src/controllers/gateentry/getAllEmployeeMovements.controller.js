import { employeeMovementSchema } from "../../models/hr/index.js";
import { employeeSchema } from "../../models/hr/index.js";
import { userSchema } from "../../models/user/index.js";

// Helper to get company from request
const getCompanyId = (req) => {
    if (req.userType === "company") return req.user._id;
    return req.user.company?._id || req.user.company;
};

export const getAllEmployeeMovements = async (req, res) => {
    try {
        const companyId = getCompanyId(req);
        const { start, end } = req.query;
        const EmployeeMovement = req.getModel('EmployeeMovement', employeeMovementSchema);
        req.getModel('Employee', employeeSchema);
        req.getModel('User', userSchema);

        const query = { company: companyId };

        if (start && end) {
            query.outTime = {
                $gte: new Date(start),
                $lte: new Date(end)
            };
        }

        const movements = await EmployeeMovement.find(query)
            .populate('employee', 'name employeeId department designation')
            .populate('createdBy', 'name')
            .populate('checkedInBy', 'name')
            .sort({ outTime: -1 });

        res.status(200).json({ movements });
    } catch (error) {
        console.error("Error fetching employee movements:", error);
        res.status(500).json({ message: "Server error fetching employee movements" });
    }
};

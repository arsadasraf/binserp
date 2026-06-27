import { vehicleSchema } from "../../models/vehicle/index.js";

// Helper to get company from request (middleware usually attaches it)
const getCompanyId = (req) => {
    if (req.userType === "company") return req.user._id;
    return req.user.company?._id || req.user.company;
};

export const getAllVehicles = async (req, res) => {
    try {
        const companyId = getCompanyId(req);
        const Vehicle = req.getModel('Vehicle', vehicleSchema);
        const { start, end } = req.query;

        const query = { company: companyId };
        if (start && end) {
            query.checkInTime = { $gte: new Date(start), $lte: new Date(end) };
        }

        const vehicles = await Vehicle.find(query)
            .sort({ checkInTime: -1 });

        res.status(200).json({ vehicles });
    } catch (error) {
        console.error("Error fetching all vehicles:", error);
        res.status(500).json({ message: "Server error fetching vehicles" });
    }
};

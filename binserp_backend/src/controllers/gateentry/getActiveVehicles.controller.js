import { vehicleSchema } from "../../models/vehicle/index.js";

// Helper to get company from request (middleware usually attaches it)
const getCompanyId = (req) => {
    if (req.userType === "company") return req.user._id;
    return req.user.company?._id || req.user.company;
};

export const getActiveVehicles = async (req, res) => {
    try {
        const companyId = getCompanyId(req);
        const Vehicle = req.getModel('Vehicle', vehicleSchema);
        const vehicles = await Vehicle.find({ company: companyId, status: "Inside" })
            .sort({ checkInTime: -1 });

        res.status(200).json({ vehicles });
    } catch (error) {
        console.error("Error fetching active vehicles:", error);
        res.status(500).json({ message: "Server error fetching vehicles" });
    }
};

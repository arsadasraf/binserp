import { vehicleSchema } from "../../models/vehicle/index.js";

// Helper to get company from request
const getCompanyId = (req) => {
    if (req.userType === "company") return req.user._id;
    return req.user.company?._id || req.user.company;
};

export const deleteVehicle = async (req, res) => {
    try {
        const { id } = req.params;
        const companyId = getCompanyId(req);
        const Vehicle = req.getModel('Vehicle', vehicleSchema);

        const vehicle = await Vehicle.findOne({ _id: id, company: companyId });
        if (!vehicle) {
            return res.status(404).json({ message: "Vehicle log not found" });
        }

        // Check 5-minute window from creation / check-in
        const referenceTime = vehicle.createdAt || vehicle.checkInTime;
        const diffMins = (Date.now() - new Date(referenceTime).getTime()) / (60 * 1000);

        if (diffMins > 5) {
            return res.status(400).json({
                message: `Delete window (5 minutes) has expired. This log was created ${Math.floor(diffMins)} minutes ago and can no longer be deleted.`
            });
        }

        await Vehicle.deleteOne({ _id: id, company: companyId });

        res.status(200).json({ message: "Vehicle log deleted successfully" });
    } catch (error) {
        console.error("Error deleting vehicle log:", error);
        res.status(500).json({ message: "Server error deleting vehicle log" });
    }
};

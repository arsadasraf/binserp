import { vehicleSchema } from "../../models/vehicle/index.js";

// Helper to get company from request (middleware usually attaches it)
const getCompanyId = (req) => {
    if (req.userType === "company") return req.user._id;
    return req.user.company?._id || req.user.company;
};

export const checkOutVehicle = async (req, res) => {
    try {
        const { id } = req.params;
        const Vehicle = req.getModel('Vehicle', vehicleSchema);
        const vehicle = await Vehicle.findById(id);

        if (!vehicle) {
            return res.status(404).json({ message: "Vehicle not found" });
        }

        if (vehicle.status === "Left") {
            return res.status(400).json({ message: "Vehicle already checked out" });
        }

        vehicle.status = "Left";
        vehicle.checkOutTime = new Date();
        await vehicle.save();

        res.status(200).json({ message: "Vehicle checked out successfully", vehicle });
    } catch (error) {
        console.error("Error checking out vehicle:", error);
        res.status(500).json({ message: "Server error checking out vehicle" });
    }
};

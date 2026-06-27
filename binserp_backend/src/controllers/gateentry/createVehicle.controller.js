import { vehicleSchema } from "../../models/vehicle/index.js";

// Helper to get company from request (middleware usually attaches it)
const getCompanyId = (req) => {
    if (req.userType === "company") return req.user._id;
    return req.user.company?._id || req.user.company;
};

export const createVehicle = async (req, res) => {
    try {
        const { driverName, phone, vehicleNumber, goodsType, purpose, documentPhotos, vehiclePhotos, companyName, address, direction } = req.body;
        const companyId = getCompanyId(req);
        const Vehicle = req.getModel('Vehicle', vehicleSchema);

        if (!driverName || !phone || !vehicleNumber) {
            return res.status(400).json({ message: "Driver Name, Phone, and Vehicle Number are required" });
        }

        const newVehicle = new Vehicle({
            company: companyId,
            name: driverName,
            phone,
            vehicleNumber,
            goodsType,
            purpose,
            documentPhotos,
            vehiclePhotos,
            companyName,
            address,
            direction: direction || "Inward",
            createdBy: req.user._id,
            status: "Inside"
        });

        await newVehicle.save();

        res.status(201).json({ message: "Vehicle checked in successfully", vehicle: newVehicle });
    } catch (error) {
        console.error("Error creating vehicle:", error);
        res.status(500).json({ message: "Server error checking in vehicle" });
    }
};

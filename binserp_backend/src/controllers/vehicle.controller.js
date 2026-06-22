import { vehicleSchema } from "../models/vehicle.model.js";

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

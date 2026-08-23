import { vehicleSchema } from "../../models/vehicle/index.js";

// Helper to get company from request
const getCompanyId = (req) => {
    if (req.userType === "company") return req.user._id;
    return req.user.company?._id || req.user.company;
};

export const updateVehicle = async (req, res) => {
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
                message: `Edit window (5 minutes) has expired. This log was created ${Math.floor(diffMins)} minutes ago and can no longer be edited.`
            });
        }

        const {
            driverName,
            phone,
            vehicleNumber,
            companyName,
            goodsType,
            address,
            direction,
            documentType,
            documentNumber,
            purpose,
            vehiclePhotos,
            documentPhotos
        } = req.body;

        if (driverName) vehicle.name = driverName.trim();
        if (phone) vehicle.phone = phone.trim();
        if (vehicleNumber) vehicle.vehicleNumber = vehicleNumber.trim();
        if (companyName !== undefined) vehicle.companyName = companyName.trim();
        if (goodsType !== undefined) vehicle.goodsType = goodsType.trim();
        if (address !== undefined) vehicle.address = address.trim();
        if (direction) vehicle.direction = direction;
        if (documentType !== undefined) vehicle.documentType = documentType;
        if (documentNumber !== undefined) vehicle.documentNumber = documentNumber.trim();
        if (purpose !== undefined) vehicle.purpose = purpose;
        if (vehiclePhotos !== undefined) vehicle.vehiclePhotos = vehiclePhotos;
        if (documentPhotos !== undefined) vehicle.documentPhotos = documentPhotos;

        await vehicle.save();

        res.status(200).json({ message: "Vehicle log updated successfully", vehicle });
    } catch (error) {
        console.error("Error updating vehicle log:", error);
        res.status(500).json({ message: "Server error updating vehicle log" });
    }
};

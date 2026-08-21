import { vehicleSchema } from "../../models/vehicle/index.js";
import { vendorSchema, customerSchema } from "../../models/store/index.js";

// Helper to get company from request
const getCompanyId = (req) => {
    if (req.userType === "company") return req.user._id;
    return req.user.company?._id || req.user.company;
};

export const getVehicleSuggestions = async (req, res) => {
    try {
        const companyId = getCompanyId(req);
        const Vehicle = req.getModel('Vehicle', vehicleSchema);
        const Vendor = req.getModel('Vendor', vendorSchema);
        const Customer = req.getModel('Customer', customerSchema);

        // Fetch past vehicles sorted by checkInTime descending (most recent first)
        const pastVehicles = await Vehicle.find({ company: companyId })
            .sort({ checkInTime: -1 })
            .limit(200)
            .select("vehicleNumber name phone companyName address goodsType purpose")
            .lean();

        // Fetch Vendors
        let vendors = [];
        try {
            vendors = await Vendor.find({ company: companyId })
                .select("name address billingAddress shippingAddress city state phone")
                .lean();
        } catch (e) {
            console.error("Error fetching vendors for suggestions:", e);
        }

        // Fetch Customers
        let customers = [];
        try {
            customers = await Customer.find({ company: companyId })
                .select("name address billingAddress shippingAddress city state phone")
                .lean();
        } catch (e) {
            console.error("Error fetching customers for suggestions:", e);
        }

        // Unique Vehicles map (keep the most recent entry for each vehicle number)
        const vehicleMap = new Map();
        pastVehicles.forEach((v) => {
            const vNum = (v.vehicleNumber || "").trim().toUpperCase();
            if (vNum && !vehicleMap.has(vNum)) {
                vehicleMap.set(vNum, {
                    vehicleNumber: vNum,
                    driverName: v.name || "",
                    phone: v.phone || "",
                    companyName: v.companyName || "",
                    address: v.address || "",
                    goodsType: v.goodsType || "",
                });
            }
        });

        // Unique Companies map (combine Vendors, Customers, and past vehicle company names)
        const companyMap = new Map();

        // Add vendors first
        vendors.forEach((vnd) => {
            const cName = (vnd.name || "").trim();
            if (cName && !companyMap.has(cName.toLowerCase())) {
                const addr = vnd.address || vnd.billingAddress || vnd.shippingAddress || (vnd.city ? `${vnd.city}, ${vnd.state || ''}` : "");
                companyMap.set(cName.toLowerCase(), {
                    name: cName,
                    address: addr.trim(),
                    phone: vnd.phone || "",
                    source: "Vendor Master"
                });
            }
        });

        // Add customers
        customers.forEach((cust) => {
            const cName = (cust.name || "").trim();
            if (cName && !companyMap.has(cName.toLowerCase())) {
                const addr = cust.address || cust.billingAddress || cust.shippingAddress || (cust.city ? `${cust.city}, ${cust.state || ''}` : "");
                companyMap.set(cName.toLowerCase(), {
                    name: cName,
                    address: addr.trim(),
                    phone: cust.phone || "",
                    source: "Customer Master"
                });
            }
        });

        // Add companies from past vehicles
        pastVehicles.forEach((v) => {
            const cName = (v.companyName || "").trim();
            if (cName && !companyMap.has(cName.toLowerCase())) {
                companyMap.set(cName.toLowerCase(), {
                    name: cName,
                    address: (v.address || "").trim(),
                    phone: v.phone || "",
                    source: "Past Log"
                });
            }
        });

        // Unique Drivers
        const driverMap = new Map();
        pastVehicles.forEach((v) => {
            const dName = (v.name || "").trim();
            if (dName && !driverMap.has(dName.toLowerCase())) {
                driverMap.set(dName.toLowerCase(), {
                    name: dName,
                    phone: v.phone || "",
                });
            }
        });

        const predefinedGoodsTypes = [
            "RM",
            "Bought Out",
            "FG",
            "Machinery / Tools",
            "Job Work Material",
            "Consumables",
            "Scrap",
            "Other"
        ];

        const predefinedPurposes = [
            "Material Inward",
            "Purchase Delivery",
            "Job Work Return",
            "Stock Transfer",
            "Machine Maintenance",
            "Sample Delivery",
            "Logistics"
        ];

        res.status(200).json({
            vehicles: Array.from(vehicleMap.values()),
            companies: Array.from(companyMap.values()),
            drivers: Array.from(driverMap.values()),
            goodsTypes: predefinedGoodsTypes,
            purposes: predefinedPurposes
        });
    } catch (error) {
        console.error("Error generating vehicle suggestions:", error);
        res.status(500).json({ message: "Server error fetching suggestions" });
    }
};

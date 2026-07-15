import { storePrefixSchema } from "../../models/store/index.js";

// Helper to get company ID (consistent with other controllers)
const getCompanyId = (req) => {
    return req.userType === "company" ? req.user.id : req.user.company._id;
};

export const getStorePrefixSettings = async (req, res) => {
    try {
        if (!req.getModel) {
            throw new Error("Tenant context not found (req.getModel is undefined)");
        }
        const StorePrefix = req.getModel("StorePrefix", storePrefixSchema);
        let settings = await StorePrefix.findOne();

        if (!settings) {
            settings = new StorePrefix();
        }

        res.status(200).json({ settings });
    } catch (error) {
        console.error("Error fetching store prefix settings:", error);
        res.status(500).json({
            message: "Failed to fetch store prefix settings",
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

export const updateStorePrefixSettings = async (req, res) => {
    try {
        if (!req.getModel) {
            throw new Error("Tenant context not found (req.getModel is undefined)");
        }

        const StorePrefix = req.getModel("StorePrefix", storePrefixSchema);

        const updateData = {
            grnPrefix: req.body.grnPrefix,
            poPrefix: req.body.poPrefix,
            dcPrefix: req.body.dcPrefix,
            invoicePrefix: req.body.invoicePrefix,
            partPrefix: req.body.partPrefix,
            vendorPrefix: req.body.vendorPrefix,
            customerPrefix: req.body.customerPrefix,
            jobWorkSupplierPrefix: req.body.jobWorkSupplierPrefix,
            incomingRfqPrefix: req.body.incomingRfqPrefix,
        };

        Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

        const settings = await StorePrefix.findOneAndUpdate(
            {}, 
            updateData,
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        res.status(200).json({ message: "Store prefix settings updated successfully", settings });
    } catch (error) {
        console.error("Error updating store prefix settings:", error);
        res.status(500).json({
            message: "Failed to update store prefix settings",
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

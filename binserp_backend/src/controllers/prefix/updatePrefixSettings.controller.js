import { prefixSettingsSchema } from "../../models/prefix/index.js";

// Helper to get company ID (consistent with other controllers)
const getCompanyId = (req) => {
    return req.userType === "company" ? req.user.id : req.user.company._id;
};

export const updatePrefixSettings = async (req, res) => {
    try {
        console.log(">>> [updatePrefixSettings] Request received.");
        console.log(">>> [updatePrefixSettings] Body:", req.body);

        if (!req.getModel) {
            console.error(">>> [updatePrefixSettings] req.getModel is UNDEFINED");
            throw new Error("Tenant context not found (req.getModel is undefined)");
        }

        const PrefixSettings = req.getModel("PrefixSettings", prefixSettingsSchema);

        // Upsert logic
        const updateData = {
            grnPrefix: req.body.grnPrefix,
            poPrefix: req.body.poPrefix,
            dcPrefix: req.body.dcPrefix,
            invoicePrefix: req.body.invoicePrefix,
            employeePrefix: req.body.employeePrefix,
            partPrefix: req.body.partPrefix,
            vendorPrefix: req.body.vendorPrefix,
            customerPrefix: req.body.customerPrefix,
            jobWorkSupplierPrefix: req.body.jobWorkSupplierPrefix,
        };

        // Remove undefined fields to avoid overwriting with null/undefined if partial update (though usually full form is sent)
        Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

        console.log(">>> [updatePrefixSettings] Update Data:", updateData);

        const settings = await PrefixSettings.findOneAndUpdate(
            {}, // Match any (first) document
            updateData,
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        console.log(">>> [updatePrefixSettings] Update Success:", settings);

        res.status(200).json({ message: "Prefix settings updated successfully", settings });
    } catch (error) {
        console.error("Error updating prefix settings:", error);
        res.status(500).json({
            message: "Failed to update prefix settings",
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

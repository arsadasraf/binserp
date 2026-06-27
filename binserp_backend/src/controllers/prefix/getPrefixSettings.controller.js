import { prefixSettingsSchema } from "../../models/prefix/index.js";

// Helper to get company ID (consistent with other controllers)
const getCompanyId = (req) => {
    return req.userType === "company" ? req.user.id : req.user.company._id;
};

export const getPrefixSettings = async (req, res) => {
    try {
        if (!req.getModel) {
            throw new Error("Tenant context not found (req.getModel is undefined)");
        }
        const PrefixSettings = req.getModel("PrefixSettings", prefixSettingsSchema);
        // Assuming settings are single document for now, or per company if tenant DB logic handles it.
        // In multi-tenant DB (one DB per company), there should be only one settings doc.
        let settings = await PrefixSettings.findOne();

        if (!settings) {
            // Return defaults if not found (or create one)
            settings = new PrefixSettings();
            // await settings.save(); // Optional: Persist default immediately or wait for update
        }

        res.status(200).json({ settings });
    } catch (error) {
        console.error("Error fetching prefix settings:", error);
        res.status(500).json({
            message: "Failed to fetch prefix settings",
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

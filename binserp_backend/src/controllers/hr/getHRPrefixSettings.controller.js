import { hrPrefixSettingsSchema } from "../../models/hrPrefix/index.js";
import { uploadOnS3 } from "../../utils/s3.js";

export const getHRPrefixSettings = async (req, res) => {
    try {
        if (!req.getModel) throw new Error("Tenant context not found");
        const HRPrefixSettings = req.getModel("HRPrefixSettings", hrPrefixSettingsSchema);
        let settings = await HRPrefixSettings.findOne();
        if (!settings) settings = new HRPrefixSettings();
        res.status(200).json({ settings });
    } catch (error) {
        console.error("Error fetching HR prefix settings:", error);
        res.status(500).json({ message: "Failed to fetch HR prefix settings", error: error.message });
    }
};

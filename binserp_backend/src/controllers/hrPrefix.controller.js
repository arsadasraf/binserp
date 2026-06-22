import { hrPrefixSettingsSchema } from "../models/hrPrefix.model.js";
import { uploadOnS3 } from "../utils/s3.js";

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

export const updateHRPrefixSettings = async (req, res) => {
    try {
        console.log(">>> [updateHRPrefixSettings] Body:", req.body);
        if (!req.getModel) throw new Error("Tenant context not found");

        const HRPrefixSettings = req.getModel("HRPrefixSettings", hrPrefixSettingsSchema);

        const updateData = {
            employeePrefix: req.body.employeePrefix,
            offerLetterPrefix: req.body.offerLetterPrefix,
            paymentSlipPrefix: req.body.paymentSlipPrefix,
            companyName: req.body.companyName,
            companyAddress: req.body.companyAddress,
            companyPhone: req.body.companyPhone,
            companyEmail: req.body.companyEmail,
            currency: req.body.currency,
        };

        // Upload logo to Cloudinary if provided
        if (req.file) {
            const uploaded = await uploadOnS3(req.file.path, "hr_logos");
            if (uploaded?.secure_url) {
                updateData.companyLogo = uploaded.secure_url;
            }
        }

        // Remove undefined fields
        Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

        const settings = await HRPrefixSettings.findOneAndUpdate(
            {},
            updateData,
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        res.status(200).json({ message: "Settings updated successfully", settings });
    } catch (error) {
        console.error("Error updating HR settings:", error);
        res.status(500).json({ message: "Failed to update settings", error: error.message });
    }
};

import mongoose from "mongoose";

const hrPrefixSettingsSchema = new mongoose.Schema(
    {
        employeePrefix: { type: String, default: "EMP" },
        offerLetterPrefix: { type: String, default: "OL" },
        paymentSlipPrefix: { type: String, default: "PAY" },
        employeeSerial: { type: Number, default: 1 },
        // Company Branding (used in PDF generation)
        companyName: { type: String, default: "" },
        companyLogo: { type: String, default: "" }, // Cloudinary URL
        companyAddress: { type: String, default: "" },
        companyPhone: { type: String, default: "" },
        companyEmail: { type: String, default: "" },
        currency: { type: String, default: "₹" },
    },
    { timestamps: true }
);

export { hrPrefixSettingsSchema };

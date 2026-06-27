import mongoose from "mongoose";

export const prefixSettingsSchema = new mongoose.Schema(
    {
        grnPrefix: { type: String, default: "GRN" },
        poPrefix: { type: String, default: "PO" },
        dcPrefix: { type: String, default: "DC" },
        invoicePrefix: { type: String, default: "INV" },
        employeePrefix: { type: String, default: "EMP" },
        partPrefix: { type: String, default: "PART" },
        vendorPrefix: { type: String, default: "VEN" },
        customerPrefix: { type: String, default: "CUS" },
        jobWorkSupplierPrefix: { type: String, default: "JWS" },
    },
    { timestamps: true }
);



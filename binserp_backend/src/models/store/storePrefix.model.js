import mongoose from "mongoose";

export const storePrefixSchema = new mongoose.Schema(
    {
        grnPrefix: { type: String, default: "GRN" },
        poPrefix: { type: String, default: "PO" },
        dcPrefix: { type: String, default: "DC" },
        invoicePrefix: { type: String, default: "INV" },
        partPrefix: { type: String, default: "PART" },
        vendorPrefix: { type: String, default: "VEN" },
        customerPrefix: { type: String, default: "CUS" },
        jobWorkSupplierPrefix: { type: String, default: "JWS" },
        incomingRfqPrefix: { type: String, default: "RFQ" },
    },
    { timestamps: true }
);

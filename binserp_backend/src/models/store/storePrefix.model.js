import mongoose from "mongoose";

export const storePrefixSchema = new mongoose.Schema(
    {
        grnPrefix: { type: String, default: "GRN" },
        rmBoGrnPrefix: { type: String, default: "GRN-RM" },
        fgGrnPrefix: { type: String, default: "GRN-FG" },
        poPrefix: { type: String, default: "PO" },
        incomingPoPrefix: { type: String, default: "PO-IN" },
        outgoingPoPrefix: { type: String, default: "PO-OUT" },
        dcPrefix: { type: String, default: "DC" },
        invoicePrefix: { type: String, default: "INV" },
        partPrefix: { type: String, default: "PART" },
        categoryPrefix: { type: String, default: "CAT" },
        vendorPrefix: { type: String, default: "VEN" },
        customerPrefix: { type: String, default: "CUS" },
        jobWorkSupplierPrefix: { type: String, default: "JWS" },
        incomingRfqPrefix: { type: String, default: "RFQ-IN" },
        outgoingRfqPrefix: { type: String, default: "RFQ-OUT" },
        quotationOutwardPrefix: { type: String, default: "QT-OUT" },
        quotationInwardPrefix: { type: String, default: "QT-IN" },
    },
    { timestamps: true }
);

import mongoose from "mongoose";

export const IncomingQCSchema = new mongoose.Schema({
    company: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Company",
        required: true
    },
    // Link to Store/Inventory (GRN or PO)
    grnReference: String, // Manual or ID if GRN module exists
    grnId: { type: mongoose.Schema.Types.ObjectId, ref: "GRN" }, // Direct Link
    grnItemId: { type: mongoose.Schema.Types.ObjectId }, // Specific item in GRN
    materialId: { type: mongoose.Schema.Types.ObjectId, ref: "RmBoItem" },
    componentId: { type: mongoose.Schema.Types.ObjectId, ref: "Component" },

    materialName: { type: String, required: true },
    batchNumber: String,
    supplierName: String,

    receivedQuantity: { type: Number, required: true },
    inspectedQuantity: { type: Number, required: true },
    acceptedQuantity: { type: Number, default: 0 },
    rejectedQuantity: { type: Number, default: 0 },

    // Check Parameters results
    inspectionResults: [{
        parameterName: String,
        standardValue: String,
        actualValue: String,
        status: { type: String, enum: ["Pass", "Fail"], default: "Pass" },
        remarks: String
    }],

    overallStatus: {
        type: String,
        enum: ["Pending", "Accepted", "Rejected", "Conditional"],
        default: "Pending"
    },

    inspector: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    remarks: String,
    photos: [String] // Evidence
}, { timestamps: true });
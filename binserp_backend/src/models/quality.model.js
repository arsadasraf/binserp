import mongoose from "mongoose";

// Quality Master Schema (For defining standard inspection templates)
export const QualityMasterSchema = new mongoose.Schema({
    company: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Company",
        required: true
    },
    name: {
        type: String,
        required: true, // e.g., "Steel Bar standard check"
    },
    type: {
        type: String,
        enum: ["Incoming", "Process", "Final"],
        required: true
    },
    description: String,
    parameters: [{
        name: { type: String, required: true }, // e.g., "Diameter", "Hardness"
        method: String, // e.g., "Vernier Caliper"
        tolerance: String, // e.g., "+/- 0.05mm"
        mandatory: { type: Boolean, default: true }
    }],
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }
}, { timestamps: true });

// Incoming QC Schema (Raw Material Inspection)
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
    materialId: { type: mongoose.Schema.Types.ObjectId, ref: "Material" },
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

// Process QC Schema (In-process / Job Inspection)
export const ProcessQCSchema = new mongoose.Schema({
    company: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Company",
        required: true
    },
    // Link to Production logic
    jobId: { type: String, required: true }, // Can link to Job model if needed
    processName: { type: String, required: true },
    operatorName: String,
    machineName: String, // Snapshot

    totalChecked: { type: Number, required: true },
    okQuantity: { type: Number, required: true },
    rejectedQuantity: { type: Number, default: 0 },
    reworkQuantity: { type: Number, default: 0 },

    // Check Parameters results
    inspectionResults: [{
        parameterName: String,
        standardValue: String,
        actualValue: String,
        status: { type: String, enum: ["Pass", "Fail"], default: "Pass" }
    }],

    status: {
        type: String,
        enum: ["Pass", "Fail", "Rework"],
        default: "Pass"
    },

    inspector: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    remarks: String
}, { timestamps: true });

export const QualityMaster = mongoose.model("QualityMaster", QualityMasterSchema);
export const IncomingQC = mongoose.model("IncomingQC", IncomingQCSchema);
export const ProcessQC = mongoose.model("ProcessQC", ProcessQCSchema);

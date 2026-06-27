import mongoose from "mongoose";

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
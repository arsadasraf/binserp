import mongoose from "mongoose";

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
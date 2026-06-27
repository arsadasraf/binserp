import mongoose from "mongoose";

// Maintenance History Schema (Log of performed preventive maintenance)
export const maintenanceHistorySchema = new mongoose.Schema(
    {
        company: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Company",
            required: true,
        },
        schedule: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "PreventiveSchedule",
        },
        machine: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Machine",
            required: true,
        },
        performedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        date: {
            type: Date,
            default: Date.now,
        },
        status: {
            type: String,
            enum: ["Completed", "Missed", "Partial"],
            default: "Completed",
        },
        remarks: String,
        sparePartsUsed: [
            {
                part: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "SparePart",
                },
                quantity: Number,
            },
        ],
    },
    { timestamps: true }
);
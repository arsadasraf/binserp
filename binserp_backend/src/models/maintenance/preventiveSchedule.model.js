import mongoose from "mongoose";

// Preventive Maintenance Schedule Schema
export const preventiveScheduleSchema = new mongoose.Schema(
    {
        company: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Company",
            required: true,
        },
        machine: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Machine",
            required: true,
        },
        title: {
            type: String,
            required: true, // e.g., "Weekly Oiling"
        },
        frequency: {
            type: String,
            enum: ["Daily", "Weekly", "Monthly", "Quarterly", "HalfYearly", "Yearly"],
            required: true,
        },
        checklist: [String], // Array of tasks
        lastMaintenanceDate: Date,
        nextDueDate: {
            type: Date,
            required: true,
        },
        assignedTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        status: {
            type: String,
            enum: ["Active", "Inactive"],
            default: "Active",
        },
    },
    { timestamps: true }
);

// Indexes
preventiveScheduleSchema.index({ company: 1, machine: 1 });
preventiveScheduleSchema.index({ company: 1, nextDueDate: 1 });
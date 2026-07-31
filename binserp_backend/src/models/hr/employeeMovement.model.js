import mongoose from "mongoose";

export const employeeMovementSchema = new mongoose.Schema(
    {
        company: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Company",
            required: true,
        },
        employee: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Employee",
            required: true,
        },
        reason: {
            type: String,
            enum: ["Lunch Break", "Snacks Break", "Official Work", "Personal", "Other"],
            required: true,
        },
        approvedBy: {
            type: String,
            default: "",
        },
        notes: {
            type: String,
            default: "",
        },
        outTime: {
            type: Date,
            default: Date.now,
        },
        inTime: {
            type: Date,
        },
        duration: {
            type: Number, // duration in minutes
        },
        status: {
            type: String,
            enum: ["Outside", "Inside"],
            default: "Outside",
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        checkedInBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        }
    },
    { timestamps: true }
);

employeeMovementSchema.index({ company: 1, status: 1 });
employeeMovementSchema.index({ company: 1, outTime: -1 });

import mongoose from "mongoose";

const ActivityType = ["Call", "Meeting", "Email", "Note", "Task"];

export const activitySchema = new mongoose.Schema(
    {
        company: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Company",
            required: true,
        },
        type: {
            type: String,
            enum: ActivityType,
            required: true,
        },
        summary: { type: String, required: true }, // Short title
        description: { type: String }, // Detailed notes

        // Linking directly to ONE of these usually, or generic refs
        relatedLead: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Lead",
        },
        relatedCustomer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Customer",
        },

        // Timing
        date: { type: Date, default: Date.now },
        duration: { type: Number }, // in minutes

        // Task properties
        dueDate: { type: Date },
        isCompleted: { type: Boolean, default: false },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
    },
    { timestamps: true }
);

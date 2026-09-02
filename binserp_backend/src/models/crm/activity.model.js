import mongoose from "mongoose";

const ActivityType = ["Call", "Meeting", "Email", "Note", "Task", "Site Visit", "Demo", "WhatsApp"];

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
        summary: { type: String, required: true, trim: true },
        description: { type: String },

        // Associated CRM Entity
        relatedLead: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Lead",
        },
        relatedCustomer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Customer",
        },
        relatedDeal: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Deal",
        },

        // Timing & Follow-up Schedule
        date: { type: Date, default: Date.now },
        dueDate: { type: Date },
        duration: { type: Number, default: 15 }, // in minutes

        // Status & Outcome
        isCompleted: { type: Boolean, default: false },
        completedAt: { type: Date },
        outcome: { type: String, trim: true }, // e.g. "Interested", "Rescheduled", "No Answer", "Quote Requested"
        
        assignedTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
    },
    { timestamps: true }
);

activitySchema.index({ company: 1, dueDate: 1, isCompleted: 1 });
activitySchema.index({ company: 1, relatedLead: 1 });
activitySchema.index({ company: 1, relatedCustomer: 1 });

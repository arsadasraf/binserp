import mongoose from "mongoose";

// Breakdown Ticket Schema (Corrective Maintenance)
export const breakdownTicketSchema = new mongoose.Schema(
    {
        company: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Company",
            required: true,
        },
        ticketNumber: {
            type: String,
            required: true,
            unique: true,
        },
        machine: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Machine",
            required: true,
        },
        reportedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        issueDescription: {
            type: String,
            required: true,
        },
        priority: {
            type: String,
            enum: ["Low", "Medium", "High", "Critical"],
            default: "Medium",
        },
        status: {
            type: String,
            enum: ["Open", "Assigned", "InProgress", "Resolved", "Closed"],
            default: "Open",
        },
        assignedTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User", // Maintenance Engineer
        },
        breakdownTime: {
            type: Date,
            default: Date.now,
        },
        resolutionTime: Date,
        solution: String,
        cost: {
            type: Number,
            default: 0,
        },
        sparePartsUsed: [
            {
                part: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "SparePart",
                },
                quantity: Number,
            },
        ],
        photos: [String],
    },
    { timestamps: true }
);

// Indexes
breakdownTicketSchema.index({ company: 1, ticketNumber: 1 }, { unique: true });
breakdownTicketSchema.index({ company: 1, status: 1 });
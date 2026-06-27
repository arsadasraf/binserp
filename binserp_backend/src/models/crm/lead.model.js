import mongoose from "mongoose";

const LeadStatus = ["New", "Contacted", "Qualified", "Proposal Sent", "Negotiation", "Won", "Lost"];
const LeadSource = ["Website", "Referral", "Cold Call", "Exhibition", "Social Media", "Other"];

export const leadSchema = new mongoose.Schema(
    {
        company: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Company",
            required: true,
        },
        // Lead Details
        name: { type: String, required: true, trim: true }, // Contact Person or Company Name
        companyName: { type: String, trim: true },
        email: { type: String, trim: true, lowercase: true },
        phone: { type: String, trim: true },

        // CRM Metadata
        status: {
            type: String,
            enum: LeadStatus,
            default: "New",
        },
        source: {
            type: String,
            enum: LeadSource,
            default: "Other",
        },
        priority: {
            type: String,
            enum: ["Low", "Medium", "High"],
            default: "Medium",
        },
        assignedTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },

        // Qualification Details
        requirements: { type: String },
        estimatedValue: { type: Number },
        expectedClosingDate: { type: Date },

        isConverted: { type: Boolean, default: false },
        convertedToCustomer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Customer",
        },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
    },
    { timestamps: true }
);

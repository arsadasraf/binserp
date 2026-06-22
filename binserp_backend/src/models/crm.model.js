import mongoose from "mongoose";

// --- Enums ---
const LeadStatus = ["New", "Contacted", "Qualified", "Proposal Sent", "Negotiation", "Won", "Lost"];
const LeadSource = ["Website", "Referral", "Cold Call", "Exhibition", "Social Media", "Other"];
const ActivityType = ["Call", "Meeting", "Email", "Note", "Task"];

// --- Schemas ---

// 1. Lead Schema
const leadSchema = new mongoose.Schema(
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

// 2. Customer Schema (Converted Leads)
const customerSchema = new mongoose.Schema(
    {
        company: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Company",
            required: true,
        },
        name: { type: String, required: true, trim: true }, // Company Name
        contactPerson: { type: String, trim: true },
        email: { type: String, trim: true, lowercase: true },
        phone: { type: String, trim: true },

        // Address Details
        address: {
            street: String,
            city: String,
            state: String,
            zipCode: String,
            country: String,
        },

        // Business Details
        gstin: { type: String, trim: true },
        industry: { type: String },

        // Origin
        convertedFromLead: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Lead",
        },

        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
    },
    { timestamps: true }
);

// 3. Activity Schema (Polymorphic: Related to Lead or Customer)
const activitySchema = new mongoose.Schema(
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

export { leadSchema, customerSchema, activitySchema };

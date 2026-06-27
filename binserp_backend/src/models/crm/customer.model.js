import mongoose from "mongoose";

export const customerSchema = new mongoose.Schema(
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

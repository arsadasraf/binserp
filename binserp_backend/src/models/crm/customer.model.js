import mongoose from "mongoose";

export const customerSchema = new mongoose.Schema(
    {
        company: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Company",
            required: true,
        },
        name: { type: String, required: true, trim: true }, // Company / Customer Name
        customerCode: { type: String, trim: true },
        contactPerson: { type: String, trim: true },
        designation: { type: String, trim: true },
        email: { type: String, trim: true, lowercase: true },
        phone: { type: String, trim: true },
        altPhone: { type: String, trim: true },
        website: { type: String, trim: true },

        // Multiple Contact Persons
        contactPersons: [
            {
                name: { type: String, trim: true },
                designation: { type: String, trim: true },
                email: { type: String, trim: true },
                phone: { type: String, trim: true },
                isPrimary: { type: Boolean, default: false }
            }
        ],

        // Address Details
        address: {
            street: String,
            city: String,
            state: String,
            zipCode: String,
            country: { type: String, default: "India" }
        },
        shippingAddress: {
            street: String,
            city: String,
            state: String,
            zipCode: String,
            country: { type: String, default: "India" }
        },

        // Business & Tax Details
        gstin: { type: String, trim: true },
        pan: { type: String, trim: true },
        industry: { type: String, trim: true },
        tier: {
            type: String,
            enum: ["Platinum", "Gold", "Silver", "Standard"],
            default: "Standard"
        },
        creditLimit: { type: Number, default: 0 },
        annualRevenue: { type: Number, default: 0 },

        // Relationship Origin
        source: { type: String, default: "Direct" },
        convertedFromLead: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Lead",
        },

        assignedAccountManager: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },

        tags: [{ type: String, trim: true }],
        notes: { type: String },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
    },
    { timestamps: true }
);

customerSchema.index({ company: 1, name: 1 });
customerSchema.index({ company: 1, phone: 1 });
customerSchema.index({ company: 1, email: 1 });

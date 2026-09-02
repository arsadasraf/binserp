import mongoose from "mongoose";

export const leadSchema = new mongoose.Schema(
    {
        company: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Company",
            required: true,
        },
        // Lead Contact & Company Details
        name: { type: String, required: true, trim: true },
        companyName: { type: String, trim: true },
        designation: { type: String, trim: true },
        email: { type: String, trim: true, lowercase: true },
        phone: { type: String, trim: true },
        altPhone: { type: String, trim: true },
        website: { type: String, trim: true },

        // Location Info
        address: { type: String, trim: true },
        city: { type: String, trim: true },
        state: { type: String, trim: true },
        country: { type: String, trim: true, default: "India" },
        pincode: { type: String, trim: true },

        // CRM Status & Pipeline
        status: {
            type: String,
            default: "New",
            trim: true
        },
        source: {
            type: String,
            default: "Direct",
            trim: true
        },
        sourceId: { 
            type: String, 
            trim: true,
            index: true
        }, // e.g. IndiaMART Query ID or Webhook Event ID
        sourceRawData: { type: mongoose.Schema.Types.Mixed },

        warmth: {
            type: String,
            enum: ["Hot", "Warm", "Cold"],
            default: "Warm"
        },
        priority: {
            type: String,
            enum: ["Low", "Medium", "High", "Urgent"],
            default: "Medium",
        },
        assignedTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },

        // Commercials & Requirements
        productInterest: [{ type: String, trim: true }],
        requirements: { type: String },
        estimatedValue: { type: Number, default: 0 },
        currency: { type: String, default: "INR" },
        expectedClosingDate: { type: Date },

        // Win / Loss Tracking
        lossReason: { type: String, trim: true },
        lossRemarks: { type: String, trim: true },

        // Conversion Tracking
        isConverted: { type: Boolean, default: false },
        convertedAt: { type: Date },
        convertedToCustomer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Customer",
        },
        convertedToDeal: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Deal",
        },

        // Stage Change History
        stageHistory: [
            {
                fromStage: String,
                toStage: String,
                changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
                changedAt: { type: Date, default: Date.now },
                remarks: String
            }
        ],

        tags: [{ type: String, trim: true }],
        notes: { type: String },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        }
    },
    { timestamps: true }
);

leadSchema.index({ company: 1, phone: 1 });
leadSchema.index({ company: 1, email: 1 });
leadSchema.index({ company: 1, sourceId: 1 });
leadSchema.index({ company: 1, status: 1 });

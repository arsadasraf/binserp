import mongoose from "mongoose";

export const dealSchema = new mongoose.Schema(
    {
        company: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Company",
            required: true,
        },
        title: { type: String, required: true, trim: true },
        lead: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Lead",
        },
        customer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Customer",
        },
        customerName: { type: String, trim: true },
        contactPerson: { type: String, trim: true },
        email: { type: String, trim: true },
        phone: { type: String, trim: true },

        value: { type: Number, required: true, default: 0 },
        currency: { type: String, default: "INR" },
        stage: {
            type: String,
            default: "Discovery",
            trim: true
        },
        probability: { type: Number, default: 50, min: 0, max: 100 },
        expectedCloseDate: { type: Date },
        actualCloseDate: { type: Date },

        products: [
            {
                name: String,
                quantity: { type: Number, default: 1 },
                unitPrice: { type: Number, default: 0 },
                total: { type: Number, default: 0 }
            }
        ],

        assignedTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },

        status: {
            type: String,
            enum: ["Open", "Won", "Lost", "Abandoned"],
            default: "Open"
        },
        lossReason: { type: String, trim: true },
        lossRemarks: { type: String, trim: true },

        stageHistory: [
            {
                fromStage: String,
                toStage: String,
                changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
                changedAt: { type: Date, default: Date.now },
                remarks: String
            }
        ],

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

dealSchema.index({ company: 1, stage: 1 });
dealSchema.index({ company: 1, status: 1 });
dealSchema.index({ company: 1, customer: 1 });

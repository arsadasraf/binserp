import mongoose from "mongoose";

export const crmProposalSchema = new mongoose.Schema(
    {
        company: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Company",
            required: true,
        },
        proposalNo: { type: String, required: true, trim: true },
        title: { type: String, required: true, trim: true },
        deal: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Deal",
        },
        customer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Customer",
        },
        customerName: { type: String, trim: true },
        contactPerson: { type: String, trim: true },
        email: { type: String, trim: true },
        phone: { type: String, trim: true },

        items: [
            {
                name: { type: String, required: true },
                description: { type: String },
                quantity: { type: Number, default: 1 },
                unitPrice: { type: Number, default: 0 },
                taxRate: { type: Number, default: 18 },
                total: { type: Number, default: 0 }
            }
        ],

        subtotal: { type: Number, default: 0 },
        taxAmount: { type: Number, default: 0 },
        totalAmount: { type: Number, required: true, default: 0 },
        currency: { type: String, default: "INR" },

        status: {
            type: String,
            enum: ["Draft", "Sent", "Under Review", "Accepted", "Declined"],
            default: "Sent"
        },
        sentDate: { type: Date, default: Date.now },
        validUntil: { type: Date },
        documentUrl: { type: String, trim: true },
        notes: { type: String },
        terms: { type: String },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        createdByName: { type: String, trim: true },
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        updatedByName: { type: String, trim: true }
    },
    { timestamps: true }
);

crmProposalSchema.index({ company: 1, proposalNo: 1 });
crmProposalSchema.index({ company: 1, customer: 1 });
crmProposalSchema.index({ company: 1, status: 1 });

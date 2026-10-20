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

        revisionNumber: { type: Number, default: 0 },
        isLatestRevision: { type: Boolean, default: true },
        parentProposalId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "CRMProposal",
        },

        items: [
            {
                productId: { type: mongoose.Schema.Types.ObjectId },
                productSource: { 
                    type: String, 
                    enum: ["FGItem", "CRMMaster", "Custom"], 
                    default: "Custom" 
                },
                name: { type: String, required: true },
                description: { type: String },
                uom: { type: String, default: "NOS" },
                hsnCode: { type: String, default: "" },
                quantity: { type: Number, default: 1 },
                proposalPrice: { type: Number, default: 0 },
                leastPrice: { type: Number, default: 0 },
                unitPrice: { type: Number, default: 0 },
                discountPercent: { type: Number, default: 0 },
                taxRate: { type: Number, default: 18 },
                total: { type: Number, default: 0 },
                isBelowFloorPrice: { type: Boolean, default: false }
            }
        ],

        subtotal: { type: Number, default: 0 },
        taxAmount: { type: Number, default: 0 },
        totalAmount: { type: Number, required: true, default: 0 },
        currency: { type: String, default: "INR" },

        status: {
            type: String,
            enum: ["Draft", "Sent", "Under Review", "Accepted", "Declined", "Converted to PI"],
            default: "Sent"
        },
        sentDate: { type: Date, default: Date.now },
        validUntil: { type: Date },
        documentUrl: { type: String, trim: true },
        notes: { type: String },
        terms: { type: String },

        // Conversion Link to Proforma Invoice
        convertedToPI: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "CRMProformaInvoice",
        },
        convertedToPINo: { type: String, trim: true },
        convertedAt: { type: Date },

        // Historical Revisions Tree
        revisionHistory: [
            {
                revisionNumber: { type: Number, required: true },
                proposalNo: { type: String, required: true },
                title: { type: String },
                items: { type: Array, default: [] },
                subtotal: { type: Number, default: 0 },
                taxAmount: { type: Number, default: 0 },
                totalAmount: { type: Number, default: 0 },
                changeNotes: { type: String, default: "" },
                status: { type: String },
                savedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
                savedByName: { type: String },
                savedAt: { type: Date, default: Date.now }
            }
        ],

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

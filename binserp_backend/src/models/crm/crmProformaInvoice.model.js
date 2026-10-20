import mongoose from "mongoose";

export const crmProformaInvoiceSchema = new mongoose.Schema(
    {
        company: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Company",
            required: true,
        },
        piNumber: { type: String, required: true, trim: true },
        revisionNumber: { type: Number, default: 0 },
        isLatestRevision: { type: Boolean, default: true },
        title: { type: String, required: true, trim: true },

        // Originating Quotation / Deal
        quotation: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "CRMProposal",
        },
        quotationNo: { type: String, trim: true },
        deal: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Deal",
        },

        // Customer Details
        customer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Customer",
        },
        customerName: { type: String, trim: true },
        contactPerson: { type: String, trim: true },
        email: { type: String, trim: true },
        phone: { type: String, trim: true },

        billingAddress: {
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

        // Commercial Line Items
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

        // Milestone Payment Terms
        advanceRequired: { type: Number, default: 0 },
        advancePaid: { type: Number, default: 0 },
        paymentTerms: { type: String, default: "30% Advance, 70% before Dispatch" },

        status: {
            type: String,
            enum: ["Draft", "Sent", "Advance Received", "Confirmed", "Converted to Invoice", "Cancelled"],
            default: "Sent"
        },
        issueDate: { type: Date, default: Date.now },
        validUntil: { type: Date },

        // Conversion Link to Tax Invoice
        convertedToInvoice: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Invoice",
        },
        convertedToInvoiceNo: { type: String, trim: true },
        convertedAt: { type: Date },

        // Historical Revisions Tree
        revisionHistory: [
            {
                revisionNumber: { type: Number, required: true },
                piNumber: { type: String, required: true },
                title: { type: String },
                items: { type: Array, default: [] },
                subtotal: { type: Number, default: 0 },
                taxAmount: { type: Number, default: 0 },
                totalAmount: { type: Number, default: 0 },
                advanceRequired: { type: Number, default: 0 },
                changeNotes: { type: String, default: "" },
                status: { type: String },
                savedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
                savedByName: { type: String },
                savedAt: { type: Date, default: Date.now }
            }
        ],

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

crmProformaInvoiceSchema.index({ company: 1, piNumber: 1 });
crmProformaInvoiceSchema.index({ company: 1, customer: 1 });
crmProformaInvoiceSchema.index({ company: 1, deal: 1 });
crmProformaInvoiceSchema.index({ company: 1, status: 1 });

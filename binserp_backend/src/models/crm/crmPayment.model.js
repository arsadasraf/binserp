import mongoose from "mongoose";

export const crmPaymentSchema = new mongoose.Schema(
    {
        company: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Company",
            required: true,
        },
        receiptNo: { type: String, required: true, trim: true },
        paymentDate: { type: Date, default: Date.now },
        amount: { type: Number, required: true, min: 0 },
        currency: { type: String, default: "INR" },
        paymentMode: {
            type: String,
            enum: ["NEFT/RTGS", "UPI", "Cheque", "Cash", "Card", "LC", "Other"],
            default: "NEFT/RTGS"
        },
        transactionRef: { type: String, trim: true }, // UTR, Cheque No, Bank Ref
        bankName: { type: String, trim: true },

        customer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Customer",
        },
        customerName: { type: String, trim: true },
        deal: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Deal",
        },
        invoiceNumber: { type: String, trim: true },

        status: {
            type: String,
            enum: ["Cleared", "Pending", "Bounced"],
            default: "Cleared"
        },
        notes: { type: String },

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

crmPaymentSchema.index({ company: 1, receiptNo: 1 });
crmPaymentSchema.index({ company: 1, customer: 1 });
crmPaymentSchema.index({ company: 1, paymentDate: -1 });

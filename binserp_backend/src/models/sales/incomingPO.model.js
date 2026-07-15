import mongoose from "mongoose";

export const incomingPOSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    poNumber: {
      type: String,
      required: true,
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    quotationReference: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Quotation",
    },
    items: [
      {
        fgItem: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "FGItem",
        },
        productName: { type: String, required: true },
        description: String,
        quantity: { type: Number, required: true, min: 1 },
        unit: { type: String, default: "PCS" },
        rate: { type: Number, required: true, min: 0 },
        amount: { type: Number, required: true, min: 0 },
        taxRate: { type: Number, default: 0 },
        taxAmount: { type: Number, default: 0 },
        expectedDeliveryDate: Date,
      },
    ],
    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    totalAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    status: {
      type: String,
      enum: ["Received", "Accepted", "Sales Order Generated", "Cancelled"],
      default: "Received",
    },
    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    pdf: {
      type: String,
    },
    remarks: {
      type: String,
    },
  },
  { timestamps: true }
);

// Indexes
incomingPOSchema.index({ company: 1, poNumber: 1, customer: 1 }, { unique: true });

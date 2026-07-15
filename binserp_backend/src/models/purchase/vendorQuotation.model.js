import mongoose from "mongoose";

export const vendorQuotationSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    quotationNumber: {
      type: String,
      required: true,
      unique: true,
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    vendorName: {
      type: String,
      required: true,
    },
    vendorAddress: String,
    items: [
      {
        materialName: String,
        description: String,
        quantity: Number,
        uom: String,
        unitPrice: Number,
        tax: Number,
        total: Number,
      },
    ],
    subtotal: Number,
    totalTax: Number,
    grandTotal: Number,
    validUntil: Date,
    status: {
      type: String,
      enum: ["Draft", "Pending Approval", "Approved", "Rejected"],
      default: "Draft",
    },
    termsAndConditions: String,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

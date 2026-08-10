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
    },
    rfq: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PurchaseRFQ",
    },
    rfqNumber: String,
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
    },
    vendorName: {
      type: String,
      required: true,
    },
    vendorAddress: String,
    vendorEmail: String,
    vendorPhone: String,
    vendorGst: String,
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    items: [
      {
        materialId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "RmBoItem",
        },
        materialName: String,
        description: String,
        quantity: Number,
        unit: String,
        uom: String,
        unitPrice: Number,
        tax: Number,
        total: Number,
        leadTimeDays: Number,
        remarks: String,
      },
    ],
    subtotal: Number,
    totalTax: Number,
    grandTotal: Number,
    validUntil: Date,
    status: {
      type: String,
      enum: ["Draft", "Pending Approval", "Approved", "Rejected"],
      default: "Pending Approval",
    },
    termsAndConditions: String,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

vendorQuotationSchema.index({ company: 1, quotationNumber: 1 }, { unique: true });

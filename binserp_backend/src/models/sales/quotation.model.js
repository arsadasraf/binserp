import mongoose from "mongoose";

export const quotationSchema = new mongoose.Schema(
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
    rfqNumber: String,
    rfq: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "IncomingRFQ",
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
    },
    customerName: {
      type: String,
      required: true,
    },
    customerAddress: String,
    customerEmail: String,
    customerPhone: String,
    items: [
      {
        material: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "RmBoItem",
        },
        component: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Component",
        },
        fgItem: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "FGItem",
        },
        productName: { type: String, required: true },
        quantity: { type: Number, required: true },
        unit: { type: String, default: "PCS" },
        rate: { type: Number, required: true },
        amount: { type: Number, required: true },
        taxRate: { type: Number, default: 0 },
        taxAmount: { type: Number, default: 0 },
        description: String,
      },
    ],
    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    otherDetails: String,
    preparedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    statusHistory: [
      {
        status: String,
        updatedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        updatedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    transportationType: { type: String, default: "Included" },
    transportationCharges: { type: Number, default: 0 },
    packagingType: { type: String, default: "Standard" },
    packagingCharges: { type: Number, default: 0 },
    attachedDocument: String,
    attachedDocumentName: String,
    status: {
      type: String,
      enum: ["Draft", "Pending Approval", "Approved", "Sent", "Accepted", "Rejected", "Closed"],
      default: "Draft",
    },
  },
  { timestamps: true }
);


// Indexes
quotationSchema.index({ company: 1, quotationNumber: 1 }, { unique: true });

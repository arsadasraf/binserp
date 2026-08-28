import mongoose from "mongoose";

export const invoiceSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    customerName: {
      type: String,
      required: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
    },
    customerPoReference: {
      type: String,
    },
    incomingPO: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "IncomingPO",
    },
    customerAddress: String,
    customerGST: String,
    currency: {
      type: String,
      default: "INR",
    },
    items: [
      {
        fgItem: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "FGItem",
        },
        material: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "RmBoItem",
        },
        component: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Component",
        },
        itemType: {
          type: String,
          default: "fg",
        },
        materialName: { type: String, required: true },
        hsnCode: String,
        quantity: { type: Number, required: true },
        unit: { type: String, default: "PCS" },
        rate: { type: Number, required: true },
        amount: { type: Number, required: true },
        taxRate: { type: Number, default: 0 },
        taxAmount: { type: Number, default: 0 },
      },
    ],
    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    transportationType: String,
    transportationCharges: { type: Number, default: 0 },
    vehicleNumber: String,
    packagingType: String,
    packagingCharges: { type: Number, default: 0 },
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
    status: {
      type: String,
      enum: ["Draft", "Sent", "Paid"],
      default: "Draft",
    },
  },
  { timestamps: true }
);

// Goods Receipt Note (GRN) Schema

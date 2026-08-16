import mongoose from "mongoose";

export const purchaseRFQSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    rfqNumber: {
      type: String,
      required: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    dueDate: Date,
    vendorName: String,
    vendorEmail: String,
    vendorPhone: String,
    vendorIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Vendor",
      }
    ],
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
        targetPrice: Number,
        remarks: String,
      },
    ],
    status: {
      type: String,
      enum: ["Draft", "Sent", "Quoted", "Closed"],
      default: "Sent",
    },
    remarks: String,
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
        status: { type: String, required: true },
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        updatedAt: { type: Date, default: Date.now },
      }
    ],
  },
  { timestamps: true }
);

purchaseRFQSchema.index({ company: 1, rfqNumber: 1 }, { unique: true });

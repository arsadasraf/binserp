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
    vendorEmail: String,
    vendorPhone: String,
    items: [
      {
        materialName: String,
        quantity: Number,
        uom: String,
        remarks: String,
      },
    ],
    status: {
      type: String,
      enum: ["Draft", "Sent", "Closed"],
      default: "Draft",
    },
    remarks: String,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

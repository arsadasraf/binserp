import mongoose from "mongoose";

export const storeMRPSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    storeOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StoreOrder",
    },
    fgItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FGItem",
      required: true,
    },
    requiredQuantity: {
      type: Number,
      required: true,
      min: 1,
    },
    dueDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["Pending", "Sent to Production"],
      default: "Pending",
    },
    remarks: {
      type: String,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

// Indexes
storeMRPSchema.index({ company: 1, status: 1 });
storeMRPSchema.index({ company: 1, fgItem: 1 });

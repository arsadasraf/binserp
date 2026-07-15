import mongoose from "mongoose";

export const storeOrderFulfillmentSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    storeOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SalesOrder",
      required: true,
    },
    fgItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FGItem",
      required: true,
    },
    orderedQuantity: {
      type: Number,
      required: true,
      min: 1,
    },
    reservedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    dispatchedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    mrpMovedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    targetDate: {
      type: Date,
    },
    status: {
      type: String,
      enum: ["Pending", "Partial", "Fulfilled", "Cancelled", "Moved MRP"],
      default: "Pending",
    },
    remarks: {
      type: String,
    },
  },
  { timestamps: true }
);

// Indexes for faster lookups
storeOrderFulfillmentSchema.index({ company: 1, storeOrder: 1 });
storeOrderFulfillmentSchema.index({ company: 1, fgItem: 1 });

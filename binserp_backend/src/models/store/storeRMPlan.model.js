import mongoose from "mongoose";

export const storeRMPlanSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    sourceMRP: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StoreMRP",
      required: true,
    },
    rmBoItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RmBoItem", // Assuming RM/BO items are in Material schema
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
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
    },
    poQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    poReference: {
      type: String,
    },
    status: {
      type: String,
      enum: ["Pending", "PO Created"],
      default: "Pending",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

// Indexes
storeRMPlanSchema.index({ company: 1, status: 1 });
storeRMPlanSchema.index({ company: 1, rmBoItem: 1 });

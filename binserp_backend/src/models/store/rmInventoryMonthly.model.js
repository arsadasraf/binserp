import mongoose from "mongoose";

export const rmInventoryMonthlySchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    material: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RmBoItem",
      required: true,
    },
    month: {
      type: String, // Format: YYYY-MM
      required: true,
    },
    openingStock: {
      type: Number,
      default: 0,
    },
    closingStock: {
      type: Number,
      default: 0,
    },
    totalInwardQuantity: {
      type: Number,
      default: 0,
    },
    totalOutwardQuantity: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Indexes
rmInventoryMonthlySchema.index({ company: 1, material: 1, month: 1 }, { unique: true });

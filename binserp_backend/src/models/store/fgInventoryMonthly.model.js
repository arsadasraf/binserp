import mongoose from "mongoose";

export const fgInventoryMonthlySchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    fgItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FGItem",
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
fgInventoryMonthlySchema.index({ company: 1, fgItem: 1, month: 1 }, { unique: true });

import mongoose from "mongoose";

export const priceListSchema = new mongoose.Schema(
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
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    taxRate: {
      type: Number,
      required: true,
      min: 0,
    },
    remarks: {
      type: String,
    },
  },
  { timestamps: true }
);

// Ensure unique index for fgItem per company, so one FG item has only one active price list entry
priceListSchema.index({ company: 1, fgItem: 1 }, { unique: true });

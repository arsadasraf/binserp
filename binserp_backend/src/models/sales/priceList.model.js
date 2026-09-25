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
    currency: {
      type: String,
      default: "INR",
      trim: true,
      uppercase: true,
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
    hsnCode: {
      type: String,
      required: false,
      trim: true,
    },
    pricingUnit: {
      type: String,
      trim: true,
      default: "",
    },
    isSecondaryUnit: {
      type: Boolean,
      default: false,
    },
    remarks: {
      type: String,
    },
  },
  { timestamps: true }
);

// Ensure unique index for fgItem per company, so one FG item has only one active price list entry
priceListSchema.index({ company: 1, fgItem: 1 }, { unique: true });

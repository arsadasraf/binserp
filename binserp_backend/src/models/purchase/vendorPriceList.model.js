import mongoose from "mongoose";

export const vendorPriceListSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
    },
    material: {
      type: mongoose.Schema.Types.ObjectId,
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
    validFrom: Date,
    validUntil: Date,
    isPreferred: {
      type: Boolean,
      default: false,
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
    remarks: String,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    createdByName: {
      type: String,
      trim: true,
      default: "",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updatedByName: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

import mongoose from "mongoose";

export const inventorySchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    materialCode: {
      type: String,
      required: true,
    },
    materialName: {
      type: String,
      required: true,
    },
    unit: {
      type: String,
      default: "PCS",
    },
    currentStock: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    qcPendingStock: {
      type: Number,
      default: 0,
      min: 0,
    },
    reorderLevel: {
      type: Number,
      default: 0,
    },
    reorderQuantity: {
      type: Number,
      default: 0,
    },
    unitPrice: {
      type: Number,
      default: 0,
    },
    location: {
      type: String,
    },
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Location",
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
    },
    materialId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Material",
    },
  },
  { timestamps: true }
);

// Material Request Schema

// Indexes
inventorySchema.index({ company: 1, materialCode: 1 }, { unique: true });

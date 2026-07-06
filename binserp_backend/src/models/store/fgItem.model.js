import mongoose from "mongoose";

const fgBOMItemSchema = new mongoose.Schema({
  // Can reference an RM (Material), another FGItem, or a PPC Component
  itemType: {
    type: String,
    enum: ["Material", "FGItem", "Component"], // RM = Material, FGItem = FGItem, PPC Component = Component
    required: true,
  },
  item: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: "bom.itemType",
  },
  itemName: { type: String, required: true },
  quantity: { type: Number, required: true },
  unit: { type: String, default: "Nos" },
});

export const fgItemSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["Component", "Sub Assembly", "Assembly"],
      required: true,
    },
    description: String,

    location: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Location",
    },
    unit: {
      type: String,
      default: "Nos",
    },
    quantity: {
      type: Number,
      default: 0,
    },
    reorderLevel: {
      type: Number,
      default: 0,
    },
    revisionNumber: {
      type: String,
    },
    photos: {
      type: [String],
      default: [],
    },
    bom: [fgBOMItemSchema],
  },
  { timestamps: true }
);

// Indexes
// Removed unique code index as code was removed.

import mongoose from "mongoose";

// Raw Material Schema
export const rawMaterialSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    name: { type: String, required: true },
    code: { type: String },
    descriptions: { type: String },
    minimumStock: { type: Number, default: 0 },
    unit: { type: String, default: "PCS", trim: true },
    hasSecondaryUnit: { type: Boolean, default: false },
    secondaryUnit: { type: String, trim: true, default: "" },
    conversionFactor: { type: Number, default: 1, min: 0 },
    hsnCode: { type: String, default: "", trim: true },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: false,
    },
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Location",
    },
    photos: {
      type: [String],
      validate: [
        (val) => val.length <= 2,
        '{PATH} exceeds the limit of 2'
      ]
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive', 'Deactivated'],
      default: 'Active',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    createdByName: {
      type: String,
      default: "System",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updatedByName: {
      type: String,
      default: "System",
    }
  },
  { timestamps: true }
);

// Indexes
rawMaterialSchema.index({ company: 1, name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });
rawMaterialSchema.index({ company: 1, code: 1 });

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
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
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
    }
  },
  { timestamps: true }
);

// Indexes
rawMaterialSchema.index({ company: 1, name: 1 }, { unique: true });
rawMaterialSchema.index({ company: 1, code: 1 });

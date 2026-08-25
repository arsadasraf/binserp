import mongoose from "mongoose";

// Bought Out Item Schema
export const boughtOutSchema = new mongoose.Schema(
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
boughtOutSchema.index({ company: 1, name: 1 }, { unique: true });
boughtOutSchema.index({ company: 1, code: 1 });

import mongoose from "mongoose";

// RM/BO Item Schema
export const rmBoItemSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    name: { type: String, required: true },
    itemType: {
      type: String,
      enum: ['Raw Material', 'Bought Out'],
      default: 'Raw Material'
    },
    descriptions: { type: String },
    minimumStock: { type: Number },
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
rmBoItemSchema.index({ company: 1, name: 1 }, { unique: true });

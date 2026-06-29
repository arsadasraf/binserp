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
    }
  },
  { timestamps: true }
);

// Indexes
rmBoItemSchema.index({ company: 1, name: 1 }, { unique: true });

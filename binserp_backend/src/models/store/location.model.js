import mongoose from "mongoose";

export const locationSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    name: { type: String, required: true },
    code: { type: String },
    description: String,
  },
  { timestamps: true }
);

// Category Master Schema

// Indexes
locationSchema.index({ company: 1, code: 1 }, { unique: true });

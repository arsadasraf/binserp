import mongoose from "mongoose";

export const machineCategorySchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    categoryCode: {
      type: String,
      required: true,
    },
    categoryName: {
      type: String,
      required: true,
    },
    hsnCode: { type: String },
    description: String,
  },
  { timestamps: true }
);

// Indexes
machineCategorySchema.index({ company: 1, categoryCode: 1 }, { unique: true });

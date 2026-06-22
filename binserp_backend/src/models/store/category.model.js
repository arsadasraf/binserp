import mongoose from "mongoose";

export const categorySchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    name: { type: String, required: true },
    code: { type: String },
    unit: { type: String, default: "PCS" },
    hsnCode: { type: String },
    description: { type: String, default: "" },
  },
  { timestamps: true }
);

// Material Master Schema

// Indexes
categorySchema.index({ company: 1, code: 1 }, { unique: true });

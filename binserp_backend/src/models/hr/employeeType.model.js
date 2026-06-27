import mongoose from "mongoose";

// Employee Type Schema
export const employeeTypeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
  },
  { timestamps: true }
);

employeeTypeSchema.index({ company: 1, name: 1 }, { unique: true });
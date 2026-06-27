import mongoose from "mongoose";

export const processSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    processCode: {
      type: String,
      required: true,
    },
    processName: {
      type: String,
      required: true,
    },
    description: String,
  },
  { timestamps: true }
);

// Indexes
processSchema.index({ company: 1, processCode: 1 }, { unique: true });

import mongoose from "mongoose";

export const shiftSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    startTime: {
      type: String, // HH:MM
      required: true,
    },
    endTime: {
      type: String, // HH:MM
      required: true,
    },
    description: String,
  },
  { timestamps: true }
);

// Indexes

// Indexes
shiftSchema.index({ company: 1, name: 1 }, { unique: true });

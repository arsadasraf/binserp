import mongoose from "mongoose";

export const manpowerSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    skills: [
      {
        name: { type: String, required: true },
        level: { type: Number, min: 1, max: 5 },
      },
    ],
    currentLoad: {
      type: Number,
      default: 0, // percentage or hours
    },
    availability: {
      type: Number,
      default: 100, // percentage
    },
    status: {
      type: String,
      enum: ["Available", "Busy", "OnLeave", "Absent"],
      default: "Available",
    },
  },
  { timestamps: true }
);

// Indexes
manpowerSchema.index({ company: 1, employee: 1 }, { unique: true });

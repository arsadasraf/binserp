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
    description: { type: String, default: "" },
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
categorySchema.index({ company: 1, name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });
categorySchema.index({ company: 1, code: 1 }, { unique: true });

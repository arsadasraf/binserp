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
    type: { type: String, enum: ['Rack', 'Bin', 'Bucket', 'Pallet', 'Table', 'Almirah', 'Shelf', 'Floor', 'Cabinet', 'Box', 'Container'], default: 'Rack' },
    description: String,
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
locationSchema.index({ company: 1, name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });
locationSchema.index({ company: 1, code: 1 }, { unique: true });

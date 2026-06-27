import mongoose from "mongoose";

export const machineLocationSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    locationCode: {
      type: String,
      required: true,
    },
    locationName: {
      type: String,
      required: true,
    },
    description: String,
  },
  { timestamps: true }
);




// Indexes
machineLocationSchema.index({ company: 1, locationCode: 1 }, { unique: true });

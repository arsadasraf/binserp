import mongoose from "mongoose";

export const routeCardSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    routeCardNumber: {
      type: String,
      required: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
    },
    productCode: {
      type: String,
      required: true,
    },
    productName: {
      type: String,
      required: true,
    },
    bom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BOM",
    },
    operations: [
      {
        operationName: { type: String, required: true },
        sequence: { type: Number, required: true },
        machineType: { type: String, required: true },
        standardTime: { type: Number, required: true }, // in minutes
        manpowerRequired: { type: Number, default: 1 },
        skillsRequired: [{ type: String }],
        description: String,
        isJobWork: { type: Boolean, default: false }, // NEW: Flag for Job Work
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    status: {
      type: String,
      enum: ["Draft", "Active", "Inactive"],
      default: "Draft",
    },
  },
  { timestamps: true }
);

// Indexes
routeCardSchema.index({ company: 1, routeCardNumber: 1 }, { unique: true });

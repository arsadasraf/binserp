import mongoose from "mongoose";

export const materialRequirementSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PPCOrder", // Link to PPC Order
      required: true,
    },
    targetMonth: String, // For grouping requirements by month
    items: [
      {
        material: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "RmBoItem", // From Store Module
        },
        component: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Component", // Inhouse Item
        },
        materialName: String,
        requiredQuantity: { type: Number, required: true },
        unit: String,
        stockAvailable: { type: Number, default: 0 }, // Snapshot at time of calculation
        shortage: { type: Number, default: 0 },
        prQuantity: { type: Number, default: 0 },
        status: {
          type: String,
          enum: ["Pending", "PR Raised", "Fulfilled"],
          default: "Pending"
        }
      }
    ],
    status: {
      type: String,
      enum: ["Draft", "Finalized"],
      default: "Draft"
    }
  },
  { timestamps: true }
);

// Indexes


// Indexes
materialRequirementSchema.index({ company: 1, order: 1 });
materialRequirementSchema.index({ company: 1, targetMonth: 1 });

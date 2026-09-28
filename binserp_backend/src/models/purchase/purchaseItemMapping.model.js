import mongoose from "mongoose";

export const purchaseItemMappingSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    // The source BOM cut-size item
    sourceItemId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    sourceItemType: {
      type: String,
      enum: ["RM", "BO", "Material", "RawMaterial", "BoughtOut"],
      required: true,
    },
    sourceItemName: {
      type: String,
      required: true,
      trim: true,
    },
    sourceItemCode: {
      type: String,
      trim: true,
      default: "",
    },
    sourceItemDescription: {
      type: String,
      default: "",
    },

    // The target purchasable bucket item (e.g. standard sheet, coil, bar)
    targetPurchaseItemId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    targetPurchaseItemType: {
      type: String,
      enum: ["RM", "BO", "Material", "RawMaterial", "BoughtOut"],
      required: true,
    },
    targetPurchaseItemName: {
      type: String,
      required: true,
      trim: true,
    },
    targetPurchaseItemCode: {
      type: String,
      trim: true,
      default: "",
    },
    targetPurchaseItemDescription: {
      type: String,
      default: "",
    },

    // Strictly matched Units
    primaryUnit: {
      type: String,
      required: true,
      trim: true,
    },
    hasSecondaryUnit: {
      type: Boolean,
      default: false,
    },
    secondaryUnit: {
      type: String,
      trim: true,
      default: "",
    },
    conversionFactor: {
      type: Number,
      default: 1,
    },

    // Optional scope: default for all plans vs specific mrpPlan
    isDefault: {
      type: Boolean,
      default: true,
    },
    mrpPlanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MRPPlan",
      default: null,
    },
    // Explicitly detached / unmapped for a specific MRP plan
    isDetached: {
      type: Boolean,
      default: false,
      index: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    createdByName: {
      type: String,
      default: "System",
    },
  },
  { timestamps: true }
);

// Compound index to ensure uniqueness per company + source item
purchaseItemMappingSchema.index({ company: 1, sourceItemId: 1, mrpPlanId: 1 }, { unique: true });

import mongoose from "mongoose";

export const bomSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    bomNumber: {
      type: String,
      required: true,
      unique: true,
    },
    productName: {
      type: String,
      required: true,
    },
    productCode: String,
    version: {
      type: String,
      default: "1.0",
    },
    description: String,
    items: [
      {
        material: { type: mongoose.Schema.Types.ObjectId, ref: "RmBoItem" },
        materialName: { type: String, required: true },
        materialCode: String,
        quantity: { type: Number, required: true },
        unit: { type: String, default: "KG" },
        hasSecondaryUnit: { type: Boolean, default: false },
        secondaryUnit: { type: String, default: "" },
        conversionFactor: { type: Number, default: 1 },
        secondaryQuantity: { type: Number, default: 0 },
        description: String,
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

try {
  if (!mongoose.models.BOM) {
    mongoose.model("BOM", bomSchema);
  }
} catch (e) {}

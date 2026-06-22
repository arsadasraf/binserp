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
        materialName: { type: String, required: true },
        materialCode: String,
        quantity: { type: Number, required: true },
        unit: { type: String, default: "PCS" },
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

// Inventory Schema

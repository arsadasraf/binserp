import mongoose from "mongoose";

export const purchaseOrderSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    poNumber: {
      type: String,
      required: true,
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
    },
    // Support both single material and items array
    material: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Material",
    },
    component: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Component",
    },
    materialName: String,
    quantity: Number,
    unit: String,
    rate: Number,
    amount: Number,
    category: String,
    items: [
      {
        material: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Material",
        },
        component: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Component",
        },
        itemType: {
          type: String,
          enum: ["bo", "custom"],
          default: "bo",
        },
        materialName: { type: String, required: true },
        quantity: { type: Number, required: true },
        unit: { type: String, default: "PCS" },
        rate: { type: Number, required: true },
        amount: { type: Number, required: true },
      },
    ],
    totalAmount: { type: Number, required: true },
    status: {
      type: String,
      enum: ["Draft", "Released", "Completed", "Cancelled"],
      default: "Released",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

// Indexes
purchaseOrderSchema.index({ company: 1, poNumber: 1 }, { unique: true });

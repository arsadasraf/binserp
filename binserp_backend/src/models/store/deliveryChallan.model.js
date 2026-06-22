import mongoose from "mongoose";

export const deliveryChallanSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    dcNumber: {
      type: String,
      required: true,
      unique: true,
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    customerName: {
      type: String,
      required: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
    },
    customerAddress: String,
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
        materialName: { type: String, required: true },
        hsnCode: String,
        quantity: { type: Number, required: true },
        unit: { type: String, default: "PCS" },
        rate: Number, // Optional for DC
        amount: Number, // Optional for DC
        description: String,
      },
    ],
    preparedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    discount: { type: Number, default: 0 },
    otherDetails: String,
    status: {
      type: String,
      enum: ["Draft", "Issued", "Delivered"],
      default: "Draft",
    },
  },
  { timestamps: true }
);

// Invoice Schema

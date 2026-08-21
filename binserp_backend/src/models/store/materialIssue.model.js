import mongoose from "mongoose";

export const materialIssueSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    issueNumber: {
      type: String,
      required: true,
      unique: true,
    },
    type: {
      type: String,
      enum: ['bo', 'inhouse', 'consumable'],
      default: 'bo'
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    department: {
      type: String,
      required: true,
    },
    issuedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    mrpPlan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MRPPlan",
    },
    mrpNumber: {
      type: String,
    },
    items: [
      {
        material: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "RmBoItem",
        },
        consumable: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "ConsumableItem",
        },
        component: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Component",
        },
        materialCode: String,
        materialName: { type: String, required: true },
        quantity: { type: Number, required: true },
        unit: { type: String, default: "PCS" },
        purpose: String,
        description: String,
      },
    ],
    issuedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    status: {
      type: String,
      enum: ["Draft", "Issued", "Returned"],
      default: "Draft",
    },
  },
  { timestamps: true }
);

// Bill of Material (BOM) Schema

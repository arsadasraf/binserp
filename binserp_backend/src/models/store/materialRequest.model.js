import mongoose from "mongoose";

export const materialRequestSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    requestNumber: {
      type: String,
      required: true,
      unique: true,
    },
    type: {
      type: String,
      enum: ['bo', 'inhouse', 'consumable'],
      default: 'bo'
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    salesOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SalesOrder",
    },
    department: {
      type: String,
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
        materialCode: { type: String },
        materialName: { type: String, required: true },
        component: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Component"
        },
        quantity: { type: Number, required: true },
        unit: { type: String, default: "PCS" },
        purpose: String,
      },
    ],
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected", "Issued"],
      default: "Pending",
    },
    priority: {
      type: String,
      enum: ["Low", "Medium", "High", "Urgent"],
      default: "Medium",
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    remarks: String,
  },
  { timestamps: true }
);

materialRequestSchema.index({ company: 1, requestNumber: 1 });

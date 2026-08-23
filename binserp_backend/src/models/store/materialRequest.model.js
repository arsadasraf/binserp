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
      enum: ['rm', 'bo', 'consumable', 'fg', 'inhouse', 'raw-material', 'bought-out'],
      default: 'rm'
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
    soNumber: {
      type: String,
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
        fgItem: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "FGItem",
        },
        component: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Component"
        },
        itemType: {
          type: String,
          enum: ['Raw Material', 'Bought Out', 'Consumable', 'FG Item', 'Inhouse Component'],
          default: 'Raw Material'
        },
        materialCode: { type: String },
        materialName: { type: String, required: true },
        quantity: { type: Number, required: true },
        unit: { type: String, default: "PCS" },
        currentStock: { type: Number, default: 0 },
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
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    createdByName: {
      type: String,
      default: "System",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updatedByName: {
      type: String,
      default: "System",
    }
  },
  { timestamps: true }
);

materialRequestSchema.index({ company: 1, requestNumber: 1 });

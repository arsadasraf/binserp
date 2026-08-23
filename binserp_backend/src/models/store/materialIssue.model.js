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
      enum: ['rm', 'bo', 'consumable', 'fg', 'inhouse', 'raw-material', 'bought-out'],
      default: 'rm'
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
        fgItem: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "FGItem",
        },
        component: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Component",
        },
        itemType: {
          type: String,
          enum: ['Raw Material', 'Bought Out', 'Consumable', 'FG Item', 'Inhouse Component'],
          default: 'Raw Material'
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

materialIssueSchema.index({ company: 1, issueNumber: 1 });

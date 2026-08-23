import mongoose from "mongoose";

export const grnSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    type: {
      type: String,
      enum: ['rm', 'bo', 'consumable', 'fg', 'inhouse', 'raw-material', 'bought-out'],
      default: 'rm'
    },
    grnNumber: {
      type: String,
      required: true,
      unique: true,
    },
    qcRequired: {
      type: Boolean,
      default: false
    },
    qcStatus: {
      type: String,
      enum: ["Pending", "Partial", "Completed", "Skipped"],
      default: "Skipped"
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    supplierName: {
      type: String,
    },
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
    },
    supplierAddress: String,
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer"
    },
    purchaseOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PurchaseOrder",
    },
    poNumber: String,
    poReference: String,
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
        materialName: { type: String, required: true },
        quantity: { type: Number, required: true },
        unit: { type: String, default: "PCS" },
        rate: { type: Number, default: 0 },
        receivedQuantity: { type: Number },
        acceptedQuantity: { type: Number },
        rejectedQuantity: { type: Number, default: 0 },
        locationId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Location",
        },
        description: String,
      },
    ],
    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    pdf: String,
    photos: {
      type: [String],
      default: []
    },
    status: {
      type: String,
      enum: ["Draft", "Received", "Accepted", "Rejected"],
      default: "Received",
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

grnSchema.index({ company: 1, grnNumber: 1 });

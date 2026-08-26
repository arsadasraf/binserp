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
      ref: "RmBoItem",
    },
    component: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Component",
    },
    materialName: String,
    quantity: Number,
    receivedQuantity: { type: Number, default: 0 },
    pendingQuantity: Number,
    unit: String,
    rate: Number,
    amount: Number,
    description: String,
    quotation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "VendorQuotation",
    },
    quotationNumber: String,
    rfqNumber: String,
    transportType: String,
    transportCharge: { type: Number, default: 0 },
    packingType: String,
    packingCharge: { type: Number, default: 0 },
    subtotal: Number,
    totalTax: Number,
    grandTotal: Number,
    remarks: String,
    items: [
      {
        material: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "RmBoItem",
        },
        component: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Component",
        },
        itemType: {
          type: String,
          enum: ["rm", "bo", "consumable", "raw_material", "bought_out", "component", "subassembly", "assembly", "custom"],
          default: "rm",
        },
        materialName: { type: String, required: true },
        description: String,
        quantity: { type: Number, required: true },
        receivedQuantity: { type: Number, default: 0 },
        pendingQuantity: { type: Number },
        itemStatus: {
          type: String,
          enum: ["Pending", "Partially Received", "Completed"],
          default: "Pending",
        },
        unit: { type: String, default: "PCS" },
        rate: { type: Number, required: true },
        taxRate: { type: Number, default: 18 },
        taxAmount: { type: Number, default: 0 },
        amount: { type: Number, required: true },
      },
    ],
    totalAmount: { type: Number, required: true },
    status: {
      type: String,
      enum: ["Draft", "Released", "Approved", "Partially Received", "Completed", "Cancelled"],
      default: "Released",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    createdByName: String,
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updatedByName: String,
    history: [
      {
        status: String,
        updatedBy: String,
        updatedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true, strict: false }
);

// Indexes
purchaseOrderSchema.index({ company: 1, poNumber: 1 }, { unique: true });

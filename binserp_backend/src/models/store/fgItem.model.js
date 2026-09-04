import mongoose from "mongoose";

const fgBOMItemSchema = new mongoose.Schema({
  // Can reference an RM (Material / RawMaterial), BoughtOut, another FGItem, or a PPC Component
  itemType: {
    type: String,
    enum: ["Material", "RawMaterial", "BoughtOut", "FGItem", "Component"],
    required: true,
  },
  item: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: "itemType",
  },
  itemName: { type: String, required: true },
  quantity: { type: Number, required: true },
  unit: { type: String, default: "Nos" },
});

export const fgItemSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      enum: ["Component", "Sub Assembly", "Assembly"],
      default: "Component",
      required: true,
    },
    description: String,
    isActive: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive', 'Deactivated'],
      default: 'Active',
    },

    location: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Location",
    },
    unit: {
      type: String,
      default: "Nos",
      trim: true,
    },
    hsnCode: {
      type: String,
      default: "",
      trim: true,
    },
    quantity: {
      type: Number,
      default: 0,
    },
    allocatedQuantity: {
      type: Number,
      default: 0,
    },
    allocations: [
      {
        salesOrder: { type: mongoose.Schema.Types.ObjectId, ref: "SalesOrder" },
        salesOrderNo: { type: String },
        customerName: { type: String },
        allocatedQty: { type: Number, required: true },
        allocatedAt: { type: Date, default: Date.now }
      }
    ],
    reorderLevel: {
      type: Number,
      default: 0,
    },
    revisionNumber: {
      type: String,
      default: "",
      trim: true,
    },
    photos: {
      type: [String],
      default: [],
    },
    bom: [fgBOMItemSchema],
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
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

fgItemSchema.virtual("availableQuantity").get(function () {
  return Math.max(0, (this.quantity || 0) - (this.allocatedQuantity || 0));
});

// Indexes: Compound uniqueness on Name and Revision per Company
fgItemSchema.index(
  { company: 1, name: 1, revisionNumber: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } }
);

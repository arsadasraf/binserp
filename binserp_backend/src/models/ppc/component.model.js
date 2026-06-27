import mongoose from "mongoose";

export const componentSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    po: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      // required: true, // Made optional for Master creation
    },
    componentCode: {
      type: String,
      required: true,
    },
    componentName: {
      type: String,
      required: true,
    },
    type: { // Added for Master Product Tab
      type: String,
      enum: ["Component", "SubAssembly", "Assembly"],
      default: "Component"
    },
    trackingType: {
      type: String,
      enum: ["Individual", "Batch"],
      default: "Individual"
    },
    isInventoryItem: {
      type: Boolean,
      default: false
    },
    description: String,
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
    },
    location: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Location",
    },
    unit: String,
    quantity: {
      type: Number,
      // required: true, // Made optional
      // min: 1,
    },
    price: {
      type: Number,
      default: 0
    },
    routeCard: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RouteCard",
    },
    status: {
      type: String,
      enum: ["Pending", "InProgress", "Completed", "OnHold"],
      default: "Pending",
    },
    completionPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    completedQuantity: {
      type: Number,
      default: 0,
    },
    remarks: String,
    billOfMaterials: [
      {
        item: {
          type: mongoose.Schema.Types.ObjectId,
          required: true,
          refPath: 'billOfMaterials.itemModel'
        },
        itemModel: {
          type: String,
          required: true,
          enum: ['Material', 'Component'] // Material from Store, Component from PPC
        },
        itemName: String, // Snapshot for easier display
        quantity: { type: Number, required: true },
        unit: String
      }
    ],
    routing: [
      {
        machine: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Machine',
        },
        process: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Process'
        },
        processName: String, // Snapshot or custom overlay
        standardTime: { type: Number, required: true }, // in minutes
        qcRequired: { type: Boolean, default: false },
        isOutsourced: { type: Boolean, default: false }, // New field for In-house vs Jobwork
        description: String,
        requiredItems: [
          {
            item: {
              type: mongoose.Schema.Types.ObjectId,
              required: true,
              refPath: 'routing.requiredItems.itemModel'
            },
            itemModel: {
              type: String,
              required: true,
              enum: ['Material', 'Component']
            },
            itemName: String, // Snapshot
            quantity: { type: Number, required: true },
            unit: String
          }
        ],
        photos: [String] // Per-process photos
      }
    ],
    photos: [String] // Added for Product Photos
  },
  { timestamps: true }
);

// Indexes
componentSchema.index({ company: 1, po: 1 });
componentSchema.index({ company: 1, componentCode: 1 });

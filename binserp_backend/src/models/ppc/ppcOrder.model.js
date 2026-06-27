import mongoose from "mongoose";

export const ppcOrderSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    orderNumber: {
      type: String,
      required: true,
    },
    poReference: {
      type: String,
      required: true,
    },
    targetMonth: {
      type: String, // "MM-YYYY"
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
    },
    customerName: String,
    photos: [String], // Added for Order Photos
    date: {
      type: Date,
      default: Date.now,
    },
    deliveryDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["Pending", "Confirmed", "Planning", "InProduction", "InProgress", "Completed", "Dispatched", "Cancelled"],
      default: "Pending",
    },
    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Component", // Master Component
        },
        productName: String,
        productCode: String,
        description: String,
        unit: String,
        price: {
          type: Number,
          default: 0,
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
        trackingType: {
          type: String,
          enum: ["Individual", "Batch"],
          default: "Individual",
        },
        targetDate: {
          type: Date,
        },
        // Snapshots
        bomSnapshot: [],
        processSnapshot: [],
        photosSnapshot: [String],
        // Linked Jobs (Traceability IDs)
        jobs: [
          {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Job",
          },
        ],
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    remarks: String,
  },
  { timestamps: true }
);

// Indexes


// Indexes
ppcOrderSchema.index({ company: 1, orderNumber: 1 }, { unique: true });

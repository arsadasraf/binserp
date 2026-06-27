import mongoose from "mongoose";

export const orderSchema = new mongoose.Schema(
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
    customerName: {
      type: String,
      required: true,
    },
    poReference: { type: String }, // NEW: PO Reference
    productCode: {
      type: String,
      required: true,
    },
    productName: {
      type: String,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    dispatchDate: {
      type: Date,
      required: true,
    },
    priority: {
      type: String,
      enum: ["Low", "Medium", "High", "Urgent"],
      default: "Medium",
    },
    photos: [{ type: String }], // Order Photos
    status: {
      type: String,
      enum: ["Pending", "Planning", "InProgress", "Completed", "Dispatched", "Cancelled"],
      default: "Pending",
    },
    bom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BOM",
    },
    routeCard: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RouteCard",
    },
    components: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Component",
      },
    ],
    // Link to Jobs/WorkOrders (Unique Items)
    jobs: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Job"
      }
    ],
    completionPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    remarks: String,
  },
  { timestamps: true }
);



// Indexes
orderSchema.index({ company: 1, orderNumber: 1 }, { unique: true });

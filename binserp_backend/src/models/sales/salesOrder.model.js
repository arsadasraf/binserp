import mongoose from "mongoose";

function arrayLimit(val) {
  return val.length <= 3;
}


export const salesOrderSchema = new mongoose.Schema(
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
    },
    orderType: {
      type: String,
      enum: ["PO_BASED", "DIRECT"],
      default: "DIRECT",
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
    },
    targetDate: {
      type: Date,
      required: true,
    },
    items: [
      {
        fgItem: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "FGItem",
        },
        type: { type: String, default: "FGItem" },
        name: { type: String, required: true },
        description: String,
        quantity: { type: Number, required: true, min: 1 },
        pricePerQuantity: { type: Number, required: true, min: 0 },
        totalPrice: { type: Number, required: true, min: 0 },
        targetDate: { type: Date },
        dispatchDate: { type: Date },
        dispatchedQuantity: { type: Number, default: 0 },
        allocatedFgQty: { type: Number, default: 0 },
      },
    ],
    allocatedFgQty: {
      type: Number,
      default: 0,
    },
    fulfillmentStatus: {
      type: String,
      enum: ["Pending", "Partially Allocated", "Fully Allocated", "Items Allocated", "In Production", "Ready for Dispatch", "Moved to MRP", "Moved MRP", "Dispatched", "Completed"],
      default: "Pending",
    },
    mrpId: String,
    workOrderIds: [{ type: String }],
    totalAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    status: {
      type: String,
      enum: ["Pending", "Items Allocated", "In-Progress", "Partially Dispatched", "Dispatched", "Completed", "Cancelled", "Moved MRP", "Moved to MRP"],
      default: "Pending",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    isPlanned: {
      type: Boolean,
      default: false,
    },
    pdf: {
      type: String,
    },
    photos: {
      type: [String],
      validate: [arrayLimit, 'Photos cannot exceed the limit of 3'],
    },
    remarks: {
      type: String,
    },
  },
  { timestamps: true }
);

// Indexes
salesOrderSchema.index({ company: 1, orderNumber: 1 }, { unique: true });

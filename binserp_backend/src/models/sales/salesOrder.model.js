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
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
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
          required: true,
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
      },
    ],
    totalAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    status: {
      type: String,
      enum: ["Pending", "In-Progress", "Partially Dispatched", "Dispatched", "Completed", "Cancelled", "Moved MRP"],
      default: "Pending",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
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

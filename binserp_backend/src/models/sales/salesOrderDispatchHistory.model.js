import mongoose from "mongoose";

export const salesOrderDispatchHistorySchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    salesOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SalesOrder",
      required: true,
    },
    dispatchNumber: {
      type: String,
      required: true,
    },
    dispatchDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    items: [
      {
        fgItem: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "FGItem",
          required: true,
        },
        dispatchedQuantity: {
          type: Number,
          required: true,
          min: 1,
        },
        remarks: {
          type: String,
        },
      },
    ],
    pdf: {
      type: String,
    },
    photos: {
      type: [String],
    },
    vehicleNumber: {
      type: String,
    },
    driverName: {
      type: String,
    },
    remarks: {
      type: String,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

// Indexes
salesOrderDispatchHistorySchema.index({ company: 1, dispatchNumber: 1 }, { unique: true });
salesOrderDispatchHistorySchema.index({ salesOrder: 1 });

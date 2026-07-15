import mongoose from "mongoose";

export const incomingRFQSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    rfqNumber: {
      type: String,
      required: true,
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    customerName: {
      type: String,
      required: true,
    },
    customerEmail: String,
    customerPhone: String,
    items: [
      {
        itemType: {
          type: String,
          enum: ["FGItem", "Custom"],
          required: true,
          default: "Custom",
        },
        fgItem: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "FGItem",
        },
        customItemName: {
          type: String,
        },
        quantity: { type: Number, required: true },
        unit: { type: String, default: "PCS" },
        description: String,
        targetPrice: Number,
      },
    ],
    expectedDeliveryDate: Date,
    remarks: String,
    status: {
      type: String,
      enum: ["Open", "Quoted", "Closed", "Rejected"],
      default: "Open",
    },
    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    pdf: String,
  },
  { timestamps: true }
);

// Indexes
incomingRFQSchema.index({ company: 1, rfqNumber: 1 }, { unique: true });

import mongoose from "mongoose";

export const fgGRNSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    grnNumber: {
      type: String,
      required: true,
      unique: true,
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
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
    items: [
      {
        fgItem: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "FGItem",
          required: true,
        },
        itemName: { type: String, required: true },
        quantity: { type: Number, required: true },
        unit: { type: String, default: "Nos" },
        receivedQuantity: { type: Number }, 
        acceptedQuantity: { type: Number },
        rejectedQuantity: { type: Number, default: 0 },
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
      default: "Draft",
    },
    remarks: String,
  },
  { timestamps: true }
);

// Indexes
fgGRNSchema.index({ company: 1, grnNumber: 1 }, { unique: true });

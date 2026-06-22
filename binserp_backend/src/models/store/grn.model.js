import mongoose from "mongoose";

export const grnSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    type: {
      type: String,
      enum: ['bo', 'inhouse'],
      default: 'bo'
    },
    grnNumber: {
      type: String,
      required: true,
      unique: true,
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
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    supplierName: {
      type: String,
      // required: true, // Made optional for InHouse
    },
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
    },
    supplierAddress: String,
    customer: { // For InHouse GRN
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer"
    },
    poNumber: String, // Linked Purchase Order Number (System)
    poReference: String, // Manual PO Reference Number
    items: [
      {
        material: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Material",
        },
        component: { // For InHouse GRN
          type: mongoose.Schema.Types.ObjectId,
          ref: "Component"
        },
        materialName: { type: String, required: true }, // Used for both Material and Component Name
        quantity: { type: Number, required: true },
        unit: { type: String, default: "PCS" },
        rate: { type: Number },
        receivedQuantity: { type: Number }, // Optional - defaults to quantity
        acceptedQuantity: { type: Number },
        rejectedQuantity: { type: Number, default: 0 },
        description: String,
      },
    ],
    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    pdf: String, // URL to uploaded PDF
    photos: {
      type: [String], // URLs for camera/photo-based GRN
      default: []
    },
    status: {
      type: String,
      enum: ["Draft", "Received", "Accepted", "Rejected"],
      default: "Draft",
    },
  },
  { timestamps: true }
);

// Material Issue Schema

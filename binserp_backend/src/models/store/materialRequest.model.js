import mongoose from "mongoose";

export const materialRequestSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    requestNumber: {
      type: String,
      required: true,
      unique: true,
    },
    type: { // Added type field
      type: String,
      enum: ['bo', 'inhouse'],
      default: 'bo'
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    department: {
      type: String,
      // required: true, // Made optional as per refactoring
    },
    items: [
      {
        material: { // Added reference to Material
          type: mongoose.Schema.Types.ObjectId,
          ref: "Material",
        },
        materialCode: { type: String }, // Optional for Inhouse
        materialName: { type: String, required: true },
        component: { // Link to Component (Inhouse Item)
          type: mongoose.Schema.Types.ObjectId,
          ref: "Component"
        },
        quantity: { type: Number, required: true },
        unit: { type: String, default: "PCS" },
        purpose: String,
      },
    ],
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected", "Issued"],
      default: "Pending",
    },
    priority: {
      type: String,
      enum: ["Low", "Medium", "High", "Urgent"],
      default: "Medium",
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    remarks: String,
  },
  { timestamps: true }
);

// Purchase Order (PO) Schema

// Indexes
materialRequestSchema.index({ company: 1, requestNumber: 1 });

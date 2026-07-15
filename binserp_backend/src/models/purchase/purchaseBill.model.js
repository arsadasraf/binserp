import mongoose from "mongoose";

export const purchaseBillSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    billNumber: {
      type: String,
      required: true,
      unique: true,
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    vendorName: {
      type: String,
      required: true,
    },
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
    },
    poReference: String,
    grnReference: String,
    items: [
      {
        materialName: String,
        quantity: Number,
        uom: String,
        unitPrice: Number,
        tax: Number,
        total: Number,
      },
    ],
    subtotal: Number,
    totalTax: Number,
    grandTotal: Number,
    status: {
      type: String,
      enum: ["Draft", "Pending", "Paid", "Cancelled"],
      default: "Draft",
    },
    paymentTerms: String,
    dueDate: Date,
    remarks: String,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

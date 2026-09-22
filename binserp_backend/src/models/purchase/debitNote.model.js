import mongoose from "mongoose";

export const debitNoteSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    debitNoteNumber: {
      type: String,
      required: true,
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
    },
    vendorName: {
      type: String,
      required: true,
    },
    debitNoteType: {
      type: String,
      enum: [
        "Material Rejection (RTV)",
        "Job Work Damage",
        "Service Cancellation",
        "Rate Difference",
        "Other",
      ],
      default: "Material Rejection (RTV)",
    },
    originalGrn: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GRN",
    },
    originalGrnNumber: String,
    originalJobWork: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JobWorkChallan",
    },
    originalJobWorkNumber: String,
    originalBill: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PurchaseBill",
    },
    originalBillNumber: String,
    mrbTicket: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MRBDisposition",
    },
    mrbTicketNumber: String,
    deliveryChallan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeliveryChallan",
    },
    deliveryChallanNumber: String,
    items: [
      {
        materialId: mongoose.Schema.Types.ObjectId,
        materialName: String,
        materialDescription: String,
        quantity: { type: Number, required: true },
        unit: { type: String, default: "PCS" },
        unitRate: { type: Number, default: 0 },
        taxRate: { type: Number, default: 18 },
        taxableAmount: { type: Number, default: 0 },
        cgst: { type: Number, default: 0 },
        sgst: { type: Number, default: 0 },
        igst: { type: Number, default: 0 },
        totalAmount: { type: Number, default: 0 },
        rejectionReason: String,
      },
    ],
    subtotal: { type: Number, default: 0 },
    totalTax: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["Draft", "Issued", "Settled", "Cancelled"],
      default: "Issued",
      index: true,
    },
    remarks: String,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    createdByName: String,
  },
  { timestamps: true }
);

debitNoteSchema.index({ company: 1, debitNoteNumber: 1 }, { unique: true });

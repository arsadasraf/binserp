import mongoose from "mongoose";

export const incomingPOSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    poNumber: {
      type: String,
      required: true,
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    quotationReference: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Quotation",
    },
    currency: {
      type: String,
      default: "INR",
    },
    items: [
      {
        fgItem: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "FGItem",
        },
        productName: { type: String, required: true },
        hsnCode: { type: String, trim: true },
        description: String,
        quantity: { type: Number, required: true, min: 1 },
        unit: { type: String, default: "PCS" },
        rate: { type: Number, required: true, min: 0 },
        amount: { type: Number, required: true, min: 0 },
        taxRate: { type: Number, default: 0 },
        taxAmount: { type: Number, default: 0 },
        expectedDeliveryDate: Date,
        committedDeliveryDate: Date,
        dispatchedQuantity: { type: Number, default: 0 },
        billedQuantity: { type: Number, default: 0 },
        plannedQuantity: { type: Number, default: 0 },
        linkedMrps: [
          {
            mrpPlan: { type: mongoose.Schema.Types.ObjectId, ref: "MRPPlan" },
            mrpNumber: { type: String, default: "" },
            quantity: { type: Number, default: 0 },
            plannedAt: { type: Date, default: Date.now },
          }
        ],
        deliverySchedule: [
          {
            monthKey: { type: String, required: true }, // e.g. "2026-10"
            monthLabel: { type: String },              // e.g. "Oct 2026"
            quantity: { type: Number, required: true, min: 0 },
            plannedQuantity: { type: Number, default: 0 },
            targetDate: { type: Date },
            notes: { type: String, default: "" },
            isPlanned: { type: Boolean, default: false },
            mrpPlan: { type: mongoose.Schema.Types.ObjectId, ref: "MRPPlan" },
            mrpNumber: { type: String, default: "" },
            linkedMrps: [
              {
                mrpPlan: { type: mongoose.Schema.Types.ObjectId, ref: "MRPPlan" },
                mrpNumber: { type: String, default: "" },
                quantity: { type: Number, default: 0 },
                plannedAt: { type: Date, default: Date.now },
              }
            ],
          }
        ],
      },
    ],
    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    totalAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    status: {
      type: String,
      enum: ["Received", "Accepted", "Partially Planned", "MRP Done", "Partially Dispatched", "Completed", "Cancelled"],
      default: "Received",
    },
    mrpPlan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MRPPlan",
    },
    mrpNumber: {
      type: String,
    },
    acknowledgementNumber: {
      type: String,
    },
    acknowledgementDate: {
      type: Date,
    },
    committedDispatchDate: {
      type: Date,
    },
    acknowledgementRemarks: {
      type: String,
    },
    acknowledgementTerms: {
      type: String,
    },
    acknowledgedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    statusHistory: [
      {
        status: String,
        updatedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        updatedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    pdf: {
      type: String,
    },
    photos: [{
      type: String,
    }],
    remarks: {
      type: String,
    },
    transportationMethod: {
      type: String,
    },
    transportationCharges: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Indexes
incomingPOSchema.index({ company: 1, poNumber: 1, customer: 1 }, { unique: true });
incomingPOSchema.index({ company: 1, acknowledgementNumber: 1 });


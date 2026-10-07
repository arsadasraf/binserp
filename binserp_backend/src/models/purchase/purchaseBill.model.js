import mongoose from "mongoose";

export const purchaseBillSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    billNumber: {
      type: String,
      required: true,
      trim: true,
    },
    supplierInvoiceNumber: {
      type: String,
      trim: true,
      default: "",
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    vendorName: {
      type: String,
      required: true,
      trim: true,
    },
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      index: true,
    },
    vendorAddress: {
      type: String,
      default: "",
    },
    vendorGst: {
      type: String,
      default: "",
    },

    // GRN & PO Linkage
    poReference: {
      type: String,
      default: "",
    },
    poNumber: {
      type: String,
      default: "",
    },
    grnReference: {
      type: String,
      default: "",
    },
    grnNumber: {
      type: String,
      index: true,
      default: "",
    },
    grn: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GRN",
      index: true,
    },
    grnCategory: {
      type: String,
      enum: ["rm", "raw-material", "bo", "bought-out", "consumable", "consumables", "other"],
      default: "rm",
      index: true,
    },
    billType: {
      type: String,
      enum: ["material", "job-work-service"],
      default: "material",
    },
    jobWorkChallan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JobWorkChallan",
    },
    jobWorkChallanNumber: String,

    // Line items with description per AGENTS.md standard
    items: [
      {
        material: { type: mongoose.Schema.Types.ObjectId, ref: "RawMaterial" },
        consumable: { type: mongoose.Schema.Types.ObjectId, ref: "Consumable" },
        materialName: { type: String, required: true },
        description: { type: String, default: "" }, // Technical description per AGENTS.md
        hsnCode: { type: String, default: "" },
        quantity: { type: Number, required: true, default: 0, min: 0 },
        unit: { type: String, default: "PCS" },
        secondaryQuantity: { type: Number, default: 0 },
        secondaryUnit: { type: String, default: "" },
        selectedUnit: { type: String, default: "" },
        rate: { type: Number, required: true, default: 0, min: 0 },
        amount: { type: Number, required: true, default: 0, min: 0 },
      },
    ],

    // Financial Breakdown
    subtotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    taxRate: {
      type: Number,
      default: 0,
      min: 0,
    },
    taxAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalTax: {
      type: Number,
      default: 0,
      min: 0,
    },
    transportationCharges: {
      type: Number,
      default: 0,
      min: 0,
    },
    packingCharges: {
      type: Number,
      default: 0,
      min: 0,
    },
    preRoundTotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    isRoundOff: {
      type: Boolean,
      default: true,
    },
    roundOff: {
      type: Number,
      default: 0,
    },
    roundingMode: {
      type: String,
      enum: ["nearest", "floor", "ceil", "none"],
      default: "nearest",
    },
    grandTotal: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Payment Terms & Credit Management
    paymentTerms: {
      type: String,
      default: "30 Days Net",
      trim: true,
    },
    creditDays: {
      type: Number,
      default: 30,
      min: 0,
    },
    dueDate: {
      type: Date,
      index: true,
    },

    // Payment Status & Tracking
    paymentStatus: {
      type: String,
      enum: ["Unpaid", "Partially Paid", "Paid", "Overdue"],
      default: "Unpaid",
      index: true,
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    balanceAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    paymentHistory: [
      {
        paymentDate: { type: Date, default: Date.now },
        amountPaid: { type: Number, required: true, min: 0 },
        paymentMode: {
          type: String,
          enum: ["Bank Transfer", "NEFT", "RTGS", "UPI", "Cheque", "Cash", "Other"],
          default: "Bank Transfer",
        },
        transactionRef: { type: String, default: "" },
        notes: { type: String, default: "" },
        recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        recordedByName: { type: String, default: "User" },
        recordedAt: { type: Date, default: Date.now },
      },
    ],

    // Auditable Notes / Comments with User Name
    comments: [
      {
        comment: { type: String, required: true, trim: true },
        userName: { type: String, required: true, trim: true },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        createdAt: { type: Date, default: Date.now },
      },
    ],

    status: {
      type: String,
      enum: ["Draft", "Pending", "Paid", "Cancelled", "Active"],
      default: "Active",
    },
    remarks: {
      type: String,
      default: "",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    createdByName: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

// Multi-tenant compound index for uniqueness per company
purchaseBillSchema.index({ company: 1, billNumber: 1 }, { unique: true });

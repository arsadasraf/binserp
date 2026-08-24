import mongoose from "mongoose";

export const stockTransactionSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    itemType: {
      type: String,
      enum: ["RawMaterial", "BoughtOut", "Consumable", "RmBo", "FGItem", "Component", "ConsumableItem", "Material"],
      required: true,
    },
    item: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "itemType",
    },
    itemCode: {
      type: String,
      default: "",
    },
    itemName: {
      type: String,
      required: true,
    },
    unit: {
      type: String,
      default: "PCS",
    },
    movementType: {
      type: String,
      enum: ["INWARD", "OUTWARD"],
      required: true,
    },
    transactionCategory: {
      type: String,
      enum: [
        "GRN_PURCHASE_INWARD",
        "GRN_QC_PENDING_INWARD",
        "QC_RELEASE_INWARD",
        "JOB_WORK_RETURN_INWARD",
        "FG_GRN_INWARD",
        "MATERIAL_ISSUE_SHOPFLOOR_OUTWARD",
        "MATERIAL_ISSUE_FG_OUTWARD",
        "RETURNABLE_DC_JOB_WORK_OUTWARD",
        "SALES_DC_OUTWARD",
        "INVOICE_OUTWARD",
        "WIP_CONSUMPTION_OUTWARD",
        "STOCK_ADJUSTMENT",
      ],
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
    },
    previousStock: {
      type: Number,
      default: 0,
    },
    newStock: {
      type: Number,
      default: 0,
    },
    referenceDocType: {
      type: String,
      enum: [
        "GRN",
        "FGGRN",
        "MaterialIssue",
        "JobWorkChallan",
        "DeliveryChallan",
        "Invoice",
        "StockAdjustment",
        "QCInspection",
      ],
      required: true,
    },
    referenceDocId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    referenceDocNumber: {
      type: String,
      default: "",
    },
    recipientOrSource: {
      type: String,
      default: "",
    },
    purpose: {
      type: String,
      default: "",
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    performedByName: {
      type: String,
      default: "",
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

stockTransactionSchema.index({ company: 1, createdAt: -1 });
stockTransactionSchema.index({ company: 1, item: 1 });
stockTransactionSchema.index({ company: 1, transactionCategory: 1 });
stockTransactionSchema.index({ company: 1, referenceDocNumber: 1 });

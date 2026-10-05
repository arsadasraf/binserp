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
      enum: [
        "RawMaterial", "BoughtOut", "Consumable", "RmBo", "FGItem", "Component", "ConsumableItem", "Material",
        "Raw Material", "Bought Out", "Finished Good", "Finished Goods", "WIP"
      ],
      required: true,
    },
    item: {
      type: mongoose.Schema.Types.ObjectId,
      required: false,
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
    hasSecondaryUnit: {
      type: Boolean,
      default: false,
    },
    secondaryUnit: {
      type: String,
      default: "",
    },
    secondaryQuantity: {
      type: Number,
      default: 0,
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
        "FG_QC_RELEASE_INWARD",
        "JOB_WORK_RETURN_INWARD",
        "JOB_WORK_FG_INWARD",
        "JOB_WORK_WIP_RETURN",
        "JOB_WORK_QC_PENDING_INWARD",
        "JOBWORK_QC_RELEASE_INWARD",
        "JOBWORK_QC_WIP_RELEASE",
        "INCOMING_QC_REJECTED",
        "JOBWORK_QC_REJECTED",
        "QC_REJECT",
        "VENDOR_RETURN_OUTWARD",
        "REPLACEMENT_DISPATCH",
        "REPLACEMENT_INWARD",
        "VENDOR_REPLACEMENT_OUTWARD",
        "SCRAP",
        "CONCESSION_RELEASE",
        "REWORK_RETURN",
        "RM_CONVERSION_INWARD",
        "RM_CONVERSION_OUTWARD",
        "FG_GRN_INWARD",
        "MATERIAL_ISSUE_SHOPFLOOR_OUTWARD",
        "MATERIAL_ISSUE_FG_OUTWARD",
        "MATERIAL_ISSUE_CONSUMABLE_OUTWARD",
        "RETURNABLE_DC_JOB_WORK_OUTWARD",
        "RETURNABLE_DC_EDIT_ADJUSTMENT",
        "RETURNABLE_DC_DELETE_REVERSAL",
        "WIP_JOB_WORK_OUTWARD",
        "SALES_DC_OUTWARD",
        "INVOICE_OUTWARD",
        "WIP_CONSUMPTION_OUTWARD",
        "STOCK_ADJUSTMENT",
        "STOCK_ADJUSTMENT_INWARD",
        "WIP_RM_CONVERT_OUTWARD",
        "WIP_COMPONENT_CONVERT_INWARD",
        "WIP_RETURN_TO_STORE",
        "WIP_SCRAP_WRITEOFF",
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
        "FGQC",
        "MaterialIssue",
        "JobWorkChallan",
        "DeliveryChallan",
        "Invoice",
        "StockAdjustment",
        "QCInspection",
        "WIPConversion",
        "WIPReturn",
        "WIPScrap",
        "WIPAdjustment",
        "ReturnInvoice",
        "RETURN_INVOICE",
        "ReplacementDC",
        "REPLACEMENT_DC",
        "ScrapCertificate",
        "SCRAP_CERTIFICATE",
        "ConcessionNote",
        "CONCESSION",
        "ReworkJobCard",
        "REWORK_JOB",
        "REWORK_SCRAP",
        "MRBDisposition",
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

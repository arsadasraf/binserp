import mongoose from "mongoose";

export const mrbDispositionSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    ticketNumber: {
      type: String,
      required: true,
    },
    sourceType: {
      type: String,
      enum: ["IncomingQC", "ProcessQC", "JobWorkQC", "FGQC", "ManualStore"],
      required: true,
      default: "IncomingQC",
    },
    sourceDocId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "sourceDocModel",
    },
    sourceDocModel: {
      type: String,
      enum: ["IncomingQC", "ProcessQC", "JobWorkQC", "FGQC", "GRN", "MaterialIssue"],
    },
    sourceDocNumber: {
      type: String,
      default: "",
    },
    // Item Details
    materialId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "materialModel",
    },
    materialModel: {
      type: String,
      enum: ["RawMaterial", "BoughtOut", "ConsumableItem", "RmBoItem", "FGItem", "Component"],
      default: "RmBoItem",
    },
    materialName: {
      type: String,
      required: true,
    },
    materialCode: {
      type: String,
      default: "",
    },
    itemType: {
      type: String,
      enum: ["Raw Material", "Bought Out", "Consumable", "Finished Goods", "Component", "WIP"],
      default: "Raw Material",
    },
    unit: {
      type: String,
      default: "KG",
    },
    rejectedQuantity: {
      type: Number,
      required: true,
      min: 0.001,
    },
    unitRate: {
      type: Number,
      default: 0,
    },
    totalEstimatedLoss: {
      type: Number,
      default: 0,
    },
    rejectionReason: {
      type: String,
      default: "",
    },
    defectCategory: {
      type: String,
      enum: [
        "Dimensional Deviation",
        "Visual / Surface Defect",
        "Material Chemical / Hardness Failure",
        "Machining Defect / Burr",
        "Packaging / Transit Damage",
        "Subcontractor Flaw",
        "Documentation / Spec Mismatch",
        "Other"
      ],
      default: "Dimensional Deviation",
    },
    // Origin Context
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
    },
    vendorName: {
      type: String,
      default: "",
    },
    workstation: {
      type: String,
      default: "",
    },
    operatorName: {
      type: String,
      default: "",
    },
    jobOrderNumber: {
      type: String,
      default: "",
    },
    // Disposition State & Action
    dispositionAction: {
      type: String,
      enum: [
        "Pending",
        "Return to Vendor",
        "Vendor Replacement",
        "Internal Rework",
        "External Rework",
        "Scrap & Write-Off",
        "Accept on Deviation"
      ],
      default: "Pending",
    },
    status: {
      type: String,
      enum: ["Pending Disposition", "In Progress", "Completed", "Cancelled"],
      default: "Pending Disposition",
      index: true,
    },
    // Sub-Action Details
    rtvDetails: {
      challanNumber: String,
      challanDate: Date,
      debitNoteNumber: String,
      debitNoteAmount: Number,
      debitNoteStatus: { type: String, enum: ["Draft", "Issued", "Settled"], default: "Draft" },
      vehicleNumber: String,
      dispatchedBy: String,
    },
    replacementDetails: {
      expectedDate: Date,
      replacementGRNId: { type: mongoose.Schema.Types.ObjectId, ref: "GRN" },
      replacementGRNNumber: String,
      replacementQuantityReceived: { type: Number, default: 0 },
      isFullyReplaced: { type: Boolean, default: false },
    },
    reworkDetails: {
      reworkJobNumber: String,
      assignedWorkstation: String,
      assignedToUser: String,
      reworkInstructions: String,
      reworkCompletedDate: Date,
      reworkHoursSpent: { type: Number, default: 0 },
      extraConsumablesCost: { type: Number, default: 0 },
      reworkQcStatus: { type: String, enum: ["Pending QC", "Passed", "Failed"], default: "Pending QC" },
      reworkPassedQuantity: { type: Number, default: 0 },
      reworkScrappedQuantity: { type: Number, default: 0 },
    },
    scrapDetails: {
      scrapLocation: { type: String, default: "Scrap Yard Bay" },
      scrapSaleDCNumber: String,
      scrapDisposalDate: Date,
      salvageRatePerKg: Number,
      salvageRealizedAmount: Number,
      scrapAuthorizedBy: String,
    },
    concessionDetails: {
      deviationRefNumber: String,
      concessionReason: String,
      authorizedBy: String,
      approvedDate: Date,
      usageConditions: String,
    },
    // Document Engine (Return Invoice vs Replacement DC)
    documentType: {
      type: String,
      enum: ["ReturnInvoice", "ReplacementDC", "ReworkJobCard", "ScrapCertificate", "ConcessionNote", "None"],
      default: "None",
    },
    documentNumber: {
      type: String,
      default: "",
    },
    documentDate: {
      type: Date,
    },
    taxDetails: {
      taxableAmount: { type: Number, default: 0 },
      taxRate: { type: Number, default: 18 },
      cgst: { type: Number, default: 0 },
      sgst: { type: Number, default: 0 },
      igst: { type: Number, default: 0 },
      totalAmount: { type: Number, default: 0 },
    },
    // Audit Trail & 24-Hour Edit Governance
    isLocked: {
      type: Boolean,
      default: false,
    },
    lastEditedAt: {
      type: Date,
    },
    lastEditedByName: {
      type: String,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    createdByName: {
      type: String,
      default: "QC Inspector",
    },
    dispositionBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    dispositionByName: {
      type: String,
      default: "",
    },
    dispositionDate: {
      type: Date,
    },
    history: [
      {
        action: String,
        performedBy: String,
        timestamp: { type: Date, default: Date.now },
        notes: String,
      }
    ],
  },
  { timestamps: true }
);

mrbDispositionSchema.index({ company: 1, ticketNumber: 1 }, { unique: true });
mrbDispositionSchema.index({ company: 1, status: 1, createdAt: -1 });

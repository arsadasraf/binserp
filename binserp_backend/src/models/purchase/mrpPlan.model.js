import mongoose from "mongoose";

export const mrpPlanSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    mrpNumber: {
      type: String,
      required: true,
    },
    customerPoNumber: {
      type: String,
      default: "",
    },
    customerPo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "IncomingPO",
    },
    customerName: {
      type: String,
      default: "",
    },
    targetDate: {
      type: Date,
    },
    remarks: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["Draft", "Planned", "In Procurement", "In Production", "Partially Completed", "Completed"],
      default: "Planned",
    },
    // FG Items Required
    fgItems: [
      {
        fgItem: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "FGItem",
        },
        fgItemName: { type: String, required: true },
        fgItemCode: { type: String, default: "" },
        description: { type: String, default: "" },
        quantity: { type: Number, required: true },
        receivedQuantity: { type: Number, default: 0 },
        unit: { type: String, default: "PCS" },
        targetDate: { type: Date },
        bomId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "BOM",
        },
        bomNumber: { type: String, default: "" },
        nestedMaterials: [
          {
            materialName: { type: String, required: true },
            materialCode: { type: String, default: "" },
            itemType: { type: String, default: "Material" },
            category: { type: String, default: "RM/BO" },
            quantityPerFG: { type: Number, default: 1 },
            totalRequired: { type: Number, required: true },
            currentStock: { type: Number, default: 0 },
            shortage: { type: Number, default: 0 },
            unit: { type: String, default: "PCS" },
            parentItemName: { type: String, default: "" },
            level: { type: Number, default: 1 },
          },
        ],
      },
    ],
    // Consolidated Calculated RM / BO Requirements
    rmRequirements: [
      {
        material: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "RmBoItem",
        },
        materialName: { type: String, required: true },
        materialCode: { type: String, default: "" },
        category: { type: String, default: "RM / BO Material" },
        itemType: { type: String, default: "RM/BO" },
        requiredQuantity: { type: Number, default: 0 },
        currentStock: { type: Number, default: 0 },
        shortage: { type: Number, default: 0 },
        unit: { type: String, default: "PCS" },
        sourceFGName: { type: String, default: "" },
        sourceFGNames: [{ type: String }],
        status: { type: String, default: "Pending" },
      },
    ],
    // Calculated BO Requirements
    boRequirements: [
      {
        material: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "RmBoItem",
        },
        materialName: { type: String, required: true },
        materialCode: { type: String, default: "" },
        category: { type: String, default: "Bought Out" },
        itemType: { type: String, default: "BO" },
        requiredQuantity: { type: Number, default: 0 },
        currentStock: { type: Number, default: 0 },
        shortage: { type: Number, default: 0 },
        unit: { type: String, default: "PCS" },
        sourceFGName: { type: String, default: "" },
        status: { type: String, default: "Pending" },
      },
    ],
    // Calculated Consumables
    consumableRequirements: [
      {
        materialName: { type: String, required: true },
        materialCode: { type: String, default: "" },
        category: { type: String, default: "Consumable" },
        itemType: { type: String, default: "Consumable" },
        requiredQuantity: { type: Number, default: 0 },
        currentStock: { type: Number, default: 0 },
        shortage: { type: Number, default: 0 },
        unit: { type: String, default: "PCS" },
        sourceFGName: { type: String, default: "" },
        status: { type: String, default: "Pending" },
      },
    ],
    // Calculated In-House Sub-Assemblies & Components
    subAssemblyRequirements: [
      {
        materialName: { type: String, required: true },
        materialCode: { type: String, default: "" },
        category: { type: String, default: "Sub Assembly" },
        itemType: { type: String, default: "SubAssembly" },
        requiredQuantity: { type: Number, default: 0 },
        currentStock: { type: Number, default: 0 },
        shortage: { type: Number, default: 0 },
        unit: { type: String, default: "PCS" },
        sourceFGName: { type: String, default: "" },
        sourceFGNames: [{ type: String }],
        status: { type: String, default: "Pending" },
      },
    ],
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

mrpPlanSchema.index({ company: 1, mrpNumber: 1 });
mrpPlanSchema.index({ company: 1, status: 1 });

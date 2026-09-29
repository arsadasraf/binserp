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
    // Multi-Customer PO Support for Consolidated MRP
    isConsolidated: {
      type: Boolean,
      default: false,
    },
    customerPOs: [
      {
        customerPo: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "IncomingPO",
        },
        customerPoNumber: { type: String, default: "" },
        customer: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Customer",
        },
        customerName: { type: String, default: "" },
        poDate: { type: Date },
        targetDate: { type: Date },
        currency: { type: String, default: "INR" },
        exchangeRate: { type: Number, default: 1 },
        totalAmount: { type: Number, default: 0 },
        totalAmountInINR: { type: Number, default: 0 },
      },
    ],
    poDate: {
      type: Date,
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
        fgItemName: { type: String, required: true, default: "Finished Good" },
        fgItemCode: { type: String, default: "" },
        description: { type: String, default: "" },
        quantity: { type: Number, required: true },
        receivedQuantity: { type: Number, default: 0 },
        unit: { type: String, default: "PCS" },
        sellingPrice: { type: Number, default: 0 }, // Converted selling price in INR
        totalPrice: { type: Number, default: 0 }, // Converted total price in INR
        currency: { type: String, default: "INR" },
        originalSellingPrice: { type: Number, default: 0 },
        exchangeRate: { type: Number, default: 1 },
        priceSource: { type: String, default: "Master Catalog" }, // "Customer PO" | "Master Catalog" | "Manual Override"
        poDeliveryDate: { type: Date },
        targetDate: { type: Date },
        customerPo: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "IncomingPO",
        },
        customerPoNumber: { type: String, default: "" },
        customerName: { type: String, default: "" },
        sourceBreakdown: [
          {
            customerPo: {
              type: mongoose.Schema.Types.ObjectId,
              ref: "IncomingPO",
            },
            customerPoNumber: { type: String, default: "" },
            customerName: { type: String, default: "" },
            quantity: { type: Number, default: 0 },
            currency: { type: String, default: "INR" },
            originalRate: { type: Number, default: 0 },
            exchangeRate: { type: Number, default: 1 },
            rateInINR: { type: Number, default: 0 },
            amountInINR: { type: Number, default: 0 },
          },
        ],
        sourceCustomerPOs: [{ type: String }],
        bomId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "BOM",
        },
        bomNumber: { type: String, default: "" },
        nestedMaterials: [
          {
            materialName: { type: String, required: true },
            materialCode: { type: String, default: "" },
            description: { type: String, default: "" },
            itemType: { type: String, default: "Material" },
            category: { type: String, default: "RM/BO" },
            quantityPerFG: { type: Number, default: 1 },
            totalRequired: { type: Number, required: true },
            currentStock: { type: Number, default: 0 },
            shortage: { type: Number, default: 0 },
            unit: { type: String, default: "PCS" },
            unitCost: { type: Number, default: 0 },
            grossCost: { type: Number, default: 0 },
            shortageCost: { type: Number, default: 0 },
            costSource: { type: String, default: "Price List" },
            parentItemName: { type: String, default: "" },
            level: { type: Number, default: 1 },
            status: { type: String, default: "Pending" },
            poNumber: { type: String, default: "" },
            rfqNumber: { type: String, default: "" },
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
        description: { type: String, default: "" },
        category: { type: String, default: "RM / BO Material" },
        itemType: { type: String, default: "RM/BO" },
        requiredQuantity: { type: Number, default: 0 },
        currentStock: { type: Number, default: 0 },
        shortage: { type: Number, default: 0 },
        unit: { type: String, default: "PCS" },
        unitCost: { type: Number, default: 0 },
        grossCost: { type: Number, default: 0 },
        shortageCost: { type: Number, default: 0 },
        costSource: { type: String, default: "Price List" },
        preferredVendor: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Vendor",
        },
        preferredVendorName: { type: String, default: "" },
        sourceFGName: { type: String, default: "" },
        sourceFGNames: [{ type: String }],
        sourceCustomerPOs: [{ type: String }],
        status: { type: String, default: "Pending" },
        rfqNumber: { type: String, default: "" },
        poNumber: { type: String, default: "" },
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
        description: { type: String, default: "" },
        category: { type: String, default: "Bought Out" },
        itemType: { type: String, default: "BO" },
        requiredQuantity: { type: Number, default: 0 },
        currentStock: { type: Number, default: 0 },
        shortage: { type: Number, default: 0 },
        unit: { type: String, default: "PCS" },
        unitCost: { type: Number, default: 0 },
        grossCost: { type: Number, default: 0 },
        shortageCost: { type: Number, default: 0 },
        costSource: { type: String, default: "Price List" },
        preferredVendor: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Vendor",
        },
        preferredVendorName: { type: String, default: "" },
        sourceFGName: { type: String, default: "" },
        sourceFGNames: [{ type: String }],
        sourceCustomerPOs: [{ type: String }],
        status: { type: String, default: "Pending" },
        rfqNumber: { type: String, default: "" },
        poNumber: { type: String, default: "" },
      },
    ],
    // Calculated Consumables
    consumableRequirements: [
      {
        materialName: { type: String, required: true },
        materialCode: { type: String, default: "" },
        description: { type: String, default: "" },
        category: { type: String, default: "Consumable" },
        itemType: { type: String, default: "Consumable" },
        requiredQuantity: { type: Number, default: 0 },
        currentStock: { type: Number, default: 0 },
        shortage: { type: Number, default: 0 },
        unit: { type: String, default: "PCS" },
        unitCost: { type: Number, default: 0 },
        grossCost: { type: Number, default: 0 },
        shortageCost: { type: Number, default: 0 },
        costSource: { type: String, default: "Price List" },
        preferredVendor: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Vendor",
        },
        preferredVendorName: { type: String, default: "" },
        sourceFGName: { type: String, default: "" },
        sourceFGNames: [{ type: String }],
        sourceCustomerPOs: [{ type: String }],
        status: { type: String, default: "Pending" },
        rfqNumber: { type: String, default: "" },
        poNumber: { type: String, default: "" },
      },
    ],
    // Calculated In-House Sub-Assemblies & Components
    subAssemblyRequirements: [
      {
        materialName: { type: String, required: true },
        materialCode: { type: String, default: "" },
        description: { type: String, default: "" },
        category: { type: String, default: "Sub Assembly" },
        itemType: { type: String, default: "SubAssembly" },
        requiredQuantity: { type: Number, default: 0 },
        currentStock: { type: Number, default: 0 },
        shortage: { type: Number, default: 0 },
        unit: { type: String, default: "PCS" },
        sourceFGName: { type: String, default: "" },
        sourceFGNames: [{ type: String }],
        sourceCustomerPOs: [{ type: String }],
        status: { type: String, default: "Pending" },
      },
    ],
    // Financial Intelligence & Budget Tracking
    totalIncome: {
      type: Number,
      default: 0,
    },
    totalGrossMaterialCost: {
      type: Number,
      default: 0,
    },
    totalEstimatedExpense: {
      type: Number,
      default: 0,
    },
    targetExpense: {
      type: Number,
      default: 0,
    },
    committedExpense: {
      type: Number,
      default: 0,
    },
    actualReceivedExpense: {
      type: Number,
      default: 0,
    },
    projectedGrossProfit: {
      type: Number,
      default: 0,
    },
    projectedMarginPercentage: {
      type: Number,
      default: 0,
    },
    budgetStatus: {
      type: String,
      enum: ["Unset", "Within Budget", "Near Limit", "Over Budget"],
      default: "Unset",
    },
    bomSyncedAt: {
      type: Date,
    },
    isBOMOutdated: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    createdByName: {
      type: String,
      default: "",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updatedByName: {
      type: String,
      default: "",
    },
    editHistory: [
      {
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        updatedByName: String,
        updatedAt: { type: Date, default: Date.now },
        action: { type: String, default: "Edited" },
        remarks: String,
      },
    ],
  },
  { timestamps: true }
);

mrpPlanSchema.index({ company: 1, mrpNumber: 1 });
mrpPlanSchema.index({ company: 1, status: 1 });

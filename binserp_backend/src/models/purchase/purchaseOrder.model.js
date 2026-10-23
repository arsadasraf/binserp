import mongoose from "mongoose";

export const purchaseOrderSchema = new mongoose.Schema(
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
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
    },
    // Support both single material and items array
    material: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RmBoItem",
    },
    component: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Component",
    },
    materialName: String,
    quantity: Number,
    receivedQuantity: { type: Number, default: 0 },
    pendingQuantity: Number,
    unit: String,
    hasSecondaryUnit: { type: Boolean, default: false },
    secondaryUnit: { type: String, default: "" },
    conversionFactor: { type: Number, default: 1 },
    secondaryQuantity: { type: Number },
    rateUnit: { type: String, enum: ["primary", "secondary"], default: "primary" },
    selectedUnit: { type: String, default: "" },
    primaryRate: { type: Number },
    secondaryRate: { type: Number },
    rate: Number,
    amount: Number,
    description: String,
    quotation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "VendorQuotation",
    },
    quotationNumber: String,
    rfqNumber: String,
    mrpPlanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MrpProcurementPlan",
    },
    mrpNumber: String,
    poType: {
      type: String,
      enum: ["standard", "jobwork"],
      default: "standard",
      index: true,
    },
    processType: {
      type: String,
      default: "",
    },
    sacCode: {
      type: String,
      default: "",
    },
    expectedDeliveryDate: {
      type: Date,
    },
    transportType: String,
    transportCharge: { type: Number, default: 0 },
    packingType: String,
    packingCharge: { type: Number, default: 0 },
    gstType: {
      type: String,
      enum: ["intra_state", "inter_state"],
      default: "intra_state",
    },
    taxRate: { type: Number, default: 18 },
    cgstRate: { type: Number, default: 9 },
    sgstRate: { type: Number, default: 9 },
    igstRate: { type: Number, default: 18 },
    cgstAmount: { type: Number, default: 0 },
    sgstAmount: { type: Number, default: 0 },
    igstAmount: { type: Number, default: 0 },
    subtotal: Number,
    totalTax: Number,
    preRoundTotal: Number,
    isRoundOff: { type: Boolean, default: true },
    roundOff: { type: Number, default: 0 },
    roundingMode: { type: String, enum: ["nearest", "floor", "ceil", "none"], default: "nearest" },
    grandTotal: Number,
    remarks: String,
    items: [
      {
        material: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "RmBoItem",
        },
        component: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Component",
        },
        itemType: {
          type: String,
          enum: [
            "rm", "bo", "consumable", "raw_material", "bought_out", "component", "subassembly", "assembly", "custom",
            "RM", "BO", "CONSUMABLE", "RAW_MATERIAL", "BOUGHT_OUT", "COMPONENT", "SUBASSEMBLY", "ASSEMBLY", "CUSTOM"
          ],
          default: "rm",
          set: (v) => (typeof v === "string" ? v.toLowerCase() : "rm"),
        },
        materialName: { type: String, required: true },
        description: String,
        processType: { type: String, default: "" },
        processNote: { type: String, default: "" },
        hsnCode: { type: String, default: "" },
        pieceCount: { type: Number, default: 0 },
        quantity: { type: Number, required: true },
        receivedQuantity: { type: Number, default: 0 },
        pendingQuantity: { type: Number },
        itemStatus: {
          type: String,
          enum: ["Pending", "Partially Received", "Completed"],
          default: "Pending",
        },
        unit: { type: String, default: "PCS" },
        hasSecondaryUnit: { type: Boolean, default: false },
        secondaryUnit: { type: String, default: "" },
        conversionFactor: { type: Number, default: 1 },
        secondaryQuantity: { type: Number },
        rateUnit: { type: String, enum: ["primary", "secondary"], default: "primary" },
        selectedUnit: { type: String, default: "" },
        primaryRate: { type: Number },
        secondaryRate: { type: Number },
        rate: { type: Number, required: true },
        taxRate: { type: Number, default: 18 },
        taxAmount: { type: Number, default: 0 },
        amount: {
          type: Number,
          required: true,
          default: function () {
            return this.total || (Number(this.quantity || 0) * Number(this.rate || 0)) || 0;
          },
        },
      },
    ],
    totalAmount: {
      type: Number,
      required: true,
      default: function () {
        return this.grandTotal || this.subtotal || this.subTotal || 0;
      },
    },
    status: {
      type: String,
      enum: ["Draft", "Released", "Approved", "Partially Received", "Completed", "Cancelled"],
      default: "Released",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    createdByName: String,
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updatedByName: String,
    history: [
      {
        status: String,
        updatedBy: String,
        updatedAt: { type: Date, default: Date.now },
      },
    ],
    followUps: [
      {
        comment: { type: String, required: true },
        category: { type: String, default: "General" },
        author: String,
        authorId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true, strict: false }
);

// Auto-calculate and normalize amounts, totals, and itemType before validation
purchaseOrderSchema.pre("validate", function (next) {
  if (this.totalAmount == null) {
    this.totalAmount = this.grandTotal ?? this.subtotal ?? this.subTotal ?? 0;
  }
  if (this.grandTotal == null && this.totalAmount != null) {
    this.grandTotal = this.totalAmount;
  }
  if (this.subtotal == null && this.subTotal != null) {
    this.subtotal = this.subTotal;
  }
  if (this.subTotal == null && this.subtotal != null) {
    this.subTotal = this.subtotal;
  }
  if (Array.isArray(this.items)) {
    this.items.forEach((item) => {
      if (item.amount == null) {
        item.amount = item.total ?? (Number(item.quantity || 0) * Number(item.rate || 0)) ?? 0;
      }
      if (item.total == null && item.amount != null) {
        item.total = item.amount;
      }
      if (typeof item.itemType === "string") {
        item.itemType = item.itemType.toLowerCase();
      } else if (!item.itemType) {
        item.itemType = "rm";
      }
    });
  }
  if (typeof next === "function") next();
});

// Indexes
purchaseOrderSchema.index({ company: 1, poNumber: 1 }, { unique: true });

import mongoose from "mongoose";

export const FGQCSchema = new mongoose.Schema({
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Company",
    required: true,
    index: true
  },
  // Link to Finished Goods Master / Inward / Production Job
  fgItemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "FGItem"
  },
  fgItemName: {
    type: String,
    required: true
  },
  fgItemCode: String,
  productionJobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Job"
  },
  jobCardNumber: String,
  fgGrnId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "FGGRN"
  },
  fgGrnNumber: String,
  customerName: String,
  customerPoReference: String,

  // Batch & Traceability
  batchNumber: {
    type: String,
    index: true
  },
  heatNumber: String,
  unit: {
    type: String,
    default: "PCS"
  },

  // Quantities
  lotQuantity: {
    type: Number,
    required: true
  },
  inspectedQuantity: {
    type: Number,
    required: true
  },
  acceptedQuantity: {
    type: Number,
    default: 0
  },
  rejectedQuantity: {
    type: Number,
    default: 0
  },
  reworkQuantity: {
    type: Number,
    default: 0
  },

  // Test Results & Parameters
  inspectionResults: [{
    parameterName: String,
    specification: String,
    tolerance: String,
    actualObserved: String,
    status: {
      type: String,
      enum: ["Pass", "Fail"],
      default: "Pass"
    },
    instrumentUsed: String,
    remarks: String
  }],

  // Final Disposition
  overallStatus: {
    type: String,
    enum: ["Pending", "Accepted", "Rejected", "Conditional", "Rework"],
    default: "Accepted",
    index: true
  },
  certificateNumber: {
    type: String,
    index: true
  },
  inspector: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  remarks: String,
  photos: [String]
}, { timestamps: true });

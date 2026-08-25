import mongoose from "mongoose";

export const JobWorkQCSchema = new mongoose.Schema({
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Company",
    required: true,
    index: true
  },
  jobWorkChallanId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "JobWorkChallan",
    required: true
  },
  challanNumber: {
    type: String,
    required: true,
    index: true
  },
  grnNumber: {
    type: String,
    index: true
  },
  vendorDcNumber: String,
  vendorInvoiceDate: Date,
  vendor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Vendor"
  },
  vendorName: {
    type: String,
    required: true
  },

  // Item details
  itemId: mongoose.Schema.Types.ObjectId,
  itemName: {
    type: String,
    required: true
  },
  itemCode: String,
  itemType: {
    type: String,
    enum: ["rm", "bo", "fg", "inhouse", "Component", "SubAssembly", "Assembly", "custom"],
    default: "fg"
  },
  processType: {
    type: String,
    default: "Job Work Processing"
  },
  unit: {
    type: String,
    default: "PCS"
  },

  // Quantities
  quantitySent: {
    type: Number,
    default: 0
  },
  receivedQuantity: {
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
  scrapQuantity: {
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
  rejectionReason: String,
  defectCategory: String,
  dispositionAction: String,
  inspector: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  remarks: String,
  photos: [String]
}, { timestamps: true });

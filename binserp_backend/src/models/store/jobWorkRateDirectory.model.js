import mongoose from "mongoose";

export const jobWorkRateDirectorySchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    // Standalone component name & technical description (intentionally unlinked from item masters/part numbers)
    componentName: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    processName: {
      type: String,
      required: true,
      trim: true,
    },
    rate: {
      type: Number,
      required: true,
      min: 0,
    },
    unit: {
      type: String,
      required: true,
      default: "PCS",
      trim: true,
    },
    // Vendor details fetched from Vendor Master or Job Work Supplier Master
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      set: (v) => (v === "" || v === null ? undefined : v),
    },
    vendorSource: {
      type: String,
      enum: ["Vendor", "JobWorkSupplier"],
      default: "Vendor",
    },
    vendorName: {
      type: String,
      required: true,
      trim: true,
    },
    vendorContactPerson: {
      type: String,
      default: "",
      trim: true,
    },
    vendorPhone: {
      type: String,
      default: "",
      trim: true,
    },
    vendorEmail: {
      type: String,
      default: "",
      trim: true,
    },
    vendorGst: {
      type: String,
      default: "",
      trim: true,
    },
    vendorAddress: {
      type: String,
      default: "",
      trim: true,
    },
    remarks: {
      type: String,
      default: "",
      trim: true,
    },
    // Mandatory Audit Trail (Created By & Updated By)
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    createdByName: {
      type: String,
      default: "",
      trim: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updatedByName: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { timestamps: true }
);

jobWorkRateDirectorySchema.index({ company: 1, componentName: 1, processName: 1 });
jobWorkRateDirectorySchema.index({ company: 1, vendorName: 1 });

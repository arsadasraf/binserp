import mongoose from "mongoose";

export const jobWorkSupplierSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    name: { type: String, required: true },
    code: { type: String },

    address: String,
    city: String,
    pincode: String,
    state: String,
    country: String,
    district: String,
    contactPerson: String,
    phone: String,
    email: String,
    gst: String,
    bankDetails: {
      accountNumber: String,
      ifscCode: String,
      bankName: String,
      branchName: String,
      branch: String,
    }

  },
  { timestamps: true }
);

// Customer Master Schema

// Indexes
jobWorkSupplierSchema.index({ company: 1, code: 1 }, { unique: true });

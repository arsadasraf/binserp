import mongoose from "mongoose";

export const vendorSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    name: { type: String, required: true },
    code: { type: String },

    vendorType: {
      type: String,
      enum: ['Rm Vendor', 'Consumable Vendor', 'Manufacturing Vendor'],
      default: 'Rm Vendor'
    },
    address: String,
    billingAddress: String,
    billingCity: String,
    billingPincode: String,
    billingState: String,
    billingDistrict: String,
    billingCountry: String,
    shippingAddress: String,
    shippingCity: String,
    shippingPincode: String,
    shippingState: String,
    shippingDistrict: String,
    shippingCountry: String,
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
      branch: String, // Keep backwards compatibility
      accountName: String,
      swiftCode: String,
    },
  },
  { timestamps: true }
);

// Job-Work Supplier Master Schema

// Indexes
vendorSchema.index({ company: 1, code: 1 }, { unique: true });

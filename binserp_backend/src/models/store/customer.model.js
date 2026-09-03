import mongoose from "mongoose";

export const customerSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    name: { type: String, required: true },
    code: { type: String },
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
    contactPerson: String,
    phone: String,
    email: String,
    website: String,
    customerType: {
      type: String,
      enum: ['Manufacturing Sales', 'Labor-Job Sales'],
      default: 'Manufacturing Sales'
    },
    gst: String,
    bankDetails: {
      accountNumber: String,
      ifscCode: String,
      bankName: String,
      branchName: String,
      branch: String,
      accountName: String,
      swiftCode: String,
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive', 'Deactivated'],
      default: 'Active',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    createdByName: {
      type: String,
      default: "System",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updatedByName: {
      type: String,
      default: "System",
    }
  },
  { timestamps: true }
);

// Indexes
customerSchema.index({ company: 1, name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });
customerSchema.index({ company: 1, code: 1 }, { unique: true });

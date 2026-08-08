import mongoose from "mongoose";

const printConfigSchema = new mongoose.Schema({
  headerAlignment: {
    type: String,
    enum: ['left', 'center', 'right'],
    default: 'center'
  },
  headerText: { type: String, default: '' },
  showCompanyDetails: { type: Boolean, default: true },
  footerText: { type: String, default: '' },
  termsAndConditions: { type: String, default: '' }
}, { _id: false });

// Company Info Schema

export const companyInfoSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      unique: true,
    },
    companyName: { type: String, required: true },
    legalName: String,
    tradeName: String,
    contactPerson: { type: String, required: true },
    contactNumber: { type: String, required: true },
    email: String,
    logo: String,
    gstNumber: String,
    panNumber: String,
    state: String,
    stateCode: String,
    pincode: String,
    city: String,
    district: String,
    einvoiceGstin: String,
    einvoiceUsername: String,
    einvoicePassword: String,
    ewayBillUsername: String,
    ewayBillPassword: String,
    lutNumber: String,
    billingAddress: { type: String, required: true },
    shippingAddress: { type: String, required: true },
    qualitySpecs: String,
    commercialTerms: String,
    bankDetails: {
      accountName: String,
      bankName: String,
      accountNumber: String,
      ifscCode: String,
      branch: String,
    },
    printSettings: {
      po: { type: printConfigSchema, default: () => ({}) },
      dc: { type: printConfigSchema, default: () => ({}) },
      invoice: { type: printConfigSchema, default: () => ({}) }
    }
  },
  { timestamps: true }
);



// Job Work Challan Schema

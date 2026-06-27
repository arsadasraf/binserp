import mongoose from "mongoose";

// Employee Schema
export const employeeSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    employeeId: {
      type: String,
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
    },
    contact: {
      type: String,
      required: true,
    },
    department: {
      type: String,
      required: true,
    },
    employeeType: {
      type: String,
      default: "Full-Time",
    },
    designation: {
      type: String,
      required: true,
    },
    skills: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Skill",
      },
    ],
    joiningDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["Active", "Inactive", "Terminated", "OnLeave"],
      default: "Active",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    activatedAt: {
      type: Date, // Set when manually activated after 24h window
    },
    photo: {
      type: String, // URL for face recognition photo
    },
    faceEncoding: {
      type: String, // Base64 encoded face data for recognition
    },
    experience: {
      type: String, // e.g. "3 Years"
      default: "",
    },
    degree: {
      type: String,
      default: "",
    },
    paymentDetails: {
      accountNumber: String,
      bankName: String,
      ifscCode: String,
      branchName: String,
    },
    salary: {
      basic: { type: Number, default: 0 },
      hra: { type: Number, default: 0 },
      conveyance: { type: Number, default: 0 },
      medical: { type: Number, default: 0 },
      specialAllowance: { type: Number, default: 0 },
      grossSalary: { type: Number, default: 0 },
      pf: { type: Number, default: 0 },
      professionalTax: { type: Number, default: 0 },
      netSalary: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);
// Indexes
employeeSchema.index({ company: 1, employeeId: 1 });

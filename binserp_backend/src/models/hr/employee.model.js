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
    gender: {
      type: String,
      enum: ["Male", "Female", "Other", ""],
    },
    bloodGroup: {
      type: String,
    },
    dob: {
      type: Date,
    },
    email: {
      type: String,
      lowercase: true,
      default: "",
    },
    contact: {
      type: String,
      default: "",
    },
    department: {
      type: String,
      required: true,
    },
    roles: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role"
    }],
    employeeType: {
      type: String,
      default: "Full-Time",
    },
    designation: {
      type: String,
      required: true,
    },
    idType: {
      type: String,
      default: "",
    },
    idDocuments: [{
      type: String, // URLs for uploaded ID documents
    }],
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
    experienceDocuments: [{
      type: String, // URLs for experience certificates/documents
    }],
    degree: {
      type: String,
      default: "",
    },
    degreeDocuments: [{
      type: String, // URLs for degree certificates/documents
    }],
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
      isPFApplicable: { type: Boolean, default: false },
      pfUanNumber: { type: String, default: "" },
      pf: { type: Number, default: 0 }, // Manual override for PF
      isESIApplicable: { type: Boolean, default: false },
      esiNumber: { type: String, default: "" },
      esi: { type: Number, default: 0 }, // Manual override for ESI
      isPTApplicable: { type: Boolean, default: false },
      professionalTax: { type: Number, default: 0 },
      perDayCalculationBasis: { type: String, enum: ['Basic', 'Gross', 'Net'], default: 'Gross' },
      dailyDivisorBasis: { type: String, enum: ['TotalMonthDays', 'ApplicableWorkingDays'], default: 'TotalMonthDays' },
      otCalculationBasis: { type: String, enum: ['Basic', 'Gross', 'Net'], default: 'Basic' },
      otDivisorBasis: { type: String, enum: ['TotalMonthDays', 'ApplicableWorkingDays'], default: 'TotalMonthDays' },
      otRate: { type: Number, default: 0 },
    },
    leaves: {
      casualLeave: { type: Number, default: 0 },
      sickLeave: { type: Number, default: 0 }
    },
    standardWorkingHours: { type: Number, default: 9 },
    weeklyOff: { type: [String], default: ['Sunday'] },
    holidayWorkPolicy: { type: String, enum: ['Overtime', 'CompOff'], default: 'Overtime' },
    weekOffWorkPolicy: { type: String, enum: ['Overtime', 'CompOff'], default: 'Overtime' },
    compOffBalance: { type: Number, default: 0 },
    isOTApplicable: { type: Boolean, default: false },
    otCompensateForAbsent: { type: Boolean, default: true },
    absentOTRate: { type: Number, default: 0 },
    leaveHistory: [{
      date: String,
      type: { type: String }, // 'CL' or 'SL'
      month: String,
      year: Number
    }],
    compOffHistory: [{
      date: String,
      transactionType: { type: String, enum: ['Earned', 'Consumed'] },
      amount: Number,
      month: String,
      year: Number
    }],
    password: {
      type: String,
      // Not required initially to support legacy employees who only have joiningDate
    },
    refreshToken: {
      type: String,
    },
    lastActiveAt: {
      type: Date,
    },
    tokenVersion: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

import bcrypt from "bcryptjs";

// Hash employee password before saving if it has been modified
employeeSchema.pre("save", async function (next) {
  if (!this.isModified("password") || !this.password) return next();

  this.password = await bcrypt.hash(this.password, 10);
  next();
});

employeeSchema.methods.comparePassword = async function (password) {
  if (!this.password) return false;
  return await bcrypt.compare(password, this.password);
};

// Indexes
employeeSchema.index({ company: 1, employeeId: 1 });

import mongoose from "mongoose";

// Salary Schema
export const salarySchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    month: {
      type: String, // e.g., "October"
      required: true,
    },
    year: {
      type: Number, // e.g., 2023
      required: true,
    },
    workingDays: {
      type: Number,
      default: 30, // Default standard month
    },
    presentDays: {
      type: Number,
      required: true,
      default: 0,
    },
    // Snapshot of salary structure at the time of generation
    salaryComponents: {
      basic: { type: Number, default: 0 },
      hra: { type: Number, default: 0 },
      conveyance: { type: Number, default: 0 },
      medical: { type: Number, default: 0 },
      specialAllowance: { type: Number, default: 0 },
      pf: { type: Number, default: 0 },
      professionalTax: { type: Number, default: 0 },
    },
    overtime: {
      hours: { type: Number, default: 0 },
      rate: { type: Number, default: 0 }, // Hourly rate
      amount: { type: Number, default: 0 },
    },
    deductions: {
      type: Number, // Manual deductions
      default: 0,
    },
    incentives: {
      type: Number, // Performance bonus etc.
      default: 0,
    },
    grossSalary: {
      type: Number,
      default: 0
    },
    netSalary: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["Draft", "Paid"],
      default: "Draft",
    },
    totalDutyHours: {
      type: Number,
      default: 0,
    },
    otRatePH: {
      type: Number,
      default: 0,
    },
    dailyLogs: [
      {
        date: String,
        day: Number,
        dayName: String,
        originalStatus: String,
        originalCheckIn: Date,
        originalCheckOut: Date,
        originalHours: Number,
        manualStatus: String,
        manualHours: Number,
        useManual: { type: Boolean, default: false }
      }
    ],
    paymentDate: Date,
    remarks: String,
  },
  { timestamps: true }
);

salarySchema.index({ company: 1, employee: 1, month: 1, year: 1 }, { unique: true });
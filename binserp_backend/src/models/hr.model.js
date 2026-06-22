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

// Attendance Schema
export const attendanceSchema = new mongoose.Schema(
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
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    checkIn: {
      time: Date,
      photo: String, // URL of check-in photo
      location: String,
    },
    checkOut: {
      time: Date,
      photo: String, // URL of check-out photo
      location: String,
    },
    status: {
      type: String,
      enum: ["Present", "Absent", "HalfDay", "Late", "EarlyLeave"],
      default: "Present",
    },
    hoursWorked: {
      type: Number, // in hours
      default: 0,
    },
    remarks: String,
  },
  { timestamps: true }
);

// Index for efficient queries
employeeSchema.index({ company: 1, employeeId: 1 });
attendanceSchema.index({ company: 1, employee: 1, date: 1 });
attendanceSchema.index({ company: 1, date: 1 });

// Department Schema
export const departmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
  },
  { timestamps: true }
);

// Designation Schema
export const designationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
  },
  { timestamps: true }
);

// Skill Schema
export const skillSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
  },
  { timestamps: true }
);

skillSchema.index({ company: 1, name: 1 }, { unique: true });

// Employee Type Schema
export const employeeTypeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
  },
  { timestamps: true }
);

employeeTypeSchema.index({ company: 1, name: 1 }, { unique: true });

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

// Employee Job Schema (for specific task assignments)
export const employeeJobSchema = new mongoose.Schema(
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
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    priority: {
      type: String,
      enum: ["Low", "Medium", "High", "Urgent"],
      default: "Medium",
    },
    status: {
      type: String,
      enum: ["Pending", "InProgress", "Completed"],
      default: "Pending",
    },
    assignedDate: {
      type: Date,
      default: Date.now,
    },
    dueDate: {
      type: Date,
    },
    completionDate: {
      type: Date,
    },
    remarks: String,
  },
  { timestamps: true }
);

employeeJobSchema.index({ company: 1, employee: 1, status: 1 });

// Export Models
// export const Employee = mongoose.model("Employee", employeeSchema);
// export const Attendance = mongoose.model("Attendance", attendanceSchema);
// export const Department = mongoose.model("Department", departmentSchema);
// export const Designation = mongoose.model("Designation", designationSchema);
// export const Skill = mongoose.model("Skill", skillSchema);
// export const Salary = mongoose.model("Salary", salarySchema);

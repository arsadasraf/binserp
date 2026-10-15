import mongoose from "mongoose";

// Attendance Validation Schema (Separate from raw Attendance punches)
export const attendanceValidationSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },
    date: {
      type: String, // "YYYY-MM-DD" formatted
      required: true,
      index: true,
    },
    year: {
      type: Number,
      required: true,
    },
    month: {
      type: String, // e.g. "October"
      required: true,
    },
    monthIndex: {
      type: Number, // 0 to 11
      required: true,
    },
    day: {
      type: Number, // 1 to 31
      required: true,
    },
    dayName: {
      type: String, // "Monday", "Tuesday", etc.
    },
    // Reference to original punch if one existed
    rawAttendance: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Attendance",
      default: null,
    },
    // Raw audit snapshot preserved for side-by-side comparison
    rawPunches: {
      checkIn: { type: Date, default: null },
      checkOut: { type: Date, default: null },
      status: { type: String, default: null },
      hoursWorked: { type: Number, default: 0 },
    },
    // HR Validated Status & Values
    status: {
      type: String,
      enum: ["Present", "Absent", "HalfDay", "WeeklyOff", "Holiday", "CL", "SL", "CompOff", "OnDuty"],
      default: "Present",
      required: true,
    },
    checkIn: {
      type: Date,
      default: null,
    },
    checkOut: {
      type: Date,
      default: null,
    },
    dutyHours: {
      type: Number,
      default: 0,
    },
    otHours: {
      type: Number,
      default: 0,
    },
    isOvertime: {
      type: Boolean,
      default: false,
    },
    remarks: {
      type: String,
      default: "",
    },
    isValidated: {
      type: Boolean,
      default: true,
    },
    validatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    validatedByUsername: {
      type: String,
      default: "",
    },
    validatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// High-performance compound indexes
attendanceValidationSchema.index({ company: 1, employee: 1, date: 1 }, { unique: true });
attendanceValidationSchema.index({ company: 1, date: 1 });
attendanceValidationSchema.index({ company: 1, year: 1, month: 1 });
attendanceValidationSchema.index({ company: 1, employee: 1, year: 1, month: 1 });

import mongoose from "mongoose";

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

attendanceSchema.index({ company: 1, employee: 1, date: 1 });
attendanceSchema.index({ company: 1, date: 1 });

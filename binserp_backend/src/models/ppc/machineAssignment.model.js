import mongoose from "mongoose";

export const machineAssignmentSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    machine: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Machine",
      required: true,
    },
    date:  { type: Date, required: true },
    shift: {
      type: String,
      enum: ["Morning", "Afternoon", "Night", "General", "Custom"],
      required: true,
    },
    startTime: String, // HH:MM — filled from shift master or custom
    endTime:   String, // HH:MM
    // Personnel
    operator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    helpers: [{ type: mongoose.Schema.Types.ObjectId, ref: "Employee" }],
    // Work
    job:            { type: mongoose.Schema.Types.ObjectId, ref: "Job" },
    jobDetail:      String,       // free-text task description if no formal Job
    targetQuantity: Number,
    process:        { type: mongoose.Schema.Types.ObjectId, ref: "Process" },
    processName:    String,       // snapshot
    // Status
    status: {
      type: String,
      enum: ["Planned", "InProgress", "Completed", "Cancelled"],
      default: "Planned",
    },
    remarks: String,
  },
  { timestamps: true }
);

// ─── Machine Maintenance Schema ──────────────────────────

// Indexes
machineAssignmentSchema.index({ company: 1, machine: 1, date: 1, shift: 1 });

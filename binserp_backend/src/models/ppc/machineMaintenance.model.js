import mongoose from "mongoose";

export const machineMaintenanceSchema = new mongoose.Schema(
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
    type: {
      type: String,
      enum: ["Breakdown", "Preventive", "Corrective", "Inspection"],
      required: true,
    },
    reportedBy:  { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
    reportedAt:  { type: Date, default: Date.now },
    description: { type: String, required: true },
    severity: {
      type: String,
      enum: ["Low", "Medium", "High", "Critical"],
      default: "Medium",
    },
    status: {
      type: String,
      enum: ["Open", "InProgress", "Resolved", "Closed"],
      default: "Open",
    },
    resolvedBy:  { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
    resolvedAt:  Date,
    downtime:    Number,  // hours
    cost:        Number,
    sparesUsed: [{
      itemName: String,
      quantity: Number,
      unit:     String,
    }],
    photos:  [String],
    remarks: String,
  },
  { timestamps: true }
);


// Indexes
machineMaintenanceSchema.index({ company: 1, machine: 1, status: 1 });
machineMaintenanceSchema.index({ company: 1, machine: 1, reportedAt: -1 });

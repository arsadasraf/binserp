import mongoose from "mongoose";

export const jobSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    jobNumber: {
      type: String,
      required: true,
    },
    // Added for Order Overhaul
    customerName: String,
    partName: String,
    poNumber: String,
    index: Number,
    masterProduct: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Component"
    },

    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      // required: true, // Made optional for Shift Planning
    },
    routeCard: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RouteCard",
    },
    operation: { // Legacy field, keeping for backward compatibility if needed, but processHistory is primary
      operationName: String,
      sequence: Number,
      machineType: String,
      standardTime: Number,
      manpowerRequired: Number,
      skillsRequired: [String],
    },
    assignedMachine: { // Order Level / Main Machine
      type: mongoose.Schema.Types.ObjectId,
      ref: "Machine",
    },
    assignedManpower: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Manpower",
      },
    ],
    scheduledStart: {
      type: Date,
    },
    scheduledEnd: {
      type: Date,
    },
    actualStart: {
      type: Date,
    },
    actualEnd: {
      type: Date,
    },
    status: {
      type: String,
      enum: ["Scheduled", "InProgress", "Completed", "OnHold", "Cancelled"],
      default: "Scheduled",
    },
    // Granular Process Tracking
    processHistory: [{
      operationName: String,
      sequence: Number,
      standardTime: Number,
      status: {
        type: String,
        enum: ['Pending', 'InProgress', 'Completed'],
        default: 'Pending'
      },
      assignedMachine: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Machine"
      },
      // Gang Assignment (Operator + Helpers)
      assignedTeam: [
        {
          employee: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
          role: { type: String, enum: ["Operator", "Helper", "Apprentice"], default: "Operator" }
        }
      ],
      assignedEmployee: { // Legacy Support: Keep for now, but auto-sync with Team[0]
        type: mongoose.Schema.Types.ObjectId,
        ref: "Employee"
      },
      targetDate: Date,
      startTime: Date,
      endTime: Date,
      issues: [{
        description: String,
        reportedBy: String,
        createdAt: { type: Date, default: Date.now }
      }],
      feedback: String,
      isJobWork: { type: Boolean, default: false },
      qcRequired: { type: Boolean, default: false },
      assignedVendor: { type: mongoose.Schema.Types.ObjectId, ref: 'VendorStore' }
    }],
    quantity: {
      type: Number,
      required: true,
    },
    completedQuantity: {
      type: Number,
      default: 0,
    },
    remarks: String,
  },
  { timestamps: true }
);

// Indexes
jobSchema.index({ company: 1, jobNumber: 1 }, { unique: true });
jobSchema.index({ company: 1, order: 1 });
jobSchema.index({ company: 1, status: 1 });

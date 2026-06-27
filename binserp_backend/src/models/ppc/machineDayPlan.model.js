import mongoose from "mongoose";

export const machineDayPlanSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    machine: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Machine",
      required: true,
    },
    shifts: [{
      name: {
        type: String,
        enum: ["First", "Second", "Third", "General", "Custom"],
        required: true
      },
      startTime: String, // HH:MM
      endTime: String    // HH:MM
    }],
    activeShifts: { type: [String], default: [] }, // Legacy/Redundant support if needed, or remove. keeping for safety but shifts is primary
    status: {
      type: String, // 'Active', 'Maintenance', 'Inactive'
      default: 'Active'
    }
  },
  { timestamps: true }
);

// Indexes
// export const WorkOrder = mongoose.model("WorkOrder", workOrderSchema);
// export const Process = mongoose.model("Process", processSchema);
// export const MachineCategory = mongoose.model("MachineCategory", machineCategorySchema);

// Indexes
machineDayPlanSchema.index({ company: 1, machine: 1, date: 1 }, { unique: true });

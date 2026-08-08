import mongoose from "mongoose";

export const workstationSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    workstationCode: {
      type: String,
      required: true,
    },
    workstationName: {
      type: String,
      required: true,
    },
    workstationType: {
      type: String,
      enum: ["INDIVIDUAL_MACHINE", "ASSEMBLY_LINE"],
      default: "INDIVIDUAL_MACHINE",
    },
    location: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MachineLocation",
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MachineCategory",
    },
    machines: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Machine",
      },
    ],
    processes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Process",
      },
    ],
    hourlyRate: {
      type: Number,
      default: 0,
    },
    capacityHoursPerDay: {
      type: Number,
      default: 8,
    },
    status: {
      type: String,
      enum: ["Active", "Maintenance", "Inactive"],
      default: "Active",
    },
    description: String,
  },
  { timestamps: true }
);

workstationSchema.index({ company: 1, workstationCode: 1 }, { unique: true });

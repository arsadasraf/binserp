import mongoose from "mongoose";

export const machineSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    // ── Identity ──────────────────────────────────────
    machineCode:   { type: String, required: true },
    machineName:   { type: String, required: true },
    machineType:   { type: String, required: true }, // e.g. Lathe, CNC
    make:          String,
    model:         String,
    serialNumber:  String,
    commissionYear: Number,
    // ── Financial / Legal ─────────────────────────────
    purchaseDate:    Date,
    purchaseValue:   Number,
    vendor:          String,
    warrantyExpiry:  Date,
    insuranceExpiry: Date,
    // ── Classification ────────────────────────────────
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MachineCategory",
    },
    location: { type: String },
    // ── Capabilities: which processes this machine can do ──
    // Quick-reference process IDs (kept for backward compat)
    processes: [{ type: mongoose.Schema.Types.ObjectId, ref: "Process" }],
    // Rich capability records
    capabilities: [{
      process:       { type: mongoose.Schema.Types.ObjectId, ref: "Process" },
      processName:   String,          // snapshot
      operationType: String,          // e.g. Roughing, Finishing
      minSize:       String,
      maxSize:       String,
      tolerance:     String,          // e.g. ±0.01 mm
      cycleTime:     Number,          // minutes per piece
      notes:         String,
    }],
    // ── Runtime ───────────────────────────────────────
    hourlyRate:  Number,
    capacity:    Number,
    status: {
      type: String,
      enum: ["Available", "Busy", "Maintenance", "Breakdown"],
      default: "Available",
    },
    description: String,
    specifications: mongoose.Schema.Types.Mixed,
    photos: [String],
  },
  { timestamps: true }
);

// ─── Machine Assignment Schema ───────────────────────────
// Indexes
machineSchema.index({ company: 1, machineCode: 1 }, { unique: true });

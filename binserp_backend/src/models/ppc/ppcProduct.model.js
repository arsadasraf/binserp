import mongoose from "mongoose";

export const ppcProductSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    // Link to the Store's FG Item
    fgItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FGItem",
      required: true,
    },
    // The manufacturing process sequence
    routing: [
      {
        sequence: {
          type: Number,
          default: 10,
        },
        stepName: String,
        process: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Process",
          required: true,
        },
        processName: String,

        // Inside (In-house) vs Outside (Subcontracted Job Work)
        processType: {
          type: String,
          enum: ["Inside", "Outside"],
          default: "Inside",
        },
        isOutsourced: {
          type: Boolean,
          default: false,
        },

        // --- Inside Process Configuration ---
        workstation: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Workstation",
        },
        machine: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Machine",
        },
        machineCategory: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "MachineCategory",
        },
        setupTime: {
          type: Number,
          default: 0,
        }, // in minutes
        cycleTime: {
          type: Number,
          default: 0,
        }, // in minutes

        // --- Outside (Job Work) Configuration ---
        supplier: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "JobWorkSupplier",
        },
        supplierName: String,
        leadTimeDays: {
          type: Number,
          default: 1,
        },
        jobWorkRate: {
          type: Number,
          default: 0,
        }, // ₹ per piece
        outsideInstructions: String,

        // --- Attachments (Photos & Documents/PDFs) ---
        photos: [
          {
            url: { type: String, required: true },
            name: String,
            caption: String,
            uploadedAt: { type: Date, default: Date.now },
          },
        ],
        documents: [
          {
            url: { type: String, required: true },
            name: String,
            fileType: String,
            size: Number,
            uploadedAt: { type: Date, default: Date.now },
          },
        ],

        // --- Quality Control (QC) ---
        qcRequired: {
          type: Boolean,
          default: false,
        },
        qcStage: {
          type: String,
          enum: ["None", "In-Process", "First-Piece", "Stage-Gate", "Final"],
          default: "In-Process",
        },
        qualityMaster: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "QualityMaster",
        },
        isMandatoryPass: {
          type: Boolean,
          default: true,
        },
        inspectionParameters: [
          {
            parameterName: { type: String, required: true },
            specification: String,
            tolerance: String,
            method: String,
            sampleSize: String,
            mandatory: { type: Boolean, default: true },
          },
        ],

        // --- BOM Items Consumed at this Step ---
        bomRequirements: [
          {
            item: {
              type: mongoose.Schema.Types.ObjectId,
              required: true,
            },
            itemType: {
              type: String,
              enum: ["Material", "RawMaterial", "BoughtOut", "FGItem", "Component"],
              required: true,
            },
            itemName: { type: String },
            itemCode: { type: String },
            quantity: {
              type: Number,
              required: true,
            },
            unit: { type: String },
            scrapPercentage: {
              type: Number,
              default: 0,
            },
            notes: String,
          },
        ],

        description: String,
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

// Indexes
ppcProductSchema.index({ company: 1, fgItem: 1 }, { unique: true });

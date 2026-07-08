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
        process: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Process",
          required: true,
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
        
        // The specific BOM items consumed DURING this process step
        bomRequirements: [
          {
            item: {
              type: mongoose.Schema.Types.ObjectId,
              required: true,
            },
            itemType: {
              type: String,
              enum: ["Material", "FGItem", "Component"],
              required: true,
            },
            itemName: { type: String },
            quantity: {
              type: Number,
              required: true,
            },
            unit: { type: String },
          }
        ]
      }
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    }
  },
  { timestamps: true }
);

// Indexes
ppcProductSchema.index({ company: 1, fgItem: 1 }, { unique: true });

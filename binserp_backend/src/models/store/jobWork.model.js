import mongoose from "mongoose";

export const jobWorkSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    challanNumber: {
      type: String,
      required: true,
      unique: true,
    },
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    expectedReturnDate: {
      type: Date,
    },
    status: {
      type: String,
      enum: ["Open", "Partial", "Closed", "Overdue"],
      default: "Open",
    },
    items: [
      {
        item: {
          type: mongoose.Schema.Types.ObjectId,
          // Refers to Material (BO) or Component (InHouse)
          required: true,
        },
        itemName: String,
        itemType: {
          type: String,
          enum: ["bo", "inhouse", "Component", "SubAssembly", "Assembly"],
          required: true,
        },
        processType: {
          type: String,
          required: true,
        },
        quantitySent: {
          type: Number,
          required: true,
        },
        quantityReceived: {
          type: Number,
          default: 0,
        },
        unit: {
          type: String,
          default: "PCS",
        },
        description: String,
        status: {
          type: String,
          enum: ["Sent", "Partial", "Completed"],
          default: "Sent"
        },

      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    receiveHistory: [
      {
        date: { type: Date, default: Date.now },
        itemId: mongoose.Schema.Types.ObjectId,
        quantity: Number
      }
    ]
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Quotation Schema

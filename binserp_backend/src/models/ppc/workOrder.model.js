import mongoose from "mongoose";

export const workOrderSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    workOrderNumber: {
      type: String,
      required: true,
    },
    component: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Component",
      required: true,
    },
    po: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    routeCard: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RouteCard",
    },
    operations: [
      {
        operationName: String,
        sequence: Number,
        machineType: String,
        standardTime: Number,
        assignedMachine: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Machine",
        },
        assignedManpower: [
          {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Manpower",
          },
        ],
        status: {
          type: String,
          enum: ["Pending", "InProgress", "Completed", "OnHold"],
          default: "Pending",
        },
        scheduledStart: Date,
        scheduledEnd: Date,
        actualStart: Date,
        actualEnd: Date,
      },
    ],
    status: {
      type: String,
      enum: ["Pending", "Scheduled", "InProgress", "Completed", "OnHold", "Cancelled"],
      default: "Pending",
    },
    scheduledStart: Date,
    scheduledEnd: Date,
    actualStart: Date,
    actualEnd: Date,
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


// Indexes
workOrderSchema.index({ company: 1, workOrderNumber: 1 }, { unique: true });
workOrderSchema.index({ company: 1, component: 1 });
workOrderSchema.index({ company: 1, po: 1 });

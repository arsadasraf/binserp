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
    poNumber: {
      type: String,
    },
    vehicleNo: {
      type: String,
    },
    estimatedWeight: {
      type: Number,
    },
    estimatedPrice: {
      type: Number,
    },
    freightType: {
      type: String,
      enum: ["To pay", "Paid", "LR/NR"],
    },
    ewayBillNo: {
      type: String,
    },
    lrNr: {
      type: String,
    },
    eSugamNo: {
      type: String,
    },
    eSugamDate: {
      type: Date,
    },
    jobWorkType: {
      type: String,
      enum: ["store-conversion", "store-to-wip", "wip-to-wip", "route-card", "inventory-conversion"],
      default: "store-conversion",
    },
    mrpPlan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MRPPlan",
    },
    mrpNumber: {
      type: String,
    },
    routeCardRef: {
      job: { type: mongoose.Schema.Types.ObjectId, ref: "Job" },
      routeCard: { type: mongoose.Schema.Types.ObjectId, ref: "RouteCard" },
      operationSequence: Number,
      operationName: String,
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
        },
        itemName: String,
        itemType: {
          type: String,
          enum: ["rm", "bo", "fg", "inhouse", "Component", "SubAssembly", "Assembly", "custom"],
          default: "rm",
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
        unitPrice: {
          type: Number,
          default: 0,
        },
        processType: {
          type: String,
          required: true,
        },
        description: String,
        status: {
          type: String,
          enum: ["Sent", "Partial", "Completed"],
          default: "Sent"
        },
        // Multiple returning items generated from this single sent item
        returningItems: [
          {
            receivedItem: {
              type: mongoose.Schema.Types.ObjectId,
            },
            receivedItemName: String,
            receivedItemType: {
              type: String,
              enum: ["rm", "bo", "fg", "inhouse", "Component", "SubAssembly", "Assembly", "custom"],
              default: "fg",
            },
            quantityToBeReceived: {
              type: Number,
              required: true,
            },
            quantityReceived: {
              type: Number,
              default: 0,
            },
            receivingUnit: {
              type: String,
              default: "PCS",
            },
            status: {
              type: String,
              enum: ["Sent", "Partial", "Completed"],
              default: "Sent"
            }
          }
        ],
        // Legacy single item fields for backward compatibility
        itemToBeReceived: String,
        receivedItem: {
          type: mongoose.Schema.Types.ObjectId,
        },
        receivedItemName: String,
        receivedItemType: String,
        quantityToBeReceived: Number,
        receivingUnit: String,
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    receiveHistory: [
      {
        date: { type: Date, default: Date.now },
        grnNumber: String,
        vendorDcNumber: String,
        vendorInvoiceDate: Date,
        vehicleNo: String,
        itemId: mongoose.Schema.Types.ObjectId,
        itemName: String,
        quantity: Number,
        qcRequired: { type: Boolean, default: true },
        qcStatus: {
          type: String,
          enum: ["Pending", "Passed", "Rejected", "Partial"],
          default: "Passed"
        },
        acceptedQuantity: Number,
        rejectedQuantity: Number,
        reworkQuantity: Number,
        rejectionReason: String,
        batchNumber: String,
        documents: [
          {
            url: String,
            filename: String,
            fileType: String
          }
        ],
        remarks: String,
        receivedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User"
        }
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

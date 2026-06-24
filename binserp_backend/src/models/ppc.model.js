import mongoose from "mongoose";

// Order Schema
export const orderSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    orderNumber: {
      type: String,
      required: true,
    },
    customerName: {
      type: String,
      required: true,
    },
    poReference: { type: String }, // NEW: PO Reference
    productCode: {
      type: String,
      required: true,
    },
    productName: {
      type: String,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    dispatchDate: {
      type: Date,
      required: true,
    },
    priority: {
      type: String,
      enum: ["Low", "Medium", "High", "Urgent"],
      default: "Medium",
    },
    photos: [{ type: String }], // Order Photos
    status: {
      type: String,
      enum: ["Pending", "Planning", "InProgress", "Completed", "Dispatched", "Cancelled"],
      default: "Pending",
    },
    bom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BOM",
    },
    routeCard: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RouteCard",
    },
    components: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Component",
      },
    ],
    // Link to Jobs/WorkOrders (Unique Items)
    jobs: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Job"
      }
    ],
    completionPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    remarks: String,
  },
  { timestamps: true }
);



// Route Card Schema
export const routeCardSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    routeCardNumber: {
      type: String,
      required: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
    },
    productCode: {
      type: String,
      required: true,
    },
    productName: {
      type: String,
      required: true,
    },
    bom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BOM",
    },
    operations: [
      {
        operationName: { type: String, required: true },
        sequence: { type: Number, required: true },
        machineType: { type: String, required: true },
        standardTime: { type: Number, required: true }, // in minutes
        manpowerRequired: { type: Number, default: 1 },
        skillsRequired: [{ type: String }],
        description: String,
        isJobWork: { type: Boolean, default: false }, // NEW: Flag for Job Work
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    status: {
      type: String,
      enum: ["Draft", "Active", "Inactive"],
      default: "Draft",
    },
  },
  { timestamps: true }
);

// Machine Schema
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
// Shift-wise assignment of operator + job to a machine
export const machineAssignmentSchema = new mongoose.Schema(
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
    date:  { type: Date, required: true },
    shift: {
      type: String,
      enum: ["Morning", "Afternoon", "Night", "General", "Custom"],
      required: true,
    },
    startTime: String, // HH:MM — filled from shift master or custom
    endTime:   String, // HH:MM
    // Personnel
    operator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    helpers: [{ type: mongoose.Schema.Types.ObjectId, ref: "Employee" }],
    // Work
    job:            { type: mongoose.Schema.Types.ObjectId, ref: "Job" },
    jobDetail:      String,       // free-text task description if no formal Job
    targetQuantity: Number,
    process:        { type: mongoose.Schema.Types.ObjectId, ref: "Process" },
    processName:    String,       // snapshot
    // Status
    status: {
      type: String,
      enum: ["Planned", "InProgress", "Completed", "Cancelled"],
      default: "Planned",
    },
    remarks: String,
  },
  { timestamps: true }
);
machineAssignmentSchema.index({ company: 1, machine: 1, date: 1, shift: 1 });

// ─── Machine Maintenance Schema ──────────────────────────
// Breakdown events and maintenance history
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
machineMaintenanceSchema.index({ company: 1, machine: 1, status: 1 });
machineMaintenanceSchema.index({ company: 1, machine: 1, reportedAt: -1 });

// Manpower Schema (separate from Employee for tracking load and availability)
export const manpowerSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    skills: [
      {
        name: { type: String, required: true },
        level: { type: Number, min: 1, max: 5 },
      },
    ],
    currentLoad: {
      type: Number,
      default: 0, // percentage or hours
    },
    availability: {
      type: Number,
      default: 100, // percentage
    },
    status: {
      type: String,
      enum: ["Available", "Busy", "OnLeave", "Absent"],
      default: "Available",
    },
  },
  { timestamps: true }
);

// Job Schema
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

// Component Schema (part of a PO/Order)
export const componentSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    po: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      // required: true, // Made optional for Master creation
    },
    componentCode: {
      type: String,
      required: true,
    },
    componentName: {
      type: String,
      required: true,
    },
    type: { // Added for Master Product Tab
      type: String,
      enum: ["Component", "SubAssembly", "Assembly"],
      default: "Component"
    },
    trackingType: {
      type: String,
      enum: ["Individual", "Batch"],
      default: "Individual"
    },
    isInventoryItem: {
      type: Boolean,
      default: false
    },
    description: String,
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
    },
    location: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Location",
    },
    unit: String,
    quantity: {
      type: Number,
      // required: true, // Made optional
      // min: 1,
    },
    price: {
      type: Number,
      default: 0
    },
    routeCard: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RouteCard",
    },
    status: {
      type: String,
      enum: ["Pending", "InProgress", "Completed", "OnHold"],
      default: "Pending",
    },
    completionPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    completedQuantity: {
      type: Number,
      default: 0,
    },
    remarks: String,
    billOfMaterials: [
      {
        item: {
          type: mongoose.Schema.Types.ObjectId,
          required: true,
          refPath: 'billOfMaterials.itemModel'
        },
        itemModel: {
          type: String,
          required: true,
          enum: ['Material', 'Component'] // Material from Store, Component from PPC
        },
        itemName: String, // Snapshot for easier display
        quantity: { type: Number, required: true },
        unit: String
      }
    ],
    routing: [
      {
        machine: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Machine',
        },
        process: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Process'
        },
        processName: String, // Snapshot or custom overlay
        standardTime: { type: Number, required: true }, // in minutes
        qcRequired: { type: Boolean, default: false },
        isOutsourced: { type: Boolean, default: false }, // New field for In-house vs Jobwork
        description: String,
        requiredItems: [
          {
            item: {
              type: mongoose.Schema.Types.ObjectId,
              required: true,
              refPath: 'routing.requiredItems.itemModel'
            },
            itemModel: {
              type: String,
              required: true,
              enum: ['Material', 'Component']
            },
            itemName: String, // Snapshot
            quantity: { type: Number, required: true },
            unit: String
          }
        ],
        photos: [String] // Per-process photos
      }
    ],
    photos: [String] // Added for Product Photos
  },
  { timestamps: true }
);

// WorkOrder Schema (manufacturing instructions for a component)
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
orderSchema.index({ company: 1, orderNumber: 1 }, { unique: true });
routeCardSchema.index({ company: 1, routeCardNumber: 1 }, { unique: true });
machineSchema.index({ company: 1, machineCode: 1 }, { unique: true });
manpowerSchema.index({ company: 1, employee: 1 }, { unique: true });
jobSchema.index({ company: 1, jobNumber: 1 }, { unique: true });
jobSchema.index({ company: 1, order: 1 });
jobSchema.index({ company: 1, status: 1 });
componentSchema.index({ company: 1, po: 1 });
componentSchema.index({ company: 1, componentCode: 1 });
workOrderSchema.index({ company: 1, workOrderNumber: 1 }, { unique: true });
workOrderSchema.index({ company: 1, component: 1 });
workOrderSchema.index({ company: 1, po: 1 });

// Process Schema
export const processSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    processCode: {
      type: String,
      required: true,
    },
    processName: {
      type: String,
      required: true,
    },
    description: String,
  },
  { timestamps: true }
);

// Machine Category Schema
export const machineCategorySchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    categoryCode: {
      type: String,
      required: true,
    },
    categoryName: {
      type: String,
      required: true,
    },
    hsnCode: { type: String },
    description: String,
  },
  { timestamps: true }
);

// Material Requirement Schema (Calculated Demand)
export const materialRequirementSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PPCOrder", // Link to PPC Order
      required: true,
    },
    targetMonth: String, // For grouping requirements by month
    items: [
      {
        material: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Material", // From Store Module
        },
        component: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Component", // Inhouse Item
        },
        materialName: String,
        requiredQuantity: { type: Number, required: true },
        unit: String,
        stockAvailable: { type: Number, default: 0 }, // Snapshot at time of calculation
        shortage: { type: Number, default: 0 },
        status: {
          type: String,
          enum: ["Pending", "PR Raised", "Fulfilled"],
          default: "Pending"
        }
      }
    ],
    status: {
      type: String,
      enum: ["Draft", "Finalized"],
      default: "Draft"
    }
  },
  { timestamps: true }
);

// Indexes
processSchema.index({ company: 1, processCode: 1 }, { unique: true });
materialRequirementSchema.index({ company: 1, order: 1 });
materialRequirementSchema.index({ company: 1, targetMonth: 1 });
machineCategorySchema.index({ company: 1, categoryCode: 1 }, { unique: true });

// Machine Location Schema
export const machineLocationSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    locationCode: {
      type: String,
      required: true,
    },
    locationName: {
      type: String,
      required: true,
    },
    description: String,
  },
  { timestamps: true }
);

machineLocationSchema.index({ company: 1, locationCode: 1 }, { unique: true });


// Enhanced PPC Order Schema (Used by Store currently)
export const ppcOrderSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    orderNumber: {
      type: String,
      required: true,
    },
    poReference: {
      type: String,
      required: true,
    },
    targetMonth: {
      type: String, // "MM-YYYY"
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
    },
    customerName: String,
    photos: [String], // Added for Order Photos
    date: {
      type: Date,
      default: Date.now,
    },
    deliveryDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["Pending", "Confirmed", "Planning", "InProduction", "InProgress", "Completed", "Dispatched", "Cancelled"],
      default: "Pending",
    },
    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Component", // Master Component
        },
        productName: String,
        productCode: String,
        description: String,
        unit: String,
        price: {
          type: Number,
          default: 0,
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
        trackingType: {
          type: String,
          enum: ["Individual", "Batch"],
          default: "Individual",
        },
        targetDate: {
          type: Date,
        },
        // Snapshots
        bomSnapshot: [],
        processSnapshot: [],
        photosSnapshot: [String],
        // Linked Jobs (Traceability IDs)
        jobs: [
          {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Job",
          },
        ],
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    remarks: String,
  },
  { timestamps: true }
);

// Indexes
ppcOrderSchema.index({ company: 1, orderNumber: 1 }, { unique: true });

// New Production Order Schema (Exclusively for PPC Tab using Components)
export const productionOrderSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    orderNumber: {
      type: String,
      required: true,
    },
    poReference: {
      type: String,
      required: true,
    },
    targetMonth: {
      type: String, // "MM-YYYY"
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
    },
    customerName: String,
    photos: [String],
    date: {
      type: Date,
      default: Date.now,
    },
    deliveryDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["Pending", "Confirmed", "Planning", "InProduction", "InProgress", "Completed", "Dispatched", "Cancelled"],
      default: "Pending",
    },
    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Component", // Strictly Master Component
        },
        productName: String,
        productCode: String,
        description: String,
        unit: String,
        price: {
          type: Number,
          default: 0,
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
        trackingType: {
          type: String,
          enum: ["Individual", "Batch"],
          default: "Individual",
        },
        targetDate: {
          type: Date,
        },
        // Snapshots
        bomSnapshot: [],
        processSnapshot: [],
        photosSnapshot: [String],
        // Linked Jobs (Traceability IDs)
        jobs: [
          {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Job",
          },
        ],
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    remarks: String,
  },
  { timestamps: true }
);

// Indexes
productionOrderSchema.index({ company: 1, orderNumber: 1 }, { unique: true });

// Manpower Allotment Schema (Roster)
export const manpowerAllotmentSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee", // Link to HR Employee
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    shift: {
      type: String,
      required: true,
    },
    startTime: String, // "HH:MM", required for Custom, auto-filled for others
    endTime: String,   // "HH:MM"
    machines: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Machine",
    }],
    remarks: String,
  },
  { timestamps: true }
);

// Indexes
manpowerAllotmentSchema.index({ company: 1, employee: 1, date: 1 }, { unique: true }); // One allotment per day per employee


// export const PPCOrder = mongoose.model("PPCOrder", ppcOrderSchema);
// export const Order = mongoose.model("Order", orderSchema);
// export const RouteCard = mongoose.model("RouteCard", routeCardSchema);
// export const Machine = mongoose.model("Machine", machineSchema);
// export const Manpower = mongoose.model("Manpower", manpowerSchema);
// export const Job = mongoose.model("Job", jobSchema);
// export const Component = mongoose.model("Component", componentSchema);

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
machineDayPlanSchema.index({ company: 1, machine: 1, date: 1 }, { unique: true });
// export const WorkOrder = mongoose.model("WorkOrder", workOrderSchema);
// export const Process = mongoose.model("Process", processSchema);
// export const MachineCategory = mongoose.model("MachineCategory", machineCategorySchema);
// Shift Schema (Company Specific)
export const shiftSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    startTime: {
      type: String, // HH:MM
      required: true,
    },
    endTime: {
      type: String, // HH:MM
      required: true,
    },
    description: String,
  },
  { timestamps: true }
);

// Indexes
shiftSchema.index({ company: 1, name: 1 }, { unique: true });

// export const MachineLocation = mongoose.model("MachineLocation", machineLocationSchema);
// export const ManpowerAllotment = mongoose.model("ManpowerAllotment", manpowerAllotmentSchema);
// export const Shift = mongoose.model("Shift", shiftSchema);


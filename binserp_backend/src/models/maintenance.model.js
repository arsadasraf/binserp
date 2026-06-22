import mongoose from "mongoose";

// Breakdown Ticket Schema (Corrective Maintenance)
export const breakdownTicketSchema = new mongoose.Schema(
    {
        company: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Company",
            required: true,
        },
        ticketNumber: {
            type: String,
            required: true,
            unique: true,
        },
        machine: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Machine",
            required: true,
        },
        reportedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        issueDescription: {
            type: String,
            required: true,
        },
        priority: {
            type: String,
            enum: ["Low", "Medium", "High", "Critical"],
            default: "Medium",
        },
        status: {
            type: String,
            enum: ["Open", "Assigned", "InProgress", "Resolved", "Closed"],
            default: "Open",
        },
        assignedTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User", // Maintenance Engineer
        },
        breakdownTime: {
            type: Date,
            default: Date.now,
        },
        resolutionTime: Date,
        solution: String,
        cost: {
            type: Number,
            default: 0,
        },
        sparePartsUsed: [
            {
                part: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "SparePart",
                },
                quantity: Number,
            },
        ],
        photos: [String],
    },
    { timestamps: true }
);

// Preventive Maintenance Schedule Schema
export const preventiveScheduleSchema = new mongoose.Schema(
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
        title: {
            type: String,
            required: true, // e.g., "Weekly Oiling"
        },
        frequency: {
            type: String,
            enum: ["Daily", "Weekly", "Monthly", "Quarterly", "HalfYearly", "Yearly"],
            required: true,
        },
        checklist: [String], // Array of tasks
        lastMaintenanceDate: Date,
        nextDueDate: {
            type: Date,
            required: true,
        },
        assignedTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        status: {
            type: String,
            enum: ["Active", "Inactive"],
            default: "Active",
        },
    },
    { timestamps: true }
);

// Maintenance History Schema (Log of performed preventive maintenance)
export const maintenanceHistorySchema = new mongoose.Schema(
    {
        company: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Company",
            required: true,
        },
        schedule: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "PreventiveSchedule",
        },
        machine: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Machine",
            required: true,
        },
        performedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        date: {
            type: Date,
            default: Date.now,
        },
        status: {
            type: String,
            enum: ["Completed", "Missed", "Partial"],
            default: "Completed",
        },
        remarks: String,
        sparePartsUsed: [
            {
                part: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "SparePart",
                },
                quantity: Number,
            },
        ],
    },
    { timestamps: true }
);

// Spare Parts Inventory Schema
export const sparePartSchema = new mongoose.Schema(
    {
        company: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Company",
            required: true,
        },
        partName: {
            type: String,
            required: true,
        },
        partCode: {
            type: String,
            required: true,
        },
        category: String, // e.g., "Electrical", "Mechanical"
        specifications: String,
        currentStock: {
            type: Number,
            required: true,
            default: 0,
            min: 0,
        },
        minStockLevel: {
            type: Number,
            default: 5, // Alert threshold
        },
        unitPrice: {
            type: Number,
            default: 0,
        },
        location: String, // Rack/Bin number
        compatibleMachines: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Machine",
            },
        ],
        supplier: String,
    },
    { timestamps: true }
);

// Indexes
breakdownTicketSchema.index({ company: 1, ticketNumber: 1 }, { unique: true });
breakdownTicketSchema.index({ company: 1, status: 1 });
preventiveScheduleSchema.index({ company: 1, machine: 1 });
preventiveScheduleSchema.index({ company: 1, nextDueDate: 1 });
sparePartSchema.index({ company: 1, partCode: 1 });

import mongoose from "mongoose";

// 1. Installed Base (Sold Goods, Machinery, Serials, Delivery & Warranty)
export const installedBaseSchema = new mongoose.Schema(
    {
        company: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Company",
            required: true,
        },
        customer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Customer",
            required: true,
        },
        customerName: { type: String, required: true, trim: true },
        productName: { type: String, required: true, trim: true },
        productDescription: { type: String, trim: true },
        serialNumber: { type: String, required: true, trim: true },
        batchNumber: { type: String, trim: true },
        deliveryDate: { type: Date, default: Date.now },
        invoiceNumber: { type: String, trim: true },

        warrantyPeriodMonths: { type: Number, default: 12 },
        warrantyExpiryDate: { type: Date },
        warrantyStatus: {
            type: String,
            enum: ["Under Warranty", "Out of Warranty", "AMC Active"],
            default: "Under Warranty"
        },

        amcStartDate: { type: Date },
        amcEndDate: { type: Date },
        amcValue: { type: Number, default: 0 },

        location: { type: String, trim: true }, // Plant / Site location
        notes: { type: String },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        createdByName: { type: String, trim: true },
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        updatedByName: { type: String, trim: true }
    },
    { timestamps: true }
);

installedBaseSchema.index({ company: 1, serialNumber: 1 });
installedBaseSchema.index({ company: 1, customer: 1 });

// 2. Service & Support Ticket
export const serviceTicketSchema = new mongoose.Schema(
    {
        company: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Company",
            required: true,
        },
        ticketNo: { type: String, required: true, trim: true },
        customer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Customer",
            required: true,
        },
        customerName: { type: String, required: true, trim: true },
        installedProduct: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "InstalledBase",
        },
        productName: { type: String, trim: true },
        serialNumber: { type: String, trim: true },

        category: {
            type: String,
            enum: ["Breakdown", "Preventive Maintenance", "Installation", "Calibration", "Spare Parts", "General Service"],
            default: "Breakdown"
        },
        priority: {
            type: String,
            enum: ["Low", "Medium", "High", "Urgent"],
            default: "Medium"
        },
        status: {
            type: String,
            enum: ["Open", "Assigned", "In Progress", "Resolved", "Closed"],
            default: "Open"
        },

        issueDescription: { type: String, required: true },
        assignedTechnician: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        technicianName: { type: String, trim: true },

        resolutionNotes: { type: String },
        resolvedAt: { type: Date },

        chargeable: { type: Boolean, default: false },
        serviceCost: { type: Number, default: 0 },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        createdByName: { type: String, trim: true },
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        updatedByName: { type: String, trim: true }
    },
    { timestamps: true }
);

serviceTicketSchema.index({ company: 1, ticketNo: 1 });
serviceTicketSchema.index({ company: 1, customer: 1 });
serviceTicketSchema.index({ company: 1, status: 1 });

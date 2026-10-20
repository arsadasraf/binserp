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

        // Field Engineer Dispatch & Scheduling
        scheduledVisitDate: { type: Date },
        timeSlot: { type: String, trim: true }, // e.g. "10:00 AM - 01:00 PM"
        
        // Spare Parts Requirement
        sparePartsRequired: [
            {
                partName: { type: String, trim: true },
                partNumber: { type: String, trim: true },
                quantity: { type: Number, default: 1 },
                isReplaced: { type: Boolean, default: false }
            }
        ],

        resolutionNotes: { type: String },
        resolvedAt: { type: Date },

        // Customer Service Sign-off
        customerSignOff: {
            signedBy: { type: String, trim: true },
            remarks: { type: String },
            satisfactionRating: { type: Number, min: 1, max: 5, default: 5 },
            signedAt: { type: Date }
        },

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

// ==========================================
// 3. INSTALLATION & COMMISSIONING (I&C)
// ==========================================
export const crmInstallationSchema = new mongoose.Schema(
    {
        company: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Company",
            required: true,
        },
        installationNo: { type: String, required: true, trim: true },
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
        productName: { type: String, required: true, trim: true },
        productDescription: { type: String, trim: true },
        serialNumber: { type: String, required: true, trim: true },
        siteLocation: { type: String, trim: true },
        commissioningDate: { type: Date, default: Date.now },

        fieldEngineer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        fieldEngineerName: { type: String, trim: true },

        clientAttendants: [
            {
                name: { type: String, trim: true },
                designation: { type: String, trim: true },
                phone: { type: String, trim: true },
                email: { type: String, trim: true }
            }
        ],

        checklist: [
            {
                item: { type: String, required: true },
                status: {
                    type: String,
                    enum: ["Pending", "Passed", "Failed", "N/A"],
                    default: "Passed"
                },
                remarks: { type: String }
            }
        ],

        trainingProvided: {
            conducted: { type: Boolean, default: true },
            topicsCovered: { type: String },
            traineesCount: { type: Number, default: 0 }
        },

        media: {
            photos: [{ type: String }],
            videoUrls: [
                {
                    title: { type: String },
                    url: { type: String, required: true },
                    type: {
                        type: String,
                        enum: ["Upload", "YouTube", "Drive", "Vimeo", "Link"],
                        default: "Upload"
                    }
                }
            ]
        },

        signOff: {
            isSignedOff: { type: Boolean, default: false },
            signedByClientName: { type: String, trim: true },
            signedByClientDesignation: { type: String, trim: true },
            signOffDate: { type: Date },
            satisfactionRating: { type: Number, min: 1, max: 5, default: 5 },
            remarks: { type: String }
        },

        status: {
            type: String,
            enum: ["Scheduled", "In Progress", "Completed & Signed Off", "On Hold"],
            default: "Scheduled"
        },

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

crmInstallationSchema.index({ company: 1, installationNo: 1 });
crmInstallationSchema.index({ company: 1, customer: 1 });
crmInstallationSchema.index({ company: 1, status: 1 });

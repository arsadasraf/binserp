import mongoose from "mongoose";

export const customerSchema = new mongoose.Schema(
    {
        company: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Company",
            required: true,
        },
        name: { type: String, required: true, trim: true }, // Company / Customer Name
        customerCode: { type: String, trim: true },
        contactPerson: { type: String, trim: true },
        designation: { type: String, trim: true },
        email: { type: String, trim: true, lowercase: true },
        phone: { type: String, trim: true },
        altPhone: { type: String, trim: true },
        website: { type: String, trim: true },

        // Multiple Contact Persons
        contactPersons: [
            {
                name: { type: String, trim: true },
                designation: { type: String, trim: true },
                email: { type: String, trim: true },
                phone: { type: String, trim: true },
                isPrimary: { type: Boolean, default: false }
            }
        ],

        // Address Details
        address: {
            street: String,
            city: String,
            state: String,
            zipCode: String,
            country: { type: String, default: "India" }
        },
        shippingAddress: {
            street: String,
            city: String,
            state: String,
            zipCode: String,
            country: { type: String, default: "India" }
        },

        // Business & Tax Details
        gstin: { type: String, trim: true },
        pan: { type: String, trim: true },
        industry: { type: String, trim: true },
        tier: {
            type: String,
            enum: ["Platinum", "Gold", "Silver", "Standard"],
            default: "Standard"
        },
        creditLimit: { type: Number, default: 0 },
        annualRevenue: { type: Number, default: 0 },

        // Relationship Origin
        source: { type: String, default: "Direct" },
        convertedFromLead: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Lead",
        },

        assignedAccountManager: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },

        tags: [{ type: String, trim: true }],
        notes: { type: String },

        // Multi-modal Contact Notes (Audio, Photos, Documents/Files, Formatted text)
        notesHistory: [
            {
                type: { 
                    type: String, 
                    enum: ["Call", "WhatsApp", "Meeting", "Email", "Note", "Site Visit", "Demo"],
                    default: "Note" 
                },
                text: { type: String, required: true },
                voiceUrl: { type: String },
                voiceDuration: { type: Number, default: 0 },
                photos: [{ type: String }],
                attachments: [
                    {
                        name: String,
                        url: String,
                        size: Number,
                        mimeType: String
                    }
                ],
                createdBy: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User"
                },
                createdByName: { type: String },
                createdAt: { type: Date, default: Date.now }
            }
        ],

        // Customer Travel & Visit History Tracking
        travelHistory: [
            {
                visitDate: { type: Date, default: Date.now },
                visitorName: { type: String, trim: true },
                visitorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
                purpose: { type: String, trim: true },
                location: { type: String, trim: true },
                distanceKm: { type: Number, default: 0 },
                travelMode: { 
                    type: String, 
                    enum: ["Flight", "Train", "Cab", "Car", "Bike", "Bus", "Other"],
                    default: "Car" 
                },
                expense: { type: Number, default: 0 },
                minutesOfMeeting: { type: String },
                outcome: { 
                    type: String, 
                    enum: ["Positive", "Follow-up Needed", "PO Expected", "Closure", "No Outcome"],
                    default: "Positive" 
                },
                nextVisitDate: { type: Date },
                photos: [{ type: String }],
                attachments: [
                    {
                        name: String,
                        url: String
                    }
                ],
                createdBy: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User"
                },
                createdAt: { type: Date, default: Date.now }
            }
        ],

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        createdByName: { type: String, trim: true },
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        updatedByName: { type: String, trim: true },
    },
    { timestamps: true }
);

customerSchema.index({ company: 1, name: 1 });
customerSchema.index({ company: 1, phone: 1 });
customerSchema.index({ company: 1, email: 1 });

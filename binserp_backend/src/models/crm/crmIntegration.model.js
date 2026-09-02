import mongoose from "mongoose";
import crypto from "crypto";

export const crmIntegrationSchema = new mongoose.Schema(
    {
        company: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Company",
            required: true,
            unique: true
        },
        // IndiaMART CRM Pull API Config
        indiaMart: {
            glusrMobile: { type: String, trim: true },
            glusrAuthKey: { type: String, trim: true },
            autoSync: { type: Boolean, default: false },
            syncIntervalMinutes: { type: Number, default: 60 },
            lastSyncAt: { type: Date },
            lastQueryTime: { type: String }, // formatted string for IndiaMART API query window
            defaultAssignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            defaultSource: { type: String, default: "IndiaMART" }
        },

        // TradeIndia CRM Config
        tradeIndia: {
            userId: { type: String, trim: true },
            profileId: { type: String, trim: true },
            authKey: { type: String, trim: true },
            autoSync: { type: Boolean, default: false },
            lastSyncAt: { type: Date },
            defaultAssignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
        },

        // Custom Inbound Webhook
        webhook: {
            webhookToken: {
                type: String,
                default: () => crypto.randomBytes(24).toString("hex"),
                unique: true
            },
            secretKey: {
                type: String,
                default: () => crypto.randomBytes(32).toString("hex")
            },
            isActive: { type: Boolean, default: true },
            defaultAssignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            defaultSource: { type: String, default: "Website Webhook" }
        },

        // Sync Audit Logs
        syncLogs: [
            {
                source: { type: String, required: true }, // IndiaMART, TradeIndia, Webhook, Excel
                syncTime: { type: Date, default: Date.now },
                status: { type: String, enum: ["Success", "Failed", "Partial"], default: "Success" },
                recordsFetched: { type: Number, default: 0 },
                recordsInserted: { type: Number, default: 0 },
                recordsSkipped: { type: Number, default: 0 },
                message: { type: String },
                errorDetails: { type: String }
            }
        ]
    },
    { timestamps: true }
);

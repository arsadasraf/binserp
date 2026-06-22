import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
    {
        adminId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "SaasAdmin",
            required: true,
        },
        adminUsername: {
            type: String,
            required: true,
        },
        action: {
            type: String,
            required: true,
            enum: [
                "LOGIN",
                "LOGOUT",
                "COMPANY_STATUS_CHANGE",
                "COMPANY_SUSPEND",
                "COMPANY_UNSUSPEND",
                "COMPANY_DELETE",
                "USER_DELETE",
                "EXPORT_DATA",
                "VIEW_ANALYTICS",
            ],
        },
        targetType: {
            type: String,
            enum: ["COMPANY", "USER", "SYSTEM", "EXPORT"],
            required: true,
        },
        targetId: {
            type: String,
            default: "",
        },
        targetName: {
            type: String,
            default: "",
        },
        details: {
            type: Object,
            default: {},
        },
        ipAddress: {
            type: String,
            default: "",
        },
        userAgent: {
            type: String,
            default: "",
        },
    },
    { timestamps: true }
);

// Index for faster queries
auditLogSchema.index({ adminId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ targetType: 1, targetId: 1 });

export const AuditLog = mongoose.model("AuditLog", auditLogSchema);

import { AuditLog } from "../models/auditlog.model.js";

/**
 * Log an admin action to the audit log
 * @param {Object} params - Logging parameters
 * @param {string} params.adminId - Admin user ID
 * @param {string} params.adminUsername - Admin username
 * @param {string} params.action - Action performed
 * @param {string} params.targetType - Type of target (COMPANY, USER, etc.)
 * @param {string} params.targetId - ID of target
 * @param {string} params.targetName - Name of target
 * @param {Object} params.details - Additional details
 * @param {Object} params.req - Express request object for IP/UA
 */
export const logAuditAction = async ({
    adminId,
    adminUsername,
    action,
    targetType,
    targetId = "",
    targetName = "",
    details = {},
    req = null,
}) => {
    try {
        const ipAddress = req ? getClientIp(req) : "";
        const userAgent = req ? req.get("user-agent") || "" : "";

        await AuditLog.create({
            adminId,
            adminUsername,
            action,
            targetType,
            targetId,
            targetName,
            details,
            ipAddress,
            userAgent,
        });
    } catch (error) {
        console.error("Failed to log audit action:", error);
        // Don't throw - audit logging should not break the main flow
    }
};

/**
 * Get client IP address from request
 */
const getClientIp = (req) => {
    return (
        req.headers["x-forwarded-for"]?.split(",")[0] ||
        req.headers["x-real-ip"] ||
        req.connection?.remoteAddress ||
        req.socket?.remoteAddress ||
        ""
    );
};

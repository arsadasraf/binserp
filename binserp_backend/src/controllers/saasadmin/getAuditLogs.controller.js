import jwt from "jsonwebtoken";
import asyncHandler from "express-async-handler";
import { SaasAdmin } from "../../models/saasadmin/index.js";
import { Company } from "../../models/company/index.js";
// import { User } from "../../models/user/index.js";
import { AuditLog } from "../../models/auditlog/index.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { logAuditAction } from "../../utils/auditLogger.js";
import { getTenantModel } from "../../db/tenant.js";
import { userSchema } from "../../models/user/index.js";
import crypto from "crypto";

// 🔑 Generate JWT for SaaS Admin
const generateToken = (adminId) => {
    return jwt.sign({ id: adminId, type: "saasadmin" }, process.env.JWT_SECRET, {
        expiresIn: "7d",
    });
};

// 🔐 Login SaaS Admin

export const getAuditLogs = asyncHandler(async (req, res) => {
    const { action, targetType, limit = 50, skip = 0 } = req.query;

    // Build filter
    const filter = {};
    if (action) {
        filter.action = action;
    }
    if (targetType) {
        filter.targetType = targetType;
    }

    const logs = await AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip(parseInt(skip))
        .populate("adminId", "username email");

    const total = await AuditLog.countDocuments(filter);

    res.status(200).json(
        new ApiResponse(
            200,
            {
                logs,
                pagination: {
                    total,
                    limit: parseInt(limit),
                    skip: parseInt(skip),
                    hasMore: total > parseInt(skip) + parseInt(limit),
                },
            },
            `${logs.length} audit logs retrieved`
        )
    );
});

// 📥 Export Companies CSV

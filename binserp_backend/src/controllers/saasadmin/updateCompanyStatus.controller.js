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

export const updateCompanyStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { isVerified } = req.body;

    if (typeof isVerified !== "boolean") {
        throw new ApiError(400, "isVerified must be a boolean value");
    }

    const company = await Company.findByIdAndUpdate(
        id,
        { isVerified },
        { new: true, runValidators: true }
    ).select("-password");

    if (!company) {
        throw new ApiError(404, "Company not found");
    }

    // Log status change
    await logAuditAction({
        adminId: req.user._id,
        adminUsername: req.user.username,
        action: "COMPANY_STATUS_CHANGE",
        targetType: "COMPANY",
        targetId: id,
        targetName: company.companyName,
        details: { isVerified },
        req,
    });

    res
        .status(200)
        .json(new ApiResponse(200, company, "Company status updated successfully"));
});

// 🚫 Suspend Company

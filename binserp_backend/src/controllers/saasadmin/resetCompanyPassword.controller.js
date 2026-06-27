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

export const resetCompanyPassword = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const company = await Company.findById(id);
    if (!company) {
        throw new ApiError(404, "Company not found");
    }

    const plainPassword = generateStrongPassword();
    company.password = plainPassword; // will be hashed by pre-save
    await company.save();

    // Audit log
    await logAuditAction({
        adminId: req.user._id,
        adminUsername: req.user.username,
        action: "COMPANY_PASSWORD_RESET",
        targetType: "COMPANY",
        targetId: id,
        targetName: company.companyName,
        req,
    });

    res.status(200).json(
        new ApiResponse(200, {
            companyName: company.companyName,
            companyId: company.companyId,
            userId: company.userId,
            contactNumber: company.contactNumber,
            password: plainPassword, // plaintext — shown once
        }, "Password reset successfully")
    );
});

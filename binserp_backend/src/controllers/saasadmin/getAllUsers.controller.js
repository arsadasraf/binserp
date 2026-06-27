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

export const getAllUsers = asyncHandler(async (req, res) => {
    const { search, department, companyId } = req.query;

    // Build filter
    const filter = {};
    if (search) {
        filter.$or = [
            { name: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
            { userId: { $regex: search, $options: "i" } },
        ];
    }
    if (department) {
        filter.department = department;
    }
    if (companyId) {
        filter.company = companyId;
    }

    const users = []; /* await User.find(filter)
        .select("-password")
        .populate("company", "companyName email")
        .sort({ createdAt: -1 }); */

    res
        .status(200)
        .json(new ApiResponse(200, users, `${users.length} users retrieved`));
});

// 🔄 Update Company Status

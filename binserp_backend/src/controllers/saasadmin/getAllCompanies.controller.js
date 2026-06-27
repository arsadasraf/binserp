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

export const getAllCompanies = asyncHandler(async (req, res) => {
    const { search, verified, sortBy = "createdAt", order = "desc" } = req.query;

    // Build filter
    const filter = {};
    if (search) {
        filter.$or = [
            { companyName: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
            { city: { $regex: search, $options: "i" } },
        ];
    }
    if (verified !== undefined) {
        filter.isVerified = verified === "true";
    }

    // Build sort
    const sort = {};
    sort[sortBy] = order === "asc" ? 1 : -1;

    // Get companies with user count
    const companies = await Company.aggregate([
        { $match: filter },
        {
            $lookup: {
                from: "users",
                localField: "_id",
                foreignField: "company",
                as: "users",
            },
        },
        {
            $project: {
                companyName: 1,
                email: 1,
                contactNumber: 1,
                city: 1,
                country: 1,
                logo: 1,
                isVerified: 1,
                isSuspended: 1,
                suspensionReason: 1,
                createdAt: 1,
                updatedAt: 1,
                userCount: { $size: "$users" },
            },
        },
        { $sort: sort },
    ]);

    res
        .status(200)
        .json(
            new ApiResponse(200, companies, `${companies.length} companies retrieved`)
        );
});

// 🏢 Get Company By ID

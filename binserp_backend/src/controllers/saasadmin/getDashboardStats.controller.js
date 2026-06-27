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

export const getDashboardStats = asyncHandler(async (req, res) => {
    // Get total companies
    const totalCompanies = await Company.countDocuments();
    const verifiedCompanies = await Company.countDocuments({ isVerified: true });
    const unverifiedCompanies = await Company.countDocuments({
        isVerified: false,
    });
    const suspendedCompanies = await Company.countDocuments({
        isSuspended: true,
    });

    // Get total users (This is now hard because users are split across databases)
    const totalUsers = 0; // await User.countDocuments();

    // Get companies registered in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentCompanies = await Company.countDocuments({
        createdAt: { $gte: thirtyDaysAgo },
    });

    // Get companies by month (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const companiesByMonth = await Company.aggregate([
        {
            $match: {
                createdAt: { $gte: sixMonthsAgo },
            },
        },
        {
            $group: {
                _id: {
                    year: { $year: "$createdAt" },
                    month: { $month: "$createdAt" },
                },
                count: { $sum: 1 },
            },
        },
        {
            $sort: { "_id.year": 1, "_id.month": 1 },
        },
    ]);

    // Get recent registrations (last 5)
    const recentRegistrations = await Company.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select("companyName email city createdAt isVerified");

    const stats = {
        totalCompanies,
        verifiedCompanies,
        unverifiedCompanies,
        suspendedCompanies,
        totalUsers,
        recentCompanies,
        companiesByMonth,
        recentRegistrations,
    };

    res.status(200).json(new ApiResponse(200, stats, "Dashboard stats retrieved"));
});

// 🏢 Get All Companies

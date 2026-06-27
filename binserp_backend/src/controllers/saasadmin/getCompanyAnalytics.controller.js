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

export const getCompanyAnalytics = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const company = await Company.findById(id);
    if (!company) {
        throw new ApiError(404, "Company not found");
    }

    // Get users by department
    const usersByDepartment = []; /* await User.aggregate([
        { $match: { company: company._id } },
        {
            $group: {
                _id: "$department",
                count: { $sum: 1 },
            },
        },
    ]); */

    // Get user growth over last 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const userGrowth = []; /* await User.aggregate([
        {
            $match: {
                company: company._id,
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
    ]); */

    // Get total users
    const totalUsers = 0; // await User.countDocuments({ company: id });

    // Get recent users (last 10)
    const recentUsers = []; /* await User.find({ company: id })
        .select("name email department createdAt")
        .sort({ createdAt: -1 })
        .limit(10); */

    const analytics = {
        companyName: company.companyName,
        totalUsers,
        usersByDepartment,
        userGrowth,
        recentUsers,
        registeredAt: company.createdAt,
        isVerified: company.isVerified,
        isSuspended: company.isSuspended,
    };

    // Log analytics view
    await logAuditAction({
        adminId: req.user._id,
        adminUsername: req.user.username,
        action: "VIEW_ANALYTICS",
        targetType: "COMPANY",
        targetId: id,
        targetName: company.companyName,
        req,
    });

    res
        .status(200)
        .json(new ApiResponse(200, analytics, "Company analytics retrieved"));
});

// 👥 Get Users By Company

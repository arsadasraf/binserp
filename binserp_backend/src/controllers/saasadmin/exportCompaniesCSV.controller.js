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

export const exportCompaniesCSV = asyncHandler(async (req, res) => {
    const companies = await Company.aggregate([
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
                isVerified: 1,
                isSuspended: 1,
                createdAt: 1,
                userCount: { $size: "$users" },
            },
        },
        { $sort: { createdAt: -1 } },
    ]);

    // Convert to CSV
    const headers = [
        "Company Name",
        "Email",
        "Contact",
        "City",
        "Country",
        "Verified",
        "Suspended",
        "Users",
        "Registered",
    ];

    const rows = companies.map((c) => [
        c.companyName,
        c.email,
        c.contactNumber,
        c.city || "",
        c.country || "",
        c.isVerified ? "Yes" : "No",
        c.isSuspended ? "Yes" : "No",
        c.userCount,
        new Date(c.createdAt).toLocaleDateString(),
    ]);

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");

    // Log export
    await logAuditAction({
        adminId: req.user._id,
        adminUsername: req.user.username,
        action: "EXPORT_DATA",
        targetType: "EXPORT",
        details: { type: "companies", count: companies.length },
        req,
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=companies.csv");
    res.status(200).send(csv);
});

// 📥 Export Users CSV

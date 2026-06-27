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

export const exportUsersCSV = asyncHandler(async (req, res) => {
    const users = []; /* await User.find()
        .select("-password")
        .populate("company", "companyName")
        .sort({ createdAt: -1 }); */

    // Convert to CSV
    const headers = [
        "Name",
        "Email",
        "User ID",
        "Company",
        "Department",
        "Registered",
    ];

    const rows = users.map((u) => [
        u.name,
        u.email,
        u.userId,
        u.company.companyName,
        u.department,
        new Date(u.createdAt).toLocaleDateString(),
    ]);

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");

    // Log export
    await logAuditAction({
        adminId: req.user._id,
        adminUsername: req.user.username,
        action: "EXPORT_DATA",
        targetType: "EXPORT",
        details: { type: "users", count: users.length },
        req,
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=users.csv");
    res.status(200).send(csv);
});

// ✨ Helper: Generate a random strong password
const generateStrongPassword = () => {
    const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const lower = "abcdefghjkmnpqrstuvwxyz";
    const digits = "23456789";
    const special = "@#$!";
    const all = upper + lower + digits + special;
    let password = 
        upper[Math.floor(Math.random() * upper.length)] +
        lower[Math.floor(Math.random() * lower.length)] +
        digits[Math.floor(Math.random() * digits.length)] +
        special[Math.floor(Math.random() * special.length)];
    for (let i = 4; i < 10; i++) {
        password += all[Math.floor(Math.random() * all.length)];
    }
    // Shuffle
    return password.split("").sort(() => Math.random() - 0.5).join("");
};

// 🏢 Create Company by SaaS Admin

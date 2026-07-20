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
import { generateTokens, setTokenCookies } from "../../utils/token.js";

// 🔐 Login SaaS Admin

export const loginSaasAdmin = asyncHandler(async (req, res) => {
    const { username, password } = req.body;

    console.log("=====================");
    console.log("🔐 SAAS ADMIN LOGIN ATTEMPT");
    console.log("Username received:", username);
    console.log("Password received:", password ? `Yes (length: ${password.length})` : "No");
    console.log("=====================");

    if (!username || !password) {
        throw new ApiError(400, "Username and password are required");
    }

    // Find SaaS Admin
    console.log("🔍 Searching for admin with username:", username);
    const admin = await SaasAdmin.findOne({ username });
    console.log("👤 Admin found:", admin ? "YES ✅" : "NO ❌");

    if (!admin) {
        console.log("❌ AUTHENTICATION FAILED: Admin not found");
        throw new ApiError(401, "Invalid credentials");
    }

    console.log("📝 Admin details:", {
        id: admin._id,
        username: admin.username,
        email: admin.email
    });

    // Check password
    console.log("🔐 Comparing passwords...");
    const isPasswordValid = await admin.comparePassword(password);
    console.log("✅ Password comparison result:", isPasswordValid);

    if (!isPasswordValid) {
        console.log("❌ AUTHENTICATION FAILED: Invalid password");
        throw new ApiError(401, "Invalid credentials");
    }

    // Log login action
    await logAuditAction({
        adminId: admin._id,
        adminUsername: admin.username,
        action: "LOGIN",
        targetType: "SYSTEM",
        details: { message: "Admin logged in successfully" },
        req,
    });

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(admin._id, "saasadmin");

    // Save refresh token
    admin.refreshToken = refreshToken;
    await admin.save({ validateBeforeSave: false });

    // Send response
    const adminData = {
        id: admin._id,
        username: admin.username,
        email: admin.email,
        roleLevel: admin.roleLevel,
    };

    res
        .cookie("saasAdminToken", accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 15 * 60 * 1000, // 15 minutes
        })
        .cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        })
        .status(200)
        .json(
            new ApiResponse(200, { admin: adminData, token: accessToken }, "Login successful")
        );
});

// 📊 Get Dashboard Statistics

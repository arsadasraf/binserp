import jwt from "jsonwebtoken";
import asyncHandler from "express-async-handler";
import { SaasAdmin } from "../models/saasadmin.model.js";
import { Company } from "../models/company.model.js";
// import { User } from "../models/user.model.js";
import { AuditLog } from "../models/auditlog.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { logAuditAction } from "../utils/auditLogger.js";
import { getTenantModel } from "../db/tenant.js";
import { userSchema } from "../models/user.model.js";
import crypto from "crypto";

// 🔑 Generate JWT for SaaS Admin
const generateToken = (adminId) => {
    return jwt.sign({ id: adminId, type: "saasadmin" }, process.env.JWT_SECRET, {
        expiresIn: "7d",
    });
};

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

    // Generate token
    const token = generateToken(admin._id);

    // Send response
    const adminData = {
        id: admin._id,
        username: admin.username,
        email: admin.email,
        roleLevel: admin.roleLevel,
    };

    res
        .cookie("saasAdminToken", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        })
        .status(200)
        .json(
            new ApiResponse(200, { admin: adminData, token }, "Login successful")
        );
});

// 📊 Get Dashboard Statistics
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
export const getCompanyById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const company = await Company.findById(id).select("-password");
    if (!company) {
        throw new ApiError(404, "Company not found");
    }

    // Get user count
    const userCount = await User.countDocuments({ company: id });

    const companyData = {
        ...company.toObject(),
        userCount,
    };

    res.status(200).json(new ApiResponse(200, companyData, "Company retrieved"));
});

// 📈 Get Company Analytics
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
export const getUsersByCompany = asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Verify company exists
    const company = await Company.findById(id);
    if (!company) {
        throw new ApiError(404, "Company not found");
    }

    const users = []; /* await User.find({ company: id })
        .select("-password")
        .sort({ createdAt: -1 }); */

    res
        .status(200)
        .json(
            new ApiResponse(
                200,
                { company: company.companyName, users },
                `${users.length} users retrieved`
            )
        );
});

// 👥 Get All Users
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
export const suspendCompany = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || reason.trim() === "") {
        throw new ApiError(400, "Suspension reason is required");
    }

    const company = await Company.findByIdAndUpdate(
        id,
        {
            isSuspended: true,
            suspensionReason: reason,
            suspendedAt: new Date(),
        },
        { new: true, runValidators: true }
    ).select("-password");

    if (!company) {
        throw new ApiError(404, "Company not found");
    }

    // Log suspension
    await logAuditAction({
        adminId: req.user._id,
        adminUsername: req.user.username,
        action: "COMPANY_SUSPEND",
        targetType: "COMPANY",
        targetId: id,
        targetName: company.companyName,
        details: { reason },
        req,
    });

    res
        .status(200)
        .json(new ApiResponse(200, company, "Company suspended successfully"));
});

// ✅ Unsuspend Company
export const unsuspendCompany = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const company = await Company.findByIdAndUpdate(
        id,
        {
            isSuspended: false,
            suspensionReason: "",
            suspendedAt: null,
        },
        { new: true, runValidators: true }
    ).select("-password");

    if (!company) {
        throw new ApiError(404, "Company not found");
    }

    // Log unsuspension
    await logAuditAction({
        adminId: req.user._id,
        adminUsername: req.user.username,
        action: "COMPANY_UNSUSPEND",
        targetType: "COMPANY",
        targetId: id,
        targetName: company.companyName,
        req,
    });

    res
        .status(200)
        .json(new ApiResponse(200, company, "Company unsuspended successfully"));
});

// 🗑️ Delete Company
export const deleteCompany = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const company = await Company.findById(id);
    if (!company) {
        throw new ApiError(404, "Company not found");
    }

    const userCount = 0; // await User.countDocuments({ company: id });

    // Delete all users associated with the company
    // await User.deleteMany({ company: id });

    // Delete the company
    await Company.findByIdAndDelete(id);

    // Log deletion
    await logAuditAction({
        adminId: req.user._id,
        adminUsername: req.user.username,
        action: "COMPANY_DELETE",
        targetType: "COMPANY",
        targetId: id,
        targetName: company.companyName,
        details: { deletedUsers: userCount },
        req,
    });

    res
        .status(200)
        .json(
            new ApiResponse(
                200,
                null,
                "Company and all associated users deleted successfully"
            )
        );
});

// 🗑️ Delete User
export const deleteUser = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const user = null; // await User.findById(id).populate("company", "companyName");
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    // await User.findByIdAndDelete(id);

    // Log deletion
    await logAuditAction({
        adminId: req.user._id,
        adminUsername: req.user.username,
        action: "USER_DELETE",
        targetType: "USER",
        targetId: id,
        targetName: user.name,
        details: { company: user.company.companyName, department: user.department },
        req,
    });

    res.status(200).json(new ApiResponse(200, null, "User deleted successfully"));
});

// 📜 Get Audit Logs
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
export const createCompanyBySaasAdmin = asyncHandler(async (req, res) => {
    const { companyName, companyType, service, email, contactNumber, city, pincode, country } = req.body;

    if (!companyName || !companyType || !service || !email || !contactNumber || !city) {
        throw new ApiError(400, "Company name, type, service, email, contact number, and city are required");
    }

    // Check duplicates
    const existingCompany = await Company.findOne({
        $or: [{ companyName }, { email }, { contactNumber }]
    });
    if (existingCompany) {
        throw new ApiError(400, "A company with this name, email, or contact number already exists");
    }

    // Auto-generate companyId and dbName
    const prefix = companyName.replace(/[^a-zA-Z]/g, "").substring(0, 4).toUpperCase().padEnd(4, "X");
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const companyId = `${prefix}${randomNum}`;
    const dbName = `bins_company_${companyId.toLowerCase()}`;

    // Auto-generate userId and password
    const userId = `${prefix.toLowerCase()}_admin`;
    const plainPassword = generateStrongPassword();

    // Create company (pre-verified, no email flow)
    const newCompany = new Company({
        companyName,
        companyType,
        service,
        email,
        contactNumber,
        city,
        pincode: pincode || "",
        country: country || "India",
        companyId,
        dbName,
        userId,
        password: plainPassword, // will be hashed by pre-save hook
        isVerified: true,
        verificationCode: "",
        verificationCodeExpires: null,
    });

    await newCompany.save();

    // Seed tenant DB with admin user
    try {
        const TenantUser = getTenantModel(dbName, "User", userSchema);
        const existingTenantUser = await TenantUser.findOne({ userId });
        if (!existingTenantUser) {
            const newAdmin = new TenantUser({
                company: newCompany._id,
                name: companyName,
                userId,
                email,
                password: plainPassword, // will be hashed by userSchema pre-save
                department: "MD",
                roleLevel: 10,
                allowedIP: "",
                allowedLocation: { lat: 0, lng: 0 }
            });
            await newAdmin.save();
            console.log(`✅ Tenant DB '${dbName}' seeded with admin user.`);
        }
    } catch (seedError) {
        console.error("⚠️ Tenant DB seeding failed:", seedError);
    }

    // Audit log
    await logAuditAction({
        adminId: req.user._id,
        adminUsername: req.user.username,
        action: "COMPANY_CREATE",
        targetType: "COMPANY",
        targetId: newCompany._id,
        targetName: companyName,
        details: { companyId, userId },
        req,
    });

    res.status(201).json(
        new ApiResponse(201, {
            companyName,
            companyId,
            userId,
            password: plainPassword, // plaintext — shown once
            contactNumber,
            email,
            city,
        }, "Company created successfully")
    );
});

// 🔑 Reset Company Password by SaaS Admin
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

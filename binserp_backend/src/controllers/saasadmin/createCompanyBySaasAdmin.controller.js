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

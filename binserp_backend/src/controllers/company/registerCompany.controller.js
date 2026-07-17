import { Company } from "../../models/company/index.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { uploadOnS3, deleteFromS3, signPhotos } from "../../utils/s3.js";
import { getTenantModel } from "../../db/tenant.js";
import { userSchema } from "../../models/user/index.js";

// Generate JWT token
const generateToken = (companyId) => {
  return jwt.sign({ id: companyId }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

// ✅ Register Company

export const registerCompany = async (req, res) => {
  try {
    const { companyName, companyType, service, contactNumber, email, state, city, pincode } = req.body;

    // Validate input
    if (!companyName || !companyType || !service || !contactNumber || !email || !state || !city) {
      return res.status(400).json({ message: "Company name, company type, service, contact number, email, state, and city are required" });
    }

    // Check if email or company name already exists
    const existingCompany = await Company.findOne({
      $or: [{ companyName }, { email }],
    });

    if (existingCompany) {
      return res.status(400).json({ message: "Company name or email already exists" });
    }


    // Generate Company ID Details
    const prefix = companyName.replace(/[^a-zA-Z]/g, "").substring(0, 4).toUpperCase().padEnd(4, "X");
    const companyId = `${prefix}${Math.floor(1000 + Math.random() * 9000)}`;
    const dbName = `bins_company_${companyId.toLowerCase()}`;

    // Auto generate secure password, since login relies heavily on Google OAuth
    const password = "GOOGLE_AUTH_" + crypto.randomBytes(16).toString("hex");

    const newCompany = new Company({
      companyName,
      companyType,
      service,
      contactNumber,
      email,
      state,
      city,
      pincode,
      companyId,
      dbName,
      password,
      isVerified: true, // Instantly Verified
      verificationCode: "", 
      verificationCodeExpires: null,
    });

    await newCompany.save();
    console.log("Company registered and saved successfully.");

    // Send Welcome Email
    // SEED TENANT DATABASE
    try {
      console.log(`Seeding Tenant DB: ${newCompany.dbName} with Admin User...`);
      const TenantUser = getTenantModel(newCompany.dbName, "User", userSchema);

      const adminUserId = email.split('@')[0] + Math.floor(100 + Math.random() * 900);
      const existingTenantUser = await TenantUser.findOne({ userId: adminUserId });

      if (!existingTenantUser) {
        const newAdmin = new TenantUser({
          company: newCompany._id,
          name: newCompany.companyName,
          userId: adminUserId,
          email: newCompany.email,
          password: password, // Will be hashed automatically by user schema
          department: "MD",
          roleLevel: 10,
          allowedIP: "",
          allowedLocation: { lat: 0, lng: 0 }
        });
        await newAdmin.save();
        console.log(`✅ Tenant DB '${newCompany.dbName}' created and Admin User seeded.`);
      }
    } catch (seedError) {
      console.error("⚠️ Failed to seed tenant database. It will be created on first usage.", seedError);
    }

    const token = generateToken(newCompany._id);

    res.status(201).json({
      message: "Registration completed successfully!",
      company: {
        id: newCompany._id,
        companyName: newCompany.companyName,
        email: newCompany.email,
        isVerified: true,
      },
      token,
    });
  } catch (error) {
    console.error("Registration Error:", error);
    if (error.code === 11000) {
      // Handle MongoDB Duplicate Key Index Error cleanly
      const duplicateField = Object.keys(error.keyPattern)[0];
      return res.status(400).json({ message: `The ${duplicateField} is already registered. Please use a unique ${duplicateField}.` });
    }
    res.status(500).json({ message: error.message });
  }
};

// ✅ Login Company

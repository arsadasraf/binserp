import { Company } from "../models/company.model.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { sendVerificationCode, sendPasswordResetEmail, sendWelcomeEmail } from "../utils/emailService.js";
import { sendWhatsAppVerificationCode } from "../utils/whatsappService.js";
import { uploadOnS3, deleteFromS3, signPhotos } from "../utils/s3.js";
import { getTenantModel } from "../db/tenant.js";
import { userSchema } from "../models/user.model.js";

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
    await sendWelcomeEmail(newCompany.email, newCompany.companyName);

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
export const loginCompany = async (req, res) => {
  try {
    const { companyId, password } = req.body;

    if (!companyId || !password) {
      return res.status(400).json({ message: "CompanyID and Password are required" });
    }

    // Check if company exists first
    const company = await Company.findOne({ companyId });
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }


    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    // Check if verified
    if (!company.isVerified) {
      return res.status(403).json({ message: "Please verify your email first" });
    }

    const isMatch = await company.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = generateToken(company._id);

    res.status(200).json({
      message: "Login successful",
      company: {
        id: company._id,
        companyName: company.companyName,
        email: company.email,
        logo: (await signPhotos([company.logo]))[0],
        isVerified: company.isVerified,
      },
      token,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ Request Password Reset
export const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const company = await Company.findOne({ email });
    if (!company) {
      // Don't reveal if email exists for security
      return res.status(200).json({ message: "If the email exists, a password reset link has been sent" });
    }

    // Generate reset token
    const resetToken = company.generatePasswordResetToken();
    await company.save();

    // Send password reset email
    await sendPasswordResetEmail(company.email, resetToken, company.companyName, "company");

    res.status(200).json({
      message: "Password reset link sent to your email",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ Reset Password
export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ message: "Token and new password are required" });
    }

    // Hash the token to compare with stored hash
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    // Find company with valid reset token
    const company = await Company.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!company) {
      return res.status(400).json({ message: "Invalid or expired reset token" });
    }

    // Update password
    company.password = newPassword; // Will be hashed by pre-save hook
    company.passwordResetToken = "";
    company.passwordResetExpires = null;
    await company.save();

    res.status(200).json({
      message: "Password reset successfully. You can now login with your new password.",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Helpers
export const getCompanyId = (req) => {
  return req.company?._id || (req.user.company ? req.user.company._id : req.user.id);
};

const getCompanyLoginId = (req) => {
  return req.company?.companyId || req.user?.companyId || req.user?.company?.companyId || "";
};

// ✅ Get Company Profile
export const getCompanyProfile = async (req, res) => {
  try {
    const company = await Company.findById(req.user.id).select("-password -verificationCode -passwordResetToken");
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }
    const companyObj = company.toObject();
    if (companyObj.logo) companyObj.logo = (await signPhotos([companyObj.logo]))[0];
    res.status(200).json(companyObj);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ Update Company Settings
export const updateCompanySettings = async (req, res) => {
  try {
    const { companyName, contactNumber, state, city, pincode } = req.body;

    const company = await Company.findById(req.user.id);
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    // Update fields if provided
    if (companyName) company.companyName = companyName;
    if (req.body.companyType) company.companyType = req.body.companyType;
    if (req.body.service) company.service = req.body.service;
    if (contactNumber) company.contactNumber = contactNumber;
    if (state) company.state = state;
    if (city) company.city = city;
    if (pincode !== undefined) company.pincode = pincode;

    // Extended Profile Fields
    if (req.body.billingAddress !== undefined) company.billingAddress = req.body.billingAddress;
    if (req.body.shippingAddress !== undefined) company.shippingAddress = req.body.shippingAddress;
    if (req.body.qualitySpecs !== undefined) company.qualitySpecs = req.body.qualitySpecs;
    if (req.body.commercialTerms !== undefined) company.commercialTerms = req.body.commercialTerms;
    if (req.body.bankDetails) company.bankDetails = req.body.bankDetails;
    if (req.body.printSettings) company.printSettings = req.body.printSettings;

    await company.save();

    res.status(200).json({
      message: "Company settings updated successfully",
      company: {
        id: company._id,
        companyName: company.companyName,
        companyType: company.companyType,
        service: company.service,
        email: company.email,
        contactNumber: company.contactNumber,
        state: company.state,
        city: company.city,
        pincode: company.pincode,
        logo: (await signPhotos([company.logo]))[0],
        // Extended fields
        billingAddress: company.billingAddress,
        shippingAddress: company.shippingAddress,
        qualitySpecs: company.qualitySpecs,
        commercialTerms: company.commercialTerms,
        bankDetails: company.bankDetails,
        printSettings: company.printSettings
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ Upload Company Logo
export const uploadCompanyLogo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const company = await Company.findById(req.user.id);
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    const companyId = req.user.id;
    // Upload to S3
    const result = await uploadOnS3(req.file.path, "logos", getCompanyLoginId(req));
    if (!result) {
      return res.status(500).json({ message: "Failed to upload logo to S3" });
    }

    // Update company logo
    company.logo = result.secure_url;
    await company.save();

    res.status(200).json({
      message: "Logo uploaded successfully",
      logo: (await signPhotos([company.logo]))[0],
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

import { userSchema } from "../../models/user/index.js";
import { employeeSchema } from "../../models/hr/index.js";
import { Company } from "../../models/company/index.js";
import { getTenantConnection, getTenantModel } from "../../db/tenant.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { uploadOnS3, deleteFromS3, signPhotos } from "../../utils/s3.js";

// Generate JWT token for users
// Generate JWT token for users
const generateUserToken = (userId, companyId) => {
  return jwt.sign({ id: userId, type: "user", companyId }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

const getCompanyLoginId = (req) => {
  return req.company?.companyId || req.user?.companyId || req.user?.company?.companyId || "";
};

// ✅ Create User (Admin only)

export const createUser = async (req, res) => {
  try {
    const { name, userId, email, password, role, department, roleLevel, allowedIP, allowedLocation } = req.body;
    // Get company ID - if company token, use req.user.id, if user token, use req.user.company._id
    const companyId = req.userType === "company" ? req.user.id : req.user.company._id;

    // Validate input
    if (!name || !userId || !password || !role) {
      return res.status(400).json({
        message: "All fields are required: name, userId, password, role"
      });
    }

    // Check if company exists
    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    const UserModel = req.getModel('User', userSchema);

    // Drop legacy unique index on email if present on tenant users collection
    try {
      await UserModel.collection.dropIndex('email_1');
    } catch (e) {
      // Ignore if index doesn't exist
    }

    // Check if userId already exists
    const existingUser = await UserModel.findOne({ userId });
    if (existingUser) {
      return res.status(400).json({
        message: "User ID already exists"
      });
    }

    // Clean email value (avoid empty string indexing conflict)
    const cleanEmail = email && typeof email === 'string' && email.trim() !== '' ? email.trim().toLowerCase() : undefined;

    // Create new user
    const newUser = await UserModel.create({
      company: companyId,
      name,
      userId,
      email: cleanEmail,
      password,
      department: department || "",
      role,
      roles: role ? [role] : [],
      allowedIP,
      allowedLocation,
      roleLevel: roleLevel || 1,
      isActive: true,
      activatedAt: new Date()
    });

    res.status(201).json({
      message: "User created successfully",
      user: {
        id: newUser._id,
        name: newUser.name,
        userId: newUser.userId,
        email: newUser.email,
        role: newUser.role,
        allowedIP: newUser.allowedIP,
        allowedLocation: newUser.allowedLocation,
        roleLevel: newUser.roleLevel,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ Get All Users (Admin only)

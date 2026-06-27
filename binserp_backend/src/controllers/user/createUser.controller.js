import { userSchema } from "../../models/user/index.js";
import { employeeSchema } from "../../models/hr/index.js";
import { Company } from "../../models/company/index.js";
import { getTenantConnection, getTenantModel } from "../../db/tenant.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { sendPasswordResetEmail } from "../../utils/emailService.js";
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
    const { name, userId, email, password, department, allowedIP, allowedLocation } = req.body;
    // Get company ID - if company token, use req.user.id, if user token, use req.user.company._id
    const companyId = req.userType === "company" ? req.user.id : req.user.company._id;

    // Validate input
    if (!name || !userId || !email || !password || !department) {
      return res.status(400).json({
        message: "All fields are required: name, userId, email, password, department"
      });
    }

    // Check if company exists
    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    // Check if userId or email already exists
    const UserModel = req.getModel('User', userSchema);
    const existingUser = await UserModel.findOne({
      $or: [{ userId }, { email }],
    });

    if (existingUser) {
      return res.status(400).json({
        message: "User ID or email already exists"
      });
    }

    // Create new user
    const newUser = await UserModel.create({
      company: companyId,
      name,
      userId,
      email,
      password,
      department,
      allowedIP,
      allowedLocation,
      roleLevel: getRoleLevel(department),
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
        department: newUser.department,
        allowedIP: newUser.allowedIP,
        allowedLocation: newUser.allowedLocation,
        roleLevel: newUser.roleLevel,
        name: newUser.name,
        userId: newUser.userId,
        email: newUser.email,
        department: newUser.department,
        roleLevel: newUser.roleLevel,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ Get All Users (Admin only)

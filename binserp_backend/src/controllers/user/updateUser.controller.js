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

export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, department, password, roleLevel, allowedIP, allowedLocation } = req.body;

    const UserModel = req.getModel('User', userSchema);
    const user = await UserModel.findOne({ _id: id });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update fields
    if (name) user.name = name;
    if (email) user.email = email;
    if (department) user.department = department;
    if (roleLevel !== undefined) user.roleLevel = roleLevel;
    if (password) user.password = password; // Will be hashed by pre-save hook
    if (allowedIP !== undefined) user.allowedIP = allowedIP;
    if (allowedLocation) user.allowedLocation = allowedLocation;

    await user.save();

    res.status(200).json({
      message: "User updated successfully",
      user: {
        id: user._id,
        name: user.name,
        userId: user.userId,
        email: user.email,
        department: user.department,
        roleLevel: user.roleLevel,
        allowedIP: user.allowedIP,
        allowedLocation: user.allowedLocation,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ Delete User

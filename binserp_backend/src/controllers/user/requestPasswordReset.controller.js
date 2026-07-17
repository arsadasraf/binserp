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

export const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    /* // Refactor: Password reset by email only is hard without knowing tenant
    const user = await User.findOne({ email });
    */
    const user = null; // DISABLED for now
    if (!user) {
      // Don't reveal if email exists for security
      return res.status(200).json({ message: "If the email exists, a password reset link has been sent" });
    }

    // Generate reset token
    const resetToken = user.generatePasswordResetToken();
    await user.save();

    // Send password reset email
    res.status(200).json({
      message: "Password reset link sent to your email",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ Reset Password

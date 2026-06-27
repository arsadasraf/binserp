import { Company } from "../../models/company/index.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { sendVerificationCode, sendPasswordResetEmail, sendWelcomeEmail } from "../../utils/emailService.js";
import { sendWhatsAppVerificationCode } from "../../utils/whatsappService.js";
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

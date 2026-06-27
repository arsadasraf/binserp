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

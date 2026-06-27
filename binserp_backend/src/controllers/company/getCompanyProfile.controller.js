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

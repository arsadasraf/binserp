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

export const getCompanyId = (req) => {
  return req.company?._id || (req.user.company ? req.user.company._id : req.user.id);
};

const getCompanyLoginId = (req) => {
  return req.company?.companyId || req.user?.companyId || req.user?.company?.companyId || "";
};

// ✅ Get Company Profile

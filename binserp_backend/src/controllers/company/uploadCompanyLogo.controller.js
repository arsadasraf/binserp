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

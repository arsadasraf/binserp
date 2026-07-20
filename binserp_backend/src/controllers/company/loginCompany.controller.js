import { Company } from "../../models/company/index.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { uploadOnS3, deleteFromS3, signPhotos } from "../../utils/s3.js";
import { getTenantModel } from "../../db/tenant.js";
import { userSchema } from "../../models/user/index.js";
import { generateTokens, setTokenCookies } from "../../utils/token.js";

// ✅ Register Company

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

    const { accessToken, refreshToken } = generateTokens(company._id, "company");

    // Save refresh token
    company.refreshToken = refreshToken;
    await company.save({ validateBeforeSave: false });

    // SET HTTP ONLY COOKIE
    setTokenCookies(res, accessToken, refreshToken);

    res.status(200).json({
      message: "Login successful",
      company: {
        id: company._id,
        companyName: company.companyName,
        email: company.email,
        logo: (await signPhotos([company.logo]))[0],
        isVerified: company.isVerified,
      },
      token: accessToken,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ Request Password Reset

import { Company } from "../../models/company/index.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { uploadOnS3, deleteFromS3, signPhotos } from "../../utils/s3.js";
import { getTenantModel } from "../../db/tenant.js";
import { userSchema } from "../../models/user/index.js";
import { generateTokens, setTokenCookies, parseDeviceInfo } from "../../utils/token.js";
import { clearCachedCompany } from "../../middlewares/auth.middleware.js";

// ✅ Login Company
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

    // 🚫 SUSPENSION CHECK: Block login immediately if company is suspended
    if (company.isSuspended) {
      return res.status(403).json({ message: "Your company has been suspended from ERP provider." });
    }

    // Check if verified
    if (!company.isVerified) {
      return res.status(403).json({ message: "Please verify your email first" });
    }

    const isMatch = await company.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const deviceInfo = parseDeviceInfo(req);

    // Increment token version for strict single-device login
    company.tokenVersion = (company.tokenVersion || 0) + 1;

    const { accessToken, refreshToken } = generateTokens(
      company._id,
      "company",
      null,
      company.tokenVersion,
      deviceInfo.accessMode
    );

    // Save refresh token & device info
    company.refreshToken = refreshToken;
    company.currentDevice = deviceInfo;
    await company.save({ validateBeforeSave: false });

    // Clear in-memory company cache so previous device is invalidated immediately
    clearCachedCompany(company.companyId, String(company._id));

    // SET HTTP ONLY COOKIE
    setTokenCookies(res, accessToken, refreshToken, deviceInfo.accessMode);

    res.status(200).json({
      message: "Login successful",
      company: {
        id: company._id,
        companyName: company.companyName,
        email: company.email,
        logo: (await signPhotos([company.logo]))[0],
        isVerified: company.isVerified,
        deviceInfo,
      },
      token: accessToken,
      refreshToken,
      deviceInfo,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

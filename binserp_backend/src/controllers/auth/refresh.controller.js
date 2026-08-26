import jwt from "jsonwebtoken";
import { getTenantModel } from "../../db/tenant.js";
import { userSchema } from "../../models/user/index.js";
import { employeeSchema } from "../../models/hr/index.js";
import { Company } from "../../models/company/index.js";
import { SaasAdmin } from "../../models/saasadmin/index.js";
import { ApiError } from "../../utils/ApiError.js";
import { generateTokens, setTokenCookies } from "../../utils/token.js";

const clearAuthCookies = (res) => {
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  };
  res.clearCookie("accessToken", cookieOptions);
  res.clearCookie("refreshToken", cookieOptions);
  res.clearCookie("saasAdminToken", cookieOptions);
  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");
  res.clearCookie("saasAdminToken");
};

export const refreshTokens = async (req, res, next) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      clearAuthCookies(res);
      throw new ApiError(401, "No refresh token provided");
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET);
    } catch (err) {
      clearAuthCookies(res);
      throw new ApiError(401, "Invalid or expired refresh token");
    }

    const { id, type, companyId } = decoded;
    let userModel;
    let userInstance;

    // Find the entity based on the type
    if (type === "saasadmin") {
      userInstance = await SaasAdmin.findById(id);
    } else if (type === "company") {
      userInstance = await Company.findById(id);
    } else if (type === "user" || type === "employee") {
      if (!companyId) {
        clearAuthCookies(res);
        throw new ApiError(400, "Company ID missing in token payload");
      }
      
      const company = await Company.findOne({ companyId });
      if (!company) {
        clearAuthCookies(res);
        throw new ApiError(404, "Company not found");
      }
      
      if (type === "user") {
        userModel = getTenantModel(company.dbName, "User", userSchema);
        userInstance = await userModel.findById(id);
      } else {
        userModel = getTenantModel(company.dbName, "Employee", employeeSchema);
        userInstance = await userModel.findById(id);
      }
    } else {
      clearAuthCookies(res);
      throw new ApiError(400, "Unknown token type");
    }

    if (!userInstance) {
      clearAuthCookies(res);
      throw new ApiError(404, "User not found");
    }

    // Verify the token matches the one in DB
    if (userInstance.refreshToken !== refreshToken) {
      clearAuthCookies(res);
      // Possible token reuse or revoked session from another device login.
      throw new ApiError(401, "Session expired. You logged in from another device.");
    }

    // Generate new access token
    const newTokens = generateTokens(id, type, companyId, userInstance.tokenVersion || 0);

    // Keep the existing refresh token to avoid race conditions with multiple tabs/requests
    const newAccessToken = newTokens.accessToken;

    // Set new cookies (this also renews the refresh token cookie expiration)
    setTokenCookies(res, newAccessToken, refreshToken);

    return res.status(200).json({
      message: "Tokens refreshed successfully",
      token: newAccessToken // Sent for backward compatibility if needed
    });
  } catch (error) {
    next(error);
  }
};

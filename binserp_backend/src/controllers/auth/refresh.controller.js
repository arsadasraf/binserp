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
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken || req.headers["x-refresh-token"];

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
      const otherDev = userInstance.currentDevice?.summary ? ` (${userInstance.currentDevice.summary})` : "";
      throw new ApiError(401, `Session expired. You logged in from another device${otherDev}.`);
    }

    const accessMode = decoded.accessMode || userInstance.currentDevice?.accessMode || "Browser";

    // Strict 24-hour cap on Web Browser sessions
    if (accessMode !== "App") {
      const loggedInAt = userInstance.currentDevice?.loggedInAt
        ? new Date(userInstance.currentDevice.loggedInAt).getTime()
        : (decoded.iat ? decoded.iat * 1000 : 0);
      if (loggedInAt > 0 && Date.now() - loggedInAt >= 24 * 60 * 60 * 1000) {
        userInstance.refreshToken = null;
        await userInstance.save({ validateBeforeSave: false });
        clearAuthCookies(res);
        throw new ApiError(401, "Web browser session expired after 24 hours. Please log in again.");
      }
    }

    // Generate new tokens:
    // For App mode, rotate refreshToken too so the session remains permanently active until explicit logout or another device login
    const newTokens = generateTokens(id, type, companyId, userInstance.tokenVersion || 0, accessMode);
    const newAccessToken = newTokens.accessToken;
    const activeRefreshToken = accessMode === "App" ? newTokens.refreshToken : refreshToken;

    if (accessMode === "App") {
      userInstance.refreshToken = activeRefreshToken;
      await userInstance.save({ validateBeforeSave: false });
    }

    // Set new cookies
    setTokenCookies(res, newAccessToken, activeRefreshToken, accessMode);

    return res.status(200).json({
      message: "Tokens refreshed successfully",
      token: newAccessToken,
      refreshToken: activeRefreshToken,
      accessMode,
    });
  } catch (error) {
    next(error);
  }
};

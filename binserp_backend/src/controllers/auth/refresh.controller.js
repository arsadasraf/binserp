import jwt from "jsonwebtoken";
import { getTenantModel } from "../../db/tenant.js";
import { userSchema } from "../../models/user/index.js";
import { employeeSchema } from "../../models/hr/index.js";
import { Company } from "../../models/company/index.js";
import { SaasAdmin } from "../../models/saasadmin/index.js";
import { ApiError } from "../../utils/ApiError.js";
import { generateTokens, setTokenCookies } from "../../utils/token.js";

export const refreshTokens = async (req, res, next) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      throw new ApiError(401, "No refresh token provided");
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET);
    } catch (err) {
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
      if (!companyId) throw new ApiError(400, "Company ID missing in token payload");
      
      const company = await Company.findOne({ companyId });
      if (!company) throw new ApiError(404, "Company not found");
      
      if (type === "user") {
        userModel = getTenantModel(company.dbName, "User", userSchema);
        userInstance = await userModel.findById(id);
      } else {
        userModel = getTenantModel(company.dbName, "Employee", employeeSchema);
        userInstance = await userModel.findById(id);
      }
    } else {
      throw new ApiError(400, "Unknown token type");
    }

    if (!userInstance) {
      throw new ApiError(404, "User not found");
    }

    // Verify the token matches the one in DB
    if (userInstance.refreshToken !== refreshToken) {
      // Possible token reuse / compromised token. Revoke all.
      userInstance.refreshToken = null;
      await userInstance.save({ validateBeforeSave: false });
      throw new ApiError(401, "Refresh token mismatch. Session revoked.");
    }

    // Generate new tokens (Rotation)
    const newTokens = generateTokens(id, type, companyId);

    // Save new refresh token
    userInstance.refreshToken = newTokens.refreshToken;
    await userInstance.save({ validateBeforeSave: false });

    // Set new cookies
    setTokenCookies(res, newTokens.accessToken, newTokens.refreshToken);

    return res.status(200).json({
      message: "Tokens refreshed successfully",
      token: newTokens.accessToken // Sent for backward compatibility if needed
    });
  } catch (error) {
    next(error);
  }
};

import jwt from "jsonwebtoken";
import { getTenantModel } from "../../db/tenant.js";
import { userSchema } from "../../models/user/index.js";
import { employeeSchema } from "../../models/hr/index.js";
import { Company } from "../../models/company/index.js";
import { SaasAdmin } from "../../models/saasadmin/index.js";

export const logout = async (req, res, next) => {
  try {
    const refreshToken = req.cookies.refreshToken || req.cookies.accessToken || req.cookies.saasAdminToken;

    if (refreshToken) {
      try {
        // Just decode, we don't care if it's expired for logout purposes
        const decoded = jwt.decode(refreshToken);
        if (decoded) {
          const { id, type, companyId } = decoded;
          let userInstance;

          if (type === "saasadmin") {
            userInstance = await SaasAdmin.findById(id);
          } else if (type === "company") {
            userInstance = await Company.findById(id);
          } else if ((type === "user" || type === "employee") && companyId) {
            const company = await Company.findOne({ companyId });
            if (company) {
              const userModel = getTenantModel(company.dbName, type === "user" ? "User" : "Employee", type === "user" ? userSchema : employeeSchema);
              userInstance = await userModel.findById(id);
            }
          }

          if (userInstance) {
            userInstance.refreshToken = null;
            await userInstance.save({ validateBeforeSave: false });
          }
        }
      } catch (err) {
        // Ignore decoding errors during logout, we will still clear cookies
        console.error("Error decoding token during logout:", err);
      }
    }

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    };

    res.clearCookie("accessToken", cookieOptions);
    res.clearCookie("refreshToken", cookieOptions);
    res.clearCookie("saasAdminToken", cookieOptions);

    return res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    next(error);
  }
};

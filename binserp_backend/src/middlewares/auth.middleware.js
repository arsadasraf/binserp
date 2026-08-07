import jwt from "jsonwebtoken";
import asyncHandler from "express-async-handler";
import { ApiError } from "../utils/ApiError.js";
import { Company } from "../models/company/index.js";
import { userSchema, roleSchema } from "../models/user/index.js";
import { employeeSchema } from "../models/hr/index.js";
import { SaasAdmin } from "../models/saasadmin/index.js";
import { getTenantConnection, getTenantModel } from "../db/tenant.js";


// ✅ Verify JWT Middleware (for Company Admin)
export const verifyJWT = asyncHandler(async (req, res, next) => {
  const token =
    req.cookies?.accessToken ||
    req.header("Authorization")?.replace("Bearer ", "");

  if (!token || token === "null" || token === "undefined") {
    throw new ApiError(401, "Unauthorized access: No token provided");
  }

  try {
    // 🔍 Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // console.log("[Auth] Token Decoded:", decoded.type);

    // Check if it's a user token
    if (decoded.type === "user") {
      let company;
      if (decoded.companyId) {
        company = await Company.findOne({ companyId: decoded.companyId });
      } else {
        throw new ApiError(401, "Invalid token: missing company context");
      }

      if (!company) throw new ApiError(404, "Company not found");

      // 2. Resolve Tenant
      const dbName = company.dbName;
      req.tenantConnection = getTenantConnection(dbName);

      // Helper
      req.getModel = (modelName, schema) => {
        return getTenantModel(dbName, modelName, schema);
      };

      // Pre-register common models for population queries
      req.getModel("User", userSchema);
      req.getModel("Employee", employeeSchema);
      req.getModel("Role", roleSchema);

      // 3. Find User
      const UserModel = req.getModel("User", userSchema);
      const user = await UserModel.findById(decoded.id).select("-password").populate("role");

      if (!user) {
        throw new ApiError(404, "User not found");
      }

      if (user.isActive === false) {
        throw new ApiError(401, "Account deactivated. Please contact an administrator.");
      }

      // STRICT SINGLE-DEVICE CHECK
      if ((decoded.tokenVersion || 0) !== (user.tokenVersion || 0)) {
        throw new ApiError(401, "Session expired. You logged in from another device.");
      }

      const now = new Date();
      if (!user.lastActiveAt || now - user.lastActiveAt > 5 * 60 * 1000) {
        UserModel.updateOne({ _id: user._id }, { $set: { lastActiveAt: now } }).catch(err => console.error("Error updating user lastActiveAt:", err));
      }

      user.company = company; // Manually populate
      req.user = user;
      req.userType = "user";
      req.company = company; // Helper access

    } else if (decoded.type === "employee") {
      // --- EMPLOYEE TOKEN ---
      let company;
      if (decoded.companyId) {
        company = await Company.findOne({ companyId: decoded.companyId });
      } else {
        throw new ApiError(401, "Invalid token: missing company context");
      }

      if (!company) throw new ApiError(404, "Company not found");

      // Resolve Tenant
      const dbName = company.dbName;
      req.tenantConnection = getTenantConnection(dbName);
      req.getModel = (modelName, schema) => {
        return getTenantModel(dbName, modelName, schema);
      };

      // Pre-register common models for population queries
      req.getModel("User", userSchema);
      req.getModel("Employee", employeeSchema);
      req.getModel("Role", roleSchema);

      // Find Employee
      const EmployeeModel = req.getModel("Employee", employeeSchema);
      const employee = await EmployeeModel.findById(decoded.id).populate("roles");

      if (!employee) {
        throw new ApiError(404, "Employee not found");
      }

      if (employee.isActive === false || employee.status !== "Active") {
        throw new ApiError(401, "Account deactivated. Please contact an administrator.");
      }

      // STRICT SINGLE-DEVICE CHECK
      if ((decoded.tokenVersion || 0) !== (employee.tokenVersion || 0)) {
        throw new ApiError(401, "Session expired. You logged in from another device.");
      }

      const now = new Date();
      if (!employee.lastActiveAt || now - employee.lastActiveAt > 5 * 60 * 1000) {
        EmployeeModel.updateOne({ _id: employee._id }, { $set: { lastActiveAt: now } }).catch(err => console.error("Error updating employee lastActiveAt:", err));
      }

      // Populate company manually
      employee.company = company;

      req.user = employee;
      req.userType = "employee"; // NEW TYPE
      req.company = company;

    } else {
      // Company token
      const company = await Company.findById(decoded.id).select("-password");
      if (!company) {
        throw new ApiError(404, "Company not found");
      }

      // STRICT SINGLE-DEVICE CHECK
      if ((decoded.tokenVersion || 0) !== (company.tokenVersion || 0)) {
        throw new ApiError(401, "Session expired. You logged in from another device.");
      }

      // Also setup tenant connection for Company Admin actions
      if (company.dbName) {
        req.tenantConnection = getTenantConnection(company.dbName);
        req.getModel = (modelName, schema) => {
          return getTenantModel(company.dbName, modelName, schema);
        };
        // Pre-register common models for population queries
        req.getModel("User", userSchema);
        req.getModel("Employee", employeeSchema);
        req.getModel("Role", roleSchema);
        req.company = company;
      }

      req.user = company;
      req.userType = "company";
    }

    // console.log("[Auth] Success");
    next();
  } catch (error) {
    console.error("[Auth] Error:", error.message);
    if (error instanceof ApiError) {
      throw error;
    }
    if (error.name === "TokenExpiredError") {
      throw new ApiError(401, "Token expired. Please log in again.");
    }
    if (error.name === "JsonWebTokenError") {
      throw new ApiError(401, "Invalid token. Authentication failed.");
    }
    throw new ApiError(500, "Something went wrong while verifying token");
  }
});

// ✅ Verify SaaS Admin JWT Middleware
export const verifySaasAdminJWT = asyncHandler(async (req, res, next) => {
  const token =
    req.cookies?.saasAdminToken ||
    req.header("Authorization")?.replace("Bearer ", "");

  if (!token || token === "null" || token === "undefined") {
    throw new ApiError(401, "Unauthorized access: No token provided");
  }

  try {
    // 🔍 Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if it's a SaaS admin token
    if (decoded.type !== "saasadmin") {
      throw new ApiError(403, "Access denied. SaaS admin privileges required.");
    }

    // Find SaaS Admin
    const admin = await SaasAdmin.findById(decoded.id).select("-password");
    if (!admin) {
      throw new ApiError(404, "SaaS admin not found");
    }

    req.user = admin;
    req.userType = "saasadmin";

    next();
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (error.name === "TokenExpiredError") {
      throw new ApiError(401, "Token expired. Please log in again.");
    }
    if (error.name === "JsonWebTokenError") {
      throw new ApiError(401, "Invalid token. Authentication failed.");
    }
    throw new ApiError(500, "Something went wrong while verifying token");
  }
});

// ✅ Restrict Access to Masters for Executives
export const restrictExecutive = asyncHandler(async (req, res, next) => {
  if (req.method !== 'GET' && (req.userType === "user" || req.userType === "employee")) {
    // Check if the department explicitly marks them as an executive
    const department = req.user.department || "";
    if (department.includes("Executive")) {
      throw new ApiError(403, "Access denied. Executives cannot modify master data.");
    }
  }
  next();
});

// ✅ IAM-Style Authorization Middleware
export const requirePermission = (moduleName, tabName, action) => {
  return asyncHandler(async (req, res, next) => {
    // 1. Company Admin and SaaS Admin have full access
    if (req.userType === "company" || req.userType === "saasadmin") {
      return next();
    }

    const user = req.user;
    
    const rolesToCheck = [];
    if (user.role) {
      rolesToCheck.push(user.role);
    }
    if (Array.isArray(user.roles)) {
      rolesToCheck.push(...user.roles);
    }

    if (rolesToCheck.length === 0) {
      throw new ApiError(403, "Access denied. No roles assigned.");
    }

    let hasPermission = false;
    
    for (const role of rolesToCheck) {
      if (!role || !role.isActive) continue;

      const policy = role.policies?.find((p) => p.module === moduleName);
      if (policy) {
        const tab = policy.tabs?.find((t) => t.name === tabName);
        if (tab && (tab.actions.includes(action) || tab.actions.includes("all"))) {
          hasPermission = true;
          break;
        }
      }
    }

    if (!hasPermission) {
      throw new ApiError(403, `Access denied. Requires '${action}' permission for '${moduleName} -> ${tabName}'.`);
    }

    next();
  });
};

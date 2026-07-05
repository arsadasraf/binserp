import jwt from "jsonwebtoken";
import asyncHandler from "express-async-handler";
import { ApiError } from "../utils/ApiError.js";
import { Company } from "../models/company/index.js";
import { userSchema } from "../models/user/index.js";
import { employeeSchema } from "../models/hr/index.js";
import { SaasAdmin } from "../models/saasadmin/index.js";
import { getTenantConnection, getTenantModel } from "../db/tenant.js";


// ✅ Verify JWT Middleware (for Company Admin)
export const verifyJWT = asyncHandler(async (req, res, next) => {
  const token =
    req.cookies?.accessToken ||
    req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
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

      // 3. Find User
      const UserModel = req.getModel("User", userSchema);
      const user = await UserModel.findById(decoded.id).select("-password");

      if (!user) {
        throw new ApiError(404, "User not found");
      }

      if (user.isActive === false) {
        throw new ApiError(401, "Account deactivated. Please contact an administrator.");
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

      // Find Employee
      const EmployeeModel = req.getModel("Employee", employeeSchema);
      const employee = await EmployeeModel.findById(decoded.id);

      if (!employee) {
        throw new ApiError(404, "Employee not found");
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

      // Also setup tenant connection for Company Admin actions
      if (company.dbName) {
        req.tenantConnection = getTenantConnection(company.dbName);
        req.getModel = (modelName, schema) => {
          return getTenantModel(company.dbName, modelName, schema);
        };
        // Pre-register User model for population queries
        req.getModel("User", userSchema);
        req.company = company;
      }

      req.user = company;
      req.userType = "company";
    }

    // console.log("[Auth] Success");
    next();
  } catch (error) {
    console.error("[Auth] Error:", error.message);
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

  if (!token) {
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
  if (req.userType === "user" || req.userType === "employee") {
    // Check if the department explicitly marks them as an executive
    const department = req.user.department || "";
    if (department.includes("Executive")) {
      throw new ApiError(403, "Access denied. Executives cannot access master data.");
    }
  }
  next();
});

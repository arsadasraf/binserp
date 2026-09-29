import jwt from "jsonwebtoken";
import asyncHandler from "express-async-handler";
import { ApiError } from "../utils/ApiError.js";
import { Company } from "../models/company/index.js";
import { userSchema, roleSchema } from "../models/user/index.js";
import { employeeSchema } from "../models/hr/index.js";
import { SaasAdmin } from "../models/saasadmin/index.js";
import { getTenantConnection, getTenantModel } from "../db/tenant.js";


// High-performance In-Memory Company Context Cache (5-minute TTL)
const companyAuthCache = new Map();
const COMPANY_CACHE_TTL = 5 * 60 * 1000;

export const getCachedCompanyByCompanyId = async (companyId) => {
  if (!companyId) return null;
  const now = Date.now();
  const cached = companyAuthCache.get(`cid_${companyId}`);
  if (cached && cached.expiresAt > now) {
    return cached.company;
  }
  const company = await Company.findOne({ companyId });
  if (company) {
    companyAuthCache.set(`cid_${companyId}`, { company, expiresAt: now + COMPANY_CACHE_TTL });
  }
  return company;
};

export const getCachedCompanyById = async (id) => {
  if (!id) return null;
  const now = Date.now();
  const cached = companyAuthCache.get(`id_${id}`);
  if (cached && cached.expiresAt > now) {
    return cached.company;
  }
  const company = await Company.findById(id).select("-password");
  if (company) {
    companyAuthCache.set(`id_${id}`, { company, expiresAt: now + COMPANY_CACHE_TTL });
  }
  return company;
};

// Clear cache helper when company updates
export const clearCachedCompany = (companyId, id) => {
  if (companyId) companyAuthCache.delete(`cid_${companyId}`);
  if (id) companyAuthCache.delete(`id_${id}`);
};

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
        company = await getCachedCompanyByCompanyId(decoded.companyId);
      } else {
        throw new ApiError(401, "Invalid token: missing company context");
      }

      if (!company) throw new ApiError(404, "Company not found");

      if (company.isSuspended) {
        throw new ApiError(403, "Your company has been suspended from ERP provider.");
      }

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
        company = await getCachedCompanyByCompanyId(decoded.companyId);
      } else {
        throw new ApiError(401, "Invalid token: missing company context");
      }

      if (!company) throw new ApiError(404, "Company not found");

      if (company.isSuspended) {
        throw new ApiError(403, "Your company has been suspended from ERP provider.");
      }

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
        throw new ApiError(401, "Your account is inactive. Please contact HR administration.");
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
      const company = await getCachedCompanyById(decoded.id);
      if (!company) {
        throw new ApiError(404, "Company not found");
      }

      if (company.isSuspended) {
        throw new ApiError(403, "Your company has been suspended from ERP provider.");
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
      return next(error);
    }
    if (error.name === "TokenExpiredError") {
      return next(new ApiError(401, "Token expired. Please log in again."));
    }
    if (error.name === "JsonWebTokenError") {
      return next(new ApiError(401, "Invalid token. Authentication failed."));
    }
    return next(new ApiError(500, "Something went wrong while verifying token"));
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
    let admin = await SaasAdmin.findById(decoded.id).select("-password");
    if (!admin) {
      const saasAdminEmail = (process.env.SAAS_ADMIN_EMAIL || "").toLowerCase().trim();
      if (saasAdminEmail) {
        admin = await SaasAdmin.findOne({ email: saasAdminEmail }).select("-password");
        if (!admin) {
          admin = await SaasAdmin.create({
            username: saasAdminEmail.split("@")[0] || "saasadmin",
            email: saasAdminEmail,
            password: "GoogleOAuthManagedPassword_StrictLock",
            roleLevel: 100,
          });
        }
      }
    }

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

// Helper to build O(1) permission hashtable map from array of role objects
export const buildPermissionMap = (roles = []) => {
  const rolesArray = Array.isArray(roles) ? roles : [roles];
  const map = {};

  for (const role of rolesArray) {
    if (!role || role.isActive === false || !Array.isArray(role.policies)) continue;
    for (const policy of role.policies) {
      if (!policy.module || !Array.isArray(policy.tabs)) continue;
      const mod = String(policy.module).toLowerCase();
      for (const tab of policy.tabs) {
        if (typeof tab === "string") {
          const t = tab.toLowerCase();
          map[`${mod}:${t}`] = true;
          map[`${mod}:${t}:read`] = true;
          map[`${mod}:${t}:create`] = true;
          map[`${mod}:${t}:update`] = true;
          map[`${mod}:${t}:delete`] = true;
          map[`${mod}:${t}:all`] = true;
        } else if (tab && typeof tab === "object") {
          const tabName = tab.name ? String(tab.name).toLowerCase() : "";
          if (tabName) {
            map[`${mod}:${tabName}`] = true;
            if (Array.isArray(tab.actions)) {
              for (const action of tab.actions) {
                map[`${mod}:${tabName}:${String(action).toLowerCase()}`] = true;
              }
            }
          }
        }
      }
    }
  }
  return map;
};

// ✅ IAM-Style Authorization Middleware with O(1) performance lookup
export const requirePermission = (moduleName, tabName, action = "") => {
  return asyncHandler(async (req, res, next) => {
    // 1. SaaS Admin has full system access
    if (req.userType === "saasadmin") {
      return next();
    }

    // 2. Company Admin (Owner) is restricted strictly to Admin module (Overview, User Management, Roles)
    if (req.userType === "company") {
      if (moduleName.toLowerCase() === "admin") {
        return next();
      }
      throw new ApiError(403, "Access denied. Company Admin accounts are restricted to Overview, User Management, and Roles.");
    }

    const user = req.user;
    const rolesToCheck = [];
    if (user?.role) rolesToCheck.push(user.role);
    if (Array.isArray(user?.roles)) rolesToCheck.push(...user.roles);

    // 3. Full-access roles (GM, Company Management, Admin Default Role)
    for (const r of rolesToCheck) {
      const rName = (r?.name || "").trim();
      if (rName === "GM" || rName === "Admin Default Role" || rName === "Company Management") {
        return next();
      }
    }

    if (rolesToCheck.length === 0) {
      throw new ApiError(403, "Access denied. No roles assigned.");
    }

    // Build or reuse O(1) permission map on request context
    if (!req.permissionMap) {
      req.permissionMap = buildPermissionMap(rolesToCheck);
    }

    const mod = String(moduleName).toLowerCase();
    const tab = String(tabName).toLowerCase();
    const act = action ? String(action).toLowerCase() : "";

    if (
      req.permissionMap[`${mod}:${tab}`] ||
      (act && req.permissionMap[`${mod}:${tab}:${act}`]) ||
      req.permissionMap[`${mod}:${tab}:all`]
    ) {
      return next();
    }

    throw new ApiError(403, `Access denied for '${moduleName} -> ${tabName}'.`);
  });
};



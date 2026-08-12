import { userSchema, roleSchema } from "../../models/user/index.js";
import { employeeSchema } from "../../models/hr/index.js";
import { sessionHistorySchema } from "../../models/user/sessionHistory.model.js";
import { Company } from "../../models/company/index.js";
import { getTenantConnection, getTenantModel } from "../../db/tenant.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { uploadOnS3, deleteFromS3, signPhotos } from "../../utils/s3.js";
import { generateTokens, setTokenCookies } from "../../utils/token.js";

const getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
};

// ✅ Login User / Employee
export const loginUser = async (req, res) => {
  try {
    const { companyId, userId, password } = req.body;

    if (!companyId || !userId || !password) {
      return res.status(400).json({ message: "CompanyID, UserId, and Password are required" });
    }

    // 1. Find Company Strategy
    const company = await Company.findOne({ companyId });
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    // 🚫 SUSPENSION CHECK: Block login immediately if company is suspended
    if (company.isSuspended) {
      return res.status(403).json({ message: "Your company has been suspended from ERP provider." });
    }

    if (!company.dbName) {
      return res.status(500).json({ message: "Company database not configured." });
    }

    // 2. Get Tenant Models
    const UserModel = getTenantModel(company.dbName, "User", userSchema);
    const EmployeeModel = getTenantModel(company.dbName, "Employee", employeeSchema);
    getTenantModel(company.dbName, "Role", roleSchema);

    // Normalize User ID search (hyphen-insensitive matching: EMP-0001 vs EMP0001)
    const rawUserId = userId.trim();
    const cleanUserId = rawUserId.replace(/[\s-]/g, "");
    const formattedWithHyphen = rawUserId.replace(/([A-Za-z]+)[\s-]*(\d+)/, "$1-$2");
    const formattedNoHyphen = rawUserId.replace(/([A-Za-z]+)[\s-]*(\d+)/, "$1$2");

    // 3. Try Finding Staff User first
    const user = await UserModel.findOne({
      $or: [
        { userId: rawUserId },
        { userId: cleanUserId },
        { userId: formattedWithHyphen },
        { userId: formattedNoHyphen },
        { userId: { $regex: `^${cleanUserId.replace(/(\d+)/, "-?$1")}$`, $options: "i" } },
      ],
    })
      .populate("role")
      .populate({ path: "roles", strictPopulate: false });

    if (user) {
      // --- STAFF USER FOUND ---
      if (user.isActive === false) {
        return res.status(403).json({ message: "Your account is inactive. Please contact your administrator." });
      }

      // Compare password (also test with/without hyphens if direct fails)
      let isMatch = await user.comparePassword(password);
      if (!isMatch && password.includes("-")) {
        isMatch = await user.comparePassword(password.replace(/-/g, ""));
      }

      if (!isMatch) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // 🔒 Security Checks (IP/Location) for User
      if (user.allowedIP) {
        const clientIP = req.headers["x-forwarded-for"] || req.ip || req.socket.remoteAddress;
        if (!clientIP || !clientIP.includes(user.allowedIP)) {
          return res.status(403).json({ message: "Access denied from restricted IP." });
        }
      }

      if (user.allowedLocation && user.allowedLocation.lat && user.allowedLocation.lng) {
        const { latitude, longitude } = req.body;
        if (!latitude || !longitude) {
          return res.status(403).json({ message: "Location access required for this account." });
        }
        const distance = getDistanceFromLatLonInKm(
          user.allowedLocation.lat,
          user.allowedLocation.lng,
          Number(latitude),
          Number(longitude)
        );
        const maxRadiusKm = (user.allowedLocation.radius || 500) / 1000;
        if (distance > maxRadiusKm) {
          return res.status(403).json({ message: "Access denied from this location." });
        }
      }

      // Increment token version for strict single-device login
      user.tokenVersion = (user.tokenVersion || 0) + 1;

      // Generate tokens
      const { accessToken, refreshToken } = generateTokens(user._id, "user", company.companyId, user.tokenVersion);

      user.refreshToken = refreshToken;
      await user.save({ validateBeforeSave: false });

      setTokenCookies(res, accessToken, refreshToken);

      // Track Session History
      const SessionHistoryModel = getTenantModel(company.dbName, "SessionHistory", sessionHistorySchema);
      const clientIP = req.headers["x-forwarded-for"] || req.ip || req.socket.remoteAddress || "Unknown";
      await SessionHistoryModel.create({
        userId: user.userId,
        userType: "user",
        action: "login",
        ipAddress: clientIP,
        location: {
          lat: req.body.latitude ? Number(req.body.latitude) : null,
          lng: req.body.longitude ? Number(req.body.longitude) : null,
        },
      });

      return res.status(200).json({
        message: "Login successful",
        user: {
          id: user._id,
          name: user.name,
          userId: user.userId,
          email: user.email,
          department: user.department,
          roleLevel: user.roleLevel,
          roles: user.roles && user.roles.length > 0 ? user.roles : user.role ? [user.role] : [],
          role: user.role || null,
          photo: (await signPhotos([user.photo]))[0],
          company: {
            id: company._id,
            companyId: company.companyId,
            companyName: company.companyName,
          },
        },
        token: accessToken,
      });
    }

    // 4. Try Finding Employee if Staff User not found
    const employee = await EmployeeModel.findOne({
      $or: [
        { employeeId: rawUserId },
        { employeeId: cleanUserId },
        { employeeId: formattedWithHyphen },
        { employeeId: formattedNoHyphen },
        { employeeId: { $regex: `^${cleanUserId.replace(/(\d+)/, "-?$1")}$`, $options: "i" } },
      ],
    }).populate("roles");

    if (employee) {
      // --- EMPLOYEE FOUND ---
      // 🚫 INACTIVE CHECK: Clear message if employee is marked inactive in HR
      if (employee.status !== "Active" || employee.isActive === false) {
        return res.status(403).json({ message: "Your account is inactive. Please contact HR administration." });
      }

      let isMatch = false;

      // 🔑 Hyphen-insensitive password check (supports both encrypted password & joining date)
      if (employee.password) {
        isMatch = await employee.comparePassword(password);
        if (!isMatch && password.includes("-")) {
          isMatch = await employee.comparePassword(password.replace(/-/g, ""));
        }
      }

      // Legacy joining date fallback (YYYY-MM-DD or YYYYMMDD)
      if (!isMatch && employee.joiningDate) {
        const joiningDateHyphen = new Date(employee.joiningDate).toISOString().split("T")[0]; // 2024-05-15
        const joiningDateNoHyphen = joiningDateHyphen.replace(/-/g, ""); // 20240515
        const inputPasswordNoHyphen = password.replace(/[\s-]/g, "");

        isMatch =
          password === joiningDateHyphen ||
          password === joiningDateNoHyphen ||
          inputPasswordNoHyphen === joiningDateNoHyphen;
      }

      if (!isMatch) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Increment token version for strict single-device login
      employee.tokenVersion = (employee.tokenVersion || 0) + 1;

      // Generate tokens
      const { accessToken, refreshToken } = generateTokens(
        employee._id,
        "employee",
        company.companyId,
        employee.tokenVersion
      );

      employee.refreshToken = refreshToken;
      await employee.save({ validateBeforeSave: false });

      const roleLevel = employee.roleLevel || 1;

      setTokenCookies(res, accessToken, refreshToken);

      // Track Session History
      const SessionHistoryModel = getTenantModel(company.dbName, "SessionHistory", sessionHistorySchema);
      const clientIP = req.headers["x-forwarded-for"] || req.ip || req.socket.remoteAddress || "Unknown";
      await SessionHistoryModel.create({
        userId: employee.employeeId,
        userType: "employee",
        action: "login",
        ipAddress: clientIP,
        location: {
          lat: req.body.latitude ? Number(req.body.latitude) : null,
          lng: req.body.longitude ? Number(req.body.longitude) : null,
        },
      });

      return res.status(200).json({
        message: "Employee Login successful",
        user: {
          id: employee._id,
          name: employee.name,
          userId: employee.employeeId,
          email: employee.email,
          department: employee.department,
          designation: employee.designation,
          roleLevel: roleLevel,
          roles: employee.roles || [],
          photo: (await signPhotos([employee.photo]))[0],
          type: "employee",
          company: {
            id: company._id,
            companyId: company.companyId,
            companyName: company.companyName,
          },
        },
        token: accessToken,
      });
    }

    // Neither User nor Employee found
    return res.status(404).json({ message: "User/Employee ID not found" });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ message: error.message });
  }
};

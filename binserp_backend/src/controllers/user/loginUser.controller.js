import { userSchema } from "../../models/user/index.js";
import { employeeSchema } from "../../models/hr/index.js";
import { Company } from "../../models/company/index.js";
import { getTenantConnection, getTenantModel } from "../../db/tenant.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { sendPasswordResetEmail } from "../../utils/emailService.js";
import { uploadOnS3, deleteFromS3, signPhotos } from "../../utils/s3.js";

// Generate JWT token for users
// Generate JWT token for users
const generateUserToken = (userId, companyId) => {
  return jwt.sign({ id: userId, type: "user", companyId }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

const getCompanyLoginId = (req) => {
  return req.company?.companyId || req.user?.companyId || req.user?.company?.companyId || "";
};

// ✅ Create User (Admin only)

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

    if (!company.dbName) {
      return res.status(500).json({ message: "Company database not configured." });
    }

    // 2. Get Tenant Models
    const UserModel = getTenantModel(company.dbName, "User", userSchema);
    const EmployeeModel = getTenantModel(company.dbName, "Employee", employeeSchema);

    // 3. Try Finding User first
    const user = await UserModel.findOne({ userId });

    if (user) {
      // --- USER FOUND ---
      if (user.isActive === false) {
        return res.status(403).json({ message: "Account deactivated. Please contact an administrator." });
      }

      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // 🔒 Security Checks (IP/Location) for User
      // 1. IP Check
      if (user.allowedIP) {
        const clientIP = req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress;
        if (!clientIP || !clientIP.includes(user.allowedIP)) {
          return res.status(403).json({ message: `Access denied from restricted IP.` });
        }
      }

      // 2. Location Check
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

      // Pass companyId to token
      const token = generateUserToken(user._id, company.companyId);

      return res.status(200).json({
        message: "Login successful",
        user: {
          id: user._id,
          name: user.name,
          userId: user.userId,
          email: user.email,
          department: user.department,
          roleLevel: user.roleLevel,
          photo: (await signPhotos([user.photo]))[0],
          company: {
            id: company._id,
            companyId: company.companyId,
            companyName: company.companyName,
          },
        },
        token,
      });
    }

    // 4. Try Finding Employee if User not found
    const employee = await EmployeeModel.findOne({ employeeId: userId });

    if (employee) {
      // --- EMPLOYEE FOUND ---
      // Password must match Joining Date (YYYY-MM-DD)
      const joiningDate = new Date(employee.joiningDate).toISOString().split('T')[0];

      if (password !== joiningDate) {
        return res.status(401).json({ message: "Invalid credentials (Password is your Joining Date: YYYY-MM-DD)" });
      }

      if (employee.status !== 'Active') {
        return res.status(403).json({ message: "Account is not active." });
      }

      // Generate Token with 'employee' type
      const token = jwt.sign({ id: employee._id, type: "employee", companyId: company.companyId }, process.env.JWT_SECRET, {
        expiresIn: "7d",
      });

      // Determine Role Level (Employee generic)
      const roleLevel = getRoleLevel("Operator"); // Default to lowest unless we map designations

      return res.status(200).json({
        message: "Employee Login successful",
        user: {
          id: employee._id,
          name: employee.name,
          userId: employee.employeeId,
          email: employee.email,
          department: employee.department, // Use real department
          designation: employee.designation,
          roleLevel: roleLevel, // For frontend checks
          photo: (await signPhotos([employee.photo]))[0],
          type: 'employee',
          company: {
            id: company._id,
            companyId: company.companyId,
            companyName: company.companyName,
          },
        },
        token,
      });
    }

    // Neither User nor Employee found
    return res.status(404).json({ message: "User/Employee ID not found" });

  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ Request Password Reset

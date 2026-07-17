import { userSchema } from "../../models/user/index.js";
import { employeeSchema } from "../../models/hr/index.js";
import { Company } from "../../models/company/index.js";
import { getTenantConnection, getTenantModel } from "../../db/tenant.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
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

export const uploadUserPhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const UserModel = req.getModel('User', userSchema);
    const user = await UserModel.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Upload to S3
    const companyId = req.userType === "company" ? req.user.id : req.user.company._id;
    const result = await uploadOnS3(req.file.path, "users", getCompanyLoginId(req));
    if (!result) {
      return res.status(500).json({ message: "Failed to upload image to S3" });
    }

    // Update user photo
    user.photo = result.secure_url;
    await user.save();

    res.status(200).json({
      message: "Photo uploaded successfully",
      photo: (await signPhotos([user.photo]))[0],
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Helper function to get role level
const getRoleLevel = (department) => {
  const roleLevels = {
    CEO: 10,
    MD: 9,
    Manager: 8,
    Admin: 7,
    HR: 5,
    Store: 5,
    Accounts: 5,
    PPC: 5,
    Quality: 5,
    Maintenance: 5,
    CRM: 5,
    Security: 2,
    Employee: 1,
  };
  return roleLevels[department] || 1;
};

// Haversine Formula for Distance Calculation
const getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
};

const deg2rad = (deg) => {
  return deg * (Math.PI / 180);
};

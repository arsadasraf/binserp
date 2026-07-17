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

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const UserModel = req.getModel('User', userSchema);

    const user = await UserModel.findById(id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const createdTime = new Date(user.createdAt).getTime();
    const currentTime = new Date().getTime();
    const hoursDifference = (currentTime - createdTime) / (1000 * 60 * 60);

    if (hoursDifference > 24) {
      return res.status(400).json({ 
        message: "Cannot delete user after 24 hours of creation. You can deactivate them instead." 
      });
    }

    await UserModel.findByIdAndDelete(id);

    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ Toggle User Status (Activate/Deactivate)

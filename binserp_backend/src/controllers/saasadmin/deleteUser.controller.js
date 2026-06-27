import jwt from "jsonwebtoken";
import asyncHandler from "express-async-handler";
import { SaasAdmin } from "../../models/saasadmin/index.js";
import { Company } from "../../models/company/index.js";
// import { User } from "../../models/user/index.js";
import { AuditLog } from "../../models/auditlog/index.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { logAuditAction } from "../../utils/auditLogger.js";
import { getTenantModel } from "../../db/tenant.js";
import { userSchema } from "../../models/user/index.js";
import crypto from "crypto";

// 🔑 Generate JWT for SaaS Admin
const generateToken = (adminId) => {
    return jwt.sign({ id: adminId, type: "saasadmin" }, process.env.JWT_SECRET, {
        expiresIn: "7d",
    });
};

// 🔐 Login SaaS Admin

export const deleteUser = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const user = null; // await User.findById(id).populate("company", "companyName");
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    // await User.findByIdAndDelete(id);

    // Log deletion
    await logAuditAction({
        adminId: req.user._id,
        adminUsername: req.user.username,
        action: "USER_DELETE",
        targetType: "USER",
        targetId: id,
        targetName: user.name,
        details: { company: user.company.companyName, department: user.department },
        req,
    });

    res.status(200).json(new ApiResponse(200, null, "User deleted successfully"));
});

// 📜 Get Audit Logs

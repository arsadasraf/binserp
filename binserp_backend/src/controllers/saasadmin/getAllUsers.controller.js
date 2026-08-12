import mongoose from "mongoose";
import asyncHandler from "express-async-handler";
import { Company } from "../../models/company/index.js";
import { getTenantModel } from "../../db/tenant.js";
import { userSchema, roleSchema } from "../../models/user/index.js";
import { employeeSchema } from "../../models/hr/index.js";
import { ApiResponse } from "../../utils/ApiResponse.js";

/**
 * 👥 Get All Users Across All Companies (Role Users + Employee Portal Users)
 * GET /api/saasadmin/users
 */
export const getAllUsers = asyncHandler(async (req, res) => {
  const { search, companyId } = req.query;

  let companyQuery = {};
  if (companyId) {
    const isMongoId = mongoose.Types.ObjectId.isValid(companyId);
    if (isMongoId) {
      companyQuery = { _id: companyId };
    } else {
      companyQuery = { companyId: companyId };
    }
  }

  const companies = await Company.find(companyQuery).select("_id companyName companyId dbName email");

  const allUsers = [];

  for (const comp of companies) {
    const dbName = comp.dbName || comp._id.toString();

    // 1. Fetch Staff Role Users
    try {
      const UserModel = getTenantModel(dbName, "User", userSchema);
      getTenantModel(dbName, "Role", roleSchema);

      const staffUsers = await UserModel.find({})
        .select("-password")
        .populate("role")
        .populate({ path: "roles", strictPopulate: false })
        .sort({ createdAt: -1 });

      staffUsers.forEach((u) => {
        const roleName = u.role
          ? typeof u.role === "string"
            ? u.role
            : u.role.name
          : u.roles && u.roles.length > 0
          ? typeof u.roles[0] === "string"
            ? u.roles[0]
            : u.roles[0].name
          : "User";

        allUsers.push({
          _id: u._id,
          name: u.name,
          userId: u.userId,
          email: u.email,
          department: u.department || "General",
          roleName: roleName,
          userType: "staff",
          isEmployee: false,
          isActive: u.isActive !== false,
          company: {
            _id: comp._id,
            companyName: comp.companyName,
            companyId: comp.companyId,
          },
          createdAt: u.createdAt,
        });
      });
    } catch (err) {
      console.warn(`Could not load staff users for company ${comp.companyName} (DB: ${dbName}):`, err.message);
    }

    // 2. Fetch Employee Portal Users
    try {
      const EmployeeModel = getTenantModel(dbName, "Employee", employeeSchema);
      const employees = await EmployeeModel.find({}).select("-password").sort({ createdAt: -1 });

      employees.forEach((emp) => {
        allUsers.push({
          _id: emp._id,
          name: `${emp.firstName || ""} ${emp.lastName || ""}`.trim() || emp.employeeId,
          userId: emp.employeeId,
          email: emp.email || "N/A",
          department: emp.department || "HR Employee",
          roleName: emp.designation || "Employee",
          userType: "employee",
          isEmployee: true,
          isActive: emp.isActive !== false,
          company: {
            _id: comp._id,
            companyName: comp.companyName,
            companyId: comp.companyId,
          },
          createdAt: emp.createdAt,
        });
      });
    } catch (err) {
      console.warn(`Could not load employee users for company ${comp.companyName} (DB: ${dbName}):`, err.message);
    }
  }

  // Filter by search query if provided
  let filtered = allUsers;
  if (search) {
    const q = search.toLowerCase();
    filtered = allUsers.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.userId.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.company.companyName.toLowerCase().includes(q)
    );
  }

  // Sort by newest
  filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  res.status(200).json(new ApiResponse(200, filtered, `${filtered.length} users retrieved`));
});

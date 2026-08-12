import mongoose from "mongoose";
import asyncHandler from "express-async-handler";
import { Company } from "../../models/company/index.js";
import { getTenantModel } from "../../db/tenant.js";
import { userSchema, roleSchema } from "../../models/user/index.js";
import { employeeSchema } from "../../models/hr/index.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";

/**
 * 👥 Get All Users (Staff Role Users + Employees) for a Specific Company
 * GET /api/saasadmin/companies/:id/users
 */
export const getUsersByCompany = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Safe company lookup (by Mongo _id or custom string companyId)
  const isMongoId = mongoose.Types.ObjectId.isValid(id);
  const company = isMongoId
    ? await Company.findById(id)
    : await Company.findOne({ companyId: id });

  if (!company) {
    throw new ApiError(404, "Company not found");
  }

  // Use tenant database name from company.dbName (fallback to _id.toString())
  const dbName = company.dbName || company._id.toString();
  const companyUsers = [];

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

      companyUsers.push({
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
          _id: company._id,
          companyName: company.companyName,
          companyId: company.companyId,
        },
        createdAt: u.createdAt,
      });
    });
  } catch (err) {
    console.warn(`Could not load staff users for company ${company.companyName} (DB: ${dbName}):`, err.message);
  }

  // 2. Fetch Employee Portal Users
  try {
    const EmployeeModel = getTenantModel(dbName, "Employee", employeeSchema);
    const employees = await EmployeeModel.find({}).select("-password").sort({ createdAt: -1 });

    employees.forEach((emp) => {
      companyUsers.push({
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
          _id: company._id,
          companyName: company.companyName,
          companyId: company.companyId,
        },
        createdAt: emp.createdAt,
      });
    });
  } catch (err) {
    console.warn(`Could not load employee users for company ${company.companyName} (DB: ${dbName}):`, err.message);
  }

  res.status(200).json(
    new ApiResponse(
      200,
      { company: company.companyName, companyId: company.companyId, users: companyUsers },
      `${companyUsers.length} users retrieved for ${company.companyName}`
    )
  );
});

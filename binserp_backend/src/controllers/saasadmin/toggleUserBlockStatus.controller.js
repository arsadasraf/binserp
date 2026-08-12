import asyncHandler from "express-async-handler";
import mongoose from "mongoose";
import { Company } from "../../models/company/index.js";
import { getTenantModel } from "../../db/tenant.js";
import { userSchema } from "../../models/user/index.js";
import { employeeSchema } from "../../models/hr/index.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";

/**
 * 🔒 Toggle User Active/Blocked Status for Staff Users or Employees
 * PUT /api/saasadmin/users/:id/block
 */
export const toggleUserBlockStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { companyId, isEmployee } = req.body;

  if (!companyId) {
    throw new ApiError(400, "Company ID is required to locate tenant user");
  }

  const isMongoId = mongoose.Types.ObjectId.isValid(companyId);
  const company = isMongoId
    ? await Company.findById(companyId)
    : await Company.findOne({ companyId: companyId });

  if (!company) {
    throw new ApiError(404, "Target company not found");
  }

  const dbName = company.dbName || company._id.toString();

  if (isEmployee) {
    const EmployeeModel = getTenantModel(dbName, "Employee", employeeSchema);
    const employee = await EmployeeModel.findById(id);

    if (!employee) {
      throw new ApiError(404, "Employee not found");
    }

    employee.isActive = !employee.isActive;
    await employee.save({ validateBeforeSave: false });

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { id: employee._id, isActive: employee.isActive, isEmployee: true },
          `Employee ${employee.isActive ? "unblocked" : "blocked"} successfully`
        )
      );
  } else {
    const UserModel = getTenantModel(dbName, "User", userSchema);
    const user = await UserModel.findById(id);

    if (!user) {
      throw new ApiError(404, "Staff user not found");
    }

    user.isActive = !user.isActive;
    await user.save({ validateBeforeSave: false });

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { id: user._id, isActive: user.isActive, isEmployee: false },
          `User ${user.isActive ? "unblocked" : "blocked"} successfully`
        )
      );
  }
});

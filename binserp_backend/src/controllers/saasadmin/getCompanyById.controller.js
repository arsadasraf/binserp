import asyncHandler from "express-async-handler";
import { Company } from "../../models/company/index.js";
import { getTenantModel } from "../../db/tenant.js";
import { userSchema } from "../../models/user/index.js";
import { employeeSchema } from "../../models/hr/index.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";

/**
 * 🏢 Get Company By ID with Full Registration & Profile Details
 * GET /api/saasadmin/companies/:id
 */
export const getCompanyById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const company = await Company.findById(id).select("-password").lean();
  if (!company) {
    throw new ApiError(404, "Company not found");
  }

  let staffCount = 0;
  let employeeCount = 0;

  try {
    const dbName = company._id.toString();
    const UserModel = getTenantModel(dbName, "User", userSchema);
    const EmployeeModel = getTenantModel(dbName, "Employee", employeeSchema);

    staffCount = await UserModel.countDocuments().catch(() => 0);
    employeeCount = await EmployeeModel.countDocuments().catch(() => 0);
  } catch (e) {
    console.warn(`Could not count users for company ${company.companyName}:`, e.message);
  }

  const companyData = {
    ...company,
    staffCount,
    employeeCount,
    userCount: staffCount + employeeCount,
  };

  res.status(200).json(new ApiResponse(200, companyData, "Company details retrieved"));
});

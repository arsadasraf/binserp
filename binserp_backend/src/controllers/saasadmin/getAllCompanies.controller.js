import asyncHandler from "express-async-handler";
import { Company } from "../../models/company/index.js";
import { getTenantModel } from "../../db/tenant.js";
import { userSchema } from "../../models/user/index.js";
import { employeeSchema } from "../../models/hr/index.js";
import { ApiResponse } from "../../utils/ApiResponse.js";

/**
 * 🏢 Get All Companies with Full Registration & Profile Details
 * GET /api/saasadmin/companies
 */
export const getAllCompanies = asyncHandler(async (req, res) => {
  const { search, verified, sortBy = "createdAt", order = "desc" } = req.query;

  const filter = {};
  if (search) {
    filter.$or = [
      { companyName: { $regex: search, $options: "i" } },
      { companyId: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { city: { $regex: search, $options: "i" } },
      { state: { $regex: search, $options: "i" } },
      { companyType: { $regex: search, $options: "i" } },
    ];
  }
  if (verified !== undefined) {
    filter.isVerified = verified === "true";
  }

  const sort = {};
  sort[sortBy] = order === "asc" ? 1 : -1;

  // Fetch all matching companies with ALL fields (excluding password)
  const rawCompanies = await Company.find(filter).select("-password").sort(sort).lean();

  const companies = [];

  for (const comp of rawCompanies) {
    let staffCount = 0;
    let employeeCount = 0;

    try {
      const dbName = comp.dbName || comp._id.toString();
      const UserModel = getTenantModel(dbName, "User", userSchema);
      const EmployeeModel = getTenantModel(dbName, "Employee", employeeSchema);

      staffCount = await UserModel.countDocuments().catch(() => 0);
      employeeCount = await EmployeeModel.countDocuments().catch(() => 0);
    } catch (e) {
      console.warn(`Could not count users for company ${comp.companyName}:`, e.message);
    }

    companies.push({
      ...comp,
      staffCount,
      employeeCount,
      userCount: staffCount + employeeCount,
    });
  }

  res.status(200).json(new ApiResponse(200, companies, `${companies.length} companies retrieved`));
});

import mongoose from "mongoose";
import asyncHandler from "express-async-handler";
import { Company } from "../../models/company/index.js";
import { getTenantModel } from "../../db/tenant.js";
import { roleSchema } from "../../models/user/index.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";

/**
 * 🛡️ Get All Roles Created Within a Specific Company
 * GET /api/saasadmin/companies/:id/roles
 */
export const getCompanyRoles = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const isMongoId = mongoose.Types.ObjectId.isValid(id);
  const company = isMongoId
    ? await Company.findById(id)
    : await Company.findOne({ companyId: id });

  if (!company) {
    throw new ApiError(404, "Company not found");
  }

  const dbName = company.dbName || company._id.toString();
  const RoleModel = getTenantModel(dbName, "Role", roleSchema);
  const roles = await RoleModel.find({}).sort({ createdAt: -1 });

  res.status(200).json(
    new ApiResponse(
      200,
      { company: company.companyName, companyId: company.companyId, roles },
      `${roles.length} roles retrieved for ${company.companyName}`
    )
  );
});

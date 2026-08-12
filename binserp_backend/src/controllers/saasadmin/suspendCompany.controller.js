import asyncHandler from "express-async-handler";
import { Company } from "../../models/company/index.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { logAuditAction } from "../../utils/auditLogger.js";

/**
 * 🔒 Suspend / Block Entire Company
 * PUT /api/saasadmin/companies/:id/suspend
 */
export const suspendCompany = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const reason = (req.body && req.body.reason) ? req.body.reason.trim() : "Suspended by SaaS Platform Administrator";

  const company = await Company.findByIdAndUpdate(
    id,
    {
      isSuspended: true,
      suspensionReason: reason,
      suspendedAt: new Date(),
    },
    { new: true, runValidators: true }
  ).select("-password");

  if (!company) {
    throw new ApiError(404, "Company not found");
  }

  // Log audit action safely if req.user exists
  if (req.user) {
    await logAuditAction({
      adminId: req.user._id,
      adminUsername: req.user.username || "saasadmin",
      action: "COMPANY_SUSPEND",
      targetType: "COMPANY",
      targetId: id,
      targetName: company.companyName,
      details: { reason },
      req,
    }).catch((err) => console.warn("Audit log error:", err.message));
  }

  res.status(200).json(new ApiResponse(200, company, `Company ${company.companyName} has been blocked/suspended`));
});

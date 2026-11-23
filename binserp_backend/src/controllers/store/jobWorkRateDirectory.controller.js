import mongoose from "mongoose";
import { jobWorkRateDirectorySchema } from "../../models/store/index.js";
import { userSchema } from "../../models/user/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";

const getCompanyId = (req) => {
  return (
    req.company?._id ||
    (req.userType === "company" ? req.user?.id : req.user?.company?._id || req.user?.company)
  );
};

const getActorInfo = (req) => {
  const actorId = req.user?._id || req.user?.id || undefined;
  const actorName =
    req.user?.name ||
    req.user?.fullName ||
    req.user?.username ||
    req.user?.email ||
    (req.userType === "company" ? req.company?.name || "Company Admin" : "System User");
  return {
    actorId: actorId && mongoose.Types.ObjectId.isValid(String(actorId)) ? actorId : undefined,
    actorName: String(actorName || "").trim(),
  };
};

/**
 * GET /api/store/job-work/rate-directory
 * Retrieve all Job Work Rate Directory entries for the company
 */
export const getJobWorkRateDirectory = asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req);
  const JobWorkRateDirectory = req.getModel("JobWorkRateDirectory", jobWorkRateDirectorySchema);
  req.getModel("User", userSchema);

  const entries = await JobWorkRateDirectory.find({ company: companyId })
    .populate("createdBy", "name email username")
    .populate("updatedBy", "name email username")
    .sort({ updatedAt: -1, createdAt: -1 })
    .lean();

  const formatted = entries.map((entry) => ({
    ...entry,
    createdByDisplay:
      entry.createdBy?.name ||
      entry.createdBy?.username ||
      entry.createdByName ||
      "System User",
    updatedByDisplay:
      entry.updatedBy?.name ||
      entry.updatedBy?.username ||
      entry.updatedByName ||
      entry.createdBy?.name ||
      entry.createdByName ||
      "System User",
  }));

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { entries: formatted, count: formatted.length },
        "Job Work Rate Directory retrieved successfully"
      )
    );
});

/**
 * POST /api/store/job-work/rate-directory
 * Create a new standalone Job Work Rate Directory entry
 */
export const createJobWorkRateDirectoryEntry = asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req);
  const JobWorkRateDirectory = req.getModel("JobWorkRateDirectory", jobWorkRateDirectorySchema);
  req.getModel("User", userSchema);

  const {
    componentName,
    description,
    processName,
    rate,
    unit,
    vendorId,
    vendorSource,
    vendorName,
    vendorContactPerson,
    vendorPhone,
    vendorEmail,
    vendorGst,
    vendorAddress,
    remarks,
  } = req.body;

  if (!componentName || !String(componentName).trim()) {
    throw new ApiError(400, "Component Name is required");
  }
  if (!processName || !String(processName).trim()) {
    throw new ApiError(400, "Process Name is required");
  }
  if (rate === undefined || rate === null || rate === "" || isNaN(Number(rate)) || Number(rate) < 0) {
    throw new ApiError(400, "Valid non-negative Rate is required");
  }
  if (!unit || !String(unit).trim()) {
    throw new ApiError(400, "Unit is required");
  }
  if (!vendorName || !String(vendorName).trim()) {
    throw new ApiError(400, "Vendor is required");
  }

  const { actorId, actorName } = getActorInfo(req);
  const cleanVendorId =
    vendorId && mongoose.Types.ObjectId.isValid(String(vendorId)) ? vendorId : undefined;

  const created = await JobWorkRateDirectory.create({
    company: companyId,
    componentName: String(componentName).trim(),
    description: description ? String(description).trim() : "",
    processName: String(processName).trim(),
    rate: Number(rate),
    unit: String(unit).trim(),
    vendorId: cleanVendorId,
    vendorSource: vendorSource === "JobWorkSupplier" ? "JobWorkSupplier" : "Vendor",
    vendorName: String(vendorName).trim(),
    vendorContactPerson: vendorContactPerson ? String(vendorContactPerson).trim() : "",
    vendorPhone: vendorPhone ? String(vendorPhone).trim() : "",
    vendorEmail: vendorEmail ? String(vendorEmail).trim() : "",
    vendorGst: vendorGst ? String(vendorGst).trim() : "",
    vendorAddress: vendorAddress ? String(vendorAddress).trim() : "",
    remarks: remarks ? String(remarks).trim() : "",
    createdBy: actorId,
    createdByName: actorName,
    updatedBy: actorId,
    updatedByName: actorName,
  });

  const populated = await JobWorkRateDirectory.findById(created._id)
    .populate("createdBy", "name email username")
    .populate("updatedBy", "name email username")
    .lean();

  return res
    .status(201)
    .json(
      new ApiResponse(
        201,
        {
          ...populated,
          createdByDisplay: populated?.createdBy?.name || populated?.createdByName || actorName,
          updatedByDisplay: populated?.updatedBy?.name || populated?.updatedByName || actorName,
        },
        "Job Work Rate Directory entry created successfully"
      )
    );
});

/**
 * PUT /api/store/job-work/rate-directory/:id
 * Update an existing Job Work Rate Directory entry (updates updatedBy/updatedAt, preserves createdBy/createdAt)
 */
export const updateJobWorkRateDirectoryEntry = asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req);
  const { id } = req.params;
  if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
    throw new ApiError(400, "Invalid entry ID");
  }

  const JobWorkRateDirectory = req.getModel("JobWorkRateDirectory", jobWorkRateDirectorySchema);
  req.getModel("User", userSchema);

  const existing = await JobWorkRateDirectory.findOne({ _id: id, company: companyId });
  if (!existing) {
    throw new ApiError(404, "Job Work Rate Directory entry not found");
  }

  const {
    componentName,
    description,
    processName,
    rate,
    unit,
    vendorId,
    vendorSource,
    vendorName,
    vendorContactPerson,
    vendorPhone,
    vendorEmail,
    vendorGst,
    vendorAddress,
    remarks,
  } = req.body;

  if (componentName !== undefined) {
    if (!String(componentName).trim()) throw new ApiError(400, "Component Name cannot be empty");
    existing.componentName = String(componentName).trim();
  }
  if (description !== undefined) existing.description = String(description || "").trim();
  if (processName !== undefined) {
    if (!String(processName).trim()) throw new ApiError(400, "Process Name cannot be empty");
    existing.processName = String(processName).trim();
  }
  if (rate !== undefined) {
    if (rate === "" || isNaN(Number(rate)) || Number(rate) < 0) {
      throw new ApiError(400, "Valid non-negative Rate is required");
    }
    existing.rate = Number(rate);
  }
  if (unit !== undefined) {
    if (!String(unit).trim()) throw new ApiError(400, "Unit cannot be empty");
    existing.unit = String(unit).trim();
  }
  if (vendorId !== undefined) {
    existing.vendorId =
      vendorId && mongoose.Types.ObjectId.isValid(String(vendorId)) ? vendorId : undefined;
  }
  if (vendorSource !== undefined) {
    existing.vendorSource = vendorSource === "JobWorkSupplier" ? "JobWorkSupplier" : "Vendor";
  }
  if (vendorName !== undefined) {
    if (!String(vendorName).trim()) throw new ApiError(400, "Vendor is required");
    existing.vendorName = String(vendorName).trim();
  }
  if (vendorContactPerson !== undefined) existing.vendorContactPerson = String(vendorContactPerson || "").trim();
  if (vendorPhone !== undefined) existing.vendorPhone = String(vendorPhone || "").trim();
  if (vendorEmail !== undefined) existing.vendorEmail = String(vendorEmail || "").trim();
  if (vendorGst !== undefined) existing.vendorGst = String(vendorGst || "").trim();
  if (vendorAddress !== undefined) existing.vendorAddress = String(vendorAddress || "").trim();
  if (remarks !== undefined) existing.remarks = String(remarks || "").trim();

  const { actorId, actorName } = getActorInfo(req);
  existing.updatedBy = actorId;
  existing.updatedByName = actorName;

  await existing.save();

  const populated = await JobWorkRateDirectory.findById(existing._id)
    .populate("createdBy", "name email username")
    .populate("updatedBy", "name email username")
    .lean();

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        {
          ...populated,
          createdByDisplay: populated?.createdBy?.name || populated?.createdByName || "System User",
          updatedByDisplay: populated?.updatedBy?.name || populated?.updatedByName || actorName,
        },
        "Job Work Rate Directory entry updated successfully"
      )
    );
});

/**
 * DELETE /api/store/job-work/rate-directory/:id
 * Delete a Job Work Rate Directory entry
 */
export const deleteJobWorkRateDirectoryEntry = asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req);
  const { id } = req.params;
  if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
    throw new ApiError(400, "Invalid entry ID");
  }

  const JobWorkRateDirectory = req.getModel("JobWorkRateDirectory", jobWorkRateDirectorySchema);
  const deleted = await JobWorkRateDirectory.findOneAndDelete({ _id: id, company: companyId });

  if (!deleted) {
    throw new ApiError(404, "Job Work Rate Directory entry not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, { _id: id }, "Job Work Rate Directory entry deleted successfully"));
});

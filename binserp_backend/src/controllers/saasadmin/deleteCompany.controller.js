import asyncHandler from "express-async-handler";
import { ApiError } from "../../utils/ApiError.js";

/**
 * 🗑️ Delete Company (Disabled - SaaS Admin can only Block/Unblock)
 */
export const deleteCompany = asyncHandler(async (req, res) => {
  throw new ApiError(400, "Data deletion is disabled. SaaS Admin can only block or unblock company accounts.");
});

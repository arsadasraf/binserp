import asyncHandler from "express-async-handler";
import { ApiError } from "../../utils/ApiError.js";

// 🔐 Login SaaS Admin (Password Login Disabled - Strictly Google OAuth)

export const loginSaasAdmin = asyncHandler(async (req, res) => {
    throw new ApiError(
        400,
        "SaaS Admin password login is disabled. Please sign in using Google OAuth with your authorized SaaS Admin Gmail account."
    );
});

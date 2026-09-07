import express from "express";
import {
  registerCompany,
  loginCompany,
  requestPasswordReset,
  resetPassword,
  getCompanyProfile,
  updateCompanySettings,
  uploadCompanyLogo,
  convertImageToBase64,
} from "../controllers/company/index.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/upload.middleware.js";

const router = express.Router();

// Public routes
router.post("/register", registerCompany);
router.post("/login", loginCompany);
router.post("/forgot-password", requestPasswordReset);
router.post("/reset-password", resetPassword);
router.post("/image-to-base64", convertImageToBase64);

// Protected routes
router.get("/me", verifyJWT, getCompanyProfile);
router.put("/settings", verifyJWT, updateCompanySettings);
router.post("/upload-logo", verifyJWT, upload.single("logo"), uploadCompanyLogo);

export default router;

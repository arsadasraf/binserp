import express from "express";
import {
  createUser,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  toggleUserStatus,
  loginUser,
  requestPasswordReset,
  resetPassword,
  updateUserProfile,
  uploadUserPhoto,
  getActiveSessions,
  getSessionHistory,
} from "../controllers/user/index.js";
import { verifyJWT, requirePermission } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/upload.middleware.js";

const router = express.Router();

// Public routes
router.post("/login", loginUser);
router.post("/forgot-password", requestPasswordReset);
router.post("/reset-password", resetPassword);

// Protected routes - User profile
router.put("/profile", verifyJWT, updateUserProfile);
router.post("/upload-photo", verifyJWT, upload.single("photo"), uploadUserPhoto);

// Admin routes (strictly protected by Admin:users permission)
router.get("/active-sessions", verifyJWT, requirePermission("Admin", "users"), getActiveSessions);
router.get("/session-history/:userId", verifyJWT, requirePermission("Admin", "users"), getSessionHistory);
router.post("/create", verifyJWT, requirePermission("Admin", "users", "create"), createUser);
router.get("/all", verifyJWT, requirePermission("Admin", "users", "read"), getAllUsers);
router.get("/:id", verifyJWT, requirePermission("Admin", "users", "read"), getUserById);
router.put("/:id", verifyJWT, requirePermission("Admin", "users", "update"), updateUser);
router.put("/toggle-status/:id", verifyJWT, requirePermission("Admin", "users", "update"), toggleUserStatus);
router.delete("/:id", verifyJWT, requirePermission("Admin", "users", "delete"), deleteUser);

export default router;

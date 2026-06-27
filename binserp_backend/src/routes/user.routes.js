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
} from "../controllers/user/index.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/upload.middleware.js";

const router = express.Router();

// Public routes
router.post("/login", loginUser);
router.post("/forgot-password", requestPasswordReset);
router.post("/reset-password", resetPassword);

// Protected routes - User profile
router.put("/profile", verifyJWT, updateUserProfile);
router.post("/upload-photo", verifyJWT, upload.single("photo"), uploadUserPhoto);

// Admin routes (protected)
router.post("/create", verifyJWT, createUser);
router.get("/all", verifyJWT, getAllUsers);
router.get("/:id", verifyJWT, getUserById);
router.put("/:id", verifyJWT, updateUser);
router.put("/toggle-status/:id", verifyJWT, toggleUserStatus);
router.delete("/:id", verifyJWT, deleteUser);

export default router;

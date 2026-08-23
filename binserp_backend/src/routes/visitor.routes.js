import express from "express";
import { verifyJWT as protect } from "../middlewares/auth.middleware.js";
import { createVisitor, updateVisitor, deleteVisitor, getActiveVisitors, getAllVisitors, checkOutVisitor } from "../controllers/gateentry/index.js";

const router = express.Router();

router.use(protect); // Ensure all routes are protected

router.post("/", createVisitor);
router.get("/active", getActiveVisitors);
router.get("/", getAllVisitors);
router.put("/:id/checkout", checkOutVisitor);
router.put("/:id", updateVisitor);
router.delete("/:id", deleteVisitor);

export default router;


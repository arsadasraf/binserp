import express from "express";
import { verifyJWT as protect } from "../middlewares/auth.middleware.js";
import { createVehicle, getActiveVehicles, getAllVehicles, checkOutVehicle } from "../controllers/gateentry/index.js";

const router = express.Router();

router.use(protect); // Ensure all routes are protected

router.post("/", createVehicle);
router.get("/active", getActiveVehicles);
router.get("/", getAllVehicles);
router.put("/:id/checkout", checkOutVehicle);

export default router;

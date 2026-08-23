import express from "express";
import { verifyJWT as protect } from "../middlewares/auth.middleware.js";
import { createVehicle, updateVehicle, deleteVehicle, getActiveVehicles, getAllVehicles, checkOutVehicle, getVehicleSuggestions } from "../controllers/gateentry/index.js";

const router = express.Router();

router.use(protect); // Ensure all routes are protected

router.post("/", createVehicle);
router.get("/suggestions", getVehicleSuggestions);
router.get("/active", getActiveVehicles);
router.get("/", getAllVehicles);
router.put("/:id/checkout", checkOutVehicle);
router.put("/:id", updateVehicle);
router.delete("/:id", deleteVehicle);

export default router;



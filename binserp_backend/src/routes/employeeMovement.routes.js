import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
    createEmployeeOut,
    updateEmployeeIn,
    getActiveEmployeeMovements,
    getAllEmployeeMovements
} from "../controllers/gateentry/index.js";

const router = Router();

// Apply auth middleware
router.use(verifyJWT);

// Routes
router.post("/out", createEmployeeOut);
router.put("/in/:id", updateEmployeeIn);
router.get("/active", getActiveEmployeeMovements);
router.get("/", getAllEmployeeMovements);

export default router;

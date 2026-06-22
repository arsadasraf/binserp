import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { resolveTenant } from "../middlewares/tenant.middleware.js";
import {
    createQualityMaster,
    getQualityMasters,
    updateQualityMaster,
    deleteQualityMaster,
    createIncomingQC,
    getIncomingQC,
    updateIncomingQC,
    createProcessQC,
    getProcessQC,
    getQualityStats,
    getPendingProcessQCJobs
} from "../controllers/quality.controller.js";

const router = Router();

// Apply middleware
router.use(verifyJWT);
router.use(resolveTenant);

// Dashboard Stats
router.get("/stats", getQualityStats);

// Master (Standards)
router.route("/master")
    .get(getQualityMasters)
    .post(createQualityMaster);

router.route("/master/:id")
    .put(updateQualityMaster)
    .delete(deleteQualityMaster);

// Incoming QC
router.route("/incoming")
    .get(getIncomingQC)
    .post(createIncomingQC);

router.route("/incoming/:id")
    .put(updateIncomingQC);

// Process QC
router.get("/process/pending", getPendingProcessQCJobs); // New
router.route("/process")
    .get(getProcessQC)
    .post(createProcessQC);

export default router;

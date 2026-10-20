import { Router } from "express";
import { verifyJWT, requirePermission } from "../middlewares/auth.middleware.js";
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
    getPendingProcessQCJobs,
    createFGQC,
    getFGQC,
    getPendingFGQCJobs,
    createJobWorkQC,
    getJobWorkQC,
    getPendingJobWorkQC,
    getQualityStats
} from "../controllers/quality/index.js";

const router = Router();

// Apply middleware
router.use(verifyJWT);
router.use(resolveTenant);

// Dashboard Stats
router.get("/stats", requirePermission("Quality", "overview"), getQualityStats);

// 1. Master (Standards & Parameters)
router.route("/master")
    .get(requirePermission("Quality", "master", "read"), getQualityMasters)
    .post(requirePermission("Quality", "master", "create"), createQualityMaster);

router.route("/master/:id")
    .put(requirePermission("Quality", "master", "update"), updateQualityMaster)
    .delete(requirePermission("Quality", "master", "delete"), deleteQualityMaster);

// 2. Incoming Material QC
router.route("/incoming")
    .get(requirePermission("Quality", "incoming", "read"), getIncomingQC)
    .post(requirePermission("Quality", "incoming", "create"), createIncomingQC);

router.route("/incoming/:id")
    .put(requirePermission("Quality", "incoming", "update"), updateIncomingQC);

// 3. Process QC (Routing Steps)
router.get("/process/pending", requirePermission("Quality", "process", "read"), getPendingProcessQCJobs);
router.route("/process")
    .get(requirePermission("Quality", "process", "read"), getProcessQC)
    .post(requirePermission("Quality", "process", "create"), createProcessQC);

// 4. Job Work Return QC (Subcontractor Inward)
router.get("/jobwork/pending", requirePermission("Quality", "jobwork-qc", "read"), getPendingJobWorkQC);
router.route("/jobwork")
    .get(requirePermission("Quality", "jobwork-qc", "read"), getJobWorkQC)
    .post(requirePermission("Quality", "jobwork-qc", "create"), createJobWorkQC);

// 5. Finished Goods (FG) QC & PDI
router.get("/fg/pending", requirePermission("Quality", "fg-qc", "read"), getPendingFGQCJobs);
router.route("/fg")
    .get(requirePermission("Quality", "fg-qc", "read"), getFGQC)
    .post(requirePermission("Quality", "fg-qc", "create"), createFGQC);

export default router;

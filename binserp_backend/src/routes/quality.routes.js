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
router.get("/stats", getQualityStats);

// 1. Master (Standards & Parameters)
router.route("/master")
    .get(getQualityMasters)
    .post(createQualityMaster);

router.route("/master/:id")
    .put(updateQualityMaster)
    .delete(deleteQualityMaster);

// 2. Incoming Material QC
router.route("/incoming")
    .get(getIncomingQC)
    .post(createIncomingQC);

router.route("/incoming/:id")
    .put(updateIncomingQC);

// 3. Process QC (Routing Steps)
router.get("/process/pending", getPendingProcessQCJobs);
router.route("/process")
    .get(getProcessQC)
    .post(createProcessQC);

// 4. Job Work Return QC (Subcontractor Inward)
router.get("/jobwork/pending", getPendingJobWorkQC);
router.route("/jobwork")
    .get(getJobWorkQC)
    .post(createJobWorkQC);

// 5. Finished Goods (FG) QC & PDI
router.get("/fg/pending", getPendingFGQCJobs);
router.route("/fg")
    .get(getFGQC)
    .post(createFGQC);

export default router;

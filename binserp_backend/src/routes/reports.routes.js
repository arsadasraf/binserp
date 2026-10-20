import express from "express";
import {
  getMachineReports,
  getManpowerReports,
  getMaterialReports
} from "../controllers/reports/reports.controller.js";
import { verifyJWT, requirePermission } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Require authentication & RBAC for all operational report routes
router.use(verifyJWT);
router.use(requirePermission("Reports", "overview"));

// Machine & Workstation Insights (OEE)
router.route("/machines").get(getMachineReports);

// Manpower Insights (Individual Employee / Operator)
router.route("/manpower").get(getManpowerReports);

// Material & Inventory Insights (All Store Materials)
router.route("/materials").get(getMaterialReports);

export default router;

import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
  createMRPPlan,
  getAllMRPPlans,
  getMRPPlanById,
  deleteMRPPlan,
  updateMRPPlan,
  updateMRPPlanStatus,
  updateMRPRequirementItemStatus,
  getMRPProcurementWorkbench,
  bulkGeneratePOFromMRP,
  sendMRPItemsToPPC,
  getMRPPPCIntakeBucket,
  updateMRPItemStatus,
  moveMRPToProduction,
  getMRP360WipTracker,
  getAllMRPWipOverview,
  getAllSalesOrderMRPs,
  createIndentFromMRP,
  createWorkOrderFromMRP
} from "../controllers/mrp/index.js";

const router = Router();

// Apply auth middleware to all MRP routes
router.use(verifyJWT);

// MRP Procurement & WIP Intelligence Routes
router.route("/procurement-workbench")
  .get(getMRPProcurementWorkbench);

router.route("/bulk-generate-po")
  .post(bulkGeneratePOFromMRP);

router.route("/send-to-ppc")
  .post(sendMRPItemsToPPC);

router.route("/ppc-intake-bucket")
  .get(getMRPPPCIntakeBucket);

router.route("/plan/:id/item-status")
  .patch(updateMRPItemStatus)
  .put(updateMRPItemStatus);

router.route("/plan/:id/move-to-production")
  .post(moveMRPToProduction);

router.route("/wip-overview")
  .get(getAllMRPWipOverview);

router.route("/wip-360/:id")
  .get(getMRP360WipTracker);

// Indent & Work Order Routing from MRP
router.route("/indent")
  .post(createIndentFromMRP);

router.route("/work-order")
  .post(createWorkOrderFromMRP);

// MRP Plan Routes (Primary MRP Engine)
router.route("/plan")
  .post(createMRPPlan);

router.route("/plans")
  .get(getAllMRPPlans);

router.route("/update-item-status")
  .put(updateMRPRequirementItemStatus);

router.route("/plan/:id")
  .get(getMRPPlanById)
  .put(updateMRPPlan)
  .delete(deleteMRPPlan);

router.route("/plan/:id/status")
  .put(updateMRPPlanStatus);

// Legacy MRP Routes
router.route("/")
  .get(getAllSalesOrderMRPs);

export default router;

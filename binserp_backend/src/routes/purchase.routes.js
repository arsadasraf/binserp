import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";

import {
  createPurchaseRFQ,
  getPurchaseRFQs,
  updatePurchaseRFQ,
  deletePurchaseRFQ,
  createVendorQuotation,
  getVendorQuotations,
  updateVendorQuotation,
  deleteVendorQuotation,
  createPurchaseBill,
  getPurchaseBills,
  updatePurchaseBill,
  deletePurchaseBill,
  createPO,
  getAllPOs,
  updatePO,
  deletePO,
  getVendorPOBucket,
  getVendorActivePOs,
  createVendorPriceList,
  getVendorPriceLists,
  updateVendorPriceList,
  deleteVendorPriceList,
  getAllSalesOrderMRPs,
  createMRPPlan,
  getAllMRPPlans,
  getMRPPlanById,
  deleteMRPPlan,
  updateMRPPlanStatus,
  updateMRPRequirementItemStatus,
  getMRPProcurementWorkbench,
  bulkGeneratePOFromMRP,
  sendMRPItemsToPPC,
  getMRPPPCIntakeBucket,
  updateMRPItemStatus,
  moveMRPToProduction,
  getMRP360WipTracker,
  getAllMRPWipOverview
} from "../controllers/purchase/index.js";

const router = Router();

// Apply auth middleware to all purchase routes
router.use(verifyJWT);

// Vendor Bucket & Active PO Routes
router.route("/vendor-bucket")
  .get(getVendorPOBucket);

router.route("/po/active-by-vendor/:vendorId")
  .get(getVendorActivePOs);

// MRP Procurement & WIP Intelligence Routes
router.route("/mrp/procurement-workbench")
  .get(getMRPProcurementWorkbench);

router.route("/mrp/bulk-generate-po")
  .post(bulkGeneratePOFromMRP);

router.route("/mrp/send-to-ppc")
  .post(sendMRPItemsToPPC);

router.route("/mrp/ppc-intake-bucket")
  .get(getMRPPPCIntakeBucket);

router.route("/mrp/plan/:id/item-status")
  .patch(updateMRPItemStatus)
  .put(updateMRPItemStatus);

router.route("/mrp/plan/:id/move-to-production")
  .post(moveMRPToProduction);

router.route("/mrp/wip-overview")
  .get(getAllMRPWipOverview);

router.route("/mrp/wip-360/:id")
  .get(getMRP360WipTracker);

// MRP Plan Routes (New MRP Engine)
router.route("/mrp/plan")
  .post(createMRPPlan);

router.route("/mrp/plans")
  .get(getAllMRPPlans);

router.route("/mrp/update-item-status")
  .put(updateMRPRequirementItemStatus);

router.route("/mrp/plan/:id")
  .get(getMRPPlanById)
  .delete(deleteMRPPlan);

router.route("/mrp/plan/:id/status")
  .put(updateMRPPlanStatus);

// Legacy MRP Routes
router.route("/mrp")
  .get(getAllSalesOrderMRPs);

// RFQ Routes
router.route("/rfq")
  .post(createPurchaseRFQ)
  .get(getPurchaseRFQs);

router.route("/rfq/:id")
  .put(updatePurchaseRFQ)
  .delete(deletePurchaseRFQ);

// Quotation Routes
router.route("/quotation")
  .post(createVendorQuotation)
  .get(getVendorQuotations);

router.route("/quotation/:id")
  .put(updateVendorQuotation)
  .delete(deleteVendorQuotation);

// Purchase Bill Routes
router.route("/bill")
  .post(createPurchaseBill)
  .get(getPurchaseBills);

router.route("/bill/:id")
  .put(updatePurchaseBill)
  .delete(deletePurchaseBill);

// Purchase Order Routes (Migrated from Store)
router.route("/po")
  .post(createPO)
  .get(getAllPOs);

router.route("/po/:id")
  .put(updatePO)
  .delete(deletePO);

// Vendor Price List Routes
router.route("/price-list")
  .post(createVendorPriceList)
  .get(getVendorPriceLists);

router.route("/price-list/:id")
  .put(updateVendorPriceList)
  .delete(deleteVendorPriceList);

export default router;

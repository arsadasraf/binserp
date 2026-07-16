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
  createVendorPriceList,
  getVendorPriceLists,
  updateVendorPriceList,
  deleteVendorPriceList,
  getAllSalesOrderMRPs
} from "../controllers/purchase/index.js";

const router = Router();

// Apply auth middleware to all purchase routes
router.use(verifyJWT);

// MRP Routes
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

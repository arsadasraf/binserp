import express from "express";
import { verifyJWT, restrictExecutive } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";
import {
  createQuotation,
  getAllQuotations,
  updateQuotation,
  deleteQuotation,
  createDC,
  getAllDCs,
  updateDC,
  deleteDC,
  createInvoice,
  getAllInvoices,
  updateInvoice,
  createSalesOrder,
  getAllSalesOrders,
  getSalesOrderById,
  updateSalesOrder,
  deleteSalesOrder,
  planSalesOrder,
  createSalesDispatch,
  getDispatchHistory,
  createIncomingRFQ,
  getAllIncomingRFQs,
  updateIncomingRFQ,
  deleteIncomingRFQ,
  createIncomingPO,
  getAllIncomingPOs,
  updateIncomingPO,
  deleteIncomingPO,
  generateSalesOrderFromPO,
  getIncomingPODispatchHistory,
  createOrUpdatePriceList,
  getAllPriceLists,
  deletePriceList
} from "../controllers/sales/index.js";

const router = express.Router();

// All routes require authentication
router.use(verifyJWT);

// Incoming RFQ routes
router.post("/incoming-rfq", createIncomingRFQ);
router.get("/incoming-rfq", getAllIncomingRFQs);
router.put("/incoming-rfq/:id", updateIncomingRFQ);
router.delete("/incoming-rfq/:id", deleteIncomingRFQ);

// Price List routes
router.post("/price-list", createOrUpdatePriceList);
router.get("/price-list", getAllPriceLists);
router.delete("/price-list/:id", deletePriceList);

// Quotation routes
router.post("/quotation", createQuotation);
router.get("/quotation", getAllQuotations);
router.put("/quotation/:id", updateQuotation);
router.delete("/quotation/:id", deleteQuotation);

// Incoming PO routes
router.post("/incoming-po", upload.fields([{ name: 'pdf', maxCount: 1 }, { name: 'photos', maxCount: 3 }]), createIncomingPO);
router.get("/incoming-po", getAllIncomingPOs);
router.put("/incoming-po/:id", upload.fields([{ name: 'pdf', maxCount: 1 }, { name: 'photos', maxCount: 3 }]), updateIncomingPO);
router.delete("/incoming-po/:id", deleteIncomingPO);
router.get("/incoming-po/:id/dispatch-history", getIncomingPODispatchHistory);
router.post("/incoming-po/:id/generate-order", generateSalesOrderFromPO);

// Sales Order routes (Internal Order)
router.post("/order", upload.fields([{ name: 'pdf', maxCount: 1 }, { name: 'photos', maxCount: 3 }]), createSalesOrder);
router.get("/order", getAllSalesOrders);
router.get("/order/:id", getSalesOrderById);
router.put("/order/:id", upload.fields([{ name: 'pdf', maxCount: 1 }, { name: 'photos', maxCount: 3 }]), updateSalesOrder);
router.post("/order/:id/plan", planSalesOrder);
router.delete("/order/:id", deleteSalesOrder);

// Sales Order Dispatch routes
router.post("/order/:salesOrderId/dispatch", upload.fields([{ name: 'pdf', maxCount: 1 }, { name: 'photos', maxCount: 3 }]), createSalesDispatch);
router.get("/order/:salesOrderId/dispatches", getDispatchHistory);

// Delivery Challan routes
router.post("/dc", createDC);
router.get("/dc", getAllDCs);
router.put("/dc/:id", updateDC);
router.delete("/dc/:id", deleteDC);

// Invoice routes
router.post("/invoice", createInvoice);
router.get("/invoice", getAllInvoices);
router.put("/invoice/:id", updateInvoice);

export default router;

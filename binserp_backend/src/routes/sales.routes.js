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
  createSalesDispatch,
  getDispatchHistory,
  createRFQ,
  getAllRFQs,
  updateRFQ,
  deleteRFQ,
  createIncomingPO,
  getAllIncomingPOs,
  updateIncomingPO,
  deleteIncomingPO
} from "../controllers/sales/index.js";

const router = express.Router();

// All routes require authentication
router.use(verifyJWT);

// RFQ routes
router.post("/rfq", createRFQ);
router.get("/rfq", getAllRFQs);
router.put("/rfq/:id", updateRFQ);
router.delete("/rfq/:id", deleteRFQ);

// Quotation routes
router.post("/quotation", createQuotation);
router.get("/quotation", getAllQuotations);
router.put("/quotation/:id", updateQuotation);
router.delete("/quotation/:id", deleteQuotation);

// Incoming PO routes
router.post("/incoming-po", createIncomingPO);
router.get("/incoming-po", getAllIncomingPOs);
router.put("/incoming-po/:id", updateIncomingPO);
router.delete("/incoming-po/:id", deleteIncomingPO);

// Sales Order routes (Internal Order)
router.post("/order", upload.fields([{ name: 'pdf', maxCount: 1 }, { name: 'photos', maxCount: 3 }]), createSalesOrder);
router.get("/order", getAllSalesOrders);
router.get("/order/:id", getSalesOrderById);
router.put("/order/:id", upload.fields([{ name: 'pdf', maxCount: 1 }, { name: 'photos', maxCount: 3 }]), updateSalesOrder);
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

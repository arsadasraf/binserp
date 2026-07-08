import express from "express";
import {
  createDC,
  getAllDCs,
  updateDC,
  deleteDC,
  createInvoice,
  getAllInvoices,
  updateInvoice,
  createGRN,
  getAllGRNs,
  updateGRN,
  getItemGRNHistory,
  deleteGRN,
  createMaterialIssue,
  getAllMaterialIssues,
  updateMaterialIssue,
  createBOM,
  getAllBOMs,
  updateBOM,
  createInventory,
  getInventory,
  updateInventory,
  getLowStockItems,
  createMaterialRequest,
  getAllMaterialRequests,
  updateMaterialRequest,
  createPO,
  getAllPOs,
  updatePO,
  createVendor,
  getAllVendors,
  updateVendor,
  deleteVendor,
  createCustomer,
  getAllCustomers,
  updateCustomer,
  deleteCustomer,
  createLocation,
  getAllLocations,
  updateLocation,
  deleteLocation,
  createCategory,
  getAllCategories,
  updateCategory,
  deleteCategory,
  createRmBoItem,
  getAllRmBoItems,
  updateRmBoItem,
  deleteRmBoItem,
  getCompanyInfo,
  updateCompanyInfo,
  createJobWorkChallan,
  receiveJobWorkItems,
  getAllJobWorkChallans,
  updateJobWorkChallan,
  deleteJobWorkChallan,
  createJobWorkSupplier,
  getAllJobWorkSuppliers,
  updateJobWorkSupplier,
  deleteJobWorkSupplier,
  createQuotation,
  getAllQuotations,
  updateQuotation,
  deleteQuotation,
  createStoreOrder,
  getAllStoreOrders,
  getStoreOrderById,
  updateStoreOrder,
  deleteStoreOrder
} from "../controllers/store/index.js";
import {
  createStoreDispatch,
  getDispatchHistory
} from "../controllers/store/storeDispatch.controller.js";
import {
  getFulfillments,
  reserveQuantity,
  moveToMRP,
  getStoreMRPs,
  planRMRequirement,
  planSingleRMRequirement,
  planProductionRequirement,
  getRMPlans,
  updateRMPlanPO
} from "../controllers/store/storeFulfillment.controller.js";
import { verifyJWT, restrictExecutive } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = express.Router();

// All routes require authentication
router.use(verifyJWT);

// Restrict Master routes for Executives
router.use(["/vendor", "/job-work-supplier", "/customer", "/location", "/category", "/rm-bo-item", "/company-info", "/fg-item"], restrictExecutive);

// Delivery Challan routes
router.post("/dc", createDC);
router.get("/dc", getAllDCs);
router.put("/dc/:id", updateDC);
router.delete("/dc/:id", deleteDC);

// Invoice routes
router.post("/invoice", createInvoice);
router.get("/invoice", getAllInvoices);
router.put("/invoice/:id", updateInvoice);

// GRN routes (with PDF and photos upload support)
router.post("/grn", upload.fields([{ name: 'pdf', maxCount: 1 }, { name: 'photos', maxCount: 10 }]), createGRN);
router.get("/grn", getAllGRNs);
router.put("/grn/:id", upload.fields([{ name: 'pdf', maxCount: 1 }, { name: 'photos', maxCount: 10 }]), updateGRN);
router.get("/grn/history/:type/:id", getItemGRNHistory); // New Route
router.delete("/grn/:id", deleteGRN);

// Material Issue routes
router.post("/material-issue", createMaterialIssue);
router.get("/material-issue", getAllMaterialIssues);
router.put("/material-issue/:id", updateMaterialIssue);

// BOM routes
router.post("/bom", createBOM);
router.get("/bom", getAllBOMs);
router.put("/bom/:id", updateBOM);

// Inventory routes
router.post("/inventory", createInventory);
router.get("/inventory", getInventory);
router.put("/inventory/:id", updateInventory);
router.get("/inventory/low-stock", getLowStockItems);

// Material Request routes
router.post("/material-request", createMaterialRequest);
router.get("/material-request", getAllMaterialRequests);
router.put("/material-request/:id", updateMaterialRequest);

// Purchase Order routes
router.post("/po", createPO);
router.get("/po", getAllPOs);
router.put("/po/:id", updatePO);

// Master routes
router.post("/vendor", createVendor);
router.get("/vendor", getAllVendors);
router.put("/vendor/:id", updateVendor);
router.delete("/vendor/:id", deleteVendor);

router.post("/job-work-supplier", createJobWorkSupplier);
router.get("/job-work-supplier", getAllJobWorkSuppliers);
router.put("/job-work-supplier/:id", updateJobWorkSupplier);
router.delete("/job-work-supplier/:id", deleteJobWorkSupplier);

router.post("/customer", createCustomer);
router.get("/customer", getAllCustomers);
router.put("/customer/:id", updateCustomer);
router.delete("/customer/:id", deleteCustomer);

router.post("/location", createLocation);
router.get("/location", getAllLocations);
router.put("/location/:id", updateLocation);
router.delete("/location/:id", deleteLocation);

router.post("/category", createCategory);
router.get("/category", getAllCategories);
router.put("/category/:id", updateCategory);
router.delete("/category/:id", deleteCategory);

router.post("/rm-bo-item", upload.array('photos', 2), createRmBoItem);
router.get("/rm-bo-item", getAllRmBoItems);
router.put("/rm-bo-item/:id", upload.array('photos', 2), updateRmBoItem);
router.delete("/rm-bo-item/:id", deleteRmBoItem);

// Company Info routes
router.get("/company-info", getCompanyInfo);
router.put("/company-info", upload.single("logo"), updateCompanyInfo);

// Job Work Store routes
router.post("/jobwork/create", createJobWorkChallan);
router.put("/jobwork/receive/:id", receiveJobWorkItems);
router.get("/jobwork/all", getAllJobWorkChallans);
router.put("/jobwork/update/:id", updateJobWorkChallan);
router.delete("/jobwork/delete/:id", deleteJobWorkChallan);
// Quotation routes
router.post("/quotation", createQuotation);
router.get("/quotation", getAllQuotations);
router.put("/quotation/:id", updateQuotation);
router.delete("/quotation/:id", deleteQuotation);

// Store Order routes
router.post("/order", upload.fields([{ name: 'pdf', maxCount: 1 }, { name: 'photos', maxCount: 3 }]), createStoreOrder);
router.get("/order", getAllStoreOrders);
router.get("/order/:id", getStoreOrderById);
router.put("/order/:id", upload.fields([{ name: 'pdf', maxCount: 1 }, { name: 'photos', maxCount: 3 }]), updateStoreOrder);
router.delete("/order/:id", deleteStoreOrder);

// Store Order Dispatch routes
router.post("/order/:storeOrderId/dispatch", upload.fields([{ name: 'pdf', maxCount: 1 }, { name: 'photos', maxCount: 3 }]), createStoreDispatch);
router.get("/order/:storeOrderId/dispatches", getDispatchHistory);

// Store Fulfillment & MRP routes
router.get("/fulfillment", getFulfillments);
router.post("/fulfillment/:id/reserve", reserveQuantity);
router.post("/fulfillment/:id/move-to-mrp", moveToMRP);
router.get("/mrp", getStoreMRPs);
router.post("/mrp/:id/plan-rm", planRMRequirement);
router.post("/mrp/:id/plan-single-rm", planSingleRMRequirement);
router.post("/mrp/:id/plan-production", planProductionRequirement);

// RM Planning routes
router.get("/rm-plan", getRMPlans);
router.put("/rm-plan/:id/po", updateRMPlanPO);

// FG Item routes
import { createFGItem, getAllFGItems, updateFGItem, deleteFGItem, createFGGRN, getAllFGGRNs, updateFGGRN, deleteFGGRN } from "../controllers/store/index.js";
router.post("/fg-item", upload.array('photos', 5), createFGItem);
router.get("/fg-item", getAllFGItems);
router.put("/fg-item/:id", upload.array('photos', 5), updateFGItem);
router.delete("/fg-item/:id", deleteFGItem);

// FG GRN routes
router.post("/fg-grn", upload.fields([{ name: 'pdf', maxCount: 1 }, { name: 'photos', maxCount: 10 }]), createFGGRN);
router.get("/fg-grn", getAllFGGRNs);
router.put("/fg-grn/:id", upload.fields([{ name: 'pdf', maxCount: 1 }, { name: 'photos', maxCount: 10 }]), updateFGGRN);
router.delete("/fg-grn/:id", deleteFGGRN);

// Monthly Inventory Routes
import { 
  getRMMonthlyInventory, 
  getFGMonthlyInventory, 
  updateRMMonthlyInventory, 
  updateFGMonthlyInventory 
} from "../controllers/store/index.js";

router.get("/monthly-inventory/rm", getRMMonthlyInventory);
router.post("/monthly-inventory/rm", updateRMMonthlyInventory);
router.get("/monthly-inventory/fg", getFGMonthlyInventory);
router.post("/monthly-inventory/fg", updateFGMonthlyInventory);

export default router;

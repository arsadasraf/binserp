import { Router } from "express";
import multer from "multer";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
    createLead,
    getLeads,
    updateLead,
    deleteLead,
    convertLeadToCustomer,
    getDeals,
    createDeal,
    updateDeal,
    deleteDeal,
    createCustomer,
    getCustomers,
    getCustomer360,
    updateCustomer,
    deleteCustomer,
    createActivity,
    getActivities,
    updateActivity,
    deleteActivity,
    getCRMMasters,
    createCRMMasterItem,
    updateCRMMasterItem,
    deleteCRMMasterItem,
    downloadExcelTemplate,
    importLeadsFromExcel,
    importCustomersFromExcel,
    exportLeadsToExcel,
    exportCustomersToExcel,
    getCRMIntegrations,
    saveCRMIntegrations,
    syncIndiaMartLeads,
    receiveWebhookLead,
    getSyncLogs,
    getCRMStats
} from "../controllers/crm/index.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// ==========================================
// PUBLIC INBOUND WEBHOOK ENDPOINT (NO JWT)
// ==========================================
router.post("/webhook/:token", receiveWebhookLead);

// ==========================================
// AUTHENTICATED CRM ROUTES (REQUIRES JWT)
// ==========================================
router.use(verifyJWT);

// 1. Stats & Analytics
router.get("/stats", getCRMStats);

// 2. CRM Masters (Sources, Stages, Industries, Loss Reasons, Products)
router.get("/masters/:type", getCRMMasters);
router.post("/masters/:type", createCRMMasterItem);
router.put("/masters/:type/:id", updateCRMMasterItem);
router.delete("/masters/:type/:id", deleteCRMMasterItem);

// 3. Leads Management
router.route("/leads")
    .get(getLeads)
    .post(createLead);

router.route("/leads/:id")
    .put(updateLead)
    .delete(deleteLead);

router.post("/leads/:id/convert", convertLeadToCustomer);

// 4. Deals & Opportunities
router.route("/deals")
    .get(getDeals)
    .post(createDeal);

router.route("/deals/:id")
    .put(updateDeal)
    .delete(deleteDeal);

// 5. Customers 360
router.route("/customers")
    .get(getCustomers)
    .post(createCustomer);

router.get("/customers/:id/360", getCustomer360);

router.route("/customers/:id")
    .put(updateCustomer)
    .delete(deleteCustomer);

// 6. Activities & Follow-ups
router.route("/activities")
    .get(getActivities)
    .post(createActivity);

router.route("/activities/:id")
    .put(updateActivity)
    .delete(deleteActivity);

// 7. Excel Import / Export Data Hub
router.get("/excel/template/:type", downloadExcelTemplate);
router.post("/excel/import/leads", upload.single("file"), importLeadsFromExcel);
router.post("/excel/import/customers", upload.single("file"), importCustomersFromExcel);
router.get("/excel/export/leads", exportLeadsToExcel);
router.get("/excel/export/customers", exportCustomersToExcel);

// 8. Integrations & Connectors
router.get("/integrations", getCRMIntegrations);
router.post("/integrations/save", saveCRMIntegrations);
router.post("/integrations/sync-indiamart", syncIndiaMartLeads);
router.get("/integrations/logs", getSyncLogs);

export default router;

import { Router } from "express";
import multer from "multer";
import { verifyJWT, requirePermission } from "../middlewares/auth.middleware.js";
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
    getCRMStats,
    getProposals,
    createProposal,
    updateProposal,
    deleteProposal,
    getPayments,
    createPayment,
    updatePayment,
    deletePayment,
    getInstalledBase,
    createInstalledBase,
    updateInstalledBase,
    deleteInstalledBase,
    getServiceTickets,
    createServiceTicket,
    updateServiceTicket,
    deleteServiceTicket,
    getCRMTeamAccess
} from "../controllers/crm/index.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// ==========================================
// PUBLIC INBOUND WEBHOOK & TEMPLATE ENDPOINTS (NO JWT REQUIRED)
// ==========================================
router.post("/webhook/:token", receiveWebhookLead);
router.get("/excel/template/:type", downloadExcelTemplate);

// ==========================================
// AUTHENTICATED CRM ROUTES (REQUIRES JWT)
// ==========================================
router.use(verifyJWT);

// ------------------------------------------
// 1. Overview Tab & Analytics
// ------------------------------------------
router.get("/stats", requirePermission("CRM", "overview"), getCRMStats);

// ------------------------------------------
// 2. Lead Pipeline Tab (with External Fetch & Excel)
// ------------------------------------------
router.use(["/leads", "/excel/import/leads", "/excel/export/leads"], requirePermission("CRM", "leads"));
router.route("/leads")
    .get(getLeads)
    .post(createLead);

router.route("/leads/:id")
    .put(updateLead)
    .delete(deleteLead);

router.post("/leads/:id/convert", convertLeadToCustomer);
router.post("/leads/sync-indiamart", syncIndiaMartLeads);
router.post("/excel/import/leads", upload.single("file"), importLeadsFromExcel);
router.get("/excel/export/leads", exportLeadsToExcel);

// ------------------------------------------
// 3. Deals & Revenue Tab (Deals, Proposals, Payment Receipts)
// ------------------------------------------
router.use(["/deals", "/proposals", "/payments"], requirePermission("CRM", "deals"));

// Deals
router.route("/deals")
    .get(getDeals)
    .post(createDeal);

router.route("/deals/:id")
    .put(updateDeal)
    .delete(deleteDeal);

// Proposals & Quotations
router.route("/proposals")
    .get(getProposals)
    .post(createProposal);

router.route("/proposals/:id")
    .put(updateProposal)
    .delete(deleteProposal);

// Payments & Receipts
router.route("/payments")
    .get(getPayments)
    .post(createPayment);

router.route("/payments/:id")
    .put(updatePayment)
    .delete(deletePayment);

// ------------------------------------------
// 4. Customer 360 & After-Sales Services Tab
// ------------------------------------------
router.use([
    "/customers", 
    "/installed-base", 
    "/service-tickets", 
    "/activities", 
    "/excel/import/customers", 
    "/excel/export/customers"
], requirePermission("CRM", "customers"));

// Customers
router.route("/customers")
    .get(getCustomers)
    .post(createCustomer);

router.get("/customers/:id/360", getCustomer360);

router.route("/customers/:id")
    .put(updateCustomer)
    .delete(deleteCustomer);

router.post("/excel/import/customers", upload.single("file"), importCustomersFromExcel);
router.get("/excel/export/customers", exportCustomersToExcel);

// Installed Base (Sold Goods, Warranty Tracking)
router.route("/installed-base")
    .get(getInstalledBase)
    .post(createInstalledBase);

router.route("/installed-base/:id")
    .put(updateInstalledBase)
    .delete(deleteInstalledBase);

// Service & Support Tickets
router.route("/service-tickets")
    .get(getServiceTickets)
    .post(createServiceTicket);

router.route("/service-tickets/:id")
    .put(updateServiceTicket)
    .delete(deleteServiceTicket);

// Activities & Follow-ups
router.route("/activities")
    .get(getActivities)
    .post(createActivity);

router.route("/activities/:id")
    .put(updateActivity)
    .delete(deleteActivity);

// ------------------------------------------
// 5. CRM Masters Tab (Products + Photos, Team Access, Credentials, Pipeline)
// ------------------------------------------
// Read access for master items (for dropdowns across CRM) is open to CRM users; mutations require CRM:masters
router.get("/masters/:type", getCRMMasters);
router.post("/masters/:type", requirePermission("CRM", "masters"), createCRMMasterItem);
router.put("/masters/:type/:id", requirePermission("CRM", "masters"), updateCRMMasterItem);
router.delete("/masters/:type/:id", requirePermission("CRM", "masters"), deleteCRMMasterItem);

// Team Access List
router.get("/team-access", requirePermission("CRM", "masters"), getCRMTeamAccess);

// Integrations & Credentials (IndiaMART, TradeIndia, Webhook)
router.use("/integrations", requirePermission("CRM", "masters"));
router.get("/integrations", getCRMIntegrations);
router.post("/integrations/save", saveCRMIntegrations);
router.post("/integrations/sync-indiamart", syncIndiaMartLeads);
router.get("/integrations/logs", getSyncLogs);

export default router;

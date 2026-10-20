import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { verifyJWT, requirePermission } from "../middlewares/auth.middleware.js";
import {
    createLead,
    getLeads,
    updateLead,
    deleteLead,
    convertLeadToCustomer,
    addLeadFollowUp,
    getLeadFollowUps,
    deleteLeadFollowUp,
    getDeals,
    createDeal,
    updateDeal,
    deleteDeal,
    createCustomer,
    getCustomers,
    getCustomer360,
    updateCustomer,
    deleteCustomer,
    addCustomerNote,
    getCustomerNotes,
    deleteCustomerNote,
    addCustomerTravelLog,
    getCustomerTravelLogs,
    deleteCustomerTravelLog,
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
    createProposalRevision,
    convertProposalToPI,
    getProformaInvoices,
    createProformaInvoice,
    updateProformaInvoice,
    createPIRevision,
    convertPIToInvoice,
    deleteProformaInvoice,
    getPayments,
    createPayment,
    updatePayment,
    deletePayment,
    getReceivablesAging,
    getInstalledBase,
    createInstalledBase,
    updateInstalledBase,
    deleteInstalledBase,
    getServiceTickets,
    createServiceTicket,
    updateServiceTicket,
    deleteServiceTicket,
    getInstallations,
    createInstallation,
    updateInstallation,
    deleteInstallation,
    getCRMTeamAccess
} from "../controllers/crm/index.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// Multi-part disk storage for follow-up notes (voice recordings, photos, and documents)
const followUpStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const tempDir = path.join(process.cwd(), "public", "temp");
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        cb(null, tempDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const safeExt = path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, "");
        const base = path.basename(file.originalname, safeExt).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 50);
        cb(null, `${uniqueSuffix}-${base || "file"}${safeExt}`);
    }
});

// Strict file filter preventing execution of scripts, HTML, or dangerous executables
const followUpFileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const dangerousExts = /\.(html?|svg|js|mjs|exe|bat|cmd|sh|php|asp|jsp|cgi|pl|py|vbs|jar|com|scr)$/i;
    
    if (dangerousExts.test(ext) || dangerousExts.test(file.originalname)) {
        return cb(new Error("File type not permitted for security reasons (executable or script detected)."), false);
    }

    if (file.fieldname === "voice") {
        const allowedVoice = /\.(webm|wav|mp3|ogg|m4a|aac)$/i;
        if (allowedVoice.test(ext) || file.mimetype.startsWith("audio/")) {
            return cb(null, true);
        }
        return cb(new Error("Only audio files (webm, wav, mp3, ogg, m4a, aac) are allowed for voice notes."), false);
    }

    if (file.fieldname === "photos") {
        const allowedPhotos = /\.(jpe?g|png|webp|gif)$/i;
        if (allowedPhotos.test(ext) && file.mimetype.startsWith("image/")) {
            return cb(null, true);
        }
        return cb(new Error("Only image files (JPEG, PNG, WEBP, GIF) are allowed for photos."), false);
    }

    if (file.fieldname === "files") {
        const allowedDocs = /\.(pdf|docx?|xlsx?|csv|txt|rtf|zip)$/i;
        if (allowedDocs.test(ext)) {
            return cb(null, true);
        }
        return cb(new Error("Only document files (PDF, DOC/DOCX, XLS/XLSX, CSV, TXT, RTF, ZIP) are allowed."), false);
    }

    cb(null, true);
};

const followUpUpload = multer({
    storage: followUpStorage,
    limits: { fileSize: 30 * 1024 * 1024 },
    fileFilter: followUpFileFilter
}).fields([
    { name: "voice", maxCount: 1 },
    { name: "photos", maxCount: 6 },
    { name: "files", maxCount: 6 }
]);

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

// Follow-up notes & interactions (voice, photos, files, schedule)
router.route("/leads/:id/follow-ups")
    .get(getLeadFollowUps)
    .post(followUpUpload, addLeadFollowUp);

router.delete("/leads/:id/follow-ups/:followUpId", deleteLeadFollowUp);

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
router.use(["/deals", "/proposals", "/proforma-invoices", "/payments"], requirePermission("CRM", "deals"));

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

router.post("/proposals/:id/revision", createProposalRevision);
router.post("/proposals/:id/convert-to-pi", convertProposalToPI);

router.route("/proposals/:id")
    .put(updateProposal)
    .delete(deleteProposal);

// Proforma Invoices (PI)
router.route("/proforma-invoices")
    .get(getProformaInvoices)
    .post(createProformaInvoice);

router.post("/proforma-invoices/:id/revision", createPIRevision);
router.post("/proforma-invoices/:id/convert-to-invoice", convertPIToInvoice);

router.route("/proforma-invoices/:id")
    .put(updateProformaInvoice)
    .delete(deleteProformaInvoice);

// Payments & Receipts
router.get("/payments/aging", getReceivablesAging);
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

// Multi-modal Contact Notes (Audio, Photos, Documents, Formatted Text)
router.route("/customers/:id/notes")
    .get(getCustomerNotes)
    .post(followUpUpload, addCustomerNote);

router.delete("/customers/:id/notes/:noteId", deleteCustomerNote);

// Customer Travel & Visit History Tracking
router.route("/customers/:id/travel-logs")
    .get(getCustomerTravelLogs)
    .post(followUpUpload, addCustomerTravelLog);

router.delete("/customers/:id/travel-logs/:travelId", deleteCustomerTravelLog);

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

// Installation & Commissioning (I&C)
router.route("/installations")
    .get(getInstallations)
    .post(createInstallation);

router.route("/installations/:id")
    .put(updateInstallation)
    .delete(deleteInstallation);

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

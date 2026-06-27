import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
    createLead,
    getLeads,
    updateLead,
    deleteLead,
    convertLeadToCustomer,
    createCustomer,
    getCustomers,
    updateCustomer,
    deleteCustomer,
    createActivity,
    getActivities,
    getCRMStats
} from "../controllers/crm/index.js";

const router = Router();

// Middleware
router.use(verifyJWT);

// Stats
router.get("/stats", getCRMStats);

// Leads
router.route("/leads")
    .get(getLeads)
    .post(createLead);

router.route("/leads/:id")
    .put(updateLead)
    .delete(deleteLead);

router.post("/leads/:id/convert", convertLeadToCustomer);

// Customers
router.route("/customers")
    .get(getCustomers)
    .post(createCustomer);

router.route("/customers/:id")
    .put(updateCustomer)
    .delete(deleteCustomer);

// Activities
router.route("/activities")
    .get(getActivities)
    .post(createActivity);

export default router;

import express from "express";
import {
    createBreakdownTicket,
    getBreakdownTickets,
    updateTicketStatus,
    createPreventiveSchedule,
    getPreventiveCalendar,
    completePreventiveMaintenance,
    addSparePart,
    getSpareParts,
    updateSparePartStock,
    getMaintenanceStats
} from "../controllers/maintenance.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { resolveTenant } from "../middlewares/tenant.middleware.js";

const router = express.Router();

// Middleware: Auth + Tenant
router.use(verifyJWT);
router.use(resolveTenant);

// Dashboard
router.get("/stats", getMaintenanceStats);

// Breakdown Management
router.post("/breakdown", createBreakdownTicket);
router.get("/breakdown", getBreakdownTickets);
router.put("/breakdown/:id/status", updateTicketStatus);

// Preventive Maintenance
router.post("/preventive/schedule", createPreventiveSchedule);
router.get("/preventive/calendar", getPreventiveCalendar);
router.post("/preventive/complete", completePreventiveMaintenance); // Using POST for action

// Spare Parts Inventory
router.post("/spare-parts", addSparePart);
router.get("/spare-parts", getSpareParts);
router.put("/spare-parts/:id/stock", updateSparePartStock);

export default router;

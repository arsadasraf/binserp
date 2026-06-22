import express from "express";
import {
    loginSaasAdmin,
    getDashboardStats,
    getAllCompanies,
    getCompanyById,
    getCompanyAnalytics,
    getUsersByCompany,
    getAllUsers,
    updateCompanyStatus,
    suspendCompany,
    unsuspendCompany,
    deleteCompany,
    deleteUser,
    getAuditLogs,
    exportCompaniesCSV,
    exportUsersCSV,
    createCompanyBySaasAdmin,
    resetCompanyPassword,
} from "../controllers/saasadmin.controller.js";
import { verifySaasAdminJWT } from "../middlewares/auth.middleware.js";

const router = express.Router();

// 🔓 Public routes
router.post("/login", loginSaasAdmin);

// 🔐 Protected routes (require SaaS Admin authentication)
router.get("/dashboard-stats", verifySaasAdminJWT, getDashboardStats);
router.post("/companies/create", verifySaasAdminJWT, createCompanyBySaasAdmin);
router.get("/companies", verifySaasAdminJWT, getAllCompanies);
router.get("/companies/:id", verifySaasAdminJWT, getCompanyById);
router.get("/companies/:id/analytics", verifySaasAdminJWT, getCompanyAnalytics);
router.get("/companies/:id/users", verifySaasAdminJWT, getUsersByCompany);
router.put("/companies/:id/status", verifySaasAdminJWT, updateCompanyStatus);
router.put("/companies/:id/reset-password", verifySaasAdminJWT, resetCompanyPassword);
router.put("/companies/:id/suspend", verifySaasAdminJWT, suspendCompany);
router.put("/companies/:id/unsuspend", verifySaasAdminJWT, unsuspendCompany);
router.delete("/companies/:id", verifySaasAdminJWT, deleteCompany);
router.get("/users", verifySaasAdminJWT, getAllUsers);
router.delete("/users/:id", verifySaasAdminJWT, deleteUser);
router.get("/audit-logs", verifySaasAdminJWT, getAuditLogs);
router.get("/export/companies", verifySaasAdminJWT, exportCompaniesCSV);
router.get("/export/users", verifySaasAdminJWT, exportUsersCSV);

export default router;

import { Company } from "../models/company/index.js";
import { userSchema } from "../models/user/index.js";
import { getTenantConnection, getTenantModel } from "../db/tenant.js";

/**
 * Middleware to resolve the tenant database based on Company ID.
 * Looks for `companyId` in req.body, req.query, or headers ['x-company-id'].
 */
export const resolveTenant = async (req, res, next) => {
    try {
        let companyId = req.body?.companyId || req.query?.companyId || req.headers?.["x-company-id"];
        console.log(`[resolveTenant] Initial companyId: ${companyId}`);

        // Check if company is already attached via auth middleware
        if (!companyId && req.company) {
            console.log(`[resolveTenant] Found req.company. ID: ${req.company.companyId}`);
            companyId = req.company.companyId;
        }

        // If still no companyId, we might be in a public/master route, or it's an error.
        if (!companyId) {
            return next();
        }

        // Check if we already have the tenant attached (e.g. from previous middleware?)
        if (req.tenantConnection && req.getModel) {
            console.log("[resolveTenant] Tenant already attached. Skipping.");
            return next();
        }

        // Find the company in Master DB
        const company = await Company.findOne({ companyId });

        if (!company) {
            return res.status(404).json({ message: "Invalid Company ID. Company not found." });
        }

        if (!company.dbName) {
            return res.status(500).json({ message: "Database configuration error for this company." });
        }

        // Attach tenant info to request
        req.tenantConnection = getTenantConnection(company.dbName);

        // Helper to get models on this tenant
        req.getModel = (modelName, schema) => {
            return getTenantModel(company.dbName, modelName, schema);
        };

        // Pre-register common models that are referenced in other schemas (e.g. for populate)
        if (req.getModel) {
            req.getModel("User", userSchema);
        }

        // Also attach company info for convenience
        req.company = company;

        next();
    } catch (error) {
        console.error("[resolveTenant] CRITICAL ERROR:", error);
        console.error("[resolveTenant] Stack:", error.stack);
        const debugInfo = {
            hasBody: !!req.body,
            bodyKeys: req.body ? Object.keys(req.body) : [],
            hasUser: !!req.user,
            hasCompanyInReq: !!req.company,
            headers: req.headers["x-company-id"]
        };
        console.error("[resolveTenant] Debug Info:", debugInfo);

        res.status(500).json({
            message: `Failed to resolve tenant database: ${error.message}`,
            details: error.message,
            debug: debugInfo
        });
    }
};

import { storePrefixSchema } from "../models/store/index.js";

export const DEFAULT_TIME_LOCK_HOURS = {
    grn: 24,
    customerPo: 24,
    deliveryChallan: 24,
    invoice: 24,
    purchasePo: 24,
    jobWorkChallan: 24,
    rfqQuotation: 24,
    mrbDisposition: 24
};

const DOC_DISPLAY_NAMES = {
    grn: "Goods Receipt Note (GRN)",
    customerPo: "Customer Purchase Order",
    deliveryChallan: "Delivery Challan",
    invoice: "Tax Invoice",
    purchasePo: "Purchase Order",
    jobWorkChallan: "Job Work Challan",
    rfqQuotation: "RFQ / Quotation",
    mrbDisposition: "MRB Disposition"
};

/**
 * Validates whether an edit or delete action is permitted based on the company's dynamic timeLock policy.
 * @param {Object} req Express request object with req.getModel
 * @param {string} entityKey 'grn' | 'customerPo' | 'deliveryChallan' | 'invoice' | 'purchasePo' | 'jobWorkChallan' | 'rfqQuotation' | 'mrbDisposition'
 * @param {Date|string} createdAt Date of record creation
 * @param {'edit'|'delete'} action 'edit' | 'delete'
 * @returns {Promise<{ allowed: boolean, message?: string, policyHours?: number }>}
 */
export const checkTimeLockGovernance = async (req, entityKey, createdAt, action = "edit") => {
    try {
        if (!createdAt) {
            return { allowed: true };
        }

        if (!req.getModel) {
            return { allowed: true };
        }

        const StorePrefix = req.getModel("StorePrefix", storePrefixSchema);
        const prefixDoc = await StorePrefix.findOne();

        const configuredPolicy = prefixDoc?.timeLockPolicies?.[entityKey];
        const policyHours = configuredPolicy !== undefined && configuredPolicy !== null
            ? Number(configuredPolicy)
            : (DEFAULT_TIME_LOCK_HOURS[entityKey] ?? 24);

        // Policy -1: Unlimited (no time lock)
        if (policyHours === -1 || isNaN(policyHours)) {
            return { allowed: true, policyHours: -1 };
        }

        const actionName = action === "delete" ? "deleted" : "edited";
        const docLabel = DOC_DISPLAY_NAMES[entityKey] || "Record";

        // Policy 0: Immediately locked after creation
        if (policyHours === 0) {
            return {
                allowed: false,
                policyHours: 0,
                message: `${docLabel} cannot be ${actionName}. Company policy has locked modifications immediately upon creation.`
            };
        }

        // Policy N: Allowed within N hours
        const elapsedHours = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60);
        if (elapsedHours > policyHours) {
            return {
                allowed: false,
                policyHours,
                message: `${docLabel} cannot be ${actionName}. Company policy allows modifications only within ${policyHours} hour(s) of creation (${elapsedHours.toFixed(1)}h elapsed).`
            };
        }

        return { allowed: true, policyHours };
    } catch (err) {
        console.error("Error evaluating checkTimeLockGovernance:", err);
        // Fail-safe default to allow or fallback gracefully
        return { allowed: true };
    }
};

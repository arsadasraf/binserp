import { storePrefixSchema } from "../../models/store/index.js";

// Helper to get company ID (consistent with other controllers)
const getCompanyId = (req) => {
    return req.userType === "company" ? req.user.id : req.user.company._id;
};

export const getStorePrefixSettings = async (req, res) => {
    try {
        if (!req.getModel) {
            throw new Error("Tenant context not found (req.getModel is undefined)");
        }
        const StorePrefix = req.getModel("StorePrefix", storePrefixSchema);
        let settings = await StorePrefix.findOne();

        const defaultRates = {
            USD: 86.80,
            EUR: 92.50,
            GBP: 108.20,
            AED: 23.63,
            CAD: 61.50,
            AUD: 55.40,
            SGD: 64.20,
            JPY: 0.56,
            CNY: 11.95,
        };

        const defaultTimeLockPolicies = {
            grn: 24,
            customerPo: 24,
            deliveryChallan: 24,
            invoice: 24,
            purchasePo: 24,
            jobWorkChallan: 24,
            rfqQuotation: 24,
            mrbDisposition: 24,
        };

        const defaultApprovalSettings = {
            materialRequest: {
                enabled: false,
                allowAllUsers: true,
                approvers: [],
                approverNames: [],
            },
            outwardPo: {
                enabled: false,
                allowAllUsers: true,
                approvers: [],
                approverNames: [],
            },
        };

        if (!settings) {
            settings = new StorePrefix();
        }

        const settingsObj = settings.toObject ? settings.toObject() : { ...settings };
        settingsObj.exchangeRates = { ...defaultRates, ...(settingsObj.exchangeRates || {}) };
        settingsObj.timeLockPolicies = { ...defaultTimeLockPolicies, ...(settingsObj.timeLockPolicies || {}) };
        settingsObj.approvalSettings = {
            materialRequest: { ...defaultApprovalSettings.materialRequest, ...(settingsObj.approvalSettings?.materialRequest || {}) },
            outwardPo: { ...defaultApprovalSettings.outwardPo, ...(settingsObj.approvalSettings?.outwardPo || {}) }
        };

        res.status(200).json({ settings: settingsObj });
    } catch (error) {
        console.error("Error fetching store prefix settings:", error);
        res.status(500).json({
            message: "Failed to fetch store prefix settings",
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

export const updateStorePrefixSettings = async (req, res) => {
    try {
        if (!req.getModel) {
            throw new Error("Tenant context not found (req.getModel is undefined)");
        }

        const StorePrefix = req.getModel("StorePrefix", storePrefixSchema);

        const defaultRates = {
            USD: 86.80,
            EUR: 92.50,
            GBP: 108.20,
            AED: 23.63,
            CAD: 61.50,
            AUD: 55.40,
            SGD: 64.20,
            JPY: 0.56,
            CNY: 11.95,
        };

        const defaultTimeLockPolicies = {
            grn: 24,
            customerPo: 24,
            deliveryChallan: 24,
            invoice: 24,
            purchasePo: 24,
            jobWorkChallan: 24,
            rfqQuotation: 24,
            mrbDisposition: 24,
        };

        const updateData = {
            grnPrefix: req.body.grnPrefix,
            rmBoGrnPrefix: req.body.rmBoGrnPrefix,
            fgGrnPrefix: req.body.fgGrnPrefix,
            poPrefix: req.body.poPrefix,
            incomingPoPrefix: req.body.incomingPoPrefix,
            outgoingPoPrefix: req.body.outgoingPoPrefix || req.body.outwardPoPrefix,
            outwardPoPrefix: req.body.outwardPoPrefix || req.body.outgoingPoPrefix,
            dcPrefix: req.body.dcPrefix,
            invoicePrefix: req.body.invoicePrefix,
            partPrefix: req.body.partPrefix,
            categoryPrefix: req.body.categoryPrefix,
            vendorPrefix: req.body.vendorPrefix,
            customerPrefix: req.body.customerPrefix,
            jobWorkSupplierPrefix: req.body.jobWorkSupplierPrefix,
            incomingRfqPrefix: req.body.incomingRfqPrefix,
            outgoingRfqPrefix: req.body.outgoingRfqPrefix,
            quotationOutwardPrefix: req.body.quotationOutwardPrefix,
            quotationInwardPrefix: req.body.quotationInwardPrefix,
        };

        if (req.body.exchangeRates && typeof req.body.exchangeRates === 'object') {
            const sanitizedRates = { ...defaultRates };
            Object.keys(req.body.exchangeRates).forEach(currency => {
                const val = Number(req.body.exchangeRates[currency]);
                if (!isNaN(val) && val > 0) {
                    sanitizedRates[currency] = val;
                }
            });
            updateData.exchangeRates = sanitizedRates;
        }

        if (req.body.timeLockPolicies && typeof req.body.timeLockPolicies === 'object') {
            const sanitizedPolicies = { ...defaultTimeLockPolicies };
            Object.keys(req.body.timeLockPolicies).forEach(key => {
                const val = Number(req.body.timeLockPolicies[key]);
                if (!isNaN(val)) {
                    sanitizedPolicies[key] = val;
                }
            });
            updateData.timeLockPolicies = sanitizedPolicies;
        }

        if (req.body.approvalSettings && typeof req.body.approvalSettings === 'object') {
            updateData.approvalSettings = {
                materialRequest: {
                    enabled: Boolean(req.body.approvalSettings.materialRequest?.enabled),
                    allowAllUsers: req.body.approvalSettings.materialRequest?.allowAllUsers !== false,
                    approvers: Array.isArray(req.body.approvalSettings.materialRequest?.approvers) ? req.body.approvalSettings.materialRequest.approvers : [],
                    approverNames: Array.isArray(req.body.approvalSettings.materialRequest?.approverNames) ? req.body.approvalSettings.materialRequest.approverNames : [],
                },
                outwardPo: {
                    enabled: Boolean(req.body.approvalSettings.outwardPo?.enabled),
                    allowAllUsers: req.body.approvalSettings.outwardPo?.allowAllUsers !== false,
                    approvers: Array.isArray(req.body.approvalSettings.outwardPo?.approvers) ? req.body.approvalSettings.outwardPo.approvers : [],
                    approverNames: Array.isArray(req.body.approvalSettings.outwardPo?.approverNames) ? req.body.approvalSettings.outwardPo.approverNames : [],
                }
            };
        }

        Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

        const settings = await StorePrefix.findOneAndUpdate(
            {}, 
            updateData,
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        res.status(200).json({ message: "Store prefix settings updated successfully", settings });
    } catch (error) {
        console.error("Error updating store prefix settings:", error);
        res.status(500).json({
            message: "Failed to update store prefix settings",
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

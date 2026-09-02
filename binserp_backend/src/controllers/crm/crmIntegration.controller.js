import axios from "axios";
import { crmIntegrationSchema, leadSchema } from "../../models/crm/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";

// 1. Get Integration Settings
export const getCRMIntegrations = asyncHandler(async (req, res) => {
    const CRMIntegration = req.getModel("CRMIntegration", crmIntegrationSchema);
    let integration = await CRMIntegration.findOne({ company: req.company._id });

    if (!integration) {
        integration = await CRMIntegration.create({
            company: req.company._id,
            indiaMart: { autoSync: false, defaultSource: "IndiaMART" },
            tradeIndia: { autoSync: false },
            webhook: { isActive: true, defaultSource: "Website Webhook" }
        });
    }

    return res.status(200).json(new ApiResponse(200, integration, "CRM Integration settings retrieved"));
});

// 2. Save / Update Integration Settings
export const saveCRMIntegrations = asyncHandler(async (req, res) => {
    const CRMIntegration = req.getModel("CRMIntegration", crmIntegrationSchema);
    let integration = await CRMIntegration.findOne({ company: req.company._id });

    if (!integration) {
        integration = new CRMIntegration({
            company: req.company._id,
            ...req.body
        });
    } else {
        if (req.body.indiaMart) {
            integration.indiaMart = { ...integration.indiaMart, ...req.body.indiaMart };
        }
        if (req.body.tradeIndia) {
            integration.tradeIndia = { ...integration.tradeIndia, ...req.body.tradeIndia };
        }
        if (req.body.webhook) {
            integration.webhook = { ...integration.webhook, ...req.body.webhook };
        }
    }

    await integration.save();
    return res.status(200).json(new ApiResponse(200, integration, "CRM Integration settings saved successfully"));
});

// 3. Trigger Live Sync with IndiaMART CRM API
export const syncIndiaMartLeads = asyncHandler(async (req, res) => {
    const CRMIntegration = req.getModel("CRMIntegration", crmIntegrationSchema);
    const Lead = req.getModel("Lead", leadSchema);

    const integration = await CRMIntegration.findOne({ company: req.company._id });
    if (!integration || !integration.indiaMart?.glusrMobile || !integration.indiaMart?.glusrAuthKey) {
        throw new ApiError(400, "Please configure IndiaMART Mobile Number and Auth Key first");
    }

    const { glusrMobile, glusrAuthKey, defaultAssignedTo, defaultSource } = integration.indiaMart;

    const syncLog = {
        source: "IndiaMART",
        syncTime: new Date(),
        status: "Success",
        recordsFetched: 0,
        recordsInserted: 0,
        recordsSkipped: 0,
        message: ""
    };

    try {
        // IndiaMART CRM API v2 Endpoint
        const apiUrl = `https://mapi.indiamart.com/wservce/crm/crmListing/v2/?glusr_mobile=${encodeURIComponent(glusrMobile)}&glusr_mobile_key=${encodeURIComponent(glusrAuthKey)}`;
        
        const response = await axios.get(apiUrl, { timeout: 15000 });
        const data = response.data;

        if (data.CODE !== 200 && data.STATUS !== "SUCCESS") {
            syncLog.status = "Failed";
            syncLog.message = data.MESSAGE || "IndiaMART API returned error";
            syncLog.errorDetails = JSON.stringify(data);
            integration.syncLogs.unshift(syncLog);
            if (integration.syncLogs.length > 50) integration.syncLogs.pop();
            await integration.save();
            return res.status(400).json(new ApiResponse(400, syncLog, syncLog.message));
        }

        const inquiries = Array.isArray(data.RESPONSE) ? data.RESPONSE : [];
        syncLog.recordsFetched = inquiries.length;

        for (const item of inquiries) {
            const queryId = item.UNIQUE_QUERY_ID || item.QUERY_ID;
            const senderName = item.SENDER_NAME || item.SENDERNAME || "IndiaMART Buyer";
            const senderCompany = item.SENDER_COMPANY || item.SENDERCOMPANY || senderName;
            const senderMobile = item.SENDER_MOBILE || item.SENDERMOBILE || item.SENDER_PHONE;
            const senderEmail = item.SENDER_EMAIL || item.SENDEREMAIL;
            const senderCity = item.SENDER_CITY || item.SENDERCITY;
            const senderState = item.SENDER_STATE || item.SENDERSTATE;
            const senderAddress = item.SENDER_ADDRESS || item.SENDERADDRESS;
            const productName = item.QUERY_PRODUCT_NAME || item.PRODUCT_NAME || item.SUBJECT;
            const message = item.QUERY_MESSAGE || item.ENQUIRY_MESSAGE || item.QUERY_DETAILS;

            // Prevent duplicate query ID insertion
            let existingLead = null;
            if (queryId) {
                existingLead = await Lead.findOne({ company: req.company._id, sourceId: queryId });
            }
            if (!existingLead && senderMobile) {
                existingLead = await Lead.findOne({ company: req.company._id, phone: senderMobile, createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } });
            }

            if (existingLead) {
                syncLog.recordsSkipped++;
                continue;
            }

            await Lead.create({
                company: req.company._id,
                name: senderName,
                companyName: senderCompany,
                email: senderEmail || undefined,
                phone: senderMobile || undefined,
                address: senderAddress,
                city: senderCity,
                state: senderState,
                source: defaultSource || "IndiaMART",
                sourceId: queryId,
                sourceRawData: item,
                warmth: "Hot",
                status: "New",
                requirements: `Product: ${productName || "General Requirement"}\nMessage: ${message || "N/A"}`,
                productInterest: productName ? [productName] : [],
                assignedTo: defaultAssignedTo || undefined,
                tags: ["IndiaMART", "API Ingestion"],
                createdBy: req.user._id
            });

            syncLog.recordsInserted++;
        }

        syncLog.message = `IndiaMART sync finished: ${syncLog.recordsInserted} inquiries added, ${syncLog.recordsSkipped} skipped.`;
        integration.indiaMart.lastSyncAt = new Date();
        integration.syncLogs.unshift(syncLog);
        if (integration.syncLogs.length > 50) integration.syncLogs.pop();
        await integration.save();

        return res.status(200).json(new ApiResponse(200, syncLog, syncLog.message));
    } catch (err) {
        syncLog.status = "Failed";
        syncLog.message = err.message || "Failed to connect to IndiaMART API";
        syncLog.errorDetails = err.stack;
        integration.syncLogs.unshift(syncLog);
        if (integration.syncLogs.length > 50) integration.syncLogs.pop();
        await integration.save();

        throw new ApiError(500, `IndiaMART Sync Error: ${err.message}`);
    }
});

// 4. Inbound Webhook Receiver (Public endpoint for Website / Ads / Zapier)
export const receiveWebhookLead = asyncHandler(async (req, res) => {
    const { token } = req.params;
    if (!token) throw new ApiError(400, "Webhook token is required");

    const CRMIntegration = req.getModel("CRMIntegration", crmIntegrationSchema);
    const Lead = req.getModel("Lead", leadSchema);

    const integration = await CRMIntegration.findOne({ "webhook.webhookToken": token, "webhook.isActive": true });
    if (!integration) {
        throw new ApiError(403, "Invalid or disabled webhook endpoint");
    }

    const payload = req.body || {};
    const name = payload.name || payload.fullName || payload.contactPerson || payload.buyerName || "Web Lead";
    const companyName = payload.company || payload.companyName || payload.organization || name;
    const email = (payload.email || payload.emailAddress || "").toLowerCase();
    const phone = payload.phone || payload.mobile || payload.contactNumber;
    const requirements = payload.requirements || payload.message || payload.inquiry || payload.query || JSON.stringify(payload);
    const source = payload.source || integration.webhook.defaultSource || "Website Webhook";

    const lead = await Lead.create({
        company: integration.company,
        name,
        companyName,
        email: email || undefined,
        phone: phone || undefined,
        city: payload.city,
        state: payload.state,
        source,
        sourceRawData: payload,
        warmth: "Hot",
        status: "New",
        requirements,
        productInterest: payload.product ? [payload.product] : [],
        assignedTo: integration.webhook.defaultAssignedTo || undefined,
        tags: ["Webhook", source]
    });

    const syncLog = {
        source: `Webhook (${source})`,
        syncTime: new Date(),
        status: "Success",
        recordsFetched: 1,
        recordsInserted: 1,
        recordsSkipped: 0,
        message: `New lead received for ${name} (${companyName})`
    };
    integration.syncLogs.unshift(syncLog);
    if (integration.syncLogs.length > 50) integration.syncLogs.pop();
    await integration.save();

    return res.status(201).json(new ApiResponse(201, { leadId: lead._id }, "Webhook lead recorded successfully"));
});

// 5. Get Integration Sync Logs
export const getSyncLogs = asyncHandler(async (req, res) => {
    const CRMIntegration = req.getModel("CRMIntegration", crmIntegrationSchema);
    const integration = await CRMIntegration.findOne({ company: req.company._id });

    const logs = integration?.syncLogs || [];
    return res.status(200).json(new ApiResponse(200, logs, "Sync logs retrieved successfully"));
});

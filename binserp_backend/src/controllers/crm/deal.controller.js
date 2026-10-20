import { dealSchema, leadSchema, customerSchema, crmProposalSchema, crmProformaInvoiceSchema } from "../../models/crm/index.js";
import { invoiceSchema } from "../../models/sales/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";

// 1. Get Deals
export const getDeals = asyncHandler(async (req, res) => {
    const { stage, status, customerId, search } = req.query;
    const Deal = req.getModel("Deal", dealSchema);
    const Proposal = req.getModel("CRMProposal", crmProposalSchema);
    const Proforma = req.getModel("CRMProformaInvoice", crmProformaInvoiceSchema);
    const Invoice = req.getModel("Invoice", invoiceSchema);

    const filter = { company: req.company._id };
    if (stage && stage !== "All") filter.stage = stage;
    if (status && status !== "All") filter.status = status;
    if (customerId) filter.customer = customerId;
    if (search) {
        filter.$or = [
            { title: { $regex: search, $options: "i" } },
            { customerName: { $regex: search, $options: "i" } }
        ];
    }

    const deals = await Deal.find(filter)
        .populate("customer", "name email phone")
        .populate("lead", "name email phone")
        .populate("assignedTo", "name email")
        .populate("quotations", "proposalNo revisionNumber title totalAmount status createdAt")
        .populate("proformaInvoices", "piNumber revisionNumber title totalAmount advanceRequired advancePaid status quotationNo createdAt")
        .populate("invoices", "invoiceNumber grandTotal paymentStatus date")
        .sort({ updatedAt: -1 })
        .lean();

    const dealIds = deals.map(d => d._id);
    const [extraProps, extraPIs] = await Promise.all([
        Proposal.find({ company: req.company._id, deal: { $in: dealIds } }).select("proposalNo revisionNumber title totalAmount status deal createdAt").lean().catch(() => []),
        Proforma.find({ company: req.company._id, deal: { $in: dealIds } }).select("piNumber revisionNumber title totalAmount advanceRequired advancePaid status quotationNo deal createdAt").lean().catch(() => [])
    ]);

    const enrichedDeals = deals.map(d => {
        const dIdStr = String(d._id);
        const dealProps = [...(d.quotations || [])];
        extraProps.filter(p => String(p.deal) === dIdStr && !dealProps.some(dp => String(dp._id) === String(p._id))).forEach(p => dealProps.push(p));

        const dealPIs = [...(d.proformaInvoices || [])];
        extraPIs.filter(pi => String(pi.deal) === dIdStr && !dealPIs.some(dpi => String(dpi._id) === String(pi._id))).forEach(pi => dealPIs.push(pi));

        return {
            ...d,
            quotations: dealProps,
            proformaInvoices: dealPIs,
            invoices: d.invoices || []
        };
    });

    return res.status(200).json(new ApiResponse(200, enrichedDeals, "Deals fetched successfully"));
});

// 2. Create Deal
export const createDeal = asyncHandler(async (req, res) => {
    const { title, value, stage, probability, expectedCloseDate, customer, lead, customerName, products, assignedTo, notes } = req.body;
    if (!title) throw new ApiError(400, "Deal title is required");

    const Deal = req.getModel("Deal", dealSchema);

    const deal = await Deal.create({
        company: req.company._id,
        title: title.trim(),
        value: Number(value) || 0,
        stage: stage || "Discovery",
        probability: probability != null ? Number(probability) : 50,
        expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : undefined,
        customer: customer || undefined,
        lead: lead || undefined,
        customerName: customerName?.trim(),
        products: Array.isArray(products) ? products : [],
        assignedTo: assignedTo || undefined,
        notes,
        createdBy: req.user._id
    });

    return res.status(201).json(new ApiResponse(201, deal, "Deal created successfully"));
});

// 3. Update Deal / Stage Transition
export const updateDeal = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const Deal = req.getModel("Deal", dealSchema);

    const deal = await Deal.findOne({ _id: id, company: req.company._id });
    if (!deal) throw new ApiError(404, "Deal not found");

    const previousStage = deal.stage;
    const newStage = req.body.stage;

    if (newStage && newStage !== previousStage) {
        deal.stageHistory.push({
            fromStage: previousStage,
            toStage: newStage,
            changedBy: req.user._id,
            changedAt: new Date(),
            remarks: req.body.stageRemarks || `Stage changed from ${previousStage} to ${newStage}`
        });
        if (newStage === "Won") {
            deal.status = "Won";
            deal.actualCloseDate = new Date();
            deal.probability = 100;
        } else if (newStage === "Lost") {
            deal.status = "Lost";
            deal.actualCloseDate = new Date();
            deal.probability = 0;
            if (req.body.lossReason) deal.lossReason = req.body.lossReason;
            if (req.body.lossRemarks) deal.lossRemarks = req.body.lossRemarks;
        }
    }

    Object.assign(deal, req.body);
    deal.updatedBy = req.user._id;
    await deal.save();

    return res.status(200).json(new ApiResponse(200, deal, "Deal updated successfully"));
});

// 4. Delete Deal
export const deleteDeal = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const Deal = req.getModel("Deal", dealSchema);

    const deal = await Deal.findOneAndDelete({ _id: id, company: req.company._id });
    if (!deal) throw new ApiError(404, "Deal not found");

    return res.status(200).json(new ApiResponse(200, deal, "Deal deleted successfully"));
});

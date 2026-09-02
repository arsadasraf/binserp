import { dealSchema, leadSchema, customerSchema } from "../../models/crm/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";

// 1. Get Deals
export const getDeals = asyncHandler(async (req, res) => {
    const { stage, status, customerId, search } = req.query;
    const Deal = req.getModel("Deal", dealSchema);

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
        .sort({ updatedAt: -1 });

    return res.status(200).json(new ApiResponse(200, deals, "Deals fetched successfully"));
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

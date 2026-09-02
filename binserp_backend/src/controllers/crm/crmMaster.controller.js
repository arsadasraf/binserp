import { crmMasterSchema } from "../../models/crm/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";

// Default Master data to seed if company has no custom masters
const DEFAULT_MASTERS = [
    // Sources
    { type: "source", name: "IndiaMART", color: "#0284c7", order: 1, isDefault: true },
    { type: "source", name: "TradeIndia", color: "#ea580c", order: 2, isDefault: true },
    { type: "source", name: "Website Inquiry", color: "#16a34a", order: 3, isDefault: true },
    { type: "source", name: "Direct Referral", color: "#8b5cf6", order: 4, isDefault: true },
    { type: "source", name: "Cold Call / Outreach", color: "#64748b", order: 5, isDefault: true },
    { type: "source", name: "Exhibition / Trade Fair", color: "#d97706", order: 6, isDefault: true },

    // Stages
    { type: "stage", name: "New", color: "#3b82f6", order: 1, probability: 10, isDefault: true },
    { type: "stage", name: "Contacted", color: "#6366f1", order: 2, probability: 25, isDefault: true },
    { type: "stage", name: "Qualified", color: "#8b5cf6", order: 3, probability: 40, isDefault: true },
    { type: "stage", name: "Proposal Sent", color: "#ec4899", order: 4, probability: 60, isDefault: true },
    { type: "stage", name: "Negotiation", color: "#f59e0b", order: 5, probability: 80, isDefault: true },
    { type: "stage", name: "Won", color: "#10b981", order: 6, probability: 100, isDefault: true },
    { type: "stage", name: "Lost", color: "#ef4444", order: 7, probability: 0, isDefault: true },

    // Industries
    { type: "industry", name: "Automotive & OEM", order: 1, isDefault: true },
    { type: "industry", name: "Heavy Engineering", order: 2, isDefault: true },
    { type: "industry", name: "Pharmaceuticals", order: 3, isDefault: true },
    { type: "industry", name: "Packaging & Printing", order: 4, isDefault: true },
    { type: "industry", name: "Electrical & Electronics", order: 5, isDefault: true },
    { type: "industry", name: "Construction & Infrastructure", order: 6, isDefault: true },

    // Loss Reasons
    { type: "lossReason", name: "Price Too High", order: 1, isDefault: true },
    { type: "lossReason", name: "Competitor Selected", order: 2, isDefault: true },
    { type: "lossReason", name: "Lead Time / Delivery Delayed", order: 3, isDefault: true },
    { type: "lossReason", name: "Technical Spec Mismatch", order: 4, isDefault: true },
    { type: "lossReason", name: "Budget Cancelled / Postponed", order: 5, isDefault: true },
    { type: "lossReason", name: "No Response from Buyer", order: 6, isDefault: true }
];

export const getCRMMasters = asyncHandler(async (req, res) => {
    const { type } = req.params;
    const CRMMaster = req.getModel("CRMMaster", crmMasterSchema);

    let query = { company: req.company._id };
    if (type && type !== "all") {
        query.type = type;
    }

    let items = await CRMMaster.find(query).sort({ order: 1, name: 1 });

    // If company has 0 masters, seed defaults automatically
    if (items.length === 0) {
        const toSeed = DEFAULT_MASTERS.map(m => ({
            ...m,
            company: req.company._id,
            createdBy: req.user?._id
        }));
        await CRMMaster.insertMany(toSeed);
        items = await CRMMaster.find(query).sort({ order: 1, name: 1 });
    }

    return res.status(200).json(new ApiResponse(200, items, "CRM Masters retrieved successfully"));
});

export const createCRMMasterItem = asyncHandler(async (req, res) => {
    const { type } = req.params;
    const { name, code, color, order, probability, description, unitPrice, unit } = req.body;

    if (!name || !name.trim()) throw new ApiError(400, "Master item name is required");

    const CRMMaster = req.getModel("CRMMaster", crmMasterSchema);

    // Check duplicate
    const existing = await CRMMaster.findOne({
        company: req.company._id,
        type: type || req.body.type,
        name: { $regex: new RegExp(`^${name.trim()}$`, "i") }
    });

    if (existing) {
        throw new ApiError(409, `A master item named '${name.trim()}' already exists in this category`);
    }

    const item = await CRMMaster.create({
        company: req.company._id,
        type: type || req.body.type,
        name: name.trim(),
        code: code?.trim(),
        color: color || "#3b82f6",
        order: Number(order) || 0,
        probability: Number(probability) || 0,
        description: description?.trim(),
        unitPrice: Number(unitPrice) || 0,
        unit: unit || "PCS",
        createdBy: req.user._id
    });

    return res.status(201).json(new ApiResponse(201, item, "CRM Master item created successfully"));
});

export const updateCRMMasterItem = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const CRMMaster = req.getModel("CRMMaster", crmMasterSchema);

    const item = await CRMMaster.findOne({ _id: id, company: req.company._id });
    if (!item) throw new ApiError(404, "Master item not found");

    Object.assign(item, req.body);
    await item.save();

    return res.status(200).json(new ApiResponse(200, item, "CRM Master item updated successfully"));
});

export const deleteCRMMasterItem = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const CRMMaster = req.getModel("CRMMaster", crmMasterSchema);

    const item = await CRMMaster.findOneAndDelete({ _id: id, company: req.company._id });
    if (!item) throw new ApiError(404, "Master item not found");

    return res.status(200).json(new ApiResponse(200, item, "CRM Master item deleted successfully"));
});

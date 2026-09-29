import { crmProposalSchema, dealSchema, customerSchema } from "../../models/crm/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";

export const getProposals = asyncHandler(async (req, res) => {
    const Proposal = req.getModel("CRMProposal", crmProposalSchema);
    const { search, status, customerId } = req.query;

    const query = { company: req.company._id };
    if (status && status !== "All") query.status = status;
    if (customerId) query.customer = customerId;

    if (search && search.trim()) {
        const regex = { $regex: search.trim(), $options: "i" };
        query.$or = [
            { proposalNo: regex },
            { title: regex },
            { customerName: regex },
            { contactPerson: regex },
            { email: regex }
        ];
    }

    const proposals = await Proposal.find(query)
        .populate("deal", "title stage value")
        .populate("customer", "name customerCode email phone")
        .populate("createdBy", "name username email")
        .sort({ createdAt: -1 });

    return res.status(200).json(new ApiResponse(200, proposals, "Proposals fetched successfully"));
});

export const createProposal = asyncHandler(async (req, res) => {
    const { title, customerName, totalAmount } = req.body;
    if (!title) throw new ApiError(400, "Proposal title is required");

    const Proposal = req.getModel("CRMProposal", crmProposalSchema);

    // Auto-generate proposal number if not provided
    let proposalNo = req.body.proposalNo;
    if (!proposalNo) {
        const count = await Proposal.countDocuments({ company: req.company._id });
        proposalNo = `PROP-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;
    }

    const authorName = req.user?.name || req.user?.username || "CRM User";

    const proposal = await Proposal.create({
        company: req.company._id,
        ...req.body,
        proposalNo,
        totalAmount: Number(totalAmount || req.body.subtotal || 0),
        createdBy: req.user._id,
        createdByName: authorName
    });

    return res.status(201).json(new ApiResponse(201, proposal, "Proposal created successfully"));
});

export const updateProposal = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const Proposal = req.getModel("CRMProposal", crmProposalSchema);

    const authorName = req.user?.name || req.user?.username || "CRM User";

    const proposal = await Proposal.findOneAndUpdate(
        { _id: id, company: req.company._id },
        {
            ...req.body,
            updatedBy: req.user._id,
            updatedByName: authorName
        },
        { new: true, runValidators: true }
    );

    if (!proposal) throw new ApiError(404, "Proposal not found");

    return res.status(200).json(new ApiResponse(200, proposal, "Proposal updated successfully"));
});

export const deleteProposal = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const Proposal = req.getModel("CRMProposal", crmProposalSchema);

    const proposal = await Proposal.findOneAndDelete({ _id: id, company: req.company._id });
    if (!proposal) throw new ApiError(404, "Proposal not found");

    return res.status(200).json(new ApiResponse(200, null, "Proposal deleted successfully"));
});

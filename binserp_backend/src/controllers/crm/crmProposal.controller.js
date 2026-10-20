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
        revisionNumber: req.body.revisionNumber || 0,
        createdBy: req.user._id,
        createdByName: authorName
    });

    // If linked to a deal, register this proposal inside deal.quotations
    if (proposal.deal) {
        const Deal = req.getModel("Deal", dealSchema);
        await Deal.findByIdAndUpdate(proposal.deal, {
            $addToSet: { quotations: proposal._id }
        }).catch(() => {});
    }

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

    if (proposal.deal) {
        const Deal = req.getModel("Deal", dealSchema);
        await Deal.findByIdAndUpdate(proposal.deal, {
            $addToSet: { quotations: proposal._id }
        }).catch(() => {});
    }

    return res.status(200).json(new ApiResponse(200, proposal, "Proposal updated successfully"));
});

// Create a new Revision for a Proposal / Quotation
export const createProposalRevision = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { changeNotes, items, subtotal, taxAmount, totalAmount, terms, notes } = req.body;

    const Proposal = req.getModel("CRMProposal", crmProposalSchema);
    const existing = await Proposal.findOne({ _id: id, company: req.company._id });
    if (!existing) throw new ApiError(404, "Proposal not found");

    const authorName = req.user?.name || req.user?.username || "CRM User";
    const currentRev = Number(existing.revisionNumber || 0);
    const nextRev = currentRev + 1;

    // Archive current snapshot into revisionHistory
    existing.revisionHistory.push({
        revisionNumber: currentRev,
        proposalNo: existing.proposalNo,
        title: existing.title,
        items: existing.items || [],
        subtotal: existing.subtotal || 0,
        taxAmount: existing.taxAmount || 0,
        totalAmount: existing.totalAmount || 0,
        changeNotes: changeNotes || `Revision ${currentRev} archived before updating to Revision ${nextRev}`,
        status: existing.status,
        savedBy: req.user._id,
        savedByName: authorName,
        savedAt: new Date()
    });

    // Update active document to next revision
    existing.revisionNumber = nextRev;
    if (items) existing.items = items;
    if (subtotal !== undefined) existing.subtotal = Number(subtotal);
    if (taxAmount !== undefined) existing.taxAmount = Number(taxAmount);
    if (totalAmount !== undefined) existing.totalAmount = Number(totalAmount);
    if (terms !== undefined) existing.terms = terms;
    if (notes !== undefined) existing.notes = notes;
    existing.updatedBy = req.user._id;
    existing.updatedByName = authorName;

    await existing.save();

    return res.status(200).json(new ApiResponse(200, existing, `Revision ${nextRev} created successfully`));
});

// 1-Click Convert Quotation / Proposal to Proforma Invoice (PI)
export const convertProposalToPI = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { advanceRequired, paymentTerms, validUntil } = req.body;

    const Proposal = req.getModel("CRMProposal", crmProposalSchema);
    const { crmProformaInvoiceSchema } = await import("../../models/crm/index.js");
    const Proforma = req.getModel("CRMProformaInvoice", crmProformaInvoiceSchema);

    const proposal = await Proposal.findOne({ _id: id, company: req.company._id });
    if (!proposal) throw new ApiError(404, "Proposal not found");

    // Auto-generate Proforma Invoice number
    const count = await Proforma.countDocuments({ company: req.company._id });
    const piNumber = `PI-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;

    const authorName = req.user?.name || req.user?.username || "CRM User";

    const proformaInvoice = await Proforma.create({
        company: req.company._id,
        piNumber,
        revisionNumber: 0,
        title: `Proforma for ${proposal.title}`,
        quotation: proposal._id,
        quotationNo: proposal.proposalNo,
        deal: proposal.deal,
        customer: proposal.customer,
        customerName: proposal.customerName,
        contactPerson: proposal.contactPerson,
        email: proposal.email,
        phone: proposal.phone,
        items: proposal.items || [],
        subtotal: proposal.subtotal || 0,
        taxAmount: proposal.taxAmount || 0,
        totalAmount: proposal.totalAmount || 0,
        currency: proposal.currency || "INR",
        advanceRequired: Number(advanceRequired || 0),
        advancePaid: 0,
        paymentTerms: paymentTerms || "30% Advance, 70% before Dispatch",
        validUntil: validUntil ? new Date(validUntil) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        terms: proposal.terms,
        notes: proposal.notes,
        status: "Sent",
        createdBy: req.user._id,
        createdByName: authorName
    });

    // Update originating proposal status
    proposal.status = "Converted to PI";
    proposal.convertedToPI = proformaInvoice._id;
    proposal.convertedToPINo = piNumber;
    proposal.convertedAt = new Date();
    await proposal.save();

    // If linked to deal, add PI to deal.proformaInvoices
    if (proposal.deal) {
        const Deal = req.getModel("Deal", dealSchema);
        await Deal.findByIdAndUpdate(proposal.deal, {
            $addToSet: { 
                quotations: proposal._id,
                proformaInvoices: proformaInvoice._id 
            }
        }).catch(() => {});
    }

    return res.status(201).json(new ApiResponse(201, {
        proposal,
        proformaInvoice
    }, "Quotation successfully converted to Proforma Invoice"));
});

export const deleteProposal = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const Proposal = req.getModel("CRMProposal", crmProposalSchema);

    const proposal = await Proposal.findOneAndDelete({ _id: id, company: req.company._id });
    if (!proposal) throw new ApiError(404, "Proposal not found");

    return res.status(200).json(new ApiResponse(200, null, "Proposal deleted successfully"));
});

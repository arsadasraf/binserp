import { crmProformaInvoiceSchema, dealSchema, customerSchema } from "../../models/crm/index.js";
import { invoiceSchema } from "../../models/sales/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";

// 1. Get All Proforma Invoices
export const getProformaInvoices = asyncHandler(async (req, res) => {
    const Proforma = req.getModel("CRMProformaInvoice", crmProformaInvoiceSchema);
    const { search, status, customerId, dealId } = req.query;

    const query = { company: req.company._id };
    if (status && status !== "All") query.status = status;
    if (customerId) query.customer = customerId;
    if (dealId) query.deal = dealId;

    if (search && search.trim()) {
        const regex = { $regex: search.trim(), $options: "i" };
        query.$or = [
            { piNumber: regex },
            { quotationNo: regex },
            { title: regex },
            { customerName: regex },
            { contactPerson: regex },
            { email: regex }
        ];
    }

    const proformas = await Proforma.find(query)
        .populate("quotation", "proposalNo title totalAmount status")
        .populate("deal", "title stage value")
        .populate("customer", "name customerCode email phone")
        .populate("convertedToInvoice", "invoiceNumber grandTotal paymentStatus date")
        .populate("createdBy", "name username email")
        .sort({ createdAt: -1 });

    return res.status(200).json(new ApiResponse(200, proformas, "Proforma Invoices fetched successfully"));
});

// 2. Create Proforma Invoice Manually
export const createProformaInvoice = asyncHandler(async (req, res) => {
    const { title, customerName, totalAmount } = req.body;
    if (!title) throw new ApiError(400, "Proforma Invoice title is required");

    const Proforma = req.getModel("CRMProformaInvoice", crmProformaInvoiceSchema);

    let piNumber = req.body.piNumber;
    if (!piNumber) {
        const count = await Proforma.countDocuments({ company: req.company._id });
        piNumber = `PI-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;
    }

    const authorName = req.user?.name || req.user?.username || "CRM User";

    const proforma = await Proforma.create({
        company: req.company._id,
        ...req.body,
        piNumber,
        totalAmount: Number(totalAmount || req.body.subtotal || 0),
        revisionNumber: req.body.revisionNumber || 0,
        createdBy: req.user._id,
        createdByName: authorName
    });

    if (proforma.deal) {
        const Deal = req.getModel("Deal", dealSchema);
        await Deal.findByIdAndUpdate(proforma.deal, {
            $addToSet: { proformaInvoices: proforma._id }
        }).catch(() => {});
    }

    return res.status(201).json(new ApiResponse(201, proforma, "Proforma Invoice created successfully"));
});

// 3. Update Proforma Invoice
export const updateProformaInvoice = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const Proforma = req.getModel("CRMProformaInvoice", crmProformaInvoiceSchema);

    const authorName = req.user?.name || req.user?.username || "CRM User";

    const proforma = await Proforma.findOneAndUpdate(
        { _id: id, company: req.company._id },
        {
            ...req.body,
            updatedBy: req.user._id,
            updatedByName: authorName
        },
        { new: true, runValidators: true }
    );

    if (!proforma) throw new ApiError(404, "Proforma Invoice not found");

    if (proforma.deal) {
        const Deal = req.getModel("Deal", dealSchema);
        await Deal.findByIdAndUpdate(proforma.deal, {
            $addToSet: { proformaInvoices: proforma._id }
        }).catch(() => {});
    }

    return res.status(200).json(new ApiResponse(200, proforma, "Proforma Invoice updated successfully"));
});

// 4. Create PI Revision
export const createPIRevision = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { changeNotes, items, subtotal, taxAmount, totalAmount, advanceRequired, terms, notes } = req.body;

    const Proforma = req.getModel("CRMProformaInvoice", crmProformaInvoiceSchema);
    const existing = await Proforma.findOne({ _id: id, company: req.company._id });
    if (!existing) throw new ApiError(404, "Proforma Invoice not found");

    const authorName = req.user?.name || req.user?.username || "CRM User";
    const currentRev = Number(existing.revisionNumber || 0);
    const nextRev = currentRev + 1;

    existing.revisionHistory.push({
        revisionNumber: currentRev,
        piNumber: existing.piNumber,
        title: existing.title,
        items: existing.items || [],
        subtotal: existing.subtotal || 0,
        taxAmount: existing.taxAmount || 0,
        totalAmount: existing.totalAmount || 0,
        advanceRequired: existing.advanceRequired || 0,
        changeNotes: changeNotes || `Revision ${currentRev} archived before updating to Revision ${nextRev}`,
        status: existing.status,
        savedBy: req.user._id,
        savedByName: authorName,
        savedAt: new Date()
    });

    existing.revisionNumber = nextRev;
    if (items) existing.items = items;
    if (subtotal !== undefined) existing.subtotal = Number(subtotal);
    if (taxAmount !== undefined) existing.taxAmount = Number(taxAmount);
    if (totalAmount !== undefined) existing.totalAmount = Number(totalAmount);
    if (advanceRequired !== undefined) existing.advanceRequired = Number(advanceRequired);
    if (terms !== undefined) existing.terms = terms;
    if (notes !== undefined) existing.notes = notes;
    existing.updatedBy = req.user._id;
    existing.updatedByName = authorName;

    await existing.save();

    return res.status(200).json(new ApiResponse(200, existing, `Revision ${nextRev} created successfully`));
});

// 5. 1-Click Convert Proforma Invoice to Tax Invoice
export const convertPIToInvoice = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { invoiceDate, poReference } = req.body;

    const Proforma = req.getModel("CRMProformaInvoice", crmProformaInvoiceSchema);
    const Invoice = req.getModel("Invoice", invoiceSchema);

    const proforma = await Proforma.findOne({ _id: id, company: req.company._id });
    if (!proforma) throw new ApiError(404, "Proforma Invoice not found");

    // Auto-generate invoice number if not provided
    const invCount = await Invoice.countDocuments({ company: req.company._id });
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(invCount + 1).padStart(4, "0")}`;

    // Map line items into standard Sales Invoice format
    const invoiceItems = (proforma.items || []).map(item => ({
        fgItem: item.productSource === "FGItem" ? item.productId : undefined,
        itemCode: item.hsnCode || "ITEM",
        itemName: item.name,
        quantity: item.quantity || 1,
        rate: item.unitPrice || 0,
        discountPercent: item.discountPercent || 0,
        amount: item.total || 0,
        taxRate: item.taxRate || 18,
        description: item.description || ""
    }));

    const authorName = req.user?.name || req.user?.username || "CRM User";

    const taxInvoice = await Invoice.create({
        company: req.company._id,
        invoiceNumber,
        date: invoiceDate ? new Date(invoiceDate) : new Date(),
        customerName: proforma.customerName || "Customer",
        customer: proforma.customer,
        customerPoReference: poReference || proforma.quotationNo || "",
        customerAddress: proforma.billingAddress?.street || "",
        customerGST: "",
        currency: proforma.currency || "INR",
        exchangeRateToINR: 1,
        items: invoiceItems,
        subTotal: proforma.subtotal || 0,
        totalTax: proforma.taxAmount || 0,
        grandTotal: proforma.totalAmount || 0,
        paymentStatus: proforma.advancePaid >= proforma.totalAmount ? "Paid" : (proforma.advancePaid > 0 ? "Partially Paid" : "Unpaid"),
        paidAmount: proforma.advancePaid || 0,
        createdBy: req.user._id,
        createdByName: authorName
    });

    // Update PI status and reference
    proforma.status = "Converted to Invoice";
    proforma.convertedToInvoice = taxInvoice._id;
    proforma.convertedToInvoiceNo = invoiceNumber;
    proforma.convertedAt = new Date();
    await proforma.save();

    // If deal linked, register invoice inside deal.invoices
    if (proforma.deal) {
        const Deal = req.getModel("Deal", dealSchema);
        await Deal.findByIdAndUpdate(proforma.deal, {
            $addToSet: { 
                proformaInvoices: proforma._id,
                invoices: taxInvoice._id 
            }
        }).catch(() => {});
    }

    return res.status(201).json(new ApiResponse(201, {
        proforma,
        taxInvoice
    }, "Proforma Invoice successfully converted to Tax Invoice"));
});

// 6. Delete Proforma Invoice
export const deleteProformaInvoice = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const Proforma = req.getModel("CRMProformaInvoice", crmProformaInvoiceSchema);

    const proforma = await Proforma.findOneAndDelete({ _id: id, company: req.company._id });
    if (!proforma) throw new ApiError(404, "Proforma Invoice not found");

    return res.status(200).json(new ApiResponse(200, null, "Proforma Invoice deleted successfully"));
});

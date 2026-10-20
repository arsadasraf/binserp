import { crmPaymentSchema, dealSchema, customerSchema } from "../../models/crm/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";

export const getPayments = asyncHandler(async (req, res) => {
    const Payment = req.getModel("CRMPayment", crmPaymentSchema);
    const { search, customerId, dealId, paymentMode } = req.query;

    const query = { company: req.company._id };
    if (customerId) query.customer = customerId;
    if (dealId) query.deal = dealId;
    if (paymentMode && paymentMode !== "All") query.paymentMode = paymentMode;

    if (search && search.trim()) {
        const regex = { $regex: search.trim(), $options: "i" };
        query.$or = [
            { receiptNo: regex },
            { customerName: regex },
            { transactionRef: regex },
            { invoiceNumber: regex },
            { notes: regex }
        ];
    }

    const payments = await Payment.find(query)
        .populate("customer", "name customerCode email phone")
        .populate("deal", "title value stage")
        .populate("createdBy", "name username email")
        .sort({ paymentDate: -1, createdAt: -1 });

    // Calculate totals
    const totalCollected = payments.reduce((acc, p) => acc + (p.amount || 0), 0);

    return res.status(200).json(new ApiResponse(200, { payments, totalCollected }, "Payments fetched successfully"));
});

export const createPayment = asyncHandler(async (req, res) => {
    const { amount, customerName } = req.body;
    if (!amount || Number(amount) <= 0) throw new ApiError(400, "Valid payment amount is required");

    const Payment = req.getModel("CRMPayment", crmPaymentSchema);

    // Auto-generate receipt number if missing
    let receiptNo = req.body.receiptNo;
    if (!receiptNo) {
        const count = await Payment.countDocuments({ company: req.company._id });
        receiptNo = `RCPT-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;
    }

    const authorName = req.user?.name || req.user?.username || "CRM User";

    const payment = await Payment.create({
        company: req.company._id,
        ...req.body,
        receiptNo,
        amount: Number(amount),
        createdBy: req.user._id,
        createdByName: authorName
    });

    return res.status(201).json(new ApiResponse(201, payment, "Payment recorded successfully"));
});

export const updatePayment = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const Payment = req.getModel("CRMPayment", crmPaymentSchema);

    const authorName = req.user?.name || req.user?.username || "CRM User";

    const payment = await Payment.findOneAndUpdate(
        { _id: id, company: req.company._id },
        {
            ...req.body,
            updatedBy: req.user._id,
            updatedByName: authorName
        },
        { new: true, runValidators: true }
    );

    if (!payment) throw new ApiError(404, "Payment record not found");

    return res.status(200).json(new ApiResponse(200, payment, "Payment updated successfully"));
});

export const deletePayment = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const Payment = req.getModel("CRMPayment", crmPaymentSchema);

    const payment = await Payment.findOneAndDelete({ _id: id, company: req.company._id });
    if (!payment) throw new ApiError(404, "Payment record not found");

    return res.status(200).json(new ApiResponse(200, null, "Payment deleted successfully"));
});

/**
 * Accounts Receivable & Payment Recovery Aging Tracker (Requirement #13)
 * Buckets: 0-30 Days, 31-60 Days, 61-90 Days, 90+ Days Critical
 */
export const getReceivablesAging = asyncHandler(async (req, res) => {
    const Payment = req.getModel("CRMPayment", crmPaymentSchema);
    const Deal = req.getModel("Deal", dealSchema);

    const deals = await Deal.find({ company: req.company._id, status: { $in: ["Won", "Open"] } })
        .populate("customer", "name phone email customerCode");

    const payments = await Payment.find({ company: req.company._id });

    const now = new Date();

    const receivables = deals.map(deal => {
        const dealPayments = payments.filter(p => p.deal?.toString() === deal._id.toString());
        const totalPaid = dealPayments.reduce((acc, cur) => acc + (cur.amount || 0), 0);
        const totalValue = deal.value || 0;
        const balanceDue = Math.max(0, totalValue - totalPaid);

        const createdDate = new Date(deal.createdAt || now);
        const daysOverdue = Math.max(0, Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)));

        let agingBucket = "0-30 Days";
        if (daysOverdue > 90) agingBucket = "90+ Days (Critical)";
        else if (daysOverdue > 60) agingBucket = "61-90 Days";
        else if (daysOverdue > 30) agingBucket = "31-60 Days";

        return {
            dealId: deal._id,
            dealTitle: deal.title,
            customerName: deal.customer?.name || deal.customerName || "Customer",
            customerPhone: deal.customer?.phone || "",
            customerEmail: deal.customer?.email || "",
            totalValue,
            totalPaid,
            balanceDue,
            daysOverdue,
            agingBucket,
            stage: deal.stage,
            createdAt: deal.createdAt
        };
    }).filter(r => r.balanceDue > 0);

    const bucket0_30 = receivables.filter(r => r.agingBucket === "0-30 Days").reduce((a, b) => a + b.balanceDue, 0);
    const bucket31_60 = receivables.filter(r => r.agingBucket === "31-60 Days").reduce((a, b) => a + b.balanceDue, 0);
    const bucket61_90 = receivables.filter(r => r.agingBucket === "61-90 Days").reduce((a, b) => a + b.balanceDue, 0);
    const bucket90Plus = receivables.filter(r => r.agingBucket === "90+ Days (Critical)").reduce((a, b) => a + b.balanceDue, 0);
    const totalOutstanding = receivables.reduce((a, b) => a + b.balanceDue, 0);

    return res.status(200).json(new ApiResponse(200, {
        receivables,
        summary: {
            bucket0_30,
            bucket31_60,
            bucket61_90,
            bucket90Plus,
            totalOutstanding,
            overdueCount: receivables.length
        }
    }, "Accounts receivable aging fetched successfully"));
});

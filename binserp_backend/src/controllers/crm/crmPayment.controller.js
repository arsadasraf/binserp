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

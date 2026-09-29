import { installedBaseSchema, serviceTicketSchema, customerSchema } from "../../models/crm/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";

// ==========================================
// 1. INSTALLED BASE (SOLD PRODUCTS & WARRANTY)
// ==========================================

export const getInstalledBase = asyncHandler(async (req, res) => {
    const InstalledBase = req.getModel("InstalledBase", installedBaseSchema);
    const { search, customerId, warrantyStatus } = req.query;

    const query = { company: req.company._id };
    if (customerId) query.customer = customerId;
    if (warrantyStatus && warrantyStatus !== "All") query.warrantyStatus = warrantyStatus;

    if (search && search.trim()) {
        const regex = { $regex: search.trim(), $options: "i" };
        query.$or = [
            { serialNumber: regex },
            { productName: regex },
            { customerName: regex },
            { invoiceNumber: regex },
            { batchNumber: regex }
        ];
    }

    const items = await InstalledBase.find(query)
        .populate("customer", "name customerCode email phone")
        .populate("createdBy", "name username email")
        .sort({ deliveryDate: -1, createdAt: -1 });

    return res.status(200).json(new ApiResponse(200, items, "Installed base items fetched successfully"));
});

export const createInstalledBase = asyncHandler(async (req, res) => {
    const { customer, customerName, productName, serialNumber } = req.body;
    if (!productName) throw new ApiError(400, "Product name is required");
    if (!serialNumber) throw new ApiError(400, "Serial number is required");

    const InstalledBase = req.getModel("InstalledBase", installedBaseSchema);

    // Check unique serial number
    const existing = await InstalledBase.findOne({
        company: req.company._id,
        serialNumber: serialNumber.trim()
    });
    if (existing) {
        throw new ApiError(400, `Equipment with Serial Number '${serialNumber}' already exists.`);
    }

    // Auto calculate warranty expiry if deliveryDate and warrantyPeriodMonths provided
    let warrantyExpiryDate = req.body.warrantyExpiryDate;
    const deliveryDate = req.body.deliveryDate ? new Date(req.body.deliveryDate) : new Date();
    const months = Number(req.body.warrantyPeriodMonths || 12);
    if (!warrantyExpiryDate && deliveryDate) {
        warrantyExpiryDate = new Date(deliveryDate);
        warrantyExpiryDate.setMonth(warrantyExpiryDate.getMonth() + months);
    }

    // Determine warranty status
    const now = new Date();
    let warrantyStatus = "Under Warranty";
    if (warrantyExpiryDate && new Date(warrantyExpiryDate) < now) {
        warrantyStatus = "Out of Warranty";
    }

    const authorName = req.user?.name || req.user?.username || "CRM User";

    const item = await InstalledBase.create({
        company: req.company._id,
        ...req.body,
        deliveryDate,
        warrantyPeriodMonths: months,
        warrantyExpiryDate,
        warrantyStatus,
        createdBy: req.user._id,
        createdByName: authorName
    });

    return res.status(201).json(new ApiResponse(201, item, "Installed equipment registered successfully"));
});

export const updateInstalledBase = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const InstalledBase = req.getModel("InstalledBase", installedBaseSchema);

    const authorName = req.user?.name || req.user?.username || "CRM User";

    const item = await InstalledBase.findOneAndUpdate(
        { _id: id, company: req.company._id },
        {
            ...req.body,
            updatedBy: req.user._id,
            updatedByName: authorName
        },
        { new: true, runValidators: true }
    );

    if (!item) throw new ApiError(404, "Installed equipment record not found");

    return res.status(200).json(new ApiResponse(200, item, "Installed equipment updated successfully"));
});

export const deleteInstalledBase = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const InstalledBase = req.getModel("InstalledBase", installedBaseSchema);

    const item = await InstalledBase.findOneAndDelete({ _id: id, company: req.company._id });
    if (!item) throw new ApiError(404, "Installed equipment record not found");

    return res.status(200).json(new ApiResponse(200, null, "Installed equipment deleted successfully"));
});

// ==========================================
// 2. SERVICE & SUPPORT TICKETS
// ==========================================

export const getServiceTickets = asyncHandler(async (req, res) => {
    const ServiceTicket = req.getModel("ServiceTicket", serviceTicketSchema);
    const { search, customerId, status, priority, category } = req.query;

    const query = { company: req.company._id };
    if (customerId) query.customer = customerId;
    if (status && status !== "All") query.status = status;
    if (priority && priority !== "All") query.priority = priority;
    if (category && category !== "All") query.category = category;

    if (search && search.trim()) {
        const regex = { $regex: search.trim(), $options: "i" };
        query.$or = [
            { ticketNo: regex },
            { customerName: regex },
            { productName: regex },
            { serialNumber: regex },
            { issueDescription: regex }
        ];
    }

    const tickets = await ServiceTicket.find(query)
        .populate("customer", "name customerCode email phone")
        .populate("assignedTechnician", "name username email")
        .populate("createdBy", "name username email")
        .sort({ createdAt: -1 });

    return res.status(200).json(new ApiResponse(200, tickets, "Service tickets fetched successfully"));
});

export const createServiceTicket = asyncHandler(async (req, res) => {
    const { customer, customerName, issueDescription, category, priority } = req.body;
    if (!issueDescription) throw new ApiError(400, "Issue description is required");

    const ServiceTicket = req.getModel("ServiceTicket", serviceTicketSchema);

    // Auto-generate ticket number
    const count = await ServiceTicket.countDocuments({ company: req.company._id });
    const ticketNo = `SRV-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;

    const authorName = req.user?.name || req.user?.username || "CRM User";

    const ticket = await ServiceTicket.create({
        company: req.company._id,
        ...req.body,
        ticketNo,
        status: req.body.status || "Open",
        createdBy: req.user._id,
        createdByName: authorName
    });

    return res.status(201).json(new ApiResponse(201, ticket, "Service ticket created successfully"));
});

export const updateServiceTicket = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const ServiceTicket = req.getModel("ServiceTicket", serviceTicketSchema);

    const authorName = req.user?.name || req.user?.username || "CRM User";
    const updateData = {
        ...req.body,
        updatedBy: req.user._id,
        updatedByName: authorName
    };

    if (req.body.status === "Resolved" || req.body.status === "Closed") {
        updateData.resolvedAt = new Date();
    }

    const ticket = await ServiceTicket.findOneAndUpdate(
        { _id: id, company: req.company._id },
        updateData,
        { new: true, runValidators: true }
    );

    if (!ticket) throw new ApiError(404, "Service ticket not found");

    return res.status(200).json(new ApiResponse(200, ticket, "Service ticket updated successfully"));
});

export const deleteServiceTicket = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const ServiceTicket = req.getModel("ServiceTicket", serviceTicketSchema);

    const ticket = await ServiceTicket.findOneAndDelete({ _id: id, company: req.company._id });
    if (!ticket) throw new ApiError(404, "Service ticket not found");

    return res.status(200).json(new ApiResponse(200, null, "Service ticket deleted successfully"));
});

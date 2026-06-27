import {
    breakdownTicketSchema,
    preventiveScheduleSchema,
    maintenanceHistorySchema,
    sparePartSchema,
} from "../models/maintenance/index.js";
import { machineSchema } from "../models/ppc/index.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

// Helper to get next due date based on frequency
const getNextDate = (fromDate, frequency) => {
    const date = new Date(fromDate);
    switch (frequency) {
        case "Daily":
            date.setDate(date.getDate() + 1);
            break;
        case "Weekly":
            date.setDate(date.getDate() + 7);
            break;
        case "Monthly":
            date.setMonth(date.getMonth() + 1);
            break;
        case "Quarterly":
            date.setMonth(date.getMonth() + 3);
            break;
        case "HalfYearly":
            date.setMonth(date.getMonth() + 6);
            break;
        case "Yearly":
            date.setFullYear(date.getFullYear() + 1);
            break;
        default:
            date.setDate(date.getDate() + 7);
    }
    return date;
};

// ================= BREAKDOWN MANAGEMENT =================

export const createBreakdownTicket = asyncHandler(async (req, res) => {
    const { machineId, issueDescription, priority } = req.body;
    const BreakdownTicket = req.getModel("BreakdownTicket", breakdownTicketSchema);

    // Auto-generate Ticket Number
    const count = await BreakdownTicket.countDocuments();
    const ticketNumber = `TKT-${new Date().getFullYear()}-${(count + 1).toString().padStart(4, "0")}`;

    const ticket = await BreakdownTicket.create({
        company: req.company._id,
        ticketNumber,
        machine: machineId,
        reportedBy: req.user._id,
        issueDescription,
        priority,
        status: "Open",
        breakdownTime: new Date(),
    });

    // Optional: Update Machine Status to 'Breakdown'
    const Machine = req.getModel("Machine", machineSchema);
    await Machine.findByIdAndUpdate(machineId, { status: "Breakdown" });

    res.status(201).json(new ApiResponse(201, ticket, "Breakdown ticket created successfully"));
});

export const getBreakdownTickets = asyncHandler(async (req, res) => {
    const { status, machineId } = req.query;
    const BreakdownTicket = req.getModel("BreakdownTicket", breakdownTicketSchema);

    const query = { company: req.company._id };
    if (status && status !== 'All') query.status = status;
    if (machineId) query.machine = machineId;

    const tickets = await BreakdownTicket.find(query)
        .populate("machine", "machineName machineCode")
        .populate("reportedBy", "name")
        .populate("assignedTo", "name")
        .sort({ createdAt: -1 });

    res.status(200).json(new ApiResponse(200, tickets, "Tickets fetched successfully"));
});

export const updateTicketStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status, assignedTo, solution, sparePartsUsed } = req.body;
    const BreakdownTicket = req.getModel("BreakdownTicket", breakdownTicketSchema);

    const updateData = { status };
    if (assignedTo) updateData.assignedTo = assignedTo;
    if (solution) updateData.solution = solution;
    if (status === "Resolved" || status === "Closed") {
        updateData.resolutionTime = new Date();

        // If ticket is resolved, set machine back to Available
        const ticket = await BreakdownTicket.findById(id);
        if (ticket) {
            const Machine = req.getModel("Machine", machineSchema);
            await Machine.findByIdAndUpdate(ticket.machine, { status: "Available" });
        }
    }
    if (sparePartsUsed) {
        updateData.sparePartsUsed = sparePartsUsed;
        // logic to deduct stock could go here
    }

    const ticket = await BreakdownTicket.findByIdAndUpdate(id, updateData, { new: true });

    res.status(200).json(new ApiResponse(200, ticket, "Ticket updated successfully"));
});

// ================= PREVENTIVE MAINTENANCE =================

export const createPreventiveSchedule = asyncHandler(async (req, res) => {
    const { machineId, title, frequency, checklist, startDate } = req.body;
    const PreventiveSchedule = req.getModel("PreventiveSchedule", preventiveScheduleSchema);

    const schedule = await PreventiveSchedule.create({
        company: req.company._id,
        machine: machineId,
        title,
        frequency,
        checklist,
        nextDueDate: startDate || new Date(),
    });

    res.status(201).json(new ApiResponse(201, schedule, "Preventive schedule created"));
});

export const getPreventiveCalendar = asyncHandler(async (req, res) => {
    const { month, year } = req.query; // Filter by month/year if needed
    const PreventiveSchedule = req.getModel("PreventiveSchedule", preventiveScheduleSchema);

    // Simple fetch for now, can be optimized for calendar range
    const schedules = await PreventiveSchedule.find({ company: req.company._id })
        .populate("machine", "machineName machineCode")
        .sort({ nextDueDate: 1 });

    res.status(200).json(new ApiResponse(200, schedules, "Schedules fetched successfully"));
});

export const completePreventiveMaintenance = asyncHandler(async (req, res) => {
    const { scheduleId, remarks, sparePartsUsed } = req.body;
    const PreventiveSchedule = req.getModel("PreventiveSchedule", preventiveScheduleSchema);
    const MaintenanceHistory = req.getModel("MaintenanceHistory", maintenanceHistorySchema);

    const schedule = await PreventiveSchedule.findById(scheduleId);
    if (!schedule) throw new ApiError(404, "Schedule not found");

    // 1. Log History
    await MaintenanceHistory.create({
        company: req.company._id,
        schedule: schedule._id,
        machine: schedule.machine,
        performedBy: req.user._id,
        date: new Date(),
        status: "Completed",
        remarks,
        sparePartsUsed
    });

    // 2. Update Schedule with Next Due Date
    const nextDate = getNextDate(schedule.nextDueDate, schedule.frequency);
    schedule.lastMaintenanceDate = new Date();
    schedule.nextDueDate = nextDate;
    await schedule.save();

    res.status(200).json(new ApiResponse(200, schedule, "Maintenance marked as completed"));
});

// ================= SPARE PARTS =================

export const addSparePart = asyncHandler(async (req, res) => {
    const Body = req.body;
    const SparePart = req.getModel("SparePart", sparePartSchema);

    // Check duplicate code
    const existing = await SparePart.findOne({ company: req.company._id, partCode: Body.partCode });
    if (existing) throw new ApiError(400, "Part code already exists");

    const part = await SparePart.create({
        company: req.company._id,
        ...Body
    });

    res.status(201).json(new ApiResponse(201, part, "Spare part added"));
});

export const getSpareParts = asyncHandler(async (req, res) => {
    const SparePart = req.getModel("SparePart", sparePartSchema);
    const parts = await SparePart.find({ company: req.company._id }).sort({ partName: 1 });
    res.status(200).json(new ApiResponse(200, parts, "Spare parts fetched"));
});

export const updateSparePartStock = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { quantity, type } = req.body; // type: 'add' or 'consume'
    const SparePart = req.getModel("SparePart", sparePartSchema);

    const part = await SparePart.findById(id);
    if (!part) throw new ApiError(404, "Part not found");

    if (type === 'add') {
        part.currentStock += Number(quantity);
    } else if (type === 'consume') {
        if (part.currentStock < quantity) throw new ApiError(400, "Insufficient stock");
        part.currentStock -= Number(quantity);
    }

    await part.save();
    res.status(200).json(new ApiResponse(200, part, "Stock updated"));
});

// ================= DASHBOARD STATS =================
export const getMaintenanceStats = asyncHandler(async (req, res) => {
    const BreakdownTicket = req.getModel("BreakdownTicket", breakdownTicketSchema);
    const PreventiveSchedule = req.getModel("PreventiveSchedule", preventiveScheduleSchema);
    const SparePart = req.getModel("SparePart", sparePartSchema);

    const [openTickets, overdueSchedules, lowStockParts] = await Promise.all([
        BreakdownTicket.countDocuments({ company: req.company._id, status: { $in: ['Open', 'Assigned', 'InProgress'] } }),
        PreventiveSchedule.countDocuments({ company: req.company._id, nextDueDate: { $lt: new Date() }, status: 'Active' }),
        SparePart.countDocuments({ company: req.company._id, $expr: { $lte: ["$currentStock", "$minStockLevel"] } })
    ]);

    res.status(200).json(new ApiResponse(200, {
        openTickets,
        overdueSchedules,
        lowStockParts
    }, "Stats fetched"));
});

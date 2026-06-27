import {
    breakdownTicketSchema,
    preventiveScheduleSchema,
    maintenanceHistorySchema,
    sparePartSchema,
} from "../../models/maintenance/index.js";
import { machineSchema } from "../../models/ppc/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";

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

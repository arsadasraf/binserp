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

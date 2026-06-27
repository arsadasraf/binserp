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

export const getPreventiveCalendar = asyncHandler(async (req, res) => {
    const { month, year } = req.query; // Filter by month/year if needed
    const PreventiveSchedule = req.getModel("PreventiveSchedule", preventiveScheduleSchema);

    // Simple fetch for now, can be optimized for calendar range
    const schedules = await PreventiveSchedule.find({ company: req.company._id })
        .populate("machine", "machineName machineCode")
        .sort({ nextDueDate: 1 });

    res.status(200).json(new ApiResponse(200, schedules, "Schedules fetched successfully"));
});

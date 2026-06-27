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

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

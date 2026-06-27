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

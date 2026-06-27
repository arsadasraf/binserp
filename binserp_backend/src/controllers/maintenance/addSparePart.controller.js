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

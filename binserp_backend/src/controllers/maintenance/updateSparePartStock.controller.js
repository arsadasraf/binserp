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

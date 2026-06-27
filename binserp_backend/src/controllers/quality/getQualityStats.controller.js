import { QualityMasterSchema, IncomingQCSchema, ProcessQCSchema } from "../../models/quality/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { updateInventoryStock } from "../store/index.js";
import { grnSchema } from "../../models/store/index.js";
import { componentSchema, jobSchema } from "../../models/ppc/index.js";
import { signPhotos } from "../../utils/s3.js";

// --- Master Management (Standards) ---

export const getQualityStats = asyncHandler(async (req, res) => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const IncomingQC = req.getModel("IncomingQC", IncomingQCSchema);
    const ProcessQC = req.getModel("ProcessQC", ProcessQCSchema);

    const totalIncoming = await IncomingQC.countDocuments({ company: req.company._id });

    // Incoming Rejections (Status = Rejected)
    const incomingsRejected = await IncomingQC.countDocuments({
        company: req.company._id,
        overallStatus: "Rejected"
    });

    // Process Checks Today
    const processChecksToday = await ProcessQC.countDocuments({
        company: req.company._id,
        createdAt: { $gte: startOfDay }
    });

    // Calculate Average Rejection Rate (Process QC)
    // Simplified: (Sum of Rejected / Sum of TotalChecked) * 100
    // Calculate Average Rejection Rate (Process QC)
    // Simplified: (Sum of Rejected / Sum of TotalChecked) * 100
    const rejectionAgg = await ProcessQC.aggregate([
        { $match: { company: req.company._id } },
        {
            $group: {
                _id: null,
                totalChecked: { $sum: "$totalChecked" },
                totalRejected: { $sum: "$rejectedQuantity" }
            }
        }
    ]);

    let processRejectionRate = 0;
    if (rejectionAgg.length > 0 && rejectionAgg[0].totalChecked > 0) {
        processRejectionRate = ((rejectionAgg[0].totalRejected / rejectionAgg[0].totalChecked) * 100).toFixed(2);
    }

    return res.status(200).json(new ApiResponse(200, {
        totalIncomingInspections: totalIncoming,
        incomingRejected: incomingsRejected,
        processChecksToday,
        processRejectionRate
    }, "Quality Stats Fetched"));
});

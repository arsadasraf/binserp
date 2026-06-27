import { QualityMasterSchema, IncomingQCSchema, ProcessQCSchema } from "../../models/quality/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { updateInventoryStock } from "../store/index.js";
import { grnSchema } from "../../models/store/index.js";
import { componentSchema, jobSchema } from "../../models/ppc/index.js";
import { signPhotos } from "../../utils/s3.js";

// --- Master Management (Standards) ---

export const getProcessQC = asyncHandler(async (req, res) => {
    const { jobId } = req.query;
    const query = { company: req.company._id };
    if (jobId) query.jobId = jobId;

    const ProcessQC = req.getModel("ProcessQC", ProcessQCSchema);
    const records = await ProcessQC.find(query)
        .populate("inspector", "username name")
        .sort({ createdAt: -1 });
    return res.status(200).json(new ApiResponse(200, records, "Fetched Process QC Records"));
});


// --- Dashboard Stats ---

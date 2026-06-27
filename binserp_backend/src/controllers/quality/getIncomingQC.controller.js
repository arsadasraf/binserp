import { QualityMasterSchema, IncomingQCSchema, ProcessQCSchema } from "../../models/quality/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { updateInventoryStock } from "../store/index.js";
import { grnSchema } from "../../models/store/index.js";
import { componentSchema, jobSchema } from "../../models/ppc/index.js";
import { signPhotos } from "../../utils/s3.js";

// --- Master Management (Standards) ---

export const getIncomingQC = asyncHandler(async (req, res) => {
    const IncomingQC = req.getModel("IncomingQC", IncomingQCSchema);
    // Ensure GRN model is registered for population
    req.getModel("GRN", grnSchema);

    const records = await IncomingQC.find({ company: req.company._id })
        .populate("inspector", "username name")
        .populate("grnId", "grnNumber") // Populate GRN Number
        .sort({ createdAt: -1 });

    const signedRecords = await Promise.all(records.map(async (record) => {
        const recordObj = record.toObject();
        if (recordObj.photos && recordObj.photos.length > 0) recordObj.photos = await signPhotos(recordObj.photos);
        return recordObj;
    }));

    return res.status(200).json(new ApiResponse(200, signedRecords, "Fetched Incoming QC Records"));
});

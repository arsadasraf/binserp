import { QualityMasterSchema, IncomingQCSchema, ProcessQCSchema } from "../../models/quality/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { updateInventoryStock } from "../store/index.js";
import { grnSchema } from "../../models/store/index.js";
import { componentSchema, jobSchema } from "../../models/ppc/index.js";
import { signPhotos } from "../../utils/s3.js";

// --- Master Management (Standards) ---

export const updateIncomingQC = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const IncomingQC = req.getModel("IncomingQC", IncomingQCSchema);
    const record = await IncomingQC.findOneAndUpdate(
        { _id: id, company: req.company._id },
        req.body,
        { new: true }
    );
    if (!record) throw new ApiError(404, "Record not found");
    return res.status(200).json(new ApiResponse(200, record, "Updated Incoming QC Record"));
});

// --- Process QC ---

import { QualityMasterSchema, IncomingQCSchema, ProcessQCSchema } from "../../models/quality/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { updateInventoryStock } from "../store/index.js";
import { grnSchema } from "../../models/store/index.js";
import { componentSchema, jobSchema } from "../../models/ppc/index.js";
import { signPhotos } from "../../utils/s3.js";

// --- Master Management (Standards) ---

export const updateQualityMaster = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const QualityMaster = req.getModel("QualityMaster", QualityMasterSchema);
    const master = await QualityMaster.findOneAndUpdate(
        { _id: id, company: req.company._id },
        req.body,
        { new: true }
    );
    if (!master) throw new ApiError(404, "Quality Standard not found");
    return res.status(200).json(new ApiResponse(200, master, "Updated successfully"));
});

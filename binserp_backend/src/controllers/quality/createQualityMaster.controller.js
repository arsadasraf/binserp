import { QualityMasterSchema, IncomingQCSchema, ProcessQCSchema } from "../../models/quality/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { updateInventoryStock } from "../store/index.js";
import { grnSchema } from "../../models/store/index.js";
import { componentSchema, jobSchema } from "../../models/ppc/index.js";
import { signPhotos } from "../../utils/s3.js";

// --- Master Management (Standards) ---

export const createQualityMaster = asyncHandler(async (req, res) => {
    const { name, type, parameters, description } = req.body;

    if (!name || !type) {
        throw new ApiError(400, "Name and Type are required");
    }

    const QualityMaster = req.getModel("QualityMaster", QualityMasterSchema);
    const master = await QualityMaster.create({
        company: req.company._id,
        name,
        type,
        parameters,
        description,
        createdBy: req.user._id
    });

    return res.status(201).json(new ApiResponse(201, master, "Quality Standard created successfully"));
});

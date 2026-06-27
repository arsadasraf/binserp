import { QualityMasterSchema, IncomingQCSchema, ProcessQCSchema } from "../../models/quality/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { updateInventoryStock } from "../store/index.js";
import { grnSchema } from "../../models/store/index.js";
import { componentSchema, jobSchema } from "../../models/ppc/index.js";
import { signPhotos } from "../../utils/s3.js";

// --- Master Management (Standards) ---

export const createProcessQC = asyncHandler(async (req, res) => {
    const { jobId, processId, processName, totalChecked, okQuantity, rejectedQuantity, status } = req.body;

    if (!jobId || !processId) { // processId (stepId) is now required
        throw new ApiError(400, "Job ID and Process ID are required");
    }

    const ProcessQC = req.getModel("ProcessQC", ProcessQCSchema);
    const Job = req.getModel("Job", jobSchema);

    // 1. Create QC Record
    const processRecord = await ProcessQC.create({
        company: req.company._id,
        ...req.body,
        inspector: req.user._id
    });

    // 2. Update Job Step Status
    const job = await Job.findOne({ _id: jobId, company: req.company._id });
    if (job) {
        const step = job.processHistory.id(processId);
        if (step) {
            // Determine Outcome
            // If explicit status 'Rejected' or mostly rejected?
            // Usually user decides passed/failed in UI.

            if (status === 'Accepted' || (okQuantity >= totalChecked && totalChecked > 0)) {
                step.status = 'Completed';
                // Auto-Activate Next Step logic (Simplified from PPC Controller)
                const nextStep = job.processHistory.find(s => s.sequence === step.sequence + 1);
                // if (nextStep) nextStep.status = 'Pending'; // (It's already pending)

                // Check if all done
                const allDone = job.processHistory.every(s => s.status === 'Completed');
                if (allDone) job.status = 'Completed';

            } else {
                step.status = 'Rejected'; // Or 'Rework'
            }
            await job.save();
        }
    }

    return res.status(201).json(new ApiResponse(201, processRecord, "Process QC Record Created & Job Updated"));
});

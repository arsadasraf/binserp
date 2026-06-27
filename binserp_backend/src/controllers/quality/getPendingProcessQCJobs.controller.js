import { QualityMasterSchema, IncomingQCSchema, ProcessQCSchema } from "../../models/quality/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { updateInventoryStock } from "../store/index.js";
import { grnSchema } from "../../models/store/index.js";
import { componentSchema, jobSchema } from "../../models/ppc/index.js";
import { signPhotos } from "../../utils/s3.js";

// --- Master Management (Standards) ---

export const getPendingProcessQCJobs = asyncHandler(async (req, res) => {
    const Job = req.getModel('Job', jobSchema);
    // Find jobs where at least one step is 'QC_Pending'
    const jobs = await Job.find({
        company: req.company._id,
        "processHistory.status": "QC_Pending"
    }).select("jobNumber partName processHistory");

    // Flatten to list of steps
    const pendingSteps = [];
    jobs.forEach(job => {
        job.processHistory.forEach(step => {
            if (step.status === 'QC_Pending') {
                pendingSteps.push({
                    jobId: job._id,
                    jobNumber: job.jobNumber,
                    partName: job.partName,
                    processId: step._id,
                    processName: step.operationName || step.processName,
                    team: step.assignedTeam, // In case we need to know who did it
                    qcRequired: step.qcRequired
                });
            }
        });
    });

    return res.status(200).json(new ApiResponse(200, pendingSteps, "Fetched Pending QC Jobs"));
});

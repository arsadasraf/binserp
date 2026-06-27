import { QualityMasterSchema, IncomingQCSchema, ProcessQCSchema } from "../models/quality/index.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { updateInventoryStock } from "./store/index.js";
import { grnSchema } from "../models/store/index.js";
import { componentSchema, jobSchema } from "../models/ppc/index.js";
import { signPhotos } from "../utils/s3.js";

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

export const getQualityMasters = asyncHandler(async (req, res) => {
    const { type } = req.query;
    const query = { company: req.company._id };
    if (type) query.type = type;

    const QualityMaster = req.getModel("QualityMaster", QualityMasterSchema);
    const masters = await QualityMaster.find(query).sort({ createdAt: -1 });
    return res.status(200).json(new ApiResponse(200, masters, "Fetched Quality Standards"));
});

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

export const deleteQualityMaster = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const QualityMaster = req.getModel("QualityMaster", QualityMasterSchema);
    await QualityMaster.findOneAndDelete({ _id: id, company: req.company._id });
    return res.status(200).json(new ApiResponse(200, null, "Deleted successfully"));
});

// --- Incoming QC ---

export const createIncomingQC = asyncHandler(async (req, res) => {
    console.log("DEBUG: createIncomingQC called");
    console.log("DEBUG: req.user:", req.user ? "Present" : "Missing", req.user);
    console.log("DEBUG: req.company:", req.company ? "Present" : "Missing", req.company);

    // Explicitly validate availability
    if (!req.company?._id && !req.user?.company) {
        console.error("DEBUG: No Company ID found!");
        throw new ApiError(400, "Company ID is missing from request context");
    }

    const companyId = req.company?._id || req.user?.company;

    const {
        materialName, receivedQuantity, inspectedQuantity,
        acceptedQuantity, rejectedQuantity, overallStatus
    } = req.body;

    if (!materialName || receivedQuantity === undefined) {
        throw new ApiError(400, "Material Name and Received Quantity are required");
    }

    const IncomingQC = req.getModel("IncomingQC", IncomingQCSchema);

    let incoming;
    try {
        incoming = await IncomingQC.create({
            company: companyId,
            ...req.body,
            inspector: req.user?._id
        });
    } catch (err) {
        console.error("DEBUG: IncomingQC.create failed:", err);
        throw err;
    }

    // --- GRN & Stock Update Logic ---
    if (req.body.grnId && req.body.grnItemId) {
        const GRN = req.getModel('GRN', grnSchema);
        const grn = await GRN.findById(req.body.grnId);

        if (grn) {
            // Find the item in GRN items array
            const itemIndex = grn.items.findIndex(item => item._id.toString() === req.body.grnItemId);

            if (itemIndex > -1) {
                // Update Item Quantities
                grn.items[itemIndex].acceptedQuantity = (grn.items[itemIndex].acceptedQuantity || 0) + (acceptedQuantity || 0);
                grn.items[itemIndex].rejectedQuantity = (grn.items[itemIndex].rejectedQuantity || 0) + (rejectedQuantity || 0);

                // Auto-update GRN QC Status
                const allInspected = grn.items.every(item => {
                    const totalProcessed = (item.acceptedQuantity || 0) + (item.rejectedQuantity || 0);
                    // Check if processed matches received/ordered quantity
                    const targetQty = item.receivedQuantity || item.quantity || 0;
                    return totalProcessed >= targetQty;
                });

                const anyInspected = grn.items.some(item => (item.acceptedQuantity || 0) + (item.rejectedQuantity || 0) > 0);

                if (allInspected) {
                    grn.qcStatus = "Completed";
                } else if (anyInspected) {
                    grn.qcStatus = "Partial";
                }

                // Save GRN updates first
                await grn.save();

                // Update Stock (Only Accepted Qty)
                // Update Stock
                if (grn.type === 'inhouse') {
                    // Inhouse -> Component Stock (Only update accepted)
                    if (acceptedQuantity > 0) {
                        const compId = req.body.componentId || grn.items[itemIndex].component || grn.items[itemIndex].material;
                        const Component = req.getModel("Component", componentSchema);
                        await Component.findByIdAndUpdate(compId, { $inc: { quantity: acceptedQuantity } });
                    }
                } else {
                    // BO -> Inventory Stock (Handle Pending & Accepted)
                    const matId = req.body.materialId || grn.items[itemIndex].material;
                    await updateInventoryStock(
                        req,
                        matId,
                        acceptedQuantity || 0,
                        grn.items[itemIndex].unit || "PCS",
                        grn.items[itemIndex].locationId,
                        {
                            isQCRelease: true,
                            inspectedQuantity: inspectedQuantity || 0
                        }
                    );
                }
            }
        }
    }

    return res.status(201).json(new ApiResponse(201, incoming, "Incoming QC Record Created"));
});

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

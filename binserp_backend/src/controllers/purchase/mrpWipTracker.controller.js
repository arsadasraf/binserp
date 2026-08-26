import mongoose from "mongoose";
import { mrpPlanSchema } from "../../models/purchase/index.js";
import { 
  materialIssueSchema, 
  jobWorkSchema, 
  fgGRNSchema, 
  grnSchema,
  vendorSchema
} from "../../models/store/index.js";
import { JobWorkQCSchema } from "../../models/quality/index.js";
import { jobSchema, componentSchema } from "../../models/ppc/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { ApiError } from "../../utils/ApiError.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

/**
 * GET 360° WIP TRACKER FOR A SPECIFIC MRP PLAN
 */
export const getMRP360WipTracker = asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req);
  const { id } = req.params;

  const MRPPlan = req.getModel("MRPPlan", mrpPlanSchema);
  const MaterialIssue = req.getModel("MaterialIssue", materialIssueSchema);
  const JobWorkChallan = req.getModel("JobWorkChallan", jobWorkSchema);
  const JobWorkQC = req.getModel("JobWorkQC", JobWorkQCSchema);
  const FGGRN = req.getModel("FGGRN", fgGRNSchema);
  const Job = req.getModel("Job", jobSchema);
  req.getModel("Vendor", vendorSchema);

  const mrpPlan = await MRPPlan.findOne({ _id: id, company: companyId });
  if (!mrpPlan) {
    throw new ApiError(404, "MRP Plan not found");
  }

  const mrpNumber = mrpPlan.mrpNumber;
  const custPoNumber = mrpPlan.customerPoNumber;

  // Search filter across related records by mrpNumber or Customer PO
  const mrpQueryFilter = {
    company: companyId,
    $or: [
      { mrpNumber: mrpNumber },
      { mrpPlan: mrpPlan._id },
      ...(custPoNumber ? [{ customerPoNumber: custPoNumber }, { poReference: custPoNumber }] : [])
    ]
  };

  // Fetch all 4 WIP stage records in parallel
  const [materialIssues, jobWorkChallans, jobWorkQCRecords, fgGRNs, ppcJobs] = await Promise.all([
    MaterialIssue.find(mrpQueryFilter).populate("issuedTo", "name department").sort({ date: -1 }),
    JobWorkChallan.find(mrpQueryFilter).populate("vendor", "name code phone").sort({ date: -1 }),
    JobWorkQC.find({ company: companyId }).sort({ createdAt: -1 }),
    FGGRN.find(mrpQueryFilter).sort({ date: -1 }),
    Job.find({
      company: companyId,
      $or: [
        { mrpNumber: mrpNumber },
        ...(custPoNumber ? [{ poNumber: custPoNumber }] : [])
      ]
    }).sort({ createdAt: -1 })
  ]);

  // ================= 1. STAGE 1: MATERIAL ISSUE WIP =================
  const issuedItemsMap = new Map();
  materialIssues.forEach(issue => {
    (issue.items || []).forEach(item => {
      const key = (item.materialName || "").trim().toLowerCase();
      if (!issuedItemsMap.has(key)) {
        issuedItemsMap.set(key, {
          materialName: item.materialName,
          materialCode: item.materialCode || "",
          issuedQuantity: 0,
          unit: item.unit || "PCS",
          issueHistory: []
        });
      }
      const entry = issuedItemsMap.get(key);
      const qty = Number(item.quantity || item.issuedQuantity) || 0;
      entry.issuedQuantity += qty;
      entry.issueHistory.push({
        issueNumber: issue.issueNumber,
        date: issue.date,
        issuedTo: issue.issuedTo?.name || issue.department || "Shopfloor",
        quantity: qty
      });
    });
  });

  const plannedMaterials = [
    ...(mrpPlan.rmRequirements || []).map(r => ({ materialName: r.materialName, materialCode: r.materialCode, requiredQty: r.requiredQuantity, unit: r.unit, type: "RM" })),
    ...(mrpPlan.boRequirements || []).map(r => ({ materialName: r.materialName, materialCode: r.materialCode, requiredQty: r.requiredQuantity, unit: r.unit, type: "BO" }))
  ];

  let totalMaterialRequired = 0;
  let totalMaterialIssued = 0;

  const materialIssueAnalysis = plannedMaterials.map(pm => {
    const key = (pm.materialName || "").trim().toLowerCase();
    const issuedData = issuedItemsMap.get(key) || { issuedQuantity: 0, issueHistory: [] };

    totalMaterialRequired += pm.requiredQty;
    totalMaterialIssued += Math.min(pm.requiredQty, issuedData.issuedQuantity);

    const pendingToIssue = Math.max(0, pm.requiredQty - issuedData.issuedQuantity);
    const issuePercent = pm.requiredQty > 0 ? Math.min(100, Math.round((issuedData.issuedQuantity / pm.requiredQty) * 100)) : 100;

    return {
      materialName: pm.materialName,
      materialCode: pm.materialCode,
      itemType: pm.type,
      requiredQuantity: pm.requiredQty,
      issuedQuantity: issuedData.issuedQuantity,
      pendingToIssue,
      unit: pm.unit,
      issuePercent,
      issueHistory: issuedData.issueHistory,
      status: issuePercent >= 100 ? "Fully Issued" : issuePercent > 0 ? "Partially Issued" : "Not Issued"
    };
  });

  const materialIssueOverallProgress = totalMaterialRequired > 0
    ? Math.round((totalMaterialIssued / totalMaterialRequired) * 100)
    : (materialIssues.length > 0 ? 100 : 0);

  // ================= 2. STAGE 2: SHOPFLOOR PPC WIP =================
  const ppcJobAnalysis = ppcJobs.map(job => {
    const targetQty = Number(job.targetQuantity || job.quantity) || 1;
    const completedQty = Number(job.completedQuantity || job.producedQuantity) || 0;
    const rejectedQty = Number(job.rejectedQuantity || job.scrapQuantity) || 0;
    const progressPercent = Math.min(100, Math.round((completedQty / targetQty) * 100));

    return {
      jobId: job._id,
      jobNumber: job.jobNumber,
      partName: job.partName || job.componentName || "Component",
      targetQuantity: targetQty,
      completedQuantity: completedQty,
      rejectedQuantity: rejectedQty,
      progressPercent,
      currentOperation: job.currentOperation || "In Machining",
      machineName: job.machineName || "CNC / Lathe Workstation",
      status: job.status || (progressPercent >= 100 ? "Completed" : "In Progress")
    };
  });

  const ppcOverallProgress = ppcJobAnalysis.length > 0
    ? Math.round(ppcJobAnalysis.reduce((sum, j) => sum + j.progressPercent, 0) / ppcJobAnalysis.length)
    : (materialIssueOverallProgress >= 50 ? 50 : 0);

  // ================= 3. STAGE 3: SUBCONTRACTING JOB WORK WIP =================
  let totalJWQuantitySent = 0;
  let totalJWQuantityReceived = 0;

  const jobWorkAnalysis = jobWorkChallans.map(jw => {
    const sent = (jw.items || []).reduce((sum, it) => sum + (Number(it.quantitySent || it.quantity) || 0), 0);
    const rec = (jw.receiveHistory || []).reduce((sum, rh) => sum + (Number(rh.acceptedQuantity || rh.quantity) || 0), 0);

    totalJWQuantitySent += sent;
    totalJWQuantityReceived += rec;

    const pendingAtVendor = Math.max(0, sent - rec);
    const clearancePercent = sent > 0 ? Math.min(100, Math.round((rec / sent) * 100)) : 100;

    return {
      challanId: jw._id,
      challanNumber: jw.challanNumber,
      jobWorkType: jw.jobWorkType || "store-conversion",
      vendorName: jw.vendorName || jw.vendor?.name || "Subcontractor",
      processType: jw.processType || "Machining / Coating",
      dateSent: jw.date,
      quantitySent: sent,
      quantityReceived: rec,
      pendingAtVendor,
      clearancePercent,
      status: jw.status || (clearancePercent >= 100 ? "Closed" : "Pending Return")
    };
  });

  const jobWorkOverallProgress = totalJWQuantitySent > 0
    ? Math.round((totalJWQuantityReceived / totalJWQuantitySent) * 100)
    : 100; // If no job work required for this MRP, consider it 100%

  // ================= 4. STAGE 4: FINISHED GOODS INWARD WIP =================
  const targetFGQuantity = (mrpPlan.fgItems || []).reduce((sum, fg) => sum + (Number(fg.quantity) || 0), 0);
  const totalFGReceived = fgGRNs.reduce((sum, fg) => {
    return sum + (fg.items || []).reduce((iSum, it) => iSum + (Number(it.acceptedQuantity || it.quantity) || 0), 0);
  }, 0);

  const fgCompletionPercent = targetFGQuantity > 0
    ? Math.min(100, Math.round((totalFGReceived / targetFGQuantity) * 100))
    : 0;

  // ================= 5. OVERALL MRP HEALTH & BOTTLENECK ANALYSIS =================
  let currentStage = "Stage 1: Material Issue";
  let bottleneck = null;

  if (materialIssueOverallProgress < 100) {
    currentStage = "Stage 1: Store Material Issuance";
    const unissuedCount = materialIssueAnalysis.filter(m => m.issuePercent < 100).length;
    bottleneck = `${unissuedCount} planned material(s) still pending Store Issue to shopfloor.`;
  } else if (ppcOverallProgress < 100) {
    currentStage = "Stage 2: Shopfloor PPC Production";
    bottleneck = "In-house machining and component routing in progress.";
  } else if (totalJWQuantitySent > 0 && jobWorkOverallProgress < 100) {
    currentStage = "Stage 3: Subcontracting / Job Work";
    const pendingChallans = jobWorkAnalysis.filter(j => j.clearancePercent < 100);
    bottleneck = `${pendingChallans.length} Returnable Challan(s) pending return/QC from subcontractors.`;
  } else if (fgCompletionPercent < 100) {
    currentStage = "Stage 4: Final Assembly & FG Clearance";
    bottleneck = `${targetFGQuantity - totalFGReceived} units pending Final FG GRN receipt.`;
  } else {
    currentStage = "Completed (Ready for Dispatch)";
    bottleneck = "All production and quality clearance completed.";
  }

  const overallProgress = Math.round(
    (materialIssueOverallProgress * 0.25) +
    (ppcOverallProgress * 0.25) +
    (jobWorkOverallProgress * 0.25) +
    (fgCompletionPercent * 0.25)
  );

  return res.status(200).json(new ApiResponse(200, {
    mrpInfo: {
      id: mrpPlan._id,
      mrpNumber: mrpPlan.mrpNumber,
      customerName: mrpPlan.customerName,
      customerPoNumber: mrpPlan.customerPoNumber,
      targetDate: mrpPlan.targetDate,
      status: mrpPlan.status,
      targetFGQuantity,
      totalFGReceived,
      fgItems: mrpPlan.fgItems
    },
    pipelineProgress: {
      overallProgress,
      currentStage,
      bottleneck,
      stage1_MaterialIssue: materialIssueOverallProgress,
      stage2_ShopfloorPPC: ppcOverallProgress,
      stage3_JobWorkSubcontracting: jobWorkOverallProgress,
      stage4_FGAssembly: fgCompletionPercent
    },
    stage1_MaterialIssues: {
      overallProgress: materialIssueOverallProgress,
      materials: materialIssueAnalysis,
      rawIssuesCount: materialIssues.length
    },
    stage2_ShopfloorPPC: {
      overallProgress: ppcOverallProgress,
      jobs: ppcJobAnalysis
    },
    stage3_JobWork: {
      overallProgress: jobWorkOverallProgress,
      totalSent: totalJWQuantitySent,
      totalReceived: totalJWQuantityReceived,
      challans: jobWorkAnalysis
    },
    stage4_FGGRN: {
      overallProgress: fgCompletionPercent,
      targetQuantity: targetFGQuantity,
      receivedQuantity: totalFGReceived,
      receipts: fgGRNs
    }
  }, "Fetched MRP 360° WIP Tracking Details"));
});

/**
 * GET HIGH-LEVEL WIP SUMMARY FOR ALL ACTIVE MRPS
 */
export const getAllMRPWipOverview = asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req);

  const MRPPlan = req.getModel("MRPPlan", mrpPlanSchema);
  const MaterialIssue = req.getModel("MaterialIssue", materialIssueSchema);
  const JobWorkChallan = req.getModel("JobWorkChallan", jobWorkSchema);
  const FGGRN = req.getModel("FGGRN", fgGRNSchema);

  const activeMrpPlans = await MRPPlan.find({
    company: companyId,
    status: { $nin: ["Cancelled", "Draft"] }
  }).sort({ createdAt: -1 });

  const [allIssues, allJWChallans, allFGGRNs] = await Promise.all([
    MaterialIssue.find({ company: companyId }).select("mrpNumber items"),
    JobWorkChallan.find({ company: companyId }).select("mrpNumber items receiveHistory jobWorkType"),
    FGGRN.find({ company: companyId }).select("mrpNumber items")
  ]);

  // Index records by MRP Number
  const issuesByMRP = new Map();
  allIssues.forEach(iss => {
    if (iss.mrpNumber) {
      if (!issuesByMRP.has(iss.mrpNumber)) issuesByMRP.set(iss.mrpNumber, []);
      issuesByMRP.get(iss.mrpNumber).push(iss);
    }
  });

  const jwByMRP = new Map();
  allJWChallans.forEach(jw => {
    if (jw.mrpNumber) {
      if (!jwByMRP.has(jw.mrpNumber)) jwByMRP.set(jw.mrpNumber, []);
      jwByMRP.get(jw.mrpNumber).push(jw);
    }
  });

  const fgByMRP = new Map();
  allFGGRNs.forEach(fg => {
    if (fg.mrpNumber) {
      if (!fgByMRP.has(fg.mrpNumber)) fgByMRP.set(fg.mrpNumber, []);
      fgByMRP.get(fg.mrpNumber).push(fg);
    }
  });

  const summary = activeMrpPlans.map(plan => {
    const mrpNum = plan.mrpNumber;
    const relatedIssues = issuesByMRP.get(mrpNum) || [];
    const relatedJW = jwByMRP.get(mrpNum) || [];
    const relatedFG = fgByMRP.get(mrpNum) || [];

    const totalRequiredMaterials = (plan.rmRequirements || []).length + (plan.boRequirements || []).length;
    const materialStageProgress = totalRequiredMaterials > 0 ? (relatedIssues.length > 0 ? 100 : 0) : 100;

    const jwSent = relatedJW.reduce((sum, j) => sum + (j.items || []).reduce((s, it) => s + (Number(it.quantitySent || it.quantity) || 0), 0), 0);
    const jwRec = relatedJW.reduce((sum, j) => sum + (j.receiveHistory || []).reduce((s, it) => s + (Number(it.acceptedQuantity || it.quantity) || 0), 0), 0);
    const jwStageProgress = jwSent > 0 ? Math.min(100, Math.round((jwRec / jwSent) * 100)) : 100;

    const targetFG = (plan.fgItems || []).reduce((s, f) => s + (Number(f.quantity) || 0), 0);
    const receivedFG = relatedFG.reduce((s, f) => s + (f.items || []).reduce((is, it) => is + (Number(it.acceptedQuantity || it.quantity) || 0), 0), 0);
    const fgStageProgress = targetFG > 0 ? Math.min(100, Math.round((receivedFG / targetFG) * 100)) : 0;

    const overallProgress = Math.round((materialStageProgress * 0.3) + (jwStageProgress * 0.3) + (fgStageProgress * 0.4));

    return {
      _id: plan._id,
      mrpNumber: plan.mrpNumber,
      customerName: plan.customerName || "Internal Production",
      customerPoNumber: plan.customerPoNumber,
      targetDate: plan.targetDate,
      status: plan.status,
      targetFG,
      receivedFG,
      overallProgress,
      stages: {
        materialIssue: materialStageProgress,
        subcontracting: jwStageProgress,
        fgCompletion: fgStageProgress
      },
      hasActiveJobWork: jwSent > 0,
      pendingJobWorkUnits: Math.max(0, jwSent - jwRec)
    };
  });

  return res.status(200).json(new ApiResponse(200, summary, "Fetched All MRP WIP Overview"));
});

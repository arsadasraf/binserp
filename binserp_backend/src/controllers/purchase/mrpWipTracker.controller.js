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
 * Streamlined 2-Stage Pipeline:
 * Stage 1: Store Material Issue (Direct Store Issue + Returnable DCs from Store)
 * Stage 2: FG GRN Inward & Clearance (Planned FG + Unplanned Returns + Receipts Log)
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

  const mrpPlan = await MRPPlan.findOne({ _id: id, company: companyId })
    .populate("fgItems.fgItem", "name code unit description specification")
    .populate("rmRequirements.material", "name code unit category descriptions description specification")
    .populate("boRequirements.material", "name code unit category descriptions description specification");

  if (!mrpPlan) {
    throw new ApiError(404, "MRP Plan not found");
  }

  const mrpNumber = mrpPlan.mrpNumber;
  const custPoNumber = mrpPlan.customerPoNumber;
  const mrpPlanIdStr = mrpPlan._id.toString();

  // Search filter across related records by mrpNumber, mrpPlan ObjectId, or Customer PO
  const mrpQueryFilter = {
    company: companyId,
    $or: [
      { mrpNumber: mrpNumber },
      { mrpNumber: { $regex: new RegExp(`^${mrpNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
      { mrpPlan: mrpPlan._id },
      { mrpPlan: mrpPlanIdStr },
      ...(custPoNumber ? [{ customerPoNumber: custPoNumber }, { poReference: custPoNumber }] : [])
    ]
  };

  // Fetch all related store issue, returnable DC, and FG GRN records
  const [materialIssues, jobWorkChallans, fgGRNs] = await Promise.all([
    MaterialIssue.find(mrpQueryFilter)
      .populate("issuedTo", "name department")
      .populate("items.material", "name code unit descriptions description specification")
      .populate("items.consumable", "name code unit descriptions description specification")
      .sort({ date: -1 }),
    JobWorkChallan.find(mrpQueryFilter)
      .populate("vendor", "name code phone")
      .sort({ date: -1 }),
    FGGRN.find(mrpQueryFilter)
      .populate("receivedBy", "name")
      .populate("items.fgItem", "name code unit description specification")
      .sort({ date: -1 })
  ]);

  // =========================================================================
  // 1. STAGE 1: MATERIAL ISSUE FROM STORE (Direct Issue + Returnable DC)
  // =========================================================================
  const issuedItemsMap = new Map();

  const registerIssuedItem = ({
    materialName,
    materialCode = "",
    description = "",
    unit = "PCS",
    quantity = 0,
    sourceType, // 'Store Material Issue' | 'Returnable DC'
    docNumber,
    date,
    recipient
  }) => {
    const cleanName = (materialName || "").trim();
    if (!cleanName || quantity <= 0) return;
    const key = cleanName.toLowerCase();

    if (!issuedItemsMap.has(key)) {
      issuedItemsMap.set(key, {
        materialName: cleanName,
        materialCode,
        description,
        unit: unit || "PCS",
        directIssueQuantity: 0,
        returnableDcQuantity: 0,
        totalIssuedQuantity: 0,
        issueHistory: []
      });
    }

    const entry = issuedItemsMap.get(key);
    if (!entry.description && description) {
      entry.description = description;
    }
    if (!entry.materialCode && materialCode) {
      entry.materialCode = materialCode;
    }

    if (sourceType === 'Store Material Issue') {
      entry.directIssueQuantity += quantity;
    } else {
      entry.returnableDcQuantity += quantity;
    }
    entry.totalIssuedQuantity += quantity;

    entry.issueHistory.push({
      sourceType,
      docNumber,
      date,
      quantity,
      recipient: recipient || "Shopfloor",
      unit: unit || entry.unit
    });
  };

  // A. Ingest Direct Material Issues from Store
  materialIssues.forEach(issue => {
    (issue.items || []).forEach(item => {
      const matName = item.material?.name || item.consumable?.name || item.materialName;
      const matDesc = item.material?.descriptions || item.material?.description || item.consumable?.descriptions || item.description || "";
      const matCode = item.material?.code || item.materialCode || "";
      const qty = Number(item.quantity || item.issuedQuantity) || 0;

      registerIssuedItem({
        materialName: matName,
        materialCode: matCode,
        description: matDesc,
        unit: item.unit || "PCS",
        quantity: qty,
        sourceType: 'Store Material Issue',
        docNumber: issue.issueNumber,
        date: issue.date,
        recipient: issue.issuedTo?.name || issue.department || "Shopfloor"
      });
    });
  });

  // B. Ingest Returnable Delivery Challans (Job Work Challans) issued directly from Store
  jobWorkChallans.forEach(jw => {
    const docNo = jw.challanNumber;
    const date = jw.date;
    const vendorName = jw.vendor?.name || jw.vendorName || "Subcontractor Vendor";

    const processJwItem = (it) => {
      const itemName = it.itemName || it.materialName;
      const itemDesc = it.description || "";
      const qty = Number(it.quantitySent || it.quantity) || 0;

      registerIssuedItem({
        materialName: itemName,
        materialCode: it.itemCode || "",
        description: itemDesc,
        unit: it.unit || "PCS",
        quantity: qty,
        sourceType: 'Returnable DC',
        docNumber: docNo,
        date: date,
        recipient: vendorName
      });
    };

    (jw.items || []).forEach(processJwItem);
    (jw.assemblyGroups || []).forEach(grp => (grp.items || []).forEach(processJwItem));
  });

  // C. Planned Materials from BOM (RM & BO Requirements)
  const plannedMaterialsMap = new Map();
  const plannedMaterialsList = [
    ...(mrpPlan.rmRequirements || []).map(r => ({
      materialName: r.material?.name || r.materialName,
      materialCode: r.material?.code || r.materialCode || "",
      description: r.material?.descriptions || r.material?.description || r.description || "",
      requiredQty: Number(r.requiredQuantity) || 0,
      unit: r.unit || r.material?.unit || "PCS",
      type: "Raw Material"
    })),
    ...(mrpPlan.boRequirements || []).map(b => ({
      materialName: b.material?.name || b.materialName,
      materialCode: b.material?.code || b.materialCode || "",
      description: b.material?.descriptions || b.material?.description || b.description || "",
      requiredQty: Number(b.requiredQuantity) || 0,
      unit: b.unit || b.material?.unit || "PCS",
      type: "Bought Out"
    }))
  ];

  let totalMaterialRequired = 0;
  let totalMaterialIssuedCapped = 0;
  let totalMaterialIssuedActual = 0;
  let totalOverIssuedQuantity = 0;

  // Process BOM Planned Materials
  const plannedMaterialsAnalysis = plannedMaterialsList.map(pm => {
    const key = (pm.materialName || "").trim().toLowerCase();
    plannedMaterialsMap.set(key, true);

    const issuedData = issuedItemsMap.get(key) || {
      directIssueQuantity: 0,
      returnableDcQuantity: 0,
      totalIssuedQuantity: 0,
      issueHistory: []
    };

    const issuedQty = issuedData.totalIssuedQuantity;
    totalMaterialRequired += pm.requiredQty;
    totalMaterialIssuedActual += issuedQty;
    totalMaterialIssuedCapped += Math.min(pm.requiredQty, issuedQty);

    const pendingToIssue = Math.max(0, pm.requiredQty - issuedQty);
    const isOverIssued = issuedQty > pm.requiredQty;
    const excessQuantity = isOverIssued ? issuedQty - pm.requiredQty : 0;
    if (isOverIssued) {
      totalOverIssuedQuantity += excessQuantity;
    }

    const issuePercent = pm.requiredQty > 0
      ? Math.round((issuedQty / pm.requiredQty) * 100)
      : (issuedQty > 0 ? 100 : 0);

    return {
      materialName: pm.materialName,
      materialCode: pm.materialCode,
      description: pm.description || issuedData.description || "",
      itemType: pm.type,
      requiredQuantity: pm.requiredQty,
      issuedQuantity: issuedQty,
      directIssueQuantity: issuedData.directIssueQuantity,
      returnableDcQuantity: issuedData.returnableDcQuantity,
      pendingToIssue,
      isOverIssued,
      excessQuantity,
      overIssuePercent: pm.requiredQty > 0 && isOverIssued ? Math.round((excessQuantity / pm.requiredQty) * 100) : 0,
      unit: pm.unit,
      issuePercent,
      issueHistory: issuedData.issueHistory,
      isNonBOM: false,
      status: isOverIssued
        ? `Over-Issued (+${excessQuantity} ${pm.unit})`
        : issuePercent >= 100
        ? "Fully Issued"
        : issuePercent > 0
        ? `Partially Issued (${issuePercent}%)`
        : "Not Issued"
    };
  });

  // D. Non-BOM Materials (Items issued for this MRP that were NOT in the BOM)
  const nonBomMaterialsAnalysis = [];
  issuedItemsMap.forEach((entry, key) => {
    if (!plannedMaterialsMap.has(key)) {
      totalMaterialIssuedActual += entry.totalIssuedQuantity;
      totalOverIssuedQuantity += entry.totalIssuedQuantity;

      nonBomMaterialsAnalysis.push({
        materialName: entry.materialName,
        materialCode: entry.materialCode,
        description: entry.description,
        itemType: "Non-BOM / Extra Store Issue",
        requiredQuantity: 0,
        issuedQuantity: entry.totalIssuedQuantity,
        directIssueQuantity: entry.directIssueQuantity,
        returnableDcQuantity: entry.returnableDcQuantity,
        pendingToIssue: 0,
        isOverIssued: true,
        excessQuantity: entry.totalIssuedQuantity,
        overIssuePercent: 100,
        unit: entry.unit,
        issuePercent: 100,
        issueHistory: entry.issueHistory,
        isNonBOM: true,
        status: `Non-BOM Extra (+${entry.totalIssuedQuantity} ${entry.unit})`
      });
    }
  });

  const materialIssueOverallProgress = totalMaterialRequired > 0
    ? Math.min(100, Math.round((totalMaterialIssuedCapped / totalMaterialRequired) * 100))
    : (materialIssues.length > 0 || jobWorkChallans.length > 0 ? 100 : 0);

  // =========================================================================
  // 2. STAGE 2: FG GRN INWARD & RETURN WITH THIS MRP
  // =========================================================================
  const fgReceivedMap = new Map();

  fgGRNs.forEach(grn => {
    (grn.items || []).forEach(it => {
      const itemName = it.fgItem?.name || it.itemName;
      const cleanName = (itemName || "").trim();
      if (!cleanName) return;
      const key = cleanName.toLowerCase();

      const acceptedQty = Number(it.acceptedQuantity != null ? it.acceptedQuantity : (it.quantity || it.receivedQuantity)) || 0;
      const rejectedQty = Number(it.rejectedQuantity || 0);

      if (!fgReceivedMap.has(key)) {
        fgReceivedMap.set(key, {
          itemName: cleanName,
          itemCode: it.fgItem?.code || "",
          description: it.fgItem?.description || it.description || "",
          unit: it.unit || it.fgItem?.unit || "Nos",
          receivedQuantity: 0,
          rejectedQuantity: 0,
          receiptHistory: []
        });
      }

      const entry = fgReceivedMap.get(key);
      entry.receivedQuantity += acceptedQty;
      entry.rejectedQuantity += rejectedQty;
      entry.receiptHistory.push({
        grnNumber: grn.grnNumber,
        date: grn.date,
        receivedBy: grn.receivedBy?.name || "Store Executive",
        acceptedQuantity: acceptedQty,
        rejectedQuantity: rejectedQty,
        qcStatus: grn.qcStatus || "Completed",
        remarks: grn.remarks || ""
      });
    });
  });

  const plannedFgMap = new Map();
  let targetFGQuantity = 0;
  let totalFGReceived = 0;
  let totalFGSurplusQuantity = 0;

  // Process Planned Finished Goods
  const plannedFGAnalysis = (mrpPlan.fgItems || []).map(fg => {
    const itemName = fg.fgItem?.name || fg.fgItemName || "FG Item";
    const key = itemName.trim().toLowerCase();
    plannedFgMap.set(key, true);

    const targetQty = Number(fg.quantity) || 0;
    targetFGQuantity += targetQty;

    const receivedData = fgReceivedMap.get(key) || {
      receivedQuantity: 0,
      rejectedQuantity: 0,
      receiptHistory: []
    };

    const recQty = receivedData.receivedQuantity;
    totalFGReceived += recQty;

    const balanceQty = Math.max(0, targetQty - recQty);
    const isSurplus = recQty > targetQty;
    const surplusQty = isSurplus ? recQty - targetQty : 0;
    if (isSurplus) {
      totalFGSurplusQuantity += surplusQty;
    }

    const completionPercent = targetQty > 0
      ? Math.round((recQty / targetQty) * 100)
      : (recQty > 0 ? 100 : 0);

    return {
      fgItemName: itemName,
      fgItemCode: fg.fgItem?.code || fg.fgItemCode || "",
      description: fg.fgItem?.description || fg.description || receivedData.description || "",
      bomNumber: fg.bomNumber || "BOM-Active",
      targetQuantity: targetQty,
      receivedQuantity: recQty,
      balanceQuantity: balanceQty,
      isSurplus,
      surplusQuantity: surplusQty,
      surplusPercent: targetQty > 0 && isSurplus ? Math.round((surplusQty / targetQty) * 100) : 0,
      rejectedQuantity: receivedData.rejectedQuantity,
      unit: fg.unit || receivedData.unit || "Nos",
      completionPercent,
      receiptHistory: receivedData.receiptHistory,
      isUnplanned: false,
      status: isSurplus
        ? `Surplus Inward (+${surplusQty} ${fg.unit || 'Nos'})`
        : completionPercent >= 100
        ? "100% Inwarded"
        : completionPercent > 0
        ? `Partially Received (${completionPercent}%)`
        : "Pending Inward"
    };
  });

  // Process Unplanned FG Items (Items received in FG GRN that were NOT in MRP fgItems)
  const unplannedFGAnalysis = [];
  fgReceivedMap.forEach((entry, key) => {
    if (!plannedFgMap.has(key)) {
      totalFGReceived += entry.receivedQuantity;
      totalFGSurplusQuantity += entry.receivedQuantity;

      unplannedFGAnalysis.push({
        fgItemName: entry.itemName,
        fgItemCode: entry.itemCode || "",
        description: entry.description,
        bomNumber: "Non-BOM Item",
        targetQuantity: 0,
        receivedQuantity: entry.receivedQuantity,
        balanceQuantity: 0,
        isSurplus: true,
        surplusQuantity: entry.receivedQuantity,
        surplusPercent: 100,
        rejectedQuantity: entry.rejectedQuantity,
        unit: entry.unit,
        completionPercent: 100,
        receiptHistory: entry.receiptHistory,
        isUnplanned: true,
        status: `Unplanned FG Return (+${entry.receivedQuantity} ${entry.unit})`
      });
    }
  });

  const fgCompletionPercent = targetFGQuantity > 0
    ? Math.min(100, Math.round((totalFGReceived / targetFGQuantity) * 100))
    : (totalFGReceived > 0 ? 100 : 0);

  // =========================================================================
  // 3. TWO-STAGE OVERALL PIPELINE & BOTTLENECK ANALYSIS
  // =========================================================================
  let currentStage = "Stage 1: Store Material Issuance";
  let bottleneck = null;

  if (materialIssueOverallProgress < 100) {
    currentStage = "Stage 1: Store Material Issuance";
    const pendingBOMCount = plannedMaterialsAnalysis.filter(m => m.pendingToIssue > 0).length;
    bottleneck = `${pendingBOMCount} planned BOM material(s) still pending Store Issue / Returnable DC to shopfloor.`;
  } else if (fgCompletionPercent < 100) {
    currentStage = "Stage 2: FG GRN Inward Clearance";
    const balanceUnits = Math.max(0, targetFGQuantity - totalFGReceived);
    bottleneck = `${balanceUnits} Finished Good unit(s) pending Final FG GRN receipt into Store.`;
  } else {
    currentStage = "Completed (Ready for Dispatch)";
    bottleneck = totalFGSurplusQuantity > 0
      ? `All production completed with +${totalFGSurplusQuantity} surplus Finished Goods received!`
      : "All store material issuance and finished goods receipts completed.";
  }

  const overallProgress = Math.round(
    (materialIssueOverallProgress * 0.5) +
    (fgCompletionPercent * 0.5)
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
      stage2_FGReturn: fgCompletionPercent,
      // Backward compatibility aliases
      stage2_ShopfloorPPC: materialIssueOverallProgress >= 100 ? 100 : materialIssueOverallProgress,
      stage3_JobWorkSubcontracting: materialIssueOverallProgress >= 100 ? 100 : materialIssueOverallProgress,
      stage4_FGAssembly: fgCompletionPercent
    },
    // Streamlined Stage 1
    stage1_MaterialIssues: {
      overallProgress: materialIssueOverallProgress,
      totalRequiredQuantity: totalMaterialRequired,
      totalIssuedQuantity: totalMaterialIssuedActual,
      totalOverIssuedQuantity: totalOverIssuedQuantity,
      materials: plannedMaterialsAnalysis, // BOM Materials
      nonBomMaterials: nonBomMaterialsAnalysis, // Non-BOM Store Issued Materials
      directIssuesCount: materialIssues.length,
      returnableDcsCount: jobWorkChallans.length
    },
    // Streamlined Stage 2
    stage2_FGGRN: {
      overallProgress: fgCompletionPercent,
      targetQuantity: targetFGQuantity,
      receivedQuantity: totalFGReceived,
      surplusQuantity: totalFGSurplusQuantity,
      plannedItems: plannedFGAnalysis, // Planned FG Demand
      unplannedItems: unplannedFGAnalysis, // Unplanned Extra FG Returns
      receipts: fgGRNs
    },
    // Backward compatibility aliases for existing views
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
    JobWorkChallan.find({ company: companyId }).select("mrpNumber items assemblyGroups"),
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
    const hasAnyStoreExit = relatedIssues.length > 0 || relatedJW.length > 0;
    const materialStageProgress = totalRequiredMaterials > 0 ? (hasAnyStoreExit ? 100 : 0) : 100;

    const targetFG = (plan.fgItems || []).reduce((s, f) => s + (Number(f.quantity) || 0), 0);
    const receivedFG = relatedFG.reduce((s, f) => s + (f.items || []).reduce((is, it) => is + (Number(it.acceptedQuantity || it.quantity) || 0), 0), 0);
    const fgStageProgress = targetFG > 0 ? Math.min(100, Math.round((receivedFG / targetFG) * 100)) : 0;

    const overallProgress = Math.round((materialStageProgress * 0.5) + (fgStageProgress * 0.5));

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
        fgCompletion: fgStageProgress
      },
      hasReturnableDCs: relatedJW.length > 0,
      totalIssuesCount: relatedIssues.length + relatedJW.length
    };
  });

  return res.status(200).json(new ApiResponse(200, summary, "Fetched All MRP WIP Overview"));
});

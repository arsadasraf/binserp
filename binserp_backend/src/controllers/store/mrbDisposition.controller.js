import { 
  mrbDispositionSchema, 
  grnSchema, 
  rawMaterialSchema, 
  boughtOutSchema, 
  consumableItemSchema, 
  rmBoItemSchema, 
  fgItemSchema, 
  jobWorkSchema,
  inventorySchema,
  stockTransactionSchema 
} from "../../models/store/index.js";
import { 
  IncomingQCSchema, 
  JobWorkQCSchema, 
  FGQCSchema, 
  ProcessQCSchema 
} from "../../models/quality/index.js";
import { componentSchema } from "../../models/ppc/index.js";
import { deliveryChallanSchema } from "../../models/sales/index.js";
import { debitNoteSchema } from "../../models/purchase/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { updateInventoryStock } from "./updateInventoryStock.controller.js";
import { recordStockTransaction } from "../../services/stockTransaction.service.js";
import { signPhotos } from "../../utils/s3.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user?.company?._id || req.user?.company);
};

// Generate next sequential Ticket Number (e.g. MRB-2026-0001)
const getNextTicketNumber = async (MRBDisposition, companyId) => {
  const currentYear = new Date().getFullYear();
  const prefix = `MRB-${currentYear}-`;
  const count = await MRBDisposition.countDocuments({ company: companyId, ticketNumber: { $regex: `^${prefix}` } });
  return `${prefix}${String(count + 1).padStart(4, '0')}`;
};

/**
 * 1. Get Pending Disposition Queue (MRB Backlog)
 * Merges tickets from MRBDisposition with un-ticketed QC rejections
 */
export const getMRBPendingQueue = asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req);
  const MRBDisposition = req.getModel("MRBDisposition", mrbDispositionSchema);
  const IncomingQC = req.getModel("IncomingQC", IncomingQCSchema);
  const JobWorkQC = req.getModel("JobWorkQC", JobWorkQCSchema);
  const FGQC = req.getModel("FGQC", FGQCSchema);
  const ProcessQC = req.getModel("ProcessQC", ProcessQCSchema);

  // 1. Fetch active tickets
  const activeTickets = await MRBDisposition.find({
    company: companyId,
    status: { $in: ["Pending Disposition", "In Progress"] }
  }).sort({ createdAt: -1 });

  const existingSourceDocIds = new Set(
    activeTickets.map(t => t.sourceDocId ? t.sourceDocId.toString() : null).filter(Boolean)
  );

  const virtualTickets = [];

  // 2. Scan Incoming QC (Populating GRN type, invoice & scanned PDF)
  const pendingFromIncoming = await IncomingQC.find({
    company: companyId,
    rejectedQuantity: { $gt: 0 }
  }).populate('grnId', 'type grnNumber items poReference invoiceNumber billNumber challanNumber date pdf photos supplier supplierName').sort({ createdAt: -1 }).limit(100);

  for (const inc of pendingFromIncoming) {
    if (!existingSourceDocIds.has(inc._id.toString())) {
      let grnCategory = "rm";
      if (inc.grnId?.type) {
        const gt = String(inc.grnId.type).toLowerCase();
        if (gt === "bo") grnCategory = "bo";
        else if (gt === "consumable") grnCategory = "consumable";
        else if (gt === "inhouse" || gt === "fg") grnCategory = "fg";
        else grnCategory = "rm";
      } else if (inc.itemType) {
        const it = String(inc.itemType).toLowerCase();
        if (it.includes("bought") || it.includes("bo")) grnCategory = "bo";
        else if (it.includes("consumable")) grnCategory = "consumable";
        else if (it.includes("finish") || it.includes("fg") || it.includes("component")) grnCategory = "fg";
        else grnCategory = "rm";
      }

      let technicalDescription = inc.materialDescription || inc.description || "";
      if (!technicalDescription && inc.grnId?.items) {
        const matched = inc.grnId.items.find(i => 
          (inc.grnItemId && i._id.toString() === inc.grnItemId.toString()) || 
          (inc.materialId && (i.material?.toString() === inc.materialId.toString() || i.component?.toString() === inc.materialId.toString()))
        );
        if (matched) {
          technicalDescription = matched.description || matched.descriptions || matched.specification || "";
        }
      }

      let signedPdf = "";
      if (inc.grnId?.pdf) {
        try {
          signedPdf = (await signPhotos([inc.grnId.pdf]))[0];
        } catch (s3Err) {
          signedPdf = inc.grnId.pdf;
        }
      }

      virtualTickets.push({
        _id: `virt-inc-${inc._id}`,
        isVirtual: true,
        ticketNumber: `IN-QC-${inc.grnNumber || (inc.grnId?.grnNumber) || inc._id.toString().slice(-4)}`,
        sourceType: "IncomingQC",
        grnCategory,
        sourceDocId: inc._id,
        sourceDocModel: "IncomingQC",
        sourceDocNumber: inc.grnNumber ? `GRN #${inc.grnNumber}` : (inc.grnId?.grnNumber ? `GRN #${inc.grnId.grnNumber}` : `Incoming QC`),
        materialId: inc.materialId || inc.material,
        materialName: inc.materialName || "Raw Material",
        materialCode: inc.materialCode || "",
        technicalDescription,
        itemType: inc.itemType || (grnCategory === 'bo' ? "Bought-Out" : (grnCategory === 'consumable' ? "Consumable" : (grnCategory === 'fg' ? "Finished Goods" : "Raw Material"))),
        unit: inc.unit || "KG",
        rejectedQuantity: Number(inc.rejectedQuantity) || 0,
        receivedQuantity: Number(inc.receivedQuantity || inc.inspectedQuantity || inc.rejectedQuantity) || 0,
        acceptedQuantity: Number(inc.acceptedQuantity) || 0,
        unitRate: Number(inc.rate || inc.unitRate || 0),
        totalEstimatedLoss: (Number(inc.rejectedQuantity) || 0) * (Number(inc.rate || inc.unitRate || 0)),
        rejectionReason: inc.rejectionReason || inc.remarks || "Incoming QC Defect",
        defectCategory: inc.defectCategory || "Dimensional Deviation",
        vendorName: inc.vendorName || inc.vendor?.name || inc.supplierName || (inc.grnId?.supplierName) || "Supplier",
        originalScannedPdf: signedPdf,
        grnNumber: inc.grnNumber || inc.grnId?.grnNumber || "",
        grnDate: inc.grnId?.date || inc.createdAt,
        poReference: inc.grnId?.poReference || "",
        invoiceNumber: inc.grnId?.invoiceNumber || inc.grnId?.billNumber || "",
        challanNumber: inc.grnId?.challanNumber || "",
        dispositionAction: "Pending",
        status: "Pending Disposition",
        createdAt: inc.createdAt || inc.date || new Date(),
        createdByName: inc.inspectorName || "Incoming QC Inspector",
      });
    }
  }

  // 3. Scan Job Work QC (Tagging Returnable DC Type)
  req.getModel("JobWorkChallan", jobWorkSchema);
  const Component = req.getModel("Component", componentSchema);
  const FGItem = req.getModel("FGItem", fgItemSchema);
  const RawMaterial = req.getModel("RawMaterial", rawMaterialSchema);
  const BoughtOut = req.getModel("BoughtOut", boughtOutSchema);

  const pendingFromJobWork = await JobWorkQC.find({
    company: companyId,
    $or: [{ rejectedQuantity: { $gt: 0 } }, { reworkQuantity: { $gt: 0 } }, { scrapQuantity: { $gt: 0 } }]
  }).populate('jobWorkChallanId').sort({ createdAt: -1 }).limit(100);

  for (const jw of pendingFromJobWork) {
    if (!existingSourceDocIds.has(jw._id.toString())) {
      const rej = Number(jw.rejectedQuantity || jw.scrapQuantity || 0);
      const rew = Number(jw.reworkQuantity || 0);
      const totalDefect = rej + rew;
      if (totalDefect > 0) {
        const rawJwType = jw.jobWorkType || "store-conversion";
        let normalizedJwType = "store-conversion";
        if (rawJwType === "store-to-wip") normalizedJwType = "store-to-wip";
        else if (rawJwType === "wip-to-wip") normalizedJwType = "wip-to-wip";
        else normalizedJwType = "store-conversion";

        let resolvedPartNumber = jw.partNumber || jw.itemCode || jw.materialCode || "";
        let resolvedItemName = jw.itemName || jw.materialName || jw.componentName || "";

        // If partNumber not on JobWorkQC record, resolve from challan items or direct master item
        if (!resolvedPartNumber && jw.jobWorkChallanId) {
          const ch = jw.jobWorkChallanId;
          const matchedItem = (ch.items || []).find(i => 
            String(i._id) === String(jw.itemId) || 
            String(i.item) === String(jw.itemId) ||
            (Array.isArray(i.returningItems) && i.returningItems.some(r => String(r._id) === String(jw.itemId) || String(r.receivedItem) === String(jw.itemId)))
          );
          if (matchedItem) {
            resolvedPartNumber = matchedItem.partNumber || matchedItem.itemCode || matchedItem.code || matchedItem.componentCode || "";
            if (!resolvedItemName || resolvedItemName === "Job Work Component") {
              resolvedItemName = matchedItem.itemName || resolvedItemName;
            }
          }
          if (!resolvedPartNumber && Array.isArray(ch.assemblyGroups)) {
            const matchedGrp = ch.assemblyGroups.find(g => 
              String(g.assemblyOutputItem?.item) === String(jw.itemId) || 
              String(g.assemblyOutputItem?._id) === String(jw.itemId)
            );
            if (matchedGrp?.assemblyOutputItem) {
              resolvedPartNumber = matchedGrp.assemblyOutputItem.partNumber || matchedGrp.assemblyOutputItem.itemCode || matchedGrp.assemblyOutputItem.code || "";
              if (!resolvedItemName || resolvedItemName === "Job Work Component") {
                resolvedItemName = matchedGrp.assemblyOutputItem.itemName || resolvedItemName;
              }
            }
          }
        }

        if (!resolvedPartNumber && jw.itemId) {
          try {
            const comp = await Component.findById(jw.itemId).select('componentCode componentName');
            if (comp) {
              resolvedPartNumber = comp.componentCode || "";
              if (!resolvedItemName || resolvedItemName === "Job Work Component") resolvedItemName = comp.componentName;
            } else {
              const fg = await FGItem.findById(jw.itemId).select('code name');
              if (fg) {
                resolvedPartNumber = fg.code || "";
                if (!resolvedItemName || resolvedItemName === "Job Work Component") resolvedItemName = fg.name;
              } else {
                const rm = await RawMaterial.findById(jw.itemId).select('code name');
                if (rm) {
                  resolvedPartNumber = rm.code || "";
                  if (!resolvedItemName || resolvedItemName === "Job Work Component") resolvedItemName = rm.name;
                }
              }
            }
          } catch (e) {}
        }

        virtualTickets.push({
          _id: `virt-jw-${jw._id}`,
          isVirtual: true,
          ticketNumber: `JW-QC-${jw.challanNumber || jw._id.toString().slice(-4)}`,
          sourceType: "JobWorkQC",
          jobWorkType: normalizedJwType,
          sourceDocId: jw._id,
          sourceDocModel: "JobWorkQC",
          sourceDocNumber: jw.challanNumber ? `JW Challan #${jw.challanNumber}` : `Job Work QC`,
          materialId: jw.itemId || jw.material || jw.component,
          materialName: resolvedItemName || "Job Work Component",
          materialCode: resolvedPartNumber,
          partNumber: resolvedPartNumber,
          itemCode: resolvedPartNumber,
          technicalDescription: jw.materialDescription || jw.description || jw.remarks || "",
          itemType: jw.itemType === "rm" ? "Raw Material" : (jw.itemType === "bo" ? "Bought Out" : "Component"),
          unit: jw.unit || "PCS",
          rejectedQuantity: totalDefect,
          unitRate: Number(jw.rate || 0),
          totalEstimatedLoss: totalDefect * Number(jw.rate || 0),
          rejectionReason: jw.rejectionReason || jw.remarks || (rew > 0 ? "Job Work Tolerance Deviation - Rework Requested" : "Job Work Defect"),
          defectCategory: jw.defectCategory || "Subcontractor Flaw",
          vendorName: jw.vendorName || jw.supplierName || jw.jobWorker || "Subcontractor",
          dispositionAction: rew > 0 ? "External Rework" : "Pending",
          status: "Pending Disposition",
          createdAt: jw.createdAt || jw.date || new Date(),
          createdByName: jw.inspectorName || "Job Work Inspector",
        });
      }
    }
  }

  // 4. Scan Process QC (Shop Floor)
  const pendingFromProcess = await ProcessQC.find({
    company: companyId,
    $or: [{ status: "Fail" }, { reworkQuantity: { $gt: 0 } }, { rejectedQuantity: { $gt: 0 } }]
  }).sort({ createdAt: -1 }).limit(100);

  for (const pr of pendingFromProcess) {
    if (!existingSourceDocIds.has(pr._id.toString())) {
      const defQty = Number(pr.reworkQuantity || pr.rejectedQuantity || pr.quantity || 1);
      virtualTickets.push({
        _id: `virt-proc-${pr._id}`,
        isVirtual: true,
        ticketNumber: `PROC-QC-${pr.jobCardNumber || pr._id.toString().slice(-4)}`,
        sourceType: "ProcessQC",
        sourceDocId: pr._id,
        sourceDocModel: "ProcessQC",
        sourceDocNumber: pr.jobCardNumber ? `Job Card #${pr.jobCardNumber}` : `Process QC`,
        materialId: pr.productId || pr.componentId,
        materialName: pr.productName || pr.componentName || "WIP Part",
        materialCode: pr.productCode || "",
        technicalDescription: pr.specification || pr.remarks || "",
        itemType: "WIP",
        unit: pr.unit || "PCS",
        rejectedQuantity: defQty,
        unitRate: Number(pr.unitRate || 0),
        totalEstimatedLoss: defQty * Number(pr.unitRate || 0),
        rejectionReason: pr.rejectionReason || pr.remarks || "Shop Floor Machining Flaw",
        defectCategory: pr.defectCategory || "Machining Defect / Burr",
        workstation: pr.workstation || pr.machineName || "CNC Station",
        operatorName: pr.operatorName || "Machine Operator",
        jobOrderNumber: pr.jobOrderNumber || pr.jobCardNumber || "",
        dispositionAction: pr.reworkQuantity > 0 ? "Internal Rework" : "Pending",
        status: "Pending Disposition",
        createdAt: pr.createdAt || pr.date || new Date(),
        createdByName: pr.inspectorName || "Floor QC Lead",
      });
    }
  }

  // 5. Scan FG QC & PDI
  const pendingFromFG = await FGQC.find({
    company: companyId,
    $or: [{ rejectedQuantity: { $gt: 0 } }, { reworkQuantity: { $gt: 0 } }, { overallStatus: "Rejected" }, { overallStatus: "Rework" }]
  }).sort({ createdAt: -1 }).limit(100);

  for (const fg of pendingFromFG) {
    if (!existingSourceDocIds.has(fg._id.toString())) {
      const defQty = Number(fg.rejectedQuantity || fg.reworkQuantity || 1);
      const isPdi = Boolean(fg.pdiNumber || fg.sourceDocModel === 'PDI' || fg.inspectionType === 'PDI');
      const grnCategory = isPdi ? "pdi" : "fg";

      virtualTickets.push({
        _id: `virt-fg-${fg._id}`,
        isVirtual: true,
        ticketNumber: `FG-QC-${fg.fgItemCode || fg._id.toString().slice(-4)}`,
        sourceType: "FGQC",
        grnCategory,
        sourceDocId: fg._id,
        sourceDocModel: "FGQC",
        sourceDocNumber: fg.pdiNumber ? `PDI #${fg.pdiNumber}` : `FG Inspection`,
        materialId: fg.fgItemId || fg.fgItem,
        materialName: fg.fgItemName || "Finished Product",
        materialCode: fg.fgItemCode || "",
        technicalDescription: fg.specification || fg.description || fg.remarks || "",
        itemType: "Finished Goods",
        unit: fg.unit || "PCS",
        rejectedQuantity: defQty,
        unitRate: Number(fg.rate || 0),
        totalEstimatedLoss: defQty * Number(fg.rate || 0),
        rejectionReason: fg.rejectionReason || fg.remarks || (isPdi ? "Pre-Delivery Inspection (PDI) Failure" : "Final FG Inspection Defect"),
        defectCategory: fg.defectCategory || "Visual / Surface Defect",
        dispositionAction: fg.reworkQuantity > 0 ? "Internal Rework" : "Pending",
        status: "Pending Disposition",
        createdAt: fg.createdAt || fg.date || new Date(),
        createdByName: fg.inspectorName || "PDI Inspector",
      });
    }
  }

  // Ensure active tickets in MRB have normalized categories
  const normalizedActiveTickets = activeTickets.map(ticket => {
    const tObj = ticket.toObject ? ticket.toObject() : { ...ticket };
    if (tObj.sourceType === "IncomingQC") {
      const it = String(tObj.itemType || "").toLowerCase();
      if (it.includes("bought") || it.includes("bo")) tObj.grnCategory = "bo";
      else if (it.includes("consumable")) tObj.grnCategory = "consumable";
      else if (it.includes("finish") || it.includes("fg") || it.includes("component")) tObj.grnCategory = "fg";
      else tObj.grnCategory = "rm";
    } else if (tObj.sourceType === "FGQC") {
      tObj.grnCategory = String(tObj.sourceDocNumber || "").includes("PDI") ? "pdi" : "fg";
    } else if (tObj.sourceType === "JobWorkQC") {
      tObj.jobWorkType = tObj.jobWorkType || "store-conversion";
    }
    tObj.partNumber = tObj.partNumber || tObj.materialCode || tObj.itemCode || "";
    tObj.itemCode = tObj.itemCode || tObj.materialCode || tObj.partNumber || "";
    return tObj;
  });

  const combinedQueue = [...normalizedActiveTickets, ...virtualTickets];

  // Aggregate stats
  const stats = {
    totalPendingCount: combinedQueue.filter(t => t.status === "Pending Disposition").length,
    incomingCount: combinedQueue.filter(t => t.sourceType === "IncomingQC").length,
    processCount: combinedQueue.filter(t => t.sourceType === "ProcessQC").length,
    jobWorkCount: combinedQueue.filter(t => t.sourceType === "JobWorkQC").length,
    fgCount: combinedQueue.filter(t => t.sourceType === "FGQC").length,
    // Store GRN categories breakdown
    storeRmCount: combinedQueue.filter(t => (t.sourceType === "IncomingQC" || t.sourceType === "FGQC") && t.grnCategory === "rm").length,
    storeBoCount: combinedQueue.filter(t => (t.sourceType === "IncomingQC" || t.sourceType === "FGQC") && t.grnCategory === "bo").length,
    storeConsumableCount: combinedQueue.filter(t => (t.sourceType === "IncomingQC" || t.sourceType === "FGQC") && t.grnCategory === "consumable").length,
    storeFgCount: combinedQueue.filter(t => (t.sourceType === "IncomingQC" || t.sourceType === "FGQC") && t.grnCategory === "fg").length,
    storePdiCount: combinedQueue.filter(t => (t.sourceType === "IncomingQC" || t.sourceType === "FGQC") && t.grnCategory === "pdi").length,
    storeTotalCount: combinedQueue.filter(t => (t.sourceType === "IncomingQC" || t.sourceType === "FGQC") && t.status === "Pending Disposition").length,
    // Job Work types breakdown
    jwStoreToWipCount: combinedQueue.filter(t => t.sourceType === "JobWorkQC" && t.jobWorkType === "store-to-wip").length,
    jwWipToWipCount: combinedQueue.filter(t => t.sourceType === "JobWorkQC" && t.jobWorkType === "wip-to-wip").length,
    jwConversionCount: combinedQueue.filter(t => t.sourceType === "JobWorkQC" && t.jobWorkType === "store-conversion").length,
    jwTotalCount: combinedQueue.filter(t => t.sourceType === "JobWorkQC" && t.status === "Pending Disposition").length,
    activeReworkCount: activeTickets.filter(t => t.dispositionAction?.includes("Rework") && t.status === "In Progress").length,
    pendingRtvCount: activeTickets.filter(t => t.dispositionAction === "Return to Vendor" && t.status === "In Progress").length,
    totalEstimatedLoss: combinedQueue.reduce((s, t) => s + (Number(t.totalEstimatedLoss) || 0), 0)
  };

  let resultQueue = combinedQueue;
  const { bin, grnCategory, jwType, sourceType } = req.query;

  if (bin === 'store') {
    // Strictly GRN, Inward, & PDI rejections only (IncomingQC + FGQC)
    resultQueue = resultQueue.filter(t => t.sourceType === "IncomingQC" || t.sourceType === "FGQC");
    if (grnCategory && grnCategory !== 'all') {
      resultQueue = resultQueue.filter(t => t.grnCategory === grnCategory);
    }
  } else if (bin === 'wip-jobwork') {
    // Strictly Job Work Returnable DC rejections only
    resultQueue = resultQueue.filter(t => t.sourceType === "JobWorkQC");
    if (jwType && jwType !== 'all') {
      resultQueue = resultQueue.filter(t => t.jobWorkType === jwType);
    }
  } else if (sourceType && sourceType !== 'all') {
    resultQueue = resultQueue.filter(t => t.sourceType === sourceType);
  }

  res.status(200).json(new ApiResponse(200, { queue: resultQueue, stats }, "MRB Pending Queue retrieved successfully"));
});

/**
 * 2. Execute Disposition Action (RTV, Replacement, Rework, Scrap, Deviation)
 */
// Generate document sequential number (e.g. RET-INV-2026-0001, RPL-DC-2026-0001)
const getNextDocNumber = async (MRBDisposition, companyId, prefix) => {
  const currentYear = new Date().getFullYear();
  const fullPrefix = `${prefix}-${currentYear}-`;
  const count = await MRBDisposition.countDocuments({ company: companyId, documentNumber: { $regex: `^${fullPrefix}` } });
  return `${fullPrefix}${String(count + 1).padStart(4, '0')}`;
};

/**
 * 2. Execute Disposition Action (RTV, Replacement, Rework, Scrap, Deviation)
 */
export const executeMRBDisposition = asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req);
  const MRBDisposition = req.getModel("MRBDisposition", mrbDispositionSchema);
  const userName = req.user?.name || req.user?.username || req.user?.email || "Quality Lead";

  const {
    ticketId,
    sourceType,
    sourceDocId,
    sourceDocModel,
    sourceDocNumber,
    materialId,
    materialName,
    materialCode,
    itemType,
    unit,
    rejectedQuantity,
    unitRate,
    rejectionReason,
    defectCategory,
    vendorName,
    dispositionAction,
    actionNotes,
    // Payload Details
    rtvPayload,
    replacementPayload,
    reworkPayload,
    scrapPayload,
    concessionPayload,
  } = req.body;

  if (!dispositionAction) {
    throw new ApiError(400, "Disposition action is required");
  }

  let ticket = null;

  // Check if ticket already exists
  if (ticketId && !String(ticketId).startsWith("virt-")) {
    ticket = await MRBDisposition.findOne({ _id: ticketId, company: companyId });
  }

  if (!ticket) {
    // Generate new official ticket
    const ticketNumber = await getNextTicketNumber(MRBDisposition, companyId);
    ticket = new MRBDisposition({
      company: companyId,
      ticketNumber,
      sourceType: sourceType || "IncomingQC",
      sourceDocId: sourceDocId || undefined,
      sourceDocModel: sourceDocModel || "IncomingQC",
      sourceDocNumber: sourceDocNumber || "",
      materialId: materialId || undefined,
      materialName: materialName || "Defective Material",
      materialCode: materialCode || req.body.partNumber || "",
      partNumber: req.body.partNumber || materialCode || "",
      itemType: itemType || "Raw Material",
      unit: unit || "KG",
      rejectedQuantity: Number(rejectedQuantity) || 1,
      unitRate: Number(unitRate) || 0,
      totalEstimatedLoss: (Number(rejectedQuantity) || 1) * (Number(unitRate) || 0),
      rejectionReason: rejectionReason || "",
      defectCategory: defectCategory || "Dimensional Deviation",
      vendorName: vendorName || "",
      createdBy: req.user?._id,
      createdByName: userName,
    });
  }

  ticket.dispositionAction = dispositionAction;
  ticket.dispositionBy = req.user?._id;
  ticket.dispositionByName = userName;
  ticket.dispositionDate = new Date();
  ticket.documentDate = new Date();

  const qty = ticket.rejectedQuantity || 1;
  const rate = ticket.unitRate || 0;
  const taxableBase = qty * rate;

  // Execute Action-Specific Handling & Automated Document Generation
  if (dispositionAction === "Return to Vendor") {
    ticket.status = "In Progress";
    ticket.documentType = "ReturnInvoice";
    ticket.documentNumber = await getNextDocNumber(MRBDisposition, companyId, "RET-INV");

    const taxRate = Number(rtvPayload?.taxRate || 18);
    const totalTax = taxableBase * (taxRate / 100);
    const isInterstate = Boolean(rtvPayload?.isInterstate);

    ticket.taxDetails = {
      taxableAmount: taxableBase,
      taxRate: taxRate,
      cgst: isInterstate ? 0 : totalTax / 2,
      sgst: isInterstate ? 0 : totalTax / 2,
      igst: isInterstate ? totalTax : 0,
      totalAmount: taxableBase + totalTax,
    };

    ticket.rtvDetails = {
      challanNumber: ticket.documentNumber,
      challanDate: new Date(),
      debitNoteNumber: rtvPayload?.debitNoteNumber || `DN-${ticket.documentNumber.slice(-4)}`,
      debitNoteAmount: ticket.taxDetails.totalAmount,
      debitNoteStatus: "Issued",
      vehicleNumber: rtvPayload?.vehicleNumber || "",
      dispatchedBy: userName,
    };

    // Log Stock Transaction (OUTWARD / QC_REJECT)
    await recordStockTransaction(req, {
      item: ticket.materialId,
      itemName: ticket.materialName,
      itemCode: ticket.materialCode,
      category: ticket.itemType === "Bought Out" ? "BO" : "RM",
      movementType: "OUTWARD",
      transactionCategory: "QC_REJECT",
      quantity: ticket.rejectedQuantity,
      unit: ticket.unit,
      sourceLocation: "Rejection Bay",
      destinationLocation: `Vendor: ${ticket.vendorName || 'Supplier'}`,
      referenceDocType: "RETURN_INVOICE",
      referenceDocNumber: ticket.documentNumber,
      performedBy: req.user?._id,
      performedByName: userName,
      remarks: `Return to Vendor (Return Bill: ${ticket.documentNumber}): ${actionNotes || ticket.rejectionReason}`,
    });

    // Generate Official Delivery Challan for Gate Out Security Pass
    try {
      const DeliveryChallan = req.getModel("DeliveryChallan", deliveryChallanSchema);
      await DeliveryChallan.create({
        company: companyId,
        dcNumber: ticket.documentNumber,
        dcType: "Vendor Return",
        date: new Date(),
        customerName: ticket.vendorName || "Supplier",
        vendor: ticket.vendorId,
        vehicleNo: rtvPayload?.vehicleNumber || "",
        status: "Dispatched",
        stockDeducted: true,
        items: [{
          material: ticket.materialId,
          materialName: ticket.materialName,
          materialCode: ticket.materialCode,
          quantity: ticket.rejectedQuantity,
          unit: ticket.unit || "PCS",
          rate: ticket.rate || 0,
          amount: ticket.taxDetails?.taxableAmount || 0,
          remarks: `MRB Return to Vendor (Ticket #${ticket.ticketNumber})`
        }],
        remarks: `Generated from MRB Ticket #${ticket.ticketNumber} - ${ticket.rejectionReason}`,
        createdBy: req.user?._id
      });
    } catch (dcErr) {
      console.warn("Could not create DeliveryChallan for MRB return:", dcErr);
    }

    // Generate Official Financial Debit Note / Return Bill
    try {
      const DebitNote = req.getModel("DebitNote", debitNoteSchema);
      const dnNumber = rtvPayload?.debitNoteNumber || `DN-${ticket.documentNumber.replace(/^[A-Z-]+/, '')}`;
      await DebitNote.create({
        company: companyId,
        debitNoteNumber: dnNumber,
        date: new Date(),
        vendor: ticket.vendorId,
        vendorName: ticket.vendorName || "Supplier",
        debitNoteType: ticket.sourceType === "JobWorkQC" ? "Job Work Damage" : "Material Rejection (RTV)",
        originalGrn: ticket.sourceDocModel === "GRN" || ticket.sourceType === "IncomingQC" ? ticket.sourceDocId : undefined,
        originalGrnNumber: ticket.sourceDocNumber || "",
        originalJobWork: ticket.sourceType === "JobWorkQC" ? ticket.sourceDocId : undefined,
        originalJobWorkNumber: ticket.sourceType === "JobWorkQC" ? ticket.sourceDocNumber : undefined,
        mrbTicket: ticket._id,
        mrbTicketNumber: ticket.ticketNumber,
        deliveryChallanNumber: ticket.documentNumber,
        items: [{
          materialId: ticket.materialId,
          materialName: ticket.materialName,
          materialDescription: ticket.rejectionReason || "",
          quantity: ticket.rejectedQuantity,
          unit: ticket.unit || "PCS",
          unitRate: ticket.unitRate || 0,
          taxRate: ticket.taxDetails?.taxRate || 18,
          taxableAmount: ticket.taxDetails?.taxableAmount || 0,
          cgst: ticket.taxDetails?.cgst || 0,
          sgst: ticket.taxDetails?.sgst || 0,
          igst: ticket.taxDetails?.igst || 0,
          totalAmount: ticket.taxDetails?.totalAmount || 0,
          rejectionReason: ticket.rejectionReason || actionNotes || "",
        }],
        subtotal: ticket.taxDetails?.taxableAmount || 0,
        totalTax: (ticket.taxDetails?.totalAmount || 0) - (ticket.taxDetails?.taxableAmount || 0),
        grandTotal: ticket.taxDetails?.totalAmount || 0,
        status: "Issued",
        remarks: `Generated from MRB Disposition (${ticket.ticketNumber}) - Gate Pass: ${ticket.documentNumber}`,
        createdBy: req.user?._id,
        createdByName: userName,
      });
      ticket.rtvDetails.debitNoteNumber = dnNumber;
    } catch (dnErr) {
      console.warn("Could not create DebitNote document for MRB return:", dnErr);
    }

    // Decrement rejectedStock in Inventory if materialId exists
    if (ticket.materialId) {
      try {
        const Inventory = req.getModel("Inventory", inventorySchema);
        await Inventory.findOneAndUpdate(
          { company: companyId, $or: [{ materialId: ticket.materialId }, { materialCode: ticket.materialCode }] },
          { $inc: { rejectedStock: -ticket.rejectedQuantity } }
        );
      } catch (invErr) { }
    }

  } else if (dispositionAction === "Vendor Replacement") {
    ticket.status = "In Progress";
    ticket.documentType = "ReplacementDC";
    ticket.documentNumber = await getNextDocNumber(MRBDisposition, companyId, "RPL-DC");

    ticket.replacementDetails = {
      expectedDate: replacementPayload?.expectedDate || new Date(Date.now() + 7 * 86400000),
      replacementQuantityReceived: 0,
      isFullyReplaced: false,
    };

    // Log Stock Transaction for Warranty Delivery Challan
    await recordStockTransaction(req, {
      item: ticket.materialId,
      itemName: ticket.materialName,
      itemCode: ticket.materialCode,
      category: ticket.itemType === "Bought Out" ? "BO" : "RM",
      movementType: "OUTWARD",
      transactionCategory: "REPLACEMENT_DISPATCH",
      quantity: ticket.rejectedQuantity,
      unit: ticket.unit,
      sourceLocation: "Rejection Bay",
      destinationLocation: `Vendor: ${ticket.vendorName || 'Supplier'}`,
      referenceDocType: "REPLACEMENT_DC",
      referenceDocNumber: ticket.documentNumber,
      performedBy: req.user?._id,
      performedByName: userName,
      remarks: `Dispatched for FOC Replacement (${ticket.documentNumber})`,
    });

    // Generate Official Delivery Challan for Gate Out Replacement Pass
    try {
      const DeliveryChallan = req.getModel("DeliveryChallan", deliveryChallanSchema);
      await DeliveryChallan.create({
        company: companyId,
        dcNumber: ticket.documentNumber,
        dcType: "Vendor Replacement",
        date: new Date(),
        customerName: ticket.vendorName || "Supplier",
        vendor: ticket.vendorId,
        vehicleNo: replacementPayload?.vehicleNumber || "",
        status: "Dispatched",
        stockDeducted: true,
        items: [{
          material: ticket.materialId,
          materialName: ticket.materialName,
          materialCode: ticket.materialCode,
          quantity: ticket.rejectedQuantity,
          unit: ticket.unit || "PCS",
          rate: ticket.rate || 0,
          amount: 0,
          remarks: `MRB Vendor Replacement (Ticket #${ticket.ticketNumber})`
        }],
        remarks: `Generated from MRB Ticket #${ticket.ticketNumber} - FOC Replacement`,
        createdBy: req.user?._id
      });
    } catch (dcErr) {
      console.warn("Could not create DeliveryChallan for MRB replacement:", dcErr);
    }

  } else if (dispositionAction === "Internal Rework" || dispositionAction === "External Rework") {
    ticket.status = "In Progress";
    ticket.documentType = "ReworkJobCard";
    ticket.documentNumber = await getNextDocNumber(MRBDisposition, companyId, "RW-JOB");

    ticket.reworkDetails = {
      reworkJobNumber: ticket.documentNumber,
      assignedWorkstation: reworkPayload?.assignedWorkstation || "Rework Station",
      assignedToUser: reworkPayload?.assignedToUser || userName,
      reworkInstructions: reworkPayload?.reworkInstructions || actionNotes || "Standard reconditioning",
      reworkQcStatus: "Pending QC",
      reworkHoursSpent: 0,
      extraConsumablesCost: 0,
    };

    // If External Rework (Subcontractor Job Work), generate Outward Rework Delivery Challan Pass
    if (dispositionAction === "External Rework") {
      try {
        const DeliveryChallan = req.getModel("DeliveryChallan", deliveryChallanSchema);
        await DeliveryChallan.create({
          company: companyId,
          dcNumber: ticket.documentNumber,
          dcType: "Vendor Replacement",
          date: new Date(),
          customerName: ticket.vendorName || "Subcontractor",
          vendor: ticket.vendorId,
          vehicleNo: reworkPayload?.vehicleNumber || "",
          status: "Dispatched",
          stockDeducted: true,
          items: [{
            material: ticket.materialId,
            materialName: ticket.materialName,
            materialCode: ticket.materialCode,
            quantity: ticket.rejectedQuantity,
            unit: ticket.unit || "PCS",
            rate: ticket.unitRate || 0,
            amount: 0,
            remarks: `FOC Subcontractor Rework Challan (Ticket #${ticket.ticketNumber})`
          }],
          remarks: `Subcontractor Free-of-Cost Rework Pass for Challan ${ticket.sourceDocNumber || ''} - ${ticket.rejectionReason}`,
          createdBy: req.user?._id
        });
      } catch (dcErr) {
        console.warn("Could not create DeliveryChallan for external rework:", dcErr);
      }
    }

  } else if (dispositionAction === "Scrap & Write-Off") {
    ticket.status = "Completed";
    ticket.documentType = "ScrapCertificate";
    ticket.documentNumber = await getNextDocNumber(MRBDisposition, companyId, "SCRAP-CERT");

    ticket.scrapDetails = {
      scrapLocation: scrapPayload?.scrapLocation || "Scrap Yard Bay A",
      scrapDisposalDate: new Date(),
      salvageRatePerKg: Number(scrapPayload?.salvageRatePerKg || 0),
      salvageRealizedAmount: Number(scrapPayload?.salvageRealizedAmount || (qty * (Number(scrapPayload?.salvageRatePerKg) || 0))),
      scrapAuthorizedBy: userName,
    };

    // Log Scrap Stock Transaction
    await recordStockTransaction(req, {
      item: ticket.materialId,
      itemName: ticket.materialName,
      itemCode: ticket.materialCode,
      category: ticket.itemType === "Bought Out" ? "BO" : "RM",
      movementType: "OUTWARD",
      transactionCategory: "SCRAP",
      quantity: ticket.rejectedQuantity,
      unit: ticket.unit,
      sourceLocation: "Rejection Bay",
      destinationLocation: ticket.scrapDetails.scrapLocation,
      referenceDocType: "SCRAP_CERTIFICATE",
      referenceDocNumber: ticket.documentNumber,
      performedBy: req.user?._id,
      performedByName: userName,
      remarks: `Scrapped & Written Off (${ticket.documentNumber}): ${actionNotes || ticket.rejectionReason}`,
    });

  } else if (dispositionAction === "Accept on Deviation") {
    ticket.status = "Completed";
    ticket.documentType = "ConcessionNote";
    ticket.documentNumber = await getNextDocNumber(MRBDisposition, companyId, "DEV-NOTE");

    ticket.concessionDetails = {
      deviationRefNumber: ticket.documentNumber,
      concessionReason: concessionPayload?.concessionReason || actionNotes || "Approved for non-critical application",
      authorizedBy: userName,
      approvedDate: new Date(),
      usageConditions: concessionPayload?.usageConditions || "Use As Is",
    };

    // Release stock into usable Inventory
    if (ticket.materialId) {
      await updateInventoryStock(
        req,
        ticket.materialId,
        ticket.rejectedQuantity,
        ticket.unit,
        null,
        {
          isQCRelease: true,
          inspectedQuantity: ticket.rejectedQuantity,
          transactionCategory: "CONCESSION_RELEASE",
          referenceDocType: "CONCESSION",
          referenceDocNumber: ticket.documentNumber,
          purpose: `Released to Stock on Deviation Concession (${ticket.documentNumber})`,
          performedBy: req.user?._id,
          performedByName: userName,
        }
      );
    }
  }

  ticket.history.push({
    action: `Disposition set to: ${dispositionAction} (Doc: ${ticket.documentNumber || 'N/A'})`,
    performedBy: userName,
    timestamp: new Date(),
    notes: actionNotes || `Status updated to ${ticket.status}`,
  });

  await ticket.save();

  res.status(200).json(new ApiResponse(200, ticket, `Disposition action '${dispositionAction}' executed successfully (Doc #${ticket.documentNumber})`));
});

/**
 * 2b. Update MRB Disposition within 24-Hour Window
 */
export const updateMRBDisposition = asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req);
  const MRBDisposition = req.getModel("MRBDisposition", mrbDispositionSchema);
  const { id } = req.params;
  const userName = req.user?.name || req.user?.username || req.user?.email || "Quality Lead";

  const ticket = await MRBDisposition.findOne({ _id: id, company: companyId });
  if (!ticket) {
    throw new ApiError(404, "MRB Ticket not found");
  }

  // 24-Hour Edit Governance Validation
  if (ticket.dispositionDate) {
    const elapsedMs = Date.now() - new Date(ticket.dispositionDate).getTime();
    const elapsedHours = elapsedMs / (1000 * 60 * 60);
    if (elapsedHours > 24) {
      ticket.isLocked = true;
      await ticket.save();
      throw new ApiError(403, `Editing locked. The 24-hour edit window elapsed (${elapsedHours.toFixed(1)} hours ago).`);
    }
  }

  const {
    dispositionAction,
    actionNotes,
    rtvPayload,
    reworkPayload,
    scrapPayload,
    concessionPayload,
  } = req.body;

  if (dispositionAction) {
    ticket.dispositionAction = dispositionAction;
  }

  if (rtvPayload && ticket.rtvDetails) {
    if (rtvPayload.vehicleNumber !== undefined) ticket.rtvDetails.vehicleNumber = rtvPayload.vehicleNumber;
    if (rtvPayload.debitNoteNumber !== undefined) ticket.rtvDetails.debitNoteNumber = rtvPayload.debitNoteNumber;
  }

  if (reworkPayload && ticket.reworkDetails) {
    if (reworkPayload.assignedWorkstation !== undefined) ticket.reworkDetails.assignedWorkstation = reworkPayload.assignedWorkstation;
    if (reworkPayload.assignedToUser !== undefined) ticket.reworkDetails.assignedToUser = reworkPayload.assignedToUser;
    if (reworkPayload.reworkInstructions !== undefined) ticket.reworkDetails.reworkInstructions = reworkPayload.reworkInstructions;
  }

  if (scrapPayload && ticket.scrapDetails) {
    if (scrapPayload.scrapLocation !== undefined) ticket.scrapDetails.scrapLocation = scrapPayload.scrapLocation;
    if (scrapPayload.salvageRatePerKg !== undefined) {
      ticket.scrapDetails.salvageRatePerKg = Number(scrapPayload.salvageRatePerKg);
      ticket.scrapDetails.salvageRealizedAmount = (ticket.rejectedQuantity || 0) * Number(scrapPayload.salvageRatePerKg);
    }
  }

  if (concessionPayload && ticket.concessionDetails) {
    if (concessionPayload.concessionReason !== undefined) ticket.concessionDetails.concessionReason = concessionPayload.concessionReason;
    if (concessionPayload.usageConditions !== undefined) ticket.concessionDetails.usageConditions = concessionPayload.usageConditions;
  }

  ticket.lastEditedAt = new Date();
  ticket.lastEditedByName = userName;

  ticket.history.push({
    action: `Disposition edited within 24h window by ${userName}`,
    performedBy: userName,
    timestamp: new Date(),
    notes: actionNotes || "Updated disposition parameters",
  });

  await ticket.save();

  res.status(200).json(new ApiResponse(200, ticket, "MRB Disposition updated successfully within 24-hour window"));
});

/**
 * 3. Complete Rework Job & Log Re-Inspection QC Result
 */
export const completeReworkInspection = asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req);
  const MRBDisposition = req.getModel("MRBDisposition", mrbDispositionSchema);
  const userName = req.user?.name || req.user?.username || req.user?.email || "Quality Inspector";

  const { ticketId, reworkQcStatus, passedQuantity, scrappedQuantity, hoursSpent, consumablesCost, remarks } = req.body;

  const ticket = await MRBDisposition.findOne({ _id: ticketId, company: companyId });
  if (!ticket) {
    throw new ApiError(404, "MRB Ticket not found");
  }

  const passedQty = Math.max(0, Number(passedQuantity) || 0);
  const scrappedQty = Math.max(0, Number(scrappedQuantity) || 0);

  ticket.reworkDetails.reworkQcStatus = reworkQcStatus || (passedQty > 0 ? "Passed" : "Failed");
  ticket.reworkDetails.reworkPassedQuantity = passedQty;
  ticket.reworkDetails.reworkScrappedQuantity = scrappedQty;
  ticket.reworkDetails.reworkCompletedDate = new Date();
  ticket.reworkDetails.reworkHoursSpent = Number(hoursSpent || 0);
  ticket.reworkDetails.extraConsumablesCost = Number(consumablesCost || 0);
  ticket.status = "Completed";

  // Release Passed items into Usable Stock
  if (passedQty > 0 && ticket.materialId) {
    await updateInventoryStock(
      req,
      ticket.materialId,
      passedQty,
      ticket.unit,
      null,
      {
        isQCRelease: true,
        inspectedQuantity: passedQty,
        transactionCategory: "REWORK_RETURN",
        referenceDocType: "REWORK_JOB",
        referenceDocNumber: ticket.reworkDetails.reworkJobNumber || ticket.ticketNumber,
        purpose: `Rework Completed & QC Cleared (${ticket.ticketNumber})`,
        performedBy: req.user?._id,
        performedByName: userName,
      }
    );
  }

  // Record Scrapped Portion if any
  if (scrappedQty > 0) {
    await recordStockTransaction(req, {
      item: ticket.materialId,
      itemName: ticket.materialName,
      itemCode: ticket.materialCode,
      category: ticket.itemType === "Bought Out" ? "BO" : "RM",
      movementType: "OUTWARD",
      transactionCategory: "SCRAP",
      quantity: scrappedQty,
      unit: ticket.unit,
      sourceLocation: "Rework Station",
      destinationLocation: "Scrap Yard",
      referenceDocType: "REWORK_SCRAP",
      referenceDocNumber: ticket.ticketNumber,
      performedBy: req.user?._id,
      performedByName: userName,
      remarks: `Rework Failed - Scrapped: ${remarks || 'Unsalvageable defect'}`,
    });
  }

  ticket.history.push({
    action: `Rework Finished - QC: ${ticket.reworkDetails.reworkQcStatus} (${passedQty} Passed, ${scrappedQty} Scrapped)`,
    performedBy: userName,
    timestamp: new Date(),
    notes: remarks || "Rework inspection completed",
  });

  await ticket.save();

  res.status(200).json(new ApiResponse(200, ticket, "Rework inspection and stock clearance completed successfully"));
});

/**
 * 4. Get Complete MRB History & Filterable Logs
 */
export const getMRBHistory = asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req);
  const MRBDisposition = req.getModel("MRBDisposition", mrbDispositionSchema);
  const { action, status, defectCategory, startDate, endDate, bin } = req.query;

  const query = { company: companyId };
  if (bin === 'store') {
    query.sourceType = { $in: ['IncomingQC', 'FGQC'] };
  } else if (bin === 'wip-jobwork') {
    query.sourceType = 'JobWorkQC';
  }

  if (action && action !== "all") query.dispositionAction = action;
  if (status && status !== "all") query.status = status;
  if (defectCategory && defectCategory !== "all") query.defectCategory = defectCategory;
  if (startDate && endDate) {
    query.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
  }

  const tickets = await MRBDisposition.find(query).sort({ createdAt: -1 });
  const mappedTickets = tickets.map(t => {
    const tObj = t.toObject ? t.toObject() : { ...t };
    tObj.partNumber = tObj.partNumber || tObj.materialCode || tObj.itemCode || "";
    tObj.itemCode = tObj.itemCode || tObj.materialCode || tObj.partNumber || "";
    return tObj;
  });

  res.status(200).json(new ApiResponse(200, { tickets: mappedTickets, count: mappedTickets.length }, "MRB History retrieved successfully"));
});

/**
 * 5. Get Scrap Yard Ledger & Loss Analytics
 */
export const getScrapLedger = asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req);
  const MRBDisposition = req.getModel("MRBDisposition", mrbDispositionSchema);
  const StockTransaction = req.getModel("StockTransaction", stockTransactionSchema);
  const { bin } = req.query;

  const scrapFilter = {
    company: companyId,
    $or: [
      { dispositionAction: "Scrap & Write-Off" },
      { "reworkDetails.reworkScrappedQuantity": { $gt: 0 } }
    ]
  };
  if (bin === 'store') {
    scrapFilter.sourceType = { $in: ['IncomingQC', 'FGQC'] };
  } else if (bin === 'wip-jobwork') {
    scrapFilter.sourceType = 'JobWorkQC';
  }

  // Fetch all scrap disposition records
  const rawScrapTickets = await MRBDisposition.find(scrapFilter).sort({ createdAt: -1 });
  const scrapTickets = rawScrapTickets.map(t => {
    const tObj = t.toObject ? t.toObject() : { ...t };
    tObj.partNumber = tObj.partNumber || tObj.materialCode || tObj.itemCode || "";
    tObj.itemCode = tObj.itemCode || tObj.materialCode || tObj.partNumber || "";
    return tObj;
  });

  // Fetch all stock transactions tagged as SCRAP
  const scrapTransactions = await StockTransaction.find({
    company: companyId,
    transactionCategory: "SCRAP"
  }).sort({ timestamp: -1 });

  // Aggregate stats by defect category
  const defectPareto = {};
  let totalScrappedQuantity = 0;
  let totalEstimatedLoss = 0;

  scrapTickets.forEach(t => {
    const qty = t.dispositionAction === "Scrap & Write-Off" ? t.rejectedQuantity : (t.reworkDetails?.reworkScrappedQuantity || 0);
    const loss = qty * (t.unitRate || 0);
    const cat = t.defectCategory || "General Scrap";

    defectPareto[cat] = (defectPareto[cat] || 0) + qty;
    totalScrappedQuantity += qty;
    totalEstimatedLoss += loss;
  });

  res.status(200).json(new ApiResponse(200, {
    scrapTickets,
    scrapTransactions,
    summary: {
      totalScrappedQuantity,
      totalEstimatedLoss,
      defectPareto
    }
  }, "Scrap Yard Ledger retrieved successfully"));
});

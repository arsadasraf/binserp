import mongoose from "mongoose";
import { 
  jobWorkSchema, vendorSchema, fgItemSchema 
} from "../../models/store/index.js";
import { updateInventoryStock } from "./updateInventoryStock.controller.js";
import { recordStockTransaction } from "../../services/stockTransaction.service.js";
import { checkTimeLockGovernance } from "../../utils/timeLockGovernance.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

/**
 * Update an existing Job Work Inward Return Receipt
 * PUT /api/store/jobwork/receive/:id/:receiptId
 */
export const updateJobWorkReturnReceipt = async (req, res) => {
  try {
    const JobWorkChallan = req.getModel("JobWorkChallan", jobWorkSchema);
    const companyId = getCompanyId(req);
    const { id, receiptId } = req.params;

    const jobWork = await JobWorkChallan.findOne({ _id: id, company: companyId }).populate("vendor");
    if (!jobWork) {
      return res.status(404).json({ message: "Job Work Challan not found" });
    }

    if (!jobWork.receiveHistory || jobWork.receiveHistory.length === 0) {
      return res.status(404).json({ message: "No receive history found for this challan" });
    }

    const receipt = jobWork.receiveHistory.id(receiptId) || 
      jobWork.receiveHistory.find(r => String(r._id) === String(receiptId) || r.grnNumber === receiptId);

    if (!receipt) {
      return res.status(404).json({ message: "Return receipt record not found" });
    }

    // Dynamic Time-Lock Governance
    const lockCheck = await checkTimeLockGovernance(req, 'jobWorkReturn', receipt.date || receipt.createdAt, 'edit');
    if (!lockCheck.allowed) {
      return res.status(403).json({ message: lockCheck.message });
    }

    const {
      returnDocType,
      customerDcNumber,
      vendorDcNumber,
      vendorInvoiceDate,
      invoiceNumber,
      invoiceDate,
      vehicleNo,
      remarks,
      pdfDocument,
      photos,
      documents
    } = req.body;

    // Update document reference metadata
    if (returnDocType !== undefined) receipt.returnDocType = returnDocType;
    if (customerDcNumber !== undefined || vendorDcNumber !== undefined) {
      const dcNum = (customerDcNumber || vendorDcNumber || "").trim();
      receipt.customerDcNumber = dcNum;
      receipt.vendorDcNumber = dcNum;
    }
    if (vendorInvoiceDate !== undefined) {
      receipt.vendorInvoiceDate = vendorInvoiceDate ? new Date(vendorInvoiceDate) : undefined;
    }
    if (invoiceNumber !== undefined) receipt.invoiceNumber = invoiceNumber.trim();
    if (invoiceDate !== undefined) {
      receipt.invoiceDate = invoiceDate ? new Date(invoiceDate) : undefined;
    }
    if (vehicleNo !== undefined) receipt.vehicleNo = vehicleNo.trim();
    if (remarks !== undefined) receipt.remarks = remarks;

    // Update attached PDF
    if (pdfDocument !== undefined) {
      if (pdfDocument && pdfDocument.url) {
        receipt.pdfDocument = {
          url: pdfDocument.url,
          filename: pdfDocument.filename || "return_document.pdf",
          fileType: pdfDocument.fileType || "application/pdf",
          sizeKb: Number(pdfDocument.sizeKb) || 0
        };
      } else {
        receipt.pdfDocument = undefined;
      }
    }

    // Update photos & document attachments
    if (Array.isArray(photos)) {
      receipt.photos = photos;
    }

    if (Array.isArray(documents)) {
      let mergedDocs = [...documents];
      if (receipt.pdfDocument && receipt.pdfDocument.url && !mergedDocs.some(d => d.url === receipt.pdfDocument.url)) {
        mergedDocs.unshift({
          url: receipt.pdfDocument.url,
          filename: receipt.pdfDocument.filename,
          fileType: receipt.pdfDocument.fileType
        });
      }
      receipt.documents = mergedDocs;
    }

    await jobWork.save();

    res.status(200).json({
      message: "Return receipt updated successfully",
      receipt,
      jobWork
    });
  } catch (error) {
    console.error("Update Job Work Return Receipt Error:", error);
    res.status(500).json({ message: error.message || "Failed to update return receipt" });
  }
};

/**
 * Delete an existing Job Work Inward Return Receipt & rollback received quantities and stock
 * DELETE /api/store/jobwork/receive/:id/:receiptId
 */
export const deleteJobWorkReturnReceipt = async (req, res) => {
  try {
    const JobWorkChallan = req.getModel("JobWorkChallan", jobWorkSchema);
    const companyId = getCompanyId(req);
    const { id, receiptId } = req.params;

    const jobWork = await JobWorkChallan.findOne({ _id: id, company: companyId }).populate("vendor");
    if (!jobWork) {
      return res.status(404).json({ message: "Job Work Challan not found" });
    }

    if (!jobWork.receiveHistory || jobWork.receiveHistory.length === 0) {
      return res.status(404).json({ message: "No receive history found for this challan" });
    }

    const receipt = jobWork.receiveHistory.id(receiptId) || 
      jobWork.receiveHistory.find(r => String(r._id) === String(receiptId) || r.grnNumber === receiptId);

    if (!receipt) {
      return res.status(404).json({ message: "Return receipt record not found" });
    }

    // Dynamic Time-Lock Governance
    const lockCheck = await checkTimeLockGovernance(req, 'jobWorkReturn', receipt.date || receipt.createdAt, 'delete');
    if (!lockCheck.allowed) {
      return res.status(403).json({ message: lockCheck.message });
    }

    const qtyToRevert = Number(receipt.quantity) || 0;
    const vendorName = jobWork.vendor?.name || "Subcontractor Vendor";

    // 1. Rollback received quantities on Job Work items or assembly groups
    if (jobWork.operationMode === "assembly") {
      let matchedGrp = null;
      if (Array.isArray(jobWork.assemblyGroups) && jobWork.assemblyGroups.length > 0) {
        matchedGrp = jobWork.assemblyGroups.find(g => 
          String(g._id) === String(receipt.returningItemId || receipt.itemId) ||
          String(g.assemblyOutputItem?._id) === String(receipt.returningItemId || receipt.itemId) ||
          String(g.assemblyOutputItem?.item) === String(receipt.returningItemId || receipt.itemId)
        );
      }

      if (matchedGrp && matchedGrp.assemblyOutputItem) {
        const out = matchedGrp.assemblyOutputItem;
        out.quantityReceived = Math.max(0, (Number(out.quantityReceived) || 0) - qtyToRevert);
        if (out.hasSecondaryUnit && out.secondaryUnit) {
          const factor = Number(out.conversionFactor) || 1;
          out.secondaryQuantityReceived = Math.max(0, (Number(out.secondaryQuantityReceived) || 0) - (qtyToRevert * factor));
        }
        out.status = out.quantityReceived <= 0 ? "Sent" : (out.quantityReceived < (Number(out.quantityToBeReceived) || 0) ? "Partial" : "Completed");

        (matchedGrp.items || []).forEach(it => {
          it.quantityReceived = Math.max(0, (Number(it.quantityReceived) || 0) - qtyToRevert);
          it.status = out.status;
        });

        // Sync legacy assemblyOutputItem if present
        if (jobWork.assemblyOutputItem && String(jobWork.assemblyGroups[0]?._id) === String(matchedGrp._id)) {
          jobWork.assemblyOutputItem.quantityReceived = matchedGrp.assemblyOutputItem.quantityReceived;
          jobWork.assemblyOutputItem.secondaryQuantityReceived = matchedGrp.assemblyOutputItem.secondaryQuantityReceived;
          jobWork.assemblyOutputItem.status = matchedGrp.assemblyOutputItem.status;
        }
      } else if (jobWork.assemblyOutputItem) {
        const out = jobWork.assemblyOutputItem;
        out.quantityReceived = Math.max(0, (Number(out.quantityReceived) || 0) - qtyToRevert);
        out.status = out.quantityReceived <= 0 ? "Sent" : (out.quantityReceived < (Number(out.quantityToBeReceived) || 0) ? "Partial" : "Completed");
        (jobWork.items || []).forEach(it => {
          it.quantityReceived = Math.max(0, (Number(it.quantityReceived) || 0) - qtyToRevert);
          it.status = out.status;
        });
      }
    } else {
      // Discrete mode rollback
      for (const item of (jobWork.items || [])) {
        let matchedRet = null;
        if (Array.isArray(item.returningItems) && item.returningItems.length > 0) {
          matchedRet = item.returningItems.find(r => 
            String(r._id) === String(receipt.returningItemId || receipt.itemId) ||
            String(r.receivedItem) === String(receipt.returningItemId || receipt.itemId)
          );
        }

        if (matchedRet) {
          matchedRet.quantityReceived = Math.max(0, (Number(matchedRet.quantityReceived) || 0) - qtyToRevert);
          const target = Number(matchedRet.quantityToBeReceived || matchedRet.quantitySent || 0);
          matchedRet.status = matchedRet.quantityReceived <= 0 ? "Sent" : (matchedRet.quantityReceived < target ? "Partial" : "Completed");
          break;
        } else if (
          String(item._id) === String(receipt.itemId) || 
          String(item.item) === String(receipt.itemId)
        ) {
          item.quantityReceived = Math.max(0, (Number(item.quantityReceived) || 0) - qtyToRevert);
          const target = Number(item.quantityToBeReceived || item.quantitySent || 0);
          item.status = item.quantityReceived <= 0 ? "Sent" : (item.quantityReceived < target ? "Partial" : "Completed");
          break;
        }
      }
    }

    // 2. Rollback Stock if QC was not required (stock was directly incremented)
    const targetItemDoc = receipt.masterItemId || receipt.itemId;
    if (!receipt.qcRequired && targetItemDoc && mongoose.Types.ObjectId.isValid(targetItemDoc)) {
      try {
        await updateInventoryStock({
          inventoryType: "raw", // updateInventoryStock handles routing
          itemId: targetItemDoc,
          companyId,
          quantityChange: -qtyToRevert, // Negative to decrement
          operation: "decrement"
        });

        await recordStockTransaction(req, {
          itemType: "FGItem",
          item: targetItemDoc,
          itemName: receipt.itemName || "Returned Item",
          unit: "PCS",
          movementType: "OUTWARD",
          transactionCategory: "JOB_WORK_RETURN_REVERSAL",
          quantity: qtyToRevert,
          previousStock: 0,
          newStock: 0,
          referenceDocType: "JobWorkChallan",
          referenceDocId: jobWork._id,
          referenceDocNumber: receipt.grnNumber || jobWork.challanNumber,
          recipientOrSource: vendorName,
          purpose: `Rollback of Job Work Return Receipt (${receipt.grnNumber || jobWork.challanNumber})`,
          performedBy: req.user?.id || req.user?._id,
        });
      } catch (stockErr) {
        console.error("Error rolling back physical inventory for deleted return receipt:", stockErr);
      }
    }

    // 3. Remove receipt from receiveHistory
    jobWork.receiveHistory = jobWork.receiveHistory.filter(r => String(r._id) !== String(receipt._id));

    // 4. Recompute Challan Status
    const hasAnyReceived = jobWork.operationMode === "assembly"
      ? (jobWork.assemblyGroups && jobWork.assemblyGroups.length > 0
          ? jobWork.assemblyGroups.some(g => (Number(g.assemblyOutputItem?.quantityReceived) || 0) > 0)
          : (Number(jobWork.assemblyOutputItem?.quantityReceived) || 0) > 0)
      : (jobWork.items || []).some(i => (Number(i.quantityReceived) || 0) > 0);

    jobWork.status = hasAnyReceived ? "Partial" : "Open";

    await jobWork.save();

    res.status(200).json({
      message: "Return receipt deleted and stock counters rolled back successfully",
      jobWork
    });
  } catch (error) {
    console.error("Delete Job Work Return Receipt Error:", error);
    res.status(500).json({ message: error.message || "Failed to delete return receipt" });
  }
};

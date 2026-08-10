import mongoose from "mongoose";
import { grnSchema, materialIssueSchema, bomSchema, inventorySchema, materialRequestSchema, vendorSchema, customerSchema, locationSchema, categorySchema, rmBoItemSchema, companyInfoSchema, jobWorkSchema, jobWorkSupplierSchema } from "../../models/store/index.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

export const receiveJobWorkItems = async (req, res) => {
  try {
    const JobWorkChallan = req.getModel("JobWorkChallan", jobWorkSchema);

    const companyId = getCompanyId(req);
    const { id } = req.params;
    const { 
      items: receivedItems,
      grnNumber: customGrnNumber,
      vendorDcNumber,
      vendorInvoiceDate,
      vehicleNo,
      qcRequired = true,
      qcStatus = "Passed",
      remarks,
      documents = []
    } = req.body;

    const jobWork = await JobWorkChallan.findById(id);
    if (!jobWork) return res.status(404).json({ message: "Job Work Challan not found" });

    const now = new Date();
    const generatedGrnNumber = customGrnNumber || `JWGRN-${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;

    for (const recItem of receivedItems || []) {
      const { 
        itemId, 
        returningItemId, 
        quantity, 
        acceptedQuantity, 
        rejectedQuantity, 
        reworkQuantity, 
        rejectionReason, 
        batchNumber 
      } = recItem;

      const qtyNum = Number(quantity) || 0;
      const acceptedNum = Number(acceptedQuantity !== undefined ? acceptedQuantity : quantity) || 0;
      const rejectedNum = Number(rejectedQuantity) || 0;
      const reworkNum = Number(reworkQuantity) || 0;

      if (qtyNum <= 0) continue;

      let matchedItemName = "Returned Item";

      for (const jwItem of jobWork.items) {
        if (jwItem.returningItems && jwItem.returningItems.length > 0) {
          const retDoc = jwItem.returningItems.id(returningItemId || itemId);
          if (retDoc) {
            matchedItemName = retDoc.receivedItemName || jwItem.itemName || matchedItemName;
            retDoc.quantityReceived = (retDoc.quantityReceived || 0) + qtyNum;
            if (retDoc.quantityReceived >= retDoc.quantityToBeReceived) {
              retDoc.status = "Completed";
            } else {
              retDoc.status = "Partial";
            }

            const allRetCompleted = jwItem.returningItems.every(
              r => r.status === "Completed" || (r.quantityReceived || 0) >= r.quantityToBeReceived
            );
            jwItem.quantityReceived = (jwItem.quantityReceived || 0) + qtyNum;
            jwItem.status = allRetCompleted ? "Completed" : "Partial";
            break;
          }
        }

        if (String(jwItem._id) === String(itemId)) {
          matchedItemName = jwItem.itemName || matchedItemName;
          jwItem.quantityReceived = (jwItem.quantityReceived || 0) + qtyNum;
          const targetQty = jwItem.quantityToBeReceived || jwItem.quantitySent;
          if (jwItem.quantityReceived >= targetQty) {
            jwItem.status = "Completed";
          } else {
            jwItem.status = "Partial";
          }
          break;
        }
      }

      if (!jobWork.receiveHistory) jobWork.receiveHistory = [];
      
      jobWork.receiveHistory.push({
        date: now,
        grnNumber: generatedGrnNumber,
        vendorDcNumber: vendorDcNumber || "",
        vendorInvoiceDate: vendorInvoiceDate ? new Date(vendorInvoiceDate) : undefined,
        vehicleNo: vehicleNo || "",
        itemId: itemId,
        itemName: matchedItemName,
        quantity: qtyNum,
        acceptedQuantity: acceptedNum,
        rejectedQuantity: rejectedNum,
        reworkQuantity: reworkNum,
        rejectionReason: rejectionReason || "",
        qcRequired: Boolean(qcRequired),
        qcStatus: qcRequired ? (qcStatus || "Pending") : "Passed",
        batchNumber: batchNumber || "",
        documents: documents || [],
        remarks: remarks || "",
        receivedBy: req.user?.id
      });
    }

    // Update Main Status
    const anyPending = jobWork.items.some(i => i.status !== "Completed");
    jobWork.status = anyPending ? "Partial" : "Closed";

    await jobWork.save();

    res.status(200).json({
      message: "WIP Return GRN created & items received successfully",
      grnNumber: generatedGrnNumber,
      jobWork
    });

  } catch (error) {
    console.error("Receive JobWork GRN Error:", error);
    res.status(500).json({ message: error.message || "Failed to process WIP Return GRN" });
  }
};

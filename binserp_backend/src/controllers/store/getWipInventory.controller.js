import mongoose from "mongoose";
import { jobWorkSchema, jobWorkSupplierSchema, vendorSchema, rmBoItemSchema, categorySchema, materialIssueSchema } from "../../models/store/index.js";
import { fgItemSchema } from "../../models/store/index.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

export const getWipInventory = async (req, res) => {
  try {
    const JobWorkChallan = req.getModel("JobWorkChallan", jobWorkSchema);
    const MaterialIssue = req.getModel("MaterialIssue", materialIssueSchema);

    // Register referenced models
    req.getModel("Vendor", vendorSchema);
    req.getModel("JobWorkSupplier", jobWorkSupplierSchema);

    const companyId = getCompanyId(req);
    const requestedType = (req.query.type || "rm-bo").toLowerCase(); // 'consumable' vs 'rm-bo' vs 'fg'

    const wipMap = new Map();

    // 1. Process Material Issues (Shop Floor Stock Reduction)
    const materialIssues = await MaterialIssue.find({ company: companyId })
      .populate("issuedTo", "name userId department")
      .sort({ date: -1 });

    materialIssues.forEach((issue) => {
      const isConsumable = issue.type === "consumable";
      const isIssueInhouse = issue.type === "inhouse" || issue.type === "fg";
      const isRmBo = !isConsumable && !isIssueInhouse;

      // Filter by requested WIP inventory category
      if (requestedType === "consumable" && !isConsumable) return;
      if (requestedType === "fg" && !isIssueInhouse) return;
      if (requestedType === "rm-bo" && !isRmBo) return;

      const issueDept = issue.department || issue.issuedTo?.department || "Shop Floor Assembly";

      (issue.items || []).forEach((item) => {
        const matName = item.materialName || "Issued Material";
        const qty = Number(item.quantity) || 0;
        const unit = item.unit || "PCS";
        const issueDate = issue.date || issue.createdAt;
        const key = `issue_${matName.trim().toLowerCase()}_${issueDept.trim().toLowerCase()}`;

        if (!wipMap.has(key)) {
          wipMap.set(key, {
            id: key,
            sentItemName: matName,
            receivedItemName: matName,
            itemType: isConsumable ? "consumable" : isIssueInhouse ? "fg" : "bo",
            categoryType: isConsumable ? "Consumable WIP" : isIssueInhouse ? "FG / In-House WIP" : "RM/BO WIP",
            vendorName: `Department: ${issueDept}`,
            processType: "Shop Floor Issue",
            unit: unit,
            receivingUnit: unit,
            totalIssuedQty: 0,
            totalJobWorkSentQty: 0,
            totalExpectedQty: 0,
            totalReturnedQty: 0,
            pendingWipQty: 0,
            lastMovementDate: issueDate,
            transactions: []
          });
        }

        const entry = wipMap.get(key);
        entry.totalIssuedQty += qty;
        entry.totalExpectedQty += qty;
        entry.pendingWipQty += qty;

        if (new Date(issueDate) > new Date(entry.lastMovementDate)) {
          entry.lastMovementDate = issueDate;
        }

        entry.transactions.push({
          date: issueDate,
          type: "Shop Floor Material Issue",
          docNumber: issue.issueNumber || `ISS-${issue._id.toString().slice(-6)}`,
          sentQty: qty,
          receivedQty: 0,
          unit: unit,
          processType: "Shop Floor Production",
          vendorName: issueDept,
          status: "Issued"
        });
      });
    });

    // 2. Process Job Work Dispatches & Receipts (Subcontractor Stock Reduction)
    const challans = await JobWorkChallan.find({ company: companyId })
      .populate("vendor")
      .sort({ date: -1 });

    challans.forEach((challan) => {
      const vendorObj = challan.vendor || { name: challan.vendorName || "Subcontractor" };
      const vendorId = vendorObj._id ? String(vendorObj._id) : "unknown";
      const vendorName = vendorObj.name || "Subcontractor";

      (challan.items || []).forEach((sentItem) => {
        const itemType = (sentItem.itemType || "bo").toLowerCase();
        const isConsumable = itemType === "consumable";
        const isItemInhouse = itemType === "fg" || itemType === "inhouse" || itemType === "component";
        const isRmBo = !isConsumable && !isItemInhouse;

        // Filter by requested WIP inventory category
        if (requestedType === "consumable" && !isConsumable) return;
        if (requestedType === "fg" && !isItemInhouse) return;
        if (requestedType === "rm-bo" && !isRmBo) return;

        const sentName = sentItem.itemName || "Sent Material";
        const sentQty = Number(sentItem.quantitySent) || 0;
        const processType = sentItem.processType || "Job Work";
        const unit = sentItem.unit || "PCS";
        const challanDate = challan.date || challan.createdAt;

        // Process returning sub-items
        const retList = Array.isArray(sentItem.returningItems) && sentItem.returningItems.length > 0
          ? sentItem.returningItems
          : [{
              receivedItemName: sentItem.receivedItemName || sentItem.itemToBeReceived || sentName,
              receivedItemType: sentItem.receivedItemType || (isConsumable ? "consumable" : isItemInhouse ? "fg" : "bo"),
              quantityToBeReceived: Number(sentItem.quantityToBeReceived || sentItem.quantitySent) || 0,
              quantityReceived: Number(sentItem.quantityReceived) || 0,
              receivingUnit: sentItem.receivingUnit || unit,
              status: sentItem.status
            }];

        retList.forEach((ret) => {
          const retName = ret.receivedItemName || sentName;
          const key = `jw_${sentName.trim().toLowerCase()}_${retName.trim().toLowerCase()}_${vendorId}`;

          const expectedQty = Number(ret.quantityToBeReceived) || sentQty;
          const receivedQty = Number(ret.quantityReceived) || 0;

          if (!wipMap.has(key)) {
            wipMap.set(key, {
              id: key,
              sentItemName: sentName,
              receivedItemName: retName,
              itemType: isConsumable ? "consumable" : isItemInhouse ? "fg" : "bo",
              categoryType: isConsumable ? "Consumable WIP" : isItemInhouse ? "FG / In-House WIP" : "RM/BO WIP",
              vendor: vendorObj,
              vendorName,
              processType,
              unit,
              receivingUnit: ret.receivingUnit || unit,
              totalIssuedQty: 0,
              totalJobWorkSentQty: 0,
              totalExpectedQty: 0,
              totalReturnedQty: 0,
              pendingWipQty: 0,
              lastMovementDate: challanDate,
              transactions: []
            });
          }

          const entry = wipMap.get(key);
          entry.totalJobWorkSentQty += sentQty;
          entry.totalExpectedQty += expectedQty;
          entry.totalReturnedQty += receivedQty;
          entry.pendingWipQty = (entry.totalIssuedQty + entry.totalExpectedQty) - entry.totalReturnedQty;

          if (new Date(challanDate) > new Date(entry.lastMovementDate)) {
            entry.lastMovementDate = challanDate;
          }

          // Add Outward Dispatch Transaction
          entry.transactions.push({
            date: challanDate,
            type: "Job-Work Outward Dispatch",
            docNumber: challan.challanNumber,
            ewayBillNo: challan.ewayBillNo || "",
            sentQty: sentQty,
            receivedQty: 0,
            unit: unit,
            processType,
            vendorName,
            status: challan.status
          });

          // Add Return Receipt History if logged
          if (Array.isArray(challan.receiveHistory)) {
            challan.receiveHistory.forEach((hist) => {
              entry.transactions.push({
                date: hist.date,
                type: "Job-Work Return Receipt",
                docNumber: challan.challanNumber,
                ewayBillNo: challan.ewayBillNo || "",
                sentQty: 0,
                receivedQty: Number(hist.quantity) || 0,
                unit: ret.receivingUnit || unit,
                processType,
                vendorName,
                status: "Received"
              });
            });
          }
        });
      });
    });

    const wipItems = Array.from(wipMap.values()).map((item) => ({
      ...item,
      pendingWipQty: item.pendingWipQty > 0 ? item.pendingWipQty : 0,
      status: item.pendingWipQty > 0 ? "In-Process" : "Completed"
    }));

    // Calculate Summary Metrics
    let totalIssuedQty = 0;
    let totalJobWorkSentQty = 0;
    let totalReturnedQty = 0;
    let netPendingWipQty = 0;

    wipItems.forEach((item) => {
      totalIssuedQty += item.totalIssuedQty;
      totalJobWorkSentQty += item.totalJobWorkSentQty;
      totalReturnedQty += item.totalReturnedQty;
      netPendingWipQty += item.pendingWipQty;
    });

    res.status(200).json({
      wipType: requestedType,
      wipItems,
      summary: {
        totalItems: wipItems.length,
        totalIssuedQty,
        totalJobWorkSentQty,
        totalReturnedQty,
        netPendingWipQty
      }
    });

  } catch (error) {
    console.error("WIP Inventory Fetch Error:", error);
    res.status(500).json({ message: error.message || "Failed to fetch WIP inventory" });
  }
};

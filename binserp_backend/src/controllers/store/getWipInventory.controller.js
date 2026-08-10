import mongoose from "mongoose";
import { jobWorkSchema, jobWorkSupplierSchema, vendorSchema, rmBoItemSchema, categorySchema, materialIssueSchema } from "../../models/store/index.js";
import { fgItemSchema } from "../../models/store/index.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

export const getWipInventory = async (req, res) => {
  try {
    const JobWorkChallan = req.getModel("JobWorkChallan", jobWorkSchema);

    // Register referenced models
    req.getModel("Vendor", vendorSchema);
    req.getModel("JobWorkSupplier", jobWorkSupplierSchema);

    const companyId = getCompanyId(req);

    // Fetch all Job Work Challans for company
    const challans = await JobWorkChallan.find({ company: companyId })
      .populate("vendor")
      .sort({ date: -1 });

    // Map to aggregate WIP stock per Item & Vendor
    const wipMap = new Map();

    challans.forEach((challan) => {
      const vendorObj = challan.vendor || { name: challan.vendorName || "Supplier" };
      const vendorId = vendorObj._id ? String(vendorObj._id) : "unknown";
      const vendorName = vendorObj.name || "Supplier";

      (challan.items || []).forEach((sentItem) => {
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
              receivedItemType: sentItem.receivedItemType || "fg",
              quantityToBeReceived: Number(sentItem.quantityToBeReceived || sentItem.quantitySent) || 0,
              quantityReceived: Number(sentItem.quantityReceived) || 0,
              receivingUnit: sentItem.receivingUnit || unit,
              status: sentItem.status
            }];

        retList.forEach((ret) => {
          const retName = ret.receivedItemName || sentName;
          const key = `${sentName.trim().toLowerCase()}_${retName.trim().toLowerCase()}_${vendorId}`;

          const expectedQty = Number(ret.quantityToBeReceived) || sentQty;
          const receivedQty = Number(ret.quantityReceived) || 0;

          if (!wipMap.has(key)) {
            wipMap.set(key, {
              id: key,
              sentItemName: sentName,
              receivedItemName: retName,
              itemType: sentItem.itemType || "bo",
              receivedItemType: ret.receivedItemType || "fg",
              vendor: vendorObj,
              vendorName,
              processType,
              unit,
              receivingUnit: ret.receivingUnit || unit,
              totalSentQty: 0,
              totalExpectedQty: 0,
              totalReceivedQty: 0,
              pendingWipQty: 0,
              lastMovementDate: challanDate,
              transactions: []
            });
          }

          const entry = wipMap.get(key);
          entry.totalSentQty += sentQty;
          entry.totalExpectedQty += expectedQty;
          entry.totalReceivedQty += receivedQty;
          entry.pendingWipQty = entry.totalExpectedQty - entry.totalReceivedQty;

          if (new Date(challanDate) > new Date(entry.lastMovementDate)) {
            entry.lastMovementDate = challanDate;
          }

          // Add Outward Dispatch Transaction
          entry.transactions.push({
            date: challanDate,
            type: "Outward Dispatch",
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
                type: "Job Work Return Receipt",
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

    const wipItems = Array.from(wipMap.values()).map(item => ({
      ...item,
      pendingWipQty: item.pendingWipQty > 0 ? item.pendingWipQty : 0,
      status: item.pendingWipQty > 0 ? "In-Process" : "Completed"
    }));

    // Calculate Summary Metrics
    let totalSentQty = 0;
    let totalExpectedQty = 0;
    let totalReceivedQty = 0;
    let netPendingWipQty = 0;

    wipItems.forEach(item => {
      totalSentQty += item.totalSentQty;
      totalExpectedQty += item.totalExpectedQty;
      totalReceivedQty += item.totalReceivedQty;
      netPendingWipQty += item.pendingWipQty;
    });

    res.status(200).json({
      wipItems,
      summary: {
        totalItems: wipItems.length,
        totalSentQty,
        totalExpectedQty,
        totalReceivedQty,
        netPendingWipQty
      }
    });

  } catch (error) {
    console.error("WIP Inventory Fetch Error:", error);
    res.status(500).json({ message: error.message || "Failed to fetch WIP inventory" });
  }
};

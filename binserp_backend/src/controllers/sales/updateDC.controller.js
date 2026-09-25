import mongoose from "mongoose";
import { companyInfoSchema } from "../../models/store/index.js";
import { incomingPOSchema, deliveryChallanSchema } from "../../models/sales/index.js";
import { validateSalesItemsStock, deductSalesItemsStock, reverseSalesItemsStock } from "./salesStockHelper.js";
import { checkTimeLockGovernance } from "../../utils/timeLockGovernance.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

export const updateDC = async (req, res) => {
  try {
    const DeliveryChallan = req.getModel('DeliveryChallan', deliveryChallanSchema);
    const IncomingPO = req.getModel('IncomingPO', incomingPOSchema);

    const companyId = getCompanyId(req);
    const { id } = req.params;
    const userId = req.user?.id || req.user?._id;

    const existingDC = await DeliveryChallan.findOne({ _id: id, company: companyId });
    if (!existingDC) {
      return res.status(404).json({ message: "Delivery Challan not found" });
    }

    // Dynamic time lock governance
    const lockCheck = await checkTimeLockGovernance(req, 'deliveryChallan', existingDC.createdAt || existingDC.date, 'edit');
    if (!lockCheck.allowed) {
      return res.status(403).json({ message: lockCheck.message });
    }

    const shouldReduceStock = req.body.reduceStock !== false && req.body.reduceStock !== 'false' && existingDC.reduceStock !== false;

    // 1. Stock Adjustment
    if (shouldReduceStock && Array.isArray(req.body.items)) {
      // Step A: Reverse previous items stock
      if (Array.isArray(existingDC.items) && existingDC.items.length > 0 && existingDC.status !== "Cancelled") {
        await reverseSalesItemsStock(req, existingDC.items, {
          companyId,
          refDocType: "DeliveryChallan",
          refDocId: existingDC._id,
          refDocNumber: existingDC.dcNumber,
          recipientName: existingDC.customerName || "Customer",
          performedBy: userId
        });
      }

      // Step B: Validate available stock for updated items
      const validation = await validateSalesItemsStock(req, req.body.items, companyId);
      if (!validation.valid) {
        // Re-apply previous items stock if validation fails
        if (Array.isArray(existingDC.items) && existingDC.items.length > 0 && existingDC.status !== "Cancelled") {
          await deductSalesItemsStock(req, existingDC.items, {
            companyId,
            refDocType: "DeliveryChallan",
            refDocId: existingDC._id,
            refDocNumber: existingDC.dcNumber,
            recipientName: existingDC.customerName || "Customer",
            performedBy: userId
          });
        }
        return res.status(400).json({ message: validation.message });
      }

      // Step C: Deduct updated items stock
      await deductSalesItemsStock(req, req.body.items, {
        companyId,
        refDocType: "DeliveryChallan",
        refDocId: existingDC._id,
        refDocNumber: req.body.dcNumber || existingDC.dcNumber,
        recipientName: req.body.customerName || existingDC.customerName || "Customer",
        performedBy: userId
      });
    }

    // 2. Customer PO Sync
    const oldPoRef = existingDC.customerPoReference || existingDC.incomingPO;
    const newPoRef = req.body.customerPoReference || req.body.incomingPO;

    // Rollback old PO dispatched quantities
    if (oldPoRef) {
      const oldPO = await IncomingPO.findOne({
        company: companyId,
        $or: [
          { _id: existingDC.incomingPO },
          { _id: mongoose.Types.ObjectId.isValid(oldPoRef) ? oldPoRef : null },
          { poNumber: oldPoRef }
        ]
      });

      if (oldPO && Array.isArray(oldPO.items) && Array.isArray(existingDC.items)) {
        for (const dcItem of existingDC.items) {
          const poItem = oldPO.items.find(i =>
            (dcItem.poItemId && i._id && i._id.toString() === dcItem.poItemId.toString()) ||
            (i.productName && dcItem.materialName && i.productName.trim().toLowerCase() === dcItem.materialName.trim().toLowerCase()) ||
            (dcItem.fgItem && i.fgItem && i.fgItem.toString() === dcItem.fgItem.toString()) ||
            (dcItem.material && i.material && i.material.toString() === dcItem.material.toString())
          );
          if (poItem) {
            poItem.dispatchedQuantity = Math.max(0, (poItem.dispatchedQuantity || 0) - Number(dcItem.quantity || 0));
          }
        }
        const totalOrdered = oldPO.items.reduce((acc, item) => acc + (Number(item.quantity) || 0), 0);
        const totalDispatched = oldPO.items.reduce((acc, item) => acc + (Number(item.dispatchedQuantity) || 0), 0);

        let oldStatus = oldPO.status;
        if (totalDispatched <= 0) {
          oldStatus = oldPO.salesOrderGenerated ? "Sales Order Generated" : "Received";
        } else if (totalDispatched < totalOrdered) {
          oldStatus = "Partially Dispatched";
        } else {
          oldStatus = "Completed";
        }

        if (oldPO.status !== oldStatus) {
          oldPO.status = oldStatus;
          oldPO.statusHistory = oldPO.statusHistory || [];
          oldPO.statusHistory.push({
            status: oldStatus,
            updatedBy: userId,
            updatedAt: new Date()
          });
        }
        await oldPO.save();
      }
    }

    // Apply new PO dispatched quantities
    let incomingPoDocId = null;
    let finalPoReference = newPoRef || "";
    if (newPoRef) {
      const newPO = await IncomingPO.findOne({
        company: companyId,
        $or: [
          { _id: mongoose.Types.ObjectId.isValid(newPoRef) ? newPoRef : null },
          { poNumber: newPoRef }
        ]
      });

      if (newPO) {
        incomingPoDocId = newPO._id;
        finalPoReference = newPO.poNumber || newPoRef;

        const updatedItems = Array.isArray(req.body.items) ? req.body.items : existingDC.items;
        if (Array.isArray(newPO.items) && Array.isArray(updatedItems)) {
          for (const dcItem of updatedItems) {
            const poItem = newPO.items.find(i =>
              (dcItem.poItemId && i._id && i._id.toString() === dcItem.poItemId.toString()) ||
              (i.productName && dcItem.materialName && i.productName.trim().toLowerCase() === dcItem.materialName.trim().toLowerCase()) ||
              (dcItem.fgItem && i.fgItem && i.fgItem.toString() === dcItem.fgItem.toString()) ||
              (dcItem.material && i.material && i.material.toString() === dcItem.material.toString())
            );
            if (poItem) {
              poItem.dispatchedQuantity = (poItem.dispatchedQuantity || 0) + Number(dcItem.quantity || 0);
            }
          }

          const totalOrdered = newPO.items.reduce((acc, item) => acc + (Number(item.quantity) || 0), 0);
          const totalDispatched = newPO.items.reduce((acc, item) => acc + (Number(item.dispatchedQuantity) || 0), 0);

          let nextStatus = newPO.status;
          if (totalDispatched >= totalOrdered && totalOrdered > 0) {
            nextStatus = "Completed";
          } else if (totalDispatched > 0) {
            nextStatus = "Partially Dispatched";
          }

          if (newPO.status !== nextStatus) {
            newPO.status = nextStatus;
            newPO.statusHistory = newPO.statusHistory || [];
            newPO.statusHistory.push({
              status: nextStatus,
              updatedBy: userId,
              updatedAt: new Date()
            });
          }
          await newPO.save();
        }
      }
    }

    // 3. Update Delivery Challan Record
    existingDC.date = req.body.date || existingDC.date;
    existingDC.customer = req.body.customer || existingDC.customer;
    existingDC.customerName = req.body.customerName || existingDC.customerName;
    existingDC.customerAddress = req.body.customerAddress !== undefined ? req.body.customerAddress : existingDC.customerAddress;
    existingDC.customerPoReference = finalPoReference;
    existingDC.incomingPO = incomingPoDocId;
    existingDC.currency = req.body.currency || existingDC.currency;
    existingDC.exchangeRateToINR = Number(req.body.exchangeRateToINR || existingDC.exchangeRateToINR || 1);
    if (Array.isArray(req.body.items)) existingDC.items = req.body.items;
    existingDC.discount = Number(req.body.discount !== undefined ? req.body.discount : existingDC.discount || 0);
    existingDC.transportationType = req.body.transportationType !== undefined ? req.body.transportationType : existingDC.transportationType;
    existingDC.transportationCharges = Number(req.body.transportationCharges !== undefined ? req.body.transportationCharges : existingDC.transportationCharges || 0);
    existingDC.vehicleNumber = req.body.vehicleNumber !== undefined ? req.body.vehicleNumber : existingDC.vehicleNumber;
    existingDC.packagingType = req.body.packagingType !== undefined ? req.body.packagingType : existingDC.packagingType;
    existingDC.packagingCharges = Number(req.body.packagingCharges !== undefined ? req.body.packagingCharges : existingDC.packagingCharges || 0);
    if (req.body.bankDetails) existingDC.bankDetails = req.body.bankDetails;
    if (req.body.termsAndConditions !== undefined) existingDC.termsAndConditions = req.body.termsAndConditions;
    existingDC.otherDetails = req.body.otherDetails !== undefined ? req.body.otherDetails : existingDC.otherDetails;
    if (req.body.status) existingDC.status = req.body.status;
    existingDC.updatedBy = userId;

    await existingDC.save();

    res.status(200).json({ message: "Delivery Challan updated successfully", dc: existingDC });
  } catch (error) {
    console.error("Error updating DC:", error);
    res.status(500).json({ message: error.message });
  }
};

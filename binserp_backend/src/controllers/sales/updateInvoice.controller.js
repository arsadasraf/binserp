import mongoose from "mongoose";
import { invoiceSchema, incomingPOSchema } from "../../models/sales/index.js";
import { validateSalesItemsStock, deductSalesItemsStock, reverseSalesItemsStock } from "./salesStockHelper.js";
import { checkTimeLockGovernance } from "../../utils/timeLockGovernance.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

export const updateInvoice = async (req, res) => {
  try {
    const Invoice = req.getModel('Invoice', invoiceSchema);
    const IncomingPO = req.getModel('IncomingPO', incomingPOSchema);

    const companyId = getCompanyId(req);
    const { id } = req.params;
    const userId = req.user?.id || req.user?._id;

    const existingInvoice = await Invoice.findOne({ _id: id, company: companyId });
    if (!existingInvoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    // Dynamic time lock governance
    const lockCheck = await checkTimeLockGovernance(req, 'invoice', existingInvoice.createdAt || existingInvoice.date, 'edit');
    if (!lockCheck.allowed) {
      return res.status(403).json({ message: lockCheck.message });
    }

    const isLinkedToDC = !!(existingInvoice.deliveryChallan || existingInvoice.dcNumber || existingInvoice.isLinkedToDC || existingInvoice.deliveryChallanId);

    // 1. Stock Adjustment for direct invoices
    if (!isLinkedToDC && Array.isArray(req.body.items)) {
      // Step A: Reverse previous items stock
      if (Array.isArray(existingInvoice.items) && existingInvoice.items.length > 0) {
        await reverseSalesItemsStock(req, existingInvoice.items, {
          companyId,
          refDocType: "Invoice",
          refDocId: existingInvoice._id,
          refDocNumber: existingInvoice.invoiceNumber,
          recipientName: existingInvoice.customerName || "Customer",
          performedBy: userId
        });
      }

      // Step B: Validate available stock for updated items
      const validation = await validateSalesItemsStock(req, req.body.items, companyId);
      if (!validation.valid) {
        // Re-apply previous items stock if validation fails
        if (Array.isArray(existingInvoice.items) && existingInvoice.items.length > 0) {
          await deductSalesItemsStock(req, existingInvoice.items, {
            companyId,
            refDocType: "Invoice",
            refDocId: existingInvoice._id,
            refDocNumber: existingInvoice.invoiceNumber,
            recipientName: existingInvoice.customerName || "Customer",
            performedBy: userId
          });
        }
        return res.status(400).json({ message: validation.message });
      }

      // Step C: Deduct updated items stock
      await deductSalesItemsStock(req, req.body.items, {
        companyId,
        refDocType: "Invoice",
        refDocId: existingInvoice._id,
        refDocNumber: req.body.invoiceNumber || existingInvoice.invoiceNumber,
        recipientName: req.body.customerName || existingInvoice.customerName || "Customer",
        performedBy: userId
      });
    }

    // 2. Customer PO Sync
    const oldPoRef = existingInvoice.customerPoReference || existingInvoice.incomingPO;
    const newPoRef = req.body.customerPoReference || req.body.incomingPO;

    // Rollback old PO billed quantities
    if (oldPoRef) {
      const oldPO = await IncomingPO.findOne({
        company: companyId,
        $or: [
          { _id: existingInvoice.incomingPO },
          { _id: mongoose.Types.ObjectId.isValid(oldPoRef) ? oldPoRef : null },
          { poNumber: oldPoRef }
        ]
      });

      if (oldPO && Array.isArray(oldPO.items) && Array.isArray(existingInvoice.items)) {
        for (const invItem of existingInvoice.items) {
          const poItem = oldPO.items.find(i =>
            (invItem.poItemId && i._id && i._id.toString() === invItem.poItemId.toString()) ||
            (i.productName && invItem.materialName && i.productName.trim().toLowerCase() === invItem.materialName.trim().toLowerCase()) ||
            (invItem.fgItem && i.fgItem && i.fgItem.toString() === invItem.fgItem.toString()) ||
            (invItem.material && i.material && i.material.toString() === invItem.material.toString())
          );
          if (poItem) {
            poItem.billedQuantity = Math.max(0, (poItem.billedQuantity || 0) - Number(invItem.quantity || 0));
            poItem.dispatchedQuantity = Math.max(0, (poItem.dispatchedQuantity || 0) - Number(invItem.quantity || 0));
          }
        }
        const totalOrdered = oldPO.items.reduce((acc, item) => acc + (Number(item.quantity) || 0), 0);
        const totalFulfilled = oldPO.items.reduce((acc, item) => acc + Math.max(Number(item.dispatchedQuantity || 0), Number(item.billedQuantity || 0)), 0);

        let oldStatus = oldPO.status;
        if (totalFulfilled <= 0) {
          oldStatus = oldPO.salesOrderGenerated ? "Sales Order Generated" : "Received";
        } else if (totalFulfilled < totalOrdered) {
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

    // Apply new PO billed quantities
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

        if (Array.isArray(req.body.items)) {
          for (const invItem of req.body.items) {
            const poItem = newPO.items.find(i =>
              (invItem.poItemId && i._id && i._id.toString() === invItem.poItemId.toString()) ||
              (i.productName && invItem.materialName && i.productName.trim().toLowerCase() === invItem.materialName.trim().toLowerCase()) ||
              (invItem.fgItem && i.fgItem && i.fgItem.toString() === invItem.fgItem.toString()) ||
              (invItem.material && i.material && i.material.toString() === invItem.material.toString())
            );
            if (poItem) {
              poItem.billedQuantity = (poItem.billedQuantity || 0) + Number(invItem.quantity || 0);
              poItem.dispatchedQuantity = (poItem.dispatchedQuantity || 0) + Number(invItem.quantity || 0);
            }
          }
          const totalOrdered = newPO.items.reduce((acc, item) => acc + (Number(item.quantity) || 0), 0);
          const totalFulfilled = newPO.items.reduce((acc, item) => acc + Math.max(Number(item.dispatchedQuantity || 0), Number(item.billedQuantity || 0)), 0);

          let newStatus = newPO.status;
          if (totalOrdered > 0) {
            if (totalFulfilled >= totalOrdered) {
              newStatus = "Completed";
            } else if (totalFulfilled > 0) {
              newStatus = "Partially Dispatched";
            }
          }

          if (newPO.status !== newStatus) {
            newPO.status = newStatus;
            newPO.statusHistory = newPO.statusHistory || [];
            newPO.statusHistory.push({
              status: newStatus,
              updatedBy: userId,
              updatedAt: new Date()
            });
          }
          await newPO.save();
        }
      }
    }

    const updatedInvoice = await Invoice.findByIdAndUpdate(
      id,
      {
        ...req.body,
        customerPoReference: finalPoReference,
        incomingPO: incomingPoDocId,
        updatedBy: userId
      },
      { new: true }
    );

    res.status(200).json({ message: "Invoice updated successfully", invoice: updatedInvoice });
  } catch (error) {
    console.error("Error in updateInvoice:", error);
    res.status(500).json({ message: error.message || "Failed to update Invoice" });
  }
};


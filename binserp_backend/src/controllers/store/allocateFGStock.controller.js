import mongoose from "mongoose";
import { fgItemSchema, customerSchema } from "../../models/store/index.js";
import { salesOrderSchema } from "../../models/sales/index.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? (req.user?._id || req.user?.id) : (req.user?.company?._id || req.user?.company));
};

const getModel = (req, modelName, schema) => {
  if (req.getModel && schema) {
    try {
      return req.getModel(modelName, schema);
    } catch (e) {}
  }
  return mongoose.models[modelName] || mongoose.model(modelName, schema);
};

/**
 * Controller to Allocate or Deallocate Finished Goods (FG) stock for a Sales Order
 */
export const allocateFGStock = async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const { salesOrderId, fgItemId, allocateQty, action = "allocate" } = req.body;

    if (!salesOrderId || !fgItemId || !allocateQty || allocateQty <= 0) {
      return res.status(400).json({ success: false, message: "Sales Order ID, FG Item ID, and positive allocation quantity are required." });
    }

    const FGItem = getModel(req, "FGItem", fgItemSchema);
    const SalesOrder = getModel(req, "SalesOrder", salesOrderSchema);
    getModel(req, "Customer", customerSchema);

    const [fgItem, salesOrder] = await Promise.all([
      FGItem.findOne({ _id: fgItemId, ...(companyId ? { company: companyId } : {}) }),
      SalesOrder.findOne({ _id: salesOrderId, ...(companyId ? { company: companyId } : {}) }).populate("customer", "name companyName")
    ]);

    if (!fgItem) {
      return res.status(404).json({ success: false, message: "Finished Goods item not found." });
    }
    if (!salesOrder) {
      return res.status(404).json({ success: false, message: "Sales Order not found." });
    }

    const currentTotalStock = fgItem.quantity || 0;
    const currentAllocated = fgItem.allocatedQuantity || 0;
    const availableStock = Math.max(0, currentTotalStock - currentAllocated);

    const custName = salesOrder.customerName || salesOrder.customer?.name || salesOrder.customer?.companyName || "Customer";

    if (action === "allocate") {
      if (allocateQty > availableStock) {
        return res.status(400).json({
          success: false,
          message: `Cannot allocate ${allocateQty} units. Only ${availableStock} units are unreserved (Total: ${currentTotalStock}, Already Allocated: ${currentAllocated}).`
        });
      }

      // Add to fgItem allocations
      fgItem.allocatedQuantity = currentAllocated + allocateQty;
      const existingAllocIdx = (fgItem.allocations || []).findIndex(
        (a) => a.salesOrder && a.salesOrder.toString() === salesOrderId.toString()
      );

      if (existingAllocIdx >= 0) {
        fgItem.allocations[existingAllocIdx].allocatedQty += allocateQty;
        fgItem.allocations[existingAllocIdx].allocatedAt = new Date();
      } else {
        fgItem.allocations = fgItem.allocations || [];
        fgItem.allocations.push({
          salesOrder: salesOrder._id,
          salesOrderNo: salesOrder.orderNumber,
          customerName: custName,
          allocatedQty: allocateQty,
          allocatedAt: new Date()
        });
      }

      await fgItem.save();

      // Update SalesOrder item & total allocated
      let totalSoQty = 0;
      let totalSoAllocated = 0;

      salesOrder.items.forEach((item) => {
        totalSoQty += item.quantity || 0;
        if (item.fgItem && item.fgItem.toString() === fgItemId.toString()) {
          item.allocatedFgQty = (item.allocatedFgQty || 0) + allocateQty;
        }
        totalSoAllocated += item.allocatedFgQty || 0;
      });

      salesOrder.allocatedFgQty = totalSoAllocated;

      if (totalSoAllocated >= totalSoQty) {
        salesOrder.fulfillmentStatus = "Fully Allocated";
      } else if (totalSoAllocated > 0) {
        salesOrder.fulfillmentStatus = "Partially Allocated";
      }

      await salesOrder.save();

      return res.status(200).json({
        success: true,
        message: `Successfully allocated ${allocateQty} units of ${fgItem.name} to Sales Order #${salesOrder.orderNumber}`,
        data: {
          fgItem,
          salesOrder
        }
      });
    } else if (action === "deallocate") {
      const deallocQty = Math.min(allocateQty, currentAllocated);
      fgItem.allocatedQuantity = Math.max(0, currentAllocated - deallocQty);

      if (fgItem.allocations) {
        const existingAllocIdx = fgItem.allocations.findIndex(
          (a) => a.salesOrder && a.salesOrder.toString() === salesOrderId.toString()
        );
        if (existingAllocIdx >= 0) {
          fgItem.allocations[existingAllocIdx].allocatedQty -= deallocQty;
          if (fgItem.allocations[existingAllocIdx].allocatedQty <= 0) {
            fgItem.allocations.splice(existingAllocIdx, 1);
          }
        }
      }

      await fgItem.save();

      let totalSoQty = 0;
      let totalSoAllocated = 0;

      salesOrder.items.forEach((item) => {
        totalSoQty += item.quantity || 0;
        if (item.fgItem && item.fgItem.toString() === fgItemId.toString()) {
          item.allocatedFgQty = Math.max(0, (item.allocatedFgQty || 0) - deallocQty);
        }
        totalSoAllocated += item.allocatedFgQty || 0;
      });

      salesOrder.allocatedFgQty = totalSoAllocated;

      if (totalSoAllocated === 0) {
        salesOrder.fulfillmentStatus = "Pending";
      } else if (totalSoAllocated < totalSoQty) {
        salesOrder.fulfillmentStatus = "Partially Allocated";
      }

      await salesOrder.save();

      return res.status(200).json({
        success: true,
        message: `Deallocated ${deallocQty} units from Sales Order #${salesOrder.orderNumber}`,
        data: { fgItem, salesOrder }
      });
    }

    return res.status(400).json({ success: false, message: "Invalid action. Use 'allocate' or 'deallocate'." });
  } catch (error) {
    console.error("Error in allocateFGStock controller:", error);
    return res.status(500).json({ success: false, message: "Server error allocating FG stock.", error: error.message });
  }
};

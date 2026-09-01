import mongoose from "mongoose";
import { grnSchema, materialIssueSchema, bomSchema, inventorySchema, materialRequestSchema, vendorSchema, customerSchema, locationSchema, categorySchema, rmBoItemSchema, companyInfoSchema, jobWorkSchema, jobWorkSupplierSchema, fgItemSchema, fgInventoryMonthlySchema } from "../../models/store/index.js";
import { recordStockTransaction } from "../../services/stockTransaction.service.js";
import { incomingRFQSchema, quotationSchema, incomingPOSchema, salesOrderSchema, salesOrderDispatchHistorySchema, deliveryChallanSchema, invoiceSchema } from "../../models/sales/index.js";
import { reverseSalesItemsStock } from "./salesStockHelper.js";
import { storePrefixSchema } from "../../models/store/index.js";
import { componentSchema, jobSchema, processSchema } from "../../models/ppc/index.js";
import { uploadOnS3, deleteFromS3, signPhotos } from "../../utils/s3.js";
import fs from 'fs';
import path from 'path';

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

const getCompanyLoginId = (req) => {
  return req.company?.companyId || req.user?.companyId || req.user?.company?.companyId || "";
};

// Helper function to update COMPONENT stock (InHouse)
const updateComponentStock = async (req, componentId, quantity) => {
  try {
    const companyId = getCompanyId(req); // Derive companyId from req
    const Component = req.getModel("Component", componentSchema);
    const component = await Component.findById(componentId);
    if (!component) {
      console.error(`Component not found: ${componentId}`);
      return null;
    }

    // Update quantity
    await Component.findByIdAndUpdate(componentId, {
      $inc: { quantity: quantity }
    });

    return true;
  } catch (error) {
    console.error("Error updating component stock:", error);
    throw error;
  }
};



// ========== GRN (Goods Receipt Note) ==========


export const deleteDC = async (req, res) => {
  try {
    const DeliveryChallan = req.getModel('DeliveryChallan', deliveryChallanSchema);
    const FGItem = req.getModel('FGItem', fgItemSchema);
    const IncomingPO = req.getModel('IncomingPO', incomingPOSchema);

    const companyId = getCompanyId(req);
    const { id } = req.params;
    const dc = await DeliveryChallan.findOne({ _id: id, company: companyId });
    if (!dc) return res.status(404).json({ message: "DC not found" });

    // If DC had deducted stock (not Cancelled), restore stock across FG, RM, BO, and Consumables
    if (dc.status !== "Cancelled" && Array.isArray(dc.items)) {
      await reverseSalesItemsStock(req, dc.items, {
        companyId,
        refDocType: "DeliveryChallan",
        refDocId: dc._id,
        refDocNumber: dc.dcNumber,
        recipientName: dc.customerName || "Customer",
        performedBy: req.user?.id || req.user?._id
      });
    }

    // If DC had customerPoReference, reverse PO dispatchedQuantity
    if (dc.customerPoReference) {
      const po = await IncomingPO.findOne({
        company: companyId,
        $or: [
          { _id: mongoose.Types.ObjectId.isValid(dc.customerPoReference) ? dc.customerPoReference : null },
          { poNumber: dc.customerPoReference }
        ]
      });
      if (po && Array.isArray(po.items) && Array.isArray(dc.items)) {
        for (const dcItem of dc.items) {
          const poItem = po.items.find(i => i.productName === dcItem.materialName || i.fgItem?.toString() === dcItem.fgItem?.toString());
          if (poItem) {
            poItem.dispatchedQuantity = Math.max(0, (poItem.dispatchedQuantity || 0) - Number(dcItem.quantity || 0));
          }
        }
        const totalOrdered = po.items.reduce((acc, item) => acc + (Number(item.quantity) || 0), 0);
        const totalDispatched = po.items.reduce((acc, item) => acc + (Number(item.dispatchedQuantity) || 0), 0);
        if (totalDispatched <= 0) {
          po.status = "Open";
        } else if (totalDispatched < totalOrdered) {
          po.status = "Partially Dispatched";
        }
        await po.save();
      }
    }

    await DeliveryChallan.findByIdAndDelete(id);
    res.status(200).json({ message: "DC deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// ========== INVOICE / BILLING ==========


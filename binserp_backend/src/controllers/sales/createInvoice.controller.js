import mongoose from "mongoose";
import { grnSchema, materialIssueSchema, bomSchema, inventorySchema, materialRequestSchema, vendorSchema, customerSchema, locationSchema, categorySchema, rmBoItemSchema, companyInfoSchema, jobWorkSchema, jobWorkSupplierSchema, fgItemSchema, fgInventoryMonthlySchema } from "../../models/store/index.js";
import { recordStockTransaction } from "../../services/stockTransaction.service.js";
import { incomingRFQSchema, quotationSchema, incomingPOSchema, salesOrderSchema, salesOrderDispatchHistorySchema, deliveryChallanSchema, invoiceSchema } from "../../models/sales/index.js";
import { validateSalesItemsStock, deductSalesItemsStock } from "./salesStockHelper.js";

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


export const createInvoice = async (req, res) => {
  try {
    const Invoice = req.getModel('Invoice', invoiceSchema);

    const companyId = getCompanyId(req);
    console.log("Creating Invoice:", req.body.invoiceNumber);

    let { customerPoReference, items, customer } = req.body;

    if (!customer || customer === "" || !mongoose.Types.ObjectId.isValid(customer)) {
      req.body.customer = undefined;
    }

    // Clean items payload
    if (Array.isArray(items)) {
      req.body.items = items.map(item => {
        const cleaned = { ...item };
        if (!cleaned.material || cleaned.material === "" || !mongoose.Types.ObjectId.isValid(cleaned.material)) delete cleaned.material;
        if (!cleaned.component || cleaned.component === "" || !mongoose.Types.ObjectId.isValid(cleaned.component)) delete cleaned.component;
        if (!cleaned.fgItem || cleaned.fgItem === "" || !mongoose.Types.ObjectId.isValid(cleaned.fgItem)) delete cleaned.fgItem;
        return cleaned;
      });
    }

    let finalPoReference = customerPoReference || "";
    let incomingPoDocId = null;

    if (customerPoReference) {
      const IncomingPO = req.getModel('IncomingPO', incomingPOSchema);
      const po = await IncomingPO.findOne({
        company: companyId,
        $or: [
          { _id: mongoose.Types.ObjectId.isValid(customerPoReference) ? customerPoReference : null },
          { poNumber: customerPoReference }
        ]
      });
      
      if (po) {
        incomingPoDocId = po._id;
        finalPoReference = po.poNumber || customerPoReference;

        if (Array.isArray(items)) {
          // Validate and update quantities
          for (const invoiceItem of items) {
            const poItem = po.items.find(i => 
              (i.productName && invoiceItem.materialName && i.productName.trim().toLowerCase() === invoiceItem.materialName.trim().toLowerCase()) || 
              (invoiceItem.fgItem && i.fgItem && i.fgItem.toString() === invoiceItem.fgItem.toString())
            );
            if (poItem) {
              poItem.billedQuantity = (poItem.billedQuantity || 0) + Number(invoiceItem.quantity || 0);
              poItem.dispatchedQuantity = (poItem.dispatchedQuantity || 0) + Number(invoiceItem.quantity || 0);
            }
          }

          // Auto-update Customer PO fulfillment status and timeline history
          const previousStatus = po.status;
          const totalOrdered = po.items.reduce((acc, item) => acc + (Number(item.quantity) || 0), 0);
          const totalFulfilled = po.items.reduce((acc, item) => acc + Math.max(Number(item.dispatchedQuantity || 0), Number(item.billedQuantity || 0)), 0);
          
          if (totalOrdered > 0) {
            if (totalFulfilled >= totalOrdered) {
              po.status = "Completed";
            } else if (totalFulfilled > 0) {
              po.status = "Partially Dispatched";
            }
          }

          if (po.status !== previousStatus) {
            po.statusHistory = po.statusHistory || [];
            po.statusHistory.push({
              status: po.status,
              updatedBy: req.user?.id || req.user?._id,
              updatedAt: new Date()
            });
          }

          await po.save();
        }
      }
    }

    // Check if linked to a Delivery Challan where stock was already deducted
    let isStockAlreadyDeducted = false;
    const dcIdOrNum = req.body.deliveryChallan || req.body.deliveryChallanId || req.body.dcNumber;
    if (dcIdOrNum) {
      const DeliveryChallan = req.getModel('DeliveryChallan', deliveryChallanSchema);
      const dcDoc = await DeliveryChallan.findOne({
        company: companyId,
        $or: [
          { _id: mongoose.Types.ObjectId.isValid(dcIdOrNum) ? dcIdOrNum : null },
          { dcNumber: dcIdOrNum }
        ]
      });
      if (dcDoc && dcDoc.stockDeducted) {
        isStockAlreadyDeducted = true;
      }
    }

    // Validate inventory stock across FG, RM, BO, and Consumables for direct invoices
    if (!isStockAlreadyDeducted && Array.isArray(req.body.items)) {
      const validation = await validateSalesItemsStock(req, req.body.items, companyId);
      if (!validation.valid) {
        return res.status(400).json({ message: validation.message });
      }
    }

    const invoice = await Invoice.create({
      company: companyId,
      ...req.body,
      exchangeRateToINR: Number(req.body.exchangeRateToINR || 1),
      customerPoReference: finalPoReference,
      incomingPO: incomingPoDocId,
      preparedBy: req.user?.id || req.user?._id,
      createdBy: req.user?.id || req.user?._id
    });

    // Deduct stock across FG, RM, BO, and Consumables if not already deducted by DC
    if (!isStockAlreadyDeducted && (invoice.status === "Sent" || invoice.status === "Paid" || !invoice.status || invoice.status === "Draft")) {
      await deductSalesItemsStock(req, items, {
        companyId,
        refDocType: "Invoice",
        refDocId: invoice._id,
        refDocNumber: invoice.invoiceNumber,
        recipientName: req.body.customerName || "Customer",
        performedBy: req.user?.id || req.user?._id
      });
    }

    res.status(201).json({ message: "Invoice created successfully", invoice });

  } catch (error) {
    console.error("Error creating Invoice:", error);
    res.status(500).json({ message: error.message || "Failed to create Invoice" });
  }
};



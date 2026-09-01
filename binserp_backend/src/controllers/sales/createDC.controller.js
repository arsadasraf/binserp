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


export const createDC = async (req, res) => {
  try {
    const DeliveryChallan = req.getModel('DeliveryChallan', deliveryChallanSchema);

    const companyId = getCompanyId(req);
    const { dcNumber, date, customer, items, status, customerPoReference } = req.body;

    console.log("Creating DC:", { dcNumber, companyId });

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

        // Validate and update dispatched quantities
        for (const dcItem of items) {
          const poItem = po.items.find(i => 
            (i.productName && dcItem.materialName && i.productName.trim().toLowerCase() === dcItem.materialName.trim().toLowerCase()) || 
            (i.fgItem && dcItem.fgItem && i.fgItem.toString() === dcItem.fgItem.toString())
          );
          if (poItem) {
            poItem.dispatchedQuantity = (poItem.dispatchedQuantity || 0) + Number(dcItem.quantity || 0);
          }
        }

        // Auto-update Customer PO fulfillment status
        const totalOrdered = po.items.reduce((acc, item) => acc + (Number(item.quantity) || 0), 0);
        const totalDispatched = po.items.reduce((acc, item) => acc + (Number(item.dispatchedQuantity) || 0), 0);
        if (totalOrdered > 0) {
          if (totalDispatched >= totalOrdered) {
            po.status = "Completed";
          } else if (totalDispatched > 0) {
            po.status = "Partially Dispatched";
          }
        }

        await po.save();
      }
    }

    const shouldReduceStock = req.body.reduceStock !== false && req.body.reduceStock !== 'false';

    // Validate inventory stock across FG, RM, BO, and Consumables
    if (shouldReduceStock && Array.isArray(items)) {
      const validation = await validateSalesItemsStock(req, items, companyId);
      if (!validation.valid) {
        return res.status(400).json({ message: validation.message });
      }
    }

    const dcCurrency = req.body.currency || (typeof po !== 'undefined' && po ? po.currency : undefined) || 'INR';

    const dc = await DeliveryChallan.create({
      company: companyId,
      dcNumber,
      date,
      customerName: req.body.customerName,
      customer,
      customerAddress: req.body.customerAddress,
      customerPoReference: finalPoReference,
      incomingPO: incomingPoDocId,
      currency: dcCurrency,
      exchangeRateToINR: Number(req.body.exchangeRateToINR || 1),
      items,
      discount: req.body.discount,
      transportationType: req.body.transportationType,
      transportationCharges: req.body.transportationCharges,
      vehicleNumber: req.body.vehicleNumber,
      packagingType: req.body.packagingType,
      packagingCharges: req.body.packagingCharges,
      otherDetails: req.body.otherDetails,
      reduceStock: shouldReduceStock,
      stockDeducted: shouldReduceStock && status !== "Cancelled",
      status: status || 'Draft',
      preparedBy: req.user?.id || req.user?._id,
      createdBy: req.user?.id || req.user?._id
    });

    // Auto-deduct inventory stock across FG, RM, BO, and Consumables if shouldReduceStock is true
    if (shouldReduceStock && dc.status !== "Cancelled") {
      await deductSalesItemsStock(req, items, {
        companyId,
        refDocType: "DeliveryChallan",
        refDocId: dc._id,
        refDocNumber: dcNumber,
        recipientName: req.body.customerName || "Customer",
        performedBy: req.user?.id || req.user?._id
      });
    }

    res.status(201).json({ message: "DC created successfully", dc });

  } catch (error) {
    console.error("Error creating DC:", error);
    res.status(500).json({ message: error.message });
  }
};


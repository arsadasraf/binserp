import mongoose from "mongoose";
import { grnSchema, materialIssueSchema, bomSchema, inventorySchema, materialRequestSchema, vendorSchema, customerSchema, locationSchema, categorySchema, rmBoItemSchema, companyInfoSchema, jobWorkSchema, jobWorkSupplierSchema, fgGRNSchema, stockTransactionSchema } from "../../models/store/index.js";
import { userSchema } from "../../models/user/index.js";
import { deliveryChallanSchema, invoiceSchema, quotationSchema } from "../../models/sales/index.js";
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

export const getItemGRNHistory = async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const { type, id } = req.params;

    if (!id || !type) {
      return res.status(400).json({ message: "Item ID and Type are required" });
    }

    // Register referenced models for dynamic connection population
    req.getModel('Vendor', vendorSchema);
    req.getModel('Customer', customerSchema);
    req.getModel('RmBoItem', rmBoItemSchema);
    req.getModel('FGItem', fgGRNSchema);
    req.getModel('User', userSchema);

    const query = { company: companyId };
    let grns = [];

    if (type === 'rm' || type === 'raw-material' || type === 'bo' || type === 'bought-out' || type === 'consumable' || type === 'rm-bo') {
      const GRN = req.getModel('GRN', grnSchema);
      query.$or = [
        { 'items.material': id },
        { 'items.consumable': id }
      ];
      grns = await GRN.find(query)
        .populate("supplier", "name")
        .populate("customer", "name")
        .populate("receivedBy", "name userId email")
        .sort({ date: -1, createdAt: -1 })
        .limit(15)
        .lean();

      // Also include RM conversion stock transactions if any
      const StockTransaction = req.getModel('StockTransaction', stockTransactionSchema);
      const conversionTxs = await StockTransaction.find({
        company: companyId,
        item: id,
        transactionCategory: "RM_CONVERSION_INWARD"
      })
        .populate("performedBy", "name userId email")
        .sort({ timestamp: -1, createdAt: -1 })
        .limit(10)
        .lean();

      for (const tx of conversionTxs) {
        grns.push({
          _id: tx._id,
          date: tx.timestamp || tx.createdAt,
          grnNumber: tx.referenceDocNumber || "RM-CONV",
          supplier: { name: tx.recipientOrSource || "RM Conversion Vendor" },
          supplierName: tx.recipientOrSource || "RM Conversion Vendor",
          isConversion: true,
          transactionCategory: "RM_CONVERSION_INWARD",
          qcStatus: "Completed",
          receivedBy: tx.performedBy,
          items: [{
            material: id,
            quantity: tx.quantity,
            receivedQuantity: tx.quantity,
            acceptedQuantity: tx.quantity
          }]
        });
      }

      // Sort by date descending
      grns.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } else if (type === 'inhouse' || type === 'fg') {
      const FGGRN = req.getModel('FGGRN', fgGRNSchema);
      query['items.fgItem'] = id;
      grns = await FGGRN.find(query)
        .populate("receivedBy", "name userId email")
        .sort({ date: -1, createdAt: -1 })
        .limit(15)
        .lean();
    }

    res.status(200).json({ grns });
  } catch (error) {
    console.error("Error fetching item GRN history:", error);
    res.status(500).json({ message: error.message });
  }
};
// ========== JOB WORK STORE ==========


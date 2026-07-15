import mongoose from "mongoose";
import { grnSchema, materialIssueSchema, bomSchema, inventorySchema, materialRequestSchema, purchaseOrderSchema, vendorSchema, customerSchema, locationSchema, categorySchema, rmBoItemSchema, companyInfoSchema, jobWorkSchema, jobWorkSupplierSchema } from "../../models/store/index.js";
import { rfqSchema, quotationSchema, incomingPOSchema, salesOrderSchema, salesOrderDispatchHistorySchema, deliveryChallanSchema, invoiceSchema } from "../../models/sales/index.js";
import { prefixSettingsSchema } from "../../models/prefix/index.js";
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


export const getAllInvoices = async (req, res) => {
  try {
    req.getModel('Material', rmBoItemSchema);
    req.getModel('Customer', customerSchema);
    const Invoice = req.getModel('Invoice', invoiceSchema);

    const companyId = getCompanyId(req);
    console.log("Fetching Invoices for company:", companyId);

    const invoices = await Invoice.find({ company: companyId })
      .populate('items.material')
      .populate('customer')
      .sort({ createdAt: -1 });

    console.log(`Found ${invoices.length} Invoices`);

    // using 'data' key to ensure useStoreData hook picks it up correctly
    res.status(200).json({ data: invoices, count: invoices.length });
  } catch (error) {
    console.error("Error fetching Invoices:", error);
    res.status(500).json({ message: error.message });
  }
};


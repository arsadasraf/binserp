import mongoose from "mongoose";
import {
  deliveryChallanSchema,
  invoiceSchema,
  grnSchema,
  materialIssueSchema,
  bomSchema,
  inventorySchema,
  materialRequestSchema,
  purchaseOrderSchema,
  vendorSchema,
  customerSchema,
  locationSchema,
  categorySchema,
  rmBoItemSchema,
  companyInfoSchema,
  jobWorkSchema,
  jobWorkSupplierSchema,
  quotationSchema
} from "../../models/store/index.js";
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


export const getAllPOs = async (req, res) => {
  try {
    req.getModel('Material', rmBoItemSchema);
    req.getModel('Vendor', vendorSchema);
    const PurchaseOrder = req.getModel('PurchaseOrder', purchaseOrderSchema);

    const companyId = getCompanyId(req);
    const pos = await PurchaseOrder.find({ company: companyId })
      .populate("vendor", "name code email phone")
      .populate("material", "name code")
      .populate("items.material", "name code")
      .sort({ createdAt: -1 });

    // Add vendorName for easier frontend display
    const posWithVendorName = pos.map(po => {
      const poObj = po.toObject();
      if (poObj.vendor) {
        poObj.vendorName = poObj.vendor.name;
      }
      return poObj;
    });

    res.status(200).json({ pos: posWithVendorName, count: pos.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


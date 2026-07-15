import mongoose from "mongoose";
import { grnSchema, materialIssueSchema, bomSchema, inventorySchema, materialRequestSchema, purchaseOrderSchema, vendorSchema, customerSchema, locationSchema, categorySchema, rmBoItemSchema, companyInfoSchema, jobWorkSchema, jobWorkSupplierSchema, fgGRNSchema } from "../../models/store/index.js";
import { deliveryChallanSchema, invoiceSchema, quotationSchema } from "../../models/sales/index.js";
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


export const getItemGRNHistory = async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const { type, id } = req.params;

    if (!id || !type) {
      return res.status(400).json({ message: "Item ID and Type are required" });
    }

    const query = { company: companyId };
    let grns = [];

    if (type === 'bo') {
      const GRN = req.getModel('GRN', grnSchema);
      query['items.material'] = id;
      grns = await GRN.find(query)
        .populate("supplier", "name")
        .populate("customer", "name")
        .sort({ date: -1, createdAt: -1 })
        .limit(5);
    } else if (type === 'inhouse') {
      const FGGRN = req.getModel('FGGRN', fgGRNSchema);
      query['items.fgItem'] = id;
      grns = await FGGRN.find(query)
        .sort({ date: -1, createdAt: -1 })
        .limit(5);
    }

    res.status(200).json({ grns });
  } catch (error) {
    console.error("Error fetching item GRN history:", error);
    res.status(500).json({ message: error.message });
  }
};
// ========== JOB WORK STORE ==========


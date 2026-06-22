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
  materialSchema,
  companyInfoSchema,
  jobWorkSchema,
  jobWorkSupplierSchema,
  quotationSchema
} from "../../models/store/index.js";
import { prefixSettingsSchema } from "../../models/prefix.model.js";
import { componentSchema, jobSchema, processSchema } from "../../models/ppc.model.js";
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


export const getAllGRNs = async (req, res) => {
  const GRN = req.getModel('GRN', grnSchema);
  // Ensure referenced models are registered for population
  req.getModel('Vendor', vendorSchema);
  req.getModel('Customer', customerSchema);
  req.getModel('Material', materialSchema);
  req.getModel('Component', componentSchema);

  try {
    const companyId = getCompanyId(req);
    const grns = await GRN.find({ company: companyId })
      .populate("receivedBy", "name userId")
      .populate("supplier", "name code")
      .populate("customer", "name code")
      .populate("items.material", "name code category")
      .populate("items.component", "componentName componentCode")
      .sort({ createdAt: -1 });

    // Sign photos and pdfs for preview
    const signedGrns = await Promise.all(grns.map(async (grn) => {
      const grnObj = grn.toObject();
      if (grnObj.photos && grnObj.photos.length > 0) grnObj.photos = await signPhotos(grnObj.photos);
      if (grnObj.pdf) grnObj.pdf = (await signPhotos([grnObj.pdf]))[0];
      return grnObj;
    }));

    res.status(200).json({ grns: signedGrns, count: signedGrns.length });
  } catch (error) {
    console.error("Error in getAllGRNs:", error);
    res.status(500).json({ message: error.message });
  }
};

// ========== MATERIAL ISSUE ==========



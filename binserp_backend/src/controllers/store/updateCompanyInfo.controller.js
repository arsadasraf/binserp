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


export const updateCompanyInfo = async (req, res) => {
  try {
    const CompanyInfo = req.getModel('CompanyInfo', companyInfoSchema);

    const companyId = getCompanyId(req);
    let updateData = { ...req.body, company: companyId };

    // Parse nested objects if they come as strings (FormData)
    if (typeof updateData.bankDetails === 'string') {
      try { updateData.bankDetails = JSON.parse(updateData.bankDetails); } catch (e) { }
    }
    if (typeof updateData.printSettings === 'string') {
      try { updateData.printSettings = JSON.parse(updateData.printSettings); } catch (e) { }
    }

    if (req.file) {
      const logo = await uploadOnS3(req.file.path, "logos", getCompanyLoginId(req));
      if (logo) {
        updateData.logo = logo.secure_url;
      }
    }

    const info = await CompanyInfo.findOneAndUpdate(
      { company: companyId },
      updateData,
      { new: true, upsert: true }
    );
    res.status(200).json({ message: "Company info updated successfully", info });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// ========== DELIVERY CHALLAN (DC) ==========


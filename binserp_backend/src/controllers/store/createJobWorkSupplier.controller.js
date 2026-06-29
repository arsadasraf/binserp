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


export const createJobWorkSupplier = async (req, res) => {
  try {
    const JobWorkSupplier = req.getModel('JobWorkSupplier', jobWorkSupplierSchema);

    const companyId = getCompanyId(req);
    let { name, code, ...otherData } = req.body;

    if (!name) return res.status(400).json({ message: "Name is required" });

    if (!code) {
      const PrefixSettings = req.getModel("PrefixSettings", prefixSettingsSchema);
      const settings = await PrefixSettings.findOne() || new PrefixSettings();
      const prefix = settings.jobWorkSupplierPrefix || "JWS";
      
      const lastSupplier = await JobWorkSupplier.findOne({ company: companyId, code: { $regex: new RegExp(`^${prefix}`) } }).sort({ code: -1 });
      
      let nextNumber = 1;
      if (lastSupplier && lastSupplier.code) {
        const match = lastSupplier.code.match(/\d+$/);
        if (match) {
          nextNumber = parseInt(match[0], 10) + 1;
        }
      }
      code = `${prefix}-${nextNumber.toString().padStart(3, '0')}`;
    }

    // Ensure robust bank details mapping
    const formattedBankDetails = otherData.bankDetails ? {
      accountNumber: otherData.bankDetails.accountNumber || "",
      ifscCode: otherData.bankDetails.ifscCode || "",
      bankName: otherData.bankDetails.bankName || "",
      branchName: otherData.bankDetails.branchName || otherData.bankDetails.branch || "", // Handle both keys
    } : {};

    const supplier = await JobWorkSupplier.create({
      ...otherData,
      name,
      code,
      bankDetails: formattedBankDetails,
      company: companyId
    });
    res.status(201).json({ message: "Job-Work Supplier created successfully", supplier });
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ message: "Code already exists" });
    res.status(500).json({ message: error.message });
  }
};


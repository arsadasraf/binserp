import mongoose from "mongoose";
import { grnSchema, materialIssueSchema, bomSchema, inventorySchema, materialRequestSchema, vendorSchema, customerSchema, locationSchema, categorySchema, rmBoItemSchema, companyInfoSchema, jobWorkSchema, jobWorkSupplierSchema } from "../../models/store/index.js";
import { deliveryChallanSchema, invoiceSchema, quotationSchema } from "../../models/sales/index.js";
import { storePrefixSchema } from "../../models/store/index.js";
import { componentSchema, jobSchema, processSchema } from "../../models/ppc/index.js";
import { uploadOnS3, deleteFromS3, signPhotos } from "../../utils/s3.js";
import { validateMasterUniqueness, formatDuplicateKeyError, generateUniqueMasterCode } from "../../utils/duplicateValidator.helper.js";
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

    if (!name || !name.toString().trim()) {
      return res.status(400).json({ message: "Name is required" });
    }
    const cleanName = name.toString().trim();

    // Auto-generate code if not provided or empty
    if (!code || !code.toString().trim()) {
      const StorePrefix = req.getModel("StorePrefix", storePrefixSchema);
      const settings = (await StorePrefix.findOne({ company: companyId })) || (await StorePrefix.findOne()) || new StorePrefix();
      const rawPrefix = settings.jobWorkSupplierPrefix || "JWS";
      code = await generateUniqueMasterCode({
        Model: JobWorkSupplier,
        companyId,
        prefix: rawPrefix,
        padLength: 3
      });
    } else {
      code = code.toString().trim().toUpperCase();
    }

    // Pre-validate uniqueness
    const uniqueness = await validateMasterUniqueness({
      Model: JobWorkSupplier,
      companyId,
      name: cleanName,
      code,
      masterLabel: "Job-Work Supplier"
    });
    if (uniqueness.isDuplicate) {
      return res.status(400).json({ message: uniqueness.message });
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
      name: cleanName,
      code,
      bankDetails: formattedBankDetails,
      company: companyId
    });
    res.status(201).json({ message: "Job-Work Supplier created successfully", supplier });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        message: formatDuplicateKeyError(error, { masterLabel: "Job-Work Supplier", cleanName: req.body?.name })
      });
    }
    res.status(500).json({ message: error.message });
  }
};


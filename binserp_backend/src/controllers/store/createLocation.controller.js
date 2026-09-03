import mongoose from "mongoose";
import { grnSchema, materialIssueSchema, bomSchema, inventorySchema, materialRequestSchema, vendorSchema, customerSchema, locationSchema, categorySchema, rmBoItemSchema, companyInfoSchema, jobWorkSchema, jobWorkSupplierSchema } from "../../models/store/index.js";
import { deliveryChallanSchema, invoiceSchema, quotationSchema } from "../../models/sales/index.js";
import { storePrefixSchema } from "../../models/store/index.js";
import { componentSchema, jobSchema, processSchema } from "../../models/ppc/index.js";
import { uploadOnS3, deleteFromS3, signPhotos } from "../../utils/s3.js";
import { getUserAudit } from "../../utils/userAudit.helper.js";
import { validateMasterUniqueness, formatDuplicateKeyError } from "../../utils/duplicateValidator.helper.js";
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


export const createLocation = async (req, res) => {
  try {
    const Location = req.getModel('Location', locationSchema);

    const companyId = getCompanyId(req);
    const { userId, userName } = getUserAudit(req);
    let { code, name } = req.body;

    if (!name || !name.toString().trim()) {
      return res.status(400).json({ message: "Location name is required" });
    }
    const cleanName = name.toString().trim();

    // Pre-validate uniqueness
    const uniqueness = await validateMasterUniqueness({
      Model: Location,
      companyId,
      name: cleanName,
      code,
      masterLabel: "Location"
    });
    if (uniqueness.isDuplicate) {
      return res.status(400).json({ message: uniqueness.message });
    }

    if (!code) {
      const prefix = cleanName.substring(0, 3).toUpperCase();
      const random = Math.floor(1000 + Math.random() * 9000);
      code = `LOC-${prefix}-${random}`;
    }

    const location = await Location.create({
      ...req.body,
      name: cleanName,
      code,
      company: companyId,
      createdBy: userId,
      createdByName: userName,
      updatedBy: userId,
      updatedByName: userName
    });
    res.status(201).json({ message: "Location created successfully", location });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        message: formatDuplicateKeyError(error, { masterLabel: "Location", cleanName: req.body?.name })
      });
    }
    res.status(500).json({ message: error.message });
  }
};


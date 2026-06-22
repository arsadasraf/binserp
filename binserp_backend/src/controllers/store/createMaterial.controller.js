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


export const createMaterial = async (req, res) => {
  try {
    const Material = req.getModel('Material', materialSchema);

    const companyId = getCompanyId(req);
    let { code, name, categoryId, locationId } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Material name is required" });
    }

    if (!categoryId) {
      return res.status(400).json({ message: "Category is required" });
    }

    /* 
      Robust check for valid ObjectId format to prevent CastErrors 
      passing straight to Mongoose
    */
    const isValidObjectId = (id) => /^[0-9a-fA-F]{24}$/.test(id);

    if (!isValidObjectId(categoryId)) {
      return res.status(400).json({ message: "Invalid Category ID format" });
    }

    // Optional: Check locationId too if provided
    if (locationId && !isValidObjectId(locationId) && locationId !== "") {
      // If it's an empty string, let's treat it as undefined/null
      locationId = undefined;
    }

    // Auto-generate code if not provided
    if (!code) {
      const prefix = name.substring(0, 3).toUpperCase();
      const random = Math.floor(1000 + Math.random() * 9000);
      code = `MAT-${prefix}-${random}`;
    }

    const material = await Material.create({ name, code, categoryId, locationId, company: companyId });

    // Populate category and location before sending response
    await material.populate(['categoryId', 'locationId']);

    res.status(201).json({ message: "Material created successfully", material });
  } catch (error) {
    console.error("Create Material Error:", error);
    if (error.code === 11000) {
      return res.status(400).json({ message: "Material code already exists" });
    }
    res.status(500).json({ message: error.message });
  }
};


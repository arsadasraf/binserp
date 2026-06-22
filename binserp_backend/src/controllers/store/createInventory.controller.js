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


export const createInventory = async (req, res) => {
  try {
    const Inventory = req.getModel('Inventory', inventorySchema);

    const companyId = getCompanyId(req);
    const {
      materialCode,
      materialName,
      unit,
      currentStock,
      reorderLevel,
      reorderQuantity,
      unitPrice,
      location,
    } = req.body;

    if (!materialCode || !materialName) {
      return res.status(400).json({ message: "Material code and name are required" });
    }

    const inventory = await Inventory.create({
      company: companyId,
      materialCode,
      materialName,
      unit: unit || "PCS",
      currentStock: currentStock || 0,
      reorderLevel: reorderLevel || 0,
      reorderQuantity: reorderQuantity || 0,
      unitPrice: unitPrice || 0,
      location,
    });

    res.status(201).json({ message: "Inventory created successfully", inventory });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "Material code already exists for this company" });
    }
    res.status(500).json({ message: error.message });
  }
};

// Get All Inventory

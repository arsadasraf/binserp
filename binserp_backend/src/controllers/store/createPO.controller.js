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


export const createPO = async (req, res) => {
  try {
    const PurchaseOrder = req.getModel('PurchaseOrder', purchaseOrderSchema);

    const companyId = getCompanyId(req);
    const {
      poNumber,
      date,
      vendor,
      material,
      component,
      materialName,
      quantity,
      unit,
      rate,
      amount,
      category,
      items,
      totalAmount,
      status
    } = req.body;

    // Support both single material and items array
    if (!poNumber || !vendor) {
      return res.status(400).json({ message: "PO number and vendor are required" });
    }

    // If single material provided, use it; otherwise use items array
    const poData = {
      company: companyId,
      poNumber,
      date: date || new Date(),
      vendor,
      createdBy: req.user.id,
      status: status || "Released",
    };

    // Items array format (preferred)
    if (items && items.length > 0) {
      poData.items = items;
      poData.totalAmount = totalAmount || items.reduce((sum, item) => sum + (item.amount || 0), 0);
    }
    // Single material format fallback
    else if (material || component || materialName) {
      poData.material = material;
      poData.component = component;
      poData.materialName = materialName;
      poData.quantity = quantity;
      poData.unit = unit;
      poData.rate = rate;
      poData.amount = amount;
      poData.category = category;
      poData.totalAmount = amount || (quantity * rate);
    } else {
      return res.status(400).json({ message: "Either items array or single material details are required" });
    }

    const po = await PurchaseOrder.create(poData);

    // Populate vendor details for response
    await po.populate("vendor", "name code email");
    await po.populate("RmBoItem", "name code");

    res.status(201).json({ message: "Purchase Order created successfully", po });
  } catch (error) {
    console.error("Create PO error:", error);
    res.status(500).json({ message: error.message });
  }
};


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
  quotationSchema,
  fgItemSchema
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


export const createMaterialRequest = async (req, res) => {
  try {
    const MaterialRequest = req.getModel('MaterialRequest', materialRequestSchema);
      const Material = req.getModel('Material', materialSchema);
      const FGItem = req.getModel('FGItem', fgItemSchema);

    const companyId = getCompanyId(req);
    let { requestNumber, department, items, priority, type } = req.body;

    if (!requestNumber) {
      requestNumber = `PR-${Date.now()}`;
    }

    if (!items || items.length === 0) {
      return res.status(400).json({
        message: "Items are required",
      });
    }

    const processedItems = [];
    const isInhouse = type === 'inhouse';

    for (const item of items) {
      if (isInhouse) {
        // Inhouse Logic: Validate against Component
        const componentId = item.component || item._id || item.material; // Allow various keys from frontend
        if (!componentId) {
          return res.status(400).json({ message: "Component ID is required for Inhouse request" });
        }

        const componentDoc = await FGItem.findById(componentId);
        if (!componentDoc) {
          return res.status(400).json({ message: `FG Item not found: ${componentId}` });
        }

        processedItems.push({
          ...item,
          component: componentDoc._id,
          materialName: componentDoc.name,
          materialCode: componentDoc.code,
          quantity: Number(item.quantity),
          unit: item.unit || componentDoc.unit || "Nos"
        });
      } else {
        // BO Logic (Existing Material Logic)
        // If code is missing, try to find it
        if (!item.materialCode) {
          let materialDoc;

          // Try by ID first if available
          if (item.material || item.materialId) {
            materialDoc = await Material.findById(item.material || item.materialId);
          }

          // If not found by ID, try by name
          if (!materialDoc && item.materialName) {
            materialDoc = await Material.findOne({ company: companyId, name: item.materialName });
          }

          if (materialDoc) {
            processedItems.push({
              ...item,
              materialCode: materialDoc.code,
              materialName: materialDoc.name, // Ensure accurate name
              material: materialDoc._id // Save reference if schema supports it
            });
          } else {
            return res.status(400).json({ message: `Material not found in master: ${item.materialName}` });
          }
        } else {
          processedItems.push(item);
        }
      }
    }

    const materialRequest = await MaterialRequest.create({
      company: companyId,
      requestNumber,
      requestedBy: req.user.id,
      department,
      type: type || 'bo',
      items: processedItems,
      priority: priority || "Medium",
      status: "Pending",
    });

    res.status(201).json({
      message: "Material request created successfully",
      materialRequest,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get All Material Requests

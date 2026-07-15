import { updateInventoryStock } from './updateInventoryStock.controller.js';
import mongoose from "mongoose";
import { grnSchema, materialIssueSchema, bomSchema, inventorySchema, materialRequestSchema, purchaseOrderSchema, vendorSchema, customerSchema, locationSchema, categorySchema, rmBoItemSchema, companyInfoSchema, jobWorkSchema, jobWorkSupplierSchema, fgItemSchema, rmInventoryMonthlySchema, fgInventoryMonthlySchema } from "../../models/store/index.js";
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

// Helper function to update FGItem stock (InHouse)
const updateFGItemStock = async (req, componentId, quantity) => {
  try {
    const companyId = getCompanyId(req); // Derive companyId from req
    const FGItem = req.getModel("FGItem", fgItemSchema);
    const component = await FGItem.findById(componentId);
    if (!component) {
      console.error(`FG Item not found: ${componentId}`);
      return null;
    }

    // Update quantity
    await FGItem.findByIdAndUpdate(componentId, {
      $inc: { quantity: quantity }
    });

    return true;
  } catch (error) {
    console.error("Error updating component stock:", error);
    throw error;
  }
};



// ========== GRN (Goods Receipt Note) ==========


export const createMaterialIssue = async (req, res) => {
  try {
    const MaterialIssue = req.getModel('MaterialIssue', materialIssueSchema);
      const Material = req.getModel('RmBoItem', rmBoItemSchema);
      const FGItem = req.getModel('FGItem', fgItemSchema);

    const companyId = getCompanyId(req);
    const { issueNumber, date, department, issuedTo, items, status, type } = req.body;

    console.log(`>>> [createMaterialIssue] Start. Status: ${status}, Type: ${type}, Items: ${items?.length}`);

    if (!issueNumber || !department || !items || items.length === 0) {
      return res.status(400).json({ message: "Issue number, department, and items are required" });
    }

    const processedItems = [];
    const isInhouse = type === 'inhouse';

    for (const item of items) {
      if (isInhouse) {
        // Inhouse Logic
        const compId = item.component || item.material || item._id; // Frontend flexibility
        if (!compId) return res.status(400).json({ message: "Component ID is required" });

        const compDoc = await FGItem.findById(compId);
        if (!compDoc) return res.status(400).json({ message: `FG Item not found: ${compId}` });

        processedItems.push({
          ...item,
          component: compDoc._id,
          materialName: compDoc.name,
          quantity: Number(item.quantity)
        });
      } else {
        // BO Logic
        let materialId = item.material?._id || item.material; // Handle object or ID

        // If no ID provided, try to find by name (fallback)
        if (!materialId && item.materialName) {
          const mat = await Material.findOne({ company: companyId, name: item.materialName });
          if (mat) materialId = mat._id;
        }

        if (!materialId) {
          return res.status(400).json({ message: `Material not found: ${item.materialName}` });
        }

        // Fetch material to get code
        let materialDoc = await Material.findById(materialId);

        // Fallback: If not found by ID (or ID was invalid/subdoc), try by Name
        if (!materialDoc && item.materialName) {
          console.log(`>>> [createMaterialIssue] Material not found by ID ${materialId}. Trying Name: ${item.materialName}`);
          materialDoc = await Material.findOne({ company: companyId, name: item.materialName });
          if (materialDoc) materialId = materialDoc._id;
        }

        if (!materialDoc) {
          return res.status(400).json({ message: `Material not found: ${item.materialName}` });
        }

        processedItems.push({
          ...item,
          material: materialId,
          materialCode: materialDoc ? materialDoc.code : (item.materialCode || ''),
          materialName: materialDoc ? materialDoc.name : item.materialName,
          quantity: Number(item.quantity) // Ensure Number
        });
      }
    }

    const materialIssue = await MaterialIssue.create({
      company: companyId,
      issueNumber,
      type: type || 'bo', // Save type
      date: date || new Date(),
      department,
      issuedTo,
      items: processedItems,
      issuedBy: req.user.id,
      status: status || "Draft",
    });

    // Auto-update inventory when material is issued
    if (status === "Issued") {
      console.log(`>>> [createMaterialIssue] Status is Issued. Updating Stock...`);
      const currentDate = new Date();
      const currentMonthStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
      
      const RMInventoryMonthly = req.getModel('RMInventoryMonthly', rmInventoryMonthlySchema);
      const FGInventoryMonthly = req.getModel('FGInventoryMonthly', fgInventoryMonthlySchema);

      for (const item of processedItems) {
        if (isInhouse) {
          await updateFGItemStock(req, item.component, -item.quantity);
          
          try {
            await FGInventoryMonthly.findOneAndUpdate(
              { company: companyId, fgItem: item.component, month: currentMonthStr },
              { $inc: { totalOutwardQuantity: item.quantity } },
              { new: true, upsert: true }
            );
          } catch (monthlyErr) {
            console.error("Error updating FG monthly outward quantity:", monthlyErr);
          }
        } else {
          await updateInventoryStock(
            req,
            item.material, // Correct: Use ID
            -item.quantity, // Negative to decrement
            item.unit || "PCS"
          );
          
          try {
            await RMInventoryMonthly.findOneAndUpdate(
              { company: companyId, material: item.material, month: currentMonthStr },
              { $inc: { totalOutwardQuantity: item.quantity } },
              { new: true, upsert: true }
            );
          } catch (monthlyErr) {
            console.error("Error updating RM monthly outward quantity:", monthlyErr);
          }
        }
      }
    }

    res.status(201).json({ message: "Material issue created successfully", materialIssue });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update Material Issue status and update inventory

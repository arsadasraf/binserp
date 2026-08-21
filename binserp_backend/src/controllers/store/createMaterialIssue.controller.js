import { updateInventoryStock } from './updateInventoryStock.controller.js';
import { recordStockTransaction } from "../../services/stockTransaction.service.js";
import mongoose from "mongoose";

import { grnSchema, materialIssueSchema, bomSchema, inventorySchema, materialRequestSchema, vendorSchema, customerSchema, locationSchema, categorySchema, rmBoItemSchema, companyInfoSchema, jobWorkSchema, jobWorkSupplierSchema, fgItemSchema, rmInventoryMonthlySchema, fgInventoryMonthlySchema, consumableItemSchema } from "../../models/store/index.js";
import { deliveryChallanSchema, invoiceSchema, quotationSchema } from "../../models/sales/index.js";
import { mrpPlanSchema } from "../../models/purchase/index.js";
import { storePrefixSchema } from "../../models/store/index.js";
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
    const compDoc = await FGItem.findById(componentId);
    if (!compDoc) {
      console.warn(`[updateFGItemStock] Component not found with ID: ${componentId}`);
      return false;
    }

    const previousStock = compDoc.quantity || 0;
    const newStock = Math.max(0, previousStock - quantity);

    console.log(`[updateFGItemStock] Component: ${compDoc.name}, Previous Stock: ${previousStock}, New Stock: ${newStock}`);

    await FGItem.findByIdAndUpdate(componentId, {
      $set: { quantity: newStock },
    });

    return true;
  } catch (error) {
    console.error("Error updating component stock:", error);
    throw error;
  }
};

export const createMaterialIssue = async (req, res) => {
  try {
    const MaterialIssue = req.getModel('MaterialIssue', materialIssueSchema);
    const Material = req.getModel('RmBoItem', rmBoItemSchema);
    const FGItem = req.getModel('FGItem', fgItemSchema);
    const ConsumableItem = req.getModel('ConsumableItem', consumableItemSchema);
    const MRPPlan = req.getModel('MRPPlan', mrpPlanSchema);

    const companyId = getCompanyId(req);
    const { issueNumber, date, department, issuedTo, items, status, type, mrpPlan, mrpNumber } = req.body;

    console.log(`>>> [createMaterialIssue] Start. Status: ${status}, Type: ${type}, Items: ${items?.length}`);

    if (!issueNumber || !department || !items || items.length === 0) {
      return res.status(400).json({ message: "Issue number, department, and items are required" });
    }

    const processedItems = [];
    const isInhouse = type === 'inhouse' || type === 'fg';
    const isConsumable = type === 'consumable';

    for (const item of items) {
      if (isConsumable) {
        // Consumable Logic
        let consumableId = item.consumable || item.material?._id || item.material || item._id;
        let consumableDoc;

        if (consumableId) {
          consumableDoc = await ConsumableItem.findById(consumableId);
        }
        if (!consumableDoc && item.materialName) {
          consumableDoc = await ConsumableItem.findOne({ company: companyId, name: item.materialName });
        }

        if (consumableDoc) {
          processedItems.push({
            ...item,
            consumable: consumableDoc._id,
            material: consumableDoc._id,
            materialCode: consumableDoc.code || item.materialCode || '',
            materialName: consumableDoc.name,
            quantity: Number(item.quantity),
            unit: item.unit || consumableDoc.unit || "PCS"
          });
        } else {
          processedItems.push({
            ...item,
            material: consumableId,
            materialName: item.materialName,
            materialCode: item.materialCode || '',
            quantity: Number(item.quantity),
            unit: item.unit || "PCS"
          });
        }
      } else if (isInhouse) {
        // Inhouse Logic
        const compId = item.component || item.material || item._id; // Frontend flexibility
        if (!compId) return res.status(400).json({ message: "Component ID is required" });

        let compDoc = await FGItem.findById(compId);
        if (!compDoc) {
          const Component = req.getModel('Component', componentSchema);
          compDoc = await Component.findById(compId);
        }
        if (!compDoc) return res.status(400).json({ message: `FG Item/Component not found: ${compId}` });

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
      type: type || 'bo',
      date: date || new Date(),
      department,
      issuedTo,
      mrpPlan: mrpPlan || undefined,
      mrpNumber: mrpNumber || undefined,
      items: processedItems,
      issuedBy: req.user.id,
      status: status || "Draft",
    });

    // Auto-update MRP Plan status to In Production if issued against an MRP plan
    if (status === "Issued" && (mrpPlan || mrpNumber)) {
      try {
        const query = { company: companyId };
        if (mrpPlan) query._id = mrpPlan;
        else if (mrpNumber) query.mrpNumber = mrpNumber;

        const plan = await MRPPlan.findOne(query);
        if (plan && (plan.status === 'Planned' || plan.status === 'Draft')) {
          plan.status = 'In Production';
          await plan.save();
        }
      } catch (err) {
        console.error("Error updating MRP plan status on issue:", err);
      }
    }

    if (status === "Issued") {
      console.log(`>>> [createMaterialIssue] Status is Issued. Updating Stock...`);
      const currentDate = new Date();
      const currentMonthStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
      
      const RMInventoryMonthly = req.getModel('RMInventoryMonthly', rmInventoryMonthlySchema);
      const FGInventoryMonthly = req.getModel('FGInventoryMonthly', fgInventoryMonthlySchema);

      for (const item of processedItems) {
        if (isInhouse) {
          const compDoc = await FGItem.findById(item.component);
          const previousStock = compDoc ? (compDoc.quantity || 0) : 0;
          const newStock = Math.max(0, previousStock - item.quantity);

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

          await recordStockTransaction(req, {
            itemType: "FGItem",
            item: item.component,
            itemName: item.materialName,
            unit: item.unit || "Nos",
            movementType: "OUTWARD",
            transactionCategory: "MATERIAL_ISSUE_FG_OUTWARD",
            quantity: item.quantity,
            previousStock,
            newStock,
            referenceDocType: "MaterialIssue",
            referenceDocId: materialIssue._id,
            referenceDocNumber: issueNumber,
            recipientOrSource: department || "Shop Floor",
            purpose: item.purpose || "Shop Floor Assembly Issue",
            performedBy: req.user?.id || req.user?._id,
          });
        } else {
          await updateInventoryStock(
            req,
            item.material, // Correct: Use ID
            -item.quantity, // Negative to decrement
            item.unit || "PCS",
            undefined,
            {
              transactionCategory: "MATERIAL_ISSUE_SHOPFLOOR_OUTWARD",
              referenceDocType: "MaterialIssue",
              referenceDocId: materialIssue._id,
              referenceDocNumber: issueNumber,
              recipientOrSource: department || "Shop Floor",
              purpose: item.purpose || "Shop Floor Production Issue",
              performedBy: req.user?.id || req.user?._id,
            }
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

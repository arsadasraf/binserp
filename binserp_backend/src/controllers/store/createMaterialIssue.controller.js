import { updateInventoryStock } from './updateInventoryStock.controller.js';
import { recordStockTransaction } from "../../services/stockTransaction.service.js";
import mongoose from "mongoose";

import {
  grnSchema,
  materialIssueSchema,
  bomSchema,
  inventorySchema,
  materialRequestSchema,
  vendorSchema,
  customerSchema,
  locationSchema,
  categorySchema,
  rawMaterialSchema,
  boughtOutSchema,
  rmBoItemSchema,
  companyInfoSchema,
  jobWorkSchema,
  jobWorkSupplierSchema,
  fgItemSchema,
  rmInventoryMonthlySchema,
  fgInventoryMonthlySchema,
  consumableItemSchema
} from "../../models/store/index.js";
import { deliveryChallanSchema, invoiceSchema, quotationSchema } from "../../models/sales/index.js";
import { mrpPlanSchema } from "../../models/purchase/index.js";
import { storePrefixSchema } from "../../models/store/index.js";
import { componentSchema, jobSchema, processSchema } from "../../models/ppc/index.js";
import { uploadOnS3, deleteFromS3, signPhotos } from "../../utils/s3.js";
import fs from 'fs';
import path from 'path';
import { userSchema } from "../../models/user/index.js";

import { getUserAudit } from "../../utils/userAudit.helper.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

const getCompanyLoginId = (req) => {
  return req.company?.companyId || req.user?.companyId || req.user?.company?.companyId || "";
};

const isValidObjectId = (id) => typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);

// Helper function to update FGItem stock (InHouse)
const updateFGItemStock = async (req, componentId, quantityToDeduct) => {
  try {
    const companyId = getCompanyId(req);
    const FGItem = req.getModel("FGItem", fgItemSchema);
    const compDoc = await FGItem.findById(componentId);
    if (!compDoc) {
      console.warn(`[updateFGItemStock] FG Item not found with ID: ${componentId}`);
      return false;
    }

    const previousStock = compDoc.quantity || 0;
    const newStock = Math.max(0, previousStock - Math.abs(quantityToDeduct));

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
    const RawMaterial = req.getModel('RawMaterial', rawMaterialSchema);
    const BoughtOut = req.getModel('BoughtOut', boughtOutSchema);
    const RmBoItem = req.getModel('RmBoItem', rmBoItemSchema);
    const FGItem = req.getModel('FGItem', fgItemSchema);
    const ConsumableItem = req.getModel('ConsumableItem', consumableItemSchema);
    const Component = req.getModel('Component', componentSchema);
    const MRPPlan = req.getModel('MRPPlan', mrpPlanSchema);

    const companyId = getCompanyId(req);
    const { userId, userName } = getUserAudit(req);
    let { issueNumber, date, department, issuedTo, items, status, type, mrpPlan, mrpNumber } = req.body;

    console.log(`>>> [createMaterialIssue] Start. Status: ${status}, Type: ${type}, Items: ${items?.length}`);

    if (!department) {
      department = 'General Store';
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Items are required for material issue" });
    }

    // Auto-generate or deduplicate issueNumber
    if (!issueNumber) {
      issueNumber = `ISS-${Date.now()}`;
    } else {
      const existingIssue = await MaterialIssue.findOne({ company: companyId, issueNumber });
      if (existingIssue) {
        issueNumber = `${issueNumber}-${Date.now().toString().slice(-4)}`;
      }
    }

    // Resolve issuedTo ID
    const validIssuedTo = issuedTo && (typeof issuedTo === 'object' ? (issuedTo._id || issuedTo.id) : issuedTo);
    const finalIssuedTo = validIssuedTo && isValidObjectId(validIssuedTo.toString()) ? validIssuedTo.toString() : undefined;

    const processedItems = [];
    const normalizedType = (type || 'rm').toLowerCase();
    const isInhouse = normalizedType === 'inhouse' || normalizedType === 'fg';
    const isConsumable = normalizedType === 'consumable';

    for (const item of items) {
      const cleanName = (item.materialName || item.name || '').toString().trim();
      const rawId = item.material?._id || item.material || item.consumable?._id || item.consumable || item.component?._id || item.component || item.fgItem?._id || item.fgItem;
      const validId = rawId && isValidObjectId(rawId.toString()) ? rawId.toString() : null;

      if (isConsumable) {
        // Consumable Logic
        let consumableDoc = null;
        if (validId) {
          consumableDoc = await ConsumableItem.findOne({ _id: validId, company: companyId });
        }
        if (!consumableDoc && (item.materialCode || item.code)) {
          consumableDoc = await ConsumableItem.findOne({ company: companyId, code: item.materialCode || item.code });
        }
        if (!consumableDoc && cleanName) {
          consumableDoc = await ConsumableItem.findOne({
            company: companyId,
            name: { $regex: new RegExp(`^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
          });
        }

        const resolvedId = consumableDoc?._id || validId;
        if (!resolvedId && !cleanName) {
          return res.status(400).json({ message: `Consumable item details missing` });
        }

        processedItems.push({
          ...item,
          consumable: resolvedId,
          material: resolvedId,
          materialCode: consumableDoc?.code || item.materialCode || '',
          materialName: consumableDoc?.name || cleanName || 'Consumable Item',
          quantity: Number(item.quantity) || 1,
          unit: item.unit || consumableDoc?.unit || "PCS"
        });
      } else if (isInhouse) {
        // Inhouse / FG Logic
        let compDoc = null;
        if (validId) {
          compDoc = await FGItem.findOne({ _id: validId, company: companyId });
          if (!compDoc) compDoc = await Component.findOne({ _id: validId, company: companyId });
        }
        if (!compDoc && (item.materialCode || item.code)) {
          compDoc = await FGItem.findOne({ company: companyId, code: item.materialCode || item.code });
          if (!compDoc) compDoc = await Component.findOne({ company: companyId, code: item.materialCode || item.code });
        }
        if (!compDoc && cleanName) {
          compDoc = await FGItem.findOne({
            company: companyId,
            name: { $regex: new RegExp(`^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
          });
          if (!compDoc) {
            compDoc = await Component.findOne({
              company: companyId,
              name: { $regex: new RegExp(`^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
            });
          }
        }

        const resolvedCompId = compDoc?._id || validId;
        if (!resolvedCompId && !cleanName) {
          return res.status(400).json({ message: `FG Item / Component not found: ${cleanName || 'Unknown'}` });
        }

        processedItems.push({
          ...item,
          component: resolvedCompId,
          fgItem: resolvedCompId,
          material: resolvedCompId,
          materialCode: compDoc?.code || item.materialCode || '',
          materialName: compDoc?.name || cleanName || 'FG Item',
          quantity: Number(item.quantity) || 1,
          unit: item.unit || compDoc?.unit || "Nos"
        });
      } else {
        // Raw Material (RM) / Bought Out (BO) Logic
        let materialDoc = null;
        if (validId) {
          materialDoc = await RawMaterial.findOne({ _id: validId, company: companyId });
          if (!materialDoc) materialDoc = await BoughtOut.findOne({ _id: validId, company: companyId });
          if (!materialDoc) materialDoc = await RmBoItem.findOne({ _id: validId, company: companyId });
        }
        if (!materialDoc && (item.materialCode || item.code)) {
          materialDoc = await RawMaterial.findOne({ company: companyId, code: item.materialCode || item.code });
          if (!materialDoc) materialDoc = await BoughtOut.findOne({ company: companyId, code: item.materialCode || item.code });
          if (!materialDoc) materialDoc = await RmBoItem.findOne({ company: companyId, code: item.materialCode || item.code });
        }
        if (!materialDoc && cleanName) {
          materialDoc = await RawMaterial.findOne({
            company: companyId,
            name: { $regex: new RegExp(`^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
          });
          if (!materialDoc) {
            materialDoc = await BoughtOut.findOne({
              company: companyId,
              name: { $regex: new RegExp(`^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
            });
          }
          if (!materialDoc) {
            materialDoc = await RmBoItem.findOne({
              company: companyId,
              name: { $regex: new RegExp(`^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
            });
          }
        }

        const resolvedMaterialId = materialDoc?._id || validId;
        if (!resolvedMaterialId && !cleanName) {
          return res.status(400).json({ message: `Material not found: ${cleanName || 'Unknown'}` });
        }

        processedItems.push({
          ...item,
          material: resolvedMaterialId,
          materialCode: materialDoc?.code || item.materialCode || '',
          materialName: materialDoc?.name || cleanName || 'Material',
          quantity: Number(item.quantity) || 1,
          unit: item.unit || materialDoc?.unit || "PCS"
        });
      }
    }

    const materialIssue = await MaterialIssue.create({
      company: companyId,
      issueNumber,
      type: normalizedType || 'rm',
      date: date || new Date(),
      department,
      issuedTo: finalIssuedTo,
      mrpPlan: mrpPlan || undefined,
      mrpNumber: mrpNumber || undefined,
      items: processedItems,
      issuedBy: req.user.id,
      status: status || "Draft",
      createdBy: userId,
      createdByName: userName,
      updatedBy: userId,
      updatedByName: userName
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

      // Resolve requested user's name from issuedTo
      let requestedUserName = "";
      if (issuedTo && mongoose.Types.ObjectId.isValid(issuedTo)) {
        try {
          const User = req.getModel('User', userSchema);
          const userDoc = await User.findById(issuedTo);
          if (userDoc) {
            requestedUserName = userDoc.name || userDoc.username || "";
          }
        } catch (uErr) {
          console.warn("Could not resolve requested user in createMaterialIssue:", uErr);
        }
      }

      const issueDestination = requestedUserName 
        ? `Shop Floor (${requestedUserName})` 
        : (!department || department.toLowerCase() === 'store' ? "Shop Floor" : `Shop Floor (${department})`);

      for (const item of processedItems) {
        if (isInhouse) {
          const compDoc = await FGItem.findById(item.component);
          const previousStock = compDoc ? (compDoc.quantity || 0) : 0;
          const newStock = Math.max(0, previousStock - item.quantity);

          await updateFGItemStock(req, item.component, item.quantity);
          
          try {
            await FGInventoryMonthly.findOneAndUpdate(
              { company: companyId, fgItem: item.component, month: currentMonthStr },
              { $inc: { totalOutwardQuantity: item.quantity } },
              { new: true, upsert: true }
            );
          } catch (monthlyErr) {
            console.error("Error updating FG monthly outward quantity:", monthlyErr);
          }

          const issuePurpose = item.purpose 
            ? `Issue to Shop Floor - ${item.purpose}` 
            : (mrpNumber ? `Issue to Shop Floor (Demand for MRP: ${mrpNumber})` : "Issue to Shop Floor (Assembly)");

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
            recipientOrSource: issueDestination,
            purpose: issuePurpose,
            performedBy: req.user?.id || req.user?._id,
          });
        } else {
          const targetMatId = isConsumable ? (item.consumable || item.material) : item.material;
          const issueItemType = isConsumable ? "Consumable" : (type === 'bo' || type === 'bought-out' ? "BoughtOut" : "RawMaterial");

          const issuePurpose = item.purpose 
            ? `Issue to Shop Floor - ${item.purpose}` 
            : (mrpNumber ? `Issue to Shop Floor (Demand for MRP: ${mrpNumber})` : (isConsumable ? "Issue to Shop Floor (Consumables)" : "Issue to Shop Floor (Production)"));

          await updateInventoryStock(
            req,
            targetMatId,
            -item.quantity, // Negative to decrement
            item.unit || "PCS",
            undefined,
            {
              itemType: issueItemType,
              transactionCategory: isConsumable ? "MATERIAL_ISSUE_CONSUMABLE_OUTWARD" : "MATERIAL_ISSUE_SHOPFLOOR_OUTWARD",
              referenceDocType: "MaterialIssue",
              referenceDocId: materialIssue._id,
              referenceDocNumber: issueNumber,
              recipientOrSource: issueDestination,
              purpose: issuePurpose,
              performedBy: req.user?.id || req.user?._id,
            }
          );
          
          try {
            await RMInventoryMonthly.findOneAndUpdate(
              { company: companyId, material: targetMatId, month: currentMonthStr },
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

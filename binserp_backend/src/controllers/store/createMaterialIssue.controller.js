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
import { validateAndResolveDualUomQuantities } from "../../utils/dualUomHelper.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

const getCompanyLoginId = (req) => {
  return req.company?.companyId || req.user?.companyId || req.user?.company?.companyId || "";
};

const isValidObjectId = (id) => typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);

// Helper to resolve dual-unit quantities and conversions using central engine
const resolveDualUnitQuantities = (item, doc, defaultUnit = "PCS") => {
  return validateAndResolveDualUomQuantities(item, doc, defaultUnit);
};

// Helper to retrieve live available stock for any store item (RM, BO, Consumable, FG, Component)
export const getItemAvailableStock = async (req, item, type = 'rm') => {
  try {
    const companyId = getCompanyId(req);
    const Inventory = req.getModel('Inventory', inventorySchema);
    const RawMaterial = req.getModel('RawMaterial', rawMaterialSchema);
    const BoughtOut = req.getModel('BoughtOut', boughtOutSchema);
    const RmBoItem = req.getModel('RmBoItem', rmBoItemSchema);
    const FGItem = req.getModel('FGItem', fgItemSchema);
    const ConsumableItem = req.getModel('ConsumableItem', consumableItemSchema);
    const Component = req.getModel('Component', componentSchema);

    const normType = (type || item.itemType || '').toLowerCase();
    const isInhouse = normType.includes('fg') || normType.includes('inhouse') || normType.includes('component');
    const isConsumable = normType.includes('consumable');

    const rawId = item.material?._id || item.material || item.consumable?._id || item.consumable || item.component?._id || item.component || item.fgItem?._id || item.fgItem || item._id;
    const validId = rawId && isValidObjectId(rawId.toString()) ? rawId.toString() : null;
    const matCode = (item.materialCode || item.code || '').trim();
    const matName = (item.materialName || item.name || '').trim();

    let availableStock = 0;
    let unit = item.unit || 'PCS';
    let description = '';

    if (isInhouse) {
      let compDoc = null;
      if (validId) compDoc = await FGItem.findOne({ _id: validId, company: companyId }) || await Component.findOne({ _id: validId, company: companyId });
      if (!compDoc && matCode) {
        compDoc = await FGItem.findOne({ company: companyId, code: matCode }) || await Component.findOne({ company: companyId, code: matCode });
      }
      if (!compDoc && matName) {
        compDoc = await FGItem.findOne({ company: companyId, name: matName }) || await Component.findOne({ company: companyId, name: matName });
      }
      availableStock = Number(compDoc?.quantity ?? compDoc?.currentStock ?? 0);
      unit = compDoc?.unit || unit;
      description = compDoc?.description || compDoc?.descriptions || '';
    } else if (isConsumable) {
      let invDoc = null;
      if (validId) invDoc = await Inventory.findOne({ company: companyId, materialId: validId });
      if (!invDoc && matCode) invDoc = await Inventory.findOne({ company: companyId, materialCode: matCode });

      let consDoc = null;
      if (validId) consDoc = await ConsumableItem.findOne({ _id: validId, company: companyId });
      if (!consDoc && matCode) consDoc = await ConsumableItem.findOne({ company: companyId, code: matCode });
      if (!consDoc && matName) consDoc = await ConsumableItem.findOne({ company: companyId, name: matName });

      if (invDoc && invDoc.currentStock !== undefined) {
        availableStock = Number(invDoc.currentStock || 0);
      } else {
        availableStock = Number(consDoc?.quantity ?? consDoc?.currentStock ?? 0);
      }
      unit = invDoc?.unit || consDoc?.unit || unit;
      description = consDoc?.descriptions || consDoc?.description || '';
    } else {
      // Raw Material or Bought Out
      let invDoc = null;
      if (validId) invDoc = await Inventory.findOne({ company: companyId, materialId: validId });
      if (!invDoc && matCode) invDoc = await Inventory.findOne({ company: companyId, materialCode: matCode });

      let matDoc = null;
      if (validId) {
        matDoc = await RawMaterial.findOne({ _id: validId, company: companyId }) ||
                 await BoughtOut.findOne({ _id: validId, company: companyId }) ||
                 await RmBoItem.findOne({ _id: validId, company: companyId });
      }
      if (!matDoc && matCode) {
        matDoc = await RawMaterial.findOne({ company: companyId, code: matCode }) ||
                 await BoughtOut.findOne({ company: companyId, code: matCode }) ||
                 await RmBoItem.findOne({ company: companyId, code: matCode });
      }
      if (!matDoc && matName) {
        matDoc = await RawMaterial.findOne({ company: companyId, name: matName }) ||
                 await BoughtOut.findOne({ company: companyId, name: matName }) ||
                 await RmBoItem.findOne({ company: companyId, name: matName });
      }

      if (invDoc && invDoc.currentStock !== undefined) {
        availableStock = Number(invDoc.currentStock || 0);
      } else {
        availableStock = Number(matDoc?.quantity ?? matDoc?.currentStock ?? 0);
      }
      unit = invDoc?.unit || matDoc?.unit || unit;
      description = matDoc?.descriptions || matDoc?.description || '';
    }

    return {
      availableStock: Math.max(0, availableStock),
      unit,
      description
    };
  } catch (err) {
    console.error("Error evaluating available stock in getItemAvailableStock:", err);
    return { availableStock: 0, unit: item.unit || 'PCS', description: '' };
  }
};

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
    let { issueNumber, date, department, issuedTo, items, status, type, mrpPlan, mrpNumber, materialRequest, requestNumber } = req.body;

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

    // Auto-resolve recipient if missing
    const finalIssuedTo = (issuedTo && isValidObjectId(issuedTo.toString())) ? issuedTo.toString() : req.user.id;

    // Inherit MRP Plan & Number from Material Request if linked and missing
    if (materialRequest && (!mrpPlan || !mrpNumber)) {
      try {
        const MaterialRequest = req.getModel('MaterialRequest', materialRequestSchema);
        const reqDoc = await MaterialRequest.findById(materialRequest);
        if (reqDoc) {
          if (!mrpPlan && reqDoc.mrpPlan) mrpPlan = reqDoc.mrpPlan;
          if (!mrpNumber && reqDoc.mrpNumber) mrpNumber = reqDoc.mrpNumber;
          if (!requestNumber && reqDoc.requestNumber) requestNumber = reqDoc.requestNumber;
        }
      } catch (err) {
        console.warn("Could not populate MRP from materialRequest in createMaterialIssue:", err);
      }
    }

    // Bidirectional MRP resolution between mrpPlan ObjectId and mrpNumber string
    if (mrpPlan && !mrpNumber) {
      try {
        const plan = await MRPPlan.findById(mrpPlan);
        if (plan && plan.mrpNumber) mrpNumber = plan.mrpNumber;
      } catch (err) {
        console.warn("Could not lookup mrpNumber from mrpPlan in createMaterialIssue:", err);
      }
    } else if (mrpNumber && !mrpPlan) {
      try {
        const plan = await MRPPlan.findOne({ company: companyId, mrpNumber: mrpNumber.trim() });
        if (plan) mrpPlan = plan._id;
      } catch (err) {
        console.warn("Could not lookup mrpPlan from mrpNumber in createMaterialIssue:", err);
      }
    }

    // Normalize type
    const normalizedType = (type || 'rm').toLowerCase();
    const isInhouse = normalizedType === 'inhouse' || normalizedType === 'in-house' || normalizedType === 'fg';
    const isConsumable = normalizedType === 'consumable';

    // Parse items if string
    let parsedItems = items;
    if (typeof items === 'string') {
      try {
        parsedItems = JSON.parse(items);
      } catch (e) {
        console.error("Failed to parse items JSON in createMaterialIssue:", e);
      }
    }

    if (!Array.isArray(parsedItems) || parsedItems.length === 0) {
      return res.status(400).json({ message: "At least one item is required for material issue" });
    }

    // Validate and process items
    const processedItems = [];

    for (const item of parsedItems) {
      const cleanName = (item.materialName || item.name || '').trim();
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

        const resolvedUnits = resolveDualUnitQuantities(item, consumableDoc, "PCS");

        processedItems.push({
          ...item,
          consumable: resolvedId,
          material: resolvedId,
          itemType: 'Consumable',
          materialCode: consumableDoc?.code || item.materialCode || '',
          materialName: consumableDoc?.name || cleanName || 'Consumable Item',
          quantity: resolvedUnits.priQty,
          unit: resolvedUnits.primaryUnit,
          hasSecondaryUnit: resolvedUnits.hasSec,
          secondaryUnit: resolvedUnits.secUnit,
          conversionFactor: resolvedUnits.convFactor,
          secondaryQuantity: resolvedUnits.secQty,
          selectedUnit: resolvedUnits.selectedUnit
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

        const resolvedUnits = resolveDualUnitQuantities(item, compDoc, "Nos");

        processedItems.push({
          ...item,
          component: resolvedCompId,
          fgItem: resolvedCompId,
          material: resolvedCompId,
          itemType: item.itemType || 'FG Item',
          materialCode: compDoc?.code || item.materialCode || '',
          materialName: compDoc?.name || cleanName || 'FG Item',
          quantity: resolvedUnits.priQty,
          unit: resolvedUnits.primaryUnit,
          hasSecondaryUnit: resolvedUnits.hasSec,
          secondaryUnit: resolvedUnits.secUnit,
          conversionFactor: resolvedUnits.convFactor,
          secondaryQuantity: resolvedUnits.secQty,
          selectedUnit: resolvedUnits.selectedUnit
        });
      } else {
        // Raw Material (RM) / Bought Out (BO) Logic
        let materialDoc = null;
        let detectedType = '';
        if (validId) {
          materialDoc = await RawMaterial.findOne({ _id: validId, company: companyId });
          if (materialDoc) detectedType = 'Raw Material';
          if (!materialDoc) {
            materialDoc = await BoughtOut.findOne({ _id: validId, company: companyId });
            if (materialDoc) detectedType = 'Bought Out';
          }
          if (!materialDoc) {
            materialDoc = await RmBoItem.findOne({ _id: validId, company: companyId });
            if (materialDoc) detectedType = materialDoc.itemType || 'Raw Material';
          }
        }
        if (!materialDoc && (item.materialCode || item.code)) {
          materialDoc = await RawMaterial.findOne({ company: companyId, code: item.materialCode || item.code });
          if (materialDoc) detectedType = 'Raw Material';
          if (!materialDoc) {
            materialDoc = await BoughtOut.findOne({ company: companyId, code: item.materialCode || item.code });
            if (materialDoc) detectedType = 'Bought Out';
          }
          if (!materialDoc) {
            materialDoc = await RmBoItem.findOne({ company: companyId, code: item.materialCode || item.code });
            if (materialDoc) detectedType = materialDoc.itemType || 'Raw Material';
          }
        }
        if (!materialDoc && cleanName) {
          materialDoc = await RawMaterial.findOne({
            company: companyId,
            name: { $regex: new RegExp(`^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
          });
          if (materialDoc) detectedType = 'Raw Material';
          if (!materialDoc) {
            materialDoc = await BoughtOut.findOne({
              company: companyId,
              name: { $regex: new RegExp(`^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
            });
            if (materialDoc) detectedType = 'Bought Out';
          }
          if (!materialDoc) {
            materialDoc = await RmBoItem.findOne({
              company: companyId,
              name: { $regex: new RegExp(`^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
            });
            if (materialDoc) detectedType = materialDoc.itemType || 'Raw Material';
          }
        }

        const resolvedMaterialId = materialDoc?._id || validId;
        if (!resolvedMaterialId && !cleanName) {
          return res.status(400).json({ message: `Material not found: ${cleanName || 'Unknown'}` });
        }

        const resolvedUnits = resolveDualUnitQuantities(item, materialDoc, "PCS");

        const rawTypeStr = (item.itemType || item.type || detectedType || '').toLowerCase();
        const codeUpper = (item.materialCode || materialDoc?.code || '').toUpperCase();
        let determinedItemType = 'Raw Material';
        if (rawTypeStr.includes('bought') || rawTypeStr === 'bo' || codeUpper.startsWith('BO-')) {
          determinedItemType = 'Bought Out';
        }

        processedItems.push({
          ...item,
          material: resolvedMaterialId,
          itemType: determinedItemType,
          materialCode: materialDoc?.code || item.materialCode || '',
          materialName: materialDoc?.name || cleanName || 'Material',
          quantity: resolvedUnits.priQty,
          unit: resolvedUnits.primaryUnit,
          hasSecondaryUnit: resolvedUnits.hasSec,
          secondaryUnit: resolvedUnits.secUnit,
          conversionFactor: resolvedUnits.convFactor,
          secondaryQuantity: resolvedUnits.secQty,
          selectedUnit: resolvedUnits.selectedUnit
        });
      }
    }

    // Strict Real-Time Stock Validation: Block issuance if available stock is insufficient or 0
    if (status === "Issued") {
      const shortages = [];

      for (const item of processedItems) {
        const stockInfo = await getItemAvailableStock(req, item, normalizedType);
        const reqQty = Number(item.quantity) || 0;
        const availStock = stockInfo.availableStock;

        if (availStock < reqQty) {
          shortages.push({
            materialId: item.material || item.component || item.consumable || item.fgItem,
            materialName: item.materialName || 'Unnamed Item',
            materialCode: item.materialCode || '',
            materialDescription: stockInfo.description || item.materialDescription || item.description || '',
            unit: item.unit || stockInfo.unit || 'PCS',
            requestedQuantity: reqQty,
            availableStock: availStock,
            shortageQuantity: Number((reqQty - availStock).toFixed(4))
          });
        }
      }

      if (shortages.length > 0) {
        console.warn(`[createMaterialIssue] BLOCKED ISSUANCE: Insufficient stock for ${shortages.length} item(s)`, shortages);
        return res.status(400).json({
          success: false,
          code: 'INSUFFICIENT_STOCK',
          message: `Cannot issue material: Insufficient stock for ${shortages.length} item(s). Available stock is less than requested quantity.`,
          shortages
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
      materialRequest: materialRequest && isValidObjectId(materialRequest.toString()) ? materialRequest.toString() : undefined,
      requestNumber: requestNumber || undefined,
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
            hasSecondaryUnit: item.hasSecondaryUnit || false,
            secondaryUnit: item.secondaryUnit || "",
            secondaryQuantity: item.secondaryQuantity || 0,
            conversionFactor: item.conversionFactor || 1,
            performedBy: req.user?.id || req.user?._id,
          });
        } else {
          const targetMatId = isConsumable ? (item.consumable || item.material) : item.material;
          const itemTypeStr = (item.itemType || '').toLowerCase();
          const issueItemType = isConsumable 
            ? "Consumable" 
            : (itemTypeStr.includes('bought') || itemTypeStr === 'bo' || type === 'bo' || type === 'bought-out' 
                ? "BoughtOut" 
                : "RawMaterial");

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
              hasSecondaryUnit: item.hasSecondaryUnit || false,
              secondaryUnit: item.secondaryUnit || "",
              secondaryQuantity: item.secondaryQuantity || 0,
              conversionFactor: item.conversionFactor || 1,
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

    // Auto-update Linked Material Request if issued against a Material Request
    if (materialRequest || requestNumber) {
      try {
        const MaterialRequest = req.getModel('MaterialRequest', materialRequestSchema);
        const reqQuery = materialRequest && isValidObjectId(materialRequest.toString())
          ? { _id: materialRequest, company: companyId }
          : { requestNumber: requestNumber, company: companyId };

        const reqDoc = await MaterialRequest.findOne(reqQuery);
        if (reqDoc) {
          let anyItemIssued = false;
          let allItemsFullyIssued = true;

          reqDoc.items.forEach(rItem => {
            const matchingIssueItem = processedItems.find(issIt => {
              if (issIt.materialRequestItemId && String(issIt.materialRequestItemId) === String(rItem._id)) return true;
              if (issIt.material && rItem.material && String(issIt.material) === String(rItem.material)) return true;
              if (issIt.component && rItem.component && String(issIt.component) === String(rItem.component)) return true;
              if (issIt.consumable && rItem.consumable && String(issIt.consumable) === String(rItem.consumable)) return true;
              if (issIt.materialName && rItem.materialName) {
                return issIt.materialName.trim().toLowerCase() === rItem.materialName.trim().toLowerCase();
              }
              return false;
            });

            if (matchingIssueItem && status === "Issued") {
              const issuedNow = Number(matchingIssueItem.quantity) || 0;
              rItem.issuedQuantity = (rItem.issuedQuantity || 0) + issuedNow;
              rItem.pendingQuantity = Math.max(0, (rItem.quantity || 0) - rItem.issuedQuantity);
            }

            const totalIssuedSoFar = rItem.issuedQuantity || 0;
            const targetQty = rItem.quantity || 0;
            if (totalIssuedSoFar < targetQty) {
              allItemsFullyIssued = false;
            }
            if (totalIssuedSoFar > 0) {
              anyItemIssued = true;
            }
          });

          if (allItemsFullyIssued) {
            reqDoc.status = "Issued";
          } else if (anyItemIssued) {
            reqDoc.status = "Partially Issued";
          }

          reqDoc.linkedIssues = reqDoc.linkedIssues || [];
          if (!reqDoc.linkedIssues.some(id => String(id) === String(materialIssue._id))) {
            reqDoc.linkedIssues.push(materialIssue._id);
          }

          reqDoc.issueNumbers = reqDoc.issueNumbers || [];
          if (!reqDoc.issueNumbers.includes(issueNumber)) {
            reqDoc.issueNumbers.push(issueNumber);
          }

          reqDoc.issuedBy = req.user?.id || req.user?._id;
          reqDoc.issuedByName = userName;
          reqDoc.issuedAt = new Date();

          await reqDoc.save();
        }
      } catch (reqErr) {
        console.error("Error updating linked Material Request on Material Issue:", reqErr);
      }
    }

    res.status(201).json({ message: "Material issue created successfully", materialIssue });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update Material Issue status and update inventory

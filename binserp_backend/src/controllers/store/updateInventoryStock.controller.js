import mongoose from "mongoose";
import { grnSchema, materialIssueSchema, bomSchema, inventorySchema, materialRequestSchema, vendorSchema, customerSchema, locationSchema, categorySchema, rmBoItemSchema, consumableItemSchema, companyInfoSchema, jobWorkSchema, jobWorkSupplierSchema } from "../../models/store/index.js";
import { deliveryChallanSchema, invoiceSchema, quotationSchema } from "../../models/sales/index.js";
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


import { recordStockTransaction } from "../../services/stockTransaction.service.js";

export const updateInventoryStock = async (req, materialId, quantity, unit, locationId, options = {}) => {
  console.log(`>>> [updateInventoryStock] Updating MatID: ${materialId}, Qty: ${quantity}, Unit: ${unit}, Options:`, options);
  const {
    isPending = false,
    isQCRelease = false,
    inspectedQuantity = 0,
    transactionCategory,
    referenceDocType,
    referenceDocId,
    referenceDocNumber,
    recipientOrSource,
    purpose,
    performedBy,
    performedByName,
  } = options;

  try {
    const companyId = getCompanyId(req);
    const Material = req.getModel('RmBoItem', rmBoItemSchema);
    const ConsumableItem = req.getModel('ConsumableItem', consumableItemSchema);
    const Inventory = req.getModel('Inventory', inventorySchema);
    const Location = req.getModel('Location', locationSchema);

    // Register Category for populate
    req.getModel('Category', categorySchema);

    // Find material to get details
    let material = await Material.findById(materialId).populate('categoryId');
    if (!material) {
      material = await ConsumableItem.findById(materialId).populate('categoryId');
    }
    if (!material) {
      console.error(`Material or Consumable not found: ${materialId}`);
      return null;
    }

    const materialName = material.name;
    const materialCode = material.code || materialId.toString();
    const categoryId = material.categoryId?._id || material.categoryId;

    // Find inventory item - Try by materialId first (more robust), then code (backward compatibility)
    let inventory = await Inventory.findOne({
      company: companyId,
      $or: [
        { materialId: materialId },
        { materialCode: materialCode }
      ]
    });

    console.log(`>>> [updateInventoryStock] Inventory Found? ${!!inventory}. Current Stock: ${inventory?.currentStock}`);

    let previousStock = 0;
    let newStock = 0;

    if (!inventory) {
      // Create new inventory entry
      let locationName = "";
      if (locationId) {
        const location = await Location.findById(locationId);
        if (location) locationName = location.name;
      }

      previousStock = 0;
      newStock = (!isPending) ? Math.max(0, quantity) : 0;

      inventory = await Inventory.create({
        company: companyId,
        materialCode,
        materialName,
        unit: unit || material.unit || "PCS",
        currentStock: newStock,
        qcPendingStock: (isPending) ? Math.max(0, quantity) : 0,
        locationId: locationId || undefined,
        categoryId: categoryId || undefined,
        materialId, // Save materialId
        location: locationName
      });
    } else {
      // Update existing inventory
      console.log(`>>> [updateInventoryStock] Updating Existing. Old: ${inventory.currentStock}, Change: ${quantity}`);

      previousStock = inventory.currentStock;

      if (isPending) {
        // Add to Pending Stock (GRN created, waiting QC)
        inventory.qcPendingStock = (inventory.qcPendingStock || 0) + quantity;
        newStock = inventory.currentStock;
      } else if (isQCRelease) {
        // Move from Pending to Main (QC Passed)
        // Increase main stock by Accepted Quantity (passed in 'quantity')
        inventory.currentStock = Math.max(0, inventory.currentStock + quantity);
        // Decrease pending stock by Inspected Quantity (processed amount)
        inventory.qcPendingStock = Math.max(0, (inventory.qcPendingStock || 0) - inspectedQuantity);
        newStock = inventory.currentStock;
      } else {
        // Regular update (Direct GRN or Issue)
        inventory.currentStock = Math.max(0, inventory.currentStock + quantity);
        newStock = inventory.currentStock;
      }

      console.log(`>>> [updateInventoryStock] New Stock: ${inventory.currentStock}, Pending: ${inventory.qcPendingStock}`);

      // Ensure materialId is set if missing (migration)
      if (!inventory.materialId) {
        inventory.materialId = materialId;
      }

      // Update location/category if provided
      if (locationId) {
        inventory.locationId = locationId;
        const location = await Location.findById(locationId);
        if (location) inventory.location = location.name;
      }

      if (categoryId) {
        inventory.categoryId = categoryId;
      }

      await inventory.save();
    }

    // Log Stock Transaction Ledger entry if category or doc info is provided
    if (transactionCategory || referenceDocType) {
      const defaultCategory = isPending
        ? "GRN_QC_PENDING_INWARD"
        : (isQCRelease
            ? "QC_RELEASE_INWARD"
            : (quantity >= 0 ? "GRN_PURCHASE_INWARD" : "MATERIAL_ISSUE_SHOPFLOOR_OUTWARD"));

      const movementType = (isPending || isQCRelease || quantity >= 0) ? "INWARD" : "OUTWARD";

      let transactionItemType = options.itemType || "RawMaterial";
      if (!options.itemType) {
        if (material.constructor?.modelName === 'ConsumableItem' || (!material.itemType && material.unit && !material.code?.startsWith('RM') && !material.code?.startsWith('BO'))) {
          transactionItemType = "Consumable";
        } else if (material.itemType === 'Bought Out' || materialCode?.startsWith('BO')) {
          transactionItemType = "BoughtOut";
        } else {
          transactionItemType = "RawMaterial";
        }
      }

      await recordStockTransaction(req, {
        itemType: transactionItemType,
        item: materialId,
        itemCode: materialCode,
        itemName: materialName,
        unit: unit || material.unit || "PCS",
        movementType,
        transactionCategory: transactionCategory || defaultCategory,
        quantity: Math.abs(quantity),
        previousStock,
        newStock,
        referenceDocType: referenceDocType || "GRN",
        referenceDocId,
        referenceDocNumber,
        recipientOrSource,
        purpose,
        performedBy,
        performedByName,
      });
    }

    return inventory;
  } catch (error) {
    console.error("Error updating inventory:", error);
    throw error;
  }
};


// Create Inventory

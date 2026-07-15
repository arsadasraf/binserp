import mongoose from "mongoose";
import { grnSchema, materialIssueSchema, bomSchema, inventorySchema, materialRequestSchema, purchaseOrderSchema, vendorSchema, customerSchema, locationSchema, categorySchema, rmBoItemSchema, companyInfoSchema, jobWorkSchema, jobWorkSupplierSchema } from "../../models/store/index.js";
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


export const updateInventoryStock = async (req, materialId, quantity, unit, locationId, options = {}) => {
  console.log(`>>> [updateInventoryStock] Updating MatID: ${materialId}, Qty: ${quantity}, Unit: ${unit}, Options:`, options);
  const { isPending = false, isQCRelease = false, inspectedQuantity = 0 } = options;

  try {
    const companyId = getCompanyId(req);
    const Material = req.getModel('RmBoItem', rmBoItemSchema);
    const Inventory = req.getModel('Inventory', inventorySchema);
    const Location = req.getModel('Location', locationSchema);

    // Register Category for populate
    req.getModel('Category', categorySchema);

    // Find material to get details
    const material = await Material.findById(materialId).populate('categoryId');
    if (!material) {
      console.error(`Material not found: ${materialId}`);
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

    if (!inventory) {
      // Create new inventory entry
      let locationName = "";
      if (locationId) {
        const location = await Location.findById(locationId);
        if (location) locationName = location.name;
      }

      inventory = await Inventory.create({
        company: companyId,
        materialCode,
        materialName,
        unit: unit || material.unit || "PCS",
        currentStock: (!isPending) ? Math.max(0, quantity) : 0,
        qcPendingStock: (isPending) ? Math.max(0, quantity) : 0,
        locationId: locationId || undefined,
        categoryId: categoryId || undefined,
        materialId, // Save materialId
        location: locationName
      });
    } else {
      // Update existing inventory
      console.log(`>>> [updateInventoryStock] Updating Existing. Old: ${inventory.currentStock}, Change: ${quantity}`);

      if (isPending) {
        // Add to Pending Stock (GRN created, waiting QC)
        inventory.qcPendingStock = (inventory.qcPendingStock || 0) + quantity;
      } else if (isQCRelease) {
        // Move from Pending to Main (QC Passed)
        // Increase main stock by Accepted Quantity (passed in 'quantity')
        inventory.currentStock = Math.max(0, inventory.currentStock + quantity);
        // Decrease pending stock by Inspected Quantity (processed amount)
        inventory.qcPendingStock = Math.max(0, (inventory.qcPendingStock || 0) - inspectedQuantity);
      } else {
        // Regular update (Direct GRN or Issue)
        inventory.currentStock = Math.max(0, inventory.currentStock + quantity);
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

    return inventory;
  } catch (error) {
    console.error("Error updating inventory:", error);
    throw error;
  }
};

// Create Inventory

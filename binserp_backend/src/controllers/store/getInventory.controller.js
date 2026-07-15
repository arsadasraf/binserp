import mongoose from "mongoose";
import { grnSchema, materialIssueSchema, bomSchema, inventorySchema, materialRequestSchema, vendorSchema, customerSchema, locationSchema, categorySchema, rmBoItemSchema, companyInfoSchema, jobWorkSchema, jobWorkSupplierSchema, rmInventoryMonthlySchema } from "../../models/store/index.js";
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


export const getInventory = async (req, res) => {
  const Inventory = req.getModel('Inventory', inventorySchema);
  // Ensure related models are registered for population
  req.getModel('Location', locationSchema);
  req.getModel('Category', categorySchema);

  try {
    const companyId = getCompanyId(req);
    const { lowStock } = req.query;

    let query = { company: companyId };
    if (lowStock === "true") {
      // Find items below reorder level
      const inventories = await Inventory.find({ company: companyId })
        .populate("locationId", "name code")
        .populate("categoryId", "name code");
      const lowStockItems = inventories.filter(
        (inv) => inv.currentStock <= inv.reorderLevel
      );
      return res.status(200).json({
        inventory: lowStockItems,
        count: lowStockItems.length,
      });
    }

    const inventory = await Inventory.find(query)
      .populate("locationId", "name code")
      .populate("categoryId", "name code")
      .sort({ materialName: 1 })
      .lean();

    // Fetch monthly tracking for the current month
    const currentDate = new Date();
    const currentMonthStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    const RMInventoryMonthly = req.getModel('RMInventoryMonthly', rmInventoryMonthlySchema);
    
    const monthlyRecords = await RMInventoryMonthly.find({ company: companyId, month: currentMonthStr }).lean();
    const monthlyMap = new Map();
    for (const rec of monthlyRecords) {
        if (rec.material) {
            monthlyMap.set(rec.material.toString(), rec);
        }
    }

    const inventoryWithMonthly = inventory.map(inv => {
        const itemMonthly = monthlyMap.get(inv.materialId?.toString() || inv._id?.toString());
        return {
            ...inv,
            monthlyData: itemMonthly || { openingStock: 0, totalInwardQuantity: 0, totalOutwardQuantity: 0 }
        };
    });

    res.status(200).json({
      inventory: inventoryWithMonthly,
      count: inventoryWithMonthly.length,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update Inventory

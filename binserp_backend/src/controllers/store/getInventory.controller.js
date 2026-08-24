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
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59, 999);

    const RMInventoryMonthly = req.getModel('RMInventoryMonthly', rmInventoryMonthlySchema);
    const GRN = req.getModel('GRN', grnSchema);
    const MaterialIssue = req.getModel('MaterialIssue', materialIssueSchema);
    
    const monthlyRecords = await RMInventoryMonthly.find({ company: companyId, month: currentMonthStr }).lean();
    const monthlyMap = new Map();
    for (const rec of monthlyRecords) {
        if (rec.material) {
            monthlyMap.set(rec.material.toString(), rec);
        }
    }

    // Fetch current month's GRNs for real-time inward calculation
    const currentMonthGrns = await GRN.find({
      company: companyId,
      status: { $in: ["Received", "Accepted"] },
      $or: [
        { date: { $gte: startOfMonth, $lte: endOfMonth } },
        { createdAt: { $gte: startOfMonth, $lte: endOfMonth } }
      ]
    }).lean();

    // Fetch current month's Material Issues for real-time outward calculation
    const currentMonthIssues = await MaterialIssue.find({
      company: companyId,
      status: "Issued",
      $or: [
        { date: { $gte: startOfMonth, $lte: endOfMonth } },
        { createdAt: { $gte: startOfMonth, $lte: endOfMonth } }
      ]
    }).lean();

    const grnInwardMap = new Map();
    for (const grn of currentMonthGrns) {
      if (Array.isArray(grn.items)) {
        for (const item of grn.items) {
          const qty = Number(item.quantity || item.receivedQuantity || 0);
          if (qty > 0) {
            const keys = [
              item.material?.toString(),
              item.consumable?.toString(),
              item.fgItem?.toString(),
              item.component?.toString(),
              item.materialName?.toLowerCase().trim()
            ].filter(Boolean);

            for (const k of keys) {
              grnInwardMap.set(k, (grnInwardMap.get(k) || 0) + qty);
            }
          }
        }
      }
    }

    const issueOutwardMap = new Map();
    for (const issue of currentMonthIssues) {
      if (Array.isArray(issue.items)) {
        for (const item of issue.items) {
          const qty = Number(item.quantity || 0);
          if (qty > 0) {
            const keys = [
              item.material?.toString(),
              item.consumable?.toString(),
              item.fgItem?.toString(),
              item.component?.toString(),
              item.materialName?.toLowerCase().trim()
            ].filter(Boolean);

            for (const k of keys) {
              issueOutwardMap.set(k, (issueOutwardMap.get(k) || 0) + qty);
            }
          }
        }
      }
    }

    const inventoryWithMonthly = inventory.map(inv => {
        const matIdStr = inv.materialId?._id?.toString() || inv.materialId?.toString();
        const invIdStr = inv._id?.toString();
        const nameKey = inv.materialName?.toLowerCase().trim();

        const itemMonthly = (matIdStr && monthlyMap.get(matIdStr)) || (invIdStr && monthlyMap.get(invIdStr));
        
        const grnInward = (matIdStr && grnInwardMap.get(matIdStr)) || (nameKey && grnInwardMap.get(nameKey)) || 0;
        const issueOutward = (matIdStr && issueOutwardMap.get(matIdStr)) || (nameKey && issueOutwardMap.get(nameKey)) || 0;

        const totalInward = Math.max(itemMonthly?.totalInwardQuantity || 0, grnInward);
        const totalOutward = Math.max(itemMonthly?.totalOutwardQuantity || 0, issueOutward);
        const opening = itemMonthly?.openingStock || 0;

        return {
            ...inv,
            monthlyData: {
                openingStock: opening,
                received: totalInward,
                issued: totalOutward,
                totalInwardQuantity: totalInward,
                totalOutwardQuantity: totalOutward,
                closingStock: inv.currentStock || 0
            }
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

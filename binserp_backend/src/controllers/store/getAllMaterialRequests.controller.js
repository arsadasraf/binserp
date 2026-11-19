import mongoose from "mongoose";
import { grnSchema, materialIssueSchema, bomSchema, inventorySchema, materialRequestSchema, vendorSchema, customerSchema, locationSchema, categorySchema, rmBoItemSchema, companyInfoSchema, jobWorkSchema, jobWorkSupplierSchema, consumableItemSchema, fgItemSchema, rawMaterialSchema, boughtOutSchema } from "../../models/store/index.js";
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


import { salesOrderSchema } from "../../models/sales/index.js";

export const getAllMaterialRequests = async (req, res) => {
  try {
    const MaterialRequest = req.getModel('MaterialRequest', materialRequestSchema);
    req.getModel('SalesOrder', salesOrderSchema);

    const companyId = getCompanyId(req);
    const { status, department, type, requestedBy, startDate, endDate } = req.query;

    const query = { company: companyId };
    if (status && status !== 'All') query.status = status;
    if (department && department !== 'All') query.department = department;
    if (requestedBy && requestedBy !== 'All') query.requestedBy = requestedBy;

    if (type && type !== 'All') {
      const t = type.toLowerCase();
      if (t === 'rm' || t === 'raw-material') {
        query.type = { $in: ['rm', 'raw-material'] };
      } else if (t === 'bo' || t === 'bought-out') {
        query.type = { $in: ['bo', 'bought-out'] };
      } else if (t === 'fg' || t === 'inhouse') {
        query.type = { $in: ['fg', 'inhouse'] };
      } else if (t === 'consumable') {
        query.type = 'consumable';
      } else {
        query.type = type;
      }
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    const ConsumableItem = req.getModel('ConsumableItem', consumableItemSchema);
    const FGItem = req.getModel('FGItem', fgItemSchema);
    const RawMaterial = req.getModel('RawMaterial', rawMaterialSchema);
    const BoughtOut = req.getModel('BoughtOut', boughtOutSchema);
    const RmBoItem = req.getModel('RmBoItem', rmBoItemSchema);
    const Component = req.getModel('Component', componentSchema);

    const materialRequests = await MaterialRequest.find(query)
      .populate("requestedBy", "name userId department email")
      .populate("approvedBy", "name userId department")
      .populate("issuedBy", "name userId department")
      .populate("salesOrder", "orderNumber status customer poReference")
      .lean()
      .sort({ createdAt: -1 });

    // Collect all unique item IDs across requests for parallel hydration
    const allItemIds = new Set();
    materialRequests.forEach(reqItem => {
      (reqItem.items || []).forEach(it => {
        const id = it.material || it.rawMaterial || it.boughtOut || it.consumable || it.fgItem || it.component;
        if (id && mongoose.Types.ObjectId.isValid(String(id))) {
          allItemIds.add(String(id));
        }
      });
    });

    const idList = Array.from(allItemIds);
    const itemMap = new Map();

    if (idList.length > 0) {
      const [rmDocs, boDocs, legacyDocs, consDocs, fgDocs, compDocs] = await Promise.all([
        RawMaterial.find({ _id: { $in: idList } }).lean(),
        BoughtOut.find({ _id: { $in: idList } }).lean(),
        RmBoItem.find({ _id: { $in: idList } }).lean(),
        ConsumableItem.find({ _id: { $in: idList } }).lean(),
        FGItem.find({ _id: { $in: idList } }).lean(),
        Component.find({ _id: { $in: idList } }).lean(),
      ]);

      [...rmDocs, ...boDocs, ...legacyDocs, ...consDocs, ...fgDocs, ...compDocs].forEach(doc => {
        if (doc && doc._id) {
          itemMap.set(String(doc._id), doc);
        }
      });
    }

    const formattedRequests = materialRequests.map((reqItem) => {
      if (!reqItem.requestedBy && (reqItem.createdBy || reqItem.createdByName)) {
        reqItem.requestedBy = {
          _id: reqItem.createdBy,
          id: reqItem.createdBy,
          name: reqItem.createdByName || 'User',
          userId: reqItem.createdBy,
          department: reqItem.department || 'Store'
        };
      }

      // Ensure item UOM reflects current master UOM and descriptions are populated
      if (Array.isArray(reqItem.items)) {
        reqItem.items = reqItem.items.map((it) => {
          const rawId = it.material || it.rawMaterial || it.boughtOut || it.consumable || it.fgItem || it.component;
          const master = rawId ? itemMap.get(String(rawId)) : null;

          const desc = master?.descriptions || master?.description || master?.specification || it.materialDescription || it.descriptions || it.description || '';
          const hasSec = master?.hasSecondaryUnit !== undefined ? Boolean(master.hasSecondaryUnit) : Boolean(it.hasSecondaryUnit);
          const secUnit = master?.secondaryUnit !== undefined ? master.secondaryUnit : (it.secondaryUnit || '');
          const conv = Number(master?.conversionFactor ?? it.conversionFactor ?? 1);
          const unit = master?.unit || it.unit || 'PCS';

          return {
            ...it,
            material: master ? {
              _id: master._id,
              name: master.name,
              code: master.code,
              unit: master.unit,
              descriptions: desc,
              description: desc,
              hasSecondaryUnit: hasSec,
              secondaryUnit: secUnit,
              conversionFactor: conv
            } : it.material,
            materialDescription: desc,
            descriptions: desc,
            description: desc,
            unit,
            hasSecondaryUnit: hasSec,
            secondaryUnit: secUnit,
            conversionFactor: conv
          };
        });
      }

      return reqItem;
    });

    res.status(200).json({
      materialRequests: formattedRequests,
      count: formattedRequests.length,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update Material Request (Approve/Reject/Issue)

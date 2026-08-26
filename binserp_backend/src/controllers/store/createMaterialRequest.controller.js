import mongoose from "mongoose";
import {
  materialRequestSchema,
  rawMaterialSchema,
  boughtOutSchema,
  rmBoItemSchema,
  fgItemSchema,
  consumableItemSchema
} from "../../models/store/index.js";
import { componentSchema } from "../../models/ppc/index.js";
import { getUserAudit } from "../../utils/userAudit.helper.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

const isValidObjectId = (id) => typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);

export const createMaterialRequest = async (req, res) => {
  try {
    const MaterialRequest = req.getModel('MaterialRequest', materialRequestSchema);
    const RawMaterial = req.getModel('RawMaterial', rawMaterialSchema);
    const BoughtOut = req.getModel('BoughtOut', boughtOutSchema);
    const RmBoItem = req.getModel('RmBoItem', rmBoItemSchema);
    const FGItem = req.getModel('FGItem', fgItemSchema);
    const ConsumableItem = req.getModel('ConsumableItem', consumableItemSchema);
    const Component = req.getModel('Component', componentSchema);

    const companyId = getCompanyId(req);
    const { userId, userName } = getUserAudit(req);
    let { requestNumber, department, items, priority, type, salesOrder, soNumber, mrpPlan, mrpNumber } = req.body;

    if (!requestNumber) {
      requestNumber = `PR-${Date.now()}`;
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Items are required" });
    }

    const normalizedType = (type || 'rm').toLowerCase();
    const isRM = normalizedType === 'rm' || normalizedType === 'raw-material';
    const isBO = normalizedType === 'bo' || normalizedType === 'bought-out';
    const isConsumable = normalizedType === 'consumable';
    const isFG = normalizedType === 'fg' || normalizedType === 'inhouse';

    if (!isConsumable && !mrpPlan && !mrpNumber) {
      return res.status(400).json({ message: "MRP Plan is compulsory for Material Requests (except Consumables)" });
    }

    const processedItems = [];

    for (const item of items) {
      const cleanName = (item.materialName || item.name || '').toString().trim();
      const rawId = item.material || item.consumable || item.fgItem || item.component || item._id;
      const validId = rawId && isValidObjectId(rawId.toString()) ? rawId.toString() : null;

      if (isConsumable) {
        // 1. Consumables
        let doc = null;
        if (validId) doc = await ConsumableItem.findOne({ _id: validId, company: companyId });
        if (!doc && cleanName) {
          doc = await ConsumableItem.findOne({
            company: companyId,
            name: { $regex: new RegExp(`^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
          });
        }

        processedItems.push({
          consumable: doc?._id || validId || undefined,
          material: doc?._id || validId || undefined,
          itemType: 'Consumable',
          materialName: doc?.name || cleanName || 'Consumable Item',
          materialCode: doc?.code || item.materialCode || '',
          quantity: Number(item.quantity) || 1,
          unit: item.unit || doc?.unit || 'PCS',
          currentStock: Number(item.currentStock ?? doc?.quantity ?? 0),
          purpose: item.purpose || ''
        });
      } else if (isFG) {
        // 2. Finished Goods / In-House Products
        let doc = null;
        if (validId) {
          doc = await FGItem.findOne({ _id: validId, company: companyId });
          if (!doc) doc = await Component.findOne({ _id: validId, company: companyId });
        }
        if (!doc && cleanName) {
          doc = await FGItem.findOne({
            company: companyId,
            name: { $regex: new RegExp(`^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
          });
          if (!doc) {
            doc = await Component.findOne({
              company: companyId,
              name: { $regex: new RegExp(`^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
            });
          }
        }

        processedItems.push({
          fgItem: doc?._id || validId || undefined,
          component: doc?._id || validId || undefined,
          material: doc?._id || validId || undefined,
          itemType: 'FG Item',
          materialName: doc?.name || cleanName || 'FG Item',
          materialCode: doc?.code || item.materialCode || '',
          quantity: Number(item.quantity) || 1,
          unit: item.unit || doc?.unit || 'Nos',
          currentStock: Number(item.currentStock ?? doc?.quantity ?? 0),
          purpose: item.purpose || ''
        });
      } else if (isBO) {
        // 3. Bought Out (BO) Items
        let doc = null;
        if (validId) {
          doc = await BoughtOut.findOne({ _id: validId, company: companyId });
          if (!doc) doc = await RmBoItem.findOne({ _id: validId, company: companyId });
        }
        if (!doc && cleanName) {
          doc = await BoughtOut.findOne({
            company: companyId,
            name: { $regex: new RegExp(`^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
          });
          if (!doc) {
            doc = await RmBoItem.findOne({
              company: companyId,
              itemType: 'Bought Out',
              name: { $regex: new RegExp(`^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
            });
          }
        }

        processedItems.push({
          material: doc?._id || validId || undefined,
          itemType: 'Bought Out',
          materialName: doc?.name || cleanName || 'Bought Out Item',
          materialCode: doc?.code || item.materialCode || '',
          quantity: Number(item.quantity) || 1,
          unit: item.unit || doc?.unit || 'PCS',
          currentStock: Number(item.currentStock ?? doc?.minimumStock ?? 0),
          purpose: item.purpose || ''
        });
      } else {
        // 4. Raw Material (RM) Items
        let doc = null;
        if (validId) {
          doc = await RawMaterial.findOne({ _id: validId, company: companyId });
          if (!doc) doc = await RmBoItem.findOne({ _id: validId, company: companyId });
        }
        if (!doc && cleanName) {
          doc = await RawMaterial.findOne({
            company: companyId,
            name: { $regex: new RegExp(`^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
          });
          if (!doc) {
            doc = await RmBoItem.findOne({
              company: companyId,
              itemType: 'Raw Material',
              name: { $regex: new RegExp(`^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
            });
          }
        }

        processedItems.push({
          material: doc?._id || validId || undefined,
          itemType: 'Raw Material',
          materialName: doc?.name || cleanName || 'Raw Material',
          materialCode: doc?.code || item.materialCode || '',
          quantity: Number(item.quantity) || 1,
          unit: item.unit || doc?.unit || 'PCS',
          currentStock: Number(item.currentStock ?? doc?.minimumStock ?? 0),
          purpose: item.purpose || ''
        });
      }
    }

    const materialRequest = await MaterialRequest.create({
      company: companyId,
      requestNumber,
      requestedBy: userId,
      department: department || 'Store',
      type: normalizedType,
      salesOrder: salesOrder || undefined,
      soNumber: soNumber || undefined,
      mrpPlan: mrpPlan || undefined,
      mrpNumber: mrpNumber || undefined,
      items: processedItems,
      priority: priority || "Medium",
      status: "Pending",
      createdBy: userId,
      createdByName: userName,
      updatedBy: userId,
      updatedByName: userName
    });

    res.status(201).json({
      message: "Material request created successfully",
      materialRequest,
    });
  } catch (error) {
    console.error("Create Material Request Error:", error);
    res.status(500).json({ message: error.message });
  }
};

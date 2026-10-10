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
import { mrpPlanSchema } from "../../models/purchase/index.js";
import { userSchema } from "../../models/user/index.js";
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
    const MRPPlan = req.getModel('MRPPlan', mrpPlanSchema);
    const User = req.getModel('User', userSchema);

    const companyId = getCompanyId(req);
    const { userId, userName } = getUserAudit(req);
    let { requestNumber, department, items, priority, type, salesOrder, soNumber, mrpPlan, mrpNumber, requestedBy } = req.body;

    // Deduplicate or auto-generate requestNumber
    if (!requestNumber || typeof requestNumber !== 'string' || !requestNumber.trim()) {
      requestNumber = `REQ-${Date.now()}`;
    } else {
      const trimmedReqNum = requestNumber.trim();
      const existingReq = await MaterialRequest.findOne({
        $or: [
          { company: companyId, requestNumber: trimmedReqNum },
          { requestNumber: trimmedReqNum }
        ]
      });
      if (existingReq) {
        const randSuffix = Math.floor(1000 + Math.random() * 9000);
        requestNumber = `${trimmedReqNum}-${Date.now().toString().slice(-4)}${randSuffix}`;
      } else {
        requestNumber = trimmedReqNum;
      }
    }

    // Bidirectional MRP resolution between mrpPlan ObjectId and mrpNumber string
    if (mrpPlan && !mrpNumber) {
      try {
        if (isValidObjectId(mrpPlan.toString())) {
          const plan = await MRPPlan.findById(mrpPlan);
          if (plan && plan.mrpNumber) mrpNumber = plan.mrpNumber;
        }
      } catch (err) {
        console.warn("Could not lookup mrpNumber from mrpPlan in createMaterialRequest:", err);
      }
    } else if (mrpNumber && !mrpPlan) {
      try {
        const plan = await MRPPlan.findOne({ company: companyId, mrpNumber: mrpNumber.trim() });
        if (plan) mrpPlan = plan._id;
      } catch (err) {
        console.warn("Could not lookup mrpPlan from mrpNumber in createMaterialRequest:", err);
      }
    }

    const finalSalesOrder = (salesOrder && isValidObjectId(salesOrder.toString())) ? salesOrder.toString() : undefined;
    const finalSoNumber = soNumber || (!isValidObjectId(salesOrder?.toString()) && salesOrder ? salesOrder.toString() : undefined);
    const finalMrpPlan = (mrpPlan && isValidObjectId(mrpPlan.toString())) ? mrpPlan.toString() : undefined;

    // Resolve requestedBy safely (fallback to active user, admin, or company)
    let finalRequestedBy = (requestedBy && isValidObjectId(requestedBy.toString()))
      ? requestedBy.toString()
      : (userId && isValidObjectId(userId?.toString()) ? userId.toString() : undefined);

    if (!finalRequestedBy) {
      try {
        const companyUser = await User.findOne({ company: companyId });
        if (companyUser) {
          finalRequestedBy = companyUser._id;
        } else if (companyId && isValidObjectId(companyId?.toString())) {
          finalRequestedBy = companyId;
        }
      } catch (e) {
        if (companyId && isValidObjectId(companyId?.toString())) {
          finalRequestedBy = companyId;
        }
      }
    }

    // Parse items if passed as string
    let parsedItems = items;
    if (typeof items === 'string') {
      try {
        parsedItems = JSON.parse(items);
      } catch (e) {
        console.error("Failed to parse items JSON in createMaterialRequest:", e);
      }
    }

    if (!parsedItems || !Array.isArray(parsedItems) || parsedItems.length === 0) {
      return res.status(400).json({ success: false, message: "Items are required" });
    }

    // Filter out empty rows
    const validItems = parsedItems.filter(item => {
      if (!item) return false;
      const cleanName = (item.materialName || item.name || '').toString().trim();
      const rawId = item.material || item.consumable || item.fgItem || item.component || item._id;
      return cleanName.length > 0 || (rawId && isValidObjectId(rawId.toString()));
    });

    if (validItems.length === 0) {
      return res.status(400).json({ success: false, message: "At least one valid item is required for material request" });
    }

    const normalizedType = (type || 'rm').toLowerCase();
    const isRM = normalizedType === 'rm' || normalizedType === 'raw-material';
    const isBO = normalizedType === 'bo' || normalizedType === 'bought-out';
    const isConsumable = normalizedType === 'consumable';
    const isFG = normalizedType === 'fg' || normalizedType === 'inhouse';

    const processedItems = [];

    for (const item of validItems) {
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

        const hasSec = Boolean(item.hasSecondaryUnit ?? doc?.hasSecondaryUnit ?? false);
        const secUnit = item.secondaryUnit || doc?.secondaryUnit || '';
        const convFactor = Number(item.conversionFactor ?? doc?.conversionFactor ?? 1);
        const selectedUnit = item.selectedUnit || item.unit || doc?.unit || 'PCS';
        let priQty = Number(item.quantity) || 0;
        let secQty = Number(item.secondaryQuantity) || 0;

        if (hasSec && convFactor > 0) {
          if (selectedUnit === secUnit && (!priQty || priQty === 0) && secQty > 0) {
            priQty = Number((secQty / convFactor).toFixed(4));
          } else if ((!secQty || secQty === 0) && priQty > 0) {
            secQty = Number((priQty * convFactor).toFixed(4));
          }
        }
        if (!priQty) priQty = 1;
        if (!secQty && hasSec && convFactor > 0) secQty = Number((priQty * convFactor).toFixed(4));

        const curStock = Number(item.currentStock ?? doc?.quantity ?? 0);
        const secCurStock = hasSec ? (curStock * convFactor) : 0;

        processedItems.push({
          consumable: doc?._id || validId || undefined,
          material: doc?._id || validId || undefined,
          itemType: 'Consumable',
          materialName: doc?.name || cleanName || 'Consumable Item',
          materialCode: doc?.code || item.materialCode || '',
          quantity: priQty,
          unit: doc?.unit || item.unit || 'PCS',
          currentStock: curStock,
          hasSecondaryUnit: hasSec,
          secondaryUnit: secUnit,
          conversionFactor: convFactor,
          secondaryQuantity: secQty,
          selectedUnit: selectedUnit,
          secondaryCurrentStock: secCurStock,
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

        const hasSec = Boolean(item.hasSecondaryUnit ?? doc?.hasSecondaryUnit ?? false);
        const secUnit = item.secondaryUnit || doc?.secondaryUnit || '';
        const convFactor = Number(item.conversionFactor ?? doc?.conversionFactor ?? 1);
        const selectedUnit = item.selectedUnit || item.unit || doc?.unit || 'Nos';
        let priQty = Number(item.quantity) || 0;
        let secQty = Number(item.secondaryQuantity) || 0;

        if (hasSec && convFactor > 0) {
          if (selectedUnit === secUnit && (!priQty || priQty === 0) && secQty > 0) {
            priQty = Number((secQty / convFactor).toFixed(4));
          } else if ((!secQty || secQty === 0) && priQty > 0) {
            secQty = Number((priQty * convFactor).toFixed(4));
          }
        }
        if (!priQty) priQty = 1;
        if (!secQty && hasSec && convFactor > 0) secQty = Number((priQty * convFactor).toFixed(4));

        const curStock = Number(item.currentStock ?? doc?.quantity ?? 0);
        const secCurStock = hasSec ? (curStock * convFactor) : 0;

        processedItems.push({
          fgItem: doc?._id || validId || undefined,
          component: doc?._id || validId || undefined,
          material: doc?._id || validId || undefined,
          itemType: 'FG Item',
          materialName: doc?.name || cleanName || 'FG Item',
          materialCode: doc?.code || item.materialCode || '',
          quantity: priQty,
          unit: doc?.unit || item.unit || 'Nos',
          currentStock: curStock,
          hasSecondaryUnit: hasSec,
          secondaryUnit: secUnit,
          conversionFactor: convFactor,
          secondaryQuantity: secQty,
          selectedUnit: selectedUnit,
          secondaryCurrentStock: secCurStock,
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

        const hasSec = Boolean(item.hasSecondaryUnit ?? doc?.hasSecondaryUnit ?? false);
        const secUnit = item.secondaryUnit || doc?.secondaryUnit || '';
        const convFactor = Number(item.conversionFactor ?? doc?.conversionFactor ?? 1);
        const selectedUnit = item.selectedUnit || item.unit || doc?.unit || 'PCS';
        let priQty = Number(item.quantity) || 0;
        let secQty = Number(item.secondaryQuantity) || 0;

        if (hasSec && convFactor > 0) {
          if (selectedUnit === secUnit && (!priQty || priQty === 0) && secQty > 0) {
            priQty = Number((secQty / convFactor).toFixed(4));
          } else if ((!secQty || secQty === 0) && priQty > 0) {
            secQty = Number((priQty * convFactor).toFixed(4));
          }
        }
        if (!priQty) priQty = 1;
        if (!secQty && hasSec && convFactor > 0) secQty = Number((priQty * convFactor).toFixed(4));

        const curStock = Number(item.currentStock ?? doc?.quantity ?? doc?.minimumStock ?? 0);
        const secCurStock = hasSec ? (curStock * convFactor) : 0;

        processedItems.push({
          material: doc?._id || validId || undefined,
          itemType: 'Bought Out',
          materialName: doc?.name || cleanName || 'Bought Out Item',
          materialCode: doc?.code || item.materialCode || '',
          quantity: priQty,
          unit: doc?.unit || item.unit || 'PCS',
          currentStock: curStock,
          hasSecondaryUnit: hasSec,
          secondaryUnit: secUnit,
          conversionFactor: convFactor,
          secondaryQuantity: secQty,
          selectedUnit: selectedUnit,
          secondaryCurrentStock: secCurStock,
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

        const hasSec = Boolean(item.hasSecondaryUnit ?? doc?.hasSecondaryUnit ?? false);
        const secUnit = item.secondaryUnit || doc?.secondaryUnit || '';
        const convFactor = Number(item.conversionFactor ?? doc?.conversionFactor ?? 1);
        const selectedUnit = item.selectedUnit || item.unit || doc?.unit || 'KG';
        let priQty = Number(item.quantity) || 0;
        let secQty = Number(item.secondaryQuantity) || 0;

        if (hasSec && convFactor > 0) {
          if (selectedUnit === secUnit && (!priQty || priQty === 0) && secQty > 0) {
            priQty = Number((secQty / convFactor).toFixed(4));
          } else if ((!secQty || secQty === 0) && priQty > 0) {
            secQty = Number((priQty * convFactor).toFixed(4));
          }
        }
        if (!priQty) priQty = 1;
        if (!secQty && hasSec && convFactor > 0) secQty = Number((priQty * convFactor).toFixed(4));

        const curStock = Number(item.currentStock ?? doc?.quantity ?? doc?.minimumStock ?? 0);
        const secCurStock = hasSec ? (curStock * convFactor) : 0;

        processedItems.push({
          material: doc?._id || validId || undefined,
          itemType: 'Raw Material',
          materialName: doc?.name || cleanName || 'Raw Material',
          materialCode: doc?.code || item.materialCode || '',
          quantity: priQty,
          unit: doc?.unit || item.unit || 'KG',
          currentStock: curStock,
          hasSecondaryUnit: hasSec,
          secondaryUnit: secUnit,
          conversionFactor: convFactor,
          secondaryQuantity: secQty,
          selectedUnit: selectedUnit,
          secondaryCurrentStock: secCurStock,
          purpose: item.purpose || ''
        });
      }
    }

    const materialRequest = await MaterialRequest.create({
      company: companyId,
      requestNumber,
      requestedBy: finalRequestedBy,
      department: department || 'Store',
      type: normalizedType,
      salesOrder: finalSalesOrder,
      soNumber: finalSoNumber,
      mrpPlan: finalMrpPlan,
      mrpNumber: mrpNumber || undefined,
      items: processedItems,
      priority: priority || "Medium",
      status: "Pending",
      createdBy: finalRequestedBy || userId,
      createdByName: userName,
      updatedBy: finalRequestedBy || userId,
      updatedByName: userName
    });

    res.status(201).json({
      success: true,
      message: "Material request created successfully",
      materialRequest,
    });
  } catch (error) {
    console.error("Create Material Request Error:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to create material request"
    });
  }
};

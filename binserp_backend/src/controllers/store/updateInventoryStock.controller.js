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
  rmBoItemSchema, 
  rawMaterialSchema, 
  boughtOutSchema, 
  consumableItemSchema, 
  fgItemSchema, 
  companyInfoSchema, 
  jobWorkSchema, 
  jobWorkSupplierSchema 
} from "../../models/store/index.js";
import { deliveryChallanSchema, invoiceSchema, quotationSchema } from "../../models/sales/index.js";
import { storePrefixSchema } from "../../models/store/index.js";
import { componentSchema, jobSchema, processSchema } from "../../models/ppc/index.js";
import { uploadOnS3, deleteFromS3, signPhotos } from "../../utils/s3.js";
import { recordStockTransaction } from "../../services/stockTransaction.service.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

const getCompanyLoginId = (req) => {
  return req.company?.companyId || req.user?.companyId || req.user?.company?.companyId || "";
};

const isValidObjectId = (id) => typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);

// Helper function to update COMPONENT stock (InHouse)
export const updateComponentStock = async (req, componentId, quantity) => {
  try {
    const Component = req.getModel("Component", componentSchema);
    if (!componentId) return null;
    await Component.findByIdAndUpdate(componentId, {
      $inc: { quantity: quantity }
    });
    return true;
  } catch (error) {
    console.error("Error updating component stock:", error);
    throw error;
  }
};

// ========== Update Inventory Stock Controller ==========
export const updateInventoryStock = async (req, materialId, quantity, unit, locationId, options = {}) => {
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
    hasSecondaryUnit,
    secondaryUnit,
    secondaryQuantity,
  } = options;

  console.log(`>>> [updateInventoryStock] Updating MatID: ${materialId}, Qty: ${quantity}, Unit: ${unit}, isPending: ${isPending}, isQCRelease: ${isQCRelease}`);

  try {
    const companyId = getCompanyId(req);
    const RawMaterial = req.getModel('RawMaterial', rawMaterialSchema);
    const BoughtOut = req.getModel('BoughtOut', boughtOutSchema);
    const ConsumableItem = req.getModel('ConsumableItem', consumableItemSchema);
    const Material = req.getModel('RmBoItem', rmBoItemSchema);
    const FGItem = req.getModel('FGItem', fgItemSchema);
    const Component = req.getModel('Component', componentSchema);
    const Inventory = req.getModel('Inventory', inventorySchema);
    const Location = req.getModel('Location', locationSchema);
    req.getModel('Category', categorySchema);

    let material = null;
    let itemMasterType = 'RawMaterial';

    const validId = materialId && (isValidObjectId(materialId.toString()) || (typeof materialId === 'object' && materialId._id)) 
      ? (typeof materialId === 'object' ? materialId._id.toString() : materialId.toString()) 
      : null;

    if (validId) {
      if (options.itemType === 'Consumable') {
        material = await ConsumableItem.findOne({ _id: validId, company: companyId }).populate('categoryId');
        if (material) itemMasterType = 'Consumable';
      }
      if (!material) {
        material = await RawMaterial.findOne({ _id: validId, company: companyId }).populate('categoryId');
        if (material) itemMasterType = 'RawMaterial';
      }
      if (!material) {
        material = await BoughtOut.findOne({ _id: validId, company: companyId }).populate('categoryId');
        if (material) itemMasterType = 'BoughtOut';
      }
      if (!material) {
        material = await ConsumableItem.findOne({ _id: validId, company: companyId }).populate('categoryId');
        if (material) itemMasterType = 'Consumable';
      }
      if (!material) {
        material = await Material.findOne({ _id: validId, company: companyId }).populate('categoryId');
        if (material) itemMasterType = material.itemType === 'Bought Out' ? 'BoughtOut' : 'RawMaterial';
      }
      if (!material) {
        material = await FGItem.findOne({ _id: validId, company: companyId });
        if (material) itemMasterType = 'FinishedGoods';
      }
      if (!material) {
        material = await Component.findOne({ _id: validId, company: companyId });
        if (material) itemMasterType = 'Component';
      }
    }

    // Fallback: If not found by ID, search by code or name
    if (!material && materialId && typeof materialId === 'string') {
      if (options.itemType === 'Consumable') {
        material = await ConsumableItem.findOne({ company: companyId, $or: [{ code: materialId }, { name: materialId }] }).populate('categoryId');
        if (material) itemMasterType = 'Consumable';
      }
      if (!material) {
        material = await RawMaterial.findOne({ company: companyId, $or: [{ code: materialId }, { name: materialId }] }).populate('categoryId');
        if (material) itemMasterType = 'RawMaterial';
      }
      if (!material) {
        material = await BoughtOut.findOne({ company: companyId, $or: [{ code: materialId }, { name: materialId }] }).populate('categoryId');
        if (material) itemMasterType = 'BoughtOut';
      }
      if (!material) {
        material = await ConsumableItem.findOne({ company: companyId, $or: [{ code: materialId }, { name: materialId }] }).populate('categoryId');
        if (material) itemMasterType = 'Consumable';
      }
      if (!material) {
        material = await Material.findOne({ company: companyId, $or: [{ code: materialId }, { name: materialId }] }).populate('categoryId');
        if (material) itemMasterType = material.itemType === 'Bought Out' ? 'BoughtOut' : 'RawMaterial';
      }
    }

    if (!material) {
      console.warn(`[updateInventoryStock] Material not found in any master table: ${materialId}`);
      // Fallback: Create or update inventory directly with provided ID
      let inventory = await Inventory.findOne({
        company: companyId,
        $or: [
          { materialId: validId || materialId },
          { materialCode: String(materialId) }
        ]
      });

      if (inventory) {
        const fallbackInc = {};
        if (isPending) {
          fallbackInc.qcPendingStock = quantity;
        } else if (isQCRelease) {
          fallbackInc.currentStock = quantity;
          fallbackInc.qcPendingStock = -inspectedQuantity;
        } else {
          fallbackInc.currentStock = quantity;
        }

        const updated = await Inventory.findOneAndUpdate(
          { _id: inventory._id },
          { $inc: fallbackInc },
          { new: true }
        );
        if (updated) {
          if (updated.currentStock < 0) {
            await Inventory.updateOne({ _id: inventory._id }, { $set: { currentStock: 0 } });
            updated.currentStock = 0;
          }
          if (updated.qcPendingStock < 0) {
            await Inventory.updateOne({ _id: inventory._id }, { $set: { qcPendingStock: 0 } });
            updated.qcPendingStock = 0;
          }
          return updated;
        }
        return inventory;
      }
      return null;
    }

    const actualMatId = material._id;
    const materialName = material.name || material.componentName || 'Material';
    const materialCode = material.code || (typeof materialId === 'string' ? materialId : actualMatId.toString());
    const categoryId = material.categoryId?._id || material.categoryId;
    const resolvedUnit = unit || material.unit || "PCS";
    const resolvedLocId = locationId || material.locationId?._id || material.locationId;

    // Find inventory item - Try by actual materialId first, then code, then name
    let inventory = await Inventory.findOne({
      company: companyId,
      $or: [
        { materialId: actualMatId },
        { materialCode: materialCode },
        { materialName: materialName, itemType: itemMasterType }
      ]
    });

    let previousStock = 0;
    let newStock = 0;

    if (!inventory) {
      // Create new inventory entry
      let locationName = "";
      if (resolvedLocId) {
        const location = await Location.findById(resolvedLocId);
        if (location) locationName = location.name;
      }

      previousStock = 0;
      newStock = (!isPending) ? Math.max(0, quantity) : 0;

      const hasSecVal = hasSecondaryUnit !== undefined ? Boolean(hasSecondaryUnit) : Boolean(material?.hasSecondaryUnit);
      const secUnitVal = secondaryUnit !== undefined ? secondaryUnit : (material?.secondaryUnit || "");
      const convFactorVal = Number(options.conversionFactor ?? material?.conversionFactor ?? 1);

      inventory = await Inventory.create({
        company: companyId,
        materialCode,
        materialName,
        unit: resolvedUnit,
        hasSecondaryUnit: hasSecVal,
        secondaryUnit: secUnitVal,
        conversionFactor: convFactorVal,
        currentStock: newStock,
        qcPendingStock: (isPending) ? Math.max(0, quantity) : 0,
        locationId: resolvedLocId || undefined,
        categoryId: categoryId || undefined,
        materialId: actualMatId,
        location: locationName
      });
    } else {
      previousStock = inventory.currentStock || 0;

      const incFields = {};
      const setFields = {};

      if (isPending) {
        incFields.qcPendingStock = quantity;
        newStock = previousStock;
      } else if (isQCRelease) {
        incFields.currentStock = quantity;
        incFields.qcPendingStock = -inspectedQuantity;
        newStock = Math.max(0, previousStock + quantity);
      } else {
        incFields.currentStock = quantity;
        newStock = Math.max(0, previousStock + quantity);
      }

      if (!inventory.materialId) {
        setFields.materialId = actualMatId;
      }
      if (resolvedLocId) {
        setFields.locationId = resolvedLocId;
        const location = await Location.findById(resolvedLocId);
        if (location) setFields.location = location.name;
      }
      if (categoryId) {
        setFields.categoryId = categoryId;
      }

      // Keep secondary unit properties synchronized on the Inventory document
      if (hasSecondaryUnit !== undefined) {
        setFields.hasSecondaryUnit = Boolean(hasSecondaryUnit);
      } else if (material?.hasSecondaryUnit !== undefined) {
        setFields.hasSecondaryUnit = Boolean(material.hasSecondaryUnit);
      }

      if (secondaryUnit !== undefined) {
        setFields.secondaryUnit = secondaryUnit;
      } else if (material?.secondaryUnit) {
        setFields.secondaryUnit = material.secondaryUnit;
      }

      if (options.conversionFactor !== undefined) {
        setFields.conversionFactor = Number(options.conversionFactor);
      } else if (material?.conversionFactor) {
        setFields.conversionFactor = Number(material.conversionFactor);
      }

      const updateOps = {};
      if (Object.keys(incFields).length > 0) updateOps.$inc = incFields;
      if (Object.keys(setFields).length > 0) updateOps.$set = setFields;

      // Atomic update eliminates concurrent race conditions
      const updatedInv = await Inventory.findOneAndUpdate(
        { _id: inventory._id },
        updateOps,
        { new: true }
      );

      if (updatedInv) {
        // Guard against negative stock clamping without losing history
        if (updatedInv.currentStock < 0) {
          await Inventory.updateOne({ _id: inventory._id }, { $set: { currentStock: 0 } });
          updatedInv.currentStock = 0;
        }
        if (updatedInv.qcPendingStock < 0) {
          await Inventory.updateOne({ _id: inventory._id }, { $set: { qcPendingStock: 0 } });
          updatedInv.qcPendingStock = 0;
        }
        inventory = updatedInv;
        newStock = updatedInv.currentStock;
      }
    }

    // Direct synchronization on Master model so master tables reflect actual current stock
    if (!isPending) {
      try {
        const stockDelta = isQCRelease ? quantity : quantity;
        if (itemMasterType === 'RawMaterial') {
          await RawMaterial.findByIdAndUpdate(actualMatId, { $inc: { quantity: stockDelta } });
        } else if (itemMasterType === 'BoughtOut') {
          await BoughtOut.findByIdAndUpdate(actualMatId, { $inc: { quantity: stockDelta } });
        } else if (itemMasterType === 'Consumable') {
          await ConsumableItem.findByIdAndUpdate(actualMatId, { $inc: { quantity: stockDelta, currentStock: stockDelta } });
        } else if (itemMasterType === 'RmBoItem') {
          await Material.findByIdAndUpdate(actualMatId, { $inc: { quantity: stockDelta } });
        } else if (itemMasterType === 'FinishedGoods') {
          await FGItem.findByIdAndUpdate(actualMatId, { $inc: { quantity: stockDelta } });
        } else if (itemMasterType === 'Component') {
          await Component.findByIdAndUpdate(actualMatId, { $inc: { quantity: stockDelta } });
        }
      } catch (masterSyncErr) {
        console.error("[updateInventoryStock] Master model stock sync error:", masterSyncErr);
      }
    }

    // Log Stock Transaction Ledger entry if category or doc info is provided
    if (transactionCategory || referenceDocType) {
      const defaultCategory = isPending
        ? "GRN_QC_PENDING_INWARD"
        : (isQCRelease
            ? "QC_RELEASE_INWARD"
            : (quantity >= 0 ? "GRN_PURCHASE_INWARD" : "MATERIAL_ISSUE_SHOPFLOOR_OUTWARD"));

      const movementType = (isPending || isQCRelease || quantity >= 0) ? "INWARD" : "OUTWARD";
      const transactionItemType = options.itemType || itemMasterType;

      const resolvedHasSec = hasSecondaryUnit !== undefined ? Boolean(hasSecondaryUnit) : Boolean(material?.hasSecondaryUnit);
      const resolvedSecUnit = secondaryUnit !== undefined ? secondaryUnit : (material?.secondaryUnit || "");
      const convFactor = Number(options.conversionFactor ?? material?.conversionFactor ?? 1);
      const resolvedSecQty = (secondaryQuantity !== undefined && secondaryQuantity !== null && Number(secondaryQuantity) > 0)
        ? Math.abs(Number(secondaryQuantity)) 
        : (resolvedHasSec && convFactor > 0 ? Math.round(Math.abs(quantity * convFactor) * 10000) / 10000 : 0);

      await recordStockTransaction(req, {
        itemType: transactionItemType,
        item: actualMatId,
        itemCode: materialCode,
        itemName: materialName,
        unit: resolvedUnit,
        hasSecondaryUnit: resolvedHasSec,
        secondaryUnit: resolvedSecUnit,
        secondaryQuantity: resolvedSecQty,
        conversionFactor: convFactor,
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

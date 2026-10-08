import mongoose from "mongoose";
import {
  rawMaterialSchema,
  boughtOutSchema,
  consumableItemSchema,
  fgItemSchema,
  inventorySchema,
  bomSchema,
  materialRequestSchema,
  rmBoItemSchema
} from "../../models/store/index.js";
import { isPlaceholderCode } from "../../utils/duplicateValidator.helper.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

/**
 * Normalizes UOM strings for strict comparison
 */
const normalizeUom = (val) => {
  if (!val) return "";
  const s = String(val).trim().toUpperCase();
  if (s === "PCS" || s === "PC" || s === "PIECE" || s === "PIECES" || s === "NO") return "NOS";
  if (s === "KGS" || s === "KILOGRAM" || s === "KILOGRAMS") return "KG";
  return String(val).trim();
};

/**
 * Helper to build comprehensive master item map for a company
 */
const getMasterItemsMap = async (req, companyId) => {
  const RawMaterial = req.getModel("RawMaterial", rawMaterialSchema);
  const BoughtOut = req.getModel("BoughtOut", boughtOutSchema);
  const ConsumableItem = req.getModel("ConsumableItem", consumableItemSchema);
  const FGItem = req.getModel("FGItem", fgItemSchema);
  const RmBoItem = req.getModel("RmBoItem", rmBoItemSchema);

  const [rawMaterials, boughtOuts, consumables, fgItems, rmBoItems] = await Promise.all([
    RawMaterial.find({ company: companyId }).lean(),
    BoughtOut.find({ company: companyId }).lean(),
    ConsumableItem.find({ company: companyId }).lean(),
    FGItem.find({ company: companyId }).lean(),
    RmBoItem.find({ company: companyId }).lean()
  ]);

  const byId = new Map();
  const byCode = new Map();
  const byName = new Map();

  const registerMaster = (doc, itemType, defaultUom) => {
    if (!doc || !doc._id) return;
    const cleanUnit = (doc.unit || defaultUom || "NOS").toString().trim();
    const isBadCode = isPlaceholderCode(doc.code);
    const cleanCode = isBadCode ? "" : (doc.code || "").toString().trim();
    const entry = {
      _id: doc._id,
      name: doc.name || "",
      code: cleanCode,
      unit: cleanUnit,
      hasSecondaryUnit: Boolean(doc.hasSecondaryUnit),
      secondaryUnit: (doc.secondaryUnit || "").toString().trim(),
      conversionFactor: Number(doc.conversionFactor) || 1,
      itemType,
      categoryId: doc.categoryId || doc.category,
      locationId: doc.locationId || doc.location
    };

    byId.set(doc._id.toString(), entry);
    if (entry.code) {
      byCode.set(entry.code.toLowerCase(), entry);
    }
    if (entry.name) {
      byName.set(entry.name.toLowerCase().trim(), entry);
    }
  };

  // Register all items
  rawMaterials.forEach((item) => registerMaster(item, "Raw Material", "KG"));
  boughtOuts.forEach((item) => registerMaster(item, "Bought Out", "NOS"));
  consumables.forEach((item) => registerMaster(item, "Consumable", "NOS"));
  fgItems.forEach((item) => registerMaster(item, "FG Item", "Nos"));

  // Also register legacy RmBoItems if not already registered
  rmBoItems.forEach((item) => {
    if (!byId.has(item._id.toString())) {
      const type = item.itemType === "Bought Out" ? "Bought Out" : "Raw Material";
      const defUom = type === "Bought Out" ? "NOS" : "KG";
      registerMaster(item, type, defUom);
    }
  });

  return { byId, byCode, byName, rawMaterials, boughtOuts, consumables, fgItems };
};

/**
 * Match a candidate item against master maps using multiple fallback strategies
 */
const findMasterEntry = (masterMaps, { id, code, name }) => {
  if (id && masterMaps.byId.has(id.toString())) {
    return masterMaps.byId.get(id.toString());
  }
  if (code && !isPlaceholderCode(code) && masterMaps.byCode.has(code.toString().toLowerCase().trim())) {
    return masterMaps.byCode.get(code.toString().toLowerCase().trim());
  }
  if (name && masterMaps.byName.has(name.toString().toLowerCase().trim())) {
    return masterMaps.byName.get(name.toString().toLowerCase().trim());
  }
  return null;
};

/**
 * GET /api/store/audit-master-uoms
 * Audits all Inventory records, BOM components, and Material Requests for UOM mismatches
 */
export const auditMasterUoms = async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const masterMaps = await getMasterItemsMap(req, companyId);

    const Inventory = req.getModel("Inventory", inventorySchema);
    const FGItem = req.getModel("FGItem", fgItemSchema);
    const BOM = req.getModel("BOM", bomSchema);
    const MaterialRequest = req.getModel("MaterialRequest", materialRequestSchema);

    const [inventories, fgItems, boms, materialRequests] = await Promise.all([
      Inventory.find({ company: companyId }).lean(),
      FGItem.find({ company: companyId }).lean(),
      BOM.find({ company: companyId }).lean(),
      MaterialRequest.find({ company: companyId, status: { $ne: "Rejected" } }).lean()
    ]);

    const inventoryMismatches = [];
    const bomMismatches = [];
    const materialRequestMismatches = [];

    // 1. Audit Inventory
    for (const inv of inventories) {
      const master = findMasterEntry(masterMaps, {
        id: inv.materialId,
        code: inv.materialCode,
        name: inv.materialName
      });

      if (master) {
        const invUnitNorm = normalizeUom(inv.unit);
        const masterUnitNorm = normalizeUom(master.unit);
        const unitMismatch = invUnitNorm !== masterUnitNorm || inv.unit !== master.unit;
        const secMismatch = Boolean(inv.hasSecondaryUnit) !== Boolean(master.hasSecondaryUnit) ||
          (master.hasSecondaryUnit && inv.secondaryUnit !== master.secondaryUnit);
        const cfMismatch = master.hasSecondaryUnit && Number(inv.conversionFactor) !== Number(master.conversionFactor);
        const missingMaterialId = !inv.materialId || inv.materialId.toString() !== master._id.toString();

        if (unitMismatch || secMismatch || cfMismatch || missingMaterialId) {
          inventoryMismatches.push({
            id: inv._id,
            materialCode: inv.materialCode,
            materialName: inv.materialName,
            itemType: master.itemType,
            currentUnit: inv.unit || "-",
            masterUnit: master.unit,
            currentSecondaryUnit: inv.secondaryUnit || "-",
            masterSecondaryUnit: master.secondaryUnit || "-",
            currentConversionFactor: inv.conversionFactor || 1,
            masterConversionFactor: master.conversionFactor,
            hasSecondaryUnit: master.hasSecondaryUnit,
            missingMaterialId
          });
        }
      }
    }

    // 2. Audit FG Item BOMs
    for (const fg of fgItems) {
      if (Array.isArray(fg.bom) && fg.bom.length > 0) {
        for (const item of fg.bom) {
          const master = findMasterEntry(masterMaps, {
            id: item.item,
            name: item.itemName
          });

          if (master) {
            const currentUnitNorm = normalizeUom(item.unit);
            const masterUnitNorm = normalizeUom(master.unit);
            if (currentUnitNorm !== masterUnitNorm || item.unit !== master.unit) {
              bomMismatches.push({
                fgId: fg._id,
                fgName: fg.name,
                fgCode: fg.code,
                componentId: item.item,
                componentName: item.itemName || master.name,
                componentType: master.itemType,
                currentUnit: item.unit || "-",
                masterUnit: master.unit
              });
            }
          }
        }
      }
    }

    // 3. Audit Standalone BOMs
    for (const bom of boms) {
      if (Array.isArray(bom.items) && bom.items.length > 0) {
        for (const item of bom.items) {
          const master = findMasterEntry(masterMaps, {
            id: item.material,
            code: item.materialCode,
            name: item.materialName
          });

          if (master) {
            const currentUnitNorm = normalizeUom(item.unit);
            const masterUnitNorm = normalizeUom(master.unit);
            if (currentUnitNorm !== masterUnitNorm || item.unit !== master.unit) {
              bomMismatches.push({
                bomId: bom._id,
                bomNumber: bom.bomNumber,
                productName: bom.productName,
                componentId: item.material,
                componentName: item.materialName || master.name,
                componentType: master.itemType,
                currentUnit: item.unit || "-",
                masterUnit: master.unit
              });
            }
          }
        }
      }
    }

    // 4. Audit Material Requests
    for (const mr of materialRequests) {
      if (Array.isArray(mr.items) && mr.items.length > 0) {
        for (const item of mr.items) {
          const master = findMasterEntry(masterMaps, {
            id: item.material || item.consumable || item.fgItem || item.component,
            code: item.materialCode,
            name: item.materialName
          });

          if (master) {
            const currentUnitNorm = normalizeUom(item.unit);
            const masterUnitNorm = normalizeUom(master.unit);
            if (currentUnitNorm !== masterUnitNorm || item.unit !== master.unit) {
              materialRequestMismatches.push({
                requestId: mr._id,
                requestNumber: mr.requestNumber,
                itemId: item._id,
                materialName: item.materialName || master.name,
                materialCode: item.materialCode || master.code,
                itemType: master.itemType,
                currentUnit: item.unit || "-",
                masterUnit: master.unit
              });
            }
          }
        }
      }
    }

    const totalMastersCount = masterMaps.byId.size;
    const totalDiscrepancies = inventoryMismatches.length + bomMismatches.length + materialRequestMismatches.length;

    res.status(200).json({
      success: true,
      totalMasters: totalMastersCount,
      totalDiscrepancies,
      inventoryMismatchesCount: inventoryMismatches.length,
      bomMismatchesCount: bomMismatches.length,
      materialRequestMismatchesCount: materialRequestMismatches.length,
      inventoryMismatches,
      bomMismatches,
      materialRequestMismatches
    });
  } catch (error) {
    console.error("Error running auditMasterUoms:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/store/sync-master-uoms
 * Performs bulk correction across Inventory, BOMs, and Material Requests
 */
export const syncMasterUoms = async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const masterMaps = await getMasterItemsMap(req, companyId);

    const Inventory = req.getModel("Inventory", inventorySchema);
    const FGItem = req.getModel("FGItem", fgItemSchema);
    const BOM = req.getModel("BOM", bomSchema);
    const MaterialRequest = req.getModel("MaterialRequest", materialRequestSchema);

    let inventoryFixedCount = 0;
    let bomItemsFixedCount = 0;
    let materialRequestsFixedCount = 0;

    // 1. Sync Inventory Records
    // Iterate over all canonical master items and update their corresponding Inventory records
    const allMasters = Array.from(masterMaps.byId.values());
    for (const master of allMasters) {
      const orConditions = [{ materialId: master._id }];
      if (master.code && !isPlaceholderCode(master.code)) {
        orConditions.push({ materialCode: master.code });
      }
      if (master.name) {
        orConditions.push({ materialName: master.name });
      }

      const updateResult = await Inventory.updateMany(
        { company: companyId, $or: orConditions },
        {
          $set: {
            unit: master.unit,
            hasSecondaryUnit: Boolean(master.hasSecondaryUnit),
            secondaryUnit: master.secondaryUnit || "",
            conversionFactor: Number(master.conversionFactor) || 1,
            materialName: master.name,
            materialId: master._id,
            itemType: master.itemType,
            ...(master.categoryId ? { categoryId: master.categoryId } : {}),
            ...(master.locationId ? { locationId: master.locationId } : {})
          }
        }
      );

      if (updateResult.modifiedCount > 0) {
        inventoryFixedCount += updateResult.modifiedCount;
      }
    }

    // 2. Sync FG Item Embedded BOMs
    const fgItems = await FGItem.find({ company: companyId });
    for (const fg of fgItems) {
      let fgModified = false;
      if (Array.isArray(fg.bom) && fg.bom.length > 0) {
        for (const item of fg.bom) {
          const master = findMasterEntry(masterMaps, {
            id: item.item,
            name: item.itemName
          });

          if (master) {
            const currentUnitNorm = normalizeUom(item.unit);
            const masterUnitNorm = normalizeUom(master.unit);
            if (currentUnitNorm !== masterUnitNorm || item.unit !== master.unit) {
              item.unit = master.unit;
              item.hasSecondaryUnit = Boolean(master.hasSecondaryUnit);
              item.secondaryUnit = master.secondaryUnit || "";
              item.conversionFactor = Number(master.conversionFactor) || 1;
              fgModified = true;
              bomItemsFixedCount++;
            }
          }
        }
      }

      if (fgModified) {
        await fg.save();
      }
    }

    // 3. Sync Standalone BOMs
    const boms = await BOM.find({ company: companyId });
    for (const bom of boms) {
      let bomModified = false;
      if (Array.isArray(bom.items) && bom.items.length > 0) {
        for (const item of bom.items) {
          const master = findMasterEntry(masterMaps, {
            id: item.material,
            code: item.materialCode,
            name: item.materialName
          });

          if (master) {
            const currentUnitNorm = normalizeUom(item.unit);
            const masterUnitNorm = normalizeUom(master.unit);
            if (currentUnitNorm !== masterUnitNorm || item.unit !== master.unit) {
              item.unit = master.unit;
              item.hasSecondaryUnit = Boolean(master.hasSecondaryUnit);
              item.secondaryUnit = master.secondaryUnit || "";
              item.conversionFactor = Number(master.conversionFactor) || 1;
              bomModified = true;
              bomItemsFixedCount++;
            }
          }
        }
      }

      if (bomModified) {
        await bom.save();
      }
    }

    // 4. Sync Material Requests
    const materialRequests = await MaterialRequest.find({ company: companyId, status: { $ne: "Rejected" } });
    for (const mr of materialRequests) {
      let mrModified = false;
      if (Array.isArray(mr.items) && mr.items.length > 0) {
        for (const item of mr.items) {
          const master = findMasterEntry(masterMaps, {
            id: item.material || item.consumable || item.fgItem || item.component,
            code: item.materialCode,
            name: item.materialName
          });

          if (master) {
            const currentUnitNorm = normalizeUom(item.unit);
            const masterUnitNorm = normalizeUom(master.unit);
            if (currentUnitNorm !== masterUnitNorm || item.unit !== master.unit) {
              item.unit = master.unit;
              item.hasSecondaryUnit = Boolean(master.hasSecondaryUnit);
              item.secondaryUnit = master.secondaryUnit || "";
              item.conversionFactor = Number(master.conversionFactor) || 1;
              mrModified = true;
              materialRequestsFixedCount++;
            }
          }
        }
      }

      if (mrModified) {
        await mr.save();
      }
    }

    res.status(200).json({
      success: true,
      message: `Master UOM synchronization successfully completed! Synchronized ${inventoryFixedCount} Inventory records, ${bomItemsFixedCount} BOM component items, and ${materialRequestsFixedCount} Material Request line items.`,
      stats: {
        inventoryFixed: inventoryFixedCount,
        bomItemsFixed: bomItemsFixedCount,
        materialRequestsFixed: materialRequestsFixedCount,
        totalMasterItems: masterMaps.byId.size
      }
    });
  } catch (error) {
    console.error("Error running syncMasterUoms:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

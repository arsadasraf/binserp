import mongoose from "mongoose";
import {
  rawMaterialSchema,
  boughtOutSchema,
  consumableItemSchema,
  fgItemSchema,
  inventorySchema,
  categorySchema,
  locationSchema,
} from "../../models/store/index.js";
import { buildMultiFieldSearchFilter } from "../../utils/searchHelper.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

const escapeRegex = (str) => {
  return (str || '').toString().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Fast unified keyword search across Store items (RM, BO, Consumables, FG)
 * GET /api/store/items/search?query=...&type=rm,bo&limit=30
 */
export const searchStoreItems = async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const { query = '', q = '', type = 'all', limit = 30, lite = '' } = req.query;

    const searchTerm = (query || q || '').toString().trim();
    const maxLimit = Math.min(Math.max(1, parseInt(limit) || 30), 100);
    const isLite = String(lite).toLowerCase() === '1' || String(lite).toLowerCase() === 'true';

    const RawMaterial = req.getModel('RawMaterial', rawMaterialSchema);
    const BoughtOut = req.getModel('BoughtOut', boughtOutSchema);
    const ConsumableItem = req.getModel('ConsumableItem', consumableItemSchema);
    const FGItem = req.getModel('FGItem', fgItemSchema);
    const Inventory = req.getModel('Inventory', inventorySchema);
    req.getModel('Category', categorySchema);
    req.getModel('Location', locationSchema);

    // Parse requested types
    const types = type.toString().toLowerCase().split(',').map(t => t.trim());
    const searchAll = types.includes('all') || types.length === 0 || types[0] === '';

    const includeRM = searchAll || types.includes('rm') || types.includes('rawmaterial') || types.includes('raw-material');
    const includeBO = searchAll || types.includes('bo') || types.includes('boughtout') || types.includes('bought-out');
    const includeConsumable = searchAll || types.includes('consumable') || types.includes('consumables') || types.includes('consumable-item');
    const includeFG = searchAll || types.includes('fg') || types.includes('finishedgoods') || types.includes('fg-item') || types.includes('inhouse');

    const searchFilter = { company: companyId, isActive: { $ne: false }, status: { $ne: 'Deactivated' } };

    // Search condition using space-free multi-keyword matching
    if (searchTerm) {
      const searchCondition = buildMultiFieldSearchFilter(searchTerm, ['name', 'code', 'descriptions', 'description']);
      if (searchCondition) {
        if (searchCondition.$or) {
          searchFilter.$or = searchCondition.$or;
        } else if (searchCondition.$and) {
          searchFilter.$and = searchCondition.$and;
        }
      }
    }

    const promises = [];
    const activeTypeCount = [includeRM, includeBO, includeConsumable, includeFG].filter(Boolean).length || 1;
    // Performance optimization: balanced per-collection cap (avoids over-fetching 4x rows on type=all)
    const perTypeLimit = searchAll
      ? (searchTerm ? Math.min(maxLimit, 20) : Math.max(4, Math.ceil(maxLimit / activeTypeCount)))
      : maxLimit;

    if (includeFG) {
      promises.push(
        FGItem.find(searchFilter)
          .select('_id name code descriptions description hsnCode unit type revisionNumber currentStock quantity')
          .limit(perTypeLimit)
          .lean()
          .then(items => items.map(item => ({ ...item, _type: 'Finished Good', _itemCategory: 'fg' })))
      );
    }

    if (includeRM) {
      let rmQuery = RawMaterial.find(searchFilter)
        .select('_id name code descriptions hsnCode unit categoryId locationId minimumStock currentStock quantity')
        .limit(perTypeLimit);
      if (!isLite) rmQuery = rmQuery.populate('categoryId', 'name').populate('locationId', 'name');
      promises.push(
        rmQuery
          .lean()
          .then(items => items.map(item => ({ ...item, _type: 'Raw Material', _itemCategory: 'rm' })))
      );
    }

    if (includeBO) {
      let boQuery = BoughtOut.find(searchFilter)
        .select('_id name code descriptions hsnCode unit categoryId locationId minimumStock currentStock quantity')
        .limit(perTypeLimit);
      if (!isLite) boQuery = boQuery.populate('categoryId', 'name').populate('locationId', 'name');
      promises.push(
        boQuery
          .lean()
          .then(items => items.map(item => ({ ...item, _type: 'Bought Out', _itemCategory: 'bo' })))
      );
    }

    if (includeConsumable) {
      let conQuery = ConsumableItem.find(searchFilter)
        .select('_id name code descriptions hsnCode unit categoryId locationId minimumStock currentStock quantity')
        .limit(perTypeLimit);
      if (!isLite) conQuery = conQuery.populate('categoryId', 'name').populate('locationId', 'name');
      promises.push(
        conQuery
          .lean()
          .then(items => items.map(item => ({ ...item, _type: 'Consumable', _itemCategory: 'consumable' })))
      );
    }

    const results = await Promise.all(promises);
    const combined = results.flat();

    // Fetch live inventory stock for matched non-FG item IDs (by materialId, materialCode, or materialName)
    const nonFgItems = combined.filter(c => c._itemCategory !== 'fg');
    const itemIds = nonFgItems.map(c => c._id);
    const itemNames = nonFgItems.map(c => c.name).filter(Boolean);
    const itemCodes = nonFgItems.map(c => c.code).filter(Boolean);

    const invOrConditions = [];
    if (itemIds.length > 0) invOrConditions.push({ materialId: { $in: itemIds } });
    if (itemCodes.length > 0) invOrConditions.push({ materialCode: { $in: itemCodes } });
    if (itemNames.length > 0) invOrConditions.push({ materialName: { $in: itemNames } });

    const inventories = invOrConditions.length > 0
      ? await Inventory.find({
          company: companyId,
          $or: invOrConditions
        }).select('materialId materialCode materialName currentStock qcPendingStock reorderLevel').lean()
      : [];

    const invByIdMap = new Map();
    const invByCodeMap = new Map();
    const invByNameMap = new Map();
    inventories.forEach(inv => {
      if (inv.materialId) invByIdMap.set(String(inv.materialId), inv);
      if (inv.materialCode) invByCodeMap.set(String(inv.materialCode).trim().toLowerCase(), inv);
      if (inv.materialName) invByNameMap.set(String(inv.materialName).trim().toLowerCase(), inv);
    });

    // Format into standard SearchableOption list with 100% live stock aligned to salesStockHelper
    const formatted = combined.map(item => {
      let currentStock = 0;
      let qcPendingStock = 0;

      if (item._itemCategory === 'fg') {
        // FG live stock is strictly FGItem.quantity (deducted/restored by DC, Invoice, FG GRN)
        currentStock = Math.max(0, Number(item.quantity || 0));
      } else {
        // RM / BO / Consumable live stock is strictly Inventory.currentStock
        const inv =
          invByIdMap.get(String(item._id)) ||
          (item.code ? invByCodeMap.get(String(item.code).trim().toLowerCase()) : null) ||
          (item.name ? invByNameMap.get(String(item.name).trim().toLowerCase()) : null);
        currentStock = inv ? Math.max(0, Number(inv.currentStock || 0)) : 0;
        qcPendingStock = inv ? Number(inv.qcPendingStock || 0) : 0;
      }

      const descStr = item.descriptions || item.description || '';

      return {
        value: String(item._id),
        label: descStr ? `${item.name} — ${descStr}` : item.name,
        name: item.name,
        code: item.code || '',
        description: descStr,
        hsnCode: item.hsnCode || '',
        unit: item.unit || 'PCS',
        itemType: item._type,
        itemCategory: item._itemCategory,
        category: item.categoryId?.name || item.categoryId || '',
        location: item.locationId?.name || item.locationId || '',
        currentStock,
        qcPendingStock,
        minimumStock: item.minimumStock || 0,
        badge: item._type === 'Finished Good' ? (item.type || 'Assembly') : item._type,
        subBadge: item.revisionNumber ? `Rev ${item.revisionNumber}` : undefined
      };
    });

    // Sort by smart relevance scoring (exact match -> clean match -> prefix -> token start -> word boundary)
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      const tokens = lower.split(/\s+/).filter(Boolean);
      const cleanQuery = lower.replace(/[^a-z0-9]/g, '');
      const firstToken = tokens[0] || lower;

      const getRelevanceScore = (item) => {
        const nameLower = (item.name || '').toLowerCase();
        const codeLower = (item.code || '').toLowerCase();
        
        // 1. Exact match
        if (nameLower === lower || codeLower === lower) return 0;

        // 2. Exact alphanumeric match (e.g. ss304 == SS-304)
        const cleanName = nameLower.replace(/[^a-z0-9]/g, '');
        const cleanCode = codeLower.replace(/[^a-z0-9]/g, '');
        if ((cleanQuery.length >= 2 && cleanName === cleanQuery) || (cleanQuery.length >= 2 && cleanCode === cleanQuery)) return 1;

        // 3. Starts with full search query
        if (nameLower.startsWith(lower) || codeLower.startsWith(lower)) return 2;
        if ((cleanQuery.length >= 2 && cleanName.startsWith(cleanQuery)) || (cleanQuery.length >= 2 && cleanCode.startsWith(cleanQuery))) return 3;

        // 4. Starts with first token
        if (nameLower.startsWith(firstToken) || codeLower.startsWith(firstToken)) return 4;

        // 5. Word boundary match
        if (nameLower.includes(` ${firstToken}`) || codeLower.includes(` ${firstToken}`)) return 5;

        return 6;
      };

      formatted.sort((a, b) => {
        const scoreDiff = getRelevanceScore(a) - getRelevanceScore(b);
        if (scoreDiff !== 0) return scoreDiff;
        return (a.name || '').localeCompare(b.name || '');
      });
    }

    res.status(200).json({
      items: formatted.slice(0, maxLimit),
      count: formatted.length,
      limit: maxLimit
    });
  } catch (error) {
    console.error("Error in searchStoreItems:", error);
    res.status(500).json({ message: error.message || "Failed to search store items" });
  }
};

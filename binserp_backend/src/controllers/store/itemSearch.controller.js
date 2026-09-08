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
    const { query = '', q = '', type = 'all', limit = 30 } = req.query;

    const searchTerm = (query || q || '').toString().trim();
    const maxLimit = Math.min(Math.max(1, parseInt(limit) || 30), 100);

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

    // Parse search tokens for intelligent multi-keyword matching
    const tokens = searchTerm.toLowerCase().split(/\s+/).filter(Boolean);

    if (tokens.length > 0) {
      // Build an $and condition where each token must be matched in at least one field (name, code, or description)
      const tokenConditions = tokens.map(token => {
        const escaped = escapeRegex(token);
        
        // Flexible separator pattern: allows "ss-304" to match "SS 304" or "ss304"
        let flexPattern = escaped.replace(/[-_./\s]+/g, '[-_./\\s]*');
        if (/^[a-z]+[0-9]+$/i.test(token)) {
          flexPattern = token.replace(/([a-z]+)([0-9]+)/i, '$1[-_./\\s]*$2');
        }

        const regex = new RegExp(flexPattern, 'i');
        return {
          $or: [
            { name: regex },
            { code: regex },
            { descriptions: regex },
            { description: regex },
          ]
        };
      });

      if (tokenConditions.length === 1) {
        searchFilter.$or = tokenConditions[0].$or;
      } else {
        searchFilter.$and = tokenConditions;
      }
    }

    const promises = [];

    if (includeRM) {
      promises.push(
        RawMaterial.find(searchFilter)
          .select('_id name code descriptions hsnCode unit categoryId locationId minimumStock currentStock quantity')
          .populate('categoryId', 'name')
          .populate('locationId', 'name')
          .limit(maxLimit)
          .lean()
          .then(items => items.map(item => ({ ...item, _type: 'Raw Material', _itemCategory: 'rm' })))
      );
    }

    if (includeBO) {
      promises.push(
        BoughtOut.find(searchFilter)
          .select('_id name code descriptions hsnCode unit categoryId locationId minimumStock currentStock quantity')
          .populate('categoryId', 'name')
          .populate('locationId', 'name')
          .limit(maxLimit)
          .lean()
          .then(items => items.map(item => ({ ...item, _type: 'Bought Out', _itemCategory: 'bo' })))
      );
    }

    if (includeConsumable) {
      promises.push(
        ConsumableItem.find(searchFilter)
          .select('_id name code descriptions hsnCode unit categoryId locationId minimumStock currentStock quantity')
          .populate('categoryId', 'name')
          .populate('locationId', 'name')
          .limit(maxLimit)
          .lean()
          .then(items => items.map(item => ({ ...item, _type: 'Consumable', _itemCategory: 'consumable' })))
      );
    }

    if (includeFG) {
      promises.push(
        FGItem.find(searchFilter)
          .select('_id name code descriptions description hsnCode unit type revisionNumber currentStock quantity')
          .limit(maxLimit)
          .lean()
          .then(items => items.map(item => ({ ...item, _type: 'Finished Good', _itemCategory: 'fg' })))
      );
    }

    const results = await Promise.all(promises);
    const combined = results.flat();

    // Fetch live inventory stock for matched item IDs in a single O(1) query
    const itemIds = combined.map(c => c._id);
    const inventories = await Inventory.find({
      company: companyId,
      materialId: { $in: itemIds }
    }).select('materialId currentStock qcPendingStock reorderLevel').lean();

    const invMap = new Map();
    inventories.forEach(inv => {
      if (inv.materialId) invMap.set(String(inv.materialId), inv);
    });

    // Format into standard SearchableOption list
    const formatted = combined.map(item => {
      const inv = invMap.get(String(item._id));
      const currentStock = inv?.currentStock !== undefined 
        ? inv.currentStock 
        : (item.currentStock !== undefined ? item.currentStock : (item.quantity || 0));
      const qcPendingStock = inv?.qcPendingStock || 0;

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
        subBadge: item.revisionNumber ? `Rev ${item.revisionNumber}` : (item.code || undefined)
      };
    });

    // Sort by smart relevance scoring (exact match -> clean match -> prefix -> token start -> word boundary)
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
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

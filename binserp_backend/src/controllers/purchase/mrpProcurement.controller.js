import mongoose from "mongoose";
import { mrpPlanSchema, purchaseOrderSchema, vendorPriceListSchema, vendorQuotationSchema, purchaseRFQSchema, purchaseItemMappingSchema } from "../../models/purchase/index.js";
import { 
  inventorySchema,
  rawMaterialSchema, 
  boughtOutSchema, 
  rmBoItemSchema, 
  consumableItemSchema,
  fgItemSchema,
  bomSchema,
  materialIssueSchema, 
  jobWorkSchema, 
  fgGRNSchema,
  vendorSchema,
  categorySchema
} from "../../models/store/index.js";
import { componentSchema, ppcOrderSchema } from "../../models/ppc/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { ApiError } from "../../utils/ApiError.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

const cleanStr = (s) => (s || "").toLowerCase().trim();
const cleanKey = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * 1. GET PROCUREMENT WORKBENCH
 * Aggregates shortages across all or specific active MRP plans, computes True Net Shortages,
 * builds Nested BOM tree, and classifies items accurately into RM, BO, Components, Sub-Assemblies, and Assemblies.
 */
export const getMRPProcurementWorkbench = asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req);
  const { mrpId } = req.query;

  const MRPPlan = req.getModel("MRPPlan", mrpPlanSchema);
  const PurchaseOrder = req.getModel("PurchaseOrder", purchaseOrderSchema);
  const Inventory = req.getModel("Inventory", inventorySchema);
  const RawMaterial = req.getModel("RawMaterial", rawMaterialSchema);
  const BoughtOut = req.getModel("BoughtOut", boughtOutSchema);
  const RmBoItem = req.getModel("RmBoItem", rmBoItemSchema);
  const ConsumableItem = req.getModel("ConsumableItem", consumableItemSchema);
  const Component = req.getModel("Component", componentSchema);
  const FGItem = req.getModel("FGItem", fgItemSchema);
  const BOM = req.getModel("BOM", bomSchema);
  const VendorPriceList = req.getModel("VendorPriceList", vendorPriceListSchema);
  const Vendor = req.getModel("Vendor", vendorSchema);
  const Category = req.getModel("Category", categorySchema);

  // Fetch active MRP Plans
  const query = {
    company: companyId,
    status: { $nin: ["Cancelled", "Draft"] }
  };
  if (mrpId && mrpId !== "all") {
    query._id = mrpId;
  }

  const activeMrpPlans = await MRPPlan.find(query).sort({ createdAt: -1 });

  // Fetch Open Purchase Orders (to calculate In-Transit Stock)
  const openPOs = await PurchaseOrder.find({
    company: companyId,
    status: { $in: ["Draft", "Released", "Approved", "Sent to Vendor", "Partially Received", "Ordered"] }
  }).populate("vendor", "name code email phone");

  // Build In-Transit PO Quantities Map
  const inTransitMap = new Map();
  openPOs.forEach(po => {
    (po.items || []).forEach(item => {
      const pendingQty = Number(item.pendingQuantity ?? (item.quantity - (item.receivedQuantity || 0))) || 0;
      if (pendingQty > 0 || po.status === "Draft" || po.status === "Released") {
        const nameK = cleanStr(item.materialName || item.itemName);
        const codeK = cleanStr(item.materialCode || item.itemCode);
        const matIdK = item.material ? String(item.material) : null;

        const poInfo = {
          poId: po._id,
          poNumber: po.poNumber,
          mrpPlanId: po.mrpPlanId ? String(po.mrpPlanId) : null,
          mrpNumber: po.mrpNumber || null,
          vendorName: po.vendorName || po.vendor?.name || "Vendor",
          orderedQty: item.quantity,
          receivedQty: item.receivedQuantity || 0,
          pendingQty: pendingQty > 0 ? pendingQty : item.quantity,
          unit: item.unit || "PCS",
          rate: item.rate || 0,
          expectedDate: item.expectedDeliveryDate || po.expectedDeliveryDate
        };

        [nameK, codeK, cleanKey(nameK), cleanKey(codeK), matIdK].filter(Boolean).forEach(k => {
          if (!inTransitMap.has(k)) {
            inTransitMap.set(k, { totalInTransit: 0, poList: [] });
          }
          const entry = inTransitMap.get(k);
          if (pendingQty > 0) entry.totalInTransit += pendingQty;
          if (!entry.poList.some(p => p.poNumber === po.poNumber)) {
            entry.poList.push(poInfo);
          }
        });
      }
    });
  });

  // Helper to extract in-transit information strictly scoped to a specific plan (or general unassigned store stock)
  const getInTransitForPlan = (keys, pId, pMrpNo) => {
    let totalInTransit = 0;
    const poList = [];
    const pIdStr = pId ? String(pId) : null;
    const isPlanScoped = Boolean(pIdStr || pMrpNo);

    keys.filter(Boolean).forEach(k => {
      const entry = inTransitMap.get(k);
      if (entry && Array.isArray(entry.poList)) {
        entry.poList.forEach(po => {
          const isThisPlan = (pIdStr && po.mrpPlanId && String(po.mrpPlanId) === pIdStr) ||
                             (pMrpNo && po.mrpNumber && po.mrpNumber === pMrpNo);

          // If querying for a specific plan, ONLY include POs raised specifically for this plan!
          // Unassigned / foreign POs from other MRPs must NEVER reduce shortage or appear in this plan.
          if (isPlanScoped) {
            if (isThisPlan) {
              if (!poList.some(p => p.poNumber === po.poNumber)) {
                poList.push(po);
                totalInTransit += po.pendingQty;
              }
            }
          } else {
            // Top-level company-wide summary view
            if (!poList.some(p => p.poNumber === po.poNumber)) {
              poList.push(po);
              totalInTransit += po.pendingQty;
            }
          }
        });
      }
    });

    return { totalInTransit, poList };
  };

  // Fetch ALL live stock masters and inventory records in parallel
  const [
    inventories,
    rmStock, 
    boStock, 
    rmBoStock, 
    consumables,
    components,
    fgStock,
    allBOMs,
    vendorPriceLists,
    allCategories
  ] = await Promise.all([
    Inventory.find({ company: companyId }).populate("categoryId", "name code").lean(),
    RawMaterial.find({ company: companyId }).populate("categoryId", "name code").lean(),
    BoughtOut.find({ company: companyId }).populate("categoryId", "name code").lean(),
    RmBoItem.find({ company: companyId }).populate("categoryId", "name code").lean(),
    ConsumableItem.find({ company: companyId }).populate("categoryId", "name code").lean(),
    Component.find({ company: companyId }).lean(),
    FGItem.find({ company: companyId }).lean(),
    BOM.find({ company: companyId, status: { $ne: "Inactive" } }).lean(),
    VendorPriceList.find({ company: companyId }).populate("vendor", "name code email phone").lean(),
    Category.find({ company: companyId }).lean()
  ]);

  // Fast Category map and Master Category lookup map
  const categoryMap = new Map();
  (allCategories || []).forEach(cat => {
    if (cat._id) categoryMap.set(String(cat._id), cat.name);
    if (cat.code) categoryMap.set(String(cat.code).toLowerCase(), cat.name);
  });

  const categoryLookupMap = new Map();
  const registerCategory = (name, code, catName) => {
    if (!catName || catName === "Raw Material" || catName === "Bought Out" || catName === "RM/BO") return;
    [cleanStr(name), cleanStr(code), cleanKey(name), cleanKey(code)].filter(Boolean).forEach(k => {
      if (!categoryLookupMap.has(k)) {
        categoryLookupMap.set(k, catName);
      }
    });
  };

  // Master Classification Sets to prevent RM from misclassifying into BO
  const rmSet = new Set();
  const boSet = new Set();
  const compSet = new Set();
  const subAssemblySet = new Set();
  const assemblySet = new Set();

  // 1. Register Raw Materials from RawMaterial master
  rmStock.forEach(r => {
    if (r.name) { rmSet.add(cleanStr(r.name)); rmSet.add(cleanKey(r.name)); }
    if (r.code) { rmSet.add(cleanStr(r.code)); rmSet.add(cleanKey(r.code)); }
  });

  // 2. Register Bought Out items from BoughtOut master
  boStock.forEach(b => {
    if (b.name) { boSet.add(cleanStr(b.name)); boSet.add(cleanKey(b.name)); }
    if (b.code) { boSet.add(cleanStr(b.code)); boSet.add(cleanKey(b.code)); }
  });

  // 3. Register from RmBoItem master based on explicit itemType
  rmBoStock.forEach(item => {
    const rawType = (item.itemType || "").toLowerCase();
    const catName = (item.categoryId?.name || "").toLowerCase();
    const isRM = rawType === "raw material" || rawType === "rm" || catName.includes("raw");
    const isBO = rawType === "bought out" || rawType === "bo" || catName.includes("bought");

    if (isRM) {
      if (item.name) { rmSet.add(cleanStr(item.name)); rmSet.add(cleanKey(item.name)); }
      if (item.code) { rmSet.add(cleanStr(item.code)); rmSet.add(cleanKey(item.code)); }
    } else if (isBO && !rmSet.has(cleanStr(item.name))) {
      if (item.name) { boSet.add(cleanStr(item.name)); boSet.add(cleanKey(item.name)); }
      if (item.code) { boSet.add(cleanStr(item.code)); boSet.add(cleanKey(item.code)); }
    }
  });

  // 4. Register Components from PPC Component master
  components.forEach(comp => {
    const name = comp.name || comp.componentName;
    const code = comp.code || comp.componentCode;
    if (name) { compSet.add(cleanStr(name)); compSet.add(cleanKey(name)); }
    if (code) { compSet.add(cleanStr(code)); compSet.add(cleanKey(code)); }
  });

  // 5. Register Sub-Assemblies, Components and Assemblies from FGItems master
  fgStock.forEach(fg => {
    const name = fg.name || fg.itemName || "";
    const code = fg.code || fg.itemCode || "";
    const fgType = fg.type || "Component";

    if (fgType === "Sub Assembly") {
      if (name) { subAssemblySet.add(cleanStr(name)); subAssemblySet.add(cleanKey(name)); }
      if (code) { subAssemblySet.add(cleanStr(code)); subAssemblySet.add(cleanKey(code)); }
    } else if (fgType === "Component") {
      if (name) { compSet.add(cleanStr(name)); compSet.add(cleanKey(name)); }
      if (code) { compSet.add(cleanStr(code)); compSet.add(cleanKey(code)); }
    } else {
      if (name) { assemblySet.add(cleanStr(name)); assemblySet.add(cleanKey(name)); }
      if (code) { assemblySet.add(cleanStr(code)); assemblySet.add(cleanKey(code)); }
    }
  });

  // 6. Register Sub-Assemblies from BOM collection
  allBOMs.forEach(b => {
    if (b.productName) { subAssemblySet.add(cleanStr(b.productName)); subAssemblySet.add(cleanKey(b.productName)); }
    if (b.productCode) { subAssemblySet.add(cleanStr(b.productCode)); subAssemblySet.add(cleanKey(b.productCode)); }
  });

  // Master Stock & Live Inventory Map
  const stockMap = new Map();
  const setStockEntry = (keys, info) => {
    keys.filter(Boolean).forEach(k => {
      if (!stockMap.has(k) || (info.priority && info.priority >= (stockMap.get(k).priority || 0))) {
        stockMap.set(k, info);
      }
    });
  };

  // Populate PPC Components Stock
  components.forEach(comp => {
    const name = comp.name || comp.componentName || "";
    const code = comp.code || comp.componentCode || "";
    const qty = Number(comp.quantity ?? comp.currentStock ?? 0);
    const info = {
      materialId: comp._id,
      name,
      code,
      description: comp.description || comp.descriptions || "",
      currentStock: qty,
      unit: comp.unit || "PCS",
      hasSecondaryUnit: Boolean(comp.hasSecondaryUnit && comp.secondaryUnit),
      secondaryUnit: comp.secondaryUnit || "",
      conversionFactor: Number(comp.conversionFactor) || 1,
      itemType: "Component",
      category: "In-House Component",
      priority: 3
    };
    setStockEntry([String(comp._id), cleanStr(code), cleanStr(name), cleanKey(code), cleanKey(name)], info);
  });

  // Populate FG Stock respecting explicit FG type (Sub Assembly, Component, or Assembly)
  fgStock.forEach(fg => {
    const name = fg.name || fg.itemName || "";
    const code = fg.code || fg.itemCode || "";
    const qty = Number(fg.stock ?? fg.currentStock ?? fg.quantity ?? 0);
    const fgType = fg.type || "Component";

    let itemType = "Assembly";
    let category = "Finished Good";
    if (fgType === "Sub Assembly") {
      itemType = "SubAssembly";
      category = "Sub Assembly";
    } else if (fgType === "Component") {
      itemType = "Component";
      category = "In-House Component";
    } else {
      itemType = "Assembly";
      category = "Finished Good / Assembly";
    }

    const info = {
      materialId: fg._id,
      name,
      code,
      description: fg.description || fg.descriptions || "",
      currentStock: qty,
      unit: fg.unit || "PCS",
      hasSecondaryUnit: Boolean(fg.hasSecondaryUnit && fg.secondaryUnit),
      secondaryUnit: fg.secondaryUnit || "",
      conversionFactor: Number(fg.conversionFactor) || 1,
      itemType,
      category,
      priority: 3
    };
    setStockEntry([String(fg._id), cleanStr(code), cleanStr(name), cleanKey(code), cleanKey(name)], info);
  });

  // Populate RM Stock
  rmStock.forEach(rm => {
    const catName = rm.categoryId?.name || (rm.categoryId && categoryMap.get(String(rm.categoryId))) || rm.category || "Raw Material";
    registerCategory(rm.name, rm.code, catName);
    const info = {
      materialId: rm._id,
      name: rm.name,
      code: rm.code,
      description: rm.description || rm.descriptions || "",
      currentStock: Number(rm.currentStock || 0),
      unit: rm.unit || "PCS",
      hasSecondaryUnit: Boolean(rm.hasSecondaryUnit && rm.secondaryUnit),
      secondaryUnit: rm.secondaryUnit || "",
      conversionFactor: Number(rm.conversionFactor) || 1,
      baseRate: Number(rm.rate || 0),
      itemType: "RM",
      category: catName,
      priority: 2
    };
    setStockEntry([String(rm._id), cleanStr(rm.code), cleanStr(rm.name), cleanKey(rm.code), cleanKey(rm.name)], info);
  });

  // Populate BO Stock
  boStock.forEach(bo => {
    const catName = bo.categoryId?.name || (bo.categoryId && categoryMap.get(String(bo.categoryId))) || bo.category || "Bought Out";
    registerCategory(bo.name, bo.code, catName);
    const info = {
      materialId: bo._id,
      name: bo.name,
      code: bo.code,
      description: bo.description || bo.descriptions || "",
      currentStock: Number(bo.currentStock || 0),
      unit: bo.unit || "PCS",
      hasSecondaryUnit: Boolean(bo.hasSecondaryUnit && bo.secondaryUnit),
      secondaryUnit: bo.secondaryUnit || "",
      conversionFactor: Number(bo.conversionFactor) || 1,
      baseRate: Number(bo.rate || 0),
      itemType: "BO",
      category: catName,
      priority: 2
    };
    setStockEntry([String(bo._id), cleanStr(bo.code), cleanStr(bo.name), cleanKey(bo.code), cleanKey(bo.name)], info);
  });

  // Populate RM/BO Item Profiles
  rmBoStock.forEach(item => {
    const rawType = (item.itemType || "").toLowerCase();
    const isRM = rawType === "raw material" || (!rawType && !item.code?.toUpperCase().startsWith("BO"));
    const catName = item.categoryId?.name || (item.categoryId && categoryMap.get(String(item.categoryId))) || item.category || (isRM ? "Raw Material" : "Bought Out");
    registerCategory(item.name, item.code, catName);
    const info = {
      materialId: item._id,
      name: item.name,
      code: item.code,
      description: item.description || item.descriptions || "",
      currentStock: Number(item.currentStock || item.minimumStock || 0),
      unit: item.unit || "PCS",
      hasSecondaryUnit: Boolean(item.hasSecondaryUnit && item.secondaryUnit),
      secondaryUnit: item.secondaryUnit || "",
      conversionFactor: Number(item.conversionFactor) || 1,
      baseRate: Number(item.rate || 0),
      itemType: isRM ? "RM" : "BO",
      category: catName,
      priority: 2
    };
    setStockEntry([String(item._id), cleanStr(item.code), cleanStr(item.name), cleanKey(item.code), cleanKey(item.name)], info);
  });

  // Populate Consumables Stock
  consumables.forEach(con => {
    const catName = con.categoryId?.name || (con.categoryId && categoryMap.get(String(con.categoryId))) || con.category || "Consumable";
    registerCategory(con.name, con.code, catName);
    const info = {
      materialId: con._id,
      name: con.name,
      code: con.code,
      description: con.description || con.descriptions || "",
      currentStock: Number(con.currentStock || con.quantity || 0),
      unit: con.unit || "PCS",
      hasSecondaryUnit: Boolean(con.hasSecondaryUnit && con.secondaryUnit),
      secondaryUnit: con.secondaryUnit || "",
      conversionFactor: Number(con.conversionFactor) || 1,
      baseRate: Number(con.rate || 0),
      itemType: "Consumable",
      category: catName,
      priority: 2
    };
    setStockEntry([cleanStr(con.code), cleanStr(con.name), cleanKey(con.code), cleanKey(con.name)], info);
  });

  // Populate Store Inventory (HIGHEST PRIORITY FOR LIVE PHYSICAL STOCK)
  inventories.forEach(inv => {
    const name = inv.materialName || "";
    const code = inv.materialCode || "";
    const qty = Number(inv.currentStock || 0);
    const existing = stockMap.get(cleanStr(code)) || stockMap.get(cleanStr(name));
    
    // Check whether this inventory item is an RM or BO
    const isExplicitRM = rmSet.has(cleanStr(name)) || rmSet.has(cleanStr(code)) || (inv.itemType && (inv.itemType.toLowerCase() === "raw material" || inv.itemType.toLowerCase() === "rm"));
    const isExplicitBO = !isExplicitRM && (boSet.has(cleanStr(name)) || boSet.has(cleanStr(code)) || (inv.itemType && (inv.itemType.toLowerCase() === "bought out" || inv.itemType.toLowerCase() === "bo")));
    const resolvedType = isExplicitRM ? "RM" : (isExplicitBO ? "BO" : (existing?.itemType || (code.toUpperCase().startsWith("BO") ? "BO" : "RM")));

    const invCat = inv.categoryId?.name || (inv.categoryId && categoryMap.get(String(inv.categoryId))) || inv.category;
    const catName = invCat || existing?.category || (resolvedType === "RM" ? "Raw Material" : "Bought Out");
    if (invCat) registerCategory(name, code, invCat);

    const hasSec = Boolean(inv.hasSecondaryUnit && inv.secondaryUnit) || Boolean(existing?.hasSecondaryUnit && existing?.secondaryUnit);
    const secUnit = (inv.hasSecondaryUnit && inv.secondaryUnit) ? inv.secondaryUnit : (existing?.secondaryUnit || "");
    const convFact = Number((inv.hasSecondaryUnit && inv.conversionFactor) ? inv.conversionFactor : (existing?.conversionFactor || 1)) || 1;

    const info = {
      materialId: inv.materialId || inv._id,
      name,
      code,
      description: inv.description || existing?.description || "",
      currentStock: qty,
      unit: inv.unit || existing?.unit || "PCS",
      hasSecondaryUnit: hasSec,
      secondaryUnit: secUnit,
      conversionFactor: convFact,
      baseRate: Number(inv.unitPrice || existing?.baseRate || 0),
      itemType: resolvedType,
      category: catName,
      priority: 5 // Live Physical Store Stock
    };
    setStockEntry([cleanStr(code), cleanStr(name), cleanKey(code), cleanKey(name)], info);
  });

  // Material master lookup map for VendorPriceList resolution
  const allMaterialsLookupMap = new Map();
  (rmBoStock || []).forEach(m => m._id && allMaterialsLookupMap.set(m._id.toString(), m));
  (rmStock || []).forEach(m => m._id && allMaterialsLookupMap.set(m._id.toString(), m));
  (boStock || []).forEach(m => m._id && allMaterialsLookupMap.set(m._id.toString(), m));
  (consumables || []).forEach(m => m._id && allMaterialsLookupMap.set(m._id.toString(), m));

  // Vendor Price List Lookup
  const priceListMap = new Map();
  vendorPriceLists.forEach(vpl => {
    // Resolve material object if stored as ID or unpopulated
    const rawMatId = (vpl.material?._id || vpl.material)?.toString();
    const resolvedMat = (rawMatId && allMaterialsLookupMap.get(rawMatId)) || vpl.material;

    // 1. Direct VendorPriceList document with material reference
    if (resolvedMat || rawMatId) {
      const mat = resolvedMat;
      const matName = typeof mat === 'object' ? (mat.name || mat.materialName || "") : "";
      const matCode = typeof mat === 'object' ? (mat.code || mat.materialCode || "") : "";
      const matId = rawMatId || (typeof mat === 'object' ? (mat._id?.toString() || "") : (mat ? mat.toString() : ""));

      const entry = {
        vendorId: vpl.vendor?._id || vpl.vendor,
        vendorName: vpl.vendor?.name || "Vendor",
        vendorCode: vpl.vendor?.code || "",
        rate: Number(vpl.price || 0),
        taxRate: Number(vpl.taxRate || 0),
        isPreferred: Boolean(vpl.isPreferred),
        leadTimeDays: vpl.leadTimeDays || 7,
        moq: vpl.moq || 1,
        currency: vpl.currency || "INR"
      };

      const keys = [
        cleanStr(matName),
        cleanStr(matCode),
        cleanKey(matName),
        cleanKey(matCode),
        matId
      ].filter(Boolean);

      keys.forEach(k => {
        if (!priceListMap.has(k)) priceListMap.set(k, []);
        priceListMap.get(k).push(entry);
      });
    }

    // 2. If vpl has items array
    if (Array.isArray(vpl.items)) {
      vpl.items.forEach(vItem => {
        const nameK = cleanStr(vItem.materialName || vItem.itemName);
        const codeK = cleanStr(vItem.materialCode || vItem.itemCode);
        const entry = {
          vendorId: vpl.vendor?._id,
          vendorName: vpl.vendor?.name || vpl.vendorName,
          vendorCode: vpl.vendor?.code,
          rate: Number(vItem.rate || vItem.unitPrice || 0),
          taxRate: Number(vItem.taxRate || vpl.taxRate || 0),
          isPreferred: Boolean(vItem.isPreferred || vpl.isPreferred),
          leadTimeDays: vItem.leadTimeDays || vpl.leadTimeDays || 7,
          moq: vItem.moq || 1,
          currency: vpl.currency || "INR"
        };

        [nameK, codeK, cleanKey(nameK), cleanKey(codeK)].filter(Boolean).forEach(k => {
          if (!priceListMap.has(k)) priceListMap.set(k, []);
          priceListMap.get(k).push(entry);
        });
      });
    }
  });

  // Classification Resolver using master sets
  const resolveClassificationType = (name, code, rawType, rawCategory, level, planRmKeys, planBoKeys) => {
    const n = cleanStr(name);
    const c = cleanStr(code);
    const nK = cleanKey(name);
    const cK = cleanKey(code);
    const t = (rawType || "").toLowerCase();
    const cat = (rawCategory || "").toLowerCase();

    // 1. Explicit RAW MATERIAL check (Highest Priority to avoid RM appearing in BO)
    if (
      planRmKeys?.has(n) || planRmKeys?.has(c) ||
      rmSet.has(n) || rmSet.has(c) || rmSet.has(nK) || rmSet.has(cK) ||
      t === "rm" || t === "raw material" || cat.includes("raw") || cat.includes("metal") || cat.includes("steel") ||
      cat.includes("aluminum") || cat.includes("brass") || cat.includes("copper") || cat.includes("iron") ||
      cat.includes("sheet") || cat.includes("rod") || cat.includes("bar") || cat.includes("pipe") || cat.includes("plate")
    ) {
      return { itemType: "RM", category: "Raw Material" };
    }

    // 2. Sub-Assembly
    if (
      subAssemblySet.has(n) || subAssemblySet.has(c) || subAssemblySet.has(nK) || subAssemblySet.has(cK) ||
      t === "subassembly" || t === "sub assembly" || t.includes("sub") || cat.includes("sub") || cat.includes("weldment") ||
      c.startsWith("sa-") || c.startsWith("sub-")
    ) {
      return { itemType: "SubAssembly", category: "Sub Assembly" };
    }

    // 3. Component
    if (
      compSet.has(n) || compSet.has(c) || compSet.has(nK) || compSet.has(cK) ||
      t === "component" || t.includes("comp") || cat.includes("comp") || cat.includes("machined") || cat.includes("turned") || cat.includes("milled") ||
      c.startsWith("comp") || c.startsWith("prt") || c.startsWith("cp-")
    ) {
      return { itemType: "Component", category: "Component Part" };
    }

    // 4. Bought Out (BO)
    if (
      planBoKeys?.has(n) || planBoKeys?.has(c) ||
      boSet.has(n) || boSet.has(c) || boSet.has(nK) || boSet.has(cK) ||
      t === "bo" || t === "bought out" || cat.includes("bought") || cat.includes("hardware") || cat.includes("fastener") ||
      cat.includes("bolt") || cat.includes("nut") || cat.includes("screw") || cat.includes("bearing") || cat.includes("motor") ||
      c.startsWith("bo-") || c.startsWith("hdw-") || c.startsWith("fst-") || c.startsWith("brg-")
    ) {
      return { itemType: "BO", category: "Bought Out" };
    }

    // 5. Assembly / FG
    if (
      assemblySet.has(n) || assemblySet.has(c) || assemblySet.has(nK) || assemblySet.has(cK) ||
      t === "fg" || t === "assembly" || t === "finished good" || cat.includes("finished")
    ) {
      return { itemType: "Assembly", category: "Finished Good / Assembly" };
    }

    // Default fallback: Raw Material
    return { itemType: "RM", category: "Raw Material" };
  };

  // Helper to process material item with LIVE stock lookup
  const processMaterialInfo = (name, code, reqQty, unit, rawItemType, rawCategory, parentMRP, level, planRmKeys, planBoKeys, existingStatus, rawDescription, poNumber = "", rfqNumber = "", planId = null) => {
    const nKey = cleanStr(name);
    const cKey = cleanStr(code);

    // Retrieve Live Stock from Master Inventory
    const stockInfo = 
      stockMap.get(cKey) || 
      stockMap.get(nKey) || 
      stockMap.get(cleanKey(cKey)) || 
      stockMap.get(cleanKey(nKey)) || {
        currentStock: 0,
        unit: unit || "PCS",
        baseRate: 0
      };

    // In-Transit POs: strictly scoped to this plan + general inventory replenishment
    const inTransitInfo = getInTransitForPlan([cKey, nKey, cleanKey(cKey), cleanKey(nKey)], planId, parentMRP);

    // Best Vendor Quote
    const vendorQuotes = 
      priceListMap.get(cKey) || 
      priceListMap.get(nKey) || 
      priceListMap.get(cleanKey(cKey)) || 
      priceListMap.get(cleanKey(nKey)) || [];

    const bestVendor = vendorQuotes.length > 0
      ? vendorQuotes.reduce((prev, curr) => {
          if (curr.isPreferred && !prev.isPreferred) return curr;
          if (!curr.isPreferred && prev.isPreferred) return prev;
          return curr.rate < prev.rate ? curr : prev;
        }, vendorQuotes[0])
      : null;

    const classification = resolveClassificationType(name, code, rawItemType, rawCategory, level, planRmKeys, planBoKeys);
    const currentLiveStock = Number(stockInfo.currentStock || 0);
    const netShortage = Math.max(0, reqQty - currentLiveStock - inTransitInfo.totalInTransit);

    const hasSecondaryUnit = Boolean(stockInfo.hasSecondaryUnit && stockInfo.secondaryUnit);
    const secondaryUnit = hasSecondaryUnit ? (stockInfo.secondaryUnit || "") : "";
    const conversionFactor = hasSecondaryUnit ? (Number(stockInfo.conversionFactor) || 1) : 1;

    const roundQty = (val) => (val != null && !isNaN(val)) ? Math.round(Number(val) * 1000) / 1000 : null;

    const secondaryRequiredQuantity = hasSecondaryUnit ? roundQty(reqQty * conversionFactor) : null;
    const secondaryCurrentPhysicalStock = hasSecondaryUnit ? roundQty(currentLiveStock * conversionFactor) : null;
    const secondaryNetShortage = hasSecondaryUnit ? roundQty(netShortage * conversionFactor) : null;
    const secondaryTotalInTransitPO = hasSecondaryUnit ? roundQty(inTransitInfo.totalInTransit * conversionFactor) : null;

    // Resolve true master category (prefer specific assigned category over generic "Raw Material" / "Bought Out")
    const assignedCategory =
      (stockInfo.category && stockInfo.category !== "Raw Material" && stockInfo.category !== "Bought Out" && stockInfo.category !== "RM/BO" ? stockInfo.category : "") ||
      categoryLookupMap.get(cKey) || 
      categoryLookupMap.get(nKey) || 
      categoryLookupMap.get(cleanKey(cKey)) || 
      categoryLookupMap.get(cleanKey(nKey)) ||
      stockInfo.category ||
      (rawCategory && rawCategory !== "Raw Material" && rawCategory !== "Bought Out" && rawCategory !== "RM/BO" && rawCategory !== "Material" ? rawCategory : "") ||
      (classification.itemType === "RM" ? "Raw Material" : classification.itemType === "BO" ? "Bought Out" : classification.category);

    return {
      materialId: stockInfo.materialId || undefined,
      materialKey: cKey || nKey || cleanKey(name) || (stockInfo.materialId ? String(stockInfo.materialId) : "") || `mat_${Math.random().toString(36).substring(2, 9)}`,
      materialName: name,
      materialCode: code || stockInfo.code || "",
      description: rawDescription || stockInfo.description || "",
      itemType: classification.itemType,
      category: assignedCategory,
      unit: unit || stockInfo.unit || "PCS",
      hasSecondaryUnit,
      secondaryUnit,
      conversionFactor,
      requiredQuantity: reqQty,
      secondaryRequiredQuantity,
      currentPhysicalStock: currentLiveStock,
      secondaryCurrentPhysicalStock,
      totalInTransitPO: inTransitInfo.totalInTransit,
      secondaryTotalInTransitPO,
      openPOs: inTransitInfo.poList,
      netShortage,
      secondaryNetShortage,
      bestVendor,
      allVendors: vendorQuotes,
      estimatedRate: bestVendor?.rate || stockInfo.baseRate || 0,
      estimatedValue: netShortage * (bestVendor?.rate || stockInfo.baseRate || 0),
      parentMRP: parentMRP || "",
      status: existingStatus || "Pending",
      poNumber: poNumber || "",
      rfqNumber: rfqNumber || ""
    };
  };

  // 1. Consolidated Classification Maps across active plans
  const rmMap = new Map();
  const boMap = new Map();
  const componentMap = new Map();
  const subAssemblyMap = new Map();
  const assemblyMap = new Map();
  // Build map of committed PO amounts per MRP Plan
  const poCommittedByPlan = new Map();
  (openPOs || []).forEach(po => {
    const amt = Number(po.grandTotal != null ? po.grandTotal : (po.totalAmount != null ? po.totalAmount : 0)) || 0;
    if (po.mrpPlanId) {
      const idStr = String(po.mrpPlanId);
      poCommittedByPlan.set(idStr, (poCommittedByPlan.get(idStr) || 0) + amt);
    }
    if (po.mrpNumber) {
      poCommittedByPlan.set(po.mrpNumber, (poCommittedByPlan.get(po.mrpNumber) || 0) + amt);
    }
  });

  // Fetch active purchase item mappings for this company
  const PurchaseItemMapping = req.getModel("PurchaseItemMapping", purchaseItemMappingSchema);
  const activeMappings = await PurchaseItemMapping.find({ company: companyId }).lean();

  const planSpecificMappingById = new Map();
  const planSpecificMappingByKey = new Map();
  const globalDefaultMappingById = new Map();
  const globalDefaultMappingByKey = new Map();

  activeMappings.forEach(m => {
    const sId = m.sourceItemId ? m.sourceItemId.toString() : null;
    const planId = m.mrpPlanId ? m.mrpPlanId.toString() : null;
    const sName = cleanStr(m.sourceItemName);
    const sCode = cleanStr(m.sourceItemCode);

    if (planId) {
      if (sId) planSpecificMappingById.set(`${sId}_${planId}`, m);
      if (sName) planSpecificMappingByKey.set(`${sName}_${planId}`, m);
      if (sCode) planSpecificMappingByKey.set(`${sCode}_${planId}`, m);
    } else {
      if (sId) globalDefaultMappingById.set(sId, m);
      if (sName) globalDefaultMappingByKey.set(sName, m);
      if (sCode) globalDefaultMappingByKey.set(sCode, m);
    }
  });

  const resolveItemMapping = (item, explicitPlanId = null) => {
    const sId = (item.materialId || item._id) ? (item.materialId || item._id).toString() : null;
    const sName = cleanStr(item.materialName || item.name);
    const sCode = cleanStr(item.materialCode || item.code);

    const planId = explicitPlanId || (mrpId && mrpId !== "all" ? String(mrpId) : (item.mrpSources?.length === 1 ? String(item.mrpSources[0].mrpId) : null));

    if (planId) {
      const planMapping = (sId && planSpecificMappingById.get(`${sId}_${planId}`)) ||
                          (sName && planSpecificMappingByKey.get(`${sName}_${planId}`)) ||
                          (sCode && planSpecificMappingByKey.get(`${sCode}_${planId}`));
      if (planMapping) {
        if (planMapping.isDetached) {
          return {
            isDetached: true,
            isPlanSpecific: true,
            mrpPlanId: planId,
            mappingId: planMapping._id,
            purchaseBucket: null
          };
        }
        return {
          isDetached: false,
          isPlanSpecific: true,
          mrpPlanId: planId,
          mappingId: planMapping._id,
          purchaseBucket: {
            mappingId: planMapping._id,
            targetPurchaseItemId: planMapping.targetPurchaseItemId,
            targetPurchaseItemType: planMapping.targetPurchaseItemType,
            targetPurchaseItemName: planMapping.targetPurchaseItemName,
            targetPurchaseItemCode: planMapping.targetPurchaseItemCode,
            targetPurchaseItemDescription: planMapping.targetPurchaseItemDescription || "",
            primaryUnit: planMapping.primaryUnit,
            secondaryUnit: planMapping.secondaryUnit,
            hasSecondaryUnit: Boolean(planMapping.hasSecondaryUnit),
            conversionFactor: Number(planMapping.conversionFactor) || 1,
            isPlanSpecific: true,
            mrpPlanId: planId
          }
        };
      }

      // If no plan-specific mapping exists for this MRP plan:
      // Do NOT auto-lock this MRP into a global purchase bucket!
      // Return null purchaseBucket so the item starts clean as its own RM / BO,
      // and planners can explicitly convert it for this MRP or keep it individual!
      return {
        isDetached: false,
        isPlanSpecific: false,
        mrpPlanId: null,
        mappingId: null,
        purchaseBucket: null
      };
    }

    const globalMapping = (sId && globalDefaultMappingById.get(sId)) ||
                          (sName && globalDefaultMappingByKey.get(sName)) ||
                          (sCode && globalDefaultMappingByKey.get(sCode));

    if (globalMapping && !globalMapping.isDetached) {
      return {
        isDetached: false,
        isPlanSpecific: false,
        mrpPlanId: null,
        mappingId: globalMapping._id,
        purchaseBucket: {
          mappingId: globalMapping._id,
          targetPurchaseItemId: globalMapping.targetPurchaseItemId,
          targetPurchaseItemType: globalMapping.targetPurchaseItemType,
          targetPurchaseItemName: globalMapping.targetPurchaseItemName,
          targetPurchaseItemCode: globalMapping.targetPurchaseItemCode,
          targetPurchaseItemDescription: globalMapping.targetPurchaseItemDescription || "",
          primaryUnit: globalMapping.primaryUnit,
          secondaryUnit: globalMapping.secondaryUnit,
          hasSecondaryUnit: Boolean(globalMapping.hasSecondaryUnit),
          conversionFactor: Number(globalMapping.conversionFactor) || 1,
          isPlanSpecific: false,
          mrpPlanId: null
        }
      };
    }

    return {
      isDetached: false,
      isPlanSpecific: false,
      mrpPlanId: null,
      mappingId: null,
      purchaseBucket: null
    };
  };

  const attachBucketInfo = (item, explicitPlanId = null) => {
    const resolved = resolveItemMapping(item, explicitPlanId);
    if (resolved.isDetached) {
      return {
        ...item,
        isDetachedForPlan: true,
        planSpecificMappingId: resolved.mappingId,
        purchaseBucket: null
      };
    }
    if (resolved.purchaseBucket) {
      let pStatus = item.materialPlanningStatus;
      if (!pStatus || pStatus === 'Not Planned' || pStatus === 'Pending') {
        pStatus = 'In Purchase Bucket';
      }
      return {
        ...item,
        materialPlanningStatus: pStatus,
        isDetachedForPlan: false,
        purchaseBucket: resolved.purchaseBucket
      };
    }
    return {
      ...item,
      isDetachedForPlan: false,
      purchaseBucket: null
    };
  };

  // 2. Build Nested BOM Tree per MRP Plan
  const mrpTreeList = activeMrpPlans.map(plan => {
    let planTotalShortages = 0;
    let planTotalInTransit = 0;

    // Keys explicitly in this plan's RM & BO requirements
    const planRmKeys = new Set((plan.rmRequirements || []).flatMap(r => [cleanStr(r.materialName), cleanStr(r.materialCode)]).filter(Boolean));
    const planBoKeys = new Set((plan.boRequirements || []).flatMap(b => [cleanStr(b.materialName), cleanStr(b.materialCode)]).filter(Boolean));

    // PO numbers valid specifically for this plan
    const validPlanPoNumbers = new Set(
      openPOs
        .filter(po => (po.mrpPlanId && String(po.mrpPlanId) === String(plan._id)) || (po.mrpNumber && po.mrpNumber === plan.mrpNumber))
        .map(po => po.poNumber)
    );

    let planNeedsSanitization = false;
    const planStatusMap = new Map();
    const planPoMap = new Map();
    const planRfqMap = new Map();

    const registerReqTracking = (reqList) => {
      (reqList || []).forEach(r => {
        const k1 = cleanStr(r.materialName);
        const k2 = cleanStr(r.materialCode);

        // Sanitize legacy cross-plan PO contamination
        let effectivePo = r.poNumber || "";
        let effectiveStatus = r.status || "Pending";
        if (effectivePo && !validPlanPoNumbers.has(effectivePo)) {
          effectivePo = "";
          r.poNumber = "";
          if (effectiveStatus === "PO Raised" || effectiveStatus === "PO Sent") {
            effectiveStatus = "Pending";
            r.status = "Pending";
          }
          planNeedsSanitization = true;
        }

        if (effectiveStatus) {
          planStatusMap.set(k1, effectiveStatus);
          if (k2) planStatusMap.set(k2, effectiveStatus);
        }
        if (effectivePo) {
          planPoMap.set(k1, effectivePo);
          if (k2) planPoMap.set(k2, effectivePo);
        }
        if (r.rfqNumber) {
          planRfqMap.set(k1, r.rfqNumber);
          if (k2) planRfqMap.set(k2, r.rfqNumber);
        }
      });
    };

    registerReqTracking(plan.rmRequirements);
    registerReqTracking(plan.boRequirements);
    registerReqTracking(plan.subAssemblyRequirements);
    registerReqTracking(plan.consumableRequirements);

    const fgItemsTree = (plan.fgItems || []).map(fg => {
      const fgQty = Number(fg.quantity) || 1;
      const fgReceived = Number(fg.receivedQuantity) || 0;

      // Look up FG item document to know its actual FG type (Sub Assembly, Component, Assembly)
      const fgDoc = fgStock.find(f => 
        (fg.fgItem && f._id.toString() === fg.fgItem.toString()) ||
        (f.name && f.name.toLowerCase() === (fg.fgItemName || '').toLowerCase()) ||
        (f.code && f.code.toLowerCase() === (fg.fgItemCode || '').toLowerCase())
      );
      const fgType = fgDoc?.type || fg.type || "Assembly";
      const rawFGType = fgType === "Sub Assembly" ? "SubAssembly" : fgType;
      const rawFGCat = fgType === "Sub Assembly" ? "Sub Assembly" : (fgType === "Component" ? "In-House Component" : "Finished Good / Assembly");

      // Sanitize root FG poNumber
      const rawFGPo = fg.poNumber || "";
      const validFGPo = validPlanPoNumbers.has(rawFGPo) ? rawFGPo : "";
      let validFGStatus = fg.status || "Pending";
      if (rawFGPo && !validFGPo) {
        fg.poNumber = "";
        if (validFGStatus === "PO Raised" || validFGStatus === "PO Sent") {
          validFGStatus = "Pending";
          fg.status = "Pending";
        }
        planNeedsSanitization = true;
      }

      // Register root FG into appropriate map
      const fgClassification = processMaterialInfo(
        fg.fgItemName,
        fg.fgItemCode,
        fgQty,
        fg.unit,
        rawFGType,
        rawFGCat,
        plan.mrpNumber,
        1,
        planRmKeys,
        planBoKeys,
        validFGStatus,
        fg.description || fgDoc?.description || fgDoc?.descriptions || "",
        validFGPo,
        fg.rfqNumber || "",
        plan._id
      );

      let fgTargetMap = assemblyMap;
      if (fgClassification.itemType === "SubAssembly") fgTargetMap = subAssemblyMap;
      else if (fgClassification.itemType === "Component") fgTargetMap = componentMap;

      const fgK = fgClassification.materialKey;
      if (!fgTargetMap.has(fgK)) {
        fgTargetMap.set(fgK, { ...fgClassification, grossRequired: 0, mrpSources: [], poNumbers: new Set(), rfqNumbers: new Set() });
      }
      const fgEntry = fgTargetMap.get(fgK);
      fgEntry.grossRequired += fgQty;
      if (fgClassification.poNumber) fgEntry.poNumbers.add(fgClassification.poNumber);
      if (fgClassification.rfqNumber) fgEntry.rfqNumbers.add(fgClassification.rfqNumber);
      if (fgEntry.hasSecondaryUnit) {
        fgEntry.secondaryGrossRequired = Math.round(fgEntry.grossRequired * fgEntry.conversionFactor * 1000) / 1000;
        fgEntry.secondaryNetShortage = Math.round(fgEntry.netShortage * fgEntry.conversionFactor * 1000) / 1000;
      }
      fgEntry.mrpSources.push({
        mrpId: plan._id,
        mrpNumber: plan.mrpNumber,
        customerPoNumber: fg.customerPoNumber || plan.customerPoNumber || "",
        customerName: fg.customerName || plan.customerName || "",
        targetDate: fg.targetDate || plan.targetDate,
        planDate: plan.poDate || plan.date || plan.createdAt,
        createdAt: plan.createdAt,
        requiredQty: fgQty
      });

      // Group nested materials by level and parent
      const nestedList = (fg.nestedMaterials || []).map(nMat => {
        const nQty = Number(nMat.totalRequired) || (Number(nMat.quantityPerFG) * fgQty) || 1;

        // Sanitize: Only accept poNumber if it actually belongs to this plan!
        const rawNMatPo = nMat.poNumber || "";
        const validNMatPo = validPlanPoNumbers.has(rawNMatPo) ? rawNMatPo : "";
        let rawNMatStatus = nMat.status || "Pending";
        if (rawNMatPo && !validNMatPo) {
          nMat.poNumber = "";
          if (rawNMatStatus === "PO Raised" || rawNMatStatus === "PO Sent") {
            rawNMatStatus = "Pending";
            nMat.status = "Pending";
          }
          planNeedsSanitization = true;
        }

        const matPoNumber = validNMatPo || planPoMap.get(cleanStr(nMat.materialName)) || planPoMap.get(cleanStr(nMat.materialCode)) || "";
        const matStatus = (matPoNumber ? "PO Raised" : null) || rawNMatStatus || planStatusMap.get(cleanStr(nMat.materialName)) || planStatusMap.get(cleanStr(nMat.materialCode)) || "Pending";
        const matRfqNumber = nMat.rfqNumber || planRfqMap.get(cleanStr(nMat.materialName)) || planRfqMap.get(cleanStr(nMat.materialCode)) || "";

        // Check if this nested material is an FGItem
        const matchedFG = fgStock.find(f =>
          (f.name && f.name.toLowerCase() === (nMat.materialName || '').toLowerCase()) ||
          (f.code && f.code.toLowerCase() === (nMat.materialCode || '').toLowerCase())
        );
        const resolvedNMatType = matchedFG 
          ? (matchedFG.type === 'Sub Assembly' ? 'SubAssembly' : (matchedFG.type === 'Component' ? 'Component' : 'Assembly'))
          : nMat.itemType;
        const resolvedNMatCat = matchedFG
          ? (matchedFG.type === 'Sub Assembly' ? 'Sub Assembly' : (matchedFG.type === 'Component' ? 'In-House Component' : 'Finished Good / Assembly'))
          : nMat.category;

        const processed = processMaterialInfo(
          nMat.materialName,
          nMat.materialCode,
          nQty,
          nMat.unit,
          resolvedNMatType,
          resolvedNMatCat,
          plan.mrpNumber,
          nMat.level || 2,
          planRmKeys,
          planBoKeys,
          matStatus,
          nMat.description,
          matPoNumber,
          matRfqNumber,
          plan._id
        );

        if (processed.netShortage > 0) planTotalShortages += processed.netShortage;
        if (processed.totalInTransitPO > 0) planTotalInTransit += processed.totalInTransitPO;

        // Classify strictly into respective consolidated buckets
        let targetMap = rmMap;
        if (processed.itemType === "SubAssembly") targetMap = subAssemblyMap;
        else if (processed.itemType === "Component") targetMap = componentMap;
        else if (processed.itemType === "BO") targetMap = boMap;
        else if (processed.itemType === "Assembly") targetMap = assemblyMap;

        const k = processed.materialKey;
        if (!targetMap.has(k)) {
          targetMap.set(k, {
            ...processed,
            grossRequired: 0,
            mrpSources: [],
            poNumbers: new Set(),
            rfqNumbers: new Set()
          });
        }
        const entry = targetMap.get(k);
        entry.grossRequired += nQty;
        entry.netShortage = Math.max(0, entry.grossRequired - entry.currentPhysicalStock - entry.totalInTransitPO);
        entry.estimatedValue = entry.netShortage * (entry.bestVendor?.rate || entry.estimatedRate || 0);
        if (processed.status && processed.status !== "Pending") {
          entry.status = processed.status;
        }
        if (processed.poNumber) {
          if (!entry.poNumbers) entry.poNumbers = new Set();
          entry.poNumbers.add(processed.poNumber);
        }
        if (processed.rfqNumber) {
          if (!entry.rfqNumbers) entry.rfqNumbers = new Set();
          entry.rfqNumbers.add(processed.rfqNumber);
        }
        if (entry.hasSecondaryUnit) {
          entry.secondaryGrossRequired = Math.round(entry.grossRequired * entry.conversionFactor * 1000) / 1000;
          entry.secondaryNetShortage = Math.round(entry.netShortage * entry.conversionFactor * 1000) / 1000;
        }
        entry.mrpSources.push({
          mrpId: plan._id,
          mrpNumber: plan.mrpNumber,
          customerPoNumber: fg.customerPoNumber || plan.customerPoNumber || "",
          customerName: fg.customerName || plan.customerName || "",
          targetDate: fg.targetDate || plan.targetDate,
          planDate: plan.poDate || plan.date || plan.createdAt,
          createdAt: plan.createdAt,
          requiredQty: nQty
        });

        const qtyPerFG = Number(nMat.quantityPerFG) || 1;
        const secondaryQuantityPerFG = processed.hasSecondaryUnit
          ? Math.round(qtyPerFG * processed.conversionFactor * 1000) / 1000
          : null;

        const withBucket = attachBucketInfo(processed, String(plan._id));

        return {
          ...nMat.toObject?.() || nMat,
          ...withBucket,
          quantityPerFG: qtyPerFG,
          secondaryQuantityPerFG
        };
      });

      return {
        fgItem: fg.fgItem,
        fgItemName: fg.fgItemName,
        fgItemCode: fg.fgItemCode,
        quantity: fgQty,
        receivedQuantity: fgReceived,
        balanceQuantity: Math.max(0, fgQty - fgReceived),
        unit: fg.unit || "PCS",
        targetDate: fg.targetDate,
        customerPo: fg.customerPo,
        customerPoNumber: fg.customerPoNumber,
        customerName: fg.customerName,
        bomNumber: fg.bomNumber,
        nestedMaterials: nestedList
      };
    });

    const isProcurementFulfilled = planTotalShortages === 0;

    const planPlanningStatus = 
      planTotalShortages === 0
        ? "Stock Covered"
        : (planTotalInTransit >= planTotalShortages
            ? "PO In-Transit"
            : (planTotalInTransit > 0 ? "Partially Planned" : "Not Planned"));

    const liveCommitted = Math.round(((poCommittedByPlan.get(String(plan._id)) || 0) + (poCommittedByPlan.get(plan.mrpNumber) || 0)) * 100) / 100;
    const targetExpense = Number(plan.targetExpense || 0);
    const estimatedExp = Number(plan.totalEstimatedExpense || 0);
    let planBudgetStatus = plan.budgetStatus || "Unset";
    if (targetExpense > 0) {
      const effectiveExpense = liveCommitted > 0 ? liveCommitted : estimatedExp;
      if (effectiveExpense > targetExpense) {
        planBudgetStatus = "Over Budget";
      } else if (effectiveExpense >= targetExpense * 0.85) {
        planBudgetStatus = "Near Limit";
      } else {
        planBudgetStatus = "Within Budget";
      }
    }

    return {
      _id: plan._id,
      mrpNumber: plan.mrpNumber,
      customerName: plan.customerName || "Internal Demand",
      customerPoNumber: plan.customerPoNumber,
      isConsolidated: plan.isConsolidated || Boolean(plan.customerPOs?.length > 1),
      customerPOs: plan.customerPOs || [],
      planDate: plan.poDate || plan.date || plan.createdAt,
      createdAt: plan.createdAt,
      targetDate: plan.targetDate,
      status: plan.status,
      isProcurementFulfilled,
      planTotalShortages,
      planTotalInTransit,
      planPlanningStatus,
      isMaterialPlanned: planTotalShortages === 0 || planTotalInTransit >= planTotalShortages,
      totalIncome: plan.totalIncome || 0,
      totalGrossMaterialCost: plan.totalGrossMaterialCost || 0,
      totalEstimatedExpense: plan.totalEstimatedExpense || 0,
      targetExpense: plan.targetExpense || 0,
      committedExpense: liveCommitted,
      projectedGrossProfit: plan.projectedGrossProfit || 0,
      projectedMarginPercentage: plan.projectedMarginPercentage || 0,
      budgetStatus: planBudgetStatus,
      fgItems: fgItemsTree
    };
  });

  // Helper to enrich each classified item with computed dates, customer lists, and Planning Status Remark
  const enrichClassifiedItem = (item) => {
    let earliestTargetDate = null;
    let latestPlanDate = null;
    const custSet = new Set();
    const poSet = new Set();

    (item.mrpSources || []).forEach(src => {
      if (src.targetDate) {
        const d = new Date(src.targetDate);
        if (!isNaN(d.getTime())) {
          if (!earliestTargetDate || d < earliestTargetDate) earliestTargetDate = d;
        }
      }
      if (src.planDate || src.createdAt) {
        const d = new Date(src.planDate || src.createdAt);
        if (!isNaN(d.getTime())) {
          if (!latestPlanDate || d > latestPlanDate) latestPlanDate = d;
        }
      }
      if (src.customerName) custSet.add(src.customerName);
      if (src.customerPoNumber) poSet.add(src.customerPoNumber);
    });

    const currentStatus = item.status || "Pending";
    let materialPlanningStatus = "Not Planned";
    if (["Completed", "Material Received", "Issued for Production"].includes(currentStatus)) {
      materialPlanningStatus = "Completed";
    } else if (currentStatus === "PO Sent" || currentStatus === "PO Raised") {
      materialPlanningStatus = "PO Sent";
    } else if (currentStatus === "Raised RFQ" || currentStatus === "RFQ Raised") {
      materialPlanningStatus = "Raised RFQ";
    } else if (item.netShortage === 0) {
      materialPlanningStatus = "Stock Covered";
    } else if (item.totalInTransitPO > 0 && item.totalInTransitPO >= item.netShortage) {
      materialPlanningStatus = "PO In-Transit";
    } else if (item.totalInTransitPO > 0) {
      materialPlanningStatus = "Partially In-Transit";
    } else {
      materialPlanningStatus = "Not Planned";
    }

    const isMaterialPlanned = materialPlanningStatus !== "Not Planned";
    const poNumList = Array.from(item.poNumbers || (item.poNumber ? [item.poNumber] : []));
    const rfqNumList = Array.from(item.rfqNumbers || (item.rfqNumber ? [item.rfqNumber] : []));

    return {
      ...item,
      earliestTargetDate,
      latestPlanDate,
      customerNames: Array.from(custSet),
      customerPoNumbers: Array.from(poSet),
      poNumbers: poNumList,
      rfqNumbers: rfqNumList,
      poNumber: item.poNumber || poNumList[0] || "",
      rfqNumber: item.rfqNumber || rfqNumList[0] || "",
      materialPlanningStatus,
      isMaterialPlanned
    };
  };

  // Format Classified Arrays
  const activePlanId = mrpId && mrpId !== "all" ? String(mrpId) : null;
  const activeMrpNumber = activeMrpPlans.length === 1 ? activeMrpPlans[0].mrpNumber : null;
  const rmList = Array.from(rmMap.values()).map(enrichClassifiedItem).map(it => attachBucketInfo(it, activePlanId));
  const boList = Array.from(boMap.values()).map(enrichClassifiedItem).map(it => attachBucketInfo(it, activePlanId));
  const componentList = Array.from(componentMap.values()).map(enrichClassifiedItem);
  const subAssemblyList = Array.from(subAssemblyMap.values()).map(enrichClassifiedItem);
  const assemblyList = Array.from(assemblyMap.values()).map(enrichClassifiedItem);

  // Build Consolidated Purchase Buckets for RM and BO
  const buildConsolidatedBuckets = (itemList, bucketType) => {
    const bucketMap = new Map();

    itemList.forEach(item => {
      if (!item.purchaseBucket) return;
      const b = item.purchaseBucket;
      const bucketId = b.targetPurchaseItemId ? b.targetPurchaseItemId.toString() : b.targetPurchaseItemName;

      if (!bucketMap.has(bucketId)) {
        const pName = cleanStr(b.targetPurchaseItemName);
        const pCode = cleanStr(b.targetPurchaseItemCode);

        const stockInfo = 
          (b.targetPurchaseItemId && stockMap.get(String(b.targetPurchaseItemId))) ||
          stockMap.get(pCode) || 
          stockMap.get(pName) || 
          stockMap.get(cleanKey(pCode)) || 
          stockMap.get(cleanKey(pName)) || { currentStock: 0, baseRate: 0, category: bucketType === "RM" ? "Raw Material" : "Bought Out" };

        const targetName = b.targetPurchaseItemName || stockInfo.name || "Commercial Purchase Item";
        const targetCode = b.targetPurchaseItemCode || stockInfo.code || "";
        const targetDesc = b.targetPurchaseItemDescription || stockInfo.description || "";
        const targetCategory = stockInfo.category || (bucketType === "RM" ? "Raw Material" : "Bought Out");

        const inTransitInfo = getInTransitForPlan([
          b.targetPurchaseItemId ? String(b.targetPurchaseItemId) : null,
          pCode,
          pName,
          cleanKey(pCode),
          cleanKey(pName)
        ], activePlanId, activeMrpNumber);

        const vendorQuotes = 
          (b.targetPurchaseItemId && priceListMap.get(String(b.targetPurchaseItemId))) ||
          priceListMap.get(pCode) || 
          priceListMap.get(pName) || 
          priceListMap.get(cleanKey(pCode)) || 
          priceListMap.get(cleanKey(pName)) || [];

        const sortedQuotes = [...vendorQuotes].sort((a, b) => {
          if (a.isPreferred && !b.isPreferred) return -1;
          if (!a.isPreferred && b.isPreferred) return 1;
          return a.rate - b.rate;
        });
        const bestVendor = sortedQuotes[0] || null;

        const currentPhysicalStock = Number(stockInfo.currentStock || 0);
        const totalInTransitPO = Number(inTransitInfo.totalInTransit || 0);

        bucketMap.set(bucketId, {
          bucketKey: `bucket_${bucketId}`,
          bucketId,
          targetPurchaseItemId: b.targetPurchaseItemId,
          materialId: b.targetPurchaseItemId,
          targetPurchaseItemName: targetName,
          materialName: targetName,
          targetPurchaseItemCode: targetCode,
          materialCode: targetCode,
          targetPurchaseItemDescription: targetDesc,
          description: targetDesc,
          itemType: bucketType,
          targetPurchaseItemCategory: targetCategory,
          category: targetCategory,
          unit: b.primaryUnit,
          hasSecondaryUnit: Boolean(b.hasSecondaryUnit),
          secondaryUnit: b.secondaryUnit || "",
          conversionFactor: Number(b.conversionFactor) || 1,
          currentPhysicalStock,
          totalInTransitPO,
          inTransitPOs: inTransitInfo.poList || [],
          grossRequired: 0,
          netShortage: 0,
          bestVendor,
          estimatedRate: bestVendor?.rate || stockInfo.baseRate || 0,
          estimatedValue: 0,
          mappedItems: [],
          sourceCutSizes: [],
          mrpSources: [],
          poNumbers: [],
          rfqNumbers: []
        });
      }

      const entry = bucketMap.get(bucketId);
      const convFactor = Number(b.conversionFactor) || 1;
      const convertedGross = Math.round(Number(item.grossRequired || 0) * convFactor * 1000) / 1000;
      entry.grossRequired += convertedGross;

      // Accumulate mrpSources onto the bucket
      if (!entry.mrpSources) entry.mrpSources = [];
      (item.mrpSources || []).forEach(src => {
        if (!entry.mrpSources.some(s => s.mrpNumber === src.mrpNumber)) {
          entry.mrpSources.push(src);
        }
      });

      const cutSizeData = {
        sourceItemId: item.materialId,
        sourceItemName: item.materialName,
        sourceItemCode: item.materialCode,
        sourceItemDescription: item.description,
        sourceItemCategory: item.category,
        materialId: item.materialId,
        materialKey: item.materialKey,
        materialName: item.materialName,
        materialCode: item.materialCode,
        description: item.description,
        grossRequired: item.grossRequired,
        netShortage: item.netShortage,
        conversionFactor: convFactor,
        convertedGrossRequired: convertedGross,
        currentPhysicalStock: item.currentPhysicalStock,
        currentStock: item.currentPhysicalStock,
        totalInTransitPO: item.totalInTransitPO || 0,
        unit: item.unit,
        hasSecondaryUnit: Boolean(item.hasSecondaryUnit),
        secondaryUnit: item.secondaryUnit || "",
        mrpSources: item.mrpSources || [],
        status: item.status || "Pending",
        poNumber: item.poNumber || (item.poNumbers && item.poNumbers[0]) || "",
        rfqNumber: item.rfqNumber || (item.rfqNumbers && item.rfqNumbers[0]) || "",
        materialPlanningStatus: item.materialPlanningStatus || "Not Planned",
        isPlanSpecific: Boolean(b.isPlanSpecific),
        mrpPlanId: b.mrpPlanId || null
      };
      entry.mappedItems.push(cutSizeData);
      entry.sourceCutSizes.push(cutSizeData);
    });

    return Array.from(bucketMap.values()).map(b => {
      b.grossRequired = Math.round(b.grossRequired * 1000) / 1000;
      b.netShortage = Math.max(0, Math.round((b.grossRequired - b.currentPhysicalStock - b.totalInTransitPO) * 1000) / 1000);
      if (b.hasSecondaryUnit && b.conversionFactor > 0) {
        b.secondaryGrossRequired = Math.round(b.grossRequired * b.conversionFactor * 1000) / 1000;
        b.secondaryNetShortage = Math.round(b.netShortage * b.conversionFactor * 1000) / 1000;
      }
      b.estimatedValue = Math.round(b.netShortage * (b.estimatedRate || 0) * 100) / 100;

      // Collect all PO numbers associated with this bucket (strictly from contained requirement shortages belonging to this plan)
      const bucketPoSet = new Set();
      (b.sourceCutSizes || []).forEach(cs => {
        if (cs.poNumber) {
          if (!activePlanId || openPOs.some(po => po.poNumber === cs.poNumber && ((po.mrpPlanId && String(po.mrpPlanId) === activePlanId) || (po.mrpNumber && po.mrpNumber === activeMrpNumber)))) {
            bucketPoSet.add(cs.poNumber);
          }
        }
      });
      b.poNumbers = Array.from(bucketPoSet);

      const bucketRfqSet = new Set();
      (b.sourceCutSizes || []).forEach(cs => {
        if (cs.rfqNumber) bucketRfqSet.add(cs.rfqNumber);
      });
      b.rfqNumbers = Array.from(bucketRfqSet);

      // Compute aggregated bucket status from contained cut sizes
      const cutStatuses = (b.sourceCutSizes || []).map(cs => {
        if (activePlanId && cs.poNumber && !b.poNumbers.includes(cs.poNumber)) {
          return "Pending";
        }
        return cs.status || "Pending";
      });
      const allCompleted = cutStatuses.length > 0 && cutStatuses.every(s => s === "Completed" || s === "Material Received" || s === "Issued for Production");
      const allPOSent   = cutStatuses.length > 0 && cutStatuses.every(s => s === "PO Sent" || s === "PO Raised" || s === "Completed" || s === "Material Received" || s === "Issued for Production");
      const anyPOSent   = cutStatuses.some(s => s === "PO Sent" || s === "PO Raised") || b.poNumbers.length > 0;
      const anyRFQ      = cutStatuses.some(s => s === "Raised RFQ" || s === "RFQ Raised") || b.rfqNumbers.length > 0;
      const allRFQ      = cutStatuses.length > 0 && cutStatuses.every(s => s === "Raised RFQ" || s === "RFQ Raised" || s === "PO Sent" || s === "PO Raised" || s === "Completed" || s === "Material Received" || s === "Issued for Production");

      if (allCompleted) {
        b.status = "Completed";
      } else if (allPOSent || anyPOSent) {
        b.status = (allPOSent || b.poNumbers.length > 0) ? "PO Sent" : "PO Sent (Partial)";
      } else if (allRFQ || anyRFQ) {
        b.status = allRFQ ? "Raised RFQ" : "Raised RFQ (Partial)";
      } else {
        b.status = "Pending";
      }

      // Material planning status: prefer explicit status over stock calculation
      if (["Completed", "Material Received", "Issued for Production"].includes(b.status)) {
        b.materialPlanningStatus = "Completed";
      } else if (b.status === "PO Sent" || b.status === "PO Sent (Partial)" || b.status === "PO Raised") {
        b.materialPlanningStatus = "PO Sent";
      } else if (b.status === "Raised RFQ" || b.status === "Raised RFQ (Partial)") {
        b.materialPlanningStatus = "Raised RFQ";
      } else if (b.netShortage === 0) {
        b.materialPlanningStatus = "Stock Covered";
      } else if (b.totalInTransitPO >= b.grossRequired) {
        b.materialPlanningStatus = "PO In-Transit";
      } else if (b.totalInTransitPO > 0) {
        b.materialPlanningStatus = "Partially In-Transit";
      } else {
        b.materialPlanningStatus = "Not Planned";
      }

      return b;
    });
  };

  const rmBuckets = buildConsolidatedBuckets(rmList, "RM");
  const boBuckets = buildConsolidatedBuckets(boList, "BO");

  const allConsolidatedShortages = [...rmList, ...boList, ...componentList, ...subAssemblyList]
    .filter(i => i.netShortage > 0);

  const totalEstimatedProcurementValue = allConsolidatedShortages
    .reduce((sum, item) => sum + item.estimatedValue, 0);

  return res.status(200).json(new ApiResponse(200, {
    activeMrpCount: activeMrpPlans.length,
    totalShortageItems: allConsolidatedShortages.length,
    totalEstimatedProcurementValue,
    mrpTreeList,
    classifiedLists: {
      rmList,
      boList,
      componentList,
      subAssemblyList,
      assemblyList
    },
    purchaseBuckets: {
      rmBuckets,
      boBuckets
    }
  }, "Fetched MRP Procurement Workbench with accurate Live Stock and Classifications"));
});

/**
 * 2. MOVE MRP TO PRODUCTION
 */
export const moveMRPToProduction = asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req);
  const { id } = req.params;

  const MRPPlan = req.getModel("MRPPlan", mrpPlanSchema);

  const plan = await MRPPlan.findOne({ _id: id, company: companyId });
  if (!plan) {
    throw new ApiError(404, "MRP Plan not found");
  }

  plan.status = "In Production";
  await plan.save();

  return res.status(200).json(new ApiResponse(200, plan, `MRP Plan #${plan.mrpNumber} moved to Production successfully`));
});

/**
 * 3. BULK AUTO-GENERATE POs FROM MRP SHORTAGES
 */
export const bulkGeneratePOFromMRP = asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req);
  const { items, defaultVendorId, remarks } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, "No material items selected for Purchase Order creation");
  }

  const PurchaseOrder = req.getModel("PurchaseOrder", purchaseOrderSchema);
  const Vendor = req.getModel("Vendor", vendorSchema);
  const MRPPlan = req.getModel("MRPPlan", mrpPlanSchema);

  // Group items by VendorId
  const vendorGroupMap = new Map();

  for (const itm of items) {
    const targetVendorId = itm.vendorId || defaultVendorId;
    if (!targetVendorId) {
      throw new ApiError(400, `Vendor not assigned for material: ${itm.materialName}. Please specify vendor.`);
    }

    if (!vendorGroupMap.has(targetVendorId)) {
      vendorGroupMap.set(targetVendorId, []);
    }
    vendorGroupMap.get(targetVendorId).push(itm);
  }

  const createdPOs = [];

  for (const [vendorId, vItems] of vendorGroupMap.entries()) {
    const vendorDoc = await Vendor.findOne({ _id: vendorId, company: companyId });
    const vendorName = vendorDoc?.name || "Vendor";

    const poNumber = `PO-MRP/${new Date().getFullYear()}/${Math.floor(10000 + Math.random() * 90000)}`;

    const poItems = vItems.map(vi => ({
      materialName: vi.materialName,
      materialCode: vi.materialCode || "",
      itemType: vi.itemType || "RM",
      quantity: Number(vi.orderQuantity || vi.netShortage || vi.requiredQuantity) || 1,
      unit: vi.unit || "PCS",
      rate: Number(vi.rate) || 0,
      total: (Number(vi.orderQuantity || vi.netShortage || vi.requiredQuantity) || 1) * (Number(vi.rate) || 0),
      description: `MRP Consolidated: ${vi.sourceMRPs?.join(", ") || "MRP Shortage"}`
    }));

    const subTotal = poItems.reduce((s, i) => s + i.total, 0);
    const taxRate = vendorDoc?.gstRate || 18;
    const taxAmount = (subTotal * taxRate) / 100;
    const grandTotal = subTotal + taxAmount;

    const firstMrpSource = vItems[0]?.mrpSources?.[0];
    const firstMrpNumber = vItems[0]?.sourceMRPs?.[0] || firstMrpSource?.mrpNumber;
    const firstMrpPlanId = firstMrpSource?.mrpPlanId;

    const newPO = await PurchaseOrder.create({
      company: companyId,
      poNumber,
      mrpNumber: firstMrpNumber || undefined,
      mrpPlanId: firstMrpPlanId || undefined,
      vendor: vendorId,
      vendorName,
      vendorAddress: vendorDoc?.billingAddress || vendorDoc?.address || "",
      vendorGst: vendorDoc?.gstin || "",
      items: poItems,
      subTotal,
      taxAmount,
      grandTotal,
      status: "Draft",
      notes: remarks || `Auto-generated from MRP Procurement Workbench for: ${vItems.map(v => v.materialName).join(", ")}`,
      createdBy: req.user?._id
    });

    createdPOs.push(newPO);

    // Update MRP Plan Item statuses across affected plans
    const poMaterialNames = new Set();
    const poMaterialCodes = new Set();
    const poMaterialIds = new Set();

    vItems.forEach(vi => {
      if (vi.materialName) poMaterialNames.add(cleanStr(vi.materialName));
      if (vi.materialCode) poMaterialCodes.add(cleanStr(vi.materialCode));
      if (vi.materialId) poMaterialIds.add(String(vi.materialId));

      // Also unpack sourceCutSizes from bucket
      if (Array.isArray(vi.sourceCutSizes)) {
        vi.sourceCutSizes.forEach(cs => {
          if (cs.sourceItemName) poMaterialNames.add(cleanStr(cs.sourceItemName));
          if (cs.sourceItemCode) poMaterialCodes.add(cleanStr(cs.sourceItemCode));
          if (cs.materialName) poMaterialNames.add(cleanStr(cs.materialName));
          if (cs.materialCode) poMaterialCodes.add(cleanStr(cs.materialCode));
          if (cs.sourceItemId) poMaterialIds.add(String(cs.sourceItemId));
          if (cs.materialId) poMaterialIds.add(String(cs.materialId));
        });
      }
    });

    // Collect ONLY the target plan IDs that these items actually belong to
    const targetPlanIds = new Set();
    const { mrpPlanId, mrpNumber: bodyMrpNo } = req.body;
    if (mrpPlanId) targetPlanIds.add(String(mrpPlanId));

    vItems.forEach(vi => {
      (vi.mrpSources || []).forEach(s => {
        if (s.mrpId) targetPlanIds.add(String(s.mrpId));
        if (s.mrpPlanId) targetPlanIds.add(String(s.mrpPlanId));
      });
      if (Array.isArray(vi.sourceCutSizes)) {
        vi.sourceCutSizes.forEach(cs => {
          (cs.mrpSources || []).forEach(s => {
            if (s.mrpId) targetPlanIds.add(String(s.mrpId));
            if (s.mrpPlanId) targetPlanIds.add(String(s.mrpPlanId));
          });
        });
      }
    });

    const targetPlanIdArray = Array.from(targetPlanIds).filter(Boolean);
    if (targetPlanIdArray.length > 0) {
      const candidatePlans = await MRPPlan.find({ _id: { $in: targetPlanIdArray }, company: companyId });
      for (const plan of candidatePlans) {
        let planChanged = false;
        const matchItem = (item) => {
          const mId = item.material?._id || item.material;
          return (
            (mId && poMaterialIds.has(String(mId))) ||
            (item.materialCode && poMaterialCodes.has(cleanStr(item.materialCode))) ||
            (item.materialName && poMaterialNames.has(cleanStr(item.materialName)))
          );
        };

        (plan.rmRequirements || []).forEach(r => {
          if (matchItem(r)) {
            r.status = "PO Raised";
            r.poNumber = poNumber;
            planChanged = true;
          }
        });
        (plan.boRequirements || []).forEach(b => {
          if (matchItem(b)) {
            b.status = "PO Raised";
            b.poNumber = poNumber;
            planChanged = true;
          }
        });
        (plan.fgItems || []).forEach(fg => {
          (fg.nestedMaterials || []).forEach(nm => {
            if (matchItem(nm)) {
              nm.status = "PO Raised";
              nm.poNumber = poNumber;
              planChanged = true;
            }
          });
        });

        if (planChanged) {
          if (plan.status === "Planned" || plan.status === "Draft") {
            plan.status = "In Procurement";
          }
          await plan.save();
        }
      }
    }
  }

  return res.status(201).json(new ApiResponse(201, {
    createdCount: createdPOs.length,
    purchaseOrders: createdPOs
  }, `Successfully generated ${createdPOs.length} Purchase Order(s) from MRP Shortages`));
});

/**
 * 4. SEND MRP ITEMS TO PPC INTAKE BUCKET
 * Dispatches selected Components, Sub-Assemblies, and Assemblies into PPC Order Intake for in-house manufacturing.
 */
export const sendMRPItemsToPPC = asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req);
  const { mrpPlanId, mrpNumber, customerName, customerPoNumber, items } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, "No items selected to send to PPC");
  }

  const PPCOrder = req.getModel("PPCOrder", ppcOrderSchema);
  const countPpc = await PPCOrder.countDocuments({ company: companyId });

  const orderNumber = `PPC-MRP-${mrpNumber || 'REQ'}-${countPpc + 1}`;

  const ppcItems = items.map(item => ({
    productName: item.materialName || item.productName,
    productCode: item.materialCode || item.productCode || "",
    itemType: item.itemType || "Component",
    description: `MRP BOM Requirement (${item.itemType || 'Component'}) for MRP #${mrpNumber || ''}`,
    quantity: Number(item.quantity || item.netShortage || item.requiredQuantity) || 1,
    unit: item.unit || "PCS",
    targetDate: item.targetDate ? new Date(item.targetDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  }));

  const newPPCOrder = await PPCOrder.create({
    company: companyId,
    orderNumber,
    poReference: customerPoNumber || mrpNumber || `MRP-${mrpPlanId || 'GEN'}`,
    customerName: customerName || "Internal Production Demand",
    mrpNumber: mrpNumber || '',
    mrpPlanId: mrpPlanId || undefined,
    sourceType: "MRP_DEMAND",
    deliveryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    status: "Pending",
    items: ppcItems,
    remarks: `Created from MRP #${mrpNumber || ''} Procurement Workbench for in-house manufacturing of ${ppcItems.length} components/assemblies.`
  });

  return res.status(201).json(new ApiResponse(201, newPPCOrder, `Successfully sent ${ppcItems.length} item(s) to PPC Intake Bucket (#${orderNumber})`));
});

/**
 * 6. GET MRP PPC INTAKE BUCKET
 * Returns all PPC orders generated from MRP Demand Plans, grouped by MRP Number.
 */
export const getMRPPPCIntakeBucket = asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req);
  const PPCOrder = req.getModel("PPCOrder", ppcOrderSchema);

  // Find all PPC orders originated from MRP demands
  const orders = await PPCOrder.find({
    company: companyId,
    $or: [
      { sourceType: "MRP_DEMAND" },
      { orderNumber: { $regex: /^PPC-MRP/i } },
      { remarks: { $regex: /Procurement Workbench/i } }
    ]
  }).sort({ createdAt: -1 }).lean();

  // Group by mrpNumber or poReference
  const mrpMap = new Map();

  orders.forEach(order => {
    const key = order.mrpNumber || order.poReference || order.orderNumber;
    if (!mrpMap.has(key)) {
      mrpMap.set(key, {
        mrpNumber: key,
        customerName: order.customerName || "Internal Demand",
        poReference: order.poReference || key,
        deliveryDate: order.deliveryDate,
        createdAt: order.createdAt,
        totalItemsCount: 0,
        totalMovedCount: 0,
        orders: [],
        items: []
      });
    }
    const bucket = mrpMap.get(key);
    bucket.orders.push(order);
    (order.items || []).forEach(it => {
      const qty = Number(it.quantity) || 1;
      const moved = Number(it.movedQuantity) || 0;
      bucket.totalItemsCount += qty;
      bucket.totalMovedCount += moved;

      const itemMoStatus = it.linkedMoNumber 
        ? (moved >= qty ? "MO Created" : "Partially Created") 
        : "Pending MO Creation";

      bucket.items.push({
        ...it,
        quantity: qty,
        movedQuantity: moved,
        remainingQuantity: Math.max(0, qty - moved),
        linkedMoNumber: it.linkedMoNumber || null,
        linkedMoId: it.linkedMoId || null,
        moStatus: itemMoStatus,
        orderId: order._id,
        orderNumber: order.orderNumber,
        orderStatus: order.status,
        mrpNumber: key
      });
    });
  });

  // Calculate bucket-level status
  const mrpBuckets = Array.from(mrpMap.values()).map(bucket => {
    const items = bucket.items || [];
    const allMoved = items.length > 0 && items.every(i => (i.movedQuantity || 0) >= i.quantity);
    const someMoved = items.some(i => (i.movedQuantity || 0) > 0);

    let bucketStatus = "Pending MO Creation";
    if (allMoved) {
      bucketStatus = "All MOs Created";
    } else if (someMoved) {
      bucketStatus = "Partially Created";
    }

    return {
      ...bucket,
      bucketStatus,
      completedItemsCount: items.filter(i => (i.movedQuantity || 0) >= i.quantity).length
    };
  });

  return res.status(200).json(new ApiResponse(200, { mrpBuckets, totalOrders: orders.length }, "MRP PPC Intake Bucket retrieved successfully"));
});

/**
 * 5. UPDATE MANUAL STATUS FOR BOM ITEMS IN MRP PLAN
 * Updates the lifecycle status (e.g. "Pending", "Raised RFQ", "PO Sent", "Material Received", "Issued for Production", "Completed")
 * for specific BOM items within an MRP Demand Plan.
 */
export const updateMRPItemStatus = asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req);
  const { id } = req.params;
  const { items, status, poNumber, rfqNumber } = req.body;

  const MRPPlan = req.getModel("MRPPlan", mrpPlanSchema);
  const plan = await MRPPlan.findOne({ _id: id, company: companyId });
  if (!plan) {
    throw new ApiError(404, "MRP Plan not found");
  }

  // Build updates map, poMap, rfqMap
  const updatesMap = new Map();
  const poMap = new Map();
  const rfqMap = new Map();

  if (Array.isArray(items) && items.length > 0) {
    items.forEach(itm => {
      const targetStatus = itm.status || status;
      const targetPo = itm.poNumber || poNumber;
      const targetRfq = itm.rfqNumber || rfqNumber;

      const registerItem = (name, code, key, s, p, r) => {
        if (s) {
          if (name) updatesMap.set(cleanStr(name), s);
          if (code) updatesMap.set(cleanStr(code), s);
          if (key && !String(key).startsWith("bucket_")) updatesMap.set(cleanStr(key), s);
        }
        if (p) {
          if (name) poMap.set(cleanStr(name), p);
          if (code) poMap.set(cleanStr(code), p);
        }
        if (r) {
          if (name) rfqMap.set(cleanStr(name), r);
          if (code) rfqMap.set(cleanStr(code), r);
        }
      };

      registerItem(itm.materialName, itm.materialCode, itm.materialKey, targetStatus, targetPo, targetRfq);

      if (Array.isArray(itm.sourceCutSizes)) {
        itm.sourceCutSizes.forEach(cs => {
          registerItem(cs.sourceItemName || cs.materialName, cs.sourceItemCode || cs.materialCode, cs.materialKey, targetStatus, targetPo, targetRfq);
        });
      }
    });
  } else if (status) {
    updatesMap.set("__ALL__", status);
    if (poNumber) poMap.set("__ALL__", poNumber);
    if (rfqNumber) rfqMap.set("__ALL__", rfqNumber);
  }

  const applyUpdates = (item) => {
    const n = cleanStr(item.materialName);
    const c = cleanStr(item.materialCode);
    const newStatus = updatesMap.get(c) || updatesMap.get(n) || updatesMap.get("__ALL__");
    if (newStatus) item.status = newStatus;

    const newPo = poMap.get(c) || poMap.get(n) || poMap.get("__ALL__");
    if (newPo) item.poNumber = newPo;

    const newRfq = rfqMap.get(c) || rfqMap.get(n) || rfqMap.get("__ALL__");
    if (newRfq) item.rfqNumber = newRfq;
  };

  (plan.rmRequirements || []).forEach(applyUpdates);
  (plan.boRequirements || []).forEach(applyUpdates);
  (plan.subAssemblyRequirements || []).forEach(applyUpdates);
  (plan.consumableRequirements || []).forEach(applyUpdates);

  (plan.fgItems || []).forEach(fg => {
    applyUpdates(fg);
    (fg.nestedMaterials || []).forEach(applyUpdates);
  });

  if (plan.status === "Planned" || plan.status === "Draft") {
    if (status === "PO Raised" || poNumber) {
      plan.status = "In Procurement";
    }
  }

  await plan.save();

  return res.status(200).json(new ApiResponse(200, plan, "Successfully updated BOM Item Status"));
});

/**
 * 12. GET PURCHASE BUCKET MAPPINGS
 */
export const getPurchaseBucketMappings = asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req);
  const { mrpPlanId } = req.query;
  const PurchaseItemMapping = req.getModel("PurchaseItemMapping", purchaseItemMappingSchema);
  const query = { company: companyId };
  if (mrpPlanId) {
    query.mrpPlanId = (mrpPlanId === "global" || mrpPlanId === "null") ? null : mrpPlanId;
  }
  const mappings = await PurchaseItemMapping.find(query).sort({ updatedAt: -1 }).lean();
  return res.status(200).json(new ApiResponse(200, mappings, "Fetched Purchase Bucket Mappings"));
});

/**
 * 13. GET ELIGIBLE PURCHASE ITEMS (WITH STRICT MATCHING UNITS)
 */
export const getEligiblePurchaseItems = asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req);
  const { primaryUnit, hasSecondaryUnit, secondaryUnit, itemType, search } = req.query;

  const isBO = (itemType || "").toLowerCase().includes("bo") || (itemType || "").toLowerCase().includes("bought");
  const Model = isBO
    ? req.getModel("BoughtOut", boughtOutSchema)
    : req.getModel("RawMaterial", rawMaterialSchema);

  const query = {
    company: companyId,
    status: { $ne: "Deactivated" }
  };

  const validUnits = [];
  if (primaryUnit && primaryUnit.trim() && primaryUnit.trim() !== "null" && primaryUnit.trim() !== "undefined") {
    validUnits.push(primaryUnit.trim());
  }
  if (secondaryUnit && secondaryUnit.trim() && secondaryUnit.trim() !== "null" && secondaryUnit.trim() !== "undefined") {
    validUnits.push(secondaryUnit.trim());
  }

  const conditions = [];

  // Match if ANY one unit matches: target's unit in validUnits OR target's secondaryUnit in validUnits
  if (validUnits.length > 0) {
    const unitRegexes = validUnits.map(u => new RegExp("^" + u.trim() + "$", "i"));
    conditions.push({
      $or: [
        { unit: { $in: unitRegexes } },
        { secondaryUnit: { $in: unitRegexes } }
      ]
    });
  }

  if (search && search.trim()) {
    const s = search.trim();
    conditions.push({
      $or: [
        { name: { $regex: s, $options: "i" } },
        { code: { $regex: s, $options: "i" } },
        { descriptions: { $regex: s, $options: "i" } },
        { description: { $regex: s, $options: "i" } },
        { specification: { $regex: s, $options: "i" } }
      ]
    });
  }

  if (conditions.length > 0) {
    query.$and = conditions;
  }

  const items = await Model.find(query).limit(100).lean();

  // Fetch Inventory for current stock of these items
  const Inventory = req.getModel("Inventory", inventorySchema);
  const itemIds = items.map(i => i._id);
  const stocks = await Inventory.find({ company: companyId, item: { $in: itemIds } }).lean();
  const stockMap = new Map();
  stocks.forEach(st => {
    if (st.item) {
      stockMap.set(st.item.toString(), (stockMap.get(st.item.toString()) || 0) + (Number(st.quantity) || 0));
    }
  });

  const formatted = items.map(it => ({
    _id: it._id,
    name: it.name,
    code: it.code || "",
    description: it.descriptions || it.description || "",
    unit: it.unit || "PCS",
    hasSecondaryUnit: Boolean(it.hasSecondaryUnit),
    secondaryUnit: it.secondaryUnit || "",
    conversionFactor: Number(it.conversionFactor) || 1,
    currentStock: stockMap.get(it._id.toString()) || 0,
    itemType: isBO ? "BO" : "RM"
  }));

  return res.status(200).json(new ApiResponse(200, formatted, "Fetched eligible purchase items with matching units"));
});

/**
 * 14. MAP ITEM TO PURCHASE BUCKET (WITH STRICT UNIT VALIDATION)
 */
export const mapItemToPurchaseBucket = asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req);
  const {
    sourceItemId,
    sourceItemType,
    sourceItemName,
    sourceItemCode,
    sourceItemDescription,
    targetPurchaseItemId,
    targetPurchaseItemType,
    targetPurchaseItemName,
    targetPurchaseItemCode,
    targetPurchaseItemDescription,
    primaryUnit,
    hasSecondaryUnit,
    secondaryUnit,
    conversionFactor,
    isDefault = true,
    mrpPlanId = null
  } = req.body;

  if (!sourceItemId || !targetPurchaseItemId) {
    throw new ApiError(400, "Both Source BOM Item and Target Purchase Item are required.");
  }

  if (sourceItemId.toString() === targetPurchaseItemId.toString()) {
    throw new ApiError(400, "Source item cannot be mapped to itself as a purchase bucket.");
  }

  // 1. Strict Unit Equality Validation
  const isSourceBO = (sourceItemType || "").toLowerCase().includes("bo");
  const SourceModel = isSourceBO ? req.getModel("BoughtOut", boughtOutSchema) : req.getModel("RawMaterial", rawMaterialSchema);
  const sourceDoc = await SourceModel.findOne({ _id: sourceItemId, company: companyId }).lean();

  const isTargetBO = (targetPurchaseItemType || "").toLowerCase().includes("bo");
  const TargetModel = isTargetBO ? req.getModel("BoughtOut", boughtOutSchema) : req.getModel("RawMaterial", rawMaterialSchema);
  const targetDoc = await TargetModel.findOne({ _id: targetPurchaseItemId, company: companyId }).lean();

  if (!targetDoc) {
    throw new ApiError(404, "Target Purchase Item not found in master records.");
  }

  const tHasSec = Boolean(targetDoc.hasSecondaryUnit && targetDoc.secondaryUnit);

  // 1. Unit Validation: Match if ANY one unit matches between Source and Target
  const sourceUnits = [
    sourceDoc?.unit || primaryUnit,
    sourceDoc?.hasSecondaryUnit ? sourceDoc?.secondaryUnit : (hasSecondaryUnit ? secondaryUnit : null)
  ].filter(Boolean).map(u => String(u).trim().toLowerCase());

  const targetUnits = [
    targetDoc.unit,
    targetDoc.hasSecondaryUnit ? targetDoc.secondaryUnit : null
  ].filter(Boolean).map(u => String(u).trim().toLowerCase());

  const hasAnyMatchingUnit = sourceUnits.some(su => targetUnits.includes(su));
  if (!hasAnyMatchingUnit) {
    throw new ApiError(
      400,
      `No matching unit between Source ('${sourceUnits.join(", ")}') and Target Purchase Item ('${targetUnits.join(", ")}'). At least one unit must match to allow purchase bucket conversion.`
    );
  }

  const PurchaseItemMapping = req.getModel("PurchaseItemMapping", purchaseItemMappingSchema);
  const userId = req.user?._id;
  const userName = req.user?.name || "System";

  const customConversionFactor = req.body.conversionFactor != null && !isNaN(Number(req.body.conversionFactor)) && Number(req.body.conversionFactor) > 0
    ? Number(req.body.conversionFactor)
    : (tHasSec ? (Number(targetDoc.conversionFactor) || 1) : 1);

  const updatedMapping = await PurchaseItemMapping.findOneAndUpdate(
    {
      company: companyId,
      sourceItemId: sourceItemId,
      mrpPlanId: mrpPlanId || null
    },
    {
      company: companyId,
      sourceItemId,
      sourceItemType: isSourceBO ? "BO" : "RM",
      sourceItemName: sourceItemName || sourceDoc?.name || "Material",
      sourceItemCode: sourceItemCode || sourceDoc?.code || "",
      sourceItemDescription: sourceItemDescription || sourceDoc?.descriptions || sourceDoc?.description || "",
      targetPurchaseItemId,
      targetPurchaseItemType: isTargetBO ? "BO" : "RM",
      targetPurchaseItemName: targetPurchaseItemName || targetDoc.name,
      targetPurchaseItemCode: targetPurchaseItemCode || targetDoc.code || "",
      targetPurchaseItemDescription: targetPurchaseItemDescription || targetDoc.descriptions || targetDoc.description || "",
      primaryUnit: targetDoc.unit,
      hasSecondaryUnit: tHasSec,
      secondaryUnit: tHasSec ? targetDoc.secondaryUnit : "",
      conversionFactor: customConversionFactor,
      isDefault: Boolean(isDefault),
      isDetached: false,
      mrpPlanId: mrpPlanId || null,
      createdBy: userId,
      createdByName: userName
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return res.status(200).json(new ApiResponse(200, updatedMapping, `Successfully mapped '${sourceItemName || "Item"}' to Purchase Bucket '${targetPurchaseItemName || targetDoc.name}'`));
});

/**
 * 15. DETACH ITEM FROM PURCHASE BUCKET (FOR A SPECIFIC MRP PLAN)
 * Planners can unbind a cut-size item specifically for this MRP so it is procured directly as its native item
 */
export const detachItemFromPurchaseBucket = asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req);
  const {
    sourceItemId,
    mrpPlanId,
    sourceItemName,
    sourceItemCode,
    sourceItemDescription,
    sourceItemType
  } = req.body;

  if (!sourceItemId) {
    throw new ApiError(400, "Source item ID is required to detach item from purchase bucket.");
  }

  if (!mrpPlanId) {
    throw new ApiError(400, "MRP Plan ID is required to detach item for a specific MRP plan.");
  }

  const PurchaseItemMapping = req.getModel("PurchaseItemMapping", purchaseItemMappingSchema);
  const userId = req.user?._id;
  const userName = req.user?.name || "System";

  const detachedRecord = await PurchaseItemMapping.findOneAndUpdate(
    {
      company: companyId,
      sourceItemId: sourceItemId,
      mrpPlanId: mrpPlanId
    },
    {
      company: companyId,
      sourceItemId,
      sourceItemType: sourceItemType || "RM",
      sourceItemName: sourceItemName || "Material",
      sourceItemCode: sourceItemCode || "",
      sourceItemDescription: sourceItemDescription || "",
      targetPurchaseItemId: null,
      targetPurchaseItemType: sourceItemType || "RM",
      targetPurchaseItemName: "",
      targetPurchaseItemCode: "",
      targetPurchaseItemDescription: "",
      isDetached: true,
      isDefault: false,
      mrpPlanId: mrpPlanId,
      createdBy: userId,
      createdByName: userName
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return res.status(200).json(
    new ApiResponse(
      200,
      detachedRecord,
      `Successfully detached '${sourceItemName || "Item"}' from purchase buckets for this MRP plan. It will now be procured directly as an individual item.`
    )
  );
});

/**
 * 16. UNMAP ITEM FROM PURCHASE BUCKET
 */
export const unmapItemFromPurchaseBucket = asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req);
  const { id } = req.params;
  const { mrpPlanId } = req.query;

  const PurchaseItemMapping = req.getModel("PurchaseItemMapping", purchaseItemMappingSchema);
  
  let deleted;
  if (mrpPlanId) {
    const targetPlanId = (mrpPlanId === "global" || mrpPlanId === "null") ? null : mrpPlanId;
    deleted = await PurchaseItemMapping.findOneAndDelete({
      company: companyId,
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(id) ? id : null },
        { sourceItemId: mongoose.Types.ObjectId.isValid(id) ? id : null }
      ].filter(Boolean),
      mrpPlanId: targetPlanId
    });
  } else {
    const query = {
      company: companyId,
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(id) ? id : null },
        { sourceItemId: mongoose.Types.ObjectId.isValid(id) ? id : null }
      ].filter(Boolean)
    };
    deleted = await PurchaseItemMapping.findOneAndDelete(query);
  }

  if (!deleted) {
    throw new ApiError(404, "Purchase bucket mapping not found.");
  }

  return res.status(200).json(new ApiResponse(200, deleted, "Successfully removed purchase bucket mapping."));
});

/**
 * 16. BULK MAP ITEMS TO PURCHASE BUCKET
 */
export const bulkMapItemsToPurchaseBucket = asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req);
  const {
    sourceItems = [],
    targetPurchaseItemId,
    targetPurchaseItemType,
    targetPurchaseItemName,
    targetPurchaseItemCode,
    targetPurchaseItemDescription,
    isDefault = true,
    mrpPlanId = null
  } = req.body;

  if (!Array.isArray(sourceItems) || sourceItems.length === 0) {
    throw new ApiError(400, "Please provide at least one source item to map.");
  }

  if (!targetPurchaseItemId) {
    throw new ApiError(400, "Target Purchase Item is required.");
  }

  const isTargetBO = (targetPurchaseItemType || "").toLowerCase().includes("bo");
  const TargetModel = isTargetBO ? req.getModel("BoughtOut", boughtOutSchema) : req.getModel("RawMaterial", rawMaterialSchema);
  const targetDoc = await TargetModel.findOne({ _id: targetPurchaseItemId, company: companyId }).lean();

  if (!targetDoc) {
    throw new ApiError(404, "Target Purchase Item not found in master records.");
  }

  const tPriUnit = (targetDoc.unit || "").trim().toLowerCase();
  const tHasSec = Boolean(targetDoc.hasSecondaryUnit && targetDoc.secondaryUnit);
  const tSecUnit = (targetDoc.secondaryUnit || "").trim().toLowerCase();

  const PurchaseItemMapping = req.getModel("PurchaseItemMapping", purchaseItemMappingSchema);
  const userId = req.user?._id;
  const userName = req.user?.name || "System";

  const mappedResults = [];
  const errors = [];

  for (const sItem of sourceItems) {
    const sId = sItem.sourceItemId || sItem.materialId || sItem._id;
    if (!sId) continue;

    if (sId.toString() === targetPurchaseItemId.toString()) {
      errors.push({ itemId: sId, name: sItem.sourceItemName || sItem.materialName, reason: "Cannot map item to itself" });
      continue;
    }

    const sUnits = [
      sItem.unit || sItem.primaryUnit,
      sItem.hasSecondaryUnit ? sItem.secondaryUnit : null
    ].filter(Boolean).map(u => String(u).trim().toLowerCase());

    const targetUnits = [
      targetDoc.unit,
      targetDoc.hasSecondaryUnit ? targetDoc.secondaryUnit : null
    ].filter(Boolean).map(u => String(u).trim().toLowerCase());

    const hasAnyMatchingUnit = sUnits.some(su => targetUnits.includes(su));
    if (!hasAnyMatchingUnit) {
      errors.push({
        itemId: sId,
        name: sItem.sourceItemName || sItem.materialName,
        reason: `No matching unit between Source ('${sUnits.join(", ")}') and Target ('${targetUnits.join(", ")}')`
      });
      continue;
    }

    const isSourceBO = (sItem.sourceItemType || sItem.itemType || "").toLowerCase().includes("bo");

    const updated = await PurchaseItemMapping.findOneAndUpdate(
      {
        company: companyId,
        sourceItemId: sId,
        mrpPlanId: mrpPlanId || null
      },
      {
        company: companyId,
        sourceItemId: sId,
        sourceItemType: isSourceBO ? "BO" : "RM",
        sourceItemName: sItem.sourceItemName || sItem.materialName || "Material",
        sourceItemCode: sItem.sourceItemCode || sItem.materialCode || "",
        sourceItemDescription: sItem.sourceItemDescription || sItem.description || "",
        targetPurchaseItemId,
        targetPurchaseItemType: isTargetBO ? "BO" : "RM",
        targetPurchaseItemName: targetPurchaseItemName || targetDoc.name,
        targetPurchaseItemCode: targetPurchaseItemCode || targetDoc.code || "",
        targetPurchaseItemDescription: targetPurchaseItemDescription || targetDoc.descriptions || targetDoc.description || "",
        primaryUnit: targetDoc.unit,
        hasSecondaryUnit: tHasSec,
        secondaryUnit: tHasSec ? targetDoc.secondaryUnit : "",
        conversionFactor: tHasSec ? (Number(targetDoc.conversionFactor) || 1) : 1,
        isDefault: Boolean(isDefault),
        mrpPlanId: mrpPlanId || null,
        createdBy: userId,
        createdByName: userName
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    mappedResults.push(updated);
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      { mappedCount: mappedResults.length, mappedResults, errors },
      `Successfully mapped ${mappedResults.length} item(s) to Purchase Bucket '${targetPurchaseItemName || targetDoc.name}'.${errors.length > 0 ? ` (${errors.length} skipped due to unit mismatches)` : ""}`
    )
  );
});



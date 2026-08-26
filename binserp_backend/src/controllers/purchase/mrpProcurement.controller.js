import mongoose from "mongoose";
import { mrpPlanSchema, purchaseOrderSchema, vendorPriceListSchema, vendorQuotationSchema, purchaseRFQSchema } from "../../models/purchase/index.js";
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
  vendorSchema
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
    status: { $in: ["Approved", "Sent to Vendor", "Partially Received", "Ordered"] }
  }).populate("vendor", "name code email phone");

  // Build In-Transit PO Quantities Map
  const inTransitMap = new Map();
  openPOs.forEach(po => {
    (po.items || []).forEach(item => {
      const pendingQty = Number(item.pendingQuantity ?? (item.quantity - (item.receivedQuantity || 0))) || 0;
      if (pendingQty > 0) {
        const nameK = cleanStr(item.materialName || item.itemName);
        const codeK = cleanStr(item.materialCode || item.itemCode);

        const poInfo = {
          poId: po._id,
          poNumber: po.poNumber,
          vendorName: po.vendorName || po.vendor?.name || "Vendor",
          orderedQty: item.quantity,
          receivedQty: item.receivedQuantity || 0,
          pendingQty: pendingQty,
          unit: item.unit || "PCS",
          rate: item.rate || 0,
          expectedDate: item.expectedDeliveryDate || po.expectedDeliveryDate
        };

        [nameK, codeK, cleanKey(nameK), cleanKey(codeK)].filter(Boolean).forEach(k => {
          if (!inTransitMap.has(k)) {
            inTransitMap.set(k, { totalInTransit: 0, poList: [] });
          }
          const entry = inTransitMap.get(k);
          entry.totalInTransit += pendingQty;
          entry.poList.push(poInfo);
        });
      }
    });
  });

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
    vendorPriceLists
  ] = await Promise.all([
    Inventory.find({ company: companyId }).lean(),
    RawMaterial.find({ company: companyId }).lean(),
    BoughtOut.find({ company: companyId }).lean(),
    RmBoItem.find({ company: companyId }).populate("categoryId", "name code").lean(),
    ConsumableItem.find({ company: companyId }).lean(),
    Component.find({ company: companyId }).lean(),
    FGItem.find({ company: companyId }).lean(),
    BOM.find({ company: companyId, status: { $ne: "Inactive" } }).lean(),
    VendorPriceList.find({ company: companyId }).populate("vendor", "name code email phone").lean()
  ]);

  // Master Classification Sets to prevent RM from misclassifying into BO
  const rmSet = new Set();
  const boSet = new Set();
  const compSet = new Set();
  const subAssemblySet = new Set();

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

  // 5. Register Sub-Assemblies from BOM
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
      name,
      code,
      currentStock: qty,
      unit: comp.unit || "PCS",
      itemType: "Component",
      category: "In-House Component",
      priority: 3
    };
    setStockEntry([cleanStr(code), cleanStr(name), cleanKey(code), cleanKey(name)], info);
  });

  // Populate FG Stock
  fgStock.forEach(fg => {
    const name = fg.name || fg.itemName || "";
    const code = fg.code || fg.itemCode || "";
    const qty = Number(fg.stock ?? fg.currentStock ?? fg.quantity ?? 0);
    const info = {
      name,
      code,
      currentStock: qty,
      unit: fg.unit || "PCS",
      itemType: "Assembly",
      category: "Finished Good",
      priority: 3
    };
    setStockEntry([cleanStr(code), cleanStr(name), cleanKey(code), cleanKey(name)], info);
  });

  // Populate RM Stock
  rmStock.forEach(rm => {
    const info = {
      name: rm.name,
      code: rm.code,
      currentStock: Number(rm.currentStock || 0),
      unit: rm.unit || "PCS",
      baseRate: Number(rm.rate || 0),
      itemType: "RM",
      category: "Raw Material",
      priority: 2
    };
    setStockEntry([cleanStr(rm.code), cleanStr(rm.name), cleanKey(rm.code), cleanKey(rm.name)], info);
  });

  // Populate BO Stock
  boStock.forEach(bo => {
    const info = {
      name: bo.name,
      code: bo.code,
      currentStock: Number(bo.currentStock || 0),
      unit: bo.unit || "PCS",
      baseRate: Number(bo.rate || 0),
      itemType: "BO",
      category: "Bought Out",
      priority: 2
    };
    setStockEntry([cleanStr(bo.code), cleanStr(bo.name), cleanKey(bo.code), cleanKey(bo.name)], info);
  });

  // Populate RM/BO Item Profiles
  rmBoStock.forEach(item => {
    const catName = item.categoryId?.name || "";
    const isRM = (item.itemType || "").toLowerCase() === "raw material" || catName.toLowerCase().includes("raw");
    const info = {
      name: item.name,
      code: item.code,
      currentStock: Number(item.currentStock || item.minimumStock || 0),
      unit: item.unit || "PCS",
      baseRate: Number(item.rate || 0),
      itemType: isRM ? "RM" : "BO",
      category: catName || (isRM ? "Raw Material" : "Bought Out"),
      priority: 2
    };
    setStockEntry([cleanStr(item.code), cleanStr(item.name), cleanKey(item.code), cleanKey(item.name)], info);
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

    const info = {
      materialId: inv.materialId || inv._id,
      name,
      code,
      currentStock: qty,
      unit: inv.unit || existing?.unit || "PCS",
      baseRate: Number(inv.unitPrice || existing?.baseRate || 0),
      itemType: resolvedType,
      category: inv.category || existing?.category || (resolvedType === "RM" ? "Raw Material" : "Bought Out"),
      priority: 5 // Live Physical Store Stock
    };
    setStockEntry([cleanStr(code), cleanStr(name), cleanKey(code), cleanKey(name)], info);
  });

  // Vendor Price List Lookup
  const priceListMap = new Map();
  vendorPriceLists.forEach(vpl => {
    (vpl.items || []).forEach(vItem => {
      const nameK = cleanStr(vItem.materialName || vItem.itemName);
      const codeK = cleanStr(vItem.materialCode || vItem.itemCode);
      const entry = {
        vendorId: vpl.vendor?._id,
        vendorName: vpl.vendor?.name || vpl.vendorName,
        vendorCode: vpl.vendor?.code,
        rate: vItem.rate || vItem.unitPrice || 0,
        leadTimeDays: vItem.leadTimeDays || vpl.leadTimeDays || 7,
        moq: vItem.moq || 1,
        currency: vpl.currency || "INR"
      };

      [nameK, codeK, cleanKey(nameK), cleanKey(codeK)].filter(Boolean).forEach(k => {
        if (!priceListMap.has(k)) priceListMap.set(k, []);
        priceListMap.get(k).push(entry);
      });
    });
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
      (level && level > 1 && (subAssemblySet.has(n) || subAssemblySet.has(c) || subAssemblySet.has(nK) || subAssemblySet.has(cK))) ||
      t.includes("sub") || cat.includes("sub") || cat.includes("weldment") ||
      c.startsWith("sa-") || c.startsWith("sub-")
    ) {
      return { itemType: "SubAssembly", category: "Sub Assembly" };
    }

    // 3. Component
    if (
      compSet.has(n) || compSet.has(c) || compSet.has(nK) || compSet.has(cK) ||
      t.includes("comp") || cat.includes("comp") || cat.includes("machined") || cat.includes("turned") || cat.includes("milled") ||
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
    if (t === "fg" || t === "assembly" || t === "finished good" || cat.includes("finished")) {
      return { itemType: "Assembly", category: "Finished Good / Assembly" };
    }

    // Default fallback: Raw Material
    return { itemType: "RM", category: "Raw Material" };
  };

  // Helper to process material item with LIVE stock lookup
  const processMaterialInfo = (name, code, reqQty, unit, rawItemType, rawCategory, parentMRP, level, planRmKeys, planBoKeys, existingStatus) => {
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

    // In-Transit POs
    const inTransitInfo = 
      inTransitMap.get(cKey) || 
      inTransitMap.get(nKey) || 
      inTransitMap.get(cleanKey(cKey)) || 
      inTransitMap.get(cleanKey(nKey)) || {
        totalInTransit: 0,
        poList: []
      };

    // Best Vendor Quote
    const vendorQuotes = 
      priceListMap.get(cKey) || 
      priceListMap.get(nKey) || 
      priceListMap.get(cleanKey(cKey)) || 
      priceListMap.get(cleanKey(nKey)) || [];

    const bestVendor = vendorQuotes.length > 0
      ? vendorQuotes.reduce((prev, curr) => (curr.rate < prev.rate ? curr : prev), vendorQuotes[0])
      : null;

    const classification = resolveClassificationType(name, code, rawItemType, rawCategory, level, planRmKeys, planBoKeys);
    const currentLiveStock = Number(stockInfo.currentStock || 0);
    const netShortage = Math.max(0, reqQty - currentLiveStock - inTransitInfo.totalInTransit);

    return {
      materialKey: cKey || nKey || cleanKey(name),
      materialName: name,
      materialCode: code || stockInfo.code || "",
      itemType: classification.itemType,
      category: classification.category,
      unit: unit || stockInfo.unit || "PCS",
      requiredQuantity: reqQty,
      currentPhysicalStock: currentLiveStock,
      totalInTransitPO: inTransitInfo.totalInTransit,
      openPOs: inTransitInfo.poList,
      netShortage,
      bestVendor,
      estimatedRate: bestVendor?.rate || stockInfo.baseRate || 0,
      estimatedValue: netShortage * (bestVendor?.rate || stockInfo.baseRate || 0),
      parentMRP: parentMRP || "",
      status: existingStatus || "Pending"
    };
  };

  // 1. Consolidated Classification Maps across active plans
  const rmMap = new Map();
  const boMap = new Map();
  const componentMap = new Map();
  const subAssemblyMap = new Map();
  const assemblyMap = new Map();

  // 2. Build Nested BOM Tree per MRP Plan
  const mrpTreeList = activeMrpPlans.map(plan => {
    let planTotalShortages = 0;
    let planTotalInTransit = 0;

    // Keys explicitly in this plan's RM & BO requirements
    const planRmKeys = new Set((plan.rmRequirements || []).flatMap(r => [cleanStr(r.materialName), cleanStr(r.materialCode)]).filter(Boolean));
    const planBoKeys = new Set((plan.boRequirements || []).flatMap(b => [cleanStr(b.materialName), cleanStr(b.materialCode)]).filter(Boolean));

    const planStatusMap = new Map();
    (plan.rmRequirements || []).forEach(r => {
      if (r.status) {
        planStatusMap.set(cleanStr(r.materialName), r.status);
        planStatusMap.set(cleanStr(r.materialCode), r.status);
      }
    });
    (plan.boRequirements || []).forEach(b => {
      if (b.status) {
        planStatusMap.set(cleanStr(b.materialName), b.status);
        planStatusMap.set(cleanStr(b.materialCode), b.status);
      }
    });
    (plan.subAssemblyRequirements || []).forEach(s => {
      if (s.status) {
        planStatusMap.set(cleanStr(s.materialName), s.status);
        planStatusMap.set(cleanStr(s.materialCode), s.status);
      }
    });
    (plan.consumableRequirements || []).forEach(c => {
      if (c.status) {
        planStatusMap.set(cleanStr(c.materialName), c.status);
        planStatusMap.set(cleanStr(c.materialCode), c.status);
      }
    });

    const fgItemsTree = (plan.fgItems || []).map(fg => {
      const fgQty = Number(fg.quantity) || 1;
      const fgReceived = Number(fg.receivedQuantity) || 0;

      // Register root FG into assemblyMap
      const fgClassification = processMaterialInfo(
        fg.fgItemName,
        fg.fgItemCode,
        fgQty,
        fg.unit,
        "Assembly",
        "Finished Good",
        plan.mrpNumber,
        1,
        planRmKeys,
        planBoKeys,
        fg.status || "Pending"
      );

      const fgK = fgClassification.materialKey;
      if (!assemblyMap.has(fgK)) {
        assemblyMap.set(fgK, { ...fgClassification, grossRequired: 0, mrpSources: [] });
      }
      const fgEntry = assemblyMap.get(fgK);
      fgEntry.grossRequired += fgQty;
      fgEntry.mrpSources.push({
        mrpNumber: plan.mrpNumber,
        customerName: plan.customerName,
        requiredQty: fgQty
      });

      // Group nested materials by level and parent
      const nestedList = (fg.nestedMaterials || []).map(nMat => {
        const nQty = Number(nMat.totalRequired) || (Number(nMat.quantityPerFG) * fgQty) || 1;
        const matStatus = nMat.status || planStatusMap.get(cleanStr(nMat.materialName)) || planStatusMap.get(cleanStr(nMat.materialCode)) || "Pending";
        const processed = processMaterialInfo(
          nMat.materialName,
          nMat.materialCode,
          nQty,
          nMat.unit,
          nMat.itemType,
          nMat.category,
          plan.mrpNumber,
          nMat.level || 2,
          planRmKeys,
          planBoKeys,
          matStatus
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
            mrpSources: []
          });
        }
        const entry = targetMap.get(k);
        entry.grossRequired += nQty;
        entry.netShortage = Math.max(0, entry.grossRequired - entry.currentPhysicalStock - entry.totalInTransitPO);
        entry.estimatedValue = entry.netShortage * (entry.bestVendor?.rate || entry.estimatedRate || 0);
        entry.mrpSources.push({
          mrpNumber: plan.mrpNumber,
          customerName: plan.customerName,
          requiredQty: nQty
        });

        return {
          ...nMat.toObject?.() || nMat,
          ...processed
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
        bomNumber: fg.bomNumber,
        nestedMaterials: nestedList
      };
    });

    const isProcurementFulfilled = planTotalShortages === 0;

    return {
      _id: plan._id,
      mrpNumber: plan.mrpNumber,
      customerName: plan.customerName || "Internal Demand",
      customerPoNumber: plan.customerPoNumber,
      targetDate: plan.targetDate,
      status: plan.status,
      isProcurementFulfilled,
      planTotalShortages,
      planTotalInTransit,
      fgItems: fgItemsTree
    };
  });

  // Format Classified Arrays
  const rmList = Array.from(rmMap.values());
  const boList = Array.from(boMap.values());
  const componentList = Array.from(componentMap.values());
  const subAssemblyList = Array.from(subAssemblyMap.values());
  const assemblyList = Array.from(assemblyMap.values());

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

    const newPO = await PurchaseOrder.create({
      company: companyId,
      poNumber,
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

    // Update MRP Plan Item statuses
    const affectedMrpIds = new Set();
    vItems.forEach(vi => {
      (vi.mrpSources || []).forEach((src) => {
        if (src.mrpPlanId) affectedMrpIds.add(src.mrpPlanId);
      });
    });

    if (affectedMrpIds.size > 0) {
      await MRPPlan.updateMany(
        { _id: { $in: Array.from(affectedMrpIds) } },
        { $set: { "rmRequirements.$[].status": "PO Raised", "boRequirements.$[].status": "PO Raised" } }
      );
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
        orders: [],
        items: []
      });
    }
    const bucket = mrpMap.get(key);
    bucket.orders.push(order);
    (order.items || []).forEach(it => {
      bucket.totalItemsCount += (Number(it.quantity) || 1);
      bucket.items.push({
        ...it,
        orderId: order._id,
        orderNumber: order.orderNumber,
        orderStatus: order.status,
        mrpNumber: key
      });
    });
  });

  const mrpBuckets = Array.from(mrpMap.values());

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
  const { items, status } = req.body;

  const MRPPlan = req.getModel("MRPPlan", mrpPlanSchema);
  const plan = await MRPPlan.findOne({ _id: id, company: companyId });
  if (!plan) {
    throw new ApiError(404, "MRP Plan not found");
  }

  // Build updates map
  const updatesMap = new Map();
  if (Array.isArray(items) && items.length > 0) {
    items.forEach(itm => {
      const targetStatus = itm.status || status;
      if (targetStatus) {
        if (itm.materialKey) updatesMap.set(cleanStr(itm.materialKey), targetStatus);
        if (itm.materialName) updatesMap.set(cleanStr(itm.materialName), targetStatus);
        if (itm.materialCode) updatesMap.set(cleanStr(itm.materialCode), targetStatus);
      }
    });
  } else if (status) {
    // Global fallback for all items in plan if needed
    updatesMap.set("__ALL__", status);
  }

  const getUpdatedStatus = (name, code, curr) => {
    return (
      updatesMap.get(cleanStr(code)) ||
      updatesMap.get(cleanStr(name)) ||
      (updatesMap.has("__ALL__") ? updatesMap.get("__ALL__") : null) ||
      curr ||
      "Pending"
    );
  };

  // 1. Update rmRequirements
  (plan.rmRequirements || []).forEach(r => {
    r.status = getUpdatedStatus(r.materialName, r.materialCode, r.status);
  });

  // 2. Update boRequirements
  (plan.boRequirements || []).forEach(b => {
    b.status = getUpdatedStatus(b.materialName, b.materialCode, b.status);
  });

  // 3. Update subAssemblyRequirements
  (plan.subAssemblyRequirements || []).forEach(s => {
    s.status = getUpdatedStatus(s.materialName, s.materialCode, s.status);
  });

  // 4. Update consumableRequirements
  (plan.consumableRequirements || []).forEach(c => {
    c.status = getUpdatedStatus(c.materialName, c.materialCode, c.status);
  });

  // 5. Update nestedMaterials inside fgItems
  (plan.fgItems || []).forEach(fg => {
    // If updating FG item status directly
    if (updatesMap.has(cleanStr(fg.fgItemName)) || updatesMap.has(cleanStr(fg.fgItemCode))) {
      fg.status = getUpdatedStatus(fg.fgItemName, fg.fgItemCode, fg.status);
    }
    (fg.nestedMaterials || []).forEach(nm => {
      nm.status = getUpdatedStatus(nm.materialName, nm.materialCode, nm.status);
    });
  });

  await plan.save();

  return res.status(200).json(new ApiResponse(200, plan, "Successfully updated BOM Item Status"));
});



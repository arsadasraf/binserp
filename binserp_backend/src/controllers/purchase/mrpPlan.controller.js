import mongoose from "mongoose";
import { mrpPlanSchema, purchaseOrderSchema, vendorPriceListSchema } from "../../models/purchase/index.js";
import { bomSchema, inventorySchema, rmBoItemSchema, categorySchema, fgItemSchema, rawMaterialSchema, boughtOutSchema, storePrefixSchema, vendorSchema } from "../../models/store/index.js";
import { incomingPOSchema } from "../../models/sales/index.js";
import { userSchema } from "../../models/user/index.js";
import { checkTimeLockGovernance } from "../../utils/timeLockGovernance.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

export const createMRPPlan = async (req, res) => {
  try {
    const MRPPlan = req.getModel("MRPPlan", mrpPlanSchema);
    const BOM = req.getModel("BOM", bomSchema);
    const Inventory = req.getModel("Inventory", inventorySchema);
    const RmBoItem = req.getModel("RmBoItem", rmBoItemSchema);
    const RawMaterial = req.getModel("RawMaterial", rawMaterialSchema);
    const BoughtOut = req.getModel("BoughtOut", boughtOutSchema);
    const Category = req.getModel("Category", categorySchema);
    const FGItem = req.getModel("FGItem", fgItemSchema);
    const IncomingPO = req.getModel("IncomingPO", incomingPOSchema);
    req.getModel("User", userSchema);

    const companyId = getCompanyId(req);
    const {
      mrpNumber: customMrpNumber,
      customerPoNumber = "",
      customerPo,
      customerName = "",
      customerPOs = [],
      customerPoIds = [],
      isConsolidated: isConsolidatedFlag,
      poDate,
      targetDate,
      remarks = "",
      fgItems = [],
    } = req.body;

    if (!Array.isArray(fgItems) || fgItems.length === 0) {
      return res.status(400).json({ message: "At least one Finished Goods (FG) item is required for MRP calculation." });
    }

    // Resolve Customer POs list (for single or multi-PO consolidation)
    let resolvedCustomerPOs = [];
    if (Array.isArray(customerPOs) && customerPOs.length > 0) {
      resolvedCustomerPOs = customerPOs.map((p) => ({
        customerPo: p.customerPo || p._id || p.id,
        customerPoNumber: p.customerPoNumber || p.poNumber || "",
        customer: p.customer?._id || p.customer,
        customerName: p.customerName || p.customer?.name || "",
        poDate: p.poDate ? new Date(p.poDate) : undefined,
        targetDate: p.targetDate ? new Date(p.targetDate) : undefined,
      }));
    } else if (Array.isArray(customerPoIds) && customerPoIds.length > 0) {
      const fetchedPOs = await IncomingPO.find({
        company: companyId,
        _id: { $in: customerPoIds },
      }).populate("customer", "name code");

      resolvedCustomerPOs = fetchedPOs.map((p) => ({
        customerPo: p._id,
        customerPoNumber: p.poNumber || "",
        customer: p.customer?._id || p.customer,
        customerName: p.customer?.name || p.customerName || "",
        poDate: p.date ? new Date(p.date) : undefined,
        targetDate: p.committedDispatchDate || p.deliveryDate || p.date,
      }));
    } else if (customerPo || customerPoNumber) {
      resolvedCustomerPOs = [
        {
          customerPo: customerPo && mongoose.Types.ObjectId.isValid(customerPo) ? customerPo : undefined,
          customerPoNumber: customerPoNumber || "",
          customerName: customerName || "",
          poDate: poDate ? new Date(poDate) : undefined,
          targetDate: targetDate ? new Date(targetDate) : undefined,
        },
      ];
    }

    const isConsolidated = Boolean(isConsolidatedFlag || resolvedCustomerPOs.length > 1);

    // Derived display fields for backward compatibility
    const displayPoNumber = resolvedCustomerPOs.length > 0
      ? resolvedCustomerPOs.map((p) => p.customerPoNumber).filter(Boolean).join(", ")
      : customerPoNumber;

    const displayCustomerName = resolvedCustomerPOs.length > 0
      ? [...new Set(resolvedCustomerPOs.map((p) => p.customerName).filter(Boolean))].join(", ")
      : customerName;

    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    
    let mrpNumber = customMrpNumber;
    if (!mrpNumber) {
      if (isConsolidated) {
        mrpNumber = `MRP-BATCH-${dateStr}-${randomSuffix}`;
      } else if (customerPoNumber) {
        mrpNumber = customerPoNumber;
      } else if (resolvedCustomerPOs.length === 1 && resolvedCustomerPOs[0].customerPoNumber) {
        mrpNumber = resolvedCustomerPOs[0].customerPoNumber;
      } else {
        mrpNumber = `MRP-${dateStr}-${randomSuffix}`;
      }
    }

    // Maps to aggregate RM, BO, SubAssemblies and Consumables across all FG items
    const rmMap = new Map();
    const boMap = new Map();
    const subAssemblyMap = new Map();
    const consumableMap = new Map();

    // Cache inventory, RM/BO items, BOMs, FG items, vendor price lists, and contributing Customer POs
    const allInventories = await Inventory.find({ company: companyId });
    const allRmBoItems = await RmBoItem.find({ company: companyId }).populate("categoryId");
    const allRawMaterials = await RawMaterial.find({ company: companyId }).populate("categoryId");
    const allBoughtOuts = await BoughtOut.find({ company: companyId }).populate("categoryId");
    const allBOMs = await BOM.find({ company: companyId });
    const allFGItems = await FGItem.find({ company: companyId });

    const VendorPriceList = req.getModel("VendorPriceList", vendorPriceListSchema);
    req.getModel("Vendor", vendorSchema);
    const allPriceLists = await VendorPriceList.find({ company: companyId }).populate("vendor", "name code").lean().catch(() => []);

    const allContributingPoIds = resolvedCustomerPOs
      .map((p) => p.customerPo)
      .filter((id) => id && mongoose.Types.ObjectId.isValid(id));

    let contributingPODocs = [];
    if (allContributingPoIds.length > 0) {
      contributingPODocs = await IncomingPO.find({
        company: companyId,
        _id: { $in: allContributingPoIds }
      }).lean().catch(() => []);
    } else if (customerPoNumber) {
      contributingPODocs = await IncomingPO.find({
        company: companyId,
        poNumber: customerPoNumber
      }).lean().catch(() => []);
    }

    // String normalization helpers for lookup maps
    const cleanStr = (s) => (s || "").trim().toLowerCase();
    const cleanKey = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

    // Build Fast Vendor Price List Map
    const vendorPriceMap = new Map();
    (allPriceLists || []).forEach((vpl) => {
      const vendorId = vpl.vendor?._id || vpl.vendor;
      const vendorName = vpl.vendor?.name || vpl.vendorName || "Vendor";
      const rawMatId = (vpl.material?._id || vpl.material)?.toString();

      const addPriceEntry = (keys, rate, isPref) => {
        const entry = {
          vendorId,
          vendorName,
          rate: Number(rate) || 0,
          isPreferred: Boolean(isPref)
        };
        keys.filter(Boolean).forEach((k) => {
          if (!vendorPriceMap.has(k)) vendorPriceMap.set(k, []);
          vendorPriceMap.get(k).push(entry);
        });
      };

      if (vpl.material || rawMatId) {
        const mat = vpl.material;
        const matName = typeof mat === 'object' ? (mat.name || mat.materialName || "") : "";
        const matCode = typeof mat === 'object' ? (mat.code || mat.materialCode || "") : "";
        const keys = [
          rawMatId,
          cleanStr(matName),
          cleanStr(matCode),
          cleanKey(matName),
          cleanKey(matCode),
        ];
        addPriceEntry(keys, vpl.price, vpl.isPreferred);
      }

      if (Array.isArray(vpl.items)) {
        vpl.items.forEach((vItem) => {
          const vName = cleanStr(vItem.materialName || vItem.itemName);
          const vCode = cleanStr(vItem.materialCode || vItem.itemCode);
          const keys = [vName, vCode, cleanKey(vName), cleanKey(vCode)];
          addPriceEntry(keys, vItem.rate || vItem.unitPrice || 0, vItem.isPreferred || vpl.isPreferred);
        });
      }
    });

    // Material Cost Resolver: checks VendorPriceList preferred rate > lowest rate > inventory unitPrice > rmBo baseRate
    const resolveMaterialPrice = (name, code, matId, rmBoObj) => {
      const keys = [
        matId ? String(matId) : null,
        cleanStr(code),
        cleanStr(name),
        cleanKey(code),
        cleanKey(name)
      ].filter(Boolean);

      let quotes = [];
      for (const k of keys) {
        if (vendorPriceMap.has(k)) {
          quotes = vendorPriceMap.get(k);
          break;
        }
      }

      if (quotes.length > 0) {
        const preferred = quotes.find((q) => q.isPreferred);
        const chosen = preferred || quotes.slice().sort((a, b) => a.rate - b.rate)[0];
        if (chosen && chosen.rate > 0) {
          return {
            unitCost: chosen.rate,
            costSource: "Vendor Price List",
            preferredVendor: chosen.vendorId,
            preferredVendorName: chosen.vendorName
          };
        }
      }

      const inv = allInventories.find(
        (i) =>
          (code && i.materialCode && i.materialCode.toLowerCase() === code.toLowerCase()) ||
          (name && i.materialName && i.materialName.toLowerCase() === name.toLowerCase())
      );

      const invRate = Number(inv?.unitPrice || 0);
      const baseRate = Number(rmBoObj?.baseRate || 0);
      const fallbackRate = invRate > 0 ? invRate : baseRate;

      return {
        unitCost: fallbackRate,
        costSource: fallbackRate > 0 ? "Inventory Valuation" : "Estimated Rate",
        preferredVendor: undefined,
        preferredVendorName: ""
      };
    };

    // Finished Goods Selling Price Resolver: Customer PO rate > FGItem sellingPrice > Manual
    const resolveFGSellingPrice = (fgId, fgName, fgCode, manualPrice) => {
      if (manualPrice !== undefined && manualPrice !== null && Number(manualPrice) > 0) {
        return { sellingPrice: Number(manualPrice), priceSource: "Manual Override" };
      }

      for (const poDoc of contributingPODocs) {
        if (Array.isArray(poDoc.items)) {
          const matchedItem = poDoc.items.find((it) => {
            const itFgId = it.fgItem?._id || it.fgItem;
            if (fgId && itFgId && String(itFgId) === String(fgId)) return true;
            const pName = (it.productName || it.name || "").trim().toLowerCase();
            const pCode = (it.productCode || it.code || "").trim().toLowerCase();
            if (fgName && pName && pName === fgName.trim().toLowerCase()) return true;
            if (fgCode && pCode && pCode === fgCode.trim().toLowerCase()) return true;
            return false;
          });

          if (matchedItem) {
            const resolvedRate = Number(matchedItem.rate || (matchedItem.quantity > 0 ? matchedItem.amount / matchedItem.quantity : 0));
            if (resolvedRate > 0) {
              return { sellingPrice: resolvedRate, priceSource: "Customer PO" };
            }
          }
        }
      }

      const matchedMaster = allFGItems.find((f) =>
        (fgId && String(f._id) === String(fgId)) ||
        (fgName && f.name && f.name.trim().toLowerCase() === fgName.trim().toLowerCase()) ||
        (fgCode && f.code && f.code.trim().toLowerCase() === fgCode.trim().toLowerCase())
      );

      if (matchedMaster && Number(matchedMaster.sellingPrice) > 0) {
        return { sellingPrice: Number(matchedMaster.sellingPrice), priceSource: "Master Catalog" };
      }

      return { sellingPrice: 0, priceSource: "Unset" };
    };

    const enrichedFgItems = [];

    // Helper to find BOM for a product (from BOM collection OR FGItem embedded BOM)
    const findBOM = (pName, pCode, bId, fgId) => {
      // 1. Direct BOM ID match
      if (bId) {
        const found = allBOMs.find((b) => b._id && b._id.toString() === bId.toString());
        if (found && Array.isArray(found.items) && found.items.length > 0) return found;

        const foundByNum = allBOMs.find((b) => b.bomNumber && b.bomNumber.toString().toLowerCase() === bId.toString().toLowerCase());
        if (foundByNum && Array.isArray(foundByNum.items) && foundByNum.items.length > 0) return foundByNum;
      }

      // 2. Direct FG Item ID match with embedded BOM
      if (fgId) {
        const foundFG = allFGItems.find((f) => f._id && f._id.toString() === fgId.toString());
        if (foundFG && Array.isArray(foundFG.bom) && foundFG.bom.length > 0) {
          return {
            _id: foundFG._id,
            bomNumber: `BOM-${foundFG.code || foundFG.name}`,
            productName: foundFG.name,
            productCode: foundFG.code,
            items: foundFG.bom.map((b) => ({
              materialName: b.itemName || b.name || "Material",
              materialCode: b.itemCode || b.code || "",
              quantity: Number(b.quantity) || 1,
              unit: b.unit || "PCS",
              itemType: b.itemType || "Material",
            })),
          };
        }
      }

      // 3. Match by Product Name
      if (pName) {
        const cleanPName = pName.trim().toLowerCase();
        const found = allBOMs.find(
          (b) => b.productName && b.productName.trim().toLowerCase() === cleanPName
        );
        if (found && Array.isArray(found.items) && found.items.length > 0) return found;

        const foundFG = allFGItems.find(
          (f) => f.name && f.name.trim().toLowerCase() === cleanPName
        );
        if (foundFG && Array.isArray(foundFG.bom) && foundFG.bom.length > 0) {
          return {
            _id: foundFG._id,
            bomNumber: `BOM-${foundFG.code || foundFG.name}`,
            productName: foundFG.name,
            productCode: foundFG.code,
            items: foundFG.bom.map((b) => ({
              materialName: b.itemName || b.name || "Material",
              materialCode: b.itemCode || b.code || "",
              quantity: Number(b.quantity) || 1,
              unit: b.unit || "PCS",
              itemType: b.itemType || "Material",
            })),
          };
        }
      }

      // 4. Match by Product Code
      if (pCode) {
        const cleanPCode = pCode.trim().toLowerCase();
        const found = allBOMs.find(
          (b) => b.productCode && b.productCode.trim().toLowerCase() === cleanPCode
        );
        if (found && Array.isArray(found.items) && found.items.length > 0) return found;

        const foundFG = allFGItems.find(
          (f) => f.code && f.code.trim().toLowerCase() === cleanPCode
        );
        if (foundFG && Array.isArray(foundFG.bom) && foundFG.bom.length > 0) {
          return {
            _id: foundFG._id,
            bomNumber: `BOM-${foundFG.code || foundFG.name}`,
            productName: foundFG.name,
            productCode: foundFG.code,
            items: foundFG.bom.map((b) => ({
              materialName: b.itemName || b.name || "Material",
              materialCode: b.itemCode || b.code || "",
              quantity: Number(b.quantity) || 1,
              unit: b.unit || "PCS",
              itemType: b.itemType || "Material",
            })),
          };
        }
      }

      return null;
    };

    // Recursive BOM explosion function with Customer PO tracking
    const explodeItemTree = (itemName, itemCode, multiplierQty, parentName, level, nestedList, fgId, bId, sourcePoNumber) => {
      const subBOM = findBOM(itemName, itemCode, bId, fgId);
      if (subBOM && Array.isArray(subBOM.items) && subBOM.items.length > 0 && level <= 5) {
        for (const subItem of subBOM.items) {
          const sName = (subItem.materialName || "").trim();
          const sCode = (subItem.materialCode || "").trim();
          const perQty = Number(subItem.quantity) || 1;
          const grossQty = perQty * multiplierQty;
          const unit = subItem.unit || "PCS";

          // Stock lookup
          const inv = allInventories.find(
            (i) =>
              (sCode && i.materialCode && i.materialCode.toLowerCase() === sCode.toLowerCase()) ||
              (i.materialName && i.materialName.toLowerCase() === sName.toLowerCase())
          );
          const currentStock = inv ? Number(inv.currentStock || 0) : 0;
          const shortage = Math.max(0, grossQty - currentStock);

          // RM/BO lookup
          const rmBo = allRmBoItems.find(
            (r) =>
              (sCode && r.code && r.code.toLowerCase() === sCode.toLowerCase()) ||
              (r.name && r.name.toLowerCase() === sName.toLowerCase())
          );
          const rawMat = allRawMaterials.find(
            (r) =>
              (sCode && r.code && r.code.toLowerCase() === sCode.toLowerCase()) ||
              (r.name && r.name.toLowerCase() === sName.toLowerCase())
          );
          const boughtOut = allBoughtOuts.find(
            (r) =>
              (sCode && r.code && r.code.toLowerCase() === sCode.toLowerCase()) ||
              (r.name && r.name.toLowerCase() === sName.toLowerCase())
          );

          // Check if this subItem itself is an FGItem / sub-assembly
          const matchedFG = allFGItems.find(
            (f) =>
              (sCode && f.code && f.code.toLowerCase() === sCode.toLowerCase()) ||
              (f.name && f.name.toLowerCase() === sName.toLowerCase())
          );
          const nestedSubBOM = findBOM(sName, sCode);
          const fgType = matchedFG?.type || subItem.fgType || subItem.itemClassification;
          const isSubAssembly = fgType === "Sub Assembly" || Boolean(nestedSubBOM);
          const isComponent = fgType === "Component";
          const isAssembly = fgType === "Assembly";

          const assignedMasterCat = rawMat?.categoryId?.name || boughtOut?.categoryId?.name || rmBo?.categoryId?.name || rawMat?.category || boughtOut?.category || rmBo?.category || "";
          const catName = (assignedMasterCat || rmBo?.categoryId?.name || rmBo?.category || "").toLowerCase();
          const rawItemType = (rawMat?.itemType || boughtOut?.itemType || rmBo?.itemType || "").toLowerCase();
          const isBO = Boolean(boughtOut) || rawItemType === 'bought out' || rawItemType === 'bo' || catName.includes('bought') || catName.includes('hardware') || catName.includes('fastener');
          const isConsumable = rawItemType === 'consumable' || catName.includes('consumable');

          let resolvedItemType = "RM";
          let categoryLabel = assignedMasterCat || "Raw Material";

          if (isSubAssembly) {
            resolvedItemType = "SubAssembly";
            categoryLabel = "Sub Assembly";
          } else if (isComponent) {
            resolvedItemType = "Component";
            categoryLabel = "In-House Component";
          } else if (isAssembly) {
            resolvedItemType = "Assembly";
            categoryLabel = "Finished Good / Assembly";
          } else if (isBO) {
            resolvedItemType = "BO";
            categoryLabel = assignedMasterCat || "Bought Out";
          } else if (isConsumable) {
            resolvedItemType = "Consumable";
            categoryLabel = assignedMasterCat || "Consumable";
          }

          const sDesc = subItem.description || matchedFG?.description || matchedFG?.descriptions || rmBo?.description || rmBo?.descriptions || "";

          nestedList.push({
            materialName: sName,
            materialCode: sCode,
            description: sDesc,
            itemType: resolvedItemType,
            category: categoryLabel,
            fgType: fgType || undefined,
            quantityPerFG: perQty,
            totalRequired: grossQty,
            currentStock: currentStock,
            shortage: shortage,
            unit: unit,
            parentItemName: parentName,
            level: level,
          });

          // Consolidate into specific maps
          const itemKey = (sCode || sName).toLowerCase();
          let targetMap = rmMap;
          if (isSubAssembly) targetMap = subAssemblyMap;
          else if (isBO) targetMap = boMap;
          else if (isConsumable) targetMap = consumableMap;

          if (!targetMap.has(itemKey)) {
            targetMap.set(itemKey, {
              material: rmBo?._id,
              materialName: sName,
              materialCode: sCode,
              description: sDesc,
              category: categoryLabel,
              itemType: resolvedItemType,
              requiredQuantity: 0,
              currentStock: currentStock,
              shortage: 0,
              unit: unit,
              sourceFGName: parentName,
              sourceFGNames: [],
              sourceCustomerPOs: [],
              status: "Pending",
            });
          }
          const existing = targetMap.get(itemKey);
          if (!existing.description && sDesc) {
            existing.description = sDesc;
          }
          existing.requiredQuantity += grossQty;
          existing.shortage = Math.max(0, existing.requiredQuantity - existing.currentStock);

          if (!existing.sourceCustomerPOs) existing.sourceCustomerPOs = [];
          if (sourcePoNumber && !existing.sourceCustomerPOs.includes(sourcePoNumber)) {
            existing.sourceCustomerPOs.push(sourcePoNumber);
          }

          const poTag = sourcePoNumber ? ` [PO: ${sourcePoNumber}]` : "";
          const fgLabel = `${parentName}${poTag} (${grossQty} ${unit})`;
          if (!existing.sourceFGNames.includes(fgLabel)) {
            existing.sourceFGNames.push(fgLabel);
          }

          // If it has sub-components, recurse into next level
          if (isSubAssembly) {
            explodeItemTree(sName, sCode, grossQty, sName, level + 1, nestedList, undefined, undefined, sourcePoNumber);
          }
        }
      }
    };

    // Deduplicate and aggregate Finished Goods line items
    const mergedFgMap = new Map();

    for (const fg of fgItems) {
      const rawQty = Number(fg.quantity) || 1;
      const fgName = (fg.fgItemName || fg.name || "").trim();
      const fgCode = (fg.fgItemCode || fg.code || "").trim();
      const fgId = fg.fgItem || fg._id;
      const itemKey = fgId ? String(fgId) : (fgCode || fgName).toLowerCase();
      if (!itemKey) continue;

      const fgPoNumber = fg.customerPoNumber || (resolvedCustomerPOs.length === 1 ? resolvedCustomerPOs[0].customerPoNumber : "");
      const fgPoId = fg.customerPo || (resolvedCustomerPOs.length === 1 ? resolvedCustomerPOs[0].customerPo : undefined);
      const fgCustName = fg.customerName || (resolvedCustomerPOs.length === 1 ? resolvedCustomerPOs[0].customerName : "");
      const fgTargetDate = fg.targetDate ? new Date(fg.targetDate) : undefined;
      const fgPoDate = fg.poDeliveryDate ? new Date(fg.poDeliveryDate) : undefined;

      if (!mergedFgMap.has(itemKey)) {
        mergedFgMap.set(itemKey, {
          fgItem: fgId,
          fgItemName: fgName,
          fgItemCode: fgCode,
          description: fg.description || "",
          quantity: 0,
          unit: fg.unit || "PCS",
          sellingPrice: Number(fg.sellingPrice) || 0,
          priceSource: fg.priceSource || "",
          poDeliveryDate: fgPoDate,
          targetDate: fgTargetDate,
          customerPo: fgPoId,
          customerPoNumber: fgPoNumber,
          customerName: fgCustName,
          bomId: fg.bomId,
          bomNumber: fg.bomNumber,
          sourceBreakdown: [],
          sourceCustomerPOs: [],
        });
      }

      const existing = mergedFgMap.get(itemKey);
      existing.quantity += rawQty;
      if (!existing.description && fg.description) existing.description = fg.description;
      if (!existing.bomId && fg.bomId) existing.bomId = fg.bomId;
      if (!existing.sellingPrice && fg.sellingPrice) {
        existing.sellingPrice = Number(fg.sellingPrice);
        existing.priceSource = fg.priceSource || "Manual Override";
      }

      // Keep earliest targetDate & poDeliveryDate
      if (fgTargetDate) {
        if (!existing.targetDate || fgTargetDate < existing.targetDate) {
          existing.targetDate = fgTargetDate;
        }
      }
      if (fgPoDate) {
        if (!existing.poDeliveryDate || fgPoDate < existing.poDeliveryDate) {
          existing.poDeliveryDate = fgPoDate;
        }
      }

      // Track source breakdown
      existing.sourceBreakdown.push({
        customerPo: fgPoId,
        customerPoNumber: fgPoNumber,
        customerName: fgCustName,
        quantity: rawQty,
      });

      if (fgPoNumber && !existing.sourceCustomerPOs.includes(fgPoNumber)) {
        existing.sourceCustomerPOs.push(fgPoNumber);
      }
    }

    // Process merged FG items and explode BOM with merged gross quantities
    for (const fg of mergedFgMap.values()) {
      const fgQty = fg.quantity;
      const fgName = fg.fgItemName;
      const fgCode = fg.fgItemCode;
      const fgDesc = fg.description;
      const fgTargetDate = fg.targetDate;
      const fgId = fg.fgItem;
      const combinedPoNumbers = fg.sourceCustomerPOs.length > 0 ? fg.sourceCustomerPOs.join(", ") : fg.customerPoNumber;

      const bomDoc = findBOM(fgName, fgCode, fg.bomId, fgId);
      const nestedMaterials = [];

      // Explode nested tree passing combined Customer PO numbers for child traceability
      explodeItemTree(fgName, fgCode, fgQty, fgName, 1, nestedMaterials, fgId, fg.bomId, combinedPoNumbers);

      // Financial resolution for FG selling rate
      const fgPriceResult = resolveFGSellingPrice(fgId, fgName, fgCode, fg.sellingPrice);
      const unitSellingPrice = fgPriceResult.sellingPrice;
      const fgTotalPrice = Math.round(fgQty * unitSellingPrice * 100) / 100;

      enrichedFgItems.push({
        fgItem: fgId,
        fgItemName: fgName,
        fgItemCode: fgCode,
        description: fgDesc,
        quantity: fgQty,
        unit: fg.unit || "PCS",
        sellingPrice: unitSellingPrice,
        totalPrice: fgTotalPrice,
        priceSource: fgPriceResult.priceSource,
        poDeliveryDate: fg.poDeliveryDate,
        targetDate: fgTargetDate,
        customerPo: fg.customerPo,
        customerPoNumber: combinedPoNumbers,
        customerName: fg.customerName,
        bomId: bomDoc?._id || fg.bomId,
        bomNumber: bomDoc?.bomNumber || fg.bomNumber || (nestedMaterials.length > 0 ? "BOM-Active" : "BOM-Auto"),
        sourceBreakdown: fg.sourceBreakdown,
        sourceCustomerPOs: fg.sourceCustomerPOs,
        nestedMaterials: nestedMaterials,
      });
    }

    const rmRequirements = Array.from(rmMap.values());
    const boRequirements = Array.from(boMap.values());
    const subAssemblyRequirements = Array.from(subAssemblyMap.values());
    const consumableRequirements = Array.from(consumableMap.values());

    // Financial Metrics Calculation
    let totalIncome = 0;
    enrichedFgItems.forEach((f) => {
      totalIncome += Number(f.totalPrice || 0);
    });

    let totalGrossMaterialCost = 0;
    let totalEstimatedExpense = 0;

    const populateReqPricing = (reqList) => {
      reqList.forEach((r) => {
        const rmBoObj = allRmBoItems.find(
          (item) =>
            (item._id && r.material && String(item._id) === String(r.material)) ||
            (r.materialCode && item.code && item.code.toLowerCase() === r.materialCode.toLowerCase()) ||
            (r.materialName && item.name && item.name.toLowerCase() === r.materialName.toLowerCase())
        );
        const pricing = resolveMaterialPrice(r.materialName, r.materialCode, r.material, rmBoObj);
        r.unitCost = pricing.unitCost;
        r.costSource = pricing.costSource;
        if (pricing.preferredVendor) r.preferredVendor = pricing.preferredVendor;
        if (pricing.preferredVendorName) r.preferredVendorName = pricing.preferredVendorName;

        r.grossCost = Math.round(Number(r.requiredQuantity || 0) * r.unitCost * 100) / 100;
        r.shortageCost = Math.round(Number(r.shortage || 0) * r.unitCost * 100) / 100;

        totalGrossMaterialCost += r.grossCost;
        totalEstimatedExpense += r.shortageCost;
      });
    };

    populateReqPricing(rmRequirements);
    populateReqPricing(boRequirements);
    populateReqPricing(consumableRequirements);

    // Also populate pricing on nestedMaterials inside enrichedFgItems
    enrichedFgItems.forEach((fg) => {
      if (Array.isArray(fg.nestedMaterials)) {
        fg.nestedMaterials.forEach((nMat) => {
          const pricing = resolveMaterialPrice(nMat.materialName, nMat.materialCode, undefined, undefined);
          nMat.unitCost = pricing.unitCost;
          nMat.costSource = pricing.costSource;
          nMat.grossCost = Math.round(Number(nMat.totalRequired || 0) * pricing.unitCost * 100) / 100;
          nMat.shortageCost = Math.round(Number(nMat.shortage || 0) * pricing.unitCost * 100) / 100;
        });
      }
    });

    totalIncome = Math.round(totalIncome * 100) / 100;
    totalGrossMaterialCost = Math.round(totalGrossMaterialCost * 100) / 100;
    totalEstimatedExpense = Math.round(totalEstimatedExpense * 100) / 100;

    const projectedGrossProfit = Math.round((totalIncome - totalGrossMaterialCost) * 100) / 100;
    const projectedMarginPercentage = totalIncome > 0
      ? Math.round(((totalIncome - totalGrossMaterialCost) / totalIncome) * 10000) / 100
      : 0;

    const targetExpense = Math.max(0, Number(req.body.targetExpense || 0));
    let budgetStatus = "Unset";
    if (targetExpense > 0) {
      if (totalEstimatedExpense > targetExpense) {
        budgetStatus = "Over Budget";
      } else if (totalEstimatedExpense >= targetExpense * 0.85) {
        budgetStatus = "Near Limit";
      } else {
        budgetStatus = "Within Budget";
      }
    }

    const newPlan = await MRPPlan.create({
      company: companyId,
      mrpNumber,
      customerPoNumber: displayPoNumber,
      customerPo: resolvedCustomerPOs.length === 1 ? resolvedCustomerPOs[0].customerPo : undefined,
      customerName: displayCustomerName,
      isConsolidated,
      customerPOs: resolvedCustomerPOs,
      poDate: poDate ? new Date(poDate) : (resolvedCustomerPOs[0]?.poDate || undefined),
      targetDate: targetDate ? new Date(targetDate) : (resolvedCustomerPOs[0]?.targetDate || undefined),
      remarks,
      status: "Planned",
      fgItems: enrichedFgItems,
      rmRequirements,
      boRequirements,
      subAssemblyRequirements,
      consumableRequirements,
      totalIncome,
      totalGrossMaterialCost,
      totalEstimatedExpense,
      targetExpense,
      committedExpense: 0,
      actualReceivedExpense: 0,
      projectedGrossProfit,
      projectedMarginPercentage,
      budgetStatus,
      createdBy: req.user?.id || req.user?._id,
      createdByName: req.user?.name || req.user?.username || "Planner",
    });

    // Auto-update all linked Customer POs to 'MRP Done'
    const poIdsToUpdate = resolvedCustomerPOs
      .map((p) => p.customerPo)
      .filter((id) => id && mongoose.Types.ObjectId.isValid(id));

    if (poIdsToUpdate.length > 0) {
      try {
        await IncomingPO.updateMany(
          { company: companyId, _id: { $in: poIdsToUpdate } },
          {
            $set: {
              status: "MRP Done",
              mrpPlan: newPlan._id,
              mrpNumber: newPlan.mrpNumber,
            },
          }
        );
      } catch (poErr) {
        console.warn("Could not update IncomingPOs to MRP Done:", poErr);
      }
    } else if (customerPoNumber) {
      try {
        await IncomingPO.updateOne(
          { company: companyId, poNumber: customerPoNumber },
          {
            $set: {
              status: "MRP Done",
              mrpPlan: newPlan._id,
              mrpNumber: newPlan.mrpNumber,
            },
          }
        );
      } catch (poErr) {
        console.warn("Could not update IncomingPO by poNumber:", poErr);
      }
    }

    res.status(201).json({
      success: true,
      message: "MRP Plan created successfully with RM & BO calculation",
      mrpPlan: newPlan,
    });
  } catch (error) {
    console.error("Error creating MRP plan:", error);
    res.status(500).json({ message: error.message || "Failed to create MRP plan" });
  }
};

export const getAllMRPPlans = async (req, res) => {
  try {
    const MRPPlan = req.getModel("MRPPlan", mrpPlanSchema);
    const PurchaseOrder = req.getModel("PurchaseOrder", purchaseOrderSchema);
    req.getModel("User", userSchema);

    const companyId = getCompanyId(req);
    const { status, search } = req.query;

    const query = { company: companyId };
    if (status && status !== "All") {
      query.status = status;
    }
    if (search) {
      const s = search.trim();
      query.$or = [
        { mrpNumber: { $regex: s, $options: "i" } },
        { customerPoNumber: { $regex: s, $options: "i" } },
        { customerName: { $regex: s, $options: "i" } },
        { "customerPOs.customerPoNumber": { $regex: s, $options: "i" } },
        { "customerPOs.customerName": { $regex: s, $options: "i" } },
        { "fgItems.fgItemName": { $regex: s, $options: "i" } },
      ];
    }

    const mrpPlans = await MRPPlan.find(query)
      .populate("createdBy", "name username email")
      .populate("updatedBy", "name username email")
      .sort({ createdAt: -1 });

    const planIds = mrpPlans.map(p => p._id);
    const planNumbers = mrpPlans.map(p => p.mrpNumber).filter(Boolean);

    // Batch query linked POs for all plans
    const linkedPOs = await PurchaseOrder.find({
      company: companyId,
      $or: [
        { mrpPlanId: { $in: planIds } },
        { mrpNumber: { $in: planNumbers } }
      ]
    }).select("mrpPlanId mrpNumber poNumber status grandTotal totalAmount").lean().catch(() => []);

    const poPlanIdMap = new Map();
    const poPlanNumMap = new Map();
    const poCommittedAmountMap = new Map();

    (linkedPOs || []).forEach(po => {
      const amt = Number(po.grandTotal != null ? po.grandTotal : (po.totalAmount != null ? po.totalAmount : 0)) || 0;
      if (po.mrpPlanId) {
        const idStr = String(po.mrpPlanId);
        poPlanIdMap.set(idStr, (poPlanIdMap.get(idStr) || 0) + 1);
        poCommittedAmountMap.set(idStr, (poCommittedAmountMap.get(idStr) || 0) + amt);
      }
      if (po.mrpNumber) {
        poPlanNumMap.set(po.mrpNumber, (poPlanNumMap.get(po.mrpNumber) || 0) + 1);
        poCommittedAmountMap.set(po.mrpNumber, (poCommittedAmountMap.get(po.mrpNumber) || 0) + amt);
      }
    });

    // Resolve company time-lock policy for mrpPlan
    const StorePrefix = req.getModel("StorePrefix", storePrefixSchema);
    const prefixDoc = await StorePrefix.findOne();
    const policyHours = prefixDoc?.timeLockPolicies?.mrpPlan !== undefined && prefixDoc?.timeLockPolicies?.mrpPlan !== null
      ? Number(prefixDoc.timeLockPolicies.mrpPlan)
      : 24;

    const enrichedPlans = mrpPlans.map(p => {
      const planObj = p.toObject ? p.toObject() : p;
      const poCount = (poPlanIdMap.get(String(p._id)) || 0) + (poPlanNumMap.get(p.mrpNumber) || 0);
      const liveCommitted = Math.round(((poCommittedAmountMap.get(String(p._id)) || 0) + (poCommittedAmountMap.get(p.mrpNumber) || 0)) * 100) / 100;
      const targetExpense = Number(p.targetExpense || 0);
      const estimatedExp = Number(p.totalEstimatedExpense || 0);

      let dynamicBudgetStatus = p.budgetStatus || "Unset";
      if (targetExpense > 0) {
        const effectiveExpense = liveCommitted > 0 ? liveCommitted : estimatedExp;
        if (effectiveExpense > targetExpense) {
          dynamicBudgetStatus = "Over Budget";
        } else if (effectiveExpense >= targetExpense * 0.85) {
          dynamicBudgetStatus = "Near Limit";
        } else {
          dynamicBudgetStatus = "Within Budget";
        }
      }

      const hasActiveReqs = (p.rmRequirements || []).some(r => r.status === 'PO Raised' || (r.orderedQuantity && r.orderedQuantity > 0) || (r.receivedQuantity && r.receivedQuantity > 0)) ||
        (p.boRequirements || []).some(b => b.status === 'PO Raised' || (b.orderedQuantity && b.orderedQuantity > 0) || (b.receivedQuantity && b.receivedQuantity > 0)) ||
        (p.fgItems || []).some(f => (f.receivedQuantity && f.receivedQuantity > 0));
      const isProductionActive = p.status !== 'Planned' || p.ppcStatus === 'Sent';
      
      const hasTransactions = poCount > 0 || hasActiveReqs || isProductionActive;
      const createdAtMs = new Date(p.createdAt || Date.now()).getTime();

      let isExpired = false;
      if (policyHours === -1) {
        isExpired = false;
      } else if (policyHours <= 0) {
        isExpired = true;
      } else {
        isExpired = (Date.now() - createdAtMs) > (policyHours * 60 * 60 * 1000);
      }

      return {
        ...planObj,
        committedExpense: liveCommitted,
        budgetStatus: dynamicBudgetStatus,
        linkedPOCount: poCount,
        hasTransactions,
        policyHours,
        is24hExpired: isExpired,
        isTimeLockExpired: isExpired,
        canEdit: !isExpired && !hasTransactions,
        canDelete: !isExpired && !hasTransactions,
        createdByName: p.createdByName || p.createdBy?.name || p.createdBy?.username || p.createdBy?.email || "Planner",
        updatedByName: p.updatedByName || p.updatedBy?.name || p.updatedBy?.username || p.updatedBy?.email || ""
      };
    });

    res.status(200).json({
      success: true,
      count: enrichedPlans.length,
      mrpPlans: enrichedPlans,
    });
  } catch (error) {
    console.error("Error fetching MRP plans:", error);
    res.status(500).json({ message: error.message || "Failed to fetch MRP plans" });
  }
};

export const getMRPPlanById = async (req, res) => {
  try {
    const MRPPlan = req.getModel("MRPPlan", mrpPlanSchema);
    const PurchaseOrder = req.getModel("PurchaseOrder", purchaseOrderSchema);
    req.getModel("User", userSchema);

    const companyId = getCompanyId(req);
    const { id } = req.params;

    const mrpPlan = await MRPPlan.findOne({ _id: id, company: companyId })
      .populate("createdBy", "name username email")
      .populate("updatedBy", "name username email")
      .populate("editHistory.updatedBy", "name username email")
      .populate("fgItems.fgItem")
      .populate("rmRequirements.material")
      .populate("boRequirements.material");

    if (!mrpPlan) {
      return res.status(404).json({ message: "MRP Plan not found" });
    }

    const linkedPOs = await PurchaseOrder.find({
      company: companyId,
      $or: [{ mrpPlanId: id }, { mrpNumber: mrpPlan.mrpNumber }]
    }).select("grandTotal totalAmount").lean().catch(() => []);

    const linkedPOCount = linkedPOs.length;
    const committedExpense = Math.round(
      linkedPOs.reduce((sum, po) => {
        const amt = Number(po.grandTotal != null ? po.grandTotal : (po.totalAmount != null ? po.totalAmount : 0)) || 0;
        return sum + amt;
      }, 0) * 100
    ) / 100;

    const targetExpense = Number(mrpPlan.targetExpense || 0);
    const estimatedExp = Number(mrpPlan.totalEstimatedExpense || 0);

    let dynamicBudgetStatus = mrpPlan.budgetStatus || "Unset";
    if (targetExpense > 0) {
      const effectiveExpense = committedExpense > 0 ? committedExpense : estimatedExp;
      if (effectiveExpense > targetExpense) {
        dynamicBudgetStatus = "Over Budget";
      } else if (effectiveExpense >= targetExpense * 0.85) {
        dynamicBudgetStatus = "Near Limit";
      } else {
        dynamicBudgetStatus = "Within Budget";
      }
    }

    const hasActiveReqs = (mrpPlan.rmRequirements || []).some(r => r.status === 'PO Raised' || (r.orderedQuantity && r.orderedQuantity > 0) || (r.receivedQuantity && r.receivedQuantity > 0)) ||
      (mrpPlan.boRequirements || []).some(b => b.status === 'PO Raised' || (b.orderedQuantity && b.orderedQuantity > 0) || (b.receivedQuantity && b.receivedQuantity > 0)) ||
      (mrpPlan.fgItems || []).some(f => (f.receivedQuantity && f.receivedQuantity > 0));
    const isProductionActive = mrpPlan.status !== 'Planned' || mrpPlan.ppcStatus === 'Sent';

    const hasTransactions = linkedPOCount > 0 || hasActiveReqs || isProductionActive;
    const createdAtMs = new Date(mrpPlan.createdAt || Date.now()).getTime();

    // Resolve company time-lock policy for mrpPlan
    const StorePrefix = req.getModel("StorePrefix", storePrefixSchema);
    const prefixDoc = await StorePrefix.findOne();
    const policyHours = prefixDoc?.timeLockPolicies?.mrpPlan !== undefined && prefixDoc?.timeLockPolicies?.mrpPlan !== null
      ? Number(prefixDoc.timeLockPolicies.mrpPlan)
      : 24;

    let isExpired = false;
    if (policyHours === -1) {
      isExpired = false;
    } else if (policyHours <= 0) {
      isExpired = true;
    } else {
      isExpired = (Date.now() - createdAtMs) > (policyHours * 60 * 60 * 1000);
    }

    const planObj = mrpPlan.toObject ? mrpPlan.toObject() : mrpPlan;

    res.status(200).json({
      success: true,
      mrpPlan: {
        ...planObj,
        committedExpense,
        budgetStatus: dynamicBudgetStatus,
        linkedPOCount,
        hasTransactions,
        policyHours,
        is24hExpired: isExpired,
        isTimeLockExpired: isExpired,
        canEdit: !isExpired && !hasTransactions,
        canDelete: !isExpired && !hasTransactions,
        createdByName: mrpPlan.createdByName || mrpPlan.createdBy?.name || mrpPlan.createdBy?.username || mrpPlan.createdBy?.email || "Planner",
        updatedByName: mrpPlan.updatedByName || mrpPlan.updatedBy?.name || mrpPlan.updatedBy?.username || mrpPlan.updatedBy?.email || ""
      },
    });
  } catch (error) {
    console.error("Error fetching MRP plan:", error);
    res.status(500).json({ message: error.message || "Failed to fetch MRP plan" });
  }
};

export const deleteMRPPlan = async (req, res) => {
  try {
    const MRPPlan = req.getModel("MRPPlan", mrpPlanSchema);
    const PurchaseOrder = req.getModel("PurchaseOrder", purchaseOrderSchema);
    const companyId = getCompanyId(req);
    const { id } = req.params;

    const plan = await MRPPlan.findOne({ _id: id, company: companyId });
    if (!plan) {
      return res.status(404).json({ message: "MRP Plan not found" });
    }

    // 1. Check Dynamic Time Lock Policy (Master > Store Settings)
    const lockCheck = await checkTimeLockGovernance(req, 'mrpPlan', plan.createdAt, 'delete');
    if (!lockCheck.allowed) {
      return res.status(403).json({
        success: false,
        message: lockCheck.message
      });
    }

    // 2. Check for linked transactions
    const linkedPOCount = await PurchaseOrder.countDocuments({
      company: companyId,
      $or: [{ mrpPlanId: id }, { mrpNumber: plan.mrpNumber }]
    }).catch(() => 0);

    const hasActiveRequirements = 
      (plan.rmRequirements || []).some(r => r.status === 'PO Raised' || (r.orderedQuantity && r.orderedQuantity > 0) || (r.receivedQuantity && r.receivedQuantity > 0)) ||
      (plan.boRequirements || []).some(b => b.status === 'PO Raised' || (b.orderedQuantity && b.orderedQuantity > 0) || (b.receivedQuantity && b.receivedQuantity > 0)) ||
      (plan.fgItems || []).some(f => (f.receivedQuantity && f.receivedQuantity > 0));

    const isProductionStarted = plan.status !== 'Planned' || plan.ppcStatus === 'Sent';

    if (linkedPOCount > 0 || hasActiveRequirements || isProductionStarted) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete MRP Plan ${plan.mrpNumber}: Active transactions (${linkedPOCount > 0 ? `${linkedPOCount} Purchase Order(s)` : 'downstream procurement or production operations'}) are linked to this plan.`
      });
    }

    // 3. Unlock all linked IncomingPOs if any
    const poIdsToUnlock = [];
    if (plan.customerPo) {
      poIdsToUnlock.push(plan.customerPo);
    }
    if (Array.isArray(plan.customerPOs)) {
      plan.customerPOs.forEach((p) => {
        if (p.customerPo) poIdsToUnlock.push(p.customerPo);
      });
    }

    if (poIdsToUnlock.length > 0) {
      try {
        const IncomingPO = req.getModel("IncomingPO", incomingPOSchema);
        await IncomingPO.updateMany(
          { _id: { $in: poIdsToUnlock } },
          { $set: { status: "Accepted", mrpPlan: null, mrpNumber: null } }
        );
      } catch (poErr) {
        console.warn("Could not unlock linked IncomingPOs:", poErr);
      }
    }

    await MRPPlan.deleteOne({ _id: id });

    res.status(200).json({
      success: true,
      message: `MRP Plan ${plan.mrpNumber} deleted successfully`,
    });
  } catch (error) {
    console.error("Error deleting MRP plan:", error);
    res.status(500).json({ message: error.message || "Failed to delete MRP plan" });
  }
};

export const updateMRPPlan = async (req, res) => {
  try {
    const MRPPlan = req.getModel("MRPPlan", mrpPlanSchema);
    const PurchaseOrder = req.getModel("PurchaseOrder", purchaseOrderSchema);
    const companyId = getCompanyId(req);
    const { id } = req.params;
    const userName = req.user?.name || req.user?.username || req.user?.email || 'Planner';

    const plan = await MRPPlan.findOne({ _id: id, company: companyId });
    if (!plan) {
      return res.status(404).json({ message: "MRP Plan not found" });
    }

    // 1. Check Dynamic Time Lock Policy (Master > Store Settings)
    const lockCheck = await checkTimeLockGovernance(req, 'mrpPlan', plan.createdAt, 'edit');
    if (!lockCheck.allowed) {
      return res.status(403).json({
        success: false,
        message: lockCheck.message
      });
    }

    // 2. Check for linked transactions
    const linkedPOCount = await PurchaseOrder.countDocuments({
      company: companyId,
      $or: [{ mrpPlanId: id }, { mrpNumber: plan.mrpNumber }]
    }).catch(() => 0);

    const hasActiveRequirements = 
      (plan.rmRequirements || []).some(r => r.status === 'PO Raised' || (r.orderedQuantity && r.orderedQuantity > 0) || (r.receivedQuantity && r.receivedQuantity > 0)) ||
      (plan.boRequirements || []).some(b => b.status === 'PO Raised' || (b.orderedQuantity && b.orderedQuantity > 0) || (b.receivedQuantity && b.receivedQuantity > 0)) ||
      (plan.fgItems || []).some(f => (f.receivedQuantity && f.receivedQuantity > 0));

    const isProductionStarted = plan.status !== 'Planned' || plan.ppcStatus === 'Sent';

    if (linkedPOCount > 0 || hasActiveRequirements || isProductionStarted) {
      return res.status(400).json({
        success: false,
        message: `Cannot edit MRP Plan ${plan.mrpNumber}: Active transactions (${linkedPOCount > 0 ? `${linkedPOCount} Purchase Order(s)` : 'downstream procurement or production operations'}) have already been initiated.`
      });
    }

    const { customerName, customerPoNumber, poDate, targetDate, remarks, fgItems } = req.body;

    if (customerName !== undefined) plan.customerName = customerName;
    if (customerPoNumber !== undefined) plan.customerPoNumber = customerPoNumber;
    if (poDate !== undefined) plan.poDate = poDate ? new Date(poDate) : plan.poDate;
    if (targetDate !== undefined) plan.targetDate = targetDate ? new Date(targetDate) : plan.targetDate;
    if (remarks !== undefined) plan.remarks = remarks;

    // Recalculate BOM requirements if fgItems were provided and modified
    if (Array.isArray(fgItems) && fgItems.length > 0) {
      const RmBoItem = req.getModel("RmBoItem", rmBoItemSchema);
      const BOM = req.getModel("BOM", bomSchema);
      const FGItem = req.getModel("FGItem", fgItemSchema);

      const allRmBoItems = await RmBoItem.find({ company: companyId }).populate("categoryId");
      const allBOMs = await BOM.find({ company: companyId });
      const allFGItems = await FGItem.find({ company: companyId });

      const findBOM = (pName, pCode, bId, fgId) => {
        if (bId) {
          const found = allBOMs.find((b) => b._id && b._id.toString() === bId.toString());
          if (found && Array.isArray(found.items) && found.items.length > 0) return found;
          const foundByNum = allBOMs.find((b) => b.bomNumber && b.bomNumber.toString().toLowerCase() === bId.toString().toLowerCase());
          if (foundByNum && Array.isArray(foundByNum.items) && foundByNum.items.length > 0) return foundByNum;
        }
        if (fgId) {
          const foundFG = allFGItems.find((f) => f._id && f._id.toString() === fgId.toString());
          if (foundFG && Array.isArray(foundFG.bom) && foundFG.bom.length > 0) {
            return {
              _id: foundFG._id,
              bomNumber: `BOM-${foundFG.code || foundFG.name}`,
              productName: foundFG.name,
              productCode: foundFG.code,
              items: foundFG.bom.map((b) => ({
                materialName: b.itemName || b.name || "Material",
                materialCode: b.itemCode || b.code || "",
                quantity: Number(b.quantity) || 1,
                unit: b.unit || "PCS",
                itemType: b.itemType || "Material",
              })),
            };
          }
        }
        if (pName) {
          const cleanPName = pName.trim().toLowerCase();
          const found = allBOMs.find((b) => b.productName && b.productName.trim().toLowerCase() === cleanPName);
          if (found && Array.isArray(found.items) && found.items.length > 0) return found;
          const foundFG = allFGItems.find((f) => f.name && f.name.trim().toLowerCase() === cleanPName);
          if (foundFG && Array.isArray(foundFG.bom) && foundFG.bom.length > 0) {
            return {
              _id: foundFG._id,
              bomNumber: `BOM-${foundFG.code || foundFG.name}`,
              productName: foundFG.name,
              productCode: foundFG.code,
              items: foundFG.bom.map((b) => ({
                materialName: b.itemName || b.name || "Material",
                materialCode: b.itemCode || b.code || "",
                quantity: Number(b.quantity) || 1,
                unit: b.unit || "PCS",
                itemType: b.itemType || "Material",
              })),
            };
          }
        }
        return null;
      };

      const enrichedFgItems = [];
      const rmMap = new Map();
      const boMap = new Map();
      const subAssemblyMap = new Map();
      const consumableMap = new Map();

      for (const fg of fgItems) {
        const targetBOM = findBOM(fg.fgItemName, fg.fgItemCode, fg.bomId || fg.bomNumber, fg.fgItem || fg._id);
        const bomNum = targetBOM ? (targetBOM.bomNumber || `BOM-${targetBOM.productName}`) : "BOM-Active";
        const bomId = targetBOM ? targetBOM._id : undefined;

        enrichedFgItems.push({
          fgItem: fg.fgItem && mongoose.Types.ObjectId.isValid(fg.fgItem) ? fg.fgItem : undefined,
          fgItemName: fg.fgItemName || "Unnamed FG",
          fgItemCode: fg.fgItemCode || "",
          description: fg.description || "",
          quantity: Number(fg.quantity) || 1,
          receivedQuantity: 0,
          unit: fg.unit || "PCS",
          bomId,
          bomNumber: bomNum,
          poDeliveryDate: fg.poDeliveryDate ? new Date(fg.poDeliveryDate) : undefined,
          targetDate: fg.targetDate ? new Date(fg.targetDate) : undefined,
        });

        if (targetBOM && Array.isArray(targetBOM.items)) {
          for (const item of targetBOM.items) {
            const bomItemQty = Number(item.quantity) || 1;
            const totalRequired = bomItemQty * (Number(fg.quantity) || 1);
            const rawName = (item.materialName || item.componentName || item.itemName || "Unnamed Material").trim();
            const rawType = (item.itemType || item.category || "").toLowerCase();

            let matchedRmBo = allRmBoItems.find((r) => r.name && r.name.trim().toLowerCase() === rawName.toLowerCase());
            const matchedFG = allFGItems.find((f) => 
              (f.name && f.name.trim().toLowerCase() === rawName.toLowerCase()) ||
              (item.materialCode && f.code && f.code.trim().toLowerCase() === item.materialCode.trim().toLowerCase())
            );

            let itemCategory = "Raw Material";
            if (matchedFG) {
              if (matchedFG.type === "Sub Assembly") itemCategory = "Sub Assembly";
              else if (matchedFG.type === "Component") itemCategory = "Component";
              else if (matchedFG.type === "Assembly") itemCategory = "Assembly";
            } else if (matchedRmBo) {
              const catName = matchedRmBo.categoryId?.name?.toLowerCase() || "";
              if (catName.includes("bought") || catName.includes("bo")) itemCategory = "Bought Out";
              else if (catName.includes("consumable")) itemCategory = "Consumable";
              else if (catName.includes("sub") || catName.includes("assembly")) itemCategory = "Sub Assembly";
            } else {
              if (rawType.includes("bought") || rawType.includes("bo")) itemCategory = "Bought Out";
              else if (rawType.includes("consumable")) itemCategory = "Consumable";
              else if (rawType.includes("sub") || rawType.includes("assembly")) itemCategory = "Sub Assembly";
            }

            const targetMap = itemCategory === "Bought Out" ? boMap : itemCategory === "Consumable" ? consumableMap : itemCategory === "Sub Assembly" ? subAssemblyMap : rmMap;
            const itemDesc = item.description || (matchedRmBo ? (matchedRmBo.description || matchedRmBo.descriptions) : "") || "";
            const current = targetMap.get(rawName) || {
              material: matchedRmBo ? matchedRmBo._id : undefined,
              materialName: rawName,
              materialCode: matchedRmBo ? matchedRmBo.code : item.materialCode || "",
              description: itemDesc,
              category: itemCategory,
              itemType: itemCategory === "Raw Material" ? "RM" : itemCategory === "Bought Out" ? "BO" : itemCategory,
              requiredQuantity: 0,
              currentStock: matchedRmBo ? (matchedRmBo.closingStock || matchedRmBo.currentStock || 0) : 0,
              unit: item.unit || (matchedRmBo ? matchedRmBo.unit : "PCS"),
              sourceFGNames: [],
            };
            if (!current.description && itemDesc) current.description = itemDesc;
            current.requiredQuantity += totalRequired;
            if (!current.sourceFGNames.includes(fg.fgItemName)) current.sourceFGNames.push(fg.fgItemName);
            targetMap.set(rawName, current);
          }
        }
      }

      const buildReqArray = (map) => {
        return Array.from(map.values()).map((val) => {
          const shortage = Math.max(0, val.requiredQuantity - (val.currentStock || 0));
          return {
            material: val.material,
            materialName: val.materialName,
            materialCode: val.materialCode || "",
            description: val.description || "",
            category: val.category,
            itemType: val.itemType,
            requiredQuantity: val.requiredQuantity,
            currentStock: val.currentStock || 0,
            shortage,
            unit: val.unit || "PCS",
            sourceFGName: val.sourceFGNames.join(", "),
            sourceFGNames: val.sourceFGNames,
            status: "Pending",
          };
        });
      };

      plan.fgItems = enrichedFgItems;
      plan.rmRequirements = buildReqArray(rmMap);
      plan.boRequirements = buildReqArray(boMap);
      plan.subAssemblyRequirements = buildReqArray(subAssemblyMap);
      plan.consumableRequirements = buildReqArray(consumableMap);

      // Financial Recalculation on FG items modification
      const VendorPriceList = req.getModel("VendorPriceList", vendorPriceListSchema);
      req.getModel("Vendor", vendorSchema);
      const allPriceLists = await VendorPriceList.find({ company: companyId }).populate("vendor", "name code").lean().catch(() => []);
      const allInventories = await req.getModel("Inventory", inventorySchema).find({ company: companyId });

      const cleanStr = (s) => (s || "").trim().toLowerCase();
      const cleanKey = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

      const vendorPriceMap = new Map();
      (allPriceLists || []).forEach((vpl) => {
        const vendorId = vpl.vendor?._id || vpl.vendor;
        const vendorName = vpl.vendor?.name || vpl.vendorName || "Vendor";
        const rawMatId = (vpl.material?._id || vpl.material)?.toString();

        const addPriceEntry = (keys, rate, isPref) => {
          const entry = { vendorId, vendorName, rate: Number(rate) || 0, isPreferred: Boolean(isPref) };
          keys.filter(Boolean).forEach((k) => {
            if (!vendorPriceMap.has(k)) vendorPriceMap.set(k, []);
            vendorPriceMap.get(k).push(entry);
          });
        };

        if (vpl.material || rawMatId) {
          const mat = vpl.material;
          const matName = typeof mat === 'object' ? (mat.name || mat.materialName || "") : "";
          const matCode = typeof mat === 'object' ? (mat.code || mat.materialCode || "") : "";
          const keys = [rawMatId, cleanStr(matName), cleanStr(matCode), cleanKey(matName), cleanKey(matCode)];
          addPriceEntry(keys, vpl.price, vpl.isPreferred);
        }

        if (Array.isArray(vpl.items)) {
          vpl.items.forEach((vItem) => {
            const vName = cleanStr(vItem.materialName || vItem.itemName);
            const vCode = cleanStr(vItem.materialCode || vItem.itemCode);
            const keys = [vName, vCode, cleanKey(vName), cleanKey(vCode)];
            addPriceEntry(keys, vItem.rate || vItem.unitPrice || 0, vItem.isPreferred || vpl.isPreferred);
          });
        }
      });

      const resolveMaterialPrice = (name, code, matId, rmBoObj) => {
        const keys = [matId ? String(matId) : null, cleanStr(code), cleanStr(name), cleanKey(code), cleanKey(name)].filter(Boolean);
        let quotes = [];
        for (const k of keys) {
          if (vendorPriceMap.has(k)) {
            quotes = vendorPriceMap.get(k);
            break;
          }
        }
        if (quotes.length > 0) {
          const preferred = quotes.find((q) => q.isPreferred);
          const chosen = preferred || quotes.slice().sort((a, b) => a.rate - b.rate)[0];
          if (chosen && chosen.rate > 0) {
            return {
              unitCost: chosen.rate,
              costSource: "Vendor Price List",
              preferredVendor: chosen.vendorId,
              preferredVendorName: chosen.vendorName
            };
          }
        }
        const inv = allInventories.find(
          (i) => (code && i.materialCode && i.materialCode.toLowerCase() === code.toLowerCase()) ||
                 (name && i.materialName && i.materialName.toLowerCase() === name.toLowerCase())
        );
        const invRate = Number(inv?.unitPrice || 0);
        const baseRate = Number(rmBoObj?.baseRate || 0);
        const fallbackRate = invRate > 0 ? invRate : baseRate;
        return {
          unitCost: fallbackRate,
          costSource: fallbackRate > 0 ? "Inventory Valuation" : "Estimated Rate",
          preferredVendor: undefined,
          preferredVendorName: ""
        };
      };

      const populateReqPricing = (reqList) => {
        reqList.forEach((r) => {
          const rmBoObj = allRmBoItems.find((item) =>
            (item._id && r.material && String(item._id) === String(r.material)) ||
            (r.materialCode && item.code && item.code.toLowerCase() === r.materialCode.toLowerCase()) ||
            (r.materialName && item.name && item.name.toLowerCase() === r.materialName.toLowerCase())
          );
          const pricing = resolveMaterialPrice(r.materialName, r.materialCode, r.material, rmBoObj);
          r.unitCost = pricing.unitCost;
          r.costSource = pricing.costSource;
          if (pricing.preferredVendor) r.preferredVendor = pricing.preferredVendor;
          if (pricing.preferredVendorName) r.preferredVendorName = pricing.preferredVendorName;

          r.grossCost = Math.round(Number(r.requiredQuantity || 0) * r.unitCost * 100) / 100;
          r.shortageCost = Math.round(Number(r.shortage || 0) * r.unitCost * 100) / 100;
        });
      };

      populateReqPricing(plan.rmRequirements);
      populateReqPricing(plan.boRequirements);
      populateReqPricing(plan.consumableRequirements);

      let totalIncome = 0;
      (plan.fgItems || []).forEach((fg) => {
        if (!fg.sellingPrice) {
          const matchedMaster = allFGItems.find((f) =>
            (fg.fgItem && String(f._id) === String(fg.fgItem)) ||
            (fg.fgItemName && f.name && f.name.trim().toLowerCase() === fg.fgItemName.trim().toLowerCase())
          );
          fg.sellingPrice = Number(matchedMaster?.sellingPrice || 0);
        }
        fg.totalPrice = Math.round(Number(fg.quantity || 0) * Number(fg.sellingPrice || 0) * 100) / 100;
        totalIncome += fg.totalPrice;
      });

      let totalGrossMaterialCost = 0;
      let totalEstimatedExpense = 0;

      [...(plan.rmRequirements || []), ...(plan.boRequirements || []), ...(plan.consumableRequirements || [])].forEach((r) => {
        totalGrossMaterialCost += Number(r.grossCost || 0);
        totalEstimatedExpense += Number(r.shortageCost || 0);
      });

      plan.totalIncome = Math.round(totalIncome * 100) / 100;
      plan.totalGrossMaterialCost = Math.round(totalGrossMaterialCost * 100) / 100;
      plan.totalEstimatedExpense = Math.round(totalEstimatedExpense * 100) / 100;
      plan.projectedGrossProfit = Math.round((plan.totalIncome - plan.totalGrossMaterialCost) * 100) / 100;
      plan.projectedMarginPercentage = plan.totalIncome > 0
        ? Math.round(((plan.totalIncome - plan.totalGrossMaterialCost) / plan.totalIncome) * 10000) / 100
        : 0;
    }

    if (req.body.targetExpense !== undefined) {
      plan.targetExpense = Math.max(0, Number(req.body.targetExpense));
    }

    if (plan.targetExpense > 0) {
      const effectiveSpent = (plan.committedExpense || 0) > 0 ? plan.committedExpense : (plan.totalEstimatedExpense || 0);
      if (effectiveSpent > plan.targetExpense) {
        plan.budgetStatus = "Over Budget";
      } else if (effectiveSpent >= plan.targetExpense * 0.85) {
        plan.budgetStatus = "Near Limit";
      } else {
        plan.budgetStatus = "Within Budget";
      }
    } else {
      plan.budgetStatus = "Unset";
    }

    plan.updatedBy = req.user?.id || req.user?._id;
    plan.updatedByName = userName;
    plan.updatedAt = new Date();
    if (!Array.isArray(plan.editHistory)) plan.editHistory = [];
    plan.editHistory.push({
      updatedBy: req.user?.id || req.user?._id,
      updatedByName: userName,
      updatedAt: new Date(),
      action: "Edited MRP Demand Plan",
      remarks: remarks || "Updated Finished Goods / Plan Parameters"
    });

    await plan.save();

    res.status(200).json({
      success: true,
      message: `MRP Plan ${plan.mrpNumber} updated successfully`,
      mrpPlan: plan
    });
  } catch (error) {
    console.error("Error updating MRP plan:", error);
    res.status(500).json({ message: error.message || "Failed to update MRP plan" });
  }
};

export const updateMRPTargetExpense = async (req, res) => {
  try {
    const MRPPlan = req.getModel("MRPPlan", mrpPlanSchema);
    const PurchaseOrder = req.getModel("PurchaseOrder", purchaseOrderSchema);
    const companyId = getCompanyId(req);
    const { id } = req.params;
    const { targetExpense, remarks } = req.body;

    const plan = await MRPPlan.findOne({ _id: id, company: companyId });
    if (!plan) {
      return res.status(404).json({ message: "MRP Plan not found" });
    }

    const newTarget = Math.max(0, Number(targetExpense) || 0);
    plan.targetExpense = newTarget;

    // Calculate live committed expense from linked POs
    const linkedPOs = await PurchaseOrder.find({
      company: companyId,
      $or: [{ mrpPlanId: id }, { mrpNumber: plan.mrpNumber }]
    }).select("grandTotal totalAmount").lean().catch(() => []);

    const committedExpense = Math.round(
      linkedPOs.reduce((sum, po) => {
        const amt = Number(po.grandTotal != null ? po.grandTotal : (po.totalAmount != null ? po.totalAmount : 0)) || 0;
        return sum + amt;
      }, 0) * 100
    ) / 100;

    plan.committedExpense = committedExpense;

    if (newTarget > 0) {
      const effectiveExpense = committedExpense > 0 ? committedExpense : Number(plan.totalEstimatedExpense || 0);
      if (effectiveExpense > newTarget) {
        plan.budgetStatus = "Over Budget";
      } else if (effectiveExpense >= newTarget * 0.85) {
        plan.budgetStatus = "Near Limit";
      } else {
        plan.budgetStatus = "Within Budget";
      }
    } else {
      plan.budgetStatus = "Unset";
    }

    plan.updatedBy = req.user?.id || req.user?._id;
    plan.updatedByName = req.user?.name || req.user?.username || "Planner";
    if (!Array.isArray(plan.editHistory)) plan.editHistory = [];
    plan.editHistory.push({
      updatedBy: req.user?.id || req.user?._id,
      updatedByName: plan.updatedByName,
      updatedAt: new Date(),
      action: "Updated Target Budget",
      remarks: remarks || `Target expense set to ₹${newTarget.toLocaleString('en-IN')}`
    });

    await plan.save();

    res.status(200).json({
      success: true,
      message: `Target expense updated to ₹${newTarget.toLocaleString('en-IN')}`,
      mrpPlan: plan
    });
  } catch (error) {
    console.error("Error updating MRP target expense:", error);
    res.status(500).json({ message: error.message || "Failed to update target expense" });
  }
};

export const updateMRPPlanStatus = async (req, res) => {
  try {
    const MRPPlan = req.getModel("MRPPlan", mrpPlanSchema);
    const companyId = getCompanyId(req);
    const { id } = req.params;
    const { status } = req.body;

    const updated = await MRPPlan.findOneAndUpdate(
      { _id: id, company: companyId },
      { status },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "MRP Plan not found" });
    }

    res.status(200).json({
      success: true,
      message: `MRP Plan status updated to ${status}`,
      mrpPlan: updated,
    });
  } catch (error) {
    console.error("Error updating MRP plan status:", error);
    res.status(500).json({ message: error.message || "Failed to update MRP plan status" });
  }
};

export const updateMRPRequirementItemStatus = async (req, res) => {
  try {
    const MRPPlan = req.getModel("MRPPlan", mrpPlanSchema);
    const companyId = getCompanyId(req);
    const { items = [], status = "RFQ Raised", planId, poNumber, rfqNumber } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Items list is required" });
    }

    const clean = (s) => (s || "").toString().trim().toLowerCase();
    const updatedPlanIds = new Set();

    // Expand items: unpack sourceCutSizes from bucket items so underlying cut sizes get updated
    const expandedItems = [];
    for (const it of items) {
      expandedItems.push(it);
      if (Array.isArray(it.sourceCutSizes) && it.sourceCutSizes.length > 0) {
        const csStatus = it.status || status;
        it.sourceCutSizes.forEach(cs => {
          const csMrp = (Array.isArray(cs.mrpSources) && cs.mrpSources[0]) || {};
          expandedItems.push({
            planId: cs.planId || csMrp.mrpId || csMrp.mrpPlanId || it.planId,
            mrpNumber: cs.mrpNumber || csMrp.mrpNumber || it.mrpNumber || it.sourceMRP,
            materialId: cs.sourceItemId || cs.materialId,
            materialName: cs.sourceItemName || cs.materialName,
            materialCode: cs.sourceItemCode || cs.materialCode,
            status: csStatus,
            poNumber: cs.poNumber || it.poNumber || poNumber,
            rfqNumber: cs.rfqNumber || it.rfqNumber || rfqNumber
          });
        });
      }
    }

    for (const it of expandedItems) {
      const targetPlanId = it.planId || planId;
      const targetMrpNo = it.mrpNumber || it.sourceMRP;
      const targetMatId = it.materialId || it.material;
      const targetMatName = clean(it.materialName);
      const targetMatCode = clean(it.materialCode);
      const newStatus = it.status || status;
      const curPoNumber = it.poNumber || poNumber || "";
      const curRfqNumber = it.rfqNumber || rfqNumber || "";

      if (!targetPlanId && !targetMrpNo) {
        // Strict MRP isolation: never update all company plans without an explicit MRP plan identifier.
        // Unscoped updates contaminate other MRP plans with foreign PO/RFQ numbers.
        continue;
      }

      const planQuery = { company: companyId };
      if (targetPlanId) {
        planQuery._id = targetPlanId;
      } else if (targetMrpNo) {
        planQuery.mrpNumber = targetMrpNo;
      }

      const matchingPlans = await MRPPlan.find(planQuery);

      for (const plan of matchingPlans) {
        let changed = false;

        // Check rmRequirements
        if (Array.isArray(plan.rmRequirements)) {
          plan.rmRequirements.forEach((r) => {
            const mId = r.material?._id || r.material;
            const matches =
              (targetMatId && mId && mId.toString() === targetMatId.toString()) ||
              (targetMatCode && r.materialCode && clean(r.materialCode) === targetMatCode) ||
              (targetMatName && r.materialName && clean(r.materialName) === targetMatName);
            if (matches) {
              r.status = newStatus;
              if (curPoNumber) r.poNumber = curPoNumber;
              if (curRfqNumber) r.rfqNumber = curRfqNumber;
              changed = true;
            }
          });
        }

        // Check boRequirements
        if (Array.isArray(plan.boRequirements)) {
          plan.boRequirements.forEach((b) => {
            const mId = b.material?._id || b.material;
            const matches =
              (targetMatId && mId && mId.toString() === targetMatId.toString()) ||
              (targetMatCode && b.materialCode && clean(b.materialCode) === targetMatCode) ||
              (targetMatName && b.materialName && clean(b.materialName) === targetMatName);
            if (matches) {
              b.status = newStatus;
              if (curPoNumber) b.poNumber = curPoNumber;
              if (curRfqNumber) b.rfqNumber = curRfqNumber;
              changed = true;
            }
          });
        }

        // Check consumableRequirements
        if (Array.isArray(plan.consumableRequirements)) {
          plan.consumableRequirements.forEach((c) => {
            const matches =
              (targetMatCode && c.materialCode && clean(c.materialCode) === targetMatCode) ||
              (targetMatName && c.materialName && clean(c.materialName) === targetMatName);
            if (matches) {
              c.status = newStatus;
              if (curPoNumber) c.poNumber = curPoNumber;
              if (curRfqNumber) c.rfqNumber = curRfqNumber;
              changed = true;
            }
          });
        }

        // Check nestedMaterials in fgItems
        if (Array.isArray(plan.fgItems)) {
          plan.fgItems.forEach((fg) => {
            if (Array.isArray(fg.nestedMaterials)) {
              fg.nestedMaterials.forEach((n) => {
                const matches =
                  (targetMatCode && n.materialCode && clean(n.materialCode) === targetMatCode) ||
                  (targetMatName && n.materialName && clean(n.materialName) === targetMatName);
                if (matches) {
                  n.status = newStatus;
                  if (curPoNumber) n.poNumber = curPoNumber;
                  if (curRfqNumber) n.rfqNumber = curRfqNumber;
                  changed = true;
                }
              });
            }
          });
        }

        if (changed) {
          if (plan.status === "Planned" || plan.status === "Draft") {
            plan.status = "In Procurement";
          }
          await plan.save();
          updatedPlanIds.add(plan._id.toString());
        }
      }
    }

    res.status(200).json({
      success: true,
      message: `Updated procurement status to '${status}' across ${updatedPlanIds.size} MRP plan(s)`,
      updatedPlansCount: updatedPlanIds.size,
    });
  } catch (error) {
    console.error("Error updating MRP requirement item status:", error);
    res.status(500).json({ message: error.message || "Failed to update item status" });
  }
};

/**
 * Preview MRP BOM Budget:
 * Calculates total RM and BO costs for given Finished Goods items based on Vendor Price List & valuations
 */
export const previewMRPBOMBudget = async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const { fgItems } = req.body;

    if (!Array.isArray(fgItems) || fgItems.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          totalRmCost: 0,
          totalBoCost: 0,
          totalBOMCost: 0,
          rmCount: 0,
          boCount: 0,
          rmItems: [],
          boItems: []
        }
      });
    }

    // Load models
    const Inventory = req.getModel("Inventory", inventorySchema);
    const RmBoItem = req.getModel("RmBoItem", rmBoItemSchema);
    const RawMaterial = req.getModel("RawMaterial", rawMaterialSchema);
    const BoughtOut = req.getModel("BoughtOut", boughtOutSchema);
    const BOM = req.getModel("BOM", bomSchema);
    const FGItem = req.getModel("FGItem", fgItemSchema);
    const VendorPriceList = req.getModel("VendorPriceList", vendorPriceListSchema);

    // Parallel fetch cached collections for company
    const [
      allInventories,
      allRmBoItems,
      allRawMaterials,
      allBoughtOuts,
      allBOMs,
      allFGItems,
      allPriceLists
    ] = await Promise.all([
      Inventory.find({ company: companyId }),
      RmBoItem.find({ company: companyId }).populate("categoryId"),
      RawMaterial.find({ company: companyId }).populate("categoryId"),
      BoughtOut.find({ company: companyId }).populate("categoryId"),
      BOM.find({ company: companyId }),
      FGItem.find({ company: companyId }),
      VendorPriceList.find({ company: companyId }).populate("vendor", "name code").lean().catch(() => [])
    ]);

    const cleanStr = (s) => (s || "").trim().toLowerCase();
    const cleanKey = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

    // Fast Vendor Price List lookup map
    const vendorPriceMap = new Map();
    (allPriceLists || []).forEach((vpl) => {
      const vendorId = vpl.vendor?._id || vpl.vendor;
      const vendorName = vpl.vendor?.name || vpl.vendorName || "Vendor";
      const rawMatId = (vpl.material?._id || vpl.material)?.toString();

      const addPriceEntry = (keys, rate, isPref) => {
        const entry = {
          vendorId,
          vendorName,
          rate: Number(rate) || 0,
          isPreferred: Boolean(isPref)
        };
        keys.filter(Boolean).forEach((k) => {
          if (!vendorPriceMap.has(k)) vendorPriceMap.set(k, []);
          vendorPriceMap.get(k).push(entry);
        });
      };

      if (vpl.material || rawMatId) {
        const mat = vpl.material;
        const matName = typeof mat === 'object' ? (mat.name || mat.materialName || "") : "";
        const matCode = typeof mat === 'object' ? (mat.code || mat.materialCode || "") : "";
        const keys = [
          rawMatId,
          cleanStr(matName),
          cleanStr(matCode),
          cleanKey(matName),
          cleanKey(matCode),
        ];
        addPriceEntry(keys, vpl.price, vpl.isPreferred);
      }

      if (Array.isArray(vpl.items)) {
        vpl.items.forEach((vItem) => {
          const vName = cleanStr(vItem.materialName || vItem.itemName);
          const vCode = cleanStr(vItem.materialCode || vItem.itemCode);
          const keys = [vName, vCode, cleanKey(vName), cleanKey(vCode)];
          addPriceEntry(keys, vItem.rate || vItem.unitPrice || 0, vItem.isPreferred || vpl.isPreferred);
        });
      }
    });

    // Material Cost Resolver: checks VendorPriceList preferred rate > lowest rate > inventory unitPrice > rmBo baseRate
    const resolveMaterialPrice = (name, code, matId, rmBoObj) => {
      const keys = [
        matId ? String(matId) : null,
        cleanStr(code),
        cleanStr(name),
        cleanKey(code),
        cleanKey(name)
      ].filter(Boolean);

      let quotes = [];
      for (const k of keys) {
        if (vendorPriceMap.has(k)) {
          quotes = vendorPriceMap.get(k);
          break;
        }
      }

      if (quotes.length > 0) {
        const preferred = quotes.find((q) => q.isPreferred);
        const chosen = preferred || quotes.slice().sort((a, b) => a.rate - b.rate)[0];
        if (chosen && chosen.rate > 0) {
          return {
            unitCost: chosen.rate,
            costSource: "Vendor Price List",
            preferredVendorName: chosen.vendorName
          };
        }
      }

      const inv = allInventories.find(
        (i) =>
          (code && i.materialCode && i.materialCode.toLowerCase() === code.toLowerCase()) ||
          (name && i.materialName && i.materialName.toLowerCase() === name.toLowerCase())
      );

      const invRate = Number(inv?.unitPrice || 0);
      const baseRate = Number(rmBoObj?.baseRate || 0);
      const fallbackRate = invRate > 0 ? invRate : baseRate;

      return {
        unitCost: fallbackRate,
        costSource: fallbackRate > 0 ? "Inventory Valuation" : "Estimated Rate",
        preferredVendorName: ""
      };
    };

    // Helper to find BOM for a product (from BOM collection OR FGItem embedded BOM)
    const findBOM = (pName, pCode, bId, fgId) => {
      if (bId) {
        const found = allBOMs.find((b) => b._id && b._id.toString() === bId.toString());
        if (found && Array.isArray(found.items) && found.items.length > 0) return found;

        const foundByNum = allBOMs.find((b) => b.bomNumber && b.bomNumber.toString().toLowerCase() === bId.toString().toLowerCase());
        if (foundByNum && Array.isArray(foundByNum.items) && foundByNum.items.length > 0) return foundByNum;
      }

      if (fgId) {
        const foundFG = allFGItems.find((f) => f._id && f._id.toString() === fgId.toString());
        if (foundFG && Array.isArray(foundFG.bom) && foundFG.bom.length > 0) {
          return {
            _id: foundFG._id,
            bomNumber: `BOM-${foundFG.code || foundFG.name}`,
            productName: foundFG.name,
            productCode: foundFG.code,
            items: foundFG.bom.map((b) => ({
              materialName: b.itemName || b.name || "Material",
              materialCode: b.itemCode || b.code || "",
              quantity: Number(b.quantity) || 1,
              unit: b.unit || "PCS",
              itemType: b.itemType || "Material",
              description: b.description || b.descriptions || ""
            })),
          };
        }
      }

      if (pName) {
        const cleanPName = pName.trim().toLowerCase();
        const found = allBOMs.find(
          (b) => b.productName && b.productName.trim().toLowerCase() === cleanPName
        );
        if (found && Array.isArray(found.items) && found.items.length > 0) return found;

        const foundFG = allFGItems.find(
          (f) => f.name && f.name.trim().toLowerCase() === cleanPName
        );
        if (foundFG && Array.isArray(foundFG.bom) && foundFG.bom.length > 0) {
          return {
            _id: foundFG._id,
            bomNumber: `BOM-${foundFG.code || foundFG.name}`,
            productName: foundFG.name,
            productCode: foundFG.code,
            items: foundFG.bom.map((b) => ({
              materialName: b.itemName || b.name || "Material",
              materialCode: b.itemCode || b.code || "",
              quantity: Number(b.quantity) || 1,
              unit: b.unit || "PCS",
              itemType: b.itemType || "Material",
              description: b.description || b.descriptions || ""
            })),
          };
        }
      }

      if (pCode) {
        const cleanPCode = pCode.trim().toLowerCase();
        const found = allBOMs.find(
          (b) => b.productCode && b.productCode.trim().toLowerCase() === cleanPCode
        );
        if (found && Array.isArray(found.items) && found.items.length > 0) return found;

        const foundFG = allFGItems.find(
          (f) => f.code && f.code.trim().toLowerCase() === cleanPCode
        );
        if (foundFG && Array.isArray(foundFG.bom) && foundFG.bom.length > 0) {
          return {
            _id: foundFG._id,
            bomNumber: `BOM-${foundFG.code || foundFG.name}`,
            productName: foundFG.name,
            productCode: foundFG.code,
            items: foundFG.bom.map((b) => ({
              materialName: b.itemName || b.name || "Material",
              materialCode: b.itemCode || b.code || "",
              quantity: Number(b.quantity) || 1,
              unit: b.unit || "PCS",
              itemType: b.itemType || "Material",
              description: b.description || b.descriptions || ""
            })),
          };
        }
      }

      return null;
    };

    const rmMap = new Map();
    const boMap = new Map();

    const explodeTree = (itemName, itemCode, multiplierQty, level, fgId, bId) => {
      const subBOM = findBOM(itemName, itemCode, bId, fgId);
      if (subBOM && Array.isArray(subBOM.items) && subBOM.items.length > 0 && level <= 5) {
        for (const subItem of subBOM.items) {
          const sName = (subItem.materialName || "").trim();
          const sCode = (subItem.materialCode || "").trim();
          const perQty = Number(subItem.quantity) || 1;
          const grossQty = perQty * multiplierQty;
          const unit = subItem.unit || "PCS";

          const rmBo = allRmBoItems.find(
            (r) =>
              (sCode && r.code && r.code.toLowerCase() === sCode.toLowerCase()) ||
              (r.name && r.name.toLowerCase() === sName.toLowerCase())
          );
          const rawMat = allRawMaterials.find(
            (r) =>
              (sCode && r.code && r.code.toLowerCase() === sCode.toLowerCase()) ||
              (r.name && r.name.toLowerCase() === sName.toLowerCase())
          );
          const boughtOut = allBoughtOuts.find(
            (r) =>
              (sCode && r.code && r.code.toLowerCase() === sCode.toLowerCase()) ||
              (r.name && r.name.toLowerCase() === sName.toLowerCase())
          );

          const matchedFG = allFGItems.find(
            (f) =>
              (sCode && f.code && f.code.toLowerCase() === sCode.toLowerCase()) ||
              (f.name && f.name.toLowerCase() === sName.toLowerCase())
          );
          const nestedSubBOM = findBOM(sName, sCode);
          const fgType = matchedFG?.type || subItem.fgType || subItem.itemClassification;
          const isSubAssembly = fgType === "Sub Assembly" || Boolean(nestedSubBOM);

          const assignedMasterCat = rawMat?.categoryId?.name || boughtOut?.categoryId?.name || rmBo?.categoryId?.name || rawMat?.category || boughtOut?.category || rmBo?.category || "";
          const catName = (assignedMasterCat || rmBo?.categoryId?.name || rmBo?.category || "").toLowerCase();
          const rawItemType = (rawMat?.itemType || boughtOut?.itemType || rmBo?.itemType || "").toLowerCase();
          const isBO = Boolean(boughtOut) || rawItemType === 'bought out' || rawItemType === 'bo' || catName.includes('bought') || catName.includes('hardware') || catName.includes('fastener');

          const sDesc = subItem.description || matchedFG?.description || matchedFG?.descriptions || rmBo?.description || rmBo?.descriptions || rawMat?.descriptions || rawMat?.description || boughtOut?.descriptions || boughtOut?.description || "";

          if (isSubAssembly) {
            explodeTree(sName, sCode, grossQty, level + 1, undefined, undefined);
          } else if (isBO) {
            const itemKey = (sCode || sName).toLowerCase();
            if (!boMap.has(itemKey)) {
              boMap.set(itemKey, {
                material: rmBo?._id || boughtOut?._id,
                materialName: sName,
                materialCode: sCode,
                description: sDesc,
                requiredQuantity: 0,
                unit,
                rmBoObj: rmBo || boughtOut
              });
            }
            const existing = boMap.get(itemKey);
            existing.requiredQuantity += grossQty;
            if (!existing.description && sDesc) existing.description = sDesc;
          } else {
            const itemKey = (sCode || sName).toLowerCase();
            if (!rmMap.has(itemKey)) {
              rmMap.set(itemKey, {
                material: rmBo?._id || rawMat?._id,
                materialName: sName,
                materialCode: sCode,
                description: sDesc,
                requiredQuantity: 0,
                unit,
                rmBoObj: rmBo || rawMat
              });
            }
            const existing = rmMap.get(itemKey);
            existing.requiredQuantity += grossQty;
            if (!existing.description && sDesc) existing.description = sDesc;
          }
        }
      }
    };

    // Explode each FG item
    for (const fg of fgItems) {
      const rawQty = Math.max(0, Number(fg.quantity) || 0);
      if (rawQty <= 0) continue;
      explodeTree(fg.fgItemName, fg.fgItemCode, rawQty, 1, fg.fgItem, fg.bomId);
    }

    let totalRmCost = 0;
    const rmItems = [];
    rmMap.forEach((r) => {
      const pricing = resolveMaterialPrice(r.materialName, r.materialCode, r.material, r.rmBoObj);
      const unitCost = pricing.unitCost;
      const grossCost = Math.round(r.requiredQuantity * unitCost * 100) / 100;
      totalRmCost += grossCost;
      rmItems.push({
        materialName: r.materialName,
        materialCode: r.materialCode,
        description: r.description,
        requiredQuantity: r.requiredQuantity,
        unit: r.unit,
        unitCost,
        grossCost,
        costSource: pricing.costSource,
        preferredVendorName: pricing.preferredVendorName
      });
    });

    let totalBoCost = 0;
    const boItems = [];
    boMap.forEach((b) => {
      const pricing = resolveMaterialPrice(b.materialName, b.materialCode, b.material, b.rmBoObj);
      const unitCost = pricing.unitCost;
      const grossCost = Math.round(b.requiredQuantity * unitCost * 100) / 100;
      totalBoCost += grossCost;
      boItems.push({
        materialName: b.materialName,
        materialCode: b.materialCode,
        description: b.description,
        requiredQuantity: b.requiredQuantity,
        unit: b.unit,
        unitCost,
        grossCost,
        costSource: pricing.costSource,
        preferredVendorName: pricing.preferredVendorName
      });
    });

    totalRmCost = Math.round(totalRmCost * 100) / 100;
    totalBoCost = Math.round(totalBoCost * 100) / 100;
    const totalBOMCost = Math.round((totalRmCost + totalBoCost) * 100) / 100;

    res.status(200).json({
      success: true,
      data: {
        totalRmCost,
        totalBoCost,
        totalBOMCost,
        rmCount: rmMap.size,
        boCount: boMap.size,
        rmItems,
        boItems
      }
    });
  } catch (error) {
    console.error("Error previewing MRP BOM budget:", error);
    res.status(500).json({ message: error.message || "Failed to calculate BOM budget preview" });
  }
};

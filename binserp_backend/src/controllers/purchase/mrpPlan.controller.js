import mongoose from "mongoose";
import { mrpPlanSchema, purchaseOrderSchema, vendorPriceListSchema } from "../../models/purchase/index.js";
import { bomSchema, inventorySchema, rmBoItemSchema, categorySchema, fgItemSchema, rawMaterialSchema, boughtOutSchema, storePrefixSchema, vendorSchema } from "../../models/store/index.js";
import { incomingPOSchema, priceListSchema } from "../../models/sales/index.js";
import { userSchema } from "../../models/user/index.js";
import { checkTimeLockGovernance } from "../../utils/timeLockGovernance.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

const cleanStr = (s) => (s || "").trim().toLowerCase();
const cleanKey = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

export const defaultExchangeRates = {
  USD: 86.80,
  EUR: 92.50,
  GBP: 108.20,
  AED: 23.63,
  CAD: 61.50,
  AUD: 55.40,
  SGD: 64.20,
  JPY: 0.56,
  CNY: 11.95,
  INR: 1.0,
};

export const resolveExchangeRateToINR = (currency, prefixSettings) => {
  const code = (currency || 'INR').trim().toUpperCase();
  if (code === 'INR') return 1.0;
  if (code === 'POUND') return prefixSettings?.exchangeRates?.GBP || defaultExchangeRates.GBP;
  if (code === 'EURO') return prefixSettings?.exchangeRates?.EUR || defaultExchangeRates.EUR;
  if (code === 'YEN') return prefixSettings?.exchangeRates?.JPY || defaultExchangeRates.JPY;
  if (code === 'YUAN' || code === 'RMB') return prefixSettings?.exchangeRates?.CNY || defaultExchangeRates.CNY;

  const rate = Number(prefixSettings?.exchangeRates?.[code]);
  if (!isNaN(rate) && rate > 0) return rate;
  return defaultExchangeRates[code] || 1.0;
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

    // Resolve Store Prefix & Currency Settings from Master
    const StorePrefix = req.getModel("StorePrefix", storePrefixSchema);
    const prefixSettings = await StorePrefix.findOne().catch(() => null);

    // Resolve Customer POs list (for single or multi-PO consolidation)
    let resolvedCustomerPOs = [];
    if (Array.isArray(customerPOs) && customerPOs.length > 0) {
      resolvedCustomerPOs = customerPOs.map((p) => {
        const cCode = p.currency || "INR";
        const exRate = p.exchangeRate || resolveExchangeRateToINR(cCode, prefixSettings);
        const totAmt = Number(p.totalAmount || 0);
        return {
          customerPo: p.customerPo || p._id || p.id,
          customerPoNumber: p.customerPoNumber || p.poNumber || "",
          customer: p.customer?._id || p.customer,
          customerName: p.customerName || p.customer?.name || "",
          poDate: p.poDate ? new Date(p.poDate) : undefined,
          targetDate: p.targetDate ? new Date(p.targetDate) : undefined,
          currency: cCode,
          exchangeRate: exRate,
          totalAmount: totAmt,
          totalAmountInINR: Math.round(totAmt * exRate * 100) / 100,
        };
      });
    } else if (Array.isArray(customerPoIds) && customerPoIds.length > 0) {
      const fetchedPOs = await IncomingPO.find({
        company: companyId,
        _id: { $in: customerPoIds },
      }).populate("customer", "name code");

      resolvedCustomerPOs = fetchedPOs.map((p) => {
        const cCode = p.currency || "INR";
        const exRate = resolveExchangeRateToINR(cCode, prefixSettings);
        const totAmt = Number(p.totalAmount || 0);
        return {
          customerPo: p._id,
          customerPoNumber: p.poNumber || "",
          customer: p.customer?._id || p.customer,
          customerName: p.customer?.name || p.customerName || "",
          poDate: p.date ? new Date(p.date) : undefined,
          targetDate: p.committedDispatchDate || p.deliveryDate || p.date,
          currency: cCode,
          exchangeRate: exRate,
          totalAmount: totAmt,
          totalAmountInINR: Math.round(totAmt * exRate * 100) / 100,
        };
      });
    } else if (customerPo || customerPoNumber) {
      const fetchedPO = (customerPo && mongoose.Types.ObjectId.isValid(customerPo))
        ? await IncomingPO.findOne({ company: companyId, _id: customerPo }).lean().catch(() => null)
        : await IncomingPO.findOne({ company: companyId, poNumber: customerPoNumber }).lean().catch(() => null);

      const cCode = fetchedPO?.currency || req.body.currency || "INR";
      const exRate = resolveExchangeRateToINR(cCode, prefixSettings);
      const totAmt = Number(fetchedPO?.totalAmount || 0);

      resolvedCustomerPOs = [
        {
          customerPo: customerPo && mongoose.Types.ObjectId.isValid(customerPo) ? customerPo : fetchedPO?._id,
          customerPoNumber: customerPoNumber || fetchedPO?.poNumber || "",
          customerName: customerName || fetchedPO?.customerName || "",
          poDate: poDate ? new Date(poDate) : (fetchedPO?.date ? new Date(fetchedPO.date) : undefined),
          targetDate: targetDate ? new Date(targetDate) : (fetchedPO?.committedDispatchDate ? new Date(fetchedPO.committedDispatchDate) : undefined),
          currency: cCode,
          exchangeRate: exRate,
          totalAmount: totAmt,
          totalAmountInINR: Math.round(totAmt * exRate * 100) / 100,
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

    // Parallel fetch cached collections for company with lean() for maximum speed & minimal memory footprint
    const VendorPriceList = req.getModel("VendorPriceList", vendorPriceListSchema);
    req.getModel("Vendor", vendorSchema);
    const PriceList = req.getModel("PriceList", priceListSchema);

    const [
      allInventories,
      allRmBoItems,
      allRawMaterials,
      allBoughtOuts,
      allBOMs,
      allFGItems,
      allPriceLists,
      allSalesPriceLists
    ] = await Promise.all([
      Inventory.find({ company: companyId }).lean(),
      RmBoItem.find({ company: companyId }).populate("categoryId").lean(),
      RawMaterial.find({ company: companyId }).populate("categoryId").lean(),
      BoughtOut.find({ company: companyId }).populate("categoryId").lean(),
      BOM.find({ company: companyId }).lean(),
      FGItem.find({ company: companyId }).lean(),
      VendorPriceList.find({ company: companyId }).populate("vendor", "name code").lean().catch(() => []),
      PriceList.find({ company: companyId }).populate("fgItem", "name code").lean().catch(() => [])
    ]);

    // O(1) Fast lookup indices
    const invByCode = new Map();
    const invByName = new Map();
    (allInventories || []).forEach(i => {
      if (i.materialCode) invByCode.set(i.materialCode.toLowerCase().trim(), i);
      if (i.materialName) invByName.set(i.materialName.toLowerCase().trim(), i);
    });

    const bomById = new Map();
    const bomByName = new Map();
    const bomByCode = new Map();
    (allBOMs || []).forEach(b => {
      if (b._id) bomById.set(b._id.toString(), b);
      if (b.bomNumber) bomById.set(b.bomNumber.toString().toLowerCase().trim(), b);
      if (b.productName) bomByName.set(b.productName.toLowerCase().trim(), b);
      if (b.productCode) bomByCode.set(b.productCode.toLowerCase().trim(), b);
    });

    const fgById = new Map();
    const fgByName = new Map();
    const fgByCode = new Map();
    (allFGItems || []).forEach(f => {
      if (f._id) fgById.set(f._id.toString(), f);
      if (f.name) fgByName.set(f.name.toLowerCase().trim(), f);
      if (f.code) fgByCode.set(f.code.toLowerCase().trim(), f);
    });

    const rmByCode = new Map();
    const rmByName = new Map();
    (allRawMaterials || []).forEach(r => {
      if (r.code) rmByCode.set(r.code.toLowerCase().trim(), r);
      if (r.name) rmByName.set(r.name.toLowerCase().trim(), r);
    });

    const boByCode = new Map();
    const boByName = new Map();
    (allBoughtOuts || []).forEach(b => {
      if (b.code) boByCode.set(b.code.toLowerCase().trim(), b);
      if (b.name) boByName.set(b.name.toLowerCase().trim(), b);
    });

    const rmBoByCode = new Map();
    const rmBoByName = new Map();
    (allRmBoItems || []).forEach(r => {
      if (r.code) rmBoByCode.set(r.code.toLowerCase().trim(), r);
      if (r.name) rmByName.set(r.name.toLowerCase().trim(), r);
    });

    // Build Fast Sales Price List Map (Sales Price List is authoritative for internal FG pricing)
    const salesPriceMap = new Map();
    allSalesPriceLists.forEach((spl) => {
      const fgId = (spl.fgItem?._id || spl.fgItem)?.toString();
      const fgName = spl.fgItem?.name || "";
      const fgCode = spl.fgItem?.code || "";
      const rawPrice = Number(spl.price || 0);
      const curr = (spl.currency || "INR").trim().toUpperCase();
      const exRate = resolveExchangeRateToINR(curr, prefixSettings);
      const priceInINR = Math.round(rawPrice * exRate * 100) / 100;

      const entry = {
        price: rawPrice,
        currency: curr,
        exchangeRate: exRate,
        rateInINR: priceInINR,
        taxRate: Number(spl.taxRate || 0),
        priceSource: curr !== "INR" ? `Sales Price List (${curr} @ ₹${exRate})` : "Sales Price List"
      };

      [fgId, cleanStr(fgName), cleanStr(fgCode), cleanKey(fgName), cleanKey(fgCode)].filter(Boolean).forEach(k => {
        if (!salesPriceMap.has(k)) salesPriceMap.set(k, entry);
      });
    });

    const allContributingPoIds = resolvedCustomerPOs
      .map((p) => p.customerPo)
      .filter((id) => id && mongoose.Types.ObjectId.isValid(id));
    const allContributingPoNumbers = resolvedCustomerPOs
      .map((p) => p.customerPoNumber)
      .filter(Boolean);
    if (customerPoNumber) {
      customerPoNumber.split(",").map(s => s.trim()).filter(Boolean).forEach(p => allContributingPoNumbers.push(p));
    }

    let contributingPODocs = [];
    if (allContributingPoIds.length > 0 || allContributingPoNumbers.length > 0) {
      contributingPODocs = await IncomingPO.find({
        company: companyId,
        $or: [
          allContributingPoIds.length > 0 ? { _id: { $in: allContributingPoIds } } : null,
          allContributingPoNumbers.length > 0 ? { poNumber: { $in: allContributingPoNumbers } } : null
        ].filter(Boolean)
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
      }      const inv = (code && invByCode.get(code.toLowerCase().trim())) ||
                  (name && invByName.get(name.toLowerCase().trim())) ||
                  null;

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

    // Build Customer PO item price and multi-currency conversion lookup map
    const poItemPriceMap = new Map();
    contributingPODocs.forEach(cpo => {
      const cpoCurrency = (cpo.currency || 'INR').trim().toUpperCase();
      const cpoExRate = resolveExchangeRateToINR(cpoCurrency, prefixSettings);

      (cpo.items || []).forEach(item => {
        const rawRate = Number(item.rate || (item.quantity > 0 ? item.amount / item.quantity : 0) || 0);
        const inrRate = Math.round(rawRate * cpoExRate * 100) / 100;
        const entry = {
          customerPo: cpo._id,
          customerPoNumber: cpo.poNumber || "",
          customerName: cpo.customerName || (typeof cpo.customer === 'object' ? cpo.customer?.name : "") || "",
          currency: cpoCurrency,
          originalRate: rawRate,
          exchangeRate: cpoExRate,
          rateInINR: inrRate,
        };

        const fgIdK = item.fgItem ? String(item.fgItem) : null;
        const nameK = cleanStr(item.productName || item.name || item.itemName);
        const codeK = cleanStr(item.productCode || item.code || item.itemCode);
        const poNumK = cleanStr(cpo.poNumber);
        const poIdK = String(cpo._id);

        [fgIdK, nameK, codeK, cleanKey(nameK), cleanKey(codeK)].filter(Boolean).forEach(k => {
          poItemPriceMap.set(`${poIdK}_${k}`, entry);
          if (poNumK) poItemPriceMap.set(`${poNumK}_${k}`, entry);
          if (!poItemPriceMap.has(`general_${k}`)) poItemPriceMap.set(`general_${k}`, entry);
        });
      });
    });

    // Finished Goods Selling Price Resolver: Customer PO rate (with currency conversion) > FGItem master > Manual
    const resolveFGSellingPrice = (fgId, fgName, fgCode, manualPrice, targetPoId, targetPoNumber) => {
      if (manualPrice !== undefined && manualPrice !== null && Number(manualPrice) > 0) {
        return { sellingPrice: Number(manualPrice), priceSource: "Manual Override" };
      }

      const pId = targetPoId ? String(targetPoId) : "";
      const pNo = cleanStr(targetPoNumber);
      const keys = [
        pId ? `${pId}_${fgId}` : null,
        pNo ? `${pNo}_${fgId}` : null,
        pId ? `${pId}_${cleanStr(fgName)}` : null,
        pNo ? `${pNo}_${cleanStr(fgName)}` : null,
        pId ? `${pId}_${cleanStr(fgCode)}` : null,
        pNo ? `${pNo}_${cleanStr(fgCode)}` : null,
        `general_${fgId}`,
        `general_${cleanStr(fgName)}`,
        `general_${cleanStr(fgCode)}`,
        `general_${cleanKey(fgName)}`,
        `general_${cleanKey(fgCode)}`,
      ].filter(Boolean);

      for (const k of keys) {
        if (poItemPriceMap.has(k)) {
          const matched = poItemPriceMap.get(k);
          if (matched.rateInINR > 0) {
            const isForeign = matched.currency !== "INR";
            return {
              sellingPrice: matched.rateInINR,
              currency: matched.currency,
              originalSellingPrice: matched.originalRate,
              exchangeRate: matched.exchangeRate,
              priceSource: isForeign ? `Customer PO (${matched.currency} @ ₹${matched.exchangeRate})` : "Customer PO"
            };
          }
        }
      }

      // For Internal MRP (no Customer PO) or when PO price is unset: query Sales Price List first
      const salesKeys = [
        fgId ? String(fgId) : null,
        cleanStr(fgName),
        cleanStr(fgCode),
        cleanKey(fgName),
        cleanKey(fgCode),
      ].filter(Boolean);

      for (const k of salesKeys) {
        if (salesPriceMap.has(k)) {
          const matchedSales = salesPriceMap.get(k);
          if (matchedSales.rateInINR > 0) {
            return {
              sellingPrice: matchedSales.rateInINR,
              currency: matchedSales.currency,
              originalSellingPrice: matchedSales.price,
              exchangeRate: matchedSales.exchangeRate,
              priceSource: matchedSales.priceSource || "Sales Price List"
            };
          }
        }
      }

      const matchedMaster = (fgId && fgById.get(String(fgId))) ||
                            (fgName && fgByName.get(cleanStr(fgName))) ||
                            (fgCode && fgByCode.get(cleanStr(fgCode))) ||
                            null;

      if (matchedMaster && Number(matchedMaster.sellingPrice) > 0) {
        const mCurr = (matchedMaster.currency || "INR").trim().toUpperCase();
        const mExRate = resolveExchangeRateToINR(mCurr, prefixSettings);
        const mRateInINR = Math.round(Number(matchedMaster.sellingPrice) * mExRate * 100) / 100;
        return {
          sellingPrice: mRateInINR,
          currency: mCurr,
          originalSellingPrice: Number(matchedMaster.sellingPrice),
          exchangeRate: mExRate,
          priceSource: mCurr !== "INR" ? `Master Catalog (${mCurr} @ ₹${mExRate})` : "Master Catalog"
        };
      }

      return { sellingPrice: 0, priceSource: "Unset" };
    };

    const enrichedFgItems = [];

    // Helper to find BOM for a product (from BOM collection OR FGItem embedded BOM) using O(1) Map lookups
    const findBOM = (pName, pCode, bId, fgId) => {
      // 1. Direct BOM ID match
      if (bId) {
        const found = bomById.get(bId.toString()) || bomById.get(bId.toString().toLowerCase().trim());
        if (found && Array.isArray(found.items) && found.items.length > 0) return found;
      }

      // 2. Direct FG Item ID match with embedded BOM
      if (fgId) {
        const foundFG = fgById.get(fgId.toString());
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
        const found = bomByName.get(cleanPName);
        if (found && Array.isArray(found.items) && found.items.length > 0) return found;

        const foundFG = fgByName.get(cleanPName);
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
        const found = bomByCode.get(cleanPCode);
        if (found && Array.isArray(found.items) && found.items.length > 0) return found;

        const foundFG = fgByCode.get(cleanPCode);
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

          // Fast O(1) Stock lookup
          const inv = (sCode && invByCode.get(sCode.toLowerCase())) ||
                      (sName && invByName.get(sName.toLowerCase())) ||
                      null;
          const currentStock = inv ? Number(inv.currentStock || 0) : 0;
          const shortage = Math.max(0, grossQty - currentStock);

          // Fast O(1) RM/BO lookup
          const rmBo = (sCode && rmBoByCode.get(sCode.toLowerCase())) ||
                       (sName && rmBoByName.get(sName.toLowerCase())) ||
                       null;
          const rawMat = (sCode && rmByCode.get(sCode.toLowerCase())) ||
                         (sName && rmByName.get(sName.toLowerCase())) ||
                         null;
          const boughtOut = (sCode && boByCode.get(sCode.toLowerCase())) ||
                            (sName && boByName.get(sName.toLowerCase())) ||
                            null;

          // Check if this subItem itself is an FGItem / sub-assembly via fast lookup
          const matchedFG = (sCode && fgByCode.get(sCode.toLowerCase())) ||
                            (sName && fgByName.get(sName.toLowerCase())) ||
                            null;
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

    // Deduplicate and aggregate Finished Goods line items with full multi-currency and breakdown tracking
    const mergedFgMap = new Map();

    for (const fg of fgItems) {
      const rawQty = Number(fg.quantity) || 1;
      const rawName = (fg.fgItemName || fg.name || fg.productName || fg.itemName || fg.description || "").trim();
      const fgCode = (fg.fgItemCode || fg.code || fg.productCode || "").trim();
      const fgId = fg.fgItem || fg._id;
      const freshFG = (fgId && fgById.get(String(fgId))) ||
                      (rawName && fgByName.get(cleanStr(rawName))) ||
                      (fgCode && fgByCode.get(cleanStr(fgCode)));
      const fgName = (freshFG?.name || rawName || (fgCode ? `Item ${fgCode}` : "") || "Finished Good").trim();
      const itemKey = fgId ? String(fgId) : (fgCode || fgName).toLowerCase();
      if (!itemKey) continue;

      const fgPoNumber = fg.customerPoNumber || (resolvedCustomerPOs.length === 1 ? resolvedCustomerPOs[0].customerPoNumber : "");
      const fgPoId = fg.customerPo || (resolvedCustomerPOs.length === 1 ? resolvedCustomerPOs[0].customerPo : undefined);
      const fgCustName = fg.customerName || (resolvedCustomerPOs.length === 1 ? resolvedCustomerPOs[0].customerName : "");
      const fgTargetDate = fg.targetDate ? new Date(fg.targetDate) : undefined;
      const fgPoDate = fg.poDeliveryDate ? new Date(fg.poDeliveryDate) : undefined;

      // Resolve breakdown entries with currency & INR conversion
      let incomingBreakdown = [];
      if (Array.isArray(fg.sourceBreakdown) && fg.sourceBreakdown.length > 0) {
        incomingBreakdown = fg.sourceBreakdown.map(b => {
          const poId = b.customerPo ? String(b.customerPo) : "";
          const poNo = cleanStr(b.customerPoNumber);
          const priceMatch = (poId && poItemPriceMap.get(`${poId}_${fgId}`)) ||
                             (poNo && poItemPriceMap.get(`${poNo}_${fgId}`)) ||
                             (poId && poItemPriceMap.get(`${poId}_${cleanStr(fgName)}`)) ||
                             (poNo && poItemPriceMap.get(`${poNo}_${cleanStr(fgName)}`)) ||
                             (poId && poItemPriceMap.get(`${poId}_${cleanStr(fgCode)}`)) ||
                             (poNo && poItemPriceMap.get(`${poNo}_${cleanStr(fgCode)}`)) ||
                             poItemPriceMap.get(`general_${fgId}`) ||
                             poItemPriceMap.get(`general_${cleanStr(fgName)}`);

          const curr = b.currency || priceMatch?.currency || "INR";
          const exRate = b.exchangeRate || priceMatch?.exchangeRate || resolveExchangeRateToINR(curr, prefixSettings);
          const origRate = Number(b.originalRate || priceMatch?.originalRate || b.rateInINR || b.rate || 0);
          const inrRate = Number(b.rateInINR || (origRate * exRate) || 0);
          const bQty = Number(b.quantity || 0);
          const amtInINR = Math.round(bQty * inrRate * 100) / 100;

          return {
            customerPo: b.customerPo || priceMatch?.customerPo,
            customerPoNumber: b.customerPoNumber || priceMatch?.customerPoNumber || "",
            customerName: b.customerName || priceMatch?.customerName || "",
            quantity: bQty,
            currency: curr,
            originalRate: origRate,
            exchangeRate: exRate,
            rateInINR: inrRate,
            amountInINR: amtInINR
          };
        });
      } else {
        const poId = fgPoId ? String(fgPoId) : "";
        const poNo = cleanStr(fgPoNumber);
        const priceMatch = (poId && poItemPriceMap.get(`${poId}_${fgId}`)) ||
                           (poNo && poItemPriceMap.get(`${poNo}_${fgId}`)) ||
                           (poId && poItemPriceMap.get(`${poId}_${cleanStr(fgName)}`)) ||
                           (poNo && poItemPriceMap.get(`${poNo}_${cleanStr(fgName)}`)) ||
                           (poId && poItemPriceMap.get(`${poId}_${cleanStr(fgCode)}`)) ||
                           (poNo && poItemPriceMap.get(`${poNo}_${cleanStr(fgCode)}`)) ||
                           poItemPriceMap.get(`general_${fgId}`) ||
                           poItemPriceMap.get(`general_${cleanStr(fgName)}`);

        const curr = fg.currency || priceMatch?.currency || "INR";
        const exRate = fg.exchangeRate || priceMatch?.exchangeRate || resolveExchangeRateToINR(curr, prefixSettings);
        const origRate = Number(fg.originalSellingPrice || priceMatch?.originalRate || fg.sellingPrice || 0);
        const inrRate = Number(fg.sellingPrice || (origRate * exRate) || priceMatch?.rateInINR || 0);
        const amtInINR = Math.round(rawQty * inrRate * 100) / 100;

        incomingBreakdown = [{
          customerPo: fgPoId || priceMatch?.customerPo,
          customerPoNumber: fgPoNumber || priceMatch?.customerPoNumber || "",
          customerName: fgCustName || priceMatch?.customerName || "",
          quantity: rawQty,
          currency: curr,
          originalRate: origRate,
          exchangeRate: exRate,
          rateInINR: inrRate,
          amountInINR: amtInINR
        }];
      }

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

      // Append incoming breakdowns
      incomingBreakdown.forEach(b => {
        existing.sourceBreakdown.push(b);
        if (b.customerPoNumber && !existing.sourceCustomerPOs.includes(b.customerPoNumber)) {
          existing.sourceCustomerPOs.push(b.customerPoNumber);
        }
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

      // Financial resolution for FG selling rate with multi-currency conversion to INR
      const totalAmountINR = fg.sourceBreakdown.reduce((s, b) => s + (Number(b.amountInINR) || 0), 0);
      let unitSellingPrice = 0;
      let calculatedTotalPrice = 0;
      let resolvedPriceSource = fg.priceSource || "";
      let resolvedCurrency = "INR";
      let resolvedOriginalPrice = 0;
      let resolvedExchangeRate = 1;

      if (totalAmountINR > 0 && fgQty > 0) {
        unitSellingPrice = Math.round((totalAmountINR / fgQty) * 100) / 100;
        calculatedTotalPrice = Math.round(totalAmountINR * 100) / 100;
        const uniqueCurrs = [...new Set(fg.sourceBreakdown.map(b => b.currency).filter(Boolean))];
        if (uniqueCurrs.length === 1 && uniqueCurrs[0] !== 'INR') {
          resolvedCurrency = uniqueCurrs[0];
          resolvedOriginalPrice = fg.sourceBreakdown[0].originalRate;
          resolvedExchangeRate = fg.sourceBreakdown[0].exchangeRate;
          resolvedPriceSource = `Customer PO (${uniqueCurrs[0]} @ ₹${resolvedExchangeRate})`;
        } else if (uniqueCurrs.length > 1) {
          resolvedCurrency = "MIXED";
          resolvedPriceSource = `Customer PO (Consolidated Multi-Currency: ${uniqueCurrs.join(', ')})`;
        } else {
          resolvedCurrency = "INR";
          resolvedOriginalPrice = unitSellingPrice;
          resolvedExchangeRate = 1;
          resolvedPriceSource = "Customer PO";
        }
      } else {
        const fallbackPrice = resolveFGSellingPrice(fgId, fgName, fgCode, fg.sellingPrice, fg.customerPo, fg.customerPoNumber);
        unitSellingPrice = fallbackPrice.sellingPrice;
        calculatedTotalPrice = Math.round(fgQty * unitSellingPrice * 100) / 100;
        resolvedPriceSource = fallbackPrice.priceSource;
        resolvedCurrency = fallbackPrice.currency || "INR";
        resolvedOriginalPrice = fallbackPrice.originalSellingPrice || unitSellingPrice;
        resolvedExchangeRate = fallbackPrice.exchangeRate || 1;
      }

      enrichedFgItems.push({
        fgItem: fgId,
        fgItemName: fgName,
        fgItemCode: fgCode,
        description: fgDesc,
        quantity: fgQty,
        unit: fg.unit || "PCS",
        sellingPrice: unitSellingPrice,
        totalPrice: calculatedTotalPrice,
        currency: resolvedCurrency,
        originalSellingPrice: resolvedOriginalPrice,
        exchangeRate: resolvedExchangeRate,
        priceSource: resolvedPriceSource,
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
      const escapedS = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { mrpNumber: { $regex: escapedS, $options: "i" } },
        { customerPoNumber: { $regex: escapedS, $options: "i" } },
        { customerName: { $regex: escapedS, $options: "i" } },
        { "customerPOs.customerPoNumber": { $regex: escapedS, $options: "i" } },
        { "customerPOs.customerName": { $regex: escapedS, $options: "i" } },
        { "fgItems.fgItemName": { $regex: escapedS, $options: "i" } },
      ];
    }

    const mrpPlans = await MRPPlan.find(query)
      .populate("createdBy", "name username email")
      .populate("updatedBy", "name username email")
      .sort({ createdAt: -1 })
      .lean();

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
    const prefixDoc = await StorePrefix.findOne({ company: companyId }).lean() || await StorePrefix.findOne().lean();
    const policyHours = prefixDoc?.timeLockPolicies?.mrpPlan !== undefined && prefixDoc?.timeLockPolicies?.mrpPlan !== null
      ? Number(prefixDoc.timeLockPolicies.mrpPlan)
      : 24;

    const enrichedPlans = mrpPlans.map(p => {
      const planObj = p;
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

    // Check if any FGItem or BOM was modified after this plan's last creation or BOM sync
    let isBOMOutdated = Boolean(mrpPlan.isBOMOutdated);
    if (!isBOMOutdated) {
      const planBOMTimestamp = mrpPlan.bomSyncedAt
        ? new Date(mrpPlan.bomSyncedAt).getTime()
        : new Date(mrpPlan.updatedAt || mrpPlan.createdAt).getTime();

      const FGItem = req.getModel("FGItem", fgItemSchema);
      const fgItemIds = (mrpPlan.fgItems || []).map(f => f.fgItem?._id || f.fgItem).filter(Boolean);
      if (fgItemIds.length > 0) {
        const freshFGs = await FGItem.find({ company: companyId, _id: { $in: fgItemIds } }).select("updatedAt").lean();
        for (const fg of freshFGs) {
          if (fg.updatedAt && new Date(fg.updatedAt).getTime() > planBOMTimestamp + 1000) {
            isBOMOutdated = true;
            break;
          }
        }
      }
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
        isBOMOutdated,
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

    // Recalculate BOM requirements with the shared multi-level explosion engine
    const recalcOptions = {};
    if (Array.isArray(fgItems) && fgItems.length > 0) {
      recalcOptions.fgItems = fgItems;
    }
    await recalculateMRPWithLatestBOM(plan, req, recalcOptions);

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

/**
 * Shared Engine to recalculate an MRP Plan with the latest FG BOMs.
 * Recursively explodes BOM, looks up physical inventory stock and vendor pricing,
 * preserves existing procurement states (PO Raised, active PO numbers, RFQs),
 * recalculates gross/shortage costs and budget metrics, and updates the plan.
 */
export const recalculateMRPWithLatestBOM = async (planDocOrId, req, options = {}) => {
  const companyId = getCompanyId(req) || options.companyId || (planDocOrId?.company?._id || planDocOrId?.company);
  const MRPPlan = req.getModel("MRPPlan", mrpPlanSchema);
  const BOM = req.getModel("BOM", bomSchema);
  const Inventory = req.getModel("Inventory", inventorySchema);
  const RmBoItem = req.getModel("RmBoItem", rmBoItemSchema);
  const RawMaterial = req.getModel("RawMaterial", rawMaterialSchema);
  const BoughtOut = req.getModel("BoughtOut", boughtOutSchema);
  const FGItem = req.getModel("FGItem", fgItemSchema);
  const VendorPriceList = req.getModel("VendorPriceList", vendorPriceListSchema);
  const PurchaseOrder = req.getModel("PurchaseOrder", purchaseOrderSchema);
  req.getModel("Vendor", vendorSchema);

  let plan = planDocOrId;
  if (typeof planDocOrId === "string" || planDocOrId instanceof mongoose.Types.ObjectId) {
    plan = await MRPPlan.findOne({ _id: planDocOrId, company: companyId });
  }
  if (!plan) return null;

  // Don't recalculate if Completed or Cancelled unless explicitly requested
  if (!options.force && (plan.status === "Completed" || plan.status === "Cancelled")) {
    return plan;
  }

  // Maps to aggregate RM, BO, SubAssemblies and Consumables across all FG items
  const rmMap = new Map();
  const boMap = new Map();
  const subAssemblyMap = new Map();
  const consumableMap = new Map();

  const PriceList = req.getModel("PriceList", priceListSchema);
  const StorePrefix = req.getModel("StorePrefix", storePrefixSchema);

  // Cache inventory, RM/BO items, BOMs, FG items, vendor price lists, sales price lists, and prefixSettings
  const [
    allInventories,
    allRmBoItems,
    allRawMaterials,
    allBoughtOuts,
    allBOMs,
    allFGItems,
    allPriceLists,
    allSalesPriceLists,
    openPOs,
    prefixSettings
  ] = await Promise.all([
    Inventory.find({ company: companyId }).lean(),
    RmBoItem.find({ company: companyId }).populate("categoryId").lean(),
    RawMaterial.find({ company: companyId }).populate("categoryId").lean(),
    BoughtOut.find({ company: companyId }).populate("categoryId").lean(),
    BOM.find({ company: companyId, status: { $ne: "Inactive" } }).lean(),
    FGItem.find({ company: companyId }).lean(),
    VendorPriceList.find({ company: companyId }).populate("vendor", "name code").lean().catch(() => []),
    PriceList.find({ company: companyId }).populate("fgItem", "name code").lean().catch(() => []),
    PurchaseOrder.find({
      company: companyId,
      $or: [{ mrpPlanId: plan._id }, { mrpNumber: plan.mrpNumber }],
      status: { $nin: ["Cancelled"] }
    }).lean().catch(() => []),
    StorePrefix.findOne({ company: companyId }).lean().catch(() => null)
      .then(p => p || StorePrefix.findOne().lean().catch(() => null))
  ]);

  // Fast O(1) Map lookups for recalculateMRPWithLatestBOM
  const invByCode = new Map();
  const invByName = new Map();
  (allInventories || []).forEach(i => {
    if (i.materialCode) invByCode.set(i.materialCode.toLowerCase().trim(), i);
    if (i.materialName) invByName.set(i.materialName.toLowerCase().trim(), i);
  });

  const bomById = new Map();
  const bomByName = new Map();
  const bomByCode = new Map();
  (allBOMs || []).forEach(b => {
    if (b._id) bomById.set(b._id.toString(), b);
    if (b.bomNumber) bomById.set(b.bomNumber.toString().toLowerCase().trim(), b);
    if (b.productName) bomByName.set(b.productName.toLowerCase().trim(), b);
    if (b.productCode) bomByCode.set(b.productCode.toLowerCase().trim(), b);
  });

  const fgById = new Map();
  const fgByName = new Map();
  const fgByCode = new Map();
  (allFGItems || []).forEach(f => {
    if (f._id) fgById.set(f._id.toString(), f);
    if (f.name) fgByName.set(f.name.toLowerCase().trim(), f);
    if (f.code) fgByCode.set(f.code.toLowerCase().trim(), f);
  });

  const rmByCode = new Map();
  const rmByName = new Map();
  (allRawMaterials || []).forEach(r => {
    if (r.code) rmByCode.set(r.code.toLowerCase().trim(), r);
    if (r.name) rmByName.set(r.name.toLowerCase().trim(), r);
  });

  const boByCode = new Map();
  const boByName = new Map();
  (allBoughtOuts || []).forEach(b => {
    if (b.code) boByCode.set(b.code.toLowerCase().trim(), b);
    if (b.name) boByName.set(b.name.toLowerCase().trim(), b);
  });

  const rmBoByCode = new Map();
  const rmBoByName = new Map();
  (allRmBoItems || []).forEach(r => {
    if (r.code) rmBoByCode.set(r.code.toLowerCase().trim(), r);
    if (r.name) rmByName.set(r.name.toLowerCase().trim(), r);
  });

  // Build Fast Sales Price List Map (Sales Price List is authoritative for internal FG pricing)
  const salesPriceMap = new Map();
  (allSalesPriceLists || []).forEach((spl) => {
    const fgId = (spl.fgItem?._id || spl.fgItem)?.toString();
    const fgName = spl.fgItem?.name || "";
    const fgCode = spl.fgItem?.code || "";
    const rawPrice = Number(spl.price || 0);
    const curr = (spl.currency || "INR").trim().toUpperCase();
    const exRate = resolveExchangeRateToINR(curr, prefixSettings);
    const priceInINR = Math.round(rawPrice * exRate * 100) / 100;

    const entry = {
      price: rawPrice,
      currency: curr,
      exchangeRate: exRate,
      rateInINR: priceInINR,
      taxRate: Number(spl.taxRate || 0),
      priceSource: curr !== "INR" ? `Sales Price List (${curr} @ ₹${exRate})` : "Sales Price List"
    };

    [fgId, cleanStr(fgName), cleanStr(fgCode), cleanKey(fgName), cleanKey(fgCode)].filter(Boolean).forEach(k => {
      if (!salesPriceMap.has(k)) salesPriceMap.set(k, entry);
    });
  });

  // Build Fast In-Transit PO Quantities Map for this specific MRP Plan
  const inTransitPoQtyMap = new Map();
  const validPlanPoNumbers = new Set();
  openPOs.forEach(po => {
    if (po.poNumber) validPlanPoNumbers.add(po.poNumber);
    (po.items || []).forEach(item => {
      const orderedQty = Number(item.quantity || 0);
      const pendingQty = Number(item.pendingQuantity ?? (orderedQty - (item.receivedQuantity || 0))) || 0;
      const k1 = cleanStr(item.materialName || item.itemName);
      const k2 = cleanStr(item.materialCode || item.itemCode);
      [k1, k2, cleanKey(k1), cleanKey(k2)].filter(Boolean).forEach(k => {
        inTransitPoQtyMap.set(k, (inTransitPoQtyMap.get(k) || 0) + (pendingQty > 0 ? pendingQty : orderedQty));
      });
    });
  });

  // Build Contracted PO Price Map from Outward POs linked to this plan
  const contractedPoPriceMap = new Map();
  openPOs.forEach(po => {
    (po.items || []).forEach(item => {
      const itemRate = Number(item.rate || 0);
      if (itemRate > 0) {
        const nameK = cleanStr(item.materialName || item.itemName);
        const codeK = cleanStr(item.materialCode || item.itemCode);
        const matIdK = item.material ? String(item.material) : null;
        const entry = {
          unitCost: itemRate,
          costSource: `Contracted PO Rate (${po.poNumber})`,
          preferredVendor: po.vendor?._id || po.vendor,
          preferredVendorName: po.vendorName || po.vendor?.name || "Contracted Vendor"
        };
        [nameK, codeK, cleanKey(nameK), cleanKey(codeK), matIdK].filter(Boolean).forEach(k => {
          if (!contractedPoPriceMap.has(k)) contractedPoPriceMap.set(k, entry);
        });
      }
    });
  });

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
      const matName = typeof mat === "object" ? (mat.name || mat.materialName || "") : "";
      const matCode = typeof mat === "object" ? (mat.code || mat.materialCode || "") : "";
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

  const resolveMaterialPrice = (name, code, matId, rmBoObj) => {
    const keys = [
      matId ? String(matId) : null,
      cleanStr(code),
      cleanStr(name),
      cleanKey(code),
      cleanKey(name)
    ].filter(Boolean);

    // 1. Highest Priority: Contracted outward PO rate already raised for this plan
    for (const k of keys) {
      if (contractedPoPriceMap.has(k)) {
        return contractedPoPriceMap.get(k);
      }
    }

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

    const inv = (code && invByCode.get(code.toLowerCase().trim())) ||
                (name && invByName.get(name.toLowerCase().trim())) ||
                null;

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

  // Helper to find the absolute latest BOM for an FG using O(1) Map lookups
  const findBOM = (pName, pCode, bId, fgId) => {
    // 1. Direct FG Item ID match with embedded BOM (LATEST)
    if (fgId) {
      const foundFG = fgById.get(fgId.toString());
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
            fgType: b.fgType,
            itemClassification: b.itemClassification,
            description: b.description || b.descriptions || "",
          })),
        };
      }
    }

    // 2. Match by Product Name on FGItem embedded BOM
    if (pName) {
      const cleanPName = cleanStr(pName);
      const foundFG = fgByName.get(cleanPName);
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
            fgType: b.fgType,
            itemClassification: b.itemClassification,
            description: b.description || b.descriptions || "",
          })),
        };
      }
    }

    // 3. Match by Product Code on FGItem embedded BOM
    if (pCode) {
      const cleanPCode = cleanStr(pCode);
      const foundFG = fgByCode.get(cleanPCode);
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
            fgType: b.fgType,
            itemClassification: b.itemClassification,
            description: b.description || b.descriptions || "",
          })),
        };
      }
    }

    // 4. Match in separate BOM collection
    if (bId) {
      const found = bomById.get(bId.toString()) || bomById.get(bId.toString().toLowerCase().trim());
      if (found && Array.isArray(found.items) && found.items.length > 0) return found;
    }

    if (pName) {
      const cleanPName = cleanStr(pName);
      const found = bomByName.get(cleanPName);
      if (found && Array.isArray(found.items) && found.items.length > 0) return found;
    }

    if (pCode) {
      const cleanPCode = cleanStr(pCode);
      const found = bomByCode.get(cleanPCode);
      if (found && Array.isArray(found.items) && found.items.length > 0) return found;
    }

    return null;
  };

  // Build Previous Requirements Lookup Maps to preserve active PO and RFQ references
  const oldReqMap = new Map();
  const registerOldReqs = (list) => {
    (list || []).forEach(item => {
      const k1 = cleanStr(item.materialName);
      const k2 = cleanStr(item.materialCode);
      const mId = item.material ? String(item.material) : null;
      [k1, k2, mId].filter(Boolean).forEach(k => {
        if (!oldReqMap.has(k)) oldReqMap.set(k, item);
      });
    });
  };
  registerOldReqs(plan.rmRequirements);
  registerOldReqs(plan.boRequirements);
  registerOldReqs(plan.subAssemblyRequirements);
  registerOldReqs(plan.consumableRequirements);

  // Recursive BOM explosion function
  const explodeItemTree = (itemName, itemCode, multiplierQty, parentName, level, nestedList, fgId, bId, sourcePoNumber) => {
    const subBOM = findBOM(itemName, itemCode, bId, fgId);
    if (subBOM && Array.isArray(subBOM.items) && subBOM.items.length > 0 && level <= 5) {
      for (const subItem of subBOM.items) {
        const sName = (subItem.materialName || "").trim();
        const sCode = (subItem.materialCode || "").trim();
        const perQty = Number(subItem.quantity) || 1;
        const grossQty = perQty * multiplierQty;
        const unit = subItem.unit || "PCS";

        // Fast Stock lookup
        const inv = (sCode && invByCode.get(sCode.toLowerCase())) ||
                    (sName && invByName.get(sName.toLowerCase())) ||
                    null;
        const currentStock = inv ? Number(inv.currentStock || 0) : 0;
        const shortage = Math.max(0, grossQty - currentStock);

        // Fast RM/BO lookup
        const rmBo = (sCode && rmBoByCode.get(sCode.toLowerCase())) ||
                     (sName && rmBoByName.get(sName.toLowerCase())) ||
                     null;
        const rawMat = (sCode && rmByCode.get(sCode.toLowerCase())) ||
                       (sName && rmByName.get(sName.toLowerCase())) ||
                       null;
        const boughtOut = (sCode && boByCode.get(sCode.toLowerCase())) ||
                          (sName && boByName.get(sName.toLowerCase())) ||
                          null;

        // Check if this subItem itself is an FGItem / sub-assembly via fast lookup
        const matchedFG = (sCode && fgByCode.get(sCode.toLowerCase())) ||
                          (sName && fgByName.get(sName.toLowerCase())) ||
                          null;
        const nestedSubBOM = findBOM(sName, sCode, undefined, matchedFG?._id);
        const fgType = matchedFG?.type || subItem.fgType || subItem.itemClassification;
        const isSubAssembly = fgType === "Sub Assembly" || Boolean(nestedSubBOM);
        const isComponent = fgType === "Component";
        const isAssembly = fgType === "Assembly";

        const assignedMasterCat = rawMat?.categoryId?.name || boughtOut?.categoryId?.name || rmBo?.categoryId?.name || rawMat?.category || boughtOut?.category || rmBo?.category || "";
        const catName = (assignedMasterCat || rmBo?.categoryId?.name || rmBo?.category || "").toLowerCase();
        const rawItemType = (rawMat?.itemType || boughtOut?.itemType || rmBo?.itemType || "").toLowerCase();
        const isBO = Boolean(boughtOut) || rawItemType === "bought out" || rawItemType === "bo" || catName.includes("bought") || catName.includes("hardware") || catName.includes("fastener");
        const isConsumable = rawItemType === "consumable" || catName.includes("consumable");

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

        const sDesc = subItem.description || matchedFG?.description || matchedFG?.descriptions || rmBo?.description || rmBo?.descriptions || rawMat?.descriptions || rawMat?.description || boughtOut?.descriptions || boughtOut?.description || "";

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
            material: rmBo?._id || rawMat?._id || boughtOut?._id,
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

        if (isSubAssembly) {
          explodeItemTree(sName, sCode, grossQty, sName, level + 1, nestedList, matchedFG?._id, undefined, sourcePoNumber);
        }
      }
    }
  };

  // Fetch linked Incoming POs to recover exact Customer PO unit prices in INR
  const IncomingPO = req.getModel("IncomingPO", incomingPOSchema);
  const poDocIds = [];
  if (plan.customerPo) poDocIds.push(plan.customerPo);
  if (Array.isArray(plan.customerPOs)) {
    plan.customerPOs.forEach(cp => {
      if (cp.customerPo) poDocIds.push(cp.customerPo);
      if (cp._id && mongoose.Types.ObjectId.isValid(cp._id)) poDocIds.push(cp._id);
    });
  }
  (plan.fgItems || []).forEach(f => {
    if (f.customerPo) poDocIds.push(f.customerPo);
    if (Array.isArray(f.sourceBreakdown)) {
      f.sourceBreakdown.forEach(b => {
        if (b.customerPo && mongoose.Types.ObjectId.isValid(b.customerPo)) poDocIds.push(b.customerPo);
      });
    }
  });

  const poNumbersToQuery = [];
  if (plan.customerPoNumber) {
    plan.customerPoNumber.split(",").map(s => s.trim()).filter(Boolean).forEach(p => poNumbersToQuery.push(p));
  }
  (plan.fgItems || []).forEach(f => {
    if (Array.isArray(f.sourceCustomerPOs)) {
      f.sourceCustomerPOs.forEach(p => { if (p) poNumbersToQuery.push(p); });
    }
    if (Array.isArray(f.sourceBreakdown)) {
      f.sourceBreakdown.forEach(b => { if (b.customerPoNumber) poNumbersToQuery.push(b.customerPoNumber); });
    }
  });

  let linkedCustomerPOs = [];
  if (poDocIds.length > 0 || poNumbersToQuery.length > 0) {
    linkedCustomerPOs = await IncomingPO.find({
      company: companyId,
      $or: [
        poDocIds.length > 0 ? { _id: { $in: poDocIds } } : null,
        poNumbersToQuery.length > 0 ? { poNumber: { $in: poNumbersToQuery } } : null
      ].filter(Boolean)
    }).lean().catch(() => []);
  }

  const customerPoPriceMap = new Map();
  linkedCustomerPOs.forEach(cpo => {
    const cpoCurrency = (cpo.currency || 'INR').trim().toUpperCase();
    const cpoExRate = resolveExchangeRateToINR(cpoCurrency, prefixSettings);

    (cpo.items || []).forEach(item => {
      const rawRate = Number(item.rate || (item.quantity > 0 ? item.amount / item.quantity : 0) || 0);
      const inrRate = Math.round(rawRate * cpoExRate * 100) / 100;
      const entry = {
        customerPo: cpo._id,
        customerPoNumber: cpo.poNumber || "",
        customerName: cpo.customerName || (typeof cpo.customer === 'object' ? cpo.customer?.name : "") || "",
        currency: cpoCurrency,
        originalRate: rawRate,
        exchangeRate: cpoExRate,
        rateInINR: inrRate,
      };

      const fgIdK = item.fgItem ? String(item.fgItem) : null;
      const nameK = cleanStr(item.productName || item.name || item.itemName);
      const codeK = cleanStr(item.productCode || item.code || item.itemCode);
      const poNumK = cleanStr(cpo.poNumber);
      const poIdK = String(cpo._id);

      [fgIdK, nameK, codeK, cleanKey(nameK), cleanKey(codeK)].filter(Boolean).forEach(k => {
        customerPoPriceMap.set(`${poIdK}_${k}`, entry);
        if (poNumK) customerPoPriceMap.set(`${poNumK}_${k}`, entry);
        if (!customerPoPriceMap.has(`general_${k}`)) customerPoPriceMap.set(`general_${k}`, entry);
      });
    });
  });

  // Live PO Item aggregation map for syncing customer PO edits
  const livePoItemMap = new Map();
  if (linkedCustomerPOs.length > 0) {
    linkedCustomerPOs.forEach(cpo => {
      const cpoCurrency = (cpo.currency || 'INR').trim().toUpperCase();
      const cpoExRate = resolveExchangeRateToINR(cpoCurrency, prefixSettings);

      (cpo.items || []).forEach(item => {
        const rawQty = Number(item.quantity || 0);
        if (rawQty <= 0) return;
        const rawRate = Number(item.rate || (rawQty > 0 ? item.amount / rawQty : 0) || 0);
        const inrRate = Math.round(rawRate * cpoExRate * 100) / 100;
        const amtInINR = Math.round(rawQty * inrRate * 100) / 100;

        const breakdownEntry = {
          customerPo: cpo._id,
          customerPoNumber: cpo.poNumber || "",
          customerName: cpo.customerName || (typeof cpo.customer === 'object' ? cpo.customer?.name : "") || "",
          quantity: rawQty,
          currency: cpoCurrency,
          originalRate: rawRate,
          exchangeRate: cpoExRate,
          rateInINR: inrRate,
          amountInINR: amtInINR
        };

        const fgIdK = item.fgItem ? String(item.fgItem) : null;
        const nameK = cleanStr(item.productName || item.name || item.itemName);
        const codeK = cleanStr(item.productCode || item.code || item.itemCode);
        const primaryKey = fgIdK || nameK || codeK;

        if (primaryKey) {
          if (!livePoItemMap.has(primaryKey)) {
            const rawItemName = (item.productName || item.name || item.itemName || item.description || (item.productCode || item.code ? `Item ${item.productCode || item.code}` : "Finished Good")).trim();
            livePoItemMap.set(primaryKey, {
              fgItem: item.fgItem,
              fgItemName: rawItemName,
              fgItemCode: item.productCode || item.code || item.itemCode || "",
              description: item.description || item.descriptions || "",
              unit: item.unit || "PCS",
              quantity: rawQty,
              sourceBreakdown: [breakdownEntry],
              sourceCustomerPOs: cpo.poNumber ? [cpo.poNumber] : [],
              targetDate: item.deliveryDate ? new Date(item.deliveryDate) : (cpo.committedDispatchDate ? new Date(cpo.committedDispatchDate) : undefined),
              poDeliveryDate: cpo.date ? new Date(cpo.date) : undefined
            });
          } else {
            const existing = livePoItemMap.get(primaryKey);
            existing.quantity += rawQty;
            existing.sourceBreakdown.push(breakdownEntry);
            if (cpo.poNumber && !existing.sourceCustomerPOs.includes(cpo.poNumber)) {
              existing.sourceCustomerPOs.push(cpo.poNumber);
            }
            if (item.deliveryDate && (!existing.targetDate || new Date(item.deliveryDate) < existing.targetDate)) {
              existing.targetDate = new Date(item.deliveryDate);
            }
          }
        }
      });
    });

    // Refresh plan.customerPOs with latest live PO header info (currencies, totals, dates)
    if (Array.isArray(plan.customerPOs) && plan.customerPOs.length > 0) {
      plan.customerPOs = plan.customerPOs.map(cpoEntry => {
        const livePO = linkedCustomerPOs.find(p => 
          (cpoEntry.customerPo && String(p._id) === String(cpoEntry.customerPo)) ||
          (cpoEntry.customerPoNumber && p.poNumber === cpoEntry.customerPoNumber)
        );
        if (livePO) {
          const cCode = (livePO.currency || "INR").trim().toUpperCase();
          const exRate = resolveExchangeRateToINR(cCode, prefixSettings);
          const totAmt = Number(livePO.totalAmount || 0);
          return {
            ...cpoEntry,
            customerName: livePO.customerName || (typeof livePO.customer === 'object' ? livePO.customer?.name : "") || cpoEntry.customerName,
            customerPoNumber: livePO.poNumber || cpoEntry.customerPoNumber,
            poDate: livePO.date ? new Date(livePO.date) : cpoEntry.poDate,
            targetDate: livePO.committedDispatchDate ? new Date(livePO.committedDispatchDate) : cpoEntry.targetDate,
            currency: cCode,
            exchangeRate: exRate,
            totalAmount: totAmt,
            totalAmountInINR: Math.round(totAmt * exRate * 100) / 100,
          };
        }
        return cpoEntry;
      });
    }
  }

  // If the plan is Customer PO backed, sync fgItems with live Customer PO line items
  let workingFgItems = options.fgItems && Array.isArray(options.fgItems) && options.fgItems.length > 0 
    ? options.fgItems 
    : (plan.fgItems || []);

  if (livePoItemMap.size > 0) {
    const matchedPoKeys = new Set();
    const syncedList = [];

    workingFgItems.forEach(fg => {
      const fgId = fg.fgItem?._id || fg.fgItem || fg._id;
      const fgIdK = fgId ? String(fgId) : null;
      const nameK = cleanStr(fg.fgItemName || fg.name);
      const codeK = cleanStr(fg.fgItemCode || fg.code);

      const matchedKey = (fgIdK && livePoItemMap.has(fgIdK) && fgIdK) ||
                         (nameK && livePoItemMap.has(nameK) && nameK) ||
                         (codeK && livePoItemMap.has(codeK) && codeK);

      if (matchedKey) {
        const livePOItem = livePoItemMap.get(matchedKey);
        matchedPoKeys.add(matchedKey);
        syncedList.push({
          ...fg,
          quantity: livePOItem.quantity,
          sourceBreakdown: livePOItem.sourceBreakdown,
          sourceCustomerPOs: livePOItem.sourceCustomerPOs,
          targetDate: livePOItem.targetDate || fg.targetDate,
          poDeliveryDate: livePOItem.poDeliveryDate || fg.poDeliveryDate
        });
      } else {
        // Retain manual / internal FG line that was not in Customer PO
        syncedList.push(fg);
      }
    });

    // Add any newly added items from live Customer POs that weren't in workingFgItems
    livePoItemMap.forEach((livePOItem, key) => {
      if (!matchedPoKeys.has(key)) {
        syncedList.push({
          fgItem: livePOItem.fgItem,
          fgItemName: livePOItem.fgItemName,
          fgItemCode: livePOItem.fgItemCode,
          description: livePOItem.description,
          unit: livePOItem.unit,
          quantity: livePOItem.quantity,
          sourceBreakdown: livePOItem.sourceBreakdown,
          sourceCustomerPOs: livePOItem.sourceCustomerPOs,
          targetDate: livePOItem.targetDate,
          poDeliveryDate: livePOItem.poDeliveryDate
        });
      }
    });

    workingFgItems = syncedList;
  }

  // Re-explode all FG items in this plan with their latest BOM
  const enrichedFgItems = [];

  for (const fg of workingFgItems) {
    const fgQty = Number(fg.quantity) || 1;
    const rawName = (fg.fgItemName || fg.name || fg.productName || fg.itemName || fg.description || "").trim();
    const fgCode = (fg.fgItemCode || fg.code || fg.productCode || "").trim();
    const fgId = fg.fgItem?._id || fg.fgItem || fg._id;

    // Refresh FG details from latest master catalog
    const freshFG = (fgId && fgById.get(String(fgId))) ||
                    (rawName && fgByName.get(cleanStr(rawName))) ||
                    (fgCode && fgByCode.get(cleanStr(fgCode))) ||
                    allFGItems.find(
                      (f) => (fgId && f._id && f._id.toString() === fgId.toString()) ||
                             (rawName && f.name && cleanStr(f.name) === cleanStr(rawName)) ||
                             (fgCode && f.code && cleanStr(f.code) === cleanStr(fgCode))
                    );

    const resolvedFGName = (freshFG?.name || rawName || (fgCode ? `Item ${fgCode}` : "") || "Finished Good").trim();
    const resolvedFGCode = freshFG?.code || fgCode;
    const resolvedFGId = freshFG?._id || fgId;
    const resolvedDesc = freshFG?.description || freshFG?.descriptions || fg.description || "";

    const combinedPoNumbers = Array.isArray(fg.sourceCustomerPOs) && fg.sourceCustomerPOs.length > 0
      ? fg.sourceCustomerPOs.join(", ")
      : (fg.customerPoNumber || plan.customerPoNumber || "");

    // Reconstruct sourceBreakdown with full multi-currency and exchange rate details
    let updatedBreakdown = [];
    if (Array.isArray(fg.sourceBreakdown) && fg.sourceBreakdown.length > 0) {
      updatedBreakdown = fg.sourceBreakdown.map(b => {
        const poId = b.customerPo ? String(b.customerPo) : "";
        const poNo = cleanStr(b.customerPoNumber);
        const match = (poId && customerPoPriceMap.get(`${poId}_${fgId}`)) ||
                      (poNo && customerPoPriceMap.get(`${poNo}_${fgId}`)) ||
                      (poId && customerPoPriceMap.get(`${poId}_${cleanStr(resolvedFGName)}`)) ||
                      (poNo && customerPoPriceMap.get(`${poNo}_${cleanStr(resolvedFGName)}`)) ||
                      (poId && customerPoPriceMap.get(`${poId}_${cleanStr(resolvedFGCode)}`)) ||
                      (poNo && customerPoPriceMap.get(`${poNo}_${cleanStr(resolvedFGCode)}`)) ||
                      customerPoPriceMap.get(`general_${fgId}`) ||
                      customerPoPriceMap.get(`general_${cleanStr(resolvedFGName)}`);

        const curr = b.currency || match?.currency || "INR";
        const exRate = b.exchangeRate || match?.exchangeRate || resolveExchangeRateToINR(curr, prefixSettings);
        const origRate = Number(b.originalRate || match?.originalRate || b.rateInINR || b.sellingPrice || 0);
        const inrRate = Number(b.rateInINR || (origRate * exRate) || match?.rateInINR || 0);
        const bQty = Number(b.quantity || 0);
        const amtInINR = Math.round(bQty * inrRate * 100) / 100;

        return {
          customerPo: b.customerPo || match?.customerPo,
          customerPoNumber: b.customerPoNumber || match?.customerPoNumber || "",
          customerName: b.customerName || match?.customerName || "",
          quantity: bQty,
          currency: curr,
          originalRate: origRate,
          exchangeRate: exRate,
          rateInINR: inrRate,
          amountInINR: amtInINR
        };
      });
    } else {
      const match = customerPoPriceMap.get(`general_${fgId}`) ||
                    customerPoPriceMap.get(`general_${cleanStr(resolvedFGName)}`) ||
                    customerPoPriceMap.get(`general_${cleanStr(resolvedFGCode)}`);
      if (match) {
        const amtInINR = Math.round(fgQty * match.rateInINR * 100) / 100;
        updatedBreakdown = [{
          customerPo: match.customerPo,
          customerPoNumber: match.customerPoNumber,
          customerName: match.customerName,
          quantity: fgQty,
          currency: match.currency,
          originalRate: match.originalRate,
          exchangeRate: match.exchangeRate,
          rateInINR: match.rateInINR,
          amountInINR: amtInINR
        }];
      }
    }

    // Compute weighted average selling price in INR
    const totalBreakdownAmountINR = updatedBreakdown.reduce((s, b) => s + (Number(b.amountInINR) || 0), 0);
    const totalBreakdownQty = updatedBreakdown.reduce((s, b) => s + (Number(b.quantity) || 0), 0);

    let resolvedSellingPrice = 0;
    let calculatedTotalPrice = 0;
    let resolvedPriceSource = fg.priceSource || "";
    let resolvedCurrency = "INR";
    let resolvedOriginalPrice = 0;
    let resolvedExchangeRate = 1;

    if (totalBreakdownAmountINR > 0 && totalBreakdownQty > 0) {
      resolvedSellingPrice = Math.round((totalBreakdownAmountINR / totalBreakdownQty) * 100) / 100;
      calculatedTotalPrice = Math.round(totalBreakdownAmountINR * 100) / 100;
      const uniqueCurrs = [...new Set(updatedBreakdown.map(b => b.currency).filter(Boolean))];
      if (uniqueCurrs.length === 1 && uniqueCurrs[0] !== 'INR') {
        resolvedCurrency = uniqueCurrs[0];
        resolvedOriginalPrice = updatedBreakdown[0].originalRate;
        resolvedExchangeRate = updatedBreakdown[0].exchangeRate;
        resolvedPriceSource = `Customer PO (${uniqueCurrs[0]} @ ₹${resolvedExchangeRate})`;
      } else if (uniqueCurrs.length > 1) {
        resolvedCurrency = "MIXED";
        resolvedPriceSource = `Customer PO (Consolidated Multi-Currency: ${uniqueCurrs.join(', ')})`;
      } else {
        resolvedCurrency = "INR";
        resolvedOriginalPrice = resolvedSellingPrice;
        resolvedExchangeRate = 1;
        resolvedPriceSource = "Customer PO";
      }
    } else {
      // For Internal MRP (no Customer PO) or when PO price is not present: check Sales Price List first
      const sMatch = salesPriceMap.get(fgId ? String(fgId) : null) ||
                     salesPriceMap.get(cleanStr(resolvedFGName)) ||
                     salesPriceMap.get(cleanStr(resolvedFGCode)) ||
                     salesPriceMap.get(cleanKey(resolvedFGName)) ||
                     salesPriceMap.get(cleanKey(resolvedFGCode));

      if (sMatch && sMatch.rateInINR > 0) {
        resolvedSellingPrice = sMatch.rateInINR;
        calculatedTotalPrice = Math.round(fgQty * resolvedSellingPrice * 100) / 100;
        resolvedPriceSource = sMatch.priceSource || "Sales Price List";
        resolvedCurrency = sMatch.currency;
        resolvedOriginalPrice = sMatch.price;
        resolvedExchangeRate = sMatch.exchangeRate;
      } else if (Number(fg.sellingPrice || 0) > 0) {
        resolvedSellingPrice = Number(fg.sellingPrice);
        calculatedTotalPrice = Math.round(fgQty * resolvedSellingPrice * 100) / 100;
        resolvedCurrency = fg.currency || "INR";
        resolvedOriginalPrice = fg.originalSellingPrice || resolvedSellingPrice;
        resolvedExchangeRate = fg.exchangeRate || 1;
        resolvedPriceSource = fg.priceSource || "Customer PO";
      } else if (freshFG && Number(freshFG.sellingPrice || freshFG.price || 0) > 0) {
        const mCurr = (freshFG.currency || "INR").trim().toUpperCase();
        const mExRate = resolveExchangeRateToINR(mCurr, prefixSettings);
        resolvedSellingPrice = Math.round(Number(freshFG.sellingPrice || freshFG.price) * mExRate * 100) / 100;
        calculatedTotalPrice = Math.round(fgQty * resolvedSellingPrice * 100) / 100;
        resolvedPriceSource = mCurr !== "INR" ? `Master Catalog (${mCurr} @ ₹${mExRate})` : "Master Catalog";
        resolvedCurrency = mCurr;
        resolvedOriginalPrice = Number(freshFG.sellingPrice || freshFG.price);
        resolvedExchangeRate = mExRate;
      }
    }

    const bomDoc = findBOM(resolvedFGName, resolvedFGCode, fg.bomId, resolvedFGId);
    const nestedMaterials = [];

    explodeItemTree(resolvedFGName, resolvedFGCode, fgQty, resolvedFGName, 1, nestedMaterials, resolvedFGId, fg.bomId, combinedPoNumbers);

    enrichedFgItems.push({
      fgItem: resolvedFGId,
      fgItemName: resolvedFGName,
      fgItemCode: resolvedFGCode,
      description: resolvedDesc,
      quantity: fgQty,
      receivedQuantity: Number(fg.receivedQuantity) || 0,
      unit: fg.unit || freshFG?.unit || "PCS",
      sellingPrice: resolvedSellingPrice,
      totalPrice: calculatedTotalPrice,
      currency: resolvedCurrency,
      originalSellingPrice: resolvedOriginalPrice,
      exchangeRate: resolvedExchangeRate,
      priceSource: resolvedPriceSource || (combinedPoNumbers ? "Customer PO" : "Sales Price List"),
      poDeliveryDate: fg.poDeliveryDate ? new Date(fg.poDeliveryDate) : undefined,
      targetDate: fg.targetDate ? new Date(fg.targetDate) : undefined,
      customerPo: fg.customerPo || undefined,
      customerPoNumber: combinedPoNumbers,
      customerName: fg.customerName || plan.customerName || "",
      bomId: bomDoc?._id || fg.bomId,
      bomNumber: bomDoc?.bomNumber || (nestedMaterials.length > 0 ? "BOM-Active" : "BOM-Auto"),
      sourceBreakdown: updatedBreakdown,
      sourceCustomerPOs: fg.sourceCustomerPOs || [],
      nestedMaterials: nestedMaterials,
    });
  }

  // Reconcile procurement state from existing requirements into new requirements
  const reconcileReqList = (reqMap) => {
    reqMap.forEach((req, key) => {
      const prev = oldReqMap.get(key) || oldReqMap.get(cleanStr(req.materialName)) || oldReqMap.get(cleanStr(req.materialCode));
      if (prev) {
        if (prev.status && prev.status !== "Pending") req.status = prev.status;
        if (prev.poNumber) req.poNumber = prev.poNumber;
        if (prev.rfqNumber) req.rfqNumber = prev.rfqNumber;
        if (prev.orderedQuantity) req.orderedQuantity = Number(prev.orderedQuantity) || 0;
        if (prev.receivedQuantity) req.receivedQuantity = Number(prev.receivedQuantity) || 0;
        if (prev.preferredVendor) req.preferredVendor = prev.preferredVendor;
        if (prev.preferredVendorName) req.preferredVendorName = prev.preferredVendorName;

        const ordered = req.orderedQuantity || (inTransitPoQtyMap.get(key) || 0);
        req.shortage = Math.max(0, req.requiredQuantity - req.currentStock - ordered);
      }
    });
  };

  reconcileReqList(rmMap);
  reconcileReqList(boMap);
  reconcileReqList(subAssemblyMap);
  reconcileReqList(consumableMap);

  // Preserve removed items that have active Purchase Orders so they are not orphaned
  const preserveRemovedWithPOs = (oldList, targetMap, itemType) => {
    (oldList || []).forEach((oldItem) => {
      const k = (oldItem.materialCode || oldItem.materialName || "").toLowerCase();
      if (!targetMap.has(k) && (oldItem.orderedQuantity > 0 || oldItem.poNumber || oldItem.status === "PO Raised")) {
        targetMap.set(k, {
          material: oldItem.material,
          materialName: oldItem.materialName,
          materialCode: oldItem.materialCode,
          description: oldItem.description || "(Retained: PO active, removed from latest BOM)",
          category: oldItem.category || "Retained Active Item",
          itemType: oldItem.itemType || itemType,
          requiredQuantity: 0,
          currentStock: oldItem.currentStock || 0,
          shortage: 0,
          unit: oldItem.unit || "PCS",
          status: oldItem.status || "PO Raised",
          poNumber: oldItem.poNumber || "",
          rfqNumber: oldItem.rfqNumber || "",
          orderedQuantity: oldItem.orderedQuantity || 0,
          receivedQuantity: oldItem.receivedQuantity || 0,
          preferredVendor: oldItem.preferredVendor,
          preferredVendorName: oldItem.preferredVendorName,
          sourceFGNames: oldItem.sourceFGNames || [],
          sourceCustomerPOs: oldItem.sourceCustomerPOs || []
        });
      }
    });
  };

  preserveRemovedWithPOs(plan.rmRequirements, rmMap, "RM");
  preserveRemovedWithPOs(plan.boRequirements, boMap, "BO");

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
      if (pricing.preferredVendor && !r.preferredVendor) r.preferredVendor = pricing.preferredVendor;
      if (pricing.preferredVendorName && !r.preferredVendorName) r.preferredVendorName = pricing.preferredVendorName;

      r.grossCost = Math.round(Number(r.requiredQuantity || 0) * r.unitCost * 100) / 100;
      r.shortageCost = Math.round(Number(r.shortage || 0) * r.unitCost * 100) / 100;

      totalGrossMaterialCost += r.grossCost;
      totalEstimatedExpense += r.shortageCost;
    });
  };

  populateReqPricing(rmRequirements);
  populateReqPricing(boRequirements);
  populateReqPricing(consumableRequirements);

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

  // 5. Total Income from FG items (preserving Customer PO selling rates)
  totalIncome = Math.round(totalIncome * 100) / 100;
  totalGrossMaterialCost = Math.round(totalGrossMaterialCost * 100) / 100;
  totalEstimatedExpense = Math.round(totalEstimatedExpense * 100) / 100;

  // 6. Committed Expense from linked active Outward POs
  const committedExpense = Math.round(
    openPOs.reduce((sum, po) => {
      const amt = Number(po.grandTotal != null ? po.grandTotal : (po.totalAmount != null ? po.totalAmount : 0)) || 0;
      return sum + amt;
    }, 0) * 100
  ) / 100;

  const targetExpense = Number(plan.targetExpense || 0);
  const effectiveExpense = committedExpense > 0 ? committedExpense : totalEstimatedExpense;

  let budgetStatus = "Unset";
  if (targetExpense > 0) {
    if (effectiveExpense > targetExpense) {
      budgetStatus = "Over Budget";
    } else if (effectiveExpense >= targetExpense * 0.85) {
      budgetStatus = "Near Limit";
    } else {
      budgetStatus = "Within Budget";
    }
  }

  const projectedGrossProfit = Math.round((totalIncome - (committedExpense > 0 ? committedExpense : totalGrossMaterialCost)) * 100) / 100;
  const projectedMarginPercentage = totalIncome > 0
    ? Math.round((projectedGrossProfit / totalIncome) * 10000) / 100
    : 0;

  // Update plan fields
  plan.fgItems = enrichedFgItems;
  plan.rmRequirements = rmRequirements;
  plan.boRequirements = boRequirements;
  plan.subAssemblyRequirements = subAssemblyRequirements;
  plan.consumableRequirements = consumableRequirements;
  plan.totalIncome = totalIncome;
  plan.totalGrossMaterialCost = totalGrossMaterialCost;
  plan.totalEstimatedExpense = totalEstimatedExpense;
  plan.committedExpense = committedExpense;
  plan.projectedGrossProfit = projectedGrossProfit;
  plan.projectedMarginPercentage = projectedMarginPercentage;
  plan.budgetStatus = budgetStatus;
  plan.bomSyncedAt = new Date();
  plan.isBOMOutdated = false;

  await plan.save();
  return plan;
};

/**
 * Synchronize MRP Plan Financials & Outward PO Commitments:
 * - Aggregates all linked outward Purchase Orders to calculate committedExpense
 * - Reconciles orderedQuantity, receivedQuantity, and status on RM/BO requirements
 * - Updates material unitCost using actual contracted outward PO rates if available
 * - Recomputes totalIncome, totalGrossMaterialCost, totalEstimatedExpense
 * - Dynamically evaluates budgetStatus (Within Budget, Near Limit, Over Budget, Unset)
 * - Computes projectedGrossProfit and projectedMarginPercentage
 */
export const syncMRPPlanFinancials = async (planDocOrId, req) => {
  const companyId = getCompanyId(req) || (planDocOrId?.company?._id || planDocOrId?.company);
  const MRPPlan = req.getModel("MRPPlan", mrpPlanSchema);
  const PurchaseOrder = req.getModel("PurchaseOrder", purchaseOrderSchema);

  let plan = planDocOrId;
  if (typeof planDocOrId === "string" || planDocOrId instanceof mongoose.Types.ObjectId) {
    plan = await MRPPlan.findOne({
      company: companyId,
      $or: [
        { _id: mongoose.isValidObjectId(planDocOrId) ? planDocOrId : undefined },
        { mrpNumber: String(planDocOrId) }
      ].filter(Boolean)
    });
  }
  if (!plan) return null;

  // 1. Fetch all active outward Purchase Orders linked to this MRP Plan
  const linkedPOs = await PurchaseOrder.find({
    company: companyId,
    $or: [
      { mrpPlanId: plan._id },
      { mrpNumber: plan.mrpNumber }
    ],
    status: { $nin: ["Cancelled"] }
  }).lean().catch(() => []);

  // 2. Compute committedExpense (sum of grand totals of all valid outward POs)
  const committedExpense = Math.round(
    linkedPOs.reduce((sum, po) => {
      const amt = Number(po.grandTotal != null ? po.grandTotal : (po.totalAmount != null ? po.totalAmount : 0)) || 0;
      return sum + amt;
    }, 0) * 100
  ) / 100;

  // 3. Build item-level lookup from linked outward POs
  const poItemLookup = new Map();
  linkedPOs.forEach(po => {
    (po.items || []).forEach(item => {
      const nameK = cleanStr(item.materialName || item.itemName);
      const codeK = cleanStr(item.materialCode || item.itemCode);
      const matIdK = item.material ? String(item.material) : null;
      const rate = Number(item.rate || 0);
      const qty = Number(item.quantity || 0);
      const recQty = Number(item.receivedQuantity || 0);

      const entry = {
        poNumber: po.poNumber,
        rate,
        orderedQuantity: qty,
        receivedQuantity: recQty
      };

      [nameK, codeK, cleanKey(nameK), cleanKey(codeK), matIdK].filter(Boolean).forEach(k => {
        if (!poItemLookup.has(k)) {
          poItemLookup.set(k, { ...entry });
        } else {
          const existing = poItemLookup.get(k);
          existing.orderedQuantity += qty;
          existing.receivedQuantity += recQty;
          if (rate > 0) existing.rate = rate;
        }
      });
    });
  });

  // 4. Reconcile requirements and recalculate costs
  let totalGrossMaterialCost = 0;
  let totalEstimatedExpense = 0;

  const reconcileList = (reqList) => {
    (reqList || []).forEach(r => {
      const k1 = cleanStr(r.materialName);
      const k2 = cleanStr(r.materialCode);
      const mId = r.material ? String(r.material) : null;
      const poData = poItemLookup.get(mId) || poItemLookup.get(k1) || poItemLookup.get(k2) || poItemLookup.get(cleanKey(k1)) || poItemLookup.get(cleanKey(k2));

      if (poData) {
        if (poData.poNumber) r.poNumber = poData.poNumber;
        if (poData.orderedQuantity > 0) r.orderedQuantity = poData.orderedQuantity;
        if (poData.receivedQuantity > 0) r.receivedQuantity = poData.receivedQuantity;
        if (poData.rate > 0) {
          r.unitCost = poData.rate;
          r.costSource = `Contracted PO Rate (${poData.poNumber})`;
        }
        if (r.receivedQuantity >= r.requiredQuantity && r.requiredQuantity > 0) {
          r.status = "Completed";
        } else if (r.orderedQuantity > 0 || r.poNumber) {
          r.status = "PO Raised";
        }
      }

      const reqQty = Number(r.requiredQuantity || 0);
      const stockQty = Number(r.currentStock || r.stockQuantity || 0);
      const ordQty = Number(r.orderedQuantity || 0);
      r.shortage = Math.max(0, reqQty - stockQty - ordQty);

      const unitCost = Number(r.unitCost || 0);
      r.grossCost = Math.round(reqQty * unitCost * 100) / 100;
      r.shortageCost = Math.round(r.shortage * unitCost * 100) / 100;

      totalGrossMaterialCost += r.grossCost;
      totalEstimatedExpense += r.shortageCost;
    });
  };

  reconcileList(plan.rmRequirements);
  reconcileList(plan.boRequirements);
  reconcileList(plan.subAssemblyRequirements);
  reconcileList(plan.consumableRequirements);

  // Reconcile nestedMaterials on fgItems
  (plan.fgItems || []).forEach(fg => {
    if (Array.isArray(fg.nestedMaterials)) {
      fg.nestedMaterials.forEach(nm => {
        const k1 = cleanStr(nm.materialName);
        const k2 = cleanStr(nm.materialCode);
        const poData = poItemLookup.get(k1) || poItemLookup.get(k2) || poItemLookup.get(cleanKey(k1)) || poItemLookup.get(cleanKey(k2));
        if (poData) {
          if (poData.poNumber) nm.poNumber = poData.poNumber;
          if (poData.rate > 0) {
            nm.unitCost = poData.rate;
            nm.costSource = `Contracted PO Rate (${poData.poNumber})`;
          }
          if (poData.receivedQuantity >= (Number(nm.totalRequired) || 0) && (Number(nm.totalRequired) || 0) > 0) {
            nm.status = "Completed";
          } else if (poData.orderedQuantity > 0 || poData.poNumber) {
            nm.status = "PO Raised";
          }
        }
        const unitCost = Number(nm.unitCost || 0);
        nm.grossCost = Math.round((Number(nm.totalRequired) || 0) * unitCost * 100) / 100;
        nm.shortageCost = Math.round((Number(nm.shortage) || 0) * unitCost * 100) / 100;
      });
    }
  });

  // 5. Total Income from FG items (preserving Customer PO selling rates)
  let totalIncome = (plan.fgItems || []).reduce((sum, f) => sum + (Number(f.totalPrice) || (Number(f.quantity || 0) * Number(f.sellingPrice || 0))), 0);
  totalIncome = Math.round(totalIncome * 100) / 100;
  totalGrossMaterialCost = Math.round(totalGrossMaterialCost * 100) / 100;
  totalEstimatedExpense = Math.round(totalEstimatedExpense * 100) / 100;

  // 6. Dynamic Budget Status
  const targetExpense = Number(plan.targetExpense || 0);
  const effectiveExpense = committedExpense > 0 ? committedExpense : totalEstimatedExpense;

  let budgetStatus = "Unset";
  if (targetExpense > 0) {
    if (effectiveExpense > targetExpense) {
      budgetStatus = "Over Budget";
    } else if (effectiveExpense >= targetExpense * 0.85) {
      budgetStatus = "Near Limit";
    } else {
      budgetStatus = "Within Budget";
    }
  }

  // 7. Projected Profit & Margin
  const projectedGrossProfit = Math.round((totalIncome - (committedExpense > 0 ? committedExpense : totalGrossMaterialCost)) * 100) / 100;
  const projectedMarginPercentage = totalIncome > 0
    ? Math.round((projectedGrossProfit / totalIncome) * 10000) / 100
    : 0;

  plan.committedExpense = committedExpense;
  plan.totalIncome = totalIncome;
  plan.totalGrossMaterialCost = totalGrossMaterialCost;
  plan.totalEstimatedExpense = totalEstimatedExpense;
  plan.budgetStatus = budgetStatus;
  plan.projectedGrossProfit = projectedGrossProfit;
  plan.projectedMarginPercentage = projectedMarginPercentage;

  await plan.save();
  return plan;
};

/**
 * Controller to trigger explicit BOM sync for a single MRP Plan
 */
export const syncMRPPlanBOM = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedPlan = await recalculateMRPWithLatestBOM(id, req, { force: true });
    if (!updatedPlan) {
      return res.status(404).json({ success: false, message: "MRP Plan not found" });
    }

    res.status(200).json({
      success: true,
      message: `MRP Plan ${updatedPlan.mrpNumber} synchronized successfully with latest BOM configurations, Customer PO data, and Sales Price Lists`,
      mrpPlan: updatedPlan
    });
  } catch (error) {
    console.error("Error syncing MRP Plan BOM:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to sync MRP Plan BOM" });
  }
};

/**
 * Controller to bulk sync all active MRP Plans with latest FG BOMs
 */
export const syncAllMRPPlansBOM = async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const MRPPlan = req.getModel("MRPPlan", mrpPlanSchema);
    const activePlans = await MRPPlan.find({
      company: companyId,
      status: { $in: ["Planned", "In Procurement", "Draft", "Partially Completed"] }
    });

    const synced = [];
    for (const p of activePlans) {
      try {
        const syncedPlan = await recalculateMRPWithLatestBOM(p, req);
        if (syncedPlan) synced.push(syncedPlan.mrpNumber);
      } catch (err) {
        console.warn(`Failed to sync MRP Plan ${p.mrpNumber}:`, err);
      }
    }

    res.status(200).json({
      success: true,
      message: `Synchronized ${synced.length} active MRP plans with latest BOM configurations`,
      syncedMrpNumbers: synced
    });
  } catch (error) {
    console.error("Error bulk syncing MRP plans:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to bulk sync MRP plans" });
  }
};


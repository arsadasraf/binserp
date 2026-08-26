import mongoose from "mongoose";
import { 
  jobWorkSchema, 
  jobWorkSupplierSchema, 
  vendorSchema, 
  rmBoItemSchema, 
  rawMaterialSchema, 
  boughtOutSchema, 
  categorySchema, 
  materialIssueSchema, 
  fgGRNSchema, 
  grnSchema,
  bomSchema, 
  fgItemSchema,
  inventorySchema
} from "../../models/store/index.js";
import { mrpPlanSchema } from "../../models/purchase/index.js";
import { componentSchema } from "../../models/ppc/index.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

export const getWipInventory = async (req, res) => {
  try {
    const JobWorkChallan = req.getModel("JobWorkChallan", jobWorkSchema);
    const MaterialIssue = req.getModel("MaterialIssue", materialIssueSchema);
    const FGGRN = req.getModel("FGGRN", fgGRNSchema);
    const GRN = req.getModel("GRN", grnSchema);
    const BOM = req.getModel("BOM", bomSchema);
    const MRPPlan = req.getModel("MRPPlan", mrpPlanSchema);
    const RawMaterial = req.getModel("RawMaterial", rawMaterialSchema);
    const BoughtOut = req.getModel("BoughtOut", boughtOutSchema);
    const RmBoItem = req.getModel("RmBoItem", rmBoItemSchema);
    const FGItem = req.getModel("FGItem", fgItemSchema);
    const Component = req.getModel("Component", componentSchema);
    const Category = req.getModel("Category", categorySchema);
    const Inventory = req.getModel("Inventory", inventorySchema);

    // Register referenced models
    req.getModel("Vendor", vendorSchema);
    req.getModel("JobWorkSupplier", jobWorkSupplierSchema);

    const companyId = getCompanyId(req);
    const requestedType = (req.query.type || "rm").toLowerCase(); // 'rm', 'bo', 'fg', 'mrp-buckets', 'ledger'

    // 1. Load All Master Items across all categories and live Main Store Inventory
    const [rawMaterialsList, boughtOutsList, rmBoList, fgItemsList, componentsList, categoriesList, inventoryList] = await Promise.all([
      RawMaterial.find({ company: companyId }).populate("categoryId", "name").lean(),
      BoughtOut.find({ company: companyId }).populate("categoryId", "name").lean(),
      RmBoItem.find({ company: companyId }).populate("categoryId", "name").lean(),
      FGItem.find({ company: companyId }).lean(),
      Component.find({ company: companyId }).lean(),
      Category.find({ company: companyId }).lean(),
      Inventory.find({ company: companyId }).lean()
    ]);

    const categoryMap = new Map(categoriesList.map(c => [c._id.toString(), c.name]));

    // Build Live Stock Lookup Maps from Main Store Inventory
    const inventoryByMaterialId = new Map();
    const inventoryByCode = new Map();
    const inventoryByName = new Map();

    (inventoryList || []).forEach(inv => {
      const stock = Number(inv.currentStock || 0);
      if (inv.materialId) {
        inventoryByMaterialId.set(inv.materialId.toString(), stock);
      }
      if (inv._id) {
        inventoryByMaterialId.set(inv._id.toString(), stock);
      }
      if (inv.materialCode) {
        inventoryByCode.set(inv.materialCode.trim().toLowerCase(), stock);
      }
      if (inv.materialName) {
        inventoryByName.set(inv.materialName.trim().toLowerCase(), stock);
      }
    });

    // 2. Load FG GRNs, in-house receipts, BOMs, and MRP Plans
    const [allFGGRNs, allInHouseGRNs, allBOMs, allMRPPlans, materialIssues, challans] = await Promise.all([
      FGGRN.find({ company: companyId, status: { $in: ["Received", "Accepted"] } }).lean(),
      GRN.find({ company: companyId, type: { $in: ["inhouse", "fg"] }, status: { $in: ["Received", "Accepted"] } }).lean(),
      BOM.find({ company: companyId }).lean(),
      MRPPlan.find({ company: companyId }).lean(),
      MaterialIssue.find({ company: companyId }).populate("issuedTo", "name userId department").sort({ date: -1 }).lean(),
      JobWorkChallan.find({ company: companyId }).populate("vendor").sort({ date: -1 }).lean()
    ]);

    // Build Master WIP Registry Map (Key: material ID or clean material key)
    const masterWipMap = new Map();
    const allTransactionsLedger = [];

    // Helper to resolve live store stock
    const getLiveStoreStock = (item, id, code, name) => {
      if (id && inventoryByMaterialId.has(id)) {
        return inventoryByMaterialId.get(id);
      }
      const cleanCode = (code || '').trim().toLowerCase();
      if (cleanCode && inventoryByCode.has(cleanCode)) {
        return inventoryByCode.get(cleanCode);
      }
      const cleanName = (name || '').trim().toLowerCase();
      if (cleanName && inventoryByName.has(cleanName)) {
        return inventoryByName.get(cleanName);
      }
      return Number(item.currentStock ?? item.quantity ?? 0);
    };

    // Helper to register master item in WIP registry
    const registerMasterItem = (item, type) => {
      const id = item._id ? item._id.toString() : "";
      const name = item.name || item.componentName || item.materialName || "Item";
      const code = item.code || item.componentCode || item.materialCode || "";
      const desc = item.descriptions || item.description || item.specification || item.grade || item.remarks || "";
      let catName = (typeof item.categoryId === 'object' && item.categoryId?.name) 
        ? item.categoryId.name 
        : (item.category?.name || categoryMap.get(item.categoryId?.toString()) || categoryMap.get(item.category?.toString()) || (typeof item.category === 'string' ? item.category : ''));

      if (!catName || catName === 'Finished Goods' || catName === 'General') {
        if (type === 'fg') {
          const rawType = String(item.type || item.fgType || item.componentType || '').trim();
          if (rawType.toLowerCase().includes('sub')) {
            catName = "Sub-Assembly";
          } else if (rawType.toLowerCase().includes('assembly')) {
            catName = "Assembly";
          } else if (rawType.toLowerCase().includes('component')) {
            catName = "Component";
          } else {
            catName = rawType || "Component";
          }
        } else if (type === 'rm') {
          catName = "Raw Material";
        } else if (type === 'bo') {
          catName = "Bought Out";
        }
      }
      const unit = item.unit || "PCS";
      const storeStock = getLiveStoreStock(item, id, code, name);

      const key = `${type}_${id || name.trim().toLowerCase()}`;
      if (!masterWipMap.has(key)) {
        masterWipMap.set(key, {
          id: key,
          materialId: id,
          materialCode: code,
          materialName: name,
          materialDescription: desc,
          categoryName: catName,
          itemType: type, // 'rm', 'bo', 'fg'
          categoryType: type === "rm" ? "Raw Material (RM)" : type === "bo" ? "Bought Out (BO)" : "Finished Goods (FG)",
          unit: unit,
          mainStoreStock: storeStock,
          totalIssuedQty: 0,
          totalJobWorkSentQty: 0,
          totalJobWorkReturnedQty: 0,
          totalReturnedQty: 0,
          totalFgConsumedQty: 0,
          shopfloorWipQty: 0,
          pendingQcQty: 0,
          jobWorkWipQty: 0,
          pendingWipQty: 0,
          lastMovementDate: item.updatedAt || item.createdAt || new Date(),
          transactions: []
        });
      }
      return key;
    };

    // Register all Master RM items
    rawMaterialsList.forEach(r => registerMasterItem(r, 'rm'));
    rmBoList.filter(m => (m.itemType || '').toLowerCase() === 'raw material' || (m.itemType || '').toLowerCase() === 'rm').forEach(r => registerMasterItem(r, 'rm'));

    // Register all Master BO items
    boughtOutsList.forEach(b => registerMasterItem(b, 'bo'));
    rmBoList.filter(m => (m.itemType || '').toLowerCase() === 'bought out' || (m.itemType || '').toLowerCase() === 'bo' || (m.code || '').toUpperCase().startsWith('BO-')).forEach(b => registerMasterItem(b, 'bo'));

    // Register all Master FG & In-House Components
    fgItemsList.forEach(f => registerMasterItem(f, 'fg'));
    componentsList.forEach(c => registerMasterItem(c, 'fg'));

    // Also register items from Main Store Inventory that haven't been registered yet
    (inventoryList || []).forEach(inv => {
      const itemTypeStr = (inv.itemType || '').toLowerCase();
      let type = 'rm';
      if (itemTypeStr.includes('bought') || itemTypeStr === 'bo' || (inv.materialCode || '').toUpperCase().startsWith('BO-')) {
        type = 'bo';
      } else if (itemTypeStr.includes('finish') || itemTypeStr === 'fg' || itemTypeStr.includes('component')) {
        type = 'fg';
      }
      registerMasterItem({
        _id: inv.materialId || inv._id,
        name: inv.materialName,
        code: inv.materialCode,
        categoryId: inv.categoryId,
        unit: inv.unit,
        currentStock: inv.currentStock
      }, type);
    });

    // 3. Pre-populate MRP WIP Buckets Map
    const mrpBucketMap = new Map();
    allMRPPlans.forEach(plan => {
      const mrpNum = plan.mrpNumber || "";
      const mrpKey = mrpNum.trim().toLowerCase();
      if (mrpKey && !mrpBucketMap.has(mrpKey)) {
        mrpBucketMap.set(mrpKey, {
          mrpNumber: mrpNum,
          mrpPlanId: plan._id,
          customerName: plan.customerName || plan.remarks || "General Production",
          originalStatus: plan.status || "Planned",
          status: plan.status || "Planned",
          planDate: plan.date || plan.createdAt,
          lastMovementDate: plan.date || plan.createdAt,
          totalRmIssued: 0,
          totalBoIssued: 0,
          totalFgIssued: 0,
          totalFgProduced: 0,
          itemsInWip: new Map(),
          transactions: []
        });
      }
    });

    // Helper to find existing master item in WIP registry
    const findWipEntry = (rawId, name, code, type) => {
      const idStr = rawId ? rawId.toString() : "";
      if (idStr && masterWipMap.has(`${type}_${idStr}`)) {
        return masterWipMap.get(`${type}_${idStr}`);
      }
      for (const entry of masterWipMap.values()) {
        if (entry.itemType === type) {
          if (idStr && entry.materialId === idStr) return entry;
          if (code && entry.materialCode && entry.materialCode.trim().toLowerCase() === code.trim().toLowerCase()) return entry;
          if (name && entry.materialName && entry.materialName.trim().toLowerCase() === name.trim().toLowerCase()) return entry;
        }
      }
      // If not found, dynamically create entry
      const dynamicKey = registerMasterItem({ _id: idStr, name, code, unit: 'PCS' }, type);
      return masterWipMap.get(dynamicKey);
    };

    // 4. Process Material Issues (Store Issues into WIP Inward)
    materialIssues.forEach((issue) => {
      if (issue.type === "consumable") return; // Consumables excluded from WIP

      const issueDept = issue.department || issue.issuedTo?.department || "Shop Floor Assembly";
      const mrpNumber = issue.mrpNumber || "";
      const issueDate = issue.date || issue.createdAt;
      const docNo = issue.issueNumber || `ISS-${issue._id.toString().slice(-6)}`;

      (issue.items || []).forEach((item) => {
        const itemTypeStr = (issue.type || item.itemType || '').toLowerCase();
        let targetType = 'rm';
        if (itemTypeStr === 'bo' || itemTypeStr === 'bought out' || (item.materialCode || '').toUpperCase().startsWith('BO-')) {
          targetType = 'bo';
        } else if (itemTypeStr === 'fg' || itemTypeStr === 'inhouse' || itemTypeStr === 'component') {
          targetType = 'fg';
        }

        const matName = item.materialName || "Issued Material";
        const matCode = item.materialCode || "";
        const rawId = item.material || item.consumable || item.fgItem || item.component || item._id;
        const qty = Number(item.quantity) || 0;
        const unit = item.unit || "PCS";

        const entry = findWipEntry(rawId, matName, matCode, targetType);
        if (entry) {
          entry.totalIssuedQty += qty;
          entry.shopfloorWipQty += qty;
          entry.pendingWipQty = entry.shopfloorWipQty + entry.jobWorkWipQty;

          if (new Date(issueDate) > new Date(entry.lastMovementDate)) {
            entry.lastMovementDate = issueDate;
          }

          const tx = {
            date: issueDate,
            type: "Store Material Issue (WIP Inward)",
            docNumber: docNo,
            mrpNumber: mrpNumber,
            sentQty: qty,
            receivedQty: 0,
            unit: unit,
            processType: `Store Issue to ${issueDept}`,
            vendorName: issueDept,
            status: "Issued"
          };
          entry.transactions.push(tx);

          allTransactionsLedger.push({
            ...tx,
            materialName: entry.materialName,
            materialCode: entry.materialCode,
            itemType: entry.itemType,
            categoryType: entry.categoryType
          });
        }

        // Aggregate into MRP WIP Plan
        if (mrpNumber) {
          const mrpKey = mrpNumber.trim().toLowerCase();
          if (!mrpBucketMap.has(mrpKey)) {
            mrpBucketMap.set(mrpKey, {
              mrpNumber: mrpNumber,
              customerName: "Production Order",
              originalStatus: "In Production",
              status: "In Production",
              planDate: issueDate,
              lastMovementDate: issueDate,
              totalRmIssued: 0,
              totalBoIssued: 0,
              totalFgIssued: 0,
              totalFgProduced: 0,
              itemsInWip: new Map(),
              transactions: []
            });
          }

          const bucket = mrpBucketMap.get(mrpKey);
          if (targetType === 'rm') bucket.totalRmIssued += qty;
          else if (targetType === 'bo') bucket.totalBoIssued += qty;
          else if (targetType === 'fg') bucket.totalFgIssued += qty;

          const itemMapKey = `${matName}_${targetType}`;
          if (!bucket.itemsInWip.has(itemMapKey)) {
            bucket.itemsInWip.set(itemMapKey, {
              materialName: matName,
              materialCode: matCode,
              itemType: targetType,
              category: targetType === 'rm' ? 'Raw Material' : targetType === 'bo' ? 'Bought Out' : 'FG / Component',
              unit: unit,
              issuedQty: 0,
              consumedQty: 0,
              pendingQty: 0
            });
          }
          const itemRecord = bucket.itemsInWip.get(itemMapKey);
          itemRecord.issuedQty += qty;
          itemRecord.pendingQty = Math.max(0, itemRecord.issuedQty - itemRecord.consumedQty);

          bucket.transactions.push({
            date: issueDate,
            type: "Material Issue into WIP",
            docNumber: docNo,
            materialName: matName,
            itemType: targetType,
            qty: qty,
            unit: unit
          });
        }
      });
    });

    // 5. Process Job Work Challans (Subcontractor Outward / Inward across all 3 Types)
    challans.forEach((challan) => {
      const vendorObj = challan.vendor || { name: challan.vendorName || "Subcontractor" };
      const vendorName = vendorObj.name || "Subcontractor";
      const challanDate = challan.date || challan.createdAt;
      const docNo = challan.challanNumber;
      const mrpNumber = challan.mrpNumber || "";
      const jwType = challan.jobWorkType || "store-conversion";

      (challan.items || []).forEach((sentItem) => {
        const sentName = sentItem.itemName || "Sent Material";
        const sentQty = Number(sentItem.quantitySent) || 0;
        const processType = sentItem.processType || "Job Work";
        const unit = sentItem.unit || "PCS";
        const sentRawType = (sentItem.itemType || (jwType === "wip-to-wip" ? "fg" : "rm")).toLowerCase();
        const sentTargetType = (sentRawType === "bo" || sentRawType === "bought out") ? "bo" : (sentRawType === "fg" || sentRawType === "inhouse" || sentRawType === "component" || jwType === "wip-to-wip") ? "fg" : "rm";

        const retList = Array.isArray(sentItem.returningItems) && sentItem.returningItems.length > 0
          ? sentItem.returningItems
          : [{
              receivedItem: sentItem.receivedItem,
              receivedItemName: sentItem.receivedItemName || sentItem.itemToBeReceived || sentName,
              receivedItemType: sentItem.receivedItemType || (jwType === "store-conversion" ? "rm" : "fg"),
              quantityToBeReceived: Number(sentItem.quantityToBeReceived || sentItem.quantitySent) || 0,
              quantityReceived: Number(sentItem.quantityReceived) || 0
            }];

        const expectedQty = retList.reduce((acc, r) => acc + (Number(r.quantityToBeReceived) || 0), 0) || sentQty;
        const receivedQty = retList.reduce((acc, r) => acc + (Number(r.quantityReceived) || 0), 0);
        const netJobWorkPending = Math.max(0, expectedQty - receivedQty);

        // Find entry for dispatched outward material
        const entry = findWipEntry(sentItem.item, sentName, null, sentTargetType);
        if (entry) {
          entry.totalJobWorkSentQty += sentQty;
          entry.totalJobWorkReturnedQty += receivedQty;
          entry.jobWorkWipQty += netJobWorkPending;

          // For WIP-to-WIP: Dispatched item was taken out from Shopfloor WIP
          if (jwType === "wip-to-wip") {
            entry.shopfloorWipQty = Math.max(0, entry.shopfloorWipQty - sentQty);
          }

          if (new Date(challanDate) > new Date(entry.lastMovementDate)) {
            entry.lastMovementDate = challanDate;
          }

          const txOut = {
            date: challanDate,
            type: jwType === "wip-to-wip" ? "WIP-to-WIP Subcontractor Dispatch" : (jwType === "store-to-wip" ? "Store-to-WIP Subcontractor Dispatch" : "RM Conversion Subcontractor Dispatch"),
            docNumber: docNo,
            mrpNumber: mrpNumber,
            ewayBillNo: challan.ewayBillNo || "",
            sentQty: sentQty,
            receivedQty: 0,
            unit: unit,
            processType: `Subcontractor: ${processType}`,
            vendorName: vendorName,
            status: challan.status
          };
          entry.transactions.push(txOut);

          allTransactionsLedger.push({
            ...txOut,
            materialName: entry.materialName,
            materialCode: entry.materialCode,
            itemType: entry.itemType,
            categoryType: entry.categoryType
          });
        }

        // For Store-to-WIP & WIP-to-WIP: QC-governed return back to Shopfloor WIP
        if (jwType === "store-to-wip" || jwType === "wip-to-wip") {
          retList.forEach((ret) => {
            const retName = ret.receivedItemName || sentName;
            const fgEntry = findWipEntry(ret.receivedItem, retName, null, "fg");
            if (!fgEntry) return;

            if (Array.isArray(challan.receiveHistory) && challan.receiveHistory.length > 0) {
              const matchingHist = challan.receiveHistory.filter(h => 
                (ret.receivedItem && (String(h.returningItemId) === String(ret.receivedItem) || String(h.itemId) === String(ret.receivedItem))) ||
                (h.itemName && h.itemName.toLowerCase() === retName.toLowerCase())
              );

              if (matchingHist.length > 0) {
                matchingHist.forEach(h => {
                  const isQcActive = h.qcRequired !== false && challan.qcRequired !== false;
                  if (!isQcActive) {
                    // QC skipped: directly accepted into Shopfloor WIP
                    fgEntry.shopfloorWipQty += Number(h.quantity || 0);
                  } else {
                    // QC enabled:
                    if (h.qcStatus === "Passed" || h.qcStatus === "Accepted") {
                      const passed = Number(h.acceptedQuantity !== undefined ? h.acceptedQuantity : h.quantity) || 0;
                      fgEntry.shopfloorWipQty += passed;
                    } else if (h.qcStatus === "Partial" || h.qcStatus === "Conditional") {
                      const passed = Number(h.acceptedQuantity || 0);
                      const inQc = Math.max(0, Number(h.quantity || 0) - passed - Number(h.rejectedQuantity || 0));
                      fgEntry.shopfloorWipQty += passed;
                      fgEntry.pendingQcQty = (fgEntry.pendingQcQty || 0) + inQc;
                    } else if (h.qcStatus === "Pending" || !h.qcStatus) {
                      // Awaiting QC: held in pendingQcQty (not added to shopfloorWipQty yet)
                      fgEntry.pendingQcQty = (fgEntry.pendingQcQty || 0) + (Number(h.quantity) || 0);
                    }
                    // If Rejected: excluded from shopfloorWipQty
                  }
                });
              } else {
                fgEntry.shopfloorWipQty += Number(ret.quantityReceived) || 0;
              }
            } else {
              fgEntry.shopfloorWipQty += Number(ret.quantityReceived) || 0;
            }
          });
        }

        // Record Inward History in Ledger
        if (Array.isArray(challan.receiveHistory) && challan.receiveHistory.length > 0) {
          challan.receiveHistory.forEach((hist) => {
            const histItemName = hist.itemName || sentName;
            const histTargetType = (jwType === "store-conversion") ? sentTargetType : "fg";
            const histEntry = findWipEntry(hist.returningItemId || hist.itemId, histItemName, null, histTargetType);

            const rejCount = Number(hist.rejectedQuantity || (hist.qcStatus === "Rejected" ? hist.quantity : 0)) || 0;
            const isRejection = hist.qcStatus === "Rejected" || rejCount > 0;
            const acceptedCount = Number(hist.acceptedQuantity !== undefined ? hist.acceptedQuantity : (hist.qcStatus === "Passed" ? hist.quantity : 0)) || 0;

            const txIn = {
              date: hist.date,
              type: isRejection 
                ? `Job Work QC Rejection (${hist.rejectionReason || "Defective"})` 
                : (jwType === "wip-to-wip" ? "WIP-to-WIP Subcontractor Receipt (WIP FG)" : (jwType === "store-to-wip" ? "Store-to-WIP Return Receipt (WIP FG)" : "RM Conversion Subcontractor Receipt (Main Store)")),
              docNumber: hist.grnNumber || docNo,
              mrpNumber: mrpNumber,
              ewayBillNo: challan.ewayBillNo || "",
              sentQty: 0,
              receivedQty: isRejection ? 0 : (acceptedCount || Number(hist.quantity) || 0),
              rejectedQty: rejCount,
              isRejection: isRejection,
              rejectionReason: hist.rejectionReason || (isRejection ? "Quality Inspection Failed" : ""),
              unit: unit,
              processType: isRejection ? `QC Rejected: ${hist.rejectionReason || "Defective"}` : `Return from ${vendorName}`,
              vendorName: vendorName,
              status: hist.qcStatus || "Received"
            };

            if (histEntry) {
              histEntry.transactions.push(txIn);
            }

            allTransactionsLedger.push({
              ...txIn,
              materialName: histItemName,
              materialCode: histEntry?.materialCode || "",
              itemType: histTargetType,
              categoryType: histEntry?.categoryType || "FG / Component"
            });
          });
        }
      });
    });

    // 6. Process FG GRNs & Production Receipts (Multi-Tier WIP Consumption Engine)
    const allProductionReceipts = [
      ...allFGGRNs.map(g => ({
        grnNumber: g.grnNumber,
        mrpNumber: g.mrpNumber || "",
        date: g.date || g.createdAt,
        items: g.items || []
      })),
      ...allInHouseGRNs.map(g => ({
        grnNumber: g.grnNumber,
        mrpNumber: g.poNumber || g.poReference || "",
        date: g.date || g.createdAt,
        items: (g.items || []).map(it => ({
          fgItem: it.materialId,
          itemName: it.materialName,
          quantity: it.receivedQuantity || it.quantity,
          unit: it.unit
        }))
      }))
    ];

    allProductionReceipts.forEach(grn => {
      const grnDate = grn.date;
      const mrpNum = grn.mrpNumber || "";

      (grn.items || []).forEach(fgRec => {
        const fgName = fgRec.itemName || "";
        const fgQty = Number(fgRec.quantity || fgRec.receivedQuantity) || 0;

        // Find Bill of Materials (BOM) for this Finished Good
        const bom = allBOMs.find(b => 
          (b.productName && b.productName.trim().toLowerCase() === fgName.trim().toLowerCase()) ||
          (b.finishedGoods && b.finishedGoods.toString() === (fgRec.fgItem?.toString() || ''))
        );

        if (bom && Array.isArray(bom.items)) {
          bom.items.forEach(bomMat => {
            const rawMatName = bomMat.materialName || bomMat.name || "";
            const rawMatCode = bomMat.materialCode || bomMat.code || "";
            const bomRatio = Number(bomMat.quantity) || 1;
            const consumedRequired = fgQty * bomRatio;

            // Determine if ingredient is RM, BO, or Sub-Assembly Component
            const matTypeStr = (bomMat.type || bomMat.itemType || '').toLowerCase();
            let ingType = 'rm';
            if (matTypeStr === 'bo' || matTypeStr === 'bought out' || (rawMatCode || '').toUpperCase().startsWith('BO-')) {
              ingType = 'bo';
            } else if (matTypeStr === 'component' || matTypeStr === 'subassembly' || matTypeStr === 'fg' || matTypeStr === 'inhouse') {
              ingType = 'fg'; // WIP-to-WIP consumption!
            }

            const ingEntry = findWipEntry(bomMat.material, rawMatName, rawMatCode, ingType);
            if (ingEntry) {
              const consumed = Math.min(ingEntry.shopfloorWipQty, consumedRequired);
              if (consumed > 0) {
                ingEntry.totalFgConsumedQty += consumed;
                ingEntry.totalReturnedQty += consumed;
                ingEntry.shopfloorWipQty = Math.max(0, ingEntry.shopfloorWipQty - consumed);
                ingEntry.pendingWipQty = ingEntry.shopfloorWipQty + ingEntry.jobWorkWipQty;

                const tx = {
                  date: grnDate,
                  type: ingType === 'fg' ? "WIP-to-WIP Subassembly Consumed" : "FG GRN Receipt (WIP Consumed)",
                  docNumber: grn.grnNumber,
                  mrpNumber: mrpNum,
                  sentQty: 0,
                  receivedQty: consumed,
                  unit: ingEntry.unit,
                  processType: `Consumed into FG: ${fgName}`,
                  vendorName: "In-House Assembly",
                  status: "Consumed"
                };
                ingEntry.transactions.push(tx);

                allTransactionsLedger.push({
                  ...tx,
                  materialName: ingEntry.materialName,
                  materialCode: ingEntry.materialCode,
                  itemType: ingEntry.itemType,
                  categoryType: ingEntry.categoryType
                });
              }
            }
          });
        }

        // Deduct from MRP WIP Bucket
        if (mrpNum) {
          const mrpKey = mrpNum.trim().toLowerCase();
          if (mrpBucketMap.has(mrpKey)) {
            const bucket = mrpBucketMap.get(mrpKey);
            bucket.totalFgProduced += fgQty;

            bucket.itemsInWip.forEach(itemRecord => {
              let consumedRatio = 1;
              if (bom && Array.isArray(bom.items)) {
                const bomMat = bom.items.find(bi => 
                  (bi.materialName && bi.materialName.toLowerCase() === itemRecord.materialName.toLowerCase()) ||
                  (bi.materialCode && bi.materialCode.toLowerCase() === itemRecord.materialCode?.toLowerCase())
                );
                if (bomMat) consumedRatio = Number(bomMat.quantity) || 1;
              }
              const consumed = Math.min(itemRecord.pendingQty, fgQty * consumedRatio);
              itemRecord.consumedQty += consumed;
              itemRecord.pendingQty = Math.max(0, itemRecord.issuedQty - itemRecord.consumedQty);
            });

            bucket.transactions.push({
              date: grnDate,
              type: "FG GRN Completed (WIP Reduced)",
              docNumber: grn.grnNumber,
              materialName: fgName,
              itemType: "fg",
              qty: fgQty,
              unit: fgRec.unit || "Nos"
            });
          }
        }
      });
    });

    // 7. Format Resulting Items
    masterWipMap.forEach(item => {
      item.pendingWipQty = (item.shopfloorWipQty || 0) + (item.jobWorkWipQty || 0);
    });

    let allItems = Array.from(masterWipMap.values()).map(item => ({
      ...item,
      status: item.pendingWipQty > 0 ? "In WIP" : "WIP Zero"
    }));

    if (requestedType === "rm") {
      allItems = allItems.filter(item => item.itemType === "rm");
    } else if (requestedType === "bo") {
      allItems = allItems.filter(item => item.itemType === "bo");
    } else if (requestedType === "fg") {
      allItems = allItems.filter(item => item.itemType === "fg");
    }

    const mrpBuckets = Array.from(mrpBucketMap.values()).map(b => {
      const items = Array.from(b.itemsInWip.values());
      const netPendingWipCount = items.reduce((sum, it) => sum + (it.pendingQty || 0), 0);
      const isCompleted = b.originalStatus === "Completed" || (items.length > 0 && netPendingWipCount <= 0);

      let finalStatus = b.originalStatus || "Planned";
      if (isCompleted) {
        finalStatus = "Completed";
      } else if (items.length > 0 || b.totalRmIssued > 0 || b.totalBoIssued > 0 || b.totalFgIssued > 0) {
        finalStatus = "In Production";
      }

      return {
        ...b,
        items,
        netPendingWipCount,
        status: finalStatus
      };
    });

    // Sort transactions ledger newest first
    allTransactionsLedger.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const summary = {
      totalItems: allItems.length,
      totalActiveWipItems: allItems.filter(it => it.pendingWipQty > 0).length,
      totalIssuedQty: allItems.reduce((acc, curr) => acc + (curr.totalIssuedQty || 0), 0),
      totalJobWorkSentQty: allItems.reduce((acc, curr) => acc + (curr.totalJobWorkSentQty || 0), 0),
      totalReturnedQty: allItems.reduce((acc, curr) => acc + (curr.totalReturnedQty || 0), 0),
      totalFgConsumedQty: allItems.reduce((acc, curr) => acc + (curr.totalFgConsumedQty || 0), 0),
      netPendingWipQty: allItems.reduce((acc, curr) => acc + (curr.pendingWipQty || 0), 0),
      shopfloorWipQty: allItems.reduce((acc, curr) => acc + (curr.shopfloorWipQty || 0), 0),
      jobWorkWipQty: allItems.reduce((acc, curr) => acc + (curr.jobWorkWipQty || 0), 0)
    };

    res.status(200).json({
      wipItems: allItems,
      mrpBuckets: mrpBuckets,
      ledger: allTransactionsLedger,
      summary
    });
  } catch (error) {
    console.error("Error fetching WIP Inventory:", error);
    res.status(500).json({ message: "Failed to fetch WIP inventory data", error: error.message });
  }
};

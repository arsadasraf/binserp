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
  inventorySchema,
  stockTransactionSchema
} from "../../models/store/index.js";
import { mrpPlanSchema } from "../../models/purchase/index.js";
import { componentSchema } from "../../models/ppc/index.js";
import { userSchema } from "../../models/user/index.js";

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
    req.getModel("User", userSchema);

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

    // 2. Load FG GRNs, in-house receipts, BOMs, MRP Plans, and WIP adjustments
    const StockTransaction = req.getModel("StockTransaction", stockTransactionSchema);
    const [allFGGRNs, allInHouseGRNs, allBOMs, allMRPPlans, materialIssues, challans, wipAdjustments] = await Promise.all([
      FGGRN.find({ 
        company: companyId, 
        $or: [
          { status: { $in: ["Received", "Accepted", "Completed"] } },
          { qcStatus: { $in: ["Completed", "Skipped", "Partial"] } }
        ] 
      }).lean(),
      GRN.find({ company: companyId, type: { $in: ["inhouse", "fg"] }, status: { $in: ["Received", "Accepted"] } }).lean(),
      BOM.find({ company: companyId }).lean(),
      MRPPlan.find({ company: companyId }).lean(),
      MaterialIssue.find({ company: companyId, status: { $in: ["Issued", "issued", "Completed", "completed", "Approved", "approved"] } }).populate("issuedTo", "name userId department").sort({ date: -1 }).lean(),
      JobWorkChallan.find({ company: companyId, status: { $ne: "Cancelled" } }).populate("vendor").sort({ date: -1 }).lean(),
      StockTransaction.find({
        company: companyId,
        transactionCategory: { 
          $in: [
            "WIP_RETURN_TO_STORE", 
            "WIP_SCRAP_WRITEOFF", 
            "WIP_RM_CONVERT_OUTWARD", 
            "WIP_COMPONENT_CONVERT_INWARD"
          ] 
        }
      }).sort({ date: -1 }).lean()
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
      const hasSec = Boolean(item.hasSecondaryUnit || (item.secondaryUnit && Number(item.conversionFactor) > 0));
      const secUnit = item.secondaryUnit || "";
      const convFactor = Number(item.conversionFactor) || 1;

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
          hasSecondaryUnit: hasSec,
          secondaryUnit: secUnit,
          conversionFactor: convFactor,
          mainStoreStock: storeStock,
          mainStoreSecondaryStock: hasSec ? parseFloat((storeStock * convFactor).toFixed(4)) : 0,
          totalIssuedQty: 0,
          totalJobWorkSentQty: 0,
          totalJobWorkReturnedQty: 0,
          totalReturnedQty: 0,
          totalFgConsumedQty: 0,
          shopfloorWipQty: 0,
          shopfloorWipSecondaryQty: 0,
          pendingQcQty: 0,
          pendingQcSecondaryQty: 0,
          jobWorkWipQty: 0,
          jobWorkWipSecondaryQty: 0,
          pendingWipQty: 0,
          pendingWipSecondaryQty: 0,
          lastMovementDate: item.updatedAt || item.createdAt || new Date(),
          wipBatches: [],
          transactions: []
        });
      } else {
        const existing = masterWipMap.get(key);
        if (!existing.hasSecondaryUnit && hasSec) {
          existing.hasSecondaryUnit = true;
          existing.secondaryUnit = secUnit;
          existing.conversionFactor = convFactor;
        }
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
        hasSecondaryUnit: inv.hasSecondaryUnit,
        secondaryUnit: inv.secondaryUnit,
        conversionFactor: inv.conversionFactor,
        currentStock: inv.currentStock
      }, type);
    });

    // 3. Pre-populate MRP WIP Buckets Map & Bidirectional Lookup Maps
    const mrpPlanById = new Map();
    const mrpPlanByNum = new Map();
    const mrpBucketMap = new Map();

    allMRPPlans.forEach(plan => {
      if (plan._id) mrpPlanById.set(plan._id.toString(), plan);
      const mrpNum = plan.mrpNumber || "";
      const mrpKey = mrpNum.trim().toLowerCase();
      if (mrpKey) {
        mrpPlanByNum.set(mrpKey, plan);
        if (!mrpBucketMap.has(mrpKey)) {
          const firstFg = (plan.fgItems && plan.fgItems[0]) || {};
          mrpBucketMap.set(mrpKey, {
            mrpNumber: mrpNum,
            mrpPlanId: plan._id,
            productName: firstFg.fgItemName || plan.remarks || "Finished Goods",
            orderQuantity: Number(firstFg.quantity) || 0,
            unit: firstFg.unit || "PCS",
            salesOrderNumber: plan.customerPoNumber || firstFg.customerPoNumber || "",
            customerName: plan.customerName || firstFg.customerName || "General Production",
            originalStatus: plan.status || "Planned",
            status: plan.status || "Planned",
            planDate: plan.date || plan.createdAt,
            lastMovementDate: plan.date || plan.createdAt,
            totalIssuedQty: 0,
            totalConsumedQty: 0,
            pendingWipQty: 0,
            totalRmIssued: 0,
            totalBoIssued: 0,
            totalFgIssued: 0,
            totalFgProduced: 0,
            itemsInWip: new Map(),
            transactions: []
          });
        }
      }
    });

    // Helper to find existing master item in WIP registry
    const findWipEntry = (rawId, name, code, type) => {
      let idStr = rawId ? rawId.toString() : "";
      if (idStr.includes('_')) {
        idStr = idStr.split('_').slice(1).join('_');
      }
      if (idStr && type && masterWipMap.has(`${type}_${idStr}`)) {
        return masterWipMap.get(`${type}_${idStr}`);
      }
      // 1. Try matching with exact itemType
      for (const entry of masterWipMap.values()) {
        if (!type || entry.itemType === type) {
          if (idStr && (entry.materialId === idStr || entry.id === idStr || entry.id === `${entry.itemType}_${idStr}`)) return entry;
          if (code && entry.materialCode && entry.materialCode.trim().toLowerCase() === code.trim().toLowerCase()) return entry;
          if (name && entry.materialName && entry.materialName.trim().toLowerCase() === name.trim().toLowerCase()) return entry;
        }
      }
      // 2. Cross-check other item types (e.g., issued as RM but categorized as BO or vice-versa)
      for (const entry of masterWipMap.values()) {
        if (idStr && (entry.materialId === idStr || entry.id === idStr || entry.id === `${entry.itemType}_${idStr}`)) return entry;
        if (code && entry.materialCode && entry.materialCode.trim().toLowerCase() === code.trim().toLowerCase()) return entry;
        if (name && entry.materialName && entry.materialName.trim().toLowerCase() === name.trim().toLowerCase()) return entry;
      }
      // If not found, dynamically create entry
      const dynamicKey = registerMasterItem({ _id: idStr, name, code, unit: 'PCS' }, type || 'rm');
      return masterWipMap.get(dynamicKey);
    };

    // 4. Process Material Issues (Store Issues into WIP Inward)
    materialIssues.forEach((issue) => {
      if (issue.type === "consumable") return; // Consumables excluded from WIP

      const issueDept = issue.department || issue.issuedTo?.department || "Shop Floor Assembly";
      let mrpNumber = issue.mrpNumber || "";
      if (!mrpNumber && issue.mrpPlan) {
        const linkedPlan = mrpPlanById.get(issue.mrpPlan.toString());
        if (linkedPlan && linkedPlan.mrpNumber) mrpNumber = linkedPlan.mrpNumber;
      }
      const issueDate = issue.date || issue.createdAt;
      const docNo = issue.issueNumber || `ISS-${issue._id.toString().slice(-6)}`;

      (issue.items || []).forEach((item) => {
        const rawItemType = (item.itemType || item.type || '').toLowerCase();
        const issueType = (issue.type || '').toLowerCase();
        let targetType = 'rm';
        if (
          rawItemType.includes('bought') || 
          rawItemType === 'bo' || 
          (item.materialCode || '').toUpperCase().startsWith('BO-') ||
          (!rawItemType && (issueType === 'bo' || issueType === 'bought out'))
        ) {
          targetType = 'bo';
        } else if (
          rawItemType.includes('finish') || 
          rawItemType === 'fg' || 
          rawItemType.includes('component') || 
          rawItemType === 'inhouse' ||
          (!rawItemType && (issueType === 'fg' || issueType === 'inhouse' || issueType === 'component'))
        ) {
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
          entry.wipBatches.push({
            issueNumber: docNo,
            mrpNumber: mrpNumber ? mrpNumber.trim().toLowerCase() : "",
            date: new Date(issueDate),
            quantity: qty,
            remainingQty: qty
          });

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
            const linkedPlan = mrpPlanByNum.get(mrpKey);
            const firstFg = (linkedPlan?.fgItems && linkedPlan.fgItems[0]) || {};
            mrpBucketMap.set(mrpKey, {
              mrpNumber: mrpNumber,
              mrpPlanId: linkedPlan?._id || issue.mrpPlan || undefined,
              productName: firstFg.fgItemName || linkedPlan?.remarks || "Production Order",
              orderQuantity: Number(firstFg.quantity) || 0,
              unit: firstFg.unit || "PCS",
              salesOrderNumber: linkedPlan?.customerPoNumber || firstFg.customerPoNumber || "",
              customerName: linkedPlan?.customerName || firstFg.customerName || "Production Order",
              originalStatus: linkedPlan?.status || "In Production",
              status: "In Production",
              planDate: issueDate,
              lastMovementDate: issueDate,
              totalIssuedQty: 0,
              totalConsumedQty: 0,
              pendingWipQty: 0,
              totalRmIssued: 0,
              totalBoIssued: 0,
              totalFgIssued: 0,
              totalFgProduced: 0,
              itemsInWip: new Map(),
              transactions: []
            });
          }

          const bucket = mrpBucketMap.get(mrpKey);
          bucket.totalIssuedQty = (bucket.totalIssuedQty || 0) + qty;
          if (targetType === 'rm') bucket.totalRmIssued += qty;
          else if (targetType === 'bo') bucket.totalBoIssued += qty;
          else if (targetType === 'fg') bucket.totalFgIssued += qty;

          const itemMapKey = `${matName}_${targetType}`;
          if (!bucket.itemsInWip.has(itemMapKey)) {
            bucket.itemsInWip.set(itemMapKey, {
              materialId: rawId,
              materialName: matName,
              materialCode: matCode,
              materialDescription: entry?.materialDescription || item.descriptions || item.description || item.specification || "",
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
            materialCode: matCode,
            materialDescription: entry?.materialDescription || item.descriptions || item.description || item.specification || "",
            itemType: targetType,
            qty: qty,
            unit: unit,
            department: issueDept,
            issuedTo: issue.issuedTo?.name || "Production",
            status: "Issued"
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
      let mrpNumber = challan.mrpNumber || "";
      if (!mrpNumber && challan.mrpPlan) {
        const linkedPlan = mrpPlanById.get(challan.mrpPlan.toString());
        if (linkedPlan && linkedPlan.mrpNumber) mrpNumber = linkedPlan.mrpNumber;
      }
      const rawJwType = (challan.jobWorkType || "store-conversion").toLowerCase().trim().replace(/[\s_]/g, "-");
      const isWipToWip = rawJwType === "wip-to-wip";
      const isStoreToWip = rawJwType === "store-to-wip";
      const jwType = isWipToWip ? "wip-to-wip" : (isStoreToWip ? "store-to-wip" : "store-conversion");

      // Check if this is an Assembly / Many-to-One consolidation challan
      const hasAssemblyGroups = challan.operationMode === "assembly" && Array.isArray(challan.assemblyGroups) && challan.assemblyGroups.length > 0;
      const isAssemblyChallan = challan.operationMode === "assembly" && (hasAssemblyGroups || challan.assemblyOutputItem);

      (challan.items || []).forEach((sentItem) => {
        const sentName = sentItem.itemName || "Sent Material";
        const sentQty = Number(sentItem.quantitySent) || 0;
        const processType = sentItem.processType || "Job Work";
        const unit = sentItem.unit || "PCS";
        const sentRawType = (sentItem.itemType || "").trim().toLowerCase();
        let sentTargetType;
        if (sentRawType === "bo" || sentRawType === "bought out" || sentRawType === "boughtout") {
          sentTargetType = "bo";
        } else if (sentRawType === "rm" || sentRawType === "raw material" || sentRawType === "rawmaterial") {
          sentTargetType = "rm";
        } else if (sentRawType === "fg" || sentRawType === "inhouse" || sentRawType === "component" || sentRawType === "subassembly" || sentRawType === "assembly") {
          sentTargetType = "fg";
        } else {
          sentTargetType = isWipToWip ? "fg" : "rm";
        }

        let retList = [];
        if (hasAssemblyGroups) {
          // Find which assembly group this sent item belongs to
          const matchingGrp = challan.assemblyGroups.find(g => 
            (g.items || []).some(gi => String(gi.item || gi._id) === String(sentItem.item || sentItem._id))
          );
          const targetOutput = matchingGrp?.assemblyOutputItem || challan.assemblyGroups[0]?.assemblyOutputItem || challan.assemblyOutputItem;
          if (targetOutput) {
            retList = [{
              receivedItem: targetOutput.item,
              receivedItemName: targetOutput.itemName || "Assembled Product",
              receivedItemType: targetOutput.itemType || "fg",
              quantityToBeReceived: Number(targetOutput.quantityToBeReceived) || 0,
              quantityReceived: Number(targetOutput.quantityReceived) || 0
            }];
          }
        } else if (isAssemblyChallan && challan.assemblyOutputItem) {
          retList = [{
            receivedItem: challan.assemblyOutputItem.item,
            receivedItemName: challan.assemblyOutputItem.itemName || "Assembled Product",
            receivedItemType: challan.assemblyOutputItem.itemType || "fg",
            quantityToBeReceived: Number(challan.assemblyOutputItem.quantityToBeReceived) || 0,
            quantityReceived: Number(challan.assemblyOutputItem.quantityReceived) || 0
          }];
        } else if (Array.isArray(sentItem.returningItems) && sentItem.returningItems.length > 0) {
          retList = sentItem.returningItems;
        } else {
          retList = [{
            receivedItem: sentItem.receivedItem,
            receivedItemName: sentItem.receivedItemName || sentItem.itemToBeReceived || sentName,
            receivedItemType: sentItem.receivedItemType || (jwType === "store-conversion" ? "rm" : "fg"),
            quantityToBeReceived: Number(sentItem.quantityToBeReceived || sentItem.quantitySent) || 0,
            quantityReceived: Number(sentItem.quantityReceived) || 0
          }];
        }

        const expectedQty = retList.reduce((acc, r) => acc + (Number(r.quantityToBeReceived) || 0), 0) || sentQty;
        const receivedQty = retList.reduce((acc, r) => acc + (Number(r.quantityReceived) || 0), 0);
        const netJobWorkPending = Math.max(0, expectedQty - receivedQty);

        // Find entry for dispatched outward material
        const entry = findWipEntry(sentItem.item, sentName, null, sentTargetType);
        if (entry) {
          entry.totalJobWorkSentQty += sentQty;
          entry.totalJobWorkReturnedQty += receivedQty;
          entry.jobWorkWipQty += netJobWorkPending;

          // For WIP-to-WIP or any FG/Component dispatched from Shopfloor WIP:
          // Dispatched item is taken out from Shopfloor WIP batches FIFO
          if (isWipToWip || sentTargetType === "fg") {
            let toDeduct = sentQty;
            for (const b of entry.wipBatches) {
              if (toDeduct <= 0) break;
              const take = Math.min(b.remainingQty, toDeduct);
              b.remainingQty -= take;
              toDeduct -= take;
            }
          }

          if (new Date(challanDate) > new Date(entry.lastMovementDate)) {
            entry.lastMovementDate = challanDate;
          }

          const txOut = {
            date: challanDate,
            type: isWipToWip ? "WIP-to-WIP Subcontractor Dispatch" : (isStoreToWip ? "Store-to-WIP Subcontractor Dispatch" : "RM Conversion Subcontractor Dispatch"),
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

          // Link outward job work dispatch to MRP Bucket
          if (mrpNumber) {
            const cMrpKey = mrpNumber.trim().toLowerCase();
            if (mrpBucketMap.has(cMrpKey)) {
              const cBucket = mrpBucketMap.get(cMrpKey);
              cBucket.transactions.push({
                date: challanDate,
                type: isWipToWip ? "Job Work Dispatch (WIP-to-WIP)" : (isStoreToWip ? "Job Work Dispatch (Store-to-WIP)" : "Job Work Dispatch (RM Conversion)"),
                docNumber: docNo,
                materialName: sentName,
                itemType: sentTargetType,
                qty: sentQty,
                unit: unit
              });
            }
          }
        }

        // For Store-to-WIP & WIP-to-WIP: QC-governed return back to Shopfloor WIP
        if (isStoreToWip || isWipToWip) {
          // For assembly challan, only process the assembled return entry once per challan
          if (isAssemblyChallan && challan.__assemblyProcessed) return;
          if (isAssemblyChallan) challan.__assemblyProcessed = true;

          retList.forEach((ret) => {
            const retName = ret.receivedItemName || sentName;
            const fgEntry = findWipEntry(ret.receivedItem, retName, null, "fg");
            if (!fgEntry) return;

            if (Array.isArray(challan.receiveHistory) && challan.receiveHistory.length > 0) {
              const matchingHist = challan.receiveHistory.filter(h => 
                (ret.receivedItem && (
                  String(h.masterItemId) === String(ret.receivedItem) ||
                  String(h.returningItemId) === String(ret.receivedItem) || 
                  String(h.itemId) === String(ret.receivedItem) ||
                  (ret._id && String(h.returningItemId) === String(ret._id))
                )) ||
                (sentItem._id && String(h.itemId) === String(sentItem._id)) ||
                (h.itemName && retName && h.itemName.trim().toLowerCase() === retName.trim().toLowerCase())
              );

              if (matchingHist.length > 0) {
                matchingHist.forEach(h => {
                  const isQcActive = h.qcRequired !== false && challan.qcRequired !== false;
                  if (!isQcActive) {
                    // QC skipped: directly accepted into Shopfloor WIP
                    const passed = Number(h.quantity || 0);
                    if (passed > 0) {
                      fgEntry.wipBatches.push({
                        issueNumber: h.grnNumber || docNo,
                        mrpNumber: mrpNumber ? mrpNumber.trim().toLowerCase() : "",
                        date: new Date(h.date || challanDate),
                        quantity: passed,
                        remainingQty: passed
                      });
                    }
                  } else {
                    // QC enabled:
                    if (h.qcStatus === "Passed" || h.qcStatus === "Accepted") {
                      const passed = Number(h.acceptedQuantity !== undefined ? h.acceptedQuantity : h.quantity) || 0;
                      if (passed > 0) {
                        fgEntry.wipBatches.push({
                          issueNumber: h.grnNumber || docNo,
                          mrpNumber: mrpNumber ? mrpNumber.trim().toLowerCase() : "",
                          date: new Date(h.date || challanDate),
                          quantity: passed,
                          remainingQty: passed
                        });
                      }
                    } else if (h.qcStatus === "Partial" || h.qcStatus === "Conditional") {
                      const passed = Number(h.acceptedQuantity || 0);
                      const inQc = Math.max(0, Number(h.quantity || 0) - passed - Number(h.rejectedQuantity || 0));
                      if (passed > 0) {
                        fgEntry.wipBatches.push({
                          issueNumber: h.grnNumber || docNo,
                          mrpNumber: mrpNumber ? mrpNumber.trim().toLowerCase() : "",
                          date: new Date(h.date || challanDate),
                          quantity: passed,
                          remainingQty: passed
                        });
                      }
                      fgEntry.pendingQcQty = (fgEntry.pendingQcQty || 0) + inQc;
                    } else if (h.qcStatus === "Pending" || !h.qcStatus) {
                      // Awaiting QC: held in pendingQcQty (not added to shopfloorWipQty yet)
                      fgEntry.pendingQcQty = (fgEntry.pendingQcQty || 0) + (Number(h.quantity) || 0);
                    }
                    // If Rejected: excluded from shopfloorWipQty
                  }
                });
              } else {
                const recQty = Number(ret.quantityReceived) || 0;
                if (recQty > 0) {
                  fgEntry.wipBatches.push({
                    issueNumber: docNo,
                    mrpNumber: mrpNumber ? mrpNumber.trim().toLowerCase() : "",
                    date: new Date(challanDate),
                    quantity: recQty,
                    remainingQty: recQty
                  });
                }
              }
            } else {
              const recQty = Number(ret.quantityReceived) || 0;
              if (recQty > 0) {
                fgEntry.wipBatches.push({
                  issueNumber: docNo,
                  mrpNumber: mrpNumber ? mrpNumber.trim().toLowerCase() : "",
                  date: new Date(challanDate),
                  quantity: recQty,
                  remainingQty: recQty
                });
              }
            }
          });
        }

        // Record Inward History in Ledger
        if (Array.isArray(challan.receiveHistory) && challan.receiveHistory.length > 0) {
          challan.receiveHistory.forEach((hist) => {
            const histItemName = hist.itemName || sentName;
            const histTargetType = (jwType === "store-conversion") ? sentTargetType : "fg";
            const histEntry = findWipEntry(hist.masterItemId || hist.returningItemId || hist.itemId, histItemName, null, histTargetType);

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

            // Link inward job work return to MRP Bucket
            if (mrpNumber) {
              const cMrpKey = mrpNumber.trim().toLowerCase();
              if (mrpBucketMap.has(cMrpKey)) {
                const cBucket = mrpBucketMap.get(cMrpKey);
                cBucket.transactions.push({
                  date: hist.date || challanDate,
                  type: isRejection ? `Job Work QC Rejection` : "Job Work Return Received",
                  docNumber: hist.grnNumber || docNo,
                  materialName: histItemName,
                  itemType: histTargetType,
                  qty: isRejection ? rejCount : (acceptedCount || Number(hist.quantity) || 0),
                  unit: unit
                });
              }
            }
          });
        }
      });
    });

    // 5.1. Process WIP Return to Store, Shopfloor Scrap, and In-house WIP Conversions
    (wipAdjustments || []).forEach(adj => {
      const adjName = adj.itemName || "Material";
      const adjQty = Number(adj.quantity) || 0;
      const adjDate = adj.date || adj.createdAt;
      const cat = adj.transactionCategory;
      const isReturn = cat === "WIP_RETURN_TO_STORE";
      const isScrap = cat === "WIP_SCRAP_WRITEOFF";
      const isConvertOutward = cat === "WIP_RM_CONVERT_OUTWARD";
      const isConvertInward = cat === "WIP_COMPONENT_CONVERT_INWARD";

      const rawType = (adj.itemType || "").toLowerCase();
      const targetType = (rawType === "boughtout" || rawType === "bo") 
        ? "bo" 
        : (rawType === "component" || rawType === "fg" || isConvertInward) 
          ? "fg" 
          : "rm";

      const entry = findWipEntry(adj.item, adjName, null, targetType);
      if (entry) {
        if (isConvertInward) {
          // Inward component addition into Shopfloor WIP batches
          entry.wipBatches.push({
            issueNumber: adj.referenceDocNumber || "CONV-IN",
            mrpNumber: "",
            date: new Date(adjDate),
            quantity: adjQty,
            remainingQty: adjQty
          });

          if (new Date(adjDate) > new Date(entry.lastMovementDate)) {
            entry.lastMovementDate = adjDate;
          }

          const tx = {
            date: adjDate,
            type: "WIP Component Produced (In-house Blank/Part)",
            docNumber: adj.referenceDocNumber || "CONV-IN",
            mrpNumber: "",
            sentQty: 0,
            receivedQty: adjQty,
            unit: adj.unit || entry.unit || "PCS",
            processType: adj.purpose || "Shopfloor In-house Blank / Part Production",
            vendorName: "Shopfloor Assembly",
            status: "Completed"
          };
          entry.transactions.push(tx);
          allTransactionsLedger.push({
            ...tx,
            materialName: entry.materialName,
            materialCode: entry.materialCode,
            itemType: entry.itemType,
            categoryType: entry.categoryType
          });
        } else {
          // Outward reduction from Shopfloor WIP batches (Return, Scrap, or RM Conversion)
          let toDeduct = adjQty;
          for (const b of entry.wipBatches) {
            if (toDeduct <= 0) break;
            const take = Math.min(b.remainingQty, toDeduct);
            b.remainingQty -= take;
            toDeduct -= take;
          }

          if (isReturn) {
            entry.totalReturnedQty += adjQty;
          }

          if (new Date(adjDate) > new Date(entry.lastMovementDate)) {
            entry.lastMovementDate = adjDate;
          }

          let txType = "Shopfloor Scrap Write-off";
          let vendorName = "Shopfloor Scrap";
          if (isReturn) {
            txType = "WIP Returned to Main Store";
            vendorName = "Main Store";
          } else if (isConvertOutward) {
            txType = "WIP Consumed for Component Production";
            vendorName = "In-house Shopfloor Production";
          }

          const tx = {
            date: adjDate,
            type: txType,
            docNumber: adj.referenceDocNumber || "ADJ",
            mrpNumber: "",
            sentQty: adjQty,
            receivedQty: 0,
            unit: adj.unit || entry.unit || "PCS",
            processType: adj.purpose || (isReturn ? "Return to Main Store" : (isConvertOutward ? "Converted to In-house Component" : "Shopfloor Scrap Write-off")),
            vendorName: vendorName,
            status: "Completed"
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
      }
    });

    // 6. Process FG GRNs & Production Receipts (Multi-Tier WIP Consumption Engine)
    const allProductionReceipts = [
      ...allFGGRNs.map(g => ({
        grnNumber: g.grnNumber,
        mrpPlan: g.mrpPlan,
        mrpNumber: g.mrpNumber || "",
        date: g.date || g.createdAt,
        items: g.items || []
      })),
      ...allInHouseGRNs.map(g => ({
        grnNumber: g.grnNumber,
        mrpPlan: g.mrpPlan,
        mrpNumber: g.poNumber || g.poReference || "",
        date: g.date || g.createdAt,
        items: (g.items || []).map(it => ({
          fgItem: it.materialId,
          itemName: it.materialName,
          quantity: it.acceptedQuantity || it.receivedQuantity || it.quantity,
          unit: it.unit
        }))
      }))
    ];

    // Sort production receipts chronologically so older receipts consume older batches first
    allProductionReceipts.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    allProductionReceipts.forEach(grn => {
      const grnDate = grn.date;
      let receiptMrpNum = grn.mrpNumber || "";
      if (!receiptMrpNum && grn.mrpPlan) {
        const linkedPlan = mrpPlanById.get(grn.mrpPlan.toString());
        if (linkedPlan && linkedPlan.mrpNumber) receiptMrpNum = linkedPlan.mrpNumber;
      }
      const targetMrpKey = receiptMrpNum ? receiptMrpNum.trim().toLowerCase() : "";

      (grn.items || []).forEach(fgRec => {
        const fgName = fgRec.itemName || "";
        const fgQty = Number(fgRec.acceptedQuantity || fgRec.quantity || fgRec.receivedQuantity) || 0;
        if (fgQty <= 0) return;

        const normFgName = fgName.trim().toLowerCase();
        const normFgItem = fgRec.fgItem ? fgRec.fgItem.toString() : '';

        // 1. Resolve Bill of Materials from standalone BOMs
        const bom = allBOMs.find(b => 
          (b.finishedGoods && normFgItem && b.finishedGoods.toString() === normFgItem) ||
          (b.productName && normFgName && b.productName.trim().toLowerCase() === normFgName) ||
          (b.productCode && fgRec.materialCode && b.productCode.trim().toLowerCase() === fgRec.materialCode.trim().toLowerCase())
        );

        // 2. Resolve from MRP Plan nestedMaterials if linked
        const mrpPlan = allMRPPlans.find(p => 
          (grn.mrpPlan && p._id.toString() === grn.mrpPlan.toString()) ||
          (receiptMrpNum && p.mrpNumber && p.mrpNumber.trim().toLowerCase() === targetMrpKey)
        );
        const matchedMrpFg = mrpPlan?.fgItems?.find(f => 
          (normFgItem && f.fgItem?.toString() === normFgItem) ||
          (f.fgItemName && f.fgItemName.trim().toLowerCase() === normFgName)
        );

        // 3. Resolve from FGItem master embedded BOM
        const fgDoc = fgItemsList.find(f => 
          (normFgItem && f._id.toString() === normFgItem) ||
          (f.name && f.name.trim().toLowerCase() === normFgName)
        );

        // Build unified ingredient list
        let bomIngredients = [];
        if (bom && Array.isArray(bom.items) && bom.items.length > 0) {
          bomIngredients = bom.items.map(it => ({
            material: it.material || it.component || it.item || it._id,
            materialName: it.materialName || it.name || "",
            materialCode: it.materialCode || it.code || "",
            quantity: Number(it.quantity) || 1,
            unit: it.unit || "PCS",
            itemType: it.type || it.itemType || ""
          }));
        } else if (matchedMrpFg && Array.isArray(matchedMrpFg.nestedMaterials) && matchedMrpFg.nestedMaterials.length > 0) {
          bomIngredients = matchedMrpFg.nestedMaterials.map(it => ({
            material: it.material || it.materialId || it._id,
            materialName: it.materialName || it.name || "",
            materialCode: it.materialCode || it.code || "",
            quantity: Number(it.quantityPerFG || it.quantity) || 1,
            unit: it.unit || "PCS",
            itemType: it.itemType || it.category || ""
          }));
        } else if (fgDoc && Array.isArray(fgDoc.bom) && fgDoc.bom.length > 0) {
          bomIngredients = fgDoc.bom.map(it => ({
            material: it.item || it._id,
            materialName: it.itemName || it.name || "",
            materialCode: it.code || it.itemCode || "",
            quantity: Number(it.quantity) || 1,
            unit: it.unit || "PCS",
            itemType: it.itemType || it.fgType || ""
          }));
        }

        if (bomIngredients.length > 0) {
          bomIngredients.forEach(bomMat => {
            const rawMatName = bomMat.materialName || "";
            const rawMatCode = bomMat.materialCode || "";
            const bomRatio = Number(bomMat.quantity) || 1;
            const consumedRequired = fgQty * bomRatio;

            // Determine if ingredient is RM, BO, or Sub-Assembly Component
            const matTypeStr = (bomMat.itemType || '').toLowerCase();
            let ingType = 'rm';
            if (matTypeStr === 'bo' || matTypeStr === 'bought out' || (rawMatCode || '').toUpperCase().startsWith('BO-')) {
              ingType = 'bo';
            } else if (matTypeStr === 'component' || matTypeStr === 'subassembly' || matTypeStr === 'fg' || matTypeStr === 'inhouse') {
              ingType = 'fg'; // WIP-to-WIP consumption!
            }

            const rawId = bomMat.material;
            const ingEntry = findWipEntry(rawId, rawMatName, rawMatCode, ingType);
            if (ingEntry) {
              let needed = consumedRequired;
              for (const batch of ingEntry.wipBatches) {
                if (needed <= 0) break;
                if (batch.remainingQty <= 0) continue;

                // Scoped batch consumption:
                if (targetMrpKey) {
                  // If GRN is for a specific MRP order, only consume from that MRP order's batches!
                  if (batch.mrpNumber !== targetMrpKey) continue;
                } else {
                  // If GRN is general, only consume from general batches issued on or before GRN date!
                  if (batch.mrpNumber) continue;
                  const endOfGrnDay = new Date(grnDate).setHours(23, 59, 59, 999);
                  if (batch.date.getTime() > endOfGrnDay) continue;
                }

                const take = Math.min(batch.remainingQty, needed);
                batch.remainingQty -= take;
                needed -= take;
              }

              const consumed = consumedRequired - needed;
              if (consumed > 0) {
                ingEntry.totalFgConsumedQty += consumed;

                const tx = {
                  date: grnDate,
                  type: ingEntry.itemType === 'fg' ? "WIP-to-WIP Subassembly Consumed" : "FG GRN Receipt (WIP Consumed)",
                  docNumber: grn.grnNumber,
                  mrpNumber: receiptMrpNum,
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
        if (receiptMrpNum) {
          const mrpKey = receiptMrpNum.trim().toLowerCase();
          if (mrpBucketMap.has(mrpKey)) {
            const bucket = mrpBucketMap.get(mrpKey);
            bucket.totalFgProduced += fgQty;
            bucket.totalConsumedQty = (bucket.totalConsumedQty || 0) + fgQty;

            bucket.itemsInWip.forEach(itemRecord => {
              let consumedRatio = 1;
              const matchedIng = bomIngredients.find(bi => 
                (bi.materialName && bi.materialName.toLowerCase() === itemRecord.materialName.toLowerCase()) ||
                (bi.materialCode && bi.materialCode.toLowerCase() === itemRecord.materialCode?.toLowerCase())
              );
              if (matchedIng) consumedRatio = Number(matchedIng.quantity) || 1;

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
      item.shopfloorWipQty = item.wipBatches.reduce((sum, b) => sum + (b.remainingQty || 0), 0);
      item.pendingWipQty = (item.shopfloorWipQty || 0) + (item.jobWorkWipQty || 0);
      const conv = Number(item.conversionFactor) || 1;
      if (item.hasSecondaryUnit && item.secondaryUnit) {
        item.mainStoreSecondaryStock = parseFloat(((item.mainStoreStock || 0) * conv).toFixed(4));
        item.shopfloorWipSecondaryQty = parseFloat(((item.shopfloorWipQty || 0) * conv).toFixed(4));
        item.pendingQcSecondaryQty = parseFloat(((item.pendingQcQty || 0) * conv).toFixed(4));
        item.jobWorkWipSecondaryQty = parseFloat(((item.jobWorkWipQty || 0) * conv).toFixed(4));
        item.pendingWipSecondaryQty = parseFloat(((item.pendingWipQty || 0) * conv).toFixed(4));
      }
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
      const items = Array.from(b.itemsInWip.values()).map(it => ({
        ...it,
        status: it.pendingQty <= 0 && it.issuedQty > 0 
          ? "Fully Consumed" 
          : it.consumedQty > 0 
          ? "Partially Consumed" 
          : "In WIP"
      }));
      const totalIssuedQty = b.totalIssuedQty || (b.totalRmIssued + b.totalBoIssued + b.totalFgIssued);
      const totalConsumedQty = b.totalConsumedQty || b.totalFgProduced || 0;
      const pendingWipQty = Math.max(0, totalIssuedQty - totalConsumedQty);
      const netPendingWipCount = items.reduce((sum, it) => sum + (it.pendingQty || 0), 0);
      const isCompleted = b.originalStatus === "Completed" || (items.length > 0 && netPendingWipCount <= 0 && totalIssuedQty > 0);

      let finalStatus = b.originalStatus || "Planned";
      if (isCompleted) {
        finalStatus = "Completed";
      } else if (items.length > 0 || totalIssuedQty > 0) {
        finalStatus = "In Production";
      }

      return {
        ...b,
        totalIssuedQty,
        totalConsumedQty,
        pendingWipQty,
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
      transactionsLedger: allTransactionsLedger,
      summary
    });
  } catch (error) {
    console.error("Error fetching WIP Inventory:", error);
    res.status(500).json({ message: "Failed to fetch WIP inventory data", error: error.message });
  }
};

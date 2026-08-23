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
  fgItemSchema 
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
    const FGItem = req.getModel("FGItem", fgItemSchema);
    const Component = req.getModel("Component", componentSchema);

    // Register referenced models
    req.getModel("Vendor", vendorSchema);
    req.getModel("JobWorkSupplier", jobWorkSupplierSchema);

    const companyId = getCompanyId(req);
    const requestedType = (req.query.type || "rm").toLowerCase(); // 'rm', 'bo', 'fg', 'mrp-buckets'

    // Load master lists to accurately classify RM vs BO vs FG
    const [rawMaterialsList, boughtOutsList, fgItemsList, componentsList] = await Promise.all([
      RawMaterial.find({ company: companyId }).select("_id name code"),
      BoughtOut.find({ company: companyId }).select("_id name code"),
      FGItem.find({ company: companyId }).select("_id name code"),
      Component.find({ company: companyId }).select("_id name componentName code")
    ]);

    const rmIdSet = new Set(rawMaterialsList.map(r => r._id.toString()));
    const boIdSet = new Set(boughtOutsList.map(b => b._id.toString()));
    const fgIdSet = new Set([...fgItemsList.map(f => f._id.toString()), ...componentsList.map(c => c._id.toString())]);

    const determineItemCategory = (item, issueType) => {
      const typeStr = (issueType || item.itemType || '').toLowerCase();
      if (typeStr === 'fg' || typeStr === 'inhouse' || typeStr === 'component') return 'fg';
      if (typeStr === 'consumable') return 'consumable';

      const matId = (item.material?._id || item.material || item.fgItem || item.component || item._id || '').toString();
      if (fgIdSet.has(matId)) return 'fg';
      if (boIdSet.has(matId)) return 'bo';
      if (rmIdSet.has(matId)) return 'rm';

      const code = (item.materialCode || item.code || '').toUpperCase();
      if (code.startsWith('BO-') || typeStr === 'bought out' || typeStr === 'bo') return 'bo';
      if (code.startsWith('RM-') || typeStr === 'raw material' || typeStr === 'rm') return 'rm';

      return 'rm'; // default to rm
    };

    // Load all FG GRNs, standard InHouse GRNs, and BOMs
    const [allFGGRNs, allInHouseGRNs, allBOMs, allMRPPlans] = await Promise.all([
      FGGRN.find({ company: companyId, status: { $in: ["Received", "Accepted"] } }),
      GRN.find({ company: companyId, type: { $in: ["inhouse", "fg"] }, status: { $in: ["Received", "Accepted"] } }),
      BOM.find({ company: companyId }),
      MRPPlan.find({ company: companyId })
    ]);

    // Combine all FG production receipts
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
          itemName: it.materialName,
          quantity: it.receivedQuantity || it.quantity,
          unit: it.unit
        }))
      }))
    ];

    const wipMap = new Map();
    const mrpBucketMap = new Map();

    // 1. Process Material Issues (Store issues directly into Shop Floor WIP)
    const materialIssues = await MaterialIssue.find({ company: companyId })
      .populate("issuedTo", "name userId department")
      .sort({ date: -1 });

    materialIssues.forEach((issue) => {
      // EXCLUDE Consumables completely from WIP
      if (issue.type === "consumable") return;

      const issueDept = issue.department || issue.issuedTo?.department || "Shop Floor Assembly";
      const mrpNumber = issue.mrpNumber || "";

      (issue.items || []).forEach((item) => {
        const itemCat = determineItemCategory(item, issue.type);
        if (itemCat === "consumable") return;

        const matName = item.materialName || "Issued Material";
        const matCode = item.materialCode || "";
        const qty = Number(item.quantity) || 0;
        const unit = item.unit || "PCS";
        const issueDate = issue.date || issue.createdAt;

        // Group key for Item-Level WIP
        const itemKey = mrpNumber 
          ? `issue_${itemCat}_${matName.trim().toLowerCase()}_mrp_${mrpNumber.toLowerCase()}`
          : `issue_${itemCat}_${matName.trim().toLowerCase()}_${issueDept.trim().toLowerCase()}`;

        if (!wipMap.has(itemKey)) {
          wipMap.set(itemKey, {
            id: itemKey,
            sentItemName: matName,
            receivedItemName: matName,
            materialCode: matCode,
            itemType: itemCat,
            categoryType: itemCat === "rm" ? "Raw Material (RM)" : itemCat === "bo" ? "Bought Out (BO)" : "Finished Goods (FG)",
            vendorName: mrpNumber ? `MRP: ${mrpNumber} (${issueDept})` : `Department: ${issueDept}`,
            processType: "Shop Floor Production",
            mrpNumber: mrpNumber,
            unit: unit,
            receivingUnit: unit,
            totalIssuedQty: 0,
            totalJobWorkSentQty: 0,
            totalExpectedQty: 0,
            totalReturnedQty: 0,
            totalFgConsumedQty: 0,
            pendingWipQty: 0,
            lastMovementDate: issueDate,
            transactions: []
          });
        }

        const entry = wipMap.get(itemKey);
        entry.totalIssuedQty += qty;
        entry.totalExpectedQty += qty;
        entry.pendingWipQty += qty;

        if (new Date(issueDate) > new Date(entry.lastMovementDate)) {
          entry.lastMovementDate = issueDate;
        }

        entry.transactions.push({
          date: issueDate,
          type: "Shop Floor Material Issue (WIP Inward)",
          docNumber: issue.issueNumber || `ISS-${issue._id.toString().slice(-6)}`,
          mrpNumber: mrpNumber,
          sentQty: qty,
          receivedQty: 0,
          unit: unit,
          processType: "Store Issue into WIP",
          vendorName: issueDept,
          status: "Issued"
        });

        // 1b. Check matching FG Production Receipts (FG GRNs) linked to this MRP Number to reduce WIP!
        if (mrpNumber) {
          const matchingGrns = allProductionReceipts.filter(g => g.mrpNumber && g.mrpNumber.toLowerCase() === mrpNumber.toLowerCase());
          matchingGrns.forEach(grn => {
            (grn.items || []).forEach(gItem => {
              const fgQty = Number(gItem.receivedQuantity || gItem.quantity) || 0;
              const fgName = gItem.itemName || "";

              // Find BOM to calculate consumption ratio
              const bom = allBOMs.find(b => b.productName && b.productName.toLowerCase() === fgName.toLowerCase());
              let consumedRatio = 1;
              if (bom && Array.isArray(bom.items)) {
                const bomMat = bom.items.find(bi => 
                  (bi.materialName && bi.materialName.toLowerCase() === matName.toLowerCase()) ||
                  (matCode && bi.materialCode && bi.materialCode.toLowerCase() === matCode.toLowerCase())
                );
                if (bomMat) {
                  consumedRatio = Number(bomMat.quantity) || 1;
                }
              }

              const consumedQty = Math.min(entry.pendingWipQty, fgQty * consumedRatio);
              if (consumedQty > 0) {
                entry.totalFgConsumedQty += consumedQty;
                entry.totalReturnedQty += consumedQty;
                entry.pendingWipQty = Math.max(0, entry.pendingWipQty - consumedQty);

                entry.transactions.push({
                  date: grn.date,
                  type: "FG GRN Receipt (WIP Consumed)",
                  docNumber: grn.grnNumber,
                  mrpNumber: mrpNumber,
                  sentQty: 0,
                  receivedQty: consumedQty,
                  unit: unit,
                  processType: `Finished Good Produced: ${fgName}`,
                  vendorName: "In-House Assembly",
                  status: "Consumed"
                });
              }
            });
          });
        }

        // 1c. Aggregate into MRP-Level Bucket
        if (mrpNumber) {
          const mrpKey = mrpNumber.toLowerCase();
          if (!mrpBucketMap.has(mrpKey)) {
            const planDoc = allMRPPlans.find(p => p.mrpNumber && p.mrpNumber.toLowerCase() === mrpKey);
            mrpBucketMap.set(mrpKey, {
              mrpNumber: mrpNumber,
              customerName: planDoc?.customerName || planDoc?.remarks || "General Production",
              status: planDoc?.status || "In Production",
              planDate: planDoc?.date || planDoc?.createdAt || issueDate,
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
          if (itemCat === 'rm') bucket.totalRmIssued += qty;
          else if (itemCat === 'bo') bucket.totalBoIssued += qty;
          else if (itemCat === 'fg') bucket.totalFgIssued += qty;

          const itemMapKey = `${matName}_${itemCat}`;
          if (!bucket.itemsInWip.has(itemMapKey)) {
            bucket.itemsInWip.set(itemMapKey, {
              materialName: matName,
              materialCode: matCode,
              itemType: itemCat,
              category: itemCat === 'rm' ? 'Raw Material' : itemCat === 'bo' ? 'Bought Out' : 'FG / Component',
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
            docNumber: issue.issueNumber,
            materialName: matName,
            itemType: itemCat,
            qty: qty,
            unit: unit
          });
        }
      });
    });

    // 2. Process Job Work Dispatches & Receipts (Subcontractor Stock)
    const challans = await JobWorkChallan.find({ company: companyId })
      .populate("vendor")
      .sort({ date: -1 });

    challans.forEach((challan) => {
      const vendorObj = challan.vendor || { name: challan.vendorName || "Subcontractor" };
      const vendorId = vendorObj._id ? String(vendorObj._id) : "unknown";
      const vendorName = vendorObj.name || "Subcontractor";

      (challan.items || []).forEach((sentItem) => {
        const itemCat = determineItemCategory(sentItem, sentItem.itemType);
        if (itemCat === "consumable") return;

        const sentName = sentItem.itemName || "Sent Material";
        const sentQty = Number(sentItem.quantitySent) || 0;
        const processType = sentItem.processType || "Job Work";
        const unit = sentItem.unit || "PCS";
        const challanDate = challan.date || challan.createdAt;

        // Process returning sub-items
        const retList = Array.isArray(sentItem.returningItems) && sentItem.returningItems.length > 0
          ? sentItem.returningItems
          : [{
              receivedItemName: sentItem.receivedItemName || sentItem.itemToBeReceived || sentName,
              receivedItemType: sentItem.receivedItemType || itemCat,
              quantityToBeReceived: Number(sentItem.quantityToBeReceived || sentItem.quantitySent) || 0,
              quantityReceived: Number(sentItem.quantityReceived) || 0,
              receivingUnit: sentItem.receivingUnit || unit,
              status: sentItem.status
            }];

        retList.forEach((ret) => {
          const retName = ret.receivedItemName || sentName;
          const key = `jw_${itemCat}_${sentName.trim().toLowerCase()}_${retName.trim().toLowerCase()}_${vendorId}`;

          const expectedQty = Number(ret.quantityToBeReceived) || sentQty;
          const receivedQty = Number(ret.quantityReceived) || 0;

          if (!wipMap.has(key)) {
            wipMap.set(key, {
              id: key,
              sentItemName: sentName,
              receivedItemName: retName,
              itemType: itemCat,
              categoryType: itemCat === "rm" ? "Raw Material (RM)" : itemCat === "bo" ? "Bought Out (BO)" : "Finished Goods (FG)",
              vendor: vendorObj,
              vendorName: challan.mrpNumber ? `${vendorName} (MRP: ${challan.mrpNumber})` : vendorName,
              mrpNumber: challan.mrpNumber || "",
              processType,
              unit,
              receivingUnit: ret.receivingUnit || unit,
              totalIssuedQty: 0,
              totalJobWorkSentQty: 0,
              totalExpectedQty: 0,
              totalReturnedQty: 0,
              totalFgConsumedQty: 0,
              pendingWipQty: 0,
              lastMovementDate: challanDate,
              transactions: []
            });
          }

          const entry = wipMap.get(key);
          entry.totalJobWorkSentQty += sentQty;
          entry.totalExpectedQty += expectedQty;
          entry.totalReturnedQty += receivedQty;
          entry.pendingWipQty = Math.max(0, (entry.totalIssuedQty + entry.totalExpectedQty) - entry.totalReturnedQty - entry.totalFgConsumedQty);

          if (new Date(challanDate) > new Date(entry.lastMovementDate)) {
            entry.lastMovementDate = challanDate;
          }

          entry.transactions.push({
            date: challanDate,
            type: "Job-Work Outward Dispatch",
            docNumber: challan.challanNumber,
            mrpNumber: challan.mrpNumber || "",
            ewayBillNo: challan.ewayBillNo || "",
            sentQty: sentQty,
            receivedQty: 0,
            unit: unit,
            processType,
            vendorName,
            status: challan.status
          });

          if (Array.isArray(challan.receiveHistory)) {
            challan.receiveHistory.forEach((hist) => {
              entry.transactions.push({
                date: hist.date,
                type: "Job-Work Return Receipt",
                docNumber: challan.challanNumber,
                mrpNumber: challan.mrpNumber || "",
                ewayBillNo: challan.ewayBillNo || "",
                sentQty: 0,
                receivedQty: Number(hist.quantity) || 0,
                unit: ret.receivingUnit || unit,
                processType,
                vendorName,
                status: "Received"
              });
            });
          }
        });
      });
    });

    // Finalize MRP Buckets: calculate total FG Produced from FG GRNs
    allProductionReceipts.forEach(grn => {
      if (grn.mrpNumber) {
        const mrpKey = grn.mrpNumber.toLowerCase();
        if (mrpBucketMap.has(mrpKey)) {
          const bucket = mrpBucketMap.get(mrpKey);
          (grn.items || []).forEach(it => {
            const fgProducedQty = Number(it.quantity || it.receivedQuantity) || 0;
            bucket.totalFgProduced += fgProducedQty;

            // Reduce items in bucket
            bucket.itemsInWip.forEach(itemRecord => {
              const bom = allBOMs.find(b => b.productName && b.productName.toLowerCase() === (it.itemName || '').toLowerCase());
              let consumedRatio = 1;
              if (bom && Array.isArray(bom.items)) {
                const bomMat = bom.items.find(bi => bi.materialName && bi.materialName.toLowerCase() === itemRecord.materialName.toLowerCase());
                if (bomMat) consumedRatio = Number(bomMat.quantity) || 1;
              }
              const consumed = Math.min(itemRecord.pendingQty, fgProducedQty * consumedRatio);
              itemRecord.consumedQty += consumed;
              itemRecord.pendingQty = Math.max(0, itemRecord.issuedQty - itemRecord.consumedQty);
            });

            bucket.transactions.push({
              date: grn.date,
              type: "FG GRN Completed (WIP Reduced)",
              docNumber: grn.grnNumber,
              materialName: it.itemName,
              itemType: "fg",
              qty: fgProducedQty,
              unit: it.unit || "Nos"
            });
          });
        }
      }
    });

    // Filter items based on requested type
    let allItems = Array.from(wipMap.values()).map(item => ({
      ...item,
      status: item.pendingWipQty <= 0 ? "Completed" : "In-Process"
    }));

    if (requestedType === "rm") {
      allItems = allItems.filter(item => item.itemType === "rm");
    } else if (requestedType === "bo") {
      allItems = allItems.filter(item => item.itemType === "bo");
    } else if (requestedType === "fg") {
      allItems = allItems.filter(item => item.itemType === "fg");
    }

    const mrpBuckets = Array.from(mrpBucketMap.values()).map(b => ({
      ...b,
      items: Array.from(b.itemsInWip.values()),
      netPendingWipCount: Array.from(b.itemsInWip.values()).reduce((sum, it) => sum + (it.pendingQty || 0), 0)
    }));

    const summary = {
      totalItems: allItems.length,
      totalIssuedQty: allItems.reduce((acc, curr) => acc + (curr.totalIssuedQty || 0), 0),
      totalJobWorkSentQty: allItems.reduce((acc, curr) => acc + (curr.totalJobWorkSentQty || 0), 0),
      totalReturnedQty: allItems.reduce((acc, curr) => acc + (curr.totalReturnedQty || 0), 0),
      totalFgConsumedQty: allItems.reduce((acc, curr) => acc + (curr.totalFgConsumedQty || 0), 0),
      netPendingWipQty: allItems.reduce((acc, curr) => acc + (curr.pendingWipQty || 0), 0)
    };

    res.status(200).json({
      wipItems: allItems,
      mrpBuckets: mrpBuckets,
      summary
    });
  } catch (error) {
    console.error("Error fetching WIP Inventory:", error);
    res.status(500).json({ message: "Failed to fetch WIP inventory data", error: error.message });
  }
};

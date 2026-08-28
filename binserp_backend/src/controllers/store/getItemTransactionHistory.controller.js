import mongoose from "mongoose";
import {
  stockTransactionSchema,
  inventorySchema,
  consumableItemSchema,
  rawMaterialSchema,
  boughtOutSchema,
  fgItemSchema,
  rmBoItemSchema,
  materialIssueSchema
} from "../../models/store/index.js";
import { userSchema } from "../../models/user/index.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

const isValidObjectId = (id) => typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);

export const getItemTransactionHistory = async (req, res) => {
  try {
    const StockTransaction = req.getModel("StockTransaction", stockTransactionSchema);
    const Inventory = req.getModel("Inventory", inventorySchema);
    const ConsumableItem = req.getModel("ConsumableItem", consumableItemSchema);
    const RawMaterial = req.getModel("RawMaterial", rawMaterialSchema);
    const BoughtOut = req.getModel("BoughtOut", boughtOutSchema);
    const FGItem = req.getModel("FGItem", fgItemSchema);
    const RmBoItem = req.getModel("RmBoItem", rmBoItemSchema);
    const MaterialIssue = req.getModel("MaterialIssue", materialIssueSchema);
    req.getModel("User", userSchema);

    const companyId = getCompanyId(req);
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: "Item ID is required" });
    }

    const orConditions = [];
    const issueOrConditions = [];
    let itemCodes = [];
    let itemNames = [];
    let matchedIds = [];

    if (isValidObjectId(id)) {
      const objId = new mongoose.Types.ObjectId(id);
      matchedIds.push(objId);
      matchedIds.push(id);
      orConditions.push({ item: objId });
      orConditions.push({ item: id });
      issueOrConditions.push({ 'items.material': objId });
      issueOrConditions.push({ 'items.consumable': objId });
      issueOrConditions.push({ 'items.fgItem': objId });
      issueOrConditions.push({ 'items.component': objId });

      // Look up in Inventory
      const inv = await Inventory.findOne({
        company: companyId,
        $or: [{ _id: objId }, { materialId: objId }]
      });

      if (inv) {
        if (inv._id) {
          matchedIds.push(inv._id);
          orConditions.push({ item: inv._id });
          orConditions.push({ item: inv._id.toString() });
        }
        if (inv.materialId) {
          matchedIds.push(inv.materialId);
          orConditions.push({ item: inv.materialId });
          orConditions.push({ item: inv.materialId.toString() });
          issueOrConditions.push({ 'items.material': inv.materialId });
          issueOrConditions.push({ 'items.consumable': inv.materialId });
        }
        if (inv.materialCode) {
          itemCodes.push(inv.materialCode);
          orConditions.push({ itemCode: inv.materialCode });
          issueOrConditions.push({ 'items.materialCode': inv.materialCode });
        }
        if (inv.materialName) {
          itemNames.push(inv.materialName);
        }
      }

      // Check Consumable, RM, BO, FGItem
      const [consumable, rm, bo, fg, rmbo] = await Promise.all([
        ConsumableItem.findOne({ _id: objId, company: companyId }),
        RawMaterial.findOne({ _id: objId, company: companyId }),
        BoughtOut.findOne({ _id: objId, company: companyId }),
        FGItem.findOne({ _id: objId, company: companyId }),
        RmBoItem.findOne({ _id: objId, company: companyId })
      ]);

      const masterDoc = consumable || rm || bo || fg || rmbo;
      if (masterDoc) {
        if (masterDoc.code) {
          itemCodes.push(masterDoc.code);
          orConditions.push({ itemCode: masterDoc.code });
          issueOrConditions.push({ 'items.materialCode': masterDoc.code });
        }
        if (masterDoc.name) {
          itemNames.push(masterDoc.name);
          issueOrConditions.push({ 'items.materialName': masterDoc.name });
        }
      }
    } else {
      orConditions.push({ itemCode: id });
      issueOrConditions.push({ 'items.materialCode': id });
    }

    const query = {
      company: companyId,
      $or: orConditions.length > 0 ? orConditions : [{ item: id }]
    };

    const transactions = await StockTransaction.find(query)
      .populate("performedBy", "name userId email")
      .sort({ timestamp: -1, createdAt: -1 })
      .lean();

    // Also find directly from MaterialIssue collection
    if (issueOrConditions.length > 0) {
      try {
        const materialIssues = await MaterialIssue.find({
          company: companyId,
          $or: issueOrConditions
        })
          .populate("issuedBy", "name userId email")
          .populate("issuedTo", "name userId email department")
          .sort({ date: -1, createdAt: -1 })
          .lean();

        for (const issue of materialIssues) {
          // Check if this issue is already in transactions
          const alreadyRecorded = transactions.some((t) =>
            (t.referenceDocNumber && issue.issueNumber && t.referenceDocNumber === issue.issueNumber) ||
            (t.referenceDocId && issue._id && t.referenceDocId.toString() === issue._id.toString())
          );

          if (!alreadyRecorded && Array.isArray(issue.items)) {
            issue.items.forEach((item, idx) => {
              const matchesMat = matchedIds.some(
                (mId) =>
                  String(item.material?._id || item.material) === String(mId) ||
                  String(item.consumable?._id || item.consumable) === String(mId)
              );
              const matchesCode = itemCodes.some(
                (c) => item.materialCode && item.materialCode.toUpperCase() === c.toUpperCase()
              );
              const matchesName = itemNames.some(
                (n) => item.materialName && item.materialName.toLowerCase().trim() === n.toLowerCase().trim()
              );

              if (matchesMat || matchesCode || matchesName || issueOrConditions.length === 0) {
                const isConsumable = issue.type === 'consumable' || !!item.consumable;
                const issuedToName = issue.issuedTo?.name || issue.issuedTo?.username || (typeof issue.issuedTo === 'string' ? issue.issuedTo : '');
                const destination = issuedToName
                  ? `Shop Floor (${issuedToName})`
                  : (!issue.department || issue.department.toLowerCase() === 'store' ? 'Shop Floor' : `Shop Floor (${issue.department})`);

                transactions.push({
                  _id: `${issue._id}_${idx}`,
                  itemType: isConsumable ? 'Consumable' : 'RawMaterial',
                  item: item.consumable || item.material || id,
                  itemCode: item.materialCode || '',
                  itemName: item.materialName || '',
                  unit: item.unit || 'PCS',
                  movementType: 'OUTWARD',
                  transactionCategory: isConsumable ? 'MATERIAL_ISSUE_CONSUMABLE_OUTWARD' : 'MATERIAL_ISSUE_SHOPFLOOR_OUTWARD',
                  quantity: Number(item.quantity) || 1,
                  referenceDocType: 'MaterialIssue',
                  referenceDocId: issue._id,
                  referenceDocNumber: issue.issueNumber,
                  recipientOrSource: destination,
                  purpose: item.purpose || `Issue to Shop Floor (${issue.department || 'Store'})`,
                  performedBy: issue.issuedBy,
                  performedByName: issue.issuedBy?.name || issue.issuedBy?.username || 'Store Admin',
                  timestamp: issue.date || issue.createdAt,
                  createdAt: issue.createdAt || issue.date,
                });
              }
            });
          }
        }
      } catch (issueQueryErr) {
        console.warn("Could not query MaterialIssue in getItemTransactionHistory:", issueQueryErr);
      }
    }

    // Sort combined results by timestamp descending
    transactions.sort((a, b) => {
      const timeA = new Date(a.timestamp || a.createdAt || 0).getTime();
      const timeB = new Date(b.timestamp || b.createdAt || 0).getTime();
      return timeB - timeA;
    });

    res.status(200).json({
      success: true,
      count: transactions.length,
      transactions,
    });
  } catch (error) {
    console.error("Error fetching item transaction history:", error);
    res.status(500).json({ message: error.message || "Failed to fetch item history" });
  }
};



import mongoose from "mongoose";
import { stockTransactionSchema } from "../models/store/index.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

export const recordStockTransaction = async (req, params) => {
  try {
    const StockTransaction = req.getModel("StockTransaction", stockTransactionSchema);
    const companyId = getCompanyId(req);

    const {
      itemType,
      item,
      itemCode = "",
      itemName,
      unit = "PCS",
      movementType,
      transactionCategory,
      quantity,
      previousStock = 0,
      newStock = 0,
      referenceDocType,
      referenceDocId,
      referenceDocNumber = "",
      recipientOrSource = "",
      purpose = "",
      performedBy,
      performedByName = "",
      hasSecondaryUnit = false,
      secondaryUnit = "",
      secondaryQuantity = 0,
    } = params;

    const userId = performedBy || req.user?.id || req.user?._id;
    const userName = performedByName || req.user?.name || req.user?.username || "System";

    const cleanItem = (item && mongoose.Types.ObjectId.isValid(item.toString())) ? item : undefined;

    // Intelligent normalization for itemType
    let resolvedItemType = itemType || params.category || params.itemCategory || "RawMaterial";
    const cleanType = String(resolvedItemType).trim().toLowerCase();
    if (cleanType.includes("bought") || cleanType === "bo" || cleanType === "boughtout") {
      resolvedItemType = "BoughtOut";
    } else if (cleanType.includes("consumable")) {
      resolvedItemType = "ConsumableItem";
    } else if (cleanType.includes("component") || cleanType.includes("subassembly") || cleanType.includes("assembly")) {
      resolvedItemType = "Component";
    } else if (cleanType.includes("fg") || cleanType.includes("finish")) {
      resolvedItemType = "FGItem";
    } else if (cleanType.includes("rmbo") || cleanType === "rm_bo") {
      resolvedItemType = "RmBo";
    } else if (cleanType === "wip") {
      resolvedItemType = "Component";
    } else {
      resolvedItemType = "RawMaterial";
    }

    const resolvedMovementType = movementType || (Number(quantity) >= 0 ? "INWARD" : "OUTWARD");
    const resolvedRefDocType = referenceDocType || "StockAdjustment";
    const resolvedTxCategory = transactionCategory || (resolvedMovementType === "INWARD" ? "STOCK_ADJUSTMENT_INWARD" : "STOCK_ADJUSTMENT");

    const transaction = await StockTransaction.create({
      company: companyId,
      itemType: resolvedItemType,
      item: cleanItem,
      itemCode,
      itemName,
      unit,
      hasSecondaryUnit,
      secondaryUnit,
      secondaryQuantity,
      movementType: resolvedMovementType,
      transactionCategory: resolvedTxCategory,
      quantity: Math.abs(quantity),
      previousStock,
      newStock,
      referenceDocType: resolvedRefDocType,
      referenceDocId,
      referenceDocNumber,
      recipientOrSource,
      purpose,
      performedBy: userId,
      performedByName: userName,
      timestamp: new Date(),
    });

    return transaction;
  } catch (error) {
    console.error("Error recording stock transaction:", error.message, error);
    throw error;
  }
};

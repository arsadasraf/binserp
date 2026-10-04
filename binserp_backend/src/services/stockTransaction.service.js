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

    const transaction = await StockTransaction.create({
      company: companyId,
      itemType,
      item: cleanItem,
      itemCode,
      itemName,
      unit,
      hasSecondaryUnit,
      secondaryUnit,
      secondaryQuantity,
      movementType,
      transactionCategory,
      quantity: Math.abs(quantity),
      previousStock,
      newStock,
      referenceDocType,
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

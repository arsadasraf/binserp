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
    } = params;

    const userId = performedBy || req.user?.id || req.user?._id;
    const userName = performedByName || req.user?.name || req.user?.username || "System";

    const transaction = await StockTransaction.create({
      company: companyId,
      itemType,
      item,
      itemCode,
      itemName,
      unit,
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
    console.error("Error recording stock transaction:", error);
    // Return null instead of crashing caller, but log error
    return null;
  }
};

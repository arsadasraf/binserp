import { stockTransactionSchema } from "../../models/store/index.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

export const getStockTransactions = async (req, res) => {
  try {
    const StockTransaction = req.getModel("StockTransaction", stockTransactionSchema);
    const companyId = getCompanyId(req);

    const {
      itemType,
      movementType,
      transactionCategory,
      referenceDocType,
      search,
      date,
      month,
      startDate,
      endDate,
      page = 1,
      limit = 50,
    } = req.query;

    const query = { company: companyId };

    // Item Type Filter with normalized aliases
    if (itemType) {
      const cleanType = itemType.toString().trim().toLowerCase();
      if (cleanType === 'rm' || cleanType === 'rawmaterial' || cleanType === 'raw material' || cleanType === 'raw-material') {
        query.$or = [
          { itemType: { $in: ["RawMaterial", "Raw Material", "RM"] } },
          { itemType: "RmBo", itemCode: { $regex: /^RM/i } },
          { itemType: "RmBo", itemCode: { $not: /^BO/i } }
        ];
      } else if (cleanType === 'bo' || cleanType === 'boughtout' || cleanType === 'bought out' || cleanType === 'bought-out') {
        query.$or = [
          { itemType: { $in: ["BoughtOut", "Bought Out", "BO"] } },
          { itemCode: { $regex: /^BO/i } }
        ];
      } else if (cleanType === 'consumable' || cleanType === 'consumables' || cleanType === 'consumableitem' || cleanType === 'consumable-item') {
        query.$or = [
          { itemType: { $in: ["Consumable", "Consumables", "ConsumableItem", "consumable-item"] } },
          { itemCode: { $regex: /^CON/i } }
        ];
      } else if (cleanType === 'fg' || cleanType === 'fgitem' || cleanType === 'finished goods' || cleanType === 'finished-goods') {
        query.itemType = { $in: ["FGItem", "FG", "Component"] };
      } else if (cleanType === 'component') {
        query.itemType = "Component";
      } else {
        query.itemType = itemType;
      }
    }

    if (movementType) query.movementType = movementType.toUpperCase();
    if (transactionCategory) query.transactionCategory = transactionCategory;
    if (referenceDocType) query.referenceDocType = referenceDocType;

    // Day and Month Date Filtering Logic
    if (date) {
      const targetDate = new Date(date);
      const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0, 0);
      const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59, 999);
      query.timestamp = { $gte: startOfDay, $lte: endOfDay };
    } else if (month) {
      // Month format: YYYY-MM or YYYY-M
      const [yearStr, monthStr] = month.split('-');
      const year = parseInt(yearStr, 10);
      const monthIndex = parseInt(monthStr, 10) - 1; // 0-indexed
      const startOfMonth = new Date(year, monthIndex, 1, 0, 0, 0, 0);
      const endOfMonth = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
      query.timestamp = { $gte: startOfMonth, $lte: endOfMonth };
    } else if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) {
        const s = new Date(startDate);
        s.setHours(0, 0, 0, 0);
        query.timestamp.$gte = s;
      }
      if (endDate) {
        const e = new Date(endDate);
        e.setHours(23, 59, 59, 999);
        query.timestamp.$lte = e;
      }
    }

    if (search) {
      const searchRegex = new RegExp(search, "i");
      query.$or = [
        { itemName: searchRegex },
        { itemCode: searchRegex },
        { referenceDocNumber: searchRegex },
        { recipientOrSource: searchRegex },
        { purpose: searchRegex },
        { performedByName: searchRegex },
      ];
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 50;
    const skip = (pageNum - 1) * limitNum;

    const [transactions, total] = await Promise.all([
      StockTransaction.find(query)
        .populate("performedBy", "name userId email")
        .sort({ timestamp: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      StockTransaction.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      transactions,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("Error fetching stock transactions:", error);
    res.status(500).json({ message: error.message || "Failed to fetch stock transactions" });
  }
};

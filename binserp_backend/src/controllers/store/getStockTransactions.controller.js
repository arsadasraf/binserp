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
      startDate,
      endDate,
      page = 1,
      limit = 50,
    } = req.query;

    const query = { company: companyId };

    if (itemType) query.itemType = itemType;
    if (movementType) query.movementType = movementType.toUpperCase();
    if (transactionCategory) query.transactionCategory = transactionCategory;
    if (referenceDocType) query.referenceDocType = referenceDocType;

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.timestamp.$lte = end;
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

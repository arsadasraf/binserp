import { stockTransactionSchema } from "../../models/store/index.js";
import { userSchema } from "../../models/user/index.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

export const getItemTransactionHistory = async (req, res) => {
  try {
    const StockTransaction = req.getModel("StockTransaction", stockTransactionSchema);
    req.getModel("User", userSchema);
    const companyId = getCompanyId(req);
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: "Item ID is required" });
    }

    const transactions = await StockTransaction.find({
      company: companyId,
      item: id,
    })
      .populate("performedBy", "name userId email")
      .sort({ timestamp: -1, createdAt: -1 });

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

import { AccountTransaction } from "../../models/accounts/index.js";

// Generate unique transaction IDs securely
const generateTxnId = () => {
  return "TXN" + Math.floor(100000 + Math.random() * 900000).toString();
};

export const getTransactions = async (req, res) => {
  try {
    const { type, status } = req.query;
    
    let query = { company: req.user.company };
    if (type) query.type = type;
    if (status) query.status = status;

    const transactions = await AccountTransaction.find(query).sort({ date: -1 });

    res.status(200).json({ success: true, count: transactions.length, data: transactions });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

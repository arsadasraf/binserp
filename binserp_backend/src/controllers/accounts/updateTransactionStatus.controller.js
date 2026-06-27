import { AccountTransaction } from "../../models/accounts/index.js";

// Generate unique transaction IDs securely
const generateTxnId = () => {
  return "TXN" + Math.floor(100000 + Math.random() * 900000).toString();
};

export const updateTransactionStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const txn = await AccountTransaction.findOne({ _id: id, company: req.user.company });

    if (!txn) {
      return res.status(404).json({ success: false, message: "Transaction not found" });
    }

    txn.status = status;
    await txn.save();

    res.status(200).json({ success: true, data: txn });
  } catch (error) {
    console.error("Error updating transaction:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

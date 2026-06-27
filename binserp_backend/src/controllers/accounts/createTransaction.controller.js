import { AccountTransaction } from "../../models/accounts/index.js";

// Generate unique transaction IDs securely
const generateTxnId = () => {
  return "TXN" + Math.floor(100000 + Math.random() * 900000).toString();
};

export const createTransaction = async (req, res) => {
  try {
    const { type, category, amount, status, paymentMethod, description, referenceId, date, partyName } = req.body;

    if (!type || !category || !amount) {
      return res.status(400).json({ success: false, message: "Type, category, and amount are required" });
    }

    const newTxn = await AccountTransaction.create({
      company: req.user.company,
      transactionId: generateTxnId(),
      type,
      category,
      amount,
      status: status || "Completed",
      paymentMethod,
      description,
      referenceId,
      date: date || new Date(),
      partyName,
    });

    res.status(201).json({ success: true, data: newTxn });
  } catch (error) {
    console.error("Error creating transaction:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

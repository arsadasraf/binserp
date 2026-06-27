import { AccountTransaction } from "../models/accounts/index.js";

// Generate unique transaction IDs securely
const generateTxnId = () => {
  return "TXN" + Math.floor(100000 + Math.random() * 900000).toString();
};

export const getOverviewStats = async (req, res) => {
  try {
    const transactions = await AccountTransaction.find({ company: req.user.company });

    let totalIncome = 0;
    let totalExpenses = 0;
    let pendingReceivables = 0;
    let pendingPayables = 0;

    transactions.forEach((txn) => {
      if (txn.status === "Completed") {
        if (txn.type === "Income" || txn.type === "Invoice") {
          totalIncome += txn.amount;
        } else if (txn.type === "Expense" || txn.type === "Bill" || txn.type === "Payroll") {
          totalExpenses += txn.amount;
        }
      } else if (txn.status === "Pending" || txn.status === "Overdue") {
        if (txn.type === "Invoice") {
          pendingReceivables += txn.amount;
        } else if (txn.type === "Bill") {
          pendingPayables += txn.amount;
        }
      }
    });

    const netProfit = totalIncome - totalExpenses;

    res.status(200).json({
      success: true,
      data: {
        totalIncome,
        totalExpenses,
        netProfit,
        pendingReceivables,
        pendingPayables,
      },
    });
  } catch (error) {
    console.error("Error fetching accounts stats:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
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

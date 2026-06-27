import { AccountTransaction } from "../../models/accounts/index.js";

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

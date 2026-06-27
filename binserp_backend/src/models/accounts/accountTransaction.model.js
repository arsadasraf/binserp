import mongoose from "mongoose";

export const accountTransactionSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    transactionId: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["Income", "Expense", "Invoice", "Bill", "Payroll"],
      required: true,
    },
    category: {
      type: String, // e.g., 'Raw Materials', 'Client Payment', 'Salary'
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["Pending", "Completed", "Overdue", "Cancelled"],
      default: "Completed",
    },
    paymentMethod: {
      type: String,
      enum: ["Bank Transfer", "Cash", "Credit Card", "Cheque", "Other"],
      default: "Bank Transfer",
    },
    description: {
      type: String,
    },
    referenceId: {
      type: String, // e.g. linked PO number, Invoice number
    },
    date: {
      type: Date,
      default: Date.now,
    },
    partyName: {
      type: String, // Client or Vendor name
    },
  },
  { timestamps: true }
);

export const AccountTransaction = mongoose.model("AccountTransaction", accountTransactionSchema);

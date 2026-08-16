import React, { useState, useEffect, useCallback } from "react";
import { getApiBaseUrl } from "@/src/utils/config";
import {
  Search,
  ArrowDownLeft,
  ArrowUpRight,
  Filter,
  RefreshCw,
  Calendar,
  FileText,
  User,
  Building,
  Tag,
  ChevronLeft,
  ChevronRight,
  Layers
} from "lucide-react";

interface Transaction {
  _id: string;
  itemType: "RmBo" | "FGItem" | "Component";
  itemCode: string;
  itemName: string;
  unit: string;
  movementType: "INWARD" | "OUTWARD";
  transactionCategory: string;
  quantity: number;
  previousStock: number;
  newStock: number;
  referenceDocType: string;
  referenceDocNumber: string;
  recipientOrSource: string;
  purpose: string;
  performedByName: string;
  timestamp: string;
}

interface StockTransactionLedgerTableProps {
  token: string | null;
  apiUrl?: string;
}

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  GRN_PURCHASE_INWARD: { label: "GRN Purchase Inward", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300" },
  GRN_QC_PENDING_INWARD: { label: "GRN QC Pending Inward", color: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300" },
  QC_RELEASE_INWARD: { label: "QC Approved Inward", color: "bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300" },
  JOB_WORK_RETURN_INWARD: { label: "JW Return Inward", color: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300" },
  FG_GRN_INWARD: { label: "FG Production GRN Inward", color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300" },
  MATERIAL_ISSUE_SHOPFLOOR_OUTWARD: { label: "Shopfloor Issue Outward", color: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300" },
  MATERIAL_ISSUE_FG_OUTWARD: { label: "Shopfloor FG Outward", color: "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300" },
  RETURNABLE_DC_JOB_WORK_OUTWARD: { label: "Returnable DC (Job Work) Outward", color: "bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300" },
  SALES_DC_OUTWARD: { label: "Sales DC Outward", color: "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300" },
  INVOICE_OUTWARD: { label: "Invoice Outward", color: "bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-300" },
  STOCK_ADJUSTMENT: { label: "Stock Adjustment", color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300" },
};

export default function StockTransactionLedgerTable({ token }: StockTransactionLedgerTableProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filter States
  const [search, setSearch] = useState<string>("");
  const [itemTypeFilter, setItemTypeFilter] = useState<string>("");
  const [movementFilter, setMovementFilter] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Pagination
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);

  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const queryParams = new URLSearchParams();
      queryParams.append("page", String(page));
      queryParams.append("limit", "25");

      if (search) queryParams.append("search", search);
      if (itemTypeFilter) queryParams.append("itemType", itemTypeFilter);
      if (movementFilter) queryParams.append("movementType", movementFilter);
      if (categoryFilter) queryParams.append("transactionCategory", categoryFilter);
      if (startDate) queryParams.append("startDate", startDate);
      if (endDate) queryParams.append("endDate", endDate);

      const baseUrl = getApiBaseUrl();
      const endpoint = `${baseUrl}/api/store/transactions?${queryParams.toString()}`;


      const res = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${token || ""}`,
          "Content-Type": "application/json",
        },
      });

      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await res.text();
        console.error("Non-JSON API Response received:", text.slice(0, 200));
        throw new Error(`Server returned HTML response (${res.status}). Verify API server is running on port 8000.`);
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load transactions");

      setTransactions(data.transactions || []);
      setTotalPages(data.pagination?.pages || 1);
      setTotalCount(data.pagination?.total || 0);
    } catch (err: any) {
      console.error("Error fetching transactions:", err);
      setError(err.message || "Error connecting to server");
    } finally {
      setLoading(false);
    }
  }, [token, page, search, itemTypeFilter, movementFilter, categoryFilter, startDate, endDate]);


  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleResetFilters = () => {
    setSearch("");
    setItemTypeFilter("");
    setMovementFilter("");
    setCategoryFilter("");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  return (
    <div className="space-y-4">
      {/* Search & Filter Header Bar */}
      <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search by Item, Doc #, User, Party..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 text-gray-900 dark:text-gray-100 placeholder-gray-400"
            />
          </div>

          {/* Action & Filter Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Item Type */}
            <select
              value={itemTypeFilter}
              onChange={(e) => { setItemTypeFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              <option value="">All Item Types</option>
              <option value="RmBo">RM / BO (Raw Material)</option>
              <option value="FGItem">FG (Finished Goods)</option>
            </select>

            {/* Movement Type */}
            <select
              value={movementFilter}
              onChange={(e) => { setMovementFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              <option value="">All Movements</option>
              <option value="INWARD">Inward (+)</option>
              <option value="OUTWARD">Outward (-)</option>
            </select>

            {/* Transaction Category */}
            <select
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/40 max-w-[200px] truncate"
            >
              <option value="">All Categories</option>
              {Object.entries(CATEGORY_LABELS).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>

            {/* Date Pickers */}
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
              className="px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-700 dark:text-gray-300"
            />
            <span className="text-gray-400 text-xs">-</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
              className="px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-700 dark:text-gray-300"
            />

            {/* Refresh / Reset */}
            <button
              onClick={fetchTransactions}
              title="Refresh Data"
              className="p-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-xl text-gray-600 dark:text-gray-300 transition-colors"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              onClick={handleResetFilters}
              title="Reset Filters"
              className="px-3 py-2 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-xl transition-colors font-medium"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Counter Summary */}
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 pt-1 border-t border-gray-100 dark:border-gray-800">
          <span>Showing <strong className="text-gray-800 dark:text-gray-200">{transactions.length}</strong> of <strong className="text-gray-800 dark:text-gray-200">{totalCount}</strong> transaction entries</span>
          <span>Page {page} of {totalPages}</span>
        </div>
      </div>

      {/* Main Ledger Table */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 text-gray-400 space-y-3">
            <RefreshCw size={28} className="animate-spin text-blue-600" />
            <p className="text-sm font-medium">Fetching transaction ledger entries...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-500 font-medium">
            {error}
          </div>
        ) : transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 text-center text-gray-400 space-y-2">
            <Layers size={36} className="text-gray-300 dark:text-gray-700" />
            <p className="font-semibold text-gray-600 dark:text-gray-300 text-sm">No transaction records found</p>
            <p className="text-xs text-gray-400 max-w-sm">No inventory inward or outward movements match the selected search or filter criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/80 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Item Details</th>
                  <th className="py-3 px-4">Movement</th>
                  <th className="py-3 px-4">Transaction Type</th>
                  <th className="py-3 px-4 text-right">Quantity</th>
                  <th className="py-3 px-4 text-right">Stock Ledger Balance</th>
                  <th className="py-3 px-4">Ref Document</th>
                  <th className="py-3 px-4">Party / Department</th>
                  <th className="py-3 px-4">Performed By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-xs">
                {transactions.map((tx) => {
                  const isInward = tx.movementType === "INWARD";
                  const catMeta = CATEGORY_LABELS[tx.transactionCategory] || {
                    label: tx.transactionCategory,
                    color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
                  };

                  const formattedDate = new Date(tx.timestamp || (tx as any).createdAt).toLocaleString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <tr
                      key={tx._id}
                      className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40 transition-colors"
                    >
                      {/* Date */}
                      <td className="py-3 px-4 text-gray-600 dark:text-gray-300 font-mono whitespace-nowrap">
                        {formattedDate}
                      </td>

                      {/* Item Details */}
                      <td className="py-3 px-4 font-medium text-gray-900 dark:text-gray-100">
                        <div className="flex flex-col">
                          <span className="font-semibold text-gray-900 dark:text-gray-100">{tx.itemName}</span>
                          <span className="text-[10px] text-gray-400 font-mono">
                            {tx.itemCode ? `Code: ${tx.itemCode}` : `Type: ${tx.itemType}`}
                          </span>
                        </div>
                      </td>

                      {/* Movement */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            isInward
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/50"
                              : "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/50"
                          }`}
                        >
                          {isInward ? <ArrowDownLeft size={13} /> : <ArrowUpRight size={13} />}
                          {tx.movementType}
                        </span>
                      </td>

                      {/* Transaction Type Category */}
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold whitespace-nowrap ${catMeta.color}`}>
                          {catMeta.label}
                        </span>
                      </td>

                      {/* Quantity */}
                      <td className="py-3 px-4 text-right font-mono font-bold whitespace-nowrap">
                        <span className={isInward ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                          {isInward ? "+" : "-"}{tx.quantity} {tx.unit}
                        </span>
                      </td>

                      {/* Prev -> New Stock Balance */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex flex-col items-end">
                          <span className="font-semibold text-gray-900 dark:text-gray-100 font-mono">{tx.newStock} {tx.unit}</span>
                          <span className="text-[10px] text-gray-400 font-mono">Prev: {tx.previousStock}</span>
                        </div>
                      </td>

                      {/* Ref Document */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-semibold text-blue-600 dark:text-blue-400 font-mono">
                            {tx.referenceDocNumber || "N/A"}
                          </span>
                          <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
                            {tx.referenceDocType}
                          </span>
                        </div>
                      </td>

                      {/* Recipient / Source */}
                      <td className="py-3 px-4 text-gray-700 dark:text-gray-300">
                        <div className="flex flex-col">
                          <span className="font-medium">{tx.recipientOrSource || "-"}</span>
                          {tx.purpose && <span className="text-[10px] text-gray-400 truncate max-w-[150px]">{tx.purpose}</span>}
                        </div>
                      </td>

                      {/* Performed By */}
                      <td className="py-3 px-4 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <User size={13} className="text-gray-400" />
                          <span className="font-medium text-gray-800 dark:text-gray-200">{tx.performedByName || "System"}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer Pagination */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between p-3 bg-gray-50/60 dark:bg-gray-800/40 border-t border-gray-100 dark:border-gray-800 text-xs">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="flex items-center gap-1 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 transition-all font-medium"
            >
              <ChevronLeft size={14} /> Previous
            </button>

            <span className="text-gray-500 dark:text-gray-400">
              Page <strong className="text-gray-800 dark:text-gray-200">{page}</strong> of {totalPages}
            </span>

            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="flex items-center gap-1 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 transition-all font-medium"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

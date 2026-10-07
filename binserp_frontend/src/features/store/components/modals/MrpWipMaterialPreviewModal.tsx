"use client";

import React, { useState } from "react";
import { 
  X, 
  Boxes, 
  CheckCircle2, 
  Clock, 
  Layers, 
  Calendar, 
  User, 
  Building2, 
  FileText, 
  AlertCircle,
  ArrowRight,
  TrendingUp,
  History
} from "lucide-react";
import { ItemNameAndDescription, getItemDescription } from "@/src/utils/itemDisplayHelper";

interface MrpWipMaterialPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  mrpBucket: any | null;
}

export default function MrpWipMaterialPreviewModal({
  isOpen,
  onClose,
  mrpBucket,
}: MrpWipMaterialPreviewModalProps) {
  const [activeTab, setActiveTab] = useState<"materials" | "history">("materials");

  if (!isOpen || !mrpBucket) return null;

  const isCompleted = mrpBucket.status === "Completed" || (mrpBucket.pendingWipQty <= 0 && mrpBucket.totalIssuedQty > 0);
  const items = mrpBucket.items || [];
  const transactions = mrpBucket.transactions || [];

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-2 sm:p-4 lg:p-6 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 w-full max-w-5xl xl:max-w-6xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col">
        
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0 border-b border-indigo-900/50">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center backdrop-blur-md shadow-inner text-indigo-300">
              <Boxes size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="font-mono text-sm sm:text-base font-black text-white bg-indigo-600/40 px-2.5 py-0.5 rounded-lg border border-indigo-400/30">
                  {mrpBucket.mrpNumber}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  isCompleted 
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" 
                    : "bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 animate-pulse"
                }`}>
                  {isCompleted ? "MRP Closed / Completed" : "Active In Production"}
                </span>
                {mrpBucket.salesOrderNumber && (
                  <span className="text-xs font-mono font-bold text-slate-300">
                    SO: {mrpBucket.salesOrderNumber}
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-300 mt-1 flex items-center gap-2 flex-wrap">
                <span className="font-bold text-white">{mrpBucket.productName || "Finished Good"}</span>
                <span className="text-slate-400">({mrpBucket.orderQuantity} {mrpBucket.unit || "PCS"})</span>
                {mrpBucket.customerName && (
                  <span className="text-indigo-300 font-medium">• Customer: {mrpBucket.customerName}</span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition-colors cursor-pointer shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Progress Metrics Strip */}
        <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0 text-xs">
          <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Total Issued to WIP</span>
            <span className="font-mono font-bold text-sm sm:text-base text-amber-600 dark:text-amber-400 mt-0.5 block">
              {mrpBucket.totalIssuedQty || 0} <span className="text-[11px] font-normal text-slate-400">{mrpBucket.unit || "units"}</span>
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">FG Consumed / Produced</span>
            <span className="font-mono font-bold text-sm sm:text-base text-emerald-600 dark:text-emerald-400 mt-0.5 block">
              {mrpBucket.totalConsumedQty || 0} <span className="text-[11px] font-normal text-slate-400">{mrpBucket.unit || "units"}</span>
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-900/60">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block">Pending Balance In WIP</span>
            <span className="font-mono font-black text-sm sm:text-base text-indigo-700 dark:text-indigo-300 mt-0.5 block">
              {mrpBucket.pendingWipQty || 0} <span className="text-[11px] font-normal text-indigo-400">{mrpBucket.unit || "units"}</span>
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Issued Material Types</span>
            <span className="font-mono font-bold text-sm sm:text-base text-slate-800 dark:text-slate-200 mt-0.5 block">
              {items.length} <span className="text-[11px] font-normal text-slate-400">materials</span>
            </span>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="px-6 pt-3 pb-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-3 shrink-0">
          <button
            onClick={() => setActiveTab("materials")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === "materials"
                ? "bg-indigo-600 text-white shadow-xs"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Layers size={14} />
            <span>Issued Materials Status ({items.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("history")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === "history"
                ? "bg-indigo-600 text-white shadow-xs"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <History size={14} />
            <span>Store Issue Slips &amp; Movements ({transactions.length})</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          {activeTab === "materials" ? (
            items.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50/50 dark:bg-slate-900/40">
                <Boxes className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600 mb-2" />
                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">No materials issued yet</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Store Material Issues linked to this MRP Plan will populate here.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-100/80 dark:bg-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                      <th className="px-4 py-3.5">Material &amp; Technical Description</th>
                      <th className="px-4 py-3.5 text-center w-32">Category</th>
                      <th className="px-4 py-3.5 text-center w-32">Issued Qty</th>
                      <th className="px-4 py-3.5 text-center w-32">FG Consumed</th>
                      <th className="px-4 py-3.5 text-center w-36">Pending in WIP</th>
                      <th className="px-4 py-3.5 text-center w-20">Unit</th>
                      <th className="px-4 py-3.5 text-center w-36">Material Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {items.map((it: any, idx: number) => {
                      const desc = getItemDescription(it) || it.materialDescription || it.description || "";
                      const pendingNum = Number(it.pendingQty || 0);
                      const issuedNum = Number(it.issuedQty || 0);
                      const consumedNum = Number(it.consumedQty || 0);
                      const isFullyConsumed = pendingNum <= 0 && issuedNum > 0;
                      const isPartial = consumedNum > 0 && pendingNum > 0;

                      return (
                        <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="px-4 py-3.5 min-w-[280px] lg:min-w-[340px]">
                            <ItemNameAndDescription
                              name={it.materialName}
                              description={desc}
                            />
                          </td>

                          <td className="px-4 py-3.5 text-center">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              it.itemType === "bo" || it.category?.toLowerCase().includes("bought")
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                : it.itemType === "fg" || it.category?.toLowerCase().includes("sub")
                                ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                                : "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300"
                            }`}>
                              {it.category || (it.itemType === "bo" ? "Bought Out" : "Raw Material")}
                            </span>
                          </td>

                          <td className="px-4 py-3.5 text-center font-mono font-bold text-slate-800 dark:text-slate-200">
                            {issuedNum}
                          </td>

                          <td className="px-4 py-3.5 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {consumedNum}
                          </td>

                          <td className="px-4 py-3.5 text-center font-mono font-black text-indigo-700 dark:text-indigo-300">
                            {pendingNum}
                          </td>

                          <td className="px-4 py-3.5 text-center font-semibold text-slate-500">
                            {it.unit || "PCS"}
                          </td>

                          <td className="px-4 py-3.5 text-center">
                            {isFullyConsumed ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                                <CheckCircle2 size={12} /> Fully Consumed
                              </span>
                            ) : isPartial ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                                <TrendingUp size={12} /> In Prod ({pendingNum} left)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800">
                                <Clock size={12} /> In Shopfloor WIP
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            transactions.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50/50 dark:bg-slate-900/40">
                <History className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600 mb-2" />
                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">No transactions recorded</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Material issue slips and FG receipts will appear in this audit log.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-100/80 dark:bg-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                      <th className="px-4 py-3.5">Date</th>
                      <th className="px-4 py-3.5">Document #</th>
                      <th className="px-4 py-3.5">Movement Type</th>
                      <th className="px-4 py-3.5">Material &amp; Technical Description</th>
                      <th className="px-4 py-3.5 text-center">Quantity</th>
                      <th className="px-4 py-3.5 text-center">Unit</th>
                      <th className="px-4 py-3.5 text-center">Department / Issued To</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {transactions.map((tx: any, idx: number) => {
                      const desc = getItemDescription(tx) || tx.materialDescription || tx.description || "";
                      return (
                        <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="px-4 py-3.5 whitespace-nowrap text-slate-600 dark:text-slate-400 font-medium">
                            {tx.date ? new Date(tx.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            {tx.docNumber || "—"}
                          </td>
                          <td className="px-4 py-3.5 font-semibold text-slate-700 dark:text-slate-300">
                            {tx.type || "Movement"}
                          </td>
                          <td className="px-4 py-3.5 min-w-[240px]">
                            <ItemNameAndDescription
                              name={tx.materialName}
                              description={desc}
                            />
                          </td>
                          <td className="px-4 py-3.5 text-center font-mono font-bold text-slate-900 dark:text-white">
                            {tx.qty}
                          </td>
                          <td className="px-4 py-3.5 text-center font-semibold text-slate-500">
                            {tx.unit || "PCS"}
                          </td>
                          <td className="px-4 py-3.5 text-center text-slate-600 dark:text-slate-400">
                            {tx.department || tx.issuedTo || "Shopfloor"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 text-xs">
          <div className="text-slate-500">
            MRP Plan <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{mrpBucket.mrpNumber}</span> • {items.length} materials tracked.
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
          >
            Close Preview
          </button>
        </div>

      </div>
    </div>
  );
}

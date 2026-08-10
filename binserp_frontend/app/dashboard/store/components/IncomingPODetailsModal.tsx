import React, { useState, useEffect } from "react";
import { X, FileText, ShoppingCart, Activity, CheckCircle2, Clock, Truck, Package, Layers } from "lucide-react";
import { IncomingPOForm } from "./IncomingPOForm";
import { useGetIncomingPODispatchHistoryQuery } from "@/src/store/services/storeService";
import LoadingSpinner from "@/src/components/LoadingSpinner";

interface IncomingPODetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  po: any;
  customers: any[];
  fgItems: any[];
  companyInfo: any;
  onGenerateOrder: (id: string) => void;
  isGeneratingOrder: boolean;
}

export const IncomingPODetailsModal: React.FC<IncomingPODetailsModalProps> = ({
  isOpen,
  onClose,
  po,
  customers = [],
  fgItems = [],
  companyInfo,
  onGenerateOrder,
  isGeneratingOrder
}) => {
  const [activeTab, setActiveTab] = useState<"details" | "history">("details");

  const { data: historyData, isLoading } = useGetIncomingPODispatchHistoryQuery(po?._id, {
    skip: !po?._id || activeTab !== "history"
  });

  if (!isOpen || !po) return null;

  const deliveryChallans = historyData?.data?.deliveryChallans || [];
  const invoices = historyData?.data?.invoices || [];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md sm:p-6">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-slate-50 to-blue-50/30 dark:from-slate-900 dark:to-slate-800/60">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-500/20">
              <ShoppingCart size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  Customer PO: {po.poNumber}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">
                  {po.status || "Received"}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Customer: <span className="font-semibold text-slate-700 dark:text-slate-200">{po.customer?.name || po.customerName || "Customer"}</span> | Target Date: {po.targetDate ? new Date(po.targetDate).toLocaleDateString() : "N/A"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {(po.status === 'Received' || po.status === 'Accepted') && (
              <button
                onClick={() => onGenerateOrder(po._id)}
                disabled={isGeneratingOrder}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50 flex items-center gap-2"
              >
                {isGeneratingOrder ? "Generating..." : "Generate Internal Sales Order"}
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-6 px-6 pt-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
          <button
            onClick={() => setActiveTab("details")}
            className={`pb-3 px-2 text-xs font-bold tracking-wider uppercase transition-colors relative flex items-center gap-2 ${
              activeTab === "details"
                ? "text-blue-600 dark:text-blue-400"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <FileText size={16} />
            PO Details & Specifications
            {activeTab === "details" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-t-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`pb-3 px-2 text-xs font-bold tracking-wider uppercase transition-colors relative flex items-center gap-2 ${
              activeTab === "history"
                ? "text-blue-600 dark:text-blue-400"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <Activity size={16} />
            Dispatch Transactions & Visual Timeline
            {activeTab === "history" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-t-full" />
            )}
          </button>
        </div>

        {/* Modal Tab Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 dark:bg-slate-900/50">
          {activeTab === "details" ? (
            <IncomingPOForm
              initialData={po}
              customers={customers}
              fgItems={fgItems}
              companyInfo={companyInfo}
              onSubmit={() => {}}
              onCancel={onClose}
              isPreview={true}
            />
          ) : (
            <div className="space-y-8">
              {isLoading ? (
                <div className="flex justify-center p-12"><LoadingSpinner /></div>
              ) : (
                <>
                  {/* Item Balance Progress Card */}
                  <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm space-y-4">
                    <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold">
                      <Layers size={18} className="text-blue-600" />
                      <h3 className="text-sm uppercase tracking-wider">Item Dispatch Balances & Quantities Available</h3>
                    </div>

                    <div className="space-y-4">
                      {(po.items || []).map((item: any, idx: number) => {
                        const ordered = item.quantity || 0;
                        const dispatched = item.dispatchedQuantity || 0;
                        const remaining = Math.max(0, ordered - dispatched);
                        const progressPercent = Math.min(100, Math.round((dispatched / (ordered || 1)) * 100));

                        return (
                          <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-900/80 rounded-xl border border-slate-200/70 dark:border-slate-800 space-y-2">
                            <div className="flex justify-between items-center text-xs font-semibold">
                              <span className="text-slate-900 dark:text-white font-bold text-sm">
                                {idx + 1}. {item.productName || item.name || "Product"}
                              </span>
                              <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                                <span>Ordered: <strong className="text-slate-900 dark:text-white">{ordered} {item.unit || "PCS"}</strong></span>
                                <span>Dispatched: <strong className="text-blue-600 dark:text-blue-400">{dispatched}</strong></span>
                                <span>Available: <strong className="text-emerald-600 dark:text-emerald-400">{remaining}</strong></span>
                              </div>
                            </div>

                            {/* Progress bar */}
                            <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex">
                              <div 
                                className="h-full bg-blue-600 rounded-full transition-all duration-500" 
                                style={{ width: `${progressPercent}%` }} 
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Delivery Challans Timeline Log */}
                  <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
                      <h3 className="font-bold text-sm uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                        <Truck size={18} className="text-amber-500" />
                        Delivery Challans Log ({deliveryChallans.length})
                      </h3>
                    </div>

                    {deliveryChallans.length === 0 ? (
                      <p className="text-xs text-slate-400 py-4 text-center">No Delivery Challans issued yet for this Customer PO.</p>
                    ) : (
                      <div className="relative border-l-2 border-slate-200 dark:border-slate-700 ml-4 space-y-6 pl-6 py-2">
                        {deliveryChallans.map((dc: any, idx: number) => (
                          <div key={dc._id || idx} className="relative group">
                            <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full bg-amber-500 border-2 border-white dark:border-slate-900 shadow-sm" />
                            <div className="bg-slate-50 dark:bg-slate-900/80 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-2">
                              <div className="flex justify-between items-center text-xs">
                                <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">DC #{dc.dcNumber}</span>
                                <span className="text-slate-500">{new Date(dc.date).toLocaleDateString("en-IN")}</span>
                              </div>
                              <div className="text-xs text-slate-600 dark:text-slate-300">
                                Dispatched Items: <span className="font-semibold text-slate-900 dark:text-slate-100">{(dc.items || []).map((i: any) => `${i.materialName || i.productName} (${i.quantity} ${i.unit || 'PCS'})`).join(", ")}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Invoices Timeline Log */}
                  <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
                      <h3 className="font-bold text-sm uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                        <FileText size={18} className="text-emerald-500" />
                        Tax Invoices Log ({invoices.length})
                      </h3>
                    </div>

                    {invoices.length === 0 ? (
                      <p className="text-xs text-slate-400 py-4 text-center">No Tax Invoices issued yet for this Customer PO.</p>
                    ) : (
                      <div className="relative border-l-2 border-slate-200 dark:border-slate-700 ml-4 space-y-6 pl-6 py-2">
                        {invoices.map((inv: any, idx: number) => (
                          <div key={inv._id || idx} className="relative group">
                            <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900 shadow-sm" />
                            <div className="bg-slate-50 dark:bg-slate-900/80 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-2">
                              <div className="flex justify-between items-center text-xs">
                                <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">Invoice #{inv.invoiceNumber}</span>
                                <span className="text-emerald-600 font-bold text-sm">₹ {(inv.totalAmount || inv.grandTotal || 0).toLocaleString()}</span>
                              </div>
                              <div className="text-xs text-slate-500 flex justify-between">
                                <span>Date: {new Date(inv.date).toLocaleDateString("en-IN")}</span>
                                <span className="font-semibold text-slate-700 dark:text-slate-300">Status: {inv.status || "Draft"}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

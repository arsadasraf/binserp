import React, { useState, useEffect } from "react";
import { X, FileText, ShoppingCart, Activity } from "lucide-react";
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
  customers,
  fgItems,
  companyInfo,
  onGenerateOrder,
  isGeneratingOrder
}) => {
  const [activeTab, setActiveTab] = useState<"details" | "history">("details");

  const { data: historyData, isLoading } = useGetIncomingPODispatchHistoryQuery(po?._id, {
    skip: !po?._id || activeTab !== "history"
  });

  if (!isOpen || !po) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm sm:p-6">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-800">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <ShoppingCart className="w-6 h-6 text-indigo-500" />
              Customer PO: {po.poNumber}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Customer: {po.customer?.name} | Status: {po.status}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {(po.status === 'Received' || po.status === 'Accepted') && (
              <button
                onClick={() => onGenerateOrder(po._id)}
                disabled={isGeneratingOrder}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {isGeneratingOrder ? "Generating..." : "Generate Sales Order"}
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 px-6 pt-4 border-b border-gray-200 dark:border-gray-800">
          <button
            onClick={() => setActiveTab("details")}
            className={`pb-3 px-2 text-sm font-medium transition-colors relative ${
              activeTab === "details"
                ? "text-indigo-600 dark:text-indigo-400"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            }`}
          >
            PO Details
            {activeTab === "details" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-t-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`pb-3 px-2 text-sm font-medium transition-colors relative ${
              activeTab === "history"
                ? "text-indigo-600 dark:text-indigo-400"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            }`}
          >
            Dispatch History
            {activeTab === "history" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-t-full" />
            )}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
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
            <div className="space-y-6">
              {isLoading ? (
                <div className="flex justify-center p-8"><LoadingSpinner /></div>
              ) : (
                <>
                  {/* Delivery Challans */}
                  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                      <h3 className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <Activity className="w-4 h-4 text-amber-500" />
                        Delivery Challans
                      </h3>
                    </div>
                    {historyData?.data?.deliveryChallans?.length === 0 ? (
                      <div className="p-6 text-center text-gray-500">No Delivery Challans found for this PO.</div>
                    ) : (
                      <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500">
                          <tr>
                            <th className="px-4 py-3">DC Number</th>
                            <th className="px-4 py-3">Date</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">Items</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                          {historyData?.data?.deliveryChallans?.map((dc: any) => (
                            <tr key={dc._id}>
                              <td className="px-4 py-3 font-medium">{dc.dcNumber}</td>
                              <td className="px-4 py-3">{new Date(dc.date).toLocaleDateString()}</td>
                              <td className="px-4 py-3">{dc.status}</td>
                              <td className="px-4 py-3">{dc.items?.length || 0} items</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {/* Invoices */}
                  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                      <h3 className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-green-500" />
                        Invoices
                      </h3>
                    </div>
                    {historyData?.data?.invoices?.length === 0 ? (
                      <div className="p-6 text-center text-gray-500">No Invoices found for this PO.</div>
                    ) : (
                      <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500">
                          <tr>
                            <th className="px-4 py-3">Invoice Number</th>
                            <th className="px-4 py-3">Date</th>
                            <th className="px-4 py-3">Amount</th>
                            <th className="px-4 py-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                          {historyData?.data?.invoices?.map((inv: any) => (
                            <tr key={inv._id}>
                              <td className="px-4 py-3 font-medium">{inv.invoiceNumber}</td>
                              <td className="px-4 py-3">{new Date(inv.date).toLocaleDateString()}</td>
                              <td className="px-4 py-3">₹{inv.grandTotal?.toLocaleString()}</td>
                              <td className="px-4 py-3">{inv.status}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
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

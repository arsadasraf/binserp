import React, { useState, useEffect } from "react";
import { X, Shield, Activity, Calendar, FileText, CheckCircle2 } from "lucide-react";

interface SalesOrderPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: any;
  onPlanOrder: (id: string, planDetails: any[]) => Promise<void>;
  isPlanning: boolean;
}

export const SalesOrderPlanModal: React.FC<SalesOrderPlanModalProps> = ({
  isOpen,
  onClose,
  order,
  onPlanOrder,
  isPlanning,
}) => {
  const [planDetails, setPlanDetails] = useState<any[]>([]);

  useEffect(() => {
    if (order && order.items) {
      // Initialize plan details for each item
      const initialDetails = order.items
        .filter((item: any) => item.fgItem) // Only FG items can be split into production
        .map((item: any) => ({
          fgItem: item.fgItem?._id || item.fgItem,
          productName: item.name || item.productName || item.fgItem?.name || "Unknown Product",
          totalQuantity: item.quantity || 0,
          storeQty: 0,
          productionQty: item.quantity || 0, // Default all to production
        }));
      setPlanDetails(initialDetails);
    }
  }, [order]);

  const handleQtyChange = (index: number, field: "storeQty" | "productionQty", value: number) => {
    setPlanDetails((prev) => {
      const newDetails = [...prev];
      const item = newDetails[index];
      const total = item.totalQuantity;

      if (field === "storeQty") {
        const storeQty = Math.min(Math.max(0, value), total);
        item.storeQty = storeQty;
        item.productionQty = total - storeQty;
      } else {
        const productionQty = Math.min(Math.max(0, value), total);
        item.productionQty = productionQty;
        item.storeQty = total - productionQty;
      }
      return newDetails;
    });
  };

  const handleConfirmPlan = () => {
    onPlanOrder(order._id, planDetails);
  };

  if (!isOpen || !order) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm sm:p-6">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-800">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Activity className="w-6 h-6 text-indigo-500" />
              Plan Sales Order: {order.orderNumber}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Customer: {order.customer?.name || order.customerName} | Target Date: {order.targetDate ? new Date(order.targetDate).toLocaleDateString() : 'N/A'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-6 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800">
            <h3 className="font-semibold flex items-center gap-2 mb-2">
              <Shield className="w-5 h-5" />
              Inventory Planning
            </h3>
            <p className="text-sm">
              Specify how much of each FG item will be fulfilled from existing Store inventory vs. newly built via Production Orders.
              Quantities allocated to Production will generate PPC buckets and MRP requirements.
            </p>
          </div>

          <div className="space-y-4">
            {planDetails.map((item, index) => (
              <div key={item.fgItem} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100 dark:border-gray-800">
                  <h4 className="font-semibold text-gray-800 dark:text-gray-200">{item.productName}</h4>
                  <span className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full text-sm font-medium">
                    Total Qty: {item.totalQuantity}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-6">
                  {/* Store Fulfillment */}
                  <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-100 dark:border-gray-700">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Fulfilled from Store
                    </label>
                    <div className="flex items-center">
                      <input
                        type="number"
                        min="0"
                        max={item.totalQuantity}
                        value={item.storeQty}
                        onChange={(e) => handleQtyChange(index, "storeQty", parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-2">Deducts from available stock on dispatch.</p>
                  </div>

                  {/* Production Fulfillment */}
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
                    <label className="block text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">
                      Plan for Production
                    </label>
                    <div className="flex items-center">
                      <input
                        type="number"
                        min="0"
                        max={item.totalQuantity}
                        value={item.productionQty}
                        onChange={(e) => handleQtyChange(index, "productionQty", parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-blue-300 dark:border-blue-600 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-white"
                      />
                    </div>
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">Generates PPC Bucket & Purchase MRP.</p>
                  </div>
                </div>
              </div>
            ))}
            
            {planDetails.length === 0 && (
              <div className="p-8 text-center text-gray-500 bg-gray-50 dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                No FG items found in this order to plan.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmPlan}
            disabled={isPlanning}
            className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {isPlanning ? (
              <>Processing...</>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Confirm & Plan Order
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};

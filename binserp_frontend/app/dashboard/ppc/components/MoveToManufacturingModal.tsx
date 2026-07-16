import React, { useState, useEffect } from "react";
import { X, Package, ArrowRight, Loader2 } from "lucide-react";
import { useGetStoreDataQuery } from "@/src/store/services/storeService";

export default function MoveToManufacturingModal({ isOpen, onClose, order, onMove }: { isOpen: boolean; onClose: () => void; order: any; onMove: (itemsToMove: { productId: string; quantity: number }[]) => void }) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch Inventory to show current FG stock
  const { data: inventory = [], isLoading: invLoading } = useGetStoreDataQuery("inventory");

  useEffect(() => {
    if (isOpen && order) {
      const initial: Record<string, number> = {};
      order.items?.forEach((item: any) => {
        // Default to moving the full quantity minus what was already moved
        initial[item.product._id || item.product] = Math.max(0, item.quantity - (item.movedQuantity || 0));
      });
      setQuantities(initial);
    }
  }, [isOpen, order]);

  if (!isOpen || !order) return null;

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const payload = Object.keys(quantities)
        .map(productId => ({ productId, quantity: quantities[productId] }))
        .filter(i => i.quantity > 0);
      
      await onMove(payload);
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStock = (productId: string) => {
    if (!inventory || !Array.isArray(inventory)) return 0;
    const itemStock = inventory.find(i => i.item === productId || i.item?._id === productId);
    return itemStock?.currentStock || 0;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-gray-100 dark:border-gray-800">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <ArrowRight className="w-6 h-6 text-indigo-600" />
              Push to Manufacturing
            </h2>
            <p className="text-sm text-gray-500 mt-1">Order {order.orderNumber} • {order.customerName}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 p-4 rounded-xl text-sm border border-blue-100 dark:border-blue-800/30 flex gap-3">
            <Package className="w-5 h-5 shrink-0" />
            <p>
              Review the current inventory stock for the FG items below. 
              You can fulfill partial quantities from stock, and push the remaining quantity to the shop floor for manufacturing.
            </p>
          </div>

          <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400 font-medium">
                <tr>
                  <th className="px-4 py-3">FG Item</th>
                  <th className="px-4 py-3 text-center">Requested Qty</th>
                  <th className="px-4 py-3 text-center">Already Moved</th>
                  <th className="px-4 py-3 text-center">In Stock</th>
                  <th className="px-4 py-3 text-center">Qty to Manufacture</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {order.items?.map((item: any) => {
                  const productId = item.product._id || item.product;
                  const stock = getStock(productId);
                  const requested = item.quantity;
                  const moved = item.movedQuantity || 0;
                  const maxToMove = Math.max(0, requested - moved);
                  
                  return (
                    <tr key={productId} className="bg-white dark:bg-gray-900">
                      <td className="px-4 py-4">
                        <div className="font-medium text-gray-900 dark:text-white">{item.productName || "Unknown Item"}</div>
                        {item.productCode && <div className="text-xs text-gray-500">{item.productCode}</div>}
                      </td>
                      <td className="px-4 py-4 text-center font-medium text-gray-900 dark:text-gray-200">{requested}</td>
                      <td className="px-4 py-4 text-center text-gray-500">{moved}</td>
                      <td className="px-4 py-4 text-center">
                        {invLoading ? (
                           <Loader2 className="w-4 h-4 animate-spin mx-auto text-gray-400" />
                        ) : (
                          <span className={`font-semibold ${stock >= maxToMove ? 'text-green-600' : (stock > 0 ? 'text-amber-600' : 'text-red-500')}`}>
                            {stock}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-center">
                          <input 
                            type="number"
                            min="0"
                            max={maxToMove}
                            value={quantities[productId] ?? 0}
                            onChange={(e) => setQuantities({ ...quantities, [productId]: Number(e.target.value) })}
                            className="w-24 px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded-lg text-center bg-gray-50 dark:bg-gray-800 focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 flex justify-end gap-3">
          <button onClick={onClose} disabled={isSubmitting} className="px-5 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm transition-all hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={isSubmitting} className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-all disabled:opacity-70">
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Confirm Push
          </button>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from "react";
import { X, Hammer, Loader2, ShieldCheck, Tag } from "lucide-react";
import { useGetStoreDataQuery } from "@/src/store/services/storeService";

interface MoveModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: any;
  onMove: (itemsToMove: any[]) => void;
}

export default function MoveToManufacturingModal({ isOpen, onClose, order, onMove }: MoveModalProps) {
  const [itemConfigs, setItemConfigs] = useState<Record<string, { quantity: number; trackingType: "Individual" | "Batch" }>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch Inventory to display current available stock
  const { data: inventory = [], isLoading: invLoading } = useGetStoreDataQuery("inventory");

  useEffect(() => {
    if (isOpen && order) {
      const initial: Record<string, { quantity: number; trackingType: "Individual" | "Batch" }> = {};
      order.items?.forEach((item: any, idx: number) => {
        const key = item._id || item.product?._id || item.product || `item_${idx}`;
        const remaining = Math.max(0, (Number(item.quantity) || 0) - (Number(item.movedQuantity) || 0));
        initial[key] = {
          quantity: remaining > 0 ? remaining : Number(item.quantity) || 1,
          trackingType: item.trackingType || "Individual"
        };
      });
      setItemConfigs(initial);
    }
  }, [isOpen, order]);

  if (!isOpen || !order) return null;

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const payload: any[] = [];
      order.items?.forEach((item: any, idx: number) => {
        const key = item._id || item.product?._id || item.product || `item_${idx}`;
        const config = itemConfigs[key];
        const qty = config?.quantity || 0;
        if (qty > 0) {
          payload.push({
            itemId: item._id,
            itemIndex: idx,
            productId: item.product?._id || item.product,
            productName: item.productName || item.materialName,
            quantity: qty,
            trackingType: config?.trackingType || "Individual"
          });
        }
      });

      if (payload.length === 0) {
        alert("Please enter a valid quantity to manufacture.");
        return;
      }

      await onMove(payload);
      onClose();
    } catch (error) {
      console.error("Manufacturing Order creation failed:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStock = (productId: string, productName?: string) => {
    if (!inventory || !Array.isArray(inventory)) return 0;
    const itemStock = inventory.find(i => 
      (productId && (i.item === productId || i.item?._id === productId)) ||
      (productName && i.item?.name?.toLowerCase() === productName.toLowerCase())
    );
    return itemStock?.currentStock || 0;
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400 rounded-xl">
              <Hammer size={20} />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                Create Manufacturing Order
              </h2>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 font-medium">
                {order.mrpNumber && (
                  <span className="font-bold text-purple-700 dark:text-purple-300">
                    MRP #{order.mrpNumber}
                  </span>
                )}
                <span>•</span>
                <span>{order.customerName || "Internal Production Demand"}</span>
                {order.poReference && (
                  <>
                    <span>•</span>
                    <span className="font-mono text-slate-400">PO: {order.poReference}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Table */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-bold uppercase">
                <tr>
                  <th className="px-4 py-3">Item & Technical Description</th>
                  <th className="px-3 py-3 text-center">Required</th>
                  <th className="px-3 py-3 text-center">Moved to MO</th>
                  <th className="px-3 py-3 text-center">In Store</th>
                  <th className="px-4 py-3 text-center">Qty to Manufacture</th>
                  <th className="px-4 py-3 text-center">Tracking Traceability</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {order.items?.map((item: any, idx: number) => {
                  const key = item._id || item.product?._id || item.product || `item_${idx}`;
                  const productId = item.product?._id || item.product;
                  const name = item.productName || item.materialName || "Part Item";
                  const desc = item.description || item.descriptions || item.specification;
                  const stock = getStock(productId, name);
                  const requested = Number(item.quantity) || 1;
                  const moved = Number(item.movedQuantity) || 0;
                  const maxToMove = Math.max(0, requested - moved);
                  const config = itemConfigs[key] || { quantity: maxToMove, trackingType: "Individual" };
                  const type = item.itemType || "Component";

                  return (
                    <tr key={key} className="bg-white dark:bg-slate-900 hover:bg-slate-50/50">
                      
                      {/* Name & Technical Description per AGENTS.md */}
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                          {name}
                        </div>
                        {desc && (
                          <div className="text-[11px] text-slate-500 italic mt-0.5 line-clamp-2">
                            {desc}
                          </div>
                        )}
                        <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-extrabold ${
                          type.toLowerCase().includes('sub') ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300' :
                          type.toLowerCase().includes('assembly') ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' :
                          'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
                        }`}>
                          {type}
                        </span>
                      </td>

                      {/* Required */}
                      <td className="px-3 py-3.5 text-center font-bold text-slate-900 dark:text-white">
                        {requested} <span className="text-[10px] text-slate-400 font-normal">{item.unit || "PCS"}</span>
                      </td>

                      {/* Moved */}
                      <td className="px-3 py-3.5 text-center font-mono font-semibold text-slate-500">
                        {moved}
                      </td>

                      {/* In Store Stock */}
                      <td className="px-3 py-3.5 text-center">
                        {invLoading ? (
                          <Loader2 size={12} className="animate-spin mx-auto text-slate-400" />
                        ) : (
                          <span className={`font-mono font-bold ${stock >= maxToMove ? 'text-emerald-600' : (stock > 0 ? 'text-amber-600' : 'text-slate-400')}`}>
                            {stock}
                          </span>
                        )}
                      </td>

                      {/* Qty to Manufacture */}
                      <td className="px-4 py-3.5">
                        <div className="flex justify-center">
                          <input 
                            type="number"
                            min="1"
                            max={maxToMove > 0 ? maxToMove : requested}
                            value={config.quantity}
                            onChange={(e) => {
                              const val = Math.max(1, Number(e.target.value));
                              setItemConfigs({
                                ...itemConfigs,
                                [key]: { ...config, quantity: val }
                              });
                            }}
                            className="w-24 px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-xl text-center font-bold text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
                          />
                        </div>
                      </td>

                      {/* Tracking Type (Individual vs Batch) */}
                      <td className="px-4 py-3.5">
                        <div className="flex justify-center">
                          <select
                            value={config.trackingType}
                            onChange={(e) => {
                              setItemConfigs({
                                ...itemConfigs,
                                [key]: { ...config, trackingType: e.target.value as "Individual" | "Batch" }
                              });
                            }}
                            className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-[11px] font-bold text-slate-700 dark:text-slate-300 outline-none"
                          >
                            <option value="Individual">Individual (Serial)</option>
                            <option value="Batch">Batch (Lot)</option>
                          </select>
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
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 flex justify-end gap-2.5">
          <button 
            onClick={onClose} 
            disabled={isSubmitting} 
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl transition-all shadow-2xs"
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit} 
            disabled={isSubmitting} 
            className="px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-sm shadow-purple-600/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 size={13} className="animate-spin" /> : <Hammer size={13} />}
            <span>Create Manufacturing Order</span>
          </button>
        </div>
      </div>
    </div>
  );
}


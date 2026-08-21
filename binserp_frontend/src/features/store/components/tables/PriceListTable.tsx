"use client";
import { Edit2, Trash2, Search, IndianRupee, Tag, Info, Image as ImageIcon } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";

interface PriceListTableProps {
  priceLists: any[];
  fgItems: any[];
  onEdit: (item: any) => void;
  onDelete: (id: string) => void;
}

export default function PriceListTable({ priceLists, fgItems, onEdit, onDelete }: PriceListTableProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredItems = fgItems.filter((item) => {
    const searchLower = searchTerm.toLowerCase();
    const fgItemName = item.name?.toLowerCase() || "";
    const fgItemCode = item.code?.toLowerCase() || "";
    return fgItemName.includes(searchLower) || fgItemCode.includes(searchLower);
  });

  // Map to easily find assigned price configs for each FG Item
  const priceListMap = (priceLists || []).reduce((acc, curr) => {
    const fgItemId = (curr.fgItem?._id || curr.fgItem)?.toString();
    if (fgItemId) acc[fgItemId] = curr;
    return acc;
  }, {} as Record<string, any>);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
      {/* Search Bar */}
      <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
        <div className="relative w-full max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search by FG Item name or code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>
        <div className="text-xs text-gray-500 hidden sm:flex items-center gap-1.5">
          <Info size={14} /> Showing {filteredItems.length} FG Items
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">
              <th className="p-4 font-medium first:pl-6 w-16">Photo</th>
              <th className="p-4 font-medium">Name</th>
              <th className="p-4 font-medium">Description</th>
              <th className="p-4 font-medium">Type</th>
              <th className="p-4 font-medium">HSN Code</th>
              <th className="p-4 font-medium text-right">Price (₹)</th>
              <th className="p-4 font-medium text-right">Tax Rate (%)</th>
              <th className="p-4 font-medium text-right last:pr-6 w-48">Actions</th>
            </tr>
          </thead>
          <tbody className="text-sm divide-y divide-gray-100 dark:divide-gray-800">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-gray-500">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Tag className="w-8 h-8 text-gray-300" />
                    <p>No finished goods found.</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredItems.map((item, index) => {
                const priceConfig = priceListMap[item._id?.toString()];
                const isAssigned = !!priceConfig;
                const hsnDisplay = priceConfig?.hsnCode || item.hsnCode || "-";

                return (
                  <motion.tr
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: Math.min(index * 0.02, 0.5) }}
                    key={item._id}
                    className="hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors group"
                  >
                    <td className="p-4 first:pl-6">
                      {item.photos && item.photos.length > 0 ? (
                        <img src={item.photos[0]} alt={item.name} className="w-10 h-10 rounded-lg object-cover border border-gray-200 dark:border-gray-700" />
                      ) : (
                        <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center text-gray-400">
                          <ImageIcon size={18} />
                        </div>
                      )}
                    </td>
                    <td className="p-4 font-medium text-gray-900 dark:text-white">
                      {item.name || "N/A"}
                    </td>
                    <td className="p-4 text-gray-500 max-w-[200px] truncate">
                      {item.description || "-"}
                    </td>
                    <td className="p-4 text-gray-600 dark:text-gray-300">
                      <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-md text-xs">
                        {item.type || "FG"}
                      </span>
                    </td>
                    <td className="p-4 text-gray-700 dark:text-gray-300 font-mono text-xs font-semibold">
                      <span className="px-2 py-1 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 rounded-md border border-blue-200 dark:border-blue-800">
                        {hsnDisplay}
                      </span>
                    </td>
                    <td className="p-4 text-right font-medium">
                      {isAssigned ? (
                        <span className="text-emerald-600 dark:text-emerald-400">
                          ₹{priceConfig.price?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      {isAssigned ? (
                        <span className="text-amber-600 dark:text-amber-400">
                          {priceConfig.taxRate}%
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="p-4 text-right last:pr-6">
                      <div className="flex justify-end items-center gap-3">
                        {isAssigned ? (
                          <>
                            <span className="px-2 py-0.5 text-[10px] font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded border border-emerald-200 dark:border-emerald-800">
                              Assigned
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => onEdit({ ...priceConfig, fgItem: item })}
                                className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 dark:border-blue-800/50 dark:text-blue-400 dark:bg-blue-900/20 dark:hover:bg-blue-900/50 rounded-lg transition-colors"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => onDelete(priceConfig._id)}
                                className="p-1.5 text-red-600 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/50 rounded-lg transition-colors"
                                title="Delete Configuration"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <span className="px-2 py-0.5 text-[10px] font-medium bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400 rounded border border-amber-200 dark:border-amber-800/50">
                              Unassigned
                            </span>
                            <button
                              onClick={() => onEdit({ fgItem: item, isNewAssignment: true })}
                              className="px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 dark:border-indigo-800/50 dark:text-indigo-400 dark:bg-indigo-900/20 dark:hover:bg-indigo-900/50 rounded-lg transition-colors flex items-center gap-1.5"
                            >
                              Assign <Tag size={12} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="block md:hidden p-3 space-y-3 pb-28 sm:pb-20 bg-gray-50/50 dark:bg-gray-900/40">
        {filteredItems.length === 0 ? (
          <div className="text-center py-10 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            <Tag className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
            <p className="font-semibold text-xs text-gray-500">No Finished Goods found.</p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const priceConfig = priceListMap[item._id?.toString()];
            const isAssigned = !!priceConfig;
            const hsnDisplay = priceConfig?.hsnCode || item.hsnCode || "-";

            return (
              <div
                key={item._id}
                className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-3 border-b border-gray-100 dark:border-gray-700 pb-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {item.photos && item.photos.length > 0 ? (
                      <img src={item.photos[0]} alt={item.name} className="w-11 h-11 rounded-lg object-cover border border-gray-200 dark:border-gray-700 shrink-0" />
                    ) : (
                      <div className="w-11 h-11 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center text-gray-400 shrink-0">
                        <ImageIcon size={18} />
                      </div>
                    )}
                    <div className="min-w-0">
                      <h4 className="font-bold text-gray-900 dark:text-white text-sm truncate">{item.name || "N/A"}</h4>
                      <p className="text-[10px] text-gray-400 truncate">{item.code ? `Code: ${item.code}` : item.description || "FG Item"}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded shrink-0 border ${
                    isAssigned
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800"
                      : "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/60 dark:text-amber-400 dark:border-amber-800"
                  }`}>
                    {isAssigned ? "Assigned" : "Unassigned"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase">HSN Code</span>
                    <p className="font-mono text-gray-700 dark:text-gray-300 font-semibold">{hsnDisplay}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase">Tax Rate</span>
                    <p className="font-semibold text-gray-700 dark:text-gray-300">
                      {isAssigned ? `${priceConfig.taxRate}%` : "—"}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[10px] font-bold text-gray-400 uppercase">Price (₹)</span>
                    <p className="font-extrabold text-sm text-emerald-600 dark:text-emerald-400">
                      {isAssigned ? `₹${priceConfig.price?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : "Price Not Configured"}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                  {isAssigned ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onEdit({ ...priceConfig, fgItem: item })}
                        className="flex-1 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 rounded-lg border border-blue-200 dark:border-blue-800 flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Edit2 size={13} /> Edit Price Config
                      </button>
                      <button
                        onClick={() => onDelete(priceConfig._id)}
                        className="py-1.5 px-3 text-xs font-bold text-red-600 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 rounded-lg border border-red-200 dark:border-red-800 transition-colors"
                        title="Delete Configuration"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => onEdit({ fgItem: item, isNewAssignment: true })}
                      className="w-full py-2 text-xs font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 rounded-lg border border-indigo-200 dark:border-indigo-800 flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Tag size={13} /> Assign Price & Tax Rate
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

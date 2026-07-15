"use client";
import { Edit2, Trash2, Search, IndianRupee, Tag, Info, Image as ImageIcon } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";

interface PriceListTableProps {
  priceLists: any[];
  fgItems: any[];
  onEdit: (item: any) => void;
  onDelete: (tab: string, id: string) => void;
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

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">
              <th className="p-4 font-medium first:pl-6 w-16">Photo</th>
              <th className="p-4 font-medium">Name</th>
              <th className="p-4 font-medium">Description</th>
              <th className="p-4 font-medium">Type</th>
              <th className="p-4 font-medium text-right">Price (₹)</th>
              <th className="p-4 font-medium text-right">Tax Rate (%)</th>
              <th className="p-4 font-medium text-right last:pr-6 w-48">Actions</th>
            </tr>
          </thead>
          <tbody className="text-sm divide-y divide-gray-100 dark:divide-gray-800">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-gray-500">
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
                                onClick={() => onDelete("price-list", priceConfig._id)}
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
    </div>
  );
}

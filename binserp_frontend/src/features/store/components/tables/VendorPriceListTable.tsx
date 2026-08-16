"use client";
import { Edit2, Trash2, Search, Tag, Info, Image as ImageIcon, Plus } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";

interface VendorPriceListTableProps {
  vendorPriceLists: any[];
  materials: any[];
  onEdit: (item: any) => void;
  onDelete: (id: string) => void;
}

export default function VendorPriceListTable({ vendorPriceLists, materials, onEdit, onDelete }: VendorPriceListTableProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredItems = materials.filter((item) => {
    const searchLower = searchTerm.toLowerCase();
    const materialName = item.name?.toLowerCase() || "";
    const materialCode = item.code?.toLowerCase() || "";
    return materialName.includes(searchLower) || materialCode.includes(searchLower);
  });

  // Map to easily find assigned price configs for each Material
  // Grouping by material ID
  const priceListMap = (vendorPriceLists || []).reduce((acc, curr) => {
    const materialId = (curr.material?._id || curr.material)?.toString();
    if (materialId) {
      if (!acc[materialId]) acc[materialId] = [];
      acc[materialId].push(curr);
    }
    return acc;
  }, {} as Record<string, any[]>);

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
            placeholder="Search by RM/BO name or code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>
        <div className="text-xs text-gray-500 hidden sm:flex items-center gap-1.5">
          <Info size={14} /> Showing {filteredItems.length} Materials
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">
              <th className="p-4 font-medium first:pl-6 w-16">Photo</th>
              <th className="p-4 font-medium">Name & Code</th>
              <th className="p-4 font-medium">Type</th>
              <th className="p-4 font-medium text-right">Price (₹)</th>
              <th className="p-4 font-medium text-right">Tax Rate (%)</th>
              <th className="p-4 font-medium text-right last:pr-6 w-48">Actions</th>
            </tr>
          </thead>
          <tbody className="text-sm divide-y divide-gray-100 dark:divide-gray-800">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-gray-500">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Tag className="w-8 h-8 text-gray-300" />
                    <p>No RM/BO items found.</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredItems.map((item, index) => {
                const assignedConfigs = priceListMap[item._id?.toString()] || [];
                const config = assignedConfigs[0]; // Active price sheet for material
                const hasPrice = !!config;

                return (
                  <motion.tr
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: Math.min(index * 0.02, 0.5) }}
                    key={item._id}
                    onClick={() => onEdit(config ? { ...config, material: item } : { material: item, isNewAssignment: true })}
                    className="hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors group cursor-pointer"
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
                      <div>{item.name || "N/A"}</div>
                      <div className="text-xs text-gray-500 font-normal mt-0.5">{item.code || "-"}</div>
                    </td>
                    <td className="p-4 text-gray-600 dark:text-gray-300">
                      <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-md text-xs">
                        {item.type || "Material"}
                      </span>
                    </td>
                    <td className="p-4 text-right font-medium">
                      {hasPrice && config.price != null ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold font-mono">
                          ₹{Number(config.price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      ) : (
                        <span className="text-gray-400 font-normal">-</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      {hasPrice && config.taxRate != null ? (
                        <span className="text-amber-600 dark:text-amber-400 font-bold">
                          {Number(config.taxRate)}%
                        </span>
                      ) : (
                        <span className="text-gray-400 font-normal">-</span>
                      )}
                    </td>
                    <td className="p-4 text-right last:pr-6" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end items-center gap-2">
                        {hasPrice ? (
                          <>
                            <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 rounded">
                              Price Set
                            </span>
                            <button
                              onClick={(e) => { e.stopPropagation(); onEdit({ ...config, material: item }); }}
                              className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
                            >
                              Edit Price
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); onDelete(config._id); }}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Remove Price Configuration"
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        ) : (
                          <>
                            <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400 rounded border border-amber-200">
                              No Price
                            </span>
                            <button
                              onClick={(e) => { e.stopPropagation(); onEdit({ material: item, isNewAssignment: true }); }}
                              className="px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors flex items-center gap-1"
                            >
                              Set Price <Plus size={12} />
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

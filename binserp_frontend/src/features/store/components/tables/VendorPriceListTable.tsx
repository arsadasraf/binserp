"use client";
import React, { useState, useMemo } from "react";
import { Edit2, Trash2, Search, Tag, Info, Image as ImageIcon, Plus, Layers, Package, Cog, Wrench } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface VendorPriceListTableProps {
  vendorPriceLists: any[];
  materials?: any[];
  rawMaterials?: any[];
  boughtOuts?: any[];
  consumables?: any[];
  onAddPriceSheet?: () => void;
  onEdit: (item: any) => void;
  onDelete: (id: string) => void;
}

export default function VendorPriceListTable({
  vendorPriceLists = [],
  materials = [],
  rawMaterials = [],
  boughtOuts = [],
  consumables = [],
  onAddPriceSheet,
  onEdit,
  onDelete,
}: VendorPriceListTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'rm' | 'bo' | 'consumable'>('all');

  // Unified items list with explicit category tags
  const unifiedItems = useMemo(() => {
    const items: Array<any & { itemCategory: 'rm' | 'bo' | 'consumable' }> = [];
    const seenIds = new Set<string>();

    (rawMaterials || []).forEach(m => {
      const id = m._id?.toString() || m.id?.toString();
      if (id && !seenIds.has(id)) {
        seenIds.add(id);
        items.push({ ...m, itemCategory: 'rm' });
      }
    });

    (boughtOuts || []).forEach(m => {
      const id = m._id?.toString() || m.id?.toString();
      if (id && !seenIds.has(id)) {
        seenIds.add(id);
        items.push({ ...m, itemCategory: 'bo' });
      }
    });

    (consumables || []).forEach(m => {
      const id = m._id?.toString() || m.id?.toString();
      if (id && !seenIds.has(id)) {
        seenIds.add(id);
        items.push({ ...m, itemCategory: 'consumable' });
      }
    });

    // Fallback: if separate lists weren't provided, use materials array
    if (items.length === 0 && Array.isArray(materials)) {
      materials.forEach(m => {
        const id = m._id?.toString() || m.id?.toString();
        if (id && !seenIds.has(id)) {
          seenIds.add(id);
          const rawType = (m.type || m.itemType || m.category?.name || '').toLowerCase();
          let cat: 'rm' | 'bo' | 'consumable' = 'rm';
          if (rawType.includes('bought') || rawType.includes('bo')) cat = 'bo';
          else if (rawType.includes('consumable')) cat = 'consumable';
          items.push({ ...m, itemCategory: cat });
        }
      });
    }

    return items;
  }, [rawMaterials, boughtOuts, consumables, materials]);

  // Counts for each category
  const counts = useMemo(() => {
    return {
      all: unifiedItems.length,
      rm: unifiedItems.filter(i => i.itemCategory === 'rm').length,
      bo: unifiedItems.filter(i => i.itemCategory === 'bo').length,
      consumable: unifiedItems.filter(i => i.itemCategory === 'consumable').length,
    };
  }, [unifiedItems]);

  // Filter items by category and search
  const filteredItems = useMemo(() => {
    return unifiedItems.filter((item) => {
      if (selectedCategory !== 'all' && item.itemCategory !== selectedCategory) {
        return false;
      }
      if (!searchTerm.trim()) return true;

      const searchLower = searchTerm.toLowerCase();
      const materialName = item.name?.toLowerCase() || "";
      const materialCode = item.code?.toLowerCase() || "";
      return materialName.includes(searchLower) || materialCode.includes(searchLower);
    });
  }, [unifiedItems, selectedCategory, searchTerm]);

  // Map to easily find assigned price configs for each Material
  const priceListMap = useMemo(() => {
    return (vendorPriceLists || []).reduce((acc, curr) => {
      const materialId = (curr.material?._id || curr.material)?.toString();
      if (materialId) {
        if (!acc[materialId]) acc[materialId] = [];
        acc[materialId].push(curr);
      }
      return acc;
    }, {} as Record<string, any[]>);
  }, [vendorPriceLists]);

  const getCategoryBadge = (cat: 'rm' | 'bo' | 'consumable') => {
    switch (cat) {
      case 'rm':
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">RM</span>;
      case 'bo':
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300">Bought Out</span>;
      case 'consumable':
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">Consumable</span>;
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden space-y-0">
      
      {/* Category Segmented Tabs Bar */}
      <div className="p-3 bg-gray-50/70 dark:bg-gray-800/40 border-b border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 p-1 bg-white dark:bg-gray-900 rounded-xl border border-gray-200/80 dark:border-gray-700 shadow-2xs overflow-x-auto max-w-full">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              selectedCategory === 'all'
                ? 'bg-slate-900 text-white shadow-xs dark:bg-slate-100 dark:text-slate-900'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            All Items
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
              selectedCategory === 'all' ? 'bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
            }`}>
              {counts.all}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('rm')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              selectedCategory === 'rm'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-blue-600'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            Raw Material (RM)
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
              selectedCategory === 'rm' ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
            }`}>
              {counts.rm}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('bo')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              selectedCategory === 'bo'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-indigo-600'
            }`}
          >
            <Cog className="w-3.5 h-3.5" />
            Bought Out (BO)
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
              selectedCategory === 'bo' ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
            }`}>
              {counts.bo}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('consumable')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              selectedCategory === 'consumable'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-emerald-600'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            Consumables
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
              selectedCategory === 'consumable' ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
            }`}>
              {counts.consumable}
            </span>
          </button>
        </div>

        {/* Search Bar & Action Button */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-3.5 w-3.5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search item name or code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
            />
          </div>

          {onAddPriceSheet && (
            <button
              type="button"
              onClick={onAddPriceSheet}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus size={14} /> Add Price Sheet
            </button>
          )}
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50/75 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider border-b border-gray-100 dark:border-gray-800">
              <th className="p-3.5 font-bold first:pl-6 w-16">Photo</th>
              <th className="p-3.5 font-bold">Item Name & Code</th>
              <th className="p-3.5 font-bold w-32">Category</th>
              <th className="p-3.5 font-bold text-right w-36">Price (₹)</th>
              <th className="p-3.5 font-bold text-center w-24">Tax Rate</th>
              <th className="p-3.5 font-bold text-right last:pr-6 w-44">Actions</th>
            </tr>
          </thead>
          <tbody className="text-sm divide-y divide-gray-100 dark:divide-gray-800">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-gray-500">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Tag className="w-8 h-8 text-gray-300" />
                    <p className="text-xs font-semibold">No items found matching the selected category & search query.</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredItems.map((item, index) => {
                const assignedConfigs = priceListMap[item._id?.toString()] || [];
                const config = assignedConfigs[0];
                const hasPrice = !!config;

                return (
                  <motion.tr
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15, delay: Math.min(index * 0.015, 0.3) }}
                    key={item._id}
                    onClick={() => onEdit(config ? { ...config, material: item, itemCategory: item.itemCategory } : { material: item, itemCategory: item.itemCategory, isNewAssignment: true })}
                    className="hover:bg-blue-50/40 dark:hover:bg-blue-900/10 transition-colors group cursor-pointer"
                  >
                    <td className="p-3.5 first:pl-6">
                      {item.photos && item.photos.length > 0 ? (
                        <img src={item.photos[0]} alt={item.name} className="w-10 h-10 rounded-lg object-cover border border-gray-200 dark:border-gray-700" />
                      ) : (
                        <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center text-gray-400">
                          <ImageIcon size={18} />
                        </div>
                      )}
                    </td>
                    <td className="p-3.5 font-medium text-gray-900 dark:text-white">
                      <div className="font-bold text-xs sm:text-sm">{item.name || "N/A"}</div>
                      <div className="text-xs text-gray-500 font-mono mt-0.5">{item.code || "-"}</div>
                    </td>
                    <td className="p-3.5">
                      {getCategoryBadge(item.itemCategory)}
                    </td>
                    <td className="p-3.5 text-right font-medium">
                      {hasPrice && config.price != null ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold font-mono text-sm">
                          ₹{Number(config.price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      ) : (
                        <span className="text-gray-400 font-normal text-xs">-</span>
                      )}
                    </td>
                    <td className="p-3.5 text-center">
                      {hasPrice && config.taxRate != null ? (
                        <span className="text-gray-800 dark:text-gray-200 font-bold text-xs">
                          {Number(config.taxRate)}%
                        </span>
                      ) : (
                        <span className="text-gray-400 font-normal text-xs">-</span>
                      )}
                    </td>
                    <td className="p-3.5 text-right last:pr-6" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end items-center gap-2">
                        {hasPrice ? (
                          <>
                            <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 rounded">
                              Price Set
                            </span>
                            <button
                              onClick={(e) => { e.stopPropagation(); onEdit({ ...config, material: item, itemCategory: item.itemCategory }); }}
                              className="px-2.5 py-1 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer"
                            >
                              Edit
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); onDelete(config._id); }}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                              title="Delete Price Configuration"
                            >
                              <Trash2 size={15} />
                            </button>
                          </>
                        ) : (
                          <>
                            <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400 rounded border border-amber-200">
                              No Price
                            </span>
                            <button
                              onClick={(e) => { e.stopPropagation(); onEdit({ material: item, itemCategory: item.itemCategory, isNewAssignment: true }); }}
                              className="px-2.5 py-1 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
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

      {/* Mobile Cards View */}
      <div className="block md:hidden p-3 space-y-3 pb-28 sm:pb-20 bg-gray-50/50 dark:bg-gray-900/40">
        {filteredItems.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Tag className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-xs font-semibold">No items found.</p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const assignedConfigs = priceListMap[item._id?.toString()] || [];
            const config = assignedConfigs[0];
            const hasPrice = !!config;

            return (
              <div
                key={item._id}
                onClick={() => onEdit(config ? { ...config, material: item, itemCategory: item.itemCategory } : { material: item, itemCategory: item.itemCategory, isNewAssignment: true })}
                className="bg-white dark:bg-gray-900 p-3.5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs space-y-2.5 cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  {item.photos && item.photos.length > 0 ? (
                    <img src={item.photos[0]} alt={item.name} className="w-11 h-11 rounded-xl object-cover border border-gray-200 dark:border-gray-700 flex-shrink-0" />
                  ) : (
                    <div className="w-11 h-11 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center text-gray-400 flex-shrink-0">
                      <ImageIcon size={18} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h4 className="font-bold text-gray-900 dark:text-white text-xs sm:text-sm truncate">{item.name || "N/A"}</h4>
                      {getCategoryBadge(item.itemCategory)}
                    </div>
                    <p className="text-xs text-gray-500 font-mono mt-0.5">{item.code || "-"}</p>
                  </div>
                  {hasPrice ? (
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 rounded flex-shrink-0">
                      Price Set
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400 rounded border border-amber-200 flex-shrink-0">
                      No Price
                    </span>
                  )}
                </div>

                <div className="bg-gray-50 dark:bg-gray-800/60 p-2.5 rounded-xl text-xs space-y-1 border border-gray-100 dark:border-gray-800">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-medium">Price (₹):</span>
                    {hasPrice && config.price != null ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-extrabold font-mono text-sm">
                        ₹{Number(config.price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    ) : (
                      <span className="text-gray-400 font-medium">-</span>
                    )}
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-medium">Tax Rate:</span>
                    {hasPrice && config.taxRate != null ? (
                      <span className="text-gray-800 dark:text-gray-200 font-bold">{Number(config.taxRate)}%</span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                  {hasPrice ? (
                    <>
                      <button
                        onClick={() => onEdit({ ...config, material: item, itemCategory: item.itemCategory })}
                        className="flex-1 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 rounded-xl flex items-center justify-center gap-1 border border-blue-200 dark:border-blue-800 cursor-pointer"
                      >
                        <Edit2 size={13} /> Edit Price
                      </button>
                      <button
                        onClick={() => onDelete(config._id)}
                        className="p-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-400 rounded-xl flex items-center justify-center border border-red-200 dark:border-red-800 cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => onEdit({ material: item, itemCategory: item.itemCategory, isNewAssignment: true })}
                      className="w-full py-2 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300 rounded-xl flex items-center justify-center gap-1 border border-indigo-200 dark:border-indigo-800 cursor-pointer"
                    >
                      <Plus size={14} /> Set Price Configuration
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

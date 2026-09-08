"use client";
import React, { useState, useMemo, useRef, useEffect } from "react";
import { Edit2, Trash2, Search, Tag, Info, Image as ImageIcon, Plus, Layers, Package, Cog, Wrench, Filter, Check, X, Star } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getItemDescription, ItemNameAndDescription } from "@/src/utils/itemDisplayHelper";

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
  const [vendorFilter, setVendorFilter] = useState<'all' | 'preferred_only' | 'unassigned' | string>('all');
  const [showVendorFilterMenu, setShowVendorFilterMenu] = useState(false);
  const vendorFilterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (vendorFilterRef.current && !vendorFilterRef.current.contains(event.target as Node)) {
        setShowVendorFilterMenu(false);
      }
    };
    if (showVendorFilterMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showVendorFilterMenu]);

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

    // Fallback & supplement: ensure any materials not yet added are included
    if (Array.isArray(materials)) {
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

  // Map to easily find assigned price configs for each Material
  const priceListMap = useMemo(() => {
    return (vendorPriceLists || []).reduce((acc, curr) => {
      const materialId = (curr.material?._id || curr.material || curr.materialId)?.toString();
      if (materialId) {
        if (!acc[materialId]) acc[materialId] = [];
        acc[materialId].push(curr);
      }
      return acc;
    }, {} as Record<string, any[]>);
  }, [vendorPriceLists]);

  // Available unique vendors from price lists for column dropdown filter
  const availableVendors = useMemo(() => {
    const map = new Map<string, { id: string; name: string; code?: string; count: number }>();
    (vendorPriceLists || []).forEach(vpl => {
      const v = vpl.vendor;
      const vId = v?._id?.toString() || (typeof v === 'string' ? v : null) || vpl.vendorName;
      const vName = v?.name || vpl.vendorName || "Vendor";
      const vCode = v?.code;
      if (vId) {
        if (!map.has(vId)) {
          map.set(vId, { id: vId, name: vName, code: vCode, count: 0 });
        }
        map.get(vId)!.count++;
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [vendorPriceLists]);

  // Total items with preferred vendor
  const preferredCount = useMemo(() => {
    return unifiedItems.filter(item => {
      const configs = priceListMap[item._id?.toString()] || [];
      return configs.some((c: any) => c.isPreferred);
    }).length;
  }, [unifiedItems, priceListMap]);

  // Counts for each category
  const counts = useMemo(() => {
    return {
      all: unifiedItems.length,
      rm: unifiedItems.filter(i => i.itemCategory === 'rm').length,
      bo: unifiedItems.filter(i => i.itemCategory === 'bo').length,
      consumable: unifiedItems.filter(i => i.itemCategory === 'consumable').length,
    };
  }, [unifiedItems]);

  // Filter items by category, vendor/preferred status, and search
  const filteredItems = useMemo(() => {
    return unifiedItems.filter((item) => {
      if (selectedCategory !== 'all' && item.itemCategory !== selectedCategory) {
        return false;
      }

      // Vendor / Preferred Filter
      if (vendorFilter !== 'all') {
        const configs = priceListMap[item._id?.toString()] || [];
        if (vendorFilter === 'preferred_only') {
          if (!configs.some((c: any) => c.isPreferred)) return false;
        } else if (vendorFilter === 'unassigned') {
          if (configs.length > 0) return false;
        } else {
          // Specific vendor filter by ID or name
          const match = configs.some((c: any) => {
            const vId = (c.vendor?._id || c.vendor)?.toString();
            const vName = c.vendor?.name || c.vendorName;
            return vId === vendorFilter || vName === vendorFilter;
          });
          if (!match) return false;
        }
      }

      if (!searchTerm.trim()) return true;

      const searchLower = searchTerm.toLowerCase();
      const materialName = item.name?.toLowerCase() || "";
      const materialDesc = getItemDescription(item).toLowerCase();
      return materialName.includes(searchLower) || materialDesc.includes(searchLower);
    });
  }, [unifiedItems, selectedCategory, vendorFilter, priceListMap, searchTerm]);

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
        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
          {/* Quick Preferred Vendor Toggle */}
          <button
            type="button"
            onClick={() => setVendorFilter(prev => prev === 'preferred_only' ? 'all' : 'preferred_only')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap border ${
              vendorFilter === 'preferred_only'
                ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                : 'text-amber-800 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200/80 dark:border-amber-800/60'
            }`}
            title="Filter by Preferred Vendors Only"
          >
            <span>⭐ Preferred Only</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
              vendorFilter === 'preferred_only' ? 'bg-white/20 text-white' : 'bg-amber-200/70 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200'
            }`}>
              {preferredCount}
            </span>
          </button>

          <div className="relative flex-1 sm:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-3.5 w-3.5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search item name or description..."
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

      {/* Active Filter Indicator Bar */}
      {vendorFilter !== 'all' && (
        <div className="px-4 py-2 bg-amber-50/70 dark:bg-amber-950/30 border-b border-amber-100 dark:border-amber-900/40 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-amber-900 dark:text-amber-200">
              Filter Active:
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200 border border-amber-300 dark:border-amber-700 text-[11px]">
              {vendorFilter === 'preferred_only'
                ? '⭐ Preferred Vendors Only'
                : vendorFilter === 'unassigned'
                ? 'Unassigned Only'
                : (availableVendors.find(v => v.id === vendorFilter)?.name || 'Specific Vendor')}
              <button
                type="button"
                onClick={() => setVendorFilter('all')}
                className="hover:bg-amber-200 dark:hover:bg-amber-800 rounded-full p-0.5 ml-1 cursor-pointer"
                title="Remove filter"
              >
                <X size={12} />
              </button>
            </span>
            <span className="text-gray-500 text-[11px]">
              ({filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'})
            </span>
          </div>
          <button
            type="button"
            onClick={() => setVendorFilter('all')}
            className="text-[11px] font-bold text-amber-800 dark:text-amber-300 hover:underline cursor-pointer"
          >
            Clear Filter
          </button>
        </div>
      )}

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50/75 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider border-b border-gray-100 dark:border-gray-800">
              <th className="p-3.5 font-bold first:pl-6 w-16">Photo</th>
              <th className="p-3.5 font-bold">Item Name & Description</th>
              <th className="p-3.5 font-bold w-28">Category</th>
              
              {/* Supplier / Vendor Column with Filter Dropdown */}
              <th className="p-3.5 font-bold w-48 relative">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="truncate">Supplier / Vendor</span>
                  <div className="relative" ref={vendorFilterRef}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowVendorFilterMenu(prev => !prev);
                      }}
                      className={`p-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                        vendorFilter !== 'all'
                          ? 'bg-amber-500 text-white shadow-xs'
                          : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200/60 dark:hover:bg-gray-700'
                      }`}
                      title="Filter by Vendor / Preferred"
                    >
                      <Filter size={12} className={vendorFilter !== 'all' ? 'fill-current' : ''} />
                      {vendorFilter !== 'all' && (
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      )}
                    </button>

                    {/* Filter Dropdown Popover */}
                    {showVendorFilterMenu && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute left-0 sm:right-0 sm:left-auto top-full mt-1.5 w-64 bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 py-1.5 z-50 text-xs normal-case tracking-normal"
                      >
                        <div className="px-3.5 py-2 font-bold text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800 text-[10px] uppercase tracking-wider flex justify-between items-center">
                          <span>Vendor Column Filter</span>
                          {vendorFilter !== 'all' && (
                            <button
                              type="button"
                              onClick={() => { setVendorFilter('all'); setShowVendorFilterMenu(false); }}
                              className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline cursor-pointer lowercase"
                            >
                              reset
                            </button>
                          )}
                        </div>

                        <div className="py-1">
                          <button
                            type="button"
                            onClick={() => { setVendorFilter('all'); setShowVendorFilterMenu(false); }}
                            className={`w-full px-3.5 py-2 text-left flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer ${
                              vendorFilter === 'all' ? 'font-bold text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/30' : 'text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            <span>Show All Vendors</span>
                            {vendorFilter === 'all' && <Check size={14} />}
                          </button>

                          <button
                            type="button"
                            onClick={() => { setVendorFilter('preferred_only'); setShowVendorFilterMenu(false); }}
                            className={`w-full px-3.5 py-2 text-left flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer ${
                              vendorFilter === 'preferred_only' ? 'font-bold text-amber-700 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/30' : 'text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            <span className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">⭐ Preferred Only</span>
                            <div className="flex items-center gap-1.5">
                              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 text-amber-800 font-bold">{preferredCount}</span>
                              {vendorFilter === 'preferred_only' && <Check size={14} />}
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => { setVendorFilter('unassigned'); setShowVendorFilterMenu(false); }}
                            className={`w-full px-3.5 py-2 text-left flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer ${
                              vendorFilter === 'unassigned' ? 'font-bold text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/30' : 'text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            <span>Unassigned Only</span>
                            {vendorFilter === 'unassigned' && <Check size={14} />}
                          </button>
                        </div>

                        {availableVendors.length > 0 && (
                          <>
                            <div className="px-3.5 py-1.5 font-bold text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-800 text-[10px] uppercase tracking-wider">
                              Filter By Specific Vendor
                            </div>
                            <div className="max-h-48 overflow-y-auto custom-scrollbar divide-y divide-gray-50 dark:divide-gray-800">
                              {availableVendors.map(v => (
                                <button
                                  key={v.id}
                                  type="button"
                                  onClick={() => { setVendorFilter(v.id); setShowVendorFilterMenu(false); }}
                                  className={`w-full px-3.5 py-2 text-left flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer truncate ${
                                    vendorFilter === v.id ? 'font-bold text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/30' : 'text-gray-700 dark:text-gray-300'
                                  }`}
                                >
                                  <span className="truncate">{v.name}</span>
                                  <div className="flex items-center gap-1 shrink-0 ml-1">
                                    <span className="text-[10px] text-gray-400 font-mono">({v.count})</span>
                                    {vendorFilter === v.id && <Check size={14} />}
                                  </div>
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </th>

              <th className="p-3.5 font-bold text-right w-36">Price (₹)</th>
              <th className="p-3.5 font-bold text-center w-24">Tax Rate</th>
              <th className="p-3.5 font-bold text-right last:pr-6 w-44">Actions</th>
            </tr>
          </thead>
          <tbody className="text-sm divide-y divide-gray-100 dark:divide-gray-800">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-gray-500">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Tag className="w-8 h-8 text-gray-300" />
                    <p className="text-xs font-semibold">No items found matching the selected category & search query.</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredItems.map((item, index) => {
                const assignedConfigs = priceListMap[item._id?.toString()] || [];
                const config = assignedConfigs.find((c: any) => c.isPreferred) || assignedConfigs[0];
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
                    <td className="p-3.5 font-medium text-gray-900 dark:text-white max-w-[280px]">
                      <ItemNameAndDescription name={item.name} description={getItemDescription(item)} />
                    </td>
                    <td className="p-3.5">
                      {getCategoryBadge(item.itemCategory)}
                    </td>
                    <td className="p-3.5">
                      {hasPrice && (config.vendor || config.vendorName) ? (
                        <div>
                          <div className="font-bold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5 flex-wrap">
                            <span>{config.vendor?.name || config.vendorName || "Vendor"}</span>
                            {config.isPreferred && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300">
                                ⭐ Preferred
                              </span>
                            )}
                            {assignedConfigs.length > 1 && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                +{assignedConfigs.length - 1} other
                              </span>
                            )}
                          </div>
                          {config.vendor?.code && (
                            <span className="font-mono text-[10px] text-slate-400">{config.vendor.code}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs italic">Unassigned</span>
                      )}
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
            const config = assignedConfigs.find((c: any) => c.isPreferred) || assignedConfigs[0];
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
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className="font-bold text-gray-900 dark:text-white text-xs sm:text-sm truncate">{item.name || "N/A"}</h4>
                      {getCategoryBadge(item.itemCategory)}
                    </div>
                    {getItemDescription(item) ? (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 italic mt-0.5 line-clamp-2">{getItemDescription(item)}</p>
                    ) : null}
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

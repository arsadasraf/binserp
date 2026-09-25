"use client";
import React, { useState, useRef, useEffect, useMemo } from "react";
import { Edit2, Trash2, Search, Tag, Info, Image as ImageIcon, Plus, Filter, Check, Globe } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getCurrencySymbol } from "@/src/utils/currencyHelper";

export type FgTypeFilter = "all" | "assembly" | "subassembly" | "component";

interface PriceListTableProps {
  priceLists: any[];
  fgItems: any[];
  onAddPriceList?: () => void;
  onEdit: (item: any) => void;
  onDelete: (id: string) => void;
}

export const normalizeFgType = (typeStr?: string): "assembly" | "subassembly" | "component" | "other" => {
  if (!typeStr) return "other";
  const clean = typeStr.toLowerCase().replace(/[\s\-_]/g, "");
  if (clean.includes("subassembly") || clean.includes("subassemblies")) return "subassembly";
  if (clean.includes("assembly") || clean.includes("assemblies")) return "assembly";
  if (clean.includes("component")) return "component";
  return "other";
};

export default function PriceListTable({
  priceLists,
  fgItems = [],
  onAddPriceList,
  onEdit,
  onDelete,
}: PriceListTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState<FgTypeFilter>("all");
  const [selectedCurrency, setSelectedCurrency] = useState<string>("all");
  const [isTypeFilterOpen, setIsTypeFilterOpen] = useState(false);
  const typeFilterRef = useRef<HTMLTableCellElement>(null);

  // Close type filter dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (typeFilterRef.current && !typeFilterRef.current.contains(event.target as Node)) {
        setIsTypeFilterOpen(false);
      }
    }
    if (isTypeFilterOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isTypeFilterOpen]);

  // Map to easily find assigned price configs for each FG Item
  const priceListMap = (priceLists || []).reduce((acc, curr) => {
    const fgItemId = (curr.fgItem?._id || curr.fgItem)?.toString();
    if (fgItemId) acc[fgItemId] = curr;
    return acc;
  }, {} as Record<string, any>);

  // Compute available currencies for filter
  const availableCurrencies = useMemo(() => {
    const set = new Set<string>();
    (priceLists || []).forEach((p: any) => {
      if (p.currency) set.add(p.currency.toUpperCase());
    });
    if (set.size === 0) set.add('INR');
    return Array.from(set);
  }, [priceLists]);

  // Compute category counts
  const typeCounts = {
    all: fgItems.length,
    assembly: fgItems.filter((i) => normalizeFgType(i.type) === "assembly").length,
    subassembly: fgItems.filter((i) => normalizeFgType(i.type) === "subassembly").length,
    component: fgItems.filter((i) => normalizeFgType(i.type) === "component").length,
  };

  const filteredItems = fgItems.filter((item) => {
    const searchLower = searchTerm.toLowerCase();
    const fgItemName = item.name?.toLowerCase() || "";
    const fgItemDesc = (item.description || item.descriptions || "")?.toLowerCase();
    const matchesSearch = fgItemName.includes(searchLower) || fgItemDesc.includes(searchLower);

    if (!matchesSearch) return false;

    if (selectedType !== "all") {
      if (normalizeFgType(item.type) !== selectedType) return false;
    }

    if (selectedCurrency !== "all") {
      const p = priceListMap[item._id?.toString()];
      const itemCurrency = (p?.currency || item.currency || "INR").toUpperCase();
      if (itemCurrency !== selectedCurrency) return false;
    }

    return true;
  });

  const renderTypeBadge = (type?: string) => {
    const norm = normalizeFgType(type);
    if (norm === "assembly") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border border-purple-200/70 dark:border-purple-800/60">
          Assembly
        </span>
      );
    }
    if (norm === "subassembly") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200/70 dark:border-blue-800/60">
          Sub-Assembly
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800/60">
        {type || "Component"}
      </span>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
      {/* Search Bar, Type Tabs & Actions */}
      <div className="p-3.5 border-b border-gray-100 dark:border-gray-800 flex flex-col gap-3 bg-gray-50/50 dark:bg-gray-800/50">
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search by FG Item name or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
            />
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0 flex-wrap">
            {/* Currency Filter Dropdown */}
            <div className="flex items-center gap-1.5">
              <select
                value={selectedCurrency}
                onChange={(e) => setSelectedCurrency(e.target.value)}
                className="px-2.5 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer shadow-2xs"
                title="Filter by Currency"
              >
                <option value="all">All Currencies</option>
                {availableCurrencies.map((c) => (
                  <option key={c} value={c}>
                    {c} ({getCurrencySymbol(c).trim()})
                  </option>
                ))}
              </select>
            </div>

            <div className="text-xs text-gray-500 hidden lg:flex items-center gap-1.5 font-medium">
              <Info size={14} /> Showing {filteredItems.length} of {fgItems.length} Items
            </div>

            {onAddPriceList && (
              <button
                type="button"
                onClick={onAddPriceList}
                className="px-3 sm:px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Plus size={14} /> <span className="hidden sm:inline">Add Price & Tax Rate</span><span className="sm:hidden">Add Price</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Desktop Table View - Scrollable with Sticky Header */}
      <div className="hidden md:block overflow-x-auto overflow-y-auto max-h-[calc(100vh-270px)] min-h-[350px]">
        <table className="w-full text-left border-collapse relative">
          <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800 shadow-2xs">
            <tr className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
              <th className="p-4 font-medium first:pl-6 w-16">Photo</th>
              <th className="p-4 font-medium">Item Details</th>
              <th className="p-4 font-medium relative" ref={typeFilterRef}>
                <div className="flex items-center gap-1.5">
                  <span>Type</span>
                  <button
                    type="button"
                    onClick={() => setIsTypeFilterOpen((prev) => !prev)}
                    className={`p-1 rounded-md transition-colors ${
                      selectedType !== "all"
                        ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300 ring-1 ring-indigo-400"
                        : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                    }`}
                    title="Filter by Type classification"
                  >
                    <Filter size={13} />
                  </button>
                </div>

                {/* Filter Popover Dropdown */}
                <AnimatePresence>
                  {isTypeFilterOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={{ duration: 0.15 }}
                      className="absolute left-0 top-full mt-1.5 z-40 w-52 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-2 text-xs font-normal normal-case"
                    >
                      <div className="px-2 py-1.5 font-bold text-gray-700 dark:text-gray-200 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                        <span className="flex items-center gap-1.5">
                          <Filter size={12} className="text-indigo-600" />
                          Filter by Type
                        </span>
                        {selectedType !== "all" && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedType("all");
                              setIsTypeFilterOpen(false);
                            }}
                            className="text-[10px] text-indigo-600 hover:underline font-semibold"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                      <div className="py-1 space-y-0.5">
                        {[
                          { id: "all", label: "All Items", count: typeCounts.all },
                          { id: "assembly", label: "Assembly", count: typeCounts.assembly },
                          { id: "subassembly", label: "Sub-Assembly", count: typeCounts.subassembly },
                          { id: "component", label: "Component", count: typeCounts.component },
                        ].map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              setSelectedType(opt.id as FgTypeFilter);
                              setIsTypeFilterOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                              selectedType === opt.id
                                ? "bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 font-bold"
                                : "hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-300"
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              {selectedType === opt.id ? (
                                <Check size={12} className="text-indigo-600" />
                              ) : (
                                <span className="w-3" />
                              )}
                              {opt.label}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                              {opt.count}
                            </span>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </th>
              <th className="p-4 font-medium">HSN Code (Master)</th>
              <th className="p-4 font-medium text-right">Selling Price</th>
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
                    <p>No finished goods found matching filter.</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredItems.map((item, index) => {
                const priceConfig = priceListMap[item._id?.toString()];
                const isAssigned = !!priceConfig;
                // Single source of truth: prioritize master HSN code
                const hsnDisplay = item.hsnCode || priceConfig?.hsnCode || "-";
                const description = item.description || item.descriptions;

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
                        <img
                          src={item.photos[0]}
                          alt={item.name}
                          className="w-10 h-10 rounded-lg object-cover border border-gray-200 dark:border-gray-700"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center text-gray-400">
                          <ImageIcon size={18} />
                        </div>
                      )}
                    </td>
                    <td className="p-4 font-medium text-gray-900 dark:text-white">
                      <div>
                        <div className="font-bold text-xs sm:text-sm text-gray-900 dark:text-white">
                          {item.name || "N/A"}
                        </div>
                        {description && (
                          <div className="text-[11px] text-slate-500 italic mt-0.5 line-clamp-2 max-w-sm">
                            {description}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-gray-600 dark:text-gray-300">
                      {renderTypeBadge(item.type)}
                    </td>
                    <td className="p-4 text-gray-700 dark:text-gray-300 font-mono text-xs font-semibold">
                      <span className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 rounded-md border border-blue-200 dark:border-blue-800 inline-flex items-center gap-1">
                        {hsnDisplay}
                      </span>
                    </td>
                    <td className="p-4 text-right font-medium">
                      {isAssigned ? (
                        <div className="flex items-center justify-end gap-1.5 font-bold font-mono">
                          <span className="text-emerald-600 dark:text-emerald-400 text-sm">
                            {getCurrencySymbol(priceConfig.currency)}{Number(priceConfig.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {priceConfig.currency || "INR"}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      {isAssigned ? (
                        <span className="text-amber-600 dark:text-amber-400 font-semibold">
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
                                className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 dark:border-blue-800/50 dark:text-blue-400 dark:bg-blue-900/20 dark:hover:bg-blue-900/50 rounded-lg transition-colors cursor-pointer"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => onDelete(priceConfig._id)}
                                className="p-1.5 text-red-600 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/50 rounded-lg transition-colors cursor-pointer"
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
                              className="px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 dark:border-indigo-800/50 dark:text-indigo-400 dark:bg-indigo-900/20 dark:hover:bg-indigo-900/50 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
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

      {/* Mobile Card View - Scrollable */}
      <div className="block md:hidden p-3 space-y-3 pb-28 sm:pb-20 bg-gray-50/50 dark:bg-gray-900/40 max-h-[calc(100vh-270px)] overflow-y-auto">
        {filteredItems.length === 0 ? (
          <div className="text-center py-10 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            <Tag className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
            <p className="font-semibold text-xs text-gray-500">No Finished Goods found matching filter.</p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const priceConfig = priceListMap[item._id?.toString()];
            const isAssigned = !!priceConfig;
            const hsnDisplay = item.hsnCode || priceConfig?.hsnCode || "-";
            const description = item.description || item.descriptions;

            return (
              <div
                key={item._id}
                className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-3 border-b border-gray-100 dark:border-gray-700 pb-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {item.photos && item.photos.length > 0 ? (
                      <img
                        src={item.photos[0]}
                        alt={item.name}
                        className="w-11 h-11 rounded-lg object-cover border border-gray-200 dark:border-gray-700 shrink-0"
                      />
                    ) : (
                      <div className="w-11 h-11 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center text-gray-400 shrink-0">
                        <ImageIcon size={18} />
                      </div>
                    )}
                    <div className="min-w-0">
                      <h4 className="font-bold text-gray-900 dark:text-white text-sm truncate">
                        {item.name || "N/A"}
                      </h4>
                      {description && (
                        <p className="text-[11px] text-slate-500 italic truncate mt-0.5">{description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold rounded border ${
                        isAssigned
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800"
                          : "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/60 dark:text-amber-400 dark:border-amber-800"
                      }`}
                    >
                      {isAssigned ? "Assigned" : "Unassigned"}
                    </span>
                    {renderTypeBadge(item.type)}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase">HSN Code (Master)</span>
                    <p className="font-mono text-gray-700 dark:text-gray-300 font-semibold">{hsnDisplay}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase">Tax Rate</span>
                    <p className="font-semibold text-gray-700 dark:text-gray-300">
                      {isAssigned ? `${priceConfig.taxRate}%` : "—"}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[10px] font-bold text-gray-400 uppercase">Selling Price</span>
                    {isAssigned ? (
                      <div className="flex items-center gap-1.5 font-mono mt-0.5">
                        <p className="font-extrabold text-sm text-emerald-600 dark:text-emerald-400">
                          {getCurrencySymbol(priceConfig.currency)}{Number(priceConfig.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                          {priceConfig.currency || "INR"}
                        </span>
                      </div>
                    ) : (
                      <p className="font-semibold text-xs text-gray-400 mt-0.5">Price Not Configured</p>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                  {isAssigned ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onEdit({ ...priceConfig, fgItem: item })}
                        className="flex-1 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 rounded-lg border border-blue-200 dark:border-blue-800 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Edit2 size={13} /> Edit Price Config
                      </button>
                      <button
                        onClick={() => onDelete(priceConfig._id)}
                        className="py-1.5 px-3 text-xs font-bold text-red-600 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 rounded-lg border border-red-200 dark:border-red-800 transition-colors cursor-pointer"
                        title="Delete Configuration"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => onEdit({ fgItem: item, isNewAssignment: true })}
                      className="w-full py-2 text-xs font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 rounded-lg border border-indigo-200 dark:border-indigo-800 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
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

"use client";

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, Check, ChevronDown, X, User } from 'lucide-react';

export interface MultiSelectOption {
  value: string;
  label: string;
  subLabel?: string;
}

interface SearchableMultiSelectProps {
  options: MultiSelectOption[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
  icon?: React.ReactNode;
  title?: string;
}

export default function SearchableMultiSelect({
  options = [],
  selectedValues = [],
  onChange,
  placeholder = "All Customers",
  searchPlaceholder = "Search customer...",
  className = "",
  icon = <User size={13} className="text-slate-400 shrink-0" />,
  title = "Filter by Customer"
}: SearchableMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      // Auto-focus search input when opened
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Filtered options based on search query
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const q = searchQuery.toLowerCase().trim();
    return options.filter(opt => 
      opt.label.toLowerCase().includes(q) || 
      (opt.subLabel && opt.subLabel.toLowerCase().includes(q))
    );
  }, [options, searchQuery]);

  // Map of selected items for quick lookup
  const selectedSet = useMemo(() => new Set(selectedValues), [selectedValues]);

  // Toggle single option
  const handleToggleOption = (val: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (selectedSet.has(val)) {
      onChange(selectedValues.filter(v => v !== val));
    } else {
      onChange([...selectedValues, val]);
    }
  };

  // Select all currently visible in filter
  const handleSelectAllFiltered = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newValues = Array.from(new Set([...selectedValues, ...filteredOptions.map(o => o.value)]));
    onChange(newValues);
  };

  // Clear all selections
  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  // Single clear for button trigger
  const handleTriggerClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  // Selected label summary
  const summaryText = useMemo(() => {
    if (selectedValues.length === 0) return placeholder;
    if (selectedValues.length === 1) {
      const match = options.find(o => o.value === selectedValues[0]);
      return match ? match.label : "1 Customer";
    }
    return `${selectedValues.length} Customers`;
  }, [selectedValues, options, placeholder]);

  return (
    <div ref={containerRef} className={`relative inline-block text-left ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className={`h-9 px-3 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer select-none ${
          selectedValues.length > 0
            ? "bg-indigo-50/80 hover:bg-indigo-100/70 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 shadow-2xs"
            : "bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 shadow-2xs"
        }`}
        title={title}
        aria-expanded={isOpen}
      >
        {icon}
        <span className="truncate max-w-[130px] sm:max-w-[150px]">{summaryText}</span>
        
        {selectedValues.length > 1 && (
          <span className="px-1.5 py-0.2 text-[10px] font-extrabold rounded-full bg-indigo-200 dark:bg-indigo-800 text-indigo-800 dark:text-indigo-200">
            {selectedValues.length}
          </span>
        )}

        {selectedValues.length > 0 ? (
          <span
            role="button"
            onClick={handleTriggerClear}
            className="p-0.5 hover:bg-indigo-200 dark:hover:bg-indigo-800 text-indigo-600 dark:text-indigo-300 rounded-md transition-colors"
            title="Clear customer filter"
          >
            <X size={12} />
          </span>
        ) : (
          <ChevronDown size={13} className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        )}
      </button>

      {/* Floating Searchable Multi-Select Popover */}
      {isOpen && (
        <div className="absolute left-0 mt-1.5 w-72 sm:w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[380px] animate-in fade-in zoom-in-95 duration-100">
          
          {/* Header & Quick Action Buttons */}
          <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 space-y-2">
            {/* Search Input */}
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500 font-medium text-slate-800 dark:text-slate-200"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Quick Action Buttons Bar */}
            <div className="flex items-center justify-between text-[11px] font-semibold px-0.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAllFiltered}
                  className="text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  Select All ({filteredOptions.length})
                </button>
                {selectedValues.length > 0 && (
                  <>
                    <span className="text-slate-300 dark:text-slate-700">•</span>
                    <button
                      type="button"
                      onClick={handleClearAll}
                      className="text-rose-500 hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                  </>
                )}
              </div>
              <span className="text-[10px] text-slate-400 font-normal">
                {selectedValues.length} of {options.length} selected
              </span>
            </div>
          </div>

          {/* Scrollable Checkbox List */}
          <div className="overflow-y-auto p-1.5 space-y-0.5 custom-scrollbar flex-1">
            {filteredOptions.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                No customers found matching &quot;{searchQuery}&quot;
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = selectedSet.has(opt.value);
                return (
                  <div
                    key={opt.value}
                    onClick={(e) => handleToggleOption(opt.value, e)}
                    className={`flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-900 dark:text-indigo-200 font-bold"
                        : "hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-medium"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                        isSelected
                          ? "bg-indigo-600 border-indigo-600 text-white shadow-2xs"
                          : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                      }`}>
                        {isSelected && <Check size={11} strokeWidth={3} />}
                      </div>
                      <div className="truncate">
                        <div className="truncate">{opt.label}</div>
                        {opt.subLabel && (
                          <div className="text-[10px] text-slate-400 font-normal truncate mt-0.5">
                            {opt.subLabel}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Bar */}
          <div className="p-2 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex justify-end">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-2xs"
            >
              Done
            </button>
          </div>

        </div>
      )}
    </div>
  );
}

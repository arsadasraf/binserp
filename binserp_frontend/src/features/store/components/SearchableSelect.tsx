import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, Check, ChevronDown, Plus, Loader2 } from 'lucide-react';

export interface SearchableOption {
    value: string;
    label: string;
    description?: string;
    code?: string;
    badge?: string;
    subBadge?: string;
    disabled?: boolean;
    hint?: string;
    [key: string]: any;
}

interface SearchableSelectProps {
    options?: SearchableOption[];
    value: string;
    onChange: (value: string) => void;
    displayLabel?: string;
    placeholder?: string;
    className?: string;
    innerClassName?: string;
    dropdownPosition?: 'bottom' | 'top' | 'auto';
    allowCustom?: boolean;
    disabled?: boolean;
    hasError?: boolean;
    asyncSearch?: (query: string) => Promise<SearchableOption[]>;
}

const MAX_RENDER_STEP = 50;

const SearchableSelect: React.FC<SearchableSelectProps> = ({ 
    options = [], 
    value, 
    onChange, 
    displayLabel,
    placeholder = "Select an option...", 
    className = "w-full", 
    innerClassName = "", 
    dropdownPosition = "auto", 
    allowCustom = false,
    disabled = false,
    hasError = false,
    asyncSearch
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
    const [mounted, setMounted] = useState(false);
    const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
    const [visibleCount, setVisibleCount] = useState<number>(MAX_RENDER_STEP);
    const [highlightedIndex, setHighlightedIndex] = useState<number>(0);

    // Async search states
    const [asyncOptions, setAsyncOptions] = useState<SearchableOption[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const asyncRequestIdRef = useRef(0);
    
    const wrapperRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Debounce search input for instant typing response
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
            setVisibleCount(MAX_RENDER_STEP);
            setHighlightedIndex(0);
        }, 120);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Handle Async Search if provided
    useEffect(() => {
        if (!isOpen || !asyncSearch) return;

        const currentRequestId = ++asyncRequestIdRef.current;
        setIsSearching(true);

        const timer = setTimeout(async () => {
            try {
                const results = await asyncSearch(debouncedSearchTerm);
                if (currentRequestId === asyncRequestIdRef.current) {
                    setAsyncOptions(results || []);
                }
            } catch (err) {
                console.error("Async search error:", err);
            } finally {
                if (currentRequestId === asyncRequestIdRef.current) {
                    setIsSearching(false);
                }
            }
        }, 150);

        return () => clearTimeout(timer);
    }, [debouncedSearchTerm, isOpen, asyncSearch]);

    // Calculate position for the portal dropdown
    const updatePosition = useCallback(() => {
        if (!wrapperRef.current) return;
        const rect = wrapperRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;

        // Choose whether to open upward or downward
        let openUpward = false;
        if (dropdownPosition === 'top') {
            openUpward = true;
        } else if (dropdownPosition === 'bottom') {
            openUpward = false;
        } else {
            openUpward = spaceBelow < 240 && spaceAbove > 180;
        }

        const width = Math.max(rect.width, 280);
        const maxAllowedWidth = Math.min(width, window.innerWidth - 16);
        let left = rect.left;
        if (left + maxAllowedWidth > window.innerWidth - 8) {
            left = window.innerWidth - maxAllowedWidth - 8;
        }
        left = Math.max(8, left);

        const newStyle: React.CSSProperties = {
            position: 'fixed',
            left: `${left}px`,
            width: `${maxAllowedWidth}px`,
            zIndex: 999999,
        };

        if (openUpward) {
            newStyle.bottom = `${window.innerHeight - rect.top + 4}px`;
            newStyle.maxHeight = `${Math.min(320, Math.max(140, spaceAbove - 16))}px`;
        } else {
            newStyle.top = `${rect.bottom + 4}px`;
            newStyle.maxHeight = `${Math.min(320, Math.max(140, spaceBelow - 16))}px`;
        }

        setMenuStyle(newStyle);
    }, [dropdownPosition]);

    // Recalculate position when open or on scroll/resize
    useEffect(() => {
        if (isOpen) {
            updatePosition();
            const handleScroll = () => updatePosition();
            const handleResize = () => updatePosition();

            window.addEventListener('scroll', handleScroll, true);
            window.addEventListener('resize', handleResize);

            return () => {
                window.removeEventListener('scroll', handleScroll, true);
                window.removeEventListener('resize', handleResize);
            };
        }
    }, [isOpen, updatePosition]);

    // Determine active source options (async vs local)
    const sourceOptions = asyncSearch ? asyncOptions : options;

    // Helper to normalize alphanumeric strings (stripping spaces, dashes, slashes, etc.)
    const normalizeAlphaNum = (str: string) => {
        return (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    };

    // Deduplicate options by value and pre-compute indexed search keys
    const uniqueOptions = useMemo(() => {
        const map = new Map<string, SearchableOption & { _searchKey: string; _cleanKey: string }>();
        const list = Array.isArray(sourceOptions) ? sourceOptions : [];

        for (let i = 0; i < list.length; i++) {
            const o = list[i];
            if (!o || o.value === undefined || o.value === null) continue;
            const val = String(o.value);
            if (!map.has(val)) {
                const labelStr = o.label || '';
                const descStr = o.description || '';
                const codeStr = o.code || '';
                const badgeStr = o.badge || '';
                const rawSearch = `${labelStr} ${descStr} ${codeStr} ${badgeStr}`.toLowerCase();
                map.set(val, {
                    ...o,
                    value: val,
                    label: labelStr,
                    description: descStr,
                    code: codeStr,
                    _searchKey: rawSearch,
                    _cleanKey: normalizeAlphaNum(rawSearch)
                });
            }
        }
        return Array.from(map.values());
    }, [sourceOptions]);

    // Handle click outside to close dropdown
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            const target = event.target as Node;
            if (
                wrapperRef.current && !wrapperRef.current.contains(target) &&
                menuRef.current && !menuRef.current.contains(target)
            ) {
                setIsOpen(false);
            }
        }
        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
            return () => document.removeEventListener("mousedown", handleClickOutside);
        }
    }, [isOpen]);

    // Focus search input when dropdown opens
    useEffect(() => {
        if (isOpen) {
            setVisibleCount(MAX_RENDER_STEP);
            setHighlightedIndex(0);
            setTimeout(() => {
                inputRef.current?.focus();
            }, 40);
        } else {
            setSearchTerm("");
            setDebouncedSearchTerm("");
        }
    }, [isOpen]);

    const stringValue = typeof value === 'object' && value !== null 
        ? String((value as any)._id || (value as any).id || (value as any).name || '') 
        : (value !== undefined && value !== null ? String(value) : '');

    // Fast O(1) matched option lookup
    const matchedOption = useMemo(() => {
        if (!stringValue) return null;
        return uniqueOptions.find((o) => o.value === stringValue) || null;
    }, [uniqueOptions, stringValue]);

    const selectedOption = matchedOption || (displayLabel ? { value: stringValue || displayLabel, label: displayLabel } : stringValue ? { value: stringValue, label: stringValue } : null);
    
    // High-performance intelligent keyword search (Case-insensitive, Multi-token AND logic, Separator tolerant, Relevance ranked)
    const filteredOptions = useMemo(() => {
        if (asyncSearch) {
            // When using asyncSearch, backend already filtered by query
            return uniqueOptions;
        }
        const rawTerm = debouncedSearchTerm.trim().toLowerCase();
        if (!rawTerm) return uniqueOptions;

        // Tokenize by any sequence of whitespace
        const tokens = rawTerm.split(/\s+/).filter(Boolean);
        if (tokens.length === 0) return uniqueOptions;

        const cleanTerm = normalizeAlphaNum(rawTerm);

        // Filter: an option matches if ALL tokens match in _searchKey or _cleanKey
        const matched = uniqueOptions.filter((o) => {
            // Direct substring match of full query
            if (o._searchKey.includes(rawTerm)) return true;
            // Clean match (e.g. "ss 304" or "ss-304" matches "ss304")
            if (cleanTerm.length >= 2 && o._cleanKey.includes(cleanTerm)) return true;

            // Multi-token match (all words must be present, any order)
            return tokens.every((token) => {
                if (o._searchKey.includes(token)) return true;
                const cleanToken = normalizeAlphaNum(token);
                if (cleanToken && o._cleanKey.includes(cleanToken)) return true;
                return false;
            });
        });

        // Relevance Ranking
        const firstToken = tokens[0];
        const getRelevanceScore = (opt: typeof uniqueOptions[0]): number => {
            const labelLower = (opt.label || '').toLowerCase();
            const codeLower = (opt.code || '').toLowerCase();

            // 1. Exact match on label or code
            if (labelLower === rawTerm || codeLower === rawTerm) return 0;

            // 2. Exact clean match (e.g. "SS304" vs "SS-304")
            const cleanCode = normalizeAlphaNum(opt.code || '');
            const cleanLabel = normalizeAlphaNum(opt.label || '');
            if (cleanCode === cleanTerm || cleanLabel === cleanTerm) return 1;

            // 3. Starts with the full search query
            if (labelLower.startsWith(rawTerm) || codeLower.startsWith(rawTerm)) return 2;
            if (cleanLabel.startsWith(cleanTerm) || cleanCode.startsWith(cleanTerm)) return 3;

            // 4. Starts with the first token
            if (labelLower.startsWith(firstToken) || codeLower.startsWith(firstToken)) return 4;

            // 5. Word boundary match
            if (labelLower.includes(` ${firstToken}`) || codeLower.includes(` ${firstToken}`)) return 5;

            // 6. Substring match
            return 6;
        };

        matched.sort((a, b) => {
            const scoreDiff = getRelevanceScore(a) - getRelevanceScore(b);
            if (scoreDiff !== 0) return scoreDiff;
            return a.label.localeCompare(b.label);
        });

        return matched;
    }, [uniqueOptions, debouncedSearchTerm, asyncSearch]);

    // High performance sliced visible options: NEVER renders 5,000 items in the DOM!
    const visibleOptions = useMemo(() => {
        return filteredOptions.slice(0, visibleCount);
    }, [filteredOptions, visibleCount]);

    const exactMatch = useMemo(() => {
        const clean = debouncedSearchTerm.trim().toLowerCase();
        if (!clean) return false;
        const cleanNorm = normalizeAlphaNum(clean);
        return uniqueOptions.some((o) => {
            const labelLower = (o.label || '').toLowerCase();
            return labelLower === clean || normalizeAlphaNum(labelLower) === cleanNorm;
        });
    }, [uniqueOptions, debouncedSearchTerm]);

    // Infinite scroll handler for options list
    const handleListScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        if (scrollHeight - scrollTop - clientHeight < 60) {
            if (visibleCount < filteredOptions.length) {
                setVisibleCount(prev => Math.min(prev + MAX_RENDER_STEP, filteredOptions.length));
            }
        }
    };

    // Helper to format option label (detects "(CODE)" at the end)
    const formatOptionLabel = (label: string) => {
        const strLabel = typeof label === 'string' ? label : String(label || '');
        const match = strLabel.match(/^(.*?)\s*(\([A-Za-z0-9\-_./\\]+\))$/);
        if (match) {
            return {
                name: match[1],
                code: match[2]
            };
        }
        return { name: strLabel, code: null };
    };

    // Keyboard navigation handler
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedIndex(prev => Math.min(prev + 1, Math.max(0, visibleOptions.length - 1)));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (visibleOptions.length > 0 && highlightedIndex >= 0 && highlightedIndex < visibleOptions.length) {
                const target = visibleOptions[highlightedIndex];
                if (!target.disabled) {
                    onChange(target.value);
                    setIsOpen(false);
                    setSearchTerm("");
                }
            } else if (allowCustom && searchTerm.trim() && !exactMatch) {
                onChange(searchTerm.trim());
                setIsOpen(false);
                setSearchTerm("");
            }
        } else if (e.key === 'Escape') {
            setIsOpen(false);
        }
    };

    return (
        <div ref={wrapperRef} className={`relative ${className}`}>
            {/* Display Trigger */}
            <div 
                className={`${
                    innerClassName 
                        ? innerClassName 
                        : 'w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border rounded-lg outline-none cursor-pointer transition-all'
                } flex justify-between items-center gap-2 ${
                    disabled 
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200 dark:bg-slate-800 dark:border-slate-700' 
                        : hasError
                            ? 'border-rose-500 bg-rose-50/40 dark:bg-rose-950/30 ring-1 ring-rose-400/80 text-rose-900 dark:text-rose-200'
                            : isOpen 
                                ? 'border-indigo-500 ring-2 ring-indigo-500/20' 
                                : !selectedOption && !stringValue && !displayLabel
                                    ? 'border-gray-300 dark:border-slate-700 hover:border-gray-400' 
                                    : 'border-gray-300 dark:border-slate-700 hover:border-indigo-300'
                }`}
                onClick={() => {
                    if (!disabled) setIsOpen(!isOpen);
                }}
            >
                <span className={`truncate font-medium ${hasError ? 'text-rose-700 dark:text-rose-300 font-semibold' : (!selectedOption && !displayLabel) ? 'text-gray-400' : 'text-gray-800 dark:text-gray-200'}`}>
                    {selectedOption ? (typeof selectedOption.label === 'string' ? selectedOption.label : String(selectedOption.label)) : (displayLabel || placeholder)}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 ${hasError ? 'text-rose-500' : 'text-gray-400'} shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180 text-indigo-600' : ''}`} />
            </div>

            {/* Portal Dropdown Menu: immune to parent container overflow, clipping, or scroll bounds */}
            {mounted && isOpen && createPortal(
                <div 
                    ref={menuRef}
                    style={menuStyle}
                    className="bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in duration-100"
                >
                    {/* Search Bar */}
                    <div className="p-2.5 bg-gray-50/95 dark:bg-slate-800/95 border-b border-gray-100 dark:border-slate-800 flex-shrink-0">
                        <div className="relative flex items-center">
                            {isSearching ? (
                                <Loader2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 animate-spin absolute left-2.5 pointer-events-none" />
                            ) : (
                                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 pointer-events-none" />
                            )}
                            <input
                                ref={inputRef}
                                type="text"
                                className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 placeholder-gray-400 text-gray-800 dark:text-gray-100 font-medium"
                                placeholder="Type keyword or code to filter..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                onClick={e => e.stopPropagation()}
                                onKeyDown={handleKeyDown}
                            />
                        </div>
                    </div>

                    {/* Options List with Fast Windowed Slicing */}
                    <div 
                        ref={listRef}
                        onScroll={handleListScroll}
                        className="overflow-y-auto divide-y divide-gray-100 dark:divide-slate-800 flex-1 custom-scrollbar min-h-[60px]"
                    >
                        {visibleOptions.length > 0 ? (
                            visibleOptions.map((o, idx) => {
                                const isSelected = value === o.value;
                                const isHighlighted = highlightedIndex === idx;
                                const { name, code } = formatOptionLabel(o.label);
                                const itemDesc = o.description || '';
                                const isDisabled = o.disabled;

                                return (
                                    <div
                                        key={o.value}
                                        className={`px-3.5 py-2.5 text-xs flex items-center justify-between gap-2 transition-colors ${
                                            isDisabled 
                                                ? 'opacity-60 cursor-not-allowed bg-gray-50/50 dark:bg-slate-800/50'
                                                : isSelected 
                                                    ? 'cursor-pointer bg-indigo-50 dark:bg-indigo-950/70 text-indigo-950 dark:text-indigo-200 font-bold' 
                                                    : isHighlighted
                                                        ? 'cursor-pointer bg-slate-100 dark:bg-slate-800/80 text-indigo-900 dark:text-indigo-300'
                                                        : 'cursor-pointer text-gray-700 dark:text-slate-200 hover:bg-indigo-50/60 dark:hover:bg-indigo-950/40 hover:text-indigo-900 dark:hover:text-indigo-300'
                                        }`}
                                        onMouseEnter={() => setHighlightedIndex(idx)}
                                        onMouseDown={(e) => {
                                            if (isDisabled) return;
                                            e.preventDefault();
                                            onChange(o.value);
                                            setIsOpen(false);
                                            setSearchTerm("");
                                        }}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="font-semibold text-slate-900 dark:text-white truncate">{name}</span>
                                                {o.badge && (
                                                    <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-md border ${
                                                        o.badge === 'Assembly' 
                                                            ? 'bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800' 
                                                            : o.badge === 'Sub Assembly'
                                                            ? 'bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                                                            : o.badge === 'Bought Out'
                                                            ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                                                            : o.badge === 'Consumable'
                                                            ? 'bg-teal-100 dark:bg-teal-950/70 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800'
                                                            : 'bg-sky-100 dark:bg-sky-950/70 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800'
                                                    }`}>
                                                        {o.badge}
                                                    </span>
                                                )}
                                                {o.subBadge && (
                                                    <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                                        {o.subBadge}
                                                    </span>
                                                )}
                                                {o.hint && (
                                                    <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800/60">
                                                        {o.hint}
                                                    </span>
                                                )}
                                            </div>
                                            {itemDesc && (
                                                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 break-words line-clamp-2 font-normal">
                                                    {itemDesc}
                                                </div>
                                            )}
                                            {code && (
                                                <span className="inline-block mt-1 px-1.5 py-0.2 text-[10px] font-mono bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 rounded border border-gray-200 dark:border-slate-700">
                                                    {code}
                                                </span>
                                            )}
                                        </div>
                                        {isSelected && (
                                            <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                        )}
                                    </div>
                                );
                            })
                        ) : isSearching ? (
                            <div className="px-3 py-6 text-xs text-gray-400 dark:text-slate-500 text-center flex flex-col items-center gap-2">
                                <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
                                <span>Searching matching items...</span>
                            </div>
                        ) : allowCustom && searchTerm.trim() && !exactMatch ? (
                            <div
                                className="px-3.5 py-2.5 text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 cursor-pointer font-bold flex items-center gap-1.5 transition-colors"
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    onChange(searchTerm.trim());
                                    setIsOpen(false);
                                    setSearchTerm("");
                                }}
                            >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Create &quot;{searchTerm.trim()}&quot;</span>
                            </div>
                        ) : (
                            <div className="px-3 py-6 text-xs text-gray-400 dark:text-slate-500 text-center flex flex-col items-center gap-1">
                                <span className="font-semibold">No matching items found</span>
                                <span className="text-[10px] text-gray-400">Try a different keyword or item code</span>
                            </div>
                        )}
                    </div>

                    {/* Sliced Count Footer / Load More Indicator */}
                    {filteredOptions.length > MAX_RENDER_STEP && (
                        <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800/90 border-t border-slate-200 dark:border-slate-700/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 flex-shrink-0">
                            <span>
                                Showing {visibleOptions.length} of {filteredOptions.length} matches
                            </span>
                            {visibleOptions.length < filteredOptions.length && (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setVisibleCount(prev => Math.min(prev + MAX_RENDER_STEP, filteredOptions.length));
                                    }}
                                    className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline cursor-pointer"
                                >
                                    +50 more
                                </button>
                            )}
                        </div>
                    )}
                </div>,
                document.body
            )}
        </div>
    );
};

export default SearchableSelect;

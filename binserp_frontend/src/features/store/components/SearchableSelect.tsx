import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Check, ChevronDown, Plus } from 'lucide-react';

interface SearchableOption {
    value: string;
    label: string;
    description?: string;
    code?: string;
}

interface SearchableSelectProps {
    options: SearchableOption[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    innerClassName?: string;
    dropdownPosition?: 'bottom' | 'top' | 'auto';
    allowCustom?: boolean;
    disabled?: boolean;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({ 
    options, 
    value, 
    onChange, 
    placeholder = "Select an option...", 
    className = "w-full", 
    innerClassName = "", 
    dropdownPosition = "bottom", 
    allowCustom = false,
    disabled = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [actualPosition, setActualPosition] = useState<'top' | 'bottom'>('bottom');
    const wrapperRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Calculate smart position whenever dropdown opens
    useEffect(() => {
        if (isOpen) {
            if (dropdownPosition === 'top') {
                setActualPosition('top');
            } else if (dropdownPosition === 'bottom') {
                setActualPosition('bottom');
            } else {
                // Auto calculate based on viewport space
                if (wrapperRef.current) {
                    const rect = wrapperRef.current.getBoundingClientRect();
                    const spaceBelow = window.innerHeight - rect.bottom;
                    const spaceAbove = rect.top;
                    // Only open upward if space below is severely cramped (< 180px) and space above has room
                    if (spaceBelow < 180 && spaceAbove > 220) {
                        setActualPosition('top');
                    } else {
                        setActualPosition('bottom');
                    }
                } else {
                    setActualPosition('bottom');
                }
            }
        }
    }, [isOpen, dropdownPosition]);

    // Deduplicate options by value
    const uniqueOptions = useMemo(() => {
        const map = new Map<string, SearchableOption>();
        (options || []).forEach((o: any) => {
            if (o && o.value && !map.has(String(o.value))) {
                map.set(String(o.value), {
                    value: String(o.value),
                    label: o.label || '',
                    description: o.description,
                    code: o.code
                });
            }
        });
        return Array.from(map.values());
    }, [options]);

    // Handle click outside to close dropdown
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Focus input when dropdown opens
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => {
                inputRef.current?.focus();
            }, 50);
        } else {
            setSearchTerm("");
        }
    }, [isOpen]);

    const selectedOption = uniqueOptions.find((o) => o.value === value) || (value ? { value, label: value } : null);
    
    const filteredOptions = useMemo(() => {
        if (!searchTerm.trim()) return uniqueOptions;
        const term = searchTerm.toLowerCase().trim();
        return uniqueOptions.filter((o) => (o.label || '').toLowerCase().includes(term));
    }, [uniqueOptions, searchTerm]);

    const exactMatch = uniqueOptions.some((o) => (o.label || '').toLowerCase() === searchTerm.trim().toLowerCase());

    // Helper to format option label (detects "(CODE)" at the end)
    const formatOptionLabel = (label: string) => {
        const match = label.match(/^(.*?)\s*(\([A-Za-z0-9\-_./\\]+\))$/);
        if (match) {
            return {
                name: match[1],
                code: match[2]
            };
        }
        return { name: label, code: null };
    };

    return (
        <div ref={wrapperRef} className={`relative ${className}`}>
            {/* Display Trigger */}
            <div 
                className={`${
                    innerClassName 
                        ? innerClassName 
                        : 'w-full px-3 py-2 text-xs bg-white border rounded-lg outline-none cursor-pointer transition-all'
                } flex justify-between items-center gap-2 ${
                    disabled 
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200' 
                        : isOpen 
                            ? 'border-indigo-500 ring-2 ring-indigo-500/20' 
                            : !selectedOption && !value 
                                ? 'border-gray-300 hover:border-gray-400' 
                                : 'border-gray-300 hover:border-indigo-300'
                }`}
                onClick={() => {
                    if (!disabled) setIsOpen(!isOpen);
                }}
            >
                <span className={`truncate font-medium ${!selectedOption ? 'text-gray-400' : 'text-gray-800'}`}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180 text-indigo-600' : ''}`} />
            </div>

            {/* Dropdown Menu (Opens Upward or Downward with Smart Positioning) */}
            {isOpen && (
                <div 
                    className={`absolute z-[99999] min-w-full sm:min-w-[320px] max-w-[95vw] ${
                        actualPosition === 'top' ? 'bottom-full mb-2 origin-bottom' : 'top-full mt-2 origin-top'
                    } bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150`}
                >
                    {/* Search Bar */}
                    <div className="p-2.5 bg-gray-50/95 dark:bg-slate-800/95 border-b border-gray-100 dark:border-slate-800 sticky top-0 z-10">
                        <div className="relative flex items-center">
                            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 pointer-events-none" />
                            <input
                                ref={inputRef}
                                type="text"
                                className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-white border border-gray-300 rounded-lg outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 placeholder-gray-400 text-gray-800 font-medium"
                                placeholder="Type to filter items..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                onClick={e => e.stopPropagation()}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        if (filteredOptions.length > 0) {
                                            onChange(filteredOptions[0].value);
                                            setIsOpen(false);
                                            setSearchTerm("");
                                        } else if (allowCustom && searchTerm.trim()) {
                                            onChange(searchTerm.trim());
                                            setIsOpen(false);
                                            setSearchTerm("");
                                        }
                                    } else if (e.key === 'Escape') {
                                        setIsOpen(false);
                                    }
                                }}
                            />
                        </div>
                    </div>

                    {/* Options List */}
                    <div className="max-h-56 overflow-y-auto divide-y divide-gray-100 dark:divide-slate-800 custom-scrollbar">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((o) => {
                                const isSelected = value === o.value;
                                const { name, code } = formatOptionLabel(o.label);
                                return (
                                    <div
                                        key={o.value}
                                        className={`px-3.5 py-2 text-xs cursor-pointer flex items-center justify-between gap-2 transition-colors ${
                                            isSelected 
                                                ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-950 dark:text-indigo-200 font-bold' 
                                                : 'text-gray-700 dark:text-slate-200 hover:bg-indigo-50/60 dark:hover:bg-indigo-950/40 hover:text-indigo-900 dark:hover:text-indigo-300'
                                        }`}
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                            onChange(o.value);
                                            setIsOpen(false);
                                            setSearchTerm("");
                                        }}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="truncate font-semibold">{name}</div>
                                            {code && (
                                                <span className="inline-block mt-0.5 px-1.5 py-0.2 text-[10px] font-mono bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 rounded border border-gray-200 dark:border-slate-700">
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
                        ) : (
                            allowCustom && searchTerm.trim() && !exactMatch ? (
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
                                <div className="px-3 py-4 text-xs text-gray-400 dark:text-slate-500 text-center flex flex-col items-center gap-1">
                                    <span>No matching items found</span>
                                </div>
                            )
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SearchableSelect;

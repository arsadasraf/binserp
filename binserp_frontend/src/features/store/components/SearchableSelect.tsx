import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
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
    displayLabel?: string;
    placeholder?: string;
    className?: string;
    innerClassName?: string;
    dropdownPosition?: 'bottom' | 'top' | 'auto';
    allowCustom?: boolean;
    disabled?: boolean;
    hasError?: boolean;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({ 
    options, 
    value, 
    onChange, 
    displayLabel,
    placeholder = "Select an option...", 
    className = "w-full", 
    innerClassName = "", 
    dropdownPosition = "auto", 
    allowCustom = false,
    disabled = false,
    hasError = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [mounted, setMounted] = useState(false);
    const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
    
    const wrapperRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Calculate position for the portal dropdown
    const updatePosition = () => {
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
            // Auto: open upward if space below is limited and space above has room
            openUpward = spaceBelow < 220 && spaceAbove > 180;
        }

        const width = Math.max(rect.width, 280);
        // Constrain width to window bounds
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
            newStyle.maxHeight = `${Math.min(280, Math.max(120, spaceAbove - 16))}px`;
        } else {
            newStyle.top = `${rect.bottom + 4}px`;
            newStyle.maxHeight = `${Math.min(280, Math.max(120, spaceBelow - 16))}px`;
        }

        setMenuStyle(newStyle);
    };

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
            setTimeout(() => {
                inputRef.current?.focus();
            }, 50);
        } else {
            setSearchTerm("");
        }
    }, [isOpen]);

    const stringValue = typeof value === 'object' && value !== null 
        ? String((value as any)._id || (value as any).id || (value as any).name || '') 
        : (value !== undefined && value !== null ? String(value) : '');

    const matchedOption = uniqueOptions.find((o) => o.value === stringValue);
    const selectedOption = matchedOption || (displayLabel ? { value: stringValue || displayLabel, label: displayLabel } : stringValue ? { value: stringValue, label: stringValue } : null);
    
    const filteredOptions = useMemo(() => {
        if (!searchTerm.trim()) return uniqueOptions;
        const term = searchTerm.toLowerCase().trim();
        return uniqueOptions.filter((o) => 
            (o.label || '').toLowerCase().includes(term) ||
            (o.description || '').toLowerCase().includes(term) ||
            (o.code || '').toLowerCase().includes(term)
        );
    }, [uniqueOptions, searchTerm]);

    const exactMatch = uniqueOptions.some((o) => (o.label || '').toLowerCase() === searchTerm.trim().toLowerCase());

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
                        : hasError
                            ? 'border-rose-500 bg-rose-50/40 dark:bg-rose-950/30 ring-1 ring-rose-400/80 text-rose-900 dark:text-rose-200'
                            : isOpen 
                                ? 'border-indigo-500 ring-2 ring-indigo-500/20' 
                                : !selectedOption && !stringValue && !displayLabel
                                    ? 'border-gray-300 hover:border-gray-400' 
                                    : 'border-gray-300 hover:border-indigo-300'
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
                            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 pointer-events-none" />
                            <input
                                ref={inputRef}
                                type="text"
                                className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 placeholder-gray-400 text-gray-800 dark:text-gray-100 font-medium"
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
                    <div className="overflow-y-auto divide-y divide-gray-100 dark:divide-slate-800 flex-1 custom-scrollbar min-h-[60px]">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((o) => {
                                const isSelected = value === o.value;
                                const { name, code } = formatOptionLabel(o.label);
                                const itemDesc = o.description || '';
                                return (
                                    <div
                                        key={o.value}
                                        className={`px-3.5 py-2.5 text-xs cursor-pointer flex items-center justify-between gap-2 transition-colors ${
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
                                            <div className="font-semibold text-slate-900 dark:text-white truncate">{name}</div>
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
                </div>,
                document.body
            )}
        </div>
    );
};

export default SearchableSelect;

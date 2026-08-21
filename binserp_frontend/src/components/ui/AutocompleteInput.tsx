"use client";

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Sparkles } from 'lucide-react';

export interface SuggestionItem {
    label: string;
    value: string;
    sublabel?: string;
    badge?: string;
    raw?: any;
}

interface AutocompleteInputProps {
    value: string;
    onChange: (value: string) => void;
    onSelect?: (item: SuggestionItem) => void;
    suggestions: (SuggestionItem | string)[];
    placeholder?: string;
    required?: boolean;
    disabled?: boolean;
    className?: string;
    inputClassName?: string;
    icon?: React.ReactNode;
    transformValue?: (val: string) => string;
    type?: string;
    id?: string;
}

export default function AutocompleteInput({
    value,
    onChange,
    onSelect,
    suggestions = [],
    placeholder = '',
    required = false,
    disabled = false,
    className = '',
    inputClassName = '',
    icon,
    transformValue,
    type = 'text',
    id
}: AutocompleteInputProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Normalize suggestions to SuggestionItem
    const normalizedSuggestions: SuggestionItem[] = suggestions.map(item => {
        if (typeof item === 'string') {
            return { label: item, value: item };
        }
        return item;
    });

    // Filter suggestions based on query
    const filteredSuggestions = normalizedSuggestions.filter(item => {
        if (!value) return true;
        const q = value.toLowerCase().trim();
        const lMatch = item.label.toLowerCase().includes(q);
        const subMatch = item.sublabel ? item.sublabel.toLowerCase().includes(q) : false;
        return lMatch || subMatch;
    });

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value;
        if (transformValue) val = transformValue(val);
        onChange(val);
        setIsOpen(true);
        setHighlightedIndex(-1);
    };

    const handleSelectOption = (item: SuggestionItem) => {
        onChange(item.value);
        if (onSelect) onSelect(item);
        setIsOpen(false);
        setHighlightedIndex(-1);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!isOpen) {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                setIsOpen(true);
                return;
            }
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedIndex(prev => 
                prev < filteredSuggestions.length - 1 ? prev + 1 : 0
            );
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex(prev => 
                prev > 0 ? prev - 1 : filteredSuggestions.length - 1
            );
        } else if (e.key === 'Enter') {
            if (highlightedIndex >= 0 && highlightedIndex < filteredSuggestions.length) {
                e.preventDefault();
                handleSelectOption(filteredSuggestions[highlightedIndex]);
            }
        } else if (e.key === 'Escape') {
            setIsOpen(false);
        }
    };

    return (
        <div ref={containerRef} className={`relative w-full ${className}`}>
            <div className="relative flex items-center">
                {icon && (
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10">
                        {icon}
                    </div>
                )}
                <input
                    ref={inputRef}
                    id={id}
                    type={type}
                    value={value}
                    onChange={handleInputChange}
                    onFocus={() => setIsOpen(true)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    required={required}
                    disabled={disabled}
                    autoComplete="off"
                    className={`w-full px-4 py-2.5 bg-white dark:bg-slate-800 text-gray-900 dark:text-white border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-gray-400 disabled:bg-gray-100 disabled:dark:bg-slate-700/50 ${
                        icon ? 'pl-10' : ''
                    } ${normalizedSuggestions.length > 0 ? 'pr-8' : ''} ${inputClassName}`}
                />
                {normalizedSuggestions.length > 0 && (
                    <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setIsOpen(!isOpen)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1"
                    >
                        <ChevronDown size={15} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                )}
            </div>

            {/* Dropdown Suggestions */}
            {isOpen && filteredSuggestions.length > 0 && (
                <div className="absolute z-50 left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-xl py-1 text-sm animate-in fade-in-50 duration-150">
                    <div className="px-3 py-1 text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider flex items-center gap-1 border-b border-gray-100 dark:border-slate-700/60 mb-1">
                        <Sparkles size={11} className="text-amber-500" /> Suggestions
                    </div>
                    {filteredSuggestions.map((item, index) => (
                        <div
                            key={`${item.value}-${index}`}
                            onMouseDown={(e) => {
                                e.preventDefault(); // Prevents input blur before click triggers
                                handleSelectOption(item);
                            }}
                            onMouseEnter={() => setHighlightedIndex(index)}
                            className={`px-3.5 py-2 cursor-pointer transition-colors flex items-center justify-between gap-2 ${
                                index === highlightedIndex
                                    ? 'bg-indigo-50 dark:bg-slate-700/80 text-indigo-900 dark:text-indigo-200'
                                    : 'text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700/50'
                            }`}
                        >
                            <div className="min-w-0 flex-1">
                                <div className="font-medium truncate">{item.label}</div>
                                {item.sublabel && (
                                    <div className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">
                                        {item.sublabel}
                                    </div>
                                )}
                            </div>
                            {item.badge && (
                                <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-slate-600">
                                    {item.badge}
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

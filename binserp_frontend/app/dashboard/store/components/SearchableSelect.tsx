import React, { useState, useEffect, useRef } from 'react';

const SearchableSelect = ({ options, value, onChange, placeholder, className = "w-full", innerClassName = "", dropdownPosition = "bottom" }: any) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const selectedOption = options.find((o: any) => o.value === value);
    const filteredOptions = (options || []).filter((o: any) => (o.label || '').toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div ref={wrapperRef} className={`relative ${className}`}>
            <div 
                className={`${innerClassName ? innerClassName : 'w-full px-2 py-1.5 text-xs bg-white border rounded outline-none cursor-pointer'} flex justify-between items-center ${!selectedOption && !value ? 'border-red-300' : (innerClassName ? '' : 'border-gray-200')}`}
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className={`truncate ${!selectedOption ? 'text-gray-500' : 'text-gray-800'}`}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <span className="text-gray-400 text-[10px]">▼</span>
            </div>
            {isOpen && (
                <div className={`absolute z-50 w-full ${dropdownPosition === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'} bg-white border border-gray-200 rounded shadow-lg max-h-48 overflow-y-auto custom-scrollbar`}>
                    <div className="sticky top-0 bg-white p-1.5 border-b border-gray-100">
                        <input
                            type="text"
                            className="w-full px-2 py-1 text-xs border border-gray-200 rounded outline-none focus:border-indigo-400"
                            placeholder="Search..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            onClick={e => e.stopPropagation()}
                            onKeyDown={e => {
                                if (e.key === 'Enter') {
                                    e.preventDefault(); // Prevent form submission
                                    if (filteredOptions.length > 0) {
                                        onChange(filteredOptions[0].value);
                                        setIsOpen(false);
                                        setSearchTerm("");
                                    }
                                }
                            }}
                            autoFocus
                        />
                    </div>
                    {filteredOptions.length > 0 ? filteredOptions.map((o: any) => (
                        <div
                            key={o.value}
                            className={`px-2 py-1.5 text-xs cursor-pointer hover:bg-indigo-50 truncate ${value === o.value ? 'bg-indigo-100 text-indigo-700' : ''}`}
                            onMouseDown={(e) => {
                                e.preventDefault(); // Prevent input from losing focus
                                onChange(o.value);
                                setIsOpen(false);
                                setSearchTerm("");
                            }}
                        >
                            {o.label}
                        </div>
                    )) : (
                        <div className="px-2 py-1.5 text-xs text-gray-500 text-center">No results</div>
                    )}
                </div>
            )}
        </div>
    );
};

export default SearchableSelect;

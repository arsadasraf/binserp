/**
 * SearchBar Component
 * 
 * Provides a search input field with an icon for filtering data across all tabs.
 * The search functionality is handled by the parent component through the searchTerm state.
 * 
 * @param searchTerm - Current search term value
 * @param setSearchTerm - Function to update the search term
 */

import React from 'react';
import { Search } from 'lucide-react';

interface SearchBarProps {
    searchTerm: string;
    setSearchTerm: (term: string) => void;
}

export default function SearchBar({ searchTerm, setSearchTerm }: SearchBarProps) {
    return (
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
            {/* Search input container with icon */}
            <div className="flex-1 relative">
                {/* Search icon positioned absolutely on the left */}
                <Search className="absolute left-3 top-3 text-gray-400" size={20} />

                {/* Search input field with left padding to accommodate icon */}
                <input
                    type="text"
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
            </div>
        </div>
    );
}

/**
 * ItemsList Component
 * 
 * Manages the dynamic list of items for transactions (GRN, DC, PO, Billing).
 * Allows users to add, edit, and remove items with fields for material name, quantity, unit, and optionally rate.
 * 
 * @param items - Array of items in the transaction
 * @param activeTab - Current active tab to determine which fields to show
 * @param updateItem - Function to update a specific item field
 * @param removeItem - Function to remove an item from the list
 * @param addItem - Function to add a new item to the list
 */

import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Item, TabType } from '../../types/store.types';

interface ItemsListProps {
    items: Item[];
    activeTab: TabType;
    updateItem: (idx: number, field: string, value: any) => void;
    removeItem: (idx: number) => void;
    addItem: () => void;
}

export default function ItemsList({ items, activeTab, updateItem, removeItem, addItem }: ItemsListProps) {
    return (
        <div className="mt-6 pt-6 border-t">
            {/* Section header with add button */}
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg text-gray-900">Items</h3>
                <button
                    type="button"
                    onClick={addItem}
                    className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-medium"
                >
                    <Plus size={16} /> Add Item
                </button>
            </div>

            {/* List of items */}
            {items?.map((item: Item, idx: number) => (
                <div key={idx} className="flex flex-col sm:flex-row gap-2 mb-2 bg-gray-50 p-3 rounded-lg">
                    {/* Material name input */}
                    <input
                        type="text"
                        placeholder="Material Name *"
                        required
                        value={item.materialName || ""}
                        onChange={(e) => updateItem(idx, "materialName", e.target.value)}
                        className="input-field flex-1"
                    />

                    {/* Quantity input */}
                    <input
                        type="number"
                        placeholder="Qty *"
                        required
                        value={item.quantity || ""}
                        onChange={(e) => updateItem(idx, "quantity", e.target.value)}
                        className="input-field w-full sm:w-24"
                    />

                    {/* Unit input */}
                    <input
                        type="text"
                        placeholder="Unit"
                        value={item.unit || "PCS"}
                        onChange={(e) => updateItem(idx, "unit", e.target.value)}
                        className="input-field w-full sm:w-20"
                    />

                    {/* Rate input - only for PO and Billing */}
                    {(activeTab === "po" || activeTab === "billing") && (
                        <input
                            type="number"
                            placeholder="Rate"
                            value={item.rate || ""}
                            onChange={(e) => updateItem(idx, "rate", e.target.value)}
                            className="input-field w-full sm:w-24"
                        />
                    )}

                    {/* Remove item button */}
                    <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            ))}
        </div>
    );
}

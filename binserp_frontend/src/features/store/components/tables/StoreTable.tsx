/**
 * StoreTable Component
 * 
 * Main table wrapper that conditionally renders the appropriate table based on the active tab.
 * Handles loading states and empty data states.
 * Integrates InventoryTable, MastersTable, and TransactionsTable components.
 * 
 * @param activeTab - Current active main tab
 * @param masterTab - Current active master tab (if in masters section)
 * @param data - Array of data items to display
 * @param loading - Loading state
 * @param onEdit - Function to handle edit action
 * @param onDelete - Function to handle delete action
 */

import React from 'react';
import { Database } from 'lucide-react';
import LoadingSpinner from '@/src/components/LoadingSpinner';
import { TabType, MasterType } from '../../types/store.types';
import InventoryTable from './InventoryTable';
import MastersTable from './MastersTable';
import TransactionsTable from './TransactionsTable';

interface StoreTableProps {
    activeTab: TabType;
    masterTab: MasterType;
    data: any[];
    loading: boolean;
    onEdit: (item: any) => void;
    onDelete: (id: string) => void;
    inHouseData?: any[];
    activeSubTab?: 'bo' | 'inhouse';
    onSubTabChange?: (tab: 'bo' | 'inhouse') => void;
}

export default function StoreTable({
    activeTab,
    masterTab,
    data,
    loading,
    onEdit,
    onDelete,
    inHouseData = [],
    activeSubTab = 'bo',
    onSubTabChange = () => { }
}: StoreTableProps) {
    // Show loading spinner while data is being fetched
    if (loading) return <LoadingSpinner />;

    // Show empty state if no data is available (Standard check for active tab data)
    // Note: Inventory tab now has sub-tabs, so we might want to defer empty check to inside InventoryTable
    // But for now, if 'data' is empty (which is BO inventory), we might still show empty. 
    // However, if we are on 'Inventory' (home), we should let InventoryTable handle empty state per sub-tab.
    // Let's modify the empty check to be smarter.

    const isEmpty = data.length === 0 && (activeTab !== "home" || (activeSubTab === 'bo' && inHouseData.length === 0));

    if (isEmpty && activeTab !== "home") { // Only show global empty state if not on home (inventory) tab, as inventory has sub-tabs 
        return (
            <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
                <Database className="text-gray-400 mx-auto mb-4" size={48} />
                <h3 className="text-lg font-medium text-gray-900">No records found</h3>
                <p className="text-gray-500 mt-1">Create a new record to get started</p>
            </div>
        );
    }

    // Render table with data
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {activeTab === "home" && (masterTab === "grn-history" || masterTab === "fg-grn-history") && (
                <MastersTable data={data} masterTab={masterTab} onEdit={onEdit} onDelete={onDelete} />
            )}

            {activeTab === "home" && masterTab !== "grn-history" && masterTab !== "fg-grn-history" && (
                <InventoryTable
                    data={data}
                    inHouseData={inHouseData}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    activeSubTab={activeSubTab}
                    onSubTabChange={onSubTabChange}
                />
            )}

            {activeTab === "masters" && (
                <MastersTable data={data} masterTab={masterTab} onEdit={onEdit} onDelete={onDelete} />
            )}

            {/* All transaction tabs use the same TransactionsTable component */}
            {!["home", "masters"].includes(activeTab) && (
                <TransactionsTable data={data} onEdit={onEdit} onDelete={onDelete} />
            )}
        </div>
    );
}

"use client";

import React from 'react';
import InventoryTable from './InventoryTable';
import { InventoryItem } from '../../types/store.types';

interface SharedInventoryViewProps {
    data: InventoryItem[];
    inHouseData?: any[];
    onEdit: (item: InventoryItem) => void;
    onDelete: (id: string) => void;
    activeSubTab: 'bo' | 'inhouse';
    onSubTabChange: (tab: 'bo' | 'inhouse') => void;
}

import ItemDetailsModal from '../modals/ItemDetailsModal'; // Import Modal

interface SharedInventoryViewProps {
    data: InventoryItem[];
    inHouseData?: any[];
    onEdit: (item: InventoryItem) => void;
    onDelete: (id: string) => void;
    activeSubTab: 'bo' | 'inhouse';
    onSubTabChange: (tab: 'bo' | 'inhouse') => void;
}

export default function SharedInventoryView({
    data,
    inHouseData = [],
    onEdit,
    onDelete,
    activeSubTab,
    onSubTabChange
}: SharedInventoryViewProps) {
    const [selectedItem, setSelectedItem] = React.useState<any | null>(null);
    const [showDetails, setShowDetails] = React.useState(false);

    return (
        <>
            <InventoryTable
                data={data}
                inHouseData={inHouseData}
                onEdit={onEdit}
                onDelete={onDelete}
                activeSubTab={activeSubTab}
                onSubTabChange={onSubTabChange}
                onItemClick={(item) => {
                    setSelectedItem(item);
                    setShowDetails(true);
                }}
            />

            <ItemDetailsModal
                isOpen={showDetails}
                onClose={() => {
                    setShowDetails(false);
                    setSelectedItem(null);
                }}
                item={selectedItem}
                type={activeSubTab}
            />
        </>
    );
}

import React, { useState, useEffect, useMemo } from 'react';
import { Package, Factory, History, FileText, Layers } from 'lucide-react';
import InventoryTable from '../tables/InventoryTable';
import StockTransactionLedgerTable from '../tables/StockTransactionLedgerTable';
import GRNModal from '../modals/GRNModal';
import ItemDetailsModal from '../modals/ItemDetailsModal';
import MastersTable from '../tables/MastersTable'; // For GRN History
import Swal from 'sweetalert2';

interface InventoryTabProps {
    storeData: any;
    token: string | null;
    masterTab?: string;
    setMasterTab?: (tab: any) => void;
    activeSubTab: 'bo' | 'consumable' | 'inhouse' | 'history' | 'fg-history' | 'ledger';
}


export default function InventoryTab({ storeData, token, masterTab, setMasterTab, activeSubTab }: InventoryTabProps) {

    // Modals
    const [showGRNModal, setShowGRNModal] = useState(false);
    const [editingGRN, setEditingGRN] = useState<any>(undefined);
    const [showInhouseForm, setShowInhouseForm] = useState(false);

    // Item Details
    const [selectedItem, setSelectedItem] = useState<any | null>(null);
    const [showDetails, setShowDetails] = useState(false);


    const {
        data,
        inHouseComponents,
        pendingProducts,
        loading,
        handleGRNSubmit,
        handleGRNUpdate,
        handleDelete,
        handleEdit, // For masters/GRN history
        vendors,
        locations,
        categories,
        materials,
        consumables,
        customers,
        refetch,
    } = storeData;

    // Effect to sync activeSubTab with masterTab (for History data fetch)
    useEffect(() => {
        if (setMasterTab) {
            if (activeSubTab === 'history') {
                setMasterTab('grn-history');
            } else if (activeSubTab === 'fg-history') {
                setMasterTab('fg-grn-history');
            } else {
                if (masterTab === 'grn-history' || masterTab === 'fg-grn-history') {
                    setMasterTab('vendor');
                }
            }
        }
    }, [activeSubTab, setMasterTab, masterTab]);

    // Map RM/BO master data to inventory format so it always shows the master list
    const mappedBoInventory = useMemo(() => {
        if (!materials) return [];
        return materials.map((m: any) => {
            // Find inventory matching this material
            const invItem = data?.find((d: any) => {
                return d.materialId === m._id || d.materialId?._id === m._id || d.materialCode === m.code;
            });
            return {
                ...m,
                _id: invItem?._id || m._id, // Prefer inventory ID for updates, fallback to material ID
                materialId: m,
                materialName: m.name,
                materialCode: m.code || 'N/A',
                description: m.descriptions || m.description || invItem?.description || '-',
                descriptions: m.descriptions || m.description || invItem?.description || '-',
                currentStock: invItem ? invItem.currentStock : 0,
                qcPendingStock: invItem ? invItem.qcPendingStock : 0,
                reorderLevel: m.minimumStock || invItem?.reorderLevel || 0,
                unit: m.unit || (m.categoryId as any)?.unit || invItem?.unit || '',
                category: m.categoryId, 
                location: m.locationId, 
                monthlyData: invItem?.monthlyData || {
                    openingStock: 0,
                    received: 0,
                    issued: 0,
                    closingStock: 0
                }
            };
        });
    }, [materials, data]);

    // Map Consumable master data to inventory format
    const mappedConsumableInventory = useMemo(() => {
        if (!consumables) return [];
        return consumables.map((c: any) => {
            const invItem = data?.find((d: any) => {
                return d.materialId === c._id || d.materialId?._id === c._id || d.materialCode === c.code || d.materialName === c.name;
            });
            return {
                ...c,
                _id: invItem?._id || c._id,
                materialId: c,
                materialName: c.name,
                materialCode: c.code || 'N/A',
                description: c.descriptions || c.description || invItem?.description || '-',
                descriptions: c.descriptions || c.description || invItem?.description || '-',
                currentStock: invItem ? invItem.currentStock : 0,
                qcPendingStock: invItem ? invItem.qcPendingStock : 0,
                reorderLevel: c.minimumStock || invItem?.reorderLevel || 0,
                unit: c.unit || (c.categoryId as any)?.unit || invItem?.unit || 'PCS',
                category: c.categoryId,
                location: c.locationId,
                monthlyData: invItem?.monthlyData || {
                    openingStock: 0,
                    received: 0,
                    issued: 0,
                    closingStock: 0
                }
            };
        });
    }, [consumables, data]);


    // Helper to handle GRN Submit
    const onGRNSubmit = async (grnData: any) => {
        try {
            const payload = grnData instanceof FormData
                ? grnData
                : { ...grnData, type: activeSubTab === 'inhouse' ? 'inhouse' : 'bo' };

            if (payload instanceof FormData) {
                payload.set('type', activeSubTab === 'inhouse' ? 'inhouse' : 'bo');
            }

            if (editingGRN && editingGRN._id) {
                await handleGRNUpdate(editingGRN._id, payload);
            } else {
                await handleGRNSubmit(payload);
            }
            setShowGRNModal(false);
            setEditingGRN(undefined);
            refetch();
            Swal.fire('Success', 'GRN submitted successfully!', 'success');
        } catch (err: any) {
            console.error(err);
            Swal.fire('Error', 'Failed to submit GRN: ' + (err.message || "Unknown error"), 'error');
        }
    };

    const handleMasterEdit = (item: any) => {
        // If in history mode, it's GRN edit
        if (activeSubTab === 'history') {
            const grnData = {
                _id: item._id,
                grnNumber: item.grnNumber,
                date: item.date,
                material: item.items?.[0]?.material?._id || item.items?.[0]?.material || '',
                materialName: item.items?.[0]?.materialName,
                quantity: item.items?.[0]?.quantity,
                unit: item.items?.[0]?.unit,
                supplier: item.supplier?._id || item.supplier || '',
                locationId: '',
                category: item.items?.[0]?.material?.category?.name || '',
            };
            setEditingGRN(grnData);
            setShowGRNModal(true);
        } else {
            handleEdit(item);
        }
    };

    return (
        <div className="">
            {/* Content Container */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm min-h-[400px] overflow-hidden p-1">
                {activeSubTab === 'ledger' ? (
                    <div className="p-3">
                        <StockTransactionLedgerTable token={token} />
                    </div>
                ) : activeSubTab === 'history' || activeSubTab === 'fg-history' ? (
                    <MastersTable
                        data={data}
                        masterTab={activeSubTab === 'history' ? "grn-history" : "fg-grn-history"}
                        onEdit={handleMasterEdit}
                        onDelete={handleDelete}
                    />
                ) : (
                    <InventoryTable
                        data={activeSubTab === 'consumable' ? mappedConsumableInventory : activeSubTab === 'bo' ? mappedBoInventory : []}
                        inHouseData={activeSubTab === 'inhouse' ? inHouseComponents : []}
                        onEdit={handleMasterEdit}
                        onDelete={handleDelete}
                        activeSubTab={activeSubTab === 'inhouse' ? 'inhouse' : activeSubTab === 'consumable' ? 'consumable' : 'bo'}
                        onSubTabChange={() => {}}
                        hideTabs={true}
                        onItemClick={(item) => {
                            setSelectedItem(item);
                            setShowDetails(true);
                        }}
                        refetch={refetch}
                        onCreateGRN={() => {
                            setEditingGRN(undefined);
                            setShowGRNModal(true);
                        }}
                    />
                )}
            </div>


            {/* Modals */}
            <GRNModal
                isOpen={showGRNModal}
                onClose={() => {
                    setShowGRNModal(false);
                    setEditingGRN(undefined);
                }}
                onSubmit={onGRNSubmit}
                materials={activeSubTab === 'inhouse' ? inHouseComponents : (activeSubTab === 'consumable' ? consumables : materials)}
                vendors={vendors}
                locations={locations}
                categories={categories}
                loading={loading}
                initialData={editingGRN}
                isEditing={!!editingGRN}
                type={activeSubTab === 'inhouse' ? 'inhouse' : 'bo'}
                customers={customers}
            />

            <ItemDetailsModal
                isOpen={showDetails}
                onClose={() => {
                    setShowDetails(false);
                    setSelectedItem(null);
                }}
                item={selectedItem}
                type={activeSubTab === 'inhouse' ? 'inhouse' : 'bo'}
            />
        </div>
    );
}

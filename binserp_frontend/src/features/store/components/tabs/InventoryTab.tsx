import React, { useState, useEffect, useMemo } from 'react';
import { Package, Factory, History, FileText, Layers } from 'lucide-react';
import InventoryTable from '../tables/InventoryTable';
import StockTransactionLedgerTable from '../tables/StockTransactionLedgerTable';
import GRNModal from '../modals/GRNModal';
import ItemDetailsModal from '../modals/ItemDetailsModal';
import MastersTable from '../tables/MastersTable'; // For GRN History
import UnifiedGrnHistoryTable from '../tables/UnifiedGrnHistoryTable';
import Swal from 'sweetalert2';

interface InventoryTabProps {
    storeData: any;
    token: string | null;
    masterTab?: string;
    setMasterTab?: (tab: any) => void;
    activeSubTab: 'rm' | 'bo' | 'consumable' | 'inhouse' | 'history' | 'fg-history' | 'ledger';
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
        materials = [],
        rawMaterials = [],
        boughtOuts = [],
        consumables = [],
        customers,
        inventoryList = [],
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

    // Combined inventory lookup list
    const combinedInventoryList = useMemo(() => {
        const inv = Array.isArray(data) ? [...data] : [];
        if (Array.isArray(inventoryList)) {
            inventoryList.forEach(item => {
                if (item && !inv.some(d => d._id === item._id || (d.materialId && item.materialId && String(d.materialId) === String(item.materialId)))) {
                    inv.push(item);
                }
            });
        }
        return inv;
    }, [data, inventoryList]);

    // Filtered master raw materials list (combines rawMaterials + materials)
    const effectiveRmList = useMemo(() => {
        const list: any[] = [];
        const seenIds = new Set<string>();

        if (Array.isArray(rawMaterials) && rawMaterials.length > 0) {
            rawMaterials.forEach((m: any) => {
                if (m && m._id && !seenIds.has(String(m._id))) {
                    seenIds.add(String(m._id));
                    list.push(m);
                }
            });
        }

        if (Array.isArray(materials) && materials.length > 0) {
            materials
                .filter((m: any) => {
                    const type = (m.itemType || '').toString().trim().toLowerCase();
                    return type !== 'bought out' && type !== 'bo';
                })
                .forEach((m: any) => {
                    if (m && m._id && !seenIds.has(String(m._id))) {
                        seenIds.add(String(m._id));
                        list.push(m);
                    }
                });
        }

        return list;
    }, [rawMaterials, materials]);

    // Filtered master bought-out list (combines boughtOuts + materials)
    const effectiveBoList = useMemo(() => {
        const list: any[] = [];
        const seenIds = new Set<string>();

        if (Array.isArray(boughtOuts) && boughtOuts.length > 0) {
            boughtOuts.forEach((m: any) => {
                if (m && m._id && !seenIds.has(String(m._id))) {
                    seenIds.add(String(m._id));
                    list.push(m);
                }
            });
        }

        if (Array.isArray(materials) && materials.length > 0) {
            materials
                .filter((m: any) => {
                    const type = (m.itemType || '').toString().trim().toLowerCase();
                    return type === 'bought out' || type === 'bo';
                })
                .forEach((m: any) => {
                    if (m && m._id && !seenIds.has(String(m._id))) {
                        seenIds.add(String(m._id));
                        list.push(m);
                    }
                });
        }

        return list;
    }, [boughtOuts, materials]);

    // Fast O(1) Lookup Maps for combinedInventoryList
    const inventoryLookups = useMemo(() => {
        const byId = new Map<string, any>();
        const byCode = new Map<string, any>();
        const byName = new Map<string, any>();

        combinedInventoryList.forEach((d: any) => {
            if (!d) return;
            const dId = String(d._id);
            byId.set(dId, d);
            
            const dMatId = typeof d.materialId === 'object' && d.materialId ? d.materialId._id : d.materialId;
            if (dMatId) {
                byId.set(String(dMatId), d);
            }

            if (d.materialCode) {
                byCode.set(String(d.materialCode).toUpperCase().trim(), d);
            }
            if (d.materialName) {
                byName.set(String(d.materialName).toLowerCase().trim(), d);
            }
        });

        return {
            findItem: (item: any) => {
                if (!item) return undefined;
                const id = String(item._id);
                if (byId.has(id)) return byId.get(id);

                if (item.code) {
                    const codeMatch = byCode.get(String(item.code).toUpperCase().trim());
                    if (codeMatch) return codeMatch;
                }

                if (item.name) {
                    const nameMatch = byName.get(String(item.name).toLowerCase().trim());
                    if (nameMatch) return nameMatch;
                }

                return undefined;
            }
        };
    }, [combinedInventoryList]);

    // Map RM master data to inventory format (O(N) with Map lookup)
    const mappedRmInventory = useMemo(() => {
        if (!effectiveRmList || effectiveRmList.length === 0) return [];
        return effectiveRmList.map((m: any) => {
            const invItem = inventoryLookups.findItem(m);

            return {
                ...m,
                _id: invItem?._id || m._id,
                materialId: m,
                materialName: m.name,
                materialCode: m.code || 'N/A',
                itemType: 'Raw Material',
                description: m.descriptions || m.description || invItem?.description || '-',
                descriptions: m.descriptions || m.description || invItem?.description || '-',
                currentStock: invItem ? (invItem.currentStock !== undefined ? invItem.currentStock : (invItem.quantity || 0)) : (m.quantity !== undefined ? m.quantity : (m.currentStock || 0)),
                qcPendingStock: invItem ? invItem.qcPendingStock || 0 : 0,
                reorderLevel: m.minimumStock !== undefined ? m.minimumStock : (invItem?.reorderLevel || 0),
                unit: m.unit || (m.categoryId as any)?.unit || invItem?.unit || 'PCS',
                category: m.categoryId, 
                location: m.locationId, 
                monthlyData: invItem?.monthlyData ? {
                    openingStock: invItem.monthlyData.openingStock || 0,
                    totalInwardQuantity: invItem.monthlyData.totalInwardQuantity || invItem.monthlyData.received || 0,
                    totalOutwardQuantity: invItem.monthlyData.totalOutwardQuantity || invItem.monthlyData.issued || 0,
                    received: invItem.monthlyData.received || invItem.monthlyData.totalInwardQuantity || 0,
                    issued: invItem.monthlyData.issued || invItem.monthlyData.totalOutwardQuantity || 0,
                    closingStock: invItem.monthlyData.closingStock || invItem.currentStock || 0
                } : {
                    openingStock: 0,
                    totalInwardQuantity: 0,
                    totalOutwardQuantity: 0,
                    received: 0,
                    issued: 0,
                    closingStock: 0
                }
            };
        });
    }, [effectiveRmList, inventoryLookups]);

    // Map BO master data to inventory format (O(N) with Map lookup)
    const mappedBoInventory = useMemo(() => {
        if (!effectiveBoList || effectiveBoList.length === 0) return [];
        return effectiveBoList.map((m: any) => {
            const invItem = inventoryLookups.findItem(m);

            return {
                ...m,
                _id: invItem?._id || m._id,
                materialId: m,
                materialName: m.name,
                materialCode: m.code || 'N/A',
                itemType: 'Bought Out',
                description: m.descriptions || m.description || invItem?.description || '-',
                descriptions: m.descriptions || m.description || invItem?.description || '-',
                currentStock: invItem ? (invItem.currentStock !== undefined ? invItem.currentStock : (invItem.quantity || 0)) : (m.quantity !== undefined ? m.quantity : (m.currentStock || 0)),
                qcPendingStock: invItem ? invItem.qcPendingStock || 0 : 0,
                reorderLevel: m.minimumStock !== undefined ? m.minimumStock : (invItem?.reorderLevel || 0),
                unit: m.unit || (m.categoryId as any)?.unit || invItem?.unit || 'PCS',
                category: m.categoryId, 
                location: m.locationId, 
                monthlyData: invItem?.monthlyData ? {
                    openingStock: invItem.monthlyData.openingStock || 0,
                    totalInwardQuantity: invItem.monthlyData.totalInwardQuantity || invItem.monthlyData.received || 0,
                    totalOutwardQuantity: invItem.monthlyData.totalOutwardQuantity || invItem.monthlyData.issued || 0,
                    received: invItem.monthlyData.received || invItem.monthlyData.totalInwardQuantity || 0,
                    issued: invItem.monthlyData.issued || invItem.monthlyData.totalOutwardQuantity || 0,
                    closingStock: invItem.monthlyData.closingStock || invItem.currentStock || 0
                } : {
                    openingStock: 0,
                    totalInwardQuantity: 0,
                    totalOutwardQuantity: 0,
                    received: 0,
                    issued: 0,
                    closingStock: 0
                }
            };
        });
    }, [effectiveBoList, inventoryLookups]);

    // Map Consumable master data to inventory format (O(N) with Map lookup)
    const mappedConsumableInventory = useMemo(() => {
        if (!consumables || consumables.length === 0) return [];
        return consumables.map((c: any) => {
            const invItem = inventoryLookups.findItem(c);

            const currentStock = invItem 
                ? (invItem.currentStock !== undefined ? invItem.currentStock : (invItem.quantity || 0)) 
                : (c.currentStock !== undefined ? c.currentStock : (c.quantity || 0));

            const qcPending = invItem?.qcPendingStock || 0;

            return {
                ...c,
                _id: invItem?._id || c._id,
                materialId: c,
                materialName: c.name,
                materialCode: c.code || invItem?.materialCode || 'N/A',
                itemType: 'Consumable',
                description: c.descriptions || c.description || invItem?.description || '-',
                descriptions: c.descriptions || c.description || invItem?.description || '-',
                currentStock,
                qcPendingStock: qcPending,
                reorderLevel: c.minimumStock !== undefined ? c.minimumStock : (invItem?.reorderLevel || 0),
                unit: c.unit || (c.categoryId as any)?.unit || invItem?.unit || 'PCS',
                category: c.categoryId,
                location: c.locationId,
                monthlyData: invItem?.monthlyData ? {
                    openingStock: invItem.monthlyData.openingStock || 0,
                    totalInwardQuantity: invItem.monthlyData.totalInwardQuantity || invItem.monthlyData.received || 0,
                    totalOutwardQuantity: invItem.monthlyData.totalOutwardQuantity || invItem.monthlyData.issued || 0,
                    received: invItem.monthlyData.received || invItem.monthlyData.totalInwardQuantity || 0,
                    issued: invItem.monthlyData.issued || invItem.monthlyData.totalOutwardQuantity || 0,
                    closingStock: invItem.monthlyData.closingStock || currentStock || 0
                } : {
                    openingStock: 0,
                    totalInwardQuantity: 0,
                    totalOutwardQuantity: 0,
                    received: 0,
                    issued: 0,
                    closingStock: currentStock || 0
                }
            };
        });
    }, [consumables, inventoryLookups]);

    // Active materials for GRN modal
    const activeGrnMaterials = useMemo(() => {
        if (activeSubTab === 'rm') return effectiveRmList;
        if (activeSubTab === 'bo') return effectiveBoList;
        if (activeSubTab === 'consumable') return consumables || [];
        if (activeSubTab === 'inhouse' || activeSubTab === 'fg-history') return inHouseComponents || [];
        return effectiveRmList || [];
    }, [activeSubTab, effectiveRmList, effectiveBoList, consumables, inHouseComponents]);

    const activeGrnType = activeSubTab === 'inhouse' || activeSubTab === 'fg-history' 
        ? 'inhouse' 
        : (activeSubTab === 'consumable' ? 'consumable' : (activeSubTab === 'rm' ? 'rm' : 'bo'));

    // Helper to handle GRN Submit
    const onGRNSubmit = async (grnData: any) => {
        try {
            let payload = grnData;
            if (!(payload instanceof FormData)) {
                payload = { ...grnData, type: grnData.type || activeGrnType };
            } else if (!payload.get('type')) {
                payload.set('type', activeGrnType);
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
            console.error("GRN Submit Error:", err);
            const errorMessage = 
                err?.data?.message || 
                err?.data?.error || 
                err?.error || 
                err?.message || 
                (typeof err === 'string' ? err : "Failed to submit GRN");
            Swal.fire('Error', errorMessage, 'error');
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
        <div className="h-full flex flex-col">
            {/* Content Container */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm h-full flex flex-col overflow-hidden p-1">
                {activeSubTab === 'ledger' ? (
                    <div className="p-3">
                        <StockTransactionLedgerTable token={token} />
                    </div>
                ) : activeSubTab === 'history' || activeSubTab === 'fg-history' ? (
                    <div className="p-3">
                        <UnifiedGrnHistoryTable
                            onEdit={handleMasterEdit}
                            onDelete={handleDelete}
                            initialTypeFilter={activeSubTab === 'fg-history' ? 'FG' : 'all'}
                        />
                    </div>
                ) : (
                    <InventoryTable
                        data={activeSubTab === 'consumable' ? mappedConsumableInventory : activeSubTab === 'rm' ? mappedRmInventory : activeSubTab === 'bo' ? mappedBoInventory : []}
                        inHouseData={activeSubTab === 'inhouse' ? inHouseComponents : []}
                        onEdit={handleMasterEdit}
                        onDelete={handleDelete}
                        activeSubTab={activeSubTab === 'inhouse' ? 'inhouse' : activeSubTab === 'consumable' ? 'consumable' : (activeSubTab === 'rm' ? 'rm' : 'bo')}
                        onSubTabChange={() => {}}
                        hideTabs={true}
                        onItemClick={(item) => {
                            setSelectedItem(item);
                            setShowDetails(true);
                        }}
                        refetch={storeData.fetchData || refetch}
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
                materials={activeGrnMaterials}
                vendors={vendors}
                locations={locations}
                categories={categories}
                loading={loading}
                initialData={editingGRN}
                isEditing={!!editingGRN}
                type={activeGrnType}
                customers={customers}
            />

            <ItemDetailsModal
                isOpen={showDetails}
                onClose={() => {
                    setShowDetails(false);
                    setSelectedItem(null);
                }}
                item={selectedItem}
                type={activeSubTab === 'inhouse' ? 'inhouse' : activeSubTab === 'consumable' ? 'consumable' : (activeSubTab === 'rm' ? 'rm' : 'bo')}
            />
        </div>
    );
}

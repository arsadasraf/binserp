import React, { useState, useEffect } from 'react'; // Added useEffect
import { Package, Factory, History, FileText } from 'lucide-react';
import InventoryTable from '../tables/InventoryTable';
import GRNModal from '../modals/GRNModal';
import ItemDetailsModal from '../modals/ItemDetailsModal';
import MastersTable from '../tables/MastersTable'; // For GRN History

interface InventoryTabProps {
    storeData: any;
    token: string | null;
    masterTab?: string;
    setMasterTab?: (tab: any) => void;
}

export default function InventoryTab({ storeData, token, masterTab, setMasterTab }: InventoryTabProps) {
    // Local state for sub-tabs and modals
    const [subTab, setSubTab] = useState<'bo' | 'inhouse' | 'history' | 'fg-history'>('bo');

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
        customers,
        refetch,
    } = storeData;

    // Effect to sync subTab with masterTab (for History data fetch)
    useEffect(() => {
        if (setMasterTab) {
            if (subTab === 'history') {
                setMasterTab('grn-history');
            } else if (subTab === 'fg-history') {
                setMasterTab('fg-grn-history');
            } else {
                if (masterTab === 'grn-history' || masterTab === 'fg-grn-history') {
                    setMasterTab('vendor');
                }
            }
        }
    }, [subTab, setMasterTab, masterTab]);


    // Helper to handle GRN Submit
    const onGRNSubmit = async (grnData: any) => {
        try {
            const payload = grnData instanceof FormData
                ? grnData
                : { ...grnData, type: subTab === 'inhouse' ? 'inhouse' : 'bo' };

            if (payload instanceof FormData) {
                payload.set('type', subTab === 'inhouse' ? 'inhouse' : 'bo');
            }

            if (editingGRN && editingGRN._id) {
                await handleGRNUpdate(editingGRN._id, payload);
            } else {
                await handleGRNSubmit(payload);
            }
            setShowGRNModal(false);
            setEditingGRN(undefined);
            refetch();
        } catch (err) {
            console.error(err);
        }
    };

    const handleMasterEdit = (item: any) => {
        // If in history mode, it's GRN edit
        if (subTab === 'history') {
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
            {/* Header / Sub-tabs & Actions */}
            <div className="flex flex-col max-w-full sm:flex-row justify-between items-start  sm:items-center gap-4">

                {/* Switcher */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-1 bg-gray-100/80 p-1.5  rounded-xl backdrop-blur-sm self-start  sm:self-auto">
                    <button
                        onClick={() => setSubTab('bo')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${subTab === 'bo'
                            ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5'
                            : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'
                            }`}
                    >
                        <Package size={16} />
                        RM/BO Inventory
                    </button>
                    <button
                        onClick={() => setSubTab('inhouse')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${subTab === 'inhouse'
                            ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5'
                            : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'
                            }`}
                    >
                        <Factory size={16} />
                        FG Invenotry
                    </button>
                    <button
                        onClick={() => setSubTab('history')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${subTab === 'history'
                            ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5'
                            : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'
                            }`}
                    >
                        <History size={16} />
                        BO GRN History
                    </button>
                    <button
                        onClick={() => setSubTab('fg-history')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${subTab === 'fg-history'
                            ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5'
                            : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'
                            }`}
                    >
                        <History size={16} />
                        FG GRN History
                    </button>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                    {subTab === 'bo' && (
                        <>
                            <button
                                onClick={() => {
                                    setEditingGRN(undefined);
                                    setShowGRNModal(true);
                                }}
                                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-xl hover:shadow-lg hover:shadow-indigo-200 transition-all font-medium text-sm active:scale-95"
                            >
                                <Package size={18} />
                                Create GRN
                            </button>
                        </>
                    )}
                    {subTab === 'inhouse' && (
                        <>

                            <button
                                onClick={() => {
                                    setEditingGRN(undefined);
                                    setShowGRNModal(true);
                                }}
                                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl hover:shadow-lg hover:shadow-violet-200 transition-all font-medium text-sm active:scale-95"
                            >
                                <Factory size={18} />
                                Create FG Items GRN
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Content Container */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm min-h-[400px] overflow-hidden p-1">
                {subTab === 'history' || subTab === 'fg-history' ? (
                    <MastersTable
                        data={data}
                        masterTab={subTab === 'history' ? "grn-history" : "fg-grn-history"}
                        onEdit={handleMasterEdit}
                        onDelete={handleDelete}
                    />
                ) : (
                    <InventoryTable
                        data={subTab === 'bo' ? data : []}
                        inHouseData={subTab === 'inhouse' ? inHouseComponents : []}
                        onEdit={handleMasterEdit}
                        onDelete={handleDelete}
                        activeSubTab={subTab === 'inhouse' ? 'inhouse' : 'bo'}
                        onSubTabChange={(t) => setSubTab(t)}
                        hideTabs={true}
                        onItemClick={(item) => {
                            setSelectedItem(item);
                            setShowDetails(true);
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
                materials={subTab === 'inhouse' ? inHouseComponents : materials}
                vendors={vendors}
                locations={locations}
                categories={categories}
                loading={loading}
                initialData={editingGRN}
                isEditing={!!editingGRN}
                type={subTab === 'inhouse' ? 'inhouse' : 'bo'}
                customers={customers}
            />

            <ItemDetailsModal
                isOpen={showDetails}
                onClose={() => {
                    setShowDetails(false);
                    setSelectedItem(null);
                }}
                item={selectedItem}
                type={subTab === 'inhouse' ? 'inhouse' : 'bo'}
            />
        </div>
    );
}

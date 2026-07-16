"use client";

import { useState, useMemo } from "react";
import LoadingSpinner from "@/src/components/LoadingSpinner";
import ErrorAlert from "@/src/components/ErrorAlert";
import SuccessAlert from "@/src/components/SuccessAlert";
import { API_BASE_URL } from "@/src/utils/config";
import * as XLSX from 'xlsx';
import { Calendar, XCircle, Plus } from 'lucide-react';

// Import Types and Hook from Store
import { TabType, MasterType, GRNFormData, POFormData, DCFormData, BillingFormData } from "../../store/types/store.types";
import { useStoreData } from "../../store/components/hooks/useStoreData";

// Import Store Components
import MasterTabs from "../../store/components/tabs/MasterTabs";
import BillsTabs from "../../store/components/tabs/BillsTabs";
import SearchBar from "../../store/components/shared/SearchBar";
import StoreForm from "../../store/components/forms/StoreForm";
import StoreTable from "../../store/components/tables/StoreTable";
import POTable from "../../store/components/tables/POTable";
import DCTable from "../../store/components/tables/DCTable";
import BillingTable from "../../store/components/tables/BillingTable";

// Import Modals
import POModal from "../../store/components/modals/POModal";
import DCModal from "../../store/components/modals/DCModal";
import BillingModal from "../../store/components/modals/BillingModal";
import GRNModal from "../../store/components/modals/GRNModal"; // Needed for types/handlers mostly, though GRN history excluded
import SharedInventoryView from "../../store/components/tables/SharedInventoryView";
import FGItemForm from "../../store/components/forms/FGItemForm";
import MaterialRequestModal from "../../store/components/modals/MaterialRequestModal";

export default function PPCStoreTab() {
    // State for local tab management
    const [activeTab, setActiveTab] = useState<TabType>("masters");
    const [masterTab, setMasterTab] = useState<MasterType>("vendor");

    // Modal States
    const [showPOModal, setShowPOModal] = useState(false);
    const [editingPO, setEditingPO] = useState<POFormData | undefined>(undefined);

    const [showDCModal, setShowDCModal] = useState(false);
    const [editingDC, setEditingDC] = useState<DCFormData | undefined>(undefined);

    const [showBillingModal, setShowBillingModal] = useState(false);
    const [editingBilling, setEditingBilling] = useState<BillingFormData | undefined>(undefined);

    // GRN State (needed for hook compatibility even if hidden)
    const [showGRNModal, setShowGRNModal] = useState(false);
    const [editingGRN, setEditingGRN] = useState<GRNFormData | undefined>(undefined);

    // Filter States
    const [filterType, setFilterType] = useState<'monthly' | 'yearly'>('monthly');
    const [filterDate, setFilterDate] = useState<string>('');

    // Inventory Sub-tab State
    const [activeSubTab, setActiveSubTab] = useState<'bo' | 'inhouse'>('bo');

    // Inhouse Item Form State
    const [showInhouseForm, setShowInhouseForm] = useState(false);

    // Material Request Modal State
    const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);

    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

    // Use Store Hook
    const {
        data,
        loading,
        showForm,
        formData,
        error,
        success,
        searchTerm,
        editingId,
        vendors,
        customers,
        locations,
        categories,
        materials,
        materialRequests,
        photos,
        setPhotos,
        setShowForm,
        setFormData,
        setError,
        setSuccess,
        setSearchTerm,
        handleSubmit,
        handleEdit,
        handleDelete,
        handleCancel,
        handleGRNSubmit,
        handleGRNUpdate,
        handlePOSubmit,
        handlePOUpdate,
        handleDCSubmit,
        handleDCUpdate,
        handleBillingSubmit,
        handleBillingUpdate,
        addItem,
        updateItem,
        removeItem,
        startDate,
        endDate,
        setStartDate,
        setEndDate,
        companyInfo, // Destructure companyInfo
        inHouseComponents, // Destructure InHouse components
        pendingProducts,
        createMaterialRequest, // Add createMaterialRequest
        inventoryList, // Add inventoryList for validation
    } = useStoreData(activeTab, masterTab, token);

    // Filter InHouse components logic (Duplicated from StorePage for consistency)
    const filteredInHouseComponents = useMemo(() => {
        // Stage 1: All inHouseComponents (FGItems) are inventory items
        const inventoryItems = inHouseComponents;

        if (!searchTerm) return inventoryItems;

        // Stage 2: Filter by search term
        const lower = searchTerm.toLowerCase();
        return inventoryItems.filter((item: any) =>
            (item.componentName?.toLowerCase().includes(lower) || false) ||
            (item.componentCode?.toLowerCase().includes(lower) || false) ||
            (item.name?.toLowerCase().includes(lower) || false) ||
            (item.code?.toLowerCase().includes(lower) || false)
        );
    }, [inHouseComponents, searchTerm]);

    // --- Handlers (Duplicated from StorePage for isolation) ---

    const handleMasterEdit = (item: any) => {
        // GRN History excluded, so standard edit
        handleEdit(item);
    };

    const handlePOEdit = (item: any) => {
        const poData: POFormData = {
            _id: item._id,
            poNumber: item.poNumber,
            date: item.date,
            vendor: item.vendor?._id || item.vendor || '',
            material: item.material || (item.items && item.items.length > 0 ? item.items[0]?.material : ''),
            materialName: item.materialName || (item.items && item.items.length > 0 ? item.items[0]?.materialName : ''),
            quantity: item.quantity || (item.items && item.items.length > 0 ? item.items[0]?.quantity : 0),
            unit: item.unit || (item.items && item.items.length > 0 ? item.items[0]?.unit : ''),
            rate: item.rate || (item.items && item.items.length > 0 ? item.items[0]?.rate : 0),
            amount: item.amount || (item.items && item.items.length > 0 ? item.items[0]?.amount : 0),
            category: item.category || '',
        };
        setEditingPO(poData);
        setShowPOModal(true);
    };

    const handleDCEdit = (item: any) => {
        const dcData: DCFormData = {
            ...item,
            customer: item.customer?._id || item.customer,
            customerName: item.customerName || item.customer?.name,
            items: item.items?.map((i: any) => ({
                ...i,
                material: i.material?._id || i.material,
                materialName: i.materialName || i.material?.name
            })) || [],
        };
        setEditingDC(dcData);
        setShowDCModal(true);
    };

    const handleBillingEdit = (item: any) => {
        const billingData: BillingFormData = {
            ...item,
            customer: item.customer?._id || item.customer,
            customerName: item.customerName || item.customer?.name,
            items: item.items?.map((i: any) => ({
                ...i,
                material: i.material?._id || i.material,
                materialName: i.materialName || i.material?.name
            })) || [],
            subtotal: Number(item.subtotal) || 0,
            taxAmount: Number(item.taxAmount) || 0,
            totalAmount: Number(item.totalAmount) || 0,
        };
        setEditingBilling(billingData);
        setShowBillingModal(true);
    };

    const onPOSubmit = async (poData: POFormData) => {
        try {
            if (editingPO && editingPO._id) {
                await handlePOUpdate(editingPO._id, poData);
            } else {
                await handlePOSubmit(poData);
            }
            setShowPOModal(false);
            setEditingPO(undefined);
        } catch (err) { }
    };

    const onDCSubmit = async (dcData: DCFormData) => {
        try {
            if (editingDC && editingDC._id) {
                await handleDCUpdate(editingDC._id, dcData);
            } else {
                await handleDCSubmit(dcData);
            }
            setShowDCModal(false);
            setEditingDC(undefined);
        } catch (err) { }
    };

    const onBillingSubmit = async (billingData: BillingFormData) => {
        try {
            if (editingBilling && editingBilling._id) {
                await handleBillingUpdate(editingBilling._id, billingData);
            } else {
                await handleBillingSubmit(billingData);
            }
            setShowBillingModal(false);
            setEditingBilling(undefined);
        } catch (err) { }
    };

    const handleCreateRequest = async (formData: any) => {
        try {
            await createMaterialRequest(formData);
            setIsRequestModalOpen(false);
            setSuccess("Material request submitted successfully");
        } catch (error: any) {
            console.error("Create request failed", error);
            setError(error.message || "Failed to submit request");
        }
    };

    // Filter Logic
    const getFilteredData = () => {
        if (!data) return [];
        if (!['po', 'dc', 'billing'].includes(activeTab)) return data;
        if (!filterDate) return data;

        return data.filter((item: any) => {
            const dateStr = item.date || item.createdAt;
            if (!dateStr) return true;
            const itemDate = new Date(dateStr);
            if (filterType === 'monthly') {
                const filterMonth = filterDate;
                const itemMonth = itemDate.toISOString().slice(0, 7);
                return itemMonth === filterMonth;
            } else {
                const filterYear = filterDate;
                const itemYear = itemDate.getFullYear().toString();
                return itemYear === filterYear;
            }
        });
    };

    const filteredBillsData = getFilteredData();

    const renderFilterInput = () => {
        const inputClass = "w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none cursor-pointer";
        const currentYear = new Date().getFullYear();
        const years = Array.from({ length: 6 }, (_, i) => currentYear - i);
        const months = [
            { val: '01', label: 'January' }, { val: '02', label: 'February' },
            { val: '03', label: 'March' }, { val: '04', label: 'April' },
            { val: '05', label: 'May' }, { val: '06', label: 'June' },
            { val: '07', label: 'July' }, { val: '08', label: 'August' },
            { val: '09', label: 'September' }, { val: '10', label: 'October' },
            { val: '11', label: 'November' }, { val: '12', label: 'December' }
        ];

        switch (filterType) {
            case 'monthly':
                const [selYear, selMonth] = filterDate ? filterDate.split('-') : ['', ''];
                const updateMonth = (newMonth: string) => {
                    const y = selYear || currentYear.toString();
                    setFilterDate(`${y}-${newMonth}`);
                };
                const updateYear = (newYear: string) => {
                    const m = selMonth || '01';
                    setFilterDate(`${newYear}-${m}`);
                };
                return (
                    <div className="flex gap-2 w-full sm:w-64">
                        <div className="relative flex-1">
                            <select value={selMonth} onChange={(e) => updateMonth(e.target.value)} className={inputClass} >
                                <option value="" disabled>Month</option>
                                {months.map(m => (
                                    <option key={m.val} value={m.val}>{m.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="relative w-28">
                            <select value={selYear} onChange={(e) => updateYear(e.target.value)} className={inputClass}>
                                {years.map(year => (
                                    <option key={year} value={year}>{year}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                );
            case 'yearly':
                return (
                    <div className="relative w-full sm:w-48">
                        <select value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className={inputClass}>
                            <option value="">Select Year</option>
                            {years.map(year => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>
                    </div>
                );
            default: return null;
        }
    };

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 md:p-6 min-h-[600px]">
            {/* Top Level Navigation: inventory | Masters | Bills */}
            <div className="flex gap-2 md:gap-4 mb-6 border-b pb-4 items-center justify-start overflow-x-auto no-scrollbar">
                <button
                    onClick={() => setActiveTab('home')}
                    className={`px-4 md:px-5 py-2 md:py-2.5 rounded-lg font-bold transition-all text-sm whitespace-nowrap ${activeTab === 'home'
                        ? "bg-emerald-600 text-white shadow-lg shadow-emerald-200"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                >
                    Inventory
                </button>
                <button
                    onClick={() => setActiveTab('masters')}
                    className={`px-4 md:px-5 py-2 md:py-2.5 rounded-lg font-bold transition-all text-sm whitespace-nowrap ${activeTab === 'masters'
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-200"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                >
                    Masters
                </button>
                <button
                    onClick={() => setActiveTab('po')}
                    className={`px-4 md:px-5 py-2 md:py-2.5 rounded-lg font-bold transition-all text-sm whitespace-nowrap ${['po', 'dc', 'billing'].includes(activeTab)
                        ? "bg-purple-600 text-white shadow-lg shadow-purple-200"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                >
                    Bills
                </button>
            </div>

            {/* Alerts */}
            {error && <ErrorAlert message={error} onClose={() => setError("")} />}
            {success && <SuccessAlert message={success} onClose={() => setSuccess("")} />}

            {/* Sub-Tabs & Actions Container */}
            <div className="flex flex-col gap-4 mb-6">

                {/* Masters Sub-tabs & Action */}
                {activeTab === 'masters' && (
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4">
                        <div className="w-full sm:w-auto overflow-x-auto">
                            <MasterTabs
                                masterTab={masterTab}
                                setMasterTab={setMasterTab}
                                excludedTabs={['grn-history', 'company-info']}
                            />
                        </div>
                        <div className="w-full sm:w-auto mt-2 sm:mt-0">
                            <button
                                onClick={() => {
                                    handleCancel(); // Clear any previous edit state
                                    if (masterTab === 'fg-items') {
                                        setShowInhouseForm(true);
                                    } else {
                                        setFormData({});
                                        setShowForm(true);
                                    }
                                }}
                                className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-sm shadow-sm"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                                </svg>
                                {masterTab === 'fg-items' ? 'Create Inhouse Item' : `Add ${masterTab === 'vendor' ? 'Supplier' : masterTab.charAt(0).toUpperCase() + masterTab.slice(1)}`}
                            </button>
                        </div>
                    </div>
                )}

                {/* Bills Sub-tabs & Action */}
                {['po', 'dc', 'billing'].includes(activeTab) && (
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4">
                        <div className="w-full sm:w-auto overflow-x-auto">
                            <BillsTabs
                                activeTab={activeTab}
                                onTabChange={(tab) => {
                                    setActiveTab(tab);
                                    setFilterDate('');
                                }}
                            />
                        </div>
                        <div className="w-full sm:w-auto mt-2 sm:mt-0">
                            {activeTab === "po" && (
                                <button onClick={() => { setEditingPO(undefined); setShowPOModal(true); }} className="w-full sm:w-auto px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 text-sm shadow-sm flex items-center justify-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                                    Create PO
                                </button>
                            )}
                            {activeTab === "dc" && (
                                <button onClick={() => { setEditingDC(undefined); setShowDCModal(true); }} className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 text-sm shadow-sm flex items-center justify-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                                    Create DC
                                </button>
                            )}
                            {activeTab === "billing" && (
                                <button onClick={() => { setEditingBilling(undefined); setShowBillingModal(true); }} className="w-full sm:w-auto px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 text-sm shadow-sm flex items-center justify-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                                    Create Invoice
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Inventory Actions Removed */}
            </div>

            {/* Search Bar */}
            {(activeTab === "masters" || activeTab === "home") && (
                <div className="mb-4">
                    <SearchBar searchTerm={searchTerm} setSearchTerm={setSearchTerm} />
                </div>
            )}

            {/* Filter Bar ... */}

            {/* ... Content ... */}

            {/* Filter Bar for Bills */}
            {['po', 'dc', 'billing'].includes(activeTab) && (
                <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-100 flex flex-wrap items-center gap-4 justify-between">
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar max-w-full">
                        {[{ id: 'monthly', label: 'Monthly' }, { id: 'yearly', label: 'Yearly' }].map((type) => (
                            <button
                                key={type.id}
                                onClick={() => { setFilterType(type.id as any); setFilterDate(''); }}
                                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ${filterType === type.id
                                    ? 'bg-white text-blue-700 shadow-sm border'
                                    : 'text-gray-500 hover:bg-gray-200'
                                    }`}
                            >
                                {type.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-2">
                        <Calendar size={16} className="text-gray-400" />
                        {renderFilterInput()}
                        {filterDate && (
                            <button onClick={() => setFilterDate('')} className="p-1 text-gray-400 hover:text-red-500">
                                <XCircle size={16} />
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Main Content */}
            {loading ? (
                <LoadingSpinner />
            ) : (
                <div className="overflow-x-auto">
                    {/* Tables */}
                    {activeTab === "po" ? (
                        <POTable
                            data={filteredBillsData}
                            companyInfo={companyInfo}
                            onEdit={handlePOEdit}
                            onDelete={handleDelete}
                        />
                    ) : activeTab === "dc" ? (
                        <DCTable
                            data={filteredBillsData}
                            companyInfo={companyInfo}
                            onEdit={handleDCEdit}
                            onDelete={handleDelete}
                        />
                    ) : activeTab === "billing" ? (
                        <BillingTable
                            data={filteredBillsData}
                            companyInfo={companyInfo}
                            onEdit={handleBillingEdit}
                            onDelete={handleDelete}
                        />
                    ) : activeTab === "masters" ? (
                        <StoreTable
                            activeTab={activeTab}
                            masterTab={masterTab}
                            data={data}
                            loading={loading}
                            onEdit={handleMasterEdit}
                            onDelete={handleDelete}
                        />
                    ) : activeTab === "home" ? (
                        <>
                            <div className="flex justify-end mb-2">
                                <button
                                    onClick={() => setIsRequestModalOpen(true)}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:shadow-lg hover:shadow-blue-200 transition-all font-medium text-sm active:scale-95 shadow-md"
                                >
                                    <Plus size={18} />
                                    Request Material
                                </button>
                            </div>
                            <SharedInventoryView
                                data={data}
                                inHouseData={filteredInHouseComponents}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                                activeSubTab={activeSubTab}
                                onSubTabChange={setActiveSubTab}
                            />
                        </>
                    ) : null}

                    {/* Modals */}
                    <StoreForm
                        activeTab={activeTab === 'home' ? 'home' : activeTab} // If home, pass home so form knows what fields (Item fields vs Master fields)
                        masterTab={masterTab}
                        showForm={showForm}
                        formData={formData}
                        setFormData={setFormData}
                        editingId={editingId}
                        loading={loading}
                        vendors={vendors}
                        customers={customers}
                        locations={locations}
                        categories={categories}
                        onSubmit={handleSubmit}
                        onCancel={handleCancel}
                        addItem={addItem}
                        updateItem={updateItem}
                        removeItem={removeItem}
                    />

                    {/* FG Item Modal */}
                    <FGItemForm
                        isOpen={showInhouseForm}
                        onClose={() => {
                            setShowInhouseForm(false);
                            handleCancel();
                        }}
                        onSubmit={async (e) => {
                            const success = await handleSubmit(e);
                            if (success) {
                                setShowInhouseForm(false);
                            }
                        }}
                        formData={formData}
                        setFormData={setFormData}
                        materials={materials}
                        isEditing={!!editingId}
                        customers={customers}
                        categories={categories}
                        locations={locations}
                        fgItems={pendingProducts}
                        loading={loading}
                        photos={photos}
                        setPhotos={setPhotos}
                    />

                    <POModal
                        isOpen={showPOModal}
                        onClose={() => { setShowPOModal(false); setEditingPO(undefined); }}
                        onSubmit={onPOSubmit}
                        materials={materials}
                        vendors={vendors}
                        loading={loading}
                        initialData={editingPO}
                        isEditing={!!editingPO}
                    />

                    <DCModal
                        isOpen={showDCModal}
                        onClose={() => { setShowDCModal(false); setEditingDC(undefined); }}
                        onSubmit={onDCSubmit}
                        customers={customers}
                        materials={materials}
                        loading={loading}
                        initialData={editingDC}
                        isEditing={!!editingDC}
                    />

                    <BillingModal
                        isOpen={showBillingModal}
                        onClose={() => { setShowBillingModal(false); setEditingBilling(undefined); }}
                        onSubmit={onBillingSubmit}
                        customers={customers}
                        materials={materials}
                        loading={loading}
                        initialData={editingBilling}
                        isEditing={!!editingBilling}
                    />


                </div>
            )}
            {/* Material Request Modal */}
            <MaterialRequestModal
                isOpen={isRequestModalOpen}
                onClose={() => setIsRequestModalOpen(false)}
                onSubmit={handleCreateRequest}
                materials={materials}
                inventoryList={inventoryList}
                loading={loading}
                inHouseComponents={inHouseComponents}
            />
        </div>
    );
}

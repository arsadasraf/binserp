/**
 * StoreForm Component
 * 
 * Main form wrapper that conditionally renders the appropriate form based on the active tab.
 * Handles form submission, cancel actions, and displays submit/cancel buttons.
 * Integrates all specific form components (MasterForm, GRNForm, DCForm, etc.).
 * 
 * @param activeTab - Current active main tab
 * @param masterTab - Current active master tab (if in masters section)
 * @param showForm - Whether to display the form
 * @param formData - Current form data state
 * @param setFormData - Function to update form data
 * @param editingId - ID of item being edited (null for new items)
 * @param loading - Loading state during form submission
 * @param vendors - List of vendors for dropdowns
 * @param customers - List of customers for dropdowns
 * @param onSubmit - Form submission handler
 * @param onCancel - Cancel button handler
 * @param addItem - Function to add item to items array
 * @param updateItem - Function to update item in items array
 * @param removeItem - Function to remove item from items array
 */

import React from 'react';
import { TabType, MasterType, StoreFormData, Vendor, Customer, Category, Location, Process } from '../../types/store.types';
import MasterForm from './MasterForm';
import GRNForm from './GRNForm';
import DCForm from './DCForm';
import POForm from './POForm';
import BillingForm from './BillingForm';
import MaterialIssueForm from './MaterialIssueForm';
import ItemsList from './ItemsList';

interface StoreFormProps {
    activeTab: TabType;
    masterTab: MasterType;
    showForm: boolean;
    formData: StoreFormData;
    setFormData: (data: StoreFormData) => void;
    editingId: string | null;
    loading: boolean;
    vendors: Vendor[];
    customers: Customer[];
    categories: Category[];
    locations: Location[];

    processes?: Process[]; // Added
    onSubmit: (e: React.FormEvent) => void;
    onCancel: () => void;
    addItem: () => void;
    updateItem: (idx: number, field: string, value: any) => void;
    removeItem: (idx: number) => void;
}

import { X } from 'lucide-react'; // Import X icon

// ... (props interface remains same)

export default function StoreForm({
    activeTab,
    masterTab,
    showForm,
    formData,
    setFormData,
    editingId,
    loading,
    vendors,
    customers,
    categories,
    locations,

    processes = [], // Default to empty array
    onSubmit,
    onCancel,
    addItem,
    updateItem,
    removeItem,
}: StoreFormProps) {
    // Don't render if form is not visible
    if (!showForm) return null;

    // Helper to get title
    const getTitle = () => {
        const action = editingId ? "Edit" : "Create";
        if (activeTab === "masters") {
            const masterName = masterTab === 'vendor' ? 'Vendor' :
                masterTab === 'job-work-supplier' ? 'Job-Work Supplier' :
                        masterTab === 'location' ? 'Location' :
                            masterTab === 'category' ? 'Category' :
                                masterTab === 'customer' ? 'Customer' :
                                    masterTab === 'rm-bo-item' ? 'RM/BO Item' :
                                        masterTab === 'inhouse-items' ? 'Inhouse Item' :
                                            masterTab.charAt(0).toUpperCase() + masterTab.slice(1);
            return `${action} ${masterName}`;
        }
        if (activeTab === "grn") return `${action} GRN`;
        if (activeTab === "dc") return `${action} Delivery Challan`;
        if (activeTab === "po") return `${action} Purchase Order`;
        if (activeTab === "billing") return `${action} Invoice`;
        if (activeTab === "material-issue") return `${action} Material Issue`;
        return `${action} Item`;
    };

    return (
        <>
            {/* Modal backdrop */}
            <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={onCancel} />

            {/* Modal content */}
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
                <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-7xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                    {/* Modal header */}
                    <div className="flex items-center justify-between p-6 border-b dark:border-gray-700 bg-gradient-to-r from-blue-600 to-indigo-600">
                        <div>
                            <h2 className="text-2xl font-bold text-white">
                                {getTitle()}
                            </h2>
                            <p className="text-blue-100 text-sm mt-1">
                                {editingId ? "Update existing details" : "Fill in the details to create new entry"}
                            </p>
                        </div>
                        <button
                            onClick={onCancel}
                            className="p-2 hover:bg-white/20 rounded-lg transition-colors text-white"
                            title="Close"
                        >
                            <X size={24} />
                        </button>
                    </div>

                    {/* Modal body - Scrollable */}
                    <div className="flex-1 overflow-y-auto p-6">
                        <form id="store-form" onSubmit={onSubmit} className="space-y-6">
                            {/* Form fields grid */}
                            <div className={activeTab === "masters" ? "space-y-6" : "grid grid-cols-1 sm:grid-cols-2 gap-4"}>
                                {/* Render appropriate form based on active tab */}
                                {activeTab === "masters" && (
                                    <MasterForm
                                        formData={formData}
                                        setFormData={setFormData}
                                        masterTab={masterTab}
                                        categories={categories}
                                        locations={locations}

                                        processes={processes}
                                    />
                                )}

                                {activeTab === "grn" && (
                                    <GRNForm formData={formData} setFormData={setFormData} vendors={vendors} />
                                )}

                                {activeTab === "dc" && (
                                    <DCForm formData={formData} setFormData={setFormData} customers={customers} />
                                )}

                                {activeTab === "po" && (
                                    <POForm formData={formData} setFormData={setFormData} vendors={vendors} />
                                )}

                                {activeTab === "billing" && (
                                    <BillingForm formData={formData} setFormData={setFormData} customers={customers} />
                                )}

                                {activeTab === "material-issue" && (
                                    <MaterialIssueForm formData={formData} setFormData={setFormData} />
                                )}
                            </div>

                            {/* Items section for transaction forms (GRN, DC, PO, Billing) */}
                            {["grn", "dc", "po", "billing"].includes(activeTab) && (
                                <ItemsList
                                    items={formData.items || []}
                                    activeTab={activeTab}
                                    updateItem={updateItem}
                                    removeItem={removeItem}
                                    addItem={addItem}
                                />
                            )}
                        </form>
                    </div>

                    {/* Modal footer - Fixed at bottom */}
                    <div className="p-6 border-t bg-gray-50 dark:bg-gray-900 dark:border-gray-700">
                        <div className="flex gap-3">
                            {/* Submit button */}
                            <button
                                type="submit"
                                form="store-form"
                                disabled={loading}
                                className="flex-1 bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-lg hover:shadow-xl"
                            >
                                {loading ? "Saving..." : editingId ? "Update" : "Create"}
                            </button>

                            {/* Cancel button */}
                            <button
                                type="button"
                                onClick={onCancel}
                                className="flex-1 bg-white text-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border-2 border-gray-300"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

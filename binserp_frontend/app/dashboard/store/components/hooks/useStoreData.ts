/**
 * useStoreData Custom Hook
 * 
 * Manages all business logic and state for the Store Dashboard.
 * Handles:
 * - State management for forms, data, loading, errors
 * - Data fetching from API (inventory, transactions, master data)
 * - CRUD operations (create, read, update, delete)
 * - Item management for transaction forms
 * - Search filtering
 * 
 * This hook centralizes all business logic, keeping components focused on presentation.
 * 
 * @param activeTab - Current active main tab
 * @param masterTab - Current active master tab
 * @param token - Authentication token
 * @returns Object containing all state and handler functions
 */

import { useState, useEffect, useMemo } from "react";
import { 
    useGetStoreDataQuery, 
    useCreateStoreRecordMutation, 
    useUpdateStoreRecordMutation, 
    useDeleteStoreRecordMutation 
} from "@/src/store/services/storeService";
import { useGetPpcComponentsQuery } from "@/src/store/services/ppcService";
import { TabType, MasterType, StoreFormData, Vendor, Customer, Location, Category, RmBoItem, GRNFormData, POFormData, CompanyInfo, DCFormData, BillingFormData, JobWorkSupplier, Process } from "../../types/store.types";

export function useStoreData(activeTab: TabType, masterTab: MasterType, token: string | null, queryParams?: string) {
    // --- Queries ---
    const { data: storeData = [], isLoading: mainLoading } = useGetStoreDataQuery(
        activeTab === "masters" ? (masterTab === "fg-grn-history" ? "fg-grn" : masterTab) : (activeTab === "home" ? (masterTab === "grn-history" ? "grn" : masterTab === "fg-grn-history" ? "fg-grn" : "inventory") : activeTab), 
        { skip: !token }
    );

    const { data: vendorsData = [] } = useGetStoreDataQuery("vendor", { skip: !token });

    const { data: customersData = [] } = useGetStoreDataQuery("customer", { skip: !token });
    const { data: locationsData = [] } = useGetStoreDataQuery("location", { skip: !token });
    const { data: categoriesData = [] } = useGetStoreDataQuery("category", { skip: !token });
    const { data: materialsData = [] } = useGetStoreDataQuery("material", { skip: !token });
    const { data: jobWorkSuppliersData = [] } = useGetStoreDataQuery("job-work-supplier", { skip: !token });
    const { data: processesData = [] } = useGetStoreDataQuery("process", { skip: !token });
    const { data: companyInfoData } = useGetStoreDataQuery("company-info", { skip: !token });
    const { data: materialRequestsData = [] } = useGetStoreDataQuery("material-request", { skip: !token });
    const { data: inventoryData = [] } = useGetStoreDataQuery("inventory", { skip: !token });
    
    const { data: fgItems = [] } = useGetStoreDataQuery('fg-item', { skip: !token }); const { data: fgGrns = [] } = useGetStoreDataQuery('fg-grn', { skip: !token });
    const { data: pendingProducts = [] } = useGetPpcComponentsQuery({ isInventoryItem: false }, { skip: !token });

    // --- Mutations ---
    const [createRecord] = useCreateStoreRecordMutation();
    const [updateRecord] = useUpdateStoreRecordMutation();
    const [deleteRecord] = useDeleteStoreRecordMutation();

    // --- Local UI State ---
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState<StoreFormData>({ items: [] });
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [photos, setPhotos] = useState<File[]>([]);

    // --- Derived Data ---
    const data = useMemo(() => {
        if (activeTab === "masters") {
            if (masterTab === "fg-items") return fgItems;
            if (masterTab === "pending-products") return pendingProducts;
        }
        return Array.isArray(storeData) ? storeData : [];
    }, [activeTab, masterTab, storeData, fgItems, pendingProducts]);

    const materialRequests = materialRequestsData;
    const vendors = vendorsData;

    const customers = customersData;
    const locations = locationsData;
    const categories = categoriesData;
    const materials = materialsData;
    const inventoryList = Array.isArray(inventoryData) ? inventoryData : [];
    const jobWorkSuppliers = jobWorkSuppliersData;
    const processes = processesData;
    const companyInfo = companyInfoData ? (Array.isArray(companyInfoData) ? companyInfoData[0] : companyInfoData) : undefined;
    const loading = mainLoading;

    // Filter state
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [filterSupplier, setFilterSupplier] = useState("");

    // ==================== Handlers ====================

    // Placeholder functions to avoid breaking the return object before we refactor handlers
    // Handlers
    const { refetch } = useGetStoreDataQuery(
        activeTab === "masters" ? (masterTab === "fg-grn-history" ? "fg-grn" : masterTab) : (activeTab === "home" ? (masterTab === "grn-history" ? "grn" : masterTab === "fg-grn-history" ? "fg-grn" : "inventory") : activeTab), 
        { skip: !token }
    );

    const fetchData = () => refetch();
    const fetchMasters = () => {};
    const fetchMaterialRequests = () => {};

    const saveCompanyInfo = async (info: CompanyInfo | FormData) => {
        try {
            const isFormData = info instanceof FormData;
            const id = companyInfo?._id || "";

            await updateRecord({ tab: "company-info", id, body: info, isFormData }).unwrap();

            setSuccess("Company information saved successfully");
            setTimeout(() => setSuccess(""), 3000);
        } catch (err: any) {
            const message = err?.data?.message || err?.message || err?.error || "Failed to save company information";
            setError(message);
        }
    };

    // ==================== Search Filtering ====================

    /**
     * Filters data based on search term and specific filters
     * Searches across different fields depending on the active tab
     */
    const filteredData = useMemo(() => {
        if (!Array.isArray(data)) return [];
        return data.filter((item) => {
            // Date Filter (Applies to all transactions with a date field)
            if (startDate) {
                const itemDate = new Date(item.date).setHours(0, 0, 0, 0);
                const start = new Date(startDate).setHours(0, 0, 0, 0);
                if (itemDate < start) return false;
            }
            if (endDate) {
                const itemDate = new Date(item.date).setHours(0, 0, 0, 0);
                const end = new Date(endDate).setHours(0, 0, 0, 0);
                if (itemDate > end) return false;
            }

            // GRN History Specific Filtering
            if (masterTab === "grn-history") {
                // Supplier Filter
                if (filterSupplier) {
                    const itemSupplierId = item.supplier?._id || item.supplier;
                    if (itemSupplierId !== filterSupplier) return false;
                }
            }

            const searchLower = searchTerm.toLowerCase();

            if (activeTab === "masters" || masterTab === "grn-history") {
                // Search in master data fields
                return (
                    (item.name?.toLowerCase().includes(searchLower) || false) ||
                    (item.code?.toLowerCase().includes(searchLower) || false) ||
                    (item.contactPerson?.toLowerCase().includes(searchLower) || false) ||
                    (item.email?.toLowerCase().includes(searchLower) || false) ||
                    (item.grnNumber?.toLowerCase().includes(searchLower) || false) || // GRN Number
                    (item.supplierName?.toLowerCase().includes(searchLower) || false) || // Supplier Name
                    (item.componentName?.toLowerCase().includes(searchLower) || false) || // InHouse Component Name
                    (item.componentCode?.toLowerCase().includes(searchLower) || false) // InHouse Component Code
                );
            }

            // Search in transaction/inventory fields
            return (
                // General Store Item / Material Issue fields
                (item.materialName?.toLowerCase().includes(searchLower) || false) ||
                (item.code?.toLowerCase().includes(searchLower) || false) ||
                // PO fields
                (item.poNumber?.toLowerCase().includes(searchLower) || false) ||
                (item.vendorName?.toLowerCase().includes(searchLower) || false) ||
                // DC fields
                (item.dcNumber?.toLowerCase().includes(searchLower) || false) ||
                (item.customerName?.toLowerCase().includes(searchLower) || false) ||
                // Invoice fields
                (item.invoiceNumber?.toLowerCase().includes(searchLower) || false) ||
                // Common fallback
                (item.status?.toLowerCase().includes(searchLower) || false)
            );
        });
    }, [data, searchTerm, activeTab, masterTab, startDate, endDate, filterSupplier]);

    // ==================== CRUD Operations ====================

    /**
     * Handles form submission for create/update operations
     * Determines the appropriate endpoint and HTTP method based on context
     */
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        try {
            const tab = activeTab === "masters" ? masterTab : activeTab;
            let payload: any = { ...formData };

            // Special handling for In-house items
            if (masterTab === "fg-items") {
                const formDataPayload = new FormData();
                if (formData.name) formDataPayload.append('name', formData.name);
                if (formData.type) formDataPayload.append('type', formData.type);
                if (formData.description) formDataPayload.append('description', formData.description);
                if (formData.categoryId) formDataPayload.append('category', formData.categoryId);
                if (formData.locationId) formDataPayload.append('location', formData.locationId);
                if (formData.unit) formDataPayload.append('unit', formData.unit);
                if (formData.revisionNumber) formDataPayload.append('revisionNumber', formData.revisionNumber);
                if (formData.bom && formData.bom.length > 0) formDataPayload.append('bom', JSON.stringify(formData.bom));
                
                photos.forEach((file) => {
                    formDataPayload.append('photos', file);
                });
                
                if (editingId) {
                    await updateRecord({ tab: "fg-item" as any, id: editingId, body: formDataPayload, isFormData: true }).unwrap();
                } else {
                    await createRecord({ tab: "fg-item" as any, body: formDataPayload, isFormData: true }).unwrap();
                }
            } else if (masterTab === "rm-bo-item") {
                const formDataPayload = new FormData();
                if (formData.name) formDataPayload.append('name', formData.name);
                if (formData.descriptions) formDataPayload.append('descriptions', formData.descriptions);
                if (formData.minimumStock !== undefined) formDataPayload.append('minimumStock', formData.minimumStock.toString());
                if (formData.categoryId) formDataPayload.append('categoryId', formData.categoryId);
                if (formData.locationId) formDataPayload.append('locationId', formData.locationId);
                
                if (formData.photos && Array.isArray(formData.photos)) {
                    formData.photos.forEach((photo) => {
                        if (photo instanceof File) {
                            formDataPayload.append('photos', photo);
                        } else if (typeof photo === 'string') {
                            formDataPayload.append('photos', photo);
                        }
                    });
                }
                
                if (editingId) {
                    await updateRecord({ tab: "rm-bo-item" as any, id: editingId, body: formDataPayload, isFormData: true }).unwrap();
                } else {
                    await createRecord({ tab: "rm-bo-item" as any, body: formDataPayload, isFormData: true }).unwrap();
                }
            } else {
                if (editingId) {
                    await updateRecord({ tab: tab as any, id: editingId, body: payload }).unwrap();
                } else {
                    await createRecord({ tab: tab as any, body: payload }).unwrap();
                }
            }

            setSuccess(`Record ${editingId ? "updated" : "created"} successfully`);
            setShowForm(false);
            setFormData({ items: [] });
            setEditingId(null);
            setPhotos([]);
            return true;
        } catch (err: any) {
            setError(err.data?.message || err.message || "Failed to save record");
            return false;
        }
    };

    /**
     * Handles edit action - populates form with existing data
     */
    const handleEdit = (item: any) => {
        // For materials, handle populated categoryId
        const editData = { ...item };
        // For materials and fg-items, handle populated categoryId
        if ((masterTab === "rm-bo-item" || masterTab === "fg-items") && item.category && typeof item.category === 'object') {
            editData.categoryId = item.category._id;
            editData.unit = item.category.unit || item.unit; // Fallback to item unit
        } else if ((masterTab === "rm-bo-item" || masterTab === "fg-items") && item.categoryId && typeof item.categoryId === 'object') {
            // Handle case where it might be populated as categoryId (for material)
            editData.categoryId = item.categoryId._id;
            editData.unit = item.categoryId.unit;
        }

        // Handle populated locationId for material and fg-items
        if ((masterTab === "rm-bo-item" || masterTab === "fg-items") && item.location && typeof item.location === 'object') {
            editData.locationId = item.location._id;
        } else if ((masterTab === "rm-bo-item" || masterTab === "fg-items") && item.locationId && typeof item.locationId === 'object') {
            editData.locationId = item.locationId._id;
        }

        // For fg-items, map componentName to name, and set revisionNumber
        if (masterTab === "fg-items") {
            editData.name = item.name || item.componentName;
            editData.revisionNumber = item.revisionNumber;
            // Ensure unit is set if not handled above
            if (!editData.unit) editData.unit = item.unit;
        }

        setFormData(editData);
        setEditingId(item._id);
        // We cannot easily pre-load existing S3 photos into the `photos` File[] state 
        // since they are URLs. They should be handled separately or kept as URL references.
        setPhotos([]); 
        setShowForm(true);
    };

    /**
     * Handles delete action with confirmation
     */
    /**
     * Handles delete action with confirmation
     */
    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this record?")) return;
        
        try {
            // Proceed with normal deletion for all items including fg-items
            const tab = activeTab === "masters" ? masterTab : activeTab;
            // Map fg-items to fg-item for the backend route
            const deleteTab = tab === "fg-items" ? "fg-item" : tab;
            await deleteRecord({ tab: deleteTab as any, id }).unwrap();
            setSuccess("Record deleted successfully");
        } catch (err: any) {
            setError(err.data?.message || err.message || "Failed to delete record");
        }
    };

    // ==================== Item Management ====================

    /**
     * Adds a new item to the items array in form data
     */
    const addItem = () => {
        setFormData({
            ...formData,
            items: [...(formData.items || []), { materialName: "", quantity: "", unit: "PCS" }],
        });
    };

    /**
     * Updates a specific field in an item at the given index
     */
    const updateItem = (idx: number, field: string, value: any) => {
        const newItems = [...(formData.items || [])];
        newItems[idx] = { ...newItems[idx], [field]: value };
        setFormData({ ...formData, items: newItems });
    };

    /**
     * Removes an item from the items array at the given index
     */
    const removeItem = (idx: number) => {
        setFormData({
            ...formData,
            items: (formData.items || []).filter((_: any, i: number) => i !== idx),
        });
    };

    /**
     * Handles cancel action - resets form state
     */
    const handleCancel = () => {
        setShowForm(false);
        setFormData({ items: [] });
        setEditingId(null);
        setPhotos([]);
    };

    // ==================== GRN Operations ====================

    /**
     * Handles GRN creation from modal
     * @param grnData - GRN form data from modal
     */
    const handleGRNSubmit = async (grnData: GRNFormData | FormData) => {
        if (!token) return;

        try {
            const isFormData = grnData instanceof FormData;
            const type = isFormData
                ? (grnData.get('type') as string | null)
                : grnData.type;
            const tabName = type === 'inhouse' ? 'fg-grn' : 'grn';

            await createRecord({
                tab: tabName as any,
                body: grnData,
                isFormData,
            }).unwrap();
            setSuccess("GRN created successfully");
            fetchData();
        } catch (err: any) {
            setError(err.data?.message || err.message || "Failed to create GRN");
            throw err;
        }
    };

    /**
     * Handles GRN update from modal
     * @param id - GRN ID
     * @param grnData - GRN form data from modal
     */
    const handleGRNUpdate = async (id: string, grnData: GRNFormData | FormData) => {
        if (!token) return;

        try {
            const isFormData = grnData instanceof FormData;
            const type = isFormData
                ? (grnData.get('type') as string | null)
                : grnData.type;
            const tabName = type === 'inhouse' ? 'fg-grn' : 'grn';

            await updateRecord({
                tab: tabName as any,
                id,
                body: grnData,
                isFormData,
            }).unwrap();
            setSuccess("GRN updated successfully");
            fetchData();
        } catch (err: any) {
            setError(err.data?.message || err.message || "Failed to update GRN");
            throw err;
        }
    };

    /**
     * Handles PO submission from modal
     * @param poData - PO form data from modal
     */
    const handlePOSubmit = async (poData: POFormData) => {
        if (!token) return;

        try {
            await createRecord({ tab: "po" as any, body: poData }).unwrap();
            setSuccess("Purchase Order created successfully");
            fetchData();
        } catch (err: any) {
            setError(err.data?.message || err.message || "Failed to create Purchase Order");
            throw err;
        }
    };

    /**
     * Handles PO update from modal
     * @param id - PO ID
     * @param poData - PO form data from modal
     */
    const handlePOUpdate = async (id: string, poData: POFormData) => {
        if (!token) return;

        try {
            await updateRecord({ tab: "po" as any, id, body: poData }).unwrap();
            setSuccess("Purchase Order updated successfully");
            fetchData();
        } catch (err: any) {
            setError(err.data?.message || err.message || "Failed to update Purchase Order");
            throw err;
        }
    };

    /**
     * Handles DC submission from modal
     * @param dcData - DC form data from modal
     */
    const handleDCSubmit = async (dcData: DCFormData) => {
        if (!token) return;

        try {
            await createRecord({ tab: "dc" as any, body: dcData }).unwrap();
            setSuccess("Delivery Challan created successfully");
            fetchData();
        } catch (err: any) {
            setError(err.data?.message || err.message || "Failed to create Delivery Challan");
            throw err;
        }
    };

    /**
     * Handles DC update from modal
     * @param id - DC ID
     * @param dcData - DC form data from modal
     */
    const handleDCUpdate = async (id: string, dcData: DCFormData) => {
        if (!token) return;

        try {
            await updateRecord({ tab: "dc" as any, id, body: dcData }).unwrap();
            setSuccess("Delivery Challan updated successfully");
            fetchData();
        } catch (err: any) {
            setError(err.data?.message || err.message || "Failed to update Delivery Challan");
            throw err;
        }
    };

    /**
     * Handles Billing/Invoice submission from modal
     * @param billingData - Billing form data from modal
     */
    const handleBillingSubmit = async (billingData: BillingFormData) => {
        if (!token) return;

        try {
            await createRecord({ tab: "invoice" as any, body: billingData }).unwrap();
            setSuccess("Invoice created successfully");
            fetchData();
        } catch (err: any) {
            setError(err.data?.message || err.message || "Failed to create Invoice");
            throw err;
        }
    };

    /**
     * Handles Billing/Invoice update from modal
     * @param id - Invoice ID
     * @param billingData - Billing form data from modal
     */
    /**
     * Handles Billing/Invoice update from modal
     * @param id - Invoice ID
     * @param billingData - Billing form data from modal
     */
    const handleBillingUpdate = async (id: string, billingData: BillingFormData) => {
        if (!token) return;

        try {
            await updateRecord({ tab: "invoice" as any, id, body: billingData }).unwrap();
            setSuccess("Invoice updated successfully");
            fetchData();
        } catch (err: any) {
            setError(err.data?.message || err.message || "Failed to update Invoice");
            throw err;
        }
    };

    /**
     * Handles Quotation submission from modal
     */
    const handleQuotationSubmit = async (quotationData: any) => {
        if (!token) return;
        try {
            await createRecord({ tab: "quotation" as any, body: quotationData }).unwrap();
            setSuccess("Quotation created successfully");
            fetchData();
        } catch (err: any) {
            setError(err.data?.message || err.message || "Failed to create Quotation");
            throw err;
        }
    };

    /**
     * Handles Quotation update from modal
     */
    const handleQuotationUpdate = async (id: string, quotationData: any) => {
        if (!token) return;
        try {
            await updateRecord({ tab: "quotation" as any, id, body: quotationData }).unwrap();
            setSuccess("Quotation updated successfully");
            fetchData();
        } catch (err: any) {
            setError(err.data?.message || err.message || "Failed to update Quotation");
            throw err;
        }
    };

    // ==================== Material Issue & Request Operations ====================

    /**
     * Create Material Request
     */
    const createMaterialRequest = async (data: any) => {
        if (!token) return;
        try {
            await createRecord({ tab: "material-request" as any, body: data }).unwrap();
            setSuccess("Material request submitted successfully");
            fetchData();
        } catch (err: any) {
            setError(err.data?.message || err.message || "Failed to submit material request");
            throw err;
        }
    };

    /**
     * Update Material Request (e.g. Reject)
     */
    const updateMaterialRequest = async (id: string, data: any) => {
        if (!token) return;
        try {
            await updateRecord({ tab: "material-request" as any, id, body: data }).unwrap();
            setSuccess(`Request ${data.status.toLowerCase()} successfully`);
            fetchData();
        } catch (err: any) {
            setError(err.data?.message || err.message || "Failed to update request");
            throw err;
        }
    };

    /**
     * Create Material Issue (Direct or from Request)
     */
    const createMaterialIssue = async (data: any) => {
        if (!token) return;
        try {
            await createRecord({ tab: "material-issue" as any, body: data }).unwrap();

            if (data.requestId) {
                await updateRecord({ tab: "material-request" as any, id: data.requestId, body: { status: 'Issued' } }).unwrap();
            }

            setSuccess("Material issued successfully");
            fetchData();
        } catch (err: any) {
            setError(err.data?.message || err.message || "Failed to issue material");
            throw err;
        }
    };

    /**
     * Update Material Issue (e.g. Return)
     */
    const updateMaterialIssue = async (id: string, data: any) => {
        if (!token) return;
        try {
            await updateRecord({ tab: "material-issue" as any, id, body: data }).unwrap();
            setSuccess("Material issue updated successfully");
            fetchData();
        } catch (err: any) {
            setError(err.data?.message || err.message || "Failed to update material issue");
            throw err;
        }
    };

    // ==================== Return Hook Interface ====================

    return {
        // State
        data: filteredData,
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
        processes, // Added


        // State setters
        setShowForm,
        setFormData,
        setError,
        setSuccess,
        setSearchTerm,

        // Handlers
        handleSubmit,
        handleEdit,
        handleDelete,
        handleCancel,
        handleGRNSubmit,
        handleGRNUpdate,
        photos,
        setPhotos,
        handlePOSubmit,
        handlePOUpdate,
        handleDCSubmit,
        handleDCUpdate,
        handleBillingSubmit,
        handleBillingUpdate,
        handleQuotationSubmit,
        handleQuotationUpdate,
        addItem,
        updateItem,
        removeItem,
        companyInfo,
        saveCompanyInfo,
        startDate,
        endDate,
        setStartDate,
        setEndDate,

        // Material Issue & Request Handlers
        createMaterialRequest,
        updateMaterialRequest,
        createMaterialIssue,
        updateMaterialIssue,
        materialRequests,
        inventoryList,
        inHouseComponents: fgItems,
        fgItems,
        pendingProducts,
        jobWorkSuppliers, // Added
        refetch: fetchData,
    };
}

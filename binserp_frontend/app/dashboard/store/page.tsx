/**
 * Store Dashboard Page
 * 
 * Main orchestrator component for the Store Management dashboard.
 * This component has been refactored from a monolithic 851-line file into a clean,
 * modular structure using separate components for better maintainability.
 * 
 * Architecture:
 * - Business logic is handled by the useStoreData custom hook
 * - UI components are separated into dedicated, reusable components
 * - This page only handles component composition and alert management
 */

"use client";
import { Suspense, useState, useMemo, useEffect } from "react";
import { useHeader } from "@/src/context/HeaderContext";
import { useSearchParams } from "next/navigation";
import LoadingSpinner from "@/src/components/LoadingSpinner";
import ErrorAlert from "@/src/components/ErrorAlert";
import SuccessAlert from "@/src/components/SuccessAlert";
import { API_BASE_URL } from "@/src/utils/config";
import { generateDocument } from '@/src/utils/documentHelper';
import { Calendar, Filter, XCircle, FileText } from 'lucide-react';
import Link from "next/link";

// Import custom types
import { TabType, MasterType, GRNFormData, POFormData, DCFormData, BillingFormData } from "./types/store.types";

// Import custom hook for business logic
import { useStoreData } from "./components/hooks/useStoreData";
import { useCreateStoreRecordMutation } from "@/src/store/services/storeService";

// Import UI components
import StoreForm from "./components/forms/StoreForm";
import StoreTable from "./components/tables/StoreTable";
import POTable from "./components/tables/POTable";
import POModal from "./components/modals/POModal";
import DCModal from "./components/modals/DCModal";
import BillingModal from "./components/modals/BillingModal";
import FGItemForm from "./components/forms/FGItemForm";
import RmBoItemForm from "./components/forms/RmBoItemForm";
import CompanyInfoForm from "./components/forms/CompanyInfoForm";
import PrintSettingsForm from "./components/forms/PrintSettingsForm";
import DCTable from "./components/tables/DCTable";
import BillingTable from "./components/tables/BillingTable";
import QuotationTable from "./components/tables/QuotationTable";
import QuotationModal from "./components/modals/QuotationModal";
import PriceListTable from "./components/tables/PriceListTable";
import PriceListModal from "./components/modals/PriceListModal";
import MaterialIssueTab from "./components/tabs/MaterialIssueTab";
import StoreTabs from "./components/tabs/StoreTabs";
import StoreOrdersTab from "./components/tabs/StoreOrdersTab";
import PPCProductsTab from "../ppc/components/PPCProductsTab";
import PrefixSettingsForm from "./components/forms/PrefixSettingsForm";
import JobWorkStore from "./components/tabs/JobWorkStore";
import InventoryTab from "./components/tabs/InventoryTab";
import MRPTab from "./components/tabs/MRPTab";
import StoreMRPTab from "./components/tabs/StoreMRPTab";


/**
 * StoreContent Component
 * 
 * Main content component that orchestrates all store dashboard functionality.
 * Uses the useStoreData hook for state management and data operations.
 */
function StoreContent() {
  // Get active tab from URL query parameters
  const searchParams = useSearchParams();
  const activeTab = (searchParams.get("tab") as TabType) || "home";

  // State for master tab selection (vendor, customer, location, category)
  const [masterTab, setMasterTab] = useState<MasterType>("vendor");
  const [createStoreRecord] = useCreateStoreRecordMutation();

  // State for Create Inhouse Item Modal
  const [showFGItemForm, setShowFGItemForm] = useState(false);
  const [showRmBoItemForm, setShowRmBoItemForm] = useState(false);

  // State for PO modal
  const [showPOModal, setShowPOModal] = useState(false);
  const [editingPO, setEditingPO] = useState<POFormData | undefined>(undefined);

  // State for DC modal
  const [showDCModal, setShowDCModal] = useState(false);
  const [editingDC, setEditingDC] = useState<DCFormData | undefined>(undefined);

  const [showBillingModal, setShowBillingModal] = useState(false);
  const [editingBilling, setEditingBilling] = useState<BillingFormData | undefined>(undefined);

  // State for Quotation modal
  const [showQuotationModal, setShowQuotationModal] = useState(false);
  const [editingQuotation, setEditingQuotation] = useState<any>(undefined);

  // State for Price List modal
  const [showPriceListModal, setShowPriceListModal] = useState(false);
  const [editingPriceList, setEditingPriceList] = useState<any>(undefined);

  // Filter States for Bills
  const [filterType, setFilterType] = useState<'monthly' | 'yearly'>('monthly');
  const [filterDate, setFilterDate] = useState<string>('');

  // Get authentication token from localStorage (wrapped in useEffect to avoid hydration mismatch)
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setToken(localStorage.getItem("token"));
    }
  }, []);

  // Use custom hook to manage all business logic and state
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
    processes, // Added
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
    materialRequests,
    photos,
    setPhotos,
    createMaterialRequest,
    updateMaterialRequest,
    createMaterialIssue,
    updateMaterialIssue,
    inventoryList,
    fgItems,
    pendingProducts,
    jobWorkSuppliers,
    refetch,
  } = useStoreData(activeTab, masterTab, token);

  // Filter InHouse components based on search term AND inventory status
  const filteredInHouseComponents = useMemo(() => {
    // Stage 1: Filter by isInventoryItem status
    // Only show items that have been explicitly marked as inventory items (via Store > Master > Inhouse Items)
    const inventoryItems = fgItems.filter((item: any) => item.isInventoryItem === true);

    if (!searchTerm) return inventoryItems;

    // Stage 2: Filter by search term
    const lower = searchTerm.toLowerCase();
    return inventoryItems.filter((item: any) =>
      (item.componentName?.toLowerCase().includes(lower) || false) ||
      (item.componentCode?.toLowerCase().includes(lower) || false) ||
      (item.name?.toLowerCase().includes(lower) || false) ||
      (item.code?.toLowerCase().includes(lower) || false)
    );
  }, [fgItems, searchTerm]);

  // Filter Data Logic for Bills (PO, DC, Billing)
  const getFilteredData = () => {
    if (!data) return [];
    // Only filter for bills tabs
    if (!['po', 'dc', 'billing', 'purchase'].includes(activeTab)) return data;
    if (!filterDate) return data;

    return data.filter((item: any) => {
      // Use item.date or fallback to createdAt
      const dateStr = item.date || item.createdAt;
      if (!dateStr) return true;

      const itemDate = new Date(dateStr);

      if (filterType === 'monthly') {
        // Match Month (YYYY-MM)
        const filterMonth = filterDate;
        const itemMonth = itemDate.toISOString().slice(0, 7);
        return itemMonth === filterMonth;
      } else {
        // Match Year (YYYY)
        const filterYear = filterDate;
        const itemYear = itemDate.getFullYear().toString();
        return itemYear === filterYear;
      }
    });
  };

  const filteredBillsData = getFilteredData();

  // Helper to render filter input (Copied logic from MaterialIssueTab)
  const renderFilterInput = () => {
    const inputClass = "w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none cursor-pointer";
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
              <select
                value={selMonth}
                onChange={(e) => updateMonth(e.target.value)}
                className={inputClass}
              >
                <option value="" disabled>Month</option>
                {months.map(m => (
                  <option key={m.val} value={m.val}>{m.label}</option>
                ))}
              </select>
            </div>
            <div className="relative w-28">
              <select
                value={selYear}
                onChange={(e) => updateYear(e.target.value)}
                className={inputClass}
              >
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
            <select
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className={inputClass}
            >
              <option value="">Select Year</option>
              {years.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        );
      default:
        return null;
    }
  };



  /**
   * Handles PO creation/update from modal
   * Closes modal on success
   */
  const onPOSubmit = async (poData: POFormData) => {
    try {
      if (editingPO && editingPO._id) {
        await handlePOUpdate(editingPO._id, poData);
      } else {
        await handlePOSubmit(poData);
      }
      setShowPOModal(false);
      setEditingPO(undefined);
    } catch (err) {
      // Error is already handled in hook
    }
  };

  /**
   * Handles DC creation/update from modal
   */
  const onDCSubmit = async (dcData: DCFormData) => {
    try {
      if (editingDC && editingDC._id) {
        await handleDCUpdate(editingDC._id, dcData);
      } else {
        await handleDCSubmit(dcData);
      }
      setShowDCModal(false);
      setEditingDC(undefined);
    } catch (err) {
      // Error is already handled in hook
    }
  };

  /**
   * Handles Billing/Invoice creation/update from modal
   */
  const onBillingSubmit = async (billingData: BillingFormData) => {
    try {
      if (editingBilling && editingBilling._id) {
        await handleBillingUpdate(editingBilling._id, billingData);
      } else {
        await handleBillingSubmit(billingData);
      }
      setShowBillingModal(false);
      setEditingBilling(undefined);
    } catch (err) {
      // Error is already handled in hook
    }
  };

  /**
   * Handles edit action for masters
   * Intercepts GRN history edit to show GRN modal
   */
  const handleMasterEdit = (item: any) => {
    handleEdit(item);
    if (masterTab === 'fg-items') {
      setShowFGItemForm(true);
    } else if (masterTab === 'rm-bo-item') {
      setShowRmBoItemForm(true);
    }
  };

  /**
   * Handles PO edit action
   * Opens PO modal with prepopulated data
   */
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

  /**
   * Handles DC edit action
   */
  const handleDCEdit = (item: any) => {
    const dcData: DCFormData = {
      ...item,
      customer: item.customer?._id || item.customer, // Flatten populated customer
      customerName: item.customerName || item.customer?.name,
      items: item.items?.map((i: any) => ({
        ...i,
        material: i.material?._id || i.material, // Flatten populated material
        materialName: i.materialName || i.material?.name
      })) || [],
    };
    setEditingDC(dcData);
    setShowDCModal(true);
  };

  /**
   * Handles Billing edit action
   */
  const handleBillingEdit = (item: any) => {
    const billingData: BillingFormData = {
      ...item,
      customer: item.customer?._id || item.customer, // Flatten populated customer
      customerName: item.customerName || item.customer?.name,
      items: item.items?.map((i: any) => ({
        ...i,
        material: i.material?._id || i.material, // Flatten populated material
        materialName: i.materialName || i.material?.name
      })) || [],
      subtotal: Number(item.subtotal) || 0,
      taxAmount: Number(item.taxAmount) || 0,
      totalAmount: Number(item.totalAmount) || 0,
    };
    setEditingBilling(billingData);
    setShowBillingModal(true);
  };

  const handleQuotationEdit = (item: any) => {
    setEditingQuotation(item);
    setShowQuotationModal(true);
  };

  const handlePriceListEdit = (item: any) => {
    setEditingPriceList(item);
    setShowPriceListModal(true);
  };

  /**
   * Downloads DC data as Excel file
   */
  const downloadDCExcel = async () => {
    if (!data || data.length === 0) {
      setError("No Delivery Challan data to export");
      return;
    }
    await generateDocument('excel', 'Delivery Challans', data);
  };

  /**
   * Downloads Billing data as Excel file
   */
  const downloadBillingExcel = async () => {
    if (!data || data.length === 0) {
      setError("No Invoice data to export");
      return;
    }
    await generateDocument('excel', 'Invoices', data);
  };

  /**
   * Downloads InHouse Masters/Inventory as Excel
   * specifically for the Masters > Inhouse Items tab
   */
  const downloadInHouseMastersExcel = async () => {
    if (!fgItems || fgItems.length === 0) {
      setError("No InHouse items to export");
      return;
    }
    await generateDocument('excel', 'InHouse Inventory', fgItems);
    setSuccess("InHouse inventory exported successfully");
  };

  /**
   * Downloads inventory data as Excel file
   */
  /**
   * Downloads inventory data (BO or InHouse) as Excel file
   */


  const { setHeader } = useHeader();

  useEffect(() => {
    setHeader("Store Management", "Manage inventory, material issues, bills, and masters.");
  }, [setHeader]);

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-950 pb-2 sm:pb-2">
      <div className="p-0 max-w-[1600px] mx-auto">
        {/* Page header removed and moved to navbar */}

        {/* Error and success alert messages */}
        <div className="max-w-4xl">
          {error && <ErrorAlert message={error} onClose={() => setError("")} />}
          {success && <SuccessAlert message={success} onClose={() => setSuccess("")} />}
        </div>

        {/* Main Navigation Tabs */}
        <StoreTabs activeTab={activeTab} />

        <div className="mt-0 animate-in fade-in slide-in-from-bottom-4 duration-500">

          {/* Purchase tabs - shown when purchase, po, purchase-rfq, vendor-quotation, or vendor-price-list tabs are active */}
          {(activeTab === "purchase" || activeTab === "po" || activeTab === "purchase-rfq" || activeTab === "vendor-quotation" || activeTab === "vendor-price-list") && (
            <div className="mb-6 flex flex-wrap gap-2 p-1 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 w-fit shadow-sm">
              <Link
                href="/dashboard/store?tab=purchase-rfq"
                className={`px-5 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${activeTab === "purchase-rfq"
                  ? "bg-indigo-600 text-white shadow-md"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"}`}
              >
                Purchase RFQ
              </Link>
              <Link
                href="/dashboard/store?tab=vendor-quotation"
                className={`px-5 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${activeTab === "vendor-quotation"
                  ? "bg-indigo-600 text-white shadow-md"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"}`}
              >
                Vendor Quotations
              </Link>
              <Link
                href="/dashboard/store?tab=purchase"
                className={`px-5 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${activeTab === "purchase" || activeTab === "po"
                  ? "bg-indigo-600 text-white shadow-md"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"}`}
              >
                Purchase Orders
              </Link>
              <Link
                href="/dashboard/store?tab=vendor-price-list"
                className={`px-5 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${activeTab === "vendor-price-list"
                  ? "bg-indigo-600 text-white shadow-md"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"}`}
              >
                RM/BO Price List
              </Link>
            </div>
          )}

          {/* Master tabs - only shown when masters tab is active */}
          {activeTab === "masters" && (
            <div className="mb-6">
              <div className="flex flex-wrap gap-2 p-1 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 w-fit shadow-sm">
                <button
                  onClick={() => setMasterTab("vendor")}
                  className={`px-5 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${masterTab === "vendor"
                    ? "bg-indigo-600 text-white shadow-md"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"}`}
                >
                  Vendors
                </button>


                <button
                  onClick={() => setMasterTab("customer")}
                  className={`px-5 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${masterTab === "customer"
                    ? "bg-indigo-600 text-white shadow-md"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"}`}
                >
                  Customers
                </button>
                <button
                  onClick={() => setMasterTab("location")}
                  className={`px-5 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${masterTab === "location"
                    ? "bg-indigo-600 text-white shadow-md"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"}`}
                >
                  Store Locations
                </button>
                <button
                  onClick={() => setMasterTab("category")}
                  className={`px-5 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${masterTab === "category"
                    ? "bg-indigo-600 text-white shadow-md"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"}`}
                >
                  RM/BO Items Categories
                </button>
                <button
                  onClick={() => setMasterTab("rm-bo-item")}
                  className={`px-5 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${masterTab === "rm-bo-item"
                    ? "bg-indigo-600 text-white shadow-md"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"}`}
                >
                  RM/BO Items
                </button>
                <button
                  onClick={() => setMasterTab("fg-items")}
                  className={`px-5 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${masterTab === "fg-items"
                    ? "bg-indigo-600 text-white shadow-md"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"}`}
                >
                  FG Items
                </button>
                {/* <button
                  onClick={() => setMasterTab("ppc-products")}
                  className={`px-5 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${masterTab === "ppc-products"
                    ? "bg-indigo-600 text-white shadow-md"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"}`}
                >
                  Inhouse Products
                </button> */}

                <button
                  onClick={() => setMasterTab("company-info")}
                  className={`px-5 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${masterTab === "company-info"
                    ? "bg-indigo-600 text-white shadow-md"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"}`}
                >
                  Company Info
                </button>

                <button
                  onClick={() => setMasterTab("prefix-settings")}
                  className={`px-5 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${masterTab === "prefix-settings"
                    ? "bg-indigo-600 text-white shadow-md"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"}`}
                >
                  Prefix Settings
                </button>
                <button
                  onClick={() => setMasterTab("print-settings")}
                  className={`px-5 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${masterTab === "print-settings"
                    ? "bg-indigo-600 text-white shadow-md"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"}`}
                >
                  Print Info
                </button>
              </div>
            </div>
          )}

          {/* WIP tabs - shown when wip, material-issue, or job-work tabs are active */}
          {(activeTab === "wip" || activeTab === "material-issue" || activeTab === "job-work") && (
            <div className="mb-6 flex flex-wrap gap-2 p-1 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 w-fit shadow-sm">
              <Link
                href="/dashboard/store?tab=wip"
                className={`px-5 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${activeTab === "wip" || activeTab === "material-issue"
                  ? "bg-indigo-600 text-white shadow-md"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"}`}
              >
                Issue
              </Link>
              <Link
                href="/dashboard/store?tab=job-work"
                className={`px-5 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${activeTab === "job-work"
                  ? "bg-indigo-600 text-white shadow-md"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"}`}
              >
                Job Work
              </Link>
            </div>
          )}

          {/* Sales tabs - shown when sales, order-entry, quotation, incoming-po, billing, dc, mrp, price-list, or rfq tabs are active */}
          {(activeTab === "sales" || activeTab === "order-entry" || activeTab === "quotation" || activeTab === "incoming-po" || activeTab === "billing" || activeTab === "dc" || activeTab === "mrp" || activeTab === "price-list" || activeTab === "rfq") && (
            <div className="mb-6 flex flex-wrap gap-2 p-1 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 w-fit shadow-sm">
              <Link
                href="/dashboard/store?tab=rfq"
                className={`px-5 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${activeTab === "rfq"
                  ? "bg-indigo-600 text-white shadow-md"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"}`}
              >
                RFQ
              </Link>
              <Link
                href="/dashboard/store?tab=quotation"
                className={`px-5 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${activeTab === "quotation"
                  ? "bg-indigo-600 text-white shadow-md"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"}`}
              >
                Quotations
              </Link>
              <Link
                href="/dashboard/store?tab=incoming-po"
                className={`px-5 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${activeTab === "incoming-po"
                  ? "bg-indigo-600 text-white shadow-md"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"}`}
              >
                Customer PO
              </Link>
              <Link
                href="/dashboard/store?tab=sales"
                className={`px-5 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${activeTab === "sales" || activeTab === "order-entry"
                  ? "bg-indigo-600 text-white shadow-md"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"}`}
              >
                Sales Orders
              </Link>
              <Link
                href="/dashboard/store?tab=dc"
                className={`px-5 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${activeTab === "dc"
                  ? "bg-indigo-600 text-white shadow-md"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"}`}
              >
                Delivery Challan
              </Link>
              <Link
                href="/dashboard/store?tab=billing"
                className={`px-5 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${activeTab === "billing"
                  ? "bg-indigo-600 text-white shadow-md"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"}`}
              >
                Billing
              </Link>
              <Link
                href="/dashboard/store?tab=mrp"
                className={`px-5 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${activeTab === "mrp"
                  ? "bg-indigo-600 text-white shadow-md"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"}`}
              >
                MRP
              </Link>
              <Link
                href="/dashboard/store?tab=price-list"
                className={`px-5 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${activeTab === "price-list"
                  ? "bg-indigo-600 text-white shadow-md"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"}`}
              >
                Price List
              </Link>
            </div>
          )}

          {/* Purchase tabs - shown when purchase or po tabs are active */}
          {(activeTab === "purchase" || activeTab === "po") && (
            <div className="mb-6 flex flex-wrap gap-2 p-1 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 w-fit shadow-sm">
              <Link
                href="/dashboard/store?tab=purchase"
                className={`px-5 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${activeTab === "purchase" || activeTab === "po"
                  ? "bg-indigo-600 text-white shadow-md"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"}`}
              >
                Purchase Orders
              </Link>
            </div>
          )}

          <div className={`bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-6`}>

            {/* Search Bar - Hidden for company info tab */}
            <div className={`flex flex-col md:flex-row ${activeTab === 'grn' ? 'justify-between' : 'justify-end'} items-start md:items-center gap-4 mb-6`}>

              {activeTab === "grn" && (
                <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 p-1 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Calendar size={16} className="text-gray-400" />
                    </div>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="pl-9 pr-3 py-2 bg-transparent border-none focus:ring-0 text-sm text-gray-700 dark:text-gray-200 w-32 placeholder-gray-400"
                      placeholder="Start Date"
                    />
                  </div>
                  <span className="text-gray-400">-</span>
                  <div className="relative">
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="px-3 py-2 bg-transparent border-none focus:ring-0 text-sm text-gray-700 dark:text-gray-200 w-32"
                      placeholder="End Date"
                    />
                  </div>
                  {(startDate || endDate) && (
                    <button
                      onClick={() => { setStartDate(''); setEndDate(''); }}
                      className="p-1 hover:bg-gray-200 rounded-full text-gray-400 hover:text-red-500 transition-colors mr-1"
                      title="Clear Dates"
                    >
                      <XCircle size={16} />
                    </button>
                  )}

                </div>
              )}


              {/* Right Side: Actions (Create & Download) */}
              <div className="flex gap-3 w-full md:w-auto justify-end">
                {/* DC Buttons */}
                {activeTab === "dc" && (
                  <>
                    <button
                      onClick={downloadDCExcel}
                      className="p-2.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-all shadow-sm hover:shadow"
                      title="Download List as Excel"
                    >
                      <FileText size={20} />
                    </button>
                    <button
                      onClick={() => {
                        setEditingDC(undefined);
                        setShowDCModal(true);
                      }}
                      className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium shadow-lg shadow-blue-200 hover:shadow-xl hover:scale-[1.02] transition-all flex items-center gap-2"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                      </svg>
                      Create DC
                    </button>
                  </>
                )}

                {/* Billing Buttons */}
                {activeTab === "billing" && (
                  <>
                    <button
                      onClick={downloadBillingExcel}
                      className="p-2.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-all shadow-sm hover:shadow"
                      title="Download List as Excel"
                    >
                      <FileText size={20} />
                    </button>
                    <button
                      onClick={() => {
                        setEditingBilling(undefined);
                        setShowBillingModal(true);
                      }}
                      className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-medium shadow-lg shadow-indigo-200 hover:shadow-xl hover:scale-[1.02] transition-all flex items-center gap-2"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                      </svg>
                      Create Invoice
                    </button>
                  </>
                )}

                {/* PO Button */}
                {activeTab === "po" && (
                  <button
                    onClick={() => {
                      setEditingPO(undefined);
                      setShowPOModal(true);
                    }}
                    className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-medium shadow-lg shadow-purple-200 hover:shadow-xl hover:scale-[1.02] transition-all flex items-center gap-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                    Create PO
                  </button>
                )}

                {/* Quotation Button */}
                {activeTab === "quotation" && (
                  <button
                    onClick={() => {
                      setEditingQuotation(undefined);
                      setShowQuotationModal(true);
                    }}
                    className="px-4 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 text-white rounded-xl font-medium shadow-lg shadow-teal-200 hover:shadow-xl hover:scale-[1.02] transition-all flex items-center gap-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                    Create Quotation
                  </button>
                )}

                {/* Masters Button */}
                {activeTab === "masters" && masterTab !== "company-info" && masterTab !== "grn-history" && masterTab !== "fg-grn-history" && masterTab !== "prefix-settings" && (
                  <div className="flex gap-2">
                    {masterTab === 'fg-items' && (
                      <button
                        onClick={downloadInHouseMastersExcel}
                        className="p-2.5 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-all shadow-sm hover:shadow"
                        title="Download InHouse Inventory Excel"
                      >
                        <FileText size={20} />
                      </button>
                    )}
                    {masterTab !== 'ppc-products' && (
                      <button
                        onClick={() => {
                          if (masterTab === 'fg-items') {
                            setShowFGItemForm(true);
                          } else if (masterTab === 'rm-bo-item') {
                            setShowRmBoItemForm(true);
                          } else {
                            setFormData({ items: [] });
                            setShowForm(true);
                          }
                        }}
                        className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-xl font-medium shadow-lg shadow-indigo-200 hover:shadow-xl hover:scale-[1.02] transition-all flex items-center gap-2"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                        </svg>
                        {'Create New'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>


            {/* Store Form */}
            <StoreForm
              activeTab={activeTab}
              masterTab={masterTab}
              showForm={showForm && masterTab !== 'fg-items'}
              formData={formData}
              setFormData={setFormData}
              editingId={editingId}
              loading={loading}
              vendors={vendors}

              customers={customers}
              locations={locations}
              categories={categories}
              processes={processes}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              addItem={addItem}
              updateItem={updateItem}
              removeItem={removeItem}
            />

            {/* Filter Bar for Bills */}
            {['po', 'dc', 'billing', 'quotation'].includes(activeTab) && (
              <div className="mb-6 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
                  <div className="flex items-center gap-2 w-full lg:w-auto overflow-x-auto pb-1 lg:pb-0 no-scrollbar">
                    <div className="flex items-center gap-1 bg-gray-100/80 p-1 rounded-xl">
                      {[{ id: 'monthly', label: 'Monthly' }, { id: 'yearly', label: 'Yearly' }].map((type) => (
                        <button
                          key={type.id}
                          onClick={() => { setFilterType(type.id as any); setFilterDate(''); }}
                          className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${filterType === type.id
                            ? 'bg-white text-blue-700 shadow-sm ring-1 ring-black/5'
                            : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'
                            }`}
                        >
                          {type.label}
                        </button>
                      ))}
                    </div>
                    <div className="h-6 w-px bg-gray-200 hidden lg:block" />
                    <div className="text-xs font-medium text-gray-500 bg-blue-50/50 px-3 py-1.5 rounded-lg border border-blue-100 whitespace-nowrap">
                      Total: <span className="text-blue-700 font-bold ml-1">{filteredBillsData.length}</span>
                    </div>
                  </div>
                  {/* Date Input */}
                  <div className="relative w-full lg:w-auto group flex items-center gap-2">
                    <div className="hidden sm:flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 text-blue-500">
                      <Calendar size={16} />
                    </div>
                    {renderFilterInput()}
                    {filterDate && (
                      <button onClick={() => setFilterDate('')} className="ml-2 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors">
                        <XCircle size={18} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
            {/* Table for displaying data */}
            {
              (activeTab === "sales" || activeTab === "order-entry") ? (
                <StoreOrdersTab />
              ) : activeTab === "price-list" ? (
                <PriceListTable
                  priceLists={filteredBillsData}
                  fgItems={fgItems}
                  onEdit={handlePriceListEdit}
                  onDelete={handleDelete}
                />
              ) : activeTab === "rfq" ? (
                <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 border-dashed text-gray-500">
                  <p className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Request for Quotation</p>
                  <p className="text-sm">This module is currently pending frontend integration.</p>
                </div>
              ) : activeTab === "incoming-po" ? (
                <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 border-dashed text-gray-500">
                  <p className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Customer Purchase Orders</p>
                  <p className="text-sm">This module is currently pending frontend integration.</p>
                </div>
              ) : activeTab === "purchase-rfq" ? (
                <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 border-dashed text-gray-500">
                  <p className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Purchase RFQ</p>
                  <p className="text-sm">This module is currently pending frontend integration.</p>
                </div>
              ) : activeTab === "vendor-quotation" ? (
                <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 border-dashed text-gray-500">
                  <p className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Vendor Quotations</p>
                  <p className="text-sm">This module is currently pending frontend integration.</p>
                </div>
              ) : activeTab === "vendor-price-list" ? (
                <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 border-dashed text-gray-500">
                  <p className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">RM/BO Price List</p>
                  <p className="text-sm">This module is currently pending frontend integration.</p>
                </div>
              ) : (activeTab === "purchase" || activeTab === "po") ? (
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
              ) : activeTab === "mrp" ? (
                <StoreMRPTab />
              ) : activeTab === "quotation" ? (
                <QuotationTable
                  data={filteredBillsData}
                  companyInfo={companyInfo}
                  onEdit={handleQuotationEdit}
                  onDelete={handleDelete}
                />
              ) : activeTab === "masters" && masterTab === "company-info" ? (
                <CompanyInfoForm
                  initialData={companyInfo}
                  onSubmit={saveCompanyInfo}
                  loading={loading}
                />
              ) : activeTab === "masters" && masterTab === "prefix-settings" ? (
                <PrefixSettingsForm
                  token={token}
                  onError={setError}
                  onSuccess={setSuccess}
                />
              ) : activeTab === "masters" && masterTab === "print-settings" ? (
                <PrintSettingsForm
                  initialData={companyInfo}
                  onSubmit={saveCompanyInfo}
                  loading={loading}
                />
              ) : (activeTab === "wip" || activeTab === "material-issue") ? (
                <MaterialIssueTab storeData={{
                  data,
                  materialRequests,
                  createMaterialRequest,
                  updateMaterialRequest,
                  createMaterialIssue,
                  updateMaterialIssue,
                  materials,
                  loading,
                  inventoryList,
                  fgItems,
                  inHouseComponents: fgItems,
                }} token={token} />

              ) : activeTab === "home" ? (
                <InventoryTab
                  storeData={{
                    data,
                    fgItems,
                    inHouseComponents: fgItems,
                    inventoryList,
                    loading,
                    handleGRNSubmit,
                    handleGRNUpdate,
                    handleDelete,
                    handleEdit,
                    vendors,
                    locations,
                    categories,
                    materials,
                    customers,
                    refetch,
                    setError,
                    setSuccess,
                    setFormData,
                    setShowForm
                  }}
                  token={token}
                  masterTab={masterTab}
                  setMasterTab={setMasterTab}
                />
              ) : activeTab === "job-work" ? (
                <JobWorkStore
                  vendors={vendors}
                  jobWorkSuppliers={jobWorkSuppliers}
                  materials={materials}
                  inHouseItems={fgItems}
                  activeTab={activeTab}
                  token={token}
                  companyInfo={companyInfo}
                  onError={(msg) => setError(msg)}
                  onSuccess={(msg) => {
                    setSuccess(msg);
                    setTimeout(() => setSuccess(""), 3000);
                  }}
                />
              ) : activeTab === "masters" && masterTab === "ppc-products" ? (
                <PPCProductsTab />
              ) : (
                <StoreTable
                  activeTab={activeTab}
                  masterTab={masterTab}
                  data={data}
                  loading={loading}
                  onEdit={handleMasterEdit}
                  onDelete={handleDelete}
                  inHouseData={filteredInHouseComponents}
                />
              )
            }

            {/* PO Modal */}
            <POModal
              inHouseItems={fgItems}
              isOpen={showPOModal}
              onClose={() => {
                setShowPOModal(false);
                setEditingPO(undefined);
              }}
              onSubmit={onPOSubmit}
              materials={materials}
              vendors={vendors}
              loading={loading}
              initialData={editingPO}
              isEditing={!!editingPO}
            />

            {/* DC Modal */}
            <DCModal
              isOpen={showDCModal}
              onClose={() => {
                setShowDCModal(false);
                setEditingDC(undefined);
              }}
              onSubmit={onDCSubmit}
              customers={customers}
              materials={materials}
              inHouseItems={fgItems}
              loading={loading}
              initialData={editingDC}
              isEditing={!!editingDC}
            />

            {/* Billing Modal */}
            <BillingModal
              isOpen={showBillingModal}
              onClose={() => {
                setShowBillingModal(false);
                setEditingBilling(undefined);
              }}
              onSubmit={onBillingSubmit}
              customers={customers}
              materials={materials}
              loading={loading}
              initialData={editingBilling}
              isEditing={!!editingBilling}
            />

            {/* Quotation Modal */}
            <QuotationModal
              isOpen={showQuotationModal}
              onClose={() => {
                setShowQuotationModal(false);
                setEditingQuotation(undefined);
              }}
              onSubmit={async (data) => {
                if (editingQuotation) {
                  await handleQuotationUpdate(editingQuotation._id, data);
                } else {
                  await handleQuotationSubmit(data);
                }
                setShowQuotationModal(false);
                setEditingQuotation(undefined);
              }}
              components={fgItems}
              loading={loading}
              initialData={editingQuotation}
              isEditing={!!editingQuotation}
            />

            {/* Price List Modal */}
            <PriceListModal
              isOpen={showPriceListModal}
              onClose={() => {
                setShowPriceListModal(false);
                setEditingPriceList(undefined);
              }}
              onSubmit={async (data) => {
                try {
                  await createStoreRecord({ tab: "price-list", body: data }).unwrap();
                  setSuccess("Price list saved successfully");
                  refetch(); // Force immediate UI update
                } catch (err: any) {
                  setError(err?.data?.message || err.message || "Failed to save price list");
                }
                setShowPriceListModal(false);
                setEditingPriceList(undefined);
              }}
              fgItems={fgItems}
              initialData={editingPriceList}
            />

            {/* Inhouse Item Modal */}
            <FGItemForm
              isOpen={showFGItemForm}
              onClose={() => {
                setShowFGItemForm(false);
                handleCancel();
              }}
              onSubmit={async (e) => {
                const success = await handleSubmit(e);
                if (success) {
                  setShowFGItemForm(false);
                }
              }}
              formData={formData}
              setFormData={setFormData}
              customers={customers}
              categories={categories}
              locations={locations}
              fgItems={fgItems}
              materials={materials}
              loading={loading}
              isEditing={!!editingId}
              photos={photos}
              setPhotos={setPhotos}
            />

            {/* RM/BO Item Modal */}
            <RmBoItemForm
              isOpen={showRmBoItemForm}
              onClose={() => {
                setShowRmBoItemForm(false);
                handleCancel();
              }}
              onSubmit={async (e) => {
                const success = await handleSubmit(e);
                if (success) {
                  setShowRmBoItemForm(false);
                }
              }}
              formData={formData}
              setFormData={setFormData}
              categories={categories}
              locations={locations}
              loading={loading}
              isEditing={!!editingId}
            />

            {/* Inhouse Item Modal moved to Inventory Tab (indirectly, or needs to be removed here if unused) 
               Wait, 'showFGItemForm' depends on logic I just removed.
               I removed 'showFGItemForm' state. So I MUST remove this block.
               
               InventoryTab handles Inhouse creation now?
               In InventoryTab.tsx, I added `FGItemForm`.
               But I removed the logic to open it from page.tsx (via `masterTab === 'fg-items'`).
               
               Wait, "Masters > Inhouse Items" tab also exists!
               If user goes to "Masters" -> "Inhouse Items", they might want to create items.
               My `InventoryTab` only covers "Inventory" (Home) tab.
               The user requirement was "in store>inventory".
               
               But I removed `masterTab === 'fg-items'` logic from the "Create New" button in page.tsx (Chunk 5 above).
               This means "Masters > Inhouse Items" creation is broken if I do that.
               
               Re-evaluating Chunk 5:
               If `masterTab === 'fg-items'`, we used to show `showFGItemForm(true)`.
               I should KEEP `showFGItemForm` state in `page.tsx` IF "Masters > Inhouse Items" needs it.
               The user didn't ask to change Masters tab.
               
               So I should RESTORE `showFGItemForm` state in Chunk 2 and RESTORE logic in Chunk 5.
               
               I will Modify Chunk 2 to keep `showFGItemForm`.
               I will Modify Chunk 5 to keep `fg-items` logic.
               I will Modify Chunk 6 (this one) to KEEP `FGItemForm`.
            */}



          </div>

          {/* Global styles for input fields */}

        </div>
      </div>
    </div>
  );
}

/**
 * StorePage Component
 * 
 * Main page export with Suspense boundary for loading state.
 * This is the entry point for the /dashboard/store route.
 */
export default function StorePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><LoadingSpinner /></div>}>
      <StoreContent />
    </Suspense>
  );
}

 

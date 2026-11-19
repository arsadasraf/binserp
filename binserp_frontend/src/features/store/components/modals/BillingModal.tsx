/**
 * Billing Modal Component
 * Modal form for creating and editing Tax Invoices / Bills
 * Top-Level Material Category Selector: FG, Raw Material (RM), Bought-Out (BO), and Consumables
 * Strict Single Material Category Rule: Only one type of material can be invoiced at once
 * High-performance debounced on-demand keyword search (asyncSearch) avoiding bulk 10,000 item downloads
 * Strict Item Display Standard: Item Name with Technical Description (Never raw item codes)
 * Live Customer Open PO selection & unbilled item auto-population
 * Inline "Add Item" on last item row & prominent Add/Delete item buttons
 */

"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
    X, Plus, Trash2, Package, User, Calendar, Hash, FileText, Truck,
    Calculator, IndianRupee, CheckCircle2, AlertTriangle, Cog, Layers,
    FlaskConical, RefreshCw, ArrowRightLeft, DollarSign, ShoppingCart, Info,
    Building2, CreditCard, RotateCcw, Eye
} from "lucide-react";
import { BillingModalProps, RmBoItem, CompanyInfo } from "@/src/features/store/types/store.types";
import SearchableSelect, { SearchableOption } from "../SearchableSelect";
import { getCurrencySymbol, CURRENCY_OPTIONS, convertToINR } from "@/src/utils/currencyHelper";
import { computeProfessionalTotalWithRoundOff, RoundingMode } from "@/src/utils/roundingHelper";
import { apiRequest } from "@/src/lib/api";
import { showConfirmDialog } from "@/src/features/store/utils/storeDialogHelper";

interface ExtendedBillingModalProps extends BillingModalProps {
    materials?: RmBoItem[];
    inHouseItems?: any[];
    fgItems?: any[];
}

export type ItemCategoryType = 'fg' | 'rm' | 'bo' | 'consumable';

interface InvoiceItemEntry {
    itemType: ItemCategoryType;
    poItemId?: string;
    fgItem?: string;
    rawMaterial?: string;
    boughtOut?: string;
    consumableItem?: string;
    material?: string;
    component?: string;
    itemCode?: string;
    materialName: string;
    hsnCode?: string;
    quantity: number;
    unit: string;
    rate: number;
    amount: number;
    taxRate?: number;
    taxAmount?: number;
    availableStock?: number;
    description?: string;
}

export default function BillingModal({
    isOpen,
    onClose,
    onSubmit,
    customers = [],
    loading,
    initialData,
    isEditing = false,
    companyInfo,
    mode = "sales",
}: ExtendedBillingModalProps) {
    const isPurchase = mode === "purchase";
    const [invoiceNumber, setInvoiceNumber] = useState("");
    const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
    const [customer, setCustomer] = useState("");
    const [customerName, setCustomerName] = useState("");
    const [customerAddress, setCustomerAddress] = useState("");
    const [customerGST, setCustomerGST] = useState("");
    const [customerPoReference, setCustomerPoReference] = useState("");
    const [currency, setCurrency] = useState("INR");
    const [customExchangeRate, setCustomExchangeRate] = useState<number | undefined>(undefined);
    const [isEditingExchangeRate, setIsEditingExchangeRate] = useState(false);

    // Single Invoice-Level Material Type on Top
    const [invoiceMaterialType, setInvoiceMaterialType] = useState<ItemCategoryType>('fg');

    const [transportationType, setTransportationType] = useState("Road Transport");
    const [transportationCharges, setTransportationCharges] = useState(0);
    const [isTransportTaxable, setIsTransportTaxable] = useState(false);
    const [transportTaxRate, setTransportTaxRate] = useState(18);
    const [vehicleNumber, setVehicleNumber] = useState("");
    const [packagingType, setPackagingType] = useState("Standard Packaging");
    const [packagingCharges, setPackagingCharges] = useState(0);
    const [isPackagingTaxable, setIsPackagingTaxable] = useState(false);
    const [packagingTaxRate, setPackagingTaxRate] = useState(18);
    const [gstSupplyType, setGstSupplyType] = useState<"intra" | "inter">("intra");
    const [discount, setDiscount] = useState(0);
    const [otherDetails, setOtherDetails] = useState("");
    const [status, setStatus] = useState("Draft");
    const [globalTaxRate, setGlobalTaxRate] = useState(18);
    const [isRoundOffEnabled, setIsRoundOffEnabled] = useState<boolean>(true);
    const [roundingMode, setRoundingMode] = useState<RoundingMode>('nearest');
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // On-demand Customer PO items preview & selective fetch state
    const [showPoItemsPreview, setShowPoItemsPreview] = useState(false);
    const [selectedPoItemKeys, setSelectedPoItemKeys] = useState<string[]>([]);

    // Purchase Mode 3-Way Matching State (Unbilled GRNs & Job Work Returns)
    const [unbilledDocs, setUnbilledDocs] = useState<{ grns: any[]; jobWorks: any[] }>({ grns: [], jobWorks: [] });
    const [isLoadingUnbilledDocs, setIsLoadingUnbilledDocs] = useState(false);
    const [selectedGrnId, setSelectedGrnId] = useState<string>("");
    const [selectedJobWorkId, setSelectedJobWorkId] = useState<string>("");

    // Company Master Resolution & Defaults
    const [fetchedCompany, setFetchedCompany] = useState<any>(null);

    // Active fetch on modal open to ensure company master data & bank details are loaded
    useEffect(() => {
        if (!isOpen) return;

        let isMounted = true;
        const fetchMasterCompany = async () => {
            try {
                const token = typeof window !== 'undefined' ? localStorage.getItem("token") : null;
                const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
                const res = await fetch(`${API_BASE_URL}/api/store/company-info`, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {}
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data && (data.companyName || data.bankDetails) && isMounted) {
                        setFetchedCompany(data);
                        try {
                            localStorage.setItem("storeCompanyInfo", JSON.stringify(data));
                        } catch (e) {}
                    }
                }
            } catch (err) {
                console.error("BillingModal: Error fetching company info master:", err);
            }
        };

        fetchMasterCompany();

        return () => {
            isMounted = false;
        };
    }, [isOpen]);

    const resolvedCompany = useMemo(() => {
        if (fetchedCompany && (fetchedCompany.companyName || fetchedCompany.bankDetails)) return fetchedCompany;
        if (companyInfo && (companyInfo.companyName || companyInfo.bankDetails)) return companyInfo;
        try {
            const stored = typeof window !== 'undefined' ? (localStorage.getItem("storeCompanyInfo") || localStorage.getItem("companyInfo")) : null;
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed && (parsed.companyName || parsed.bankDetails)) return parsed;
            }
        } catch (e) {}
        return fetchedCompany || companyInfo;
    }, [fetchedCompany, companyInfo]);

    const getMasterBankDetails = useCallback(() => {
        const bd = resolvedCompany?.bankDetails || {};
        return {
            accountName: bd.accountName || resolvedCompany?.companyName || "",
            bankName: bd.bankName || (resolvedCompany as any)?.bankName || "",
            accountNumber: bd.accountNumber || (resolvedCompany as any)?.accountNumber || "",
            ifscCode: bd.ifscCode || (resolvedCompany as any)?.ifscCode || "",
            branch: bd.branch || bd.branchName || (resolvedCompany as any)?.branchName || ""
        };
    }, [resolvedCompany]);

    const DEFAULT_INVOICE_TERMS = 
`1. Goods once sold will not be accepted back or exchanged.
2. Payment is due within agreed credit terms from the date of invoice.
3. Interest @ 18% p.a. will be charged on overdue payments after due date.
4. Any disputes arising out of this invoice are subject to local jurisdiction only.`;

    const getMasterTerms = useCallback(() => {
        return resolvedCompany?.printSettings?.invoice?.termsAndConditions || resolvedCompany?.commercialTerms || DEFAULT_INVOICE_TERMS;
    }, [resolvedCompany]);

    const [bankDetails, setBankDetails] = useState({
        accountName: "",
        bankName: "",
        accountNumber: "",
        ifscCode: "",
        branch: ""
    });

    const [termsAndConditions, setTermsAndConditions] = useState("");

    // Keep bank details & terms in sync with company master whenever master data arrives
    useEffect(() => {
        if (!resolvedCompany) return;
        const masterBank = getMasterBankDetails();

        setBankDetails(prev => {
            const hasExisting = Boolean(prev.bankName || prev.accountNumber);
            if (!hasExisting && (masterBank.bankName || masterBank.accountNumber)) {
                return masterBank;
            }
            return prev;
        });

        setTermsAndConditions(prev => {
            if (!prev || !prev.trim()) {
                return getMasterTerms();
            }
            return prev;
        });
    }, [resolvedCompany, getMasterBankDetails, getMasterTerms]);

    // Customer Open POs state
    const [customerPOs, setCustomerPOs] = useState<any[]>([]);
    const [isLoadingCustomerPOs, setIsLoadingCustomerPOs] = useState(false);

    // Unified all-material search state (FG, RM, BO, Consumables — no category switcher needed)
    const [initialItemOptions, setInitialItemOptions] = useState<SearchableOption[]>([]);
    const itemDetailsCacheRef = useRef<Map<string, any>>(new Map());
    const searchCacheRef = useRef<Map<string, SearchableOption[]>>(new Map());
    const searchAbortRef = useRef<AbortController | null>(null);

    const clearError = (key: string) => {
        setFormErrors(prev => {
            if (!prev[key]) return prev;
            const next = { ...prev };
            delete next[key];
            return next;
        });
    };

    const [items, setItems] = useState<InvoiceItemEntry[]>([{
        itemType: 'fg',
        fgItem: "",
        materialName: "",
        hsnCode: "",
        quantity: 1,
        unit: "PCS",
        rate: 0,
        amount: 0,
        taxRate: 18,
        taxAmount: 0,
        description: ""
    }]);

    const generateInvoiceNumber = () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");
        const hours = String(now.getHours()).padStart(2, "0");
        const mins = String(now.getMinutes()).padStart(2, "0");
        return `INV/${year}${month}${day}-${hours}${mins}`;
    };

    // Performance-optimized unified keyword search across FG, RM, BO, and Consumables
    const searchItemsAsync = useCallback(async (query: string): Promise<SearchableOption[]> => {
        const cleanQ = (query || '').trim().toLowerCase();
        const cachedResults = searchCacheRef.current.get(cleanQ);
        if (cachedResults) return cachedResults;

        if (searchAbortRef.current) {
            searchAbortRef.current.abort();
        }
        const controller = new AbortController();
        searchAbortRef.current = controller;

        const formatTypeBadge = (cat?: string) => {
            const c = (cat || 'fg').toLowerCase();
            if (c === 'rm') return 'RM';
            if (c === 'bo') return 'BO';
            if (c === 'consumable') return 'Consumable';
            return 'FG';
        };

        try {
            const res = await apiRequest(
                `/api/store/items/search?type=all&lite=1&query=${encodeURIComponent(query)}&limit=36&_t=${Date.now()}`,
                { signal: controller.signal }
            );
            if (!res.ok) return [];
            const data = await res.json();
            const fetched = (data.items || []).map((item: any) => {
                const descStr = item.description || item.descriptions || '';
                const cat = (item.itemCategory || 'fg').toLowerCase() as ItemCategoryType;
                const stockVal = item.currentStock !== undefined ? Number(item.currentStock) : 0;
                const unitStr = item.unit || 'PCS';
                const option: SearchableOption = {
                    value: String(item.value || item._id),
                    label: item.name,
                    description: descStr,
                    code: '',
                    name: item.name,
                    unit: unitStr,
                    hsnCode: item.hsnCode || '',
                    currentStock: stockVal,
                    rate: Number(item.rate || item.price || item.sellingPrice || 0),
                    badge: formatTypeBadge(cat),
                    subBadge: stockVal > 0 ? `Stock: ${stockVal} ${unitStr}` : 'Out of Stock',
                    itemCategory: cat,
                    rawItem: item
                };
                itemDetailsCacheRef.current.set(String(option.value), option);
                return option;
            });
            searchCacheRef.current.set(cleanQ, fetched);
            return fetched;
        } catch (err: any) {
            if (err?.name === 'AbortError') return [];
            console.warn("Error searching store items:", err?.message || err);
            return [];
        }
    }, []);

    // Load fresh balanced top items (FG + RM + BO + Consumable) with live stock on modal open
    const preloadAllOptions = useCallback(async () => {
        searchCacheRef.current.clear();
        const initial = await searchItemsAsync("");
        setInitialItemOptions(initial);
    }, [searchItemsAsync]);

    // Preload unified options when modal opens
    useEffect(() => {
        if (isOpen) {
            preloadAllOptions();
        }
        return () => {
            if (searchAbortRef.current) searchAbortRef.current.abort();
        };
    }, [isOpen, preloadAllOptions]);

    // Fetch customer open POs when customer is selected
    const fetchOpenCustomerPOs = useCallback(async (customerId: string) => {
        if (!customerId) {
            setCustomerPOs([]);
            return;
        }
        setIsLoadingCustomerPOs(true);
        try {
            const res = await apiRequest(`/api/sales/incoming-po?customer=${encodeURIComponent(customerId)}&openOnly=true`);
            if (res.ok) {
                const data = await res.json();
                setCustomerPOs(data.pos || []);
            } else {
                setCustomerPOs([]);
            }
        } catch (err) {
            console.error("Failed to load customer open POs:", err);
            setCustomerPOs([]);
        } finally {
            setIsLoadingCustomerPOs(false);
        }
    }, []);

    // Fetch unbilled purchase documents (GRNs and Job Work Challans) for 3-way matching
    const fetchUnbilledPurchaseDocs = useCallback(async (vendorId: string) => {
        if (!vendorId) {
            setUnbilledDocs({ grns: [], jobWorks: [] });
            return;
        }
        setIsLoadingUnbilledDocs(true);
        try {
            const res = await apiRequest(`/api/purchase/bill/unbilled-docs?vendor=${encodeURIComponent(vendorId)}`);
            if (res.ok) {
                const data = await res.json();
                setUnbilledDocs({
                    grns: data.grns || [],
                    jobWorks: data.jobWorks || []
                });
            } else {
                setUnbilledDocs({ grns: [], jobWorks: [] });
            }
        } catch (err) {
            console.error("Failed to load unbilled purchase documents:", err);
            setUnbilledDocs({ grns: [], jobWorks: [] });
        } finally {
            setIsLoadingUnbilledDocs(false);
        }
    }, []);

    // Handle Customer / Vendor Selection
    const handleCustomerChange = (val: string) => {
        setCustomer(val);
        const cust: any = customers.find((c: any) => (c._id || c.id) === val);
        if (cust) {
            setCustomerName(cust.name || cust.customerName || cust.companyName || cust.vendorName || "");
            setCustomerAddress(cust.address || cust.billingAddress || "");
            const nextCustGst = (cust.gstNumber || cust.gstin || "").trim().toUpperCase();
            setCustomerGST(nextCustGst);

            // Auto-suggest Intra-State vs Inter-State based on GST state code (first 2 digits)
            const compGst = (resolvedCompany?.gstin || resolvedCompany?.gstNumber || resolvedCompany?.gst || "").trim().toUpperCase();
            if (/^\d{2}/.test(compGst) && /^\d{2}/.test(nextCustGst)) {
                setGstSupplyType(compGst.slice(0, 2) === nextCustGst.slice(0, 2) ? "intra" : "inter");
            }
        } else {
            setCustomerName("");
            setCustomerAddress("");
            setCustomerGST("");
        }
        setCustomerPoReference("");
        setShowPoItemsPreview(false);
        setSelectedPoItemKeys([]);
        clearError("customer");
        if (isPurchase) {
            setSelectedGrnId("");
            setSelectedJobWorkId("");
            if (val) {
                fetchUnbilledPurchaseDocs(val);
            } else {
                setUnbilledDocs({ grns: [], jobWorks: [] });
            }
        } else {
            if (val) {
                fetchOpenCustomerPOs(val);
            } else {
                setCustomerPOs([]);
            }
        }
    };

    // Handle Unbilled Document Selection (3-Way Matching for GRN / Job Work)
    const handleSelectUnbilledDoc = async (val: string) => {
        if (!val) {
            setSelectedGrnId("");
            setSelectedJobWorkId("");
            return;
        }
        if (val.startsWith("grn:")) {
            const grnId = val.replace("grn:", "");
            setSelectedGrnId(grnId);
            setSelectedJobWorkId("");
            const selectedGrn = unbilledDocs.grns.find(g => g._id === grnId);
            if (!selectedGrn || !Array.isArray(selectedGrn.items)) return;

            const unbilledItems = selectedGrn.items
                .map((item: any) => {
                    const accepted = Number(item.acceptedQuantity || item.receivedQuantity || 0);
                    const billed = Number(item.billedQuantity || 0);
                    const remaining = Math.max(0, accepted - billed);
                    return { item, remaining };
                })
                .filter((x: any) => x.remaining > 0);

            if (unbilledItems.length > 0) {
                const isDefaultBlank = items.length === 1 && !items[0].materialName && !items[0].fgItem && !items[0].rawMaterial;
                let shouldImport = isDefaultBlank;
                if (!shouldImport) {
                    shouldImport = await showConfirmDialog({
                        title: "Import GRN Line Items?",
                        text: `Import ${unbilledItems.length} unbilled line item(s) from GRN ${selectedGrn.grnNumber}?`,
                        confirmButtonText: "Yes, Import",
                        confirmButtonColor: "#4f46e5"
                    });
                }
                if (shouldImport) {
                    const grnMatType: ItemCategoryType = selectedGrn.type === 'bo' ? 'bo' : (selectedGrn.type === 'fg' ? 'fg' : 'rm');
                    setInvoiceMaterialType(grnMatType);

                    const populatedRows: InvoiceItemEntry[] = unbilledItems.map(({ item, remaining }: any) => {
                        const rate = Number(item.unitPrice || item.rate || 0);
                        const amt = remaining * rate;
                        const taxAmt = amt * ((globalTaxRate || 18) / 100);
                        const desc = item.materialDescription || item.descriptions || item.description || "";
                        const name = item.materialName || item.name || "Material Item";
                        const matId = item.material?._id || item.material || item.rawMaterial || item.boughtOut || "";

                        if (matId) {
                            itemDetailsCacheRef.current.set(String(matId), {
                                value: String(matId),
                                label: desc ? `${name} — ${desc}` : name,
                                name,
                                description: desc,
                                unit: item.unit || "PCS",
                                hsnCode: item.hsnCode || "",
                                currentStock: undefined
                            });
                        }

                        return {
                            itemType: grnMatType,
                            rawMaterial: grnMatType === 'rm' ? matId : undefined,
                            boughtOut: grnMatType === 'bo' ? matId : undefined,
                            fgItem: grnMatType === 'fg' ? matId : undefined,
                            materialName: name,
                            poItemId: item.poItemId,
                            quantity: remaining,
                            unit: item.unit || "PCS",
                            rate,
                            amount: amt,
                            taxRate: globalTaxRate || 18,
                            taxAmount: taxAmt,
                            description: desc,
                            availableStock: undefined
                        };
                    });

                    setItems(populatedRows);
                    if (selectedGrn.vendorInvoiceNumber && !invoiceNumber) {
                        setInvoiceNumber(selectedGrn.vendorInvoiceNumber);
                    }
                }
            }
        } else if (val.startsWith("jw:")) {
            const jwId = val.replace("jw:", "");
            setSelectedJobWorkId(jwId);
            setSelectedGrnId("");
            const jw = unbilledDocs.jobWorks.find(j => j._id === jwId);
            if (!jw) return;

            const returnItems = jw.itemsReturn || jw.itemsReturned || [];
            const returnedQty = returnItems.reduce((acc: number, it: any) => acc + (it.receivedQuantity || it.quantity || 0), 0) || jw.totalReturnQuantity || 1;
            const processName = jw.processType || jw.operation || "Subcontracting Service";

            setItems([{
                itemType: 'fg',
                materialName: `Job Work Service: ${processName} (Challan: ${jw.challanNumber})`,
                quantity: returnedQty,
                unit: "PCS",
                rate: Number(jw.ratePerUnit || jw.processingCost || 0),
                amount: returnedQty * Number(jw.ratePerUnit || jw.processingCost || 0),
                taxRate: globalTaxRate || 18,
                taxAmount: (returnedQty * Number(jw.ratePerUnit || jw.processingCost || 0)) * ((globalTaxRate || 18) / 100),
                description: `Processing/Labour charges for Job Work Return Challan ${jw.challanNumber}`,
            }]);
        }
    };

    // Selected PO unbilled items memo (for on-demand Preview & Fetch — never auto-overwrites by default)
    const selectedPoUnbilledItems = useMemo(() => {
        if (!customerPoReference) return [];
        const selectedPO = customerPOs.find(p => p.poNumber === customerPoReference);
        if (!selectedPO || !Array.isArray(selectedPO.items)) return [];

        return selectedPO.items
            .map((poItem: any, idx: number) => {
                const orderedQty = Number(poItem.quantity || 0);
                const billedQty = Number(poItem.billedQuantity || 0);
                const remainingQty = Math.max(0, orderedQty - billedQty);
                const key = String(poItem._id || idx);
                return { key, poItem, orderedQty, billedQty, remainingQty };
            })
            .filter((entry: { remainingQty: number }) => entry.remainingQty > 0);
    }, [customerPoReference, customerPOs]);

    // Handle Customer PO Selection (links PO without auto-fetching items by default)
    const handleCustomerPoSelect = (poNumber: string) => {
        setCustomerPoReference(poNumber);
        setShowPoItemsPreview(false);

        if (!poNumber) {
            setSelectedPoItemKeys([]);
            return;
        }

        const selectedPO = customerPOs.find(p => p.poNumber === poNumber);
        if (selectedPO && Array.isArray(selectedPO.items)) {
            const keys = selectedPO.items
                .map((poItem: any, idx: number) => {
                    const remaining = Math.max(0, Number(poItem.quantity || 0) - Number(poItem.billedQuantity || 0));
                    return remaining > 0 ? String(poItem._id || idx) : null;
                })
                .filter(Boolean) as string[];
            setSelectedPoItemKeys(keys);
        } else {
            setSelectedPoItemKeys([]);
        }
    };

    // On-demand fetch of selected PO items into the Invoice line item list
    const handleFetchSelectedPoItems = () => {
        const toImport = selectedPoUnbilledItems.filter((entry: any) => selectedPoItemKeys.includes(entry.key));
        if (toImport.length === 0) return;

        setInvoiceMaterialType('fg');

        const populatedRows: InvoiceItemEntry[] = toImport.map(({ poItem, remainingQty }: { poItem: any; remainingQty: number }) => {
            const rate = Number(poItem.rate || poItem.pricePerQuantity || 0);
            const amt = remainingQty * rate;
            const taxAmt = amt * ((globalTaxRate || 18) / 100);
            const desc = poItem.description || poItem.fgItem?.description || poItem.descriptions || "";
            const name = poItem.productName || poItem.fgItem?.name || "Product Item";
            const fgId = poItem.fgItem?._id || poItem.fgItem || "";

            if (fgId) {
                itemDetailsCacheRef.current.set(String(fgId), {
                    value: String(fgId),
                    label: name,
                    name,
                    description: desc,
                    unit: poItem.unit || "PCS",
                    hsnCode: poItem.hsnCode || poItem.fgItem?.hsnCode || "",
                    currentStock: poItem.fgItem?.quantity !== undefined ? Number(poItem.fgItem.quantity) : undefined
                });
            }

            return {
                itemType: 'fg',
                poItemId: poItem._id,
                fgItem: fgId || undefined,
                materialName: name,
                itemCode: poItem.code || poItem.fgItem?.code || "",
                hsnCode: poItem.hsnCode || poItem.fgItem?.hsnCode || "",
                quantity: remainingQty,
                unit: poItem.unit || "PCS",
                rate,
                amount: amt,
                taxRate: globalTaxRate || 18,
                taxAmount: taxAmt,
                description: desc,
                availableStock: poItem.fgItem?.quantity !== undefined ? Number(poItem.fgItem.quantity) : undefined
            };
        });

        setItems(populatedRows);
        setShowPoItemsPreview(false);
    };

    // Initial Data loading on Edit or Create
    useEffect(() => {
        if (!isOpen) return;

        if (initialData) {
            setInvoiceNumber(initialData.invoiceNumber || "");
            setDate(initialData.date ? new Date(initialData.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0]);
            const custId = typeof initialData.customer === 'object' ? (initialData.customer as any)?._id : initialData.customer || "";
            setCustomer(custId);
            setCustomerName(initialData.customerName || (initialData.customer as any)?.name || (initialData.customer as any)?.companyName || "");
            setCustomerAddress(initialData.customerAddress || (initialData.customer as any)?.address || "");
            setCustomerGST(initialData.customerGST || (initialData.customer as any)?.gstNumber || "");
            setCustomerPoReference(initialData.customerPoReference || "");
            setCurrency(initialData.currency || (initialData as any).po?.currency || (initialData as any).dc?.currency || "INR");
            setCustomExchangeRate((initialData as any).exchangeRateToINR);
            setTransportationType((initialData as any).transportationType || "Road Transport");
            setTransportationCharges((initialData as any).transportationCharges || 0);
            setIsTransportTaxable(Boolean((initialData as any).isTransportTaxable));
            setTransportTaxRate((initialData as any).transportTaxRate ?? 18);
            setVehicleNumber((initialData as any).vehicleNumber || "");
            setPackagingType((initialData as any).packagingType || "Standard Packaging");
            setPackagingCharges((initialData as any).packagingCharges || 0);
            setIsPackagingTaxable(Boolean((initialData as any).isPackagingTaxable));
            setPackagingTaxRate((initialData as any).packagingTaxRate ?? 18);
            setGstSupplyType((initialData as any).gstSupplyType === "inter" ? "inter" : "intra");
            setShowPoItemsPreview(false);
            setDiscount(initialData.discount || 0);
            if ((initialData as any).isRoundOff !== undefined) {
                setIsRoundOffEnabled(Boolean((initialData as any).isRoundOff));
            }
            if ((initialData as any).roundingMode) {
                setRoundingMode((initialData as any).roundingMode);
            }
            setOtherDetails(initialData.otherDetails || (initialData as any).remarks || "");
            setStatus(initialData.status || "Draft");

            // Detect material category from existing items
            const firstType = (initialData.items?.[0] as any)?.itemType?.toLowerCase();
            const detectedType: ItemCategoryType = (firstType === "rm" || firstType === "bo" || firstType === "consumable") ? firstType : "fg";
            setInvoiceMaterialType(detectedType);

            if (custId) {
                fetchOpenCustomerPOs(custId);
            }

            if (initialData.items && initialData.items.length > 0) {
                setItems(initialData.items.map((i: any) => {
                    const itemId = i.fgItem?._id || i.fgItem || i.rawMaterial?._id || i.rawMaterial || i.boughtOut?._id || i.boughtOut || i.consumableItem?._id || i.consumableItem || i.material || "";
                    const qty = i.quantity || 1;
                    const rate = i.rate || i.pricePerQuantity || 0;
                    const amt = qty * rate;
                    const taxRate = i.taxRate !== undefined ? i.taxRate : 18;
                    const name = i.materialName || i.productName || i.name || "";
                    const desc = i.description || i.descriptions || "";

                    if (itemId) {
                        itemDetailsCacheRef.current.set(String(itemId), {
                            value: String(itemId),
                            label: desc ? `${name} — ${desc}` : name,
                            name,
                            description: desc,
                            unit: i.unit || "PCS",
                            hsnCode: i.hsnCode || "",
                            currentStock: i.fgItem?.quantity !== undefined ? Number(i.fgItem.quantity) : undefined
                        });
                    }

                    return {
                        itemType: detectedType,
                        poItemId: i.poItemId,
                        fgItem: detectedType === 'fg' ? itemId : undefined,
                        rawMaterial: detectedType === 'rm' ? itemId : undefined,
                        boughtOut: detectedType === 'bo' ? itemId : undefined,
                        consumableItem: detectedType === 'consumable' ? itemId : undefined,
                        itemCode: i.itemCode || "",
                        materialName: name,
                        hsnCode: i.hsnCode || "",
                        quantity: qty,
                        unit: i.unit || "PCS",
                        rate: rate,
                        amount: amt,
                        taxRate: taxRate,
                        taxAmount: i.taxAmount || (amt * (taxRate / 100)),
                        description: desc,
                        availableStock: i.fgItem?.quantity !== undefined ? Number(i.fgItem.quantity) : undefined
                    };
                }));
            } else {
                setItems([{
                    itemType: detectedType, fgItem: "", materialName: "", hsnCode: "", quantity: 1, unit: "PCS", rate: 0, amount: 0, taxRate: 18, taxAmount: 0, description: ""
                }]);
            }

            if (initialData.bankDetails && (initialData.bankDetails.bankName || initialData.bankDetails.accountNumber)) {
                setBankDetails({
                    accountName: initialData.bankDetails.accountName || "",
                    bankName: initialData.bankDetails.bankName || "",
                    accountNumber: initialData.bankDetails.accountNumber || "",
                    ifscCode: initialData.bankDetails.ifscCode || "",
                    branch: initialData.bankDetails.branch || (initialData.bankDetails as any).branchName || ""
                });
            } else {
                setBankDetails(getMasterBankDetails());
            }

            if (initialData.termsAndConditions) {
                setTermsAndConditions(initialData.termsAndConditions);
            } else {
                setTermsAndConditions(getMasterTerms());
            }
        } else {
            setInvoiceNumber(generateInvoiceNumber());
            setDate(new Date().toISOString().split("T")[0]);
            setCustomer("");
            setCustomerName("");
            setCustomerAddress("");
            setCustomerGST("");
            setCustomerPoReference("");
            setCurrency("INR");
            setCustomExchangeRate(undefined);
            setTransportationType("Road Transport");
            setTransportationCharges(0);
            setIsTransportTaxable(false);
            setTransportTaxRate(18);
            setVehicleNumber("");
            setPackagingType("Standard Packaging");
            setPackagingCharges(0);
            setIsPackagingTaxable(false);
            setPackagingTaxRate(18);
            setGstSupplyType("intra");
            setShowPoItemsPreview(false);
            setSelectedPoItemKeys([]);
            setSubmitError(null);
            setDiscount(0);
            setOtherDetails("");
            setStatus("Draft");
            setCustomerPOs([]);
            setBankDetails(getMasterBankDetails());
            setTermsAndConditions(getMasterTerms());
            setInvoiceMaterialType('fg');
            setItems([{
                itemType: 'fg', fgItem: "", materialName: "", hsnCode: "", quantity: 1, unit: "PCS", rate: 0, amount: 0, taxRate: 18, taxAmount: 0, description: ""
            }]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialData, isOpen]);

    // Item Selection Handler (automatically detects itemType per row: fg | rm | bo | consumable)
    const handleItemSelection = (index: number, selectedId: string) => {
        const newItems = [...items];
        const currentItem = newItems[index];

        const cached = itemDetailsCacheRef.current.get(String(selectedId));
        const resolvedType: ItemCategoryType = (cached?.itemCategory || cached?.rawItem?.itemCategory || currentItem.itemType || 'fg') as ItemCategoryType;
        const name = cached?.name || "";
        const code = cached?.rawItem?.code || cached?.code || "";
        const hsn = cached?.hsnCode || "";
        const unit = cached?.unit || "PCS";
        const desc = cached?.description || "";
        const stock = cached?.currentStock ?? 0;
        const rate = cached?.rate || currentItem.rate || 0;
        const qty = currentItem.quantity || 1;
        const amt = qty * rate;
        const taxRate = currentItem.taxRate !== undefined ? currentItem.taxRate : globalTaxRate;

        newItems[index] = {
            ...currentItem,
            itemType: resolvedType,
            fgItem: resolvedType === 'fg' ? selectedId : undefined,
            rawMaterial: resolvedType === 'rm' ? selectedId : undefined,
            boughtOut: resolvedType === 'bo' ? selectedId : undefined,
            consumableItem: resolvedType === 'consumable' ? selectedId : undefined,
            materialName: name,
            itemCode: code,
            hsnCode: hsn,
            unit,
            rate,
            amount: amt,
            taxRate,
            taxAmount: amt * (taxRate / 100),
            description: desc,
            availableStock: stock
        };

        setItems(newItems);
        if (submitError) setSubmitError(null);
        clearError(`item_${index}_id`);
    };

    const updateItem = (index: number, field: keyof InvoiceItemEntry, value: any) => {
        const newItems = [...items];
        const item = { ...newItems[index], [field]: value };

        const qty = field === 'quantity' ? Number(value) : item.quantity;
        const rate = field === 'rate' ? Number(value) : (item.rate || 0);
        const taxRate = field === 'taxRate' ? Number(value) : (item.taxRate || 0);

        item.amount = qty * rate;
        item.taxAmount = item.amount * (taxRate / 100);

        newItems[index] = item;
        setItems(newItems);
        if (submitError) setSubmitError(null);
        clearError(`item_${index}_quantity`);
    };

    // Add New Item (Uses currently selected invoiceMaterialType)
    const addItem = () => {
        setItems([
            ...items,
            {
                itemType: invoiceMaterialType,
                fgItem: "",
                rawMaterial: "",
                boughtOut: "",
                consumableItem: "",
                materialName: "",
                hsnCode: "",
                quantity: 1,
                unit: invoiceMaterialType === 'rm' ? 'KGS' : 'PCS',
                rate: 0,
                amount: 0,
                taxRate: globalTaxRate || 18,
                taxAmount: 0,
                description: ""
            }
        ]);
    };

    // Delete Line Item
    const removeItem = (index: number) => {
        if (items.length > 1) {
            setItems(items.filter((_, i) => i !== index));
        }
    };

    // Subtotals & Tax Calculation (including optional Transportation & Packaging GST + Intra/Inter-State split)
    const subtotal = useMemo(() => {
        return items.reduce((acc, curr) => acc + (curr.amount || (curr.quantity * (curr.rate || 0))), 0);
    }, [items]);

    const itemsTaxAmount = useMemo(() => {
        return items.reduce((acc, curr) => acc + (curr.taxAmount || 0), 0);
    }, [items]);

    const transportTaxAmount = useMemo(() => {
        if (!isTransportTaxable) return 0;
        return parseFloat(((Number(transportationCharges || 0) * Number(transportTaxRate || 0)) / 100).toFixed(2));
    }, [isTransportTaxable, transportationCharges, transportTaxRate]);

    const packagingTaxAmount = useMemo(() => {
        if (!isPackagingTaxable) return 0;
        return parseFloat(((Number(packagingCharges || 0) * Number(packagingTaxRate || 0)) / 100).toFixed(2));
    }, [isPackagingTaxable, packagingCharges, packagingTaxRate]);

    const totalTaxAmount = useMemo(() => {
        return parseFloat((itemsTaxAmount + transportTaxAmount + packagingTaxAmount).toFixed(2));
    }, [itemsTaxAmount, transportTaxAmount, packagingTaxAmount]);

    const cgstAmount = useMemo(() => {
        return gstSupplyType === "intra" ? parseFloat((totalTaxAmount / 2).toFixed(2)) : 0;
    }, [gstSupplyType, totalTaxAmount]);

    const sgstAmount = useMemo(() => {
        return gstSupplyType === "intra" ? parseFloat((totalTaxAmount - cgstAmount).toFixed(2)) : 0;
    }, [gstSupplyType, totalTaxAmount, cgstAmount]);

    const igstAmount = useMemo(() => {
        return gstSupplyType === "inter" ? totalTaxAmount : 0;
    }, [gstSupplyType, totalTaxAmount]);

    const rounding = useMemo(() => {
        return computeProfessionalTotalWithRoundOff({
            subtotal,
            totalTax: totalTaxAmount,
            transportationCharges: Number(transportationCharges || 0),
            packagingCharges: Number(packagingCharges || 0),
            discount: Number(discount || 0),
            isRoundOffEnabled,
            roundingMode,
            currency
        });
    }, [subtotal, totalTaxAmount, transportationCharges, packagingCharges, discount, isRoundOffEnabled, roundingMode, currency]);

    const totalAmount = rounding.roundedGrandTotal;

    // Live INR Conversion computation
    const inrConversion = useMemo(() => {
        return convertToINR(totalAmount, currency, customExchangeRate);
    }, [totalAmount, currency, customExchangeRate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitError(null);
        const errors: Record<string, string> = {};
        let stockErrorMsg: string | null = null;

        if (!customer) errors.customer = 'Customer is required';
        if (!date) errors.date = 'Invoice date is required';

        const categoryLabelMap: Record<ItemCategoryType, string> = {
            fg: "FG inventory",
            rm: "Raw Material (RM)",
            bo: "Bought-Out (BO)",
            consumable: "Consumable"
        };

        items.forEach((item, index) => {
            const itemId = item.fgItem || item.rawMaterial || item.boughtOut || item.consumableItem;
            if (!itemId && !item.materialName) {
                errors[`item_${index}_id`] = 'Item selection is required';
                return;
            }

            if (Number(item.quantity) <= 0) {
                errors[`item_${index}_quantity`] = 'Qty must be > 0';
                return;
            }

            // Client-side stock guard for new sales invoices (backend also validates net stock on edit)
            if (!isPurchase && !isEditing && status !== "Cancelled" && item.availableStock !== undefined && Number(item.quantity) > Number(item.availableStock)) {
                const msg = `Requested quantity (${Number(item.quantity)} ${item.unit || 'PCS'}) exceeds available ${categoryLabelMap[item.itemType || 'fg'] || 'inventory'} stock (${Number(item.availableStock)} ${item.unit || 'PCS'}) for '${item.materialName || 'Item'}'.`;
                errors[`item_${index}_quantity`] = `Max available: ${Number(item.availableStock)} ${item.unit || 'PCS'}`;
                if (!stockErrorMsg) stockErrorMsg = msg;
            }
        });

        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            if (stockErrorMsg) {
                setSubmitError(stockErrorMsg);
            } else {
                setSubmitError("Please fill all required fields highlighted in red before saving.");
            }
            const targetForm = e.currentTarget as HTMLElement;
            if (targetForm) {
                setTimeout(() => {
                    const firstInvalid = targetForm.querySelector('[data-has-error="true"]');
                    if (firstInvalid) firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 50);
            }
            return;
        }

        setFormErrors({});

        const payloadItems = items.map(entry => {
            const itemPayload: any = {
                itemType: entry.itemType || 'fg',
                materialName: entry.materialName,
                itemCode: entry.itemCode,
                hsnCode: entry.hsnCode,
                quantity: entry.quantity,
                unit: entry.unit,
                rate: entry.rate || 0,
                amount: entry.amount || (entry.quantity * (entry.rate || 0)),
                taxRate: entry.taxRate || 0,
                taxAmount: entry.taxAmount || 0,
                description: entry.description,
            };
            if (entry.poItemId) itemPayload.poItemId = entry.poItemId;
            if (entry.fgItem) itemPayload.fgItem = entry.fgItem;
            if (entry.rawMaterial) itemPayload.rawMaterial = entry.rawMaterial;
            if (entry.boughtOut) itemPayload.boughtOut = entry.boughtOut;
            if (entry.consumableItem) itemPayload.consumableItem = entry.consumableItem;
            return itemPayload;
        });

        const payload: any = {
            invoiceNumber,
            date,
            customerName,
            customerAddress,
            customerGST,
            currency,
            exchangeRateToINR: inrConversion.rate,
            transportationType,
            transportationCharges,
            isTransportTaxable,
            transportTaxRate,
            transportTaxAmount,
            vehicleNumber,
            packagingType,
            packagingCharges,
            isPackagingTaxable,
            packagingTaxRate,
            packagingTaxAmount,
            items: payloadItems,
            subtotal,
            taxAmount: totalTaxAmount,
            gstSupplyType,
            cgstAmount,
            sgstAmount,
            igstAmount,
            discount,
            preRoundTotal: rounding.preRoundTotal,
            isRoundOff: isRoundOffEnabled,
            roundOff: rounding.roundOff,
            roundingMode,
            totalAmount: rounding.roundedGrandTotal,
            otherDetails,
            bankDetails,
            termsAndConditions,
            status,
        };

        if (customer) {
            if (isPurchase) {
                payload.vendor = customer;
            } else {
                payload.customer = customer;
            }
        }
        if (customerPoReference) payload.customerPoReference = customerPoReference;

        if (isPurchase) {
            payload.billType = selectedJobWorkId ? "job-work-service" : "material";
            if (selectedGrnId) payload.grn = selectedGrnId;
            if (selectedJobWorkId) {
                payload.jobWorkChallan = selectedJobWorkId;
                const jw = unbilledDocs.jobWorks.find(j => j._id === selectedJobWorkId);
                if (jw) payload.jobWorkChallanNumber = jw.challanNumber;
            }
            payload.purchaseBillNumber = invoiceNumber;
        }

        try {
            setIsSubmitting(true);
            const result = await onSubmit(payload);
            if (result && typeof result === "object" && "error" in result && result.error) {
                setSubmitError(String(result.error));
            }
        } catch (err: any) {
            const rawMsg = err?.data?.message || err?.response?.data?.message || err?.error || err?.message || "Failed to save Tax Invoice.";
            setSubmitError(typeof rawMsg === "string" ? rawMsg : JSON.stringify(rawMsg));
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    // Build options for unbilled purchase documents (3-way matching)
    const unbilledDocOptions: SearchableOption[] = [
        { value: "", label: "Direct Bill / No Linked GRN", description: "Create purchase bill manually without linking to a GRN" },
        ...(unbilledDocs.grns || []).map(g => {
            const unbilledCount = (g.items || []).filter((i: any) => {
                const acc = Number(i.acceptedQuantity || i.receivedQuantity || 0);
                const billed = Number(i.billedQuantity || 0);
                return acc > billed;
            }).length;
            return {
                value: `grn:${g._id}`,
                label: `GRN: ${g.grnNumber} (Inv: ${g.vendorInvoiceNumber || 'N/A'}) — Status: ${g.billingStatus || 'Unbilled'}`,
                description: `${unbilledCount} unbilled item(s) • PO: ${g.purchaseOrder?.poNumber || 'Direct'}`,
                badge: g.billingStatus || 'Unbilled'
            };
        }),
        ...(unbilledDocs.jobWorks || []).map(jw => ({
            value: `jw:${jw._id}`,
            label: `Job Work Challan: ${jw.challanNumber} (${jw.processType || 'Subcontracting'})`,
            description: `Return Job Work awaiting service billing • Status: ${jw.billingStatus || 'Unbilled'}`,
            badge: "Job Work"
        }))
    ];

    // Build options for customer PO selector
    const customerPoOptions: SearchableOption[] = [
        { value: "", label: "None / Direct Sale (No Customer PO)", description: "Generate invoice without linking to a Customer PO" },
        ...customerPOs.map(po => {
            const unbilledCount = (po.items || []).filter((i: any) => (Number(i.quantity || 0) - Number(i.billedQuantity || 0)) > 0).length;
            return {
                value: po.poNumber,
                label: `${po.poNumber} (${po.date ? new Date(po.date).toLocaleDateString() : 'N/A'}) — Status: ${po.status || 'Received'}`,
                description: `${unbilledCount} unbilled item(s) available for invoicing`,
                badge: po.status,
                po
            };
        })
    ];

    const materialTypeLabelMap: Record<ItemCategoryType, string> = {
        fg: "Finished Goods (FG)",
        rm: "Raw Material (RM)",
        bo: "Bought-Out (BO)",
        consumable: "Consumables"
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 lg:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-[98vw] xl:max-w-7xl 2xl:max-w-[1600px] max-h-[94vh] flex flex-col bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                
                {/* Modal Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-indigo-50/70 to-blue-50/70 dark:from-slate-800/80 dark:to-slate-800/40 sticky top-0 z-20 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-500/25 shrink-0">
                            <FileText size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                                <span>{isEditing ? "Edit Tax Invoice" : "Create Tax Invoice / Bill"}</span>
                            </h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                Generate GST-compliant sales invoices, link customer POs, and record revenue
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-white dark:hover:bg-slate-800 transition-colors cursor-pointer active:scale-95"
                    >
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-3.5 sm:p-6 space-y-4 sm:space-y-6">

                    {/* Basic Info Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 p-5 bg-slate-50/50 dark:bg-slate-800/30 border border-slate-200/80 dark:border-slate-800 rounded-2xl">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                {isPurchase ? "Bill / Invoice #" : "Invoice Number"}
                            </label>
                            <input
                                type="text"
                                value={invoiceNumber}
                                onChange={(e) => setInvoiceNumber(e.target.value)}
                                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold dark:text-white"
                                required
                            />
                        </div>

                        <div className="space-y-1" data-has-error={!!formErrors.date}>
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                {isPurchase ? "Bill Date" : "Invoice Date"}
                            </label>
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => { setDate(e.target.value); clearError("date"); }}
                                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white"
                                required
                            />
                        </div>

                        <div className="space-y-1" data-has-error={!!formErrors.customer}>
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                {isPurchase ? "Vendor" : "Customer"} <span className="text-red-500">*</span>
                            </label>
                            <SearchableSelect
                                options={(customers || []).map((c: any) => ({
                                    value: c._id || c.id,
                                    label: c.name || c.vendorName || c.customerName || c.companyName || (isPurchase ? 'Vendor' : 'Customer'),
                                    description: c.email || c.phone || c.city || ''
                                }))}
                                value={customer}
                                hasError={!!formErrors.customer}
                                onChange={handleCustomerChange}
                                placeholder={isPurchase ? "Select Vendor..." : "Select Customer..."}
                            />
                        </div>

                        {/* 3-Way Matching for Purchase OR Customer PO Selection for Sales */}
                        {isPurchase ? (
                            <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                        <Truck size={13} className="text-indigo-600" />
                                        Unbilled GRN / JW
                                    </label>
                                    {customer && (unbilledDocs.grns.length > 0 || unbilledDocs.jobWorks.length > 0) && (
                                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-200 dark:border-emerald-800">
                                            {unbilledDocs.grns.length + unbilledDocs.jobWorks.length} Unbilled
                                        </span>
                                    )}
                                </div>
                                <SearchableSelect
                                    options={unbilledDocOptions}
                                    value={selectedGrnId ? `grn:${selectedGrnId}` : (selectedJobWorkId ? `jw:${selectedJobWorkId}` : "")}
                                    onChange={handleSelectUnbilledDoc}
                                    placeholder={
                                        !customer
                                            ? "Select vendor first..."
                                            : isLoadingUnbilledDocs
                                                ? "Loading unbilled docs..."
                                                : (unbilledDocs.grns.length === 0 && unbilledDocs.jobWorks.length === 0)
                                                    ? "No unbilled GRNs/JWs"
                                                    : "Link Unbilled GRN / JW..."
                                    }
                                    disabled={!customer || isLoadingUnbilledDocs}
                                />
                            </div>
                        ) : (
                            <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                        <ShoppingCart size={13} className="text-indigo-600" />
                                        Customer PO Ref
                                    </label>
                                    {customer && customerPOs.length > 0 && (
                                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-200 dark:border-emerald-800">
                                            {customerPOs.length} Open
                                        </span>
                                    )}
                                </div>
                                <SearchableSelect
                                    options={customerPoOptions}
                                    value={customerPoReference}
                                    onChange={handleCustomerPoSelect}
                                    placeholder={
                                        !customer 
                                            ? "Select customer first..." 
                                            : isLoadingCustomerPOs 
                                                ? "Loading open POs..." 
                                                : customerPOs.length === 0 
                                                    ? "No open POs found" 
                                                    : "Select Customer PO..."
                                    }
                                    disabled={!customer || isLoadingCustomerPOs}
                                    allowCustom={true}
                                />
                            </div>
                        )}

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Currency</label>
                            <select
                                value={currency}
                                onChange={(e) => {
                                    setCurrency(e.target.value);
                                    setCustomExchangeRate(undefined);
                                }}
                                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold dark:text-white"
                            >
                                {CURRENCY_OPTIONS.map(opt => (
                                    <option key={opt.code} value={opt.code}>{opt.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Customer PO banner & On-Demand PO Items Preview/Fetch */}
                    {customerPoReference && (
                        <div className="space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/80 px-4 py-2.5 rounded-xl text-xs text-indigo-900 dark:text-indigo-200">
                                <div className="flex items-center gap-2">
                                    <span className="font-semibold text-slate-600 dark:text-slate-300">Linked PO:</span>
                                    <span className="font-bold text-indigo-700 dark:text-indigo-300 font-mono">{customerPoReference}</span>
                                    {selectedPoUnbilledItems.length > 0 && (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                            {selectedPoUnbilledItems.length} Pending Item{selectedPoUnbilledItems.length > 1 ? "s" : ""}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    {selectedPoUnbilledItems.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => setShowPoItemsPreview((prev) => !prev)}
                                            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer active:scale-95"
                                        >
                                            <Eye size={13} />
                                            <span>{showPoItemsPreview ? "Hide PO Items" : `Preview PO Items (${selectedPoUnbilledItems.length})`}</span>
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setCustomerPoReference("");
                                            setShowPoItemsPreview(false);
                                            setSelectedPoItemKeys([]);
                                        }}
                                        className="text-indigo-600 dark:text-indigo-400 hover:underline font-bold text-[11px] ml-1 cursor-pointer"
                                    >
                                        Clear Link
                                    </button>
                                </div>
                            </div>

                            {showPoItemsPreview && selectedPoUnbilledItems.length > 0 && (
                                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 shadow-sm space-y-3 animate-in fade-in duration-150">
                                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                                        <div className="flex items-center gap-2">
                                            <Package size={15} className="text-indigo-600" />
                                            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                                                PO #{customerPoReference} — Listed Items Preview
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setSelectedPoItemKeys(
                                                        selectedPoItemKeys.length === selectedPoUnbilledItems.length
                                                            ? []
                                                            : selectedPoUnbilledItems.map((e: any) => e.key)
                                                    )
                                                }
                                                className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                                            >
                                                {selectedPoItemKeys.length === selectedPoUnbilledItems.length ? "Deselect All" : "Select All"}
                                            </button>
                                            <button
                                                type="button"
                                                disabled={selectedPoItemKeys.length === 0}
                                                onClick={handleFetchSelectedPoItems}
                                                className="px-3.5 py-1.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                Fetch Selected ({selectedPoItemKeys.length}) into Invoice
                                            </button>
                                        </div>
                                    </div>

                                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                                        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                                            <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 uppercase font-bold text-[10px]">
                                                <tr>
                                                    <th className="px-3 py-2 text-center w-10">Pick</th>
                                                    <th className="px-3 py-2 text-left">Item Name &amp; Description</th>
                                                    <th className="px-3 py-2 text-right">Ordered</th>
                                                    <th className="px-3 py-2 text-right">Pending Qty</th>
                                                    <th className="px-3 py-2 text-right">Rate ({getCurrencySymbol(currency)})</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                {selectedPoUnbilledItems.map((entry: any) => {
                                                    const { key, poItem, orderedQty, remainingQty } = entry;
                                                    const isChecked = selectedPoItemKeys.includes(key);
                                                    const pName = poItem.productName || poItem.fgItem?.name || "Product Item";
                                                    const pDesc = poItem.description || poItem.fgItem?.description || poItem.descriptions || "";
                                                    const pRate = Number(poItem.rate || poItem.pricePerQuantity || 0);
                                                    return (
                                                        <tr
                                                            key={key}
                                                            onClick={() =>
                                                                setSelectedPoItemKeys((prev) =>
                                                                    prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
                                                                )
                                                            }
                                                            className={`cursor-pointer transition-colors ${isChecked ? "bg-indigo-50/40 dark:bg-indigo-950/30" : "hover:bg-slate-50 dark:hover:bg-slate-800/40"}`}
                                                        >
                                                            <td className="px-3 py-2 text-center">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isChecked}
                                                                    onChange={() => {}}
                                                                    className="w-3.5 h-3.5 text-indigo-600 rounded cursor-pointer"
                                                                />
                                                            </td>
                                                            <td className="px-3 py-2">
                                                                <div className="font-bold text-slate-900 dark:text-white">{pName}</div>
                                                                {pDesc && <div className="text-[11px] text-slate-500 italic line-clamp-2">{pDesc}</div>}
                                                            </td>
                                                            <td className="px-3 py-2 text-right font-mono text-slate-500">
                                                                {orderedQty} {poItem.unit || "PCS"}
                                                            </td>
                                                            <td className="px-3 py-2 text-right font-mono font-bold text-indigo-700 dark:text-indigo-300">
                                                                {remainingQty} {poItem.unit || "PCS"}
                                                            </td>
                                                            <td className="px-3 py-2 text-right font-mono font-semibold text-slate-900 dark:text-white">
                                                                {pRate.toFixed(2)}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Items Section */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800">
                            <div>
                                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                    <Package className="w-5 h-5 text-indigo-600" />
                                    Invoice Line Items ({items.length})
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={addItem}
                                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/40 border border-indigo-200 dark:border-indigo-800 rounded-xl hover:bg-indigo-100 transition-colors shadow-sm cursor-pointer"
                            >
                                <Plus size={16} /> Add Item
                            </button>
                        </div>

                        {/* Line Items List */}
                        <div className="space-y-3.5">
                            {items.map((entry, index) => {
                                const currentItemId = entry.fgItem || entry.rawMaterial || entry.boughtOut || entry.consumableItem || '';
                                const currentOptions = initialItemOptions;
                                const isLastItem = index === items.length - 1;
                                const rowTypeBadge = entry.itemType === 'rm' ? 'RM' : entry.itemType === 'bo' ? 'BO' : entry.itemType === 'consumable' ? 'Consumable' : 'FG';
                                
                                // Ensure current item is present in options list
                                const rowOptions = [...currentOptions];
                                if (currentItemId && entry.materialName && !rowOptions.some(o => o.value === currentItemId)) {
                                    rowOptions.unshift({
                                        value: currentItemId,
                                        label: entry.description ? `${entry.materialName} — ${entry.description}` : entry.materialName,
                                        description: entry.description,
                                        name: entry.materialName,
                                        unit: entry.unit,
                                        hsnCode: entry.hsnCode,
                                        badge: rowTypeBadge,
                                        currentStock: entry.availableStock
                                    });
                                }

                                return (
                                    <div key={index} className="p-4 bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xs space-y-3 transition-all hover:border-slate-300 dark:hover:border-slate-600">
                                        
                                        {/* Row Top Header: Item Number, Category Badge & Action Buttons */}
                                        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800">
                                            <div className="flex items-center gap-2">
                                                <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center text-[11px] font-bold">
                                                    {index + 1}
                                                </span>
                                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                                    Item #{index + 1}
                                                </span>
                                                <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                                                    entry.itemType === 'rm'
                                                        ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                                                        : entry.itemType === 'bo'
                                                        ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                                                        : entry.itemType === 'consumable'
                                                        ? 'bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800'
                                                        : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                                                }`}>
                                                    {entry.materialName ? rowTypeBadge : 'ALL TYPES'}
                                                </span>
                                            </div>

                                            {/* Action Buttons: Add Item on last row + Delete Item */}
                                            <div className="flex items-center gap-1.5">
                                                {isLastItem && (
                                                    <button
                                                        type="button"
                                                        onClick={addItem}
                                                        className="px-2.5 py-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/70 border border-indigo-200 dark:border-indigo-800 rounded-xl flex items-center gap-1 transition-all shadow-xs cursor-pointer"
                                                        title="Add another item"
                                                    >
                                                        <Plus size={14} />
                                                        <span>Add Item</span>
                                                    </button>
                                                )}

                                                <button
                                                    type="button"
                                                    onClick={() => removeItem(index)}
                                                    disabled={items.length <= 1}
                                                    className="px-2 py-1 text-rose-500 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-xl transition-all disabled:opacity-20 disabled:pointer-events-none cursor-pointer border border-transparent hover:border-rose-200 dark:hover:border-rose-800 flex items-center gap-1 text-xs font-semibold"
                                                    title={items.length <= 1 ? "At least one item is required" : "Delete this line item"}
                                                >
                                                    <Trash2 size={14} />
                                                    <span className="hidden sm:inline">Delete</span>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Line Item Inputs */}
                                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-start">
                                            {/* Item Search via On-Demand Debounced asyncSearch */}
                                            <div className="md:col-span-4 space-y-1.5" data-has-error={!!formErrors[`item_${index}_id`]}>
                                                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase flex items-center justify-between">
                                                    <span>Item Name & Description <span className="text-red-500">*</span></span>
                                                    {formErrors[`item_${index}_id`] && (
                                                        <span className="text-[10px] text-rose-600 font-bold lowercase">
                                                            {formErrors[`item_${index}_id`]}
                                                        </span>
                                                    )}
                                                </label>

                                                <SearchableSelect
                                                    options={rowOptions}
                                                    value={currentItemId}
                                                    displayLabel={entry.description ? `${entry.materialName} — ${entry.description}` : entry.materialName}
                                                    hasError={!!formErrors[`item_${index}_id`]}
                                                    asyncSearch={searchItemsAsync}
                                                    onChange={(val: string) => handleItemSelection(index, val)}
                                                    placeholder="Search any FG, RM, BO or Consumable item..."
                                                />

                                                {/* Editable Technical Description input directly below item name */}
                                                <input
                                                    type="text"
                                                    value={entry.description || ''}
                                                    onChange={e => updateItem(index, 'description', e.target.value)}
                                                    placeholder="Technical Description / Specification..."
                                                    className="w-full px-2.5 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-lg text-[11px] text-slate-600 dark:text-slate-300 italic placeholder:not-italic focus:ring-1 focus:ring-indigo-500/30"
                                                    title="Item Technical Description"
                                                />

                                                {/* Stock badge */}
                                                {entry.materialName && entry.availableStock !== undefined && (
                                                    <div className="mt-0.5">
                                                        {entry.availableStock <= 0 ? (
                                                            <span className="text-[10px] font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-800 inline-flex items-center gap-1">
                                                                <AlertTriangle size={11} /> Low / Out of Stock (Avail: 0 {entry.unit})
                                                            </span>
                                                        ) : Number(entry.quantity) > Number(entry.availableStock) ? (
                                                            <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800 inline-flex items-center gap-1">
                                                                <AlertTriangle size={11} /> Stock: {entry.availableStock} {entry.unit} (Req: {entry.quantity})
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 inline-flex items-center gap-1">
                                                                <CheckCircle2 size={11} /> Available Stock: {entry.availableStock} {entry.unit}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* HSN */}
                                            <div className="md:col-span-2 space-y-1.5">
                                                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">HSN Code</label>
                                                <input
                                                    type="text"
                                                    value={entry.hsnCode || ''}
                                                    onChange={e => updateItem(index, 'hsnCode', e.target.value)}
                                                    placeholder="HSN Code"
                                                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white"
                                                />
                                            </div>

                                            {/* Quantity & Unit */}
                                            <div className="md:col-span-2 space-y-1.5" data-has-error={!!formErrors[`item_${index}_quantity`]}>
                                                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">Qty & Unit</label>
                                                <div className="flex gap-1.5">
                                                    <input
                                                        type="number"
                                                        min="0.01"
                                                        step="0.01"
                                                        value={entry.quantity || ''}
                                                        onChange={e => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                                                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-center dark:text-white"
                                                        placeholder="Qty"
                                                        required
                                                    />
                                                    <input
                                                        type="text"
                                                        value={entry.unit || 'PCS'}
                                                        onChange={e => updateItem(index, 'unit', e.target.value)}
                                                        className="w-14 px-1.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-center font-semibold dark:text-white"
                                                        placeholder="Unit"
                                                    />
                                                </div>
                                            </div>

                                            {/* Rate */}
                                            <div className="md:col-span-2 space-y-1.5">
                                                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">
                                                    Unit Rate ({getCurrencySymbol(currency)})
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={entry.rate || ''}
                                                    onChange={e => updateItem(index, 'rate', parseFloat(e.target.value) || 0)}
                                                    className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium dark:text-white"
                                                    placeholder="Rate"
                                                    required
                                                />
                                            </div>

                                            {/* Tax Rate & Total */}
                                            <div className="md:col-span-2 space-y-1.5">
                                                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">
                                                    Tax & Total
                                                </label>
                                                <div className="flex gap-1.5">
                                                    <select
                                                        value={entry.taxRate || 0}
                                                        onChange={e => updateItem(index, 'taxRate', parseFloat(e.target.value) || 0)}
                                                        className="w-16 px-1 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold dark:text-white"
                                                    >
                                                        <option value={0}>0%</option>
                                                        <option value={5}>5%</option>
                                                        <option value={12}>12%</option>
                                                        <option value={18}>18%</option>
                                                        <option value={28}>28%</option>
                                                    </select>
                                                    <div className="flex-1 px-2 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-end truncate">
                                                        {getCurrencySymbol(currency)} {((entry.amount || 0) + (entry.taxAmount || 0)).toFixed(2)}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Bottom Add Item Area */}
                        <div className="pt-2">
                            <button
                                type="button"
                                onClick={addItem}
                                className="w-full py-3 px-4 border-2 border-dashed border-indigo-200 dark:border-indigo-800/80 hover:border-indigo-500 dark:hover:border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/20 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-bold rounded-2xl text-xs flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer active:scale-[0.99]"
                            >
                                <Plus size={16} className="text-indigo-600 dark:text-indigo-400" />
                                <span>+ Add Another Line Item</span>
                            </button>
                        </div>
                    </div>

                    {/* Compact Single-Line Logistics, Charges & GST Type Bar */}
                    <div className="bg-slate-50/80 dark:bg-slate-800/40 p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 items-end">
                            {/* Transport Mode Dropdown */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                                    <Truck size={12} className="text-indigo-600" /> Transport Mode
                                </label>
                                <select
                                    value={transportationType}
                                    onChange={(e) => setTransportationType(e.target.value)}
                                    className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold dark:text-white"
                                >
                                    <option value="Road Transport">Road Transport</option>
                                    <option value="Rail Transport">Rail Transport</option>
                                    <option value="Air Transport">Air Transport</option>
                                    <option value="Ship / Sea">Ship / Sea</option>
                                    <option value="Courier">Courier</option>
                                    <option value="By Hand">By Hand</option>
                                </select>
                            </div>

                            {/* Vehicle Number */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Vehicle No</label>
                                <input
                                    type="text"
                                    value={vehicleNumber}
                                    onChange={e => setVehicleNumber(e.target.value.toUpperCase())}
                                    placeholder="MH-12-AB-1234"
                                    className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white font-mono uppercase"
                                />
                            </div>

                            {/* Transportation Charge + Compact GST Toggle */}
                            <div className="space-y-1">
                                <div className="flex items-center justify-between gap-1">
                                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 truncate">
                                        Transport ({getCurrencySymbol(currency)})
                                    </label>
                                    <label className="inline-flex items-center gap-1 cursor-pointer text-[10px] font-bold text-indigo-700 dark:text-indigo-300 shrink-0">
                                        <input
                                            type="checkbox"
                                            checked={isTransportTaxable}
                                            onChange={(e) => setIsTransportTaxable(e.target.checked)}
                                            className="w-3 h-3 text-indigo-600 rounded cursor-pointer"
                                        />
                                        <span>GST</span>
                                    </label>
                                </div>
                                <div className="flex items-center gap-1">
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={transportationCharges || ''}
                                        onChange={e => setTransportationCharges(parseFloat(e.target.value) || 0)}
                                        placeholder="0.00"
                                        className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold dark:text-white"
                                    />
                                    {isTransportTaxable && (
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            step="0.5"
                                            value={transportTaxRate}
                                            onChange={(e) => setTransportTaxRate(parseFloat(e.target.value) || 0)}
                                            className="w-12 px-1.5 py-1.5 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 rounded-lg text-[11px] font-bold text-indigo-700 dark:text-indigo-300 text-center shrink-0"
                                            title="GST % on Transportation"
                                        />
                                    )}
                                </div>
                            </div>

                            {/* Packaging Charge + Compact GST Toggle */}
                            <div className="space-y-1">
                                <div className="flex items-center justify-between gap-1">
                                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 truncate">
                                        Packaging ({getCurrencySymbol(currency)})
                                    </label>
                                    <label className="inline-flex items-center gap-1 cursor-pointer text-[10px] font-bold text-indigo-700 dark:text-indigo-300 shrink-0">
                                        <input
                                            type="checkbox"
                                            checked={isPackagingTaxable}
                                            onChange={(e) => setIsPackagingTaxable(e.target.checked)}
                                            className="w-3 h-3 text-indigo-600 rounded cursor-pointer"
                                        />
                                        <span>GST</span>
                                    </label>
                                </div>
                                <div className="flex items-center gap-1">
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={packagingCharges || ''}
                                        onChange={e => setPackagingCharges(parseFloat(e.target.value) || 0)}
                                        placeholder="0.00"
                                        className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold dark:text-white"
                                    />
                                    {isPackagingTaxable && (
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            step="0.5"
                                            value={packagingTaxRate}
                                            onChange={(e) => setPackagingTaxRate(parseFloat(e.target.value) || 0)}
                                            className="w-12 px-1.5 py-1.5 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 rounded-lg text-[11px] font-bold text-indigo-700 dark:text-indigo-300 text-center shrink-0"
                                            title="GST % on Packaging"
                                        />
                                    )}
                                </div>
                            </div>

                            {/* Discount */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                                    Discount ({getCurrencySymbol(currency)})
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={discount || ''}
                                    onChange={e => setDiscount(parseFloat(e.target.value) || 0)}
                                    placeholder="0.00"
                                    className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold dark:text-white"
                                />
                            </div>

                            {/* GST Tax Type Dropdown (Intra-State vs Inter-State) */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                                    <Calculator size={12} className="text-indigo-600" /> Tax Type (GST)
                                </label>
                                <select
                                    value={gstSupplyType}
                                    onChange={(e) => setGstSupplyType(e.target.value === "inter" ? "inter" : "intra")}
                                    className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-700 rounded-xl text-xs font-bold text-indigo-700 dark:text-indigo-300"
                                >
                                    <option value="intra">Intra-State (CGST + SGST)</option>
                                    <option value="inter">Inter-State (IGST)</option>
                                </select>
                            </div>
                        </div>

                        {/* Compact Remarks Input */}
                        <div className="flex items-center gap-2 pt-1">
                            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 shrink-0">Remarks:</label>
                            <input
                                type="text"
                                value={otherDetails}
                                onChange={e => setOtherDetails(e.target.value)}
                                placeholder="Dispatched via, delivery notes, or payment remarks..."
                                className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white"
                            />
                        </div>
                    </div>

                    {/* Financial Summary & Multi-Currency Conversion Area */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-2">
                        {/* LEFT: Multi-Currency Conversion (if foreign) */}
                        <div className="lg:col-span-7">
                            {inrConversion.isForeign ? (
                                <div className="bg-gradient-to-br from-indigo-50 via-blue-50 to-emerald-50 dark:from-slate-800/90 dark:to-slate-800/40 border border-blue-200/80 dark:border-slate-700 rounded-2xl p-4 shadow-sm space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h4 className="font-extrabold text-sm text-blue-900 dark:text-blue-200 flex items-center gap-2">
                                            <ArrowRightLeft size={16} className="text-blue-600 dark:text-blue-400" />
                                            Live Multi-Currency Conversion to INR (₹)
                                        </h4>
                                        <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded-md border border-indigo-200 dark:border-indigo-800">
                                            Currency Conversion
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                        <div className="bg-white/80 dark:bg-slate-900/80 border border-blue-100 dark:border-slate-700/60 p-3 rounded-xl">
                                            <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold block mb-0.5">
                                                Exchange Rate (1 {currency})
                                            </span>
                                            {isEditingExchangeRate ? (
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">₹</span>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={customExchangeRate ?? inrConversion.rate}
                                                        onChange={(e) => setCustomExchangeRate(parseFloat(e.target.value) || 1)}
                                                        className="w-24 px-2 py-1 bg-white dark:bg-slate-800 border rounded-lg text-xs font-bold"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsEditingExchangeRate(false)}
                                                        className="text-xs text-indigo-600 font-bold cursor-pointer"
                                                    >
                                                        Save
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-between mt-0.5">
                                                    <span className="text-base font-extrabold text-indigo-700 dark:text-indigo-300">
                                                        ₹{inrConversion.rate.toFixed(2)} INR
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsEditingExchangeRate(true)}
                                                        className="text-[11px] text-slate-500 hover:text-indigo-600 underline font-medium cursor-pointer"
                                                    >
                                                        Custom Rate
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        <div className="bg-white/80 dark:bg-slate-900/80 border border-emerald-100 dark:border-slate-700/60 p-3 rounded-xl">
                                            <span className="text-[10px] text-emerald-700 dark:text-emerald-400 uppercase font-bold block mb-0.5">
                                                Equivalent INR Total
                                            </span>
                                            <span className="text-lg font-black text-emerald-700 dark:text-emerald-400 mt-0.5 block">
                                                {inrConversion.formattedINR}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ) : null}
                        </div>

                        {/* RIGHT: Financial Totals Summary */}
                        <div className="lg:col-span-5 space-y-2 bg-slate-50/80 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs">
                            <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                <span>Subtotal:</span>
                                <span className="font-bold text-slate-900 dark:text-white">
                                    {getCurrencySymbol(currency)} {subtotal.toFixed(2)}
                                </span>
                            </div>

                            {Number(transportationCharges) > 0 && (
                                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                    <span>
                                        Transportation Charges{isTransportTaxable ? ` (Taxable @ ${transportTaxRate}%)` : ""}:
                                    </span>
                                    <span className="font-semibold text-slate-900 dark:text-white">
                                        + {getCurrencySymbol(currency)} {Number(transportationCharges).toFixed(2)}
                                    </span>
                                </div>
                            )}

                            {Number(packagingCharges) > 0 && (
                                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                    <span>
                                        Packaging Charges{isPackagingTaxable ? ` (Taxable @ ${packagingTaxRate}%)` : ""}:
                                    </span>
                                    <span className="font-semibold text-slate-900 dark:text-white">
                                        + {getCurrencySymbol(currency)} {Number(packagingCharges).toFixed(2)}
                                    </span>
                                </div>
                            )}

                            {gstSupplyType === "intra" ? (
                                <>
                                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                        <span>CGST:</span>
                                        <span className="font-bold text-slate-900 dark:text-white">
                                            + {getCurrencySymbol(currency)} {cgstAmount.toFixed(2)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                        <span>SGST:</span>
                                        <span className="font-bold text-slate-900 dark:text-white">
                                            + {getCurrencySymbol(currency)} {sgstAmount.toFixed(2)}
                                        </span>
                                    </div>
                                </>
                            ) : (
                                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                    <span>IGST (Inter-State):</span>
                                    <span className="font-bold text-slate-900 dark:text-white">
                                        + {getCurrencySymbol(currency)} {igstAmount.toFixed(2)}
                                    </span>
                                </div>
                            )}

                            {Number(discount) > 0 && (
                                <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                                    <span>Discount:</span>
                                    <span className="font-semibold">
                                        - {getCurrencySymbol(currency)} {Number(discount).toFixed(2)}
                                    </span>
                                </div>
                            )}

                            <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
                                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                                    <input
                                        type="checkbox"
                                        checked={isRoundOffEnabled}
                                        onChange={(e) => setIsRoundOffEnabled(e.target.checked)}
                                        className="w-3.5 h-3.5 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
                                    />
                                    <span>Round Off Grand Total</span>
                                </label>
                                {isRoundOffEnabled && rounding.roundOff !== 0 && (
                                    <span className={`font-mono font-bold ${rounding.roundOff >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                        {rounding.roundOff > 0 ? '+' : ''}{getCurrencySymbol(currency)} {rounding.roundOff.toFixed(2)}
                                    </span>
                                )}
                            </div>

                            <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between text-sm font-extrabold text-slate-900 dark:text-white">
                                <span>Total Payable:</span>
                                <span className="text-base text-indigo-600 dark:text-indigo-400">
                                    {getCurrencySymbol(currency)} {totalAmount.toFixed(2)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* LAST SECTION: Terms & Conditions + Company Bank Details */}
                    <div className="space-y-4 pt-3 border-t border-slate-200 dark:border-slate-800">
                        {/* Terms & Conditions */}
                        <div className="bg-slate-50/80 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2.5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <FileText size={15} className="text-indigo-600 dark:text-indigo-400" />
                                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                                        Terms &amp; Conditions
                                    </h4>
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => setTermsAndConditions(prev => prev ? `${prev}\n• Payment due within 30 days from invoice date.` : `• Payment due within 30 days from invoice date.`)}
                                        className="px-2 py-0.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-semibold rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                    >
                                        + 30-Day Credit
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setTermsAndConditions(prev => prev ? `${prev}\n• Goods once sold will not be accepted back or exchanged.` : `• Goods once sold will not be accepted back or exchanged.`)}
                                        className="px-2 py-0.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-semibold rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                    >
                                        + No Return Policy
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setTermsAndConditions(prev => prev ? `${prev}\n• Overdue interest @ 18% p.a. will be levied after due date.` : `• Overdue interest @ 18% p.a. will be levied after due date.`)}
                                        className="px-2 py-0.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-semibold rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                    >
                                        + 18% Overdue Interest
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setTermsAndConditions(prev => prev ? `${prev}\n• Subject to local jurisdiction only.` : `• Subject to local jurisdiction only.`)}
                                        className="px-2 py-0.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-semibold rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                    >
                                        + Local Jurisdiction
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setTermsAndConditions(getMasterTerms())}
                                        className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-bold flex items-center gap-1 ml-1 cursor-pointer"
                                    >
                                        <RotateCcw size={11} /> Reset
                                    </button>
                                </div>
                            </div>

                            <textarea
                                rows={3}
                                value={termsAndConditions}
                                onChange={e => setTermsAndConditions(e.target.value)}
                                placeholder="Enter custom terms and conditions for this invoice..."
                                className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white leading-relaxed resize-y font-mono"
                            />
                        </div>

                        {/* Company Bank Details */}
                        <div className="bg-slate-50/80 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700/80 pb-2.5">
                                <div className="flex items-center gap-2">
                                    <Building2 size={15} className="text-indigo-600 dark:text-indigo-400" />
                                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                                        Company Bank Details
                                    </h4>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setBankDetails(getMasterBankDetails())}
                                    className="px-2.5 py-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-lg shadow-xs hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-all flex items-center gap-1 cursor-pointer"
                                >
                                    <RotateCcw size={11} /> Reset to Master
                                </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Account Holder Name</label>
                                    <input
                                        type="text"
                                        value={bankDetails.accountName}
                                        onChange={e => setBankDetails(prev => ({ ...prev, accountName: e.target.value }))}
                                        placeholder="Company Name"
                                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white font-medium"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Bank Name</label>
                                    <input
                                        type="text"
                                        value={bankDetails.bankName}
                                        onChange={e => setBankDetails(prev => ({ ...prev, bankName: e.target.value }))}
                                        placeholder="e.g. HDFC Bank"
                                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white font-medium"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Account Number</label>
                                    <input
                                        type="text"
                                        value={bankDetails.accountNumber}
                                        onChange={e => setBankDetails(prev => ({ ...prev, accountNumber: e.target.value }))}
                                        placeholder="Account Number"
                                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white font-mono font-bold"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">IFSC Code</label>
                                    <input
                                        type="text"
                                        value={bankDetails.ifscCode}
                                        onChange={e => setBankDetails(prev => ({ ...prev, ifscCode: e.target.value.toUpperCase() }))}
                                        placeholder="IFSC Code"
                                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white font-mono font-bold uppercase"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Branch Name</label>
                                    <input
                                        type="text"
                                        value={bankDetails.branch}
                                        onChange={e => setBankDetails(prev => ({ ...prev, branch: e.target.value }))}
                                        placeholder="Branch Name"
                                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white font-medium"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Inline Alert Banner for Stock / Validation / API Errors */}
                    {submitError && (
                        <div
                            role="alert"
                            className="flex items-start gap-3 px-4 py-3 mt-4 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 shadow-sm animate-in fade-in duration-150"
                        >
                            <AlertTriangle size={18} className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                            <div className="flex-1 text-xs sm:text-sm font-semibold leading-snug">
                                {submitError}
                            </div>
                            <button
                                type="button"
                                onClick={() => setSubmitError(null)}
                                className="p-1 text-rose-500 hover:text-rose-700 dark:hover:text-rose-200 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors cursor-pointer"
                                title="Dismiss alert"
                            >
                                <X size={15} />
                            </button>
                        </div>
                    )}

                    {/* Bottom Actions */}
                    <div className="flex items-center justify-end gap-3 px-6 py-4 -mx-3.5 sm:-mx-6 -mb-3.5 sm:-mb-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 shrink-0 mt-6">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="px-4.5 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading || isSubmitting}
                            className="px-6 py-2.5 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 rounded-xl shadow-md shadow-indigo-500/25 hover:shadow-lg hover:shadow-indigo-500/35 transition-all cursor-pointer flex items-center gap-2 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {(loading || isSubmitting) && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                            <span>{(loading || isSubmitting) ? "Saving..." : (isEditing ? "Update Tax Invoice" : "Create Tax Invoice")}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

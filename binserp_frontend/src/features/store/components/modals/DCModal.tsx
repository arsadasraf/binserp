/**
 * DC Modal Component
 * Modal form for creating and editing Delivery Challans (DC)
 * Top-Level Material Category Selector: FG, Raw Material (RM), Bought-Out (BO), and Consumables
 * Strict Single Material Category Rule: Only one type of material can be in a DC at once
 * High-performance debounced on-demand keyword search avoiding bulk item downloads
 * Strict Item Display Standard: Item Name with Technical Description (Never raw item codes)
 * Live Customer Open PO selection & undispatched item auto-population
 * Inline "Add Item" at the bottom of the item list
 * Company Bank Details auto-populated from Master with per-DC override
 * Customizable Terms & Conditions with quick preset chips
 */

"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
    X, Plus, Trash2, Package, User, Calendar, Hash, FileText, Truck,
    CheckCircle2, AlertTriangle, Cog, Layers, FlaskConical,
    ArrowRightLeft, ShoppingCart, Building2, RotateCcw
} from "lucide-react";
import { DCModalProps, RmBoItem, CompanyInfo } from "@/src/features/store/types/store.types";
import SearchableSelect, { SearchableOption } from "../SearchableSelect";
import { getCurrencySymbol, CURRENCY_OPTIONS, convertToINR } from "@/src/utils/currencyHelper";
import { apiRequest } from "@/src/lib/api";

interface ExtendedDCModalProps extends DCModalProps {
    materials?: RmBoItem[];
    inHouseItems?: any[];
    fgItems?: any[];
    companyInfo?: CompanyInfo;
}

export type ItemCategoryType = 'fg' | 'rm' | 'bo' | 'consumable';

interface DCItemEntry {
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
    rate?: number;
    amount?: number;
    availableStock?: number;
    description?: string;
}

export default function DCModal({
    isOpen,
    onClose,
    onSubmit,
    customers = [],
    loading,
    initialData,
    isEditing = false,
    companyInfo,
}: ExtendedDCModalProps) {
    const [dcNumber, setDcNumber] = useState("");
    const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
    const [customer, setCustomer] = useState("");
    const [customerName, setCustomerName] = useState("");
    const [customerAddress, setCustomerAddress] = useState("");
    const [customerPoReference, setCustomerPoReference] = useState("");
    const [currency, setCurrency] = useState("INR");
    const [customExchangeRate, setCustomExchangeRate] = useState<number | undefined>(undefined);
    const [isEditingExchangeRate, setIsEditingExchangeRate] = useState(false);

    // Single DC-Level Material Type on Top
    const [dcMaterialType, setDcMaterialType] = useState<ItemCategoryType>('fg');

    const [transportationType, setTransportationType] = useState("Road Transport");
    const [transportationCharges, setTransportationCharges] = useState(0);
    const [vehicleNumber, setVehicleNumber] = useState("");
    const [packagingType, setPackagingType] = useState("Standard Packaging");
    const [packagingCharges, setPackagingCharges] = useState(0);
    const [discount, setDiscount] = useState(0);
    const [otherDetails, setOtherDetails] = useState("");
    const [status, setStatus] = useState("Draft");
    const [reduceStock, setReduceStock] = useState(true);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});

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
                console.error("DCModal: Error fetching company info master:", err);
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

    const DEFAULT_DC_TERMS = 
`1. Material delivered against this Delivery Challan is subject to terms agreed in the purchase contract.
2. Goods must be verified and acknowledged upon receipt by an authorized receiver.
3. Any discrepancy or damage must be notified within 24 hours of delivery.
4. Subject to local jurisdiction only.`;

    const getMasterTerms = useCallback(() => {
        return resolvedCompany?.printSettings?.dc?.termsAndConditions || resolvedCompany?.printSettings?.invoice?.termsAndConditions || resolvedCompany?.commercialTerms || DEFAULT_DC_TERMS;
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

    // Item options cache per category & selected items cache
    const [categoryInitialOptions, setCategoryInitialOptions] = useState<Record<ItemCategoryType, SearchableOption[]>>({
        fg: [],
        rm: [],
        bo: [],
        consumable: []
    });
    const itemDetailsCacheRef = useRef<Map<string, any>>(new Map());

    const clearError = (key: string) => {
        setFormErrors(prev => {
            if (!prev[key]) return prev;
            const next = { ...prev };
            delete next[key];
            return next;
        });
    };

    const [items, setItems] = useState<DCItemEntry[]>([{
        itemType: 'fg',
        fgItem: "",
        materialName: "",
        hsnCode: "",
        quantity: 1,
        unit: "PCS",
        rate: 0,
        amount: 0,
        description: ""
    }]);

    const generateDCNumber = () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");
        const hours = String(now.getHours()).padStart(2, "0");
        const mins = String(now.getMinutes()).padStart(2, "0");
        return `DC/${year}${month}${day}-${hours}${mins}`;
    };

    // Fast keyword search using backend search endpoint
    const searchItemsAsync = useCallback(async (type: ItemCategoryType, query: string): Promise<SearchableOption[]> => {
        try {
            const res = await apiRequest(`/api/store/items/search?type=${type}&query=${encodeURIComponent(query)}&limit=30`);
            if (!res.ok) return [];
            const data = await res.json();
            const fetched = (data.items || []).map((item: any) => {
                const descStr = item.description || item.descriptions || '';
                const option: SearchableOption = {
                    value: String(item.value || item._id),
                    label: descStr ? `${item.name} — ${descStr}` : item.name,
                    description: descStr,
                    code: item.code || '',
                    name: item.name,
                    unit: item.unit || 'PCS',
                    hsnCode: item.hsnCode || '',
                    currentStock: item.currentStock !== undefined ? item.currentStock : (item.quantity || 0),
                    rate: Number(item.rate || item.price || item.sellingPrice || 0),
                    badge: item.badge,
                    subBadge: item.subBadge,
                    rawItem: item
                };
                itemDetailsCacheRef.current.set(String(option.value), option);
                return option;
            });
            return fetched;
        } catch (err) {
            console.error("Error searching store items for DC:", err);
            return [];
        }
    }, []);

    // Preload top 30 items for category if not already loaded
    const preloadCategoryOptions = useCallback(async (category: ItemCategoryType) => {
        if (categoryInitialOptions[category]?.length > 0) return;
        const initial = await searchItemsAsync(category, "");
        setCategoryInitialOptions(prev => ({
            ...prev,
            [category]: initial
        }));
    }, [categoryInitialOptions, searchItemsAsync]);

    // Preload default category on modal open
    useEffect(() => {
        if (isOpen) {
            preloadCategoryOptions(dcMaterialType);
        }
    }, [isOpen, dcMaterialType, preloadCategoryOptions]);

    // Top-Level Material Category Switcher: Only one type of material per DC
    const handleDcMaterialTypeChange = (newType: ItemCategoryType) => {
        if (newType === dcMaterialType) return;

        const hasEnteredData = items.some(i => i.materialName || i.fgItem || i.rawMaterial || i.boughtOut || i.consumableItem);
        if (hasEnteredData) {
            const confirmed = window.confirm(
                `Switching material category to ${newType.toUpperCase()} will reset all current line items, as only one material type can be included per Delivery Challan. Proceed?`
            );
            if (!confirmed) return;
        }

        setDcMaterialType(newType);
        preloadCategoryOptions(newType);

        // Reset items to single blank row with the new material type
        setItems([{
            itemType: newType,
            fgItem: "",
            rawMaterial: "",
            boughtOut: "",
            consumableItem: "",
            materialName: "",
            hsnCode: "",
            quantity: 1,
            unit: newType === 'rm' ? 'KGS' : 'PCS',
            rate: 0,
            amount: 0,
            description: ""
        }]);
    };

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
            console.error("Failed to load customer open POs for DC:", err);
            setCustomerPOs([]);
        } finally {
            setIsLoadingCustomerPOs(false);
        }
    }, []);

    // Handle Customer Selection
    const handleCustomerChange = (val: string) => {
        setCustomer(val);
        const cust: any = customers.find((c: any) => (c._id || c.id) === val);
        if (cust) {
            setCustomerName(cust.name || cust.customerName || cust.companyName || "");
            setCustomerAddress(cust.address || cust.billingAddress || cust.shippingAddress || "");
        } else {
            setCustomerName("");
            setCustomerAddress("");
        }
        setCustomerPoReference("");
        clearError("customer");
        if (val) {
            fetchOpenCustomerPOs(val);
        } else {
            setCustomerPOs([]);
        }
    };

    // Handle Customer PO Selection & Auto-fill line items
    const handleCustomerPoSelect = (poNumber: string) => {
        setCustomerPoReference(poNumber);
        if (!poNumber) return;

        const selectedPO = customerPOs.find(p => p.poNumber === poNumber);
        if (!selectedPO || !Array.isArray(selectedPO.items)) return;

        // Extract items with remaining undispatched quantities
        const undispatchedItems = selectedPO.items
            .map((poItem: any) => {
                const orderedQty = Number(poItem.quantity || 0);
                const dispatchedQty = Number(poItem.dispatchedQuantity || 0);
                const remainingQty = Math.max(0, orderedQty - dispatchedQty);
                return { poItem, remainingQty };
            })
            .filter(({ remainingQty }: { poItem: any; remainingQty: number }) => remainingQty > 0);

        if (undispatchedItems.length === 0) return;

        // Detect material category of the PO items
        const firstPoItem = undispatchedItems[0].poItem;
        let detectedType: ItemCategoryType = 'fg';
        if (firstPoItem.rawMaterial) detectedType = 'rm';
        else if (firstPoItem.boughtOut) detectedType = 'bo';
        else if (firstPoItem.consumableItem) detectedType = 'consumable';

        setDcMaterialType(detectedType);
        preloadCategoryOptions(detectedType);

        // Auto-fill DC items
        const newItems: DCItemEntry[] = undispatchedItems.map(({ poItem, remainingQty }: { poItem: any; remainingQty: number }) => {
            const itemId = poItem.fgItem?._id || poItem.fgItem || poItem.rawMaterial?._id || poItem.rawMaterial || poItem.boughtOut?._id || poItem.boughtOut || poItem.consumableItem?._id || poItem.consumableItem || poItem.material || "";
            const rate = Number(poItem.rate || poItem.unitPrice || poItem.price || 0);
            const amt = remainingQty * rate;
            const name = poItem.materialName || poItem.productName || poItem.name || "";
            const desc = poItem.description || poItem.descriptions || "";

            if (itemId) {
                itemDetailsCacheRef.current.set(String(itemId), {
                    value: String(itemId),
                    label: desc ? `${name} — ${desc}` : name,
                    name,
                    description: desc,
                    unit: poItem.unit || "PCS",
                    hsnCode: poItem.hsnCode || "",
                    currentStock: 999,
                    rate
                });
            }

            return {
                itemType: detectedType,
                poItemId: poItem._id || poItem.id,
                fgItem: detectedType === 'fg' ? itemId : undefined,
                rawMaterial: detectedType === 'rm' ? itemId : undefined,
                boughtOut: detectedType === 'bo' ? itemId : undefined,
                consumableItem: detectedType === 'consumable' ? itemId : undefined,
                itemCode: poItem.itemCode || "",
                materialName: name,
                hsnCode: poItem.hsnCode || "",
                quantity: remainingQty,
                unit: poItem.unit || "PCS",
                rate: rate,
                amount: amt,
                description: desc,
                availableStock: 999
            };
        });

        setItems(newItems);
    };

    // Form Initialization / Editing setup
    useEffect(() => {
        if (!isOpen) return;

        if (initialData) {
            setDcNumber(initialData.dcNumber || "");
            setDate(initialData.date ? new Date(initialData.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0]);
            const custId = typeof initialData.customer === 'object' ? (initialData.customer as any)?._id : initialData.customer || "";
            setCustomer(custId);
            setCustomerName(initialData.customerName || (initialData.customer as any)?.name || (initialData.customer as any)?.companyName || "");
            setCustomerAddress(initialData.customerAddress || (initialData.customer as any)?.address || "");
            setCustomerPoReference(initialData.customerPoReference || "");
            setCurrency(initialData.currency || (initialData as any).po?.currency || "INR");
            setCustomExchangeRate((initialData as any).exchangeRateToINR);
            setTransportationType((initialData as any).transportationType || "Road Transport");
            setTransportationCharges((initialData as any).transportationCharges || 0);
            setVehicleNumber((initialData as any).vehicleNumber || "");
            setPackagingType((initialData as any).packagingType || "Standard Packaging");
            setPackagingCharges((initialData as any).packagingCharges || 0);
            setDiscount(initialData.discount || 0);
            setOtherDetails(initialData.otherDetails || (initialData as any).remarks || "");
            setStatus(initialData.status || "Draft");
            setReduceStock((initialData as any)?.reduceStock !== false);

            // Detect material category from existing items
            const firstType = (initialData.items?.[0] as any)?.itemType?.toLowerCase();
            const detectedType: ItemCategoryType = (firstType === "rm" || firstType === "bo" || firstType === "consumable") ? firstType : "fg";
            setDcMaterialType(detectedType);
            preloadCategoryOptions(detectedType);

            if (custId) {
                fetchOpenCustomerPOs(custId);
            }

            if (initialData.items && initialData.items.length > 0) {
                setItems(initialData.items.map((i: any) => {
                    const itemId = i.fgItem?._id || i.fgItem || i.rawMaterial?._id || i.rawMaterial || i.boughtOut?._id || i.boughtOut || i.consumableItem?._id || i.consumableItem || i.material || "";
                    const qty = i.quantity || 1;
                    const rate = i.rate || i.pricePerQuantity || 0;
                    const amt = qty * rate;
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
                            currentStock: 999
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
                        description: desc,
                        availableStock: 999
                    };
                }));
            } else {
                setItems([{
                    itemType: detectedType, fgItem: "", materialName: "", hsnCode: "", quantity: 1, unit: "PCS", rate: 0, amount: 0, description: ""
                }]);
            }

            if ((initialData as any).bankDetails && ((initialData as any).bankDetails.bankName || (initialData as any).bankDetails.accountNumber)) {
                setBankDetails({
                    accountName: (initialData as any).bankDetails.accountName || "",
                    bankName: (initialData as any).bankDetails.bankName || "",
                    accountNumber: (initialData as any).bankDetails.accountNumber || "",
                    ifscCode: (initialData as any).bankDetails.ifscCode || "",
                    branch: (initialData as any).bankDetails.branch || (initialData as any).bankDetails.branchName || ""
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
            setDcNumber(generateDCNumber());
            setDate(new Date().toISOString().split("T")[0]);
            setCustomer("");
            setCustomerName("");
            setCustomerAddress("");
            setCustomerPoReference("");
            setCurrency("INR");
            setCustomExchangeRate(undefined);
            setTransportationType("Road Transport");
            setTransportationCharges(0);
            setVehicleNumber("");
            setPackagingType("Standard Packaging");
            setPackagingCharges(0);
            setDiscount(0);
            setOtherDetails("");
            setStatus("Draft");
            setReduceStock(true);
            setCustomerPOs([]);
            setBankDetails(getMasterBankDetails());
            setTermsAndConditions(getMasterTerms());
            setDcMaterialType('fg');
            preloadCategoryOptions('fg');
            setItems([{
                itemType: 'fg', fgItem: "", materialName: "", hsnCode: "", quantity: 1, unit: "PCS", rate: 0, amount: 0, description: ""
            }]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialData, isOpen]);

    // Item Selection Handler
    const handleItemSelection = (index: number, selectedId: string) => {
        const newItems = [...items];
        const currentItem = newItems[index];

        const cached = itemDetailsCacheRef.current.get(String(selectedId));
        const name = cached?.name || "";
        const code = cached?.code || "";
        const hsn = cached?.hsnCode || "";
        const unit = cached?.unit || "PCS";
        const desc = cached?.description || "";
        const stock = cached?.currentStock ?? 0;
        const rate = cached?.rate || currentItem.rate || 0;
        const qty = currentItem.quantity || 1;
        const amt = qty * rate;

        newItems[index] = {
            ...currentItem,
            fgItem: dcMaterialType === 'fg' ? selectedId : undefined,
            rawMaterial: dcMaterialType === 'rm' ? selectedId : undefined,
            boughtOut: dcMaterialType === 'bo' ? selectedId : undefined,
            consumableItem: dcMaterialType === 'consumable' ? selectedId : undefined,
            materialName: name,
            itemCode: code,
            hsnCode: hsn,
            unit: unit,
            rate: rate,
            amount: amt,
            description: desc,
            availableStock: stock
        };

        setItems(newItems);
        clearError(`item_${index}_id`);
    };

    const updateItem = (index: number, field: keyof DCItemEntry, val: any) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: val };

        if (field === 'quantity' || field === 'rate') {
            const qty = Number(field === 'quantity' ? val : newItems[index].quantity || 0);
            const rate = Number(field === 'rate' ? val : newItems[index].rate || 0);
            const amt = qty * rate;
            newItems[index].amount = amt;
        }

        setItems(newItems);
        clearError(`item_${index}_${field}`);
    };

    const addItem = () => {
        setItems(prev => [
            ...prev,
            {
                itemType: dcMaterialType,
                fgItem: "",
                rawMaterial: "",
                boughtOut: "",
                consumableItem: "",
                materialName: "",
                hsnCode: "",
                quantity: 1,
                unit: dcMaterialType === 'rm' ? 'KGS' : 'PCS',
                rate: 0,
                amount: 0,
                description: ""
            }
        ]);
    };

    const removeItem = (index: number) => {
        if (items.length <= 1) {
            setItems([{
                itemType: dcMaterialType,
                fgItem: "",
                rawMaterial: "",
                boughtOut: "",
                consumableItem: "",
                materialName: "",
                hsnCode: "",
                quantity: 1,
                unit: dcMaterialType === 'rm' ? 'KGS' : 'PCS',
                rate: 0,
                amount: 0,
                description: ""
            }]);
            return;
        }
        setItems(items.filter((_, i) => i !== index));
    };

    // Financial Computations
    const subtotal = useMemo(() => {
        return items.reduce((acc, item) => acc + (Number(item.amount) || 0), 0);
    }, [items]);

    const totalAmount = useMemo(() => {
        const freight = Number(transportationCharges) || 0;
        const packaging = Number(packagingCharges) || 0;
        const disc = Number(discount) || 0;
        return Math.max(0, subtotal + freight + packaging - disc);
    }, [subtotal, transportationCharges, packagingCharges, discount]);

    const inrConversion = useMemo(() => {
        return convertToINR(totalAmount, currency, customExchangeRate);
    }, [totalAmount, currency, customExchangeRate]);

    const materialTypeLabelMap: Record<ItemCategoryType, string> = {
        fg: "Finished Goods (FG)",
        rm: "Raw Materials (RM)",
        bo: "Bought-Out Components (BO)",
        consumable: "Consumables"
    };

    const validateForm = () => {
        const errors: Record<string, string> = {};
        if (!customer) errors.customer = "Customer selection is required";
        if (!dcNumber.trim()) errors.dcNumber = "DC number is required";
        if (!date) errors.date = "DC date is required";

        items.forEach((item, idx) => {
            const hasId = item.fgItem || item.rawMaterial || item.boughtOut || item.consumableItem;
            if (!hasId && !item.materialName.trim()) {
                errors[`item_${idx}_id`] = "Please select an item";
            }
            if (Number(item.quantity) <= 0) {
                errors[`item_${idx}_quantity`] = "Quantity must be greater than 0";
            }
        });

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateForm()) return;

        const payloadItems = items.map(entry => {
            const itemPayload: any = {
                itemType: entry.itemType,
                poItemId: entry.poItemId,
                materialName: entry.materialName,
                itemCode: entry.itemCode || "",
                hsnCode: entry.hsnCode || "",
                quantity: Number(entry.quantity),
                unit: entry.unit,
                rate: Number(entry.rate || 0),
                amount: Number(entry.amount || 0),
                description: entry.description || ""
            };

            if (entry.fgItem) itemPayload.fgItem = entry.fgItem;
            if (entry.rawMaterial) itemPayload.rawMaterial = entry.rawMaterial;
            if (entry.boughtOut) itemPayload.boughtOut = entry.boughtOut;
            if (entry.consumableItem) itemPayload.consumableItem = entry.consumableItem;
            return itemPayload;
        });

        const payload: any = {
            dcNumber,
            date,
            customerName,
            customerAddress,
            currency,
            exchangeRateToINR: inrConversion.rate,
            transportationType,
            transportationCharges,
            vehicleNumber,
            packagingType,
            packagingCharges,
            items: payloadItems,
            subtotal,
            totalAmount,
            discount,
            otherDetails,
            status,
            reduceStock,
            customerPoReference,
            bankDetails,
            termsAndConditions
        };

        if (customer) payload.customer = customer;

        onSubmit(payload);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[200] flex items-center justify-center p-2 sm:p-5 overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-[98vw] xl:max-w-7xl 2xl:max-w-[1600px] max-h-[92vh] flex flex-col border border-slate-200 dark:border-slate-800 my-auto overflow-hidden">
                
                {/* Modal Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 sticky top-0 z-20">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-blue-600 text-white rounded-2xl shadow-md">
                            <Truck size={20} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                                {isEditing ? "Edit Delivery Challan" : "Create Delivery Challan"}
                            </h2>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">

                    {/* TOP SECTION: Material Types Selector on Top (Single Type per DC) */}
                    <div className="bg-gradient-to-r from-slate-50 via-blue-50/30 to-slate-50 dark:from-slate-800/60 dark:via-blue-950/20 dark:to-slate-800/60 p-4 rounded-2xl border border-blue-100 dark:border-slate-700 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <Layers size={16} className="text-blue-600 dark:text-blue-400" />
                            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                                Material Type:
                            </span>
                        </div>

                        {/* Segmented Buttons for Material Type */}
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={() => handleDcMaterialTypeChange('fg')}
                                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                                    dcMaterialType === 'fg'
                                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25 ring-2 ring-blue-500/20'
                                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                                }`}
                            >
                                <Package size={14} /> Finished Goods (FG)
                            </button>

                            <button
                                type="button"
                                onClick={() => handleDcMaterialTypeChange('rm')}
                                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                                    dcMaterialType === 'rm'
                                        ? 'bg-amber-600 text-white shadow-md shadow-amber-600/25 ring-2 ring-amber-500/20'
                                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                                }`}
                            >
                                <Cog size={14} /> Raw Material (RM)
                            </button>

                            <button
                                type="button"
                                onClick={() => handleDcMaterialTypeChange('bo')}
                                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                                    dcMaterialType === 'bo'
                                        ? 'bg-purple-600 text-white shadow-md shadow-purple-600/25 ring-2 ring-purple-500/20'
                                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                                }`}
                            >
                                <Layers size={14} /> Bought-Out (BO)
                            </button>

                            <button
                                type="button"
                                onClick={() => handleDcMaterialTypeChange('consumable')}
                                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                                    dcMaterialType === 'consumable'
                                        ? 'bg-teal-600 text-white shadow-md shadow-teal-600/25 ring-2 ring-teal-500/20'
                                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                                }`}
                            >
                                <FlaskConical size={14} /> Consumables
                            </button>
                        </div>
                    </div>

                    {/* DC Metadata Header Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 bg-slate-50/50 dark:bg-slate-800/30 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                                <span>DC Number <span className="text-red-500">*</span></span>
                                {formErrors.dcNumber && <span className="text-[10px] text-rose-500">{formErrors.dcNumber}</span>}
                            </label>
                            <input
                                type="text"
                                value={dcNumber}
                                onChange={(e) => { setDcNumber(e.target.value); clearError("dcNumber"); }}
                                placeholder="DC/20260307-..."
                                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono font-bold dark:text-white"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                                <span>DC Date <span className="text-red-500">*</span></span>
                                {formErrors.date && <span className="text-[10px] text-rose-500">{formErrors.date}</span>}
                            </label>
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => { setDate(e.target.value); clearError("date"); }}
                                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold dark:text-white"
                            />
                        </div>

                        {/* Customer Searchable Dropdown */}
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                                <span>Customer / Recipient <span className="text-red-500">*</span></span>
                                {formErrors.customer && <span className="text-[10px] text-rose-500">{formErrors.customer}</span>}
                            </label>
                            <SearchableSelect
                                options={customers.map((c: any) => ({
                                    value: c._id || c.id,
                                    label: c.name || c.customerName || c.companyName || "Unnamed Customer",
                                    code: c.customerCode || ""
                                }))}
                                value={customer}
                                onChange={handleCustomerChange}
                                placeholder="Search customer..."
                                hasError={!!formErrors.customer}
                            />
                        </div>

                        {/* Customer Open PO Selector */}
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                                <span className="flex items-center gap-1">
                                    <ShoppingCart size={13} className="text-blue-500" /> Customer PO Ref
                                </span>
                                {isLoadingCustomerPOs && <span className="text-[10px] text-blue-500 animate-pulse">Loading POs...</span>}
                            </label>
                            <SearchableSelect
                                options={customerPOs.map((p: any) => ({
                                    value: p.poNumber,
                                    label: `${p.poNumber} (${p.status || 'Open'}) — ${new Date(p.poDate || p.createdAt).toLocaleDateString()}`,
                                    code: p.poNumber
                                }))}
                                value={customerPoReference}
                                onChange={handleCustomerPoSelect}
                                placeholder={customer ? (customerPOs.length > 0 ? "Select Open PO (Auto-fills)" : "No Open POs found") : "Select customer first"}
                                disabled={!customer}
                                allowCustom={true}
                            />
                        </div>

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

                    {/* Customer PO banner if selected */}
                    {customerPoReference && (
                        <div className="flex items-center justify-between bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/80 px-4 py-2 rounded-xl text-xs text-blue-900 dark:text-blue-200">
                            <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-600 dark:text-slate-300">Linked PO:</span>
                                <span className="font-bold text-blue-700 dark:text-blue-300">{customerPoReference}</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setCustomerPoReference("")}
                                className="text-blue-600 dark:text-blue-400 hover:underline font-bold text-[11px] ml-2 cursor-pointer"
                            >
                                Clear Link
                            </button>
                        </div>
                    )}

                    {/* Items Section */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800">
                            <div>
                                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                    <Package className="w-5 h-5 text-blue-600" />
                                    DC Line Items ({items.length})
                                </h3>
                            </div>
                        </div>

                        {/* Items Table / Cards */}
                        <div className="space-y-3">
                            {items.map((entry, index) => {
                                const selectedValue = entry.fgItem || entry.rawMaterial || entry.boughtOut || entry.consumableItem || '';
                                return (
                                    <div
                                        key={index}
                                        className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-blue-300 dark:hover:border-blue-700 transition-all space-y-3"
                                    >
                                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold text-xs flex items-center justify-center">
                                                    {index + 1}
                                                </span>
                                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
                                                    {materialTypeLabelMap[dcMaterialType]}
                                                </span>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => removeItem(index)}
                                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors cursor-pointer"
                                                title="Remove Item"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>

                                        {/* Row Inputs */}
                                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                                            {/* Item Searchable Keyword Dropdown */}
                                            <div className="md:col-span-5 space-y-1">
                                                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase flex items-center justify-between">
                                                    <span>Item Description <span className="text-red-500">*</span></span>
                                                    {formErrors[`item_${index}_id`] && (
                                                        <span className="text-[10px] text-rose-500 font-normal">
                                                            {formErrors[`item_${index}_id`]}
                                                        </span>
                                                    )}
                                                </label>
                                                <SearchableSelect
                                                    options={categoryInitialOptions[dcMaterialType] || []}
                                                    asyncSearch={(q) => searchItemsAsync(dcMaterialType, q)}
                                                    value={selectedValue}
                                                    onChange={(val) => handleItemSelection(index, val)}
                                                    placeholder={`Type keyword to search ${dcMaterialType.toUpperCase()}...`}
                                                    hasError={!!formErrors[`item_${index}_id`]}
                                                />

                                                {/* Selected Item Technical Description Display (Rule 1) */}
                                                {entry.description && (
                                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 italic px-1 pt-0.5 line-clamp-2">
                                                        {entry.description}
                                                    </p>
                                                )}

                                                {/* Stock Status Pill */}
                                                {entry.materialName && (
                                                    <div className="pt-0.5">
                                                        {(entry.availableStock || 0) <= 0 ? (
                                                            <span className="text-[10px] font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded-md border border-rose-200 dark:border-rose-800 inline-flex items-center gap-1">
                                                                <AlertTriangle size={11} /> Current Stock: 0 {entry.unit}
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800 inline-flex items-center gap-1">
                                                                <CheckCircle2 size={11} /> In Stock: {entry.availableStock} {entry.unit}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* HSN Code */}
                                            <div className="md:col-span-2 space-y-1">
                                                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">
                                                    HSN Code
                                                </label>
                                                <input
                                                    type="text"
                                                    value={entry.hsnCode || ""}
                                                    onChange={(e) => updateItem(index, 'hsnCode', e.target.value)}
                                                    placeholder="HSN / SAC"
                                                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white font-mono"
                                                />
                                            </div>

                                            {/* Quantity & Unit */}
                                            <div className="md:col-span-2 space-y-1">
                                                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase flex items-center justify-between">
                                                    <span>Quantity <span className="text-red-500">*</span></span>
                                                    {formErrors[`item_${index}_quantity`] && (
                                                        <span className="text-[10px] text-rose-500">
                                                            {formErrors[`item_${index}_quantity`]}
                                                        </span>
                                                    )}
                                                </label>
                                                <div className="flex gap-1.5">
                                                    <input
                                                        type="number"
                                                        min="0.01"
                                                        step="any"
                                                        value={entry.quantity}
                                                        onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                                                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold dark:text-white"
                                                    />
                                                    <input
                                                        type="text"
                                                        value={entry.unit}
                                                        onChange={(e) => updateItem(index, 'unit', e.target.value)}
                                                        className="w-16 px-2 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold uppercase text-center dark:text-white"
                                                    />
                                                </div>
                                            </div>

                                            {/* Unit Rate */}
                                            <div className="md:col-span-1 space-y-1">
                                                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">
                                                    Rate
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="any"
                                                    value={entry.rate || 0}
                                                    onChange={(e) => updateItem(index, 'rate', parseFloat(e.target.value) || 0)}
                                                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold dark:text-white"
                                                />
                                            </div>

                                            {/* Line Amount */}
                                            <div className="md:col-span-2 space-y-1">
                                                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">
                                                    Amount
                                                </label>
                                                <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-extrabold text-slate-900 dark:text-white">
                                                    {getCurrencySymbol(currency)} {(entry.amount || 0).toFixed(2)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Add Item Button at End of List */}
                        <div className="flex justify-start pt-1">
                            <button
                                type="button"
                                onClick={addItem}
                                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors shadow-xs cursor-pointer"
                            >
                                <Plus size={16} /> Add Item
                            </button>
                        </div>
                    </div>

                    {/* Company Bank Details Card */}
                    <div className="bg-slate-50/80 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700/80 pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-xl">
                                    <Building2 size={18} />
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                                        Company Bank Details
                                    </h4>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => setBankDetails(getMasterBankDetails())}
                                className="px-3 py-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-lg shadow-xs hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-all flex items-center gap-1.5 cursor-pointer"
                            >
                                <RotateCcw size={13} /> Reset to Master
                            </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Account Holder Name</label>
                                <input
                                    type="text"
                                    value={bankDetails.accountName}
                                    onChange={e => setBankDetails(prev => ({ ...prev, accountName: e.target.value }))}
                                    placeholder="Company Name"
                                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white font-medium"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Bank Name</label>
                                <input
                                    type="text"
                                    value={bankDetails.bankName}
                                    onChange={e => setBankDetails(prev => ({ ...prev, bankName: e.target.value }))}
                                    placeholder="e.g. HDFC Bank"
                                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white font-medium"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Account Number</label>
                                <input
                                    type="text"
                                    value={bankDetails.accountNumber}
                                    onChange={e => setBankDetails(prev => ({ ...prev, accountNumber: e.target.value }))}
                                    placeholder="Account Number"
                                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white font-mono font-bold"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">IFSC Code</label>
                                <input
                                    type="text"
                                    value={bankDetails.ifscCode}
                                    onChange={e => setBankDetails(prev => ({ ...prev, ifscCode: e.target.value.toUpperCase() }))}
                                    placeholder="IFSC Code"
                                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white font-mono font-bold uppercase"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Branch Name</label>
                                <input
                                    type="text"
                                    value={bankDetails.branch}
                                    onChange={e => setBankDetails(prev => ({ ...prev, branch: e.target.value }))}
                                    placeholder="Branch Name"
                                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white font-medium"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Custom Terms & Conditions & Logistics Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                        {/* LEFT: Custom Terms & Conditions */}
                        <div className="lg:col-span-7 bg-slate-50/80 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <FileText size={16} className="text-blue-600 dark:text-blue-400" />
                                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                                        Dispatch Terms & Conditions
                                    </h4>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setTermsAndConditions(getMasterTerms())}
                                    className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                                >
                                    <RotateCcw size={11} /> Reset to Default
                                </button>
                            </div>

                            {/* Quick Clause Chips */}
                            <div className="flex flex-wrap gap-1.5 items-center">
                                <span className="text-[10px] text-slate-400 font-bold uppercase mr-1">Quick Presets:</span>
                                {[
                                    { label: "+ 30-Day Returnable", text: "\n• Material is returnable within 30 days of dispatch." },
                                    { label: "+ Transit Insurance", text: "\n• Transit insurance is arranged and borne by the consignee." },
                                    { label: "+ Defective Replacement", text: "\n• Defective goods will be replaced upon receipt and verification." },
                                    { label: "+ Local Jurisdiction", text: "\n• Any disputes are subject to local jurisdiction only." }
                                ].map((preset, pIdx) => (
                                    <button
                                        key={pIdx}
                                        type="button"
                                        onClick={() => {
                                            if (!termsAndConditions.includes(preset.text.trim())) {
                                                setTermsAndConditions(prev => (prev ? `${prev}${preset.text}` : preset.text.trim()));
                                            }
                                        }}
                                        className="text-[10px] font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 px-2 py-0.5 rounded-md text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                                    >
                                        {preset.label}
                                    </button>
                                ))}
                            </div>

                            <textarea
                                rows={4}
                                value={termsAndConditions}
                                onChange={e => setTermsAndConditions(e.target.value)}
                                placeholder="Enter specific delivery challan terms..."
                                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono dark:text-white focus:ring-2 focus:ring-blue-500/20 leading-relaxed"
                            />
                        </div>

                        {/* RIGHT: Logistics Details */}
                        <div className="lg:col-span-5 bg-slate-50/80 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <Truck size={16} className="text-blue-600" />
                                Logistics & Freight
                            </h4>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Transportation Mode</label>
                                    <input
                                        type="text"
                                        value={transportationType}
                                        onChange={(e) => setTransportationType(e.target.value)}
                                        placeholder="e.g. Road Transport"
                                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white font-medium"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Vehicle / Tracking No.</label>
                                    <input
                                        type="text"
                                        value={vehicleNumber}
                                        onChange={(e) => setVehicleNumber(e.target.value)}
                                        placeholder="e.g. KA-01-AB-1234"
                                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white font-mono uppercase font-bold"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Freight Charges ({getCurrencySymbol(currency)})</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="any"
                                        value={transportationCharges}
                                        onChange={(e) => setTransportationCharges(parseFloat(e.target.value) || 0)}
                                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white font-semibold"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Packaging Charges ({getCurrencySymbol(currency)})</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="any"
                                        value={packagingCharges}
                                        onChange={(e) => setPackagingCharges(parseFloat(e.target.value) || 0)}
                                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white font-semibold"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Multi-Currency and Financial Totals */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-4 border-t border-slate-200 dark:border-slate-800">
                        {/* LEFT: Multi-Currency preview if foreign */}
                        <div className="lg:col-span-7">
                            {inrConversion.isForeign ? (
                                <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-emerald-50 dark:from-slate-800/90 dark:to-slate-800/40 border border-blue-200/80 dark:border-slate-700 rounded-2xl p-5 shadow-sm space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h4 className="font-extrabold text-sm text-blue-900 dark:text-blue-200 flex items-center gap-2">
                                            <ArrowRightLeft size={16} className="text-blue-600 dark:text-blue-400" />
                                            Live Multi-Currency Conversion to INR (₹)
                                        </h4>
                                        <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded-md border border-blue-200 dark:border-blue-800">
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
                                                        className="text-xs text-blue-600 font-bold cursor-pointer"
                                                    >
                                                        Save
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-between mt-0.5">
                                                    <span className="text-base font-extrabold text-blue-700 dark:text-blue-300">
                                                        ₹{inrConversion.rate.toFixed(2)} INR
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsEditingExchangeRate(true)}
                                                        className="text-[11px] text-slate-500 hover:text-blue-600 underline font-medium cursor-pointer"
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
                                    <span>Freight Charges:</span>
                                    <span className="font-semibold text-slate-900 dark:text-white">
                                        + {getCurrencySymbol(currency)} {Number(transportationCharges).toFixed(2)}
                                    </span>
                                </div>
                            )}

                            {Number(packagingCharges) > 0 && (
                                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                    <span>Packaging Charges:</span>
                                    <span className="font-semibold text-slate-900 dark:text-white">
                                        + {getCurrencySymbol(currency)} {Number(packagingCharges).toFixed(2)}
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

                            <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between text-sm font-extrabold text-slate-900 dark:text-white">
                                <span>Total Value:</span>
                                <span className="text-base text-blue-600 dark:text-blue-400">
                                    {getCurrencySymbol(currency)} {totalAmount.toFixed(2)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Actions */}
                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/25 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                            {loading ? "Saving..." : (isEditing ? "Update Delivery Challan" : "Create Delivery Challan")}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}

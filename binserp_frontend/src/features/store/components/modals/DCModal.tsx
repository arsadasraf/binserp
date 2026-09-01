/**
 * DC Modal Component
 * Modal form for creating and editing Delivery Challans
 * Supports Polymorphic Item Selection: FG, Raw Material (RM), Bought-Out (BO), and Consumables
 * Features Real-Time Stock Validation and Live Foreign Currency to INR Conversion Preview
 */

"use client";

import { useState, useEffect, useMemo } from "react";
import {
    X, Plus, Trash2, Package, User, Calendar, Hash, FileText, Truck,
    Calculator, IndianRupee, CheckCircle2, AlertTriangle, Cog, Layers,
    FlaskConical, RefreshCw, ArrowRightLeft, DollarSign
} from "lucide-react";
import { DCModalProps, RmBoItem } from "@/src/features/store/types/store.types";
import SearchableSelect from "../SearchableSelect";
import { useGetStoreDataQuery } from "@/src/store/services/storeService";
import { getCurrencySymbol, CURRENCY_OPTIONS, convertToINR, getExchangeRateToINR } from "@/src/utils/currencyHelper";

interface ExtendedDCModalProps extends DCModalProps {
    materials?: RmBoItem[];
    inHouseItems?: any[];
    fgItems?: any[];
}

export type ItemCategoryType = 'fg' | 'rm' | 'bo' | 'consumable';

interface DCItemEntry {
    itemType: ItemCategoryType;
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
    inHouseItems = [],
    fgItems = [],
    loading,
    initialData,
    isEditing = false,
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

    // Queries to guarantee FG, RM, BO, Consumables & Inventory data are loaded
    const { data: fetchedFGList = [] } = useGetStoreDataQuery("fg-item", { skip: !isOpen });
    const { data: rawMaterials = [] } = useGetStoreDataQuery("raw-material", { skip: !isOpen });
    const { data: boughtOuts = [] } = useGetStoreDataQuery("bought-out", { skip: !isOpen });
    const { data: consumableItems = [] } = useGetStoreDataQuery("consumable-item", { skip: !isOpen });
    const { data: inventoryList = [] } = useGetStoreDataQuery("inventory", { skip: !isOpen });
    const { data: incomingPOs = [] } = useGetStoreDataQuery("incoming-po", { skip: !isOpen });
    const { data: priceLists = [] } = useGetStoreDataQuery("price-list", { skip: !isOpen });

    const availableFGItems = useMemo(() => {
        const combined = [...(fgItems || []), ...(inHouseItems || []), ...(Array.isArray(fetchedFGList) ? fetchedFGList : [])];
        const uniqueMap = new Map();
        combined.forEach(item => {
            if (item && (item._id || item.id) && !uniqueMap.has(item._id || item.id)) {
                uniqueMap.set(item._id || item.id, item);
            }
        });
        return Array.from(uniqueMap.values());
    }, [fgItems, inHouseItems, fetchedFGList]);

    // Helper map for inventory quantities by materialId or materialName
    const inventoryStockMap = useMemo(() => {
        const map = new Map<string, number>();
        if (Array.isArray(inventoryList)) {
            inventoryList.forEach((inv: any) => {
                if (inv.materialId) map.set(String(inv.materialId), Number(inv.currentStock || 0));
                if (inv._id) map.set(String(inv._id), Number(inv.currentStock || 0));
                if (inv.materialCode) map.set(String(inv.materialCode).toLowerCase(), Number(inv.currentStock || 0));
                if (inv.materialName) map.set(String(inv.materialName).toLowerCase(), Number(inv.currentStock || 0));
            });
        }
        return map;
    }, [inventoryList]);

    const generateDCNumber = () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");
        const hours = String(now.getHours()).padStart(2, "0");
        const mins = String(now.getMinutes()).padStart(2, "0");
        return `DC/${year}${month}${day}-${hours}${mins}`;
    };

    useEffect(() => {
        if (!isOpen) return;

        if (initialData) {
            setDcNumber(initialData.dcNumber || "");
            setDate(initialData.date ? new Date(initialData.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0]);
            setCustomer(typeof initialData.customer === 'object' ? (initialData.customer as any)?._id : initialData.customer || "");
            setCustomerName(initialData.customerName || (initialData.customer as any)?.name || "");
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

            if (initialData.items && initialData.items.length > 0) {
                setItems(initialData.items.map((item: any) => {
                    const rawType = (item.itemType || "fg").toLowerCase();
                    const itemType: ItemCategoryType = (rawType === "rm" || rawType === "bo" || rawType === "consumable") ? rawType : "fg";
                    const itemId = item.fgItem?._id || item.fgItem || item.rawMaterial?._id || item.rawMaterial || item.boughtOut?._id || item.boughtOut || item.consumableItem?._id || item.consumableItem || item.material || "";
                    const qty = item.quantity || 1;
                    const rate = item.rate || item.pricePerQuantity || 0;

                    return {
                        itemType,
                        fgItem: itemType === 'fg' ? itemId : undefined,
                        rawMaterial: itemType === 'rm' ? itemId : undefined,
                        boughtOut: itemType === 'bo' ? itemId : undefined,
                        consumableItem: itemType === 'consumable' ? itemId : undefined,
                        itemCode: item.itemCode || "",
                        materialName: item.materialName || item.productName || item.name || "",
                        hsnCode: item.hsnCode || "",
                        quantity: qty,
                        unit: item.unit || "PCS",
                        rate: rate,
                        amount: item.amount || (qty * rate),
                        description: item.description || ""
                    };
                }));
            } else {
                setItems([{
                    itemType: 'fg', fgItem: "", materialName: "", hsnCode: "", quantity: 1, unit: "PCS", rate: 0, amount: 0, description: ""
                }]);
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
            setItems([{
                itemType: 'fg', fgItem: "", materialName: "", hsnCode: "", quantity: 1, unit: "PCS", rate: 0, amount: 0, description: ""
            }]);
        }
    }, [initialData, isOpen]);

    // Item selection handler polymorphic across FG, RM, BO, Consumable
    const handleCategoryChange = (index: number, newCategory: ItemCategoryType) => {
        const newItems = [...items];
        newItems[index] = {
            ...newItems[index],
            itemType: newCategory,
            fgItem: undefined,
            rawMaterial: undefined,
            boughtOut: undefined,
            consumableItem: undefined,
            itemCode: "",
            materialName: "",
            hsnCode: "",
            rate: 0,
            amount: 0,
            availableStock: 0
        };
        setItems(newItems);
        clearError(`item_${index}_id`);
    };

    const handleItemSelection = (index: number, selectedId: string) => {
        const newItems = [...items];
        const currentItem = newItems[index];
        const category = currentItem.itemType;

        let name = "";
        let code = "";
        let hsn = "";
        let unit = "PCS";
        let rate = 0;
        let desc = "";
        let stock = 0;

        if (category === 'rm') {
            const doc = (rawMaterials || []).find((r: any) => (r._id || r.id) === selectedId);
            if (doc) {
                name = doc.name || "";
                code = doc.code || "";
                hsn = doc.hsnCode || "";
                unit = doc.unit || "KGS";
                desc = doc.descriptions || "";
                stock = inventoryStockMap.get(String(doc._id)) ?? inventoryStockMap.get(name.toLowerCase()) ?? 0;
            }
            newItems[index] = {
                ...currentItem,
                rawMaterial: selectedId,
                materialName: name,
                itemCode: code,
                hsnCode: hsn,
                unit,
                rate: 0,
                amount: 0,
                description: desc,
                availableStock: stock
            };
        } else if (category === 'bo') {
            const doc = (boughtOuts || []).find((b: any) => (b._id || b.id) === selectedId);
            if (doc) {
                name = doc.name || "";
                code = doc.code || "";
                hsn = doc.hsnCode || "";
                unit = doc.unit || "NOS";
                desc = doc.descriptions || "";
                stock = inventoryStockMap.get(String(doc._id)) ?? inventoryStockMap.get(name.toLowerCase()) ?? 0;
            }
            newItems[index] = {
                ...currentItem,
                boughtOut: selectedId,
                materialName: name,
                itemCode: code,
                hsnCode: hsn,
                unit,
                rate: 0,
                amount: 0,
                description: desc,
                availableStock: stock
            };
        } else if (category === 'consumable') {
            const doc = (consumableItems || []).find((c: any) => (c._id || c.id) === selectedId);
            if (doc) {
                name = doc.name || "";
                code = doc.code || "";
                hsn = doc.hsnCode || "";
                unit = doc.unit || "PCS";
                desc = doc.descriptions || "";
                stock = inventoryStockMap.get(String(doc._id)) ?? inventoryStockMap.get(name.toLowerCase()) ?? 0;
            }
            newItems[index] = {
                ...currentItem,
                consumableItem: selectedId,
                materialName: name,
                itemCode: code,
                hsnCode: hsn,
                unit,
                rate: 0,
                amount: 0,
                description: desc,
                availableStock: stock
            };
        } else {
            // Finished Good (FG)
            const doc = (availableFGItems || []).find((f: any) => (f._id || f.id) === selectedId);
            const priceConfig = Array.isArray(priceLists) ? priceLists.find((p: any) => (p.fgItem?._id || p.fgItem) === selectedId) : null;
            if (doc) {
                name = doc.name || doc.partName || "";
                code = doc.code || doc.partCode || "";
                hsn = priceConfig?.hsnCode || doc.hsnCode || "";
                unit = doc.unit || "PCS";
                rate = Number(priceConfig?.price ?? doc.sellingPrice ?? doc.rate ?? 0);
                desc = doc.description || doc.partDescription || "";
                stock = Number(doc.quantity || 0);
            }
            const qty = currentItem.quantity || 1;
            newItems[index] = {
                ...currentItem,
                fgItem: selectedId,
                materialName: name,
                itemCode: code,
                hsnCode: hsn,
                unit,
                rate,
                amount: qty * rate,
                description: desc,
                availableStock: stock
            };
        }

        setItems(newItems);
    };

    const updateItem = (index: number, field: keyof DCItemEntry, value: any) => {
        const newItems = [...items];
        const item = { ...newItems[index], [field]: value };

        if (field === 'quantity' || field === 'rate') {
            const qty = field === 'quantity' ? Number(value) : item.quantity;
            const rate = field === 'rate' ? Number(value) : (item.rate || 0);
            item.amount = qty * rate;
        }

        newItems[index] = item;
        setItems(newItems);
    };

    const addItem = () => {
        setItems([
            ...items,
            { itemType: 'fg', fgItem: "", materialName: "", hsnCode: "", quantity: 1, unit: "PCS", rate: 0, amount: 0, description: "" }
        ]);
    };

    const removeItem = (index: number) => {
        if (items.length > 1) {
            setItems(items.filter((_, i) => i !== index));
        }
    };

    // Subtotal & Totals
    const subtotal = useMemo(() => {
        return items.reduce((acc, curr) => acc + (curr.amount || (curr.quantity * (curr.rate || 0))), 0);
    }, [items]);

    const totalAmount = useMemo(() => {
        return Math.max(0, subtotal + Number(transportationCharges || 0) + Number(packagingCharges || 0) - Number(discount || 0));
    }, [subtotal, transportationCharges, packagingCharges, discount]);

    // Live INR Conversion computation
    const inrConversion = useMemo(() => {
        return convertToINR(totalAmount, currency, customExchangeRate);
    }, [totalAmount, currency, customExchangeRate]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const errors: Record<string, string> = {};

        if (!customer) errors.customer = 'Customer is required';
        if (!date) errors.date = 'Challan date is required';

        items.forEach((item, index) => {
            const itemId = item.fgItem || item.rawMaterial || item.boughtOut || item.consumableItem;
            if (!itemId) {
                errors[`item_${index}_id`] = 'Item selection is required';
                return;
            }

            const stock = Number(item.availableStock ?? 0);
            if (reduceStock) {
                if (stock <= 0) {
                    errors[`item_${index}_quantity`] = `Out of stock (Avail: 0)`;
                } else if (Number(item.quantity) > stock) {
                    errors[`item_${index}_quantity`] = `Exceeds stock (Avail: ${stock})`;
                }
            }
            if (Number(item.quantity) <= 0) {
                errors[`item_${index}_quantity`] = 'Qty must be > 0';
            }
        });

        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
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
                itemType: entry.itemType,
                materialName: entry.materialName,
                itemCode: entry.itemCode,
                hsnCode: entry.hsnCode,
                quantity: entry.quantity,
                unit: entry.unit,
                rate: entry.rate || 0,
                amount: entry.amount || (entry.quantity * (entry.rate || 0)),
                description: entry.description,
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
            discount,
            totalAmount,
            otherDetails,
            reduceStock,
            status,
        };

        if (customer) payload.customer = customer;
        if (customerPoReference) payload.customerPoReference = customerPoReference;

        onSubmit(payload);
    };

    if (!isOpen) return null;

    // Build select dropdown options for each item category
    const getItemOptions = (category: ItemCategoryType) => {
        if (category === 'rm') {
            return (rawMaterials || []).map((r: any) => {
                const stock = inventoryStockMap.get(String(r._id)) ?? inventoryStockMap.get(String(r.name).toLowerCase()) ?? 0;
                return {
                    value: r._id || r.id,
                    label: `${r.name} (${r.code || 'RM'}) — Stock: ${stock} ${r.unit || 'KGS'}`
                };
            });
        }
        if (category === 'bo') {
            return (boughtOuts || []).map((b: any) => {
                const stock = inventoryStockMap.get(String(b._id)) ?? inventoryStockMap.get(String(b.name).toLowerCase()) ?? 0;
                return {
                    value: b._id || b.id,
                    label: `${b.name} (${b.code || 'BO'}) — Stock: ${stock} ${b.unit || 'NOS'}`
                };
            });
        }
        if (category === 'consumable') {
            return (consumableItems || []).map((c: any) => {
                const stock = inventoryStockMap.get(String(c._id)) ?? inventoryStockMap.get(String(c.name).toLowerCase()) ?? 0;
                return {
                    value: c._id || c.id,
                    label: `${c.name} (${c.code || 'CON'}) — Stock: ${stock} ${c.unit || 'PCS'}`
                };
            });
        }
        // FG
        return (availableFGItems || []).map((fg: any) => {
            const stock = Number(fg.quantity || 0);
            return {
                value: fg._id || fg.id,
                label: `${fg.name || fg.partName || 'FG Product'} (${fg.code || 'FG'}) — Stock: ${stock} ${fg.unit || 'PCS'}`
            };
        });
    };

    return (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[200] flex items-center justify-center p-2 sm:p-5 overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-[98vw] xl:max-w-7xl 2xl:max-w-[1600px] max-h-[92vh] flex flex-col border border-slate-200 dark:border-slate-800 my-auto overflow-hidden">
                
                {/* Modal Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 sticky top-0 z-20">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-blue-600 text-white rounded-2xl shadow-md">
                            <FileText size={20} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                                {isEditing ? "Edit Delivery Challan" : "Create Delivery Challan"}
                            </h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Dispatches FG, Raw Materials, Bought-Out & Consumables with live inventory sync
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Basic Info Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-5 bg-slate-50/50 dark:bg-slate-800/30 border border-slate-200/80 dark:border-slate-800 rounded-2xl">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">DC Number</label>
                            <input
                                type="text"
                                value={dcNumber}
                                onChange={(e) => setDcNumber(e.target.value)}
                                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold dark:text-white"
                                required
                            />
                        </div>

                        <div className="space-y-1" data-has-error={!!formErrors.date}>
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Challan Date</label>
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => { setDate(e.target.value); clearError("date"); }}
                                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white"
                                required
                            />
                        </div>

                        <div className="space-y-1" data-has-error={!!formErrors.customer}>
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Customer <span className="text-red-500">*</span></label>
                            <SearchableSelect
                                options={(customers || []).map((c: any) => ({ value: c._id || c.id, label: c.name || c.customerName }))}
                                value={customer}
                                hasError={!!formErrors.customer}
                                onChange={(val: string) => {
                                    setCustomer(val);
                                    const cust = customers.find(c => (c._id || (c as any).id) === val);
                                    if (cust) {
                                        setCustomerName(cust.name || (cust as any).customerName || "");
                                        setCustomerAddress(cust.address || (cust as any).billingAddress || "");
                                    }
                                    clearError("customer");
                                }}
                                placeholder="Select Customer"
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

                    {/* Items Section */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800">
                            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                <Package className="w-5 h-5 text-blue-600" />
                                Challan Line Items ({items.length})
                            </h3>
                            <button
                                type="button"
                                onClick={addItem}
                                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800 rounded-xl hover:bg-blue-100 transition-colors shadow-sm"
                            >
                                <Plus size={16} /> Add Row
                            </button>
                        </div>

                        <div className="space-y-4">
                            {items.map((entry, index) => (
                                <div key={index} className="p-4 bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-2xl relative group shadow-sm space-y-3">
                                    {items.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => removeItem(index)}
                                            className="absolute -top-2.5 -right-2.5 p-1.5 bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-300 rounded-full hover:scale-110 transition-transform shadow-md"
                                            title="Remove Row"
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    )}

                                    {/* Category Pill Switcher */}
                                    <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">Category:</span>
                                        <button
                                            type="button"
                                            onClick={() => handleCategoryChange(index, 'fg')}
                                            className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                                                entry.itemType === 'fg'
                                                    ? 'bg-blue-600 text-white shadow-sm'
                                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                                            }`}
                                        >
                                            <Package size={13} /> Finished Good (FG)
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => handleCategoryChange(index, 'rm')}
                                            className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                                                entry.itemType === 'rm'
                                                    ? 'bg-amber-600 text-white shadow-sm'
                                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                                            }`}
                                        >
                                            <Cog size={13} /> Raw Material (RM)
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => handleCategoryChange(index, 'bo')}
                                            className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                                                entry.itemType === 'bo'
                                                    ? 'bg-purple-600 text-white shadow-sm'
                                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                                            }`}
                                        >
                                            <Layers size={13} /> Bought-Out (BO)
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => handleCategoryChange(index, 'consumable')}
                                            className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                                                entry.itemType === 'consumable'
                                                    ? 'bg-teal-600 text-white shadow-sm'
                                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                                            }`}
                                        >
                                            <FlaskConical size={13} /> Consumable
                                        </button>
                                    </div>

                                    {/* Line Item Inputs */}
                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-start">
                                        {/* Master Item Search */}
                                        <div className="md:col-span-4 space-y-1.5" data-has-error={!!formErrors[`item_${index}_id`]}>
                                            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase flex items-center justify-between">
                                                <span>Item Name <span className="text-red-500">*</span></span>
                                                {formErrors[`item_${index}_id`] && (
                                                    <span className="text-[10px] text-rose-600 font-bold lowercase">
                                                        {formErrors[`item_${index}_id`]}
                                                    </span>
                                                )}
                                            </label>

                                            <SearchableSelect
                                                options={getItemOptions(entry.itemType)}
                                                value={entry.fgItem || entry.rawMaterial || entry.boughtOut || entry.consumableItem || ''}
                                                hasError={!!formErrors[`item_${index}_id`]}
                                                onChange={(val: string) => handleItemSelection(index, val)}
                                                placeholder={`Select ${entry.itemType.toUpperCase()} item...`}
                                            />

                                            {/* Real-time Stock Badge */}
                                            {entry.materialName && (
                                                <div className="mt-1">
                                                    {(entry.availableStock || 0) <= 0 ? (
                                                        <span className="text-[11px] font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded-lg border border-rose-200 dark:border-rose-800 inline-flex items-center gap-1">
                                                            <AlertTriangle size={12} /> Out of Stock (0 {entry.unit}) — Deduction Blocked
                                                        </span>
                                                    ) : Number(entry.quantity) > Number(entry.availableStock) ? (
                                                        <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-lg border border-amber-200 dark:border-amber-800 inline-flex items-center gap-1">
                                                            <AlertTriangle size={12} /> Available Stock: {entry.availableStock} {entry.unit} (Req: {entry.quantity})
                                                        </span>
                                                    ) : (
                                                        <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800 inline-flex items-center gap-1">
                                                            <CheckCircle2 size={12} /> Available Stock: {entry.availableStock} {entry.unit}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* HSN & Remarks */}
                                        <div className="md:col-span-3 space-y-1.5">
                                            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">HSN & Details</label>
                                            <input
                                                type="text"
                                                value={entry.hsnCode || ''}
                                                onChange={e => updateItem(index, 'hsnCode', e.target.value)}
                                                placeholder="HSN Code"
                                                className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white"
                                            />
                                            <input
                                                type="text"
                                                value={entry.description || ''}
                                                onChange={e => updateItem(index, 'description', e.target.value)}
                                                placeholder="Description / Remarks"
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
                                                    className="w-16 px-2 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-center font-semibold dark:text-white"
                                                    placeholder="Unit"
                                                />
                                            </div>
                                        </div>

                                        {/* Rate & Amount */}
                                        <div className="md:col-span-3 space-y-1.5">
                                            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">
                                                Rate & Total ({getCurrencySymbol(currency)})
                                            </label>
                                            <div className="grid grid-cols-2 gap-1.5">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={entry.rate || ''}
                                                    onChange={e => updateItem(index, 'rate', parseFloat(e.target.value) || 0)}
                                                    className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium dark:text-white"
                                                    placeholder="Rate"
                                                />
                                                <div className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-end">
                                                    {getCurrencySymbol(currency)} {(entry.amount || (entry.quantity * (entry.rate || 0))).toFixed(2)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Summary & Live Currency Conversion Area */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-4 border-t border-slate-200 dark:border-slate-800">
                        {/* LEFT: Live Currency Conversion Informational Card (7 Cols) */}
                        <div className="lg:col-span-7">
                            {inrConversion.isForeign ? (
                                <div className="bg-gradient-to-br from-indigo-50 via-blue-50 to-emerald-50 dark:from-slate-800/90 dark:to-slate-800/40 border border-blue-200/80 dark:border-slate-700 rounded-2xl p-5 shadow-sm space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h4 className="font-extrabold text-sm text-blue-900 dark:text-blue-200 flex items-center gap-2">
                                            <ArrowRightLeft size={16} className="text-blue-600 dark:text-blue-400" />
                                            Live Multi-Currency Conversion to INR (₹)
                                        </h4>
                                        <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-600 text-white rounded-full">
                                            Informational Preview
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
                                                        className="text-xs text-blue-600 font-bold"
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
                                                        className="text-[11px] text-slate-500 hover:text-blue-600 underline font-medium"
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

                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                                        Note: The invoice is billed in <strong>{currency}</strong>. INR values are displayed for business calculation and reference only.
                                    </p>
                                </div>
                            ) : (
                                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-700 text-xs text-slate-500 space-y-1">
                                    <p className="font-semibold text-slate-700 dark:text-slate-300">💡 Multi-Category Store Dispatch:</p>
                                    <p>Line items can contain Finished Goods, Raw Materials, Bought-Out parts, and Consumables. Inventory stock is deducted directly upon dispatch.</p>
                                </div>
                            )}
                        </div>

                        {/* RIGHT: Financial Totals Summary (5 Cols) */}
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
                                <span>Total Amount:</span>
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
                            className="px-5 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-xl text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-500/20 transition-all active:scale-95 flex items-center gap-2"
                        >
                            {loading && <RefreshCw size={14} className="animate-spin" />}
                            {isEditing ? "Update Delivery Challan" : "Create Delivery Challan"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

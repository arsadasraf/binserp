/**
 * Billing Modal Component
 * Modal form for creating and editing Tax Invoices / Bills
 * Clean, single-theme sleek UI layout (no multicolor)
 * Supports FG Catalog Selection & Custom Products, Inward PO pre-fill, Freight & Packaging Charges
 */

"use client";

import { useState, useEffect, useMemo } from "react";
import { X, Plus, Trash2, Package, User, Calendar, Hash, FileText, Truck, Calculator, IndianRupee } from "lucide-react";
import { BillingModalProps, RmBoItem } from "@/src/features/store/types/store.types";
import SearchableSelect from "../SearchableSelect";
import { useGetStoreDataQuery } from "@/src/store/services/storeService";
import Swal from "sweetalert2";

interface ExtendedBillingModalProps extends BillingModalProps {
    materials?: RmBoItem[];
    inHouseItems?: any[];
    fgItems?: any[];
}

interface InvoiceItemEntry {
    itemType: 'fg' | 'custom';
    fgItem?: string;
    material?: string;
    component?: string;
    materialName: string;
    hsnCode?: string;
    quantity: number;
    unit: string;
    rate: number;
    amount: number;
    taxRate: number;
    taxAmount: number;
    description?: string;
}

export default function BillingModal({
    isOpen,
    onClose,
    onSubmit,
    customers = [],
    materials = [],
    fgItems = [],
    inHouseItems = [],
    loading,
    initialData,
    isEditing = false,
}: ExtendedBillingModalProps) {
    const [invoiceNumber, setInvoiceNumber] = useState("");
    const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
    const [customer, setCustomer] = useState("");
    const [customerName, setCustomerName] = useState("");
    const [customerAddress, setCustomerAddress] = useState("");
    const [customerGST, setCustomerGST] = useState("");
    const [customerPoReference, setCustomerPoReference] = useState("");
    const [transportationType, setTransportationType] = useState("Road Transport");
    const [transportationCharges, setTransportationCharges] = useState(0);
    const [vehicleNumber, setVehicleNumber] = useState("");
    const [packagingType, setPackagingType] = useState("Standard Packaging");
    const [packagingCharges, setPackagingCharges] = useState(0);
    const [discount, setDiscount] = useState(0);
    const [otherDetails, setOtherDetails] = useState("");
    const [status, setStatus] = useState("Draft");
    const [globalTaxRate, setGlobalTaxRate] = useState(0);

    const [items, setItems] = useState<InvoiceItemEntry[]>([{
        itemType: 'fg',
        fgItem: "",
        materialName: "",
        hsnCode: "",
        quantity: 1,
        unit: "PCS",
        rate: 0,
        amount: 0,
        taxRate: 0,
        taxAmount: 0,
        description: ""
    }]);

    // Fallback queries to guarantee FG items & PO data are ALWAYS available
    const { data: fetchedFGList = [] } = useGetStoreDataQuery("fg-item", { skip: !isOpen });
    const { data: incomingPOs = [] } = useGetStoreDataQuery("incoming-po", { skip: !isOpen });
    const { data: priceLists = [] } = useGetStoreDataQuery("price-list", { skip: !isOpen });

    const availableFGItems = useMemo(() => {
        const combined = [...(fgItems || []), ...(inHouseItems || []), ...(Array.isArray(fetchedFGList) ? fetchedFGList : [])];
        const uniqueMap = new Map();
        combined.forEach(item => {
            if (item && item._id && !uniqueMap.has(item._id)) {
                uniqueMap.set(item._id, item);
            }
        });
        return Array.from(uniqueMap.values());
    }, [fgItems, inHouseItems, fetchedFGList]);

    const generateInvoiceNumber = () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");
        const hours = String(now.getHours()).padStart(2, "0");
        const mins = String(now.getMinutes()).padStart(2, "0");
        return `INV/${year}${month}${day}-${hours}${mins}`;
    };

    useEffect(() => {
        if (!isOpen) return;

        if (initialData) {
            setInvoiceNumber(initialData.invoiceNumber || "");
            setDate(initialData.date ? new Date(initialData.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0]);
            setCustomer(typeof initialData.customer === 'object' ? (initialData.customer as any)?._id : initialData.customer || "");
            setCustomerName(initialData.customerName || (initialData.customer as any)?.name || "");
            setCustomerAddress(initialData.customerAddress || (initialData.customer as any)?.address || "");
            setCustomerGST(initialData.customerGST || (initialData.customer as any)?.gstNumber || "");
            setCustomerPoReference(initialData.customerPoReference || "");
            setTransportationType((initialData as any).transportationType || "Road Transport");
            setTransportationCharges((initialData as any).transportationCharges || 0);
            setVehicleNumber((initialData as any).vehicleNumber || "");
            setPackagingType((initialData as any).packagingType || "Standard Packaging");
            setPackagingCharges((initialData as any).packagingCharges || 0);
            setDiscount(initialData.discount || 0);
            setOtherDetails(initialData.otherDetails || (initialData as any).remarks || "");
            setStatus(initialData.status || "Draft");

            if (initialData.items && initialData.items.length > 0) {
                setItems(initialData.items.map((i: any) => {
                    const fgId = typeof i.fgItem === 'object' ? i.fgItem?._id : (i.fgItem || i.material || "");
                    const qty = i.quantity || 1;
                    const rate = i.rate || i.pricePerQuantity || 0;
                    const amt = qty * rate;
                    const taxRate = i.taxRate || 0;
                    return {
                        itemType: i.itemType || (fgId ? 'fg' : 'custom'),
                        fgItem: fgId,
                        material: i.material || "",
                        materialName: i.materialName || i.productName || i.name || "",
                        hsnCode: i.hsnCode || "",
                        quantity: qty,
                        unit: i.unit || "PCS",
                        rate: rate,
                        amount: amt,
                        taxRate: taxRate,
                        taxAmount: i.taxAmount || (amt * (taxRate / 100)),
                        description: i.description || ""
                    };
                }));
            } else {
                setItems([{
                    itemType: 'fg', fgItem: "", materialName: "", hsnCode: "", quantity: 1, unit: "PCS", rate: 0, amount: 0, taxRate: 0, taxAmount: 0, description: ""
                }]);
            }
        } else {
            setInvoiceNumber(generateInvoiceNumber());
            setDate(new Date().toISOString().split("T")[0]);
            setCustomer("");
            setCustomerName("");
            setCustomerAddress("");
            setCustomerGST("");
            setCustomerPoReference("");
            setTransportationType("Road Transport");
            setTransportationCharges(0);
            setVehicleNumber("");
            setPackagingType("Standard Packaging");
            setPackagingCharges(0);
            setDiscount(0);
            setOtherDetails("");
            setStatus("Draft");
            setGlobalTaxRate(0);
            setItems([{
                itemType: 'fg', fgItem: "", materialName: "", hsnCode: "", quantity: 1, unit: "PCS", rate: 0, amount: 0, taxRate: 0, taxAmount: 0, description: ""
            }]);
        }
    }, [initialData, isOpen]);

    const handleCustomerChange = (customerId: string) => {
        setCustomer(customerId);
        const selectedCustomer = customers.find(c => (c._id || (c as any).id) === customerId);
        if (selectedCustomer) {
            setCustomerName(selectedCustomer.name || (selectedCustomer as any).customerName || "");
            setCustomerAddress(selectedCustomer.address || (selectedCustomer as any).billingAddress || "");
            setCustomerGST((selectedCustomer as any).gstNumber || (selectedCustomer as any).gst || "");
        }
    };

    const handlePOSelect = (poId: string) => {
        setCustomerPoReference(poId);
        const po = Array.isArray(incomingPOs) ? incomingPOs.find((p: any) => p._id === poId) : null;
        if (po) {
            if (po.customer) {
                const custId = typeof po.customer === 'object' ? po.customer._id : po.customer;
                handleCustomerChange(custId);
            }
            if (po.items && po.items.length > 0) {
                // Filter only items with pending billing quantity > 0
                const pendingItems = po.items.filter((i: any) => {
                    const remainingQty = (i.quantity || 0) - (i.billedQuantity || i.dispatchedQuantity || 0);
                    return remainingQty > 0;
                });

                if (pendingItems.length === 0) {
                    Swal.fire("PO Billing Info", "All items in this Customer PO have already been fully billed.", "info");
                    return;
                }

                const mappedItems: InvoiceItemEntry[] = pendingItems.map((i: any) => {
                    const fgId = typeof i.fgItem === 'object' ? i.fgItem?._id : i.fgItem || "";
                    const remainingQty = (i.quantity || 0) - (i.billedQuantity || i.dispatchedQuantity || 0);
                    const rate = i.pricePerQuantity || i.rate || 0;
                    const amt = remainingQty * rate;
                    const taxRate = i.taxRate || 0;
                    return {
                        itemType: fgId ? 'fg' : 'custom',
                        fgItem: fgId,
                        materialName: i.productName || i.name || "",
                        hsnCode: i.hsnCode || "",
                        quantity: remainingQty,
                        unit: i.unit || "PCS",
                        rate: rate,
                        amount: amt,
                        taxRate: taxRate,
                        taxAmount: amt * (taxRate / 100),
                        description: `PO ${po.poNumber} Line Item`
                    };
                });
                setItems(mappedItems);
            }
        }
    };

    const handleFGSelection = (index: number, selectedFgId: string) => {
        const newItems = [...items];
        const selectedFG = availableFGItems.find(item => item._id === selectedFgId);
        const priceConfig = Array.isArray(priceLists) ? priceLists.find((p: any) => (p.fgItem?._id || p.fgItem) === selectedFgId) : null;

        const rate = Number(priceConfig?.price ?? selectedFG?.sellingPrice ?? selectedFG?.rate ?? 0);
        const taxRate = Number(priceConfig?.taxRate ?? selectedFG?.taxRate ?? globalTaxRate ?? 0);
        const name = selectedFG?.name || selectedFG?.partName || selectedFG?.componentName || "";
        const hsn = selectedFG?.hsnCode || priceConfig?.hsnCode || "";
        const unit = selectedFG?.unit || "PCS";
        const qty = newItems[index].quantity || 1;
        const amt = qty * rate;
        const taxAmt = amt * (taxRate / 100);

        newItems[index] = {
            ...newItems[index],
            fgItem: selectedFgId,
            materialName: name,
            hsnCode: hsn,
            unit: unit,
            rate: rate,
            amount: amt,
            taxRate: taxRate,
            taxAmount: taxAmt
        };

        setItems(newItems);
    };

    const updateItem = (index: number, field: keyof InvoiceItemEntry, value: any) => {
        const newItems = [...items];
        const item = { ...newItems[index], [field]: value };

        if (field === 'itemType' && value === 'custom') {
            item.fgItem = '';
        }

        if (field === 'quantity' || field === 'rate' || field === 'taxRate') {
            const qty = field === 'quantity' ? Number(value) : item.quantity;
            const rate = field === 'rate' ? Number(value) : item.rate;
            const taxRate = field === 'taxRate' ? Number(value) : item.taxRate;

            item.amount = qty * rate;
            item.taxAmount = (item.amount * taxRate) / 100;
        }

        newItems[index] = item;
        setItems(newItems);
    };

    const addItem = () => {
        setItems([
            ...items,
            { itemType: 'fg', fgItem: "", materialName: "", hsnCode: "", quantity: 1, unit: "PCS", rate: 0, amount: 0, taxRate: globalTaxRate, taxAmount: 0, description: "" }
        ]);
    };

    const removeItem = (index: number) => {
        if (items.length > 1) {
            setItems(items.filter((_, i) => i !== index));
        }
    };

    const handleGlobalTaxChange = (rate: number) => {
        setGlobalTaxRate(rate);
        setItems(prev => prev.map(item => {
            const taxAmt = (item.amount * rate) / 100;
            return { ...item, taxRate: rate, taxAmount: taxAmt };
        }));
    };

    const subtotal = useMemo(() => {
        return items.reduce((acc, curr) => acc + (curr.amount || 0), 0);
    }, [items]);

    const totalTax = useMemo(() => {
        return items.reduce((acc, curr) => acc + (curr.taxAmount || 0), 0);
    }, [items]);

    const totalAmount = useMemo(() => {
        return Math.max(0, subtotal + totalTax + Number(transportationCharges || 0) + Number(packagingCharges || 0) - Number(discount || 0));
    }, [subtotal, totalTax, transportationCharges, packagingCharges, discount]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Validation against Customer PO
        if (customerPoReference && incomingPOs) {
            const po = (incomingPOs as any[]).find(p => p._id === customerPoReference);
            if (po) {
                for (const item of items) {
                    const poItem = po.items.find((i: any) => i.productName === item.materialName || i.fgItem?._id === item.fgItem || i.fgItem === item.fgItem);
                    if (poItem) {
                        const remaining = poItem.quantity - (poItem.billedQuantity || 0);
                        if (item.quantity > remaining) {
                            Swal.fire("Validation Error", `Cannot bill more than PO quantity for ${poItem.productName}. Remaining: ${remaining}, Requested: ${item.quantity}`, "error");
                            return;
                        }
                    }
                }
            }
        }

        const cleanedItems = items.map(entry => {
            const itemPayload: any = {
                itemType: entry.itemType,
                materialName: entry.materialName,
                hsnCode: entry.hsnCode,
                quantity: entry.quantity,
                unit: entry.unit,
                rate: entry.rate,
                amount: entry.amount,
                taxRate: entry.taxRate,
                taxAmount: entry.taxAmount,
                description: entry.description
            };
            if (entry.fgItem && entry.fgItem !== "") itemPayload.fgItem = entry.fgItem;
            if (entry.material && entry.material !== "") itemPayload.material = entry.material;
            if (entry.component && entry.component !== "") itemPayload.component = entry.component;
            return itemPayload;
        });

        const payload: any = {
            invoiceNumber,
            date,
            customerName,
            customerAddress,
            customerGST,
            transportationType,
            transportationCharges,
            vehicleNumber,
            packagingType,
            packagingCharges,
            items: cleanedItems,
            subtotal,
            taxAmount: totalTax,
            discount,
            totalAmount,
            otherDetails,
            status,
        };

        if (customer && customer !== "") payload.customer = customer;
        if (customerPoReference && customerPoReference !== "") payload.customerPoReference = customerPoReference;

        onSubmit(payload);
    };

    if (!isOpen) return null;

    const fgOptions = availableFGItems.map((fg) => ({
        value: fg._id,
        label: `${fg.name || fg.partName} ${fg.itemCode ? `(${fg.itemCode})` : ''}`
    }));

    return (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[105] flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-7xl w-full max-h-[95vh] flex flex-col border border-slate-200 dark:border-slate-800 my-auto">
                
                {/* Modal Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 sticky top-0 z-20">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-blue-600 text-white rounded-2xl shadow-md">
                            <FileText size={20} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                                {isEditing ? "Edit Tax Invoice" : "Create Tax Invoice"}
                            </h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Official billing & customer tax invoice documentation
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Modal Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    <form id="billing-form" onSubmit={handleSubmit} className="space-y-6">
                        
                        {/* Invoice Header Details */}
                        <div className="bg-slate-50/70 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                                <User className="w-4 h-4 text-blue-600" />
                                <span>Invoice & Customer Details</span>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Invoice Number</label>
                                    <input
                                        type="text"
                                        value={invoiceNumber}
                                        readOnly
                                        className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-600 dark:text-slate-300 cursor-not-allowed"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Date *</label>
                                    <input
                                        type="date"
                                        required
                                        value={date}
                                        onChange={(e) => setDate(e.target.value)}
                                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Customer *</label>
                                    <SearchableSelect
                                        options={customers.map((c) => ({ value: c._id || (c as any).id, label: c.name || (c as any).customerName || '' }))}
                                        value={customer || ""}
                                        onChange={(val: any) => handleCustomerChange(val)}
                                        placeholder="Select Customer"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Inward PO Ref (Auto-Fill)</label>
                                    <SearchableSelect
                                        options={Array.isArray(incomingPOs) ? incomingPOs.map((po: any) => ({
                                            value: po._id,
                                            label: `${po.poNumber} (${po.customer?.name || 'Customer'})`
                                        })) : []}
                                        value={customerPoReference || ""}
                                        onChange={(val: any) => handlePOSelect(val)}
                                        placeholder="Link Customer PO..."
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Freight & Logistics */}
                        <div className="bg-slate-50/50 dark:bg-slate-800/30 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                                <Truck className="w-4 h-4 text-blue-600" />
                                <span>Freight & Freight Charges</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Transport Method</label>
                                    <input
                                        type="text"
                                        value={transportationType}
                                        onChange={(e) => setTransportationType(e.target.value)}
                                        placeholder="e.g. By Road, Express"
                                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Vehicle Number</label>
                                    <input
                                        type="text"
                                        value={vehicleNumber}
                                        onChange={(e) => setVehicleNumber(e.target.value)}
                                        placeholder="e.g. MH-12-AB-1234"
                                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Freight Cost (₹)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={transportationCharges === 0 ? "" : transportationCharges}
                                        onChange={(e) => setTransportationCharges(parseFloat(e.target.value) || 0)}
                                        placeholder="0.00"
                                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Packaging Charges (₹)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={packagingCharges === 0 ? "" : packagingCharges}
                                        onChange={(e) => setPackagingCharges(parseFloat(e.target.value) || 0)}
                                        placeholder="0.00"
                                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Invoice Items Section */}
                        <div className="space-y-4">
                            <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800">
                                <div className="flex items-center gap-4">
                                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                        <Package className="w-5 h-5 text-blue-600" />
                                        Invoice Products & Items ({items.length})
                                    </h3>
                                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-xl border border-slate-200 dark:border-slate-700">
                                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Apply GST % To All:</span>
                                        <input
                                            type="number"
                                            min="0"
                                            className="w-14 text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 text-center dark:text-white"
                                            value={globalTaxRate === 0 ? "" : globalTaxRate}
                                            onChange={(e) => handleGlobalTaxChange(parseFloat(e.target.value) || 0)}
                                            placeholder="0"
                                        />
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={addItem}
                                    className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors"
                                >
                                    <Plus size={16} /> Add Product
                                </button>
                            </div>

                            <div className="space-y-4">
                                {items.map((entry, index) => (
                                    <div key={index} className="p-4 bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-2xl relative group shadow-sm">
                                        {items.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeItem(index)}
                                                className="absolute -top-2.5 -right-2.5 p-1.5 bg-red-100 text-red-600 dark:bg-red-900/80 dark:text-red-300 rounded-full opacity-90 hover:opacity-100 transition-opacity"
                                                title="Remove Item"
                                            >
                                                <X size={14} />
                                            </button>
                                        )}

                                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                            {/* Type & Dropdown */}
                                            <div className="md:col-span-4 space-y-2">
                                                <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                                                    <button
                                                        type="button"
                                                        onClick={() => updateItem(index, 'itemType', 'fg')}
                                                        className={`flex-1 py-1 text-xs font-medium rounded-lg transition-all ${entry.itemType === 'fg' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-300 font-bold' : 'text-slate-500'}`}
                                                    >
                                                        FG Catalog Item
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => updateItem(index, 'itemType', 'custom')}
                                                        className={`flex-1 py-1 text-xs font-medium rounded-lg transition-all ${entry.itemType === 'custom' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-300 font-bold' : 'text-slate-500'}`}
                                                    >
                                                        Custom Item
                                                    </button>
                                                </div>

                                                {entry.itemType === 'fg' ? (
                                                    <SearchableSelect
                                                        options={fgOptions}
                                                        value={entry.fgItem || entry.material || ''}
                                                        onChange={(val: any) => handleFGSelection(index, val)}
                                                        placeholder="Select Finished Good"
                                                    />
                                                ) : (
                                                    <input
                                                        type="text"
                                                        value={entry.materialName}
                                                        onChange={e => updateItem(index, 'materialName', e.target.value)}
                                                        placeholder="Custom Item Name *"
                                                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white"
                                                    />
                                                )}
                                            </div>

                                            {/* HSN & Description */}
                                            <div className="md:col-span-2 space-y-2">
                                                <input
                                                    type="text"
                                                    value={entry.hsnCode || ''}
                                                    onChange={e => updateItem(index, 'hsnCode', e.target.value)}
                                                    placeholder="HSN Code"
                                                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white"
                                                />
                                            </div>

                                            {/* Qty & Unit */}
                                            <div className="md:col-span-2 flex gap-2">
                                                <div className="flex-1">
                                                    <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Qty</label>
                                                    <input
                                                        type="number"
                                                        min="0.01"
                                                        step="0.01"
                                                        value={entry.quantity || ''}
                                                        onChange={e => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                                                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white font-medium"
                                                    />
                                                </div>
                                                <div className="w-16">
                                                    <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Unit</label>
                                                    <input
                                                        type="text"
                                                        value={entry.unit}
                                                        onChange={e => updateItem(index, 'unit', e.target.value.toUpperCase())}
                                                        className="w-full px-2 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white text-center uppercase"
                                                    />
                                                </div>
                                            </div>

                                            {/* Financials (Unit Rate, Tax %, Line Total) */}
                                            <div className="md:col-span-4 flex gap-2">
                                                <div className="flex-1">
                                                    <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Rate (₹)</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={entry.rate === 0 ? "" : entry.rate}
                                                        onChange={e => updateItem(index, 'rate', parseFloat(e.target.value) || 0)}
                                                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white font-medium"
                                                    />
                                                </div>
                                                <div className="w-16">
                                                    <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">GST %</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.1"
                                                        value={entry.taxRate === 0 ? "" : entry.taxRate}
                                                        onChange={e => updateItem(index, 'taxRate', parseFloat(e.target.value) || 0)}
                                                        className="w-full px-2 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white text-center font-medium"
                                                    />
                                                </div>
                                                <div className="flex-1">
                                                    <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Total (Incl Tax)</label>
                                                    <div className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center justify-between">
                                                        <span className="text-slate-400 text-xs">₹</span>
                                                        <span>{((entry.amount || 0) + (entry.taxAmount || 0)).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Bottom Summary & Notes */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-4 border-t border-slate-200 dark:border-slate-800">
                            <div className="lg:col-span-7 space-y-3">
                                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Payment Terms & Remarks</label>
                                <textarea
                                    value={otherDetails}
                                    onChange={(e) => setOtherDetails(e.target.value)}
                                    rows={4}
                                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm dark:text-white resize-none"
                                    placeholder="Payment terms, bank instructions, delivery details..."
                                />
                            </div>

                            <div className="lg:col-span-5 bg-slate-50 dark:bg-slate-800/60 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                                <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                                    <span>Subtotal</span>
                                    <span className="font-semibold text-slate-900 dark:text-white">₹{subtotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                                </div>
                                <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                                    <span>Total Tax (GST)</span>
                                    <span className="font-semibold text-slate-900 dark:text-white">₹{totalTax.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                                </div>
                                <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                                    <span>Freight Charges</span>
                                    <span className="font-semibold text-slate-900 dark:text-white">+ ₹{Number(transportationCharges || 0).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                                    <span>Packaging Charges</span>
                                    <span className="font-semibold text-slate-900 dark:text-white">+ ₹{Number(packagingCharges || 0).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400 items-center">
                                    <span>Discount</span>
                                    <input
                                        type="number"
                                        min="0"
                                        value={discount === 0 ? "" : discount}
                                        onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                                        className="w-28 px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-right text-sm font-semibold dark:text-white"
                                        placeholder="0"
                                    />
                                </div>
                                <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                                    <span className="text-base font-bold text-slate-900 dark:text-white">Grand Total Amount</span>
                                    <span className="text-xl font-bold text-blue-600 dark:text-blue-400">₹{totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                                </div>
                            </div>
                        </div>
                    </form>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-end gap-3 sticky bottom-0 z-20">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="billing-form"
                        disabled={loading}
                        className="px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-2xl shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50"
                    >
                        {loading ? "Saving..." : isEditing ? "Update Tax Invoice" : "Create Tax Invoice"}
                    </button>
                </div>
            </div>
        </div>
    );
}

/**
 * Billing Modal Component
 * Modal form for creating and editing Tax Invoices / Bills
 * Clean, single-theme sleek UI layout (no multicolor)
 * Supports FG Catalog Selection & Custom Products, Inward PO pre-fill, Freight & Packaging Charges
 */

"use client";

import { useState, useEffect, useMemo } from "react";
import { X, Plus, Trash2, Package, User, Calendar, Hash, FileText, Truck, Calculator, IndianRupee, CheckCircle2, AlertTriangle } from "lucide-react";
import { BillingModalProps, RmBoItem } from "@/src/features/store/types/store.types";
import SearchableSelect from "../SearchableSelect";
import { useGetStoreDataQuery } from "@/src/store/services/storeService";
import { getCurrencySymbol, CURRENCY_OPTIONS } from "@/src/utils/currencyHelper";

interface ExtendedBillingModalProps extends BillingModalProps {
    materials?: RmBoItem[];
    inHouseItems?: any[];
    fgItems?: any[];
}

interface InvoiceItemEntry {
    itemType: 'fg';
    fgItem: string;
    material?: string;
    component?: string;
    materialName: string;
    hsnCode?: string;
    quantity: number;
    unit: string;
    rate: number;
    amount: number;
    taxRate?: number;
    taxAmount?: number;
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
    const [currency, setCurrency] = useState("INR");
    const [transportationType, setTransportationType] = useState("Road Transport");
    const [transportationCharges, setTransportationCharges] = useState(0);
    const [vehicleNumber, setVehicleNumber] = useState("");
    const [packagingType, setPackagingType] = useState("Standard Packaging");
    const [packagingCharges, setPackagingCharges] = useState(0);
    const [discount, setDiscount] = useState(0);
    const [otherDetails, setOtherDetails] = useState("");
    const [status, setStatus] = useState("Draft");
    const [globalTaxRate, setGlobalTaxRate] = useState(0);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});

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
            setCurrency(initialData.currency || (initialData as any).po?.currency || (initialData as any).dc?.currency || "INR");
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
                        itemType: 'fg' as const,
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
            setCurrency("INR");
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

    const availablePOs = useMemo(() => {
        if (!incomingPOs || !Array.isArray(incomingPOs)) return [];
        return incomingPOs.filter((po: any) => {
            if (po.status === 'Completed' || po.status === 'Cancelled') return false;
            if (customer && customer !== '') {
                const poCustId = typeof po.customer === 'object' ? po.customer?._id : po.customer;
                return poCustId?.toString() === customer?.toString();
            }
            return true;
        });
    }, [incomingPOs, customer]);

    const handleCustomerChange = (customerId: string) => {
        setCustomer(customerId);
        const selectedCustomer = customers.find(c => (c._id || (c as any).id) === customerId);
        if (selectedCustomer) {
            setCustomerName(selectedCustomer.name || (selectedCustomer as any).customerName || "");
            setCustomerAddress(selectedCustomer.address || (selectedCustomer as any).billingAddress || "");
            setCustomerGST((selectedCustomer as any).gstNumber || (selectedCustomer as any).gst || "");
        }
        if (customerPoReference && Array.isArray(incomingPOs)) {
            const currentPo = incomingPOs.find((p: any) => p._id === customerPoReference);
            if (currentPo) {
                const poCustId = typeof currentPo.customer === 'object' ? currentPo.customer?._id : currentPo.customer;
                if (poCustId?.toString() !== customerId?.toString()) {
                    setCustomerPoReference("");
                }
            }
        }
    };

    const handlePOSelect = (poId: string) => {
        setCustomerPoReference(poId);
        if (!poId) return;

        const po = Array.isArray(incomingPOs) ? incomingPOs.find((p: any) => p._id === poId) : null;
        if (po) {
            if (po.currency) {
                setCurrency(po.currency);
            }
            if (po.customer) {
                const custId = typeof po.customer === 'object' ? po.customer._id : po.customer;
                handleCustomerChange(custId);
            }
            if (po.items && po.items.length > 0) {
                const pendingItems = po.items.filter((i: any) => {
                    const remainingQty = (Number(i.quantity) || 0) - (Number(i.billedQuantity) || 0);
                    return remainingQty > 0;
                });

                if (pendingItems.length === 0) {
                    setFormErrors({ server_error: "All items in this Customer PO have already been fully billed." });
                    return;
                }

                const mappedItems: InvoiceItemEntry[] = pendingItems.map((i: any) => {
                    const rawFgId = typeof i.fgItem === 'object' ? i.fgItem?._id : i.fgItem || "";
                    const matchedFG = availableFGItems.find(f => 
                        (rawFgId && (f._id === rawFgId || f.id === rawFgId)) ||
                        (f.name && i.productName && f.name.trim().toLowerCase() === i.productName.trim().toLowerCase())
                    );
                    const finalFgId = matchedFG?._id || rawFgId || "";
                    const remainingQty = Math.max(1, (Number(i.quantity) || 1) - (Number(i.billedQuantity) || 0));
                    const priceConfig = Array.isArray(priceLists) ? priceLists.find((p: any) => (p.fgItem?._id || p.fgItem) === finalFgId) : null;
                    const rate = Number(i.pricePerQuantity ?? i.rate ?? priceConfig?.price ?? matchedFG?.sellingPrice ?? matchedFG?.rate ?? 0);
                    const amt = remainingQty * rate;
                    const taxRate = Number(i.taxRate ?? priceConfig?.taxRate ?? matchedFG?.taxRate ?? globalTaxRate ?? 18);
                    const taxAmt = amt * (taxRate / 100);
                    const hsn = i.hsnCode || priceConfig?.hsnCode || matchedFG?.hsnCode || "";
                    const desc = i.description || matchedFG?.description || matchedFG?.partDescription || "";
                    const unit = i.unit || matchedFG?.unit || "PCS";

                    return {
                        itemType: 'fg',
                        fgItem: finalFgId,
                        materialName: i.productName || matchedFG?.name || "",
                        hsnCode: hsn,
                        quantity: remainingQty,
                        unit: unit,
                        rate: rate,
                        amount: amt,
                        taxRate: taxRate,
                        taxAmount: taxAmt,
                        description: desc
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
        const taxRate = Number(priceConfig?.taxRate ?? selectedFG?.taxRate ?? globalTaxRate ?? 18);
        const name = selectedFG?.name || selectedFG?.partName || selectedFG?.componentName || "";
        const hsn = priceConfig?.hsnCode || selectedFG?.hsnCode || "";
        const desc = selectedFG?.description || selectedFG?.partDescription || "";
        const unit = selectedFG?.unit || "PCS";
        const qty = newItems[index].quantity || 1;
        const amt = qty * rate;
        const taxAmt = amt * (taxRate / 100);

        newItems[index] = {
            ...newItems[index],
            fgItem: selectedFgId,
            materialName: name,
            description: desc,
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

        if (field === 'quantity' || field === 'rate' || field === 'taxRate') {
            const qty = field === 'quantity' ? Number(value) : item.quantity;
            const rate = field === 'rate' ? Number(value) : item.rate;
            const taxRate = field === 'taxRate' ? Number(value) : item.taxRate;

            item.amount = qty * rate;
            item.taxAmount = (item.amount * (taxRate || 0)) / 100;
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

        const errors: Record<string, string> = {};
        if (!customer) {
            errors.customer = "Customer is required";
        }
        if (!invoiceNumber || !invoiceNumber.trim()) {
            errors.invoiceNumber = "Invoice number is required";
        }
        if (!date) {
            errors.date = "Invoice date is required";
        }

        if (!items || items.length === 0) {
            errors.items = "At least one item is required";
        } else {
            items.forEach((item, index) => {
                if (!item.fgItem || item.fgItem.trim() === "") {
                    errors[`item_${index}_fg`] = "Select FG Item";
                }
                if (!item.quantity || Number(item.quantity) <= 0) {
                    errors[`item_${index}_quantity`] = "Qty > 0 required";
                } else {
                    const fg = (availableFGItems || []).find((f: any) => (f._id || f.id) === item.fgItem);
                    const stock = fg ? Number(fg.quantity || 0) : 0;
                    if (!fg || stock <= 0) {
                        errors[`item_${index}_quantity`] = "Out of stock (0 avail)";
                    } else if (Number(item.quantity) > stock) {
                        errors[`item_${index}_quantity`] = `Exceeds stock (${stock} avail)`;
                    }
                }
                if (item.rate === undefined || item.rate === null || Number(item.rate) <= 0) {
                    errors[`item_${index}_rate`] = "Rate > 0 required";
                }
            });
        }

        // Validation against Customer PO
        if (customerPoReference && incomingPOs) {
            const po = (incomingPOs as any[]).find(p => p._id === customerPoReference);
            if (po) {
                items.forEach((item, index) => {
                    const poItem = po.items.find((i: any) => i.productName === item.materialName || i.fgItem?._id === item.fgItem || i.fgItem === item.fgItem);
                    if (poItem) {
                        const remaining = poItem.quantity - (poItem.billedQuantity || 0);
                        if (item.quantity > remaining) {
                            errors[`item_${index}_quantity`] = `Exceeds PO balance (${remaining})`;
                        }
                    }
                });
            }
        }

        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            const targetForm = e.currentTarget as HTMLElement;
            if (targetForm) {
                setTimeout(() => {
                    const firstInvalid = targetForm.querySelector('[data-has-error="true"]');
                    if (firstInvalid) {
                        firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 50);
            }
            return;
        }

        setFormErrors({});

        const cleanedItems = items.map(entry => {
            const itemPayload: any = {
                itemType: 'fg',
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
            currency,
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
        if (customerPoReference && customerPoReference !== "") {
            const selectedPoObj = (incomingPOs || []).find((p: any) => p._id === customerPoReference || p.poNumber === customerPoReference);
            payload.customerPoReference = selectedPoObj ? selectedPoObj.poNumber : customerPoReference;
        }

        onSubmit(payload);
    };

    if (!isOpen) return null;

    const fgOptions = (availableFGItems || []).map((fg: any) => {
        const stock = Number(fg.quantity || 0);
        return {
            value: fg._id || fg.id,
            label: `${fg.name || fg.partName || 'FG Product'} (${fg.code || fg.itemCode || 'FG'}) — Stock: ${stock} ${fg.unit || 'PCS'}`
        };
    });

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
                                {isEditing ? "Edit Tax Invoice" : "Create Tax Invoice"}
                            </h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Generate official GST sales invoice with live Finished Goods inventory deduction
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Modal Body */}
                <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-6">
                    <form onSubmit={handleSubmit} id="billing-form" className="space-y-6">
                        
                        {/* Visual Error Summary Alert Banner */}
                        {Object.keys(formErrors).length > 0 && (
                            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 rounded-xl flex items-center justify-between gap-2.5 text-rose-800 dark:text-rose-300 animate-in fade-in duration-150 shadow-2xs">
                                <div className="flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                                    <span className="text-xs font-bold">
                                        Please fill in the highlighted compulsory field{Object.keys(formErrors).length > 1 ? 's' : ''} before creating Tax Invoice.
                                    </span>
                                </div>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-200 dark:bg-rose-900 text-rose-900 dark:text-rose-200">
                                    {Object.keys(formErrors).length} required
                                </span>
                            </div>
                        )}

                        {/* Section 1: Customer & PO Reference */}
                        <div className="bg-slate-50 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
                            <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-700">
                                <User className="w-4 h-4 text-blue-600" />
                                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Customer & Order Details</h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="space-y-1" data-has-error={!!formErrors.customer}>
                                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                                        <span>Customer <span className="text-red-500">*</span></span>
                                        {formErrors.customer && <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold">{formErrors.customer}</span>}
                                    </label>
                                    <SearchableSelect
                                        options={customers.map((c) => ({ value: c._id || (c as any).id, label: c.name || (c as any).customerName || '' }))}
                                        value={customer}
                                        hasError={!!formErrors.customer}
                                        onChange={(val: any) => {
                                            handleCustomerChange(val);
                                            if (val) clearError('customer');
                                        }}
                                        placeholder="Select Customer..."
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">Currency</label>
                                    <select
                                        value={currency || "INR"}
                                        onChange={(e) => setCurrency(e.target.value)}
                                        className="w-full px-3 py-2 bg-indigo-50/50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl text-sm font-bold text-indigo-700 dark:text-indigo-300 outline-none"
                                    >
                                        {CURRENCY_OPTIONS.map((c) => (
                                            <option key={c.code} value={c.code}>
                                                {c.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-1" data-has-error={!!formErrors.invoiceNumber}>
                                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                                        <span>Invoice Number <span className="text-red-500">*</span></span>
                                        {formErrors.invoiceNumber && <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold">{formErrors.invoiceNumber}</span>}
                                    </label>
                                    <input
                                        type="text"
                                        value={invoiceNumber}
                                        onChange={(e) => {
                                            setInvoiceNumber(e.target.value);
                                            if (e.target.value.trim()) clearError('invoiceNumber');
                                        }}
                                        className={`w-full px-3 py-2 rounded-xl text-sm font-mono outline-none transition-all ${
                                            formErrors.invoiceNumber
                                                ? 'bg-rose-50/50 dark:bg-rose-950/40 border border-rose-500 text-rose-900 dark:text-rose-100 ring-1 ring-rose-400'
                                                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white'
                                        }`}
                                    />
                                </div>

                                <div className="space-y-1" data-has-error={!!formErrors.date}>
                                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                                        <span>Invoice Date <span className="text-red-500">*</span></span>
                                        {formErrors.date && <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold">{formErrors.date}</span>}
                                    </label>
                                    <input
                                        type="date"
                                        value={date}
                                        onChange={(e) => {
                                            setDate(e.target.value);
                                            if (e.target.value) clearError('date');
                                        }}
                                        className={`w-full px-3 py-2 rounded-xl text-sm outline-none transition-all ${
                                            formErrors.date
                                                ? 'bg-rose-50/50 dark:bg-rose-950/40 border border-rose-500 text-rose-900 dark:text-rose-100 ring-1 ring-rose-400'
                                                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white'
                                        }`}
                                    />
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Customer PO Reference</label>
                                    <SearchableSelect
                                        options={[
                                            { value: "", label: "Direct / No PO" },
                                            ...availablePOs.map((po: any) => ({
                                                value: po._id,
                                                label: `${po.poNumber} — ${po.customerName || po.customer?.name} (${po.items?.length || 0} items)`
                                            }))
                                        ]}
                                        value={customerPoReference}
                                        onChange={(val: any) => handlePOSelect(val)}
                                        placeholder="Link Customer PO (Optional)..."
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">GST Number</label>
                                    <input
                                        type="text"
                                        value={customerGST}
                                        onChange={(e) => setCustomerGST(e.target.value)}
                                        placeholder="e.g. 29AAAAA0000A1Z5"
                                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white font-mono"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Status</label>
                                    <select
                                        value={status}
                                        onChange={(e) => setStatus(e.target.value)}
                                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white"
                                    >
                                        <option value="Draft">Draft</option>
                                        <option value="Issued">Issued / Billed</option>
                                        <option value="Paid">Paid</option>
                                        <option value="Cancelled">Cancelled</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Billing Address</label>
                                <input
                                    type="text"
                                    value={customerAddress}
                                    onChange={(e) => setCustomerAddress(e.target.value)}
                                    placeholder="Customer full billing address"
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white"
                                />
                            </div>
                        </div>

                        {/* Section 2: Logistics & Transportation */}
                        <div className="bg-slate-50 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
                            <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-700">
                                <Truck className="w-4 h-4 text-blue-600" />
                                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Transport & Packaging Charges</h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Transport Mode</label>
                                    <select
                                        value={transportationType}
                                        onChange={(e) => setTransportationType(e.target.value)}
                                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white"
                                    >
                                        <option value="Road Transport">Road Transport</option>
                                        <option value="Express Courier">Express Courier</option>
                                        <option value="Rail Freight">Rail Freight</option>
                                        <option value="Air Cargo">Air Cargo</option>
                                        <option value="Customer Pick-up">Customer Pick-up</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Vehicle / Tracking No.</label>
                                    <input
                                        type="text"
                                        value={vehicleNumber}
                                        onChange={(e) => setVehicleNumber(e.target.value)}
                                        placeholder="e.g. KA-01-AB-1234"
                                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Freight Charges ({getCurrencySymbol(currency)})</label>
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
                                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Packaging Charges ({getCurrencySymbol(currency)})</label>
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
                                        Finished Goods & Invoice Items ({items.length})
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

                            {/* Desktop Table Header */}
                            <div className="hidden lg:grid grid-cols-12 gap-3 px-4 py-2 text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider bg-slate-100/60 dark:bg-slate-800/60 rounded-xl">
                                <div className="col-span-3">Finished Good (FG) *</div>
                                <div className="col-span-2">Item Description *</div>
                                <div className="col-span-1 text-center">HSN</div>
                                <div className="col-span-1 text-center">Qty *</div>
                                <div className="col-span-1 text-center">Unit</div>
                                <div className="col-span-2 text-right">Unit Rate ({getCurrencySymbol(currency)}) *</div>
                                <div className="col-span-1 text-center">GST %</div>
                                <div className="col-span-1 text-right">Total ({getCurrencySymbol(currency)})</div>
                            </div>

                            <div className="space-y-3">
                                {items.map((entry, index) => {
                                    const selectedFgId = entry.fgItem || entry.material || entry.component;
                                    const fg = (availableFGItems || []).find((f: any) => (f._id || f.id) === selectedFgId);
                                    const stock = fg ? Number(fg.quantity || 0) : 0;
                                    const isOverStock = Number(entry.quantity || 0) > stock;

                                    return (
                                        <div key={index} className="p-4 bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-2xl relative group shadow-sm">
                                            {items.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeItem(index)}
                                                    className="absolute -top-2.5 -right-2.5 p-1.5 bg-red-100 text-red-600 dark:bg-red-900/80 dark:text-red-300 rounded-full opacity-90 hover:opacity-100 transition-opacity z-10"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            )}

                                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
                                                {/* FG Item Selector */}
                                                <div className="col-span-12 lg:col-span-3 space-y-1" data-has-error={!!formErrors[`item_${index}_fg`]}>
                                                    <label className="block lg:hidden text-[10px] uppercase font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                                                        <span>Select Finished Good <span className="text-red-500">*</span></span>
                                                        {formErrors[`item_${index}_fg`] && <span className="text-[9px] text-rose-600 dark:text-rose-400 font-bold lowercase">{formErrors[`item_${index}_fg`]}</span>}
                                                    </label>
                                                    <SearchableSelect
                                                        options={fgOptions}
                                                        value={entry.fgItem || ""}
                                                        hasError={!!formErrors[`item_${index}_fg`]}
                                                        onChange={(val) => {
                                                            handleFGSelection(index, val);
                                                            if (val) clearError(`item_${index}_fg`);
                                                        }}
                                                        placeholder="Search Finished Goods..."
                                                    />
                                                    {fg && (
                                                        <div className="mt-1">
                                                            {stock <= 0 ? (
                                                                <span className="text-[10px] font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950 px-2 py-0.5 rounded-lg border border-rose-200 dark:border-rose-800 inline-flex items-center gap-1">
                                                                    <AlertTriangle size={11} className="text-rose-600" /> Out of Stock (0 {fg.unit || 'PCS'}) — Billing Blocked
                                                                </span>
                                                            ) : isOverStock ? (
                                                                <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded-lg border border-amber-200 dark:border-amber-800 inline-flex items-center gap-1">
                                                                    <AlertTriangle size={11} className="text-amber-600" /> Avail Stock: {stock} {fg.unit || 'PCS'} (Req: {entry.quantity})
                                                                </span>
                                                            ) : (
                                                                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800 inline-flex items-center gap-1">
                                                                    <CheckCircle2 size={11} className="text-emerald-600" /> Avail Stock: {stock} {fg.unit || 'PCS'}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Product Name Custom Override */}
                                                <div className="col-span-12 lg:col-span-2 space-y-1">
                                                    <label className="block lg:hidden text-[10px] uppercase font-bold text-slate-400">Product Description *</label>
                                                    <input
                                                        type="text"
                                                        value={entry.materialName}
                                                        onChange={e => updateItem(index, 'materialName', e.target.value)}
                                                        placeholder="Item Name / Description"
                                                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white font-medium outline-none"
                                                    />
                                                </div>

                                                {/* HSN Code */}
                                                <div className="col-span-4 lg:col-span-1 space-y-1">
                                                    <label className="block lg:hidden text-[10px] uppercase font-bold text-slate-400">HSN</label>
                                                    <input
                                                        type="text"
                                                        value={entry.hsnCode || ''}
                                                        onChange={e => updateItem(index, 'hsnCode', e.target.value)}
                                                        placeholder="HSN"
                                                        className="w-full px-2 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white font-mono text-center outline-none"
                                                    />
                                                </div>

                                                {/* Quantity */}
                                                <div className="col-span-4 lg:col-span-1 space-y-1" data-has-error={!!formErrors[`item_${index}_quantity`]}>
                                                    <label className="block lg:hidden text-[10px] uppercase font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                                                        <span>Qty <span className="text-red-500">*</span></span>
                                                        {formErrors[`item_${index}_quantity`] && <span className="text-[9px] text-rose-600 dark:text-rose-400 font-bold">{formErrors[`item_${index}_quantity`]}</span>}
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={entry.quantity || ''}
                                                        onChange={e => {
                                                            updateItem(index, 'quantity', parseFloat(e.target.value) || 0);
                                                            clearError(`item_${index}_quantity`);
                                                        }}
                                                        className={`w-full px-2 py-2 border rounded-xl text-sm font-bold text-center outline-none transition-all ${
                                                            formErrors[`item_${index}_quantity`]
                                                                ? 'bg-rose-50/50 dark:bg-rose-950/40 border-rose-500 text-rose-900 dark:text-rose-100 ring-1 ring-rose-400'
                                                                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white'
                                                        }`}
                                                    />
                                                </div>

                                                {/* Unit */}
                                                <div className="col-span-4 lg:col-span-1 space-y-1">
                                                    <label className="block lg:hidden text-[10px] uppercase font-bold text-slate-400">Unit</label>
                                                    <input
                                                        type="text"
                                                        value={entry.unit}
                                                        onChange={e => updateItem(index, 'unit', e.target.value.toUpperCase())}
                                                        className="w-full px-2 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white text-center uppercase outline-none"
                                                    />
                                                </div>

                                                {/* Unit Rate - Wide Column for Large Numbers */}
                                                <div className="col-span-6 lg:col-span-2 space-y-1" data-has-error={!!formErrors[`item_${index}_rate`]}>
                                                    <label className="block lg:hidden text-[10px] uppercase font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                                                        <span>Rate ({getCurrencySymbol(currency)}) <span className="text-red-500">*</span></span>
                                                        {formErrors[`item_${index}_rate`] && <span className="text-[9px] text-rose-600 dark:text-rose-400 font-bold">{formErrors[`item_${index}_rate`]}</span>}
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={entry.rate === 0 ? "" : entry.rate}
                                                        onChange={e => {
                                                            updateItem(index, 'rate', parseFloat(e.target.value) || 0);
                                                            clearError(`item_${index}_rate`);
                                                        }}
                                                        placeholder={`0.00`}
                                                        className={`w-full px-3 py-2 border rounded-xl text-sm font-bold text-right font-mono outline-none transition-all ${
                                                            formErrors[`item_${index}_rate`]
                                                                ? 'bg-rose-50/50 dark:bg-rose-950/40 border-rose-500 text-rose-900 dark:text-rose-100 ring-1 ring-rose-400'
                                                                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 focus:border-indigo-500'
                                                        }`}
                                                    />
                                                </div>

                                                {/* GST % */}
                                                <div className="col-span-6 lg:col-span-1 space-y-1">
                                                    <label className="block lg:hidden text-[10px] uppercase font-bold text-slate-400">GST %</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.1"
                                                        value={entry.taxRate === 0 ? "" : entry.taxRate}
                                                        onChange={e => updateItem(index, 'taxRate', parseFloat(e.target.value) || 0)}
                                                        className="w-full px-1.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white text-center font-medium outline-none"
                                                    />
                                                </div>

                                                {/* Line Total */}
                                                <div className="col-span-12 lg:col-span-1 space-y-1">
                                                    <label className="block lg:hidden text-[10px] uppercase font-bold text-slate-400">Total</label>
                                                    <div className="w-full px-2 py-2 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center justify-end font-mono truncate" title={`${getCurrencySymbol(currency)}${((entry.amount || 0) + (entry.taxAmount || 0)).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`}>
                                                        {getCurrencySymbol(currency)}{((entry.amount || 0) + (entry.taxAmount || 0)).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Bottom Summary & Notes */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-4 border-t border-slate-200 dark:border-slate-800">
                            <div className="lg:col-span-6 space-y-3">
                                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Payment Terms & Remarks</label>
                                <textarea
                                    value={otherDetails}
                                    onChange={(e) => setOtherDetails(e.target.value)}
                                    rows={4}
                                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm dark:text-white resize-none"
                                    placeholder="Payment terms, bank instructions, delivery details..."
                                />
                            </div>

                            <div className="lg:col-span-6 bg-slate-50 dark:bg-slate-800/60 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                                <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                                    <span>Subtotal</span>
                                    <span className="font-semibold text-slate-900 dark:text-white font-mono">{getCurrencySymbol(currency)}{subtotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                                </div>
                                <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                                    <span>Total Tax (GST)</span>
                                    <span className="font-semibold text-slate-900 dark:text-white font-mono">{getCurrencySymbol(currency)}{totalTax.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                                </div>
                                <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                                    <span>Freight Charges</span>
                                    <span className="font-semibold text-slate-900 dark:text-white font-mono">+ {getCurrencySymbol(currency)}{Number(transportationCharges || 0).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                                    <span>Packaging Charges</span>
                                    <span className="font-semibold text-slate-900 dark:text-white font-mono">+ {getCurrencySymbol(currency)}{Number(packagingCharges || 0).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400 items-center">
                                    <span>Discount</span>
                                    <input
                                        type="number"
                                        min="0"
                                        value={discount === 0 ? "" : discount}
                                        onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                                        className="w-32 px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-right text-sm font-bold font-mono dark:text-white"
                                        placeholder="0"
                                    />
                                </div>
                                <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                                    <span className="text-base font-bold text-slate-900 dark:text-white">Grand Total Amount ({currency || "INR"})</span>
                                    <span className="text-2xl font-black text-blue-600 dark:text-blue-400 font-mono tracking-tight">
                                        {getCurrencySymbol(currency)}{totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                    </span>
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

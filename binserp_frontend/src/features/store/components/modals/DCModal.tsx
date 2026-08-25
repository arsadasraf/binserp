/**
 * DC Modal Component
 * Modal form for creating and editing Delivery Challans
 * Clean, single-theme sleek UI layout (no multicolor)
 * Supports FG Catalog Selection & Custom Products, Inward PO pre-fill, Freight & Packaging Charges
 */

"use client";

import { useState, useEffect, useMemo } from "react";
import { X, Plus, Trash2, Package, User, Calendar, Hash, FileText, Truck, Calculator, IndianRupee, CheckCircle2, AlertTriangle } from "lucide-react";
import { DCModalProps, RmBoItem } from "@/src/features/store/types/store.types";
import SearchableSelect from "../SearchableSelect";
import { useGetStoreDataQuery } from "@/src/store/services/storeService";
import Swal from "sweetalert2";

interface ExtendedDCModalProps extends DCModalProps {
    materials?: RmBoItem[];
    inHouseItems?: any[];
    fgItems?: any[];
}

interface DCItemEntry {
    itemType: 'fg';
    fgItem?: string;
    material?: string;
    component?: string;
    materialName: string;
    hsnCode?: string;
    quantity: number;
    unit: string;
    rate?: number;
    amount?: number;
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
    const [transportationType, setTransportationType] = useState("Road Transport");
    const [transportationCharges, setTransportationCharges] = useState(0);
    const [vehicleNumber, setVehicleNumber] = useState("");
    const [packagingType, setPackagingType] = useState("Standard Packaging");
    const [packagingCharges, setPackagingCharges] = useState(0);
    const [discount, setDiscount] = useState(0);
    const [otherDetails, setOtherDetails] = useState("");
    const [status, setStatus] = useState("Draft");
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

    // Fallback query to guarantee FG items are always available
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
            setTransportationType((initialData as any).transportationType || "Road Transport");
            setTransportationCharges((initialData as any).transportationCharges || 0);
            setVehicleNumber((initialData as any).vehicleNumber || "");
            setPackagingType((initialData as any).packagingType || "Standard Packaging");
            setPackagingCharges((initialData as any).packagingCharges || 0);
            setDiscount(initialData.discount || 0);
            setOtherDetails(initialData.otherDetails || (initialData as any).remarks || "");
            setStatus(initialData.status || "Draft");
            
            if (initialData.items && initialData.items.length > 0) {
                setItems(initialData.items.map((item: any) => {
                    const fgId = typeof item.fgItem === 'object' ? item.fgItem?._id : (item.fgItem || item.component || item.material || "");
                    const qty = item.quantity || 1;
                    const rate = item.rate || item.pricePerQuantity || 0;
                    return {
                        itemType: 'fg' as const,
                        fgItem: fgId,
                        material: item.material || "",
                        component: item.component || "",
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
        const po = Array.isArray(incomingPOs) ? incomingPOs.find((p: any) => p._id === poId) : null;
        if (po) {
            if (po.customer) {
                const custId = typeof po.customer === 'object' ? po.customer._id : po.customer;
                handleCustomerChange(custId);
            }
            if (po.items && po.items.length > 0) {
                // Filter only items with pending dispatch quantity > 0
                const pendingItems = po.items.filter((i: any) => {
                    const remainingQty = (i.quantity || 0) - (i.dispatchedQuantity || 0);
                    return remainingQty > 0;
                });

                if (pendingItems.length === 0) {
                    Swal.fire("PO Dispatch Info", "All items in this Customer PO have already been fully dispatched.", "info");
                    return;
                }

                const mappedItems: DCItemEntry[] = pendingItems.map((i: any) => {
                    const fgId = typeof i.fgItem === 'object' ? i.fgItem?._id : i.fgItem || "";
                    const reservedStock = i.allocatedFgQty !== undefined ? Number(i.allocatedFgQty || 0) : Number(i.quantity || 0);
                    const alreadyDispatched = Number(i.dispatchedQuantity || 0);
                    const availableForDispatch = Math.max(1, reservedStock > 0 ? (reservedStock - alreadyDispatched) : ((i.quantity || 1) - alreadyDispatched));
                    const rate = i.pricePerQuantity || i.rate || 0;
                    return {
                        itemType: 'fg' as const,
                        fgItem: fgId,
                        component: fgId,
                        materialName: i.productName || i.name || "",
                        hsnCode: i.hsnCode || "",
                        quantity: availableForDispatch,
                        unit: i.unit || "PCS",
                        rate: rate,
                        amount: availableForDispatch * rate,
                        description: `Reserved for PO ${po.poNumber || po.poReference}`
                    };
                });
                setItems(mappedItems);
            }
        }
    };

    const addItem = () => {
        setItems([
            ...items,
            { itemType: 'fg', fgItem: "", materialName: "", hsnCode: "", quantity: 1, unit: "PCS", rate: 0, amount: 0, description: "" }
        ]);
    };

    const handleFGSelection = (index: number, selectedFgId: string) => {
        const newItems = [...items];
        const selectedFG = availableFGItems.find(item => item._id === selectedFgId);
        const priceConfig = Array.isArray(priceLists) ? priceLists.find((p: any) => (p.fgItem?._id || p.fgItem) === selectedFgId) : null;
        
        const rate = Number(priceConfig?.price ?? selectedFG?.sellingPrice ?? selectedFG?.rate ?? 0);
        const name = selectedFG?.name || selectedFG?.partName || selectedFG?.componentName || "";
        const hsn = priceConfig?.hsnCode || selectedFG?.hsnCode || "";
        const unit = selectedFG?.unit || "PCS";
        const qty = newItems[index].quantity || 1;

        newItems[index] = {
            ...newItems[index],
            fgItem: selectedFgId,
            component: selectedFgId,
            materialName: name,
            hsnCode: hsn,
            unit: unit,
            rate: rate,
            amount: qty * rate,
        };

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

    const removeItem = (index: number) => {
        if (items.length > 1) {
            setItems(items.filter((_, i) => i !== index));
        }
    };

    const subtotal = useMemo(() => {
        return items.reduce((acc, curr) => acc + (curr.amount || (curr.quantity * (curr.rate || 0))), 0);
    }, [items]);

    const totalAmount = useMemo(() => {
        return Math.max(0, subtotal + Number(transportationCharges || 0) + Number(packagingCharges || 0) - Number(discount || 0));
    }, [subtotal, transportationCharges, packagingCharges, discount]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        const errors: Record<string, string> = {};

        if (!customer) {
            errors.customer = 'Customer is required';
        }

        if (!date) {
            errors.date = 'Challan date is required';
        }

        // Strict Validation for FG item selection and Inventory Stock
        items.forEach((item, index) => {
            const fgId = item.fgItem || item.material || item.component;
            if (!fgId) {
                errors[`item_${index}_fg`] = 'Finished Good (FG) item is required';
                return;
            }

            const fg = (availableFGItems || []).find((f: any) => (f._id || f.id) === fgId);
            const stock = fg ? Number(fg.quantity || 0) : 0;
            if (!fg || stock <= 0) {
                errors[`item_${index}_quantity`] = `Out of stock (Avail: 0)`;
            } else if (Number(item.quantity) > stock) {
                errors[`item_${index}_quantity`] = `Exceeds stock (Avail: ${stock})`;
            } else if (Number(item.quantity) <= 0) {
                errors[`item_${index}_quantity`] = 'Dispatch qty must be > 0';
            }
        });

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

        const payloadItems = items.map(entry => {
            const itemPayload: any = {
                itemType: 'fg',
                materialName: entry.materialName,
                hsnCode: entry.hsnCode,
                quantity: entry.quantity,
                unit: entry.unit,
                rate: entry.rate || 0,
                amount: entry.amount || (entry.quantity * (entry.rate || 0)),
                description: entry.description,
            };
            if (entry.fgItem && entry.fgItem !== "") itemPayload.fgItem = entry.fgItem;
            if (entry.component && entry.component !== "") itemPayload.component = entry.component;
            return itemPayload;
        });

        // Validation against Customer PO
        if (customerPoReference && incomingPOs) {
            const po = (incomingPOs as any[]).find(p => p._id === customerPoReference);
            if (po) {
                for (const item of payloadItems) {
                    const poItem = po.items.find((i: any) => i.productName === item.materialName || i.fgItem?._id === item.fgItem || i.fgItem === item.fgItem);
                    if (poItem) {
                        const remaining = poItem.quantity - (poItem.dispatchedQuantity || 0);
                        if (item.quantity > remaining) {
                            Swal.fire("Validation Warning", `Requested ${item.quantity} ${item.unit} exceeds remaining PO balance (${remaining} ${item.unit}). Proceeding with dispatch.`, "warning");
                        }
                    }
                }
            }
        }

        const payload: any = {
            dcNumber,
            date,
            customerName,
            customerAddress,
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
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[200] flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-7xl w-full max-h-[92vh] flex flex-col border border-slate-200 dark:border-slate-800 my-auto">
                
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
                                Goods dispatch challan & logistics documentation
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
                    <form id="dc-form" onSubmit={handleSubmit} className="space-y-6">
                        
                        {/* Visual Error Summary Alert Banner */}
                        {Object.keys(formErrors).length > 0 && (
                            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 rounded-xl flex items-center justify-between gap-2.5 text-rose-800 dark:text-rose-300 animate-in fade-in duration-150 shadow-2xs">
                                <div className="flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                                    <span className="text-xs font-bold">
                                        Please fill in the highlighted compulsory field{Object.keys(formErrors).length > 1 ? 's' : ''} before creating Delivery Challan.
                                    </span>
                                </div>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-200 dark:bg-rose-900 text-rose-900 dark:text-rose-200">
                                    {Object.keys(formErrors).length} required
                                </span>
                            </div>
                        )}

                        {/* Header Details Card */}
                        <div className="bg-slate-50/70 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                                <User className="w-4 h-4 text-blue-600" />
                                <span>Challan & Customer Details</span>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">DC Number</label>
                                    <input
                                        type="text"
                                        value={dcNumber}
                                        readOnly
                                        className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-600 dark:text-slate-300 cursor-not-allowed"
                                    />
                                </div>

                                <div className="space-y-1" data-has-error={!!formErrors.date}>
                                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                                        <span>Date <span className="text-red-500">*</span></span>
                                        {formErrors.date && <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold">{formErrors.date}</span>}
                                    </label>
                                    <input
                                        type="date"
                                        value={date}
                                        onChange={(e) => {
                                            setDate(e.target.value);
                                            if (e.target.value) clearError('date');
                                        }}
                                        className={`w-full px-3 py-2 border rounded-xl text-xs outline-none transition-all ${
                                            formErrors.date
                                                ? 'bg-rose-50/50 dark:bg-rose-950/40 border-rose-500 text-rose-900 dark:text-rose-100 ring-1 ring-rose-400 focus:ring-rose-500'
                                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white'
                                        }`}
                                    />
                                </div>

                                <div className="space-y-1" data-has-error={!!formErrors.customer}>
                                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                                        <span>Customer <span className="text-red-500">*</span></span>
                                        {formErrors.customer && <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold">{formErrors.customer}</span>}
                                    </label>
                                    <SearchableSelect
                                        options={customers.map((c) => ({ value: c._id || (c as any).id, label: c.name || (c as any).customerName || '' }))}
                                        value={customer || ""}
                                        hasError={!!formErrors.customer}
                                        onChange={(val: any) => {
                                            handleCustomerChange(val);
                                            if (val) clearError('customer');
                                        }}
                                        placeholder="Select Customer"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Inward PO Ref (Optional Auto-Fill)</label>
                                    <SearchableSelect
                                        options={[
                                            { value: "", label: "Direct / No PO" },
                                            ...availablePOs.map((po: any) => ({
                                                value: po._id,
                                                label: `${po.poNumber} (${po.customerName || po.customer?.name || 'Customer'}) - ${po.status || 'Received'}`
                                            }))
                                        ]}
                                        value={customerPoReference || ""}
                                        onChange={(val: any) => handlePOSelect(val)}
                                        placeholder="Link Customer PO (Optional)..."
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Logistics Section */}
                        <div className="bg-slate-50/50 dark:bg-slate-800/30 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                                <Truck className="w-4 h-4 text-blue-600" />
                                <span>Logistics & Freight Information</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Transport Method</label>
                                    <select
                                        value={transportationType}
                                        onChange={(e) => setTransportationType(e.target.value)}
                                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white"
                                    >
                                        <option value="Road Transport">Road Transport (By Truck / Lorry)</option>
                                        <option value="Express Courier">Express Courier (Gati / BlueDart / DTDC)</option>
                                        <option value="Air Freight">Air Freight</option>
                                        <option value="Sea Freight">Sea Freight</option>
                                        <option value="Customer Self-Pickup">Customer Self-Pickup</option>
                                        <option value="Other / Custom">Other / Custom</option>
                                    </select>
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
                                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Freight Charges (₹)</label>
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
                                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Packaging Type</label>
                                    <select
                                        value={packagingType}
                                        onChange={(e) => setPackagingType(e.target.value)}
                                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white"
                                    >
                                        <option value="Standard Packaging">Standard Packaging (Carton Boxes)</option>
                                        <option value="Wooden Crating">Wooden Crating</option>
                                        <option value="Heavy Duty Pallet Packaging">Heavy Duty Pallet Packaging</option>
                                        <option value="Bubble Wrap & Stretch Film">Bubble Wrap & Stretch Film</option>
                                        <option value="Export Grade Packaging">Export Grade Packaging</option>
                                        <option value="Other / Custom">Other / Custom</option>
                                    </select>
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

                        {/* Items Section */}
                        <div className="space-y-4">
                            <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800">
                                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                    <Package className="w-5 h-5 text-blue-600" />
                                    Challan Line Items ({items.length})
                                </h3>
                                <button
                                    type="button"
                                    onClick={addItem}
                                    className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors"
                                >
                                    <Plus size={16} /> Add Row
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
                                                title="Remove Line"
                                            >
                                                <X size={14} />
                                            </button>
                                        )}

                                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                            {/* Finished Goods Item Selector */}
                                            <div className="md:col-span-4 space-y-2" data-has-error={!!formErrors[`item_${index}_fg`]}>
                                                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center justify-between">
                                                    <span className="flex items-center gap-1.5">
                                                        <Package size={13} className="text-blue-600" />
                                                        <span>Finished Good (FG) Item <span className="text-red-500">*</span></span>
                                                    </span>
                                                    {formErrors[`item_${index}_fg`] && (
                                                        <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold lowercase">
                                                            {formErrors[`item_${index}_fg`]}
                                                        </span>
                                                    )}
                                                </label>

                                                <SearchableSelect
                                                    options={fgOptions}
                                                    value={entry.fgItem || entry.component || ''}
                                                    hasError={!!formErrors[`item_${index}_fg`]}
                                                    onChange={(val: any) => {
                                                        handleFGSelection(index, val);
                                                        if (val) clearError(`item_${index}_fg`);
                                                    }}
                                                    placeholder="Select Finished Good"
                                                />
                                                {(() => {
                                                    const selectedFgId = entry.fgItem || entry.material || entry.component;
                                                    const fg = (availableFGItems || []).find((f: any) => (f._id || f.id) === selectedFgId);
                                                    if (!fg) return (
                                                        <span className="text-[10px] text-slate-400 dark:text-slate-500 italic block mt-1">
                                                            Select an FG item from catalog or Customer PO
                                                        </span>
                                                    );
                                                    const stock = Number(fg.quantity || 0);
                                                    const isOverStock = Number(entry.quantity || 0) > stock;
                                                    return (
                                                        <div className="mt-1">
                                                            {stock <= 0 ? (
                                                                  <span className="text-[11px] font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950 px-2 py-0.5 rounded-lg border border-rose-200 dark:border-rose-800 inline-flex items-center gap-1">
                                                                    <AlertTriangle size={12} className="text-rose-600" /> Out of Stock (0 {fg.unit || 'PCS'}) — Dispatch Blocked
                                                                </span>
                                                            ) : isOverStock ? (
                                                                <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded-lg border border-amber-200 dark:border-amber-800 inline-flex items-center gap-1">
                                                                    <AlertTriangle size={12} className="text-amber-600" /> Available Stock: {stock} {fg.unit || 'PCS'} (Req: {entry.quantity})
                                                                </span>
                                                            ) : (
                                                                <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800 inline-flex items-center gap-1">
                                                                    <CheckCircle2 size={12} className="text-emerald-600" /> Available Stock: {stock} {fg.unit || 'PCS'}
                                                                </span>
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                            </div>

                                            {/* HSN & Remarks */}
                                            <div className="md:col-span-3 space-y-2">
                                                <input
                                                    type="text"
                                                    value={entry.hsnCode || ''}
                                                    onChange={e => updateItem(index, 'hsnCode', e.target.value)}
                                                    placeholder="HSN Code"
                                                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white"
                                                />
                                                <input
                                                    type="text"
                                                    value={entry.description || ''}
                                                    onChange={e => updateItem(index, 'description', e.target.value)}
                                                    placeholder="Remarks / Specs"
                                                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs dark:text-white"
                                                />
                                            </div>

                                            {/* Qty & Unit */}
                                            <div className="md:col-span-2 flex gap-2">
                                                <div className="flex-1" data-has-error={!!formErrors[`item_${index}_quantity`]}>
                                                    <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1 flex items-center justify-between">
                                                        <span>Qty <span className="text-red-500">*</span></span>
                                                        {formErrors[`item_${index}_quantity`] && (
                                                            <span className="text-[9px] text-rose-600 dark:text-rose-400 font-bold">
                                                                Req
                                                            </span>
                                                        )}
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min="0.01"
                                                        step="0.01"
                                                        value={entry.quantity || ''}
                                                        onChange={e => {
                                                            const val = parseFloat(e.target.value) || 0;
                                                            updateItem(index, 'quantity', val);
                                                            if (val > 0) clearError(`item_${index}_quantity`);
                                                        }}
                                                        className={`w-full px-3 py-2 border rounded-xl text-sm font-medium outline-none transition-all ${
                                                            formErrors[`item_${index}_quantity`]
                                                                ? 'bg-rose-50/50 dark:bg-rose-950/40 border-rose-500 text-rose-900 dark:text-rose-100 ring-1 ring-rose-400 focus:ring-rose-500'
                                                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white'
                                                        }`}
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

                                            {/* Rate & Line Total */}
                                            <div className="md:col-span-3 flex gap-2">
                                                <div className="flex-1">
                                                    <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Unit Price (₹)</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={entry.rate === 0 ? "" : entry.rate}
                                                        onChange={e => updateItem(index, 'rate', parseFloat(e.target.value) || 0)}
                                                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white font-medium"
                                                    />
                                                </div>
                                                <div className="flex-1">
                                                    <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Line Amount</label>
                                                    <div className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center justify-between">
                                                        <span className="text-slate-400 text-xs">₹</span>
                                                        <span>{((entry.amount || 0)).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Bottom Summary & Options */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-4 border-t border-slate-200 dark:border-slate-800">
                            <div className="lg:col-span-7 space-y-3">
                                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Remarks / Delivery Notes</label>
                                <textarea
                                    value={otherDetails}
                                    onChange={(e) => setOtherDetails(e.target.value)}
                                    rows={3}
                                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm dark:text-white resize-none"
                                    placeholder="Special delivery notes or terms..."
                                />
                            </div>

                            <div className="lg:col-span-5 bg-slate-50 dark:bg-slate-800/60 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                                <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                                    <span>Items Subtotal</span>
                                    <span className="font-semibold text-slate-900 dark:text-white">₹{subtotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
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
                                    <span className="text-base font-bold text-slate-900 dark:text-white">Total DC Value</span>
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
                        form="dc-form"
                        disabled={loading}
                        className="px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-2xl shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50"
                    >
                        {loading ? "Saving..." : isEditing ? "Update Delivery Challan" : "Create Delivery Challan"}
                    </button>
                </div>
            </div>
        </div>
    );
}

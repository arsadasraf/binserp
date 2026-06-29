/**
 * DC Modal Component
 * Modal form for creating and editing Delivery Challans
 * Supports Master Data (FG) selection, Custom Items, HSN, Discount, and Other Details
 * Features a modern glassmorphism UI layout
 */

"use client";

import { useState, useEffect } from "react";
import { X, Plus, Trash2, Package, User, Calendar, Hash, FileText } from "lucide-react";
import { DCModalProps, DCFormData, RmBoItem } from "../../types/store.types";

interface ExtendedDCModalProps extends DCModalProps {
    materials?: RmBoItem[]; // For backward compatibility if passed
    inHouseItems?: any[]; // FG items
}

interface DCItemEntry {
    itemType: 'fg' | 'custom';
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
    customers,
    inHouseItems = [],
    loading,
    initialData,
    isEditing = false,
}: ExtendedDCModalProps) {
    const [dcNumber, setDcNumber] = useState("");
    const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
    const [customer, setCustomer] = useState("");
    const [customerName, setCustomerName] = useState("");
    const [customerAddress, setCustomerAddress] = useState("");
    const [discount, setDiscount] = useState(0);
    const [otherDetails, setOtherDetails] = useState("");
    const [status, setStatus] = useState("Draft");
    const [items, setItems] = useState<DCItemEntry[]>([{
        itemType: 'fg',
        material: "",
        component: "",
        materialName: "",
        hsnCode: "",
        quantity: 1,
        unit: "PCS",
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

    useEffect(() => {
        if (!isOpen) return;

        if (initialData) {
            setDcNumber(initialData.dcNumber || "");
            setDate(initialData.date ? new Date(initialData.date).toISOString().split("T")[0] : "");
            setCustomer(initialData.customer || "");
            setCustomerName(initialData.customerName || "");
            setCustomerAddress(initialData.customerAddress || "");
            setDiscount(initialData.discount || 0);
            setOtherDetails(initialData.otherDetails || "");
            setStatus(initialData.status || "Draft");
            
            if (initialData.items && initialData.items.length > 0) {
                setItems(initialData.items.map((item: any) => ({
                    itemType: item.itemType || (item.component || item.material ? 'fg' : 'custom'),
                    material: item.material || "",
                    component: item.component || "",
                    materialName: item.materialName || "",
                    hsnCode: item.hsnCode || "",
                    quantity: item.quantity || 1,
                    unit: item.unit || "PCS",
                    rate: item.rate,
                    amount: item.amount,
                    description: item.description || ""
                })));
            } else {
                setItems([{
                    itemType: 'fg',
                    material: "",
                    component: "",
                    materialName: "",
                    hsnCode: "",
                    quantity: 1,
                    unit: "PCS",
                    description: ""
                }]);
            }
        } else {
            setDcNumber(generateDCNumber());
            setDate(new Date().toISOString().split("T")[0]);
            setCustomer("");
            setCustomerName("");
            setCustomerAddress("");
            setDiscount(0);
            setOtherDetails("");
            setStatus("Draft");
            setItems([{
                itemType: 'fg',
                material: "",
                component: "",
                materialName: "",
                hsnCode: "",
                quantity: 1,
                unit: "PCS",
                description: ""
            }]);
        }
    }, [initialData, isOpen]);

    const handleCustomerChange = (customerId: string) => {
        setCustomer(customerId);
        const selectedCustomer = customers.find(c => c._id === customerId);
        if (selectedCustomer) {
            setCustomerName(selectedCustomer.name);
            setCustomerAddress(selectedCustomer.address || "");
        } else {
            setCustomerName("");
            setCustomerAddress("");
        }
    };

    const addItem = () => {
        setItems([
            ...items,
            { itemType: 'fg', material: "", component: "", materialName: "", hsnCode: "", quantity: 1, unit: "PCS", description: "" }
        ]);
    };

    const updateItem = (index: number, field: keyof DCItemEntry, value: any) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };

        if (field === 'itemType') {
            if (value === 'custom') {
                newItems[index].material = '';
                newItems[index].component = '';
            } else {
                newItems[index].materialName = '';
            }
        }

        setItems(newItems);
    };

    const handleMaterialChange = (index: number, selectedId: string) => {
        const newItems = [...items];
        
        if (selectedId) {
            const selectedFG = inHouseItems.find(item => item._id === selectedId);
            newItems[index] = {
                ...newItems[index],
                component: selectedId,
                material: undefined,
                materialName: selectedFG?.partName || selectedFG?.name || selectedFG?.componentName || "",
                unit: selectedFG?.unit || "PCS",
            };
        } else {
            newItems[index] = {
                ...newItems[index],
                component: "",
                materialName: "",
                unit: "PCS",
            };
        }

        setItems(newItems);
    };

    const removeItem = (index: number) => {
        if (items.length > 1) {
            setItems(items.filter((_, i) => i !== index));
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        const payloadItems = items.map(entry => {
            const payload: any = {
                itemType: entry.itemType,
                materialName: entry.materialName,
                hsnCode: entry.hsnCode,
                quantity: entry.quantity,
                unit: entry.unit,
                rate: entry.rate,
                amount: entry.amount,
                description: entry.description,
            };
            if (entry.material) payload.material = entry.material;
            if (entry.component) payload.component = entry.component;
            return payload;
        });

        onSubmit({
            dcNumber,
            date,
            customer,
            customerName,
            customerAddress,
            items: payloadItems,
            discount,
            otherDetails,
            status,
        } as any);
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Modal backdrop with blur */}
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[105] transition-opacity" onClick={onClose} />

            {/* Modal content */}
            <div className="fixed inset-0 flex items-center justify-center z-[110] p-4 sm:p-6">
                <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl max-w-5xl w-full max-h-[95vh] overflow-hidden flex flex-col border border-white/50">
                    
                    {/* Modal header */}
                    <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-white/50">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-600 flex items-center justify-center shadow-lg shadow-blue-200">
                                <FileText className="text-white" size={24} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600">
                                    {isEditing ? "Edit Delivery Challan" : "Create Delivery Challan"}
                                </h2>
                                <p className="text-gray-500 text-sm mt-1 font-medium">
                                    Issue a delivery challan to customer
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2.5 bg-gray-50 hover:bg-red-50 hover:text-red-600 rounded-full transition-all duration-200 text-gray-400 group"
                            title="Close"
                        >
                            <X size={20} className="group-hover:rotate-90 transition-transform duration-300" />
                        </button>
                    </div>

                    {/* Modal body - Scrollable */}
                    <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
                        <form id="dc-form" onSubmit={handleSubmit} className="space-y-6">
                            
                            {/* General Details Section */}
                            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-blue-500 to-cyan-500"></div>
                                <h3 className="text-sm uppercase tracking-wider font-bold text-gray-400 mb-5 pl-2">DC Details</h3>
                                
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {/* DC Number */}
                                    <div className="space-y-1.5">
                                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                                            <Hash size={14} className="text-blue-500" />
                                            DC Number
                                        </label>
                                        <input
                                            type="text"
                                            value={dcNumber}
                                            readOnly
                                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-500 font-mono text-sm cursor-not-allowed focus:outline-none"
                                        />
                                    </div>

                                    {/* Date */}
                                    <div className="space-y-1.5">
                                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                                            <Calendar size={14} className="text-cyan-500" />
                                            Date <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="date"
                                            required
                                            value={date}
                                            onChange={(e) => setDate(e.target.value)}
                                            className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700"
                                        />
                                    </div>

                                    {/* Customer */}
                                    <div className="space-y-1.5">
                                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                                            <User size={14} className="text-indigo-500" />
                                            Customer <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            required
                                            value={customer || ""}
                                            onChange={(e) => handleCustomerChange(e.target.value)}
                                            className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700"
                                        >
                                            <option value="">Select Customer</option>
                                            {customers.map((c) => (
                                                <option key={c._id} value={c._id}>
                                                    {c.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Items Section */}
                            <div className="bg-white rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-cyan-500 to-teal-500"></div>
                                
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-6 border-b border-gray-50 gap-4">
                                    <div className="flex items-center gap-2 pl-2">
                                        <Package size={18} className="text-cyan-500" />
                                        <h3 className="text-lg font-bold text-gray-800">Challan Items</h3>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={addItem}
                                        className="flex items-center justify-center gap-2 px-5 py-2.5 bg-cyan-50 text-cyan-700 hover:bg-cyan-600 hover:text-white rounded-lg transition-all duration-200 text-sm font-semibold group"
                                    >
                                        <Plus size={16} className="group-hover:rotate-90 transition-transform duration-300" />
                                        Add Item
                                    </button>
                                </div>

                                <div className="p-6 space-y-6">
                                    {items.map((entry, index) => (
                                        <div key={index} className="relative bg-slate-50/50 rounded-xl p-5 border border-slate-200 group hover:border-cyan-200 hover:shadow-md hover:shadow-cyan-500/5 transition-all duration-200">
                                            
                                            <div className="absolute -top-3 -left-3 w-8 h-8 bg-cyan-100 text-cyan-700 rounded-full flex items-center justify-center font-bold text-sm shadow-sm border border-white">
                                                {index + 1}
                                            </div>

                                            {items.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeItem(index)}
                                                    className="absolute top-4 right-4 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                    title="Remove Item"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}

                                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mt-2">
                                                
                                                {/* Type Selection */}
                                                <div className="lg:col-span-2 space-y-1.5">
                                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Type</label>
                                                    <select
                                                        value={entry.itemType}
                                                        onChange={e => updateItem(index, 'itemType', e.target.value)}
                                                        className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-sm font-medium text-gray-700"
                                                    >
                                                        <option value="fg">Finished Good</option>
                                                        <option value="custom">Custom Item</option>
                                                    </select>
                                                </div>

                                                {/* Item Name / Selection */}
                                                <div className="lg:col-span-3 space-y-1.5">
                                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
                                                        Item Details <span className="text-red-500">*</span>
                                                    </label>
                                                    {entry.itemType === 'custom' ? (
                                                        <input
                                                            type="text"
                                                            required
                                                            value={entry.materialName}
                                                            onChange={e => updateItem(index, 'materialName', e.target.value)}
                                                            placeholder="Type custom item name..."
                                                            className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-sm font-medium text-gray-800"
                                                        />
                                                    ) : (
                                                        <select
                                                            required
                                                            value={entry.component || ""}
                                                            onChange={(e) => handleMaterialChange(index, e.target.value)}
                                                            className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-sm font-medium text-gray-800"
                                                        >
                                                            <option value="" className="text-gray-400">Select Item</option>
                                                            <optgroup label="Finished Goods (FG)">
                                                                {inHouseItems.map((item: any) => (
                                                                    <option key={item._id} value={item._id}>
                                                                        {item.partName || item.name || item.componentName} ({item.partNumber || item.code || 'N/A'})
                                                                    </option>
                                                                ))}
                                                            </optgroup>
                                                        </select>
                                                    )}
                                                </div>

                                                {/* HSN Code */}
                                                <div className="lg:col-span-2 space-y-1.5">
                                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
                                                        HSN Code
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={entry.hsnCode || ''}
                                                        onChange={(e) => updateItem(index, 'hsnCode', e.target.value)}
                                                        className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-sm font-medium text-gray-800"
                                                        placeholder="HSN"
                                                    />
                                                </div>

                                                {/* Quantity & Unit */}
                                                <div className="lg:col-span-2 space-y-1.5">
                                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
                                                        Qty / Unit <span className="text-red-500">*</span>
                                                    </label>
                                                    <div className="flex border border-gray-200 rounded-lg overflow-hidden bg-white focus-within:ring-2 focus-within:ring-cyan-500/20 focus-within:border-cyan-500">
                                                        <input
                                                            type="number"
                                                            required
                                                            min="0"
                                                            step="0.01"
                                                            value={entry.quantity || ''}
                                                            onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                                                            className="w-full px-2 py-2.5 border-none focus:ring-0 text-sm font-bold text-gray-800"
                                                            placeholder="0"
                                                        />
                                                        <input
                                                            type="text"
                                                            value={entry.unit}
                                                            onChange={e => entry.itemType === 'custom' && updateItem(index, 'unit', e.target.value.toUpperCase())}
                                                            readOnly={entry.itemType !== 'custom'}
                                                            className={`w-16 px-2 py-2.5 border-none focus:ring-0 text-sm font-medium uppercase text-center border-l border-gray-200 ${entry.itemType === 'custom' ? 'bg-white text-cyan-600' : 'bg-gray-50 text-gray-500'}`}
                                                            placeholder="Unit"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Description / Remarks */}
                                                <div className="lg:col-span-3 space-y-1.5">
                                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
                                                        Remarks
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={entry.description || ''}
                                                        onChange={(e) => updateItem(index, 'description', e.target.value)}
                                                        className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-sm font-medium text-gray-800"
                                                        placeholder="Optional remarks"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Additional Details Section */}
                            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-teal-500 to-emerald-500"></div>
                                <h3 className="text-sm uppercase tracking-wider font-bold text-gray-400 mb-5 pl-2">Additional Info</h3>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-1.5">
                                        <label className="block text-sm font-semibold text-gray-700">Other Details / Terms</label>
                                        <textarea
                                            value={otherDetails}
                                            onChange={(e) => setOtherDetails(e.target.value)}
                                            className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all text-gray-700 resize-none"
                                            rows={3}
                                            placeholder="Enter generic terms or remarks here..."
                                        />
                                    </div>
                                    <div className="space-y-4">
                                        <div className="space-y-1.5">
                                            <label className="block text-sm font-semibold text-gray-700">Discount (₹)</label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={discount}
                                                onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                                                className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all text-gray-700"
                                                placeholder="0.00"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="block text-sm font-semibold text-gray-700">Status</label>
                                            <select
                                                value={status}
                                                onChange={(e) => setStatus(e.target.value as any)}
                                                className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all text-gray-700"
                                            >
                                                <option value="Draft">Draft</option>
                                                <option value="Issued">Issued</option>
                                                <option value="Delivered">Delivered</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </form>
                    </div>

                    {/* Modal footer */}
                    <div className="p-6 border-t border-gray-100 bg-white/80">
                        <div className="flex gap-4 justify-end">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-8 py-3 bg-white text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors border border-gray-200 shadow-sm"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                form="dc-form"
                                disabled={loading}
                                className="px-10 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-cyan-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                            >
                                {loading ? "Saving..." : isEditing ? "Update Challan" : "Create Challan"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash2, Camera, FileText, User, Calendar, Hash, Package } from 'lucide-react';
import { useGetCustomersQuery, useCreatePpcOrderMutation, useUpdatePpcOrderMutation } from "@/src/store/services/ppcService";
import { useGetStoreDataQuery } from "@/src/store/services/storeService";
import SearchableSelect from '../SearchableSelect';

interface StoreCreateOrderModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (message: string) => void;
    initialOrder?: any;
}

export default function StoreCreateOrderModal({ isOpen, onClose, onSuccess, initialOrder }: StoreCreateOrderModalProps) {
    const [formData, setFormData] = useState({
        poReference: "",
        customerName: "",
        deadlineDate: "",
        presentDate: new Date().toISOString().split('T')[0],
        orderNumber: `ORD-${Math.floor(Date.now() / 1000)}`,
        targetMonth: new Date().toISOString().slice(0, 7),
        remarks: ""
    });

    const [items, setItems] = useState<any[]>([
        { componentId: "", quantity: 1, price: 0, unit: "Nos" }
    ]);

    const { data: customers = [] } = useGetCustomersQuery(undefined, { skip: !isOpen });
    const { data: inhouseItems = [] } = useGetStoreDataQuery('fg-item', { skip: !isOpen });
    const [createPpcOrder] = useCreatePpcOrderMutation();
    const [updatePpcOrder] = useUpdatePpcOrderMutation();

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [photos, setPhotos] = useState<File[]>([]);
    const galleryInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (initialOrder && isOpen) {
            setFormData({
                orderNumber: initialOrder.orderNumber,
                poReference: initialOrder.poReference || "",
                customerName: initialOrder.customerName,
                deadlineDate: (initialOrder.deliveryDate || initialOrder.dispatchDate) ? new Date(initialOrder.deliveryDate || initialOrder.dispatchDate).toISOString().split('T')[0] : "",
                presentDate: new Date().toISOString().split('T')[0],
                targetMonth: initialOrder.targetMonth || new Date().toISOString().slice(0, 7),
                remarks: initialOrder.remarks || "",
            });

            const sourceItems = initialOrder.items || initialOrder.components;
            if (sourceItems && sourceItems.length > 0) {
                const mappedItems = sourceItems.map((comp: any) => {
                    let masterId = comp.product?._id || comp.product;
                    if (!masterId && comp.componentCode) {
                        masterId = inhouseItems.find((i: any) => i.componentCode === comp.componentCode || i.code === comp.componentCode)?._id;
                    }
                    const master = inhouseItems.find((i: any) => i._id === masterId);
                    return {
                        _id: comp._id,
                        componentId: masterId || "",
                        quantity: comp.quantity,
                        price: comp.price || 0,
                        unit: master?.unit || comp.unit || "Nos",
                    };
                });
                if (mappedItems.length > 0) setItems(mappedItems);
            }
        } else if (!initialOrder && isOpen) {
            setFormData({
                poReference: "",
                customerName: "",
                deadlineDate: "",
                presentDate: new Date().toISOString().split('T')[0],
                orderNumber: `ORD-${Math.floor(Date.now() / 1000)}`,
                targetMonth: new Date().toISOString().slice(0, 7),
                remarks: ""
            });
            setItems([{ componentId: "", quantity: 1, price: 0, unit: "Nos" }]);
        }
    }, [initialOrder, isOpen]);

    const handleAddItem = () => {
        setItems([...items, { componentId: "", quantity: 1, price: 0, unit: "Nos" }]);
    };

    const handleRemoveItem = (index: number) => {
        const newItems = [...items];
        newItems.splice(index, 1);
        setItems(newItems);
    };

    const updateItem = (index: number, field: string, value: any) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };

        if (field === "componentId") {
            const selectedInfo = inhouseItems.find((i: any) => i._id === value);
            if (selectedInfo) {
                const isDuplicate = newItems.some((item, i) => i !== index && item.componentId === value);
                if (isDuplicate) {
                    alert("This product is already added to the order. Please adjust the quantity of the existing row instead.");
                    return;
                }
                newItems[index].unit = selectedInfo.unit || "Nos";
                newItems[index].componentName = selectedInfo.componentName || selectedInfo.name;
                newItems[index].componentCode = selectedInfo.componentCode || selectedInfo.code;
            } else {
                newItems[index].componentName = "";
                newItems[index].componentCode = "";
                newItems[index].unit = "Nos";
            }
        }
        setItems(newItems);
    };

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setPhotos(Array.from(e.target.files));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError("");

        if (items.some(i => !i.componentId || !i.quantity)) {
            setError("Please select items and quantity for all rows");
            setSubmitting(false);
            return;
        }

        try {
            const selectedCustomer = customers.find((c: any) => c.name === formData.customerName);
            const customerId = selectedCustomer ? selectedCustomer._id : undefined;

            const itemsPayload = items.map(item => ({
                product: item.componentId,
                quantity: Number(item.quantity),
                price: Number(item.price),
                trackingType: "Individual",
            }));

            const orderFormData = new FormData();
            orderFormData.append("orderNumber", formData.orderNumber);
            orderFormData.append("customer", customerId || "");
            orderFormData.append("customerName", formData.customerName);
            orderFormData.append("poReference", formData.poReference);
            orderFormData.append("deliveryDate", formData.deadlineDate);
            orderFormData.append("targetMonth", formData.targetMonth);
            orderFormData.append("remarks", formData.remarks);
            orderFormData.append("items", JSON.stringify(itemsPayload));

            photos.forEach(photo => orderFormData.append("photos", photo));

            let res;
            if (initialOrder?._id) {
                res = await updatePpcOrder({ id: initialOrder._id, body: orderFormData });
            } else {
                res = await createPpcOrder(orderFormData);
            }

            if ("error" in res) {
                const err = res.error as any;
                setError(err?.data?.message || "Failed to process order");
            } else {
                onSuccess(initialOrder ? "Order updated successfully" : "Order created successfully");
                onClose();
            }
        } catch (error: any) {
            console.error(error);
            setError("Failed to process order");
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    // We filter items so that they only see FG components. Usually type="Assembly" or type="Finished Goods"
    // Since inHouseItems typically mixes components and assemblies, we'll let them pick anything, but typically they pick FG.
    const productOptions = inhouseItems;

    return (
        <>
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[105] transition-opacity" onClick={onClose} />
            <div className="fixed inset-0 flex items-center justify-center z-[110] p-4 sm:p-6">
                <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl max-w-7xl w-full h-[95vh] flex flex-col border border-white/50">

                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-white/50">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-fuchsia-600 to-pink-600 flex items-center justify-center shadow-lg shadow-fuchsia-200">
                                <FileText className="text-white" size={24} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600">
                                    {initialOrder ? "Edit Order" : "Create New Order"}
                                </h2>
                                <p className="text-gray-500 text-sm mt-1 font-medium">
                                    Fill in the details below to plan production
                                </p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2.5 bg-gray-50 hover:bg-red-50 hover:text-red-600 rounded-full transition-all duration-200 text-gray-400 group">
                            <X size={20} className="group-hover:rotate-90 transition-transform duration-300" />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 pb-32">
                        {error && (
                            <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100 font-medium">
                                {error}
                            </div>
                        )}

                        <form id="order-form" onSubmit={handleSubmit} className="space-y-6">

                            {/* General Details */}
                            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 relative overflow-visible">
                                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-fuchsia-500 to-pink-500"></div>
                                <h3 className="text-sm uppercase tracking-wider font-bold text-gray-400 mb-5 pl-2">General Details</h3>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="space-y-1.5">
                                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                                            <Hash size={14} className="text-fuchsia-500" />
                                            Order Number
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.orderNumber}
                                            readOnly
                                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-500 font-mono text-sm cursor-not-allowed"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                                            <FileText size={14} className="text-pink-500" />
                                            PO Reference <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.poReference}
                                            onChange={(e) => setFormData({ ...formData, poReference: e.target.value, orderNumber: e.target.value })}
                                            className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-fuchsia-500/20 focus:border-fuchsia-500 text-gray-700"
                                            placeholder="Enter PO Ref"
                                        />
                                    </div>
                                    <div className="space-y-1.5 overflow-visible">
                                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                                            <User size={14} className="text-rose-500" />
                                            Customer <span className="text-red-500">*</span>
                                        </label>
                                        <SearchableSelect
                                            options={customers.map((c: any) => ({ value: c.name, label: c.name || '' }))}
                                            value={formData.customerName}
                                            onChange={(val: any) => setFormData({ ...formData, customerName: val })}
                                            placeholder="Select Customer"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                                            <Calendar size={14} className="text-purple-500" />
                                            Target Date <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="date"
                                            required
                                            value={formData.deadlineDate}
                                            onChange={(e) => setFormData({ ...formData, deadlineDate: e.target.value })}
                                            className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-fuchsia-500/20 focus:border-fuchsia-500 text-gray-700"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                                            <Calendar size={14} className="text-indigo-500" />
                                            Target Month <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="month"
                                            required
                                            value={formData.targetMonth}
                                            onChange={(e) => setFormData({ ...formData, targetMonth: e.target.value })}
                                            className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-fuchsia-500/20 focus:border-fuchsia-500 text-gray-700"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Order Parts Section */}
                            <div className="bg-white rounded-xl shadow-sm border border-gray-100 relative overflow-visible">
                                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-pink-500 to-rose-500"></div>

                                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-6 border-b border-gray-50 gap-4">
                                    <div className="flex items-center gap-2 pl-2">
                                        <Package size={18} className="text-pink-500" />
                                        <h3 className="text-lg font-bold text-gray-800">Order Parts (FG)</h3>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleAddItem}
                                        className="flex items-center justify-center gap-2 px-5 py-2.5 bg-pink-50 text-pink-700 hover:bg-pink-600 hover:text-white rounded-lg transition-all duration-200 text-sm font-semibold group"
                                    >
                                        <Plus size={16} className="group-hover:rotate-90 transition-transform duration-300" />
                                        Add Item
                                    </button>
                                </div>

                                <div className="p-6 space-y-4">
                                    {items.map((item, index) => (
                                        <div key={index} className="relative bg-slate-50/50 rounded-xl p-5 border border-slate-200 group hover:border-pink-200 hover:shadow-md transition-all duration-200">
                                            <div className="absolute -top-3 -left-3 w-8 h-8 bg-pink-100 text-pink-700 rounded-full flex items-center justify-center font-bold text-sm shadow-sm border border-white">
                                                {index + 1}
                                            </div>

                                            {items.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveItem(index)}
                                                    className="absolute top-4 right-4 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}

                                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mt-2">
                                                {/* Product Selection */}
                                                <div className="lg:col-span-6 space-y-1.5 overflow-visible">
                                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
                                                        Finished Good <span className="text-red-500">*</span>
                                                    </label>
                                                    <SearchableSelect
                                                        options={productOptions.map((comp: any) => ({ 
                                                            value: comp._id, 
                                                            label: `${comp.componentName || comp.name || ''} (${comp.componentCode || comp.code || 'N/A'})` 
                                                        }))}
                                                        value={typeof item.componentId === 'object' ? (item.componentId as any)._id : item.componentId || ''}
                                                        onChange={(val: any) => updateItem(index, 'componentId', val)}
                                                        placeholder="Select FG Item..."
                                                    />
                                                </div>

                                                {/* Quantity */}
                                                <div className="lg:col-span-3 space-y-1.5">
                                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
                                                        Qty / Unit <span className="text-red-500">*</span>
                                                    </label>
                                                    <div className="flex border border-gray-200 rounded-lg overflow-hidden bg-white focus-within:ring-2 focus-within:ring-pink-500/20 focus-within:border-pink-500">
                                                        <input
                                                            type="number"
                                                            required
                                                            min="1"
                                                            value={item.quantity || ''}
                                                            onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                                                            className="w-full px-2 py-2.5 border-none focus:ring-0 text-sm font-bold text-gray-800 text-center"
                                                            placeholder="0"
                                                        />
                                                        <input
                                                            type="text"
                                                            readOnly
                                                            value={item.unit}
                                                            className="w-16 px-2 py-2.5 border-none focus:ring-0 text-sm font-medium uppercase text-center border-l border-gray-200 bg-gray-50 text-gray-500"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Price */}
                                                <div className="lg:col-span-3 space-y-1.5">
                                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
                                                        Price <span className="text-red-500">*</span>
                                                    </label>
                                                    <div className="flex border border-gray-200 rounded-lg overflow-hidden bg-white focus-within:ring-2 focus-within:ring-pink-500/20 focus-within:border-pink-500">
                                                        <span className="flex items-center justify-center bg-gray-50 px-3 text-gray-500 text-sm font-medium border-r border-gray-200">
                                                            ₹
                                                        </span>
                                                        <input
                                                            type="number"
                                                            required
                                                            min="0"
                                                            value={item.price || ''}
                                                            onChange={(e) => updateItem(index, 'price', e.target.value)}
                                                            className="w-full px-2 py-2.5 border-none focus:ring-0 text-sm font-bold text-gray-800"
                                                            placeholder="0.00"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Attachments & Remarks */}
                            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-rose-500 to-orange-500"></div>
                                <h3 className="text-sm uppercase tracking-wider font-bold text-gray-400 mb-5 pl-2">Additional Details</h3>

                                <div className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="block text-sm font-semibold text-gray-700">Remarks</label>
                                        <textarea
                                            value={formData.remarks}
                                            onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                                            className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-gray-700 resize-none"
                                            rows={2}
                                            placeholder="Enter any additional instructions..."
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="block text-sm font-semibold text-gray-700">Attachments</label>
                                        <div className="flex items-center gap-3">
                                            <button
                                                type="button"
                                                onClick={() => galleryInputRef.current?.click()}
                                                className="flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors text-sm font-medium text-gray-700"
                                            >
                                                <Camera size={16} className="text-orange-500" />
                                                Upload Photos
                                            </button>
                                            <input
                                                ref={galleryInputRef}
                                                type="file"
                                                className="hidden"
                                                accept="image/*,application/pdf"
                                                multiple
                                                onChange={handlePhotoChange}
                                            />
                                            {photos.length > 0 && (
                                                <div className="flex gap-2 flex-wrap">
                                                    {photos.map((file, index) => (
                                                        <div key={index} className="relative w-10 h-10 rounded-lg overflow-hidden border border-gray-200 group">
                                                            {file.type === 'application/pdf' ? (
                                                                <div className="w-full h-full bg-gray-50 flex items-center justify-center">
                                                                    <span className="text-[10px] font-bold text-red-500">PDF</span>
                                                                </div>
                                                            ) : (
                                                                <img src={URL.createObjectURL(file)} alt="Preview" className="w-full h-full object-cover" />
                                                            )}
                                                            <button
                                                                type="button"
                                                                onClick={() => setPhotos(prev => prev.filter((_, i) => i !== index))}
                                                                className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                                            >
                                                                <X size={12} />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </form>
                    </div>

                    {/* Footer */}
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
                                form="order-form"
                                disabled={submitting}
                                className="px-10 py-3 bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white rounded-xl font-bold hover:from-fuchsia-700 hover:to-pink-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                            >
                                {submitting ? "Saving..." : (initialOrder ? "Update Order" : "Confirm & Plan Materials")}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Camera } from 'lucide-react';
import { useRef } from 'react';
import { API_BASE_URL } from "@/src/utils/config";
import { 
    useGetCustomersQuery, 
    useGetComponentsQuery, 
    useCreatePpcOrderMutation, 
    useUpdatePpcOrderMutation 
} from "@/src/store/services/ppcService";

interface CreateOrderModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (message: string) => void;
    initialOrder?: any;
}

export default function CreateOrderModal({ isOpen, onClose, onSuccess, initialOrder }: CreateOrderModalProps) {
    const [formData, setFormData] = useState({
        poReference: "",
        customerName: "",
        deadlineDate: "",
        presentDate: new Date().toISOString().split('T')[0],
        orderNumber: `ORD-${Math.floor(Date.now() / 1000)}`,
        targetMonth: new Date().toISOString().slice(0, 7), // YYYY-MM
        remarks: ""
    });

    const [items, setItems] = useState<any[]>([
        { componentId: "", quantity: 1, price: 0, unit: "Nos", type: "", trackingType: "Individual", targetDate: "" }
    ]);

    const { data: customers = [] } = useGetCustomersQuery(undefined, { skip: !isOpen });
    const { data: inhouseItems = [] } = useGetComponentsQuery(undefined, { skip: !isOpen });
    const [createPpcOrder] = useCreatePpcOrderMutation();
    const [updatePpcOrder] = useUpdatePpcOrderMutation();

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");


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
            // Populate existing items
            // Populate existing items
            const sourceItems = initialOrder.items || initialOrder.components;
            if (sourceItems && sourceItems.length > 0) {
                const mappedItems = sourceItems.map((comp: any) => {
                    // Try to resolve Master Component ID
                    // Case 1: PPCOrder item with populated product
                    let masterId = comp.product?._id || comp.product;

                    // Case 2: Legacy Order Component (match by code)
                    if (!masterId && comp.componentCode) {
                        masterId = inhouseItems.find(i => i.componentCode === comp.componentCode)?._id;
                    }

                    // Find master info for defaults
                    const master = inhouseItems.find(i => i._id === masterId);

                    return {
                        _id: comp._id,
                        componentId: masterId || "",
                        quantity: comp.quantity,
                        price: comp.price || 0,
                        unit: master?.unit || comp.unit || "Nos",
                        type: master?.type || comp.type || "Component",
                        trackingType: comp.trackingType || "Individual",
                        status: comp.status,
                        targetDate: comp.targetDate ? new Date(comp.targetDate).toISOString().split('T')[0] : ""
                    };
                });
                // Filter out any items where master component wasn't found (safeguard)
                // mappedItems = mappedItems.filter(i => i.componentId);

                if (mappedItems.length > 0) {
                    setItems(mappedItems);
                }
            }
        } else if (!initialOrder && isOpen) {
            // Reset form on new open
            setFormData({
                poReference: "",
                customerName: "",
                deadlineDate: "",
                presentDate: new Date().toISOString().split('T')[0],
                orderNumber: `ORD-${Math.floor(Date.now() / 1000)}`,
                targetMonth: new Date().toISOString().slice(0, 7),
                remarks: ""
            });
            setItems([{ componentId: "", quantity: 1, price: 0, unit: "Nos", type: "", trackingType: "Individual", targetDate: "" }]);
        }
    }, [initialOrder, isOpen]);




    const handleAddItem = () => {
        setItems([...items, { componentId: "", quantity: 1, price: 0, unit: "Nos", type: "", trackingType: "Individual", targetDate: "" }]);
    };

    const handleRemoveItem = (index: number) => {
        const newItems = [...items];
        newItems.splice(index, 1);
        setItems(newItems);
    };

    const updateItem = (index: number, field: string, value: any) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };

        if (field === "type") {
            // Reset component selection when type changes
            newItems[index].componentId = "";
            newItems[index].componentName = "";
            newItems[index].componentCode = "";
            newItems[index].unit = "Nos";
            newItems[index].price = 0;
        }

        if (field === "componentId") {
            const selectedInfo = inhouseItems.find(i => i._id === value);
            if (selectedInfo) {
                // Duplicate Check: Check if this component is already selected in other rows
                const isDuplicate = newItems.some((item, i) => i !== index && item.componentId === value);
                if (isDuplicate) {
                    // Alert user and clear selection
                    alert("This product is already added to the order. Please adjust the quantity of the existing row instead.");
                    return; // Do not update
                }

                newItems[index].unit = selectedInfo.unit || "Nos";
                newItems[index].componentName = selectedInfo.componentName;
                newItems[index].componentCode = selectedInfo.componentCode;
            }
        }
        setItems(newItems);
    };

    // State for Photos
    const [photos, setPhotos] = useState<File[]>([]);
    const galleryInputRef = useRef<HTMLInputElement>(null);

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
                trackingType: item.trackingType || "Individual",
                targetDate: item.targetDate || undefined
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

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-100 dark:border-gray-800 flex flex-col">

                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-gray-800 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm sticky top-0 z-10">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                            {initialOrder ? "Edit Order" : "Create New Order"}
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Fill in the details below</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>

                {/* Form Body */}
                <div className="p-6">
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Order Number</label>
                                <input
                                    type="text"
                                    value={formData.orderNumber}
                                    onChange={(e) => setFormData({ ...formData, orderNumber: e.target.value })}
                                    className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">PO Reference</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Enter PO Ref"
                                    value={formData.poReference}
                                    onChange={(e) => setFormData({ ...formData, poReference: e.target.value, orderNumber: e.target.value })}
                                    className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Customer</label>
                                <select
                                    required
                                    value={formData.customerName}
                                    onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                                    className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-white"
                                >
                                    <option value="">Select Customer</option>
                                    {customers.map((c: any) => (
                                        <option key={c._id} value={c.name}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Present Date</label>
                                <input
                                    type="date"
                                    value={formData.presentDate}
                                    readOnly
                                    className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-500 cursor-not-allowed"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target Date</label>
                                <input
                                    type="date"
                                    required
                                    value={formData.deadlineDate}
                                    onChange={(e) => setFormData({ ...formData, deadlineDate: e.target.value })}
                                    className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target Month</label>
                                <input
                                    type="month"
                                    required
                                    value={formData.targetMonth}
                                    onChange={(e) => setFormData({ ...formData, targetMonth: e.target.value })}
                                    className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-white"
                                />
                            </div>

                            <div className="flex items-center gap-2 mt-6">
                                <button
                                    type="button"
                                    onClick={() => galleryInputRef.current?.click()}
                                    className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-600 dark:text-gray-300"
                                    title="Add Photos"
                                >
                                    <Camera size={20} />
                                </button>
                                <input
                                    ref={galleryInputRef}
                                    type="file"
                                    className="hidden"
                                    accept="image/*"
                                    multiple
                                    onChange={handlePhotoChange}
                                />
                                {photos.length > 0 && (
                                    <div className="flex gap-2">
                                        {photos.map((file, index) => (
                                            <div key={index} className="relative w-8 h-8 rounded-md overflow-hidden bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 group">
                                                <img src={URL.createObjectURL(file)} alt="Preview" className="w-full h-full object-cover" />
                                                <button
                                                    type="button"
                                                    onClick={() => setPhotos(prev => prev.filter((_, i) => i !== index))}
                                                    className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <X size={10} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Items Section */}
                        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                            <h4 className="font-semibold text-gray-800 dark:text-white mb-4 flex justify-between items-center">
                                <span>Order Parts</span>
                            </h4>

                            <div className="space-y-3">
                                {/* Header */}
                                <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 uppercase tracking-wider px-1">
                                    <div className="col-span-2">Type</div>
                                    <div className="col-span-3">Product</div>
                                    <div className="col-span-2">Tracking</div>
                                    <div className="col-span-2 text-center">Target Date</div>
                                    <div className="col-span-1 text-center">Qty</div>
                                    <div className="col-span-1 text-center">Price</div>
                                    <div className="col-span-1"></div>
                                </div>

                                {items.map((item, index) => (
                                    <div key={index} className="grid grid-cols-12 gap-2 items-center bg-gray-50 dark:bg-gray-800/50 p-1 rounded-lg border border-gray-100 dark:border-gray-800">
                                        <div className="col-span-2">
                                            <select
                                                value={item.type || ""}
                                                onChange={(e) => updateItem(index, 'type', e.target.value)}
                                                className="w-full px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded text-xs focus:ring-1 focus:ring-indigo-500 text-gray-900 dark:text-white"
                                            >
                                                <option value="">Type</option>
                                                <option value="Assembly">Assembly</option>
                                                <option value="SubAssembly">SubAssy</option>
                                                <option value="Component">Component</option>
                                            </select>
                                        </div>
                                        <div className="col-span-3">
                                            <select
                                                required
                                                value={item.componentId}
                                                onChange={(e) => updateItem(index, 'componentId', e.target.value)}
                                                disabled={!item.type}
                                                className="w-full px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded text-xs focus:ring-1 focus:ring-indigo-500 text-gray-900 dark:text-white disabled:opacity-50"
                                            >
                                                <option value="">{item.type ? "Select Product" : "Type?"}</option>
                                                {inhouseItems
                                                    .filter(comp => !item.type || comp.type === item.type)
                                                    .map((comp: any) => (
                                                        <option key={comp._id} value={comp._id}>
                                                            {comp.componentName}
                                                        </option>
                                                    ))}
                                            </select>
                                        </div>
                                        <div className="col-span-2">
                                            <select
                                                value={item.trackingType || "Individual"}
                                                onChange={(e) => updateItem(index, 'trackingType', e.target.value)}
                                                className="w-full px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded text-xs focus:ring-1 focus:ring-indigo-500 text-gray-900 dark:text-white"
                                            >
                                                <option value="Individual">Indiv</option>
                                                <option value="Batch">Batch</option>
                                            </select>
                                        </div>
                                        <div className="col-span-2">
                                            <input
                                                type="date"
                                                value={item.targetDate || ""}
                                                onChange={(e) => updateItem(index, 'targetDate', e.target.value)}
                                                className="w-full px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded text-xs focus:ring-1 focus:ring-indigo-500 text-gray-900 dark:text-white"
                                            />
                                        </div>
                                        <div className="col-span-1">
                                            <input
                                                type="number"
                                                required
                                                min="1"
                                                value={item.quantity}
                                                onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                                                className="w-full px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded text-xs text-gray-900 dark:text-white text-center"
                                                placeholder="Qty"
                                            />
                                        </div>
                                        <div className="col-span-1">
                                            <input
                                                type="number"
                                                required
                                                min="0"
                                                value={item.price}
                                                onChange={(e) => updateItem(index, 'price', e.target.value)}
                                                className="w-full px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded text-xs text-gray-900 dark:text-white text-center"
                                                placeholder="Price"
                                            />
                                        </div>
                                        <div className="col-span-1 flex justify-end pr-1">
                                            {items.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveItem(index)}
                                                    className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                <button
                                    type="button"
                                    onClick={handleAddItem}
                                    className="mt-2 text-indigo-600 hover:text-indigo-700 text-sm font-medium flex items-center gap-1"
                                >
                                    <Plus size={16} />
                                    Add Another Item
                                </button>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-6 py-2.5 rounded-xl font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={submitting}
                                className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 shadow-lg shadow-indigo-200 disabled:opacity-50 transition-all"
                            >
                                {submitting ? "Saving..." : (initialOrder ? "Update Order" : "Create Order")}
                            </button>
                        </div>
                    </form>
                </div>
            </div >
        </div >
    );
}

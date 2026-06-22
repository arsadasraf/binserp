/**
 * DC Modal Component
 * Modal form for creating and editing Delivery Challans
 * Supports Master Data selection, HSN, Discount, and Other Details
 */

"use client";

import { useState, useEffect } from "react";
import { DCModalProps, DCFormData, Material } from "../../types/store.types";

interface ExtendedDCModalProps extends DCModalProps {
    materials?: Material[];
}

export default function DCModal({
    isOpen,
    onClose,
    onSubmit,
    customers,
    materials = [],
    loading,
    initialData,
    isEditing = false,
}: ExtendedDCModalProps) {
    const [formData, setFormData] = useState<DCFormData>({
        dcNumber: "",
        date: new Date().toISOString().split("T")[0],
        customerName: "",
        customer: "",
        customerAddress: "",
        items: [{ material: "", materialName: "", hsnCode: "", quantity: 1, unit: "PCS", description: "" }],
        discount: 0,
        otherDetails: "",
        status: "Draft",
    });

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
            setFormData(initialData);
            return;
        }

        setFormData({
            dcNumber: generateDCNumber(),
            date: new Date().toISOString().split("T")[0],
            customerName: "",
            customer: "",
            customerAddress: "",
            items: [{ material: "", materialName: "", hsnCode: "", quantity: 1, unit: "PCS", description: "" }],
            discount: 0,
            otherDetails: "",
            status: "Draft",
        });
    }, [initialData, isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(formData);
    };

    const addItem = () => {
        setFormData((prev) => ({
            ...prev,
            items: [
                ...prev.items,
                { material: "", materialName: "", hsnCode: "", quantity: 1, unit: "PCS", description: "" },
            ],
        }));
    };

    const updateItem = (index: number, field: string, value: any) => {
        const newItems = [...formData.items];
        newItems[index] = { ...newItems[index], [field]: value };
        setFormData({ ...formData, items: newItems });
    };

    const handleMaterialChange = (index: number, selectedValue: string) => {
        const [type, id] = selectedValue.split("_");
        const newItems = [...formData.items];

        if (type === "MAT") {
            const selectedMaterial = materials.find((item: any) => item._id === id) as any;
            const categoryUnit =
                (typeof selectedMaterial?.category === "object" && selectedMaterial.category !== null && "unit" in selectedMaterial.category)
                    ? selectedMaterial.category.unit
                    : (typeof selectedMaterial?.categoryId === "object" && selectedMaterial.categoryId !== null && "unit" in selectedMaterial.categoryId)
                        ? selectedMaterial.categoryId.unit
                        : selectedMaterial?.unit;
            newItems[index] = {
                ...newItems[index],
                material: id,
                materialName: selectedMaterial?.name || "",
                unit: categoryUnit || "PCS",
            };
        } else {
            newItems[index] = {
                ...newItems[index],
                material: "",
                materialName: "",
                unit: "PCS",
            };
        }

        setFormData({ ...formData, items: newItems });
    };

    const removeItem = (index: number) => {
        if (formData.items.length > 1) {
            const newItems = formData.items.filter((_, i) => i !== index);
            setFormData({ ...formData, items: newItems });
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 bg-opacity-50">
            <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col m-4">
                <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-blue-600 to-indigo-600">
                    <div>
                        <h2 className="text-2xl font-bold text-white">
                            {isEditing ? "Edit Delivery Challan" : "Create Delivery Challan"}
                        </h2>
                        <p className="text-blue-100 text-sm mt-1">Issue a delivery challan to customer</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
                    >
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    <form id="dc-form" onSubmit={handleSubmit} className="space-y-6">
                        <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <div className="w-1 h-5 bg-blue-600 rounded"></div>
                                DC Details
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">DC Number</label>
                                    <input
                                        type="text"
                                        readOnly
                                        value={formData.dcNumber}
                                        className="input-field bg-gray-100 cursor-not-allowed"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                                    <input
                                        type="date"
                                        required
                                        value={formData.date}
                                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                        className="input-field"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Customer *</label>
                                    <select
                                        value={formData.customer || ""}
                                        onChange={(e) => setFormData({ ...formData, customer: e.target.value })}
                                        className="input-field"
                                    >
                                        <option value="">Select Customer</option>
                                        {customers.map((customer) => (
                                            <option key={customer._id} value={customer._id}>
                                                {customer.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl border-2 border-blue-100 p-5">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                    <div className="w-1 h-5 bg-blue-600 rounded"></div>
                                    Items
                                </h3>
                                <button
                                    type="button"
                                    onClick={addItem}
                                    className="text-sm bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-1"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    Add Item
                                </button>
                            </div>

                            <div className="space-y-4">
                                {formData.items.map((item, index) => (
                                    <div key={index} className="grid grid-cols-12 gap-2 items-center p-3 bg-gray-50 rounded-lg border border-gray-100">
                                        <div className="col-span-3">
                                            <select
                                                value={item.material ? `MAT_${item.material}` : ""}
                                                onChange={(e) => handleMaterialChange(index, e.target.value)}
                                                className="input-field text-sm py-1 px-2"
                                            >
                                                <option value="">Select Material</option>
                                                {materials.map((m) => (
                                                    <option key={m._id} value={`MAT_${m._id}`}>
                                                        {m.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="col-span-2">
                                            <input
                                                type="text"
                                                value={item.hsnCode}
                                                onChange={(e) => updateItem(index, "hsnCode", e.target.value)}
                                                className="input-field text-sm py-1 px-2"
                                                placeholder="HSN"
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <input
                                                type="number"
                                                value={item.quantity}
                                                onChange={(e) => updateItem(index, "quantity", parseFloat(e.target.value) || 0)}
                                                className="input-field text-sm py-1 px-2"
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <input
                                                type="text"
                                                value={item.unit}
                                                onChange={(e) => updateItem(index, "unit", e.target.value)}
                                                className="input-field text-sm py-1 px-2"
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <input
                                                type="text"
                                                value={item.description}
                                                onChange={(e) => updateItem(index, "description", e.target.value)}
                                                className="input-field text-sm py-1 px-2"
                                                placeholder="Remarks"
                                            />
                                        </div>
                                        <div className="col-span-1 text-right">
                                            {formData.items.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeItem(index)}
                                                    className="text-red-500 hover:text-red-700"
                                                >
                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Other Details / Terms</label>
                                <textarea
                                    value={formData.otherDetails}
                                    onChange={(e) => setFormData({ ...formData, otherDetails: e.target.value })}
                                    className="input-field"
                                    rows={3}
                                    placeholder="Enter generic terms or remarks here..."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Discount (₹)</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={formData.discount}
                                    onChange={(e) => setFormData({ ...formData, discount: parseFloat(e.target.value) || 0 })}
                                    className="input-field"
                                />
                                <div className="mt-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                                    <select
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                                        className="input-field"
                                    >
                                        <option value="Draft">Draft</option>
                                        <option value="Issued">Issued</option>
                                        <option value="Delivered">Delivered</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </form>
                </div>

                <div className="p-6 border-t bg-gray-50">
                    <div className="flex gap-3">
                        <button
                            type="submit"
                            form="dc-form"
                            disabled={loading}
                            className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                        >
                            {loading ? "Saving..." : isEditing ? "Update DC" : "Create DC"}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 bg-white text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors border-2 border-gray-300"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

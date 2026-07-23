/**
 * Billing Modal Component
 * Modal form for creating and editing Invoices/Bills
 * Supports Master Data, HSN, Tax, Discount, and Other Details
 */

"use client";

import { useState, useEffect } from "react";
import { BillingModalProps, BillingFormData, RmBoItem } from "../../types/store.types";
import SearchableSelect from "../SearchableSelect";
import { useGetStoreDataQuery } from "@/src/store/services/storeService";
import Swal from "sweetalert2";

interface ExtendedBillingModalProps extends BillingModalProps {
    materials?: RmBoItem[];
}

export default function BillingModal({
    isOpen,
    onClose,
    onSubmit,
    customers,
    materials = [],
    loading,
    initialData,
    isEditing = false,
}: ExtendedBillingModalProps) {
    const [formData, setFormData] = useState<BillingFormData>({
        invoiceNumber: "",
        date: new Date().toISOString().split("T")[0],
        customerName: "",
        customer: "",
        customerAddress: "",
        customerGST: "",
        customerPoReference: "",
        items: [{ material: "", materialName: "", hsnCode: "", quantity: 1, unit: "PCS", rate: 0, amount: 0, taxRate: 0, taxAmount: 0 }],
        subtotal: 0,
        discount: 0,
        taxAmount: 0,
        totalAmount: 0,
        otherDetails: "",
        status: "Draft",
    });

    const generateInvoiceNumber = () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");
        const hours = String(now.getHours()).padStart(2, "0");
        const mins = String(now.getMinutes()).padStart(2, "0");
        return `INV/${year}${month}${day}-${hours}${mins}`;
    };

    const [globalTaxRate, setGlobalTaxRate] = useState(0);
    const { data: incomingPOs } = useGetStoreDataQuery("incoming-po", { skip: !isOpen });

    useEffect(() => {
        if (!isOpen) return;

        if (initialData) {
            setFormData(initialData);
            if (initialData.items.length > 0) {
                setGlobalTaxRate(initialData.items[0].taxRate || 0);
            }
            return;
        }

        setFormData({
            invoiceNumber: generateInvoiceNumber(),
            date: new Date().toISOString().split("T")[0],
            customerName: "",
            customer: "",
            customerAddress: "",
            customerGST: "",
            customerPoReference: "",
            items: [{ material: "", materialName: "", hsnCode: "", quantity: 1, unit: "PCS", rate: 0, amount: 0, taxRate: 0, taxAmount: 0 }],
            subtotal: 0,
            discount: 0,
            taxAmount: 0,
            totalAmount: 0,
            otherDetails: "",
            status: "Draft",
        });
        setGlobalTaxRate(0);
    }, [initialData, isOpen]);

    useEffect(() => {
        let subtotal = 0;
        let totalTax = 0;

        const updatedItems = formData.items.map((item) => {
            const amount = (item.quantity || 0) * (item.rate || 0);
            const itemTax = (amount * (item.taxRate || 0)) / 100;
            return { ...item, amount, taxAmount: itemTax };
        });

        updatedItems.forEach((item) => {
            subtotal += item.amount;
            totalTax += item.taxAmount || 0;
        });

        const discountAmount = formData.discount || 0;
        const totalAmount = subtotal + totalTax - discountAmount;

        if (
            Math.abs(subtotal - formData.subtotal) > 0.01 ||
            Math.abs(totalTax - (formData.taxAmount || 0)) > 0.01 ||
            Math.abs(totalAmount - formData.totalAmount) > 0.01
        ) {
            setFormData((prev) => ({
                ...prev,
                subtotal,
                taxAmount: totalTax,
                totalAmount: totalAmount > 0 ? totalAmount : 0,
            }));
        }
    }, [formData.items, formData.discount, formData.subtotal, formData.taxAmount, formData.totalAmount]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Validation against Customer PO
        if (formData.customerPoReference && incomingPOs) {
            const po = (incomingPOs as any[]).find(p => p._id === formData.customerPoReference);
            if (po) {
                for (const item of formData.items) {
                    const poItem = po.items.find((i: any) => i.productName === item.materialName || i.fgItem?._id === item.material || i.fgItem === item.material);
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

        onSubmit(formData);
    };

    const addItem = () => {
        setFormData((prev) => ({
            ...prev,
            items: [
                ...prev.items,
                {
                    material: "",
                    materialName: "",
                    hsnCode: "",
                    quantity: 1,
                    unit: "PCS",
                    rate: 0,
                    amount: 0,
                    taxRate: globalTaxRate,
                    taxAmount: 0,
                },
            ],
        }));
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

    const updateItem = (index: number, field: string, value: any) => {
        const newItems = [...formData.items];
        const item = { ...newItems[index], [field]: value };

        if (field === "quantity" || field === "rate" || field === "taxRate") {
            const qty = field === "quantity" ? value : item.quantity;
            const rate = field === "rate" ? value : item.rate;
            const taxRate = field === "taxRate" ? value : item.taxRate;

            item.amount = qty * rate;
            item.taxAmount = (item.amount * taxRate) / 100;
        }

        newItems[index] = item;
        setFormData({ ...formData, items: newItems });
    };

    const removeItem = (index: number) => {
        if (formData.items.length > 1) {
            const newItems = formData.items.filter((_, i) => i !== index);
            setFormData({ ...formData, items: newItems });
        }
    };

    const handleGlobalTaxChange = (rate: number) => {
        setGlobalTaxRate(rate);
        const newItems = formData.items.map((item) => ({
            ...item,
            taxRate: rate,
            taxAmount: (item.amount * rate) / 100,
        }));
        setFormData({ ...formData, items: newItems });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 bg-opacity-50">
            <div className="bg-white rounded-2xl shadow-2xl max-w-7xl w-full h-[95vh] flex flex-col m-4">
                <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-indigo-600 to-purple-600">
                    <div>
                        <h2 className="text-2xl font-bold text-white">
                            {isEditing ? "Edit Invoice" : "Create Invoice"}
                        </h2>
                        <p className="text-indigo-100 text-sm mt-1">Generate customer invoice</p>
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

                <div className="flex-1 overflow-y-auto p-6 pb-32">
                    <form id="invoice-form" onSubmit={handleSubmit} className="space-y-6">
                        <div className="bg-gray-50 rounded-xl p-5 border border-gray-200 relative overflow-visible">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <div className="w-1 h-5 bg-indigo-600 rounded"></div>
                                Invoice Details
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Invoice No</label>
                                    <input
                                        type="text"
                                        readOnly
                                        value={formData.invoiceNumber}
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
                                <div className="md:col-span-2 overflow-visible">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Customer *</label>
                                    <SearchableSelect
                                        options={customers.map((customer) => ({ value: customer._id, label: customer.name || '' }))}
                                        value={formData.customer || ""}
                                        onChange={(val: any) => setFormData({ ...formData, customer: val })}
                                        placeholder="Select Customer"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl border-2 border-indigo-100 p-5 relative overflow-visible">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-4">
                                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                        <div className="w-1 h-5 bg-indigo-600 rounded"></div>
                                        Items
                                    </h3>
                                    <div className="flex items-center gap-2 bg-indigo-50 px-3 py-1 rounded-lg">
                                        <span className="text-xs font-semibold text-indigo-700">Global Tax %:</span>
                                        <input
                                            type="number"
                                            className="w-16 text-sm border-indigo-200 rounded px-1"
                                            value={globalTaxRate}
                                            onChange={(e) => handleGlobalTaxChange(parseFloat(e.target.value) || 0)}
                                        />
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={addItem}
                                    className="text-sm bg-indigo-600 text-white px-3 py-2 rounded-lg hover:bg-indigo-700 flex items-center gap-1"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    Add Item
                                </button>
                            </div>

                            <div className="space-y-4 relative overflow-visible">
                                {formData.items.map((item, index) => (
                                    <div key={index} className="grid grid-cols-12 gap-2 items-center p-3 bg-gray-50 rounded-lg border border-gray-100 relative overflow-visible">
                                        <div className="col-span-3 overflow-visible">
                                            <SearchableSelect
                                                options={materials.map((m) => ({ value: `MAT_${m._id}`, label: m.name || '' }))}
                                                value={item.material ? `MAT_${item.material}` : ""}
                                                onChange={(val: any) => handleMaterialChange(index, val)}
                                                placeholder="Select Material"
                                            />
                                        </div>
                                        <div className="col-span-1">
                                            <input
                                                type="text"
                                                value={item.hsnCode}
                                                onChange={(e) => updateItem(index, "hsnCode", e.target.value)}
                                                className="input-field text-sm py-1 px-2"
                                                placeholder="HSN"
                                            />
                                        </div>
                                        <div className="col-span-1">
                                            <input
                                                type="number"
                                                value={item.quantity}
                                                onChange={(e) => updateItem(index, "quantity", parseFloat(e.target.value) || 0)}
                                                className="input-field text-sm py-1 px-2"
                                            />
                                        </div>
                                        <div className="col-span-1">
                                            <input
                                                type="text"
                                                readOnly
                                                value={item.unit}
                                                className="input-field text-sm py-1 px-2 bg-gray-100"
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <input
                                                type="number"
                                                value={item.rate}
                                                onChange={(e) => updateItem(index, "rate", parseFloat(e.target.value) || 0)}
                                                className="input-field text-sm py-1 px-2"
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <input
                                                type="number"
                                                value={item.taxRate}
                                                onChange={(e) => updateItem(index, "taxRate", parseFloat(e.target.value) || 0)}
                                                className="input-field text-sm py-1 px-2"
                                            />
                                        </div>
                                        <div className="col-span-1 text-right font-medium text-gray-900">
                                            ₹ {item.amount.toFixed(2)}
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

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Remarks / Terms</label>
                                <textarea
                                    value={formData.otherDetails}
                                    onChange={(e) => setFormData({ ...formData, otherDetails: e.target.value })}
                                    className="input-field"
                                    rows={4}
                                    placeholder="Payment terms, delivery notes, etc."
                                />
                                <div className="mt-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                                    <select
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                                        className="input-field"
                                    >
                                        <option value="Draft">Draft</option>
                                        <option value="Sent">Sent</option>
                                        <option value="Paid">Paid</option>
                                    </select>
                                </div>
                            </div>

                            <div className="bg-gray-50 p-5 rounded-xl space-y-3">
                                <div className="flex justify-between text-sm text-gray-600">
                                    <span>Subtotal</span>
                                    <span>₹ {formData.subtotal.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-sm text-gray-600">
                                    <span>Total Tax</span>
                                    <span>₹ {formData.taxAmount?.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm text-gray-600">
                                    <span>Discount (Flat)</span>
                                    <input
                                        type="number"
                                        value={formData.discount}
                                        onChange={(e) => setFormData({ ...formData, discount: parseFloat(e.target.value) || 0 })}
                                        className="w-24 px-2 py-1 text-right border border-gray-300 rounded"
                                    />
                                </div>
                                <div className="pt-3 border-t border-gray-200 flex justify-between items-center">
                                    <span className="text-lg font-bold text-gray-900">Total Amount</span>
                                    <span className="text-2xl font-bold text-indigo-600">₹ {formData.totalAmount.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                    </form>
                </div>

                <div className="p-6 border-t bg-gray-50">
                    <div className="flex gap-3">
                        <button
                            type="submit"
                            form="invoice-form"
                            disabled={loading}
                            className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-lg font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                        >
                            {loading ? "Saving..." : isEditing ? "Update Invoice" : "Create Invoice"}
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

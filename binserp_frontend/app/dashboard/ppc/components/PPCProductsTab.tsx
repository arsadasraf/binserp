"use client";

import { useState } from "react";
import ProductForm from "./ProductForm";
import LoadingSpinner from "@/src/components/LoadingSpinner";
import { Plus, Trash2, Eye, Edit } from "lucide-react";
import ProductDetailsModal from "./ProductDetailsModal";
import { 
    useGetComponentsQuery, 
    useDeleteComponentMutation 
} from "@/src/store/services/ppcService";

export default function PPCProductsTab() {
    const [productType, setProductType] = useState<"Assembly" | "SubAssembly" | "Component">("Assembly");
    const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
    const [showDetails, setShowDetails] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editingItem, setEditingItem] = useState<any | null>(null);

    const { data: allComponents = [], isLoading: loading } = useGetComponentsQuery();
    const [deleteComponent] = useDeleteComponentMutation();

    const filteredData = allComponents.filter((item: any) => (item.type || "Component") === productType);

    const handleDelete = async (id: string) => {
        if (confirm("Are you sure you want to delete this product?")) {
            try {
                await deleteComponent(id).unwrap();
            } catch (err) {
                console.error("Failed to delete product:", err);
                alert("Failed to delete product.");
            }
        }
    };

    const handleEdit = (item: any) => {
        setEditingItem(item);
        setShowForm(true);
    };

    const handleSuccess = (msg: string) => {
        // Optional: show a toast
        console.log(msg);
    };

    return (
        <div className="space-y-6">
            {/* Header Actions */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                {/* Sub-Tabs */}
                <div className="flex p-1 bg-gray-100/80 dark:bg-gray-800/80 rounded-xl border border-gray-200 dark:border-gray-700">
                    {(["Assembly", "SubAssembly", "Component"] as const).map((type) => (
                        <button
                            key={type}
                            onClick={() => setProductType(type)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${productType === type
                                ? "bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
                                : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-300 hover:bg-gray-200/50 dark:hover:bg-gray-700/50"
                                }`}
                        >
                            {type}
                        </button>
                    ))}
                </div>

                {/* Add Button */}
                <button
                    onClick={() => {
                        setEditingItem(null);
                        setShowForm(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
                >
                    <Plus size={18} />
                    <span>Add {productType}</span>
                </button>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 text-gray-500 font-medium">
                            <th className="px-6 py-4">Product Details</th>
                            <th className="px-6 py-4">Processes</th>
                            <th className="px-6 py-4">Required Items</th>
                            <th className="px-6 py-4">Standard Time</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {loading ? (
                            <tr><td colSpan={5} className="text-center py-12"><LoadingSpinner /></td></tr>
                        ) : filteredData.length === 0 ? (
                            <tr><td colSpan={5} className="text-center py-12 text-gray-400">No {productType}s found.</td></tr>
                        ) : (
                            filteredData.map((item: any) => {
                                const processCount = item.routing?.length || 0;
                                const totalTime = item.routing?.reduce((acc: number, r: any) => acc + (Number(r.standardTime) || 0), 0) || 0;
                                
                                let totalRMQty = 0;
                                let totalInhouseQty = 0;
                                (item.routing || []).forEach((step: any) => {
                                    (step.requiredItems || []).forEach((ri: any) => {
                                        const qty = Number(ri.quantity) || 0;
                                        if (ri.itemModel === 'Material' || ri.sourceType === 'Store-Bo') totalRMQty += qty;
                                        else totalInhouseQty += qty;
                                    });
                                });

                                return (
                                    <tr key={item._id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-gray-900 dark:text-white">{item.componentName}</div>
                                            <div className="text-xs text-gray-400 font-mono">{item.componentCode}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg text-xs font-semibold">
                                                {processCount} Steps
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="space-y-1">
                                                <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">RM: {totalRMQty} | Inhouse: {totalInhouseQty}</div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-gray-700 dark:text-gray-300">{totalTime} mins</div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button 
                                                    onClick={() => { setSelectedProduct(item); setShowDetails(true); }}
                                                    className="p-2 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                                >
                                                    <Eye size={18} />
                                                </button>
                                                <button 
                                                    onClick={() => handleEdit(item)}
                                                    className="p-2 text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                                                >
                                                    <Edit size={18} />
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(item._id)}
                                                    className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Mobile View */}
            <div className="md:hidden space-y-4">
                {loading ? (
                    <div className="p-8 text-center"><LoadingSpinner /></div>
                ) : filteredData.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                        No {productType}s found.
                    </div>
                ) : (
                    filteredData.map((item: any) => (
                        <div key={item._id} className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <div className="font-bold text-gray-900 dark:text-white">{item.componentName}</div>
                                    <div className="text-xs text-gray-400 font-mono">{item.componentCode}</div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => handleEdit(item)} className="p-2 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-lg"><Edit size={16} /></button>
                                    <button onClick={() => handleDelete(item._id)} className="p-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg"><Trash2 size={16} /></button>
                                </div>
                            </div>
                            <button 
                                onClick={() => { setSelectedProduct(item); setShowDetails(true); }}
                                className="w-full py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl text-sm font-bold"
                            >
                                View Full Details
                            </button>
                        </div>
                    ))
                )}
            </div>

            {/* Modals */}
            {showForm && (
                <ProductForm 
                    isOpen={showForm} 
                    onClose={() => { setShowForm(false); setEditingItem(null); }}
                    onSuccess={handleSuccess}
                    initialLinkType={productType}
                    initialData={editingItem}
                />
            )}

            {showDetails && selectedProduct && (
                <ProductDetailsModal
                    isOpen={showDetails}
                    onClose={() => { setShowDetails(false); setSelectedProduct(null); }}
                    item={selectedProduct}
                />
            )}
        </div>
    );
}

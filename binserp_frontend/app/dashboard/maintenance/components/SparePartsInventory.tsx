"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { API_BASE_URL } from "@/src/utils/config";
import { Search, Plus, Package } from "lucide-react";
import { motion } from "framer-motion";

interface SparePart {
    _id: string;
    partName: string;
    partCode: string;
    currentStock: number;
    minStockLevel: number;
    location: string;
    unitPrice: number;
}

export default function SparePartsInventory() {
    const [parts, setParts] = useState<SparePart[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    // Form
    const [formData, setFormData] = useState({
        partName: "",
        partCode: "",
        currentStock: 0,
        minStockLevel: 5,
        location: "",
        unitPrice: 0
    });

    useEffect(() => {
        fetchParts();
    }, []);

    const fetchParts = async () => {
        try {
            const token = localStorage.getItem("token");
            const response = await axios.get(`${API_BASE_URL}/api/maintenance/spare-parts`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.data.success) {
                setParts(response.data.data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        try {
            const token = localStorage.getItem("token");
            await axios.post(`${API_BASE_URL}/api/maintenance/spare-parts`, formData, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setShowModal(false);
            fetchParts();
            setFormData({ partName: "", partCode: "", currentStock: 0, minStockLevel: 5, location: "", unitPrice: 0 });
        } catch (error) {
            alert("Failed to add part");
        }
    };

    const updateStock = async (id: string, type: 'add' | 'consume', qty: number) => {
        try {
            const token = localStorage.getItem("token");
            await axios.put(`${API_BASE_URL}/api/maintenance/spare-parts/${id}/stock`, {
                type,
                quantity: qty
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchParts();
        } catch (error) {
            alert("Failed to update stock");
        }
    }

    return (
        <div className="space-y-6">
            {/* Header Actions */}
            <div className="flex justify-between items-center">
                <div className="relative">
                    <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search parts..."
                        className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
                    />
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                >
                    <Plus className="w-4 h-4" />
                    Add Spare Part
                </button>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {parts.map(part => (
                    <div key={part._id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:bg-gray-50 transition-colors">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                                <Package className="w-6 h-6" />
                            </div>
                            {part.currentStock <= part.minStockLevel && (
                                <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-1 rounded">Low Stock</span>
                            )}
                        </div>

                        <h3 className="font-bold text-gray-900">{part.partName}</h3>
                        <p className="text-sm text-gray-500 mb-4">{part.partCode}</p>

                        <div className="flex justify-between items-end">
                            <div>
                                <p className="text-xs text-gray-500">Stock</p>
                                <p className={`text-xl font-bold ${part.currentStock <= part.minStockLevel ? 'text-red-600' : 'text-gray-900'}`}>{part.currentStock}</p>
                            </div>
                            <div className="flex gap-1">
                                <button
                                    onClick={() => updateStock(part._id, 'consume', 1)}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-300 hover:bg-gray-100 text-gray-600"
                                >-</button>
                                <button
                                    onClick={() => updateStock(part._id, 'add', 1)}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white"
                                >+</button>
                            </div>
                        </div>
                        <div className="mt-3 text-xs text-gray-400">
                            Location: {part.location || 'N/A'}
                        </div>
                    </div>
                ))}
            </div>

            {/* Create Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white rounded-xl shadow-xl w-full max-w-md p-6"
                    >
                        <h2 className="text-xl font-bold mb-4">Add Spare Part</h2>
                        <div className="space-y-4">
                            <input className="w-full border p-2 rounded" placeholder="Part Name" value={formData.partName} onChange={e => setFormData({ ...formData, partName: e.target.value })} />
                            <input className="w-full border p-2 rounded" placeholder="Part Code" value={formData.partCode} onChange={e => setFormData({ ...formData, partCode: e.target.value })} />
                            <div className="grid grid-cols-2 gap-4">
                                <input type="number" className="w-full border p-2 rounded" placeholder="Initial Stock" value={formData.currentStock} onChange={e => setFormData({ ...formData, currentStock: Number(e.target.value) })} />
                                <input type="number" className="w-full border p-2 rounded" placeholder="Min Stock Level" value={formData.minStockLevel} onChange={e => setFormData({ ...formData, minStockLevel: Number(e.target.value) })} />
                            </div>
                            <input className="w-full border p-2 rounded" placeholder="Location" value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} />
                            <input type="number" className="w-full border p-2 rounded" placeholder="Unit Price" value={formData.unitPrice} onChange={e => setFormData({ ...formData, unitPrice: Number(e.target.value) })} />
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-600 border rounded-lg">Cancel</button>
                            <button onClick={handleCreate} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Add Part</button>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
}

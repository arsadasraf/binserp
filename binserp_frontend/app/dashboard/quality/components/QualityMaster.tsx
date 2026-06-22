"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { API_BASE_URL } from "@/src/utils/config";
import { Plus, Trash2, Edit2, Save, X } from "lucide-react";
import Modal from "@/src/components/Modal"; // Reuse existing Modal if possible, else logic inline
import { motion, AnimatePresence } from "framer-motion";

export default function QualityMaster() {
    const [standards, setStandards] = useState<any[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({
        _id: "",
        name: "",
        type: "Incoming", // Incoming, Process, Final
        description: "",
        parameters: [{ name: "", method: "", tolerance: "" }]
    });

    useEffect(() => {
        fetchStandards();
    }, []);

    const fetchStandards = async () => {
        try {
            const token = localStorage.getItem("token");
            const res = await axios.get(`${API_BASE_URL}/api/quality/master`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) setStandards(res.data.data);
        } catch (error) {
            console.error("Error fetching standards");
        }
    };

    const handleSave = async () => {
        try {
            const token = localStorage.getItem("token");
            const payload = { ...formData };
            if (payload._id === "") delete (payload as any)._id;

            if (formData._id) {
                await axios.put(`${API_BASE_URL}/api/quality/master/${formData._id}`, payload, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            } else {
                await axios.post(`${API_BASE_URL}/api/quality/master`, payload, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            }
            setShowModal(false);
            fetchStandards();
            setFormData({ _id: "", name: "", type: "Incoming", description: "", parameters: [{ name: "", method: "", tolerance: "" }] });
        } catch (error) {
            alert("Failed to save standard");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this standard?")) return;
        try {
            const token = localStorage.getItem("token");
            await axios.delete(`${API_BASE_URL}/api/quality/master/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchStandards();
        } catch (error) {
            alert("Failed to delete");
        }
    };

    const addParameter = () => {
        setFormData({ ...formData, parameters: [...formData.parameters, { name: "", method: "", tolerance: "" }] });
    };

    const removeParameter = (index: number) => {
        const newParams = formData.parameters.filter((_, i) => i !== index);
        setFormData({ ...formData, parameters: newParams });
    };

    const updateParameter = (index: number, field: string, value: string) => {
        const newParams = [...formData.parameters];
        (newParams[index] as any)[field] = value;
        setFormData({ ...formData, parameters: newParams });
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-xl font-bold text-gray-800">Quality Standards</h3>
                    <p className="text-gray-500 text-sm">Define inspection templates and parameters.</p>
                </div>
                <button
                    onClick={() => {
                        setFormData({ _id: "", name: "", type: "Incoming", description: "", parameters: [{ name: "", method: "", tolerance: "" }] });
                        setShowModal(true);
                    }}
                    className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Create Standard
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {standards.map((std) => (
                    <motion.div
                        key={std._id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="border border-gray-200 rounded-xl p-5 hover:border-emerald-200 hover:shadow-md transition-all group"
                    >
                        <div className="flex justify-between items-start mb-3">
                            <div>
                                <h4 className="font-semibold text-gray-900">{std.name}</h4>
                                <span className={`text-xs px-2 py-0.5 rounded-full mt-1 inline-block ${std.type === 'Incoming' ? 'bg-blue-100 text-blue-700' :
                                        std.type === 'Process' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'
                                    }`}>
                                    {std.type} QC
                                </span>
                            </div>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => {
                                        setFormData(std);
                                        setShowModal(true);
                                    }}
                                    className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg"
                                >
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => handleDelete(std._id)}
                                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        <p className="text-sm text-gray-500 mb-4 line-clamp-2">{std.description || "No description provided."}</p>

                        <div className="space-y-2">
                            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Parameters</p>
                            {std.parameters.slice(0, 3).map((p: any, idx: number) => (
                                <div key={idx} className="flex justify-between text-sm bg-gray-50 p-2 rounded border border-gray-100">
                                    <span className="text-gray-700 font-medium">{p.name}</span>
                                    <span className="text-gray-500 font-mono text-xs">{p.tolerance}</span>
                                </div>
                            ))}
                            {std.parameters.length > 3 && (
                                <p className="text-xs text-center text-gray-400 italic">+{std.parameters.length - 3} more parameters</p>
                            )}
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Modal */}
            <AnimatePresence>
                {showModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
                        >
                            <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
                                <h3 className="text-lg font-bold text-gray-900">{formData._id ? "Edit Standard" : "New Quality Standard"}</h3>
                                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="p-6 space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Standard Name</label>
                                        <input
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                                            placeholder="e.g. Raw Material Check"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                                        <select
                                            value={formData.type}
                                            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                            className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                                        >
                                            <option value="Incoming">Incoming QC</option>
                                            <option value="Process">Process QC</option>
                                            <option value="Final">Final QC</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                    <textarea
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                                        rows={2}
                                    />
                                </div>

                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="block text-sm font-medium text-gray-700">Check Parameters</label>
                                        <button onClick={addParameter} className="text-xs text-emerald-600 font-bold hover:underline">+ Add Parameter</button>
                                    </div>
                                    <div className="space-y-2">
                                        {formData.parameters.map((param, idx) => (
                                            <div key={idx} className="flex gap-2 items-center">
                                                <input
                                                    placeholder="Parameter Name"
                                                    value={param.name}
                                                    onChange={(e) => updateParameter(idx, "name", e.target.value)}
                                                    className="flex-1 border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                                />
                                                <input
                                                    placeholder="Method (e.g. Visual)"
                                                    value={param.method}
                                                    onChange={(e) => updateParameter(idx, "method", e.target.value)}
                                                    className="flex-1 border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                                />
                                                <input
                                                    placeholder="Tolerance (+/-)"
                                                    value={param.tolerance}
                                                    onChange={(e) => updateParameter(idx, "tolerance", e.target.value)}
                                                    className="w-24 border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                                />
                                                <button onClick={() => removeParameter(idx)} className="text-red-400 hover:text-red-600 p-2">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50 rounded-b-2xl">
                                <button onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg">Cancel</button>
                                <button onClick={handleSave} className="px-6 py-2 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 shadow-sm flex items-center gap-2">
                                    <Save className="w-4 h-4" /> Save Standard
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

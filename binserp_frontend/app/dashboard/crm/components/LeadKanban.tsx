"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "@/src/utils/config";
import { Plus, MoreHorizontal, User, Smartphone, Mail, Building } from "lucide-react";
import { motion } from "framer-motion";

// Types
interface Lead {
    _id: string;
    name: string;
    companyName?: string;
    email?: string;
    phone?: string;
    status: string;
    createdAt: string;
}

export default function LeadKanban() {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    // Form State
    const [newLead, setNewLead] = useState({ name: "", companyName: "", email: "", phone: "" });

    const columns = [
        { id: "New", title: "New Lead", color: "bg-blue-50 text-blue-700 border-blue-200" },
        { id: "Contacted", title: "Contacted", color: "bg-purple-50 text-purple-700 border-purple-200" },
        { id: "Qualified", title: "Qualified", color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
        { id: "Proposal Sent", title: "Proposal", color: "bg-orange-50 text-orange-700 border-orange-200" },
        { id: "Won", title: "Converted", color: "bg-green-50 text-green-700 border-green-200" },
    ];

    useEffect(() => {
        fetchLeads();
    }, []);

    const fetchLeads = async () => {
        try {
            const token = localStorage.getItem("token");
            const res = await axios.get(`${API_BASE_URL}/api/crm/leads`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                setLeads(res.data.data);
            }
        } catch (error) {
            console.error("Error fetching leads");
        } finally {
            setLoading(false);
        }
    };

    const handleCreateLead = async () => {
        try {
            const token = localStorage.getItem("token");
            await axios.post(`${API_BASE_URL}/api/crm/leads`, newLead, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setShowModal(false);
            setNewLead({ name: "", companyName: "", email: "", phone: "" });
            fetchLeads();
        } catch (error) {
            alert("Failed to create lead");
        }
    };

    const handleStatusUpdate = async (id: string, newStatus: string) => {
        // Optimistic Update
        const updatedLeads = leads.map(l => l._id === id ? { ...l, status: newStatus } : l);
        setLeads(updatedLeads);

        try {
            const token = localStorage.getItem("token");
            // If converting to Won, we might want to trigger conversion logic?
            // For now just update status
            await axios.put(`${API_BASE_URL}/api/crm/leads/${id}`, { status: newStatus }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (newStatus === "Won") {
                // Trigger backend conversion
                await axios.post(`${API_BASE_URL}/api/crm/leads/${id}/convert`, {}, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                alert("Lead converted to Customer!");
            }
        } catch (error) {
            console.error("Update failed");
            fetchLeads(); // Revert on error
        }
    };

    if (loading) return <div className="p-8 text-center animate-pulse">Loading Pipeline...</div>;

    return (
        <div className="h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-800">Sales Pipeline</h2>
                <button
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
                >
                    <Plus size={16} /> Add Lead
                </button>
            </div>

            <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4">
                <div className="flex gap-4 min-w-[1000px] h-full">
                    {columns.map(col => (
                        <div key={col.id} className="flex-1 min-w-[200px] bg-gray-50/50 rounded-2xl border border-gray-100 flex flex-col">
                            <div className={`p-3 border-b border-gray-100 rounded-t-2xl font-semibold text-sm ${col.color}`}>
                                {col.title} <span className="ml-2 px-2 py-0.5 bg-white/50 rounded-full text-xs">{leads.filter(l => l.status === col.id).length}</span>
                            </div>
                            <div className="p-2 space-y-2 overflow-y-auto flex-1 custom-scrollbar">
                                {leads.filter(l => l.status === col.id).map(lead => (
                                    <div key={lead._id} className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all group">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="font-bold text-gray-800 text-sm truncate">{lead.companyName || lead.name}</span>
                                            <div className="relative group/menu">
                                                <button className="text-gray-400 hover:text-gray-600"><MoreHorizontal size={14} /></button>
                                                {/* Simple Status Dropdown on Hover */}
                                                <div className="absolute right-0 top-full mt-1 w-32 bg-white rounded-lg shadow-lg border border-gray-100 overflow-hidden hidden group-hover/menu:block z-10">
                                                    {columns.map(c => (
                                                        <button
                                                            key={c.id}
                                                            onClick={() => handleStatusUpdate(lead._id, c.id)}
                                                            className="block w-full text-left px-3 py-2 text-xs hover:bg-gray-50"
                                                        >
                                                            Move to {c.title}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                        {lead.companyName && <p className="text-xs text-gray-500 flex items-center gap-1 mb-1"><User size={10} /> {lead.name}</p>}
                                        {lead.phone && <p className="text-xs text-gray-400 flex items-center gap-1"><Smartphone size={10} /> {lead.phone}</p>}

                                        <div className="mt-3 pt-2 border-t border-gray-50 flex justify-between items-center">
                                            <span className="text-[10px] text-gray-400">{new Date(lead.createdAt).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 animate-in zoom-in-95">
                        <h3 className="text-lg font-bold mb-4">Add New Lead</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Company / Lead Name *</label>
                                <input
                                    value={newLead.name}
                                    onChange={e => setNewLead({ ...newLead, name: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="Ex: Acme Corp"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
                                <input
                                    value={newLead.companyName}
                                    onChange={e => setNewLead({ ...newLead, companyName: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="Ex: John Doe"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                                    <input
                                        value={newLead.phone}
                                        onChange={e => setNewLead({ ...newLead, phone: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                    <input
                                        value={newLead.email}
                                        onChange={e => setNewLead({ ...newLead, email: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                            <button onClick={handleCreateLead} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Create Lead</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

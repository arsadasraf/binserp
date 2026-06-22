"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { API_BASE_URL } from "@/src/utils/config";
import { Plus, Filter, AlertCircle, CheckCircle2, Search } from "lucide-react";
import { motion } from "framer-motion";

interface Ticket {
    _id: string;
    ticketNumber: string;
    machine: { _id: string; machineName: string; machineCode: string };
    issueDescription: string;
    priority: string;
    status: string;
    breakdownTime: string;
    assignedTo?: { name: string };
    createdAt: string;
}

export default function BreakdownManagement() {
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    // Form State
    const [selectedMachine, setSelectedMachine] = useState("");
    const [issue, setIssue] = useState("");
    const [priority, setPriority] = useState("Medium");

    // Valid Machines List (Needs fetching from PPC/Machine API, for now mock or fetch)
    const [machines, setMachines] = useState<any[]>([]);

    useEffect(() => {
        fetchTickets();
        fetchMachines();
    }, []);

    const fetchTickets = async () => {
        try {
            const token = localStorage.getItem("token");
            const response = await axios.get(`${API_BASE_URL}/api/maintenance/breakdown`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.data.success) {
                setTickets(response.data.data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const fetchMachines = async () => {
        try {
            const token = localStorage.getItem("token");
            // Assuming this endpoint exists from PPC module
            const response = await axios.get(`${API_BASE_URL}/api/ppc/machines?status=Available`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.data.success) {
                setMachines(response.data.data);
            }
        } catch (error) {
            console.warn("Failed to fetch machines");
        }
    };

    const handleCreate = async () => {
        try {
            const token = localStorage.getItem("token");
            await axios.post(`${API_BASE_URL}/api/maintenance/breakdown`, {
                machineId: selectedMachine,
                issueDescription: issue,
                priority
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setShowModal(false);
            fetchTickets();
            // Reset form
            setIssue("");
            setSelectedMachine("");
        } catch (error) {
            alert("Failed to create ticket");
        }
    };

    const getPriorityColor = (p: string) => {
        switch (p) {
            case "Critical": return "bg-red-100 text-red-700";
            case "High": return "bg-orange-100 text-orange-700";
            case "Medium": return "bg-yellow-100 text-yellow-700";
            default: return "bg-blue-100 text-blue-700";
        }
    };

    const getStatusColor = (s: string) => {
        switch (s) {
            case "Resolved": return "bg-green-100 text-green-700";
            case "Open": return "bg-red-50 text-red-600";
            default: return "bg-gray-100 text-gray-700";
        }
    };

    return (
        <div className="space-y-6">
            {/* Header Actions */}
            <div className="flex justify-between items-center">
                <div className="relative">
                    <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search tickets..."
                        className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
                    />
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                >
                    <Plus className="w-4 h-4" />
                    Report Breakdown
                </button>
            </div>

            {/* List */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Ticket #</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Machine</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Issue</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Priority</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Status</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Reported At</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {tickets.map((ticket) => (
                            <tr key={ticket._id} className="hover:bg-gray-50/50 transition-colors">
                                <td className="px-6 py-4 font-medium text-gray-900">{ticket.ticketNumber}</td>
                                <td className="px-6 py-4">
                                    <div className="text-sm font-medium text-gray-900">{ticket.machine?.machineName}</div>
                                    <div className="text-xs text-gray-500">{ticket.machine?.machineCode}</div>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">{ticket.issueDescription}</td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(ticket.priority)}`}>
                                        {ticket.priority}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(ticket.status)}`}>
                                        {ticket.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-500">
                                    {new Date(ticket.breakdownTime).toLocaleDateString()}
                                </td>
                            </tr>
                        ))}
                        {tickets.length === 0 && !loading && (
                            <tr>
                                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                                    No breakdown tickets found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Create Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white rounded-xl shadow-xl w-full max-w-md p-6"
                    >
                        <h2 className="text-xl font-bold mb-4">Report Machine Breakdown</h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Select Machine</label>
                                <select
                                    className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    value={selectedMachine}
                                    onChange={(e) => setSelectedMachine(e.target.value)}
                                >
                                    <option value="">-- Choose Machine --</option>
                                    {machines.map(m => (
                                        <option key={m._id} value={m._id}>{m.machineName} ({m.machineCode})</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Issue Description</label>
                                <textarea
                                    className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    rows={3}
                                    value={issue}
                                    onChange={(e) => setIssue(e.target.value)}
                                    placeholder="Describe the problem..."
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                                <select
                                    className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    value={priority}
                                    onChange={(e) => setPriority(e.target.value)}
                                >
                                    <option value="Low">Low</option>
                                    <option value="Medium">Medium</option>
                                    <option value="High">High</option>
                                    <option value="Critical">Critical</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => setShowModal(false)}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreate}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                            >
                                Report Breakdown
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
}

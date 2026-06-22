"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { API_BASE_URL } from "@/src/utils/config";
import { Plus, Cpu, CalendarClock } from "lucide-react";
import { motion } from "framer-motion";
import PPCMachinesTab from "../../ppc/components/PPCMachinesTab";

export default function MaintenanceMaster() {
    // Tab State for Master Section
    const [activeTab, setActiveTab] = useState<"preventive" | "machines">("preventive");

    return (
        <div className="space-y-6">
            {/* Master Sub-Tabs */}
            <div className="flex flex-wrap gap-2 items-center bg-white p-1 rounded-xl shadow-sm border border-gray-100 max-w-fit">
                <button
                    onClick={() => setActiveTab("preventive")}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${activeTab === "preventive"
                            ? "bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200"
                            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                        }`}
                >
                    <CalendarClock className="w-4 h-4" />
                    <span>Preventive Schedules</span>
                </button>
                <button
                    onClick={() => setActiveTab("machines")}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${activeTab === "machines"
                            ? "bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200"
                            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                        }`}
                >
                    <Cpu className="w-4 h-4" />
                    <span>Machines</span>
                </button>
            </div>

            {/* Content */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 min-h-[500px]">
                {activeTab === "preventive" && <PreventiveScheduleForm />}
                {activeTab === "machines" && <PPCMachinesTab />}
            </div>
        </div>
    );
}

// Extracted the previous form content into a sub-component
function PreventiveScheduleForm() {
    const [machines, setMachines] = useState<any[]>([]);

    // Schedule Creation Form
    const [formData, setFormData] = useState({
        machineId: "",
        title: "",
        frequency: "Monthly",
        checklist: "", // comma separated
        startDate: ""
    });

    useEffect(() => {
        fetchMachines();
    }, []);

    const fetchMachines = async () => {
        try {
            const token = localStorage.getItem("token");
            const response = await axios.get(`${API_BASE_URL}/api/ppc/machine`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            // Handle both structure possibilities just in case
            if (response.data.machines) {
                setMachines(response.data.machines);
            } else if (response.data.success && response.data.data) {
                setMachines(response.data.data);
            }
        } catch (error) {
            console.warn("Failed to fetch machines");
        }
    };

    const handleCreate = async () => {
        try {
            const token = localStorage.getItem("token");
            await axios.post(`${API_BASE_URL}/api/maintenance/preventive/schedule`, {
                ...formData,
                checklist: formData.checklist.split(',').map(s => s.trim())
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert("Schedule Created!");
            setFormData({ machineId: "", title: "", frequency: "Monthly", checklist: "", startDate: "" });
        } catch (error) {
            alert("Failed to create schedule");
        }
    };

    return (
        <div className="max-w-2xl mx-auto">
            <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-900">Configure Preventive Schedule</h2>
                <p className="text-gray-500 text-sm">Set up recurring maintenance tasks for machines.</p>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Select Machine</label>
                    <select
                        className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={formData.machineId}
                        onChange={(e) => setFormData({ ...formData, machineId: e.target.value })}
                    >
                        <option value="">-- Choose Machine --</option>
                        {machines.map(m => (
                            <option key={m._id} value={m._id}>{m.machineName} ({m.machineCode})</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Task Title</label>
                    <input
                        className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                        placeholder="e.g. Monthly Lubrication"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                        <select
                            className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                            value={formData.frequency}
                            onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                        >
                            <option value="Daily">Daily</option>
                            <option value="Weekly">Weekly</option>
                            <option value="Monthly">Monthly</option>
                            <option value="Quarterly">Quarterly</option>
                            <option value="Yearly">Yearly</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                        <input
                            type="date"
                            className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                            value={formData.startDate}
                            onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Checklist (comma separated)</label>
                    <textarea
                        className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                        rows={3}
                        placeholder="Check oil level, Clean filters, Tighten bolts..."
                        value={formData.checklist}
                        onChange={(e) => setFormData({ ...formData, checklist: e.target.value })}
                    />
                </div>
            </div>

            <div className="mt-8">
                <button
                    onClick={handleCreate}
                    className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition-colors font-semibold shadow-sm"
                >
                    <Plus className="w-5 h-5" />
                    Create Schedule
                </button>
            </div>
        </div>
    );
}

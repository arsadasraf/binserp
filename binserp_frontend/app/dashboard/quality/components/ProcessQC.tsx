"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { API_BASE_URL } from "@/src/utils/config";
import { Plus, CheckCircle, XCircle, AlertCircle, Play } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function ProcessQC() {
    const [pendingJobs, setPendingJobs] = useState<any[]>([]);
    const [historyRecords, setHistoryRecords] = useState<any[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [selectedJob, setSelectedJob] = useState<any>(null);

    // Form State
    const [formData, setFormData] = useState({
        jobId: "",
        processId: "", // Added processId
        processName: "",
        totalChecked: 0,
        okQuantity: 0,
        rejectedQuantity: 0,
        reworkQuantity: 0,
        remarks: "",
        status: "Accepted" // Default Status
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const token = localStorage.getItem("token");
            const headers = { Authorization: `Bearer ${token}` };

            // 1. Fetch Pending Jobs for QC
            const pendingRes = await axios.get(`${API_BASE_URL}/api/quality/process/pending`, { headers });
            if (pendingRes.data.success) setPendingJobs(pendingRes.data.data);

            // 2. Fetch History (Recent Inspections)
            const historyRes = await axios.get(`${API_BASE_URL}/api/quality/process`, { headers });
            if (historyRes.data.success) setHistoryRecords(historyRes.data.data);

        } catch (error) {
            console.error("Error fetching quality data");
        }
    };

    const handleInspect = (job: any) => {
        setSelectedJob(job);
        setFormData({
            jobId: job.jobId,
            processId: job.processId, // Key for backend update
            processName: job.processName,
            totalChecked: 0,
            okQuantity: 0,
            rejectedQuantity: 0,
            reworkQuantity: 0,
            remarks: "",
            status: "Accepted"
        });
        setShowModal(true);
    };

    const handleSubmit = async () => {
        try {
            const token = localStorage.getItem("token");
            // Auto-calculate Status if not manually set? 
            // Logic: If Rejected > 0, maybe warn? But for now trust user input.

            await axios.post(`${API_BASE_URL}/api/quality/process`, formData, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setShowModal(false);
            fetchData(); // Refresh both lists
        } catch (error) {
            alert("Failed to submit Process QC");
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex justify-between items-center">
                <div>
                    <h3 className="text-xl font-bold text-gray-800">Process Inspection</h3>
                    <p className="text-gray-500 text-sm">Review pending jobs and monitor quality compliance.</p>
                </div>
                {/* <button onClick={() => setShowModal(true)} ...> New Inspection (Manual) </button> */}
            </div>

            {/* Pending QC List */}
            <div className="grid grid-cols-1 gap-6">
                <div>
                    <h4 className="text-lg font-bold text-gray-700 mb-3 flex items-center gap-2">
                        <AlertCircle className="text-orange-500" size={20} />
                        Pending Inspection ({pendingJobs.length})
                    </h4>

                    {pendingJobs.length === 0 ? (
                        <div className="bg-gray-50 rounded-xl p-8 text-center text-gray-400 border border-dashed border-gray-200">
                            No jobs waiting for Quality Control.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {pendingJobs.map((job) => (
                                <motion.div
                                    key={job.processId}
                                    layout
                                    className="bg-white border border-orange-100 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden"
                                >
                                    <div className="absolute top-0 right-0 p-2 opacity-10">
                                        <AlertCircle size={60} className="text-orange-500" />
                                    </div>
                                    <div className="relative z-10">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-100 uppercase tracking-wider">
                                                QC Required
                                            </span>
                                        </div>
                                        <h4 className="font-bold text-gray-800 text-lg mb-1">{job.partName}</h4>
                                        <p className="text-sm text-gray-500 mb-4">{job.processName} • Ref: {job.jobNumber}</p>

                                        <button
                                            onClick={() => handleInspect(job)}
                                            className="w-full py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white font-medium rounded-lg shadow-sm hover:shadow-orange-200/50 flex items-center justify-center gap-2"
                                        >
                                            <Play size={16} /> Inspect Now
                                        </button>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Recent History */}
                <div>
                    <h4 className="text-lg font-bold text-gray-700 mb-3 flex items-center gap-2">
                        <CheckCircle className="text-green-500" size={20} />
                        Recent Inspections
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {historyRecords.length === 0 ? (
                            <div className="col-span-full text-center py-6 text-gray-400 text-sm">No history yet.</div>
                        ) : (
                            historyRecords.map((rec) => (
                                <div key={rec._id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm opacity-80 hover:opacity-100 transition-opacity">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${rec.status === 'Accepted' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {rec.status}
                                        </span>
                                        <span className="text-xs text-gray-400">{new Date(rec.createdAt).toLocaleDateString()}</span>
                                    </div>
                                    <h5 className="font-bold text-gray-800 text-sm">{rec.processName}</h5>
                                    <div className="flex justify-between text-xs mt-2 text-gray-600">
                                        <span>Checked: {rec.totalChecked}</span>
                                        <span className="text-green-600">OK: {rec.okQuantity}</span>
                                        <span className="text-red-600">NG: {rec.rejectedQuantity}</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Inspection Modal */}
            <AnimatePresence>
                {showModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
                        >
                            <div className="p-6 border-b border-gray-100 bg-gray-50">
                                <h3 className="text-lg font-bold text-gray-900">Inspect: {selectedJob?.partName}</h3>
                                <p className="text-sm text-gray-500">{selectedJob?.processName} ({selectedJob?.jobNumber})</p>
                            </div>

                            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Total Checked</label>
                                        <input type="number" value={formData.totalChecked} onChange={(e) => setFormData({ ...formData, totalChecked: Number(e.target.value) })} className="w-full border p-2 rounded-lg" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Pass/Fail Status</label>
                                        <select
                                            value={formData.status}
                                            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                            className={`w-full border p-2 rounded-lg font-bold ${formData.status === 'Accepted' ? 'text-green-600' : 'text-red-600'}`}
                                        >
                                            <option value="Accepted">✅ Accepted</option>
                                            <option value="Rejected">❌ Rejected</option>
                                            <option value="Rework">⚠️ Rework</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-green-700 mb-1">OK Qty</label>
                                        <input type="number" value={formData.okQuantity} onChange={(e) => setFormData({ ...formData, okQuantity: Number(e.target.value) })} className="w-full border border-green-200 p-2 rounded-lg" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-red-700 mb-1">Rejected Qty</label>
                                        <input type="number" value={formData.rejectedQuantity} onChange={(e) => setFormData({ ...formData, rejectedQuantity: Number(e.target.value) })} className="w-full border border-red-200 p-2 rounded-lg" />
                                    </div>
                                </div>

                                <textarea
                                    value={formData.remarks}
                                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                                    className="w-full border border-gray-300 rounded-lg p-2"
                                    rows={2}
                                    placeholder="Observations / Defect Reasons..."
                                />
                            </div>

                            <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
                                <button onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg">Cancel</button>
                                <button onClick={handleSubmit} className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 shadow-lg shadow-indigo-200">
                                    Submit Inspection
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

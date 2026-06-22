"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { API_BASE_URL } from "@/src/utils/config";
import { Plus, Check, X, ClipboardCheck, Search, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function IncomingQC() {
    const [records, setRecords] = useState<any[]>([]);
    const [showModal, setShowModal] = useState(false);

    // Grouped Inspection State
    const [selectedGRN, setSelectedGRN] = useState<any>(null);
    const [inspectionData, setInspectionData] = useState<Record<string, {
        rejectedQuantity: number;
        remarks: string;
    }>>({});

    const [pendingGRNs, setPendingGRNs] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');

    useEffect(() => {
        fetchRecords();
        fetchPendingGRNs();
    }, []);

    const fetchPendingGRNs = async () => {
        try {
            const token = localStorage.getItem("token");
            const res = await axios.get(`${API_BASE_URL}/api/store/grn`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.grns) {
                // Filter for QC Pending
                const pending = res.data.grns.filter((g: any) => g.qcRequired && g.qcStatus === 'Pending');
                setPendingGRNs(pending);
            }
        } catch (error) {
            console.error("Error fetching GRNs");
        }
    };

    const fetchRecords = async () => {
        try {
            const token = localStorage.getItem("token");
            const res = await axios.get(`${API_BASE_URL}/api/quality/incoming`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) setRecords(res.data.data);
        } catch (error) {
            console.error("Error fetching incoming QC records");
        }
    };

    const handleInspectGRN = (grn: any) => {
        if (!grn) return;
        setSelectedGRN(grn);
        // Initialize inspection data for all items in GRN
        const initialData: any = {};
        grn.items.forEach((item: any) => {
            initialData[item._id] = {
                rejectedQuantity: 0,
                remarks: ""
            };
        });
        setInspectionData(initialData);
        setShowModal(true);
    };

    const handleItemChange = (itemId: string, field: string, value: any) => {
        setInspectionData(prev => ({
            ...prev,
            [itemId]: {
                ...prev[itemId],
                [field]: value
            }
        }));
    };

    const handleSubmit = async () => {
        if (!selectedGRN) return;

        try {
            const token = localStorage.getItem("token");

            // Allow multiple concurrent submissions for all items in the GRN
            // In a real app, this might be a single bulk endpoint, but reusing existing endpoint for now
            const promises = selectedGRN.items.map((item: any) => {
                const data = inspectionData[item._id];
                const acceptedQty = item.quantity - (data.rejectedQuantity || 0);
                const status = data.rejectedQuantity > 0 ? "Rejected" : "Accepted";

                // Robust name resolution
                let matName = item.materialName;
                if (!matName) {
                    if (item.component && typeof item.component === 'object') {
                        matName = item.component.componentName || item.component.name;
                    } else if (item.material && typeof item.material === 'object') {
                        matName = item.material.name;
                    }
                }
                // Fallback if still empty
                if (!matName) matName = "Unknown Material";

                const payload = {
                    grnId: selectedGRN._id,
                    grnItemId: item._id,
                    materialId: item.material?._id || (typeof item.material === 'string' ? item.material : null),
                    componentId: item.component?._id || (typeof item.component === 'string' ? item.component : null),
                    materialName: matName,
                    supplierName: selectedGRN.supplierName || selectedGRN.supplier?.name || "",
                    batchNumber: "",
                    receivedQuantity: Number(item.quantity) || 0,
                    inspectedQuantity: Number(item.quantity) || 0,
                    acceptedQuantity: Number(acceptedQty) || 0,
                    rejectedQuantity: Number(data.rejectedQuantity) || 0,
                    remarks: data.remarks || "",
                    inspectionResults: [],
                    overallStatus: status
                };

                return axios.post(`${API_BASE_URL}/api/quality/incoming`, payload, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            });

            await Promise.all(promises);

            setShowModal(false);
            fetchRecords();
            fetchPendingGRNs();
            setSelectedGRN(null);
            // Switch to history view to show new records
            setActiveTab('history');
        } catch (error) {
            console.error(error);
            alert("Failed to submit QC. Check console.");
        }
    };

    // PDF Generation
    const generateHistoryPDF = (groupedData: any[]) => {
        if (!groupedData || groupedData.length === 0) return;

        const doc = new jsPDF();
        const firstRec = groupedData[0];
        const grnNum = firstRec.grnId?.grnNumber || "N/A";
        const dateStr = new Date(firstRec.createdAt).toLocaleDateString();

        // Header
        doc.setFontSize(18);
        doc.text("Incoming QC Report", 14, 20);

        doc.setFontSize(10);
        doc.text(`GRN Number: ${grnNum}`, 14, 30);
        doc.text(`Date: ${dateStr}`, 14, 35);
        doc.text(`Supplier: ${firstRec.supplierName || "N/A"}`, 14, 40);
        doc.text(`Inspector: ${firstRec.inspector?.username || "Unknown"}`, 14, 45);

        // Table
        const tableRows = groupedData.map((rec) => [
            rec.materialName,
            `${rec.receivedQuantity} / ${rec.acceptedQuantity}`,
            rec.rejectedQuantity || 0,
            rec.overallStatus,
            rec.remarks || "-"
        ]);

        autoTable(doc, {
            startY: 55,
            head: [['Material', 'Qty (Rec/Acc)', 'Rej Qty', 'Status', 'Reason/Remarks']],
            body: tableRows,
            theme: 'grid',
            headStyles: { fillColor: [79, 70, 229] }, // Indigo-600
        });

        doc.save(`QC_Report_${grnNum}.pdf`);
    };

    // View History Logic
    const [viewHistoryData, setViewHistoryData] = useState<any[] | null>(null);

    const handleViewHistory = (record: any) => {
        // Group by GRN ID to show full report for that GRN
        const grnId = record.grnId?._id || record.grnId;
        const siblings = records.filter(r => (r.grnId?._id || r.grnId) === grnId);
        setViewHistoryData(siblings);
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 h-[calc(100vh-140px)] flex flex-col">
            {/* Header with Tabs */}
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <div className="flex gap-2">
                    <button
                        onClick={() => setActiveTab('pending')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'pending' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'}`}
                    >
                        Pending GRNs ({pendingGRNs.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'history' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'}`}
                    >
                        QC History
                    </button>
                </div>
            </div>

            {/* List Content */}
            <div className="flex-1 overflow-auto p-6 bg-gray-50">
                {activeTab === 'pending' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {pendingGRNs.length === 0 ? (
                            <div className="col-span-full flex flex-col items-center justify-center h-64 text-gray-400">
                                <ClipboardCheck className="w-12 h-12 mb-2 opacity-20" />
                                <p>No pending GRNs for QC.</p>
                            </div>
                        ) : (
                            pendingGRNs.map((grn) => (
                                <div
                                    key={grn._id}
                                    onClick={() => handleInspectGRN(grn)}
                                    className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <span className="text-sm font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded inline-block mb-1">{grn.grnNumber}</span>
                                            <p className="text-xs text-gray-500">{new Date(grn.date).toLocaleDateString()}</p>
                                        </div>
                                        <div className="bg-white border border-gray-200 rounded-full p-1.5 group-hover:bg-indigo-50 group-hover:border-indigo-200 transition-colors">
                                            <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-indigo-600" />
                                        </div>
                                    </div>

                                    <div className="mb-4">
                                        <p className="text-xs text-gray-500 mb-1">Supplier</p>
                                        <p className="text-sm font-medium text-gray-800 truncate">{grn.supplierName || grn.supplier?.name || "Unknown"}</p>
                                    </div>

                                    {grn.poReference && (
                                        <div className="mb-4">
                                            <p className="text-xs text-gray-500 mb-1">PO Reference</p>
                                            <p className="text-sm font-medium text-gray-800">{grn.poReference}</p>
                                        </div>
                                    )}

                                    <div className="pt-4 border-t border-gray-100">
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-gray-500">Items to Inspect</span>
                                            <span className="font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded-full">{grn.items.length}</span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                ) : (
                    // HISTORY TABLE
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                        <table className="w-full text-left text-sm text-gray-600">
                            <thead className="bg-gray-50 text-gray-700 uppercase font-semibold">
                                <tr>
                                    <th className="px-4 py-3">Date</th>
                                    <th className="px-4 py-3">GRN No</th>
                                    <th className="px-4 py-3">Material</th>
                                    <th className="px-4 py-3 text-center">Qty (Rec/Apps)</th>
                                    <th className="px-4 py-3 text-center">Rej Qty</th>
                                    <th className="px-4 py-3 text-center">Status</th>
                                    <th className="px-4 py-3 text-right">Inspector</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {records.length === 0 ? (
                                    <tr><td colSpan={7} className="text-center py-8 text-gray-400">No inspections found.</td></tr>
                                ) : (
                                    records.map((rec) => (
                                        <tr
                                            key={rec._id}
                                            onClick={() => handleViewHistory(rec)}
                                            className="hover:bg-indigo-50 transition-colors cursor-pointer"
                                            title="Click to view full details"
                                        >
                                            <td className="px-4 py-3">{new Date(rec.createdAt).toLocaleDateString()}</td>
                                            <td className="px-4 py-3 font-mono text-xs">{rec.grnId?.grnNumber || "-"}</td>
                                            <td className="px-4 py-3 font-medium text-gray-900">{rec.materialName}</td>
                                            <td className="px-4 py-3 text-center">{rec.receivedQuantity} / {rec.acceptedQuantity}</td>
                                            <td className="px-4 py-3 text-center font-bold text-red-600">{rec.rejectedQuantity > 0 ? rec.rejectedQuantity : "-"}</td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${rec.overallStatus === "Accepted" ? "bg-green-100 text-green-700" :
                                                    rec.overallStatus === "Rejected" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"
                                                    }`}>
                                                    {rec.overallStatus}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right">{rec.inspector?.username || "Unknown"}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Bulk Inspection Modal (INPUT) */}
            <AnimatePresence>
                {showModal && selectedGRN && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col"
                        >
                            {/* Modal Header */}
                            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">Inspect GRN: {selectedGRN.grnNumber}</h3>
                                    <div className="flex gap-4 text-xs text-gray-500 mt-1">
                                        <span>Items: {selectedGRN.items.length}</span>
                                        <span>•</span>
                                        <span>{new Date(selectedGRN.date).toLocaleDateString()}</span>
                                    </div>
                                </div>
                                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-lg">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Modal Body - Items Table */}
                            <div className="flex-1 overflow-auto p-6">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200">
                                        <tr>
                                            <th className="px-4 py-3 w-[30%]">Material/Item</th>
                                            <th className="px-4 py-3 text-center w-[15%]">Received</th>
                                            <th className="px-4 py-3 text-center w-[15%]">Accepted</th>
                                            <th className="px-4 py-3 w-[15%]">Rejected</th>
                                            <th className="px-4 py-3 w-[25%]">Remarks</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {selectedGRN.items.map((item: any) => {
                                            const data = inspectionData[item._id] || { rejectedQuantity: 0, remarks: "" };
                                            const accepted = item.quantity - (data.rejectedQuantity || 0);

                                            return (
                                                <tr key={item._id} className="hover:bg-gray-50/50">
                                                    <td className="px-4 py-3">
                                                        <div className="font-medium text-gray-900">{item.materialName}</div>
                                                        <div className="text-xs text-gray-500">{item.unit}</div>
                                                    </td>
                                                    <td className="px-4 py-3 text-center font-medium">
                                                        {item.quantity}
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <span className="font-bold text-green-600">{accepted}</span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max={item.quantity}
                                                            value={data.rejectedQuantity}
                                                            onChange={(e) => handleItemChange(item._id, "rejectedQuantity", Number(e.target.value))}
                                                            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-red-500 outline-none font-medium text-red-600"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <input
                                                            type="text"
                                                            value={data.remarks}
                                                            onChange={(e) => handleItemChange(item._id, "remarks", e.target.value)}
                                                            className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                                                            placeholder="Reason for rejection..."
                                                        />
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Modal Footer */}
                            <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                                <button onClick={() => setShowModal(false)} className="px-5 py-2 text-gray-600 font-medium hover:bg-white border border-transparent hover:border-gray-200 rounded-lg transition-all">Cancel</button>
                                <button onClick={handleSubmit} className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 shadow-md transform active:scale-95 transition-all flex items-center gap-2">
                                    <ClipboardCheck className="w-4 h-4" /> Submit All Inspections
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* History Details Viewer Modal (READ ONLY) */}
            <AnimatePresence>
                {viewHistoryData && viewHistoryData.length > 0 && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col"
                        >
                            {/* Header */}
                            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">QC Report: {viewHistoryData[0].grnId?.grnNumber}</h3>
                                    <div className="flex gap-4 text-xs text-gray-500 mt-1">
                                        <span>Supplier: {viewHistoryData[0].supplierName || "N/A"}</span>
                                        <span>•</span>
                                        <span>Items: {viewHistoryData.length}</span>
                                        <span>•</span>
                                        <span>Date: {new Date(viewHistoryData[0].createdAt).toLocaleDateString()}</span>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => generateHistoryPDF(viewHistoryData)}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-200 transition-colors"
                                    >
                                        <ClipboardCheck size={16} /> Download PDF
                                    </button>
                                    <button onClick={() => setViewHistoryData(null)} className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-lg">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            {/* Table */}
                            <div className="flex-1 overflow-auto p-6">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200">
                                        <tr>
                                            <th className="px-4 py-3">Material</th>
                                            <th className="px-4 py-3 text-center">Received</th>
                                            <th className="px-4 py-3 text-center">Accepted</th>
                                            <th className="px-4 py-3 text-center">Rejected</th>
                                            <th className="px-4 py-3 text-center">Status</th>
                                            <th className="px-4 py-3 w-[25%]">Reasons / Remarks</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {viewHistoryData.map((rec) => (
                                            <tr key={rec._id} className="hover:bg-gray-50/50">
                                                <td className="px-4 py-3 font-medium text-gray-900">{rec.materialName}</td>
                                                <td className="px-4 py-3 text-center">{rec.receivedQuantity}</td>
                                                <td className="px-4 py-3 text-center text-green-600 font-medium">{rec.acceptedQuantity}</td>
                                                <td className="px-4 py-3 text-center text-red-600 font-bold">{rec.rejectedQuantity > 0 ? rec.rejectedQuantity : "-"}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${rec.overallStatus === "Accepted" ? "bg-green-100 text-green-700" :
                                                        rec.overallStatus === "Rejected" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"
                                                        }`}>
                                                        {rec.overallStatus}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-gray-500 italic">
                                                    {rec.remarks || "No remarks"}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

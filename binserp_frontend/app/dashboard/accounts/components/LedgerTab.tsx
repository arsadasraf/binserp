"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { API_BASE_URL } from "@/src/utils/config";
import { Plus, Download } from "lucide-react";

export default function LedgerTab() {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({
        type: "Income",
        category: "",
        amount: "",
        partyName: "",
        paymentMethod: "Bank Transfer",
        description: ""
    });

    const fetchTransactions = async () => {
        try {
            const token = localStorage.getItem("token");
            const res = await axios.get(`${API_BASE_URL}/api/accounts/transactions`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                setTransactions(res.data.data);
            }
        } catch (error) {
            console.error("Error fetching ledger", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchTransactions(); }, []);

    const handleSubmit = async (e: any) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem("token");
            await axios.post(`${API_BASE_URL}/api/accounts/transactions`, formData, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setShowModal(false);
            fetchTransactions();
        } catch (error) {
            alert("Failed to record entry");
        }
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <h3 className="text-lg font-bold text-gray-800">Master Ledger</h3>
                <button
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                >
                    <Plus size={16} /> New Entry
                </button>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-100">
                        <tr>
                            <th className="py-4 px-6">Date</th>
                            <th className="py-4 px-6">Txn ID</th>
                            <th className="py-4 px-6">Type</th>
                            <th className="py-4 px-6">Category</th>
                            <th className="py-4 px-6">Party/Ref</th>
                            <th className="py-4 px-6 text-right">Amount</th>
                            <th className="py-4 px-6">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {transactions.length === 0 ? (
                            <tr><td colSpan={7} className="text-center py-8 text-gray-500">No transactions recorded yet</td></tr>
                        ) : (
                            transactions.map((txn: any) => (
                                <tr key={txn._id} className="hover:bg-gray-50/50">
                                    <td className="py-3 px-6 text-gray-600">
                                        {new Date(txn.date).toLocaleDateString()}
                                    </td>
                                    <td className="py-3 px-6 font-mono text-gray-500">{txn.transactionId}</td>
                                    <td className="py-3 px-6">
                                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                                            txn.type === 'Income' ? 'bg-emerald-100 text-emerald-700' :
                                            txn.type === 'Expense' ? 'bg-rose-100 text-rose-700' :
                                            'bg-gray-100 text-gray-700'
                                        }`}>
                                            {txn.type}
                                        </span>
                                    </td>
                                    <td className="py-3 px-6 text-gray-700 font-medium">{txn.category}</td>
                                    <td className="py-3 px-6 text-gray-500">{txn.partyName || '-'}</td>
                                    <td className="py-3 px-6 text-right font-bold text-gray-900">
                                        ₹{txn.amount.toLocaleString()}
                                    </td>
                                    <td className="py-3 px-6">
                                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                                            txn.status === 'Completed' ? 'text-green-600 bg-green-50' : 'text-amber-600 bg-amber-50'
                                        }`}>
                                            {txn.status}
                                        </span>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl">
                        <h3 className="text-lg font-bold mb-4">Record New Ledger Entry</h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Type</label>
                                    <select 
                                        className="w-full border rounded-lg p-2"
                                        value={formData.type}
                                        onChange={(e) => setFormData({...formData, type: e.target.value})}
                                    >
                                        <option value="Income">Income</option>
                                        <option value="Expense">Expense</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Category</label>
                                    <input 
                                        type="text" required className="w-full border rounded-lg p-2"
                                        placeholder="e.g. Server Cost"
                                        value={formData.category}
                                        onChange={(e) => setFormData({...formData, category: e.target.value})}
                                    />
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium mb-1">Amount (₹)</label>
                                <input 
                                    type="number" required min="1" className="w-full border rounded-lg p-2"
                                    value={formData.amount}
                                    onChange={(e) => setFormData({...formData, amount: e.target.value})}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Party Name / Vendor (Optional)</label>
                                <input 
                                    type="text" className="w-full border rounded-lg p-2"
                                    value={formData.partyName}
                                    onChange={(e) => setFormData({...formData, partyName: e.target.value})}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Description</label>
                                <textarea 
                                    className="w-full border rounded-lg p-2" rows={2}
                                    value={formData.description}
                                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                                />
                            </div>

                            <div className="flex gap-4 pt-4 border-t">
                                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2 border rounded-xl hover:bg-gray-50">Cancel</button>
                                <button type="submit" className="flex-1 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700">Save Entry</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

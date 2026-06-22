"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { API_BASE_URL } from "@/src/utils/config";
import { FileText, Plus } from "lucide-react";

export default function InvoicesTab() {
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchInvoices = async () => {
        try {
            const token = localStorage.getItem("token");
            const res = await axios.get(`${API_BASE_URL}/api/accounts/transactions?type=Invoice`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                setInvoices(res.data.data);
            }
        } catch (error) {
            console.error("Error fetching invoices", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchInvoices(); }, []);

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <h3 className="text-lg font-bold text-gray-800">Accounts Receivable (Invoices)</h3>
                <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
                    <Plus size={16} /> Create Invoice
                </button>
            </div>

            <div className="p-8">
                {invoices.length === 0 ? (
                    <div className="text-center py-12">
                        <FileText className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                        <h3 className="text-lg font-medium text-gray-900">No Invoices</h3>
                        <p className="text-gray-500">You haven't generated any customer invoices yet.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {invoices.map((inv: any) => (
                            <div key={inv._id} className="border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start mb-4">
                                    <span className="text-xs text-gray-500 font-mono">{inv.transactionId}</span>
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                                        inv.status === 'Pending' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'
                                    }`}>
                                        {inv.status}
                                    </span>
                                </div>
                                <h4 className="text-xl font-bold text-gray-900 mb-1">₹{inv.amount.toLocaleString()}</h4>
                                <p className="text-sm font-medium text-gray-600 mb-4">{inv.partyName || 'Unknown Client'}</p>
                                <div className="text-sm text-gray-500 border-t pt-3">
                                    Generated: {new Date(inv.date).toLocaleDateString()}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

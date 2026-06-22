"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { API_BASE_URL } from "@/src/utils/config";
import { FileMinus, Plus } from "lucide-react";

export default function ExpensesTab() {
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchExpenses = async () => {
        try {
            const token = localStorage.getItem("token");
            const res = await axios.get(`${API_BASE_URL}/api/accounts/transactions?type=Expense`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                setExpenses(res.data.data);
            }
        } catch (error) {
            console.error("Error fetching expenses", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchExpenses(); }, []);

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <h3 className="text-lg font-bold text-gray-800">Accounts Payable (Expenses & Bills)</h3>
                <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
                    <Plus size={16} /> Record Bill
                </button>
            </div>

            <div className="p-8">
                {expenses.length === 0 ? (
                    <div className="text-center py-12">
                        <FileMinus className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                        <h3 className="text-lg font-medium text-gray-900">No Expenses</h3>
                        <p className="text-gray-500">You haven't recorded any system expenses or bills yet.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {expenses.map((exp: any) => (
                            <div key={exp._id} className="border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow bg-rose-50/10">
                                <div className="flex justify-between items-start mb-4">
                                    <span className="text-xs text-gray-500 font-mono">{exp.transactionId}</span>
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                                        exp.status === 'Pending' ? 'bg-rose-100 text-rose-800' : 'bg-gray-100 text-gray-600'
                                    }`}>
                                        {exp.status}
                                    </span>
                                </div>
                                <h4 className="text-xl font-bold text-gray-900 mb-1">₹{exp.amount.toLocaleString()}</h4>
                                <p className="text-sm font-medium text-gray-600 mb-4">{exp.category || 'General Expense'}</p>
                                <div className="text-sm text-gray-500 border-t border-rose-100/50 pt-3">
                                    Paid To: {exp.partyName || 'Internal / Direct'}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

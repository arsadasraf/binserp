"use client";

import React, { useState, useEffect } from "react";
import { 
    Plus, Search, RefreshCw, CreditCard, IndianRupee, 
    Calendar, CheckCircle2, Clock, AlertCircle, Edit2, Trash2, X, Check, Building2
} from "lucide-react";
import { apiGet, apiPost, apiPut, apiDelete } from "@/src/lib/api";

interface Payment {
    _id: string;
    receiptNo: string;
    paymentDate: string;
    amount: number;
    currency: string;
    paymentMode: string;
    transactionRef?: string;
    bankName?: string;
    customerName?: string;
    invoiceNumber?: string;
    status: "Cleared" | "Pending" | "Bounced";
    notes?: string;
    createdByName?: string;
    createdAt?: string;
}

export default function CRMPaymentsLedger() {
    const [payments, setPayments] = useState<Payment[]>([]);
    const [totalCollected, setTotalCollected] = useState(0);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [modeFilter, setModeFilter] = useState("All");

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        receiptNo: "",
        paymentDate: new Date().toISOString().slice(0, 10),
        amount: 0,
        currency: "INR",
        paymentMode: "NEFT/RTGS",
        transactionRef: "",
        bankName: "",
        customerName: "",
        invoiceNumber: "",
        status: "Cleared" as Payment["status"],
        notes: ""
    });

    const fetchPayments = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("token");
            let url = `/api/crm/payments?search=${encodeURIComponent(search)}`;
            if (modeFilter !== "All") url += `&paymentMode=${encodeURIComponent(modeFilter)}`;

            const res = await apiGet(url, token);
            const data = res.data || {};
            setPayments(data.payments || []);
            setTotalCollected(data.totalCollected || 0);
        } catch (err) {
            console.error("Failed to load payments", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPayments();
    }, [modeFilter]);

    const handleOpenCreate = () => {
        setEditingPayment(null);
        setFormData({
            receiptNo: "",
            paymentDate: new Date().toISOString().slice(0, 10),
            amount: 0,
            currency: "INR",
            paymentMode: "NEFT/RTGS",
            transactionRef: "",
            bankName: "",
            customerName: "",
            invoiceNumber: "",
            status: "Cleared",
            notes: ""
        });
        setIsModalOpen(true);
    };

    const handleOpenEdit = (pay: Payment) => {
        setEditingPayment(pay);
        setFormData({
            receiptNo: pay.receiptNo,
            paymentDate: pay.paymentDate ? new Date(pay.paymentDate).toISOString().slice(0, 10) : "",
            amount: pay.amount,
            currency: pay.currency || "INR",
            paymentMode: pay.paymentMode || "NEFT/RTGS",
            transactionRef: pay.transactionRef || "",
            bankName: pay.bankName || "",
            customerName: pay.customerName || "",
            invoiceNumber: pay.invoiceNumber || "",
            status: pay.status || "Cleared",
            notes: pay.notes || ""
        });
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const token = localStorage.getItem("token");
            if (editingPayment) {
                await apiPut(`/api/crm/payments/${editingPayment._id}`, formData, token);
            } else {
                await apiPost("/api/crm/payments", formData, token);
            }
            setIsModalOpen(false);
            fetchPayments();
        } catch (err) {
            console.error("Failed to save payment", err);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string, receiptNo: string) => {
        if (!confirm(`Delete payment record ${receiptNo}?`)) return;
        try {
            const token = localStorage.getItem("token");
            await apiDelete(`/api/crm/payments/${id}`, token);
            fetchPayments();
        } catch (err) {
            console.error("Failed to delete payment", err);
        }
    };

    return (
        <div className="space-y-4">
            {/* KPI Overview Banner */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="p-4 rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-xs">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-100 block">Total Realized Collections</span>
                    <strong className="text-2xl font-mono font-extrabold block mt-1">₹{Number(totalCollected || 0).toLocaleString()}</strong>
                    <span className="text-[10px] text-emerald-100 mt-1 block">Cleared across all deals & invoices</span>
                </div>
                <div className="p-4 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col justify-between">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Total Payment Receipts</span>
                    <strong className="text-2xl font-mono font-extrabold text-slate-900 dark:text-white mt-1">{payments.length}</strong>
                    <span className="text-[10px] text-slate-500">Transaction vouchers logged</span>
                </div>
                <div className="p-4 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col justify-between">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Average Transaction</span>
                    <strong className="text-2xl font-mono font-extrabold text-indigo-600 dark:text-indigo-400 mt-1">
                        ₹{payments.length > 0 ? Math.round(totalCollected / payments.length).toLocaleString() : 0}
                    </strong>
                    <span className="text-[10px] text-slate-500">Per payment voucher</span>
                </div>
            </div>

            {/* Filter & Action Toolbar */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative w-64">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Search receipt, UTR, client..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && fetchPayments()}
                            className="w-full pl-9 pr-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                    </div>

                    <select
                        value={modeFilter}
                        onChange={(e) => setModeFilter(e.target.value)}
                        className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 outline-none"
                    >
                        <option value="All">All Modes</option>
                        <option value="NEFT/RTGS">NEFT / RTGS</option>
                        <option value="UPI">UPI</option>
                        <option value="Cheque">Cheque</option>
                        <option value="Cash">Cash</option>
                        <option value="LC">Letter of Credit (LC)</option>
                    </select>

                    <button
                        onClick={fetchPayments}
                        className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 hover:bg-slate-100 rounded-xl"
                        title="Refresh"
                    >
                        <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
                    </button>
                </div>

                <button
                    onClick={handleOpenCreate}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5"
                >
                    <Plus size={15} />
                    <span>Record Payment</span>
                </button>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-700">
                            <tr>
                                <th className="px-5 py-3.5">Receipt # & Date</th>
                                <th className="px-5 py-3.5">Customer / Client</th>
                                <th className="px-5 py-3.5">Amount (INR)</th>
                                <th className="px-5 py-3.5">Payment Mode & UTR</th>
                                <th className="px-5 py-3.5">Invoice / Ref</th>
                                <th className="px-5 py-3.5">Status</th>
                                <th className="px-5 py-3.5">Recorded By</th>
                                <th className="px-5 py-3.5 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-medium">
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                                        <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-emerald-500" />
                                        Loading payment receipts...
                                    </td>
                                </tr>
                            ) : payments.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                                        No payments logged yet. Click &quot;Record Payment&quot; to log incoming funds.
                                    </td>
                                </tr>
                            ) : (
                                payments.map((p) => (
                                    <tr key={p._id} className="hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors">
                                        <td className="px-5 py-4">
                                            <strong className="text-slate-900 dark:text-white font-mono block">{p.receiptNo}</strong>
                                            <span className="text-[11px] text-slate-500 block">
                                                {p.paymentDate ? new Date(p.paymentDate).toLocaleDateString() : ""}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4">
                                            <strong className="text-slate-900 dark:text-white block">{p.customerName || "N/A"}</strong>
                                        </td>
                                        <td className="px-5 py-4">
                                            <strong className="text-emerald-600 dark:text-emerald-400 font-mono text-sm">
                                                ₹{Number(p.amount || 0).toLocaleString()}
                                            </strong>
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="font-bold text-slate-800 dark:text-slate-200">{p.paymentMode}</div>
                                            {p.transactionRef && (
                                                <div className="text-[10px] text-slate-500 font-mono">Ref: {p.transactionRef}</div>
                                            )}
                                        </td>
                                        <td className="px-5 py-4 text-slate-600 dark:text-slate-400 font-mono">
                                            {p.invoiceNumber || "—"}
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${
                                                p.status === "Cleared"
                                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                    : p.status === "Pending"
                                                    ? "bg-amber-50 text-amber-700 border-amber-200"
                                                    : "bg-rose-50 text-rose-700 border-rose-200"
                                            }`}>
                                                {p.status}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 text-slate-500 text-[11px]">
                                            <div>{p.createdByName || "System"}</div>
                                            <div className="text-[10px] text-slate-400">
                                                {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : ""}
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <button
                                                    onClick={() => handleOpenEdit(p)}
                                                    className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700 rounded-lg"
                                                    title="Edit"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(p._id, p.receiptNo)}
                                                    className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-700 rounded-lg"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* RECORD PAYMENT MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-800">
                        <div className="p-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex justify-between items-center border-b border-slate-700">
                            <div>
                                <h3 className="font-extrabold text-base flex items-center gap-2">
                                    <CreditCard size={18} className="text-emerald-400" />
                                    {editingPayment ? `Edit Payment: ${editingPayment.receiptNo}` : "Record Incoming Payment"}
                                </h3>
                                <p className="text-xs text-slate-300 mt-0.5">Payment receipt and collection voucher</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300">
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Customer / Company *</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. Maruti Suzuki India"
                                        value={formData.customerName}
                                        onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Amount (INR) *</label>
                                    <input
                                        type="number"
                                        required
                                        min="1"
                                        placeholder="0"
                                        value={formData.amount}
                                        onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono font-bold outline-none text-emerald-600 dark:text-emerald-400"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Payment Date</label>
                                    <input
                                        type="date"
                                        value={formData.paymentDate}
                                        onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
                                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Payment Mode</label>
                                    <select
                                        value={formData.paymentMode}
                                        onChange={(e) => setFormData({ ...formData, paymentMode: e.target.value })}
                                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold outline-none"
                                    >
                                        <option value="NEFT/RTGS">NEFT / RTGS</option>
                                        <option value="UPI">UPI</option>
                                        <option value="Cheque">Cheque</option>
                                        <option value="Cash">Cash</option>
                                        <option value="LC">Letter of Credit (LC)</option>
                                        <option value="Card">Credit/Debit Card</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Transaction Ref / UTR</label>
                                    <input
                                        type="text"
                                        placeholder="UTR, Cheque number..."
                                        value={formData.transactionRef}
                                        onChange={(e) => setFormData({ ...formData, transactionRef: e.target.value })}
                                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Invoice / Reference #</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. INV-2026-089"
                                        value={formData.invoiceNumber}
                                        onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono outline-none"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Bank Name</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. HDFC Bank"
                                        value={formData.bankName}
                                        onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Status</label>
                                    <select
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold outline-none"
                                    >
                                        <option value="Cleared">Cleared</option>
                                        <option value="Pending">Pending</option>
                                        <option value="Bounced">Bounced</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Remarks / Notes</label>
                                <textarea
                                    rows={2}
                                    placeholder="Payment details, deduction remarks..."
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                                />
                            </div>

                            <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs disabled:opacity-50"
                                >
                                    {submitting ? "Saving..." : editingPayment ? "Update Receipt" : "Record Receipt"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

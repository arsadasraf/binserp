import React from "react";
import { X, Calendar, PlusCircle, MinusCircle } from "lucide-react";
import { Employee } from "../../types/hr.types";

interface CompOffHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    employee: Employee | null;
}

export default function CompOffHistoryModal({ isOpen, onClose, employee }: CompOffHistoryModalProps) {
    if (!isOpen || !employee) return null;

    const history = employee.compOffHistory || [];

    // Sort history by date descending
    const sortedHistory = [...history].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return (
        <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" style={{ zIndex: 9999 }}>
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                
                {/* Header */}
                <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 dark:border-slate-800">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">CompOff Ledger</h2>
                        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
                            History for {employee.name} ({employee.employeeId})
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-800 dark:hover:text-gray-300 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Balance Summary */}
                <div className="px-6 py-4 bg-indigo-50/50 dark:bg-indigo-900/10 border-b border-indigo-100 dark:border-indigo-800/30 flex justify-between items-center">
                    <span className="text-sm font-medium text-indigo-800 dark:text-indigo-300">
                        Current Available Balance
                    </span>
                    <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                        {employee.compOffBalance || 0} <span className="text-sm font-medium">Days</span>
                    </span>
                </div>

                {/* Body - Table */}
                <div className="max-h-[60vh] overflow-y-auto p-6">
                    {sortedHistory.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="bg-gray-50 dark:bg-slate-800 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Calendar size={24} className="text-gray-400" />
                            </div>
                            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">No CompOff History</h3>
                            <p className="text-gray-500 dark:text-gray-400 mt-1">This employee has not earned or consumed any CompOff.</p>
                        </div>
                    ) : (
                        <div className="border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 dark:bg-slate-800/50 text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-slate-700">
                                    <tr>
                                        <th className="px-4 py-3 font-medium">Date</th>
                                        <th className="px-4 py-3 font-medium">Salary Month</th>
                                        <th className="px-4 py-3 font-medium">Type</th>
                                        <th className="px-4 py-3 font-medium text-right">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedHistory.map((record, idx) => {
                                        const isEarned = record.transactionType === 'Earned';
                                        return (
                                            <tr key={idx} className="border-b last:border-0 border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/30">
                                                <td className="px-4 py-3 text-gray-800 dark:text-gray-200 font-medium">
                                                    {new Date(record.date).toLocaleDateString()}
                                                </td>
                                                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                                                    {record.month} {record.year}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                                                        isEarned 
                                                        ? "bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-800" 
                                                        : "bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800"
                                                    }`}>
                                                        {isEarned ? <PlusCircle size={12} /> : <MinusCircle size={12} />}
                                                        {record.transactionType}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <span className={`font-semibold ${isEarned ? "text-teal-600 dark:text-teal-400" : "text-orange-600 dark:text-orange-400"}`}>
                                                        {isEarned ? "+" : "-"}{record.amount}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}

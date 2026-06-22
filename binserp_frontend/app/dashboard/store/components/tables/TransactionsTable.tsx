/**
 * TransactionsTable Component
 * 
 * Displays transaction records (GRN, DC, PO, Billing, Material Issue) in a table format.
 * Columns include:
 * - Number (GRN/DC/PO/Invoice number)
 * - Date
 * - Items count
 * - Actions (Edit/Delete)
 * 
 * @param data - Array of transaction items to display
 * @param onEdit - Function to handle edit action
 * @param onDelete - Function to handle delete action
 */

import React from 'react';
import { Edit2, Trash2 } from 'lucide-react';
import { Transaction } from '../../types/store.types';

interface TransactionsTableProps {
    data: Transaction[];
    onEdit: (item: Transaction) => void;
    onDelete: (id: string) => void;
}

export default function TransactionsTable({ data, onEdit, onDelete }: TransactionsTableProps) {
    return (
        <div className="w-full">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="px-6 py-3 text-left font-semibold text-gray-900">Number</th>
                            <th className="px-6 py-3 text-left font-semibold text-gray-900">Date</th>
                            <th className="px-6 py-3 text-left font-semibold text-gray-900">Items</th>
                            <th className="px-6 py-3 text-right font-semibold text-gray-900">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {data.map((item) => (
                            <tr key={item._id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4 font-medium text-gray-900">
                                    {item.grnNumber || item.dcNumber || item.poNumber || item.invoiceNumber || item.issueNumber}
                                </td>
                                <td className="px-6 py-4 text-gray-600">
                                    {new Date(item.date).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 text-gray-600">
                                    {item.items?.length || 0} items
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex justify-end gap-2">
                                        <button onClick={() => onEdit(item)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg" title="Edit">
                                            <Edit2 size={16} />
                                        </button>
                                        <button onClick={() => onDelete(item._id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg" title="Delete">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden flex flex-col gap-3 p-4">
                {data.map((item) => (
                    <div key={item._id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-3">
                        <div className="flex justify-between items-start border-b border-gray-50 pb-2">
                            <div>
                                <span className="text-xs font-medium text-gray-500 block mb-1">
                                    {item.grnNumber ? 'GRN' : item.dcNumber ? 'DC' : item.poNumber ? 'PO' : item.invoiceNumber ? 'Invoice' : item.issueNumber ? 'Issue' : 'Transaction'}
                                </span>
                                <h4 className="font-bold text-gray-900">
                                    {item.grnNumber || item.dcNumber || item.poNumber || item.invoiceNumber || item.issueNumber}
                                </h4>
                            </div>
                            <span className="text-xs text-gray-400 font-medium">
                                {new Date(item.date).toLocaleDateString()}
                            </span>
                        </div>

                        <div className="text-sm">
                            <span className="text-gray-500">Items:</span> <span className="font-medium text-gray-900">{item.items?.length || 0}</span>
                        </div>

                        <div className="flex items-center gap-2 pt-2 border-t border-gray-50">
                            <button onClick={() => onEdit(item)} className="flex-1 flex items-center justify-center gap-2 py-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg text-sm font-medium transition-colors">
                                <Edit2 size={16} /> Edit
                            </button>
                            <button onClick={() => onDelete(item._id)} className="flex-1 flex items-center justify-center gap-2 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg text-sm font-medium transition-colors">
                                <Trash2 size={16} /> Delete
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

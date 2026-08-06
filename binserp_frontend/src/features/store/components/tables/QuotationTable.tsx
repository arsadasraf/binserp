/**
 * QuotationTable Component
 * Displays Quotation history
 */

import React, { useState, useMemo } from 'react';
import { Edit2, Trash2, Download } from 'lucide-react';
import { CompanyInfo } from '../../types/store.types';
import { generateDocument } from '@/src/utils/documentHelper';

interface QuotationTableProps {
    data: any[];
    companyInfo?: CompanyInfo;
    onEdit: (item: any) => void;
    onDelete: (id: string) => void;
    onView?: (item: any) => void;
}

export default function QuotationTable({ data, companyInfo, onEdit, onDelete, onView }: QuotationTableProps) {
    const [selectedMonth, setSelectedMonth] = useState<string>('');

    // Filter by selected month
    const filteredData = useMemo(() => {
        if (!selectedMonth) return data;
        return data.filter(item => {
            const date = new Date(item.date);
            const itemMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            return itemMonth === selectedMonth;
        });
    }, [data, selectedMonth]);

    const handleDownloadPDF = async (quotation: any) => {
        await generateDocument('pdf', 'quotation', { doc: quotation, companyInfo });
    };

    if (!data || data.length === 0) {
        return (
            <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <p className="text-gray-500 text-lg">No Quotations found</p>
                <p className="text-gray-400 text-sm mt-2">Create a new Quotation to get started</p>
            </div>
        );
    }

    return (
        <div className="w-full">
            {/* Month Filter */}
            <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
                <h3 className="text-lg font-bold text-gray-800">Quotations History</h3>
                <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-gray-600">Filter by Month:</label>
                    <input 
                        type="month" 
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm"
                    />
                    {selectedMonth && (
                        <button 
                            onClick={() => setSelectedMonth('')} 
                            className="text-sm text-red-500 hover:underline"
                        >
                            Clear
                        </button>
                    )}
                </div>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-indigo-50 border-b border-indigo-100">
                        <tr>
                            <th className="px-6 py-3 text-left font-semibold text-indigo-900">Quotation No</th>
                            <th className="px-6 py-3 text-left font-semibold text-indigo-900">Date</th>
                            <th className="px-6 py-3 text-left font-semibold text-indigo-900">Customer</th>
                            <th className="px-6 py-3 text-left font-semibold text-indigo-900">Amount</th>
                            <th className="px-6 py-3 text-left font-semibold text-indigo-900">Status</th>
                            <th className="px-6 py-3 text-right font-semibold text-indigo-900">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                        {filteredData.map((item) => (
                            <tr key={item._id} className="hover:bg-indigo-50 transition-colors cursor-pointer" onClick={() => onView && onView(item)}>
                                <td className="px-6 py-4 font-medium text-gray-900">{item.quotationNumber}</td>
                                <td className="px-6 py-4 text-gray-600">{new Date(item.date).toLocaleDateString()}</td>
                                <td className="px-6 py-4 text-gray-600">{item.customerName}</td>
                                <td className="px-6 py-4 text-indigo-600 font-semibold">₹ {(item.totalAmount || 0).toFixed(2)}</td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                        item.status === 'Accepted' ? 'bg-green-100 text-green-800' :
                                        item.status === 'Sent' ? 'bg-blue-100 text-blue-800' : 
                                        item.status === 'Rejected' ? 'bg-red-100 text-red-800' :
                                        'bg-gray-100 text-gray-800'
                                    }`}>
                                        {item.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                        <button onClick={() => handleDownloadPDF(item)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Download PDF"><Download size={16} /></button>
                                        <button onClick={() => onEdit(item)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Edit"><Edit2 size={16} /></button>
                                        <button onClick={() => onDelete(item._id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete"><Trash2 size={16} /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filteredData.length === 0 && (
                     <div className="text-center py-6 text-gray-500 bg-white">No quotations found for the selected month.</div>
                )}
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden flex flex-col gap-3">
                {filteredData.map((item) => (
                    <div key={item._id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-3 cursor-pointer hover:border-indigo-200" onClick={() => onView && onView(item)}>
                        <div className="flex justify-between items-start border-b border-gray-50 pb-2">
                            <div>
                                <span className="text-xs font-medium text-gray-500 block mb-1">Quote #{item.quotationNumber}</span>
                                <h4 className="font-bold text-gray-900">{item.customerName}</h4>
                            </div>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${item.status === 'Accepted' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{item.status}</span>
                        </div>
                        <div className="text-sm space-y-2">
                            <div className="flex justify-between"><span className="text-gray-500">Date:</span> <span>{new Date(item.date).toLocaleDateString()}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">Amount:</span> <span className="font-bold text-indigo-600">₹ {(item.totalAmount || 0).toFixed(2)}</span></div>
                        </div>
                        <div className="flex items-center gap-2 pt-3 border-t border-gray-50 mt-1" onClick={(e) => e.stopPropagation()}>
                            <button onClick={() => handleDownloadPDF(item)} className="flex-1 flex justify-center py-2 text-indigo-600 bg-indigo-50 rounded-lg"><Download size={16} /></button>
                            <button onClick={() => onEdit(item)} className="flex-1 flex items-center justify-center gap-2 py-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg"><Edit2 size={16} /></button>
                            <button onClick={() => onDelete(item._id)} className="flex-1 flex items-center justify-center gap-2 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg"><Trash2 size={16} /></button>
                        </div>
                    </div>
                ))}
                {filteredData.length === 0 && (
                     <div className="text-center py-6 text-gray-500">No quotations found for the selected month.</div>
                )}
            </div>
        </div>
    );
}

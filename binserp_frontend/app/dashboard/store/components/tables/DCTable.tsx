/**
 * DCTable Component
 * Displays Delivery Challan history
 * Features: E-way Bill Generation button, PDF Download, Edit/Delete
 */

import React from 'react';
import { Edit2, Trash2, Download, Truck, FileText } from 'lucide-react'; // Truck icon for E-way Bill
import { CompanyInfo } from '../../types/store.types';
import { generateDocument } from '@/src/utils/documentHelper';

interface DCTableProps {
    data: any[];
    companyInfo?: CompanyInfo;
    onEdit: (item: any) => void;
    onDelete: (id: string) => void;
}

const generateEWayBill = (dc: any) => {
    // Placeholder for E-way bill generation logic
    alert(`Generating E-Way Bill for DC: ${dc.dcNumber}`);
};

const downloadDCAsPDF = async (dc: any, companyInfo?: CompanyInfo) => {
    await generateDocument('pdf', 'dc', { doc: dc, companyInfo });
};

const downloadSingleDCExcel = async (dc: any, companyInfo?: CompanyInfo) => {
    await generateDocument('excel', 'Delivery Challans', [dc]);
};

export default function DCTable({ data, companyInfo, onEdit, onDelete }: DCTableProps) {
    if (!data || data.length === 0) {
        return (
            <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <p className="text-gray-500 text-lg">No Delivery Challans found</p>
                <p className="text-gray-400 text-sm mt-2">Create a new DC to get started</p>
            </div>
        );
    }

    return (
        <div className="w-full">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-blue-50 border-b border-blue-100">
                        <tr>
                            <th className="px-6 py-3 text-left font-semibold text-blue-900">DC Number</th>
                            <th className="px-6 py-3 text-left font-semibold text-blue-900">Date</th>
                            <th className="px-6 py-3 text-left font-semibold text-blue-900">Customer</th>
                            <th className="px-6 py-3 text-left font-semibold text-blue-900">Items</th>
                            <th className="px-6 py-3 text-left font-semibold text-blue-900">Status</th>
                            <th className="px-6 py-3 text-right font-semibold text-blue-900">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                        {data.map((item) => (
                            <tr key={item._id} className="hover:bg-blue-50 transition-colors">
                                <td className="px-6 py-4 font-medium text-gray-900">{item.dcNumber}</td>
                                <td className="px-6 py-4 text-gray-600">{new Date(item.date).toLocaleDateString()}</td>
                                <td className="px-6 py-4 text-gray-600">{item.customerName}</td>
                                <td className="px-6 py-4 text-gray-600">
                                    {item.items?.[0]?.materialName || '-'}
                                    {item.items?.length > 1 && <span className="text-xs text-blue-600 ml-1">(+{item.items.length - 1} more)</span>}
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${item.status === 'Delivered' ? 'bg-green-100 text-green-800' :
                                        item.status === 'Issued' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                                        }`}>
                                        {item.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex justify-end gap-2">
                                        <button onClick={() => generateEWayBill(item)} className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors" title="Generate E-Way Bill"><Truck size={16} /></button>
                                        <button onClick={() => downloadSingleDCExcel(item, companyInfo)} className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Download Excel"><FileText size={16} /></button>
                                        <button onClick={() => downloadDCAsPDF(item, companyInfo)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Download PDF"><Download size={16} /></button>
                                        <button onClick={() => onEdit(item)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Edit"><Edit2 size={16} /></button>
                                        <button onClick={() => onDelete(item._id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete"><Trash2 size={16} /></button>
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
                        {/* Card Header */}
                        <div className="flex justify-between items-start border-b border-gray-50 pb-2">
                            <div>
                                <span className="text-xs font-medium text-gray-500 block mb-1">DC #{item.dcNumber}</span>
                                <h4 className="font-bold text-gray-900">{item.customerName}</h4>
                            </div>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${item.status === 'Delivered' ? 'bg-green-100 text-green-800' : item.status === 'Issued' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>{item.status}</span>
                        </div>

                        {/* Card Content Details */}
                        <div className="text-sm space-y-2">
                            <div className="flex justify-between"><span className="text-gray-500">Date:</span> <span>{new Date(item.date).toLocaleDateString()}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">Items:</span> <span>{item.items?.[0]?.materialName || '-'}{item.items?.length > 1 && <span className="text-xs text-blue-600 ml-1">(+{item.items.length - 1} more)</span>}</span></div>
                        </div>

                        {/* Card Actions */}
                        <div className="flex items-center gap-2 pt-3 border-t border-gray-50 mt-1 flex-wrap">
                            <button onClick={() => generateEWayBill(item)} className="flex-1 py-2 text-orange-600 bg-orange-50 rounded-lg text-xs font-medium flex justify-center items-center gap-1"><Truck size={14} /> E-Way</button>
                            <button onClick={() => downloadSingleDCExcel(item, companyInfo)} className="flex-1 py-2 text-green-600 bg-green-50 rounded-lg text-xs font-medium flex justify-center items-center gap-1"><FileText size={14} /> Excel</button>
                            <button onClick={() => downloadDCAsPDF(item, companyInfo)} className="flex-1 py-2 text-blue-600 bg-blue-50 rounded-lg text-xs font-medium flex justify-center items-center gap-1"><Download size={14} /> PDF</button>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => onEdit(item)} className="flex-1 flex items-center justify-center gap-2 py-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg text-sm font-medium transition-colors"><Edit2 size={16} /> Edit</button>
                            <button onClick={() => onDelete(item._id)} className="flex-1 flex items-center justify-center gap-2 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg text-sm font-medium transition-colors"><Trash2 size={16} /> Delete</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

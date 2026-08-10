/**
 * POTable Component
 * 
 * Displays Purchase Order history in the PO tab
 * Features:
 * - PO list with clickable preview modal & client-side PDF/Excel export
 * - Object-safe property extraction to prevent React child object rendering crashes
 * - 12-hour edit/delete restriction
 */

import React, { useState } from 'react';
import { Edit2, Trash2, Download, FileSpreadsheet, Eye, X, Printer, Building2, ShoppingCart } from 'lucide-react';
import { generateDocument } from '@/src/utils/documentHelper';
import { generateFrontendPoPDF } from '@/src/utils/frontendPdfHelper';
import { CompanyInfo } from "@/src/features/store/types/store.types";

interface POTableProps {
    data: any[];
    companyInfo?: CompanyInfo;
    onEdit: (item: any) => void;
    onDelete: (id: string) => void;
}

const isWithin12Hours = (createdAt: string | Date): boolean => {
    if (!createdAt) return true;
    const now = new Date().getTime();
    const created = new Date(createdAt).getTime();
    const hoursDiff = (now - created) / (1000 * 60 * 60);
    return hoursDiff <= 12;
};

// Safe helper functions for extracting string values from potential Mongoose populated objects
const getVendorNameStr = (item: any): string => {
    if (!item) return '-';
    if (typeof item.vendorName === 'string' && item.vendorName.trim()) return item.vendorName;
    if (typeof item.vendor === 'object' && item.vendor?.name) return String(item.vendor.name);
    if (typeof item.vendor === 'string') return item.vendor;
    return 'Supplier';
};

const getMaterialNameStr = (item: any): string => {
    if (!item) return '-';
    if (Array.isArray(item.items) && item.items.length > 0) {
        const first = item.items[0];
        if (typeof first?.materialName === 'string') return first.materialName;
        if (typeof first?.material === 'object' && first.material?.name) return String(first.material.name);
        if (typeof first?.material === 'string') return first.material;
    }
    if (typeof item.materialName === 'string') return item.materialName;
    if (typeof item.material === 'object' && item.material?.name) return String(item.material.name);
    if (typeof item.material === 'string') return item.material;
    return 'Material Item';
};

const getVendorAddressStr = (vendorObj: any): string => {
    if (!vendorObj || typeof vendorObj !== 'object') return '';
    return vendorObj.address || vendorObj.billingAddress || vendorObj.street || '';
};

const getVendorGstStr = (vendorObj: any): string => {
    if (!vendorObj || typeof vendorObj !== 'object') return '';
    return vendorObj.gst || vendorObj.gstNumber || vendorObj.gstin || '';
};

export default function POTable({ data, companyInfo, onEdit, onDelete }: POTableProps) {
    const [selectedPoPreview, setSelectedPoPreview] = useState<any | null>(null);

    const downloadPOAsPDF = (po: any) => {
        generateFrontendPoPDF({ po, companyInfo });
    };

    const downloadPOAsExcel = async (po: any) => {
        await generateDocument('excel', 'Invoices', [po]);
    };

    if (!Array.isArray(data) || data.length === 0) {
        return (
            <div className="text-center py-12 bg-gray-50 dark:bg-slate-900 rounded-2xl border-2 border-dashed border-gray-300 dark:border-slate-800">
                <ShoppingCart className="mx-auto h-12 w-12 text-slate-300 mb-2" />
                <p className="text-gray-700 dark:text-slate-300 text-base font-bold">No Purchase Orders yet</p>
                <p className="text-gray-400 text-xs mt-1">Generate a PO from an Inward Quotation or click "Create Purchase Order".</p>
            </div>
        );
    }

    return (
        <div className="w-full space-y-4">
            
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-800 text-sm">
                    <thead className="bg-purple-50 dark:bg-slate-800/80 border-b border-purple-100 dark:border-slate-700 text-xs uppercase font-bold text-purple-900 dark:text-purple-300">
                        <tr>
                            <th className="px-6 py-3.5 text-left">PO Number</th>
                            <th className="px-6 py-3.5 text-left">Date</th>
                            <th className="px-6 py-3.5 text-left">Vendor</th>
                            <th className="px-6 py-3.5 text-left">Materials</th>
                            <th className="px-6 py-3.5 text-right">Amount (₹)</th>
                            <th className="px-6 py-3.5 text-center">Status</th>
                            <th className="px-6 py-3.5 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                        {data.map((item) => {
                            const vName = getVendorNameStr(item);
                            const mName = getMaterialNameStr(item);
                            const amount = Number(item.totalAmount || item.amount || 0);

                            return (
                                <tr key={item._id} className="hover:bg-purple-50/50 dark:hover:bg-slate-800/50 transition-colors">
                                    <td 
                                        onClick={() => setSelectedPoPreview(item)} 
                                        className="px-6 py-4 font-mono font-bold text-purple-600 dark:text-purple-400 cursor-pointer hover:underline"
                                    >
                                        {item.poNumber || 'PO-Doc'}
                                    </td>

                                    <td className="px-6 py-4 text-gray-600 dark:text-slate-400 font-medium">
                                        {item.date ? new Date(item.date).toLocaleDateString('en-GB') : '-'}
                                    </td>

                                    <td className="px-6 py-4 text-gray-900 dark:text-white font-bold">
                                        {vName}
                                    </td>

                                    <td className="px-6 py-4 text-gray-600 dark:text-slate-300">
                                        {mName}
                                        {Array.isArray(item.items) && item.items.length > 1 && (
                                            <span className="text-xs text-purple-600 font-bold ml-1">(+{item.items.length - 1} more)</span>
                                        )}
                                    </td>

                                    <td className="px-6 py-4 text-right text-gray-900 dark:text-white font-extrabold font-mono">
                                        ₹ {amount.toLocaleString()}
                                    </td>

                                    <td className="px-6 py-4 text-center">
                                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                            item.status === 'Released' ? 'bg-purple-100 text-purple-800' :
                                            item.status === 'Completed' ? 'bg-green-100 text-green-800' :
                                            item.status === 'Cancelled' ? 'bg-red-100 text-red-800' :
                                            'bg-gray-100 text-gray-800'
                                        }`}>
                                            {item.status || 'Released'}
                                        </span>
                                    </td>

                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-1.5">
                                            <button 
                                                onClick={() => setSelectedPoPreview(item)} 
                                                className="p-1.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 rounded-lg transition-colors" 
                                                title="Preview PO Details"
                                            >
                                                <Eye size={16} />
                                            </button>

                                            <button 
                                                onClick={() => downloadPOAsPDF(item)} 
                                                className="p-1.5 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/40 rounded-lg transition-colors" 
                                                title="Download Frontend PDF"
                                            >
                                                <Download size={16} />
                                            </button>

                                            <button 
                                                onClick={() => downloadPOAsExcel(item)} 
                                                className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition-colors" 
                                                title="Download Excel"
                                            >
                                                <FileSpreadsheet size={16} />
                                            </button>

                                            {isWithin12Hours(item.createdAt || item.date) ? (
                                                <>
                                                    <button onClick={() => onEdit(item)} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Edit PO"><Edit2 size={16} /></button>
                                                    <button onClick={() => onDelete(item._id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete PO"><Trash2 size={16} /></button>
                                                </>
                                            ) : (
                                                <>
                                                    <button disabled className="p-1.5 text-gray-300 dark:text-slate-700 cursor-not-allowed rounded-lg" title="12-hour limit exceeded"><Edit2 size={16} /></button>
                                                    <button disabled className="p-1.5 text-gray-300 dark:text-slate-700 cursor-not-allowed rounded-lg" title="12-hour limit exceeded"><Trash2 size={16} /></button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Mobile View */}
            <div className="md:hidden flex flex-col gap-3">
                {data.map((item) => (
                    <div key={item._id} className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800 flex flex-col gap-3">
                        <div className="flex justify-between items-start border-b border-gray-100 dark:border-slate-800 pb-2">
                            <div>
                                <span onClick={() => setSelectedPoPreview(item)} className="text-xs font-mono font-bold text-purple-600 cursor-pointer block mb-1">PO #{item.poNumber}</span>
                                <h4 className="font-bold text-gray-900 dark:text-white">{getVendorNameStr(item)}</h4>
                            </div>
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800">{item.status || 'Released'}</span>
                        </div>

                        <div className="text-xs space-y-1.5">
                            <div className="flex justify-between"><span className="text-gray-500">Date:</span> <span>{new Date(item.date).toLocaleDateString('en-GB')}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">Total Amount:</span> <span className="font-extrabold text-purple-600">₹ {Number(item.totalAmount || item.amount || 0).toLocaleString()}</span></div>
                        </div>

                        <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-slate-800">
                            <button onClick={() => setSelectedPoPreview(item)} className="flex-1 py-1.5 text-xs font-bold bg-slate-100 text-slate-700 rounded-xl flex items-center justify-center gap-1">
                                <Eye size={14} /> View
                            </button>
                            <button onClick={() => downloadPOAsPDF(item)} className="flex-1 py-1.5 text-xs font-bold bg-purple-600 text-white rounded-xl flex items-center justify-center gap-1">
                                <Download size={14} /> PDF
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Clickable Outward PO Preview Modal */}
            {selectedPoPreview && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[85vh]">
                        
                        {/* Modal Header */}
                        <div className="p-6 bg-purple-950 text-white flex justify-between items-center flex-shrink-0 border-b border-purple-900">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-purple-900 rounded-xl flex items-center justify-center border border-purple-700">
                                    <ShoppingCart size={20} className="text-purple-300" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-mono font-extrabold tracking-tight text-purple-200">{selectedPoPreview.poNumber || 'PO Preview'}</h2>
                                    <p className="text-xs text-purple-300/80 mt-0.5">Outward Purchase Order Preview</p>
                                </div>
                            </div>
                            <button onClick={() => setSelectedPoPreview(null)} className="w-8 h-8 rounded-full bg-purple-900 hover:bg-purple-800 flex items-center justify-center text-white transition-colors">
                                <X size={18} />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 overflow-y-auto space-y-6">
                            
                            {/* Vendor & Metadata Card */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs">
                                <div>
                                    <span className="text-purple-600 font-bold uppercase block text-[10px]">TARGET VENDOR / SUPPLIER</span>
                                    <div className="text-sm font-extrabold text-slate-900 dark:text-white mt-1">{getVendorNameStr(selectedPoPreview)}</div>
                                    {getVendorAddressStr(selectedPoPreview.vendor) && <div className="text-slate-500 mt-1">{getVendorAddressStr(selectedPoPreview.vendor)}</div>}
                                    {getVendorGstStr(selectedPoPreview.vendor) && <div className="text-slate-500 mt-0.5">GSTIN: {getVendorGstStr(selectedPoPreview.vendor)}</div>}
                                </div>

                                <div className="space-y-1">
                                    <div><span className="text-slate-400">PO Date:</span> <strong className="text-slate-800 dark:text-slate-200">{new Date(selectedPoPreview.date || Date.now()).toLocaleDateString('en-GB')}</strong></div>
                                    {selectedPoPreview.quotationNumber && <div><span className="text-slate-400">Ref Quotation #:</span> <strong className="text-cyan-600 font-mono">{selectedPoPreview.quotationNumber}</strong></div>}
                                    {selectedPoPreview.rfqNumber && <div><span className="text-slate-400">Ref RFQ #:</span> <strong className="text-cyan-600 font-mono">{selectedPoPreview.rfqNumber}</strong></div>}
                                    <div><span className="text-slate-400">Status:</span> <strong className="text-emerald-600 font-bold">{selectedPoPreview.status || 'Released'}</strong></div>
                                </div>
                            </div>

                            {/* Materials Table */}
                            <div className="space-y-2">
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Purchase Order Items</h4>
                                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-purple-50 dark:bg-slate-800 font-bold text-purple-900 dark:text-purple-300 uppercase">
                                            <tr>
                                                <th className="p-3 text-center w-12">S.No</th>
                                                <th className="p-3">Material Item</th>
                                                <th className="p-3 text-center">Quantity</th>
                                                <th className="p-3 text-right">Unit Rate (₹)</th>
                                                <th className="p-3 text-right">Total Amount (₹)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                            {(Array.isArray(selectedPoPreview.items) && selectedPoPreview.items.length > 0 
                                                ? selectedPoPreview.items 
                                                : [{
                                                    materialName: getMaterialNameStr(selectedPoPreview),
                                                    quantity: selectedPoPreview.quantity || 1,
                                                    unit: selectedPoPreview.unit || 'PCS',
                                                    rate: selectedPoPreview.rate || selectedPoPreview.amount || 0,
                                                    amount: selectedPoPreview.amount || 0
                                                }]
                                            ).map((it: any, idx: number) => {
                                                const itemName = getMaterialNameStr(it);
                                                const qty = Number(it.quantity || 1);
                                                const unit = it.unit || it.uom || 'PCS';
                                                const rate = Number(it.rate || it.unitPrice || 0);
                                                const lineTotal = Number(it.amount || (qty * rate));

                                                return (
                                                    <tr key={idx}>
                                                        <td className="p-3 text-center">{idx + 1}</td>
                                                        <td className="p-3 font-bold text-slate-900 dark:text-white">{itemName}</td>
                                                        <td className="p-3 text-center font-bold text-slate-700 dark:text-slate-300">{qty} {unit}</td>
                                                        <td className="p-3 text-right font-semibold">₹{rate.toLocaleString()}</td>
                                                        <td className="p-3 text-right font-extrabold text-purple-600 font-mono">₹{lineTotal.toLocaleString()}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                        <tfoot className="bg-purple-50/50 dark:bg-slate-800 font-bold border-t border-purple-200 dark:border-slate-700">
                                            <tr>
                                                <td colSpan={4} className="p-3 text-right">Total Purchase Order Value =</td>
                                                <td className="p-3 text-right font-mono text-sm text-purple-700 dark:text-purple-300">
                                                    ₹{Number(selectedPoPreview.totalAmount || selectedPoPreview.amount || 0).toLocaleString()}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>

                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 bg-slate-50 dark:bg-slate-800 flex justify-between items-center border-t border-slate-200 dark:border-slate-700">
                            <button onClick={() => setSelectedPoPreview(null)} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl">
                                Close
                            </button>

                            <button 
                                onClick={() => downloadPOAsPDF(selectedPoPreview)} 
                                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-purple-600/20 flex items-center gap-2"
                            >
                                <Printer size={15} /> Print / Save PO PDF (Frontend)
                            </button>
                        </div>

                    </div>
                </div>
            )}

        </div>
    );
}

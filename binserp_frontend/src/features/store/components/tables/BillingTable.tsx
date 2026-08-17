import React, { useState, useMemo } from 'react';
import { Edit2, Trash2, Download, Truck, FileText, Search, User, Filter, Calendar } from 'lucide-react';
import { CompanyInfo } from "@/src/features/store/types/store.types";
import { download4CopyPDF, downloadFrontendExcel } from '@/src/utils/frontendDocumentHelper';

interface BillingTableProps {
    data: any[];
    companyInfo?: CompanyInfo;
    onEdit: (item: any) => void;
    onDelete: (id: string) => void;
}

const generateEWayBill = (invoice: any) => {
    alert(`Generating E-Way Bill for Invoice: ${invoice.invoiceNumber}`);
};

const downloadInvoiceAsPDF = (invoice: any, companyInfo?: CompanyInfo) => {
    download4CopyPDF('invoice', { doc: invoice, companyInfo });
};

const downloadSingleBillingExcel = (invoice: any, companyInfo?: CompanyInfo) => {
    const formattedData = (invoice.items || []).map((item: any) => ({
        "Invoice Number": invoice.invoiceNumber,
        "Date": new Date(invoice.date).toLocaleDateString(),
        "Customer": invoice.customerName || "-",
        "Customer PO Ref": invoice.customerPoReference || "-",
        "Product / Material": item.materialName || item.productName || "-",
        "HSN Code": item.hsnCode || "-",
        "Quantity": item.quantity || 0,
        "Unit": item.unit || "PCS",
        "Unit Rate (INR)": item.rate || 0,
        "Tax Rate %": item.taxRate || 0,
        "Tax Amount (INR)": item.taxAmount || 0,
        "Line Total (INR)": (item.amount || 0) + (item.taxAmount || 0),
        "Freight Charges (INR)": invoice.transportationCharges || 0,
        "Packaging Charges (INR)": invoice.packagingCharges || 0,
        "Grand Total (INR)": invoice.totalAmount || 0,
        "Status": invoice.status || "Issued"
    }));
    downloadFrontendExcel(`INVOICE_${invoice.invoiceNumber}`, formattedData);
};

export default function BillingTable({ data = [], companyInfo, onEdit, onDelete }: BillingTableProps) {
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedCustomerFilter, setSelectedCustomerFilter] = useState("all");
    const [selectedStatusFilter, setSelectedStatusFilter] = useState("all");

    const uniqueCustomers = useMemo(() => {
        const list: { id: string; name: string }[] = [];
        const seen = new Set();
        (data || []).forEach(item => {
            const custId = typeof item.customer === 'object' ? item.customer?._id : item.customer;
            const custName = item.customerName || item.customer?.name || item.customer?.companyName || '';
            const key = custId || custName;
            if (key && !seen.has(key)) {
                seen.add(key);
                list.push({ id: custId || custName, name: custName || 'Customer' });
            }
        });
        return list;
    }, [data]);

    const filteredData = useMemo(() => {
        return (data || []).filter((item: any) => {
            if (selectedCustomerFilter !== 'all') {
                const custId = typeof item.customer === 'object' ? item.customer?._id : item.customer;
                const custName = item.customerName || item.customer?.name || item.customer?.companyName || '';
                if (custId?.toString() !== selectedCustomerFilter && custName !== selectedCustomerFilter) {
                    return false;
                }
            }
            if (selectedStatusFilter !== 'all' && item.status !== selectedStatusFilter) {
                return false;
            }
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                const invNum = (item.invoiceNumber || '').toLowerCase();
                const custName = (item.customerName || item.customer?.name || '').toLowerCase();
                const poRef = (item.customerPoReference || '').toLowerCase();
                if (!invNum.includes(term) && !custName.includes(term) && !poRef.includes(term)) {
                    return false;
                }
            }
            return true;
        });
    }, [data, selectedCustomerFilter, selectedStatusFilter, searchTerm]);

    return (
        <div className="w-full space-y-4">
            {/* Top Control & Filter Bar */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
                {/* Search Input */}
                <div className="relative w-full md:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                    <input
                        type="text"
                        placeholder="Search Invoice No, Customer, PO Ref..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                </div>

                <div className="flex flex-wrap gap-2.5 w-full md:w-auto items-center">
                    {/* Customer Filter */}
                    <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                        <User size={14} className="text-indigo-500" />
                        <select
                            value={selectedCustomerFilter}
                            onChange={(e) => setSelectedCustomerFilter(e.target.value)}
                            className="bg-transparent font-medium text-slate-700 dark:text-slate-200 focus:outline-none"
                        >
                            <option value="all">All Customers ({uniqueCustomers.length})</option>
                            {uniqueCustomers.map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Status Filter */}
                    <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                        <Filter size={14} className="text-amber-500" />
                        <select
                            value={selectedStatusFilter}
                            onChange={(e) => setSelectedStatusFilter(e.target.value)}
                            className="bg-transparent font-medium text-slate-700 dark:text-slate-200 focus:outline-none"
                        >
                            <option value="all">All Statuses</option>
                            <option value="Draft">Draft</option>
                            <option value="Sent">Sent</option>
                            <option value="Paid">Paid</option>
                            <option value="Cancelled">Cancelled</option>
                        </select>
                    </div>
                </div>
            </div>

            {filteredData.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 dark:bg-slate-900 rounded-2xl border-2 border-dashed border-gray-300 dark:border-slate-800">
                    <p className="text-gray-500 text-lg font-medium">No Tax Invoices found</p>
                    <p className="text-gray-400 text-sm mt-1">Try adjusting your customer or status filter</p>
                </div>
            ) : (
                <>
                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-800">
                            <thead className="bg-indigo-50/70 dark:bg-slate-800/60 border-b border-indigo-100 dark:border-slate-800">
                                <tr>
                                    <th className="px-6 py-3.5 text-left font-semibold text-indigo-900 dark:text-indigo-200 text-xs tracking-wider uppercase">Invoice No</th>
                                    <th className="px-6 py-3.5 text-left font-semibold text-indigo-900 dark:text-indigo-200 text-xs tracking-wider uppercase">Date</th>
                                    <th className="px-6 py-3.5 text-left font-semibold text-indigo-900 dark:text-indigo-200 text-xs tracking-wider uppercase">Customer</th>
                                    <th className="px-6 py-3.5 text-left font-semibold text-indigo-900 dark:text-indigo-200 text-xs tracking-wider uppercase">PO Ref</th>
                                    <th className="px-6 py-3.5 text-left font-semibold text-indigo-900 dark:text-indigo-200 text-xs tracking-wider uppercase">Grand Total</th>
                                    <th className="px-6 py-3.5 text-left font-semibold text-indigo-900 dark:text-indigo-200 text-xs tracking-wider uppercase">Created By</th>
                                    <th className="px-6 py-3.5 text-left font-semibold text-indigo-900 dark:text-indigo-200 text-xs tracking-wider uppercase">Status</th>
                                    <th className="px-6 py-3.5 text-right font-semibold text-indigo-900 dark:text-indigo-200 text-xs tracking-wider uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                                {filteredData.map((item) => (
                                    <tr key={item._id} className="hover:bg-indigo-50/50 dark:hover:bg-slate-800/40 transition-colors">
                                        <td className="px-6 py-4 font-mono text-sm font-semibold text-slate-900 dark:text-white">{item.invoiceNumber}</td>
                                        <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{new Date(item.date).toLocaleDateString()}</td>
                                        <td className="px-6 py-4 text-sm font-medium text-slate-800 dark:text-slate-200">{item.customerName || "-"}</td>
                                        <td className="px-6 py-4 text-sm text-slate-500 font-mono">{item.customerPoReference || "-"}</td>
                                        <td className="px-6 py-4 text-sm font-bold text-indigo-600 dark:text-indigo-400">₹ {(item.totalAmount || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                        <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                                            <div className="flex items-center gap-1.5">
                                                <User size={13} className="text-slate-400" />
                                                <span className="font-medium text-xs text-slate-700 dark:text-slate-200">
                                                    {item.createdBy?.name || item.preparedBy?.name || item.updatedBy?.name || 'Admin User'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                                                item.status === 'Paid' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' :
                                                item.status === 'Sent' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' : 
                                                'bg-gray-100 text-gray-800 dark:bg-slate-800 dark:text-slate-300'
                                            }`}>
                                                {item.status || "Draft"}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-1.5">
                                                <button onClick={() => generateEWayBill(item)} className="p-2 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-xl transition-colors" title="Generate E-Way Bill"><Truck size={16} /></button>
                                                <button onClick={() => downloadSingleBillingExcel(item, companyInfo)} className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-xl transition-colors" title="Export Excel"><FileText size={16} /></button>
                                                <button onClick={() => downloadInvoiceAsPDF(item, companyInfo)} className="p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-xl transition-colors" title="Download 4-Copy PDF"><Download size={16} /></button>
                                                <button onClick={() => onEdit(item)} className="p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-xl transition-colors" title="Edit Invoice"><Edit2 size={16} /></button>
                                                <button onClick={() => onDelete(item._id)} className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-colors" title="Delete Invoice"><Trash2 size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden flex flex-col gap-3 p-2">
                        {filteredData.map((item) => (
                            <div key={item._id} className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col gap-3">
                                <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-800 pb-2">
                                    <div>
                                        <span className="text-xs font-mono text-slate-500 block mb-0.5">Inv #{item.invoiceNumber}</span>
                                        <h4 className="font-bold text-slate-900 dark:text-white">{item.customerName || "Customer"}</h4>
                                    </div>
                                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300">{item.status || "Draft"}</span>
                                </div>

                                <div className="text-xs space-y-1.5 text-slate-600 dark:text-slate-300">
                                    <div className="flex justify-between"><span>Date:</span> <span className="font-medium">{new Date(item.date).toLocaleDateString()}</span></div>
                                    <div className="flex justify-between"><span>Amount:</span> <span className="font-bold text-indigo-600 dark:text-indigo-400">₹ {(item.totalAmount || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span></div>
                                </div>

                                <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                                    <button onClick={() => generateEWayBill(item)} className="flex-1 py-1.5 text-amber-600 bg-amber-50 dark:bg-amber-900/30 rounded-xl text-xs font-semibold flex justify-center items-center gap-1"><Truck size={14} /> E-Way</button>
                                    <button onClick={() => downloadSingleBillingExcel(item, companyInfo)} className="flex-1 py-1.5 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl text-xs font-semibold flex justify-center items-center gap-1"><FileText size={14} /> Excel</button>
                                    <button onClick={() => downloadInvoiceAsPDF(item, companyInfo)} className="flex-1 py-1.5 text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl text-xs font-semibold flex justify-center items-center gap-1"><Download size={14} /> 4-Copy PDF</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

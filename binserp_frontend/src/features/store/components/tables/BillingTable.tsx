import React, { useState, useMemo } from 'react';
import { Edit2, Trash2, Download, Truck, FileText, Search, User, Calendar, X, Eye } from 'lucide-react';
import { CompanyInfo } from "@/src/features/store/types/store.types";
import { download4CopyPDF, downloadFrontendExcel, downloadInvoiceExcelDocument } from '@/src/utils/frontendDocumentHelper';
import InvoicePreviewModal from '../modals/InvoicePreviewModal';

interface BillingTableProps {
    data: any[];
    companyInfo?: CompanyInfo;
    onEdit: (item: any) => void;
    onDelete: (id: string) => void;
}

const generateEWayBill = (invoice: any) => {
    alert(`Generating E-Way Bill for Invoice: ${invoice.invoiceNumber}`);
};

const formatDateTime = (dateStr?: string | Date) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleString('en-IN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
};

const getCurrentMonth = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
};

export default function BillingTable({ data = [], companyInfo, onEdit, onDelete }: BillingTableProps) {
    const currentMonthStr = useMemo(() => getCurrentMonth(), []);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedCustomerFilter, setSelectedCustomerFilter] = useState("all");
    const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth);
    const [selectedDay, setSelectedDay] = useState("");
    const [selectedInvoicePreview, setSelectedInvoicePreview] = useState<any | null>(null);

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
            if (!item) return false;

            if (selectedCustomerFilter !== 'all') {
                const custId = typeof item.customer === 'object' ? item.customer?._id : item.customer;
                const custName = item.customerName || item.customer?.name || item.customer?.companyName || '';
                if (custId?.toString() !== selectedCustomerFilter && custName !== selectedCustomerFilter) {
                    return false;
                }
            }

            const rawDate = item.createdAt || item.date;
            if (rawDate) {
                const d = new Date(rawDate);
                if (!isNaN(d.getTime())) {
                    if (selectedMonth) {
                        const itemMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                        if (itemMonth !== selectedMonth) {
                            return false;
                        }
                    }

                    if (selectedDay) {
                        const itemDay = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                        if (itemDay !== selectedDay) {
                            return false;
                        }
                    }
                }
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
    }, [data, selectedCustomerFilter, selectedMonth, selectedDay, searchTerm]);

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

                    {/* Month Picker Filter */}
                    <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                        <Calendar size={14} className="text-blue-500" />
                        <span className="font-semibold text-slate-500">Month:</span>
                        <input
                            type="month"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="bg-transparent font-medium text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
                        />
                        {selectedMonth && (
                            <button
                                onClick={() => setSelectedMonth("")}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 ml-1"
                                title="Clear Month Filter"
                            >
                                <X size={13} />
                            </button>
                        )}
                        {selectedMonth !== currentMonthStr && (
                            <button
                                onClick={() => setSelectedMonth(currentMonthStr)}
                                className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/40 px-1.5 py-0.5 rounded ml-1"
                                title="Set to Current Month"
                            >
                                This Month
                            </button>
                        )}
                    </div>

                    {/* Specific Day Filter */}
                    <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                        <Calendar size={14} className="text-purple-500" />
                        <span className="font-semibold text-slate-500">Day:</span>
                        <input
                            type="date"
                            value={selectedDay}
                            onChange={(e) => setSelectedDay(e.target.value)}
                            className="bg-transparent font-medium text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
                        />
                        {selectedDay && (
                            <button
                                onClick={() => setSelectedDay("")}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 ml-1"
                                title="Clear Day Filter"
                            >
                                <X size={13} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {filteredData.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 dark:bg-slate-900 rounded-2xl border-2 border-dashed border-gray-300 dark:border-slate-800">
                    <p className="text-gray-500 text-lg font-medium">No Tax Invoices found</p>
                    <p className="text-gray-400 text-sm mt-1">Try adjusting your filters or date range</p>
                </div>
            ) : (
                <>
                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-800">
                            <thead className="bg-indigo-50/70 dark:bg-slate-800/60 border-b border-indigo-100 dark:border-slate-800">
                                <tr>
                                    <th className="px-6 py-3.5 text-left font-semibold text-indigo-900 dark:text-indigo-200 text-xs tracking-wider uppercase">S.No</th>
                                    <th className="px-6 py-3.5 text-left font-semibold text-indigo-900 dark:text-indigo-200 text-xs tracking-wider uppercase">Invoice Number</th>
                                    <th className="px-6 py-3.5 text-left font-semibold text-indigo-900 dark:text-indigo-200 text-xs tracking-wider uppercase">PO / DC Ref</th>
                                    <th className="px-6 py-3.5 text-left font-semibold text-indigo-900 dark:text-indigo-200 text-xs tracking-wider uppercase">Customer Name</th>
                                    <th className="px-6 py-3.5 text-left font-semibold text-indigo-900 dark:text-indigo-200 text-xs tracking-wider uppercase">Items</th>
                                    <th className="px-6 py-3.5 text-left font-semibold text-indigo-900 dark:text-indigo-200 text-xs tracking-wider uppercase">Created By</th>
                                    <th className="px-6 py-3.5 text-left font-semibold text-indigo-900 dark:text-indigo-200 text-xs tracking-wider uppercase">Creation Date & Time</th>
                                    <th className="px-6 py-3.5 text-right font-semibold text-indigo-900 dark:text-indigo-200 text-xs tracking-wider uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                                {filteredData.map((item, idx) => (
                                    <tr key={item._id} className="hover:bg-indigo-50/50 dark:hover:bg-slate-800/40 transition-colors">
                                        <td className="px-6 py-4 text-sm font-medium text-slate-500">{idx + 1}</td>
                                        <td className="px-6 py-4 font-mono text-sm font-extrabold text-indigo-600 dark:text-indigo-400">
                                            <span 
                                                onClick={() => setSelectedInvoicePreview(item)} 
                                                className="cursor-pointer hover:underline flex items-center gap-1.5"
                                            >
                                                {item.invoiceNumber || `INV-00${idx + 1}`}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm font-mono text-slate-600 dark:text-slate-300 font-semibold">
                                            {item.customerPoReference || item.dcNumber || "-"}
                                        </td>
                                        <td className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-white">
                                            {item.customerName || item.customer?.name || item.customer?.companyName || "-"}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                                            <div className="max-w-[200px] truncate" title={(item.items || []).map((i: any) => i.materialName || i.productName || i.itemName).join(', ')}>
                                                <span className="font-semibold text-slate-900 dark:text-white">
                                                    {item.items?.[0]?.materialName || item.items?.[0]?.productName || item.items?.[0]?.itemName || 'Item'}
                                                </span>
                                                {item.items?.length > 1 && (
                                                    <span className="text-xs text-indigo-600 dark:text-indigo-400 font-bold ml-1">
                                                        (+{item.items.length - 1} more)
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                                            <div className="flex items-center gap-1.5">
                                                <User size={13} className="text-slate-400" />
                                                <span className="font-medium text-xs text-slate-700 dark:text-slate-200">
                                                    {item.createdBy?.name || item.preparedBy?.name || item.updatedBy?.name || 'Admin User'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300 font-medium whitespace-nowrap">
                                            {formatDateTime(item.createdAt || item.date)}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button 
                                                    onClick={() => setSelectedInvoicePreview(item)} 
                                                    className="px-3.5 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-600 text-indigo-600 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-indigo-200 dark:border-indigo-800 shadow-sm" 
                                                    title="Preview Invoice (PDF, Excel, Edit, Delete)"
                                                >
                                                    <Eye size={15} /> Preview
                                                </button>
                                                <button 
                                                    onClick={() => generateEWayBill(item)} 
                                                    className="px-3 py-1.5 bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-600 text-amber-600 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-amber-200 dark:border-amber-800 shadow-sm" 
                                                    title="Generate E-Way Bill"
                                                >
                                                    <Truck size={15} /> E-Way
                                                </button>
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
                                        <span onClick={() => setSelectedInvoicePreview(item)} className="text-xs font-mono text-indigo-600 dark:text-indigo-400 font-bold block mb-0.5 cursor-pointer">INV #{item.invoiceNumber}</span>
                                        <h4 className="font-bold text-slate-900 dark:text-white">{item.customerName || "Customer"}</h4>
                                    </div>
                                </div>

                                <div className="text-xs space-y-1.5 text-slate-600 dark:text-slate-300">
                                    <div className="flex justify-between">
                                        <span>Creation Date & Time:</span> 
                                        <span className="font-medium">{formatDateTime(item.createdAt || item.date)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Items:</span> 
                                        <span>{item.items?.[0]?.materialName || '-'}{item.items?.length > 1 && ` (+${item.items.length - 1} more)`}</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                                    <button onClick={() => setSelectedInvoicePreview(item)} className="flex-1 py-2 text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl text-xs font-bold flex justify-center items-center gap-1.5 border border-indigo-200 dark:border-indigo-800"><Eye size={15} /> Preview</button>
                                    <button onClick={() => generateEWayBill(item)} className="flex-1 py-2 text-amber-600 bg-amber-50 dark:bg-amber-900/30 rounded-xl text-xs font-bold flex justify-center items-center gap-1.5 border border-amber-200 dark:border-amber-800"><Truck size={15} /> E-Way</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* Invoice Preview & PDF Copy Types Modal */}
            {selectedInvoicePreview && (
                <InvoicePreviewModal
                    isOpen={!!selectedInvoicePreview}
                    onClose={() => setSelectedInvoicePreview(null)}
                    invoice={selectedInvoicePreview}
                    companyInfo={companyInfo}
                    onEdit={onEdit}
                    onDelete={onDelete}
                />
            )}
        </div>
    );
}

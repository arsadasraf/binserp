/**
 * QuotationTable Component
 * Displays Outward Quotations history with search & month filter
 */

import React, { useState, useMemo } from 'react';
import { Edit2, Trash2, Download, Search, Plus, FileText, Eye } from 'lucide-react';
import { CompanyInfo } from "@/src/features/store/types/store.types";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { getCurrencySymbol } from "@/src/utils/currencyHelper";

interface QuotationTableProps {
    data: any[];
    companyInfo?: CompanyInfo;
    onCreate?: () => void;
    onEdit: (item: any) => void;
    onDelete: (id: string) => void;
    onView?: (item: any) => void;
}

export default function QuotationTable({ data = [], companyInfo, onCreate, onEdit, onDelete, onView }: QuotationTableProps) {
    const [selectedMonth, setSelectedMonth] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState<string>('');

    // Filter by month & search term
    const filteredData = useMemo(() => {
        return (data || []).filter(item => {
            if (!item) return false;
            const matchesSearch = 
                (item.quotationNumber?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                (item.customerName?.toLowerCase() || '').includes(searchTerm.toLowerCase());
            
            if (!selectedMonth) return matchesSearch;
            const date = new Date(item.date);
            const itemMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            return matchesSearch && itemMonth === selectedMonth;
        });
    }, [data, selectedMonth, searchTerm]);

    const handleDownloadPDFClientSide = (quotation: any) => {
        try {
            const doc = new jsPDF();

            const info = companyInfo as any;
            const compName = info?.companyName || info?.name || "COMPANY MASTER";
            const compAddress = info?.address || info?.location || "";
            const compEmail = info?.email || "";
            const compPhone = info?.phone || info?.contactNumber || "";
            const compGst = info?.gstin || info?.gstNumber || info?.gst || "";

            // Top Clean Header (Monochrome Dark Slate Text)
            doc.setTextColor(15, 23, 42);
            doc.setFontSize(16);
            doc.setFont("helvetica", "bold");
            doc.text(compName.toUpperCase(), 14, 16);

            doc.setFontSize(8);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(71, 85, 105);
            const compHeaderSub = [compAddress, compPhone && `Ph: ${compPhone}`, compEmail && `Email: ${compEmail}`, compGst && `GSTIN: ${compGst}`].filter(Boolean).join(" | ");
            doc.text(compHeaderSub.substring(0, 110), 14, 22);

            doc.setFontSize(14);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(15, 23, 42);
            doc.text("OUTWARD QUOTATION", 196, 16, { align: "right" });

            // Fine Divider Line
            doc.setDrawColor(226, 232, 240);
            doc.setLineWidth(0.5);
            doc.line(14, 26, 196, 26);

            // Metadata & Customer Section
            doc.setFontSize(8);
            doc.setTextColor(71, 85, 105);
            doc.setFont("helvetica", "bold");
            doc.text("QUOTATION DETAILS", 14, 33);
            doc.text("BILLED TO / CUSTOMER", 110, 33);

            doc.setFont("helvetica", "normal");
            doc.setTextColor(15, 23, 42);
            doc.text(`Quotation No: ${quotation.quotationNumber || 'N/A'}`, 14, 39);
            doc.text(`Date: ${quotation.date ? new Date(quotation.date).toLocaleDateString() : ''}`, 14, 44);
            doc.text(`Status: ${quotation.status || 'Draft'}`, 14, 49);

            doc.setFont("helvetica", "bold");
            doc.text(quotation.customerName || 'N/A', 110, 39);

            doc.setFont("helvetica", "normal");
            let custLineY = 44;
            if (quotation.customerAddress) {
                const splitAddr = doc.splitTextToSize(quotation.customerAddress, 85);
                doc.text(splitAddr, 110, custLineY);
                custLineY += (splitAddr.length * 4);
            }
            const custContact = [quotation.customerEmail, quotation.customerPhone].filter(Boolean).join(" | ");
            if (custContact) {
                doc.text(custContact, 110, Math.min(custLineY, 52));
            }

            const currSym = getCurrencySymbol(quotation.currency);
            const tableStartY = Math.max(56, custLineY + 4);

            // Table Columns: SI.No, Product & Description, Qty, Unit, Rate, Tax Rate, Total Price
            const tableData = (quotation.items || []).map((item: any, idx: number) => {
                const prodName = item.productName || "Product";
                const specText = item.description ? `\n${item.description}` : "";
                return [
                    idx + 1,
                    `${prodName}${specText}`,
                    item.quantity || 0,
                    item.unit || "PCS",
                    `${currSym}${Number(item.rate || 0).toFixed(2)}`,
                    `${item.taxRate || 0}%`,
                    `${currSym}${Number(item.amount || (item.quantity * item.rate) || 0).toFixed(2)}`
                ];
            });

            autoTable(doc, {
                startY: tableStartY,
                head: [["SI.No", "Product & Description", "Qty", "Unit", `Rate (${currSym})`, "Tax %", `Total Price (${currSym})`]],
                body: tableData,
                headStyles: {
                    fillColor: [241, 245, 249],
                    textColor: [15, 23, 42],
                    fontStyle: "bold",
                    fontSize: 8.5,
                    lineColor: [226, 232, 240],
                    lineWidth: 0.2
                },
                styles: {
                    fontSize: 8,
                    cellPadding: 3.5,
                    textColor: [30, 41, 59],
                    lineColor: [226, 232, 240],
                    lineWidth: 0.1
                },
                columnStyles: {
                    0: { cellWidth: 14, halign: 'center' },
                    1: { cellWidth: 76 },
                    2: { cellWidth: 16, halign: 'right' },
                    3: { cellWidth: 16, halign: 'center' },
                    4: { cellWidth: 22, halign: 'right' },
                    5: { cellWidth: 18, halign: 'right' },
                    6: { cellWidth: 20, halign: 'right' },
                },
                alternateRowStyles: { fillColor: [250, 250, 250] },
            });

            const finalY = (doc as any).lastAutoTable?.finalY || 120;

            // Clean Modern Calculation Summary
            doc.setDrawColor(226, 232, 240);
            doc.setFillColor(250, 250, 250);
            doc.roundedRect(114, finalY + 6, 82, 44, 1.5, 1.5, "FD");

            doc.setFontSize(8);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(71, 85, 105);

            doc.text("Items Subtotal:", 118, finalY + 13);
            doc.text(`${currSym}${Number(quotation.subtotal || 0).toFixed(2)}`, 190, finalY + 13, { align: "right" });

            doc.text(`Transport (${quotation.transportationType || 'Included'}):`, 118, finalY + 19);
            doc.text(`+ ${currSym}${Number(quotation.transportationCharges || 0).toFixed(2)}`, 190, finalY + 19, { align: "right" });

            doc.text(`Packaging (${quotation.packagingType || 'Standard'}):`, 118, finalY + 25);
            doc.text(`+ ${currSym}${Number(quotation.packagingCharges || 0).toFixed(2)}`, 190, finalY + 25, { align: "right" });

            doc.text("Total Tax (GST):", 118, finalY + 31);
            doc.text(`+ ${currSym}${Number(quotation.taxAmount || 0).toFixed(2)}`, 190, finalY + 31, { align: "right" });

            if (Number(quotation.discount || 0) > 0) {
                doc.text("Discount:", 118, finalY + 36);
                doc.text(`- ${currSym}${Number(quotation.discount || 0).toFixed(2)}`, 190, finalY + 36, { align: "right" });
            }

            doc.setFontSize(9.5);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(15, 23, 42);
            doc.text(`Total Price (${quotation.currency || 'INR'}):`, 118, finalY + 44);
            doc.text(`${currSym}${Number(quotation.totalAmount || 0).toFixed(2)}`, 190, finalY + 44, { align: "right" });

            // Remarks / Terms Section
            if (quotation.remarks) {
                doc.setFontSize(8);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(15, 23, 42);
                doc.text("REMARKS / TERMS & CONDITIONS", 14, finalY + 13);

                doc.setFont("helvetica", "normal");
                doc.setTextColor(71, 85, 105);
                const splitRemarks = doc.splitTextToSize(quotation.remarks, 90);
                doc.text(splitRemarks, 14, finalY + 19);
            }

            doc.save(`Outward_Quotation_${quotation.quotationNumber || Date.now()}.pdf`);
        } catch (err) {
            console.error("PDF generation error", err);
        }
    };

    return (
        <div className="bg-white dark:bg-gray-900 shadow-sm border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
            {/* Header with Search & Filter */}
            <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-indigo-500" />
                    Outward Quotations
                </h2>

                <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap">
                    <div className="w-full sm:w-56 relative">
                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Search Quotations..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                    </div>

                    <input 
                        type="month" 
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    {selectedMonth && (
                        <button onClick={() => setSelectedMonth('')} className="text-xs text-red-500 font-medium hover:underline">
                            Clear
                        </button>
                    )}

                    {onCreate && (
                        <button
                            onClick={onCreate}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors shadow-sm ml-auto sm:ml-0"
                        >
                            <Plus size={16} />
                            Create Quotation
                        </button>
                    )}
                </div>
            </div>

            {/* Desktop Table View */}
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800 text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400">
                        <tr>
                            <th className="px-6 py-3 text-left font-semibold">Quotation No</th>
                            <th className="px-6 py-3 text-left font-semibold">Date</th>
                            <th className="px-6 py-3 text-left font-semibold">Customer</th>
                            <th className="px-6 py-3 text-left font-semibold">Transport / Packing</th>
                            <th className="px-6 py-3 text-right font-semibold">Total Amount</th>
                            <th className="px-6 py-3 text-center font-semibold">Status</th>
                            <th className="px-6 py-3 text-right font-semibold">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-800 bg-white dark:bg-gray-900">
                        {filteredData.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                                    <FileText className="w-10 h-10 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                                    No Outward Quotations found.
                                </td>
                            </tr>
                        ) : (
                            filteredData.map((item) => (
                                <tr
                                    key={item._id}
                                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer group"
                                    onClick={() => onView ? onView(item) : onEdit(item)}
                                >
                                    <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">{item.quotationNumber}</td>
                                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{new Date(item.date).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{item.customerName}</td>
                                    <td className="px-6 py-4 text-xs text-gray-500">
                                        <div>{item.transportationType || 'Included'} {item.transportationCharges ? `(${getCurrencySymbol(item.currency)}${item.transportationCharges})` : ''}</div>
                                        <div>{item.packagingType || 'Standard'} {item.packagingCharges ? `(${getCurrencySymbol(item.currency)}${item.packagingCharges})` : ''}</div>
                                    </td>
                                    <td className="px-6 py-4 text-right font-bold text-indigo-600 dark:text-indigo-400">
                                        {getCurrencySymbol(item.currency)} {Number(item.totalAmount || 0).toFixed(2)}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                            item.status === 'Accepted' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                            item.status === 'Sent' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' : 
                                            item.status === 'Rejected' ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400' :
                                            'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                                        }`}>
                                            {item.status || 'Draft'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                                            <button
                                                onClick={() => handleDownloadPDFClientSide(item)}
                                                className="p-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 rounded-lg transition-colors"
                                                title="Download PDF"
                                            >
                                                <Download size={16} />
                                            </button>
                                            <button
                                                onClick={() => onEdit(item)}
                                                className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/40 rounded-lg transition-colors"
                                                title="Edit"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                onClick={() => onDelete(item._id)}
                                                className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/40 rounded-lg transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 size={16} />
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
    );
}

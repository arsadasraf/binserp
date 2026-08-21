import React, { useState } from 'react';
import { X, Calendar, User, Truck, Package, Layers, FileText, Download, Edit2, Trash2, CheckCircle2, Building2, Eye, Printer, MapPin, Hash, Sparkles } from 'lucide-react';
import { CompanyInfo } from "@/src/features/store/types/store.types";
import { download4CopyPDF, downloadInvoiceExcelDocument } from '@/src/utils/frontendDocumentHelper';

interface InvoicePreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    invoice: any | null;
    companyInfo?: CompanyInfo;
    onEdit?: (invoice: any) => void;
    onDelete?: (id: string) => void;
}

function numberToWords(num: number): string {
    if (!num || isNaN(num) || num <= 0) return "Zero Rupees Only";
    const a = [
        "", "One ", "Two ", "Three ", "Four ", "Five ", "Six ", "Seven ", "Eight ", "Nine ", "Ten ",
        "Eleven ", "Twelve ", "Thirteen ", "Fourteen ", "Fifteen ", "Sixteen ", "Seventeen ", "Eighteen ", "Nineteen "
    ];
    const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

    function inWords(n: number): string {
        if (n < 20) return a[n];
        if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? " " + a[n % 10] : " ");
        if (n < 1000) return a[Math.floor(n / 100)] + "Hundred " + (n % 100 ? inWords(n % 100) : "");
        if (n < 100000) return inWords(Math.floor(n / 1000)) + "Thousand " + (n % 1000 ? inWords(n % 1000) : "");
        if (n < 10000000) return inWords(Math.floor(n / 100000)) + "Lakh " + (n % 100000 ? inWords(n % 100000) : "");
        return inWords(Math.floor(n / 10000000)) + "Crore " + (n % 10000000 ? inWords(n % 10000000) : "");
    }

    const integerPart = Math.floor(num);
    const decimalPart = Math.round((num - integerPart) * 100);

    let str = "Rupees " + inWords(integerPart).trim();
    if (decimalPart > 0) {
        str += " and " + inWords(decimalPart).trim() + " Paise";
    }
    return str + " Only";
}

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

export default function InvoicePreviewModal({
    isOpen,
    onClose,
    invoice,
    companyInfo,
    onEdit,
    onDelete
}: InvoicePreviewModalProps) {
    const [selectedCopyType, setSelectedCopyType] = useState<"all" | "original" | "duplicate" | "triplicate">("all");

    if (!isOpen || !invoice) return null;

    // Master company details resolution
    const compName = companyInfo?.companyName || companyInfo?.name || "COMPANY MASTER";
    const compAddress = companyInfo?.billingAddress || companyInfo?.address || companyInfo?.location || "";
    const compGst = companyInfo?.gstin || companyInfo?.gstNumber || companyInfo?.gst || "N/A";

    // Customer details resolution
    const custObj = typeof invoice.customer === 'object' ? invoice.customer : {};
    const custName = invoice.customerName || custObj?.name || custObj?.companyName || "Internal / Cash Customer";
    const custAddress = invoice.customerAddress || custObj?.address || custObj?.billingAddress || custObj?.shippingAddress || "-";
    const custGst = invoice.customerGST || custObj?.gstin || custObj?.gstNumber || custObj?.gst || "-";
    const custPoRef = invoice.customerPoReference || invoice.poNumber || "-";

    // Calculations
    const items = invoice.items || [];
    const subtotal = invoice.subtotal || items.reduce((acc: number, i: any) => acc + (Number(i.quantity || 0) * Number(i.rate || 0)), 0);
    const transportCharges = Number(invoice.transportationCharges || invoice.freightCharges || 0);
    const packagingCharges = Number(invoice.packagingCharges || 0);
    const taxAmount = invoice.taxAmount || items.reduce((acc: number, i: any) => acc + ((Number(i.quantity || 0) * Number(i.rate || 0)) * (Number(i.taxRate || 0) / 100)), 0);
    const discount = Number(invoice.discount || 0);
    const grandTotal = invoice.totalAmount || (subtotal + taxAmount + transportCharges + packagingCharges - discount);

    const handleDownloadPDF = () => {
        download4CopyPDF("invoice", { doc: invoice, companyInfo, copyType: selectedCopyType });
    };

    const handleDownloadExcel = () => {
        downloadInvoiceExcelDocument(invoice, companyInfo);
    };

    const copyBadgeLabel = {
        all: "Full 3-Copy PDF (Original + Duplicate + Triplicate)",
        original: "ORIGINAL FOR RECIPIENT",
        duplicate: "DUPLICATE FOR TRANSPORTER",
        triplicate: "TRIPLICATE FOR SUPPLIER"
    }[selectedCopyType];

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-5xl my-auto overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh]">
                
                {/* Header Bar */}
                <div className="p-5 sm:p-6 bg-slate-900 text-white flex justify-between items-center flex-shrink-0 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 bg-indigo-600/20 rounded-2xl flex items-center justify-center border border-indigo-500/30">
                            <FileText className="text-indigo-400 w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="font-extrabold text-base sm:text-lg tracking-tight text-white">
                                    TAX INVOICE #{invoice.invoiceNumber || 'INV-001'}
                                </h3>
                                <span className="bg-indigo-500/20 text-indigo-300 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-indigo-500/30 uppercase tracking-wide">
                                    Preview Mode
                                </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
                                <span>Creation: {formatDateTime(invoice.createdAt || invoice.date)}</span>
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 transition-all flex items-center justify-center text-slate-300 hover:text-white border border-slate-700"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Main Body */}
                <div className="p-5 sm:p-7 overflow-y-auto flex-1 space-y-6">

                    {/* PDF Copy Type Selection Bar */}
                    <div className="bg-slate-50 dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2.5">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                                <Sparkles size={14} className="text-amber-500" /> Choose PDF Copy & Preview Type:
                            </span>
                            <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-0.5 rounded-lg border border-indigo-200 dark:border-indigo-800">
                                {copyBadgeLabel}
                            </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <button
                                onClick={() => setSelectedCopyType("all")}
                                className={`px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-center border ${
                                    selectedCopyType === "all"
                                        ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20"
                                        : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                                }`}
                            >
                                🌟 All 3 Copies PDF
                            </button>
                            <button
                                onClick={() => setSelectedCopyType("original")}
                                className={`px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-center border ${
                                    selectedCopyType === "original"
                                        ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20"
                                        : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                                }`}
                            >
                                📄 Original (Recipient)
                            </button>
                            <button
                                onClick={() => setSelectedCopyType("duplicate")}
                                className={`px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-center border ${
                                    selectedCopyType === "duplicate"
                                        ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20"
                                        : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                                }`}
                            >
                                🚚 Duplicate (Transporter)
                            </button>
                            <button
                                onClick={() => setSelectedCopyType("triplicate")}
                                className={`px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-center border ${
                                    selectedCopyType === "triplicate"
                                        ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20"
                                        : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                                }`}
                            >
                                🏢 Triplicate (Supplier)
                            </button>
                        </div>
                    </div>

                    {/* Live Visual Document Mockup */}
                    <div className="bg-white dark:bg-slate-950 p-6 sm:p-8 rounded-2xl border border-slate-300 dark:border-slate-800 shadow-xl space-y-6 text-slate-800 dark:text-slate-200">
                        
                        {/* Company Header Banner */}
                        <div className="flex flex-col sm:flex-row justify-between items-start border-b-2 border-indigo-600 pb-4 gap-4">
                            <div>
                                <h1 className="text-xl sm:text-2xl font-black uppercase text-indigo-900 dark:text-indigo-300 tracking-tight">
                                    {compName}
                                </h1>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-lg leading-relaxed">
                                    {compAddress}
                                </p>
                                <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-1">
                                    GSTIN: <span className="font-mono text-indigo-600 dark:text-indigo-400">{compGst}</span>
                                </p>
                            </div>

                            <div className="sm:text-right">
                                <span className="inline-block bg-indigo-900 text-white text-[10px] font-black px-3 py-1 rounded-md uppercase tracking-wider">
                                    {selectedCopyType === "all" ? "ORIGINAL FOR RECIPIENT" : copyBadgeLabel}
                                </span>
                            </div>
                        </div>

                        {/* Title Bar */}
                        <div className="bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-900 text-center py-2 rounded-xl">
                            <h2 className="text-sm font-black text-indigo-900 dark:text-indigo-300 uppercase tracking-widest">
                                TAX INVOICE
                            </h2>
                        </div>

                        {/* Customer & Document Info Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            
                            {/* Buyer Box */}
                            <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs">
                                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block mb-1">
                                    BUYER / CONSIGNEE DETAILS
                                </span>
                                <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                                    {custName}
                                </h4>
                                <p className="text-slate-600 dark:text-slate-400">
                                    <b>Address:</b> {custAddress}
                                </p>
                                <p className="text-slate-600 dark:text-slate-400">
                                    <b>GSTIN:</b> <span className="font-mono">{custGst}</span>
                                </p>
                                {custPoRef !== '-' && (
                                    <p className="text-indigo-600 dark:text-indigo-400 font-medium">
                                        <b>PO Reference:</b> {custPoRef}
                                    </p>
                                )}
                            </div>

                            {/* Logistics Box */}
                            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs">
                                <div className="flex justify-between py-0.5 border-b border-slate-100 dark:border-slate-800">
                                    <span className="text-slate-500">Invoice Number:</span>
                                    <span className="font-mono font-extrabold text-indigo-600 dark:text-indigo-400 text-sm">{invoice.invoiceNumber || 'INV-001'}</span>
                                </div>
                                <div className="flex justify-between py-0.5 border-b border-slate-100 dark:border-slate-800">
                                    <span className="text-slate-500">Creation Date & Time:</span>
                                    <span className="font-semibold">{formatDateTime(invoice.createdAt || invoice.date)}</span>
                                </div>
                                <div className="flex justify-between py-0.5 border-b border-slate-100 dark:border-slate-800">
                                    <span className="text-slate-500">Transport Mode:</span>
                                    <span className="font-semibold">{invoice.transportationType || invoice.transportMode || 'Road Transport'}</span>
                                </div>
                                <div className="flex justify-between py-0.5">
                                    <span className="text-slate-500">Vehicle Number:</span>
                                    <span className="font-mono font-bold">{invoice.vehicleNumber || invoice.vehicleNo || '-'}</span>
                                </div>
                            </div>

                        </div>

                        {/* Line Items Table */}
                        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-indigo-50 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-300 font-extrabold uppercase text-[10px] border-b border-indigo-200 dark:border-indigo-900">
                                    <tr>
                                        <th className="p-2.5 text-center w-10">S.No</th>
                                        <th className="p-2.5">Product / Item Description</th>
                                        <th className="p-2.5 text-center">HSN</th>
                                        <th className="p-2.5 text-center">Qty</th>
                                        <th className="p-2.5 text-right">Unit Rate</th>
                                        <th className="p-2.5 text-center">GST %</th>
                                        <th className="p-2.5 text-right">Total Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {items.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="p-4 text-center text-slate-400 italic">No line items specified</td>
                                        </tr>
                                    ) : (
                                        items.map((item: any, idx: number) => {
                                            const qty = Number(item.quantity || item.qty || 0);
                                            const rate = Number(item.rate || item.unitPrice || 0);
                                            const lineAmt = (item.amount || (qty * rate));
                                            const taxRate = Number(item.taxRate || 0);
                                            const totalLine = lineAmt + (lineAmt * (taxRate / 100));

                                            return (
                                                <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                                                    <td className="p-2.5 text-center text-slate-400">{idx + 1}</td>
                                                    <td className="p-2.5 font-bold text-slate-900 dark:text-white">
                                                        {item.materialName || item.productName || item.itemName || 'Item'}
                                                    </td>
                                                    <td className="p-2.5 text-center font-mono text-slate-500">{item.hsnCode || item.hsn || '-'}</td>
                                                    <td className="p-2.5 text-center font-bold text-indigo-600 dark:text-indigo-400">{qty} {item.unit || 'PCS'}</td>
                                                    <td className="p-2.5 text-right font-mono">₹{rate.toFixed(2)}</td>
                                                    <td className="p-2.5 text-center">{taxRate > 0 ? `${taxRate}%` : '-'}</td>
                                                    <td className="p-2.5 text-right font-bold font-mono text-slate-900 dark:text-white">₹{totalLine.toFixed(2)}</td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Summary & Amount in Words Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                            
                            {/* Bank Details */}
                            <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                                    BANK DETAILS & REMARKS
                                </span>
                                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                                    Bank: <b>{(companyInfo as any)?.bankName || companyInfo?.bankDetails?.bankName || '-'}</b> | 
                                    A/c: <b>{(companyInfo as any)?.accountNumber || companyInfo?.bankDetails?.accountNumber || '-'}</b> | 
                                    IFSC: <b>{(companyInfo as any)?.ifscCode || companyInfo?.bankDetails?.ifscCode || '-'}</b>
                                </p>
                                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 font-semibold italic text-indigo-900 dark:text-indigo-300">
                                    Amount in Words: {numberToWords(grandTotal)}
                                </div>
                            </div>

                            {/* Totals Table */}
                            <div className="bg-slate-50 dark:bg-slate-900/80 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs">
                                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                    <span>Subtotal:</span>
                                    <span className="font-mono font-bold">₹{subtotal.toFixed(2)}</span>
                                </div>
                                {transportCharges > 0 && (
                                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                        <span>Freight Charges:</span>
                                        <span className="font-mono">+ ₹{transportCharges.toFixed(2)}</span>
                                    </div>
                                )}
                                {packagingCharges > 0 && (
                                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                        <span>Packaging Charges:</span>
                                        <span className="font-mono">+ ₹{packagingCharges.toFixed(2)}</span>
                                    </div>
                                )}
                                {taxAmount > 0 && (
                                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                        <span>Tax Amount (GST):</span>
                                        <span className="font-mono">+ ₹{taxAmount.toFixed(2)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between pt-2 border-t-2 border-indigo-600 text-indigo-900 dark:text-indigo-300 font-black text-sm">
                                    <span>GRAND TOTAL:</span>
                                    <span className="font-mono">₹{grandTotal.toFixed(2)}</span>
                                </div>
                            </div>

                        </div>

                    </div>

                </div>

                {/* Footer Controls */}
                <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-900 flex flex-wrap justify-between items-center gap-3 border-t border-slate-200 dark:border-slate-800 flex-shrink-0">
                    <div className="flex flex-wrap gap-2.5">
                        <button
                            onClick={handleDownloadPDF}
                            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/20 transition-all flex items-center gap-2"
                        >
                            <Download size={16} /> Download {copyBadgeLabel.split("(")[0].trim()} PDF
                        </button>
                        <button
                            onClick={handleDownloadExcel}
                            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 transition-all flex items-center gap-2"
                        >
                            <FileText size={16} /> Export Excel
                        </button>
                        {onEdit && (
                            <button
                                onClick={() => { onClose(); onEdit(invoice); }}
                                className="px-4 py-2.5 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-600 text-indigo-600 hover:text-white dark:text-indigo-400 font-bold text-xs rounded-xl border border-indigo-200 dark:border-indigo-800 transition-all flex items-center gap-2"
                            >
                                <Edit2 size={16} /> Edit Invoice
                            </button>
                        )}
                        {onDelete && (
                            <button
                                onClick={() => {
                                    if (confirm(`Are you sure you want to delete Tax Invoice ${invoice.invoiceNumber || ''}?`)) {
                                        onClose();
                                        onDelete(invoice._id || invoice.id);
                                    }
                                }}
                                className="px-4 py-2.5 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-600 text-rose-600 hover:text-white dark:text-rose-400 font-bold text-xs rounded-xl border border-rose-200 dark:border-rose-800 transition-all flex items-center gap-2"
                            >
                                <Trash2 size={16} /> Delete Invoice
                            </button>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition-colors"
                    >
                        Close
                    </button>
                </div>

            </div>
        </div>
    );
}

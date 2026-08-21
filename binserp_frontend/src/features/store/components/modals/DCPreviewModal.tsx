import React, { useState } from 'react';
import { X, Calendar, User, Truck, Package, Layers, FileText, Download, Edit2, Trash2, CheckCircle2, Building2, Eye, Printer, MapPin, Hash, Sparkles } from 'lucide-react';
import { CompanyInfo } from "@/src/features/store/types/store.types";
import { download4CopyPDF, downloadFrontendExcel, downloadDCExcelDocument } from '@/src/utils/frontendDocumentHelper';

interface DCPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    dc: any | null;
    companyInfo?: CompanyInfo;
    onEdit?: (dc: any) => void;
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

export default function DCPreviewModal({
    isOpen,
    onClose,
    dc,
    companyInfo,
    onEdit,
    onDelete
}: DCPreviewModalProps) {
    const [selectedCopyType, setSelectedCopyType] = useState<"all" | "original" | "duplicate" | "triplicate">("all");

    if (!isOpen || !dc) return null;

    // Master company details resolution
    const compName = companyInfo?.companyName || companyInfo?.name || "COMPANY MASTER";
    const compAddress = companyInfo?.billingAddress || companyInfo?.address || companyInfo?.location || "";
    const compGst = companyInfo?.gstin || companyInfo?.gstNumber || companyInfo?.gst || "N/A";

    // Customer details resolution
    const custObj = typeof dc.customer === 'object' ? dc.customer : {};
    const custName = dc.customerName || custObj?.name || custObj?.companyName || "Internal / Cash Customer";
    const custAddress = dc.customerAddress || custObj?.address || custObj?.billingAddress || custObj?.shippingAddress || "-";
    const custGst = dc.customerGST || custObj?.gstin || custObj?.gstNumber || custObj?.gst || "-";
    const custPoRef = dc.customerPoReference || dc.poNumber || "-";

    // Calculations
    const items = dc.items || [];
    const subtotal = dc.subtotal || items.reduce((acc: number, i: any) => acc + (Number(i.quantity || 0) * Number(i.rate || 0)), 0);
    const transportCharges = Number(dc.transportationCharges || dc.freightCharges || 0);
    const packagingCharges = Number(dc.packagingCharges || 0);
    const taxAmount = dc.taxAmount || items.reduce((acc: number, i: any) => acc + ((Number(i.quantity || 0) * Number(i.rate || 0)) * (Number(i.taxRate || 0) / 100)), 0);
    const discount = Number(dc.discount || 0);
    const grandTotal = dc.totalAmount || (subtotal + taxAmount + transportCharges + packagingCharges - discount);

    const handleDownloadPDF = () => {
        download4CopyPDF("dc", { doc: dc, companyInfo, copyType: selectedCopyType });
    };

    const handleDownloadExcel = () => {
        downloadDCExcelDocument(dc, companyInfo);
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
                        <div className="w-11 h-11 bg-blue-600/20 rounded-2xl flex items-center justify-center border border-blue-500/30">
                            <FileText className="text-blue-400 w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2.5">
                                <h2 className="text-lg sm:text-xl font-black font-mono tracking-tight text-white">
                                    DC #{dc.dcNumber}
                                </h2>
                                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30">
                                    {dc.status || "Issued"}
                                </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
                                <span>Creation: {formatDateTime(dc.createdAt || dc.date)}</span>
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
                            <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-0.5 rounded-lg border border-blue-200 dark:border-blue-800">
                                {copyBadgeLabel}
                            </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <button
                                onClick={() => setSelectedCopyType("all")}
                                className={`px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-center border ${
                                    selectedCopyType === "all"
                                        ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20"
                                        : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                                }`}
                            >
                                🌟 All 3 Copies PDF
                            </button>
                            <button
                                onClick={() => setSelectedCopyType("original")}
                                className={`px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-center border ${
                                    selectedCopyType === "original"
                                        ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20"
                                        : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                                }`}
                            >
                                📄 Original (Recipient)
                            </button>
                            <button
                                onClick={() => setSelectedCopyType("duplicate")}
                                className={`px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-center border ${
                                    selectedCopyType === "duplicate"
                                        ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20"
                                        : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                                }`}
                            >
                                🚛 Duplicate (Transporter)
                            </button>
                            <button
                                onClick={() => setSelectedCopyType("triplicate")}
                                className={`px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-center border ${
                                    selectedCopyType === "triplicate"
                                        ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20"
                                        : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                                }`}
                            >
                                🏢 Triplicate (Supplier)
                            </button>
                        </div>
                    </div>

                    {/* Live Visual Document Mockup Preview Card */}
                    <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl border-2 border-slate-200 dark:border-slate-800 shadow-lg space-y-5 font-sans">
                        
                        {/* Top Mockup Header Bar */}
                        <div className="flex flex-col sm:flex-row justify-between items-start border-b border-slate-200 dark:border-slate-800 pb-4 gap-3">
                            <div>
                                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">{compName}</h3>
                                {compAddress && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{compAddress}</p>}
                                <p className="text-xs text-slate-500 font-medium mt-0.5">GSTIN: <span className="font-bold text-slate-800 dark:text-slate-200">{compGst}</span></p>
                            </div>
                            <div className="flex flex-col items-start sm:items-end">
                                <span className="px-3 py-1 bg-slate-900 text-white font-extrabold text-xs rounded-lg uppercase tracking-wider">
                                    {selectedCopyType === "all" ? "ORIGINAL / MULTI-COPY" : copyBadgeLabel}
                                </span>
                                <h4 className="text-base font-black text-blue-600 dark:text-blue-400 mt-2 uppercase tracking-wide">DELIVERY CHALLAN</h4>
                            </div>
                        </div>

                        {/* Customer & Logistics Details Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                            <div className="p-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1">
                                <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Consignee Details</span>
                                <div className="font-bold text-slate-900 dark:text-white text-sm">{custName}</div>
                                <div className="text-slate-600 dark:text-slate-300 font-medium">Address: {custAddress}</div>
                                {custGst !== "-" && <div className="text-slate-600 dark:text-slate-300">GSTIN: <span className="font-bold">{custGst}</span></div>}
                                {custPoRef !== "-" && <div className="text-slate-600 dark:text-slate-300">Customer PO Ref: <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{custPoRef}</span></div>}
                            </div>

                            <div className="p-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1.5">
                                <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Document & Transport Info</span>
                                <div className="flex justify-between"><span>DC Number:</span> <span className="font-mono font-bold text-slate-900 dark:text-white">{dc.dcNumber}</span></div>
                                <div className="flex justify-between"><span>Creation Time:</span> <span className="font-medium text-slate-700 dark:text-slate-300">{formatDateTime(dc.createdAt || dc.date)}</span></div>
                                <div className="flex justify-between"><span>Transport Mode:</span> <span className="font-medium">{dc.transportationType || dc.transportType || "Road Transport"}</span></div>
                                <div className="flex justify-between"><span>Vehicle Number:</span> <span className="font-mono font-bold">{dc.vehicleNumber || "-"}</span></div>
                            </div>
                        </div>

                        {/* Items Table Mockup */}
                        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-slate-900 text-white font-bold uppercase text-[11px]">
                                    <tr>
                                        <th className="p-2.5 text-center">#</th>
                                        <th className="p-2.5">Item / Product Description</th>
                                        <th className="p-2.5 text-center">HSN</th>
                                        <th className="p-2.5 text-center">Qty</th>
                                        <th className="p-2.5 text-center">Unit</th>
                                        <th className="p-2.5 text-right">Rate (₹)</th>
                                        <th className="p-2.5 text-right">Total (₹)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                                    {items.map((item: any, idx: number) => {
                                        const qty = Number(item.quantity || item.qty || 0);
                                        const rate = Number(item.rate || item.unitPrice || 0);
                                        const total = Number(item.amount || item.lineTotal || (qty * rate));

                                        return (
                                            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                                                <td className="p-2.5 text-center font-mono">{idx + 1}</td>
                                                <td className="p-2.5 font-bold text-slate-900 dark:text-white">
                                                    {item.materialName || item.productName || item.itemName || "Item"}
                                                </td>
                                                <td className="p-2.5 text-center font-mono text-slate-500">{item.hsnCode || "-"}</td>
                                                <td className="p-2.5 text-center font-bold text-blue-600 dark:text-blue-400">{qty}</td>
                                                <td className="p-2.5 text-center text-slate-600 dark:text-slate-300">{item.unit || "PCS"}</td>
                                                <td className="p-2.5 text-right font-mono">₹{rate.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                <td className="p-2.5 text-right font-mono font-bold text-slate-900 dark:text-white">₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Summary & Totals Block */}
                        <div className="flex flex-col sm:flex-row justify-between items-end border-t border-slate-200 dark:border-slate-800 pt-4 gap-4">
                            <div className="text-xs space-y-1 max-w-sm">
                                <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Amount in Words</span>
                                <p className="font-bold text-slate-800 dark:text-slate-200 italic bg-slate-50 dark:bg-slate-900 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                                    {numberToWords(grandTotal)}
                                </p>
                            </div>

                            <div className="w-full sm:w-72 space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                                <div className="flex justify-between"><span>Items Subtotal:</span> <span className="font-mono font-bold">₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                                {transportCharges > 0 && <div className="flex justify-between"><span>Freight Charges:</span> <span className="font-mono">+ ₹{transportCharges.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>}
                                {packagingCharges > 0 && <div className="flex justify-between"><span>Packaging Charges:</span> <span className="font-mono">+ ₹{packagingCharges.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>}
                                <div className="flex justify-between font-extrabold text-sm text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-800">
                                    <span>GRAND TOTAL:</span> 
                                    <span className="font-mono text-blue-600 dark:text-blue-400">₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
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
                            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/20 transition-all flex items-center gap-2"
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
                                onClick={() => { onClose(); onEdit(dc); }}
                                className="px-4 py-2.5 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-600 text-indigo-600 hover:text-white dark:text-indigo-400 font-bold text-xs rounded-xl border border-indigo-200 dark:border-indigo-800 transition-all flex items-center gap-2"
                            >
                                <Edit2 size={16} /> Edit DC
                            </button>
                        )}
                        {onDelete && (
                            <button
                                onClick={() => {
                                    if (confirm(`Are you sure you want to delete Delivery Challan ${dc.dcNumber || ''}?`)) {
                                        onClose();
                                        onDelete(dc._id || dc.id);
                                    }
                                }}
                                className="px-4 py-2.5 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-600 text-rose-600 hover:text-white dark:text-rose-400 font-bold text-xs rounded-xl border border-rose-200 dark:border-rose-800 transition-all flex items-center gap-2"
                            >
                                <Trash2 size={16} /> Delete DC
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

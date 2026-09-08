import React, { useState, useEffect } from 'react';
import {
    X, Calendar, User, Truck, Package, Layers, FileText, Download,
    Edit2, Trash2, CheckCircle2, Building2, Eye, Printer, MapPin,
    Hash, Sparkles, Clock, Lock, Copy, Check, ChevronDown, ChevronUp,
    ExternalLink, CreditCard, ShieldCheck, DollarSign
} from 'lucide-react';
import { CompanyInfo } from "@/src/features/store/types/store.types";
import { download4CopyPDF, downloadInvoiceExcelDocument } from '@/src/utils/frontendDocumentHelper';
import { getCurrencySymbol, convertAmountToWords } from '@/src/utils/currencyHelper';

interface InvoicePreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    invoice: any | null;
    companyInfo?: CompanyInfo;
    onEdit?: (invoice: any) => void;
    onDelete?: (id: string) => void;
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
    const [previewMode, setPreviewMode] = useState<"interactive" | "print">("interactive");
    const [selectedCopyType, setSelectedCopyType] = useState<"all" | "original" | "duplicate" | "triplicate">("all");
    const [nowTime, setNowTime] = useState<number>(Date.now());
    const [copiedField, setCopiedField] = useState<string | null>(null);

    // Interactive view toggles
    const [showCustomerDetails, setShowCustomerDetails] = useState(false);
    const [showPoDetails, setShowPoDetails] = useState(false);
    const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(null);

    useEffect(() => {
        const timer = setInterval(() => setNowTime(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    if (!isOpen || !invoice) return null;

    const getRemainingEditSeconds = (createdAt: string | Date | undefined) => {
        if (!createdAt) return 0;
        const createdTime = new Date(createdAt).getTime();
        if (isNaN(createdTime)) return 0;
        const diffSeconds = Math.floor((createdTime + 24 * 60 * 60 * 1000 - nowTime) / 1000);
        return Math.max(0, diffSeconds);
    };

    const formatRemainingTime = (seconds: number) => {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const remainingSecs = getRemainingEditSeconds(invoice.createdAt || invoice.date);
    const isWithin24h = remainingSecs > 0;

    // Master company details resolution
    const compName = companyInfo?.companyName || companyInfo?.name || "BINSERP ENTERPRISE";
    const compAddress = companyInfo?.billingAddress || companyInfo?.address || companyInfo?.location || "";
    const compGst = companyInfo?.gstin || companyInfo?.gstNumber || companyInfo?.gst || "N/A";
    const compPan = companyInfo?.panNumber || companyInfo?.pan || "N/A";
    const compPhone = companyInfo?.contactNumber || (companyInfo as any)?.phone || "";
    const compEmail = companyInfo?.email || "";
    const compLogo = companyInfo?.logo || "";

    // Bank details resolution: Prefer invoice-specific bank details, fallback to master
    const invBank = invoice.bankDetails || {};
    const masterBank = companyInfo?.bankDetails || {};
    const bankName = invBank.bankName || masterBank.bankName || (companyInfo as any)?.bankName || '-';
    const accountName = invBank.accountName || masterBank.accountName || compName;
    const accountNumber = invBank.accountNumber || masterBank.accountNumber || (companyInfo as any)?.accountNumber || '-';
    const ifscCode = invBank.ifscCode || masterBank.ifscCode || (companyInfo as any)?.ifscCode || '-';
    const branchName = invBank.branch || invBank.branchName || masterBank.branch || masterBank.branchName || (companyInfo as any)?.branchName || '';

    // Terms & Conditions resolution: Prefer invoice-specific terms, fallback to master
    const termsAndConditions = invoice.termsAndConditions || invoice.terms ||
        companyInfo?.printSettings?.invoice?.termsAndConditions ||
        companyInfo?.commercialTerms ||
        "1. Goods once sold will not be accepted back or exchanged.\n2. Payment is due within agreed credit terms from the date of invoice.\n3. Interest @ 18% p.a. will be charged on overdue payments after due date.\n4. Any disputes arising out of this invoice are subject to local jurisdiction only.";

    // Customer details resolution
    const custObj = typeof invoice.customer === 'object' ? invoice.customer : {};
    const custName = invoice.customerName || custObj?.name || custObj?.companyName || "Internal / Cash Customer";
    const custAddress = invoice.customerAddress || custObj?.address || custObj?.billingAddress || custObj?.shippingAddress || "-";
    const custShippingAddress = custObj?.shippingAddress || invoice.shippingAddress || custAddress;
    const custGst = invoice.customerGST || custObj?.gstin || custObj?.gstNumber || custObj?.gst || "-";
    const custPhone = custObj?.phone || custObj?.contactNumber || "-";
    const custEmail = custObj?.email || "-";
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

    const handlePrint = () => {
        window.print();
    };

    const copyToClipboard = (text: string, label: string) => {
        if (!text || text === '-') return;
        navigator.clipboard.writeText(text);
        setCopiedField(label);
        setTimeout(() => setCopiedField(null), 2000);
    };

    const copyBadgeLabel = {
        all: "Full 3-Copy PDF (Original + Duplicate + Triplicate)",
        original: "ORIGINAL FOR RECIPIENT",
        duplicate: "DUPLICATE FOR TRANSPORTER",
        triplicate: "TRIPLICATE FOR SUPPLIER"
    }[selectedCopyType];

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-2 sm:p-5 bg-slate-950/75 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
            
            {/* Embedded Print Styling: Isolated to #printable-tax-invoice */}
            <style jsx global>{`
                @media print {
                    body * {
                        visibility: hidden !important;
                    }
                    #printable-tax-invoice, #printable-tax-invoice * {
                        visibility: visible !important;
                    }
                    #printable-tax-invoice {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        max-width: 100% !important;
                        margin: 0 !important;
                        padding: 12mm !important;
                        box-shadow: none !important;
                        border: 1px solid #000 !important;
                        background: #fff !important;
                        color: #000 !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                }
            `}</style>

            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-5xl xl:max-w-6xl my-auto overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[94vh]">
                
                {/* Header Bar */}
                <div className="p-4 sm:p-5 bg-slate-900 text-white flex flex-wrap justify-between items-center gap-3 flex-shrink-0 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-600/20 rounded-2xl flex items-center justify-center border border-indigo-500/30">
                            <FileText className="text-indigo-400 w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-extrabold text-base sm:text-lg tracking-tight text-white">
                                    TAX INVOICE #{invoice.invoiceNumber || 'INV-001'}
                                </h3>
                                {isWithin24h ? (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                        <Clock size={12} className="text-amber-400 animate-pulse" />
                                        <span>⏳ {formatRemainingTime(remainingSecs)} left to edit/delete</span>
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                                        <Lock size={12} />
                                        <span>Locked (&gt;24h)</span>
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
                                <span>Creation: {formatDateTime(invoice.createdAt || invoice.date)}</span>
                            </p>
                        </div>
                    </div>

                    {/* Mode Toggle Switcher & Close */}
                    <div className="flex items-center gap-2.5">
                        <div className="bg-slate-800 p-1 rounded-xl border border-slate-700 flex items-center gap-1">
                            <button
                                type="button"
                                onClick={() => setPreviewMode("interactive")}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                                    previewMode === "interactive"
                                        ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/30"
                                        : "text-slate-400 hover:text-slate-200"
                                }`}
                            >
                                <Eye size={13} />
                                <span>Clickable Details</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setPreviewMode("print")}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                                    previewMode === "print"
                                        ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/30"
                                        : "text-slate-400 hover:text-slate-200"
                                }`}
                            >
                                <Printer size={13} />
                                <span>A4 Print View</span>
                            </button>
                        </div>

                        <button
                            onClick={onClose}
                            className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 transition-all flex items-center justify-center text-slate-300 hover:text-white border border-slate-700 cursor-pointer"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Main Body */}
                <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">

                    {/* ========================================================= */}
                    {/* MODE 1: INTERACTIVE CLICKABLE DETAIL PREVIEW               */}
                    {/* ========================================================= */}
                    {previewMode === "interactive" && (
                        <div className="space-y-5 animate-in fade-in duration-150">
                            
                            {/* Top Info Banner */}
                            <div className="bg-gradient-to-r from-indigo-50 via-blue-50 to-indigo-50 dark:from-slate-800/80 dark:via-indigo-950/30 dark:to-slate-800/80 p-4 rounded-2xl border border-indigo-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                                <div className="flex items-center gap-2">
                                    <Sparkles size={16} className="text-indigo-600 dark:text-indigo-400" />
                                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                                        Interactive ERP Inspector: Click line items, customer details, and bank fields for deep details and copy actions.
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-slate-500 dark:text-slate-400">Status:</span>
                                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                        {invoice.status || "Draft"}
                                    </span>
                                </div>
                            </div>

                            {/* Clickable Customer & Invoice Metadata Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                
                                {/* Clickable Buyer Card */}
                                <div
                                    onClick={() => setShowCustomerDetails(!showCustomerDetails)}
                                    className="bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 transition-all cursor-pointer group space-y-2 shadow-xs"
                                >
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                                            <User size={13} /> Buyer / Consignee Details
                                        </span>
                                        <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                                            {showCustomerDetails ? "Hide Full Info" : "Click to Inspect"}
                                            {showCustomerDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                        </span>
                                    </div>

                                    <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
                                        {custName}
                                    </h4>

                                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-1">
                                        <b>Address:</b> {custAddress}
                                    </p>

                                    <p className="text-xs text-slate-600 dark:text-slate-300">
                                        <b>GSTIN:</b> <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">{custGst}</span>
                                    </p>

                                    {/* Expandable Customer Details */}
                                    {showCustomerDetails && (
                                        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 space-y-1.5 animate-in slide-in-from-top-1 duration-150">
                                            <p><b>Shipping Address:</b> {custShippingAddress}</p>
                                            <p><b>Contact Phone:</b> {custPhone}</p>
                                            <p><b>Email:</b> {custEmail}</p>
                                        </div>
                                    )}
                                </div>

                                {/* Clickable Logistics & PO Card */}
                                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2 text-xs shadow-xs">
                                    <div className="flex justify-between items-center pb-1 border-b border-slate-200 dark:border-slate-700">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                            <Truck size={13} /> Logistics & Reference
                                        </span>
                                        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                            {invoice.invoiceNumber || 'INV-001'}
                                        </span>
                                    </div>

                                    {custPoRef && custPoRef !== '-' ? (
                                        <div 
                                            onClick={() => setShowPoDetails(!showPoDetails)}
                                            className="p-2.5 bg-indigo-50/70 dark:bg-indigo-950/40 hover:bg-indigo-100/80 dark:hover:bg-indigo-900/60 rounded-xl border border-indigo-200 dark:border-indigo-800/80 transition-all cursor-pointer flex justify-between items-center"
                                        >
                                            <div>
                                                <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold block">
                                                    Linked Customer PO:
                                                </span>
                                                <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                                                    {custPoRef}
                                                </span>
                                            </div>
                                            <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-0.5">
                                                {showPoDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                            </span>
                                        </div>
                                    ) : (
                                        <div className="text-slate-400 italic">
                                            Direct Sale (No Customer PO linked)
                                        </div>
                                    )}

                                    {showPoDetails && custPoRef && (
                                        <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-indigo-100 dark:border-indigo-900 text-[11px] text-slate-600 dark:text-slate-300 space-y-1">
                                            <p>PO Reference: <strong>{custPoRef}</strong></p>
                                            <p>PO items and dispatched quantities are linked directly to this Tax Invoice.</p>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-2 pt-1 text-slate-600 dark:text-slate-300">
                                        <div>
                                            <span className="text-slate-400 block text-[10px]">Transport Mode:</span>
                                            <span className="font-semibold">{invoice.transportationType || 'Road Transport'}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-400 block text-[10px]">Vehicle No:</span>
                                            <span className="font-mono font-bold">{invoice.vehicleNumber || '-'}</span>
                                        </div>
                                    </div>
                                </div>

                            </div>

                            {/* Clickable Line Items Table */}
                            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
                                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                                        <Package size={14} className="text-indigo-600 dark:text-indigo-400" />
                                        Invoice Line Items ({items.length}) • Click any row to inspect specifications
                                    </h4>
                                    <span className="text-[11px] text-slate-500 font-medium">
                                        Currency: <b>{invoice.currency || 'INR'}</b>
                                    </span>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-slate-100/70 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 font-extrabold uppercase text-[10px] border-b border-slate-200 dark:border-slate-800">
                                            <tr>
                                                <th className="p-3 text-center w-12">S.No</th>
                                                <th className="p-3">Item Name & Technical Description</th>
                                                <th className="p-3 text-center">HSN</th>
                                                <th className="p-3 text-center">Quantity</th>
                                                <th className="p-3 text-right">Unit Rate ({invoice.currency || 'INR'})</th>
                                                <th className="p-3 text-center">GST %</th>
                                                <th className="p-3 text-right">Total Line ({invoice.currency || 'INR'})</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {items.length === 0 ? (
                                                <tr>
                                                    <td colSpan={7} className="p-6 text-center text-slate-400 italic">No line items specified</td>
                                                </tr>
                                            ) : (
                                                items.map((item: any, idx: number) => {
                                                    const qty = Number(item.quantity || item.qty || 0);
                                                    const rate = Number(item.rate || item.unitPrice || 0);
                                                    const lineAmt = (item.amount || (qty * rate));
                                                    const taxRate = Number(item.taxRate || 0);
                                                    const totalLine = lineAmt + (lineAmt * (taxRate / 100));
                                                    const isSelected = selectedItemIndex === idx;

                                                    const currSym = getCurrencySymbol(invoice.currency);

                                                    return (
                                                        <React.Fragment key={idx}>
                                                            <tr
                                                                onClick={() => setSelectedItemIndex(isSelected ? null : idx)}
                                                                className={`transition-colors cursor-pointer ${
                                                                    isSelected 
                                                                        ? "bg-indigo-50/70 dark:bg-indigo-950/40" 
                                                                        : "hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                                                                }`}
                                                            >
                                                                <td className="p-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                                                                <td className="p-3 text-slate-900 dark:text-white">
                                                                    <div className="font-bold text-xs sm:text-sm text-indigo-950 dark:text-indigo-200">
                                                                        {item.materialName || item.productName || item.itemName || 'Item'}
                                                                    </div>
                                                                    {(item.description || item.descriptions) && (
                                                                        <div className="text-[11px] text-slate-500 dark:text-slate-400 italic mt-0.5 line-clamp-2">
                                                                            {item.description || item.descriptions}
                                                                        </div>
                                                                    )}
                                                                </td>
                                                                <td className="p-3 text-center font-mono text-slate-500">{item.hsnCode || item.hsn || '-'}</td>
                                                                <td className="p-3 text-center font-bold text-indigo-600 dark:text-indigo-400">{qty} {item.unit || 'PCS'}</td>
                                                                <td className="p-3 text-right font-mono">{currSym}{rate.toFixed(2)}</td>
                                                                <td className="p-3 text-center font-semibold">{taxRate > 0 ? `${taxRate}%` : '-'}</td>
                                                                <td className="p-3 text-right font-bold font-mono text-slate-900 dark:text-white">{currSym}{totalLine.toFixed(2)}</td>
                                                            </tr>

                                                            {/* Expandable Line Item Inspection Card */}
                                                            {isSelected && (
                                                                <tr className="bg-indigo-50/40 dark:bg-indigo-950/20 border-b border-indigo-100 dark:border-indigo-900/50">
                                                                    <td colSpan={7} className="p-4">
                                                                        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-indigo-200 dark:border-indigo-800/80 space-y-2 text-xs">
                                                                            <div className="flex justify-between items-center font-bold text-indigo-700 dark:text-indigo-300">
                                                                                <span>Item Technical Breakdown:</span>
                                                                                <span className="text-[11px] text-slate-400 font-mono">HSN: {item.hsnCode || 'N/A'}</span>
                                                                            </div>
                                                                            <p className="text-slate-600 dark:text-slate-400">
                                                                                <b>Technical Specification:</b> {item.description || item.descriptions || "No extended specifications recorded."}
                                                                            </p>
                                                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                                                                                <div>
                                                                                    <span className="text-slate-400 block text-[10px]">Taxable Base:</span>
                                                                                    <span className="font-mono font-bold">{currSym}{lineAmt.toFixed(2)}</span>
                                                                                </div>
                                                                                <div>
                                                                                    <span className="text-slate-400 block text-[10px]">GST Rate:</span>
                                                                                    <span className="font-bold">{taxRate}%</span>
                                                                                </div>
                                                                                <div>
                                                                                    <span className="text-slate-400 block text-[10px]">Tax Amount:</span>
                                                                                    <span className="font-mono font-bold text-emerald-600">+{currSym}{(lineAmt * (taxRate / 100)).toFixed(2)}</span>
                                                                                </div>
                                                                                <div>
                                                                                    <span className="text-slate-400 block text-[10px]">Final Line Total:</span>
                                                                                    <span className="font-mono font-extrabold text-indigo-600">{currSym}{totalLine.toFixed(2)}</span>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </React.Fragment>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Bank Details (With Copy-to-Clipboard) & Custom Terms Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                
                                {/* Bank Details Card with Instant One-Click Copy */}
                                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3 text-xs shadow-xs">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                                            <Building2 size={14} /> Company Bank Details (Receipt Account)
                                        </span>
                                        {copiedField && (
                                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 rounded text-[10px] font-bold flex items-center gap-1 animate-in fade-in">
                                                <Check size={11} /> {copiedField} Copied!
                                            </span>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                        <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                                            <span className="text-[10px] text-slate-400 block">Bank Name:</span>
                                            <span className="font-bold text-slate-900 dark:text-white">{bankName}</span>
                                        </div>
                                        <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                                            <span className="text-[10px] text-slate-400 block">Account Holder:</span>
                                            <span className="font-bold text-slate-900 dark:text-white truncate block">{accountName}</span>
                                        </div>
                                        <div 
                                            onClick={() => copyToClipboard(accountNumber, "A/C Number")}
                                            className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-400 transition-colors cursor-pointer group flex justify-between items-center"
                                        >
                                            <div>
                                                <span className="text-[10px] text-slate-400 block">Account Number:</span>
                                                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{accountNumber}</span>
                                            </div>
                                            <Copy size={13} className="text-slate-400 group-hover:text-indigo-600 transition-colors" />
                                        </div>
                                        <div 
                                            onClick={() => copyToClipboard(ifscCode, "IFSC Code")}
                                            className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-400 transition-colors cursor-pointer group flex justify-between items-center"
                                        >
                                            <div>
                                                <span className="text-[10px] text-slate-400 block">IFSC Code:</span>
                                                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 uppercase">{ifscCode}</span>
                                            </div>
                                            <Copy size={13} className="text-slate-400 group-hover:text-indigo-600 transition-colors" />
                                        </div>
                                    </div>

                                    {branchName && branchName !== '-' && (
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                            Branch: <strong>{branchName}</strong>
                                        </p>
                                    )}

                                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700 font-semibold italic text-indigo-900 dark:text-indigo-300">
                                        Amount in Words: {convertAmountToWords(grandTotal, invoice.currency)}
                                    </div>
                                </div>

                                {/* Custom Terms & Conditions Card */}
                                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2 text-xs shadow-xs">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                        <FileText size={14} /> Terms & Conditions (Invoice Specific)
                                    </span>
                                    <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed font-mono">
                                        {termsAndConditions}
                                    </div>
                                </div>

                            </div>

                            {/* Financial Totals Summary Bar */}
                            <div className="bg-slate-50 dark:bg-slate-800/80 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                    <div>
                                        <span className="text-slate-400 block text-[10px]">Subtotal:</span>
                                        <span className="font-mono font-bold text-sm text-slate-900 dark:text-white">
                                            {getCurrencySymbol(invoice.currency)}{subtotal.toFixed(2)}
                                        </span>
                                    </div>
                                    {transportCharges > 0 && (
                                        <div>
                                            <span className="text-slate-400 block text-[10px]">Freight / Transport:</span>
                                            <span className="font-mono font-bold text-sm text-slate-900 dark:text-white">
                                                +{getCurrencySymbol(invoice.currency)}{transportCharges.toFixed(2)}
                                            </span>
                                        </div>
                                    )}
                                    {taxAmount > 0 && (
                                        <div>
                                            <span className="text-slate-400 block text-[10px]">GST / Tax Amount:</span>
                                            <span className="font-mono font-bold text-sm text-emerald-600">
                                                +{getCurrencySymbol(invoice.currency)}{taxAmount.toFixed(2)}
                                            </span>
                                        </div>
                                    )}
                                    <div>
                                        <span className="text-indigo-600 dark:text-indigo-400 block text-[10px] font-bold">GRAND TOTAL:</span>
                                        <span className="font-mono font-extrabold text-base text-indigo-600 dark:text-indigo-400">
                                            {getCurrencySymbol(invoice.currency)}{grandTotal.toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                        </div>
                    )}

                    {/* ========================================================= */}
                    {/* MODE 2: DISTINCT AUTHENTIC A4 PRINT PREVIEW               */}
                    {/* ========================================================= */}
                    {previewMode === "print" && (
                        <div className="space-y-4 animate-in fade-in duration-150">
                            
                            {/* Copy Selector Bar (Interactive in preview, hidden during print) */}
                            <div className="no-print bg-slate-50 dark:bg-slate-800/80 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 text-xs">
                                <span className="font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                                    <Sparkles size={14} className="text-amber-500" /> Select Document Copy Stamp:
                                </span>
                                <div className="flex flex-wrap items-center gap-1.5">
                                    {(["all", "original", "duplicate", "triplicate"] as const).map(type => (
                                        <button
                                            key={type}
                                            type="button"
                                            onClick={() => setSelectedCopyType(type)}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                                selectedCopyType === type
                                                    ? "bg-indigo-600 text-white shadow-xs"
                                                    : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                                            }`}
                                        >
                                            {type === "all" && "🌟 All 3 Copies"}
                                            {type === "original" && "📄 Original (Recipient)"}
                                            {type === "duplicate" && "🚚 Duplicate (Transporter)"}
                                            {type === "triplicate" && "🏢 Triplicate (Supplier)"}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Actual Pixel-Perfect Authentic A4 Tax Invoice Sheet */}
                            <div
                                id="printable-tax-invoice"
                                className="bg-white text-slate-950 p-6 sm:p-10 border border-slate-400 shadow-xl max-w-[210mm] mx-auto text-xs font-sans space-y-4"
                            >
                                {/* Header */}
                                <div className="flex justify-between items-start border-b-2 border-slate-900 pb-3">
                                    <div>
                                        <h1 className="text-xl font-black uppercase text-slate-950 tracking-tight">
                                            {compName}
                                        </h1>
                                        <p className="text-[11px] text-slate-700 mt-0.5 max-w-md leading-relaxed">
                                            {compAddress}
                                        </p>
                                        <p className="text-[11px] font-bold text-slate-800 mt-1">
                                            GSTIN: <span className="font-mono">{compGst}</span> | PAN: <span className="font-mono">{compPan}</span>
                                        </p>
                                    </div>

                                    <div className="text-right">
                                        <span className="inline-block border border-slate-900 bg-slate-900 text-white text-[10px] font-black px-3 py-1 uppercase tracking-wider">
                                            {selectedCopyType === "all" ? "ORIGINAL FOR RECIPIENT" : copyBadgeLabel}
                                        </span>
                                    </div>
                                </div>

                                {/* Title */}
                                <div className="text-center py-1.5 border border-slate-900 bg-slate-100 font-black text-sm uppercase tracking-widest text-slate-900">
                                    TAX INVOICE
                                </div>

                                {/* 2-Column Billed-To / Logistics Grid */}
                                <div className="grid grid-cols-2 border border-slate-900 text-[11px] divide-x divide-slate-900">
                                    {/* Buyer Box */}
                                    <div className="p-3 space-y-1">
                                        <span className="text-[9px] font-bold uppercase text-slate-600 block">
                                            DETAILS OF RECEIVER / BILLED TO:
                                        </span>
                                        <h4 className="font-extrabold text-xs text-slate-950">
                                            {custName}
                                        </h4>
                                        <p className="text-slate-700 leading-snug">
                                            <b>Address:</b> {custAddress}
                                        </p>
                                        <p className="text-slate-800">
                                            <b>GSTIN:</b> <span className="font-mono font-bold">{custGst}</span>
                                        </p>
                                    </div>

                                    {/* Invoice Metadata Box */}
                                    <div className="p-3 space-y-1 bg-slate-50/50">
                                        <div className="flex justify-between">
                                            <span className="text-slate-600">Invoice Number:</span>
                                            <span className="font-mono font-bold text-xs text-slate-950">{invoice.invoiceNumber || 'INV-001'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-600">Invoice Date:</span>
                                            <span className="font-semibold">{formatDateTime(invoice.createdAt || invoice.date)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-600">Customer PO Ref:</span>
                                            <span className="font-semibold">{custPoRef}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-600">Transport Mode:</span>
                                            <span className="font-semibold">{invoice.transportationType || 'Road Transport'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-600">Vehicle Number:</span>
                                            <span className="font-mono font-bold">{invoice.vehicleNumber || '-'}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Line Items Table */}
                                <table className="w-full border-collapse border border-slate-900 text-[10.5px]">
                                    <thead>
                                        <tr className="bg-slate-100 border-b border-slate-900 text-slate-950 font-bold uppercase text-[9.5px]">
                                            <th className="p-2 text-center border-r border-slate-900 w-8">S.N.</th>
                                            <th className="p-2 text-left border-r border-slate-900">Description of Goods</th>
                                            <th className="p-2 text-center border-r border-slate-900 w-16">HSN/SAC</th>
                                            <th className="p-2 text-center border-r border-slate-900 w-16">Qty</th>
                                            <th className="p-2 text-right border-r border-slate-900 w-20">Rate</th>
                                            <th className="p-2 text-center border-r border-slate-900 w-12">GST %</th>
                                            <th className="p-2 text-right w-24">Amount ({invoice.currency || 'INR'})</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-300">
                                        {items.map((item: any, idx: number) => {
                                            const qty = Number(item.quantity || item.qty || 0);
                                            const rate = Number(item.rate || item.unitPrice || 0);
                                            const lineAmt = (item.amount || (qty * rate));
                                            const taxRate = Number(item.taxRate || 0);
                                            const totalLine = lineAmt + (lineAmt * (taxRate / 100));

                                            return (
                                                <tr key={idx}>
                                                    <td className="p-2 text-center border-r border-slate-900">{idx + 1}</td>
                                                    <td className="p-2 border-r border-slate-900">
                                                        <div className="font-bold">
                                                            {item.materialName || item.productName || item.itemName}
                                                        </div>
                                                        {(item.description || item.descriptions) && (
                                                            <div className="text-[10px] text-slate-600 italic mt-0.5">
                                                                {item.description || item.descriptions}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="p-2 text-center font-mono border-r border-slate-900">{item.hsnCode || '-'}</td>
                                                    <td className="p-2 text-center font-bold border-r border-slate-900">{qty} {item.unit || 'PCS'}</td>
                                                    <td className="p-2 text-right font-mono border-r border-slate-900">{rate.toFixed(2)}</td>
                                                    <td className="p-2 text-center border-r border-slate-900">{taxRate > 0 ? `${taxRate}%` : '-'}</td>
                                                    <td className="p-2 text-right font-mono font-bold">{totalLine.toFixed(2)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>

                                {/* Bottom Summary & Signatory Block */}
                                <div className="grid grid-cols-2 border border-slate-900 divide-x divide-slate-900 text-[10.5px]">
                                    <div className="p-3 space-y-2">
                                        <div>
                                            <span className="font-bold uppercase text-[9px] text-slate-600 block">
                                                COMPANY BANK DETAILS:
                                            </span>
                                            <p className="text-slate-800 leading-snug">
                                                Bank: <b>{bankName}</b> | A/c No: <b>{accountNumber}</b><br />
                                                IFSC: <b>{ifscCode}</b> {branchName ? `| Branch: ${branchName}` : ''}
                                            </p>
                                        </div>

                                        <div className="pt-2 border-t border-slate-300">
                                            <span className="font-bold uppercase text-[9px] text-slate-600 block">
                                                TERMS & CONDITIONS:
                                            </span>
                                            <p className="text-slate-700 whitespace-pre-line text-[9.5px]">
                                                {termsAndConditions}
                                            </p>
                                        </div>

                                        <div className="pt-2 border-t border-slate-300 italic font-bold">
                                            Amount in Words: {convertAmountToWords(grandTotal, invoice.currency)}
                                        </div>
                                    </div>

                                    <div className="p-3 flex flex-col justify-between">
                                        <div className="space-y-1">
                                            <div className="flex justify-between">
                                                <span className="text-slate-600">Subtotal:</span>
                                                <span className="font-mono font-bold">{subtotal.toFixed(2)}</span>
                                            </div>
                                            {transportCharges > 0 && (
                                                <div className="flex justify-between">
                                                    <span className="text-slate-600">Freight:</span>
                                                    <span className="font-mono">+{transportCharges.toFixed(2)}</span>
                                                </div>
                                            )}
                                            {taxAmount > 0 && (
                                                <div className="flex justify-between">
                                                    <span className="text-slate-600">Tax Amount (GST):</span>
                                                    <span className="font-mono">+{taxAmount.toFixed(2)}</span>
                                                </div>
                                            )}
                                            <div className="flex justify-between pt-1 border-t border-slate-900 font-extrabold text-xs">
                                                <span>GRAND TOTAL ({invoice.currency || 'INR'}):</span>
                                                <span className="font-mono">{grandTotal.toFixed(2)}</span>
                                            </div>
                                        </div>

                                        <div className="pt-6 text-right">
                                            <span className="text-[10px] text-slate-600 block">For {compName}</span>
                                            <div className="h-10"></div>
                                            <span className="font-bold text-[10px] border-t border-slate-900 pt-1 px-4 inline-block">
                                                Authorized Signatory
                                            </span>
                                        </div>
                                    </div>
                                </div>

                            </div>
                        </div>
                    )}

                </div>

                {/* Footer Controls */}
                <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-900 flex flex-wrap justify-between items-center gap-3 border-t border-slate-200 dark:border-slate-800 flex-shrink-0">
                    <div className="flex flex-wrap gap-2.5">
                        <button
                            onClick={handlePrint}
                            className="px-4 py-2.5 bg-slate-900 hover:bg-black dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
                        >
                            <Printer size={16} /> Print Document
                        </button>
                        <button
                            onClick={handleDownloadPDF}
                            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/20 transition-all flex items-center gap-2 cursor-pointer"
                        >
                            <Download size={16} /> Download {copyBadgeLabel.split("(")[0].trim()} PDF
                        </button>
                        <button
                            onClick={handleDownloadExcel}
                            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 transition-all flex items-center gap-2 cursor-pointer"
                        >
                            <FileText size={16} /> Export Excel
                        </button>
                        {isWithin24h ? (
                            <>
                                {onEdit && (
                                    <button
                                        onClick={() => { onClose(); onEdit(invoice); }}
                                        className="px-4 py-2.5 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-600 text-indigo-600 hover:text-white dark:text-indigo-400 font-bold text-xs rounded-xl border border-indigo-200 dark:border-indigo-800 transition-all flex items-center gap-2 cursor-pointer"
                                    >
                                        <Edit2 size={16} /> Edit Invoice
                                    </button>
                                )}
                                {onDelete && (
                                    <button
                                        onClick={() => {
                                            if (confirm(`Are you sure you want to delete Tax Invoice ${invoice.invoiceNumber || ''}? This will revert stock and adjust Customer PO.`)) {
                                                onClose();
                                                onDelete(invoice._id || invoice.id);
                                            }
                                        }}
                                        className="px-4 py-2.5 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-600 text-rose-600 hover:text-white dark:text-rose-400 font-bold text-xs rounded-xl border border-rose-200 dark:border-rose-800 transition-all flex items-center gap-2 cursor-pointer"
                                    >
                                        <Trash2 size={16} /> Delete Invoice
                                    </button>
                                )}
                            </>
                        ) : (
                            <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-slate-500 text-xs font-semibold border border-slate-200 dark:border-slate-800">
                                <Lock size={14} />
                                <span>24h Edit/Delete Window Expired (Locked)</span>
                            </div>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
                    >
                        Close
                    </button>
                </div>

            </div>
        </div>
    );
}

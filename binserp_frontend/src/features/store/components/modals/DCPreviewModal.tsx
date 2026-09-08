import React, { useState, useEffect } from 'react';
import {
    X, Calendar, User, Truck, Package, Layers, FileText, Download,
    Edit2, Trash2, CheckCircle2, Building2, Eye, Printer, MapPin,
    Hash, Sparkles, Clock, Lock, Copy, Check, ChevronDown, ChevronUp,
    ExternalLink, CreditCard, ShieldCheck, DollarSign
} from 'lucide-react';
import { CompanyInfo } from "@/src/features/store/types/store.types";
import { download4CopyPDF, downloadDCExcelDocument } from '@/src/utils/frontendDocumentHelper';
import { getCurrencySymbol, convertAmountToWords } from '@/src/utils/currencyHelper';

interface DCPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    dc: any | null;
    companyInfo?: CompanyInfo;
    onEdit?: (dc: any) => void;
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

export default function DCPreviewModal({
    isOpen,
    onClose,
    dc,
    companyInfo,
    onEdit,
    onDelete
}: DCPreviewModalProps) {
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

    if (!isOpen || !dc) return null;

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

    const remainingSecs = getRemainingEditSeconds(dc.createdAt || dc.date);
    const isWithin24h = remainingSecs > 0;

    // Master company details resolution
    const compName = companyInfo?.companyName || companyInfo?.name || "BINSERP ENTERPRISE";
    const compAddress = companyInfo?.billingAddress || companyInfo?.address || companyInfo?.location || "";
    const compGst = companyInfo?.gstin || companyInfo?.gstNumber || companyInfo?.gst || "N/A";
    const compPan = companyInfo?.panNumber || companyInfo?.pan || "N/A";
    const compPhone = companyInfo?.contactNumber || (companyInfo as any)?.phone || "";
    const compEmail = companyInfo?.email || "";
    const compLogo = companyInfo?.logo || "";

    // Bank details resolution: Prefer DC-specific bank details, fallback to master
    const dcBank = dc.bankDetails || {};
    const masterBank = companyInfo?.bankDetails || {};
    const bankName = dcBank.bankName || masterBank.bankName || (companyInfo as any)?.bankName || '-';
    const accountName = dcBank.accountName || masterBank.accountName || compName;
    const accountNumber = dcBank.accountNumber || masterBank.accountNumber || (companyInfo as any)?.accountNumber || '-';
    const ifscCode = dcBank.ifscCode || masterBank.ifscCode || (companyInfo as any)?.ifscCode || '-';
    const branch = dcBank.branch || dcBank.branchName || masterBank.branch || masterBank.branchName || (companyInfo as any)?.branchName || '-';

    // Terms resolution
    const DEFAULT_DC_TERMS = 
`1. Material delivered against this Delivery Challan is subject to terms agreed in the purchase contract.
2. Goods must be verified and acknowledged upon receipt by an authorized receiver.
3. Any discrepancy or damage must be notified within 24 hours of delivery.
4. Subject to local jurisdiction only.`;

    const termsAndConditions = dc.termsAndConditions || companyInfo?.printSettings?.dc?.termsAndConditions || companyInfo?.commercialTerms || DEFAULT_DC_TERMS;

    // Customer details resolution
    const custObj = typeof dc.customer === 'object' ? dc.customer : {};
    const custName = dc.customerName || custObj?.name || custObj?.companyName || "Internal / Cash Customer";
    const custAddress = dc.customerAddress || custObj?.address || custObj?.billingAddress || custObj?.shippingAddress || "-";
    const custGst = dc.customerGST || custObj?.gstin || custObj?.gstNumber || custObj?.gst || "-";
    const custPhone = custObj?.phone || custObj?.contactNumber || custObj?.mobile || "-";
    const custEmail = custObj?.email || "-";
    const custPoRef = dc.customerPoReference || dc.poNumber || "-";

    // Calculations
    const items = dc.items || [];
    const subtotal = dc.subtotal || items.reduce((acc: number, i: any) => acc + (Number(i.quantity || 0) * Number(i.rate || 0)), 0);
    const transportCharges = Number(dc.transportationCharges || dc.freightCharges || 0);
    const packagingCharges = Number(dc.packagingCharges || 0);
    const discount = Number(dc.discount || 0);
    const grandTotal = dc.totalAmount || Math.max(0, subtotal + transportCharges + packagingCharges - discount);

    const handleCopy = (text: string, fieldName: string) => {
        if (!text || text === '-') return;
        navigator.clipboard.writeText(text);
        setCopiedField(fieldName);
        setTimeout(() => setCopiedField(null), 2000);
    };

    const handleDownloadPDF = () => {
        download4CopyPDF("dc", { doc: dc, companyInfo, copyType: selectedCopyType });
    };

    const handleDownloadExcel = () => {
        downloadDCExcelDocument(dc, companyInfo);
    };

    const handleNativePrint = () => {
        window.print();
    };

    const copyBadgeLabel = {
        all: "Full 3-Copy Set (Original + Duplicate + Triplicate)",
        original: "ORIGINAL FOR RECIPIENT",
        duplicate: "DUPLICATE FOR TRANSPORTER",
        triplicate: "TRIPLICATE FOR SUPPLIER"
    }[selectedCopyType];

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-2 sm:p-5 bg-slate-950/75 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
            {/* Embedded Print Styling */}
            <style jsx global>{`
                @media print {
                    body * {
                        visibility: hidden !important;
                    }
                    #printable-dc-document, #printable-dc-document * {
                        visibility: visible !important;
                    }
                    #printable-dc-document {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        margin: 0 !important;
                        padding: 12mm !important;
                        background: white !important;
                        color: black !important;
                        box-shadow: none !important;
                        border: none !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                }
            `}</style>

            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-[98vw] xl:max-w-6xl max-h-[94vh] flex flex-col border border-slate-200 dark:border-slate-800 my-auto overflow-hidden">
                
                {/* Header with Mode Switcher */}
                <div className="no-print p-4 sm:p-5 bg-slate-900 text-white flex flex-wrap justify-between items-center gap-3 border-b border-slate-800 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-600/25 rounded-2xl flex items-center justify-center border border-blue-500/40 shadow-sm">
                            <Truck className="text-blue-400 w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-base sm:text-lg font-black font-mono tracking-tight text-white">
                                    DC #{dc.dcNumber}
                                </h2>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30">
                                    {dc.status || "Issued"}
                                </span>
                            </div>
                            <p className="text-xs text-slate-400">
                                Creation Date: {formatDateTime(dc.createdAt || dc.date)}
                            </p>
                        </div>
                    </div>

                    {/* Mode Toggle & Copy Selector */}
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Mode Switcher Buttons */}
                        <div className="bg-slate-800 p-1 rounded-xl border border-slate-700 flex items-center gap-1">
                            <button
                                type="button"
                                onClick={() => setPreviewMode("interactive")}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                                    previewMode === "interactive"
                                        ? "bg-blue-600 text-white shadow-xs"
                                        : "text-slate-300 hover:text-white"
                                }`}
                            >
                                <Eye size={13} /> Clickable Details
                            </button>
                            <button
                                type="button"
                                onClick={() => setPreviewMode("print")}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                                    previewMode === "print"
                                        ? "bg-blue-600 text-white shadow-xs"
                                        : "text-slate-300 hover:text-white"
                                }`}
                            >
                                <Printer size={13} /> A4 Print View
                            </button>
                        </div>

                        {/* Copy Type Selector */}
                        <select
                            value={selectedCopyType}
                            onChange={(e: any) => setSelectedCopyType(e.target.value)}
                            className="bg-slate-800 text-white text-xs px-3 py-1.5 rounded-xl border border-slate-700 font-semibold focus:outline-none"
                        >
                            <option value="all">Full 3-Copy Set</option>
                            <option value="original">Original (Recipient)</option>
                            <option value="duplicate">Duplicate (Transporter)</option>
                            <option value="triplicate">Triplicate (Supplier)</option>
                        </select>

                        <button
                            onClick={onClose}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer ml-1"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Modal Body */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                    
                    {/* MODE 1: INTERACTIVE CLICKABLE PREVIEW */}
                    {previewMode === "interactive" && (
                        <div className="space-y-5 animate-in fade-in duration-150">
                            
                            {/* Top Cards Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                
                                {/* 1. Dispatching Company Card */}
                                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs">
                                    <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                                        <Building2 size={12} className="text-blue-600" /> Consignor / Supplier
                                    </span>
                                    <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                                        {compName}
                                    </h4>
                                    <p className="text-slate-600 dark:text-slate-400 line-clamp-2">
                                        {compAddress || "Address on file in Company Master"}
                                    </p>
                                    <div className="pt-1 flex flex-wrap gap-2 text-[11px] font-mono">
                                        <span className="text-slate-500">GSTIN: <strong className="text-slate-700 dark:text-slate-300">{compGst}</strong></span>
                                        {compPan !== "N/A" && <span className="text-slate-500">PAN: <strong className="text-slate-700 dark:text-slate-300">{compPan}</strong></span>}
                                    </div>
                                </div>

                                {/* 2. Clickable Customer / Consignee Card */}
                                <div 
                                    onClick={() => setShowCustomerDetails(!showCustomerDetails)}
                                    className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/60 space-y-1.5 text-xs cursor-pointer hover:border-blue-400 transition-all group"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                                            <User size={12} /> Consignee / Buyer (Clickable)
                                        </span>
                                        {showCustomerDetails ? <ChevronUp size={14} className="text-blue-600" /> : <ChevronDown size={14} className="text-blue-600 group-hover:translate-y-0.5 transition-transform" />}
                                    </div>
                                    <h4 className="font-extrabold text-sm text-blue-950 dark:text-blue-100 flex items-center gap-1.5">
                                        {custName}
                                    </h4>
                                    <p className="text-slate-600 dark:text-slate-300 line-clamp-1">
                                        {custAddress}
                                    </p>
                                    <div className="pt-1 text-[11px] font-mono text-blue-700 dark:text-blue-300 font-semibold">
                                        GSTIN: {custGst}
                                    </div>

                                    {/* Expandable Buyer Details */}
                                    {showCustomerDetails && (
                                        <div className="pt-2 mt-2 border-t border-blue-200/80 dark:border-blue-900/60 space-y-1 text-[11px] text-slate-700 dark:text-slate-300 animate-in fade-in">
                                            <div className="flex justify-between"><span>Phone:</span> <span className="font-bold">{custPhone}</span></div>
                                            <div className="flex justify-between"><span>Email:</span> <span className="font-bold">{custEmail}</span></div>
                                            <div className="flex justify-between"><span>Full Address:</span> <span className="font-bold text-right max-w-[200px]">{custAddress}</span></div>
                                        </div>
                                    )}
                                </div>

                                {/* 3. Clickable Customer PO & Logistics Card */}
                                <div 
                                    onClick={() => setShowPoDetails(!showPoDetails)}
                                    className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs cursor-pointer hover:border-slate-400 transition-all group"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                                            <Truck size={12} className="text-indigo-600" /> PO & Transport (Clickable)
                                        </span>
                                        {showPoDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} className="group-hover:translate-y-0.5 transition-transform" />}
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-500">Customer PO:</span>
                                        <span className="font-mono font-bold text-slate-900 dark:text-white bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded">
                                            {custPoRef}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-500">Vehicle No:</span>
                                        <span className="font-mono font-bold text-slate-900 dark:text-white uppercase">
                                            {dc.vehicleNumber || "-"}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-500">Transport:</span>
                                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                                            {dc.transportationType || "Road Transport"}
                                        </span>
                                    </div>

                                    {/* Expandable PO & Logistics Info */}
                                    {showPoDetails && (
                                        <div className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-700 space-y-1 text-[11px] text-slate-600 dark:text-slate-400 animate-in fade-in">
                                            <div className="flex justify-between"><span>Currency:</span> <span className="font-bold text-slate-900 dark:text-white">{dc.currency || "INR"}</span></div>
                                            <div className="flex justify-between"><span>Exchange Rate:</span> <span className="font-bold text-slate-900 dark:text-white">₹{Number(dc.exchangeRateToINR || 1).toFixed(2)}</span></div>
                                            <div className="flex justify-between"><span>Packaging Type:</span> <span className="font-bold text-slate-900 dark:text-white">{dc.packagingType || "Standard Packaging"}</span></div>
                                            <div className="flex justify-between"><span>Freight:</span> <span className="font-bold text-slate-900 dark:text-white">{getCurrencySymbol(dc.currency)} {transportCharges.toFixed(2)}</span></div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Clickable Line Items Table with Inspection Drawer */}
                            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs bg-white dark:bg-slate-900">
                                <div className="p-3.5 bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                        <Package size={14} className="text-blue-600" />
                                        Line Items ({items.length}) — Click row to inspect details
                                    </h4>
                                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/40 px-2 py-0.5 rounded-full">
                                        Interactive View
                                    </span>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                                        <thead className="bg-slate-50/50 dark:bg-slate-800/30 text-slate-500 uppercase font-bold text-[10px]">
                                            <tr>
                                                <th className="px-4 py-3 text-left">S.No</th>
                                                <th className="px-4 py-3 text-left">Item Name & Technical Description</th>
                                                <th className="px-4 py-3 text-left">HSN/SAC</th>
                                                <th className="px-4 py-3 text-right">Quantity</th>
                                                <th className="px-4 py-3 text-right">Rate</th>
                                                <th className="px-4 py-3 text-right">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                                            {items.map((item: any, idx: number) => {
                                                const isSelected = selectedItemIndex === idx;
                                                const itemName = item.materialName || item.productName || item.name || "Item";
                                                const itemDesc = item.description || item.descriptions || "";
                                                const qty = Number(item.quantity || 0);
                                                const rate = Number(item.rate || 0);
                                                const lineAmt = Number(item.amount || (qty * rate));

                                                return (
                                                    <React.Fragment key={idx}>
                                                        <tr 
                                                            onClick={() => setSelectedItemIndex(isSelected ? null : idx)}
                                                            className={`cursor-pointer transition-colors ${
                                                                isSelected 
                                                                    ? "bg-blue-50/80 dark:bg-blue-950/40" 
                                                                    : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                                                            }`}
                                                        >
                                                            <td className="px-4 py-3.5 text-slate-500 font-mono">{idx + 1}</td>
                                                            <td className="px-4 py-3.5">
                                                                <div className="font-bold text-slate-900 dark:text-white">
                                                                    {itemName}
                                                                </div>
                                                                {itemDesc && (
                                                                    <div className="text-[11px] text-slate-500 italic mt-0.5 line-clamp-1">
                                                                        {itemDesc}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3.5 font-mono text-slate-500">{item.hsnCode || "-"}</td>
                                                            <td className="px-4 py-3.5 text-right font-bold text-slate-900 dark:text-white">
                                                                {qty} <span className="text-[10px] text-slate-400">{item.unit || "PCS"}</span>
                                                            </td>
                                                            <td className="px-4 py-3.5 text-right font-mono">
                                                                {getCurrencySymbol(dc.currency)} {rate.toFixed(2)}
                                                            </td>
                                                            <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                                                                {getCurrencySymbol(dc.currency)} {lineAmt.toFixed(2)}
                                                            </td>
                                                        </tr>

                                                        {/* Expandable Line Item Inspection Drawer */}
                                                        {isSelected && (
                                                            <tr className="bg-blue-50/40 dark:bg-blue-950/20 border-b border-blue-100 dark:border-blue-900">
                                                                <td colSpan={6} className="px-6 py-3.5 animate-in fade-in">
                                                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                                                                        <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-blue-100 dark:border-blue-800/60">
                                                                            <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Material Category</span>
                                                                            <span className="font-bold text-blue-700 dark:text-blue-300 uppercase">
                                                                                {item.itemType || "FG"} Item
                                                                            </span>
                                                                        </div>
                                                                        <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-blue-100 dark:border-blue-800/60 sm:col-span-2">
                                                                            <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Full Technical Description & Specifications</span>
                                                                            <span className="text-slate-700 dark:text-slate-300 italic">
                                                                                {itemDesc || "No additional technical specification recorded."}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </React.Fragment>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Bank Details & Terms Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                
                                {/* Bank Details with 1-Click Copy */}
                                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2.5 text-xs">
                                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                                        <h4 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                                            <CreditCard size={15} className="text-blue-600" />
                                            Company Bank Details
                                        </h4>
                                        <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold">
                                            Click to Copy
                                        </span>
                                    </div>

                                    <div className="space-y-1.5 text-[11px]">
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-500">Bank Name:</span>
                                            <span className="font-bold text-slate-800 dark:text-slate-200">{bankName}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-500">Account Holder:</span>
                                            <span className="font-semibold text-slate-800 dark:text-slate-200">{accountName}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-500">Account Number:</span>
                                            <div className="flex items-center gap-1 font-mono font-bold text-slate-900 dark:text-white">
                                                <span>{accountNumber}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleCopy(accountNumber, 'account')}
                                                    className="p-1 text-slate-400 hover:text-blue-600 rounded cursor-pointer"
                                                    title="Copy Account Number"
                                                >
                                                    {copiedField === 'account' ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                                                </button>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-500">IFSC Code:</span>
                                            <div className="flex items-center gap-1 font-mono font-bold text-slate-900 dark:text-white uppercase">
                                                <span>{ifscCode}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleCopy(ifscCode, 'ifsc')}
                                                    className="p-1 text-slate-400 hover:text-blue-600 rounded cursor-pointer"
                                                    title="Copy IFSC Code"
                                                >
                                                    {copiedField === 'ifsc' ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                                                </button>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-500">Branch:</span>
                                            <span className="font-medium text-slate-700 dark:text-slate-300">{branch}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Custom Dispatch Terms Card */}
                                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2.5 text-xs">
                                    <div className="border-b border-slate-200 dark:border-slate-700 pb-2">
                                        <h4 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                                            <ShieldCheck size={15} className="text-blue-600" />
                                            Dispatch Terms & Conditions
                                        </h4>
                                    </div>

                                    <div className="whitespace-pre-line font-mono text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed max-h-36 overflow-y-auto">
                                        {termsAndConditions}
                                    </div>
                                </div>
                            </div>

                            {/* Financial Summary Box */}
                            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex flex-wrap justify-between items-center gap-3">
                                <div>
                                    <span className="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">Amount in Words</span>
                                    <p className="font-bold text-xs text-slate-800 dark:text-slate-200">
                                        {convertAmountToWords(grandTotal, dc.currency)}
                                    </p>
                                </div>

                                <div className="space-y-1 text-xs text-right">
                                    <div className="text-slate-500">Subtotal: <strong className="font-mono text-slate-900 dark:text-white">{getCurrencySymbol(dc.currency)} {subtotal.toFixed(2)}</strong></div>
                                    {transportCharges > 0 && <div className="text-slate-500">Freight: <strong className="font-mono text-slate-900 dark:text-white">+ {getCurrencySymbol(dc.currency)} {transportCharges.toFixed(2)}</strong></div>}
                                    {packagingCharges > 0 && <div className="text-slate-500">Packaging: <strong className="font-mono text-slate-900 dark:text-white">+ {getCurrencySymbol(dc.currency)} {packagingCharges.toFixed(2)}</strong></div>}
                                    {discount > 0 && <div className="text-emerald-600">Discount: <strong className="font-mono">- {getCurrencySymbol(dc.currency)} {discount.toFixed(2)}</strong></div>}
                                    <div className="text-sm font-extrabold text-blue-600 dark:text-blue-400 pt-1 border-t border-slate-200 dark:border-slate-700">
                                        Total Value: <span className="font-mono">{getCurrencySymbol(dc.currency)} {grandTotal.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>

                        </div>
                    )}

                    {/* MODE 2: AUTHENTIC A4 PRINT VIEW */}
                    {previewMode === "print" && (
                        <div className="flex justify-center bg-slate-100 dark:bg-slate-950/60 p-2 sm:p-6 rounded-2xl overflow-x-auto">
                            <div 
                                id="printable-dc-document"
                                className="bg-white text-black w-full max-w-[210mm] min-h-[297mm] p-8 sm:p-10 shadow-xl border border-slate-300 font-sans text-xs space-y-4"
                            >
                                {/* Header */}
                                <div className="text-center border-b-2 border-black pb-3">
                                    <div className="text-right text-[10px] font-bold uppercase tracking-wider text-slate-600">
                                        {copyBadgeLabel}
                                    </div>
                                    <h1 className="text-xl font-black tracking-wide uppercase mt-1">
                                        {compName}
                                    </h1>
                                    <p className="text-[11px] text-slate-700 max-w-lg mx-auto mt-0.5">
                                        {compAddress}
                                    </p>
                                    <div className="text-[10px] font-semibold mt-1 flex justify-center gap-4">
                                        <span>GSTIN: {compGst}</span>
                                        {compPan !== "N/A" && <span>PAN: {compPan}</span>}
                                        {compPhone && <span>Phone: {compPhone}</span>}
                                    </div>
                                    <div className="inline-block px-4 py-0.5 border-2 border-black font-black text-sm uppercase tracking-widest mt-2">
                                        DELIVERY CHALLAN
                                    </div>
                                </div>

                                {/* Metadata Grid */}
                                <div className="grid grid-cols-2 border border-black divide-x divide-black text-[11px]">
                                    <div className="p-2.5 space-y-1">
                                        <div className="font-bold uppercase text-slate-600 text-[9px]">CONSIGNEE / DELIVER TO:</div>
                                        <div className="font-black text-sm">{custName}</div>
                                        <div className="text-slate-700">{custAddress}</div>
                                        <div><strong>GSTIN:</strong> {custGst}</div>
                                        {custPhone !== "-" && <div><strong>Phone:</strong> {custPhone}</div>}
                                    </div>
                                    <div className="p-2.5 space-y-1 font-mono">
                                        <div className="flex justify-between"><span>DC NUMBER:</span> <strong className="font-black">{dc.dcNumber}</strong></div>
                                        <div className="flex justify-between"><span>DC DATE:</span> <strong>{new Date(dc.date || dc.createdAt).toLocaleDateString('en-IN')}</strong></div>
                                        <div className="flex justify-between"><span>PO REF:</span> <strong>{custPoRef}</strong></div>
                                        <div className="flex justify-between"><span>VEHICLE NO:</span> <strong className="uppercase">{dc.vehicleNumber || "-"}</strong></div>
                                        <div className="flex justify-between"><span>TRANSPORT:</span> <strong>{dc.transportationType || "Road"}</strong></div>
                                    </div>
                                </div>

                                {/* Items Table */}
                                <table className="w-full border-collapse border border-black text-[11px]">
                                    <thead>
                                        <tr className="bg-slate-100 border-b border-black font-bold uppercase text-[10px]">
                                            <th className="border border-black p-1.5 w-8 text-center">S.No</th>
                                            <th className="border border-black p-1.5 text-left">Description of Goods</th>
                                            <th className="border border-black p-1.5 text-center w-20">HSN/SAC</th>
                                            <th className="border border-black p-1.5 text-right w-16">Qty</th>
                                            <th className="border border-black p-1.5 text-center w-12">Unit</th>
                                            <th className="border border-black p-1.5 text-right w-20">Rate</th>
                                            <th className="border border-black p-1.5 text-right w-24">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((item: any, iIdx: number) => {
                                            const itemName = item.materialName || item.productName || item.name || "Item";
                                            const itemDesc = item.description || item.descriptions || "";
                                            const qty = Number(item.quantity || 0);
                                            const rate = Number(item.rate || 0);
                                            const lineAmt = Number(item.amount || (qty * rate));

                                            return (
                                                <tr key={iIdx} className="border-b border-black">
                                                    <td className="border border-black p-1.5 text-center">{iIdx + 1}</td>
                                                    <td className="border border-black p-1.5">
                                                        <div className="font-bold">{itemName}</div>
                                                        {itemDesc && <div className="text-[10px] text-slate-600 italic mt-0.5">{itemDesc}</div>}
                                                    </td>
                                                    <td className="border border-black p-1.5 text-center font-mono">{item.hsnCode || "-"}</td>
                                                    <td className="border border-black p-1.5 text-right font-bold">{qty}</td>
                                                    <td className="border border-black p-1.5 text-center uppercase">{item.unit || "PCS"}</td>
                                                    <td className="border border-black p-1.5 text-right font-mono">{rate.toFixed(2)}</td>
                                                    <td className="border border-black p-1.5 text-right font-mono font-bold">{lineAmt.toFixed(2)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot>
                                        <tr className="border-t border-black font-bold">
                                            <td colSpan={6} className="border border-black p-1.5 text-right uppercase">Subtotal:</td>
                                            <td className="border border-black p-1.5 text-right font-mono">{subtotal.toFixed(2)}</td>
                                        </tr>
                                        {transportCharges > 0 && (
                                            <tr className="border-t border-black">
                                                <td colSpan={6} className="border border-black p-1 text-right">Freight Charges:</td>
                                                <td className="border border-black p-1 text-right font-mono">{transportCharges.toFixed(2)}</td>
                                            </tr>
                                        )}
                                        {packagingCharges > 0 && (
                                            <tr className="border-t border-black">
                                                <td colSpan={6} className="border border-black p-1 text-right">Packaging Charges:</td>
                                                <td className="border border-black p-1 text-right font-mono">{packagingCharges.toFixed(2)}</td>
                                            </tr>
                                        )}
                                        {discount > 0 && (
                                            <tr className="border-t border-black text-emerald-800">
                                                <td colSpan={6} className="border border-black p-1 text-right">Discount:</td>
                                                <td className="border border-black p-1 text-right font-mono">- {discount.toFixed(2)}</td>
                                            </tr>
                                        )}
                                        <tr className="border-t-2 border-black font-black text-sm bg-slate-50">
                                            <td colSpan={6} className="border border-black p-2 text-right uppercase">Total Challan Value ({dc.currency || "INR"}):</td>
                                            <td className="border border-black p-2 text-right font-mono">{grandTotal.toFixed(2)}</td>
                                        </tr>
                                    </tfoot>
                                </table>

                                {/* Amount in Words */}
                                <div className="border border-black p-2 text-[11px]">
                                    <strong>Amount in Words:</strong> {convertAmountToWords(grandTotal, dc.currency)}
                                </div>

                                {/* Bank Details & Terms & Signatory Box */}
                                <div className="grid grid-cols-2 border border-black divide-x divide-black text-[10px]">
                                    <div className="p-2 space-y-1.5">
                                        <div className="font-bold uppercase text-slate-600">Company Bank Details:</div>
                                        <div><strong>Bank:</strong> {bankName}</div>
                                        <div><strong>A/C Name:</strong> {accountName}</div>
                                        <div><strong>A/C Number:</strong> {accountNumber}</div>
                                        <div><strong>IFSC Code:</strong> {ifscCode}</div>
                                        <div><strong>Branch:</strong> {branch}</div>

                                        <div className="pt-2 border-t border-slate-300">
                                            <div className="font-bold uppercase text-slate-600">Terms & Conditions:</div>
                                            <div className="whitespace-pre-line text-slate-700 leading-snug">{termsAndConditions}</div>
                                        </div>
                                    </div>

                                    <div className="p-2 flex flex-col justify-between text-right">
                                        <div className="font-bold">For {compName}</div>
                                        <div className="pt-16">
                                            <div className="border-t border-black inline-block w-40 text-center font-bold pt-1">
                                                Authorized Signatory
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="text-center text-[9px] text-slate-500 pt-1">
                                    This is a computer generated document.
                                </div>
                            </div>
                        </div>
                    )}

                </div>

                {/* Footer Controls */}
                <div className="no-print p-4 sm:p-5 bg-slate-50 dark:bg-slate-900 flex flex-wrap justify-between items-center gap-3 border-t border-slate-200 dark:border-slate-800 flex-shrink-0">
                    <div className="flex flex-wrap gap-2.5">
                        <button
                            onClick={handleNativePrint}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/20 transition-all flex items-center gap-2 cursor-pointer"
                        >
                            <Printer size={15} /> Print Document
                        </button>
                        <button
                            onClick={handleDownloadPDF}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/20 transition-all flex items-center gap-2 cursor-pointer"
                        >
                            <Download size={15} /> Download PDF
                        </button>
                        <button
                            onClick={handleDownloadExcel}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 transition-all flex items-center gap-2 cursor-pointer"
                        >
                            <FileText size={15} /> Export Excel
                        </button>

                        {/* Edit button with 24h timer check */}
                        {onEdit && isWithin24h && (
                            <button
                                onClick={() => { onClose(); onEdit(dc); }}
                                className="px-4 py-2 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-600 text-blue-600 hover:text-white font-bold text-xs rounded-xl border border-blue-200 dark:border-blue-800 transition-all flex items-center gap-1.5 cursor-pointer"
                                title={`Allowed for another ${formatRemainingTime(remainingSecs)}`}
                            >
                                <Edit2 size={15} /> Edit DC ({formatRemainingTime(remainingSecs)})
                            </button>
                        )}

                        {/* Delete button with 24h timer check */}
                        {onDelete && isWithin24h && (
                            <button
                                onClick={() => {
                                    if (confirm(`Are you sure you want to delete Delivery Challan ${dc.dcNumber || ''}? Inventory will be restored and Customer PO status will revert.`)) {
                                        onClose();
                                        onDelete(dc._id || dc.id);
                                    }
                                }}
                                className="px-4 py-2 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-600 text-rose-600 hover:text-white font-bold text-xs rounded-xl border border-rose-200 dark:border-rose-800 transition-all flex items-center gap-1.5 cursor-pointer"
                                title={`Allowed for another ${formatRemainingTime(remainingSecs)}`}
                            >
                                <Trash2 size={15} /> Delete DC
                            </button>
                        )}
                    </div>

                    <button
                        onClick={onClose}
                        className="px-5 py-2 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
                    >
                        Close
                    </button>
                </div>

            </div>
        </div>
    );
}

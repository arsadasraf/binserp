import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { Edit2, Trash2, Download, Truck, FileText, Search, User, Calendar, X, Eye, Plus, Clock, Lock, Coins, TrendingUp, Globe, ChevronDown, ChevronUp, RotateCcw, Tag, Settings, IndianRupee, Filter, LayoutGrid, ShieldCheck } from 'lucide-react';
import { CompanyInfo } from "@/src/features/store/types/store.types";
import { download4CopyPDF, downloadFrontendExcel, downloadInvoiceExcelDocument } from '@/src/utils/frontendDocumentHelper';
import { getCurrencySymbol, normalizeCurrencyCode } from '@/src/utils/currencyHelper';
import { useExchangeRates } from '@/src/hooks/useExchangeRates';
import { useTimeLockPolicy } from '@/src/hooks/useTimeLockPolicy';
import InvoicePreviewModal from '../modals/InvoicePreviewModal';
import SearchableMultiSelect from '../SearchableMultiSelect';

interface BillingTableProps {
    data: any[];
    companyInfo?: CompanyInfo;
    onEdit: (item: any) => void;
    onDelete: (id: string) => void;
    onAddBill?: () => void;
    addLabel?: string;
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

export default function BillingTable({ data = [], companyInfo, onEdit, onDelete, onAddBill, addLabel = "Add Invoice" }: BillingTableProps) {
    const { exchangeRates, convertToINR } = useExchangeRates();
    const isPurchase = (addLabel || "").toLowerCase().includes("purchase") || (addLabel || "").toLowerCase().includes("bill");
    const currentMonthStr = useMemo(() => getCurrentMonth(), []);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedCustomerFilters, setSelectedCustomerFilters] = useState<string[]>([]);
    const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth);
    const [selectedDay, setSelectedDay] = useState("");
    const [selectedInvoicePreview, setSelectedInvoicePreview] = useState<any | null>(null);
    const [showDashboard, setShowDashboard] = useState<boolean>(false);
    const [showFilters, setShowFilters] = useState<boolean>(false);

    // Live 1-second ticking timer for dynamic edit/delete countdown
    const [nowTime, setNowTime] = useState(Date.now());
    useEffect(() => {
        const timer = setInterval(() => setNowTime(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    const { getPolicyHours } = useTimeLockPolicy();

    const getRemainingEditSeconds = (createdAt: string | Date | undefined) => {
        if (!createdAt) return 0;
        const policyHours = getPolicyHours('invoice');
        if (policyHours === -1) return Infinity;
        if (policyHours <= 0) return 0;
        const created = new Date(createdAt).getTime();
        if (isNaN(created)) return 0;
        const elapsed = Math.floor((nowTime - created) / 1000);
        const limit = policyHours * 3600;
        return Math.max(0, limit - elapsed);
    };

    const isEditAllowed = (createdAt: string | Date | undefined) => {
        const policyHours = getPolicyHours('invoice');
        if (policyHours === -1) return true;
        if (policyHours <= 0) return false;
        return getRemainingEditSeconds(createdAt) > 0;
    };

    const formatRemainingTime = (totalSeconds: number) => {
        if (totalSeconds === Infinity) return 'Unlimited';
        if (totalSeconds <= 0) return '00:00:00';
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };

    const handleDeleteSafe = (item: any) => {
        if (!isEditAllowed(item.createdAt || item.date)) {
            const hrs = getPolicyHours('invoice');
            alert(hrs <= 0 
                ? "This Tax Invoice cannot be deleted because it is locked immediately upon creation by company policy." 
                : `This Tax Invoice cannot be deleted because the ${hrs}-hour edit/delete window has expired.`);
            return;
        }
        if (window.confirm(`Are you sure you want to delete Tax Invoice #${item.invoiceNumber || ''}? This will return inventory stock and adjust linked Customer PO status.`)) {
            onDelete(item._id);
        }
    };

    const customerOptions = useMemo(() => {
        const list: { value: string; label: string }[] = [];
        const seen = new Set();
        (data || []).forEach(item => {
            const custId = typeof item.customer === 'object' ? item.customer?._id : item.customer;
            const custName = item.customerName || item.customer?.name || item.customer?.companyName || item.vendorName || item.vendor?.name || '';
            const key = custId?.toString() || custName;
            if (key && !seen.has(key)) {
                seen.add(key);
                list.push({ value: key, label: custName || (isPurchase ? 'Vendor' : 'Customer') });
            }
        });
        return list;
    }, [data, isPurchase]);

    const filteredData = useMemo(() => {
        return (data || []).filter((item: any) => {
            if (!item) return false;

            if (selectedCustomerFilters.length > 0 && !selectedCustomerFilters.includes('all') && !selectedCustomerFilters.includes('All')) {
                const custId = (typeof item.customer === 'object' ? item.customer?._id : item.customer)?.toString();
                const custName = item.customerName || item.customer?.name || item.customer?.companyName || item.vendorName || item.vendor?.name || '';
                const matches = (custId && selectedCustomerFilters.includes(custId)) || (custName && selectedCustomerFilters.includes(custName));
                if (!matches) {
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
                const custName = (item.customerName || item.customer?.name || item.customer?.companyName || item.vendorName || item.vendor?.name || '').toLowerCase();
                const poRef = (item.customerPoReference || '').toLowerCase();
                const dcRef = (item.dcNumber || item.dcReference || '').toLowerCase();
                const matchItems = Array.isArray(item.items) && item.items.some((it: any) =>
                    (it.productName || it.name || it.description || it.fgItem?.name || '').toLowerCase().includes(term)
                );
                if (!invNum.includes(term) && !custName.includes(term) && !poRef.includes(term) && !dcRef.includes(term) && !matchItems) {
                    return false;
                }
            }
            return true;
        });
    }, [data, selectedCustomerFilters, selectedMonth, selectedDay, searchTerm]);

    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (selectedCustomerFilters.length > 0 && !selectedCustomerFilters.includes('all') && !selectedCustomerFilters.includes('All')) count++;
        if (selectedMonth !== currentMonthStr) count++;
        if (selectedDay !== '') count++;
        if (searchTerm.trim() !== '') count++;
        return count;
    }, [selectedCustomerFilters, selectedMonth, currentMonthStr, selectedDay, searchTerm]);

    const hasActiveFilters = activeFilterCount > 0;

    const resetFilters = () => {
        setSelectedCustomerFilters([]);
        setSelectedMonth(currentMonthStr);
        setSelectedDay('');
        setSearchTerm('');
    };

    // Dynamic Invoice / Bill KPIs calculated on filtered dataset
    const billingKPIs = useMemo(() => {
        let totalInvoicedInr = 0;
        const totalCount = (filteredData || []).length;
        let currentMonthInr = 0;
        let currentMonthCount = 0;
        let within24hCount = 0;
        const customerSet = new Set<string>();
        const currencyTotals: Record<string, number> = {};
        const currencyInrTotals: Record<string, number> = {};

        const now = Date.now();
        (filteredData || []).forEach((item: any) => {
            const amt = Number(item.grandTotal || item.totalAmount || item.subtotal || 0);
            const curr = normalizeCurrencyCode(item.currency || 'INR');
            const inrVal = convertToINR(amt, curr).inrAmount;

            totalInvoicedInr += inrVal;
            currencyTotals[curr] = (currencyTotals[curr] || 0) + amt;
            currencyInrTotals[curr] = (currencyInrTotals[curr] || 0) + inrVal;

            const custId = typeof item.customer === 'object' ? item.customer?._id : item.customer;
            const custName = item.customerName || item.customer?.name || item.customer?.companyName || item.vendorName || item.vendor?.name || '';
            if (custId || custName) customerSet.add(custId || custName);

            const rawDate = item.createdAt || item.date;
            if (rawDate) {
                const d = new Date(rawDate);
                if (!isNaN(d.getTime())) {
                    const itemMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                    if (itemMonth === currentMonthStr) {
                        currentMonthInr += inrVal;
                        currentMonthCount += 1;
                    }
                    const policyHours = getPolicyHours('invoice');
                    if (policyHours === -1) {
                        within24hCount += 1;
                    } else if (policyHours > 0) {
                        const elapsedSecs = Math.floor((now - d.getTime()) / 1000);
                        if (elapsedSecs < policyHours * 3600) {
                            within24hCount += 1;
                        }
                    }
                }
            }
        });

        return {
            totalInvoicedInr,
            formattedTotalInvoicedInr: `₹${totalInvoicedInr.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            totalCount,
            currentMonthInr,
            formattedCurrentMonthInr: `₹${currentMonthInr.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            currentMonthCount,
            within24hCount,
            customerCount: customerSet.size,
            currencyTotals,
            currencyInrTotals,
            hasForeign: Object.keys(currencyTotals).some(c => c !== 'INR' && currencyTotals[c] > 0)
        };
    }, [filteredData, currentMonthStr, convertToINR]);

    return (
        <div className="w-full space-y-4 animate-in fade-in duration-300">
            {/* Executive KPI Overview (Collapsible) */}
            <div className="space-y-3">
                {!showDashboard ? (
                    /* Collapsed Compact State */
                    <div className="hidden sm:flex bg-slate-100/90 dark:bg-slate-800/80 px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700/60 items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-3 overflow-x-auto py-0.5">
                            <span className="font-extrabold uppercase tracking-wider text-[11px] text-slate-500 dark:text-slate-400 shrink-0 flex items-center gap-1.5">
                                <IndianRupee size={13} className="text-emerald-600" /> {isPurchase ? "Billing Overview:" : "Invoice Overview:"}
                            </span>
                            <span className="font-bold text-slate-700 dark:text-slate-200 shrink-0">
                                Total: <strong className="text-emerald-600 font-mono">{billingKPIs.formattedTotalInvoicedInr}</strong> ({filteredData.length})
                            </span>
                            {hasActiveFilters && (
                                <span className="px-1.5 py-0.2 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 rounded text-[9px] font-bold border border-emerald-200 dark:border-emerald-800 shrink-0">
                                    Filtered
                                </span>
                            )}
                            <span className="text-slate-300 dark:text-slate-600">|</span>
                            <span className="text-slate-600 dark:text-slate-300 shrink-0">
                                This Month: <strong className="text-purple-600 font-mono">{billingKPIs.formattedCurrentMonthInr}</strong> ({billingKPIs.currentMonthCount})
                            </span>
                            <span className="text-slate-300 dark:text-slate-600">|</span>
                            <span className="text-slate-600 dark:text-slate-300 shrink-0">
                                Active 24H: <strong className="text-amber-600 font-mono">{billingKPIs.within24hCount}</strong>
                            </span>
                            <span className="text-slate-300 dark:text-slate-600">|</span>
                            <span className="text-slate-600 dark:text-slate-300 shrink-0">
                                Accounts: <strong className="text-blue-600 font-mono">{billingKPIs.customerCount}</strong>
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowDashboard(true)}
                            className="text-xs font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 flex items-center gap-1 shrink-0 cursor-pointer px-2 py-1 rounded-lg hover:bg-emerald-50 dark:hover:bg-slate-700 transition-colors"
                            title="Show Executive KPI Dashboard"
                        >
                            <span className="hidden sm:inline">Show Dashboard</span>
                            <span className="sm:hidden text-[11px]">Stats</span>
                            <ChevronDown size={14} />
                        </button>
                    </div>
                ) : (
                    /* Expanded 4 KPI Cards */
                    <>
                        {/* Top Dashboard Header with Title and Accessible Hide / Collapse Button */}
                        <div className="flex items-center justify-between pb-1 px-1">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                    {isPurchase ? "Executive Vendor Bill Dashboard" : "Executive Invoice Dashboard"}
                                </span>
                                {hasActiveFilters && (
                                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">
                                        Filtered ({filteredData.length} of {data.length})
                                    </span>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowDashboard(false)}
                                className="px-2.5 py-1 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1 cursor-pointer border border-slate-200 dark:border-slate-700"
                                title="Hide Executive KPI Dashboard"
                            >
                                <ChevronUp size={14} />
                                <span>Hide</span>
                            </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                            {/* Card 1: Total Invoiced Value */}
                            <div className="bg-gradient-to-br from-emerald-50/90 via-white to-slate-50 dark:from-emerald-950/30 dark:via-slate-900 dark:to-slate-900 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-900/40 shadow-xs relative overflow-hidden">
                                <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-2">
                                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                        {isPurchase ? "Total Bill Value (INR)" : "Total Invoiced Value (INR)"}
                                    </span>
                                    <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                                        <IndianRupee size={16} />
                                    </div>
                                </div>
                                <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono tracking-tight truncate">
                                    {billingKPIs.formattedTotalInvoicedInr}
                                </div>
                                <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                                    <span>Cumulative Gross</span>
                                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{billingKPIs.totalCount} Documents</span>
                                </div>
                            </div>

                            {/* Card 2: Current Month Invoiced */}
                            <div className="bg-gradient-to-br from-purple-50/90 via-white to-slate-50 dark:from-purple-950/30 dark:via-slate-900 dark:to-slate-900 p-4 rounded-2xl border border-purple-100 dark:border-purple-900/40 shadow-xs relative overflow-hidden">
                                <div className="flex items-center justify-between text-purple-600 dark:text-purple-400 mb-2">
                                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">This Month Invoiced</span>
                                    <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center">
                                        <Calendar size={16} />
                                    </div>
                                </div>
                                <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono tracking-tight truncate">
                                    {billingKPIs.formattedCurrentMonthInr}
                                </div>
                                <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                                    <span>Current Cycle</span>
                                    <span className="font-bold text-purple-600 dark:text-purple-400">{billingKPIs.currentMonthCount} Invoices</span>
                                </div>
                            </div>

                            {/* Card 3: Active Action Window */}
                            <div className="bg-gradient-to-br from-amber-50/90 via-white to-slate-50 dark:from-amber-950/30 dark:via-slate-900 dark:to-slate-900 p-4 rounded-2xl border border-amber-100 dark:border-amber-900/40 shadow-xs relative overflow-hidden">
                                <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 mb-2">
                                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">24-Hour Active Window</span>
                                    <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                                        <Clock size={16} />
                                    </div>
                                </div>
                                <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono tracking-tight truncate">
                                    {billingKPIs.within24hCount} Invoices
                                </div>
                                <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                                    <span>Editable / Reversible</span>
                                    <span className="font-bold text-amber-600 dark:text-amber-400">&lt; 24h Old</span>
                                </div>
                            </div>

                            {/* Card 4: Accounts Invoiced */}
                            <div className="bg-gradient-to-br from-blue-50/90 via-white to-slate-50 dark:from-blue-950/30 dark:via-slate-900 dark:to-slate-900 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/40 shadow-xs relative overflow-hidden">
                                <div className="flex items-center justify-between text-blue-600 dark:text-blue-400 mb-2">
                                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                        {isPurchase ? "Active Vendors" : "Active Clients"}
                                    </span>
                                    <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                                        <User size={16} />
                                    </div>
                                </div>
                                <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono tracking-tight truncate">
                                    {billingKPIs.customerCount} Accounts
                                </div>
                                <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                                    <span>Billed Parties</span>
                                    <span className="font-bold text-blue-600 dark:text-blue-400">Verified</span>
                                </div>
                            </div>
                        </div>

                        {/* Benchmark Exchange Rates & Store Prefix Setting Link */}
                        <div className="bg-slate-50 dark:bg-slate-900/60 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs flex flex-wrap items-center justify-between gap-2 text-slate-500 dark:text-slate-400">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                    <Tag size={12} className="text-indigo-500" />
                                    <span>Store Prefix Conversion Active:</span>
                                </span>
                                <span className="font-mono text-[11px]">
                                    USD: ₹{exchangeRates.USD?.toFixed(2) || '84.50'} | EUR: ₹{exchangeRates.EUR?.toFixed(2) || '92.00'} | GBP: ₹{exchangeRates.GBP?.toFixed(2) || '108.00'}
                                </span>
                            </div>

                            <Link 
                                href="/dashboard/store/masters/prefix-settings"
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 hover:underline shrink-0"
                            >
                                <Settings size={11} />
                                <span>Manage Exchange Rates</span>
                            </Link>
                        </div>

                        {/* Foreign Currency Breakdown Chips */}
                        {billingKPIs.hasForeign && (
                            <div className="flex flex-wrap items-center gap-1.5 text-xs bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                                <span className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mr-1">Foreign Breakdown:</span>
                                {Object.keys(billingKPIs.currencyTotals).map(curr => {
                                    const amt = billingKPIs.currencyTotals[curr];
                                    if (amt <= 0) return null;
                                    const sym = getCurrencySymbol(curr);
                                    const isForeign = curr !== 'INR';
                                    return (
                                        <div key={curr} className="px-2 py-0.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] font-medium flex items-center gap-1">
                                            <span className="font-bold text-slate-700 dark:text-slate-200">{sym}{amt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {curr}</span>
                                            {isForeign && (
                                                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold font-mono">
                                                    (≈ ₹{(billingKPIs.currencyInrTotals[curr] || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })})
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Top Control & Filter Bar */}
            <div className="bg-white dark:bg-slate-900 p-2.5 sm:p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2.5">
                {/* Main Control Row - Fits in a SINGLE line on Desktop (`lg:flex`) */}
                <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2 sm:gap-2.5">
                    {/* Left & Center: Search + Desktop Inline Filters */}
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                        {/* Search Input: Compact on desktop so filters fit in the same line */}
                        <div className="relative flex-1 lg:flex-initial lg:w-48 xl:w-56 shrink-0">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <input
                                type="text"
                                placeholder={isPurchase ? "Search Bill No, Vendor, PO Ref..." : "Search Invoice No, Customer, PO Ref..."}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-8 pr-7 py-1.5 bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                            />
                            {searchTerm && (
                                <button
                                    type="button"
                                    onClick={() => setSearchTerm('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                                    title="Clear search"
                                >
                                    <X size={13} />
                                </button>
                            )}
                        </div>

                        {/* Inline Filters on Desktop (`lg:flex`) */}
                        <div className="hidden lg:flex items-center gap-2 flex-wrap min-w-0">
                            {/* Customer / Vendor Filter */}
                            <SearchableMultiSelect
                                options={customerOptions}
                                selectedValues={selectedCustomerFilters}
                                onChange={setSelectedCustomerFilters}
                                placeholder={isPurchase ? "All Vendors" : "All Customers"}
                                searchPlaceholder={isPurchase ? "Search vendor..." : "Search customer..."}
                                className="w-40 xl:w-52"
                            />

                            {/* Month Filter */}
                            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                                <Calendar size={13} className="text-purple-500 shrink-0" />
                                <span className="font-bold text-slate-500 hidden xl:inline">Month:</span>
                                <input
                                    type="month"
                                    value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(e.target.value)}
                                    className="bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer text-center"
                                />
                                {selectedMonth && (
                                    <button
                                        type="button"
                                        onClick={() => setSelectedMonth("")}
                                        className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                                        title="Clear Month"
                                    >
                                        <X size={12} />
                                    </button>
                                )}
                            </div>

                            {/* Day Filter */}
                            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                                <Calendar size={13} className="text-emerald-500 shrink-0" />
                                <span className="font-bold text-slate-500 hidden xl:inline">Day:</span>
                                <input
                                    type="date"
                                    value={selectedDay}
                                    onChange={(e) => setSelectedDay(e.target.value)}
                                    className="bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                                />
                                {selectedDay && (
                                    <button
                                        type="button"
                                        onClick={() => setSelectedDay("")}
                                        className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                                        title="Clear Day"
                                    >
                                        <X size={12} />
                                    </button>
                                )}
                            </div>

                            {/* Reset Filters */}
                            {hasActiveFilters && (
                                <button
                                    type="button"
                                    onClick={resetFilters}
                                    className="p-1.5 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-800 transition-all flex items-center gap-1 cursor-pointer shrink-0 text-xs font-bold"
                                    title="Reset all filters"
                                >
                                    <RotateCcw size={13} />
                                    <span className="hidden xl:inline">Reset</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Right Action Group: Mobile Toggles + Dashboard Toggle + Actions */}
                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 self-end lg:self-auto">
                        {/* Mobile Only: Small Filter Toggle Icon */}
                        <button
                            type="button"
                            onClick={() => setShowFilters(prev => !prev)}
                            className={`lg:hidden p-2 rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer border ${
                                showFilters || hasActiveFilters
                                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-300'
                                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                            }`}
                            title={showFilters ? "Hide Filters" : "Show Filters"}
                            aria-label="Toggle Filters"
                        >
                            <Filter size={15} />
                            {hasActiveFilters && (
                                <span className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[10px] flex items-center justify-center font-bold">
                                    {activeFilterCount}
                                </span>
                            )}
                        </button>

                        {/* Executive KPI Dashboard Toggle: Small icon on mobile, compact labeled button on desktop */}
                        <button
                            type="button"
                            onClick={() => setShowDashboard(prev => !prev)}
                            className={`p-2 sm:px-2.5 sm:py-1.5 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${
                                showDashboard
                                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-300'
                                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                            }`}
                            title={showDashboard ? "Hide Invoice Dashboard" : "Show Invoice Dashboard"}
                            aria-label="Toggle Dashboard"
                        >
                            <LayoutGrid size={15} />
                            <span className="hidden sm:inline">{showDashboard ? "Hide" : "Dashboard"}</span>
                        </button>

                        {onAddBill && (
                            <button
                                type="button"
                                onClick={onAddBill}
                                className="px-2.5 sm:px-3.5 py-1.5 sm:py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                            >
                                <Plus size={15} />
                                <span className="hidden sm:inline">{addLabel}</span>
                                <span className="sm:hidden">{isPurchase ? "Add Bill" : "Add Invoice"}</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Mobile Collapsible Filter Drawer */}
                {showFilters && (
                    <div className="lg:hidden pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-2 animate-in fade-in duration-200">
                        <div className="flex items-center justify-between pb-1">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Filter Options</span>
                            <button
                                type="button"
                                onClick={() => setShowFilters(false)}
                                className="text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center gap-0.5"
                            >
                                <ChevronUp size={13} />
                                <span>Collapse</span>
                            </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {/* Customer / Vendor Filter */}
                            <div className="flex flex-col gap-1">
                                <label className="text-[11px] font-bold text-slate-500">{isPurchase ? "Vendor" : "Customer"}</label>
                                <SearchableMultiSelect
                                    options={customerOptions}
                                    selectedValues={selectedCustomerFilters}
                                    onChange={setSelectedCustomerFilters}
                                    placeholder={isPurchase ? "All Vendors" : "All Customers"}
                                    searchPlaceholder={isPurchase ? "Search vendor..." : "Search customer..."}
                                    className="w-full"
                                />
                            </div>

                            {/* Month Filter */}
                            <div className="flex flex-col gap-1">
                                <label className="text-[11px] font-bold text-slate-500">Month</label>
                                <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                                    <Calendar size={13} className="text-purple-500 shrink-0" />
                                    <input
                                        type="month"
                                        value={selectedMonth}
                                        onChange={(e) => setSelectedMonth(e.target.value)}
                                        className="flex-1 bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 outline-none text-center"
                                    />
                                    {selectedMonth && (
                                        <button
                                            type="button"
                                            onClick={() => setSelectedMonth("")}
                                            className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                        >
                                            <X size={12} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Day Filter */}
                            <div className="flex flex-col gap-1 sm:col-span-2">
                                <label className="text-[11px] font-bold text-slate-500">Day (Exact Date)</label>
                                <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                                    <Calendar size={13} className="text-emerald-500 shrink-0" />
                                    <input
                                        type="date"
                                        value={selectedDay}
                                        onChange={(e) => setSelectedDay(e.target.value)}
                                        className="flex-1 bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 outline-none"
                                    />
                                    {selectedDay && (
                                        <button
                                            type="button"
                                            onClick={() => setSelectedDay("")}
                                            className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                        >
                                            <X size={12} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Mobile Reset Action */}
                        {hasActiveFilters && (
                            <div className="flex items-center justify-end pt-1">
                                <button
                                    type="button"
                                    onClick={resetFilters}
                                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-center gap-1"
                                >
                                    <RotateCcw size={12} />
                                    <span>Reset Filters</span>
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {filteredData.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                    <FileText className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                    <p className="text-slate-700 dark:text-slate-200 text-base font-bold">
                        {hasActiveFilters ? "No Tax Invoices Match Your Filters" : "No Tax Invoices Found"}
                    </p>
                    <p className="text-slate-400 text-xs mt-1">
                        {hasActiveFilters ? "Try adjusting your search, customer, month, or day filter." : "Create a Tax Invoice to bill dispatched deliveries."}
                    </p>
                    {hasActiveFilters && (
                        <button
                            type="button"
                            onClick={resetFilters}
                            className="mt-3.5 px-4 py-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold text-xs rounded-xl border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                        >
                            <RotateCcw size={13} />
                            <span>Reset All Filters</span>
                        </button>
                    )}
                </div>
            ) : (
                <>
                    {/* Desktop Table View - Scrollable with Sticky Header */}
                    <div className="hidden md:block overflow-x-auto overflow-y-auto max-h-[calc(100vh-270px)] min-h-[350px] rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-800">
                            <thead className="sticky top-0 z-10 bg-indigo-50/90 dark:bg-slate-800 border-b border-indigo-100 dark:border-slate-700 shadow-2xs">
                                <tr>
                                    <th className="px-6 py-3.5 text-left font-semibold text-indigo-900 dark:text-indigo-200 text-xs tracking-wider uppercase">S.No</th>
                                    <th className="px-6 py-3.5 text-left font-semibold text-indigo-900 dark:text-indigo-200 text-xs tracking-wider uppercase">{isPurchase ? "Bill / Invoice #" : "Invoice Number"}</th>
                                    <th className="px-6 py-3.5 text-left font-semibold text-indigo-900 dark:text-indigo-200 text-xs tracking-wider uppercase">{isPurchase ? "Linked GRN / JW / PO" : "PO / DC Ref"}</th>
                                    <th className="px-6 py-3.5 text-left font-semibold text-indigo-900 dark:text-indigo-200 text-xs tracking-wider uppercase">{isPurchase ? "Vendor Name" : "Customer Name"}</th>
                                    <th className="px-6 py-3.5 text-left font-semibold text-indigo-900 dark:text-indigo-200 text-xs tracking-wider uppercase">Items</th>
                                    <th className="px-6 py-3.5 text-left font-semibold text-indigo-900 dark:text-indigo-200 text-xs tracking-wider uppercase">Created By</th>
                                    <th className="px-6 py-3.5 text-left font-semibold text-indigo-900 dark:text-indigo-200 text-xs tracking-wider uppercase">Creation Date & Time</th>
                                    <th className="px-6 py-3.5 text-right font-semibold text-indigo-900 dark:text-indigo-200 text-xs tracking-wider uppercase">Invoice Amount</th>
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
                                            {isPurchase ? (
                                                <div className="space-y-0.5">
                                                    {(item.grnNumber || item.grn?.grnNumber) && (
                                                        <span className="inline-block px-2 py-0.5 text-[11px] font-bold rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                                            GRN: {item.grn?.grnNumber || item.grnNumber}
                                                        </span>
                                                    )}
                                                    {item.jobWorkChallanNumber && (
                                                        <span className="inline-block px-2 py-0.5 text-[11px] font-bold rounded-md bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                                            JW: {item.jobWorkChallanNumber}
                                                        </span>
                                                    )}
                                                    {item.purchaseOrder?.poNumber && (
                                                        <span className="block text-[10px] text-slate-500 font-mono">PO: {item.purchaseOrder?.poNumber}</span>
                                                    )}
                                                    {!item.grnNumber && !item.grn?.grnNumber && !item.jobWorkChallanNumber && (
                                                        item.customerPoReference || item.dcNumber || "-"
                                                    )}
                                                    {item.billType === "job-work-service" && (
                                                        <span className="block text-[10px] text-purple-600 font-semibold">Job Work Service</span>
                                                    )}
                                                </div>
                                            ) : (
                                                item.customerPoReference || item.dcNumber || "-"
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-white">
                                            {item.vendorName || item.vendor?.name || item.customerName || item.customer?.name || item.customer?.companyName || "-"}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                                            <div className="max-w-[240px]">
                                                <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                                                    {item.items?.[0]?.materialName || item.items?.[0]?.productName || item.items?.[0]?.itemName || 'Item'}
                                                </div>
                                                {(item.items?.[0]?.description || item.items?.[0]?.descriptions) && (
                                                    <div className="text-[11px] text-slate-500 italic mt-0.5 line-clamp-1">
                                                        {item.items?.[0]?.description || item.items?.[0]?.descriptions}
                                                    </div>
                                                )}
                                                {item.items?.length > 1 && (
                                                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">
                                                        (+{item.items.length - 1} more items)
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
                                            {(() => {
                                                const amt = Number(item.grandTotal || item.totalAmount || item.subtotal || 0);
                                                const curr = normalizeCurrencyCode(item.currency || 'INR');
                                                const inr = convertToINR(amt, curr);
                                                return (
                                                    <div>
                                                        <div className="font-extrabold text-sm text-slate-900 dark:text-white font-mono flex items-center justify-end gap-1.5">
                                                            <span>{getCurrencySymbol(curr)}{amt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                                                {curr}
                                                            </span>
                                                        </div>
                                                        {inr.isForeign ? (
                                                            <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5" title={`Rate: 1 ${curr} = ₹${inr.rate.toFixed(2)}`}>
                                                                ≈ {inr.formattedINR} <span className="font-normal text-slate-400">(@ ₹{inr.rate.toFixed(2)})</span>
                                                            </div>
                                                        ) : (
                                                            <div className="text-[10px] font-medium text-slate-400 mt-0.5">
                                                                Consolidated: ₹{amt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end items-center gap-1.5">
                                                <button 
                                                    onClick={() => setSelectedInvoicePreview(item)} 
                                                    className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-600 text-indigo-600 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 border border-indigo-200 dark:border-indigo-800 shadow-xs cursor-pointer" 
                                                    title="Preview Invoice (PDF, Excel, Details)"
                                                >
                                                    <Eye size={14} /> Preview
                                                </button>
                                                <button 
                                                    onClick={() => generateEWayBill(item)} 
                                                    className="px-3 py-1.5 bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-600 text-amber-600 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 border border-amber-200 dark:border-amber-800 shadow-xs cursor-pointer" 
                                                    title="Generate E-Way Bill"
                                                >
                                                    <Truck size={14} /> E-Way
                                                </button>

                                                {(() => {
                                                    const remainingSecs = getRemainingEditSeconds(item.createdAt || item.date);
                                                    const isWithinLimit = isEditAllowed(item.createdAt || item.date);

                                                    return isWithinLimit ? (
                                                        <div className="flex items-center gap-1 shrink-0 ml-0.5">
                                                            {remainingSecs === Infinity ? (
                                                                <span 
                                                                    title="Unlimited editing window configured by company policy"
                                                                    className="px-2 py-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 rounded-xl font-mono text-[10px] font-bold border border-emerald-200 dark:border-emerald-800 inline-flex items-center gap-1 shrink-0"
                                                                >
                                                                    <ShieldCheck size={11} className="text-emerald-600" />
                                                                    Unlimited
                                                                </span>
                                                            ) : (
                                                                <span 
                                                                    title={`Edit and delete allowed for another ${formatRemainingTime(remainingSecs)}`}
                                                                    className="px-2 py-1 bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 rounded-xl font-mono text-[10px] font-bold border border-amber-200 dark:border-amber-800 inline-flex items-center gap-1 shrink-0"
                                                                >
                                                                    <Clock size={11} className="text-amber-600 animate-pulse" />
                                                                    {formatRemainingTime(remainingSecs)}
                                                                </span>
                                                            )}

                                                            <button 
                                                                onClick={() => onEdit(item)} 
                                                                className="p-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition-colors cursor-pointer border border-indigo-200 dark:border-indigo-800" 
                                                                title={`Edit Tax Invoice (${formatRemainingTime(remainingSecs)} left)`}
                                                            >
                                                                <Edit2 size={14} />
                                                            </button>

                                                            <button 
                                                                onClick={() => handleDeleteSafe(item)} 
                                                                className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer border border-rose-200 dark:border-rose-800" 
                                                                title={`Delete Tax Invoice (${formatRemainingTime(remainingSecs)} left)`}
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <span 
                                                            title={`Compliance edit and delete window expired (${getPolicyHours('invoice')}h limit)`}
                                                            className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-400 text-[10px] font-semibold rounded-xl inline-flex items-center gap-1 opacity-75 shrink-0 ml-0.5"
                                                        >
                                                            <Lock size={11} /> Locked
                                                        </span>
                                                    );
                                                })()}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Card View - Scrollable */}
                    <div className="md:hidden flex flex-col gap-3 p-2 pb-28 sm:pb-20 max-h-[calc(100vh-270px)] overflow-y-auto">
                        {filteredData.map((item) => (
                            <div key={item._id} className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col gap-3">
                                <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-800 pb-2">
                                    <div>
                                        <span onClick={() => setSelectedInvoicePreview(item)} className="text-xs font-mono text-indigo-600 dark:text-indigo-400 font-bold block mb-0.5 cursor-pointer hover:underline">INV #{item.invoiceNumber}</span>
                                        <h4 className="font-bold text-slate-900 dark:text-white">{item.customerName || "Customer"}</h4>
                                    </div>
                                    {item.customerPoReference && (
                                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-[10px] font-mono font-semibold">
                                            PO: {item.customerPoReference}
                                        </span>
                                    )}
                                </div>

                                <div className="text-xs space-y-1.5 text-slate-600 dark:text-slate-300">
                                    <div className="flex justify-between">
                                        <span className="text-slate-400 font-medium">Creation Date & Time:</span> 
                                        <span className="font-semibold text-slate-700 dark:text-slate-200">{formatDateTime(item.createdAt || item.date)}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 font-medium block">Item & Description:</span> 
                                        <div className="font-bold text-slate-800 dark:text-slate-100">
                                            {item.items?.[0]?.materialName || item.items?.[0]?.productName || '-'}
                                        </div>
                                        {(item.items?.[0]?.description || item.items?.[0]?.descriptions) && (
                                            <div className="text-[11px] text-slate-500 italic line-clamp-1">
                                                {item.items?.[0]?.description || item.items?.[0]?.descriptions}
                                            </div>
                                        )}
                                        {item.items?.length > 1 && (
                                            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">
                                                (+{item.items.length - 1} more items)
                                            </span>
                                        )}
                                    </div>
                                     <div className="flex justify-between items-baseline">
                                         <span className="text-slate-400 font-medium">Total Amount:</span> 
                                         <div className="text-right">
                                             <div className="font-bold text-indigo-600 dark:text-indigo-400 font-mono flex items-center justify-end gap-1.5">
                                                 <span>{getCurrencySymbol(item.currency)}{(item.grandTotal || item.totalAmount || item.subtotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                 <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                                     {normalizeCurrencyCode(item.currency)}
                                                 </span>
                                             </div>
                                             {(() => {
                                                 const inr = convertToINR(item.grandTotal || item.totalAmount || item.subtotal || 0, item.currency);
                                                 if (inr.isForeign) {
                                                     return (
                                                         <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 block font-mono">
                                                             ≈ {inr.formattedINR} <span className="font-normal text-slate-400">(@ ₹{inr.rate.toFixed(2)})</span>
                                                         </span>
                                                     );
                                                 }
                                                 return (
                                                     <span className="text-[10px] font-medium text-slate-400 block font-mono">
                                                         Consolidated: ₹{(item.grandTotal || item.totalAmount || item.subtotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                     </span>
                                                 );
                                             })()}
                                         </div>
                                     </div>
                                </div>

                                <div className="flex flex-col gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                                    {(() => {
                                        const remainingSecs = getRemainingEditSeconds(item.createdAt || item.date);
                                        const isWithinLimit = isEditAllowed(item.createdAt || item.date);

                                        return isWithinLimit ? (
                                            <div className="flex items-center justify-between w-full">
                                                {remainingSecs === Infinity ? (
                                                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 rounded-lg font-mono text-[10px] font-bold border border-emerald-200 dark:border-emerald-800 inline-flex items-center gap-1">
                                                        <ShieldCheck size={11} className="text-emerald-600" />
                                                        Unlimited edit window
                                                    </span>
                                                ) : (
                                                    <span className="px-2 py-0.5 bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 rounded-lg font-mono text-[10px] font-bold border border-amber-200 dark:border-amber-800 inline-flex items-center gap-1">
                                                        <Clock size={11} className="text-amber-600 animate-pulse" />
                                                        {formatRemainingTime(remainingSecs)} left to edit
                                                    </span>
                                                )}
                                                <div className="flex items-center gap-1.5">
                                                    <button 
                                                        onClick={() => onEdit(item)} 
                                                        className="px-2.5 py-1 text-xs font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 rounded-lg border border-indigo-200 dark:border-indigo-800 flex items-center gap-1 cursor-pointer"
                                                    >
                                                        <Edit2 size={13} /> Edit
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDeleteSafe(item)} 
                                                        className="px-2.5 py-1 text-xs font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/40 rounded-lg border border-rose-200 dark:border-rose-800 flex items-center gap-1 cursor-pointer"
                                                    >
                                                        <Trash2 size={13} /> Delete
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-400 text-[10px] font-semibold rounded-lg inline-flex items-center gap-1 opacity-75">
                                                <Lock size={11} /> Edit Window Expired ({getPolicyHours('invoice')}h limit)
                                            </span>
                                        );
                                    })()}
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => setSelectedInvoicePreview(item)} className="flex-1 py-2 text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-600 hover:text-white rounded-xl text-xs font-bold flex justify-center items-center gap-1.5 border border-indigo-200 dark:border-indigo-800 transition-all cursor-pointer"><Eye size={15} /> Preview</button>
                                        <button onClick={() => generateEWayBill(item)} className="flex-1 py-2 text-amber-600 bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-600 hover:text-white rounded-xl text-xs font-bold flex justify-center items-center gap-1.5 border border-amber-200 dark:border-amber-800 transition-all cursor-pointer"><Truck size={15} /> E-Way</button>
                                    </div>
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

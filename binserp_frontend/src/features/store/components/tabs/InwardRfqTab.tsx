import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Inbox, Plus, Search, Calendar, User, Eye, FileText, CheckCircle2, Clock, Filter, ArrowRight, X, Building2, Printer, LayoutGrid, List, Edit2, Trash2, UserCheck, History, ShieldCheck, Download, AlertTriangle, IndianRupee, ChevronDown, ChevronUp, RotateCcw, Tag, Settings } from 'lucide-react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/src/lib/api';
import SearchableSelect from '../SearchableSelect';
import { generateFrontendInwardRfqPDF } from '@/src/utils/frontendPdfHelper';
import { getCurrencySymbol, CURRENCY_OPTIONS, normalizeCurrencyCode } from '@/src/utils/currencyHelper';
import { useExchangeRates } from '@/src/hooks/useExchangeRates';

interface InwardRfqTabProps {
    token: string | null;
    onError: (msg: string) => void;
    onSuccess: (msg: string) => void;
}

export default function InwardRfqTab({ token, onError, onSuccess }: InwardRfqTabProps) {
    const { exchangeRates, convertToINR } = useExchangeRates(token);
    const [loading, setLoading] = useState(true);
    const [rfqs, setRfqs] = useState<any[]>([]);
    const [fgItems, setFgItems] = useState<any[]>([]);
    const [customers, setCustomers] = useState<any[]>([]);
    const [companyInfo, setCompanyInfo] = useState<any>(null);
    
    const [priceLists, setPriceLists] = useState<any[]>([]);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('All');
    const [filterCustomer, setFilterCustomer] = useState<string>('All');
    const [filterDateType, setFilterDateType] = useState<'entry' | 'expected' | 'either'>('entry');
    const [filterMonth, setFilterMonth] = useState<string>(''); // format: 'YYYY-MM'
    const [showDashboard, setShowDashboard] = useState<boolean>(true);

    // Create/Edit RFQ Modal State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingRfq, setEditingRfq] = useState<any | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [customerSearchTerm, setCustomerSearchTerm] = useState('');
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});

    const clearError = (field: string) => {
        setFormErrors(prev => {
            const next = { ...prev };
            delete next[field];
            delete next.server_error;
            return next;
        });
    };

    const [newRfq, setNewRfq] = useState({
        rfqNumber: '',
        date: new Date().toISOString().slice(0, 10),
        expectedDeliveryDate: '',
        currency: 'INR',
        customer: '',
        customerName: '',
        customerEmail: '',
        customerPhone: '',
        remarks: '',
        status: 'Open',
        items: [{ fgItem: '', hsnCode: '', description: '', quantity: 1, unit: 'PCS', targetPrice: '' }]
    });

    // View Modal State
    const [selectedRfq, setSelectedRfq] = useState<any | null>(null);

    const fetchData = async () => {
        if (!token) return;
        try {
            setLoading(true);
            const [rfqRes, fgRes, custRes, compRes, priceRes] = await Promise.all([
                apiGet('/api/sales/incoming-rfq', token).catch(() => ({ rfqs: [] })),
                apiGet('/api/store/fg-item', token).catch(() => []),
                apiGet('/api/store/customer', token).catch(() => []),
                apiGet('/api/store/company-info', token).catch(() => null),
                apiGet('/api/sales/price-list', token).catch(() => ({ priceLists: [] }))
            ]);

            const rfqsList = Array.isArray(rfqRes?.rfqs) ? rfqRes.rfqs : (Array.isArray(rfqRes?.data) ? rfqRes.data : (Array.isArray(rfqRes) ? rfqRes : []));
            const fgList = Array.isArray(fgRes?.fgItems) ? fgRes.fgItems : (Array.isArray(fgRes) ? fgRes : []);
            const custList = Array.isArray(custRes?.customers) ? custRes.customers : (Array.isArray(custRes) ? custRes : []);
            const priceList = Array.isArray(priceRes?.priceLists) ? priceRes.priceLists : (Array.isArray(priceRes?.data) ? priceRes.data : (Array.isArray(priceRes) ? priceRes : []));

            setRfqs(rfqsList);
            setFgItems(fgList);
            setCustomers(custList);
            setPriceLists(priceList);
            setCompanyInfo(compRes?.companyInfo || compRes);
        } catch (err: any) {
            console.error("Inward RFQ Fetch error:", err);
            onError(err.message || "Failed to fetch Inward RFQs");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [token]);

    const generateRfqNumber = () => {
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        return `RFQ-IN-${dateStr}-${randomNum}`;
    };

    const getUserName = (userObj: any) => {
        if (!userObj) return 'Sales User';
        if (typeof userObj === 'string') return userObj;
        return userObj.name || userObj.email || 'User';
    };

    const handlePrintInwardRfqPdf = (rfq: any) => {
        try {
            const customerObj = (Array.isArray(customers) ? customers : []).find(
                (c: any) => (c._id || c.id)?.toString() === (rfq.customer?._id || rfq.customer)?.toString()
            ) || { name: rfq.customerName, email: rfq.customerEmail, phone: rfq.customerPhone };

            generateFrontendInwardRfqPDF({ rfq, customer: customerObj, companyInfo });
            onSuccess(`Inward RFQ PDF generated for ${rfq.customerName || 'Customer'}`);
        } catch (err: any) {
            onError(err.message || "Failed to generate PDF");
        }
    };

    // Formatted FG options for SearchableSelect with list price and descriptions
    const fgOptions = useMemo(() => {
        return (Array.isArray(fgItems) ? fgItems : [])
            .map(m => {
                const pEntry = (Array.isArray(priceLists) ? priceLists : []).find((p: any) => {
                    const pFgId = typeof p.fgItem === 'string' ? p.fgItem : (p.fgItem?._id || p.fgItem?.id);
                    return pFgId?.toString() === (m._id || m.id)?.toString();
                });
                const rate = pEntry && pEntry.price != null ? Number(pEntry.price) : (Number(m.sellingPrice || m.rate || 0));
                const priceText = rate > 0 ? ` — ${getCurrencySymbol(newRfq.currency)}${rate}` : '';
                const descText = m.description ? ` (${m.description})` : '';
                const codeText = m.code ? ` [${m.code}]` : '';
                return {
                    value: (m._id || m.id)?.toString(),
                    label: `${m.name || m.itemName || 'FG Item'}${codeText}${descText}${priceText}`,
                    rate: rate,
                    raw: m,
                    priceEntry: pEntry
                };
            })
            .filter(o => o.value);
    }, [fgItems, priceLists, newRfq.currency]);

    const handleOpenCreateModal = () => {
        setEditingRfq(null);
        setCustomerSearchTerm('');
        setFormErrors({});
        setNewRfq({
            rfqNumber: generateRfqNumber(),
            date: new Date().toISOString().slice(0, 10),
            expectedDeliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
            currency: 'INR',
            customer: '',
            customerName: '',
            customerEmail: '',
            customerPhone: '',
            remarks: '',
            status: 'Open',
            items: [{ fgItem: '', hsnCode: '', description: '', quantity: 1, unit: 'PCS', targetPrice: '' }]
        });
        setIsCreateModalOpen(true);
    };

    const handleOpenEditModal = (rfq: any) => {
        setEditingRfq(rfq);
        setCustomerSearchTerm('');
        setFormErrors({});
        setNewRfq({
            rfqNumber: rfq.rfqNumber || '',
            date: rfq.date ? new Date(rfq.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
            expectedDeliveryDate: rfq.expectedDeliveryDate ? new Date(rfq.expectedDeliveryDate).toISOString().slice(0, 10) : (rfq.dueDate ? new Date(rfq.dueDate).toISOString().slice(0, 10) : ''),
            currency: rfq.currency || 'INR',
            customer: rfq.customer?._id || rfq.customer || '',
            customerName: rfq.customerName || rfq.customer?.name || '',
            customerEmail: rfq.customerEmail || rfq.customer?.email || '',
            customerPhone: rfq.customerPhone || rfq.customer?.phone || '',
            remarks: rfq.remarks || '',
            status: rfq.status || 'Open',
            items: Array.isArray(rfq.items) && rfq.items.length > 0
                ? rfq.items.map((it: any) => ({
                    fgItem: it.fgItem?._id || it.fgItem || '',
                    hsnCode: it.hsnCode || '',
                    description: it.description || '',
                    quantity: it.quantity || 1,
                    unit: it.unit || 'PCS',
                    targetPrice: it.targetPrice != null ? it.targetPrice : ''
                }))
                : [{ fgItem: '', hsnCode: '', description: '', quantity: 1, unit: 'PCS', targetPrice: '' }]
        });
        setIsCreateModalOpen(true);
    };

    const handleDeleteRfq = async (rfq: any) => {
        if (!rfq || !rfq._id) return;
        if (confirm(`Are you sure you want to delete Inward RFQ #${rfq.rfqNumber}? This action cannot be undone.`)) {
            try {
                await apiDelete(`/api/sales/incoming-rfq/${rfq._id}`, token);
                onSuccess(`Inward RFQ #${rfq.rfqNumber} deleted successfully`);
                if (selectedRfq && selectedRfq._id === rfq._id) {
                    setSelectedRfq(null);
                }
                fetchData();
            } catch (err: any) {
                onError(err.message || "Failed to delete Inward RFQ");
            }
        }
    };

    const handleStatusChange = async (rfqId: string, newStatus: string) => {
        try {
            const res = await apiPut(`/api/sales/incoming-rfq/${rfqId}`, { status: newStatus }, token);
            onSuccess(`Inward RFQ Status updated to ${newStatus}`);
            const updated = res.rfq || res.data || res;
            if (selectedRfq && selectedRfq._id === rfqId) {
                setSelectedRfq(updated);
            }
            fetchData();
        } catch (err: any) {
            onError(err.message || "Failed to update status");
        }
    };

    const handleAddItem = () => {
        setNewRfq(prev => ({
            ...prev,
            items: [...prev.items, { fgItem: '', hsnCode: '', description: '', quantity: 1, unit: 'PCS', targetPrice: '' }]
        }));
    };

    const handleRemoveItem = (index: number) => {
        setNewRfq(prev => ({
            ...prev,
            items: prev.items.filter((_, i) => i !== index)
        }));
    };

    const handleItemChange = (index: number, field: string, value: any) => {
        clearError(`item_${index}_${field}`);
        const updatedItems = [...newRfq.items];
        if (field === 'fgItem') {
            const selectedFg = (Array.isArray(fgItems) ? fgItems : []).find((m: any) => (m._id || m.id)?.toString() === value?.toString());
            const priceEntry = (Array.isArray(priceLists) ? priceLists : []).find((p: any) => {
                const pFgId = typeof p.fgItem === 'string' ? p.fgItem : (p.fgItem?._id || p.fgItem?.id);
                return pFgId?.toString() === value?.toString();
            });
            const autoRate = priceEntry && priceEntry.price != null ? Number(priceEntry.price) : (Number(selectedFg?.sellingPrice || selectedFg?.rate || 0));
            const autoHsn = (selectedFg as any)?.hsnCode || (selectedFg as any)?.hsn || priceEntry?.hsnCode || '';
            const autoName = selectedFg?.name || selectedFg?.itemName || '';
            const autoDesc = selectedFg?.descriptions || selectedFg?.description || autoName;
            const autoUnit = selectedFg?.unit || 'PCS';

            updatedItems[index] = {
                ...updatedItems[index],
                fgItem: value,
                hsnCode: autoHsn || updatedItems[index].hsnCode || '',
                description: autoDesc,
                unit: autoUnit,
                targetPrice: autoRate > 0 ? String(autoRate) : (updatedItems[index].targetPrice || '')
            };
        } else {
            updatedItems[index] = { ...updatedItems[index], [field]: value };
        }
        setNewRfq(prev => ({ ...prev, items: updatedItems }));
    };

    const handleSelectCustomer = (custId: string) => {
        clearError('customer');
        const selectedCust = (Array.isArray(customers) ? customers : []).find((c: any) => (c._id || c.id)?.toString() === custId?.toString());
        if (selectedCust) {
            setNewRfq(prev => ({
                ...prev,
                customer: custId,
                customerName: selectedCust.name || selectedCust.companyName || '',
                customerEmail: selectedCust.email || '',
                customerPhone: selectedCust.phone || ''
            }));
        } else {
            setNewRfq(prev => ({ ...prev, customer: custId }));
        }
    };

    const handleCreateRfqSubmit = async () => {
        const errors: Record<string, string> = {};
        if (!newRfq.customer) {
            errors.customer = "Please select a registered customer";
        }
        if (!newRfq.date) {
            errors.date = "RFQ date is required";
        }
        if (!newRfq.items || newRfq.items.length === 0) {
            errors.items = "At least one item is required";
        } else {
            newRfq.items.forEach((it, idx) => {
                if (!it.fgItem) {
                    errors[`item_${idx}_fgItem`] = "Select Finished Good";
                }
                if (!it.quantity || Number(it.quantity) <= 0) {
                    errors[`item_${idx}_quantity`] = "Qty > 0 required";
                }
            });
        }

        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            setTimeout(() => {
                const firstErr = document.querySelector('[data-has-error="true"]');
                if (firstErr) {
                    firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    (firstErr.querySelector('input, select, button') as HTMLElement)?.focus?.();
                }
            }, 50);
            return;
        }

        setFormErrors({});
        setSubmitting(true);
        try {
            if (editingRfq && editingRfq._id) {
                await apiPut(`/api/sales/incoming-rfq/${editingRfq._id}`, newRfq, token);
                onSuccess(`Inward RFQ #${newRfq.rfqNumber} updated successfully`);
            } else {
                await apiPost('/api/sales/incoming-rfq', newRfq, token);
                onSuccess("Inward RFQ created successfully");
            }
            setIsCreateModalOpen(false);
            setEditingRfq(null);
            fetchData();
        } catch (err: any) {
            setFormErrors({ server_error: err.message || "Failed to save Inward RFQ" });
        } finally {
            setSubmitting(false);
        }
    };

    // Helper to calculate total target value of an RFQ
    const calculateRfqTotalTargetValue = useCallback((rfq: any) => {
        if (!Array.isArray(rfq?.items)) return 0;
        return rfq.items.reduce((sum: number, it: any) => {
            const price = Number(it.targetPrice || 0);
            const qty = Number(it.quantity || 1);
            return sum + (price * qty);
        }, 0);
    }, []);

    const filteredRfqs = useMemo(() => {
        return (Array.isArray(rfqs) ? rfqs : []).filter((rfq: any) => {
            const matchSearch =
                (rfq.rfqNumber && rfq.rfqNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (rfq.customerName && rfq.customerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (rfq.items && rfq.items.some((i: any) => (i.fgItem?.name || i.itemName || '').toLowerCase().includes(searchTerm.toLowerCase())));

            const matchStatus = filterStatus === 'All' || rfq.status === filterStatus;

            let matchCustomer = true;
            if (filterCustomer !== 'All') {
                const custId = rfq.customer?._id || rfq.customer;
                matchCustomer = custId?.toString() === filterCustomer?.toString();
            }

            let matchDate = true;
            if (filterMonth) {
                const getYearMonth = (val: any) => {
                    if (!val) return '';
                    const d = new Date(val);
                    if (isNaN(d.getTime())) return '';
                    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                };

                const entryYm = getYearMonth(rfq.date || rfq.createdAt);
                const expectedYm = getYearMonth(rfq.expectedDeliveryDate || rfq.dueDate);

                if (filterDateType === 'entry') {
                    matchDate = entryYm === filterMonth;
                } else if (filterDateType === 'expected') {
                    matchDate = expectedYm === filterMonth;
                } else {
                    matchDate = entryYm === filterMonth || expectedYm === filterMonth;
                }
            }

            return matchSearch && matchStatus && matchCustomer && matchDate;
        });
    }, [rfqs, searchTerm, filterStatus, filterCustomer, filterMonth, filterDateType]);

    // Live RFQ count per status for the dropdown
    const statusCounts = useMemo(() => {
        const counts: Record<string, number> = { All: Array.isArray(rfqs) ? rfqs.length : 0 };
        ['Draft', 'Open', 'Quoted', 'Closed', 'Rejected'].forEach(st => {
            counts[st] = (Array.isArray(rfqs) ? rfqs : []).filter(r => r.status === st).length;
        });
        return counts;
    }, [rfqs]);

    // Overall RFQ Pipeline Financials in INR
    const overallRfqFinancials = useMemo(() => {
        let totalInr = 0;
        let openInr = 0;
        let openCount = 0;
        let quotedInr = 0;
        let quotedCount = 0;
        let closedInr = 0;
        let closedCount = 0;
        const currencyTotals: Record<string, number> = {};
        const currencyInrTotals: Record<string, number> = {};

        (Array.isArray(rfqs) ? rfqs : []).forEach(rfq => {
            if (rfq.status === 'Rejected') return;
            const rfqTotal = calculateRfqTotalTargetValue(rfq);
            const curr = (rfq.currency || 'INR').trim().toUpperCase();
            currencyTotals[curr] = (currencyTotals[curr] || 0) + rfqTotal;

            const inrConversion = convertToINR(rfqTotal, curr);
            const inrVal = inrConversion.inrAmount;
            totalInr += inrVal;
            currencyInrTotals[curr] = (currencyInrTotals[curr] || 0) + inrVal;

            if (rfq.status === 'Open' || rfq.status === 'Draft') {
                openInr += inrVal;
                openCount++;
            } else if (rfq.status === 'Quoted') {
                quotedInr += inrVal;
                quotedCount++;
            } else if (rfq.status === 'Closed') {
                closedInr += inrVal;
                closedCount++;
            }
        });

        return {
            totalInr,
            formattedTotalInr: `₹${totalInr.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            openInr,
            formattedOpenInr: `₹${openInr.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
            openCount,
            quotedInr,
            formattedQuotedInr: `₹${quotedInr.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
            quotedCount,
            closedInr,
            formattedClosedInr: `₹${closedInr.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
            closedCount,
            currencyTotals,
            currencyInrTotals,
            hasForeign: Object.keys(currencyTotals).some(c => c !== 'INR' && currencyTotals[c] > 0)
        };
    }, [rfqs, calculateRfqTotalTargetValue, convertToINR]);

    // Consolidated Filtered RFQ Financials in INR
    const consolidatedRfqFinancials = useMemo(() => {
        let totalInr = 0;
        const currencyTotals: Record<string, number> = {};
        const currencyInrTotals: Record<string, number> = {};

        (Array.isArray(filteredRfqs) ? filteredRfqs : []).forEach(rfq => {
            if (rfq.status === 'Rejected') return;
            const rfqTotal = calculateRfqTotalTargetValue(rfq);
            if (rfqTotal <= 0) return;
            const curr = (rfq.currency || 'INR').trim().toUpperCase();
            currencyTotals[curr] = (currencyTotals[curr] || 0) + rfqTotal;

            const inrConversion = convertToINR(rfqTotal, curr);
            totalInr += inrConversion.inrAmount;
            currencyInrTotals[curr] = (currencyInrTotals[curr] || 0) + inrConversion.inrAmount;
        });

        return {
            totalInr,
            formattedTotalInr: `₹${totalInr.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            currencyTotals,
            currencyInrTotals,
            hasForeign: Object.keys(currencyTotals).some(c => c !== 'INR' && currencyTotals[c] > 0)
        };
    }, [filteredRfqs, calculateRfqTotalTargetValue, convertToINR]);

    const hasActiveFilters = Boolean(searchTerm || filterStatus !== 'All' || filterCustomer !== 'All' || filterMonth);

    return (
        <div className="space-y-4 animate-in fade-in duration-300">
            {/* 1. EXECUTIVE INWARD RFQ DASHBOARD - CONVERTED PIPELINE VALUATIONS & METRICS */}
            <div className="space-y-3">
                {!showDashboard ? (
                    <div className="bg-white dark:bg-slate-900 p-2.5 sm:px-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-3 sm:gap-6 flex-wrap">
                            <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Pipeline Value:</span>
                                <span className="font-mono font-bold text-slate-900 dark:text-white">{overallRfqFinancials.formattedTotalInr}</span>
                                <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-extrabold">({rfqs.length} RFQs)</span>
                            </div>
                            <div className="hidden sm:flex items-center gap-1.5">
                                <span className="text-[11px] font-bold text-slate-500">Open RFQs:</span>
                                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{overallRfqFinancials.openCount} ({overallRfqFinancials.formattedOpenInr})</span>
                            </div>
                            <div className="hidden md:flex items-center gap-1.5">
                                <span className="text-[11px] font-bold text-slate-500">Quoted:</span>
                                <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{overallRfqFinancials.quotedCount} ({overallRfqFinancials.formattedQuotedInr})</span>
                            </div>
                            <div className="hidden md:flex items-center gap-1.5">
                                <span className="text-[11px] font-bold text-slate-500">Closed:</span>
                                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{overallRfqFinancials.closedCount}</span>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowDashboard(true)}
                            className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-900/50 cursor-pointer shrink-0 transition-colors"
                        >
                            <span>Show Dashboard</span>
                            <ChevronDown size={14} />
                        </button>
                    </div>
                ) : (
                    <>
                        {/* 4 Primary Executive KPI Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            {/* Card 1: Total Pipeline Target Value */}
                            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between gap-2.5 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Pipeline Value</span>
                                    <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                                        <IndianRupee size={16} />
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
                                        {overallRfqFinancials.formattedTotalInr}
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-1 text-[11px] font-bold text-slate-500 dark:text-slate-400 flex-wrap">
                                        <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">{rfqs.length} RFQs</span>
                                        <span>•</span>
                                        <span>Converted to INR</span>
                                    </div>
                                </div>
                            </div>

                            {/* Card 2: Open RFQs */}
                            <div 
                                onClick={() => setFilterStatus(filterStatus === 'Open' ? 'All' : 'Open')}
                                className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between gap-2.5 hover:border-blue-400 dark:hover:border-blue-600 transition-colors cursor-pointer group"
                                title="Click to filter Open RFQs"
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Open / Pending</span>
                                    <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold group-hover:scale-105 transition-transform">
                                        <Clock size={16} />
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-400 font-mono tracking-tight">
                                        {overallRfqFinancials.formattedOpenInr}
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-1 text-[11px] font-bold text-slate-500 dark:text-slate-400 flex-wrap">
                                        <span className="text-blue-600 dark:text-blue-400 font-extrabold">{overallRfqFinancials.openCount} RFQs</span>
                                        <span>•</span>
                                        <span>Awaiting Quotation</span>
                                    </div>
                                </div>
                            </div>

                            {/* Card 3: Quoted RFQs */}
                            <div 
                                onClick={() => setFilterStatus(filterStatus === 'Quoted' ? 'All' : 'Quoted')}
                                className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between gap-2.5 hover:border-amber-400 dark:hover:border-amber-600 transition-colors cursor-pointer group"
                                title="Click to filter Quoted RFQs"
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Quoted RFQs</span>
                                    <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold group-hover:scale-105 transition-transform">
                                        <FileText size={16} />
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 font-mono tracking-tight">
                                        {overallRfqFinancials.formattedQuotedInr}
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-1 text-[11px] font-bold text-slate-500 dark:text-slate-400 flex-wrap">
                                        <span className="text-amber-600 dark:text-amber-400 font-extrabold">{overallRfqFinancials.quotedCount} RFQs</span>
                                        <span>•</span>
                                        <span>Quote Sent to Customer</span>
                                    </div>
                                </div>
                            </div>

                            {/* Card 4: Closed / Converted */}
                            <div 
                                onClick={() => setFilterStatus(filterStatus === 'Closed' ? 'All' : 'Closed')}
                                className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between gap-2.5 hover:border-emerald-400 dark:hover:border-emerald-600 transition-colors cursor-pointer group"
                                title="Click to filter Closed RFQs"
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Closed / Won</span>
                                    <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold group-hover:scale-105 transition-transform">
                                        <CheckCircle2 size={16} />
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono tracking-tight">
                                        {overallRfqFinancials.formattedClosedInr}
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-1 text-[11px] font-bold text-slate-500 dark:text-slate-400 flex-wrap">
                                        <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">{overallRfqFinancials.closedCount} RFQs</span>
                                        <span>•</span>
                                        <span>Completed / PO Won</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Currency Conversion Info Bar from Store Prefix Settings */}
                        <div className="bg-slate-50/80 dark:bg-slate-800/40 px-3.5 py-2 rounded-xl border border-slate-200/80 dark:border-slate-800 text-[11px] flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                    <Tag size={12} className="text-indigo-500" />
                                    <span>Currency Conversion Rates (Store &gt; Masters &gt; Setting Prefix):</span>
                                </span>
                                <span className="font-mono text-slate-600 dark:text-slate-400">
                                    1 USD ≈ ₹{(exchangeRates.USD || 84.50).toFixed(2)} | 1 EUR ≈ ₹{(exchangeRates.EUR || 92.00).toFixed(2)} | 1 GBP ≈ ₹{(exchangeRates.GBP || 108.00).toFixed(2)} | 1 AED ≈ ₹{(exchangeRates.AED || 23.00).toFixed(2)}
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

                        {/* Foreign Currency Breakdown (if order book has foreign currencies) */}
                        {overallRfqFinancials.hasForeign && (
                            <div className="flex flex-wrap items-center gap-1.5 text-xs bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                                <span className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mr-1">Foreign Breakdown:</span>
                                {Object.keys(overallRfqFinancials.currencyTotals).map(curr => {
                                    const amt = overallRfqFinancials.currencyTotals[curr];
                                    if (amt <= 0) return null;
                                    const sym = getCurrencySymbol(curr);
                                    const isForeign = curr !== 'INR';
                                    return (
                                        <div key={curr} className="px-2 py-0.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] font-medium flex items-center gap-1">
                                            <span className="font-bold text-slate-700 dark:text-slate-200">{sym}{amt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {curr}</span>
                                            {isForeign && (
                                                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold font-mono">
                                                    (≈ ₹{(overallRfqFinancials.currencyInrTotals[curr] || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })})
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
            
            {/* Search, Filter & Action Toolbar */}
            <div className="bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                {/* Primary Row: Search + Action Buttons */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="Search RFQ #, Customer or Item..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-8 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-slate-50/50 dark:bg-slate-800/50"
                        />
                        {searchTerm && (
                            <button
                                type="button"
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                                title="Clear search"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0">
                        <button
                            type="button"
                            onClick={() => setShowDashboard(prev => !prev)}
                            className="flex-1 sm:flex-initial px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap border border-slate-200 dark:border-slate-700"
                            title={showDashboard ? "Hide Executive KPI Dashboard" : "Show Executive KPI Dashboard"}
                        >
                            {showDashboard ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                            <span>{showDashboard ? "Hide Dashboard" : "Show Dashboard"}</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleOpenCreateModal}
                            className="flex-1 sm:flex-initial px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                        >
                            <Plus size={15} /> <span>Log Inward RFQ</span>
                        </button>
                    </div>
                </div>

                {/* Filters Row: Customer Dropdown + Status Dropdown + Month Date Filter + Reset */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
                        {/* Customer Filter Dropdown */}
                        <div className="flex items-center gap-1.5 flex-1 sm:flex-none min-w-[150px] sm:min-w-0">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0">Customer:</label>
                            <select
                                value={filterCustomer}
                                onChange={(e) => setFilterCustomer(e.target.value)}
                                className="w-full sm:w-auto px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 outline-none cursor-pointer focus:ring-2 focus:ring-indigo-500/20 max-w-full sm:max-w-[240px]"
                            >
                                <option value="All">All Customers</option>
                                {(Array.isArray(customers) ? customers : []).map((c: any) => (
                                    <option key={c._id || c.id} value={(c._id || c.id)?.toString()}>
                                        {c.name || c.companyName} {c.code ? `(${c.code})` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Status Filter Dropdown */}
                        <div className="flex items-center gap-1.5 flex-1 sm:flex-none min-w-[160px] sm:min-w-0">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0">Status:</label>
                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="w-full sm:w-auto px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 outline-none cursor-pointer focus:ring-2 focus:ring-indigo-500/20 max-w-full sm:max-w-[260px]"
                            >
                                <option value="All">All Statuses ({statusCounts.All || 0})</option>
                                <option value="Draft">Draft ({statusCounts.Draft || 0})</option>
                                <option value="Open">Open ({statusCounts.Open || 0})</option>
                                <option value="Quoted">Quoted ({statusCounts.Quoted || 0})</option>
                                <option value="Closed">Closed ({statusCounts.Closed || 0})</option>
                                <option value="Rejected">Rejected ({statusCounts.Rejected || 0})</option>
                            </select>
                        </div>

                        {/* Month-Based Date Filter */}
                        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-xl border border-slate-200 dark:border-slate-700 flex-1 sm:flex-none min-w-[230px] sm:min-w-0">
                            <Calendar size={13} className="text-indigo-500 shrink-0" />
                            <select
                                value={filterDateType}
                                onChange={(e) => setFilterDateType(e.target.value as any)}
                                className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-300 outline-none cursor-pointer pr-1"
                                title="Select date basis for month filter"
                            >
                                <option value="entry">RFQ / Log Month</option>
                                <option value="expected">Expected Month</option>
                                <option value="either">Either Month</option>
                            </select>
                            <div className="relative flex items-center">
                                <input
                                    type="month"
                                    value={filterMonth}
                                    onChange={(e) => setFilterMonth(e.target.value)}
                                    className="px-2 py-0.5 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-200 rounded-lg border border-slate-200 dark:border-slate-700 outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer text-center"
                                    title="Choose month (YYYY-MM)"
                                />
                                {filterMonth && (
                                    <button
                                        type="button"
                                        onClick={() => setFilterMonth('')}
                                        className="ml-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-0.5"
                                        title="Clear month filter"
                                    >
                                        <X size={12} />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Reset Filters Button */}
                    {hasActiveFilters && (
                        <button
                            type="button"
                            onClick={() => {
                                setSearchTerm('');
                                setFilterStatus('All');
                                setFilterCustomer('All');
                                setFilterMonth('');
                                setFilterDateType('entry');
                            }}
                            className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800 transition-all flex items-center gap-1 cursor-pointer shrink-0 ml-auto sm:ml-0"
                            title="Reset all search queries and filters"
                        >
                            <RotateCcw size={12} />
                            <span>Reset Filters</span>
                        </button>
                    )}
                </div>

                {/* Live Counter & Pipeline Indicator */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                        <span>Showing <strong className="text-slate-900 dark:text-white font-bold">{filteredRfqs.length}</strong> of <strong className="text-slate-900 dark:text-white font-bold">{rfqs.length}</strong> Inward RFQs</span>
                        {hasActiveFilters && (
                            <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 text-[10px] font-bold">Filtered</span>
                        )}
                    </div>
                    <div className="flex items-center gap-1 font-mono text-xs">
                        <span>Target Pipeline:</span>
                        <strong className="text-indigo-600 dark:text-indigo-400 font-extrabold text-sm">{consolidatedRfqFinancials.formattedTotalInr}</strong>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center p-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
            ) : filteredRfqs.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                    <Inbox className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                        {hasActiveFilters ? "No Inward RFQs Match Filter" : "No Inward RFQs Found"}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                        {hasActiveFilters 
                            ? "Try adjusting or resetting your search and filter criteria."
                            : "Create an Inward RFQ to log customer quote requests."}
                    </p>
                    {hasActiveFilters && (
                        <button
                            type="button"
                            onClick={() => {
                                setSearchTerm('');
                                setFilterStatus('All');
                                setFilterCustomer('All');
                                setFilterMonth('');
                                setFilterDateType('entry');
                            }}
                            className="mt-4 px-3 py-1.5 rounded-xl text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 border border-indigo-200 dark:border-indigo-800 transition-all inline-flex items-center gap-1.5 cursor-pointer"
                        >
                            <RotateCcw size={13} />
                            <span>Reset All Filters</span>
                        </button>
                    )}
                </div>
            ) : (
                /* Table & Cards View */
                <div className="space-y-3">

                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                        {/* Desktop Table View - Scrollable with Sticky Header */}
                        <div className="hidden md:block overflow-x-auto overflow-y-auto max-h-[calc(100vh-270px)] min-h-[350px]">
                            <table className="w-full text-sm text-left relative">
                                <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700 shadow-2xs">
                                    <tr>
                                        <th className="px-4 py-3.5">RFQ Number</th>
                                        <th className="px-4 py-3.5">Target Items</th>
                                        <th className="px-4 py-3.5 text-right">Target Value</th>
                                        <th className="px-4 py-3.5 text-center">Expected Date</th>
                                        <th className="px-4 py-3.5">Customer</th>
                                        <th className="px-4 py-3.5 text-center">Status</th>
                                        <th className="px-4 py-3.5 text-center">Received / Logged By</th>
                                        <th className="px-4 py-3.5 text-right">Actions</th>
                                    </tr>
                                </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                {filteredRfqs.map((rfq) => {
                                    const firstItemName = rfq.items?.[0]?.fgItem?.name || rfq.items?.[0]?.itemName || 'FG Item';
                                    const extraCount = (rfq.items?.length || 1) - 1;

                                    return (
                                        <tr key={rfq._id || rfq.rfqNumber} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                                            <td className="px-4 py-3.5 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                                {rfq.rfqNumber}
                                                <span className="block text-[10px] text-slate-400 font-sans font-normal">{new Date(rfq.date || rfq.createdAt || Date.now()).toLocaleDateString('en-GB')}</span>
                                            </td>

                                            <td className="px-4 py-3.5 font-bold text-slate-800 dark:text-slate-200">
                                                {Array.isArray(rfq.items) && rfq.items.length > 0 ? (
                                                    <div>
                                                        {firstItemName}
                                                        {extraCount > 0 && <span className="text-xs text-slate-400 font-normal ml-1 flex-inline">+{extraCount} more</span>}
                                                    </div>
                                                ) : 'Items'}
                                            </td>

                                            {/* Target Value Column */}
                                            <td className="px-4 py-3.5 text-right font-mono text-xs">
                                                {(() => {
                                                    const rfqTargetTotal = calculateRfqTotalTargetValue(rfq);
                                                    if (rfqTargetTotal <= 0) return <span className="text-slate-400 font-sans">-</span>;
                                                    const inr = convertToINR(rfqTargetTotal, rfq.currency);
                                                    return (
                                                        <div>
                                                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                                                <span className="font-extrabold text-indigo-600 dark:text-indigo-400 text-sm">
                                                                    {getCurrencySymbol(rfq.currency)}{rfqTargetTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                </span>
                                                                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                                                    {normalizeCurrencyCode(rfq.currency)}
                                                                </span>
                                                            </div>
                                                            {inr.isForeign ? (
                                                                <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5" title={`Rate: 1 ${rfq.currency} = ₹${inr.rate.toFixed(2)}`}>
                                                                    ≈ {inr.formattedINR} <span className="font-normal text-slate-400">(@ ₹{inr.rate.toFixed(2)})</span>
                                                                </div>
                                                            ) : (
                                                                <div className="text-[10px] font-medium text-slate-400 mt-0.5">
                                                                    Consolidated: ₹{rfqTargetTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                            </td>

                                            <td className="px-4 py-3.5 text-center font-bold text-slate-700 dark:text-slate-300 text-xs">
                                                {rfq.expectedDeliveryDate || rfq.dueDate ? new Date(rfq.expectedDeliveryDate || rfq.dueDate).toLocaleDateString('en-GB') : 'N/A'}
                                            </td>

                                            <td className="px-4 py-3.5 font-bold text-slate-800 dark:text-slate-200 text-xs">
                                                <div className="flex items-center gap-1.5">
                                                    <Building2 size={13} className="text-indigo-500 shrink-0" />
                                                    <span className="truncate max-w-[180px]">{rfq.customerName || rfq.customer?.name || 'Customer'}</span>
                                                </div>
                                            </td>

                                            <td className="px-4 py-3.5 text-center">
                                                <select
                                                    value={rfq.status || 'Open'}
                                                    onChange={(e) => handleStatusChange(rfq._id, e.target.value)}
                                                    className={`px-2.5 py-1 rounded-full text-xs font-bold border-none outline-none cursor-pointer ${
                                                        rfq.status === 'Quoted' ? 'bg-amber-100 text-amber-800' :
                                                        rfq.status === 'Closed' ? 'bg-emerald-100 text-emerald-800' :
                                                        rfq.status === 'Rejected' ? 'bg-rose-100 text-rose-800' :
                                                        rfq.status === 'Draft' ? 'bg-slate-200 text-slate-700' :
                                                        'bg-blue-100 text-blue-800'
                                                    }`}
                                                >
                                                    <option value="Draft">Draft</option>
                                                    <option value="Open">Open</option>
                                                    <option value="Quoted">Quoted</option>
                                                    <option value="Closed">Closed</option>
                                                    <option value="Rejected">Rejected</option>
                                                </select>
                                            </td>

                                            <td className="px-4 py-3.5 text-center text-xs font-medium text-slate-500">
                                                <span className="inline-flex items-center gap-1">
                                                    <User size={12} className="text-slate-400" />
                                                    {getUserName(rfq.receivedBy)}
                                                </span>
                                            </td>

                                            <td className="px-4 py-3.5 text-right space-x-1.5 whitespace-nowrap">
                                                <button
                                                    onClick={() => setSelectedRfq(rfq)}
                                                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition-colors inline-flex items-center gap-1"
                                                >
                                                    <Eye size={13} /> View
                                                </button>

                                                <button
                                                    onClick={() => handleOpenEditModal(rfq)}
                                                    className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 text-xs font-bold rounded-xl transition-colors inline-flex items-center gap-1"
                                                >
                                                    <Edit2 size={13} /> Edit
                                                </button>

                                                <button
                                                    onClick={() => handlePrintInwardRfqPdf(rfq)}
                                                    className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors inline-flex items-center gap-1 shadow-sm"
                                                >
                                                    <Printer size={13} /> Print
                                                </button>

                                                <button
                                                    onClick={() => handleDeleteRfq(rfq)}
                                                    title="Delete RFQ"
                                                    className="px-2 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400 text-xs font-bold rounded-xl transition-colors inline-flex items-center"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="block md:hidden p-3 space-y-3 pb-28 sm:pb-20 bg-gray-50/50 dark:bg-slate-900/40">
                        {filteredRfqs.map((rfq) => {
                            const firstItemName = rfq.items?.[0]?.fgItem?.name || rfq.items?.[0]?.itemName || 'FG Item';
                            const extraCount = (rfq.items?.length || 1) - 1;

                            return (
                                <div
                                    key={rfq._id || rfq.rfqNumber}
                                    className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col gap-3"
                                >
                                    <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-700 pb-2.5">
                                        <div>
                                            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-sm block">{rfq.rfqNumber}</span>
                                            <span className="text-[10px] text-slate-400">{new Date(rfq.date || rfq.createdAt || Date.now()).toLocaleDateString('en-GB')}</span>
                                        </div>
                                        <select
                                            value={rfq.status || 'Open'}
                                            onChange={(e) => handleStatusChange(rfq._id, e.target.value)}
                                            className={`px-2.5 py-1 rounded-full text-xs font-bold border-none outline-none cursor-pointer ${
                                                rfq.status === 'Quoted' ? 'bg-amber-100 text-amber-800' :
                                                rfq.status === 'Closed' ? 'bg-emerald-100 text-emerald-800' :
                                                rfq.status === 'Rejected' ? 'bg-rose-100 text-rose-800' :
                                                rfq.status === 'Draft' ? 'bg-slate-200 text-slate-700' :
                                                'bg-blue-100 text-blue-800'
                                            }`}
                                        >
                                            <option value="Draft">Draft</option>
                                            <option value="Open">Open</option>
                                            <option value="Quoted">Quoted</option>
                                            <option value="Closed">Closed</option>
                                            <option value="Rejected">Rejected</option>
                                        </select>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">Customer</span>
                                            <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">{rfq.customerName || rfq.customer?.name || 'Customer'}</p>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">Expected Date</span>
                                            <p className="font-medium text-slate-700 dark:text-slate-300">
                                                {rfq.expectedDeliveryDate || rfq.dueDate ? new Date(rfq.expectedDeliveryDate || rfq.dueDate).toLocaleDateString('en-GB') : 'N/A'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="bg-slate-50 dark:bg-slate-700/40 p-2.5 rounded-lg text-xs space-y-1">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">Target Items</span>
                                            {(() => {
                                                const rfqTargetTotal = calculateRfqTotalTargetValue(rfq);
                                                if (rfqTargetTotal <= 0) return null;
                                                const inr = convertToINR(rfqTargetTotal, rfq.currency);
                                                return (
                                                    <span className="font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                                                        {getCurrencySymbol(rfq.currency)}{rfqTargetTotal.toLocaleString()}
                                                        {inr.isForeign && <span className="text-emerald-600 font-mono ml-1 text-[10px]">(≈ {inr.formattedINR})</span>}
                                                    </span>
                                                );
                                            })()}
                                        </div>
                                        <p className="font-semibold text-slate-800 dark:text-slate-200">
                                            {firstItemName} {extraCount > 0 && <span className="text-slate-400 font-normal">(+{extraCount} more)</span>}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-700">
                                        <button
                                            onClick={() => setSelectedRfq(rfq)}
                                            className="flex-1 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center gap-1"
                                        >
                                            <Eye size={13} /> View
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (typeof window !== 'undefined') {
                                                    window.location.href = `/dashboard/store/sales/quotations?rfqId=${rfq._id}`;
                                                }
                                            }}
                                            className="flex-1 py-1.5 text-xs font-bold text-white bg-emerald-600 rounded-lg flex items-center justify-center gap-1 shadow-sm"
                                        >
                                            <FileText size={13} /> Quote
                                        </button>
                                        <button
                                            onClick={() => handleOpenEditModal(rfq)}
                                            className="py-1.5 px-2.5 text-xs font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg border border-indigo-200 dark:border-indigo-800"
                                        >
                                            <Edit2 size={13} />
                                        </button>
                                        <button
                                            onClick={() => handlePrintInwardRfqPdf(rfq)}
                                            className="py-1.5 px-2.5 text-xs font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg border border-indigo-200 dark:border-indigo-800"
                                        >
                                            <Printer size={13} />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteRfq(rfq)}
                                            className="py-1.5 px-2.5 text-xs font-bold text-rose-600 bg-rose-50 dark:bg-rose-900/30 rounded-lg border border-rose-200 dark:border-rose-800"
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
            )}

            {/* Create / Edit Inward RFQ Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-[96vw] xl:max-w-7xl 2xl:max-w-[1550px] overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh]">
                        
                        <div className="p-5 sm:p-6 bg-slate-900 text-white flex justify-between items-center flex-shrink-0 border-b border-slate-800">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-indigo-600/20 rounded-xl flex items-center justify-center border border-indigo-500/30">
                                    {editingRfq ? <Edit2 size={20} className="text-indigo-400" /> : <Inbox size={20} className="text-indigo-400" />}
                                </div>
                                <div>
                                    <h2 className="text-xl font-extrabold tracking-tight">
                                        {editingRfq ? 'Edit Inward RFQ' : 'Create Inward RFQ'}
                                    </h2>
                                    <p className="text-xs text-slate-400 mt-0.5">RFQ Number: <span className="font-mono font-bold text-indigo-300">{newRfq.rfqNumber}</span></p>
                                </div>
                            </div>
                            <button onClick={() => { setIsCreateModalOpen(false); setEditingRfq(null); }} className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 transition-colors">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-5 sm:p-7 overflow-y-auto flex-1 space-y-6">
                            
                            {/* In-Form Error Guidance Banner */}
                            {Object.keys(formErrors).length > 0 && (
                                <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 rounded-2xl flex items-center justify-between gap-3 text-rose-800 dark:text-rose-300 animate-in fade-in duration-150 shadow-xs">
                                    <div className="flex items-center gap-2.5">
                                        <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                                        <span className="text-xs font-bold">
                                            {formErrors.server_error || `Please fill in the compulsory field${Object.keys(formErrors).length > 1 ? 's' : ''} highlighted in red below.`}
                                        </span>
                                    </div>
                                    {!formErrors.server_error && (
                                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-200 dark:bg-rose-900 text-rose-900 dark:text-rose-200">
                                            {Object.keys(formErrors).length} required
                                        </span>
                                    )}
                                </div>
                            )}

                            {/* General & Customer Info Panel */}
                            <div className="bg-slate-50/80 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-4">
                                <h3 className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                                    1. Customer & Logistics Details
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <div className="md:col-span-2 space-y-1" data-has-error={!!formErrors.customer}>
                                        <label className="flex justify-between items-center text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                            <span>Select Customer from Master <span className="text-rose-500">*</span></span>
                                            {formErrors.customer && <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold">{formErrors.customer}</span>}
                                        </label>
                                        <SearchableSelect
                                            options={(Array.isArray(customers) ? customers : []).map(c => ({
                                                value: (c._id || c.id)?.toString(),
                                                label: `${c.name || c.companyName} ${c.code ? `(${c.code})` : ''} ${c.city ? `- ${c.city}` : ''}`.trim()
                                            }))}
                                            value={newRfq.customer}
                                            hasError={!!formErrors.customer}
                                            onChange={(val: any) => handleSelectCustomer(val)}
                                            placeholder="Search & Select Registered Customer..."
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-1.5">
                                            Currency *
                                        </label>
                                        <select
                                            value={newRfq.currency || 'INR'}
                                            onChange={(e) => setNewRfq({ ...newRfq, currency: e.target.value })}
                                            className="w-full px-3.5 py-2 bg-indigo-50/50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl text-sm font-bold text-indigo-700 dark:text-indigo-300 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        >
                                            {CURRENCY_OPTIONS.map((c) => (
                                                <option key={c.code} value={c.code}>
                                                    {c.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="space-y-1" data-has-error={!!formErrors.date}>
                                        <label className="flex justify-between items-center text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                            <span>RFQ Date <span className="text-rose-500">*</span></span>
                                            {formErrors.date && <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold">{formErrors.date}</span>}
                                        </label>
                                        <input
                                            type="date"
                                            value={newRfq.date}
                                            onChange={(e) => {
                                                setNewRfq({ ...newRfq, date: e.target.value });
                                                if (e.target.value) clearError('date');
                                            }}
                                            className={`w-full px-3.5 py-2 rounded-xl text-sm font-semibold outline-none transition-all ${
                                                formErrors.date
                                                    ? 'bg-rose-50/50 dark:bg-rose-950/40 border border-rose-500 text-rose-900 dark:text-rose-100 ring-1 ring-rose-400'
                                                    : 'bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500/20'
                                            }`}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                            Expected Delivery Date
                                        </label>
                                        <input
                                            type="date"
                                            value={newRfq.expectedDeliveryDate}
                                            onChange={(e) => setNewRfq({ ...newRfq, expectedDeliveryDate: e.target.value })}
                                            className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        />
                                    </div>

                                    <div className="md:col-span-2 lg:col-span-3">
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                            Remarks / Special Notes
                                        </label>
                                        <input
                                            type="text"
                                            value={newRfq.remarks}
                                            onChange={(e) => setNewRfq({ ...newRfq, remarks: e.target.value })}
                                            placeholder="e.g. Special packing requirement or urgency notes..."
                                            className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Select Requested Items Panel */}
                            <div className="bg-slate-50/80 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                                        2. Requested Customer Items
                                    </h3>
                                    <button
                                        type="button"
                                        onClick={handleAddItem}
                                        className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-950/80 bg-indigo-50 dark:bg-indigo-950/60 px-3.5 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 transition-colors"
                                    >
                                        + Add Item
                                    </button>
                                </div>

                                {/* Desktop Table Header */}
                                <div className="hidden lg:grid grid-cols-12 gap-3 px-3 py-1.5 text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    <div className="col-span-3">Finished Good (FG Item) *</div>
                                    <div className="col-span-1 text-center">HSN</div>
                                    <div className="col-span-3">Item Specifications / Details</div>
                                    <div className="col-span-2 text-center">Target Price ({getCurrencySymbol(newRfq.currency)})</div>
                                    <div className="col-span-1 text-center">Required Qty *</div>
                                    <div className="col-span-1 text-center">Unit</div>
                                    <div className="col-span-1 text-right">Action</div>
                                </div>

                                {/* Items Rows - All in 1 Line on Desktop */}
                                <div className="space-y-2.5">
                                    {newRfq.items.map((item, idx) => (
                                        <div key={idx} className="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                            <div className="grid grid-cols-12 gap-3 items-center">
                                                
                                                {/* FG Item Column */}
                                                <div className="col-span-12 lg:col-span-3" data-has-error={!!formErrors[`item_${idx}_fgItem`]}>
                                                    <label className="flex justify-between items-center lg:hidden text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                                                        <span>Finished Good (FG Item) <span className="text-rose-500">*</span></span>
                                                        {formErrors[`item_${idx}_fgItem`] && <span className="text-[9px] text-rose-600 dark:text-rose-400 font-bold">{formErrors[`item_${idx}_fgItem`]}</span>}
                                                    </label>
                                                    <SearchableSelect
                                                        options={fgOptions}
                                                        value={item.fgItem}
                                                        hasError={!!formErrors[`item_${idx}_fgItem`]}
                                                        onChange={(val: any) => handleItemChange(idx, 'fgItem', val)}
                                                        placeholder="Select FG Item..."
                                                        dropdownPosition="auto"
                                                    />
                                                </div>

                                                {/* HSN Code Column */}
                                                <div className="col-span-6 lg:col-span-1">
                                                    <label className="block lg:hidden text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                                                        HSN
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={item.hsnCode || ''}
                                                        onChange={(e) => handleItemChange(idx, 'hsnCode', e.target.value)}
                                                        placeholder="HSN"
                                                        className="w-full px-2 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-800 dark:text-slate-200 text-center outline-none focus:ring-1 focus:ring-indigo-500"
                                                    />
                                                </div>

                                                {/* Specifications / Technical Details Column */}
                                                <div className="col-span-12 lg:col-span-3">
                                                    <label className="block lg:hidden text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                                                        Item Specifications
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={item.description || ''}
                                                        onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                                                        placeholder="Technical specs, grade, dimensions..."
                                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-indigo-500"
                                                    />
                                                </div>

                                                {/* Target / List Price Column */}
                                                <div className="col-span-6 lg:col-span-2">
                                                    <label className="block lg:hidden text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                                                        Target Price ({getCurrencySymbol(newRfq.currency)})
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="any"
                                                        value={item.targetPrice}
                                                        onChange={(e) => handleItemChange(idx, 'targetPrice', e.target.value)}
                                                        placeholder="0.00"
                                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 outline-none focus:ring-1 focus:ring-indigo-500 text-center"
                                                    />
                                                </div>

                                                {/* Required Qty Column */}
                                                <div className="col-span-3 lg:col-span-1" data-has-error={!!formErrors[`item_${idx}_quantity`]}>
                                                    <label className="flex justify-between items-center lg:hidden text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                                                        <span>Qty <span className="text-rose-500">*</span></span>
                                                        {formErrors[`item_${idx}_quantity`] && <span className="text-[9px] text-rose-600 dark:text-rose-400 font-bold">{formErrors[`item_${idx}_quantity`]}</span>}
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={item.quantity}
                                                        onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                                                        placeholder="Qty"
                                                        className={`w-full px-3 py-2 border rounded-xl text-sm font-bold text-center outline-none transition-all ${
                                                            formErrors[`item_${idx}_quantity`]
                                                                ? 'bg-rose-50/50 dark:bg-rose-950/40 border-rose-500 text-rose-900 dark:text-rose-100 ring-1 ring-rose-400'
                                                                : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white'
                                                        }`}
                                                    />
                                                </div>

                                                {/* Unit Column */}
                                                <div className="col-span-3 lg:col-span-1">
                                                    <label className="block lg:hidden text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                                                        Unit
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={item.unit || 'PCS'}
                                                        onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                                                        className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 text-center"
                                                    />
                                                </div>

                                                {/* Action Column */}
                                                <div className="col-span-1 text-right">
                                                    {newRfq.items.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveItem(idx)}
                                                            className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors"
                                                            title="Remove Item"
                                                        >
                                                            <X size={18} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                        </div>

                        <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 flex-shrink-0">
                            <button onClick={() => { setIsCreateModalOpen(false); setEditingRfq(null); }} className="px-5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 font-semibold text-sm hover:bg-slate-100 transition-colors">
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateRfqSubmit}
                                disabled={submitting}
                                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-indigo-600/20 flex items-center gap-2"
                            >
                                <Inbox size={16} />
                                {submitting ? 'Saving...' : (editingRfq ? 'Update Inward RFQ' : 'Save Inward RFQ')}
                            </button>
                        </div>

                    </div>
                </div>
            )}

            {/* View RFQ & User Audit Details Modal */}
            {selectedRfq && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-[96vw] xl:max-w-7xl 2xl:max-w-[1550px] overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh]">
                        
                        <div className="p-5 sm:p-6 bg-slate-900 text-white flex justify-between items-center flex-shrink-0 border-b border-slate-800">
                            <div>
                                <h2 className="text-xl font-extrabold font-mono text-indigo-300">{selectedRfq.rfqNumber}</h2>
                                <p className="text-xs text-slate-400 mt-0.5">Inward RFQ & User Audit Details</p>
                            </div>
                            <button onClick={() => setSelectedRfq(null)} className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 transition-colors">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-5">
                            
                            {/* General Status & Interactive Control */}
                            <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 text-xs bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                                <div>
                                    <span className="text-slate-400 block mb-0.5">Expected Delivery Date:</span>
                                    <strong className="text-slate-800 dark:text-slate-200 font-bold">
                                        {selectedRfq.expectedDeliveryDate || selectedRfq.dueDate ? new Date(selectedRfq.expectedDeliveryDate || selectedRfq.dueDate).toLocaleDateString('en-GB') : 'N/A'}
                                    </strong>
                                </div>

                                <div>
                                    <span className="text-slate-400 block mb-0.5">Currency:</span>
                                    <strong className="text-indigo-600 dark:text-indigo-400 font-bold">
                                        {selectedRfq.currency || 'INR'} ({getCurrencySymbol(selectedRfq.currency)})
                                    </strong>
                                </div>

                                <div>
                                    <span className="text-slate-400 block mb-0.5">Estimated Target Total:</span>
                                    {(() => {
                                        const tot = calculateRfqTotalTargetValue(selectedRfq);
                                        const inr = convertToINR(tot, selectedRfq.currency);
                                        return (
                                            <div>
                                                <strong className="text-indigo-600 dark:text-indigo-400 font-extrabold font-mono text-sm block">
                                                    {getCurrencySymbol(selectedRfq.currency)}{tot.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </strong>
                                                {inr.isForeign && tot > 0 && (
                                                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 font-mono block mt-0.5">
                                                        ≈ {inr.formattedINR} (@ ₹{inr.rate.toFixed(2)})
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </div>

                                <div>
                                    <span className="text-slate-400 block mb-0.5">Current Status:</span>
                                    <select
                                        value={selectedRfq.status || 'Open'}
                                        onChange={(e) => handleStatusChange(selectedRfq._id, e.target.value)}
                                        className="px-3 py-1 rounded-xl text-xs font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700 outline-none cursor-pointer"
                                    >
                                        <option value="Draft">Draft</option>
                                        <option value="Open">Open</option>
                                        <option value="Quoted">Quoted</option>
                                        <option value="Closed">Closed</option>
                                        <option value="Rejected">Rejected</option>
                                    </select>
                                </div>

                                <div>
                                    <span className="text-slate-400 block mb-0.5">Created Date:</span>
                                    <strong className="text-slate-800 dark:text-slate-200 font-bold">{new Date(selectedRfq.date || selectedRfq.createdAt || Date.now()).toLocaleDateString('en-GB')}</strong>
                                </div>
                            </div>

                            {/* User Audit Information Box */}
                            <div className="p-4 bg-indigo-50/60 dark:bg-indigo-950/40 rounded-2xl border border-indigo-200 dark:border-indigo-800 space-y-3">
                                <h4 className="text-xs font-extrabold text-indigo-900 dark:text-indigo-200 uppercase tracking-wider flex items-center gap-1.5">
                                    <ShieldCheck size={16} className="text-indigo-600 dark:text-indigo-400" />
                                    User Audit Tracking & Ownership
                                </h4>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                    <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-indigo-100 dark:border-indigo-900">
                                        <User size={16} className="text-indigo-600 shrink-0" />
                                        <div className="truncate">
                                            <span className="text-[10px] text-slate-400 block">Created / Received By User</span>
                                            <strong className="text-slate-800 dark:text-slate-200 font-bold truncate block">{getUserName(selectedRfq.createdBy || selectedRfq.receivedBy)}</strong>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-indigo-100 dark:border-indigo-900">
                                        <UserCheck size={16} className="text-emerald-600 shrink-0" />
                                        <div className="truncate">
                                            <span className="text-[10px] text-slate-400 block">Last Updated By User</span>
                                            <strong className="text-slate-800 dark:text-slate-200 font-bold truncate block">{getUserName(selectedRfq.updatedBy || selectedRfq.createdBy || selectedRfq.receivedBy)}</strong>
                                        </div>
                                    </div>
                                </div>

                                {/* Status Change Audit History Log */}
                                {Array.isArray(selectedRfq.statusHistory) && selectedRfq.statusHistory.length > 0 && (
                                    <div className="pt-2 border-t border-indigo-100 dark:border-indigo-900 space-y-2">
                                        <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                                            <History size={13} /> Status Audit History Log
                                        </span>
                                        <div className="space-y-1.5 max-h-32 overflow-y-auto custom-scrollbar">
                                            {selectedRfq.statusHistory.map((h: any, idx: number) => (
                                                <div key={idx} className="flex justify-between items-center text-[11px] bg-white/80 dark:bg-slate-900/80 px-3 py-1.5 rounded-lg border border-indigo-100/60 dark:border-indigo-900/60">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold px-2 py-0.5 bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200 rounded text-[10px]">
                                                             {h.status}
                                                        </span>
                                                        <span className="text-slate-600 dark:text-slate-400 font-medium">By: {getUserName(h.updatedBy)}</span>
                                                    </div>
                                                    <span className="text-slate-400 font-mono text-[10px]">
                                                        {h.updatedAt ? new Date(h.updatedAt).toLocaleString('en-GB') : ''}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Customer Info Card */}
                            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1.5 text-xs">
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                                    <Building2 size={14} className="text-indigo-500" /> Customer Information
                                </h4>
                                <div className="font-extrabold text-slate-900 dark:text-white text-sm">
                                    {selectedRfq.customerName || selectedRfq.customer?.name || 'Customer'}
                                </div>
                                <div className="text-slate-500 font-medium space-x-3">
                                    {selectedRfq.customerEmail && <span>Email: {selectedRfq.customerEmail}</span>}
                                    {selectedRfq.customerPhone && <span>Phone: {selectedRfq.customerPhone}</span>}
                                </div>
                            </div>

                            {/* Requested Items Section */}
                            <div>
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Requested FG Items</h4>
                                <div className="border rounded-xl overflow-hidden">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-slate-100 dark:bg-slate-800 font-bold text-slate-600">
                                            <tr>
                                                <th className="p-3">Item Name</th>
                                                <th className="p-3 text-center">HSN</th>
                                                <th className="p-3 text-center">Required Qty</th>
                                                <th className="p-3 text-center">Target Rate ({selectedRfq.currency || 'INR'})</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {(selectedRfq.items || []).map((item: any, idx: number) => (
                                                <tr key={idx}>
                                                    <td className="p-3 font-bold">
                                                        {item.fgItem?.name || item.itemName || item.productName || 'FG Item'}
                                                        {item.fgItem?.code && <span className="text-[10px] text-slate-400 font-mono ml-1">[{item.fgItem.code}]</span>}
                                                        {item.description && <span className="block text-[10px] font-normal text-slate-400">{item.description}</span>}
                                                    </td>
                                                    <td className="p-3 text-center font-mono text-xs text-slate-600 dark:text-slate-400">{item.hsnCode || item.hsn || '-'}</td>
                                                    <td className="p-3 text-center font-bold text-indigo-600">{item.quantity} {item.unit || 'PCS'}</td>
                                                    <td className="p-3 text-center font-bold text-slate-700">{item.targetPrice ? `${getCurrencySymbol(selectedRfq.currency)}${item.targetPrice}` : '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-slate-50 dark:bg-slate-800 flex justify-between items-center border-t border-slate-200 dark:border-slate-700">
                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        if (typeof window !== 'undefined') {
                                            window.location.href = `/dashboard/store/sales/quotations?rfqId=${selectedRfq._id}`;
                                        }
                                    }}
                                    className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-xs rounded-xl transition-all shadow-md shadow-emerald-600/20 flex items-center gap-1.5"
                                >
                                    <FileText size={14} /> Create Outward Quotation
                                </button>
                                <button
                                    onClick={() => handlePrintInwardRfqPdf(selectedRfq)}
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-colors flex items-center gap-1 shadow-sm"
                                >
                                    <Printer size={14} /> Print PDF
                                </button>
                                <button
                                    onClick={() => {
                                        const rfqToEdit = selectedRfq;
                                        setSelectedRfq(null);
                                        handleOpenEditModal(rfqToEdit);
                                    }}
                                    className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-bold text-xs rounded-xl transition-colors flex items-center gap-1"
                                >
                                    <Edit2 size={14} /> Edit RFQ
                                </button>
                                <button
                                    onClick={() => handleDeleteRfq(selectedRfq)}
                                    className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400 font-bold text-xs rounded-xl transition-colors flex items-center gap-1"
                                >
                                    <Trash2 size={14} /> Delete RFQ
                                </button>
                            </div>
                            <button onClick={() => setSelectedRfq(null)} className="px-5 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl">
                                Close
                            </button>
                        </div>

                    </div>
                </div>
            )}

        </div>
    );
}

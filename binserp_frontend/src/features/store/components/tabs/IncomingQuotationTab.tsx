import React, { useState, useEffect, useMemo } from 'react';
import { FileText, Plus, Search, Calendar, User, Eye, CheckCircle2, Clock, Filter, ArrowRight, X, Building2, Printer, LayoutGrid, List, BarChart3, ShoppingCart, Award } from 'lucide-react';
import { apiGet, apiPost, apiPut } from '@/src/lib/api';
import SearchableSelect from '../SearchableSelect';
import { generateFrontendVendorQuotationPDF } from '@/src/utils/frontendPdfHelper';
import PoGenerationModal from '../modals/PoGenerationModal';

interface IncomingQuotationTabProps {
    token: string | null;
    onError: (msg: string) => void;
    onSuccess: (msg: string) => void;
}

export default function IncomingQuotationTab({ token, onError, onSuccess }: IncomingQuotationTabProps) {
    const [loading, setLoading] = useState(true);
    const [quotations, setQuotations] = useState<any[]>([]);
    const [rfqs, setRfqs] = useState<any[]>([]);
    const [vendors, setVendors] = useState<any[]>([]);
    const [companyInfo, setCompanyInfo] = useState<any>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('All');
    const [viewMode, setViewMode] = useState<'matrix' | 'buckets' | 'table'>('matrix');

    // PO Generation Modal State
    const [poModalQuote, setPoModalQuote] = useState<any | null>(null);
    const [poSubmitting, setPoSubmitting] = useState(false);

    // Create Modal State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [selectedRfqId, setSelectedRfqId] = useState<string>('');
    const [newQuote, setNewQuote] = useState({
        quotationNumber: '',
        rfqId: '',
        rfqNumber: '',
        vendorId: '',
        vendorName: '',
        vendorAddress: '',
        vendorEmail: '',
        vendorPhone: '',
        date: new Date().toISOString().slice(0, 10),
        validUntil: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        termsAndConditions: '',
        items: [] as any[],
        subtotal: 0,
        totalTax: 0,
        grandTotal: 0
    });

    // View Modal State
    const [selectedQuote, setSelectedQuote] = useState<any | null>(null);

    const fetchData = async () => {
        if (!token) return;
        try {
            setLoading(true);
            const [quotRes, rfqRes, venRes, compRes] = await Promise.all([
                apiGet('/api/purchase/quotation', token).catch(() => ({ data: [] })),
                apiGet('/api/purchase/rfq', token).catch(() => ({ data: [] })),
                apiGet('/api/store/vendor', token).catch(() => []),
                apiGet('/api/store/company-info', token).catch(() => null)
            ]);

            const quotList = Array.isArray(quotRes?.data) ? quotRes.data : (Array.isArray(quotRes) ? quotRes : []);
            const rfqList = Array.isArray(rfqRes?.data) ? rfqRes.data : (Array.isArray(rfqRes?.rfqs) ? rfqRes.rfqs : (Array.isArray(rfqRes) ? rfqRes : []));
            const venList = Array.isArray(venRes?.vendors) ? venRes.vendors : (Array.isArray(venRes) ? venRes : []);

            setQuotations(quotList);
            setRfqs(rfqList);
            setVendors(venList);
            setCompanyInfo(compRes?.companyInfo || compRes);
        } catch (err: any) {
            console.error("Fetch quotations error:", err);
            onError(err.message || "Failed to fetch Vendor Quotations");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [token]);

    const generateQuoteNo = () => {
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        return `VQ-${dateStr}-${randomNum}`;
    };

    const handleOpenCreateModal = () => {
        setSelectedRfqId('');
        setNewQuote({
            quotationNumber: generateQuoteNo(),
            rfqId: '',
            rfqNumber: '',
            vendorId: '',
            vendorName: '',
            vendorAddress: '',
            vendorEmail: '',
            vendorPhone: '',
            date: new Date().toISOString().slice(0, 10),
            validUntil: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
            termsAndConditions: '',
            items: [],
            subtotal: 0,
            totalTax: 0,
            grandTotal: 0
        });
        setIsCreateModalOpen(true);
    };

    // Auto-fetch materials & vendors when an Outward RFQ is selected
    const handleSelectRfq = (rfqId: string) => {
        setSelectedRfqId(rfqId);
        const selectedRfq = (Array.isArray(rfqs) ? rfqs : []).find((r: any) => r._id === rfqId);
        if (!selectedRfq) return;

        const autoItems = (selectedRfq.items || []).map((it: any) => ({
            materialId: it.materialId,
            materialName: it.materialName || 'Material Item',
            quantity: Number(it.quantity) || 1,
            unit: it.unit || it.uom || 'PCS',
            unitPrice: Number(it.targetPrice) || 0,
            tax: 18,
            total: (Number(it.quantity) || 1) * (Number(it.targetPrice) || 0) * 1.18,
            remarks: it.remarks || ''
        }));

        const sub = autoItems.reduce((acc: number, cur: any) => acc + (cur.quantity * cur.unitPrice), 0);
        const tax = sub * 0.18;

        setNewQuote(prev => ({
            ...prev,
            rfqId,
            rfqNumber: selectedRfq.rfqNumber || '',
            items: autoItems,
            subtotal: sub,
            totalTax: tax,
            grandTotal: sub + tax
        }));
    };

    const handleSelectVendor = (vendorId: string) => {
        const selectedVen = (Array.isArray(vendors) ? vendors : []).find((v: any) => v._id === vendorId);
        if (!selectedVen) return;

        setNewQuote(prev => ({
            ...prev,
            vendorId,
            vendorName: selectedVen.name || '',
            vendorAddress: selectedVen.address || selectedVen.billingAddress || '',
            vendorEmail: selectedVen.email || '',
            vendorPhone: selectedVen.phone || selectedVen.contactNumber || '',
        }));
    };

    const handleItemPriceChange = (index: number, field: string, value: any) => {
        const updatedItems = [...newQuote.items];
        updatedItems[index] = { ...updatedItems[index], [field]: Number(value) || 0 };

        const qty = Number(updatedItems[index].quantity) || 0;
        const rate = Number(updatedItems[index].unitPrice) || 0;
        const taxPct = Number(updatedItems[index].tax) || 0;
        const total = (qty * rate) * (1 + taxPct / 100);
        updatedItems[index].total = total;

        let sub = 0;
        let tax = 0;
        updatedItems.forEach((it: any) => {
            const lineSub = (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0);
            const lineTax = lineSub * ((Number(it.tax) || 0) / 100);
            sub += lineSub;
            tax += lineTax;
        });

        setNewQuote(prev => ({
            ...prev,
            items: updatedItems,
            subtotal: sub,
            totalTax: tax,
            grandTotal: sub + tax
        }));
    };

    const handleCreateQuoteSubmit = async () => {
        if (!newQuote.vendorName) {
            onError("Please select a vendor for the incoming quotation");
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                ...newQuote,
                rfq: newQuote.rfqId || undefined,
                vendor: newQuote.vendorId || undefined
            };
            await apiPost('/api/purchase/quotation', payload, token);
            onSuccess("Incoming Vendor Quotation logged successfully");
            setIsCreateModalOpen(false);
            fetchData();
        } catch (err: any) {
            onError(err.message || "Failed to log incoming vendor quotation");
        } finally {
            setSubmitting(false);
        }
    };

    const handleOpenPoModal = (quote: any) => {
        setPoModalQuote(quote);
    };

    const handlePoModalSubmit = async (poPayload: any) => {
        if (!poModalQuote) return;
        setPoSubmitting(true);
        try {
            // 1. Mark Quotation as Approved
            await apiPut(`/api/purchase/quotation/${poModalQuote._id}`, { status: 'Approved' }, token);

            // 2. Create Outward Purchase Order (PO)
            await apiPost('/api/purchase/po', poPayload, token);

            onSuccess(`Outward PO ${poPayload.poNumber} created successfully for quotation ${poModalQuote.quotationNumber} and listed under Outward PO.`);
            setPoModalQuote(null);
            fetchData();
        } catch (err: any) {
            console.error("PO Generation submit error:", err);
            onError(err.message || "Failed to generate Outward PO");
        } finally {
            setPoSubmitting(false);
        }
    };

    const handlePrintQuotePdf = (quote: any) => {
        generateFrontendVendorQuotationPDF({
            quotation: quote,
            vendor: quote.vendor,
            companyInfo
        });
    };

    const filteredQuotations = useMemo(() => {
        return (Array.isArray(quotations) ? quotations : []).filter((q: any) => {
            const matchSearch = 
                (q.quotationNumber && q.quotationNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (q.rfqNumber && q.rfqNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (q.vendorName && q.vendorName.toLowerCase().includes(searchTerm.toLowerCase()));
            
            const matchStatus = filterStatus === 'All' || q.status === filterStatus;
            return matchSearch && matchStatus;
        });
    }, [quotations, searchTerm, filterStatus]);

    // Group Quotations by Linked RFQ for Rate Comparison Matrix
    const rfqMatrixGroups = useMemo(() => {
        const groups: { [rfqNo: string]: any[] } = {};

        filteredQuotations.forEach((q: any) => {
            const key = q.rfqNumber || 'Direct / General Quotes';
            if (!groups[key]) groups[key] = [];
            groups[key].push(q);
        });

        // Tag lowest bidder L1 in each RFQ group
        Object.keys(groups).forEach(key => {
            groups[key].sort((a: any, b: any) => (a.grandTotal || a.subtotal || 0) - (b.grandTotal || b.subtotal || 0));
            groups[key].forEach((q: any, rank: number) => {
                q.bidRank = `L${rank + 1}`;
            });
        });

        return groups;
    }, [filteredQuotations]);

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            
            {/* Header & Actions */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                        <FileText size={22} className="text-cyan-600" /> Incoming Vendor Quotations & Price Matrix
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Log subcontractor & vendor rate quotes linked to Outward RFQs, compare bids (L1/L2), and convert to POs.
                    </p>
                </div>

                <button
                    onClick={handleOpenCreateModal}
                    className="px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold text-xs rounded-xl shadow-md shadow-cyan-600/20 hover:shadow-lg transition-all flex items-center gap-2"
                >
                    <Plus size={16} /> Add Incoming Quote
                </button>
            </div>

            {/* Filter & View Mode Bar */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="relative w-full sm:w-80">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                        type="text"
                        placeholder="Search Quote #, RFQ #, or Vendor..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 bg-slate-50/50 dark:bg-slate-800/50"
                    />
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold">
                        {['All', 'Pending Approval', 'Approved', 'Rejected'].map(status => (
                            <button
                                key={status}
                                onClick={() => setFilterStatus(status)}
                                className={`px-3 py-1.5 rounded-lg transition-all ${filterStatus === status ? 'bg-white dark:bg-slate-900 text-cyan-600 shadow-sm' : 'text-slate-500'}`}
                            >
                                {status}
                            </button>
                        ))}
                    </div>

                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold">
                        <button
                            onClick={() => setViewMode('matrix')}
                            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${viewMode === 'matrix' ? 'bg-cyan-600 text-white shadow-sm font-bold' : 'text-slate-500'}`}
                        >
                            <BarChart3 size={15} /> Rate Matrix (L1/L2)
                        </button>
                        <button
                            onClick={() => setViewMode('buckets')}
                            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${viewMode === 'buckets' ? 'bg-cyan-600 text-white shadow-sm font-bold' : 'text-slate-500'}`}
                        >
                            <LayoutGrid size={15} /> Vendor Buckets
                        </button>
                        <button
                            onClick={() => setViewMode('table')}
                            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${viewMode === 'table' ? 'bg-cyan-600 text-white shadow-sm font-bold' : 'text-slate-500'}`}
                        >
                            <List size={15} /> Table
                        </button>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center p-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
                </div>
            ) : Object.keys(rfqMatrixGroups).length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                    <FileText className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No Incoming Vendor Quotations Found</h3>
                    <p className="text-xs text-slate-500 mt-1">Select an Outward RFQ and log vendor quoted prices to auto-compare bids.</p>
                </div>
            ) : viewMode === 'matrix' ? (
                
                /* Comparative Rate Matrix View (Grouped by Linked RFQ) */
                <div className="space-y-6">
                    {Object.keys(rfqMatrixGroups).map(rfqKey => {
                        const quoteGroup = rfqMatrixGroups[rfqKey];
                        const l1Quote = quoteGroup[0];

                        return (
                            <div key={rfqKey} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-base font-black text-slate-900 dark:text-white">
                                                RFQ Reference: <span className="text-cyan-600 dark:text-cyan-400 font-mono">{rfqKey}</span>
                                            </h3>
                                            <span className="bg-cyan-50 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800 text-xs font-bold px-2.5 py-0.5 rounded-full">
                                                {quoteGroup.length} Vendor Quotes Received
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-0.5">
                                            Side-by-side vendor quotation rate analysis and bid evaluation.
                                        </p>
                                    </div>

                                    {l1Quote && (
                                        <div className="bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5">
                                            <Award size={16} className="text-emerald-600" />
                                            Lowest Bidder (L1): <strong className="text-emerald-700 dark:text-emerald-300">{l1Quote.vendorName}</strong> (₹{Number(l1Quote.grandTotal || l1Quote.subtotal || 0).toLocaleString()})
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {quoteGroup.map((quote: any) => {
                                        const isL1 = quote.bidRank === 'L1';

                                        return (
                                            <div
                                                key={quote._id}
                                                className={`rounded-2xl border p-4 transition-all flex flex-col justify-between space-y-3 ${
                                                    isL1
                                                        ? 'bg-emerald-50/40 border-emerald-300 dark:bg-emerald-950/30 dark:border-emerald-800'
                                                        : 'bg-slate-50/50 border-slate-200 dark:bg-slate-800/40 dark:border-slate-700'
                                                }`}
                                            >
                                                <div className="space-y-2">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <div className="flex items-center gap-1.5">
                                                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${isL1 ? 'bg-emerald-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'}`}>
                                                                    {quote.bidRank}
                                                                </span>
                                                                <h4 className="font-extrabold text-slate-900 dark:text-white text-sm">
                                                                    {quote.vendorName}
                                                                </h4>
                                                            </div>
                                                            <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                                                                Quote #: {quote.quotationNumber}
                                                            </span>
                                                        </div>

                                                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                                            quote.status === 'Approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                                        }`}>
                                                            {quote.status || 'Pending'}
                                                        </span>
                                                    </div>

                                                    {/* Items Rate Table */}
                                                    <div className="bg-white dark:bg-slate-900 rounded-xl p-2.5 border border-slate-200 dark:border-slate-800 space-y-1 text-xs">
                                                        {(quote.items || []).map((it: any, idx: number) => (
                                                            <div key={idx} className="flex justify-between items-center py-0.5">
                                                                <span className="font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[170px]">{it.materialName || 'Material'}</span>
                                                                <span className="font-bold text-slate-900 dark:text-white font-mono">
                                                                    ₹{Number(it.unitPrice || 0).toLocaleString()} <span className="text-[10px] text-slate-400">/{it.unit || 'PCS'}</span>
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-2">
                                                    <div className="flex justify-between items-center text-xs font-bold">
                                                        <span className="text-slate-500">Quoted Total:</span>
                                                        <span className="text-cyan-600 dark:text-cyan-400 font-mono text-sm">₹{Number(quote.grandTotal || quote.subtotal || 0).toLocaleString()}</span>
                                                    </div>

                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => handlePrintQuotePdf(quote)}
                                                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition-colors inline-flex items-center gap-1"
                                                        >
                                                            <Printer size={14} /> PDF
                                                        </button>

                                                        <button
                                                            onClick={() => handleOpenPoModal(quote)}
                                                            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-emerald-600/20 inline-flex items-center gap-1.5"
                                                        >
                                                            <ShoppingCart size={14} /> {quote.status === 'Approved' ? 'Re-Generate PO' : 'Generate PO'}
                                                        </button>
                                                    </div>
                                                </div>

                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : viewMode === 'buckets' ? (

                /* Vendor Buckets View */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredQuotations.map((quote) => (
                        <div key={quote._id} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4 flex flex-col justify-between">
                            <div className="space-y-2">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-2">
                                        <div className="w-9 h-9 rounded-xl bg-cyan-50 dark:bg-cyan-950 text-cyan-600 flex items-center justify-center font-bold">
                                            <Building2 size={18} />
                                        </div>
                                        <div>
                                            <h3 className="font-extrabold text-slate-900 dark:text-white text-sm">{quote.vendorName}</h3>
                                            <span className="text-[10px] text-slate-400 font-mono block">Quote #: {quote.quotationNumber}</span>
                                        </div>
                                    </div>
                                    <span className="bg-cyan-50 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300 font-mono text-[10px] font-bold px-2 py-0.5 rounded border border-cyan-200 dark:border-cyan-800">
                                        RFQ: {quote.rfqNumber || 'N/A'}
                                    </span>
                                </div>

                                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 space-y-1 text-xs border border-slate-100 dark:border-slate-800">
                                    {(quote.items || []).map((it: any, idx: number) => (
                                        <div key={idx} className="flex justify-between text-xs">
                                            <span className="font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[170px]">{it.materialName}</span>
                                            <span className="font-bold text-slate-900 dark:text-white">₹{it.unitPrice}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center gap-2">
                                <span className="font-mono text-cyan-600 dark:text-cyan-400 font-bold text-sm">₹{Number(quote.grandTotal || quote.subtotal || 0).toLocaleString()}</span>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handlePrintQuotePdf(quote)}
                                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5"
                                    >
                                        <Printer size={14} /> PDF
                                    </button>
                                    <button
                                        onClick={() => handleOpenPoModal(quote)}
                                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
                                    >
                                        <ShoppingCart size={14} /> Generate PO
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (

                /* Table View */
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                                <tr>
                                    <th className="px-5 py-3.5">Quotation #</th>
                                    <th className="px-5 py-3.5">Linked RFQ #</th>
                                    <th className="px-5 py-3.5">Vendor Name</th>
                                    <th className="px-5 py-3.5 text-center">Date</th>
                                    <th className="px-5 py-3.5 text-right">Grand Total</th>
                                    <th className="px-5 py-3.5 text-center">Status</th>
                                    <th className="px-5 py-3.5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                {filteredQuotations.map((q) => (
                                    <tr key={q._id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="px-5 py-4 font-mono font-bold text-cyan-600 dark:text-cyan-400">{q.quotationNumber}</td>
                                        <td className="px-5 py-4 font-mono text-slate-700 dark:text-slate-300 font-bold">{q.rfqNumber || 'N/A'}</td>
                                        <td className="px-5 py-4 font-bold text-slate-800 dark:text-slate-200">{q.vendorName}</td>
                                        <td className="px-5 py-4 text-center font-semibold text-slate-600 dark:text-slate-400">{new Date(q.date || Date.now()).toLocaleDateString('en-GB')}</td>
                                        <td className="px-5 py-4 text-right font-extrabold text-cyan-600 dark:text-cyan-400 font-mono">₹{Number(q.grandTotal || q.subtotal || 0).toLocaleString()}</td>
                                        <td className="px-5 py-4 text-center">
                                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${q.status === 'Approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                                {q.status || 'Pending'}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 text-right space-x-2">
                                            <button onClick={() => handlePrintQuotePdf(q)} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold inline-flex items-center gap-1">
                                                <Printer size={14} /> PDF
                                            </button>
                                            <button onClick={() => handleOpenPoModal(q)} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1">
                                                <ShoppingCart size={14} /> Generate PO
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Create Inward Quotation Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
                        
                        <div className="p-6 bg-cyan-950 text-white flex justify-between items-center flex-shrink-0 border-b border-cyan-900">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-cyan-900 rounded-xl flex items-center justify-center border border-cyan-700">
                                    <FileText size={20} className="text-cyan-300" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-extrabold tracking-tight">Log Incoming Vendor Quotation</h2>
                                    <p className="text-xs text-cyan-300/80 mt-0.5">Quote #: <span className="font-mono font-bold text-white">{newQuote.quotationNumber}</span></p>
                                </div>
                            </div>
                            <button onClick={() => setIsCreateModalOpen(false)} className="w-8 h-8 rounded-full bg-cyan-900 hover:bg-cyan-800 flex items-center justify-center text-white transition-colors">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 space-y-6">
                            
                            {/* Step 1: Select Linked Outward RFQ */}
                            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                                <label className="block text-xs font-extrabold text-cyan-700 dark:text-cyan-300 uppercase tracking-wider">
                                    Select Linked Outward RFQ (Auto-Fetches Materials & Vendor)
                                </label>
                                <SearchableSelect
                                    options={(Array.isArray(rfqs) ? rfqs : []).map((r: any) => ({
                                        value: r._id,
                                        label: `${r.rfqNumber} (${Array.isArray(r.items) ? r.items.length : 0} Items | Due: ${r.dueDate ? new Date(r.dueDate).toLocaleDateString('en-GB') : 'Immediate'})`
                                    }))}
                                    value={selectedRfqId}
                                    onChange={(val: any) => handleSelectRfq(val)}
                                    placeholder="Select Outward RFQ to Auto-Fill..."
                                />
                            </div>

                            {/* Step 2: Vendor Selection */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                                        Select Vendor Submitting Quote <span className="text-red-500">*</span>
                                    </label>
                                    <SearchableSelect
                                        options={(Array.isArray(vendors) ? vendors : []).map((v: any) => ({ value: v._id, label: `${v.name} (${v.city || 'Supplier'})` }))}
                                        value={newQuote.vendorId}
                                        onChange={(val: any) => handleSelectVendor(val)}
                                        placeholder="Select Vendor..."
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                                        Quotation Valid Until
                                    </label>
                                    <input
                                        type="date"
                                        value={newQuote.validUntil}
                                        onChange={(e) => setNewQuote({ ...newQuote, validUntil: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-cyan-500/20"
                                    />
                                </div>
                            </div>

                            {/* Step 3: Quoted Material Rates Table (Only Enter Price!) */}
                            <div className="space-y-3">
                                <h3 className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    Materials Requested & Vendor Quoted Rates
                                </h3>

                                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-slate-100 dark:bg-slate-800 font-bold text-slate-600 dark:text-slate-400 uppercase border-b border-slate-200 dark:border-slate-700">
                                            <tr>
                                                <th className="px-4 py-3">Requested Material</th>
                                                <th className="px-4 py-3 text-center">Req Qty</th>
                                                <th className="px-4 py-3 text-right w-36">Quoted Unit Rate (₹)</th>
                                                <th className="px-4 py-3 text-center w-24">GST %</th>
                                                <th className="px-4 py-3 text-right">Line Total (₹)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                                            {newQuote.items.map((item, idx) => (
                                                <tr key={idx}>
                                                    <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                                                        {item.materialName}
                                                    </td>
                                                    <td className="px-4 py-3 text-center font-bold text-slate-700 dark:text-slate-300">
                                                        {item.quantity} {item.unit}
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="any"
                                                            value={item.unitPrice || ''}
                                                            onChange={(e) => handleItemPriceChange(idx, 'unitPrice', e.target.value)}
                                                            placeholder="0.00"
                                                            className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-bold text-slate-900 dark:text-white text-right focus:ring-2 focus:ring-cyan-500/20"
                                                        />
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="any"
                                                            value={item.tax || ''}
                                                            onChange={(e) => handleItemPriceChange(idx, 'tax', e.target.value)}
                                                            placeholder="18"
                                                            className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-center"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-extrabold text-cyan-600 font-mono">
                                                        ₹{Number(item.total || 0).toLocaleString()}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Total Summary */}
                            <div className="flex justify-end bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                                <div className="w-64 space-y-1.5 text-xs">
                                    <div className="flex justify-between text-slate-600 dark:text-slate-400"><span>Subtotal:</span> <span className="font-bold">₹{Number(newQuote.subtotal).toLocaleString()}</span></div>
                                    <div className="flex justify-between text-slate-600 dark:text-slate-400"><span>Total GST:</span> <span className="font-bold">₹{Number(newQuote.totalTax).toLocaleString()}</span></div>
                                    <div className="flex justify-between text-sm font-extrabold text-slate-900 dark:text-white pt-1 border-t">
                                        <span>Grand Total:</span> <span className="text-cyan-600 font-mono">₹{Number(newQuote.grandTotal).toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>

                        </div>

                        <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 flex-shrink-0">
                            <button onClick={() => setIsCreateModalOpen(false)} className="px-5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 font-semibold text-sm">
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateQuoteSubmit}
                                disabled={submitting || !newQuote.vendorName}
                                className="px-6 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-cyan-600/20 flex items-center gap-2"
                            >
                                <CheckCircle2 size={16} />
                                {submitting ? 'Logging Quote...' : 'Submit Vendor Quotation'}
                            </button>
                        </div>

                    </div>
                </div>
            )}

            {/* PO Generation Modal */}
            {poModalQuote && (
                <PoGenerationModal
                    isOpen={!!poModalQuote}
                    onClose={() => setPoModalQuote(null)}
                    onSubmit={handlePoModalSubmit}
                    quotation={poModalQuote}
                    vendors={vendors}
                    submitting={poSubmitting}
                />
            )}

        </div>
    );
}

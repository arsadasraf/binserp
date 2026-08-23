import React, { useState, useEffect, useMemo } from 'react';
import { FileText, Plus, Search, Calendar, User, Eye, CheckCircle2, Clock, Filter, ArrowRight, X, Building2, Printer, LayoutGrid, List, Edit2, Trash2, UserCheck, History, ShieldCheck, Download, ShoppingCart } from 'lucide-react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/src/lib/api';
import SearchableSelect from '../SearchableSelect';
import { generateFrontendOutwardQuotationPDF } from '@/src/utils/frontendPdfHelper';

interface OutwardQuotationTabProps {
    token: string | null;
    initialRfqId?: string | null;
    onError: (msg: string) => void;
    onSuccess: (msg: string) => void;
}

export default function OutwardQuotationTab({ token, initialRfqId, onError, onSuccess }: OutwardQuotationTabProps) {
    const [loading, setLoading] = useState(true);
    const [quotations, setQuotations] = useState<any[]>([]);
    const [rfqs, setRfqs] = useState<any[]>([]);
    const [fgItems, setFgItems] = useState<any[]>([]);
    const [customers, setCustomers] = useState<any[]>([]);
    const [companyInfo, setCompanyInfo] = useState<any>(null);

    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('All');
    const [filterCustomer, setFilterCustomer] = useState<string>('All');

    // Create / Edit Modal State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingQuote, setEditingQuote] = useState<any | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [selectedRfqId, setSelectedRfqId] = useState<string>('');

    const [newQuote, setNewQuote] = useState({
        quotationNumber: '',
        rfq: '',
        rfqId: '',
        rfqNumber: '',
        customer: '',
        customerName: '',
        customerAddress: '',
        customerEmail: '',
        customerPhone: '',
        date: new Date().toISOString().slice(0, 10),
        validUntil: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        transportationType: 'Included',
        transportationCharges: 0,
        packagingType: 'Standard',
        packagingCharges: 0,
        otherDetails: '',
        status: 'Draft',
        items: [] as any[],
        subtotal: 0,
        taxAmount: 0,
        totalAmount: 0
    });

    const [priceLists, setPriceLists] = useState<any[]>([]);
    const hasAutoOpenedRfq = React.useRef(false);

    // View Modal State
    const [selectedQuote, setSelectedQuote] = useState<any | null>(null);

    const fetchData = async () => {
        if (!token) return;
        try {
            setLoading(true);
            const [quotRes, rfqRes, fgRes, custRes, compRes, priceRes] = await Promise.all([
                apiGet('/api/sales/quotation', token).catch(() => ({ quotations: [] })),
                apiGet('/api/sales/incoming-rfq', token).catch(() => ({ rfqs: [] })),
                apiGet('/api/store/fg-item', token).catch(() => []),
                apiGet('/api/store/customer', token).catch(() => []),
                apiGet('/api/store/company-info', token).catch(() => null),
                apiGet('/api/sales/price-list', token).catch(() => ({ priceLists: [] }))
            ]);

            const quotList = Array.isArray(quotRes?.quotations) ? quotRes.quotations : (Array.isArray(quotRes?.data) ? quotRes.data : (Array.isArray(quotRes) ? quotRes : []));
            const rfqList = Array.isArray(rfqRes?.rfqs) ? rfqRes.rfqs : (Array.isArray(rfqRes?.data) ? rfqRes.data : (Array.isArray(rfqRes) ? rfqRes : []));
            const fgList = Array.isArray(fgRes?.fgItems) ? fgRes.fgItems : (Array.isArray(fgRes) ? fgRes : []);
            const custList = Array.isArray(custRes?.customers) ? custRes.customers : (Array.isArray(custRes) ? custRes : []);
            const priceList = Array.isArray(priceRes?.priceLists) ? priceRes.priceLists : (Array.isArray(priceRes?.data) ? priceRes.data : (Array.isArray(priceRes) ? priceRes : []));

            setQuotations(quotList);
            setRfqs(rfqList);
            setFgItems(fgList);
            setCustomers(custList);
            setPriceLists(priceList);
            setCompanyInfo(compRes?.companyInfo || compRes);

            // Auto-trigger Create Modal ONLY ONCE if initialRfqId was passed in URL query
            if (initialRfqId && !hasAutoOpenedRfq.current) {
                hasAutoOpenedRfq.current = true;
                const targetRfq = rfqList.find((r: any) => r._id === initialRfqId);
                if (targetRfq) {
                    handleOpenCreateModalWithRfq(targetRfq, custList, fgList);
                }
            }
        } catch (err: any) {
            console.error("Fetch Outward Quotations error:", err);
            onError(err.message || "Failed to fetch Outward Sales Quotations");
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
        return `QT-OUT-${dateStr}-${randomNum}`;
    };

    const getUserName = (userObj: any) => {
        if (!userObj) return 'Sales User';
        if (typeof userObj === 'string') return userObj;
        return userObj.name || userObj.email || 'User';
    };

    const handlePrintQuotePdf = (quote: any) => {
        try {
            const customerObj = (Array.isArray(customers) ? customers : []).find(
                (c: any) => (c._id || c.id)?.toString() === (quote.customer?._id || quote.customer)?.toString()
            ) || { name: quote.customerName, email: quote.customerEmail, phone: quote.customerPhone, address: quote.customerAddress };

            generateFrontendOutwardQuotationPDF({ quotation: quote, customer: customerObj, companyInfo });
            onSuccess(`Outward Quotation PDF generated for ${quote.customerName || 'Customer'}`);
        } catch (err: any) {
            onError(err.message || "Failed to generate PDF");
        }
    };

    const handleOpenCreateModal = () => {
        setEditingQuote(null);
        setSelectedRfqId('');
        setNewQuote({
            quotationNumber: generateQuoteNo(),
            rfq: '',
            rfqId: '',
            rfqNumber: '',
            customer: '',
            customerName: '',
            customerAddress: '',
            customerEmail: '',
            customerPhone: '',
            date: new Date().toISOString().slice(0, 10),
            validUntil: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
            transportationType: 'Included',
            transportationCharges: 0,
            packagingType: 'Standard',
            packagingCharges: 0,
            otherDetails: '',
            status: 'Draft',
            items: [{ fgItem: '', productName: '', description: '', quantity: 1, unit: 'PCS', rate: 0, taxRate: 18, amount: 0 }],
            subtotal: 0,
            taxAmount: 0,
            totalAmount: 0
        });
        setIsCreateModalOpen(true);
    };

    const fgOptions = useMemo(() => {
        return (Array.isArray(fgItems) ? fgItems : [])
            .map(m => {
                const pEntry = (Array.isArray(priceLists) ? priceLists : []).find((p: any) => {
                    const pFgId = typeof p.fgItem === 'string' ? p.fgItem : (p.fgItem?._id || p.fgItem?.id);
                    return pFgId?.toString() === (m._id || m.id)?.toString();
                });
                const rate = pEntry && pEntry.price != null ? Number(pEntry.price) : (Number(m.sellingPrice || m.unitPrice || 0));
                const priceText = rate > 0 ? ` — ₹${rate}` : '';
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
    }, [fgItems, priceLists]);

    const handleOpenCreateModalWithRfq = (targetRfq: any, custList: any[], fgList: any[]) => {
        setEditingQuote(null);
        setSelectedRfqId(targetRfq._id);
        const custId = targetRfq.customer?._id || targetRfq.customer;
        const matchedCust = (custList || []).find((c: any) => (c._id || c.id)?.toString() === custId?.toString());

        const autoItems = (targetRfq.items || []).map((it: any) => {
            const qty = Number(it.quantity) || 1;
            const fgId = (it.fgItem?._id || it.fgItem || '').toString();
            const matchedFg = (fgList || []).find((m: any) => (m._id || m.id)?.toString() === fgId);
            const pEntry = (Array.isArray(priceLists) ? priceLists : []).find((p: any) => {
                const pFgId = typeof p.fgItem === 'string' ? p.fgItem : (p.fgItem?._id || p.fgItem?.id);
                return pFgId?.toString() === fgId;
            });
            const rate = Number(it.targetPrice) > 0 ? Number(it.targetPrice) : (pEntry && pEntry.price != null ? Number(pEntry.price) : Number(matchedFg?.sellingPrice || 0));
            const taxRate = pEntry && pEntry.taxRate != null ? Number(pEntry.taxRate) : Number(matchedFg?.taxRate || 18);
            const prodName = matchedFg?.name || it.fgItem?.name || it.itemName || 'FG Item';
            const amount = qty * rate * (1 + taxRate / 100);

            return {
                fgItem: fgId,
                productName: prodName,
                description: it.description || matchedFg?.description || '',
                quantity: qty,
                unit: it.unit || matchedFg?.unit || 'PCS',
                rate: rate,
                taxRate: taxRate,
                taxAmount: qty * rate * (taxRate / 100),
                amount: amount
            };
        });

        const sub = autoItems.reduce((acc: number, cur: any) => acc + (cur.quantity * cur.rate), 0);
        const tax = autoItems.reduce((acc: number, cur: any) => acc + (cur.taxAmount || 0), 0);

        setNewQuote({
            quotationNumber: generateQuoteNo(),
            rfq: targetRfq._id,
            rfqId: targetRfq._id,
            rfqNumber: targetRfq.rfqNumber || '',
            customer: custId || '',
            customerName: targetRfq.customerName || matchedCust?.name || '',
            customerAddress: matchedCust?.address || matchedCust?.billingAddress || '',
            customerEmail: targetRfq.customerEmail || matchedCust?.email || '',
            customerPhone: targetRfq.customerPhone || matchedCust?.phone || '',
            date: new Date().toISOString().slice(0, 10),
            validUntil: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
            transportationType: 'Included',
            transportationCharges: 0,
            packagingType: 'Standard',
            packagingCharges: 0,
            otherDetails: targetRfq.remarks || '',
            status: 'Draft',
            items: autoItems.length > 0 ? autoItems : [{ fgItem: '', productName: '', description: '', quantity: 1, unit: 'PCS', rate: 0, taxRate: 18, amount: 0 }],
            subtotal: sub,
            taxAmount: tax,
            totalAmount: sub + tax
        });
        setIsCreateModalOpen(true);
    };

    const handleOpenEditModal = (quote: any) => {
        setEditingQuote(quote);
        setSelectedRfqId(quote.rfq?._id || quote.rfq || quote.rfqId || '');
        setNewQuote({
            quotationNumber: quote.quotationNumber || '',
            rfq: quote.rfq?._id || quote.rfq || quote.rfqId || '',
            rfqId: quote.rfq?._id || quote.rfq || quote.rfqId || '',
            rfqNumber: quote.rfqNumber || quote.rfq?.rfqNumber || '',
            customer: quote.customer?._id || quote.customer || '',
            customerName: quote.customerName || quote.customer?.name || '',
            customerAddress: quote.customerAddress || '',
            customerEmail: quote.customerEmail || '',
            customerPhone: quote.customerPhone || '',
            date: quote.date ? new Date(quote.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
            validUntil: quote.validUntil ? new Date(quote.validUntil).toISOString().slice(0, 10) : '',
            transportationType: quote.transportationType || 'Included',
            transportationCharges: quote.transportationCharges || 0,
            packagingType: quote.packagingType || 'Standard',
            packagingCharges: quote.packagingCharges || 0,
            otherDetails: quote.otherDetails || quote.remarks || '',
            status: quote.status || 'Draft',
            items: Array.isArray(quote.items) && quote.items.length > 0
                ? quote.items.map((it: any) => ({
                    fgItem: it.fgItem?._id || it.fgItem || '',
                    productName: it.productName || it.fgItem?.name || '',
                    description: it.description || '',
                    quantity: it.quantity || 1,
                    unit: it.unit || 'PCS',
                    rate: it.rate || it.unitPrice || 0,
                    taxRate: it.taxRate != null ? it.taxRate : 18,
                    taxAmount: it.taxAmount || 0,
                    amount: it.amount || (it.quantity * it.rate * 1.18)
                }))
                : [{ fgItem: '', productName: '', description: '', quantity: 1, unit: 'PCS', rate: 0, taxRate: 18, amount: 0 }],
            subtotal: quote.subtotal || 0,
            taxAmount: quote.taxAmount || 0,
            totalAmount: quote.totalAmount || quote.grandTotal || 0
        });
        setIsCreateModalOpen(true);
    };

    const handleSelectRfq = (rfqId: string) => {
        setSelectedRfqId(rfqId);
        const selectedRfq = (Array.isArray(rfqs) ? rfqs : []).find((r: any) => r._id === rfqId);
        if (!selectedRfq) return;

        handleOpenCreateModalWithRfq(selectedRfq, customers, fgItems);
    };

    const handleSelectCustomer = (custId: string) => {
        const selectedCust = (Array.isArray(customers) ? customers : []).find((c: any) => (c._id || c.id)?.toString() === custId?.toString());
        if (selectedCust) {
            setNewQuote(prev => ({
                ...prev,
                customer: custId,
                customerName: selectedCust.name || selectedCust.companyName || '',
                customerAddress: selectedCust.address || selectedCust.billingAddress || '',
                customerEmail: selectedCust.email || '',
                customerPhone: selectedCust.phone || ''
            }));
        } else {
            setNewQuote(prev => ({ ...prev, customer: custId }));
        }
    };

    const handleAddItem = () => {
        setNewQuote(prev => ({
            ...prev,
            items: [...prev.items, { fgItem: '', productName: '', description: '', quantity: 1, unit: 'PCS', rate: 0, taxRate: 18, amount: 0 }]
        }));
    };

    const handleRemoveItem = (index: number) => {
        const updated = newQuote.items.filter((_, i) => i !== index);
        recalculateTotals(updated);
    };

    const handleItemChange = (index: number, field: string, value: any) => {
        const updated = [...newQuote.items];
        if (field === 'fgItem') {
            const selectedFg = (Array.isArray(fgItems) ? fgItems : []).find((m: any) => (m._id || m.id)?.toString() === value?.toString());
            const autoName = selectedFg?.name || selectedFg?.itemName || '';
            const autoDesc = selectedFg?.description || selectedFg?.details || autoName;
            const autoUnit = selectedFg?.unit || selectedFg?.uom || 'PCS';

            // Auto-fetch unit rate and tax rate from FG Price List
            const priceEntry = (Array.isArray(priceLists) ? priceLists : []).find((p: any) => {
                const pFgId = typeof p.fgItem === 'string' ? p.fgItem : (p.fgItem?._id || p.fgItem?.id);
                return pFgId?.toString() === value?.toString();
            });

            const autoRate = priceEntry && priceEntry.price != null ? Number(priceEntry.price) : (Number(selectedFg?.sellingPrice || selectedFg?.unitPrice || selectedFg?.rate || 0));
            const autoTax = priceEntry && priceEntry.taxRate != null ? Number(priceEntry.taxRate) : (Number(selectedFg?.taxRate || selectedFg?.gstRate || 18));

            updated[index] = {
                ...updated[index],
                fgItem: value,
                productName: autoName,
                description: autoDesc,
                unit: autoUnit,
                rate: autoRate,
                taxRate: autoTax
            };
        } else {
            updated[index] = { ...updated[index], [field]: value };
        }

        recalculateTotals(updated);
    };

    const recalculateTotals = (itemsList: any[]) => {
        let sub = 0;
        let taxSum = 0;

        const updatedItems = itemsList.map(it => {
            const qty = Number(it.quantity) || 0;
            const rate = Number(it.rate) || 0;
            const taxPct = Number(it.taxRate) || 0;
            const lineSub = qty * rate;
            const lineTax = lineSub * (taxPct / 100);
            const lineTotal = lineSub + lineTax;

            sub += lineSub;
            taxSum += lineTax;

            return {
                ...it,
                amount: lineTotal,
                taxAmount: lineTax
            };
        });

        const grand = sub + taxSum + Number(newQuote.transportationCharges || 0) + Number(newQuote.packagingCharges || 0);

        setNewQuote(prev => ({
            ...prev,
            items: updatedItems,
            subtotal: sub,
            taxAmount: taxSum,
            totalAmount: grand
        }));
    };

    const handleStatusChange = async (quoteId: string, newStatus: string) => {
        try {
            const res = await apiPut(`/api/sales/quotation/${quoteId}`, { status: newStatus }, token);
            onSuccess(`Outward Quotation status updated to ${newStatus}`);
            const updated = res.quotation || res.data || res;
            if (selectedQuote && selectedQuote._id === quoteId) {
                setSelectedQuote(updated);
            }
            fetchData();
        } catch (err: any) {
            onError(err.message || "Failed to update quotation status");
        }
    };

    const handleDeleteQuote = async (quote: any) => {
        if (!quote || !quote._id) return;
        if (confirm(`Are you sure you want to delete Outward Quotation #${quote.quotationNumber}? This action cannot be undone.`)) {
            try {
                await apiDelete(`/api/sales/quotation/${quote._id}`, token);
                onSuccess(`Outward Quotation #${quote.quotationNumber} deleted successfully`);
                if (selectedQuote && selectedQuote._id === quote._id) {
                    setSelectedQuote(null);
                }
                fetchData();
            } catch (err: any) {
                onError(err.message || "Failed to delete quotation");
            }
        }
    };

    const handleCreateQuoteSubmit = async () => {
        if (!newQuote.customerName.trim()) {
            onError("Please select or enter customer name");
            return;
        }
        if (!newQuote.items || newQuote.items.length === 0 || !newQuote.items.some(i => i.fgItem && Number(i.quantity) > 0 && Number(i.rate) > 0)) {
            onError("Please select at least one FG Item with quantity and unit rate");
            return;
        }
        if (newQuote.items.some(i => !i.fgItem || Number(i.quantity) <= 0 || Number(i.rate) <= 0)) {
            onError("Please ensure all item rows have a selected FG Item, quantity > 0, and unit rate > 0");
            return;
        }

        setSubmitting(true);
        try {
            if (editingQuote && editingQuote._id) {
                await apiPut(`/api/sales/quotation/${editingQuote._id}`, newQuote, token);
                onSuccess(`Outward Quotation #${newQuote.quotationNumber} updated successfully`);
            } else {
                await apiPost('/api/sales/quotation', newQuote, token);
                onSuccess("Outward Quotation created successfully");
            }
            hasAutoOpenedRfq.current = true;
            setIsCreateModalOpen(false);
            setEditingQuote(null);
            if (typeof window !== 'undefined' && window.history.replaceState) {
                window.history.replaceState({}, '', window.location.pathname);
            }
            fetchData();
        } catch (err: any) {
            onError(err.message || "Failed to save Outward Quotation");
        } finally {
            setSubmitting(false);
        }
    };

    const filteredQuotations = useMemo(() => {
        return (Array.isArray(quotations) ? quotations : []).filter((q: any) => {
            const matchSearch =
                (q.quotationNumber && q.quotationNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (q.rfqNumber && q.rfqNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (q.customerName && q.customerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (q.items && q.items.some((i: any) => (i.productName || i.fgItem?.name || '').toLowerCase().includes(searchTerm.toLowerCase())));

            const matchStatus = filterStatus === 'All' || q.status === filterStatus;

            let matchCustomer = true;
            if (filterCustomer !== 'All') {
                const custId = q.customer?._id || q.customer;
                matchCustomer = custId?.toString() === filterCustomer?.toString();
            }

            return matchSearch && matchStatus && matchCustomer;
        });
    }, [quotations, searchTerm, filterStatus, filterCustomer]);

    return (
        <div className="space-y-4 animate-in fade-in duration-300">
            
            {/* Search, Filter & Action Toolbar */}
            <div className="bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col xl:flex-row justify-between items-stretch xl:items-center gap-3">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 min-w-0">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="Search Quote #, RFQ #, Customer or Item..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-slate-50/50 dark:bg-slate-800/50"
                        />
                    </div>

                    {/* Customer Filter Dropdown */}
                    <div className="flex items-center gap-2 shrink-0">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">Customer:</label>
                        <select
                            value={filterCustomer}
                            onChange={(e) => setFilterCustomer(e.target.value)}
                            className="w-full sm:w-auto px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 outline-none cursor-pointer focus:ring-2 focus:ring-indigo-500/20 max-w-[220px] truncate"
                        >
                            <option value="All">All Customers</option>
                            {(Array.isArray(customers) ? customers : []).map((c: any) => (
                                <option key={c._id || c.id} value={(c._id || c.id)?.toString()}>
                                    {c.name || c.companyName} {c.code ? `(${c.code})` : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Right Side: Status Filter Tabs + Create Quote Button */}
                <div className="flex flex-wrap sm:flex-nowrap items-center justify-between sm:justify-end gap-2 shrink-0">
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold overflow-x-auto no-scrollbar max-w-full shrink-0">
                        {['All', 'Draft', 'Pending Approval', 'Approved', 'Sent', 'Closed', 'Rejected'].map(status => (
                            <button
                                key={status}
                                onClick={() => setFilterStatus(status)}
                                className={`px-2.5 py-1.5 rounded-lg whitespace-nowrap transition-all cursor-pointer ${filterStatus === status ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-sm font-bold' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                            >
                                {status}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={handleOpenCreateModal}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                        <Plus size={15} /> Create Outward Quote
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center p-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
            ) : filteredQuotations.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                    <FileText className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No Outward Sales Quotations Found</h3>
                    <p className="text-xs text-slate-500 mt-1">Create an Outward Quotation to send formal pricing proposals to customers.</p>
                </div>
            ) : (
                /* Table & Cards View */
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                                <tr>
                                    <th className="px-4 py-3.5">Quotation #</th>
                                    <th className="px-4 py-3.5">Linked RFQ #</th>
                                    <th className="px-4 py-3.5">Customer Name</th>
                                    <th className="px-4 py-3.5 text-center">Quote Date</th>
                                    <th className="px-4 py-3.5 text-right">Grand Total</th>
                                    <th className="px-4 py-3.5 text-center">Status</th>
                                    <th className="px-4 py-3.5 text-center">Prepared By</th>
                                    <th className="px-4 py-3.5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                {filteredQuotations.map((quote) => {
                                    const total = Number(quote.totalAmount || quote.grandTotal || quote.subtotal || 0);

                                    return (
                                        <tr key={quote._id || quote.quotationNumber} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                                            <td className="px-4 py-3.5 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                                {quote.quotationNumber}
                                                <span className="block text-[10px] text-slate-400 font-sans font-normal">{new Date(quote.date || quote.createdAt || Date.now()).toLocaleDateString('en-GB')}</span>
                                            </td>

                                            <td className="px-4 py-3.5 font-mono font-bold text-slate-700 dark:text-slate-300 text-xs">
                                                {quote.rfqNumber || quote.rfq?.rfqNumber ? (
                                                    <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 rounded-md border border-indigo-200 dark:border-indigo-800">
                                                        {quote.rfqNumber || quote.rfq?.rfqNumber}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 font-normal">Direct</span>
                                                )}
                                            </td>

                                            <td className="px-4 py-3.5 font-bold text-slate-800 dark:text-slate-200 text-xs">
                                                <div className="flex items-center gap-1.5">
                                                    <Building2 size={13} className="text-indigo-500 shrink-0" />
                                                    <span className="truncate max-w-[180px]">{quote.customerName || quote.customer?.name || 'Customer'}</span>
                                                </div>
                                            </td>

                                            <td className="px-4 py-3.5 text-center font-bold text-slate-700 dark:text-slate-300 text-xs">
                                                {quote.date ? new Date(quote.date).toLocaleDateString('en-GB') : 'N/A'}
                                            </td>

                                            <td className="px-4 py-3.5 text-right font-mono font-extrabold text-indigo-600 dark:text-indigo-400 text-sm">
                                                ₹{total.toLocaleString()}
                                            </td>

                                            <td className="px-4 py-3.5 text-center">
                                                <select
                                                    value={quote.status || 'Draft'}
                                                    onChange={(e) => handleStatusChange(quote._id, e.target.value)}
                                                    className={`px-2.5 py-1 rounded-full text-xs font-bold border-none outline-none cursor-pointer ${
                                                        quote.status === 'Approved' ? 'bg-emerald-100 text-emerald-800' :
                                                        quote.status === 'Sent' ? 'bg-blue-100 text-blue-800' :
                                                        quote.status === 'Closed' ? 'bg-slate-100 text-slate-600' :
                                                        quote.status === 'Rejected' ? 'bg-rose-100 text-rose-800' :
                                                        'bg-amber-100 text-amber-800'
                                                    }`}
                                                >
                                                    <option value="Draft">Draft</option>
                                                    <option value="Pending Approval">Pending Approval</option>
                                                    <option value="Approved">Approved</option>
                                                    <option value="Sent">Sent</option>
                                                    <option value="Rejected">Rejected</option>
                                                    <option value="Closed">Closed</option>
                                                </select>
                                            </td>

                                            <td className="px-4 py-3.5 text-center text-xs font-medium text-slate-600 dark:text-slate-400">
                                                <div className="flex items-center justify-center gap-1 font-bold text-slate-700 dark:text-slate-300">
                                                    <User size={13} className="text-indigo-500" />
                                                    {getUserName(quote.preparedBy || quote.createdBy)}
                                                </div>
                                                {quote.createdAt && <div className="text-[10px] text-slate-400">{new Date(quote.createdAt).toLocaleDateString('en-GB')}</div>}
                                            </td>

                                            <td className="px-4 py-3.5 text-right space-x-1.5">
                                                <button
                                                    onClick={() => setSelectedQuote(quote)}
                                                    title="View Details"
                                                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-xs font-bold rounded-xl transition-colors inline-flex items-center gap-1"
                                                >
                                                    <Eye size={13} /> View
                                                </button>

                                                <button
                                                    onClick={() => handleOpenEditModal(quote)}
                                                    title="Edit Quotation"
                                                    className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 text-xs font-bold rounded-xl transition-colors inline-flex items-center gap-1"
                                                >
                                                    <Edit2 size={13} /> Edit
                                                </button>

                                                <button
                                                    onClick={() => handlePrintQuotePdf(quote)}
                                                    className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors inline-flex items-center gap-1 shadow-sm"
                                                >
                                                    <Printer size={13} /> PDF
                                                </button>

                                                <button
                                                    onClick={() => handleDeleteQuote(quote)}
                                                    title="Delete Quotation"
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
                        {filteredQuotations.map((quote) => {
                            const total = Number(quote.totalAmount || quote.grandTotal || quote.subtotal || 0);

                            return (
                                <div
                                    key={quote._id || quote.quotationNumber}
                                    className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col gap-3"
                                >
                                    <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-700 pb-2.5">
                                        <div>
                                            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-sm block">{quote.quotationNumber}</span>
                                            <span className="text-[10px] text-slate-400">{new Date(quote.date || quote.createdAt || Date.now()).toLocaleDateString('en-GB')}</span>
                                        </div>
                                        <select
                                            value={quote.status || 'Draft'}
                                            onChange={(e) => handleStatusChange(quote._id, e.target.value)}
                                            className={`px-2.5 py-1 rounded-full text-xs font-bold border-none outline-none cursor-pointer ${
                                                quote.status === 'Approved' ? 'bg-emerald-100 text-emerald-800' :
                                                quote.status === 'Sent' ? 'bg-blue-100 text-blue-800' :
                                                quote.status === 'Closed' ? 'bg-slate-100 text-slate-600' :
                                                quote.status === 'Rejected' ? 'bg-rose-100 text-rose-800' :
                                                'bg-amber-100 text-amber-800'
                                            }`}
                                        >
                                            <option value="Draft">Draft</option>
                                            <option value="Pending Approval">Pending Approval</option>
                                            <option value="Approved">Approved</option>
                                            <option value="Sent">Sent</option>
                                            <option value="Rejected">Rejected</option>
                                            <option value="Closed">Closed</option>
                                        </select>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">Customer</span>
                                            <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">{quote.customerName || quote.customer?.name || 'Customer'}</p>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">Linked RFQ</span>
                                            <p className="font-mono text-slate-700 dark:text-slate-300 font-semibold">{quote.rfqNumber || quote.rfq?.rfqNumber || "Direct Quote"}</p>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">Prepared By</span>
                                            <p className="text-slate-600 dark:text-slate-400">{getUserName(quote.preparedBy || quote.createdBy)}</p>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">Grand Total</span>
                                            <p className="font-extrabold text-sm text-indigo-600 dark:text-indigo-400">
                                                ₹{total.toLocaleString()}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-700">
                                        <button
                                            onClick={() => setSelectedQuote(quote)}
                                            className="flex-1 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center gap-1"
                                        >
                                            <Eye size={13} /> View
                                        </button>
                                        <button
                                            onClick={() => handlePrintQuotePdf(quote)}
                                            className="flex-1 py-1.5 text-xs font-bold text-white bg-indigo-600 rounded-lg flex items-center justify-center gap-1 shadow-sm"
                                        >
                                            <Printer size={13} /> PDF
                                        </button>
                                        <button
                                            onClick={() => handleOpenEditModal(quote)}
                                            className="py-1.5 px-2.5 text-xs font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg border border-indigo-200 dark:border-indigo-800"
                                        >
                                            <Edit2 size={13} />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteQuote(quote)}
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
            )}

            {/* Create / Edit Outward Quotation Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-[96vw] xl:max-w-7xl 2xl:max-w-[1550px] overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh]">
                        
                        <div className="p-5 sm:p-6 bg-slate-900 text-white flex justify-between items-center flex-shrink-0 border-b border-slate-800">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-indigo-600/20 rounded-xl flex items-center justify-center border border-indigo-500/30">
                                    {editingQuote ? <Edit2 size={20} className="text-indigo-400" /> : <FileText size={20} className="text-indigo-400" />}
                                </div>
                                <div>
                                    <h2 className="text-xl font-extrabold tracking-tight">
                                        {editingQuote ? 'Edit Outward Sales Quotation' : 'Create Outward Sales Quotation'}
                                    </h2>
                                    <p className="text-xs text-slate-400 mt-0.5">Quotation #: <span className="font-mono font-bold text-indigo-300">{newQuote.quotationNumber}</span></p>
                                </div>
                            </div>
                            <button onClick={() => { setIsCreateModalOpen(false); setEditingQuote(null); }} className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 transition-colors">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-5 sm:p-7 overflow-y-auto flex-1 space-y-6">
                            
                            {/* Step 1: Linked RFQ & Customer Logistics */}
                            <div className="bg-slate-50/80 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-4">
                                <h3 className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                                    1. Linked Inward RFQ & Customer Details
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                            Linked Inward RFQ <span className="text-slate-400 font-normal">(Optional - Direct Quotation if empty)</span>
                                        </label>
                                        <SearchableSelect
                                            options={[
                                                { value: '', label: '-- None (Direct Customer Quotation) --' },
                                                ...(Array.isArray(rfqs) ? rfqs : []).map(r => ({
                                                    value: r._id,
                                                    label: `${r.rfqNumber} - ${r.customerName || 'Customer'} (${r.items?.length || 0} Items)`
                                                }))
                                            ]}
                                            value={selectedRfqId}
                                            onChange={(val: any) => {
                                                if (!val) {
                                                    setSelectedRfqId('');
                                                    setNewQuote(prev => ({
                                                        ...prev,
                                                        rfq: '',
                                                        rfqId: '',
                                                        rfqNumber: ''
                                                    }));
                                                } else {
                                                    handleSelectRfq(val);
                                                }
                                            }}
                                            placeholder="Select Linked Inward RFQ (Optional)..."
                                        />
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                            Customer / Client *
                                        </label>
                                        <SearchableSelect
                                            options={(Array.isArray(customers) ? customers : []).map(c => ({
                                                value: (c._id || c.id)?.toString(),
                                                label: `${c.name || c.companyName} ${c.code ? `(${c.code})` : ''} ${c.city ? `- ${c.city}` : ''}`.trim()
                                            }))}
                                            value={newQuote.customer}
                                            onChange={(val: any) => handleSelectCustomer(val)}
                                            placeholder="Select Customer..."
                                        />
                                        {!newQuote.customer && (
                                            <input
                                                type="text"
                                                value={newQuote.customerName}
                                                onChange={(e) => setNewQuote({ ...newQuote, customerName: e.target.value })}
                                                placeholder="Or type customer name directly..."
                                                className="w-full mt-2 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                            />
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                            Quotation Date
                                        </label>
                                        <input
                                            type="date"
                                            value={newQuote.date}
                                            onChange={(e) => setNewQuote({ ...newQuote, date: e.target.value })}
                                            className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                            Quotation Valid Until
                                        </label>
                                        <input
                                            type="date"
                                            value={newQuote.validUntil}
                                            onChange={(e) => setNewQuote({ ...newQuote, validUntil: e.target.value })}
                                            className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                            Transportation / Freight Mode
                                        </label>
                                        <select
                                            value={newQuote.transportationType}
                                            onChange={(e) => setNewQuote({ ...newQuote, transportationType: e.target.value })}
                                            className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none"
                                        >
                                            <option value="Road Freight">Road Freight (By Truck)</option>
                                            <option value="Air Freight">Air Freight (Express)</option>
                                            <option value="Sea Freight">Sea Freight (Cargo)</option>
                                            <option value="Courier Service">Courier Service</option>
                                            <option value="Included">Freight Included in Price</option>
                                            <option value="Ex-Works">Ex-Works (Customer Pickup)</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                            Freight Charges (₹)
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={newQuote.transportationCharges}
                                            onChange={(e) => {
                                                const val = Number(e.target.value) || 0;
                                                setNewQuote(prev => ({ ...prev, transportationCharges: val }));
                                                recalculateTotals(newQuote.items);
                                            }}
                                            placeholder="0"
                                            className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                            Packaging Type
                                        </label>
                                        <select
                                            value={newQuote.packagingType}
                                            onChange={(e) => setNewQuote({ ...newQuote, packagingType: e.target.value })}
                                            className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none"
                                        >
                                            <option value="Standard">Standard Box Packing</option>
                                            <option value="Wooden Crate">Wooden Crate Packing</option>
                                            <option value="Palletized">Palletized Stretch Wrap</option>
                                            <option value="Bubble Wrap">Bubble Wrap & Heavy Box</option>
                                            <option value="Custom Export">Custom Export Packing</option>
                                            <option value="None">No Special Packing</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                            Packaging Charges (₹)
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={newQuote.packagingCharges}
                                            onChange={(e) => {
                                                const val = Number(e.target.value) || 0;
                                                setNewQuote(prev => ({ ...prev, packagingCharges: val }));
                                                recalculateTotals(newQuote.items);
                                            }}
                                            placeholder="0"
                                            className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Step 2: Quoted Product Items - All in 1 Line on Desktop */}
                            <div className="bg-slate-50/80 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                                        2. Quoted Product Items & Rates
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
                                    <div className="col-span-3">FG Item * (Price List)</div>
                                    <div className="col-span-3">Specifications</div>
                                    <div className="col-span-1 text-center">Qty</div>
                                    <div className="col-span-1 text-center">Unit</div>
                                    <div className="col-span-2 text-right">Unit Rate (₹)</div>
                                    <div className="col-span-1 text-center">GST %</div>
                                    <div className="col-span-1 text-right">Action</div>
                                </div>

                                {/* Items Rows */}
                                <div className="space-y-2.5">
                                    {newQuote.items.map((item, idx) => (
                                        <div key={idx} className="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                            <div className="grid grid-cols-12 gap-3 items-center">
                                                
                                                {/* FG Item Column */}
                                                <div className="col-span-12 lg:col-span-3">
                                                    <label className="block lg:hidden text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                                                        FG Item *
                                                    </label>
                                                    <SearchableSelect
                                                        options={fgOptions}
                                                        value={item.fgItem}
                                                        onChange={(val: any) => handleItemChange(idx, 'fgItem', val)}
                                                        placeholder="Select FG Item..."
                                                    />
                                                </div>

                                                {/* Specifications */}
                                                <div className="col-span-12 lg:col-span-3">
                                                    <label className="block lg:hidden text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                                                        Specifications
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={item.description || ''}
                                                        onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                                                        placeholder="Specs, grade, dimensions..."
                                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-indigo-500"
                                                    />
                                                </div>

                                                {/* Qty */}
                                                <div className="col-span-6 lg:col-span-1">
                                                    <label className="block lg:hidden text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                                                        Qty
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={item.quantity}
                                                        onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                                                        className="w-full px-2 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white text-center"
                                                    />
                                                </div>

                                                {/* Unit */}
                                                <div className="col-span-6 lg:col-span-1">
                                                    <label className="block lg:hidden text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                                                        Unit
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={item.unit || 'PCS'}
                                                        onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                                                        className="w-full px-2 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 text-center"
                                                    />
                                                </div>

                                                {/* Rate */}
                                                <div className="col-span-6 lg:col-span-2">
                                                    <label className="block lg:hidden text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                                                        Unit Rate (₹)
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={item.rate}
                                                        onChange={(e) => handleItemChange(idx, 'rate', e.target.value)}
                                                        placeholder="Rate ₹"
                                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-extrabold text-indigo-600 dark:text-indigo-400 text-right"
                                                    />
                                                </div>

                                                {/* GST % */}
                                                <div className="col-span-5 lg:col-span-1">
                                                    <label className="block lg:hidden text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                                                        GST %
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max="28"
                                                        value={item.taxRate}
                                                        onChange={(e) => handleItemChange(idx, 'taxRate', e.target.value)}
                                                        className="w-full px-2 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 text-center"
                                                    />
                                                </div>

                                                {/* Action Column */}
                                                <div className="col-span-1 text-right">
                                                    {newQuote.items.length > 1 && (
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

                            {/* Summary Card */}
                            <div className="bg-indigo-50/70 dark:bg-indigo-950/40 p-5 rounded-2xl border border-indigo-200 dark:border-indigo-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <div className="text-xs space-y-1">
                                    <div className="font-bold text-slate-700 dark:text-slate-300">
                                        Subtotal: <span className="font-mono text-slate-900 dark:text-white">₹{newQuote.subtotal.toLocaleString()}</span>
                                    </div>
                                    <div className="font-bold text-slate-700 dark:text-slate-300">
                                        Total Tax (GST): <span className="font-mono text-slate-900 dark:text-white">₹{newQuote.taxAmount.toLocaleString()}</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">Grand Total Amount</span>
                                    <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
                                        ₹{newQuote.totalAmount.toLocaleString()}
                                    </span>
                                </div>
                            </div>

                        </div>

                        <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 flex-shrink-0">
                            <button onClick={() => { setIsCreateModalOpen(false); setEditingQuote(null); }} className="px-5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 font-semibold text-sm hover:bg-slate-100 transition-colors">
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateQuoteSubmit}
                                disabled={submitting}
                                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-indigo-600/20 flex items-center gap-2"
                            >
                                <FileText size={16} />
                                {submitting ? 'Saving...' : (editingQuote ? 'Update Outward Quote' : 'Save Outward Quote')}
                            </button>
                        </div>

                    </div>
                </div>
            )}

            {/* View Quotation & User Audit Details Modal */}
            {selectedQuote && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-[96vw] xl:max-w-7xl 2xl:max-w-[1550px] overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh]">
                        
                        <div className="p-5 sm:p-6 bg-slate-900 text-white flex justify-between items-center flex-shrink-0 border-b border-slate-800">
                            <div>
                                <h2 className="text-xl font-extrabold font-mono text-indigo-300">{selectedQuote.quotationNumber}</h2>
                                <p className="text-xs text-slate-400 mt-0.5">Outward Sales Quotation & User Audit Details</p>
                            </div>
                            <button onClick={() => setSelectedQuote(null)} className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 transition-colors">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-5">
                            
                            {/* General Status & Interactive Control */}
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                                <div>
                                    <span className="text-slate-400 block mb-0.5">Linked RFQ Number:</span>
                                    <strong className="text-indigo-600 dark:text-indigo-400 font-mono font-bold">
                                        {selectedQuote.rfqNumber || selectedQuote.rfq?.rfqNumber || 'Direct'}
                                    </strong>
                                </div>

                                <div>
                                    <span className="text-slate-400 block mb-0.5">Quotation Date:</span>
                                    <strong className="text-slate-800 dark:text-slate-200 font-bold">
                                        {selectedQuote.date ? new Date(selectedQuote.date).toLocaleDateString('en-GB') : 'N/A'}
                                    </strong>
                                </div>

                                <div>
                                    <span className="text-slate-400 block mb-0.5">Valid Until:</span>
                                    <strong className="text-rose-600 font-bold">
                                        {selectedQuote.validUntil ? new Date(selectedQuote.validUntil).toLocaleDateString('en-GB') : 'N/A'}
                                    </strong>
                                </div>

                                <div>
                                    <span className="text-slate-400 block mb-0.5">Current Status:</span>
                                    <select
                                        value={selectedQuote.status || 'Draft'}
                                        onChange={(e) => handleStatusChange(selectedQuote._id, e.target.value)}
                                        className="px-3 py-1 rounded-xl text-xs font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700 outline-none cursor-pointer"
                                    >
                                        <option value="Draft">Draft</option>
                                        <option value="Pending Approval">Pending Approval</option>
                                        <option value="Approved">Approved</option>
                                        <option value="Sent">Sent</option>
                                        <option value="Rejected">Rejected</option>
                                        <option value="Closed">Closed</option>
                                    </select>
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
                                            <span className="text-[10px] text-slate-400 block">Prepared / Created By User</span>
                                            <strong className="text-slate-800 dark:text-slate-200 font-bold truncate block">{getUserName(selectedQuote.preparedBy || selectedQuote.createdBy)}</strong>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-indigo-100 dark:border-indigo-900">
                                        <UserCheck size={16} className="text-emerald-600 shrink-0" />
                                        <div className="truncate">
                                            <span className="text-[10px] text-slate-400 block">Last Updated By User</span>
                                            <strong className="text-slate-800 dark:text-slate-200 font-bold truncate block">{getUserName(selectedQuote.updatedBy || selectedQuote.preparedBy || selectedQuote.createdBy)}</strong>
                                        </div>
                                    </div>
                                </div>

                                {/* Status Audit History Log */}
                                {Array.isArray(selectedQuote.statusHistory) && selectedQuote.statusHistory.length > 0 && (
                                    <div className="pt-2 border-t border-indigo-100 dark:border-indigo-900 space-y-2">
                                        <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                                            <History size={13} /> Status Audit History Log
                                        </span>
                                        <div className="space-y-1.5 max-h-32 overflow-y-auto custom-scrollbar">
                                            {selectedQuote.statusHistory.map((h: any, idx: number) => (
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
                                    {selectedQuote.customerName || selectedQuote.customer?.name || 'Customer'}
                                </div>
                                <div className="text-slate-500 font-medium space-x-3">
                                    {selectedQuote.customerEmail && <span>Email: {selectedQuote.customerEmail}</span>}
                                    {selectedQuote.customerPhone && <span>Phone: {selectedQuote.customerPhone}</span>}
                                </div>
                            </div>

                            {/* Requested Items Section */}
                            <div>
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Quoted Items & Pricing Breakdown</h4>
                                <div className="border rounded-xl overflow-hidden">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-slate-100 dark:bg-slate-800 font-bold text-slate-600">
                                            <tr>
                                                <th className="p-3">FG Item Name</th>
                                                <th className="p-3 text-center">Quantity</th>
                                                <th className="p-3 text-right">Unit Rate (₹)</th>
                                                <th className="p-3 text-center">GST %</th>
                                                <th className="p-3 text-right">Line Total (₹)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {(selectedQuote.items || []).map((item: any, idx: number) => {
                                                const qty = Number(item.quantity) || 1;
                                                const rate = Number(item.rate || item.unitPrice) || 0;
                                                const tax = Number(item.taxRate != null ? item.taxRate : 18);
                                                const lineTotal = item.amount ? Number(item.amount) : (qty * rate * (1 + tax / 100));

                                                return (
                                                    <tr key={idx}>
                                                        <td className="p-3 font-bold">
                                                            {item.fgItem?.name || item.productName || 'FG Item'}
                                                            {item.fgItem?.code && <span className="text-[10px] text-slate-400 font-mono ml-1">[{item.fgItem.code}]</span>}
                                                            {item.description && <span className="block text-[10px] font-normal text-slate-400">{item.description}</span>}
                                                        </td>
                                                        <td className="p-3 text-center font-bold text-indigo-600">{qty} {item.unit || 'PCS'}</td>
                                                        <td className="p-3 text-right font-bold font-mono">₹{rate.toLocaleString()}</td>
                                                        <td className="p-3 text-center font-bold text-slate-600">{tax}%</td>
                                                        <td className="p-3 text-right font-extrabold font-mono text-indigo-600">₹{lineTotal.toLocaleString()}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-slate-50 dark:bg-slate-800 flex justify-between items-center border-t border-slate-200 dark:border-slate-700">
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handlePrintQuotePdf(selectedQuote)}
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-colors flex items-center gap-1 shadow-sm"
                                >
                                    <Printer size={14} /> Print PDF
                                </button>
                                <button
                                    onClick={() => {
                                        const quoteToEdit = selectedQuote;
                                        setSelectedQuote(null);
                                        handleOpenEditModal(quoteToEdit);
                                    }}
                                    className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-bold text-xs rounded-xl transition-colors flex items-center gap-1"
                                >
                                    <Edit2 size={14} /> Edit Quotation
                                </button>
                                <button
                                    onClick={() => handleDeleteQuote(selectedQuote)}
                                    className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400 font-bold text-xs rounded-xl transition-colors flex items-center gap-1"
                                >
                                    <Trash2 size={14} /> Delete
                                </button>
                            </div>
                            <button onClick={() => setSelectedQuote(null)} className="px-5 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl">
                                Close
                            </button>
                        </div>

                    </div>
                </div>
            )}

        </div>
    );
}

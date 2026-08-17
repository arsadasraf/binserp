import React, { useState, useEffect, useMemo } from 'react';
import { FileCheck, Plus, Search, Calendar, User, Eye, CheckCircle2, Clock, Filter, ArrowRight, X, Building2, Printer, LayoutGrid, List, Edit2, Trash2, UserCheck, History, ShieldCheck, Download, ShoppingBag, ShoppingCart, Truck, IndianRupee, FileText, CheckCircle, PackageCheck, Lock } from 'lucide-react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/src/lib/api';
import SearchableSelect from '../SearchableSelect';

interface CustomerPoTabProps {
    token: string | null;
    onError: (msg: string) => void;
    onSuccess: (msg: string) => void;
}

export default function CustomerPoTab({ token, onError, onSuccess }: CustomerPoTabProps) {
    const [loading, setLoading] = useState(true);
    const [poList, setPoList] = useState<any[]>([]);
    const [quotations, setQuotations] = useState<any[]>([]);
    const [fgItems, setFgItems] = useState<any[]>([]);
    const [customers, setCustomers] = useState<any[]>([]);
    const [companyInfo, setCompanyInfo] = useState<any>(null);

    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('All');
    const [filterCustomer, setFilterCustomer] = useState<string>('All');

    // Create / Edit Modal State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingPo, setEditingPo] = useState<any | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [selectedQuoteId, setSelectedQuoteId] = useState<string>('');

    const [newPo, setNewPo] = useState({
        poNumber: '',
        quotationReference: '',
        customer: '',
        customerName: '',
        date: new Date().toISOString().slice(0, 10),
        transportationMethod: 'Road Freight',
        transportationCharges: 0,
        remarks: '',
        status: 'Received',
        items: [] as any[],
        subtotal: 0,
        taxAmount: 0,
        totalAmount: 0
    });

    // View Modal State (With Dispatch History & DC/Invoice Timeline)
    const [selectedPo, setSelectedPo] = useState<any | null>(null);
    const [timelineData, setTimelineData] = useState<{ deliveryChallans: any[]; invoices: any[] }>({ deliveryChallans: [], invoices: [] });
    const [timelineLoading, setTimelineLoading] = useState(false);
    const [generatingOrder, setGeneratingOrder] = useState(false);
    const [activeViewTab, setActiveViewTab] = useState<'overview' | 'dispatch'>('overview');

    const fetchData = async () => {
        if (!token) return;
        try {
            setLoading(true);
            const [poRes, quotRes, fgRes, custRes, compRes] = await Promise.all([
                apiGet('/api/sales/incoming-po', token).catch(() => ({ pos: [] })),
                apiGet('/api/sales/quotation', token).catch(() => ({ quotations: [] })),
                apiGet('/api/store/fg-item', token).catch(() => []),
                apiGet('/api/store/customer', token).catch(() => []),
                apiGet('/api/store/company-info', token).catch(() => null)
            ]);

            const listPOs = Array.isArray(poRes?.pos) ? poRes.pos : (Array.isArray(poRes?.data) ? poRes.data : (Array.isArray(poRes) ? poRes : []));
            const listQuotes = Array.isArray(quotRes?.quotations) ? quotRes.quotations : (Array.isArray(quotRes?.data) ? quotRes.data : (Array.isArray(quotRes) ? quotRes : []));
            const listFgs = Array.isArray(fgRes?.fgItems) ? fgRes.fgItems : (Array.isArray(fgRes) ? fgRes : []);
            const listCusts = Array.isArray(custRes?.customers) ? custRes.customers : (Array.isArray(custRes) ? custRes : []);

            setPoList(listPOs);
            setQuotations(listQuotes);
            setFgItems(listFgs);
            setCustomers(listCusts);
            setCompanyInfo(compRes?.companyInfo || compRes);
        } catch (err: any) {
            console.error("Fetch Customer POs error:", err);
            onError(err.message || "Failed to fetch Customer POs");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [token]);

    const fetchPoTimeline = async (poId: string) => {
        if (!token || !poId) return;
        try {
            setTimelineLoading(true);
            const res = await apiGet(`/api/sales/incoming-po/${poId}/dispatch-history`, token);
            const dcs = res.data?.deliveryChallans || res.deliveryChallans || [];
            const invs = res.data?.invoices || res.invoices || [];
            setTimelineData({
                deliveryChallans: dcs,
                invoices: invs
            });

            if (selectedPo && Array.isArray(selectedPo.items)) {
                const totalOrd = selectedPo.items.reduce((acc: number, cur: any) => acc + Number(cur.quantity || 0), 0);
                const totalDisp = dcs.reduce((acc: number, dc: any) => acc + (dc.items || []).reduce((iAcc: number, it: any) => iAcc + Number(it.quantity || 0), 0), 0);
                const totalInv = invs.reduce((acc: number, inv: any) => acc + (inv.items || []).reduce((iAcc: number, it: any) => iAcc + Number(it.quantity || 0), 0), 0);
                const effectiveFulfilled = Math.max(totalDisp, totalInv);

                if (totalOrd > 0 && effectiveFulfilled > 0) {
                    if (effectiveFulfilled >= totalOrd && selectedPo.status !== 'Completed') {
                        handleStatusChange(selectedPo._id, 'Completed');
                    } else if (effectiveFulfilled < totalOrd && selectedPo.status !== 'Partially Dispatched' && selectedPo.status !== 'Completed') {
                        handleStatusChange(selectedPo._id, 'Partially Dispatched');
                    }
                }
            }
        } catch (err: any) {
            console.error("Fetch PO Timeline error:", err);
        } finally {
            setTimelineLoading(false);
        }
    };

    useEffect(() => {
        if (selectedPo && selectedPo._id) {
            fetchPoTimeline(selectedPo._id);
        } else {
            setTimelineData({ deliveryChallans: [], invoices: [] });
        }
    }, [selectedPo]);

    const generatePoNo = () => {
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        return `CPO-${dateStr}-${randomNum}`;
    };

    const getUserName = (userObj: any) => {
        if (!userObj) return 'System User';
        if (typeof userObj === 'string') return userObj;
        return userObj.name || userObj.email || 'User';
    };

    const handleOpenCreateModal = () => {
        setEditingPo(null);
        setSelectedQuoteId('');
        setNewPo({
            poNumber: generatePoNo(),
            quotationReference: '',
            customer: '',
            customerName: '',
            date: new Date().toISOString().slice(0, 10),
            transportationMethod: 'Road Freight',
            transportationCharges: 0,
            remarks: '',
            status: 'Received',
            items: [{ fgItem: '', productName: '', description: '', quantity: 1, unit: 'PCS', rate: 0, taxRate: 18, expectedDeliveryDate: '', amount: 0 }],
            subtotal: 0,
            taxAmount: 0,
            totalAmount: 0
        });
        setIsCreateModalOpen(true);
    };

    const handleOpenEditModal = (po: any) => {
        const createdDate = po.createdAt ? new Date(po.createdAt) : (po.date ? new Date(po.date) : null);
        const hoursDiff = createdDate ? (Date.now() - createdDate.getTime()) / (1000 * 60 * 60) : 0;
        if (hoursDiff > 24) {
            onError("Customer PO can only be edited or deleted within 24 hours of creation");
            return;
        }
        setEditingPo(po);
        setSelectedQuoteId(po.quotationReference?._id || po.quotationReference || '');
        setNewPo({
            poNumber: po.poNumber || '',
            quotationReference: po.quotationReference?._id || po.quotationReference || '',
            customer: po.customer?._id || po.customer || '',
            customerName: po.customerName || po.customer?.name || '',
            date: po.date ? new Date(po.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
            transportationMethod: po.transportationMethod || 'Road Freight',
            transportationCharges: po.transportationCharges || 0,
            remarks: po.remarks || '',
            status: po.status || 'Received',
            items: Array.isArray(po.items) && po.items.length > 0
                ? po.items.map((it: any) => ({
                    fgItem: it.fgItem?._id || it.fgItem || '',
                    productName: it.productName || it.fgItem?.name || '',
                    description: it.description || '',
                    quantity: it.quantity || 1,
                    unit: it.unit || 'PCS',
                    rate: it.rate || 0,
                    taxRate: it.taxRate != null ? it.taxRate : 18,
                    expectedDeliveryDate: it.expectedDeliveryDate ? new Date(it.expectedDeliveryDate).toISOString().slice(0, 10) : '',
                    amount: it.amount || (it.quantity * it.rate * 1.18)
                }))
                : [{ fgItem: '', productName: '', description: '', quantity: 1, unit: 'PCS', rate: 0, taxRate: 18, expectedDeliveryDate: '', amount: 0 }],
            subtotal: po.subtotal || 0,
            taxAmount: po.taxAmount || 0,
            totalAmount: po.totalAmount || 0
        });
        setIsCreateModalOpen(true);
    };

    const handleSelectQuotation = (quotId: string) => {
        setSelectedQuoteId(quotId);
        const selectedQuot = (Array.isArray(quotations) ? quotations : []).find((q: any) => q._id === quotId);
        if (!selectedQuot) return;

        const custId = selectedQuot.customer?._id || selectedQuot.customer;
        const matchedCust = (customers || []).find((c: any) => (c._id || c.id)?.toString() === custId?.toString());

        const autoItems = (selectedQuot.items || []).map((it: any) => {
            const qty = Number(it.quantity) || 1;
            const rate = Number(it.rate || it.unitPrice) || 0;
            const tax = Number(it.taxRate != null ? it.taxRate : 18);
            const lineSub = qty * rate;
            const lineTax = lineSub * (tax / 100);

            return {
                fgItem: it.fgItem?._id || it.fgItem || '',
                productName: it.productName || it.fgItem?.name || 'Product Item',
                description: it.description || '',
                quantity: qty,
                unit: it.unit || 'PCS',
                rate: rate,
                taxRate: tax,
                expectedDeliveryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
                amount: lineSub + lineTax
            };
        });

        const sub = autoItems.reduce((acc: number, cur: any) => acc + (cur.quantity * cur.rate), 0);
        const taxSum = autoItems.reduce((acc: number, cur: any) => acc + (cur.quantity * cur.rate * (cur.taxRate / 100)), 0);

        setNewPo(prev => ({
            ...prev,
            quotationReference: quotId,
            customer: custId || '',
            customerName: selectedQuot.customerName || matchedCust?.name || '',
            items: autoItems.length > 0 ? autoItems : prev.items,
            subtotal: sub,
            taxAmount: taxSum,
            totalAmount: sub + taxSum
        }));
    };

    const handleSelectCustomer = (custId: string) => {
        const selectedCust = (Array.isArray(customers) ? customers : []).find((c: any) => (c._id || c.id)?.toString() === custId?.toString());
        if (selectedCust) {
            setNewPo(prev => ({
                ...prev,
                customer: custId,
                customerName: selectedCust.name || selectedCust.companyName || ''
            }));
        } else {
            setNewPo(prev => ({ ...prev, customer: custId }));
        }
    };

    const handleAddItem = () => {
        setNewPo(prev => ({
            ...prev,
            items: [...prev.items, { fgItem: '', productName: '', description: '', quantity: 1, unit: 'PCS', rate: 0, taxRate: 18, expectedDeliveryDate: '', amount: 0 }]
        }));
    };

    const handleRemoveItem = (index: number) => {
        const updated = newPo.items.filter((_, i) => i !== index);
        recalculateTotals(updated);
    };

    const handleItemChange = (index: number, field: string, value: any) => {
        const updated = [...newPo.items];
        if (field === 'fgItem') {
            const selectedFg = (Array.isArray(fgItems) ? fgItems : []).find((m: any) => (m._id || m.id)?.toString() === value?.toString());
            const autoName = selectedFg?.name || selectedFg?.itemName || '';
            const autoDesc = selectedFg?.description || selectedFg?.details || autoName;
            const autoUnit = selectedFg?.unit || selectedFg?.uom || 'PCS';
            const autoRate = Number(selectedFg?.sellingPrice || selectedFg?.unitPrice || selectedFg?.rate || 0);

            updated[index] = {
                ...updated[index],
                fgItem: value,
                productName: autoName,
                description: autoDesc,
                unit: autoUnit,
                rate: autoRate
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

        const grand = sub + taxSum + Number(newPo.transportationCharges || 0);

        setNewPo(prev => ({
            ...prev,
            items: updatedItems,
            subtotal: sub,
            taxAmount: taxSum,
            totalAmount: grand
        }));
    };

    const handleStatusChange = async (poId: string, newStatus: string) => {
        try {
            const res = await apiPut(`/api/sales/incoming-po/${poId}`, { status: newStatus }, token);
            onSuccess(`Customer PO status updated to ${newStatus}`);
            const updated = res.incomingPO || res.data || res;
            if (selectedPo && selectedPo._id === poId) {
                setSelectedPo(updated);
            }
            fetchData();
        } catch (err: any) {
            onError(err.message || "Failed to update PO status");
        }
    };

    const handleGenerateSalesOrder = async (poId: string) => {
        setGeneratingOrder(true);
        try {
            await apiPost(`/api/sales/incoming-po/${poId}/generate-order`, {}, token);
            onSuccess("Sales Order generated successfully from Customer PO");
            fetchData();
        } catch (err: any) {
            onError(err.message || "Failed to generate Sales Order");
        } finally {
            setGeneratingOrder(false);
        }
    };

    const handleDeletePo = async (po: any) => {
        if (!po || !po._id) return;
        const createdDate = po.createdAt ? new Date(po.createdAt) : (po.date ? new Date(po.date) : null);
        const hoursDiff = createdDate ? (Date.now() - createdDate.getTime()) / (1000 * 60 * 60) : 0;
        if (hoursDiff > 24) {
            onError("Customer PO can only be edited or deleted within 24 hours of creation");
            return;
        }
        if (confirm(`Are you sure you want to delete Customer PO #${po.poNumber}? This action cannot be undone.`)) {
            try {
                await apiDelete(`/api/sales/incoming-po/${po._id}`, token);
                onSuccess(`Customer PO #${po.poNumber} deleted successfully`);
                if (selectedPo && selectedPo._id === po._id) {
                    setSelectedPo(null);
                }
                fetchData();
            } catch (err: any) {
                onError(err.message || "Failed to delete PO");
            }
        }
    };

    const handleCreatePoSubmit = async () => {
        if (!newPo.poNumber.trim()) {
            onError("Please enter Customer PO number");
            return;
        }
        if (!newPo.customerName.trim() && !newPo.customer) {
            onError("Please select customer for this PO");
            return;
        }
        if (!newPo.items.some(i => (i.fgItem || i.productName) && Number(i.quantity) > 0)) {
            onError("Please add at least one item to the PO");
            return;
        }

        setSubmitting(true);
        try {
            if (editingPo && editingPo._id) {
                await apiPut(`/api/sales/incoming-po/${editingPo._id}`, newPo, token);
                onSuccess(`Customer PO #${newPo.poNumber} updated successfully`);
            } else {
                await apiPost('/api/sales/incoming-po', newPo, token);
                onSuccess("Customer PO created successfully");
            }
            setIsCreateModalOpen(false);
            setEditingPo(null);
            fetchData();
        } catch (err: any) {
            onError(err.message || "Failed to save Customer PO");
        } finally {
            setSubmitting(false);
        }
    };

    const filteredPoList = useMemo(() => {
        return (Array.isArray(poList) ? poList : []).filter((p: any) => {
            const matchSearch =
                (p.poNumber && p.poNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (p.customerName && p.customerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (p.customer?.name && p.customer.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (p.items && p.items.some((i: any) => (i.productName || i.fgItem?.name || '').toLowerCase().includes(searchTerm.toLowerCase())));

            const matchStatus = filterStatus === 'All' || p.status === filterStatus;

            let matchCustomer = true;
            if (filterCustomer !== 'All') {
                const custId = p.customer?._id || p.customer;
                matchCustomer = custId?.toString() === filterCustomer?.toString();
            }

            return matchSearch && matchStatus && matchCustomer;
        });
    }, [poList, searchTerm, filterStatus, filterCustomer]);

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Header Banner */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                        <FileCheck size={22} className="text-blue-600 dark:text-blue-400" /> Customer PO & Fulfillment Tracking
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Log customer Purchase Orders (Inward PO), track user audit trails, and monitor linked Delivery Challans (DC) & Invoice timelines.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleOpenCreateModal}
                        className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/20 hover:shadow-lg transition-all flex items-center gap-2"
                    >
                        <Plus size={16} /> Log Customer PO
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="relative w-full sm:w-80">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                        type="text"
                        placeholder="Search PO #, Customer or Item..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-slate-50/50 dark:bg-slate-800/50"
                    />
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Customer Filter Dropdown */}
                    <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">Customer:</label>
                        <select
                            value={filterCustomer}
                            onChange={(e) => setFilterCustomer(e.target.value)}
                            className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 outline-none cursor-pointer focus:ring-2 focus:ring-blue-500/20 max-w-[200px] truncate"
                        >
                            <option value="All">All Customers</option>
                            {(Array.isArray(customers) ? customers : []).map((c: any) => (
                                <option key={c._id || c.id} value={(c._id || c.id)?.toString()}>
                                    {c.name || c.companyName} {c.code ? `(${c.code})` : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Status Filter Tabs */}
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold">
                        {['All', 'Received', 'Accepted', 'Processing', 'Sales Order Generated', 'Partially Dispatched', 'Completed', 'Cancelled'].map(status => (
                            <button
                                key={status}
                                onClick={() => setFilterStatus(status)}
                                className={`px-3 py-1.5 rounded-lg transition-all ${filterStatus === status ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-sm' : 'text-slate-500'}`}
                            >
                                {status}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center p-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
            ) : filteredPoList.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                    <FileCheck className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No Customer Purchase Orders Found</h3>
                    <p className="text-xs text-slate-500 mt-1">Log incoming customer POs to initiate fulfillment, DCs, and invoicing.</p>
                </div>
            ) : (
                /* Table View */
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                                <tr>
                                    <th className="px-4 py-3.5">Customer PO #</th>
                                    <th className="px-4 py-3.5">Customer Name</th>
                                    <th className="px-4 py-3.5 text-center">PO Date</th>
                                    <th className="px-4 py-3.5 text-right">Total Amount</th>
                                    <th className="px-4 py-3.5 text-center">Fulfillment Status</th>
                                    <th className="px-4 py-3.5 text-center">Created By</th>
                                    <th className="px-4 py-3.5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                {filteredPoList.map((po) => {
                                    const total = Number(po.totalAmount || po.subtotal || 0);

                                    return (
                                        <tr key={po._id || po.poNumber} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                                            <td className="px-4 py-3.5 font-mono font-bold text-blue-600 dark:text-blue-400">
                                                {po.poNumber}
                                                {po.quotationReference?.quotationNumber && (
                                                    <span className="block text-[10px] text-slate-400 font-sans font-normal">
                                                        Ref Quote: {po.quotationReference.quotationNumber}
                                                    </span>
                                                )}
                                            </td>

                                            <td className="px-4 py-3.5 font-bold text-slate-800 dark:text-slate-200 text-xs">
                                                <div className="flex items-center gap-1.5">
                                                    <Building2 size={13} className="text-blue-500 shrink-0" />
                                                    <span className="truncate max-w-[180px]">{po.customerName || po.customer?.name || 'Customer'}</span>
                                                </div>
                                            </td>

                                            <td className="px-4 py-3.5 text-center font-bold text-slate-700 dark:text-slate-300 text-xs">
                                                {po.date ? new Date(po.date).toLocaleDateString('en-GB') : 'N/A'}
                                            </td>

                                            <td className="px-4 py-3.5 text-right font-mono font-extrabold text-blue-600 dark:text-blue-400 text-sm">
                                                ₹{total.toLocaleString()}
                                            </td>

                                            <td className="px-4 py-3.5 text-center">
                                                <select
                                                    value={po.status || 'Received'}
                                                    onChange={(e) => handleStatusChange(po._id, e.target.value)}
                                                    className={`px-2.5 py-1 rounded-full text-xs font-bold border-none outline-none cursor-pointer ${
                                                        po.status === 'Completed' || po.status === 'Accepted' ? 'bg-emerald-100 text-emerald-800' :
                                                        po.status === 'Sales Order Generated' ? 'bg-blue-100 text-blue-800' :
                                                        po.status === 'Partially Dispatched' || po.status === 'Processing' ? 'bg-indigo-100 text-indigo-800' :
                                                        po.status === 'Cancelled' ? 'bg-rose-100 text-rose-800' :
                                                        'bg-amber-100 text-amber-800'
                                                    }`}
                                                >
                                                    <option value="Received">Received</option>
                                                    <option value="Accepted">Accepted</option>
                                                    <option value="Processing">Processing</option>
                                                    <option value="Sales Order Generated">Sales Order Generated</option>
                                                    <option value="Partially Dispatched">Partially Dispatched</option>
                                                    <option value="Completed">Completed</option>
                                                    <option value="Cancelled">Cancelled</option>
                                                </select>
                                            </td>

                                            <td className="px-4 py-3.5 text-center text-xs font-medium text-slate-600 dark:text-slate-400">
                                                <div className="flex items-center justify-center gap-1 font-bold text-slate-700 dark:text-slate-300">
                                                    <User size={13} className="text-blue-500" />
                                                    {getUserName(po.createdBy || po.receivedBy)}
                                                </div>
                                                {po.createdAt && <div className="text-[10px] text-slate-400">{new Date(po.createdAt).toLocaleDateString('en-GB')}</div>}
                                            </td>

                                            <td className="px-4 py-3.5 text-right space-x-1.5">
                                                <button
                                                    onClick={() => setSelectedPo(po)}
                                                    title="View Details & DC/Invoice Timeline"
                                                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-xs font-bold rounded-xl transition-colors inline-flex items-center gap-1"
                                                >
                                                    <Eye size={13} /> View
                                                </button>

                                                {(() => {
                                                    const createdDate = po.createdAt ? new Date(po.createdAt) : (po.date ? new Date(po.date) : null);
                                                    const hoursDiff = createdDate ? (Date.now() - createdDate.getTime()) / (1000 * 60 * 60) : 0;
                                                    const isWithin24h = hoursDiff <= 24;
                                                    const isSoGenerated = po.status === 'Sales Order Generated' || po.status === 'Partially Dispatched' || po.status === 'Completed';

                                                    return (
                                                        <>
                                                            {isWithin24h ? (
                                                                <button
                                                                    onClick={() => handleOpenEditModal(po)}
                                                                    title="Edit PO (Allowed within 24h of creation)"
                                                                    className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 text-xs font-bold rounded-xl transition-colors inline-flex items-center gap-1"
                                                                >
                                                                    <Edit2 size={13} /> Edit
                                                                </button>
                                                            ) : (
                                                                <span title="Editing allowed only within 24 hours of creation" className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-400 text-[11px] font-medium rounded-xl inline-flex items-center gap-1 opacity-60">
                                                                    <Lock size={12} /> Locked
                                                                </span>
                                                            )}

                                                            {!isSoGenerated ? (
                                                                <button
                                                                    onClick={() => handleGenerateSalesOrder(po._id)}
                                                                    disabled={generatingOrder}
                                                                    title="Generate Sales Order from PO"
                                                                    className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors inline-flex items-center gap-1 shadow-sm disabled:opacity-50"
                                                                >
                                                                    <ShoppingCart size={13} /> Gen Order
                                                                </button>
                                                            ) : (
                                                                <span title="Sales Order already generated for this PO" className="px-2.5 py-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 text-[11px] font-bold rounded-xl border border-emerald-200 dark:border-emerald-800 inline-flex items-center gap-1">
                                                                    <CheckCircle2 size={12} /> SO Generated
                                                                </span>
                                                            )}

                                                            {isWithin24h && (
                                                                <button
                                                                    onClick={() => handleDeletePo(po)}
                                                                    title="Delete PO (Allowed within 24h of creation)"
                                                                    className="px-2 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400 text-xs font-bold rounded-xl transition-colors inline-flex items-center"
                                                                >
                                                                    <Trash2 size={13} />
                                                                </button>
                                                            )}
                                                        </>
                                                    );
                                                })()}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Create / Edit Customer PO Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-[96vw] xl:max-w-7xl 2xl:max-w-[1550px] overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh]">
                        
                        <div className="p-5 sm:p-6 bg-slate-900 text-white flex justify-between items-center flex-shrink-0 border-b border-slate-800">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-600/20 rounded-xl flex items-center justify-center border border-blue-500/30">
                                    {editingPo ? <Edit2 size={20} className="text-blue-400" /> : <FileCheck size={20} className="text-blue-400" />}
                                </div>
                                <div>
                                    <h2 className="text-xl font-extrabold tracking-tight">
                                        {editingPo ? 'Edit Customer Purchase Order' : 'Log Customer Purchase Order (Inward PO)'}
                                    </h2>
                                    <p className="text-xs text-slate-400 mt-0.5">PO #: <span className="font-mono font-bold text-blue-300">{newPo.poNumber}</span></p>
                                </div>
                            </div>
                            <button onClick={() => { setIsCreateModalOpen(false); setEditingPo(null); }} className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 transition-colors">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-5 sm:p-7 overflow-y-auto flex-1 space-y-6">
                            
                            {/* Step 1: Customer & Linked Quotation Logistics */}
                            <div className="bg-slate-50/80 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-4">
                                <h3 className="text-xs font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                                    1. Customer & Linked Quotation Details
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                            Linked Outward Quotation <span className="text-slate-400 font-normal">(Optional - Auto-Fills Customer & Rates)</span>
                                        </label>
                                        <SearchableSelect
                                            options={[
                                                { value: '', label: '-- None (Direct Customer PO) --' },
                                                ...(Array.isArray(quotations) ? quotations : []).map(q => ({
                                                    value: q._id,
                                                    label: `${q.quotationNumber} - ${q.customerName || 'Customer'} (₹${Number(q.totalAmount || 0).toLocaleString()})`
                                                }))
                                            ]}
                                            value={selectedQuoteId}
                                            onChange={(val: any) => {
                                                if (!val) {
                                                    setSelectedQuoteId('');
                                                    setNewPo(prev => ({ ...prev, quotationReference: '' }));
                                                } else {
                                                    handleSelectQuotation(val);
                                                }
                                            }}
                                            placeholder="Select Linked Quotation (Optional)..."
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
                                            value={newPo.customer}
                                            onChange={(val: any) => handleSelectCustomer(val)}
                                            placeholder="Select Customer..."
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                            Customer PO Number *
                                        </label>
                                        <input
                                            type="text"
                                            value={newPo.poNumber}
                                            onChange={(e) => setNewPo({ ...newPo, poNumber: e.target.value })}
                                            placeholder="e.g. PO-CUST-8823"
                                            className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                            Customer PO Date
                                        </label>
                                        <input
                                            type="date"
                                            value={newPo.date}
                                            onChange={(e) => setNewPo({ ...newPo, date: e.target.value })}
                                            className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                            Transportation Mode
                                        </label>
                                        <select
                                            value={newPo.transportationMethod}
                                            onChange={(e) => setNewPo({ ...newPo, transportationMethod: e.target.value })}
                                            className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none"
                                        >
                                            <option value="Road Freight">Road Freight (By Truck)</option>
                                            <option value="Air Freight">Air Freight (Express)</option>
                                            <option value="Sea Freight">Sea Freight (Cargo)</option>
                                            <option value="Courier Service">Courier Service</option>
                                            <option value="Customer Pickup">Customer Self Pickup</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                            Freight / Transport Charges (₹)
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={newPo.transportationCharges}
                                            onChange={(e) => {
                                                const val = Number(e.target.value) || 0;
                                                setNewPo(prev => ({ ...prev, transportationCharges: val }));
                                                recalculateTotals(newPo.items);
                                            }}
                                            className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Step 2: Ordered Items - 1 Line on Desktop */}
                            <div className="bg-slate-50/80 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-xs font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                                        2. Ordered Items & Line Pricing
                                    </h3>
                                    <button
                                        type="button"
                                        onClick={handleAddItem}
                                        className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-950/80 bg-blue-50 dark:bg-blue-950/60 px-3.5 py-1.5 rounded-xl border border-blue-200 dark:border-blue-800 transition-colors"
                                    >
                                        + Add Item
                                    </button>
                                </div>

                                {/* Desktop Table Header */}
                                <div className="hidden lg:grid grid-cols-12 gap-3 px-3 py-1.5 text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    <div className="col-span-3">Product Item *</div>
                                    <div className="col-span-3">Specifications</div>
                                    <div className="col-span-1 text-center">Qty</div>
                                    <div className="col-span-1 text-center">Unit</div>
                                    <div className="col-span-2 text-right">Unit Rate (₹)</div>
                                    <div className="col-span-1 text-center">GST %</div>
                                    <div className="col-span-1 text-right">Action</div>
                                </div>

                                {/* Items Rows */}
                                <div className="space-y-2.5">
                                    {newPo.items.map((item, idx) => (
                                        <div key={idx} className="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                            <div className="grid grid-cols-12 gap-3 items-center">
                                                
                                                {/* Product Item Column */}
                                                <div className="col-span-12 lg:col-span-3">
                                                    <label className="block lg:hidden text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                                                        Product Item *
                                                    </label>
                                                    <SearchableSelect
                                                        options={(Array.isArray(fgItems) ? fgItems : [])
                                                            .map(m => ({
                                                                value: (m._id || m.id)?.toString(),
                                                                label: `${m.name || m.itemName} ${m.code ? `(${m.code})` : ''}`.trim()
                                                            }))
                                                            .filter(o => o.value)}
                                                        value={item.fgItem}
                                                        onChange={(val: any) => handleItemChange(idx, 'fgItem', val)}
                                                        placeholder="Select Product..."
                                                    />
                                                    {!item.fgItem && (
                                                        <input
                                                            type="text"
                                                            value={item.productName}
                                                            onChange={(e) => handleItemChange(idx, 'productName', e.target.value)}
                                                            placeholder="Or type custom product..."
                                                            className="w-full mt-1.5 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200"
                                                        />
                                                    )}
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
                                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-blue-500"
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
                                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-extrabold text-blue-600 dark:text-blue-400 text-right"
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
                                                    {newPo.items.length > 1 && (
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
                            <div className="bg-blue-50/70 dark:bg-blue-950/40 p-5 rounded-2xl border border-blue-200 dark:border-blue-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <div className="text-xs space-y-1">
                                    <div className="font-bold text-slate-700 dark:text-slate-300">
                                        Subtotal: <span className="font-mono text-slate-900 dark:text-white">₹{newPo.subtotal.toLocaleString()}</span>
                                    </div>
                                    <div className="font-bold text-slate-700 dark:text-slate-300">
                                        Total Tax (GST): <span className="font-mono text-slate-900 dark:text-white">₹{newPo.taxAmount.toLocaleString()}</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">Grand Total PO Amount</span>
                                    <span className="text-2xl font-black text-blue-600 dark:text-blue-400 font-mono">
                                        ₹{newPo.totalAmount.toLocaleString()}
                                    </span>
                                </div>
                            </div>

                        </div>

                        <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 flex-shrink-0">
                            <button onClick={() => { setIsCreateModalOpen(false); setEditingPo(null); }} className="px-5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 font-semibold text-sm hover:bg-slate-100 transition-colors">
                                Cancel
                            </button>
                            <button
                                onClick={handleCreatePoSubmit}
                                disabled={submitting}
                                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-blue-600/20 flex items-center gap-2"
                            >
                                <FileCheck size={16} />
                                {submitting ? 'Saving...' : (editingPo ? 'Update Customer PO' : 'Save Customer PO')}
                            </button>
                        </div>

                    </div>
                </div>
            )}

            {/* View Details & Document Fulfillment Timeline Modal */}
            {selectedPo && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-[96vw] xl:max-w-7xl 2xl:max-w-[1550px] overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh]">
                        
                        <div className="p-5 sm:p-6 bg-slate-900 text-white flex justify-between items-center flex-shrink-0 border-b border-slate-800">
                            <div>
                                <h2 className="text-xl font-extrabold font-mono text-blue-300">{selectedPo.poNumber}</h2>
                                <p className="text-xs text-slate-400 mt-0.5">Customer PO Overview, User Ownership Audit & Document Timeline</p>
                            </div>
                            <button onClick={() => setSelectedPo(null)} className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 transition-colors">
                                <X size={18} />
                            </button>
                        </div>

                        {/* Modal Tab Bar */}
                        <div className="flex bg-slate-100 dark:bg-slate-800/80 px-6 pt-2 border-b border-slate-200 dark:border-slate-800 gap-2 flex-shrink-0">
                            <button
                                onClick={() => setActiveViewTab('overview')}
                                className={`px-5 py-2.5 font-bold text-xs flex items-center gap-2 rounded-t-xl transition-all ${
                                    activeViewTab === 'overview'
                                        ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 border-t-2 border-x border-blue-600 dark:border-blue-500 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                                }`}
                            >
                                <FileText size={15} /> Customer PO Overview & Items
                            </button>
                            <button
                                onClick={() => setActiveViewTab('dispatch')}
                                className={`px-5 py-2.5 font-bold text-xs flex items-center gap-2 rounded-t-xl transition-all ${
                                    activeViewTab === 'dispatch'
                                        ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 border-t-2 border-x border-blue-600 dark:border-blue-500 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                                }`}
                            >
                                <Truck size={15} /> Dispatch Timeline ({timelineData.deliveryChallans.length} DCs)
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-6 flex-1">
                            
                            {activeViewTab === 'overview' ? (
                                /* TAB 1: OVERVIEW & ITEMS */
                                <div className="space-y-6">
                                    {/* General Status & Interactive Control */}
                                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                                        <div>
                                            <span className="text-slate-400 block mb-0.5">Linked Quotation Ref:</span>
                                            <strong className="text-blue-600 dark:text-blue-400 font-mono font-bold">
                                                {selectedPo.quotationReference?.quotationNumber || 'Direct PO'}
                                            </strong>
                                        </div>

                                        <div>
                                            <span className="text-slate-400 block mb-0.5">Customer PO Date:</span>
                                            <strong className="text-slate-800 dark:text-slate-200 font-bold">
                                                {selectedPo.date ? new Date(selectedPo.date).toLocaleDateString('en-GB') : 'N/A'}
                                            </strong>
                                        </div>

                                        <div>
                                            <span className="text-slate-400 block mb-0.5">Total PO Value:</span>
                                            <strong className="text-blue-600 font-extrabold font-mono text-sm">
                                                ₹{Number(selectedPo.totalAmount || selectedPo.subtotal || 0).toLocaleString()}
                                            </strong>
                                        </div>

                                        <div>
                                            <span className="text-slate-400 block mb-0.5">Fulfillment Status:</span>
                                            <select
                                                value={selectedPo.status || 'Received'}
                                                onChange={(e) => handleStatusChange(selectedPo._id, e.target.value)}
                                                className="px-3 py-1 rounded-xl text-xs font-bold bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700 outline-none cursor-pointer"
                                            >
                                                <option value="Received">Received</option>
                                                <option value="Accepted">Accepted</option>
                                                <option value="Processing">Processing</option>
                                                <option value="Sales Order Generated">Sales Order Generated</option>
                                                <option value="Partially Dispatched">Partially Dispatched</option>
                                                <option value="Completed">Completed</option>
                                                <option value="Cancelled">Cancelled</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* User Audit Ownership Box */}
                                    <div className="p-4 bg-blue-50/60 dark:bg-blue-950/40 rounded-2xl border border-blue-200 dark:border-blue-800 space-y-3">
                                        <h4 className="text-xs font-extrabold text-blue-900 dark:text-blue-200 uppercase tracking-wider flex items-center gap-1.5">
                                            <ShieldCheck size={16} className="text-blue-600 dark:text-blue-400" />
                                            User Audit Tracking & Ownership
                                        </h4>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                            <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-blue-100 dark:border-blue-900">
                                                <User size={16} className="text-blue-600 shrink-0" />
                                                <div className="truncate">
                                                    <span className="text-[10px] text-slate-400 block">Created / Logged By User</span>
                                                    <strong className="text-slate-800 dark:text-slate-200 font-bold truncate block">{getUserName(selectedPo.createdBy || selectedPo.receivedBy)}</strong>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-blue-100 dark:border-blue-900">
                                                <UserCheck size={16} className="text-emerald-600 shrink-0" />
                                                <div className="truncate">
                                                    <span className="text-[10px] text-slate-400 block">Last Updated By User</span>
                                                    <strong className="text-slate-800 dark:text-slate-200 font-bold truncate block">{getUserName(selectedPo.updatedBy || selectedPo.createdBy || selectedPo.receivedBy)}</strong>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Status Audit History Log */}
                                        {Array.isArray(selectedPo.statusHistory) && selectedPo.statusHistory.length > 0 && (
                                            <div className="pt-2 border-t border-blue-100 dark:border-blue-900 space-y-2">
                                                <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300 flex items-center gap-1">
                                                    <History size={13} /> Status Audit History Log
                                                </span>
                                                <div className="space-y-1.5 max-h-32 overflow-y-auto custom-scrollbar">
                                                    {selectedPo.statusHistory.map((h: any, idx: number) => (
                                                        <div key={idx} className="flex justify-between items-center text-[11px] bg-white/80 dark:bg-slate-900/80 px-3 py-1.5 rounded-lg border border-blue-100/60 dark:border-blue-900/60">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-bold px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded text-[10px]">
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
                                            <Building2 size={14} className="text-blue-500" /> Customer Information
                                        </h4>
                                        <div className="font-extrabold text-slate-900 dark:text-white text-sm">
                                            {selectedPo.customerName || selectedPo.customer?.name || 'Customer'}
                                        </div>
                                        <div className="text-slate-500 font-medium space-x-3">
                                            {selectedPo.customer?.email && <span>Email: {selectedPo.customer.email}</span>}
                                            {selectedPo.customer?.phone && <span>Phone: {selectedPo.customer.phone}</span>}
                                        </div>
                                    </div>

                                    {/* Ordered Items Breakdown */}
                                    <div>
                                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Ordered Items Breakdown</h4>
                                        <div className="border rounded-xl overflow-hidden">
                                            <table className="w-full text-xs text-left">
                                                <thead className="bg-slate-100 dark:bg-slate-800 font-bold text-slate-600">
                                                    <tr>
                                                        <th className="p-3">Product Name</th>
                                                        <th className="p-3 text-center">Ordered Qty</th>
                                                        <th className="p-3 text-right">Unit Rate (₹)</th>
                                                        <th className="p-3 text-center">GST %</th>
                                                        <th className="p-3 text-right">Line Total (₹)</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y">
                                                    {(selectedPo.items || []).map((item: any, idx: number) => {
                                                        const qty = Number(item.quantity) || 1;
                                                        const rate = Number(item.rate) || 0;
                                                        const tax = Number(item.taxRate != null ? item.taxRate : 18);
                                                        const lineTotal = item.amount ? Number(item.amount) : (qty * rate * (1 + tax / 100));

                                                        return (
                                                            <tr key={idx}>
                                                                <td className="p-3 font-bold">
                                                                    {item.productName || item.fgItem?.name || 'Product Item'}
                                                                    {item.description && <span className="block text-[10px] font-normal text-slate-400">{item.description}</span>}
                                                                </td>
                                                                <td className="p-3 text-center font-bold text-blue-600">{qty} {item.unit || 'PCS'}</td>
                                                                <td className="p-3 text-right font-bold font-mono">₹{rate.toLocaleString()}</td>
                                                                <td className="p-3 text-center font-bold text-slate-600">{tax}%</td>
                                                                <td className="p-3 text-right font-extrabold font-mono text-blue-600">₹{lineTotal.toLocaleString()}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                /* TAB 2: DISPATCH TIMELINE & ITEM BALANCE TRACKING */
                                <div className="space-y-6">
                                    {(() => {
                                        const dcs = timelineData.deliveryChallans || [];
                                        const invs = timelineData.invoices || [];

                                        // Compute item-by-item remaining balance
                                        const itemFulfillmentList = (selectedPo.items || []).map((poItem: any) => {
                                            const fgId = poItem.fgItem?._id || poItem.fgItem;
                                            const pName = (poItem.productName || poItem.fgItem?.name || '').toLowerCase().trim();
                                            const ordQty = Number(poItem.quantity || 0);

                                            // Sum matching DC quantities
                                            let dcQty = 0;
                                            dcs.forEach((dc: any) => {
                                                (dc.items || []).forEach((dcIt: any) => {
                                                    const dcFgId = dcIt.material || dcIt.component || dcIt.fgItem;
                                                    const dcName = (dcIt.materialName || dcIt.componentName || dcIt.name || '').toLowerCase().trim();
                                                    if ((fgId && dcFgId && fgId.toString() === dcFgId.toString()) || (pName && dcName && pName === dcName)) {
                                                        dcQty += Number(dcIt.quantity || 0);
                                                    }
                                                });
                                            });

                                            // Sum matching Invoice quantities
                                            let invQty = 0;
                                            invs.forEach((inv: any) => {
                                                (inv.items || []).forEach((invIt: any) => {
                                                    const invFgId = invIt.material || invIt.component || invIt.fgItem;
                                                    const invName = (invIt.materialName || invIt.componentName || invIt.name || '').toLowerCase().trim();
                                                    if ((fgId && invFgId && fgId.toString() === invFgId.toString()) || (pName && invName && pName === invName)) {
                                                        invQty += Number(invIt.quantity || 0);
                                                    }
                                                });
                                            });

                                            // Effective fulfilled is max of DC dispatched and Invoiced
                                            const fulfilledQty = Math.max(dcQty, invQty);
                                            const remainingQty = Math.max(0, ordQty - fulfilledQty);

                                            return {
                                                productName: poItem.productName || poItem.fgItem?.name || 'Product Item',
                                                unit: poItem.unit || 'PCS',
                                                orderedQty: ordQty,
                                                dcQty,
                                                invQty,
                                                fulfilledQty,
                                                remainingQty,
                                                status: remainingQty === 0 ? 'Fulfilled' : (fulfilledQty > 0 ? 'Partial' : 'Pending')
                                            };
                                        });

                                        const totalOrd = itemFulfillmentList.reduce((acc: number, cur: any) => acc + cur.orderedQty, 0);
                                        const totalFulfilled = itemFulfillmentList.reduce((acc: number, cur: any) => acc + cur.fulfilledQty, 0);
                                        const fulfillmentPct = totalOrd > 0 ? Math.min(100, Math.round((totalFulfilled / totalOrd) * 100)) : 0;

                                        return (
                                            <div className="space-y-6">
                                                
                                                {/* Header Stats Bar */}
                                                <div className="p-4 bg-slate-50 dark:bg-slate-800/70 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                                    <div>
                                                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                                                            <PackageCheck size={16} className="text-slate-600 dark:text-slate-400" /> Item Fulfillment & Remaining Balance Summary
                                                        </h4>
                                                        <p className="text-xs text-slate-500 mt-0.5">Generating a DC or Invoice reduces item remaining balance quantity.</p>
                                                    </div>
                                                    <div className="text-xs font-bold bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                                                        Total Progress: <span className="font-mono text-slate-900 dark:text-white font-extrabold">{totalFulfilled} / {totalOrd} PCS</span> ({fulfillmentPct}%)
                                                    </div>
                                                </div>

                                                {/* Item-by-Item Balance Matrix Table */}
                                                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                                                    <div className="p-3 bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 font-bold text-xs text-slate-700 dark:text-slate-300">
                                                        Item-by-Item Remaining Balance Tracker
                                                    </div>
                                                    <div className="overflow-x-auto">
                                                        <table className="w-full text-xs text-left">
                                                            <thead className="bg-slate-50 dark:bg-slate-800 font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                                                                <tr>
                                                                    <th className="p-3">Product Item</th>
                                                                    <th className="p-3 text-center">Ordered Qty</th>
                                                                    <th className="p-3 text-center">DC Dispatched</th>
                                                                    <th className="p-3 text-center">Invoiced Qty</th>
                                                                    <th className="p-3 text-center bg-blue-50/50 dark:bg-blue-950/30">Remaining Balance</th>
                                                                    <th className="p-3 text-center">Item Status</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                                                {itemFulfillmentList.map((row: any, idx: number) => (
                                                                    <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/50">
                                                                        <td className="p-3 font-bold text-slate-800 dark:text-slate-200">{row.productName}</td>
                                                                        <td className="p-3 text-center font-bold text-slate-700 dark:text-slate-300">{row.orderedQty} {row.unit}</td>
                                                                        <td className="p-3 text-center font-mono text-slate-700 dark:text-slate-300">{row.dcQty} {row.unit}</td>
                                                                        <td className="p-3 text-center font-mono text-slate-700 dark:text-slate-300">{row.invQty} {row.unit}</td>
                                                                        <td className="p-3 text-center font-mono font-extrabold text-blue-600 dark:text-blue-400 bg-blue-50/30 dark:bg-blue-950/20">
                                                                            {row.remainingQty} {row.unit}
                                                                        </td>
                                                                        <td className="p-3 text-center">
                                                                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                                                                row.status === 'Fulfilled' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                                                                                row.status === 'Partial' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' :
                                                                                'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                                                            }`}>
                                                                                {row.status}
                                                                            </span>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>

                                                {/* Independent Dispatch Documents: DCs and Invoices */}
                                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                                    
                                                    {/* Delivery Challans (DC) */}
                                                    <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                                                        <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800">
                                                            <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                                                <Truck size={15} className="text-slate-500" /> Delivery Challans (DC) ({dcs.length})
                                                            </h5>
                                                        </div>

                                                        {dcs.length === 0 ? (
                                                            <p className="text-slate-400 italic text-xs py-4 text-center">No Delivery Challans generated yet.</p>
                                                        ) : (
                                                            <div className="space-y-2.5 max-h-72 overflow-y-auto">
                                                                {dcs.map((dc: any) => (
                                                                    <div key={dc._id} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1.5">
                                                                        <div className="flex justify-between items-center">
                                                                            <span className="font-mono font-extrabold text-slate-900 dark:text-white">{dc.dcNumber}</span>
                                                                            <span className="text-slate-500 font-mono text-[11px]">{dc.date ? new Date(dc.date).toLocaleDateString('en-GB') : ''}</span>
                                                                        </div>
                                                                        {Array.isArray(dc.items) && dc.items.length > 0 && (
                                                                            <div className="pt-1.5 border-t border-slate-200 dark:border-slate-700/60 space-y-1">
                                                                                {dc.items.map((it: any, iIdx: number) => (
                                                                                    <div key={iIdx} className="flex justify-between text-[11px] text-slate-600 dark:text-slate-300">
                                                                                        <span>• {it.materialName || it.componentName || it.name || 'Dispatched Item'}</span>
                                                                                        <span className="font-mono font-bold text-slate-900 dark:text-white">{it.quantity} {it.unit || 'PCS'}</span>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Tax Invoices */}
                                                    <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                                                        <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800">
                                                            <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                                                <IndianRupee size={15} className="text-slate-500" /> Tax Invoices ({invs.length})
                                                            </h5>
                                                        </div>

                                                        {invs.length === 0 ? (
                                                            <p className="text-slate-400 italic text-xs py-4 text-center">No Tax Invoices generated yet.</p>
                                                        ) : (
                                                            <div className="space-y-2.5 max-h-72 overflow-y-auto">
                                                                {invs.map((inv: any) => (
                                                                    <div key={inv._id} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1.5">
                                                                        <div className="flex justify-between items-center">
                                                                            <span className="font-mono font-extrabold text-slate-900 dark:text-white">{inv.invoiceNumber}</span>
                                                                            <span className="text-slate-500 font-mono text-[11px]">{inv.date ? new Date(inv.date).toLocaleDateString('en-GB') : ''}</span>
                                                                        </div>
                                                                        <div className="text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300">
                                                                            Amount: ₹{Number(inv.totalAmount || 0).toLocaleString()}
                                                                        </div>
                                                                        {Array.isArray(inv.items) && inv.items.length > 0 && (
                                                                            <div className="pt-1.5 border-t border-slate-200 dark:border-slate-700/60 space-y-1">
                                                                                {inv.items.map((it: any, iIdx: number) => (
                                                                                    <div key={iIdx} className="flex justify-between text-[11px] text-slate-600 dark:text-slate-300">
                                                                                        <span>• {it.materialName || it.componentName || it.name || 'Billed Item'}</span>
                                                                                        <span className="font-mono font-bold text-slate-900 dark:text-white">{it.quantity} {it.unit || 'PCS'}</span>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>

                                                </div>

                                            </div>
                                        );
                                    })()}
                                </div>
                            )}

                        </div>

                        <div className="p-4 bg-slate-50 dark:bg-slate-800 flex justify-between items-center border-t border-slate-200 dark:border-slate-700">
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleGenerateSalesOrder(selectedPo._id)}
                                    disabled={generatingOrder || selectedPo.status === 'Sales Order Generated'}
                                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-colors flex items-center gap-1 shadow-sm disabled:opacity-50"
                                >
                                    <ShoppingCart size={14} /> Generate Sales Order
                                </button>
                                <button
                                    onClick={() => {
                                        const poToEdit = selectedPo;
                                        setSelectedPo(null);
                                        handleOpenEditModal(poToEdit);
                                    }}
                                    className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-bold text-xs rounded-xl transition-colors flex items-center gap-1"
                                >
                                    <Edit2 size={14} /> Edit Customer PO
                                </button>
                                <button
                                    onClick={() => handleDeletePo(selectedPo)}
                                    className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400 font-bold text-xs rounded-xl transition-colors flex items-center gap-1"
                                >
                                    <Trash2 size={14} /> Delete PO
                                </button>
                            </div>
                            <button onClick={() => setSelectedPo(null)} className="px-5 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl">
                                Close
                            </button>
                        </div>

                    </div>
                </div>
            )}

        </div>
    );
}

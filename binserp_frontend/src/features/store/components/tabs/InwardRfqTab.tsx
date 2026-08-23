import React, { useState, useEffect, useMemo } from 'react';
import { Inbox, Plus, Search, Calendar, User, Eye, FileText, CheckCircle2, Clock, Filter, ArrowRight, X, Building2, Printer, LayoutGrid, List, Edit2, Trash2, UserCheck, History, ShieldCheck, Download } from 'lucide-react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/src/lib/api';
import SearchableSelect from '../SearchableSelect';
import { generateFrontendInwardRfqPDF } from '@/src/utils/frontendPdfHelper';

interface InwardRfqTabProps {
    token: string | null;
    onError: (msg: string) => void;
    onSuccess: (msg: string) => void;
}

export default function InwardRfqTab({ token, onError, onSuccess }: InwardRfqTabProps) {
    const [loading, setLoading] = useState(true);
    const [rfqs, setRfqs] = useState<any[]>([]);
    const [fgItems, setFgItems] = useState<any[]>([]);
    const [customers, setCustomers] = useState<any[]>([]);
    const [companyInfo, setCompanyInfo] = useState<any>(null);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('All');
    const [filterCustomer, setFilterCustomer] = useState<string>('All');

    // Create/Edit RFQ Modal State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingRfq, setEditingRfq] = useState<any | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [customerSearchTerm, setCustomerSearchTerm] = useState('');

    const [newRfq, setNewRfq] = useState({
        rfqNumber: '',
        date: new Date().toISOString().slice(0, 10),
        expectedDeliveryDate: '',
        customer: '',
        customerName: '',
        customerEmail: '',
        customerPhone: '',
        remarks: '',
        status: 'Open',
        items: [{ fgItem: '', customItemName: '', description: '', quantity: 1, unit: 'PCS', targetPrice: '' }]
    });

    // View Modal State
    const [selectedRfq, setSelectedRfq] = useState<any | null>(null);

    const fetchData = async () => {
        if (!token) return;
        try {
            setLoading(true);
            const [rfqRes, fgRes, custRes, compRes] = await Promise.all([
                apiGet('/api/sales/incoming-rfq', token).catch(() => ({ rfqs: [] })),
                apiGet('/api/store/fg-item', token).catch(() => []),
                apiGet('/api/store/customer', token).catch(() => []),
                apiGet('/api/store/company-info', token).catch(() => null)
            ]);

            const rfqsList = Array.isArray(rfqRes?.rfqs) ? rfqRes.rfqs : (Array.isArray(rfqRes?.data) ? rfqRes.data : (Array.isArray(rfqRes) ? rfqRes : []));
            const fgList = Array.isArray(fgRes?.fgItems) ? fgRes.fgItems : (Array.isArray(fgRes) ? fgRes : []);
            const custList = Array.isArray(custRes?.customers) ? custRes.customers : (Array.isArray(custRes) ? custRes : []);

            setRfqs(rfqsList);
            setFgItems(fgList);
            setCustomers(custList);
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

    const handleOpenCreateModal = () => {
        setEditingRfq(null);
        setCustomerSearchTerm('');
        setNewRfq({
            rfqNumber: generateRfqNumber(),
            date: new Date().toISOString().slice(0, 10),
            expectedDeliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
            customer: '',
            customerName: '',
            customerEmail: '',
            customerPhone: '',
            remarks: '',
            status: 'Open',
            items: [{ fgItem: '', customItemName: '', description: '', quantity: 1, unit: 'PCS', targetPrice: '' }]
        });
        setIsCreateModalOpen(true);
    };

    const handleOpenEditModal = (rfq: any) => {
        setEditingRfq(rfq);
        setCustomerSearchTerm('');
        setNewRfq({
            rfqNumber: rfq.rfqNumber || '',
            date: rfq.date ? new Date(rfq.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
            expectedDeliveryDate: rfq.expectedDeliveryDate ? new Date(rfq.expectedDeliveryDate).toISOString().slice(0, 10) : (rfq.dueDate ? new Date(rfq.dueDate).toISOString().slice(0, 10) : ''),
            customer: rfq.customer?._id || rfq.customer || '',
            customerName: rfq.customerName || rfq.customer?.name || '',
            customerEmail: rfq.customerEmail || rfq.customer?.email || '',
            customerPhone: rfq.customerPhone || rfq.customer?.phone || '',
            remarks: rfq.remarks || '',
            status: rfq.status || 'Open',
            items: Array.isArray(rfq.items) && rfq.items.length > 0
                ? rfq.items.map((it: any) => ({
                    fgItem: it.fgItem?._id || it.fgItem || '',
                    customItemName: it.customItemName || it.itemName || it.materialName || '',
                    description: it.description || '',
                    quantity: it.quantity || 1,
                    unit: it.unit || 'PCS',
                    targetPrice: it.targetPrice || ''
                }))
                : [{ fgItem: '', customItemName: '', description: '', quantity: 1, unit: 'PCS', targetPrice: '' }]
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
            items: [...prev.items, { fgItem: '', customItemName: '', description: '', quantity: 1, unit: 'PCS', targetPrice: '' }]
        }));
    };

    const handleRemoveItem = (index: number) => {
        setNewRfq(prev => ({
            ...prev,
            items: prev.items.filter((_, i) => i !== index)
        }));
    };

    const handleItemChange = (index: number, field: string, value: any) => {
        const updatedItems = [...newRfq.items];
        if (field === 'fgItem') {
            const selectedFg = (Array.isArray(fgItems) ? fgItems : []).find((m: any) => (m._id || m.id)?.toString() === value?.toString());
            const autoName = selectedFg?.name || selectedFg?.itemName || '';
            const autoDesc = selectedFg?.description || selectedFg?.details || autoName;
            const autoUnit = selectedFg?.unit || selectedFg?.uom || 'PCS';

            updatedItems[index] = {
                ...updatedItems[index],
                fgItem: value,
                customItemName: autoName,
                description: autoDesc,
                unit: autoUnit
            };
        } else {
            updatedItems[index] = { ...updatedItems[index], [field]: value };
        }
        setNewRfq(prev => ({ ...prev, items: updatedItems }));
    };

    const handleSelectCustomer = (custId: string) => {
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
        if (!newRfq.customerName.trim()) {
            onError("Please select or enter customer name");
            return;
        }
        if (!newRfq.items.some(i => (i.fgItem || i.customItemName) && Number(i.quantity) > 0)) {
            onError("Please add at least one item with quantity");
            return;
        }

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
            onError(err.message || "Failed to save Inward RFQ");
        } finally {
            setSubmitting(false);
        }
    };

    const filteredRfqs = useMemo(() => {
        return (Array.isArray(rfqs) ? rfqs : []).filter((rfq: any) => {
            const matchSearch =
                (rfq.rfqNumber && rfq.rfqNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (rfq.customerName && rfq.customerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (rfq.items && rfq.items.some((i: any) => (i.customItemName || i.fgItem?.name || '').toLowerCase().includes(searchTerm.toLowerCase())));

            const matchStatus = filterStatus === 'All' || rfq.status === filterStatus;

            let matchCustomer = true;
            if (filterCustomer !== 'All') {
                const custId = rfq.customer?._id || rfq.customer;
                matchCustomer = custId?.toString() === filterCustomer?.toString();
            }

            return matchSearch && matchStatus && matchCustomer;
        });
    }, [rfqs, searchTerm, filterStatus, filterCustomer]);

    return (
        <div className="space-y-4 animate-in fade-in duration-300">
            
            {/* Search, Filter & Action Toolbar */}
            <div className="bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col xl:flex-row justify-between items-stretch xl:items-center gap-3">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 min-w-0">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="Search RFQ #, Customer or Item..."
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

                {/* Right Side: Status Filter + Create RFQ Button */}
                <div className="flex flex-wrap sm:flex-nowrap items-center justify-between sm:justify-end gap-2 shrink-0">
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold overflow-x-auto no-scrollbar max-w-full shrink-0">
                        {['All', 'Draft', 'Open', 'Quoted', 'Closed', 'Rejected'].map(status => (
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
                        <Plus size={15} /> Create Inward RFQ
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center p-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
            ) : filteredRfqs.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                    <Inbox className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No Inward RFQs Found</h3>
                    <p className="text-xs text-slate-500 mt-1">Create an Inward RFQ to log customer quote requests.</p>
                </div>
            ) : (
                /* Table & Cards View */
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                                <tr>
                                    <th className="px-4 py-3.5">RFQ Number</th>
                                    <th className="px-4 py-3.5">Target Items</th>
                                    <th className="px-4 py-3.5 text-center">Expected Date</th>
                                    <th className="px-4 py-3.5">Customer</th>
                                    <th className="px-4 py-3.5 text-center">Status</th>
                                    <th className="px-4 py-3.5 text-center">Received / Logged By</th>
                                    <th className="px-4 py-3.5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                {filteredRfqs.map((rfq) => {
                                    const firstItemName = rfq.items?.[0]?.fgItem?.name || rfq.items?.[0]?.customItemName || rfq.items?.[0]?.itemName || rfq.items?.[0]?.materialName || 'Item';
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

                                            <td className="px-4 py-3.5 text-center text-xs font-medium text-slate-600 dark:text-slate-400">
                                                <div className="flex items-center justify-center gap-1 font-bold text-slate-700 dark:text-slate-300">
                                                    <User size={13} className="text-indigo-500" />
                                                    {getUserName(rfq.createdBy || rfq.receivedBy)}
                                                </div>
                                                {rfq.createdAt && <div className="text-[10px] text-slate-400">{new Date(rfq.createdAt).toLocaleDateString('en-GB')}</div>}
                                            </td>

                                             <td className="px-4 py-3.5 text-right space-x-1.5">
                                                <button
                                                    onClick={() => setSelectedRfq(rfq)}
                                                    title="View Details"
                                                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-xs font-bold rounded-xl transition-colors inline-flex items-center gap-1"
                                                >
                                                    <Eye size={13} /> View
                                                </button>

                                                <button
                                                    onClick={() => {
                                                        if (typeof window !== 'undefined') {
                                                            window.location.href = `/dashboard/store/sales/quotations?rfqId=${rfq._id}`;
                                                        }
                                                    }}
                                                    title="Create Outward Quotation"
                                                    className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors inline-flex items-center gap-1 shadow-sm"
                                                >
                                                    <FileText size={13} /> Quote
                                                </button>

                                                <button
                                                    onClick={() => handleOpenEditModal(rfq)}
                                                    title="Edit RFQ"
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
                            const firstItemName = rfq.items?.[0]?.fgItem?.name || rfq.items?.[0]?.customItemName || rfq.items?.[0]?.itemName || rfq.items?.[0]?.materialName || 'Item';
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

                                    <div className="bg-slate-50 dark:bg-slate-700/40 p-2.5 rounded-lg text-xs">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Target Items</span>
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
                            
                            {/* General & Customer Info Panel */}
                            <div className="bg-slate-50/80 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-4">
                                <h3 className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                                    1. Customer & Logistics Details
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                            Select Customer / Client *
                                        </label>
                                        <SearchableSelect
                                            options={(Array.isArray(customers) ? customers : []).map(c => ({
                                                value: (c._id || c.id)?.toString(),
                                                label: `${c.name || c.companyName} ${c.code ? `(${c.code})` : ''} ${c.city ? `- ${c.city}` : ''}`.trim()
                                            }))}
                                            value={newRfq.customer}
                                            onChange={(val: any) => handleSelectCustomer(val)}
                                            placeholder="Search & Select Customer..."
                                        />
                                        {!newRfq.customer && (
                                            <input
                                                type="text"
                                                value={newRfq.customerName}
                                                onChange={(e) => setNewRfq({ ...newRfq, customerName: e.target.value })}
                                                placeholder="Or type customer name directly..."
                                                className="w-full mt-2 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                            />
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                            RFQ Date
                                        </label>
                                        <input
                                            type="date"
                                            value={newRfq.date}
                                            onChange={(e) => setNewRfq({ ...newRfq, date: e.target.value })}
                                            className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20"
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

                                    <div className="md:col-span-2 lg:col-span-4">
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
                                    <div className="col-span-4">Product Item *</div>
                                    <div className="col-span-4">Item Specifications / Details</div>
                                    <div className="col-span-2 text-center">Required Qty</div>
                                    <div className="col-span-1 text-center">Unit</div>
                                    <div className="col-span-1 text-right">Action</div>
                                </div>

                                {/* Items Rows - All in 1 Line on Desktop */}
                                <div className="space-y-2.5">
                                    {newRfq.items.map((item, idx) => (
                                        <div key={idx} className="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                            <div className="grid grid-cols-12 gap-3 items-center">
                                                
                                                {/* Product Item Column */}
                                                <div className="col-span-12 lg:col-span-4">
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
                                                            value={item.customItemName}
                                                            onChange={(e) => handleItemChange(idx, 'customItemName', e.target.value)}
                                                            placeholder="Or type custom item name..."
                                                            className="w-full mt-1.5 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200"
                                                        />
                                                    )}
                                                </div>

                                                {/* Specifications / Technical Details Column */}
                                                <div className="col-span-12 lg:col-span-4">
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

                                                {/* Required Qty Column */}
                                                <div className="col-span-6 lg:col-span-2">
                                                    <label className="block lg:hidden text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                                                        Required Qty
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={item.quantity}
                                                        onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                                                        placeholder="Qty"
                                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white text-center"
                                                    />
                                                </div>

                                                {/* Unit Column */}
                                                <div className="col-span-5 lg:col-span-1">
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
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                                <div>
                                    <span className="text-slate-400 block mb-0.5">Expected Delivery Date:</span>
                                    <strong className="text-slate-800 dark:text-slate-200 font-bold">
                                        {selectedRfq.expectedDeliveryDate || selectedRfq.dueDate ? new Date(selectedRfq.expectedDeliveryDate || selectedRfq.dueDate).toLocaleDateString('en-GB') : 'N/A'}
                                    </strong>
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
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Requested Customer Items</h4>
                                <div className="border rounded-xl overflow-hidden">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-slate-100 dark:bg-slate-800 font-bold text-slate-600">
                                            <tr>
                                                <th className="p-3">Item Name</th>
                                                <th className="p-3 text-center">Required Qty</th>
                                                <th className="p-3 text-center">Target Rate</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {(selectedRfq.items || []).map((item: any, idx: number) => (
                                                <tr key={idx}>
                                                    <td className="p-3 font-bold">
                                                        {item.fgItem?.name || item.customItemName || item.itemName || item.materialName || 'Item'}
                                                        {item.description && <span className="block text-[10px] font-normal text-slate-400">{item.description}</span>}
                                                    </td>
                                                    <td className="p-3 text-center font-bold text-indigo-600">{item.quantity} {item.unit || 'PCS'}</td>
                                                    <td className="p-3 text-center font-bold text-slate-700">{item.targetPrice ? `₹${item.targetPrice}` : '-'}</td>
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

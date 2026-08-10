import React, { useState, useEffect, useMemo } from 'react';
import { Send, Plus, Search, Calendar, User, Eye, FileText, CheckCircle2, Clock, Filter, ArrowRight, X, Building2, Printer, LayoutGrid, List } from 'lucide-react';
import { apiGet, apiPost } from '@/src/lib/api';
import SearchableSelect from '../SearchableSelect';
import { generateFrontendRfqPDF } from '@/src/utils/frontendPdfHelper';

interface OutwardRfqTabProps {
    token: string | null;
    onError: (msg: string) => void;
    onSuccess: (msg: string) => void;
}

export default function OutwardRfqTab({ token, onError, onSuccess }: OutwardRfqTabProps) {
    const [loading, setLoading] = useState(true);
    const [rfqs, setRfqs] = useState<any[]>([]);
    const [materials, setMaterials] = useState<any[]>([]);
    const [vendors, setVendors] = useState<any[]>([]);
    const [companyInfo, setCompanyInfo] = useState<any>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('All');
    const [viewMode, setViewMode] = useState<'buckets' | 'table'>('buckets');

    // Create RFQ Modal State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [newRfq, setNewRfq] = useState({
        rfqNumber: '',
        dueDate: '',
        vendorIds: [] as string[],
        remarks: '',
        items: [{ materialId: '', materialName: '', quantity: 1, unit: 'PCS', targetPrice: '' }]
    });

    // View Modal State
    const [selectedRfq, setSelectedRfq] = useState<any | null>(null);

    const fetchData = async () => {
        if (!token) return;
        try {
            setLoading(true);
            const [rfqRes, matRes, venRes, compRes] = await Promise.all([
                apiGet('/api/purchase/rfq', token).catch(() => ({ data: [] })),
                apiGet('/api/store/rm-bo-item', token).catch(() => []),
                apiGet('/api/store/vendor', token).catch(() => []),
                apiGet('/api/store/company-info', token).catch(() => null)
            ]);

            const rfqsList = Array.isArray(rfqRes?.data) ? rfqRes.data : (Array.isArray(rfqRes?.rfqs) ? rfqRes.rfqs : (Array.isArray(rfqRes) ? rfqRes : []));
            const matList = Array.isArray(matRes?.rmBoItems) ? matRes.rmBoItems : (Array.isArray(matRes?.materials) ? matRes.materials : (Array.isArray(matRes) ? matRes : []));
            const venList = Array.isArray(venRes?.vendors) ? venRes.vendors : (Array.isArray(venRes) ? venRes : []);

            setRfqs(rfqsList);
            setMaterials(matList);
            setVendors(venList);
            setCompanyInfo(compRes?.companyInfo || compRes);
        } catch (err: any) {
            console.error("RFQ Fetch error:", err);
            onError(err.message || "Failed to fetch Outward RFQs");
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
        return `RFQ-${dateStr}-${randomNum}`;
    };

    const handleOpenCreateModal = () => {
        setNewRfq({
            rfqNumber: generateRfqNumber(),
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
            vendorIds: [],
            remarks: '',
            items: [{ materialId: '', materialName: '', quantity: 1, unit: 'PCS', targetPrice: '' }]
        });
        setIsCreateModalOpen(true);
    };

    const handleAddItem = () => {
        setNewRfq(prev => ({
            ...prev,
            items: [...prev.items, { materialId: '', materialName: '', quantity: 1, unit: 'PCS', targetPrice: '' }]
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
        if (field === 'materialId') {
            const selectedMat = (Array.isArray(materials) ? materials : []).find((m: any) => m._id === value);
            updatedItems[index] = {
                ...updatedItems[index],
                materialId: value,
                materialName: selectedMat?.name || '',
                unit: selectedMat?.unit || 'PCS'
            };
        } else {
            updatedItems[index] = { ...updatedItems[index], [field]: value };
        }
        setNewRfq(prev => ({ ...prev, items: updatedItems }));
    };

    const handleToggleVendor = (vendorId: string) => {
        setNewRfq(prev => {
            const exists = prev.vendorIds.includes(vendorId);
            return {
                ...prev,
                vendorIds: exists 
                    ? prev.vendorIds.filter(id => id !== vendorId)
                    : [...prev.vendorIds, vendorId]
            };
        });
    };

    const handleCreateRfqSubmit = async () => {
        if (!newRfq.items.some(i => i.materialId && Number(i.quantity) > 0)) {
            onError("Please select at least one material item with quantity");
            return;
        }

        setSubmitting(true);
        try {
            await apiPost('/api/purchase/rfq', newRfq, token);
            onSuccess("Outward RFQ created & dispatched successfully");
            setIsCreateModalOpen(false);
            fetchData();
        } catch (err: any) {
            onError(err.message || "Failed to create Outward RFQ");
        } finally {
            setSubmitting(false);
        }
    };

    const filteredRfqs = useMemo(() => {
        return (Array.isArray(rfqs) ? rfqs : []).filter((rfq: any) => {
            const matchSearch = 
                (rfq.rfqNumber && rfq.rfqNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (rfq.items && rfq.items.some((i: any) => i.materialName?.toLowerCase().includes(searchTerm.toLowerCase())));
            
            const matchStatus = filterStatus === 'All' || rfq.status === filterStatus;
            return matchSearch && matchStatus;
        });
    }, [rfqs, searchTerm, filterStatus]);

    // Flatten RFQs into Vendor Buckets for Vendor-Specific View & Printing
    const vendorBuckets = useMemo(() => {
        const buckets: any[] = [];

        filteredRfqs.forEach((rfq: any) => {
            const assignedVendorList = (Array.isArray(rfq.vendorIds) && rfq.vendorIds.length > 0)
                ? rfq.vendorIds
                : (rfq.vendorName ? [{ _id: 'v_custom', name: rfq.vendorName, email: rfq.vendorEmail, phone: rfq.vendorPhone }] : []);

            if (assignedVendorList.length === 0) {
                // Generic Bucket
                buckets.push({
                    bucketId: `${rfq._id || rfq.rfqNumber}_generic`,
                    rfq,
                    vendor: { name: rfq.vendorName || 'All Suppliers' },
                    vendorName: rfq.vendorName || 'All Suppliers'
                });
            } else {
                assignedVendorList.forEach((vObj: any) => {
                    const fullVendor = typeof vObj === 'string' 
                        ? (vendors.find((v: any) => v._id === vObj) || { name: 'Supplier', _id: vObj })
                        : vObj;

                    buckets.push({
                        bucketId: `${rfq._id || rfq.rfqNumber}_${fullVendor._id || fullVendor.name}`,
                        rfq,
                        vendor: fullVendor,
                        vendorName: fullVendor.name || fullVendor.vendorName || 'Supplier'
                    });
                });
            }
        });

        return buckets;
    }, [filteredRfqs, vendors]);

    const handlePrintVendorRfqPdf = (rfq: any, vendor: any) => {
        generateFrontendRfqPDF({
            rfq,
            vendor,
            companyInfo
        });
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            
            {/* Header & KPI Summary */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                        <Send size={22} className="text-cyan-600" /> Outward RFQs & Vendor Buckets
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Issue inquiries to vendors, manage vendor-specific RFQ buckets, and print tailored PDF RFQ quote sheets.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleOpenCreateModal}
                        className="px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold text-xs rounded-xl shadow-md shadow-cyan-600/20 hover:shadow-lg transition-all flex items-center gap-2"
                    >
                        <Plus size={16} /> Create Outward RFQ
                    </button>
                </div>
            </div>

            {/* Filter & View Switcher Bar */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="relative w-full sm:w-80">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                        type="text"
                        placeholder="Search RFQ #, Vendor or Item..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 bg-slate-50/50 dark:bg-slate-800/50"
                    />
                </div>

                <div className="flex items-center gap-3">
                    {/* Status Filter */}
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold">
                        {['All', 'Sent', 'Quoted', 'Closed'].map(status => (
                            <button
                                key={status}
                                onClick={() => setFilterStatus(status)}
                                className={`px-3 py-1.5 rounded-lg transition-all ${filterStatus === status ? 'bg-white dark:bg-slate-900 text-cyan-600 shadow-sm' : 'text-slate-500'}`}
                            >
                                {status}
                            </button>
                        ))}
                    </div>

                    {/* View Switcher: Vendor Buckets vs Table */}
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold">
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
                            <List size={15} /> Table View
                        </button>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center p-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
                </div>
            ) : vendorBuckets.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                    <Send className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No Outward RFQ Buckets Found</h3>
                    <p className="text-xs text-slate-500 mt-1">Create an Outward RFQ to generate vendor buckets and printable PDF quote sheets.</p>
                </div>
            ) : viewMode === 'buckets' ? (
                
                /* Vendor RFQ Buckets Grid View */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {vendorBuckets.map((bucket) => {
                        const { rfq, vendor, vendorName } = bucket;
                        const items = rfq.items || [];

                        return (
                            <div key={bucket.bucketId} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4">
                                
                                {/* Vendor Bucket Header */}
                                <div className="space-y-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-9 h-9 rounded-xl bg-cyan-50 dark:bg-cyan-950 text-cyan-600 dark:text-cyan-400 flex items-center justify-center font-bold">
                                                <Building2 size={18} />
                                            </div>
                                            <div>
                                                <h3 className="font-extrabold text-slate-900 dark:text-white text-sm line-clamp-1">
                                                    {vendorName}
                                                </h3>
                                                <span className="text-[10px] text-slate-400 block font-mono">
                                                    RFQ: <strong className="text-cyan-600 dark:text-cyan-400">{rfq.rfqNumber}</strong>
                                                </span>
                                            </div>
                                        </div>

                                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                            rfq.status === 'Quoted' ? 'bg-emerald-100 text-emerald-800' :
                                            rfq.status === 'Closed' ? 'bg-slate-100 text-slate-600' :
                                            'bg-amber-100 text-amber-800'
                                        }`}>
                                            {rfq.status || 'Sent'}
                                        </span>
                                    </div>

                                    {/* Vendor Contact Brief */}
                                    <div className="text-xs text-slate-500 dark:text-slate-400 space-y-0.5 pt-1">
                                        {vendor.city && <div>📍 {vendor.city} {vendor.state ? `, ${vendor.state}` : ''}</div>}
                                        {vendor.gst && <div className="font-mono text-[10px]">GSTIN: <strong className="text-slate-700 dark:text-slate-300">{vendor.gst}</strong></div>}
                                    </div>
                                </div>

                                {/* Requested Materials Summary */}
                                <div className="space-y-2 flex-1">
                                    <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex justify-between">
                                        <span>Requested Items ({items.length})</span>
                                        <span>Due: {rfq.dueDate ? new Date(rfq.dueDate).toLocaleDateString('en-GB') : 'Immediate'}</span>
                                    </div>

                                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 space-y-1.5 max-h-36 overflow-y-auto border border-slate-100 dark:border-slate-800">
                                        {items.map((it: any, idx: number) => (
                                            <div key={idx} className="flex justify-between items-center text-xs">
                                                <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[180px]">{it.materialName || 'Material'}</span>
                                                <span className="font-bold text-cyan-600 dark:text-cyan-400 bg-white dark:bg-slate-900 px-2 py-0.5 rounded border text-[11px]">
                                                    {it.quantity} {it.unit || 'PCS'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Vendor Bucket Action Bar */}
                                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                                    <button
                                        onClick={() => setSelectedRfq(rfq)}
                                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors"
                                    >
                                        View Details
                                    </button>

                                    <button
                                        onClick={() => handlePrintVendorRfqPdf(rfq, vendor)}
                                        className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-cyan-600/20 flex items-center gap-1.5"
                                    >
                                        <Printer size={15} /> Print Vendor RFQ PDF
                                    </button>
                                </div>

                            </div>
                        );
                    })}
                </div>
            ) : (

                /* Table View */
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                                <tr>
                                    <th className="px-5 py-3.5">RFQ Number</th>
                                    <th className="px-5 py-3.5">Target Items</th>
                                    <th className="px-5 py-3.5 text-center">Due Date</th>
                                    <th className="px-5 py-3.5 text-center">Vendors Sent</th>
                                    <th className="px-5 py-3.5 text-center">Status</th>
                                    <th className="px-5 py-3.5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                {filteredRfqs.map((rfq) => (
                                    <tr key={rfq._id || rfq.rfqNumber} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="px-5 py-4 font-mono font-bold text-cyan-600 dark:text-cyan-400">
                                            {rfq.rfqNumber}
                                            <span className="block text-[10px] text-slate-400 font-sans font-normal">{new Date(rfq.createdAt || Date.now()).toLocaleDateString('en-GB')}</span>
                                        </td>

                                        <td className="px-5 py-4 font-bold text-slate-800 dark:text-slate-200">
                                            {Array.isArray(rfq.items) && rfq.items.length > 0 ? (
                                                <div>
                                                    {rfq.items[0]?.materialName || 'Material Item'}
                                                    {rfq.items.length > 1 && <span className="text-xs text-slate-400 font-normal ml-1 flex-inline">+{rfq.items.length - 1} more</span>}
                                                </div>
                                            ) : 'Materials'}
                                        </td>

                                        <td className="px-5 py-4 text-center font-bold text-slate-700 dark:text-slate-300">
                                            {rfq.dueDate ? new Date(rfq.dueDate).toLocaleDateString('en-GB') : 'N/A'}
                                        </td>

                                        <td className="px-5 py-4 text-center font-bold text-slate-700 dark:text-slate-300">
                                            <span className="bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg text-xs">
                                                {Array.isArray(rfq.vendorIds) ? rfq.vendorIds.length : (rfq.vendors?.length || 0)} Vendors
                                            </span>
                                        </td>

                                        <td className="px-5 py-4 text-center">
                                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                                rfq.status === 'Quoted' ? 'bg-emerald-100 text-emerald-800' :
                                                rfq.status === 'Closed' ? 'bg-slate-100 text-slate-600' :
                                                'bg-amber-100 text-amber-800'
                                            }`}>
                                                {rfq.status || 'Sent'}
                                            </span>
                                        </td>

                                        <td className="px-5 py-4 text-right space-x-2">
                                            <button
                                                onClick={() => setSelectedRfq(rfq)}
                                                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-xs font-bold rounded-xl transition-colors inline-flex items-center gap-1.5"
                                            >
                                                <Eye size={14} /> View
                                            </button>
                                            <button
                                                onClick={() => handlePrintVendorRfqPdf(rfq, null)}
                                                className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold rounded-xl transition-colors inline-flex items-center gap-1.5"
                                            >
                                                <Printer size={14} /> Print PDF
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Create Outward RFQ Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
                        
                        <div className="p-6 bg-cyan-950 text-white flex justify-between items-center flex-shrink-0 border-b border-cyan-900">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-cyan-900 rounded-xl flex items-center justify-center border border-cyan-700">
                                    <Send size={20} className="text-cyan-300" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-extrabold tracking-tight">Create Outward RFQ</h2>
                                    <p className="text-xs text-cyan-300/80 mt-0.5">RFQ Number: <span className="font-mono font-bold text-white">{newRfq.rfqNumber}</span></p>
                                </div>
                            </div>
                            <button onClick={() => setIsCreateModalOpen(false)} className="w-8 h-8 rounded-full bg-cyan-900 hover:bg-cyan-800 flex items-center justify-center text-white transition-colors">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 space-y-6">
                            
                            {/* General Info */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                                        Quotation Due Date
                                    </label>
                                    <input
                                        type="date"
                                        value={newRfq.dueDate}
                                        onChange={(e) => setNewRfq({ ...newRfq, dueDate: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-cyan-500/20"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                                        Remarks / Terms & Conditions
                                    </label>
                                    <input
                                        type="text"
                                        value={newRfq.remarks}
                                        onChange={(e) => setNewRfq({ ...newRfq, remarks: e.target.value })}
                                        placeholder="e.g. Include GST and freight charges in quote"
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-cyan-500/20"
                                    />
                                </div>
                            </div>

                            {/* Select Materials */}
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                        Target Materials to Request Quotes For
                                    </h3>
                                    <button
                                        type="button"
                                        onClick={handleAddItem}
                                        className="text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:underline bg-cyan-50 dark:bg-cyan-950/60 px-3 py-1 rounded-lg border border-cyan-200 dark:border-cyan-800"
                                    >
                                        + Add Material
                                    </button>
                                </div>

                                <div className="space-y-2">
                                    {newRfq.items.map((item, idx) => (
                                        <div key={idx} className="grid grid-cols-12 gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 items-center">
                                            <div className="col-span-6">
                                                <SearchableSelect
                                                    options={(Array.isArray(materials) ? materials : []).map(m => ({ value: m._id, label: `${m.name} (${m.code || 'RM/BO'})` }))}
                                                    value={item.materialId}
                                                    onChange={(val: any) => handleItemChange(idx, 'materialId', val)}
                                                    placeholder="Select Material..."
                                                />
                                            </div>

                                            <div className="col-span-3">
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={item.quantity}
                                                    onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                                                    placeholder="Qty"
                                                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white"
                                                />
                                            </div>

                                            <div className="col-span-2 text-xs font-bold text-slate-500">
                                                {item.unit}
                                            </div>

                                            <div className="col-span-1 text-right">
                                                {newRfq.items.length > 1 && (
                                                    <button onClick={() => handleRemoveItem(idx)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg">
                                                        <X size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Select Target Vendors */}
                            <div className="space-y-2">
                                <h3 className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    Select Vendors to Send RFQ To ({newRfq.vendorIds.length} Selected)
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-44 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                                    {(Array.isArray(vendors) ? vendors : []).map((vendor: any) => {
                                        const isSelected = newRfq.vendorIds.includes(vendor._id);
                                        return (
                                            <div
                                                key={vendor._id}
                                                onClick={() => handleToggleVendor(vendor._id)}
                                                className={`cursor-pointer p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between transition-all ${
                                                    isSelected
                                                        ? 'bg-cyan-50 border-cyan-300 text-cyan-900 dark:bg-cyan-950 dark:text-cyan-200'
                                                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                                                }`}
                                            >
                                                <div className="truncate">
                                                    <div>{vendor.name}</div>
                                                    <div className="text-[10px] text-slate-400 font-normal">{vendor.city || vendor.vendorType || 'Supplier'}</div>
                                                </div>
                                                <input type="checkbox" checked={isSelected} onChange={() => {}} className="accent-cyan-600" />
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                        </div>

                        <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 flex-shrink-0">
                            <button onClick={() => setIsCreateModalOpen(false)} className="px-5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 font-semibold text-sm">
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateRfqSubmit}
                                disabled={submitting}
                                className="px-6 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-cyan-600/20 flex items-center gap-2"
                            >
                                <Send size={16} />
                                {submitting ? 'Dispatching...' : 'Dispatch Outward RFQ'}
                            </button>
                        </div>

                    </div>
                </div>
            )}

            {/* View RFQ Modal */}
            {selectedRfq && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[85vh]">
                        
                        <div className="p-6 bg-cyan-950 text-white flex justify-between items-center flex-shrink-0">
                            <div>
                                <h2 className="text-xl font-extrabold font-mono text-cyan-200">{selectedRfq.rfqNumber}</h2>
                                <p className="text-xs text-cyan-300/80">Outward RFQ Details</p>
                            </div>
                            <button onClick={() => setSelectedRfq(null)} className="w-8 h-8 rounded-full bg-cyan-900 hover:bg-cyan-800 flex items-center justify-center text-white">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-4">
                            <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl">
                                <div><span className="text-slate-400 block">Due Date:</span> <strong className="text-slate-800 dark:text-slate-200 font-bold">{selectedRfq.dueDate ? new Date(selectedRfq.dueDate).toLocaleDateString('en-GB') : 'N/A'}</strong></div>
                                <div><span className="text-slate-400 block">Status:</span> <strong className="text-cyan-600 font-bold">{selectedRfq.status || 'Sent'}</strong></div>
                            </div>

                            <div>
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Requested Material Items</h4>
                                <div className="border rounded-xl overflow-hidden">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-slate-100 dark:bg-slate-800 font-bold text-slate-600">
                                            <tr>
                                                <th className="p-3">Material Name</th>
                                                <th className="p-3 text-center">Required Qty</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {(selectedRfq.items || []).map((item: any, idx: number) => (
                                                <tr key={idx}>
                                                    <td className="p-3 font-bold">{item.materialName || 'Item'}</td>
                                                    <td className="p-3 text-center font-bold text-cyan-600">{item.quantity} {item.unit || 'PCS'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-slate-50 dark:bg-slate-800 flex justify-end">
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

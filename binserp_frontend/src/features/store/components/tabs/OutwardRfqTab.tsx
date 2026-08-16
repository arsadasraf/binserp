import React, { useState, useEffect, useMemo } from 'react';
import { Send, Plus, Search, Calendar, User, Eye, FileText, CheckCircle2, Clock, Filter, ArrowRight, X, Building2, Printer, LayoutGrid, List, Edit2, Trash2, UserCheck, History, ShieldCheck, Download, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { apiGet, apiPost, apiPut, apiDelete } from '@/src/lib/api';
import SearchableSelect from '../SearchableSelect';
import { generateFrontendRfqPDF } from '@/src/utils/frontendPdfHelper';
import MasterExcelImportModal from '../modals/MasterExcelImportModal';
import { downloadMasterExcelTemplate } from '@/src/utils/excelMasterHelper';

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
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('All');
    const [filterVendor, setFilterVendor] = useState<string>('All');
    const [viewMode, setViewMode] = useState<'buckets' | 'table'>('table');

    // Create/Edit RFQ Modal State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingRfq, setEditingRfq] = useState<any | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [vendorSearchTerm, setVendorSearchTerm] = useState('');
    const [newRfq, setNewRfq] = useState({
        rfqNumber: '',
        dueDate: '',
        vendorIds: [] as string[],
        remarks: '',
        items: [{ materialId: '', materialName: '', description: '', quantity: 1, unit: 'PCS', targetPrice: '' }]
    });

    // View Modal & Print State
    const [selectedRfq, setSelectedRfq] = useState<any | null>(null);
    const [printMenuRfq, setPrintMenuRfq] = useState<any | null>(null);

    const resolveRfqVendors = (rfq: any, vendorList: any[]) => {
        if (!rfq) return [];
        if (Array.isArray(rfq.vendorIds) && rfq.vendorIds.length > 0) {
            return rfq.vendorIds.map((vObj: any) => {
                if (typeof vObj === 'object' && vObj !== null && (vObj.name || vObj.vendorName)) {
                    return vObj;
                }
                const vId = typeof vObj === 'string' ? vObj : (vObj?._id || vObj?.id);
                const found = (Array.isArray(vendorList) ? vendorList : []).find((v: any) => (v._id || v.id)?.toString() === vId?.toString());
                return found || { _id: vId, name: 'Supplier / Vendor', city: '', phone: '' };
            });
        }
        if (Array.isArray(rfq.vendors) && rfq.vendors.length > 0) return rfq.vendors;
        if (rfq.vendorName) return [{ _id: 'custom', name: rfq.vendorName, email: rfq.vendorEmail, phone: rfq.vendorPhone }];
        return [];
    };

    const filteredModalVendors = useMemo(() => {
        if (!vendorSearchTerm.trim()) return vendors;
        const lower = vendorSearchTerm.toLowerCase();
        return (Array.isArray(vendors) ? vendors : []).filter((v: any) =>
            (v.name && v.name.toLowerCase().includes(lower)) ||
            (v.code && v.code.toLowerCase().includes(lower)) ||
            (v.city && v.city.toLowerCase().includes(lower)) ||
            (v.phone && v.phone.toLowerCase().includes(lower)) ||
            (v.email && v.email.toLowerCase().includes(lower)) ||
            (v.gst && v.gst.toLowerCase().includes(lower))
        );
    }, [vendors, vendorSearchTerm]);

    const fetchData = async () => {
        if (!token) return;
        try {
            setLoading(true);
            const [rfqRes, matRes, invRes, venRes, compRes] = await Promise.all([
                apiGet('/api/purchase/rfq', token).catch(() => ({ data: [] })),
                apiGet('/api/store/rm-bo-item', token).catch(() => []),
                apiGet('/api/store/inventory', token).catch(() => []),
                apiGet('/api/store/vendor', token).catch(() => []),
                apiGet('/api/store/company-info', token).catch(() => null)
            ]);

            const rfqsList = Array.isArray(rfqRes?.data) ? rfqRes.data : (Array.isArray(rfqRes?.rfqs) ? rfqRes.rfqs : (Array.isArray(rfqRes) ? rfqRes : []));
            const venList = Array.isArray(venRes?.vendors) ? venRes.vendors : (Array.isArray(venRes) ? venRes : []);

            let matList: any[] = [];
            if (Array.isArray(matRes)) matList = matRes;
            else if (Array.isArray(matRes?.rmBoItems)) matList = matRes.rmBoItems;
            else if (Array.isArray(matRes?.data?.rmBoItems)) matList = matRes.data.rmBoItems;
            else if (Array.isArray(matRes?.materials)) matList = matRes.materials;
            else if (Array.isArray(matRes?.data)) matList = matRes.data;

            let invList: any[] = [];
            if (Array.isArray(invRes)) invList = invRes;
            else if (Array.isArray(invRes?.inventory)) invList = invRes.inventory;
            else if (Array.isArray(invRes?.data?.inventory)) invList = invRes.data.inventory;
            else if (Array.isArray(invRes?.data)) invList = invRes.data;

            const finalMaterials: any[] = [];
            const seenKeys = new Set<string>();

            const processItem = (m: any) => {
                if (!m) return;
                const realId = (m.materialId?._id || m.materialId || m._id || m.id)?.toString();
                const cleanName = (m.name || m.materialName || m.itemName || '').trim().toLowerCase();

                if (realId && seenKeys.has(realId)) return;
                if (cleanName && seenKeys.has(cleanName)) return;

                if (realId) seenKeys.add(realId);
                if (cleanName) seenKeys.add(cleanName);

                finalMaterials.push(m);
            };

            matList.forEach(processItem);
            if (finalMaterials.length === 0) {
                invList.forEach(processItem);
            }

            setRfqs(rfqsList);
            setMaterials(finalMaterials);
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

    const handlePrintVendorRfqPdf = (rfq: any, vendor: any) => {
        try {
            generateFrontendRfqPDF({ rfq, vendor, companyInfo });
            onSuccess(`Outward RFQ PDF generated for ${vendor ? (vendor.name || vendor.companyName) : 'All Vendors'}`);
        } catch (err: any) {
            onError(err.message || "Failed to generate PDF");
        }
    };

    const getUserName = (userObj: any) => {
        if (!userObj) return 'System User';
        if (typeof userObj === 'string') return userObj;
        return userObj.name || userObj.email || 'User';
    };

    const handleOpenCreateModal = () => {
        setEditingRfq(null);
        setVendorSearchTerm('');
        setNewRfq({
            rfqNumber: generateRfqNumber(),
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
            vendorIds: [],
            remarks: '',
            items: [{ materialId: '', materialName: '', description: '', quantity: 1, unit: 'PCS', targetPrice: '' }]
        });
        setIsCreateModalOpen(true);
    };

    const handleOpenEditModal = (rfq: any) => {
        setEditingRfq(rfq);
        setVendorSearchTerm('');
        const extractedVendorIds = (Array.isArray(rfq.vendorIds) ? rfq.vendorIds : [])
            .map((v: any) => typeof v === 'string' ? v : (v._id || v.id))
            .filter(Boolean);

        setNewRfq({
            rfqNumber: rfq.rfqNumber || '',
            dueDate: rfq.dueDate ? new Date(rfq.dueDate).toISOString().slice(0, 10) : '',
            vendorIds: extractedVendorIds,
            remarks: rfq.remarks || '',
            items: Array.isArray(rfq.items) && rfq.items.length > 0 
                ? rfq.items.map((it: any) => ({
                    materialId: it.materialId?._id || it.materialId || '',
                    materialName: it.materialName || '',
                    description: it.description || '',
                    quantity: it.quantity || 1,
                    unit: it.unit || 'PCS',
                    targetPrice: it.targetPrice || ''
                }))
                : [{ materialId: '', materialName: '', description: '', quantity: 1, unit: 'PCS', targetPrice: '' }]
        });
        setIsCreateModalOpen(true);
    };

    const handleDeleteRfq = async (rfq: any) => {
        if (!rfq || !rfq._id) return;
        if (confirm(`Are you sure you want to delete Outward RFQ #${rfq.rfqNumber}? This action cannot be undone.`)) {
            try {
                await apiDelete(`/api/purchase/rfq/${rfq._id}`, token);
                onSuccess(`Outward RFQ #${rfq.rfqNumber} deleted successfully`);
                if (selectedRfq && selectedRfq._id === rfq._id) {
                    setSelectedRfq(null);
                }
                fetchData();
            } catch (err: any) {
                onError(err.message || "Failed to delete Outward RFQ");
            }
        }
    };

    const handleStatusChange = async (rfqId: string, newStatus: string) => {
        try {
            const res = await apiPut(`/api/purchase/rfq/${rfqId}`, { status: newStatus }, token);
            onSuccess(`RFQ Status updated to ${newStatus}`);
            const updated = res.data || res;
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
            items: [...prev.items, { materialId: '', materialName: '', description: '', quantity: 1, unit: 'PCS', targetPrice: '' }]
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
            const selectedMat = (Array.isArray(materials) ? materials : []).find((m: any) => (m._id || m.id)?.toString() === value?.toString());
            const autoName = selectedMat?.name || selectedMat?.materialName || selectedMat?.itemName || '';
            const autoDesc = selectedMat?.descriptions || selectedMat?.description || selectedMat?.details || autoName;
            const autoUnit = selectedMat?.unit || selectedMat?.uom || selectedMat?.categoryId?.unit || selectedMat?.category?.unit || 'PCS';

            updatedItems[index] = {
                ...updatedItems[index],
                materialId: value,
                materialName: autoName,
                description: autoDesc,
                unit: autoUnit
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
        if (!newRfq.items.some(i => (i.materialId || i.materialName) && Number(i.quantity) > 0)) {
            onError("Please select at least one material item with quantity");
            return;
        }

        setSubmitting(true);
        try {
            if (editingRfq && editingRfq._id) {
                await apiPut(`/api/purchase/rfq/${editingRfq._id}`, newRfq, token);
                onSuccess(`Outward RFQ #${newRfq.rfqNumber} updated successfully`);
            } else {
                await apiPost('/api/purchase/rfq', newRfq, token);
                onSuccess("Outward RFQ created & dispatched successfully");
            }
            setIsCreateModalOpen(false);
            setEditingRfq(null);
            fetchData();
        } catch (err: any) {
            onError(err.message || "Failed to save Outward RFQ");
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

            let matchVendor = true;
            if (filterVendor !== 'All') {
                const assigned = resolveRfqVendors(rfq, vendors);
                matchVendor = assigned.some((v: any) => (v._id || v.id)?.toString() === filterVendor?.toString());
            }

            return matchSearch && matchStatus && matchVendor;
        });
    }, [rfqs, searchTerm, filterStatus, filterVendor, vendors]);

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            
            {/* Header & KPI Summary */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                        <Send size={22} className="text-cyan-600" /> Outward RFQs & Inquiries
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Issue inquiries to vendors, filter by specific vendors or statuses, and generate tailored PDF quote sheets.
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

            {/* Filter Bar */}
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

                <div className="flex flex-wrap items-center gap-3">
                    {/* Vendor Filter Dropdown */}
                    <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">Vendor:</label>
                        <select
                            value={filterVendor}
                            onChange={(e) => setFilterVendor(e.target.value)}
                            className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 outline-none cursor-pointer focus:ring-2 focus:ring-cyan-500/20 max-w-[200px] truncate"
                        >
                            <option value="All">All Vendors</option>
                            {(Array.isArray(vendors) ? vendors : []).map((v: any) => (
                                <option key={v._id || v.id} value={(v._id || v.id)?.toString()}>
                                    {v.name || v.companyName} {v.code ? `(${v.code})` : ''}
                                </option>
                            ))}
                        </select>
                    </div>

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
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center p-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
                </div>
            ) : filteredRfqs.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                    <Send className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No Outward RFQs Found</h3>
                    <p className="text-xs text-slate-500 mt-1">Create an Outward RFQ to issue quote requests to suppliers.</p>
                </div>
            ) : (

                /* Table View */
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                                <tr>
                                    <th className="px-4 py-3.5">RFQ Number</th>
                                    <th className="px-4 py-3.5">Target Items</th>
                                    <th className="px-4 py-3.5 text-center">Due Date</th>
                                    <th className="px-4 py-3.5 text-center">Vendors</th>
                                    <th className="px-4 py-3.5 text-center">Status</th>
                                    <th className="px-4 py-3.5 text-center">Created By</th>
                                    <th className="px-4 py-3.5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                {filteredRfqs.map((rfq) => (
                                    <tr key={rfq._id || rfq.rfqNumber} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="px-4 py-3.5 font-mono font-bold text-cyan-600 dark:text-cyan-400">
                                            {rfq.rfqNumber}
                                            <span className="block text-[10px] text-slate-400 font-sans font-normal">{new Date(rfq.createdAt || Date.now()).toLocaleDateString('en-GB')}</span>
                                        </td>

                                        <td className="px-4 py-3.5 font-bold text-slate-800 dark:text-slate-200">
                                            {Array.isArray(rfq.items) && rfq.items.length > 0 ? (
                                                <div>
                                                    {rfq.items[0]?.materialName || 'Material Item'}
                                                    {rfq.items.length > 1 && <span className="text-xs text-slate-400 font-normal ml-1 flex-inline">+{rfq.items.length - 1} more</span>}
                                                </div>
                                            ) : 'Materials'}
                                        </td>

                                        <td className="px-4 py-3.5 text-center font-bold text-slate-700 dark:text-slate-300 text-xs">
                                            {rfq.dueDate ? new Date(rfq.dueDate).toLocaleDateString('en-GB') : 'N/A'}
                                        </td>

                                        <td className="px-4 py-3.5 text-center font-bold text-slate-700 dark:text-slate-300">
                                            <span className="bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg text-xs">
                                                {Array.isArray(rfq.vendorIds) ? rfq.vendorIds.length : (rfq.vendors?.length || 0)} Vendors
                                            </span>
                                        </td>

                                        <td className="px-4 py-3.5 text-center">
                                            <select
                                                value={rfq.status || 'Sent'}
                                                onChange={(e) => handleStatusChange(rfq._id, e.target.value)}
                                                className={`px-2.5 py-1 rounded-full text-xs font-bold border-none outline-none cursor-pointer ${
                                                    rfq.status === 'Quoted' ? 'bg-emerald-100 text-emerald-800' :
                                                    rfq.status === 'Closed' ? 'bg-slate-100 text-slate-600' :
                                                    rfq.status === 'Draft' ? 'bg-slate-200 text-slate-700' :
                                                    'bg-amber-100 text-amber-800'
                                                }`}
                                            >
                                                <option value="Draft">Draft</option>
                                                <option value="Sent">Sent</option>
                                                <option value="Quoted">Quoted</option>
                                                <option value="Closed">Closed</option>
                                            </select>
                                        </td>

                                        <td className="px-4 py-3.5 text-center text-xs font-medium text-slate-600 dark:text-slate-400">
                                            <div className="flex items-center justify-center gap-1 font-bold text-slate-700 dark:text-slate-300">
                                                <User size={13} className="text-cyan-500" />
                                                {getUserName(rfq.createdBy)}
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
                                                onClick={() => handleOpenEditModal(rfq)}
                                                title="Edit RFQ"
                                                className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 text-xs font-bold rounded-xl transition-colors inline-flex items-center gap-1"
                                            >
                                                <Edit2 size={13} /> Edit
                                            </button>

                                            <button
                                                onClick={() => {
                                                    const assigned = resolveRfqVendors(rfq, vendors);
                                                    if (assigned.length <= 1) {
                                                        handlePrintVendorRfqPdf(rfq, assigned[0] || null);
                                                    } else {
                                                        setPrintMenuRfq(rfq);
                                                    }
                                                }}
                                                className="px-2.5 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold rounded-xl transition-colors inline-flex items-center gap-1 shadow-sm"
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
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Create / Edit Outward RFQ Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
                        
                        <div className="p-6 bg-cyan-950 text-white flex justify-between items-center flex-shrink-0 border-b border-cyan-900">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-cyan-900 rounded-xl flex items-center justify-center border border-cyan-700">
                                    {editingRfq ? <Edit2 size={20} className="text-cyan-300" /> : <Send size={20} className="text-cyan-300" />}
                                </div>
                                <div>
                                    <h2 className="text-xl font-extrabold tracking-tight">
                                        {editingRfq ? 'Edit Outward RFQ' : 'Create Outward RFQ'}
                                    </h2>
                                    <p className="text-xs text-cyan-300/80 mt-0.5">RFQ Number: <span className="font-mono font-bold text-white">{newRfq.rfqNumber}</span></p>
                                </div>
                            </div>
                            <button onClick={() => { setIsCreateModalOpen(false); setEditingRfq(null); }} className="w-8 h-8 rounded-full bg-cyan-900 hover:bg-cyan-800 flex items-center justify-center text-white transition-colors">
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

                                <div className="space-y-3">
                                    {newRfq.items.map((item, idx) => (
                                        <div key={idx} className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2.5">
                                            <div className="grid grid-cols-12 gap-2.5 items-center">
                                                <div className="col-span-6">
                                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                                        RM / BO Material Item
                                                    </label>
                                                    <SearchableSelect
                                                        options={(Array.isArray(materials) ? materials : [])
                                                            .map(m => {
                                                                const id = (m._id || m.id)?.toString();
                                                                const name = m.name || m.materialName || m.itemName || 'Material Item';
                                                                const code = m.code ? `(${m.code})` : '';
                                                                const desc = (m.descriptions || m.description || m.details) ? ` - ${m.descriptions || m.description || m.details}` : '';
                                                                return {
                                                                    value: id,
                                                                    label: `${name} ${code}${desc}`.trim()
                                                                };
                                                            })
                                                            .filter(o => o.value)}
                                                        value={item.materialId}
                                                        onChange={(val: any) => handleItemChange(idx, 'materialId', val)}
                                                        placeholder="Select Material..."
                                                    />
                                                </div>

                                                <div className="col-span-3">
                                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                                        Required Qty
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={item.quantity}
                                                        onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                                                        placeholder="Qty"
                                                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white"
                                                    />
                                                </div>

                                                <div className="col-span-2">
                                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                                        Unit
                                                    </label>
                                                    <div className="px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 text-center">
                                                        {item.unit || 'PCS'}
                                                    </div>
                                                </div>

                                                <div className="col-span-1 text-right pt-4">
                                                    {newRfq.items.length > 1 && (
                                                        <button onClick={() => handleRemoveItem(idx)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-colors">
                                                            <X size={18} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                                    Item Description / Specifications (Auto-filled)
                                                </label>
                                                <input
                                                    type="text"
                                                    value={item.description || ''}
                                                    onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                                                    placeholder="Item description or technical specs..."
                                                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-cyan-500"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Select Target Vendors */}
                            <div className="space-y-3">
                                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                                    <h3 className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                        Select Vendors to Send RFQ To ({newRfq.vendorIds.length} Selected)
                                    </h3>
                                    <div className="flex items-center gap-2 text-xs">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const allFilteredIds = filteredModalVendors.map((v: any) => v._id);
                                                const uniqueIds = Array.from(new Set([...newRfq.vendorIds, ...allFilteredIds]));
                                                setNewRfq(prev => ({ ...prev, vendorIds: uniqueIds }));
                                            }}
                                            className="px-2.5 py-1 bg-cyan-50 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300 font-bold rounded-lg hover:bg-cyan-100 transition-colors"
                                        >
                                            Select All Filtered
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setNewRfq(prev => ({ ...prev, vendorIds: [] }))}
                                            className="px-2.5 py-1 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 font-bold rounded-lg hover:bg-slate-200 transition-colors"
                                        >
                                            Clear Selection
                                        </button>
                                    </div>
                                </div>

                                {/* Vendor Keyword Search Input */}
                                <div className="relative">
                                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input
                                        type="text"
                                        placeholder="Search vendor by name, code, city, GST, phone..."
                                        value={vendorSearchTerm}
                                        onChange={(e) => setVendorSearchTerm(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-cyan-500/20"
                                    />
                                </div>

                                {/* Searchable Vendor List */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-52 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 custom-scrollbar">
                                    {filteredModalVendors.length === 0 ? (
                                        <div className="col-span-full p-4 text-center text-xs text-slate-400">
                                            No vendors match your search criteria.
                                        </div>
                                    ) : (
                                        filteredModalVendors.map((vendor: any) => {
                                            const isSelected = newRfq.vendorIds.includes(vendor._id);
                                            return (
                                                <div
                                                    key={vendor._id}
                                                    onClick={() => handleToggleVendor(vendor._id)}
                                                    className={`cursor-pointer p-3 rounded-xl border text-xs font-bold flex items-center justify-between transition-all ${
                                                        isSelected
                                                            ? 'bg-cyan-50 border-cyan-300 text-cyan-900 dark:bg-cyan-950/80 dark:border-cyan-700 dark:text-cyan-200 shadow-sm'
                                                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                                                    }`}
                                                >
                                                    <div className="truncate pr-2">
                                                        <div className="truncate font-extrabold">{vendor.name} {vendor.code ? `(${vendor.code})` : ''}</div>
                                                        <div className="text-[10px] text-slate-400 font-normal truncate mt-0.5">
                                                            {vendor.city || 'Supplier'} {vendor.phone ? `• ${vendor.phone}` : ''}
                                                        </div>
                                                    </div>
                                                    <input 
                                                        type="checkbox" 
                                                        checked={isSelected} 
                                                        onChange={() => {}} 
                                                        className="w-4 h-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 accent-cyan-600 shrink-0" 
                                                    />
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>

                        </div>

                        <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 flex-shrink-0">
                            <button onClick={() => { setIsCreateModalOpen(false); setEditingRfq(null); }} className="px-5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 font-semibold text-sm">
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateRfqSubmit}
                                disabled={submitting}
                                className="px-6 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-cyan-600/20 flex items-center gap-2"
                            >
                                <Send size={16} />
                                {submitting ? 'Saving...' : (editingRfq ? 'Update Outward RFQ' : 'Dispatch Outward RFQ')}
                            </button>
                        </div>

                    </div>
                </div>
            )}

            {/* View RFQ & User Audit Details Modal */}
            {selectedRfq && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-[95vw] lg:max-w-6xl xl:max-w-7xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
                        
                        <div className="p-6 bg-cyan-950 text-white flex justify-between items-center flex-shrink-0">
                            <div>
                                <h2 className="text-xl font-extrabold font-mono text-cyan-200">{selectedRfq.rfqNumber}</h2>
                                <p className="text-xs text-cyan-300/80">Outward RFQ & User Audit Details</p>
                            </div>
                            <button onClick={() => setSelectedRfq(null)} className="w-8 h-8 rounded-full bg-cyan-900 hover:bg-cyan-800 flex items-center justify-center text-white">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-5">
                            
                            {/* General Status & Interactive Control */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                                <div>
                                    <span className="text-slate-400 block mb-0.5">Quotation Due Date:</span>
                                    <strong className="text-slate-800 dark:text-slate-200 font-bold">{selectedRfq.dueDate ? new Date(selectedRfq.dueDate).toLocaleDateString('en-GB') : 'N/A'}</strong>
                                </div>

                                <div>
                                    <span className="text-slate-400 block mb-0.5">Current Status:</span>
                                    <select
                                        value={selectedRfq.status || 'Sent'}
                                        onChange={(e) => handleStatusChange(selectedRfq._id, e.target.value)}
                                        className="px-3 py-1 rounded-xl text-xs font-bold bg-cyan-50 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-700 outline-none cursor-pointer"
                                    >
                                        <option value="Draft">Draft</option>
                                        <option value="Sent">Sent</option>
                                        <option value="Quoted">Quoted</option>
                                        <option value="Closed">Closed</option>
                                    </select>
                                </div>

                                <div>
                                    <span className="text-slate-400 block mb-0.5">Created Date:</span>
                                    <strong className="text-slate-800 dark:text-slate-200 font-bold">{new Date(selectedRfq.createdAt || Date.now()).toLocaleDateString('en-GB')}</strong>
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
                                        <User size={16} className="text-cyan-600 shrink-0" />
                                        <div className="truncate">
                                            <span className="text-[10px] text-slate-400 block">Created By User</span>
                                            <strong className="text-slate-800 dark:text-slate-200 font-bold truncate block">{getUserName(selectedRfq.createdBy)}</strong>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-indigo-100 dark:border-indigo-900">
                                        <UserCheck size={16} className="text-emerald-600 shrink-0" />
                                        <div className="truncate">
                                            <span className="text-[10px] text-slate-400 block">Last Updated By User</span>
                                            <strong className="text-slate-800 dark:text-slate-200 font-bold truncate block">{getUserName(selectedRfq.updatedBy || selectedRfq.createdBy)}</strong>
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

                            {/* Assigned Vendors List Section */}
                            <div className="space-y-2">
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                    Assigned Vendors ({resolveRfqVendors(selectedRfq, vendors).length})
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-44 overflow-y-auto custom-scrollbar">
                                    {resolveRfqVendors(selectedRfq, vendors).map((vObj: any, idx: number) => (
                                        <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 flex justify-between items-center text-xs">
                                            <div className="truncate pr-2">
                                                <div className="font-extrabold text-slate-900 dark:text-white truncate">
                                                    {vObj.name || vObj.companyName || 'Supplier'} {vObj.code ? `(${vObj.code})` : ''}
                                                </div>
                                                <div className="text-[10px] text-slate-400 font-normal truncate mt-0.5">
                                                    {vObj.city || 'Vendor'} {vObj.phone ? `• Ph: ${vObj.phone}` : ''}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handlePrintVendorRfqPdf(selectedRfq, vObj)}
                                                className="px-2.5 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-lg text-[11px] flex items-center gap-1 shrink-0 transition-colors shadow-sm"
                                            >
                                                <Printer size={12} /> Print PDF
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Requested Material Items Section */}
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

                        <div className="p-4 bg-slate-50 dark:bg-slate-800 flex justify-between items-center border-t border-slate-200 dark:border-slate-700">
                            <div className="flex gap-2">
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

            {/* Select Vendor PDF Modal for Table View */}
            {printMenuRfq && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col">
                        
                        <div className="p-5 bg-cyan-950 text-white flex justify-between items-center border-b border-cyan-900">
                            <div>
                                <h3 className="text-base font-extrabold flex items-center gap-2">
                                    <Printer size={18} className="text-cyan-300" /> Select Vendor RFQ PDF
                                </h3>
                                <p className="text-xs text-cyan-300/80 mt-0.5">RFQ: <span className="font-mono font-bold text-white">{printMenuRfq.rfqNumber}</span></p>
                            </div>
                            <button onClick={() => setPrintMenuRfq(null)} className="w-7 h-7 rounded-full bg-cyan-900 hover:bg-cyan-800 flex items-center justify-center text-white">
                                <X size={16} />
                            </button>
                        </div>

                        <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar">
                            <p className="text-xs text-slate-500 font-medium">Select an assigned vendor to generate their vendor-specific RFQ PDF quote sheet:</p>
                            
                            {resolveRfqVendors(printMenuRfq, vendors).map((vObj: any, idx: number) => (
                                <div
                                    key={idx}
                                    onClick={() => {
                                        handlePrintVendorRfqPdf(printMenuRfq, vObj);
                                        setPrintMenuRfq(null);
                                    }}
                                    className="cursor-pointer p-3.5 bg-slate-50 hover:bg-cyan-50 dark:bg-slate-800 dark:hover:bg-cyan-950/60 rounded-2xl border border-slate-200 hover:border-cyan-300 transition-all flex items-center justify-between group"
                                >
                                    <div className="truncate pr-3">
                                        <div className="font-extrabold text-slate-900 dark:text-white text-xs group-hover:text-cyan-600 transition-colors">
                                            {vObj.name || vObj.companyName || 'Supplier'} {vObj.code ? `(${vObj.code})` : ''}
                                        </div>
                                        <div className="text-[10px] text-slate-400 font-normal mt-0.5">
                                            {vObj.city || 'Vendor'} {vObj.phone ? `• Ph: ${vObj.phone}` : ''} {vObj.gst ? `• GST: ${vObj.gst}` : ''}
                                        </div>
                                    </div>
                                    <span className="px-3 py-1.5 bg-cyan-600 text-white font-bold text-xs rounded-xl group-hover:bg-cyan-700 transition-colors flex items-center gap-1.5 shrink-0">
                                        <Printer size={13} /> Print
                                    </span>
                                </div>
                            ))}
                        </div>

                        <div className="p-4 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                            <button
                                onClick={() => {
                                    resolveRfqVendors(printMenuRfq, vendors).forEach((v: any) => handlePrintVendorRfqPdf(printMenuRfq, v));
                                    setPrintMenuRfq(null);
                                }}
                                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl transition-colors"
                            >
                                Print All Vendor PDFs
                            </button>
                            <button onClick={() => setPrintMenuRfq(null)} className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl">
                                Cancel
                            </button>
                        </div>

                    </div>
                </div>
            )}

        </div>
    );
}

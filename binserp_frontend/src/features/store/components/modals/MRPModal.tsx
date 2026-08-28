import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    X,
    Plus,
    Trash2,
    Layers,
    Calendar,
    User,
    FileText,
    CheckCircle2,
    Sparkles,
    Search,
    ChevronDown,
    AlertTriangle,
    Package,
    Building,
    Boxes,
    Check
} from 'lucide-react';
import { apiGet, apiPost } from '@/src/lib/api';
import Swal from 'sweetalert2';

interface MRPModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    token: string;
}

interface FGRow {
    fgItem: string;
    fgItemName: string;
    fgItemCode: string;
    description: string;
    quantity: number;
    unit: string;
    targetDate: string;
    bomId?: string;
    bomNumber?: string;
}

export default function MRPModal({ isOpen, onClose, onSuccess, token }: MRPModalProps) {
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Masters Data
    const [customerList, setCustomerList] = useState<any[]>([]);
    const [fgItemList, setFgItemList] = useState<any[]>([]);
    const [bomsList, setBomsList] = useState<any[]>([]);
    const [incomingPOs, setIncomingPOs] = useState<any[]>([]);
    const [existingMRPPlans, setExistingMRPPlans] = useState<any[]>([]);

    // Form State
    const [mrpNumber, setMrpNumber] = useState('');
    const [selectedCustomerId, setSelectedCustomerId] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [selectedPOId, setSelectedPOId] = useState('');
    const [customerPoNumber, setCustomerPoNumber] = useState('');
    const [targetDate, setTargetDate] = useState('');
    const [remarks, setRemarks] = useState('');

    // Dropdown / Combobox Search & Open States
    const [customerSearch, setCustomerSearch] = useState('');
    const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
    const customerDropdownRef = useRef<HTMLDivElement>(null);

    const [poSearch, setPoSearch] = useState('');
    const [isPoDropdownOpen, setIsPoDropdownOpen] = useState(false);
    const poDropdownRef = useRef<HTMLDivElement>(null);

    // FG Row Combobox Active State
    const [activeFGSearchIdx, setActiveFGSearchIdx] = useState<number | null>(null);
    const [fgSearchQuery, setFgSearchQuery] = useState('');
    const fgDropdownRef = useRef<HTMLDivElement>(null);

    // FG Items Table
    const [fgRows, setFgRows] = useState<FGRow[]>([
        { fgItem: '', fgItemName: '', fgItemCode: '', description: '', quantity: 1, unit: 'PCS', targetDate: '' }
    ]);

    // Close dropdowns on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target as Node)) {
                setIsCustomerDropdownOpen(false);
            }
            if (poDropdownRef.current && !poDropdownRef.current.contains(event.target as Node)) {
                setIsPoDropdownOpen(false);
            }
            if (fgDropdownRef.current && !fgDropdownRef.current.contains(event.target as Node)) {
                setActiveFGSearchIdx(null);
                setFgSearchQuery('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (isOpen) {
            const now = new Date();
            const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
            const randomSuffix = Math.floor(1000 + Math.random() * 9000);
            setMrpNumber(`MRP-${dateStr}-${randomSuffix}`);
            setSelectedCustomerId('');
            setCustomerName('');
            setCustomerSearch('');
            setSelectedPOId('');
            setCustomerPoNumber('');
            setPoSearch('');
            setRemarks('');

            // Default target date: 7 days in future
            const future = new Date();
            future.setDate(future.getDate() + 7);
            const defaultDate = future.toISOString().split('T')[0];
            setTargetDate(defaultDate);

            setFgRows([
                { fgItem: '', fgItemName: '', fgItemCode: '', description: '', quantity: 1, unit: 'PCS', targetDate: defaultDate }
            ]);

            loadDropdownMasters();
        }
    }, [isOpen]);

    const loadDropdownMasters = async () => {
        setLoading(true);
        try {
            const [custRes, fgRes, bomRes, poRes, mrpRes] = await Promise.allSettled([
                apiGet('/api/store/customer', token),
                apiGet('/api/store/fg-item', token),
                apiGet('/api/store/bom', token),
                apiGet('/api/sales/incoming-po', token),
                apiGet('/api/purchase/mrp/plans', token)
            ]);

            if (custRes.status === 'fulfilled' && custRes.value) {
                setCustomerList(Array.isArray(custRes.value) ? custRes.value : (custRes.value.customers || custRes.value.data || []));
            }
            if (fgRes.status === 'fulfilled' && fgRes.value) {
                setFgItemList(Array.isArray(fgRes.value) ? fgRes.value : (fgRes.value.fgItems || fgRes.value.data || []));
            }
            if (bomRes.status === 'fulfilled' && bomRes.value) {
                setBomsList(Array.isArray(bomRes.value) ? bomRes.value : (bomRes.value.boms || bomRes.value.data || []));
            }
            if (poRes.status === 'fulfilled' && poRes.value) {
                const pos = Array.isArray(poRes.value)
                    ? poRes.value
                    : (poRes.value.pos || poRes.value.incomingPOs || poRes.value.data || []);
                setIncomingPOs(pos);
            }
            if (mrpRes.status === 'fulfilled' && mrpRes.value) {
                setExistingMRPPlans(Array.isArray(mrpRes.value) ? mrpRes.value : (mrpRes.value.mrpPlans || mrpRes.value.data || []));
            }
        } catch (err) {
            console.error('Failed to load masters for MRP modal:', err);
        } finally {
            setLoading(false);
        }
    };

    // Filtered Customers based on keyword search
    const filteredCustomers = useMemo(() => {
        if (!customerSearch.trim()) return customerList;
        const q = customerSearch.toLowerCase().trim();
        return customerList.filter((c: any) =>
            (c.name && c.name.toLowerCase().includes(q)) ||
            (c.companyName && c.companyName.toLowerCase().includes(q)) ||
            (c.code && c.code.toLowerCase().includes(q)) ||
            (c.city && c.city.toLowerCase().includes(q))
        );
    }, [customerList, customerSearch]);

    // Open Customer POs list (filtered by selected customer if any, and by search query)
    const availablePOs = useMemo(() => {
        let pos = (incomingPOs || []).filter(
            (p: any) => p && p.status !== 'Cancelled' && p.status !== 'Completed'
        );

        // If a customer is selected, narrow down to that customer
        if (selectedCustomerId) {
            pos = pos.filter((p: any) => {
                const cId = p.customer?._id || (typeof p.customer === 'string' ? p.customer : p.customer?.id);
                const pCustName = (p.customerName || p.customer?.name || '').toLowerCase().trim();
                const matchedName = customerName && pCustName && pCustName === customerName.toLowerCase().trim();
                return (cId && String(cId) === String(selectedCustomerId)) || matchedName;
            });
        } else if (customerName.trim()) {
            const cleanCName = customerName.toLowerCase().trim();
            pos = pos.filter((p: any) => {
                const pCustName = (p.customerName || p.customer?.name || '').toLowerCase().trim();
                return pCustName.includes(cleanCName);
            });
        }

        if (poSearch.trim()) {
            const q = poSearch.toLowerCase().trim();
            // Don't filter out if poSearch is just the selected PO's number
            if (selectedPOId && (q === `po #${customerPoNumber}`.toLowerCase() || q === customerPoNumber.toLowerCase())) {
                return pos;
            }
            pos = pos.filter((p: any) =>
                (p.poNumber && p.poNumber.toLowerCase().includes(q)) ||
                (p.customerName && p.customerName.toLowerCase().includes(q)) ||
                (p.customer?.name && p.customer.name.toLowerCase().includes(q))
            );
        }

        return pos;
    }, [incomingPOs, selectedCustomerId, customerName, poSearch, selectedPOId, customerPoNumber]);

    // Check if the currently selected PO has an existing MRP plan
    const duplicateMrpPlan = useMemo(() => {
        if (!selectedPOId && !customerPoNumber) return null;
        return (existingMRPPlans || []).find((p: any) =>
            (selectedPOId && String(p.customerPo) === String(selectedPOId)) ||
            (customerPoNumber && p.customerPoNumber && p.customerPoNumber.toLowerCase() === customerPoNumber.toLowerCase())
        );
    }, [existingMRPPlans, selectedPOId, customerPoNumber]);

    // Handle Customer Selection
    const handleSelectCustomer = (customer: any) => {
        if (!customer) {
            setSelectedCustomerId('');
            setCustomerName('');
            setCustomerSearch('');
            setIsCustomerDropdownOpen(false);
            return;
        }

        const custId = customer._id || customer.id || '';
        const name = customer.name || customer.companyName || '';
        setSelectedCustomerId(custId);
        setCustomerName(name);
        setCustomerSearch(name);
        setIsCustomerDropdownOpen(false);

        // If currently selected PO does not belong to this customer, reset PO
        if (selectedPOId) {
            const currentPO = incomingPOs.find((p) => (p._id || p.id) === selectedPOId);
            const poCustId = currentPO?.customer?._id || (typeof currentPO?.customer === 'string' ? currentPO?.customer : currentPO?.customer?.id);
            const poCustName = (currentPO?.customerName || currentPO?.customer?.name || '').toLowerCase().trim();
            if (String(poCustId) !== String(custId) && (!name || poCustName !== name.toLowerCase().trim())) {
                setSelectedPOId('');
                setCustomerPoNumber('');
                setPoSearch('');
            }
        }
    };

    // Handle Customer PO Selection
    const handleSelectCustomerPO = (po: any) => {
        if (!po) {
            setSelectedPOId('');
            setCustomerPoNumber('');
            setPoSearch('');
            setIsPoDropdownOpen(false);
            return;
        }

        setSelectedPOId(po._id);
        setCustomerPoNumber(po.poNumber || '');
        setPoSearch(`PO #${po.poNumber}`);
        setIsPoDropdownOpen(false);

        // Auto-fill customer if not already selected
        const cName = po.customerName || (typeof po.customer === 'object' ? po.customer?.name : '') || '';
        const cId = typeof po.customer === 'object' ? po.customer?._id : po.customer;
        if (cName && !customerName) {
            setCustomerName(cName);
            setCustomerSearch(cName);
        }
        if (cId && !selectedCustomerId) {
            setSelectedCustomerId(cId);
        }

        // Auto-fill target date
        if (po.deliveryDate || po.targetDate || po.date) {
            const dateVal = new Date(po.deliveryDate || po.targetDate || po.date).toISOString().split('T')[0];
            setTargetDate(dateVal);
        }

        // Auto-populate FG items from PO
        if (Array.isArray(po.items) && po.items.length > 0) {
            const mappedRows: FGRow[] = po.items.map((item: any) => {
                const pName = item.productName || item.name || item.itemName || '';
                const pCode = item.productCode || item.code || '';
                const fgObj = fgItemList.find(
                    (f) =>
                        f._id === item.fgItem ||
                        f._id === (item.fgItem?._id || item.fgItem) ||
                        (pName && f.name?.toLowerCase() === pName.toLowerCase()) ||
                        (pCode && f.code?.toLowerCase() === pCode.toLowerCase())
                );
                const matchedBom = bomsList.find(
                    (b) =>
                        (fgObj &&
                            (b.productName?.toLowerCase() === fgObj.name?.toLowerCase() ||
                                b.productCode === fgObj.code)) ||
                        (pName && b.productName?.toLowerCase() === pName.toLowerCase()) ||
                        (pCode && b.productCode === pCode)
                );

                const qty = (item.quantity || 1) - (item.dispatchedQuantity || item.billedQuantity || 0);

                return {
                    fgItem: fgObj?._id || (typeof item.fgItem === 'object' ? item.fgItem?._id : item.fgItem) || '',
                    fgItemName: fgObj?.name || pName || 'Finished Good',
                    fgItemCode: fgObj?.code || pCode || '',
                    description: item.description || fgObj?.description || fgObj?.descriptions || '',
                    quantity: qty > 0 ? qty : Number(item.quantity) || 1,
                    unit: item.unit || fgObj?.unit || 'PCS',
                    targetDate:
                        targetDate || (po.deliveryDate ? new Date(po.deliveryDate).toISOString().split('T')[0] : ''),
                    bomId: matchedBom?._id,
                    bomNumber: matchedBom?.bomNumber || (fgObj?.bom?.length > 0 ? `BOM-${fgObj.code || fgObj.name}` : undefined)
                };
            });

            setFgRows(mappedRows);
        }
    };

    // Filtered FG Items for table row search
    const filteredFGItems = useMemo(() => {
        if (!fgSearchQuery.trim()) return fgItemList;
        const q = fgSearchQuery.toLowerCase().trim();
        return fgItemList.filter(
            (f: any) =>
                (f.name && f.name.toLowerCase().includes(q)) ||
                (f.code && f.code.toLowerCase().includes(q)) ||
                (f.description && f.description.toLowerCase().includes(q))
        );
    }, [fgItemList, fgSearchQuery]);

    // Handle Manual FG Selection in Table Row
    const handleSelectFGForRow = (index: number, selected: any) => {
        if (!selected) return;

        const matchedBom = bomsList.find(
            (b) =>
                (selected &&
                    (b.productName?.toLowerCase() === selected.name?.toLowerCase() ||
                        b.productCode === selected.code))
        );
        const hasEmbeddedBom = selected && Array.isArray(selected.bom) && selected.bom.length > 0;
        const bomNum = matchedBom?.bomNumber || (hasEmbeddedBom ? `BOM-${selected.code || selected.name}` : undefined);
        const bomId = matchedBom?._id || (hasEmbeddedBom ? selected._id : undefined);

        const updated = [...fgRows];
        updated[index] = {
            ...updated[index],
            fgItem: selected._id,
            fgItemName: selected.name || '',
            fgItemCode: selected.code || '',
            description: selected.description || selected.descriptions || updated[index].description || '',
            unit: selected.unit || 'PCS',
            bomId: bomId,
            bomNumber: bomNum
        };
        setFgRows(updated);
        setActiveFGSearchIdx(null);
        setFgSearchQuery('');
    };

    const handleAddRow = () => {
        setFgRows([
            ...fgRows,
            {
                fgItem: '',
                fgItemName: '',
                fgItemCode: '',
                description: '',
                quantity: 1,
                unit: 'PCS',
                targetDate: targetDate || ''
            }
        ]);
    };

    const handleRemoveRow = (index: number) => {
        if (fgRows.length <= 1) {
            setFgRows([
                {
                    fgItem: '',
                    fgItemName: '',
                    fgItemCode: '',
                    description: '',
                    quantity: 1,
                    unit: 'PCS',
                    targetDate: targetDate || ''
                }
            ]);
            return;
        }
        setFgRows(fgRows.filter((_, i) => i !== index));
    };

    const handleRowChange = (index: number, field: keyof FGRow, val: any) => {
        const updated = [...fgRows];
        updated[index] = {
            ...updated[index],
            [field]: val
        };
        setFgRows(updated);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const validItems = fgRows.filter((r) => r.fgItemName || r.fgItem);
        if (validItems.length === 0) {
            Swal.fire({
                icon: 'warning',
                title: 'No Finished Goods Selected',
                text: 'Please select or add at least one Finished Goods (FG) item.'
            });
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                mrpNumber,
                customerPo: selectedPOId || undefined,
                customerPoNumber: customerPoNumber || undefined,
                customerName: customerName || 'Internal Production',
                targetDate,
                remarks,
                fgItems: validItems
            };

            const res = await apiPost('/api/purchase/mrp/plan', payload, token);

            Swal.fire({
                icon: 'success',
                title: 'MRP Demand Plan Created!',
                text: `MRP #${mrpNumber} generated with unified RM/BO BOM explosion and PO status updated to 'MRP Done'.`,
                timer: 3000
            });

            onSuccess();
            onClose();
        } catch (err: any) {
            console.error('Error creating MRP plan:', err);
            Swal.fire({
                icon: 'error',
                title: 'MRP Calculation Error',
                text: err.message || 'Failed to generate MRP demand plan'
            });
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-5 lg:p-6 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-6xl xl:max-w-7xl max-h-[94vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                {/* Modal Header */}
                <div className="p-5 sm:p-6 bg-gradient-to-r from-indigo-700 via-indigo-800 to-slate-900 text-white flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
                            <Layers className="text-indigo-200" size={22} />
                        </div>
                        <div>
                            <h2 className="text-lg sm:text-xl font-black">Create MRP Demand Plan</h2>
                            <p className="text-xs text-indigo-200 mt-0.5">
                                Select Customer / Open PO or enter manual FG requirements to explode nested BOM
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors flex items-center justify-center cursor-pointer"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5">
                    {/* Top Bar: Customer Search & Open PO Quick Selector */}
                    <div className="bg-gradient-to-r from-indigo-50/90 to-blue-50/70 dark:from-indigo-950/40 dark:to-slate-900 p-4 rounded-2xl border border-indigo-200/80 dark:border-indigo-800 space-y-3">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold shadow-xs">
                                    <Sparkles size={14} />
                                </div>
                                <div>
                                    <h3 className="text-xs font-black text-indigo-950 dark:text-indigo-200 uppercase tracking-wide">
                                        Customer & Open Purchase Order Linkage (Optional)
                                    </h3>
                                    <p className="text-[11px] text-indigo-700/80 dark:text-indigo-300/80">
                                        Search customer to filter open POs, or pick an open PO to auto-populate finished goods.
                                    </p>
                                </div>
                            </div>
                            {(selectedCustomerId || selectedPOId || customerName) && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedCustomerId('');
                                        setCustomerName('');
                                        setCustomerSearch('');
                                        setSelectedPOId('');
                                        setCustomerPoNumber('');
                                        setPoSearch('');
                                    }}
                                    className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
                                >
                                    <X size={12} /> Clear Customer & PO Link
                                </button>
                            )}
                        </div>

                        {/* Customer Search & PO Select Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* 1. Keyword-Searchable Customer Master Dropdown */}
                            <div className="relative" ref={customerDropdownRef}>
                                <label className="text-[11px] font-bold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider block mb-1">
                                    1. Search Customer (Optional)
                                </label>
                                <div className="relative">
                                    <Building className="absolute left-3 top-2.5 text-indigo-500" size={15} />
                                    <input
                                        type="text"
                                        placeholder="Type customer name, code or city..."
                                        value={customerSearch}
                                        onFocus={() => setIsCustomerDropdownOpen(true)}
                                        onChange={(e) => {
                                            setCustomerSearch(e.target.value);
                                            setCustomerName(e.target.value);
                                            setIsCustomerDropdownOpen(true);
                                        }}
                                        className="w-full pl-9 pr-8 py-2 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 shadow-2xs"
                                    />
                                    {customerSearch && (
                                        <button
                                            type="button"
                                            onClick={() => handleSelectCustomer(null)}
                                            className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                                        >
                                            <X size={14} />
                                        </button>
                                    )}
                                </div>

                                {/* Customer Dropdown Results */}
                                {isCustomerDropdownOpen && (
                                    <div className="absolute left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 p-1 space-y-0.5">
                                        <button
                                            type="button"
                                            onClick={() => handleSelectCustomer(null)}
                                            className="w-full text-left px-3 py-2 rounded-xl text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold"
                                        >
                                            -- Internal Production / No Customer Link --
                                        </button>
                                        {filteredCustomers.length === 0 ? (
                                            <div className="p-3 text-center text-xs text-slate-400">
                                                No customer found. Custom name &quot;{customerSearch}&quot; will be used.
                                            </div>
                                        ) : (
                                            filteredCustomers.map((cust: any) => {
                                                const isSelected = selectedCustomerId === cust._id;
                                                return (
                                                    <button
                                                        key={cust._id}
                                                        type="button"
                                                        onClick={() => handleSelectCustomer(cust)}
                                                        className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-colors flex items-center justify-between cursor-pointer ${
                                                            isSelected
                                                                ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold'
                                                                : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                                                        }`}
                                                    >
                                                        <div>
                                                            <span className="font-bold block">{cust.name || cust.companyName}</span>
                                                            <span className="text-[10px] text-slate-400 font-mono">
                                                                {cust.code || ''} {cust.city ? `• ${cust.city}` : ''}
                                                            </span>
                                                        </div>
                                                        {isSelected && <Check size={14} className="text-indigo-600" />}
                                                    </button>
                                                );
                                            })
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* 2. Keyword-Searchable Open Customer PO Dropdown */}
                            <div className="relative" ref={poDropdownRef}>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-[11px] font-bold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider">
                                        2. Select Open Customer PO (Optional)
                                    </label>
                                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-indigo-200/80 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200">
                                        {availablePOs.length} Open POs
                                    </span>
                                </div>
                                <div className="relative">
                                    <FileText className="absolute left-3 top-2.5 text-indigo-500" size={15} />
                                    <input
                                        type="text"
                                        placeholder="Search open PO # or customer..."
                                        value={poSearch}
                                        onFocus={() => setIsPoDropdownOpen(true)}
                                        onChange={(e) => {
                                            setPoSearch(e.target.value);
                                            setIsPoDropdownOpen(true);
                                        }}
                                        className="w-full pl-9 pr-8 py-2 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 shadow-2xs"
                                    />
                                    {selectedPOId && (
                                        <button
                                            type="button"
                                            onClick={() => handleSelectCustomerPO(null)}
                                            className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                                        >
                                            <X size={14} />
                                        </button>
                                    )}
                                </div>

                                {/* Open PO Dropdown List */}
                                {isPoDropdownOpen && (
                                    <div className="absolute left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 p-1 space-y-0.5">
                                        <button
                                            type="button"
                                            onClick={() => handleSelectCustomerPO(null)}
                                            className="w-full text-left px-3 py-2 rounded-xl text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold"
                                        >
                                            -- Direct Manual Entry (No PO Linked) --
                                        </button>
                                        {availablePOs.length === 0 ? (
                                            <div className="p-3 text-center text-xs text-slate-400">
                                                No open purchase orders found{selectedCustomerId ? ' for selected customer' : ''}.
                                            </div>
                                        ) : (
                                            availablePOs.map((po: any) => {
                                                const isSelected = selectedPOId === po._id;
                                                const hasMrp = existingMRPPlans.some(
                                                    (m) =>
                                                        String(m.customerPo) === String(po._id) ||
                                                        (po.poNumber && m.customerPoNumber === po.poNumber)
                                                );

                                                return (
                                                    <button
                                                        key={po._id}
                                                        type="button"
                                                        onClick={() => handleSelectCustomerPO(po)}
                                                        className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-colors flex items-center justify-between cursor-pointer ${
                                                            isSelected
                                                                ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold'
                                                                : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                                                        }`}
                                                    >
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-mono font-bold">PO #{po.poNumber}</span>
                                                                {hasMrp && (
                                                                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                                                        MRP Exists
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <span className="text-[10px] text-slate-500 block">
                                                                {po.customerName || po.customer?.name || 'Customer'} •{' '}
                                                                {po.items?.length || 0} items
                                                            </span>
                                                        </div>
                                                        {isSelected && <Check size={14} className="text-indigo-600" />}
                                                    </button>
                                                );
                                            })
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Duplicate MRP Alert Warning */}
                        {duplicateMrpPlan && (
                            <div className="p-3 bg-amber-100/90 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 rounded-xl flex items-start gap-2.5 text-amber-900 dark:text-amber-200 text-xs animate-in fade-in">
                                <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                                <div>
                                    <span className="font-bold block">
                                        Notice: MRP Demand Plan ({duplicateMrpPlan.mrpNumber}) has already been created for this PO #{customerPoNumber}.
                                    </span>
                                    <span className="text-[11px] text-amber-800 dark:text-amber-300">
                                        You may still proceed if you are issuing a split or supplementary demand batch for this order.
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Metadata Header Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800">
                        {/* Auto-generated MRP Number */}
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                MRP Demand #
                            </label>
                            <div className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono font-black text-indigo-600 dark:text-indigo-400 shadow-2xs">
                                {mrpNumber}
                            </div>
                        </div>

                        {/* Customer Name Display / Override */}
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                Customer Name
                            </label>
                            <input
                                type="text"
                                placeholder="Internal Production"
                                value={customerName}
                                onChange={(e) => {
                                    setCustomerName(e.target.value);
                                    setCustomerSearch(e.target.value);
                                }}
                                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                            />
                        </div>

                        {/* Target Due Date */}
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                Target Due Date
                            </label>
                            <input
                                type="date"
                                value={targetDate}
                                onChange={(e) => {
                                    setTargetDate(e.target.value);
                                    setFgRows((prev) =>
                                        prev.map((r) => ({ ...r, targetDate: r.targetDate || e.target.value }))
                                    );
                                }}
                                required
                                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                            />
                        </div>

                        {/* Purpose / Remarks */}
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                Purpose / Remarks
                            </label>
                            <input
                                type="text"
                                placeholder="e.g. Batch #1 Production"
                                value={remarks}
                                onChange={(e) => setRemarks(e.target.value)}
                                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                            />
                        </div>
                    </div>

                    {/* Finished Goods Items Table Section */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center flex-wrap gap-2">
                            <div>
                                <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                                    <Boxes className="text-indigo-600" size={18} />
                                    Finished Goods (FG) Items Entry
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Search and select FG items from master. Multi-level BOM hierarchy will be exploded automatically.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={handleAddRow}
                                className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:hover:bg-indigo-900 dark:text-indigo-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                            >
                                <Plus size={15} /> Add FG Row
                            </button>
                        </div>

                        {/* Table */}
                        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-visible shadow-xs bg-white dark:bg-slate-900">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-slate-100 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-300 uppercase border-b border-slate-200 dark:border-slate-700">
                                    <tr>
                                        <th className="px-3 py-3 w-10 text-center">#</th>
                                        <th className="px-3 py-3 min-w-[240px]">Finished Goods (FG) Item (Searchable)</th>
                                        <th className="px-3 py-3 min-w-[160px]">Description</th>
                                        <th className="px-3 py-3 w-28 text-center">Qty</th>
                                        <th className="px-3 py-3 w-20 text-center">Unit</th>
                                        <th className="px-3 py-3 min-w-[130px]">Target Date</th>
                                        <th className="px-3 py-3 w-12 text-right"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                    {fgRows.map((row, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                                            <td className="px-3 py-3 text-slate-400 font-bold text-center">{idx + 1}</td>

                                            {/* Keyword-Searchable FG Combobox */}
                                            <td className="px-3 py-3 relative">
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        placeholder="Type to search FG Item..."
                                                        value={
                                                            activeFGSearchIdx === idx
                                                                ? fgSearchQuery
                                                                : row.fgItemName
                                                                ? `${row.fgItemName} ${row.fgItemCode ? `(${row.fgItemCode})` : ''}`
                                                                : ''
                                                        }
                                                        onFocus={() => {
                                                            setActiveFGSearchIdx(idx);
                                                            setFgSearchQuery(row.fgItemName || '');
                                                        }}
                                                        onChange={(e) => {
                                                            setFgSearchQuery(e.target.value);
                                                            handleRowChange(idx, 'fgItemName', e.target.value);
                                                        }}
                                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-2xs"
                                                    />
                                                    <ChevronDown
                                                        size={14}
                                                        className="absolute right-2.5 top-2.5 text-slate-400 pointer-events-none"
                                                    />
                                                </div>

                                                {row.bomNumber && (
                                                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-1">
                                                        <CheckCircle2 size={11} /> BOM Linked: {row.bomNumber}
                                                    </span>
                                                )}

                                                {/* Search Results Dropdown */}
                                                {activeFGSearchIdx === idx && (
                                                    <div
                                                        ref={fgDropdownRef}
                                                        className="absolute left-3 right-3 mt-1 max-h-52 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 p-1 space-y-0.5"
                                                    >
                                                        {filteredFGItems.length === 0 ? (
                                                            <div className="p-3 text-center text-xs text-slate-400">
                                                                No FG master found for &quot;{fgSearchQuery}&quot;.
                                                            </div>
                                                        ) : (
                                                            filteredFGItems.map((fg: any) => {
                                                                const matchedBom = bomsList.find(
                                                                    (b) =>
                                                                        b.productName?.toLowerCase() ===
                                                                            fg.name?.toLowerCase() ||
                                                                        b.productCode === fg.code
                                                                );
                                                                const hasBom =
                                                                    matchedBom ||
                                                                    (Array.isArray(fg.bom) && fg.bom.length > 0);

                                                                return (
                                                                    <button
                                                                        key={fg._id}
                                                                        type="button"
                                                                        onClick={() => handleSelectFGForRow(idx, fg)}
                                                                        className="w-full text-left px-3 py-2 rounded-xl text-xs hover:bg-indigo-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-between cursor-pointer"
                                                                    >
                                                                        <div>
                                                                            <span className="font-bold text-slate-900 dark:text-white block">
                                                                                {fg.name}
                                                                            </span>
                                                                            <span className="text-[10px] text-slate-400 font-mono">
                                                                                Code: {fg.code || 'N/A'} • Unit: {fg.unit || 'PCS'}
                                                                            </span>
                                                                        </div>
                                                                        <span
                                                                            className={`text-[9px] font-bold px-2 py-0.5 rounded-md uppercase ${
                                                                                hasBom
                                                                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                                                                    : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                                                                            }`}
                                                                        >
                                                                            {hasBom ? 'BOM Attached' : 'No BOM'}
                                                                        </span>
                                                                    </button>
                                                                );
                                                            })
                                                        )}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Description */}
                                            <td className="px-3 py-3">
                                                <input
                                                    type="text"
                                                    placeholder="Specs / notes..."
                                                    value={row.description}
                                                    onChange={(e) => handleRowChange(idx, 'description', e.target.value)}
                                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                />
                                            </td>

                                            {/* Quantity */}
                                            <td className="px-3 py-3 text-center">
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={row.quantity}
                                                    onChange={(e) =>
                                                        handleRowChange(idx, 'quantity', Math.max(1, Number(e.target.value)))
                                                    }
                                                    required
                                                    className="w-full px-2 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-center font-bold text-indigo-600 dark:text-indigo-400 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                />
                                            </td>

                                            {/* Unit */}
                                            <td className="px-3 py-3 text-center text-slate-600 dark:text-slate-400 font-bold">
                                                {row.unit || 'PCS'}
                                            </td>

                                            {/* Row Target Date */}
                                            <td className="px-3 py-3">
                                                <input
                                                    type="date"
                                                    value={row.targetDate}
                                                    onChange={(e) => handleRowChange(idx, 'targetDate', e.target.value)}
                                                    className="w-full px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                />
                                            </td>

                                            {/* Delete Row */}
                                            <td className="px-3 py-3 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveRow(idx)}
                                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition-colors cursor-pointer"
                                                    title="Remove Row"
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Bottom Submit Footer */}
                    <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center flex-wrap gap-3">
                        <div className="text-xs text-slate-500 flex items-center gap-3">
                            <span className="font-bold text-slate-700 dark:text-slate-300">
                                {fgRows.length} FG Item{fgRows.length !== 1 ? 's' : ''}
                            </span>
                            <span>•</span>
                            <span>
                                Total Required Qty:{' '}
                                <strong className="text-indigo-600 dark:text-indigo-400 font-mono">
                                    {fgRows.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0)}
                                </strong>
                            </span>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>

                            <button
                                type="submit"
                                disabled={submitting}
                                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-bold text-xs shadow-md shadow-indigo-200 dark:shadow-none transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                            >
                                <Sparkles size={16} />
                                {submitting ? 'Exploding BOM & Calculating Requirements...' : 'Calculate & Generate MRP Breakdown'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}

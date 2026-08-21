import React, { useState, useEffect, useMemo } from 'react';
import { X, Plus, Trash2, Calendar, User, Package, Layers, Info, Check, Truck, ArrowRight, ShieldCheck, Factory, FileText, FileSpreadsheet, RotateCcw } from 'lucide-react';
import { Vendor, RmBoItem, JobWorkFormData, JobWorkSupplier, JobWorkReturningItem } from "@/src/features/store/types/store.types";
import { apiPost, apiPut } from '@/src/lib/api';
import { generateDocument } from '@/src/utils/documentHelper';
import SearchableSelect from '../SearchableSelect';

interface JobWorkFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    onError: (msg: string) => void;
    vendors?: Vendor[];
    jobWorkSuppliers?: JobWorkSupplier[];
    materials?: RmBoItem[]; // BO Items
    inHouseItems?: any[]; // In-House Items
    initialData?: Partial<JobWorkFormData> & { _id?: string }; // Pre-fill data
    isModal?: boolean;
    token: string | null;
    companyInfo?: any;
}

export default function JobWorkForm({
    isOpen,
    onClose,
    onSuccess,
    onError,
    vendors = [],
    jobWorkSuppliers = [],
    materials = [],
    inHouseItems = [],
    initialData,
    isModal = true,
    token,
    companyInfo
}: JobWorkFormProps) {
    const [loading, setLoading] = useState(false);
    const [successData, setSuccessData] = useState<any>(null);

    const [formData, setFormData] = useState<JobWorkFormData>({
        challanNumber: '',
        vendor: '',
        date: new Date().toISOString().split('T')[0],
        expectedReturnDate: '',
        poNumber: '',
        vehicleNo: '',
        freightType: 'To pay',
        ewayBillNo: '',
        estimatedWeight: 0,
        estimatedPrice: 0,
        items: [
            {
                item: '',
                itemName: '',
                itemType: 'bo',
                quantitySent: 1,
                unit: 'PCS',
                processType: 'Machining',
                unitPrice: 0,
                description: '',
                returningItems: [
                    {
                        receivedItem: '',
                        receivedItemName: '',
                        receivedItemType: 'fg',
                        quantityToBeReceived: 1,
                        receivingUnit: 'PCS'
                    }
                ]
            }
        ]
    });

    // Populate suppliers combining jobWorkSuppliers and regular vendors
    const supplierOptions = useMemo(() => {
        const combined = [...jobWorkSuppliers, ...vendors];
        const uniqueMap = new Map();
        combined.forEach(s => {
            if (s && s._id && !uniqueMap.has(s._id)) {
                uniqueMap.set(s._id, {
                    value: s._id,
                    label: s.name ? `${s.name} ${s.city ? `(${s.city})` : ''}` : 'Unknown Vendor'
                });
            }
        });
        return Array.from(uniqueMap.values());
    }, [vendors, jobWorkSuppliers]);

    // Item options for BO (RM/BO)
    const boOptions = useMemo(() => {
        return (materials || []).map(m => ({
            value: m._id,
            label: m.name ? `${m.name} ${m.code ? `[${m.code}]` : ''}` : 'Material'
        }));
    }, [materials]);

    // Item options for In-House / FG
    const fgOptions = useMemo(() => {
        return (inHouseItems || []).map(i => ({
            value: i._id,
            label: i.name || i.componentName || 'In-House Component'
        }));
    }, [inHouseItems]);

    // Pre-fill form
    useEffect(() => {
        if (isOpen && initialData) {
            const { _id, items, ...rest } = initialData;
            setFormData(prev => ({
                ...prev,
                ...rest,
                ewayBillNo: (initialData as any).ewayBillNo || prev.ewayBillNo || '',
                items: (items || []).map((it: any) => {
                    let retItems: JobWorkReturningItem[] = [];

                    if (Array.isArray(it.returningItems) && it.returningItems.length > 0) {
                        retItems = it.returningItems.map((r: any) => ({
                            receivedItem: r.receivedItem || '',
                            receivedItemName: r.receivedItemName || r.itemName || '',
                            receivedItemType: r.receivedItemType || 'fg',
                            quantityToBeReceived: Number(r.quantityToBeReceived) || 1,
                            receivingUnit: r.receivingUnit || 'PCS'
                        }));
                    } else {
                        // Fallback from legacy single returning item
                        retItems = [{
                            receivedItem: it.receivedItem || '',
                            receivedItemName: it.receivedItemName || it.itemToBeReceived || it.itemName || '',
                            receivedItemType: it.receivedItemType || 'fg',
                            quantityToBeReceived: Number(it.quantityToBeReceived) || Number(it.quantitySent) || 1,
                            receivingUnit: it.receivingUnit || it.unit || 'PCS'
                        }];
                    }

                    return {
                        item: it.item || '',
                        itemName: it.itemName || '',
                        itemType: it.itemType || 'bo',
                        quantitySent: Number(it.quantitySent) || 1,
                        unit: it.unit || 'PCS',
                        processType: it.processType || 'Job Work',
                        unitPrice: Number(it.unitPrice) || 0,
                        description: it.description || '',
                        returningItems: retItems
                    };
                })
            }));
            setSuccessData(null);
        } else if (isOpen && !initialData) {
            setSuccessData(null);
            setFormData({
                challanNumber: '',
                vendor: '',
                date: new Date().toISOString().split('T')[0],
                expectedReturnDate: '',
                poNumber: '',
                vehicleNo: '',
                freightType: 'To pay',
                ewayBillNo: '',
                estimatedWeight: 0,
                estimatedPrice: 0,
                items: [
                    {
                        item: '',
                        itemName: '',
                        itemType: 'bo',
                        quantitySent: 1,
                        unit: 'PCS',
                        processType: 'Machining',
                        unitPrice: 0,
                        description: '',
                        returningItems: [
                            {
                                receivedItem: '',
                                receivedItemName: '',
                                receivedItemType: 'fg',
                                quantityToBeReceived: 1,
                                receivingUnit: 'PCS'
                            }
                        ]
                    }
                ]
            });
        }
    }, [isOpen, initialData]);

    // Handle Sent Item Field Changes
    const handleSentItemChange = (itemIdx: number, field: string, value: any) => {
        const newItems = [...formData.items];
        const current = { ...newItems[itemIdx], [field]: value };

        if (field === 'item') {
            const selectedId = value;
            const type = current.itemType;
            if (type === 'bo') {
                const found = (materials || []).find(m => m._id === selectedId);
                if (found) {
                    current.itemName = found.name;
                    current.unit = (found as any).categoryId?.unit || (found as any).category?.unit || 'PCS';
                }
            } else if (type === 'inhouse' || type === 'fg') {
                const found = (inHouseItems || []).find(i => i._id === selectedId);
                if (found) {
                    current.itemName = found.name || found.componentName;
                    current.unit = found.unit || 'PCS';
                }
            }

            // Auto-sync first returning item name if blank
            if (current.returningItems && current.returningItems.length > 0 && !current.returningItems[0].receivedItemName) {
                current.returningItems[0].receivedItemName = current.itemName || '';
            }
        }

        if (field === 'itemName') {
            if (current.returningItems && current.returningItems.length > 0 && !current.returningItems[0].receivedItemName) {
                current.returningItems[0].receivedItemName = value || '';
            }
        }

        newItems[itemIdx] = current;
        setFormData({ ...formData, items: newItems });
    };

    // Handle Returning Item Sub-Row Field Changes
    const handleReturningItemChange = (itemIdx: number, retIdx: number, field: string, value: any) => {
        const newItems = [...formData.items];
        const currentSent = { ...newItems[itemIdx] };
        const newRetList = [...currentSent.returningItems];
        const currentRet = { ...newRetList[retIdx], [field]: value };

        if (field === 'receivedItem') {
            const selectedId = value;
            const type = currentRet.receivedItemType;
            if (type === 'bo') {
                const found = (materials || []).find(m => m._id === selectedId);
                if (found) {
                    currentRet.receivedItemName = found.name;
                    currentRet.receivingUnit = (found as any).categoryId?.unit || (found as any).category?.unit || 'PCS';
                }
            } else if (type === 'inhouse' || type === 'fg') {
                const found = (inHouseItems || []).find(i => i._id === selectedId);
                if (found) {
                    currentRet.receivedItemName = found.name || found.componentName;
                    currentRet.receivingUnit = found.unit || 'PCS';
                }
            }
        }

        newRetList[retIdx] = currentRet;
        currentSent.returningItems = newRetList;
        newItems[itemIdx] = currentSent;
        setFormData({ ...formData, items: newItems });
    };

    // Add Returning Material Sub-row inside a Sent Item
    const addReturningItemRow = (itemIdx: number) => {
        const newItems = [...formData.items];
        const currentSent = { ...newItems[itemIdx] };
        currentSent.returningItems = [
            ...currentSent.returningItems,
            {
                receivedItem: '',
                receivedItemName: currentSent.itemName || '',
                receivedItemType: 'fg',
                quantityToBeReceived: 1,
                receivingUnit: 'PCS'
            }
        ];
        newItems[itemIdx] = currentSent;
        setFormData({ ...formData, items: newItems });
    };

    // Remove Returning Material Sub-row
    const removeReturningItemRow = (itemIdx: number, retIdx: number) => {
        const newItems = [...formData.items];
        const currentSent = { ...newItems[itemIdx] };
        if (currentSent.returningItems.length <= 1) return;
        currentSent.returningItems = currentSent.returningItems.filter((_, r) => r !== retIdx);
        newItems[itemIdx] = currentSent;
        setFormData({ ...formData, items: newItems });
    };

    // Add New Sent Item Row
    const addSentItemRow = () => {
        setFormData(prev => ({
            ...prev,
            items: [
                ...prev.items,
                {
                    item: '',
                    itemName: '',
                    itemType: 'bo',
                    quantitySent: 1,
                    unit: 'PCS',
                    processType: 'Machining',
                    unitPrice: 0,
                    description: '',
                    returningItems: [
                        {
                            receivedItem: '',
                            receivedItemName: '',
                            receivedItemType: 'fg',
                            quantityToBeReceived: 1,
                            receivingUnit: 'PCS'
                        }
                    ]
                }
            ]
        }));
    };

    // Remove Sent Item Row
    const removeSentItemRow = (index: number) => {
        if (formData.items.length <= 1) return;
        setFormData(prev => ({
            ...prev,
            items: prev.items.filter((_, i) => i !== index)
        }));
    };

    // Calculate Totals Summary
    const summary = useMemo(() => {
        let totalSentQty = 0;
        let totalReturnQty = 0;
        let totalValue = 0;

        formData.items.forEach(it => {
            const sent = Number(it.quantitySent) || 0;
            const price = Number(it.unitPrice) || 0;
            totalSentQty += sent;
            totalValue += sent * price;

            (it.returningItems || []).forEach(r => {
                totalReturnQty += Number(r.quantityToBeReceived) || 0;
            });
        });

        return {
            totalSentItems: formData.items.length,
            totalSentQty,
            totalReturnQty,
            totalValue
        };
    }, [formData.items]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        if (!token) {
            onError("Authentication token missing");
            setLoading(false);
            return;
        }

        try {
            if (!formData.vendor) {
                onError('Please select a Supplier / Vendor');
                setLoading(false);
                return;
            }

            const cleanedItems = [];

            for (let i = 0; i < formData.items.length; i++) {
                const item = formData.items[i];

                // Derive item name if dropdown selected ID
                let resolvedSentName = item.itemName || '';
                if (!resolvedSentName && item.item) {
                    if (item.itemType === 'bo') {
                        const found = (materials || []).find(m => m._id === item.item);
                        if (found) resolvedSentName = found.name;
                    } else if (item.itemType === 'fg' || item.itemType === 'inhouse') {
                        const found = (inHouseItems || []).find(f => f._id === item.item);
                        if (found) resolvedSentName = found.name || found.componentName;
                    }
                }

                if (!resolvedSentName) {
                    resolvedSentName = `Sent Item #${i + 1}`;
                }

                const cleanedReturning = [];
                for (let r = 0; r < item.returningItems.length; r++) {
                    const ret = item.returningItems[r];
                    let resolvedRetName = ret.receivedItemName || '';
                    if (!resolvedRetName && ret.receivedItem) {
                        if (ret.receivedItemType === 'bo') {
                            const found = (materials || []).find(m => m._id === ret.receivedItem);
                            if (found) resolvedRetName = found.name;
                        } else if (ret.receivedItemType === 'fg' || ret.receivedItemType === 'inhouse') {
                            const found = (inHouseItems || []).find(f => f._id === ret.receivedItem);
                            if (found) resolvedRetName = found.name || found.componentName;
                        }
                    }

                    if (!resolvedRetName) {
                        resolvedRetName = resolvedSentName; // Fallback to sent item name!
                    }

                    cleanedReturning.push({
                        receivedItem: (ret.receivedItem && ret.receivedItem.trim() !== '') ? ret.receivedItem : undefined,
                        receivedItemName: resolvedRetName,
                        receivedItemType: ret.receivedItemType || 'fg',
                        quantityToBeReceived: Number(ret.quantityToBeReceived) || Number(item.quantitySent) || 1,
                        receivingUnit: ret.receivingUnit || item.unit || 'PCS'
                    });
                }

                cleanedItems.push({
                    item: (item.item && item.item.trim() !== '') ? item.item : undefined,
                    itemName: resolvedSentName,
                    itemType: item.itemType || 'bo',
                    quantitySent: Number(item.quantitySent) || 1,
                    unit: item.unit || 'PCS',
                    processType: item.processType || 'Job Work',
                    unitPrice: Number(item.unitPrice) || 0,
                    description: item.description || '',
                    returningItems: cleanedReturning
                });
            }

            const payload = {
                ...formData,
                items: cleanedItems
            };

            if (initialData && initialData._id) {
                await apiPut(`/api/store/jobwork/update/${initialData._id}`, payload, token);
                onSuccess();
            } else {
                const response = await apiPost('/api/store/jobwork/create', payload, token);
                setSuccessData(response.jobWork);
            }
        } catch (error: any) {
            onError(error.message || "Failed to save Job Work Challan");
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadPDF = async () => {
        try {
            await generateDocument('pdf', 'returnable_dc', { doc: successData, companyInfo, vendors: [...jobWorkSuppliers, ...vendors] });
        } catch (error) {
            onError('Failed to generate PDF');
        }
    };

    const handleDownloadExcel = async () => {
        try {
            await generateDocument('excel', 'Returnable DC', [{ doc: successData, companyInfo }]);
        } catch (error) {
            onError('Failed to generate Excel');
        }
    };

    if (!isOpen) return null;

    // Success Screen
    if (successData) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
                <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-xl p-8 border border-slate-200 dark:border-slate-800 text-center relative overflow-hidden">
                    <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-6 border border-indigo-200 dark:border-indigo-800 shadow-sm">
                        <Check className="w-10 h-10 stroke-[3px]" />
                    </div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">
                        Challan Created Successfully!
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 max-w-md mx-auto">
                        Job Work Delivery Challan <strong className="text-indigo-600 dark:text-indigo-400">{successData.challanNumber}</strong> is generated with 3-copy PDF print ready.
                    </p>

                    <div className="grid grid-cols-2 gap-4 mb-8 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                        <div className="text-left">
                            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Vendor</span>
                            <p className="font-bold text-slate-800 dark:text-slate-200 truncate">{successData.vendor?.name || 'Supplier'}</p>
                        </div>
                        <div className="text-left">
                            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">E-Way Bill</span>
                            <p className="font-bold text-slate-800 dark:text-slate-200 font-mono">{successData.ewayBillNo || 'N/A'}</p>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <button
                            onClick={handleDownloadPDF}
                            className="flex-1 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2"
                        >
                            <FileText size={18} />
                            Download 3-Copy PDF
                        </button>
                        <button
                            onClick={handleDownloadExcel}
                            className="px-5 py-3 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
                        >
                            <FileSpreadsheet size={18} />
                            Excel
                        </button>
                    </div>

                    <button
                        onClick={onClose}
                        className="mt-6 text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-semibold"
                    >
                        Close & Return to List
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-md overflow-y-auto">
            {/* Wider Modal Window (max-w-6xl / xl:max-w-7xl) with Single Cohesive Indigo/Slate Theme */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-6xl xl:max-w-7xl my-auto overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
                
                {/* Header (Single Cohesive Indigo Theme) */}
                <div className="px-7 py-5 bg-indigo-950 text-white flex justify-between items-center flex-shrink-0 border-b border-indigo-900">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 bg-indigo-900/80 rounded-2xl flex items-center justify-center border border-indigo-700/60">
                            <Factory className="text-indigo-300 w-6 h-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2.5">
                                <h2 className="text-xl font-extrabold tracking-tight">
                                    {initialData ? "Edit Job-Work Challan" : "Create Job-Work Challan"}
                                </h2>
                                <span className="bg-indigo-900 text-indigo-200 border border-indigo-700 text-[10px] uppercase font-extrabold px-2.5 py-0.5 rounded-full">
                                    Returnable DC
                                </span>
                            </div>
                            <p className="text-xs text-indigo-300/80 mt-0.5">
                                Outward dispatch for subcontractor processing & return item mapping
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="w-9 h-9 rounded-full bg-indigo-900 hover:bg-indigo-800 transition-all flex items-center justify-center text-white border border-indigo-700"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 sm:p-7 space-y-6">
                    
                    {/* Workflow Type Selector */}
                    <div className="bg-indigo-50/70 dark:bg-indigo-950/40 p-4 rounded-2xl border border-indigo-200/80 dark:border-indigo-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div>
                            <span className="text-xs font-black uppercase tracking-wider text-indigo-900 dark:text-indigo-200 block">
                                Job-Work Workflow Type
                            </span>
                            <p className="text-[11px] text-indigo-700/80 dark:text-indigo-300/80 mt-0.5">
                                Select purpose of subcontracting dispatch: Store Inventory RM/BO Conversion vs PPC Route-Card Operation
                            </p>
                        </div>

                        <div className="flex bg-white dark:bg-slate-900 p-1 rounded-xl border border-indigo-200 dark:border-indigo-800">
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, jobWorkType: 'inventory-conversion' })}
                                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    (formData.jobWorkType || 'inventory-conversion') === 'inventory-conversion'
                                        ? 'bg-indigo-600 text-white shadow-sm'
                                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                }`}
                            >
                                Store RM/BO Conversion
                            </button>
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, jobWorkType: 'route-card' })}
                                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    formData.jobWorkType === 'route-card'
                                        ? 'bg-indigo-600 text-white shadow-sm'
                                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                }`}
                            >
                                PPC Route-Card Operation
                            </button>
                        </div>
                    </div>

                    {/* Section 1: Supplier & Dispatch Info */}
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/70 space-y-4">

                        <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                            <User size={14} />
                            1. Supplier & Dispatch Information
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {/* Vendor Selection */}
                            <div className="lg:col-span-2">
                                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                    Job-Work Supplier / Vendor <span className="text-red-500">*</span>
                                </label>
                                <SearchableSelect
                                    options={supplierOptions}
                                    value={formData.vendor}
                                    onChange={(val: any) => setFormData({ ...formData, vendor: val })}
                                    placeholder="Search or Select Supplier..."
                                />
                            </div>

                            {/* Challan Date */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                    Challan Date <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    value={formData.date ? new Date(formData.date).toISOString().split('T')[0] : ''}
                                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                    className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                    required
                                />
                            </div>

                            {/* Expected Due Date */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                    Expected Due Return Date
                                </label>
                                <input
                                    type="date"
                                    value={formData.expectedReturnDate ? new Date(formData.expectedReturnDate).toISOString().split('T')[0] : ''}
                                    onChange={(e) => setFormData({ ...formData, expectedReturnDate: e.target.value })}
                                    className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                />
                            </div>
                        </div>

                        {/* Row 2: Logistics */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 pt-1">
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                                    Our PO Number
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. PO-2026-092"
                                    value={formData.poNumber || ''}
                                    onChange={(e) => setFormData({ ...formData, poNumber: e.target.value })}
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                                    Vehicle No.
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. KA-05-EV-1234"
                                    value={formData.vehicleNo || ''}
                                    onChange={(e) => setFormData({ ...formData, vehicleNo: e.target.value })}
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                />
                            </div>

                            {/* E-Way Bill Number */}
                            <div>
                                <label className="block text-xs font-bold text-indigo-700 dark:text-indigo-300 mb-1">
                                    E-Way Bill Number
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. 3410 9821 4092"
                                    value={formData.ewayBillNo || ''}
                                    onChange={(e) => setFormData({ ...formData, ewayBillNo: e.target.value })}
                                    className="w-full px-3 py-2 bg-indigo-50/50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl text-sm font-semibold text-indigo-900 dark:text-indigo-200 focus:ring-2 focus:ring-indigo-500/30 outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                                    Freight Terms
                                </label>
                                <select
                                    value={formData.freightType || 'To pay'}
                                    onChange={(e) => setFormData({ ...formData, freightType: e.target.value as any })}
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                >
                                    <option value="To pay">To Pay</option>
                                    <option value="Paid">Paid</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                                    Est. Weight (Kgs)
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    placeholder="e.g. 150"
                                    value={formData.estimatedWeight || ''}
                                    onChange={(e) => setFormData({ ...formData, estimatedWeight: Number(e.target.value) })}
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Items List */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                                <Package size={14} />
                                2. Materials Sent & Expected Returning Items List
                            </div>

                            <button
                                type="button"
                                onClick={addSentItemRow}
                                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 rounded-xl text-xs font-bold border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 transition-colors"
                            >
                                <Plus size={14} /> Add Sent Material Line
                            </button>
                        </div>

                        {/* Sent Items Cards */}
                        <div className="space-y-5">
                            {formData.items.map((sentItem, itemIdx) => (
                                <div
                                    key={itemIdx}
                                    className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4"
                                >
                                    {/* Sent Item Top Header */}
                                    <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
                                        <div className="flex items-center gap-2">
                                            <span className="w-6 h-6 rounded-full bg-slate-800 text-white text-xs font-black flex items-center justify-center">
                                                {itemIdx + 1}
                                            </span>
                                            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                                                Sent Material Entry
                                            </h4>
                                        </div>

                                        {formData.items.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeSentItemRow(itemIdx)}
                                                className="text-red-500 hover:text-red-700 p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-xs font-semibold flex items-center gap-1 transition-colors"
                                            >
                                                <Trash2 size={15} /> Remove Line
                                            </button>
                                        )}
                                    </div>

                                    {/* Sent Item Row Inputs */}
                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-slate-50/70 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
                                        
                                        {/* Type Tabs */}
                                        <div className="md:col-span-3">
                                            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                                                Material Type
                                            </label>
                                            <div className="flex bg-white dark:bg-slate-900 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold">
                                                <button
                                                    type="button"
                                                    onClick={() => handleSentItemChange(itemIdx, 'itemType', 'bo')}
                                                    className={`flex-1 py-1 rounded-md transition-all ${sentItem.itemType === 'bo' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-500 hover:text-slate-800'}`}
                                                >
                                                    RM / BO
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleSentItemChange(itemIdx, 'itemType', 'fg')}
                                                    className={`flex-1 py-1 rounded-md transition-all ${sentItem.itemType === 'fg' || sentItem.itemType === 'inhouse' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-500 hover:text-slate-800'}`}
                                                >
                                                    FG
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleSentItemChange(itemIdx, 'itemType', 'custom')}
                                                    className={`flex-1 py-1 rounded-md transition-all ${sentItem.itemType === 'custom' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-500 hover:text-slate-800'}`}
                                                >
                                                    Custom
                                                </button>
                                            </div>
                                        </div>

                                        {/* Item Name / Selection */}
                                        <div className="md:col-span-4">
                                            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                                                Sent Item Name <span className="text-red-500">*</span>
                                            </label>
                                            {sentItem.itemType === 'custom' ? (
                                                <input
                                                    type="text"
                                                    placeholder="Enter custom material name sent..."
                                                    value={sentItem.itemName || ''}
                                                    onChange={(e) => handleSentItemChange(itemIdx, 'itemName', e.target.value)}
                                                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                                />
                                            ) : (
                                                <SearchableSelect
                                                    options={sentItem.itemType === 'bo' ? boOptions : fgOptions}
                                                    value={sentItem.item || ''}
                                                    onChange={(val: any) => handleSentItemChange(itemIdx, 'item', val)}
                                                    placeholder={sentItem.itemType === 'bo' ? "Select Raw Material / BO Item..." : "Select FG / In-House Item..."}
                                                />
                                            )}
                                        </div>

                                        {/* Quantity Sent & Unit */}
                                        <div className="md:col-span-3 grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                                                    Qty Sent <span className="text-red-500">*</span>
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0.01"
                                                    step="any"
                                                    value={sentItem.quantitySent || ''}
                                                    onChange={(e) => handleSentItemChange(itemIdx, 'quantitySent', e.target.value)}
                                                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                                                    Unit
                                                </label>
                                                <select
                                                    value={sentItem.unit || 'PCS'}
                                                    onChange={(e) => handleSentItemChange(itemIdx, 'unit', e.target.value)}
                                                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                                >
                                                    <option value="PCS">PCS</option>
                                                    <option value="NOS">NOS</option>
                                                    <option value="KG">KG</option>
                                                    <option value="MTR">MTR</option>
                                                    <option value="SET">SET</option>
                                                    <option value="BOX">BOX</option>
                                                </select>
                                            </div>
                                        </div>

                                        {/* Process Type */}
                                        <div className="md:col-span-2">
                                            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                                                Process <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="e.g. Machining, Plating"
                                                value={sentItem.processType || ''}
                                                onChange={(e) => handleSentItemChange(itemIdx, 'processType', e.target.value)}
                                                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                                required
                                            />
                                        </div>
                                    </div>

                                    {/* Rate & Remarks */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                                                Job Rate per Unit (₹)
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                placeholder="0.00"
                                                value={sentItem.unitPrice || ''}
                                                onChange={(e) => handleSentItemChange(itemIdx, 'unitPrice', e.target.value)}
                                                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                                                Item Specification / Remarks
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="Optional remarks..."
                                                value={sentItem.description || ''}
                                                onChange={(e) => handleSentItemChange(itemIdx, 'description', e.target.value)}
                                                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                            />
                                        </div>
                                    </div>

                                    {/* NESTED LIST: Multiple Expected Returning Materials for this single sent item */}
                                    <div className="mt-4 bg-slate-50/90 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                                        <div className="flex justify-between items-center border-b border-slate-200/60 dark:border-slate-700 pb-2">
                                            <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                                                <RotateCcw size={14} /> Expected Returning Materials (Multiple Return Items Allowed)
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => addReturningItemRow(itemIdx)}
                                                className="text-xs font-bold text-indigo-600 dark:text-indigo-300 hover:underline flex items-center gap-1"
                                            >
                                                <Plus size={13} /> Add Returning Material
                                            </button>
                                        </div>

                                        <div className="space-y-3">
                                            {sentItem.returningItems.map((retItem, retIdx) => (
                                                <div
                                                    key={retIdx}
                                                    className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700"
                                                >
                                                    {/* Returning Material Type */}
                                                    <div className="sm:col-span-3">
                                                        <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                                                            Returning Type
                                                        </label>
                                                        <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-xs font-semibold">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleReturningItemChange(itemIdx, retIdx, 'receivedItemType', 'fg')}
                                                                className={`flex-1 py-0.5 rounded transition-all ${retItem.receivedItemType === 'fg' || retItem.receivedItemType === 'inhouse' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-500'}`}
                                                            >
                                                                FG
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleReturningItemChange(itemIdx, retIdx, 'receivedItemType', 'bo')}
                                                                className={`flex-1 py-0.5 rounded transition-all ${retItem.receivedItemType === 'bo' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-500'}`}
                                                            >
                                                                RM/BO
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleReturningItemChange(itemIdx, retIdx, 'receivedItemType', 'custom')}
                                                                className={`flex-1 py-0.5 rounded transition-all ${retItem.receivedItemType === 'custom' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-500'}`}
                                                            >
                                                                Custom
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Returning Item Dropdown or Text */}
                                                    <div className="sm:col-span-5">
                                                        <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                                                            Returning Item Name <span className="text-red-500">*</span>
                                                        </label>
                                                        {retItem.receivedItemType === 'custom' ? (
                                                            <input
                                                                type="text"
                                                                placeholder="Enter returning material name..."
                                                                value={retItem.receivedItemName || ''}
                                                                onChange={(e) => handleReturningItemChange(itemIdx, retIdx, 'receivedItemName', e.target.value)}
                                                                className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                                            />
                                                        ) : (
                                                            <SearchableSelect
                                                                options={retItem.receivedItemType === 'bo' ? boOptions : fgOptions}
                                                                value={retItem.receivedItem || ''}
                                                                onChange={(val: any) => handleReturningItemChange(itemIdx, retIdx, 'receivedItem', val)}
                                                                placeholder={retItem.receivedItemType === 'bo' ? "Select BO Returning Material..." : "Select FG Returning Item..."}
                                                            />
                                                        )}
                                                    </div>

                                                    {/* Expected Return Qty & Unit */}
                                                    <div className="sm:col-span-3 grid grid-cols-2 gap-2">
                                                        <div>
                                                            <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                                                                Exp. Return Qty
                                                            </label>
                                                            <input
                                                                type="number"
                                                                min="0.01"
                                                                step="any"
                                                                value={retItem.quantityToBeReceived || ''}
                                                                onChange={(e) => handleReturningItemChange(itemIdx, retIdx, 'quantityToBeReceived', e.target.value)}
                                                                className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-indigo-700 dark:text-indigo-300 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                                                                Unit
                                                            </label>
                                                            <select
                                                                value={retItem.receivingUnit || 'PCS'}
                                                                onChange={(e) => handleReturningItemChange(itemIdx, retIdx, 'receivingUnit', e.target.value)}
                                                                className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none"
                                                            >
                                                                <option value="PCS">PCS</option>
                                                                <option value="NOS">NOS</option>
                                                                <option value="KG">KG</option>
                                                                <option value="MTR">MTR</option>
                                                                <option value="SET">SET</option>
                                                                <option value="BOX">BOX</option>
                                                            </select>
                                                        </div>
                                                    </div>

                                                    {/* Remove Button */}
                                                    <div className="sm:col-span-1 flex justify-end pt-3 sm:pt-0">
                                                        {sentItem.returningItems.length > 1 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => removeReturningItemRow(itemIdx, retIdx)}
                                                                className="text-red-400 hover:text-red-600 p-1"
                                                                title="Remove Returning Material"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </form>

                {/* Footer Action Bar */}
                <div className="px-7 py-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4 flex-shrink-0">
                    {/* Live Summary Bar */}
                    <div className="flex items-center gap-3 text-xs">
                        <div className="bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                            <span className="text-slate-400">Total Sent Lines: </span>
                            <strong className="text-slate-800 dark:text-slate-200 font-extrabold">{summary.totalSentItems} ({summary.totalSentQty} units)</strong>
                        </div>
                        <div className="bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                            <span className="text-slate-400">Total Expected Return Qty: </span>
                            <strong className="text-indigo-600 dark:text-indigo-400 font-extrabold">{summary.totalReturnQty}</strong>
                        </div>
                        {summary.totalValue > 0 && (
                            <div className="bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hidden md:block">
                                <span className="text-slate-400">Est. Total Job Value: </span>
                                <strong className="text-slate-900 dark:text-slate-100 font-extrabold">₹{summary.totalValue.toLocaleString()}</strong>
                            </div>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 font-semibold text-sm hover:bg-slate-100 transition-all"
                        >
                            Cancel
                        </button>

                        <button
                            type="submit"
                            onClick={handleSubmit}
                            disabled={loading}
                            className="px-7 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-indigo-600/20 disabled:opacity-50 flex items-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <ShieldCheck size={18} />
                                    {initialData ? "Update Challan" : "Generate Job Work Challan"}
                                </>
                            )}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}

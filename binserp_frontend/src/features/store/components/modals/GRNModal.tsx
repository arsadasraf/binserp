import React, { useState, useEffect, useRef } from 'react';
import { 
    X, 
    Upload, 
    Plus, 
    Trash2, 
    FileText, 
    Layers, 
    CheckCircle2, 
    AlertCircle, 
    Camera, 
    Image, 
    Sparkles, 
    ShoppingCart,
    ShieldAlert,
    ShieldCheck,
    Paperclip
} from 'lucide-react';
import { GRNModalProps } from "@/src/features/store/types/store.types";
import SearchableSelect from '../SearchableSelect';
import { apiGet } from '@/src/lib/api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface MaterialEntry {
    material: string;
    materialName?: string;
    quantity: number;
    unit?: string;
    category?: string;
    locationId?: string;
    rate?: number;
}

export default function GRNModal({
    isOpen,
    onClose,
    onSubmit,
    materials = [],
    vendors = [],
    locations = [],
    categories = [],
    customers = [],
    loading = false,
    initialData,
    isEditing = false,
    type = 'rm'
}: GRNModalProps) {
    const safeMaterials = Array.isArray(materials) ? materials : [];
    const safeVendors = Array.isArray(vendors) ? vendors : [];
    const safeCustomers = Array.isArray(customers) ? customers : [];

    // Form states
    const [grnNumber, setGrnNumber] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [supplier, setSupplier] = useState('');
    const [customer, setCustomer] = useState('');
    const [poReference, setPoReference] = useState('');
    const [selectedPO, setSelectedPO] = useState('');
    const [vendorActivePOs, setVendorActivePOs] = useState<any[]>([]);
    const [loadingPOs, setLoadingPOs] = useState(false);
    const [poLinkedNotice, setPoLinkedNotice] = useState<string | null>(null);

    // MRP Plan state for InHouse / FG
    const [mrpPlan, setMrpPlan] = useState('');
    const [mrpNumber, setMrpNumber] = useState('');
    const [mrpPlansList, setMrpPlansList] = useState<any[]>([]);

    // QC & Media
    const [qcRequired, setQcRequired] = useState(false);
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [photoFiles, setPhotoFiles] = useState<File[]>([]);
    const [existingPhotos, setExistingPhotos] = useState<string[]>([]);
    const [materialEntries, setMaterialEntries] = useState<MaterialEntry[]>([{
        material: '',
        materialName: '',
        quantity: 0,
        unit: '',
        category: '',
        locationId: '',
        rate: 0,
    }]);

    // Refs for file inputs
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const galleryInputRef = useRef<HTMLInputElement>(null);
    const docCameraInputRef = useRef<HTMLInputElement>(null);
    const docFileInputRef = useRef<HTMLInputElement>(null);

    const [prefixSettings, setPrefixSettings] = useState<{ 
        rmBoGrnPrefix?: string; 
        fgGrnPrefix?: string; 
        grnPrefix?: string; 
        consumablePrefix?: string 
    } | null>(null);

    // Fetch custom prefix settings
    useEffect(() => {
        const fetchPrefixes = async () => {
            try {
                const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
                if (!token) return;
                const data = await apiGet('/api/store/prefix', token).catch(() => null);
                if (data && data.settings) {
                    setPrefixSettings(data.settings);
                }
            } catch (e) {
                console.error("Failed to fetch prefix settings:", e);
            }
        };
        fetchPrefixes();
    }, []);

    // Generate prefix-based GRN Number
    const generateGRNNumber = (grnType: string, customPrefix?: string) => {
        const now = new Date();
        const year = now.getFullYear().toString().slice(-2);
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');

        let prefix = customPrefix;
        if (!prefix) {
            switch (grnType) {
                case 'inhouse':
                case 'fg':
                    prefix = 'GRN-FG';
                    break;
                case 'bo':
                    prefix = 'GRN-BO';
                    break;
                case 'consumable':
                    prefix = 'GRN-CON';
                    break;
                case 'rm':
                default:
                    prefix = 'GRN-RM';
                    break;
            }
        }
        return `${prefix}/${year}${month}${day}-${hours}${minutes}${seconds}`;
    };

    // Initialize form when modal opens
    useEffect(() => {
        if (isOpen) {
            let activePrefix = prefixSettings?.rmBoGrnPrefix || prefixSettings?.grnPrefix || 'GRN-RM';
            if (type === 'inhouse' || type === 'fg') {
                activePrefix = prefixSettings?.fgGrnPrefix || 'GRN-FG';
            } else if (type === 'bo') {
                activePrefix = prefixSettings?.rmBoGrnPrefix || prefixSettings?.grnPrefix || 'GRN-BO';
            } else if (type === 'consumable') {
                activePrefix = (prefixSettings as any)?.consumablePrefix || 'GRN-CON';
            }

            if (isEditing && initialData) {
                setGrnNumber(initialData.grnNumber || '');
                setDate(initialData.date ? new Date(initialData.date).toISOString().split('T')[0] : '');
                setSupplier(typeof (initialData as any).supplier === 'object' && (initialData as any).supplier !== null ? ((initialData as any).supplier as any)._id : ((initialData as any).supplier || ''));
                setCustomer((initialData as any).customerId || (initialData as any).customer || '');
                setPoReference((initialData as any).poReference || (initialData as any).poNumber || '');
                setSelectedPO((initialData as any).purchaseOrder || '');
                setExistingPhotos((initialData as any).photos || []);
                setQcRequired((initialData as any).qcRequired || false);

                if (Array.isArray(initialData.items) && initialData.items.length > 0) {
                    const entries = initialData.items.map((item: any) => ({
                        material: item.material?._id || item.material || item.component?._id || item.component || '',
                        materialName: item.materialName || item.material?.name || item.component?.name || '',
                        quantity: item.quantity || 0,
                        unit: item.unit || '',
                        category: item.category || '',
                        locationId: item.locationId?._id || item.locationId || item.location?._id || item.location || '',
                        rate: item.rate || 0,
                    }));
                    setMaterialEntries(entries);
                }
            } else {
                setGrnNumber(generateGRNNumber(type, activePrefix));
                setDate(new Date().toISOString().split('T')[0]);
                setSupplier('');
                setCustomer('');
                setPoReference('');
                setSelectedPO('');
                setPoLinkedNotice(null);
                setQcRequired(false);
                setPdfFile(null);
                setPhotoFiles([]);
                setExistingPhotos([]);
                setMaterialEntries([{
                    material: '',
                    materialName: '',
                    quantity: 0,
                    unit: '',
                    category: '',
                    locationId: '',
                    rate: 0,
                }]);
            }
        }
    }, [isOpen, isEditing, initialData, type, prefixSettings]);

    // Fetch active Outward POs released from Purchase tab when supplier changes (RM, BO, Consumables)
    useEffect(() => {
        const supplierId = typeof supplier === 'object' ? (supplier as any)?._id : supplier;
        if (supplierId && type !== 'inhouse' && type !== 'fg') {
            setLoadingPOs(true);
            const fetchPOs = async () => {
                try {
                    const token = localStorage.getItem('token');
                    const res = await fetch(`${API_BASE_URL}/api/purchase/po/active-by-vendor/${supplierId}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (res.ok) {
                        const json = await res.json();
                        setVendorActivePOs(json.data || []);
                    } else {
                        setVendorActivePOs([]);
                    }
                } catch (e) {
                    console.error("Failed to fetch active vendor POs:", e);
                    setVendorActivePOs([]);
                } finally {
                    setLoadingPOs(false);
                }
            };
            fetchPOs();
        } else {
            setVendorActivePOs([]);
            setSelectedPO('');
            setPoLinkedNotice(null);
        }
    }, [supplier, type]);

    // Fetch active MRP plans for InHouse / FG GRN
    useEffect(() => {
        if (isOpen && (type === 'inhouse' || type === 'fg')) {
            const token = localStorage.getItem('token');
            if (token) {
                apiGet('/api/purchase/mrp/plans', token)
                    .then(res => setMrpPlansList(res.mrpPlans || []))
                    .catch(err => console.error("Failed to load MRP plans for FG GRN:", err));
            }
        }
    }, [isOpen, type]);

    // Handle PO Selection and Auto-Populate Items
    const handleSelectPO = (poId: string) => {
        setSelectedPO(poId);
        if (!poId) {
            setPoReference('');
            setPoLinkedNotice(null);
            return;
        }

        const foundPO = vendorActivePOs.find(p => p._id === poId);
        if (!foundPO) return;

        setPoReference(foundPO.poNumber || '');

        if (Array.isArray(foundPO.items) && foundPO.items.length > 0) {
            const newEntries: MaterialEntry[] = foundPO.items.map((poItem: any) => {
                const materialObj = poItem.material;
                const matId = typeof materialObj === 'object' && materialObj !== null
                    ? materialObj._id 
                    : (poItem.material || poItem.item || '');

                const matName = typeof materialObj === 'object' && materialObj !== null
                    ? materialObj.name 
                    : (poItem.itemName || poItem.name || '');

                let unit = poItem.unit || '';
                if (!unit && typeof materialObj === 'object' && materialObj !== null) {
                    unit = materialObj.unit || '';
                }

                let category = poItem.category || '';
                if (!category && typeof materialObj === 'object' && materialObj !== null) {
                    category = typeof materialObj.category === 'object' ? materialObj.category?.name : materialObj.category;
                }

                let locationId = poItem.locationId || '';
                if (!locationId && typeof materialObj === 'object' && materialObj !== null) {
                    locationId = typeof materialObj.locationId === 'object' ? materialObj.locationId?._id : materialObj.locationId;
                }

                const qtyRemaining = poItem.pendingQuantity !== undefined 
                    ? Number(poItem.pendingQuantity) 
                    : Math.max(0, (Number(poItem.quantity) || 0) - (Number(poItem.receivedQuantity) || 0));

                const rate = Number(poItem.rate) || Number(poItem.unitPrice) || Number(poItem.price) || 0;

                return {
                    material: matId,
                    materialName: matName,
                    quantity: qtyRemaining > 0 ? qtyRemaining : Number(poItem.quantity) || 0,
                    unit: unit || 'PCS',
                    category: category || '',
                    locationId: locationId || '',
                    rate: rate
                };
            });

            setMaterialEntries(newEntries);
            setPoLinkedNotice(`Loaded ${newEntries.length} items from PO #${foundPO.poNumber}`);
        }
    };

    // Handle MRP Plan Selection for InHouse / FG GRN
    const handleSelectMRPPlan = (planId: string) => {
        setMrpPlan(planId);
        if (!planId) {
            setMrpNumber('');
            return;
        }

        const foundPlan = mrpPlansList.find(p => p._id === planId);
        if (!foundPlan) return;

        setMrpNumber(foundPlan.mrpNumber || '');
        if (foundPlan.customerId) {
            const cId = typeof foundPlan.customerId === 'object' ? foundPlan.customerId._id : foundPlan.customerId;
            setCustomer(cId || '');
        }

        if (Array.isArray(foundPlan.items) && foundPlan.items.length > 0) {
            const newEntries: MaterialEntry[] = foundPlan.items.map((mrpItem: any) => {
                const fgObj = mrpItem.fgItem || mrpItem.product || mrpItem.finishedGood;
                const fgId = typeof fgObj === 'object' && fgObj !== null ? fgObj._id : (fgObj || mrpItem.material || '');
                const fgName = typeof fgObj === 'object' && fgObj !== null ? fgObj.name : (mrpItem.productName || mrpItem.name || '');
                const unit = mrpItem.unit || (typeof fgObj === 'object' ? fgObj?.unit : 'PCS');
                const qty = Number(mrpItem.quantity) || Number(mrpItem.plannedQuantity) || 0;

                return {
                    material: fgId,
                    materialName: fgName,
                    quantity: qty,
                    unit: unit || 'PCS',
                    category: 'Finished Goods',
                    locationId: '',
                    rate: Number(mrpItem.rate) || 0
                };
            });
            setMaterialEntries(newEntries);
        }
    };

    // Items table handlers
    const handleAddMaterial = () => {
        setMaterialEntries(prev => [...prev, {
            material: '',
            materialName: '',
            quantity: 0,
            unit: '',
            category: '',
            locationId: '',
            rate: 0,
        }]);
    };

    const handleRemoveMaterial = (index: number) => {
        if (materialEntries.length > 1) {
            setMaterialEntries(prev => prev.filter((_, i) => i !== index));
        }
    };

    const handleMaterialChange = (index: number, field: keyof MaterialEntry, value: any) => {
        setMaterialEntries(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };

            if (field === 'material') {
                const selectedMaterial = safeMaterials.find(m => m._id === value);
                if (selectedMaterial) {
                    updated[index].materialName = selectedMaterial.name;
                    let unitVal = (selectedMaterial as any).unit || '';
                    if (!unitVal && selectedMaterial.category && typeof selectedMaterial.category === 'object') {
                        unitVal = (selectedMaterial.category as any).unit || '';
                    }
                    updated[index].unit = unitVal || 'PCS';

                    let categoryVal = '';
                    if (typeof selectedMaterial.category === 'object') {
                        categoryVal = (selectedMaterial.category as any).name || '';
                    } else if (typeof selectedMaterial.category === 'string') {
                        categoryVal = selectedMaterial.category;
                    }
                    updated[index].category = categoryVal;

                    if ((selectedMaterial as any).locationId) {
                        const locId = typeof (selectedMaterial as any).locationId === 'object' 
                            ? ((selectedMaterial as any).locationId as any)._id 
                            : (selectedMaterial as any).locationId;
                        updated[index].locationId = locId;
                    }
                }
            }
            return updated;
        });
    };

    // Form Submission
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Validate items
        const invalidItems = materialEntries.filter(m => !m.material || m.quantity <= 0);
        if (invalidItems.length > 0) {
            alert("Please ensure all items have a selected material and a valid quantity greater than 0.");
            return;
        }

        const items = materialEntries.map(entry => ({
            material: entry.material,
            fgItem: entry.material,
            materialName: entry.materialName,
            quantity: Number(entry.quantity),
            unit: entry.unit,
            locationId: entry.locationId,
            rate: Number(entry.rate) || 0,
        }));

        const formData = new FormData();
        formData.append('grnNumber', grnNumber);
        formData.append('date', date);
        formData.append('type', type);
        formData.append('qcRequired', String(qcRequired));
        formData.append('items', JSON.stringify(items));

        if (type !== 'inhouse' && type !== 'fg') {
            const supplierId = typeof supplier === 'object' ? (supplier as any)._id : supplier;
            formData.append('supplier', supplierId);
            if (selectedPO) formData.append('purchaseOrder', selectedPO);
            if (poReference) formData.append('poReference', poReference);
            if (pdfFile) formData.append('pdf', pdfFile);
            photoFiles.forEach(photo => formData.append('photos', photo));
            if (isEditing) formData.append('existingPhotos', JSON.stringify(existingPhotos));
        } else {
            if (customer) formData.append('customer', customer);
            if (mrpPlan) formData.append('mrpPlan', mrpPlan);
            if (mrpNumber) formData.append('mrpNumber', mrpNumber);
        }

        onSubmit(formData);
    };

    // Calculate totals
    const totalItemsCount = materialEntries.filter(m => m.material).length;
    const totalQuantity = materialEntries.reduce((sum, m) => sum + (Number(m.quantity) || 0), 0);
    const totalNetValue = materialEntries.reduce((sum, m) => sum + ((Number(m.quantity) || 0) * (Number(m.rate) || 0)), 0);

    // Theming Helpers
    const theme = {
        rm: {
            title: "Raw Material (RM) GRN",
            badge: "RM",
            gradient: "from-blue-600 to-indigo-700",
            buttonBg: "bg-blue-600 hover:bg-blue-700",
            itemLabel: "Raw Material",
        },
        bo: {
            title: "Bought Out (BO) GRN",
            badge: "BO",
            gradient: "from-indigo-600 to-purple-700",
            buttonBg: "bg-indigo-600 hover:bg-indigo-700",
            itemLabel: "Bought Out Item",
        },
        consumable: {
            title: "Consumable Goods GRN",
            badge: "Consumable",
            gradient: "from-emerald-600 to-teal-700",
            buttonBg: "bg-emerald-600 hover:bg-emerald-700",
            itemLabel: "Consumable Item",
        },
        inhouse: {
            title: "In-House (FG) GRN",
            badge: "FG",
            gradient: "from-purple-600 to-pink-700",
            buttonBg: "bg-purple-600 hover:bg-purple-700",
            itemLabel: "Finished Good",
        },
        fg: {
            title: "Finished Goods (FG) GRN",
            badge: "FG",
            gradient: "from-purple-600 to-pink-700",
            buttonBg: "bg-purple-600 hover:bg-purple-700",
            itemLabel: "Finished Good",
        }
    }[type] || {
        title: "Goods Receipt Note (GRN)",
        badge: "GRN",
        gradient: "from-blue-600 to-indigo-700",
        buttonBg: "bg-blue-600 hover:bg-blue-700",
        itemLabel: "Material",
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl max-h-[94vh] flex flex-col overflow-hidden border border-gray-100">
                
                {/* Modal Header */}
                <div className={`px-4 sm:px-6 py-3 bg-gradient-to-r ${theme.gradient} text-white flex items-center justify-between shrink-0 shadow-md`}>
                    <div className="flex items-center gap-2.5">
                        <div className="p-1.5 bg-white/15 rounded-lg border border-white/20">
                            <Layers className="w-4 h-4 text-white" />
                        </div>
                        <h2 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-2">
                            {isEditing ? `Edit ${theme.title}` : `Create ${theme.title}`}
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/20 text-white border border-white/30">
                                {theme.badge}
                            </span>
                        </h2>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Compact QC Inspection Toggle */}
                        <label className="flex items-center gap-1.5 px-2.5 py-1 bg-white/15 hover:bg-white/25 border border-white/30 rounded-lg cursor-pointer transition-colors text-white text-xs font-bold">
                            <input
                                type="checkbox"
                                checked={qcRequired}
                                onChange={(e) => setQcRequired(e.target.checked)}
                                className="w-3.5 h-3.5 rounded text-amber-500 border-white/50 focus:ring-0 cursor-pointer"
                            />
                            <span className="hidden sm:inline">QC Required</span>
                            <span className="sm:hidden">QC</span>
                        </label>

                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-full text-white/80 hover:text-white hover:bg-white/20 transition-all cursor-pointer"
                            title="Close"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Modal Body */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4 bg-gray-50/60">
                    
                    {/* Basic Info & Vendor Grid */}
                    <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-gray-200/80 shadow-xs">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                            
                            {/* GRN Number */}
                            <div>
                                <label className="block text-[11px] font-bold text-gray-700 mb-1">
                                    GRN Number
                                </label>
                                <input
                                    type="text"
                                    value={grnNumber}
                                    readOnly
                                    className="w-full px-2.5 py-1.5 bg-gray-100 border border-gray-300 rounded-lg text-gray-900 font-mono text-xs font-semibold cursor-not-allowed select-all"
                                />
                            </div>

                            {/* Receipt Date */}
                            <div>
                                <label className="block text-[11px] font-bold text-gray-700 mb-1">
                                    Receipt Date <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    required
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                />
                            </div>

                            {/* Supplier for RM, BO, Consumable */}
                            {type !== 'inhouse' && type !== 'fg' && (
                                <div className="sm:col-span-2 lg:col-span-1">
                                    <label className="block text-[11px] font-bold text-gray-700 mb-1">
                                        Supplier / Vendor <span className="text-red-500">*</span>
                                    </label>
                                    <SearchableSelect
                                        options={safeVendors.map(vendor => ({
                                            value: vendor._id,
                                            label: `${vendor.name || 'Unnamed'} ${vendor.code ? `(${vendor.code})` : ''}`
                                        }))}
                                        value={typeof supplier === 'object' ? (supplier as any)._id : supplier || ''}
                                        onChange={(val: any) => {
                                            setSupplier(val);
                                            setSelectedPO('');
                                            setPoReference('');
                                            setPoLinkedNotice(null);
                                        }}
                                        placeholder="Select Vendor..."
                                    />
                                </div>
                            )}

                            {/* Customer for FG / InHouse */}
                            {(type === 'inhouse' || type === 'fg') && (
                                <div className="sm:col-span-2 lg:col-span-1">
                                    <label className="block text-[11px] font-bold text-gray-700 mb-1">
                                        Customer <span className="text-red-500">*</span>
                                    </label>
                                    <SearchableSelect
                                        options={safeCustomers.map(cust => ({
                                            value: cust._id,
                                            label: `${cust.name || 'Unnamed'} ${cust.code ? `(${cust.code})` : ''}`
                                        }))}
                                        value={typeof customer === 'object' ? (customer as any)._id : customer || ''}
                                        onChange={(val: any) => setCustomer(val)}
                                        placeholder="Select Customer..."
                                    />
                                </div>
                            )}

                            {/* Outward PO Selector (if vendor selected) */}
                            {type !== 'inhouse' && type !== 'fg' && supplier && (
                                <div className="sm:col-span-2 lg:col-span-1">
                                    <label className="block text-[11px] font-bold text-indigo-900 mb-1 flex items-center justify-between">
                                        <span>Link Outward PO</span>
                                        <span className="text-[10px] text-indigo-600 font-semibold">({vendorActivePOs.length} Open)</span>
                                    </label>
                                    <select
                                        value={selectedPO}
                                        onChange={(e) => handleSelectPO(e.target.value)}
                                        className="w-full px-2.5 py-1.5 bg-indigo-50/50 border border-indigo-300 rounded-lg text-xs font-bold text-indigo-950 focus:ring-2 focus:ring-indigo-500 cursor-pointer truncate"
                                    >
                                        <option value="">-- Direct / No PO Link --</option>
                                        {vendorActivePOs.map(po => {
                                            const poDate = po.date ? new Date(po.date).toLocaleDateString('en-GB') : '';
                                            return (
                                                <option key={po._id} value={po._id}>
                                                    PO #{po.poNumber} ({poDate}) - {po.status || 'Active'}
                                                </option>
                                            );
                                        })}
                                    </select>
                                </div>
                            )}

                            {/* Manual PO / Invoice Ref */}
                            {type !== 'inhouse' && type !== 'fg' && (
                                <div>
                                    <label className="block text-[11px] font-bold text-gray-700 mb-1">
                                        PO / Invoice Ref No.
                                    </label>
                                    <input
                                        type="text"
                                        value={poReference}
                                        onChange={(e) => setPoReference(e.target.value)}
                                        placeholder="Manual / Offline Ref"
                                        className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-800 focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                            )}

                            {/* MRP Plan for FG */}
                            {(type === 'inhouse' || type === 'fg') && mrpPlansList.length > 0 && (
                                <div className="sm:col-span-2">
                                    <label className="block text-[11px] font-bold text-purple-900 mb-1">
                                        Link MRP Demand Plan
                                    </label>
                                    <select
                                        value={mrpPlan}
                                        onChange={(e) => handleSelectMRPPlan(e.target.value)}
                                        className="w-full px-2.5 py-1.5 bg-purple-50/50 border border-purple-300 rounded-lg text-xs font-bold text-purple-950 focus:ring-2 focus:ring-purple-500 cursor-pointer"
                                    >
                                        <option value="">-- Select MRP Plan (Optional) --</option>
                                        {mrpPlansList.map(plan => (
                                            <option key={plan._id} value={plan._id}>
                                                MRP #{plan.mrpNumber} {plan.customerName ? `(${plan.customerName})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>

                        {/* PO Auto-link Notice */}
                        {poLinkedNotice && (
                            <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-800 font-semibold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                                <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span>{poLinkedNotice}</span>
                            </div>
                        )}
                    </div>

                    {/* Compact Single-Bar Attachment Toolbar */}
                    {type !== 'inhouse' && type !== 'fg' && (
                        <div className="bg-white px-3.5 py-2.5 rounded-xl border border-gray-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="font-bold text-gray-700 flex items-center gap-1 shrink-0">
                                    <Paperclip className="w-3.5 h-3.5 text-indigo-600" />
                                    Attach:
                                </span>

                                {/* Camera Button */}
                                <button
                                    type="button"
                                    onClick={() => docCameraInputRef.current?.click()}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 rounded-lg font-bold text-indigo-700 transition-colors cursor-pointer"
                                    title="Open rear camera to photograph document/invoice"
                                >
                                    <Camera className="w-3.5 h-3.5 text-indigo-600" />
                                    Camera
                                </button>

                                {/* Gallery / Photo Button */}
                                <button
                                    type="button"
                                    onClick={() => galleryInputRef.current?.click()}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-50 border border-gray-200 hover:bg-gray-100 rounded-lg font-semibold text-gray-700 transition-colors cursor-pointer"
                                >
                                    <Image className="w-3.5 h-3.5 text-gray-600" />
                                    Photos
                                </button>

                                {/* File / PDF Button */}
                                <button
                                    type="button"
                                    onClick={() => docFileInputRef.current?.click()}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-50 border border-gray-200 hover:bg-gray-100 rounded-lg font-semibold text-gray-700 transition-colors cursor-pointer"
                                >
                                    <FileText className="w-3.5 h-3.5 text-gray-600" />
                                    Invoice PDF
                                </button>

                                {/* Hidden file inputs */}
                                <input
                                    ref={docCameraInputRef}
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    className="hidden"
                                    onChange={(e) => {
                                        if (e.target.files?.[0]) {
                                            setPdfFile(e.target.files[0]);
                                        }
                                    }}
                                />
                                <input
                                    ref={docFileInputRef}
                                    type="file"
                                    accept="application/pdf,image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                        if (e.target.files?.[0]) {
                                            setPdfFile(e.target.files[0]);
                                        }
                                    }}
                                />
                                <input
                                    ref={galleryInputRef}
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    className="hidden"
                                    onChange={(e) => {
                                        if (e.target.files?.length) {
                                            setPhotoFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                                        }
                                    }}
                                />
                            </div>

                            {/* Active Attachments Badges */}
                            <div className="flex flex-wrap items-center gap-2">
                                {/* Attached PDF/Invoice Pill */}
                                {pdfFile && (
                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg font-semibold text-[11px]">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                        <span className="truncate max-w-[140px] sm:max-w-[200px]">{pdfFile.name}</span>
                                        <button
                                            type="button"
                                            onClick={() => setPdfFile(null)}
                                            className="text-emerald-700 hover:text-red-600 transition-colors ml-0.5 cursor-pointer"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                )}

                                {/* Attached Photos Count & Mini Previews */}
                                {photoFiles.length > 0 && (
                                    <div className="flex items-center gap-1.5">
                                        <div className="flex -space-x-1.5 overflow-hidden">
                                            {photoFiles.slice(0, 3).map((file, idx) => (
                                                <img
                                                    key={idx}
                                                    src={URL.createObjectURL(file)}
                                                    alt="thumb"
                                                    className="w-6 h-6 rounded-md object-cover border border-white ring-1 ring-gray-200 shadow-2xs"
                                                />
                                            ))}
                                        </div>
                                        <span className="text-[11px] font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded-md border border-gray-200">
                                            {photoFiles.length} photo{photoFiles.length > 1 ? 's' : ''}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setPhotoFiles([])}
                                            className="text-gray-400 hover:text-red-600 transition-colors p-0.5 cursor-pointer"
                                            title="Clear photos"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Items Section */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
                        {/* Section Header */}
                        <div className="px-4 py-2.5 bg-gray-50/90 border-b border-gray-200 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Layers className="w-4 h-4 text-indigo-600" />
                                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800">
                                    Item Details
                                </h3>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-100 text-indigo-800">
                                    {materialEntries.length} Item(s)
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={handleAddMaterial}
                                className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                Add Item
                            </button>
                        </div>

                        {/* Desktop View: Wide Responsive Table (hidden on mobile) */}
                        <div className="hidden md:block overflow-x-auto min-h-[260px] pb-24">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-100/75 text-gray-600 text-[11px] font-bold uppercase tracking-wider border-b border-gray-200">
                                        <th className="py-2.5 px-3 w-10 text-center">#</th>
                                        <th className="py-2.5 px-3 min-w-[320px]">{theme.itemLabel} <span className="text-red-500">*</span></th>
                                        <th className="py-2.5 px-3 w-32">Qty Received <span className="text-red-500">*</span></th>
                                        <th className="py-2.5 px-3 w-24">Unit</th>
                                        <th className="py-2.5 px-3 w-32">Rate (₹)</th>
                                        <th className="py-2.5 px-3 w-36 text-right">Total (₹)</th>
                                        <th className="py-2.5 px-3 w-12 text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-xs">
                                    {materialEntries.map((entry, index) => {
                                        const rowTotal = (Number(entry.quantity) || 0) * (Number(entry.rate) || 0);
                                        return (
                                            <tr key={index} className="hover:bg-indigo-50/30 transition-colors">
                                                <td className="py-2 px-3 text-center text-gray-400 font-bold">
                                                    {index + 1}
                                                </td>
                                                <td className="py-2 px-3">
                                                    <SearchableSelect
                                                        options={safeMaterials.map(m => ({
                                                            value: m._id,
                                                            label: `${m.name || 'Unnamed'} ${m.code ? `(${m.code})` : ''}`
                                                        }))}
                                                        value={entry.material}
                                                        onChange={(val: any) => handleMaterialChange(index, 'material', val)}
                                                        placeholder={`Search or select ${theme.itemLabel}...`}
                                                    />
                                                </td>
                                                <td className="py-2 px-3">
                                                    <input
                                                        type="number"
                                                        min="0.001"
                                                        step="any"
                                                        required
                                                        value={entry.quantity || ''}
                                                        onChange={(e) => handleMaterialChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                                                        placeholder="0"
                                                        className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-bold text-gray-900 focus:ring-2 focus:ring-indigo-500"
                                                    />
                                                </td>
                                                <td className="py-2 px-3">
                                                    <span className="inline-block px-2.5 py-1 bg-gray-100 text-gray-700 rounded-md text-[11px] font-bold border border-gray-200">
                                                        {entry.unit || 'PCS'}
                                                    </span>
                                                </td>
                                                <td className="py-2 px-3">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="any"
                                                        value={entry.rate || ''}
                                                        onChange={(e) => handleMaterialChange(index, 'rate', parseFloat(e.target.value) || 0)}
                                                        placeholder="0.00"
                                                        className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-semibold text-gray-800 focus:ring-2 focus:ring-indigo-500"
                                                    />
                                                </td>
                                                <td className="py-2 px-3 text-right font-mono font-bold text-gray-900">
                                                    ₹{rowTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                                <td className="py-2 px-3 text-center">
                                                    {materialEntries.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveMaterial(index)}
                                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                                            title="Remove Item"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile View: Touch-Friendly Compact Cards (shown on mobile only) */}
                        <div className="block md:hidden p-3 space-y-3 bg-gray-50/70">
                            {materialEntries.map((entry, index) => {
                                const rowTotal = (Number(entry.quantity) || 0) * (Number(entry.rate) || 0);
                                return (
                                    <div key={index} className="bg-white p-3 rounded-xl border border-gray-200 shadow-2xs space-y-2.5">
                                        {/* Card Header: Index & Trash */}
                                        <div className="flex items-center justify-between pb-1 border-b border-gray-100">
                                            <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                                                Item #{index + 1}
                                            </span>
                                            {materialEntries.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveMaterial(index)}
                                                    className="text-red-500 hover:text-red-700 p-1 cursor-pointer"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>

                                        {/* Material Selection */}
                                        <div>
                                            <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">
                                                {theme.itemLabel} <span className="text-red-500">*</span>
                                            </label>
                                            <SearchableSelect
                                                options={safeMaterials.map(m => ({
                                                    value: m._id,
                                                    label: `${m.name || 'Unnamed'} ${m.code ? `(${m.code})` : ''}`
                                                }))}
                                                value={entry.material}
                                                onChange={(val: any) => handleMaterialChange(index, 'material', val)}
                                                placeholder={`Select ${theme.itemLabel}...`}
                                            />
                                        </div>

                                        {/* Qty, Unit & Rate Grid */}
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">
                                                    Qty ({entry.unit || 'PCS'}) <span className="text-red-500">*</span>
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0.001"
                                                    step="any"
                                                    required
                                                    value={entry.quantity || ''}
                                                    onChange={(e) => handleMaterialChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                                                    placeholder="Qty"
                                                    className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-bold text-gray-900 focus:ring-2 focus:ring-indigo-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">
                                                    Rate (₹)
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="any"
                                                    value={entry.rate || ''}
                                                    onChange={(e) => handleMaterialChange(index, 'rate', parseFloat(e.target.value) || 0)}
                                                    placeholder="Rate"
                                                    className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-semibold text-gray-800 focus:ring-2 focus:ring-indigo-500"
                                                />
                                            </div>
                                        </div>

                                        {/* Total Amount Bar */}
                                        <div className="flex items-center justify-between pt-1 text-xs">
                                            <span className="text-gray-500 font-semibold">Row Total:</span>
                                            <span className="font-mono font-bold text-gray-900">
                                                ₹{rowTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Summary Bar */}
                        <div className="p-3 bg-gray-50 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                            <div className="flex items-center gap-4 text-gray-600 font-medium">
                                <div>Items: <span className="font-bold text-gray-900">{totalItemsCount}</span></div>
                                <div>Total Qty: <span className="font-bold text-gray-900">{totalQuantity}</span></div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-gray-500 font-semibold">Total Value:</span>
                                <span className="text-sm font-extrabold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-200">
                                    ₹{totalNetValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Modal Actions */}
                    <div className="flex items-center justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl border border-gray-300 bg-white text-gray-700 text-xs font-bold hover:bg-gray-50 transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className={`px-6 py-2 rounded-xl text-white text-xs font-bold shadow-md transition-all cursor-pointer flex items-center gap-2 ${
                                theme.buttonBg
                            } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {loading ? (
                                <>
                                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    <span>Saving...</span>
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>{isEditing ? 'Update GRN' : 'Submit GRN'}</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

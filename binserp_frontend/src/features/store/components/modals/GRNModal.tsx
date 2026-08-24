import React, { useState, useEffect, useRef, useMemo } from 'react';
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
    Paperclip,
    Download,
    Eye,
    ZoomIn,
    FileSpreadsheet,
    PackageCheck,
    RotateCcw
} from 'lucide-react';
import { GRNModalProps } from "@/src/features/store/types/store.types";
import SearchableSelect from '../SearchableSelect';
import { apiGet } from '@/src/lib/api';
import { compressImageToFile } from '@/src/utils/imageCompressor';
import { generateFrontendGrnPDF } from '@/src/utils/frontendPdfHelper';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface MaterialEntry {
    material: string;
    materialName?: string;
    description?: string;
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
    const [isMrpRequired, setIsMrpRequired] = useState(false);

    // QC & Media
    const [qcRequired, setQcRequired] = useState(false);
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [photoFiles, setPhotoFiles] = useState<File[]>([]);
    const [existingPhotos, setExistingPhotos] = useState<string[]>([]);
    const [isCompressing, setIsCompressing] = useState(false);

    // Post-submission success & preview states
    const [createdGRNData, setCreatedGRNData] = useState<any>(null);
    const [zoomPhotoUrl, setZoomPhotoUrl] = useState<string | null>(null);

    // Compulsory field validation state
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [isSubmitted, setIsSubmitted] = useState(false);

    const clearError = (fieldKey: string) => {
        setFormErrors(prev => {
            if (!prev[fieldKey]) return prev;
            const updated = { ...prev };
            delete updated[fieldKey];
            return updated;
        });
    };

    const [materialEntries, setMaterialEntries] = useState<MaterialEntry[]>([{
        material: '',
        materialName: '',
        description: '',
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

            setCreatedGRNData(null);
            setZoomPhotoUrl(null);

            if (isEditing && initialData) {
                setGrnNumber(initialData.grnNumber || '');
                setDate(initialData.date ? new Date(initialData.date).toISOString().split('T')[0] : '');
                setSupplier(typeof (initialData as any).supplier === 'object' && (initialData as any).supplier !== null ? ((initialData as any).supplier as any)._id : ((initialData as any).supplier || ''));
                setCustomer((initialData as any).customerId || (initialData as any).customer || '');
                setPoReference((initialData as any).poReference || (initialData as any).poNumber || '');
                setSelectedPO((initialData as any).purchaseOrder || '');
                setMrpPlan((initialData as any).mrpPlan || '');
                setMrpNumber((initialData as any).mrpNumber || '');
                setIsMrpRequired(!!(initialData as any).mrpPlan);
                setExistingPhotos((initialData as any).photos || []);
                setQcRequired((initialData as any).qcRequired || false);

                if (Array.isArray(initialData.items) && initialData.items.length > 0) {
                    const entries = initialData.items.map((item: any) => {
                        const mObj = item.material || item.component || item.fgItem;
                        const matId = typeof mObj === 'object' && mObj !== null ? mObj._id : (mObj || '');
                        const desc = item.description || item.descriptions || (typeof mObj === 'object' ? (mObj.descriptions || mObj.description) : '');
                        return {
                            material: matId,
                            materialName: item.materialName || (typeof mObj === 'object' ? mObj.name : '') || '',
                            description: desc || '',
                            quantity: item.quantity || 0,
                            unit: item.unit || '',
                            category: item.category || '',
                            locationId: item.locationId?._id || item.locationId || item.location?._id || item.location || '',
                            rate: item.rate || 0,
                        };
                    });
                    setMaterialEntries(entries);
                }
            } else {
                setGrnNumber(generateGRNNumber(type, activePrefix));
                setDate(new Date().toISOString().split('T')[0]);
                setSupplier('');
                setCustomer('');
                setPoReference('');
                setSelectedPO('');
                setMrpPlan('');
                setMrpNumber('');
                setIsMrpRequired(false);
                setPoLinkedNotice(null);
                setQcRequired(false);
                setPdfFile(null);
                setPhotoFiles([]);
                setExistingPhotos([]);
                setFormErrors({});
                setIsSubmitted(false);
                setMaterialEntries([{
                    material: '',
                    materialName: '',
                    description: '',
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

    // Format material options with descriptions for SearchableSelect
    const materialOptions = useMemo(() => {
        return safeMaterials.map((m: any) => {
            const desc = m.descriptions || m.description || '';
            const code = m.code ? `[${m.code}]` : '';
            return {
                value: m._id,
                label: `${m.name || 'Unnamed'} ${code} ${desc ? `— ${desc}` : ''}`.trim(),
                description: desc,
                code: m.code
            };
        });
    }, [safeMaterials]);

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

                const desc = poItem.description || poItem.descriptions || (typeof materialObj === 'object' ? (materialObj.descriptions || materialObj.description) : '');

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
                    description: desc || '',
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

    // Filter active/open MRP plans
    const openMrpPlans = useMemo(() => {
        return (mrpPlansList || []).filter((p: any) => p && p.status !== 'Completed');
    }, [mrpPlansList]);

    // Handle MRP Plan Selection for InHouse / FG GRN
    const handleSelectMRPPlan = (planId: string) => {
        setMrpPlan(planId);
        if (!planId) {
            setMrpNumber('');
            setPoLinkedNotice(null);
            return;
        }

        const foundPlan = mrpPlansList.find(p => p._id === planId);
        if (!foundPlan) return;

        setMrpNumber(foundPlan.mrpNumber || '');
        if (foundPlan.customer || foundPlan.customerId) {
            const cId = typeof foundPlan.customerId === 'object' ? foundPlan.customerId?._id : (foundPlan.customerId || foundPlan.customer);
            setCustomer(cId || '');
        }

        const fgList = foundPlan.fgItems || foundPlan.items || [];
        if (Array.isArray(fgList) && fgList.length > 0) {
            const newEntries: MaterialEntry[] = fgList.map((mrpItem: any) => {
                const fgObj = mrpItem.fgItem || mrpItem.product || mrpItem.finishedGood;
                const fgId = typeof fgObj === 'object' && fgObj !== null ? fgObj._id : (fgObj || mrpItem.material || mrpItem._id || '');
                const fgName = typeof fgObj === 'object' && fgObj !== null ? (fgObj.name || fgObj.fgItemName) : (mrpItem.fgItemName || mrpItem.productName || mrpItem.name || '');
                const desc = mrpItem.description || (typeof fgObj === 'object' ? (fgObj.descriptions || fgObj.description) : '') || '';
                const unit = mrpItem.unit || (typeof fgObj === 'object' ? fgObj?.unit : 'PCS') || 'PCS';
                const plannedQty = Number(mrpItem.quantity) || Number(mrpItem.plannedQuantity) || 0;
                const receivedQty = Number(mrpItem.receivedQuantity) || 0;
                const qtyRemaining = mrpItem.pendingQuantity !== undefined 
                    ? Number(mrpItem.pendingQuantity) 
                    : Math.max(0, plannedQty - receivedQty);

                return {
                    material: fgId,
                    materialName: fgName,
                    description: desc,
                    quantity: qtyRemaining > 0 ? qtyRemaining : plannedQty,
                    unit: unit,
                    category: 'Finished Goods',
                    locationId: '',
                    rate: Number(mrpItem.rate) || 0
                };
            });
            setMaterialEntries(newEntries);
            setPoLinkedNotice(`Auto-loaded ${newEntries.length} FG items from MRP Plan #${foundPlan.mrpNumber}`);
        }
    };

    // Items table handlers
    const handleAddMaterial = () => {
        setMaterialEntries(prev => [...prev, {
            material: '',
            materialName: '',
            description: '',
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
                    updated[index].description = (selectedMaterial as any).descriptions || (selectedMaterial as any).description || '';

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

    // Client-Side Photo & Document Compression Handlers
    const handlePhotoSelection = async (files: FileList | File[] | null) => {
        if (!files) return;
        const fileArr = Array.from(files);
        if (fileArr.length === 0) return;

        setIsCompressing(true);
        try {
            const compressTasks = fileArr.map(f => compressImageToFile(f, { maxWidth: 1280, maxHeight: 1280, quality: 0.8 }));
            const compressedFiles = await Promise.all(compressTasks);
            setPhotoFiles(prev => [...prev, ...compressedFiles]);
        } catch (err) {
            console.error("Photo compression error, keeping originals:", err);
            setPhotoFiles(prev => [...prev, ...fileArr]);
        } finally {
            setIsCompressing(false);
        }
    };

    const handleInvoiceDocSelection = async (file: File | null) => {
        if (!file) return;
        if (file.type.startsWith('image/')) {
            setIsCompressing(true);
            try {
                const compressed = await compressImageToFile(file, { maxWidth: 1280, maxHeight: 1280, quality: 0.8 });
                setPdfFile(compressed);
            } catch (err) {
                setPdfFile(file);
            } finally {
                setIsCompressing(false);
            }
        } else {
            setPdfFile(file);
        }
    };

    // Form Submission
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitted(true);

        const errors: Record<string, string> = {};

        if (!date) {
            errors.date = "Receipt date is required";
        }

        const supplierId = typeof supplier === 'object' ? (supplier as any)?._id : supplier;
        if (type !== 'inhouse' && type !== 'fg' && !supplierId) {
            errors.supplier = "Supplier / Vendor is required";
        }

        if ((type === 'inhouse' || type === 'fg') && isMrpRequired && !mrpPlan) {
            errors.mrpPlan = "Open Purchase MRP Plan is required in Compulsory Mode";
        }

        materialEntries.forEach((entry, idx) => {
            if (!entry.material) {
                errors[`item_${idx}_material`] = "Material item is required";
            }
            if (!entry.quantity || Number(entry.quantity) <= 0) {
                errors[`item_${idx}_quantity`] = "Quantity must be > 0";
            }
        });

        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            // Smoothly focus first invalid field
            const targetForm = e.currentTarget;
            if (targetForm) {
                const firstInvalid = targetForm.querySelector('[data-has-error="true"]');
                if (firstInvalid) {
                    firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
            return;
        }

        setFormErrors({});

        const items = materialEntries.map(entry => ({
            material: entry.material,
            consumable: entry.material,
            fgItem: entry.material,
            materialName: entry.materialName,
            description: entry.description,
            descriptions: entry.description,
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

        try {
            const res = await onSubmit(formData);

            // Prepare details for post-submission preview screen
            const supplierObj = safeVendors.find(v => v._id === supplierId) || { name: supplierId };
            const customerObj = safeCustomers.find(c => c._id === customer) || { name: customer };
            const localPhotoUrls = photoFiles.map(f => URL.createObjectURL(f));

            setCreatedGRNData({
                grnNumber,
                date,
                type,
                supplierName: supplierObj?.name,
                customerName: customerObj?.name,
                poReference: poReference || selectedPO,
                items,
                photos: [...existingPhotos, ...localPhotoUrls],
                pdfName: pdfFile?.name,
                qcRequired,
                qcStatus: qcRequired ? 'Pending QC' : 'Passed',
                totalQuantity: items.reduce((sum, it) => sum + it.quantity, 0),
                totalAmount: items.reduce((sum, it) => sum + (it.quantity * (it.rate || 0)), 0)
            });
        } catch (err: any) {
            console.error("GRN submission error:", err);
        }
    };

    // Calculate totals
    const totalItemsCount = materialEntries.filter(m => m.material).length;
    const totalQuantity = materialEntries.reduce((sum, m) => sum + (Number(m.quantity) || 0), 0);
    const totalNetValue = materialEntries.reduce((sum, m) => sum + ((Number(m.quantity) || 0) * (Number(m.rate) || 0)), 0);

    const theme = {
        title: type === 'inhouse' || type === 'fg' 
            ? 'Finished Goods / In-House GRN' 
            : (type === 'consumable' ? 'Consumable Items GRN' : (type === 'bo' ? 'Bought Out (BO) GRN' : 'Raw Material (RM) GRN')),
        badgeBg: type === 'inhouse' || type === 'fg' 
            ? 'bg-purple-100 text-purple-800' 
            : (type === 'consumable' ? 'bg-amber-100 text-amber-800' : (type === 'bo' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800')),
        itemLabel: type === 'inhouse' || type === 'fg' 
            ? 'Finished Good' 
            : (type === 'consumable' ? 'Consumable Material' : (type === 'bo' ? 'Bought Out Item' : 'Raw Material')),
        buttonBg: type === 'inhouse' || type === 'fg' 
            ? 'bg-purple-600 hover:bg-purple-700' 
            : (type === 'consumable' ? 'bg-amber-600 hover:bg-amber-700' : (type === 'bo' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'))
    };

    if (!isOpen) return null;

    // Post-Submission Success & Preview Screen
    if (createdGRNData) {
        return (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh]">
                    
                    {/* Header */}
                    <div className="px-5 py-4 bg-slate-900 text-white flex justify-between items-center flex-shrink-0 border-b border-slate-800">
                        <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 bg-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center border border-emerald-500/30">
                                <CheckCircle2 className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-sm sm:text-base font-black tracking-tight flex items-center gap-2">
                                    <span>GRN Generated Successfully</span>
                                    <span className="bg-emerald-950 text-emerald-300 border border-emerald-700 text-[10px] uppercase font-black px-2 py-0.5 rounded-md">
                                        {createdGRNData.grnNumber}
                                    </span>
                                </h2>
                                <p className="text-slate-400 text-xs mt-0.5">Goods receipt and inventory balances updated.</p>
                            </div>
                        </div>

                        <button
                            onClick={onClose}
                            className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 transition-all flex items-center justify-center text-slate-300 hover:text-white cursor-pointer"
                        >
                            <X size={15} />
                        </button>
                    </div>

                    {/* Content Body */}
                    <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
                        
                        {/* Summary Metrics Bar */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Receipt Date</span>
                                <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">{new Date(createdGRNData.date).toLocaleDateString('en-IN')}</p>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Party / Supplier</span>
                                <p className="font-bold text-slate-800 dark:text-slate-200 truncate mt-0.5">{createdGRNData.supplierName || createdGRNData.customerName || 'In-House'}</p>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Total Items</span>
                                <p className="font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">{createdGRNData.items?.length || 0} Items ({createdGRNData.totalQuantity} Qty)</p>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Total Value</span>
                                <p className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">₹{createdGRNData.totalAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                            </div>
                        </div>

                        {/* Items Table with Descriptions */}
                        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                            <div className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-300 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                                <Layers size={13} className="text-indigo-600" />
                                <span>Materials Received & Inspected</span>
                            </div>
                            <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                                {createdGRNData.items?.map((item: any, idx: number) => (
                                    <div key={idx} className="p-3 flex items-start justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                        <div className="flex-1">
                                            <div className="font-bold text-slate-900 dark:text-slate-100">{item.materialName}</div>
                                            {item.description && (
                                                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                                                    📝 {item.description}
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-right whitespace-nowrap">
                                            <span className="font-bold text-slate-800 dark:text-slate-200">{item.quantity} {item.unit || 'PCS'}</span>
                                            {item.rate > 0 && (
                                                <div className="text-[10px] text-slate-400">@ ₹{item.rate} = ₹{(item.quantity * item.rate).toFixed(2)}</div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Photos & Document Previews */}
                        {(createdGRNData.photos?.length > 0 || createdGRNData.pdfName) && (
                            <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                                <div className="font-bold text-slate-700 dark:text-slate-300 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                                    <Camera size={13} className="text-indigo-600" />
                                    <span>Uploaded Invoice Photos & Documents</span>
                                </div>

                                <div className="flex flex-wrap items-center gap-2.5">
                                    {/* Photos Thumbnails */}
                                    {createdGRNData.photos?.map((photoUrl: string, idx: number) => (
                                        <div 
                                            key={idx} 
                                            onClick={() => setZoomPhotoUrl(photoUrl)}
                                            className="relative group w-16 h-16 rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700 bg-black cursor-pointer shadow-xs"
                                        >
                                            <img src={photoUrl} alt={`Invoice photo ${idx + 1}`} className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                                                <ZoomIn size={14} />
                                            </div>
                                        </div>
                                    ))}

                                    {/* PDF Attachment Badge */}
                                    {createdGRNData.pdfName && (
                                        <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 rounded-lg font-bold">
                                            <FileText size={16} className="text-indigo-600" />
                                            <span className="truncate max-w-[200px]">{createdGRNData.pdfName}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Actions Footer */}
                    <div className="p-3.5 bg-slate-50 dark:bg-slate-800/90 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5 flex-shrink-0">
                        <button
                            type="button"
                            onClick={() => setCreatedGRNData(null)}
                            className="px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                            <RotateCcw size={13} />
                            <span>Create Another GRN</span>
                        </button>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => generateFrontendGrnPDF({ grn: createdGRNData })}
                                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                            >
                                <Download size={14} />
                                <span>Download GRN PDF</span>
                            </button>

                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
                            >
                                Done
                            </button>
                        </div>
                    </div>

                    {/* Lightbox Photo Zoom Modal */}
                    {zoomPhotoUrl && (
                        <div 
                            onClick={() => setZoomPhotoUrl(null)}
                            className="fixed inset-0 z-[300] bg-black/90 flex items-center justify-center p-4 cursor-zoom-out animate-in fade-in duration-150"
                        >
                            <div className="relative max-w-4xl max-h-[90vh]">
                                <img src={zoomPhotoUrl} alt="Enlarged invoice" className="max-w-full max-h-[85vh] rounded-lg shadow-2xl object-contain" />
                                <button
                                    onClick={() => setZoomPhotoUrl(null)}
                                    className="absolute -top-3 -right-3 w-8 h-8 bg-white text-slate-900 rounded-full flex items-center justify-center shadow-lg font-bold cursor-pointer"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-2 sm:p-4 bg-slate-950/75 backdrop-blur-md overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-5xl my-auto overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[94vh] animate-in fade-in zoom-in-95 duration-200">
                
                {/* Thin, Sleek Modal Header */}
                <div className="px-4 sm:px-5 py-3 bg-slate-900 text-white flex justify-between items-center flex-shrink-0 border-b border-slate-800">
                    <div className="flex items-center gap-2 sm:gap-3">
                        <div className="w-8 h-8 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                            <Upload className="w-4 h-4" />
                        </div>
                        <div>
                            <h2 className="text-sm sm:text-base font-black tracking-tight flex items-center gap-2">
                                <span>{isEditing ? `Edit ${theme.title}` : `New ${theme.title}`}</span>
                                <span className="bg-indigo-900/80 text-indigo-200 border border-indigo-700 text-[10px] uppercase font-black px-2 py-0.5 rounded-md">
                                    {type.toUpperCase()}
                                </span>
                            </h2>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 transition-all flex items-center justify-center text-slate-300 hover:text-white cursor-pointer"
                    >
                        <X size={15} />
                    </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-3.5">
                    
                    {/* Visual Error Summary Alert Banner */}
                    {Object.keys(formErrors).length > 0 && (
                        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 rounded-xl flex items-center justify-between gap-2.5 text-rose-800 dark:text-rose-300 animate-in fade-in duration-150 shadow-2xs">
                            <div className="flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                                <span className="text-xs font-bold">
                                    Please fill in the highlighted compulsory field{Object.keys(formErrors).length > 1 ? 's' : ''} before submitting.
                                </span>
                            </div>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-200 dark:bg-rose-900 text-rose-900 dark:text-rose-200">
                                {Object.keys(formErrors).length} required
                            </span>
                        </div>
                    )}

                    {/* Section 1: Receipt Header & PO Linkage */}
                    <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/60">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            
                            {/* GRN Number */}
                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    GRN Number
                                </label>
                                <input
                                    type="text"
                                    value={grnNumber}
                                    readOnly
                                    className="w-full h-9 px-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-mono text-xs font-semibold cursor-not-allowed select-all"
                                />
                            </div>

                            {/* Receipt Date */}
                            <div data-has-error={!!formErrors.date}>
                                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                                    <span>Receipt Date <span className="text-red-500">*</span></span>
                                    {formErrors.date && <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold">Required</span>}
                                </label>
                                <input
                                    type="date"
                                    value={date}
                                    onChange={(e) => {
                                        setDate(e.target.value);
                                        if (e.target.value) clearError('date');
                                    }}
                                    className={`w-full h-9 px-2.5 bg-white dark:bg-slate-900 border rounded-xl text-xs font-medium focus:ring-2 cursor-pointer transition-all ${
                                        formErrors.date
                                            ? 'border-rose-500 bg-rose-50/40 dark:bg-rose-950/30 ring-1 ring-rose-400 focus:ring-rose-500 text-rose-900 dark:text-rose-100'
                                            : 'border-slate-300 dark:border-slate-700 focus:ring-indigo-500 text-slate-900 dark:text-slate-100'
                                    }`}
                                />
                            </div>

                            {/* Supplier for RM, BO, Consumable */}
                            {type !== 'inhouse' && type !== 'fg' && (
                                <div className="sm:col-span-2 lg:col-span-1" data-has-error={!!formErrors.supplier}>
                                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                                        <span>Supplier / Vendor <span className="text-red-500">*</span></span>
                                        {formErrors.supplier && <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold">Required</span>}
                                    </label>
                                    <SearchableSelect
                                        options={safeVendors.map(vendor => ({
                                            value: vendor._id,
                                            label: `${vendor.name || 'Unnamed'} ${vendor.code ? `(${vendor.code})` : ''}`
                                        }))}
                                        value={typeof supplier === 'object' ? (supplier as any)._id : supplier || ''}
                                        hasError={!!formErrors.supplier}
                                        onChange={(val: any) => {
                                            setSupplier(val);
                                            setSelectedPO('');
                                            setPoReference('');
                                            setPoLinkedNotice(null);
                                            if (val) clearError('supplier');
                                        }}
                                        placeholder="Select Vendor..."
                                        dropdownPosition="auto"
                                    />
                                </div>
                            )}

                            {/* Customer & MRP Plan for FG / InHouse */}
                            {(type === 'inhouse' || type === 'fg') && (
                                <>
                                    {/* MRP Mode Toggle Switch Header */}
                                    <div className="col-span-1 sm:col-span-2 lg:col-span-4 p-3 bg-purple-50/80 dark:bg-purple-950/40 rounded-xl border border-purple-200 dark:border-purple-800/80 flex flex-wrap items-center justify-between gap-3">
                                        <div className="flex items-center gap-2.5">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${isMrpRequired ? 'bg-purple-600 text-white shadow-xs' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                                                <Layers className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                                    <span>Production MRP Plan Linkage</span>
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-md font-extrabold uppercase border ${isMrpRequired ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 border-purple-300 dark:border-purple-700' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'}`}>
                                                        {isMrpRequired ? 'Compulsory (Plan-Driven)' : 'Optional / Direct FG Inward'}
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                                    {isMrpRequired
                                                        ? "Strictly requires selecting an active Production MRP Plan to auto-load planned FG quantities and track fulfillment."
                                                        : "Direct FG Inward enabled — you can directly select Finished Goods from inventory or optionally choose an MRP plan."}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Interactive Mode Toggle Buttons */}
                                        <div className="flex items-center bg-white dark:bg-slate-900 p-1 rounded-xl border border-purple-200 dark:border-purple-800/80 shadow-xs shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setIsMrpRequired(false);
                                                    clearError('mrpPlan');
                                                }}
                                                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${!isMrpRequired ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}`}
                                            >
                                                Direct / Optional MRP
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setIsMrpRequired(true);
                                                }}
                                                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${isMrpRequired ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}`}
                                            >
                                                Compulsory MRP Plan
                                            </button>
                                        </div>
                                    </div>

                                    {/* Open Purchase MRP Plan Dropdown */}
                                    <div className="sm:col-span-2 lg:col-span-2" data-has-error={!!formErrors.mrpPlan}>
                                        <label className="block text-[11px] font-bold text-purple-900 dark:text-purple-300 mb-1 flex items-center justify-between">
                                            <span>
                                                {isMrpRequired ? "Open Purchase MRP Plan" : "Link MRP Plan (Optional)"}{" "}
                                                {isMrpRequired && <span className="text-red-500">*</span>}
                                            </span>
                                            {formErrors.mrpPlan ? (
                                                <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold">Required in Compulsory Mode</span>
                                            ) : (
                                                <span className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold">({openMrpPlans.length} Open)</span>
                                            )}
                                        </label>
                                        <select
                                            value={mrpPlan}
                                            onChange={(e) => {
                                                handleSelectMRPPlan(e.target.value);
                                                if (e.target.value) clearError('mrpPlan');
                                            }}
                                            className={`w-full h-9 px-2.5 border rounded-xl text-xs font-bold focus:ring-2 cursor-pointer truncate transition-all ${
                                                formErrors.mrpPlan
                                                    ? 'border-rose-500 bg-rose-50/60 dark:bg-rose-950/40 text-rose-950 dark:text-rose-100 ring-1 ring-rose-400 focus:ring-rose-500'
                                                    : 'bg-purple-50/70 dark:bg-purple-950/50 border-purple-300 dark:border-purple-800 text-purple-950 dark:text-purple-200 focus:ring-purple-500'
                                            }`}
                                        >
                                            <option value="">
                                                {isMrpRequired ? "-- Select Open Purchase MRP Plan * --" : "-- Direct Inward / No MRP Link (Optional) --"}
                                            </option>
                                            {openMrpPlans.map(plan => {
                                                const itemCount = plan.fgItems?.length || plan.items?.length || 0;
                                                return (
                                                    <option key={plan._id} value={plan._id}>
                                                        MRP #{plan.mrpNumber} {plan.customerName ? `— ${plan.customerName}` : ''} ({itemCount} FG items) [{plan.status || 'Planned'}]
                                                    </option>
                                                );
                                            })}
                                        </select>
                                    </div>

                                    {/* Customer (Optional / Auto-filled from MRP Plan) */}
                                    <div className="sm:col-span-2 lg:col-span-2">
                                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                            Customer <span className="text-slate-400 font-normal text-[10px]">(Optional / In-House Stock)</span>
                                        </label>
                                        <SearchableSelect
                                            options={safeCustomers.map(cust => ({
                                                value: cust._id,
                                                label: `${cust.name || 'Unnamed'} ${cust.code ? `(${cust.code})` : ''}`
                                            }))}
                                            value={typeof customer === 'object' ? (customer as any)._id : customer || ''}
                                            onChange={(val: any) => setCustomer(val)}
                                            placeholder="Select Customer (Optional)..."
                                            dropdownPosition="auto"
                                        />
                                    </div>
                                </>
                            )}

                            {/* Outward PO Selector (if vendor selected) */}
                            {type !== 'inhouse' && type !== 'fg' && supplier && (
                                <div className="sm:col-span-2 lg:col-span-1">
                                    <label className="block text-[11px] font-bold text-indigo-900 dark:text-indigo-300 mb-1 flex items-center justify-between">
                                        <span>Link Outward PO</span>
                                        <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">({vendorActivePOs.length} Open)</span>
                                    </label>
                                    <select
                                        value={selectedPO}
                                        onChange={(e) => handleSelectPO(e.target.value)}
                                        className="w-full h-9 px-2.5 bg-indigo-50/70 dark:bg-indigo-950/50 border border-indigo-300 dark:border-indigo-800 rounded-xl text-xs font-bold text-indigo-950 dark:text-indigo-200 focus:ring-2 focus:ring-indigo-500 cursor-pointer truncate"
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
                                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        PO / Invoice Ref No.
                                    </label>
                                    <input
                                        type="text"
                                        value={poReference}
                                        onChange={(e) => setPoReference(e.target.value)}
                                        placeholder="Manual / Offline Ref"
                                        className="w-full h-9 px-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                            )}

                            {/* Quality Check (QC Required) Toggle Bar */}
                            <div className="col-span-1 sm:col-span-2 lg:col-span-4 flex items-center justify-between p-2.5 sm:p-3 bg-indigo-50/70 dark:bg-slate-800/80 rounded-xl border border-indigo-200 dark:border-slate-700 mt-1">
                                <div className="flex items-center gap-2.5">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 ${qcRequired ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                                        <ShieldCheck className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                            <span>Quality Check (QC) Required</span>
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${qcRequired ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
                                                {qcRequired ? 'Send to Incoming QC' : 'Direct Inward'}
                                            </span>
                                        </div>
                                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                            {qcRequired 
                                                ? "Material will be held in Pending QC Stock and routed to Incoming Quality for inspection." 
                                                : "Stock is immediately available in Current Inventory without QC inspection."}
                                        </div>
                                    </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-2">
                                    <input 
                                        type="checkbox" 
                                        checked={qcRequired} 
                                        onChange={(e) => setQcRequired(e.target.checked)} 
                                        className="sr-only peer" 
                                    />
                                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
                                </label>
                            </div>
                        </div>

                        {/* PO Auto-link Notice */}
                        {poLinkedNotice && (
                            <div className="mt-2.5 flex items-center gap-1.5 text-xs text-emerald-800 dark:text-emerald-300 font-semibold bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
                                <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span>{poLinkedNotice}</span>
                            </div>
                        )}
                    </div>

                    {/* Compact Single-Bar Attachment Toolbar with Client-Side Compression */}
                    {type !== 'inhouse' && type !== 'fg' && (
                        <div className="bg-white dark:bg-slate-900 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1 shrink-0">
                                    <Paperclip className="w-3.5 h-3.5 text-indigo-600" />
                                    Attach (Auto-Compressed):
                                </span>

                                {/* Camera Button */}
                                <button
                                    type="button"
                                    onClick={() => docCameraInputRef.current?.click()}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 rounded-lg font-bold text-indigo-700 dark:text-indigo-300 transition-colors cursor-pointer"
                                    title="Open camera to photograph invoice / material"
                                >
                                    <Camera className="w-3.5 h-3.5 text-indigo-600" />
                                    Camera
                                </button>

                                {/* Gallery / Photo Button */}
                                <button
                                    type="button"
                                    onClick={() => galleryInputRef.current?.click()}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 rounded-lg font-semibold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                                >
                                    <Image className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                                    Photos
                                </button>

                                {/* File / PDF Button */}
                                <button
                                    type="button"
                                    onClick={() => docFileInputRef.current?.click()}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 rounded-lg font-semibold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                                >
                                    <FileText className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                                    Invoice File
                                </button>

                                {isCompressing && (
                                    <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-bold animate-pulse">
                                        ⚡ Compressing images...
                                    </span>
                                )}

                                {/* Hidden file inputs */}
                                <input
                                    ref={docCameraInputRef}
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    className="hidden"
                                    onChange={(e) => {
                                        if (e.target.files?.[0]) {
                                            handlePhotoSelection(e.target.files);
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
                                            handleInvoiceDocSelection(e.target.files[0]);
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
                                            handlePhotoSelection(e.target.files);
                                        }
                                    }}
                                />
                            </div>

                            {/* Active Attachments Badges */}
                            <div className="flex flex-wrap items-center gap-2">
                                {/* Attached PDF/Invoice Pill */}
                                {pdfFile && (
                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-lg font-semibold text-[11px]">
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
                                                    className="w-6 h-6 rounded-md object-cover border border-white dark:border-slate-800 ring-1 ring-slate-200 shadow-2xs"
                                                />
                                            ))}
                                        </div>
                                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                                            {photoFiles.length} compressed photo{photoFiles.length > 1 ? 's' : ''}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setPhotoFiles([])}
                                            className="text-slate-400 hover:text-red-600 transition-colors p-0.5 cursor-pointer"
                                            title="Clear photos"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Items Section with Upward-Opening Dropdown & Descriptions */}
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
                        
                        {/* Section Header */}
                        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Layers className="w-4 h-4 text-indigo-600" />
                                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                                    Item Details & Descriptions
                                </h3>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
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

                        {/* Desktop View: Wide Responsive Table with Upward Dropdowns */}
                        <div className="hidden md:block overflow-x-auto min-h-[220px]">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-100/75 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                                        <th className="py-2.5 px-3 w-10 text-center">#</th>
                                        <th className="py-2.5 px-3 min-w-[340px]">{theme.itemLabel} & Description <span className="text-red-500">*</span></th>
                                        <th className="py-2.5 px-3 w-32">Qty Received <span className="text-red-500">*</span></th>
                                        <th className="py-2.5 px-3 w-24 text-center">Unit</th>
                                        <th className="py-2.5 px-3 w-32">Rate (₹)</th>
                                        <th className="py-2.5 px-3 w-36 text-right">Total (₹)</th>
                                        <th className="py-2.5 px-3 w-12 text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                                    {materialEntries.map((entry, index) => {
                                        const rowTotal = (Number(entry.quantity) || 0) * (Number(entry.rate) || 0);
                                        const hasMaterialError = !!formErrors[`item_${index}_material`];
                                        const hasQuantityError = !!formErrors[`item_${index}_quantity`];

                                        return (
                                            <tr key={index} className="hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 transition-colors">
                                                <td className="py-2 px-3 text-center text-slate-400 font-bold">
                                                    {index + 1}
                                                </td>
                                                <td className="py-2 px-3" data-has-error={hasMaterialError}>
                                                    <SearchableSelect
                                                        options={materialOptions}
                                                        value={entry.material}
                                                        hasError={hasMaterialError}
                                                        onChange={(val: any) => {
                                                            handleMaterialChange(index, 'material', val);
                                                            if (val) clearError(`item_${index}_material`);
                                                        }}
                                                        placeholder={`Search ${theme.itemLabel}...`}
                                                        dropdownPosition="auto"
                                                    />
                                                    {hasMaterialError && (
                                                        <div className="text-[10px] text-rose-600 dark:text-rose-400 font-bold mt-0.5 flex items-center gap-1">
                                                            <span>⚠️</span>
                                                            <span>{formErrors[`item_${index}_material`]}</span>
                                                        </div>
                                                    )}
                                                    {entry.description && !hasMaterialError && (
                                                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate mt-1 flex items-center gap-1" title={entry.description}>
                                                            <span>📝</span>
                                                            <span className="truncate">{entry.description}</span>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="py-2 px-3" data-has-error={hasQuantityError}>
                                                    <input
                                                        type="number"
                                                        min="0.001"
                                                        step="any"
                                                        value={entry.quantity || ''}
                                                        onChange={(e) => {
                                                            const val = parseFloat(e.target.value) || 0;
                                                            handleMaterialChange(index, 'quantity', val);
                                                            if (val > 0) clearError(`item_${index}_quantity`);
                                                        }}
                                                        placeholder="0"
                                                        className={`w-full h-9 px-2.5 border rounded-xl text-xs font-bold text-center outline-none transition-all ${
                                                            hasQuantityError
                                                                ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-100 ring-1 ring-rose-400 focus:ring-rose-500'
                                                                : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500'
                                                        }`}
                                                    />
                                                    {hasQuantityError && (
                                                        <div className="text-[9px] text-rose-600 dark:text-rose-400 font-bold mt-0.5 text-center">
                                                            {formErrors[`item_${index}_quantity`]}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="py-2 px-3 text-center">
                                                    <span className="inline-block px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-[11px] font-bold border border-slate-200 dark:border-slate-700">
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
                                                        className="w-full h-9 px-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                                                    />
                                                </td>
                                                <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                                                    ₹{rowTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                                <td className="py-2 px-3 text-center">
                                                    {materialEntries.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveMaterial(index)}
                                                            className="text-slate-400 hover:text-red-600 transition-colors p-1 cursor-pointer"
                                                            title="Delete row"
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

                        {/* Mobile View: Touch-Friendly Compact Cards with Upward Dropdowns */}
                        <div className="block md:hidden p-3 space-y-3 bg-slate-50/70 dark:bg-slate-800/40">
                            {materialEntries.map((entry, index) => {
                                const rowTotal = (Number(entry.quantity) || 0) * (Number(entry.rate) || 0);
                                const hasMaterialError = !!formErrors[`item_${index}_material`];
                                const hasQuantityError = !!formErrors[`item_${index}_quantity`];

                                return (
                                    <div key={index} className={`bg-white dark:bg-slate-900 p-3 rounded-xl border shadow-2xs space-y-2.5 transition-all ${hasMaterialError || hasQuantityError ? 'border-rose-300 dark:border-rose-800 bg-rose-50/20' : 'border-slate-200 dark:border-slate-700'}`}>
                                        
                                        {/* Card Header: Index & Trash */}
                                        <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
                                            <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-100 dark:border-indigo-800">
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

                                        {/* Material Selection with Description */}
                                        <div data-has-error={hasMaterialError}>
                                            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1 flex items-center justify-between">
                                                <span>{theme.itemLabel} <span className="text-red-500">*</span></span>
                                                {hasMaterialError && <span className="text-rose-600 dark:text-rose-400 font-bold">{formErrors[`item_${index}_material`]}</span>}
                                            </label>
                                            <SearchableSelect
                                                options={materialOptions}
                                                value={entry.material}
                                                hasError={hasMaterialError}
                                                onChange={(val: any) => {
                                                    handleMaterialChange(index, 'material', val);
                                                    if (val) clearError(`item_${index}_material`);
                                                }}
                                                placeholder={`Select ${theme.itemLabel}...`}
                                                dropdownPosition="auto"
                                            />
                                            {entry.description && !hasMaterialError && (
                                                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate mt-1">
                                                    📝 {entry.description}
                                                </div>
                                            )}
                                        </div>

                                        {/* Qty, Unit & Rate Grid */}
                                        <div className="grid grid-cols-2 gap-2">
                                            <div data-has-error={hasQuantityError}>
                                                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1 flex items-center justify-between">
                                                    <span>Qty ({entry.unit || 'PCS'}) <span className="text-red-500">*</span></span>
                                                    {hasQuantityError && <span className="text-rose-600 font-bold">Req</span>}
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0.001"
                                                    step="any"
                                                    value={entry.quantity || ''}
                                                    onChange={(e) => {
                                                        const val = parseFloat(e.target.value) || 0;
                                                        handleMaterialChange(index, 'quantity', val);
                                                        if (val > 0) clearError(`item_${index}_quantity`);
                                                    }}
                                                    placeholder="Qty"
                                                    className={`w-full h-9 px-2.5 border rounded-xl text-xs font-bold text-center outline-none transition-all ${
                                                        hasQuantityError
                                                            ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-100 ring-1 ring-rose-400 focus:ring-rose-500'
                                                            : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500'
                                                    }`}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                                                    Rate (₹)
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="any"
                                                    value={entry.rate || ''}
                                                    onChange={(e) => handleMaterialChange(index, 'rate', parseFloat(e.target.value) || 0)}
                                                    placeholder="Rate"
                                                    className="w-full h-9 px-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                                                />
                                            </div>
                                        </div>

                                        {/* Total Amount Bar */}
                                        <div className="flex items-center justify-between pt-1 text-xs">
                                            <span className="text-slate-500 font-semibold">Row Total:</span>
                                            <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                                                ₹{rowTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Summary Bar */}
                        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                            <div className="flex items-center gap-4 text-slate-600 dark:text-slate-400 font-medium">
                                <div>Items: <span className="font-bold text-slate-900 dark:text-slate-100">{totalItemsCount}</span></div>
                                <div>Total Qty: <span className="font-bold text-slate-900 dark:text-slate-100">{totalQuantity}</span></div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-slate-500 font-semibold">Total Value:</span>
                                <span className="text-sm font-extrabold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-3 py-1 rounded-xl border border-indigo-200 dark:border-indigo-800">
                                    ₹{totalNetValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Modal Actions */}
                    <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading || isCompressing}
                            className={`px-6 py-2 rounded-xl text-white text-xs font-bold shadow-md transition-all cursor-pointer flex items-center gap-2 ${
                                theme.buttonBg
                            } ${(loading || isCompressing) ? 'opacity-50 cursor-not-allowed' : ''}`}
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

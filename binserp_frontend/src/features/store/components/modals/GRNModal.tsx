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
    RotateCcw,
    Percent,
    PackagePlus,
    Truck,
    Package
} from 'lucide-react';
import { GRNModalProps } from "@/src/features/store/types/store.types";
import SearchableSelect from '../SearchableSelect';
import { computeProfessionalTotalWithRoundOff, RoundingMode } from '@/src/utils/roundingHelper';
import QuickItemMasterModal from './QuickItemMasterModal';
import { apiGet } from '@/src/lib/api';
import { compressImageToFile } from '@/src/utils/imageCompressor';
import { generateFrontendGrnPDF } from '@/src/utils/frontendPdfHelper';
import { resolveGrnLineItemDisplay, computeDualUomLinePricing, syncQuantities, switchRateUnit } from '@/src/utils/dualUomHelper';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface MaterialEntry {
    material: string;
    materialName?: string;
    description?: string;
    hsnCode?: string;
    quantity: number;
    unit?: string;
    category?: string;
    locationId?: string;
    rate?: number;
    amount?: number;
    hasSecondaryUnit?: boolean;
    secondaryUnit?: string;
    conversionFactor?: number;
    secondaryQuantity?: number;
    currentStock?: number;
    secondaryCurrentStock?: number;
    selectedUnit?: string;
    rateUnit?: 'primary' | 'secondary';
    primaryRate?: number;
    secondaryRate?: number;
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
    const [grnType, setGrnType] = useState<string>(type || 'rm');
    const [grnNumber, setGrnNumber] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [supplier, setSupplier] = useState('');
    const [customer, setCustomer] = useState('');
    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [poNumber, setPoNumber] = useState('');
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

    // Global Tax Rate (GST) state for RM, BO, Consumables
    const [globalTaxRate, setGlobalTaxRate] = useState<number>(0);

    // Additional receipt charges (Transportation & Packing)
    const [transportationCharges, setTransportationCharges] = useState<number>(0);
    const [packingCharges, setPackingCharges] = useState<number>(0);
    const [isRoundOffEnabled, setIsRoundOffEnabled] = useState<boolean>(true);
    const [roundingMode, setRoundingMode] = useState<RoundingMode>('nearest');

    // Post-submission success & preview states
    const [createdGRNData, setCreatedGRNData] = useState<any>(null);
    const [zoomPhotoUrl, setZoomPhotoUrl] = useState<string | null>(null);

    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [isSubmitted, setIsSubmitted] = useState(false);

    // Quick Master Item Modal States
    const [isQuickMasterModalOpen, setIsQuickMasterModalOpen] = useState(false);
    const [quickMasterInitialName, setQuickMasterInitialName] = useState('');
    const [quickMasterTargetIndex, setQuickMasterTargetIndex] = useState<number | null>(null);
    const [localExtraMaterials, setLocalExtraMaterials] = useState<any[]>([]);

    const [companyInfo, setCompanyInfo] = useState<any>(null);

    useEffect(() => {
        try {
            const cached = localStorage.getItem("storeCompanyInfo") || localStorage.getItem("companyInfo");
            if (cached) setCompanyInfo(JSON.parse(cached));
        } catch (e) {}

        const token = typeof window !== 'undefined' ? localStorage.getItem("token") : null;
        if (token) {
            fetch(`${API_BASE_URL}/api/store/company-info`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            .then(res => res.json())
            .then(data => {
                if (data && (data.companyName || data.name)) {
                    setCompanyInfo(data);
                    try { localStorage.setItem("storeCompanyInfo", JSON.stringify(data)); } catch (e) {}
                }
            })
            .catch(() => {});
        }
    }, []);

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
        hsnCode: '',
        quantity: 0,
        unit: '',
        category: '',
        locationId: '',
        rate: 0,
        hasSecondaryUnit: false,
        secondaryUnit: '',
        conversionFactor: 0,
        secondaryQuantity: 0,
        currentStock: 0,
        secondaryCurrentStock: 0,
        selectedUnit: '',
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

    const handleSwitchType = (newType: string) => {
        setGrnType(newType);
        let activePrefix = prefixSettings?.rmBoGrnPrefix || prefixSettings?.grnPrefix || 'GRN-RM';
        if (newType === 'inhouse' || newType === 'fg') {
            activePrefix = prefixSettings?.fgGrnPrefix || 'GRN-FG';
        } else if (newType === 'bo') {
            activePrefix = prefixSettings?.rmBoGrnPrefix || prefixSettings?.grnPrefix || 'GRN-BO';
        } else if (newType === 'consumable') {
            activePrefix = (prefixSettings as any)?.consumablePrefix || 'GRN-CON';
        }
        setGrnNumber(generateGRNNumber(newType, activePrefix));
    };

    // Initialize form when modal opens
    useEffect(() => {
        if (isOpen) {
            const resolvedType = initialData?.type || type || 'rm';
            setGrnType(resolvedType);

            let activePrefix = prefixSettings?.rmBoGrnPrefix || prefixSettings?.grnPrefix || 'GRN-RM';
            if (resolvedType === 'inhouse' || resolvedType === 'fg') {
                activePrefix = prefixSettings?.fgGrnPrefix || 'GRN-FG';
            } else if (resolvedType === 'bo') {
                activePrefix = prefixSettings?.rmBoGrnPrefix || prefixSettings?.grnPrefix || 'GRN-BO';
            } else if (resolvedType === 'consumable') {
                activePrefix = (prefixSettings as any)?.consumablePrefix || 'GRN-CON';
            }

            setCreatedGRNData(null);
            setZoomPhotoUrl(null);

            if (isEditing && initialData) {
                setGrnNumber(initialData.grnNumber || '');
                setDate(initialData.date ? new Date(initialData.date).toISOString().split('T')[0] : '');
                setSupplier(typeof (initialData as any).supplier === 'object' && (initialData as any).supplier !== null ? ((initialData as any).supplier as any)._id : ((initialData as any).supplier || ''));
                setCustomer((initialData as any).customerId || (initialData as any).customer || '');
                setInvoiceNumber((initialData as any).invoiceNumber || (initialData as any).invoiceNo || '');
                setPoNumber((initialData as any).poNumber || (initialData as any).poReference || '');
                setPoReference((initialData as any).invoiceNumber || (initialData as any).poReference || (initialData as any).poNumber || '');
                setSelectedPO((initialData as any).purchaseOrder || '');
                setMrpPlan((initialData as any).mrpPlan || '');
                setMrpNumber((initialData as any).mrpNumber || '');
                setIsMrpRequired(!!(initialData as any).mrpPlan);
                setExistingPhotos((initialData as any).photos || []);
                setQcRequired((initialData as any).qcRequired || false);
                setGlobalTaxRate(Number((initialData as any).taxRate) || 0);
                setTransportationCharges(Number((initialData as any).transportationCharges) || 0);
                setPackingCharges(Number((initialData as any).packingCharges) || 0);
                if ((initialData as any).isRoundOff !== undefined) {
                    setIsRoundOffEnabled(Boolean((initialData as any).isRoundOff));
                }
                if ((initialData as any).roundingMode) {
                    setRoundingMode((initialData as any).roundingMode);
                }

                if (Array.isArray(initialData.items) && initialData.items.length > 0) {
                    const entries = initialData.items.map((item: any) => {
                        const mObj = item.material || item.component || item.fgItem;
                        const matId = typeof mObj === 'object' && mObj !== null ? mObj._id : (mObj || '');
                        const desc = item.description || item.descriptions || (typeof mObj === 'object' ? (mObj.descriptions || mObj.description) : '');
                        const hsn = item.hsnCode || (typeof mObj === 'object' ? (mObj.hsnCode || mObj.hsn) : '') || '';
                        const hasSec = Boolean(item.hasSecondaryUnit ?? (typeof mObj === 'object' ? mObj?.hasSecondaryUnit : false));
                        const secUnit = item.secondaryUnit || (typeof mObj === 'object' ? mObj?.secondaryUnit : '') || '';
                        const convFactor = Number(item.conversionFactor ?? (typeof mObj === 'object' ? mObj?.conversionFactor : 0)) || 0;
                        const curStock = Number((typeof mObj === 'object' ? (mObj?.quantity ?? mObj?.currentStock) : 0)) || 0;
                        const secStock = hasSec && convFactor ? curStock * convFactor : 0;
                        const priQty = Number(item.quantity || item.receivedQuantity || 0);
                        const secQty = Number(item.secondaryQuantity || item.secondaryReceivedQuantity || (hasSec && convFactor ? priQty * convFactor : 0));

                        const isSec = Boolean(
                            hasSec && (
                                item.rateUnit === 'secondary' ||
                                (item.selectedUnit && secUnit && item.selectedUnit.toLowerCase() === secUnit.toLowerCase())
                            )
                        );
                        const rateUnit = isSec ? 'secondary' : 'primary';
                        const activeSelectedUnit = isSec ? secUnit : (item.selectedUnit || item.unit || '');
                        const itemRate = Number(item.rate || 0);

                        return {
                            material: matId,
                            materialName: item.materialName || (typeof mObj === 'object' ? mObj.name : '') || '',
                            description: desc || '',
                            hsnCode: hsn,
                            quantity: priQty,
                            unit: item.unit || '',
                            category: item.category || '',
                            locationId: item.locationId?._id || item.locationId || item.location?._id || item.location || '',
                            rate: itemRate,
                            amount: item.amount || 0,
                            hasSecondaryUnit: hasSec,
                            secondaryUnit: secUnit,
                            conversionFactor: convFactor,
                            secondaryQuantity: secQty,
                            currentStock: curStock,
                            secondaryCurrentStock: secStock,
                            selectedUnit: activeSelectedUnit,
                            rateUnit: rateUnit,
                            primaryRate: isSec && convFactor ? parseFloat((itemRate * convFactor).toFixed(3)) : (item.primaryRate || itemRate),
                            secondaryRate: !isSec && convFactor ? parseFloat((itemRate / convFactor).toFixed(3)) : (item.secondaryRate || itemRate),
                        };
                    });
                    setMaterialEntries(entries);
                }
            } else {
                setGrnNumber(generateGRNNumber(resolvedType, activePrefix));
                setDate(new Date().toISOString().split('T')[0]);
                setSupplier('');
                setCustomer('');
                setInvoiceNumber('');
                setPoNumber('');
                setPoReference('');
                setSelectedPO('');
                setMrpPlan('');
                setMrpNumber('');
                setIsMrpRequired(false);
                setPoLinkedNotice(null);
                setQcRequired(false);
                setGlobalTaxRate(0);
                setTransportationCharges(0);
                setPackingCharges(0);
                setPdfFile(null);
                setPhotoFiles([]);
                setExistingPhotos([]);
                setFormErrors({});
                setIsSubmitted(false);
                setMaterialEntries([{
                    material: '',
                    materialName: '',
                    description: '',
                    hsnCode: '',
                    quantity: 0,
                    unit: '',
                    category: '',
                    locationId: '',
                    rate: 0,
                    hasSecondaryUnit: false,
                    secondaryUnit: '',
                    conversionFactor: 0,
                    secondaryQuantity: 0,
                    currentStock: 0,
                    secondaryCurrentStock: 0,
                    selectedUnit: '',
                    rateUnit: 'primary',
                    primaryRate: 0,
                    secondaryRate: 0,
                }]);
            }
        }
    }, [isOpen, isEditing, initialData, type, prefixSettings]);

    // Fetch active Outward POs released from Purchase tab when supplier changes (RM, BO, Consumables)
    useEffect(() => {
        const supplierId = typeof supplier === 'object' ? (supplier as any)?._id : supplier;
        if (supplierId && grnType !== 'inhouse' && grnType !== 'fg') {
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
    }, [supplier, grnType]);

    // Fetch active MRP plans for InHouse / FG GRN
    useEffect(() => {
        if (isOpen && (grnType === 'inhouse' || grnType === 'fg')) {
            const token = localStorage.getItem('token');
            if (token) {
                apiGet('/api/purchase/mrp/plans', token)
                    .then(res => setMrpPlansList(res.mrpPlans || []))
                    .catch(err => console.error("Failed to load MRP plans for FG GRN:", err));
            }
        }
    }, [isOpen, grnType]);

    // Format material options with descriptions for SearchableSelect
    const materialOptions = useMemo(() => {
        const optionsMap = new Map<string, any>();

        // Combine safeMaterials and localExtraMaterials (newly added on-the-fly)
        const allAvailableMaterials = [...safeMaterials, ...localExtraMaterials];

        allAvailableMaterials.forEach((m: any) => {
            if (!m || !m._id) return;
            const desc = (m.descriptions || m.description || '').trim();
            const label = desc ? `${m.name || 'Unnamed'} — ${desc}` : (m.name || 'Unnamed');
            optionsMap.set(String(m._id), {
                value: String(m._id),
                label: label,
                description: desc,
                code: m.code
            });
        });

        // Ensure any materialEntry item currently loaded in the form (from Outward PO or initialData) is present in options
        materialEntries.forEach((entry) => {
            if (entry.material && !optionsMap.has(String(entry.material))) {
                const desc = (entry.description || '').trim();
                const label = desc ? `${entry.materialName || 'Material Item'} — ${desc}` : (entry.materialName || 'Material Item');
                optionsMap.set(String(entry.material), {
                    value: String(entry.material),
                    label: label,
                    description: desc,
                    code: ''
                });
            }
        });

        return Array.from(optionsMap.values());
    }, [safeMaterials, localExtraMaterials, materialEntries]);

    // Open Quick Master Modal
    const handleOpenQuickMasterModal = (initialName: string = '', targetIndex: number | null = null) => {
        console.log('[GRNModal] handleOpenQuickMasterModal called with:', { initialName, targetIndex, currentEntriesCount: materialEntries.length });
        setQuickMasterInitialName(initialName);
        setQuickMasterTargetIndex(targetIndex !== null ? targetIndex : materialEntries.length - 1);
        setIsQuickMasterModalOpen(true);
    };

    // Callback when item is created via QuickItemMasterModal
    const handleQuickItemCreated = (newItem: any) => {
        if (!newItem || !newItem._id) return;

        // 1. Add to local extra materials list
        setLocalExtraMaterials(prev => {
            const exists = prev.some(m => String(m._id) === String(newItem._id));
            return exists ? prev : [...prev, newItem];
        });

        // 2. Populate into the active material entry row
        const targetIdx = quickMasterTargetIndex !== null && quickMasterTargetIndex >= 0 && quickMasterTargetIndex < materialEntries.length
            ? quickMasterTargetIndex
            : materialEntries.length - 1;

        setMaterialEntries(prev => {
            const copy = [...prev];
            const hasSec = Boolean(newItem.hasSecondaryUnit);
            const secUnit = newItem.secondaryUnit || '';
            const conv = Number(newItem.conversionFactor) || 1;

            copy[targetIdx] = {
                ...copy[targetIdx],
                material: String(newItem._id),
                materialName: newItem.name,
                description: newItem.descriptions || newItem.description || '',
                hsnCode: newItem.hsnCode || newItem.hsn || '',
                unit: newItem.unit || 'PCS',
                selectedUnit: newItem.unit || 'PCS',
                category: typeof newItem.categoryId === 'object' ? newItem.categoryId?.name : (newItem.category || ''),
                locationId: typeof newItem.locationId === 'object' ? newItem.locationId?._id : (newItem.locationId || ''),
                hasSecondaryUnit: hasSec,
                secondaryUnit: secUnit,
                conversionFactor: conv,
                quantity: copy[targetIdx].quantity > 0 ? copy[targetIdx].quantity : 1,
                secondaryQuantity: hasSec && conv ? parseFloat(((copy[targetIdx].quantity > 0 ? copy[targetIdx].quantity : 1) * conv).toFixed(4)) : 0
            };
            return copy;
        });

        clearError(`item_${targetIdx}_material`);
    };

    // Handle PO Selection and Auto-Populate Items
    const handleSelectPO = (poId: string) => {
        setSelectedPO(poId);
        if (!poId) {
            setPoNumber('');
            setPoReference('');
            setPoLinkedNotice(null);
            return;
        }

        const foundPO = vendorActivePOs.find(p => p._id === poId);
        if (!foundPO) return;

        setPoNumber(foundPO.poNumber || '');
        setPoReference(foundPO.poNumber || '');

        // Set global tax rate if present on PO
        if (foundPO.taxRate !== undefined && foundPO.taxRate !== null && !isNaN(Number(foundPO.taxRate))) {
            setGlobalTaxRate(Number(foundPO.taxRate));
        }

        const poItemsList: any[] = (Array.isArray(foundPO.items) && foundPO.items.length > 0)
            ? foundPO.items
            : (foundPO.material || foundPO.materialName ? [{
                material: foundPO.material,
                materialName: foundPO.materialName,
                description: foundPO.description,
                quantity: foundPO.quantity,
                receivedQuantity: foundPO.receivedQuantity,
                pendingQuantity: foundPO.pendingQuantity,
                unit: foundPO.unit,
                rate: foundPO.rate,
                category: foundPO.category,
                hsnCode: foundPO.hsnCode
            }] : []);

        if (poItemsList.length > 0) {
            const newEntries: MaterialEntry[] = poItemsList.map((poItem: any) => {
                const materialObj = poItem.material;
                let matId = typeof materialObj === 'object' && materialObj !== null
                    ? String(materialObj._id || '') 
                    : (poItem.material ? String(poItem.material) : (poItem.item ? String(poItem.item) : ''));

                let matName = poItem.materialName || (typeof materialObj === 'object' && materialObj !== null ? materialObj.name : '') || poItem.itemName || poItem.name || '';

                // Try to resolve matching item from safeMaterials
                const matchedSafeMat = safeMaterials.find((m: any) => 
                    (matId && String(m._id) === String(matId)) ||
                    (matName && m.name && m.name.toLowerCase().trim() === matName.toLowerCase().trim())
                );

                if (matchedSafeMat) {
                    if (!matId) matId = String(matchedSafeMat._id);
                    if (!matName) matName = matchedSafeMat.name;
                }

                const desc = poItem.description || poItem.descriptions || 
                    (typeof materialObj === 'object' && materialObj !== null ? (materialObj.descriptions || materialObj.description) : '') ||
                    (matchedSafeMat?.descriptions || matchedSafeMat?.description || '');

                const hsn = poItem.hsnCode || 
                    (typeof materialObj === 'object' && materialObj !== null ? (materialObj.hsnCode || materialObj.hsn) : '') ||
                    (matchedSafeMat?.hsnCode || '');

                let unit = poItem.unit || (typeof materialObj === 'object' && materialObj !== null ? materialObj.unit : '') || matchedSafeMat?.unit || '';
                if (!unit && matchedSafeMat?.categoryId && typeof matchedSafeMat.categoryId === 'object') {
                    unit = matchedSafeMat.categoryId.unit || '';
                }

                let category = poItem.category || '';
                if (!category && typeof materialObj === 'object' && materialObj !== null) {
                    category = typeof materialObj.category === 'object' ? materialObj.category?.name : materialObj.category;
                }
                if (!category && matchedSafeMat) {
                    category = typeof matchedSafeMat.category === 'object' ? matchedSafeMat.category?.name : (matchedSafeMat.category || '');
                }

                let locationId = poItem.locationId || '';
                if (!locationId && typeof materialObj === 'object' && materialObj !== null) {
                    locationId = typeof materialObj.locationId === 'object' ? materialObj.locationId?._id : materialObj.locationId;
                }
                if (!locationId && matchedSafeMat?.locationId) {
                    locationId = typeof matchedSafeMat.locationId === 'object' ? matchedSafeMat.locationId._id : matchedSafeMat.locationId;
                }

                const qty = Number(poItem.quantity) || 0;
                const recQty = Number(poItem.receivedQuantity) || 0;
                const qtyRemaining = poItem.pendingQuantity !== undefined 
                    ? Number(poItem.pendingQuantity) 
                    : Math.max(0, qty - recQty);

                const hasSec = Boolean(matchedSafeMat?.hasSecondaryUnit || poItem?.hasSecondaryUnit);
                const secUnit = matchedSafeMat?.secondaryUnit || poItem?.secondaryUnit || '';
                const convFactor = Number(matchedSafeMat?.conversionFactor || poItem?.conversionFactor) || 0;
                const curStock = Number(matchedSafeMat?.quantity ?? matchedSafeMat?.currentStock ?? 0);
                const secStock = hasSec && convFactor ? curStock * convFactor : 0;
                const finalPriQty = qtyRemaining > 0 ? qtyRemaining : (qty > 0 ? qty : 1);
                const finalSecQty = hasSec && convFactor ? parseFloat((finalPriQty * convFactor).toFixed(4)) : 0;

                const isPoSec = Boolean(
                    hasSec && (
                        poItem.rateUnit === 'secondary' ||
                        (poItem.selectedUnit && secUnit && poItem.selectedUnit.toLowerCase() === secUnit.toLowerCase())
                    )
                );
                const activeSelectedUnit = isPoSec ? secUnit : (poItem.selectedUnit || unit || 'PCS');
                const activeRate = Number(
                    isPoSec && poItem.secondaryRate !== undefined && Number(poItem.secondaryRate) > 0 ? poItem.secondaryRate :
                    (poItem.rate ?? poItem.unitPrice ?? poItem.price ?? foundPO.rate ?? matchedSafeMat?.rate ?? 0)
                );

                return {
                    material: matId,
                    materialName: matName || 'Material Item',
                    description: desc || '',
                    hsnCode: hsn || '',
                    quantity: finalPriQty,
                    unit: unit || 'PCS',
                    category: category || '',
                    locationId: locationId || '',
                    rate: activeRate,
                    rateUnit: isPoSec ? 'secondary' : 'primary',
                    primaryRate: isPoSec && convFactor ? parseFloat((activeRate * convFactor).toFixed(3)) : (poItem.primaryRate || activeRate),
                    secondaryRate: !isPoSec && convFactor ? parseFloat((activeRate / convFactor).toFixed(3)) : (poItem.secondaryRate || activeRate),
                    hasSecondaryUnit: hasSec,
                    secondaryUnit: secUnit,
                    conversionFactor: convFactor,
                    secondaryQuantity: finalSecQty,
                    currentStock: curStock,
                    secondaryCurrentStock: secStock,
                    selectedUnit: activeSelectedUnit,
                };
            });

            setMaterialEntries(newEntries);
            setPoLinkedNotice(`Loaded ${newEntries.length} item(s) from PO #${foundPO.poNumber} with prices, remaining quantities & descriptions`);
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
                const hsn = (typeof fgObj === 'object' && fgObj !== null ? (fgObj.hsnCode || fgObj.hsn) : '') || mrpItem.hsnCode || '';
                const unit = mrpItem.unit || (typeof fgObj === 'object' ? fgObj?.unit : 'PCS') || 'PCS';
                const plannedQty = Number(mrpItem.quantity) || Number(mrpItem.plannedQuantity) || 0;
                const receivedQty = Number(mrpItem.receivedQuantity) || 0;
                const qtyRemaining = mrpItem.pendingQuantity !== undefined 
                    ? Number(mrpItem.pendingQuantity) 
                    : Math.max(0, plannedQty - receivedQty);

                const hasSec = Boolean((typeof fgObj === 'object' && fgObj?.hasSecondaryUnit) || mrpItem.hasSecondaryUnit);
                const secUnit = (typeof fgObj === 'object' ? fgObj?.secondaryUnit : mrpItem.secondaryUnit) || '';
                const convFactor = Number((typeof fgObj === 'object' ? fgObj?.conversionFactor : mrpItem.conversionFactor)) || 0;
                const curStock = Number(typeof fgObj === 'object' ? (fgObj.quantity ?? fgObj.currentStock) : 0) || 0;
                const secStock = hasSec && convFactor ? curStock * convFactor : 0;
                const finalPriQty = qtyRemaining > 0 ? qtyRemaining : plannedQty;
                const finalSecQty = hasSec && convFactor ? parseFloat((finalPriQty * convFactor).toFixed(4)) : 0;

                return {
                    material: fgId,
                    materialName: fgName,
                    description: desc,
                    hsnCode: hsn || '',
                    quantity: finalPriQty,
                    unit: unit,
                    category: 'Finished Goods',
                    locationId: '',
                    rate: Number(mrpItem.rate) || 0,
                    hasSecondaryUnit: hasSec,
                    secondaryUnit: secUnit,
                    conversionFactor: convFactor,
                    secondaryQuantity: finalSecQty,
                    currentStock: curStock,
                    secondaryCurrentStock: secStock,
                    selectedUnit: unit,
                };
            });
            setMaterialEntries(newEntries);
            setPoLinkedNotice(`Auto-loaded ${newEntries.length} FG items from MRP Plan #${foundPlan.mrpNumber}`);
        }
    };

    // Items table handlers
    const handleAddMaterial = (afterIndex?: number) => {
        const newEntry: MaterialEntry = {
            material: '',
            materialName: '',
            description: '',
            hsnCode: '',
            quantity: 0,
            unit: '',
            category: '',
            locationId: '',
            rate: 0,
            amount: 0,
            hasSecondaryUnit: false,
            secondaryUnit: '',
            conversionFactor: 0,
            secondaryQuantity: 0,
            currentStock: 0,
            secondaryCurrentStock: 0,
            selectedUnit: '',
            rateUnit: 'primary',
            primaryRate: 0,
            secondaryRate: 0,
        };
        if (typeof afterIndex === 'number') {
            setMaterialEntries(prev => {
                const updated = [...prev];
                updated.splice(afterIndex + 1, 0, newEntry);
                return updated;
            });
        } else {
            setMaterialEntries(prev => [...prev, newEntry]);
        }
    };

    const handleRemoveMaterial = (index: number) => {
        if (materialEntries.length > 1) {
            setMaterialEntries(prev => prev.filter((_, i) => i !== index));
        }
    };

    const handleUnitToggle = (index: number, targetRateUnit: 'primary' | 'secondary') => {
        setMaterialEntries(prev => {
            const updated = [...prev];
            const current = { ...updated[index] };
            const hasSec = Boolean(current.hasSecondaryUnit && current.secondaryUnit);
            const convFactor = Number(current.conversionFactor) || 1;

            if (!hasSec) return prev;

            const isSwitchingToSec = targetRateUnit === 'secondary';
            current.rateUnit = isSwitchingToSec ? 'secondary' : 'primary';
            current.selectedUnit = isSwitchingToSec ? (current.secondaryUnit || '') : (current.unit || 'PCS');

            current.rate = switchRateUnit(
                current.rateUnit,
                current.rate || 0,
                current.primaryRate,
                current.secondaryRate,
                convFactor
            );

            const pricing = computeDualUomLinePricing({
                quantity: current.quantity,
                unit: current.unit,
                hasSecondaryUnit: hasSec,
                secondaryUnit: current.secondaryUnit,
                conversionFactor: convFactor,
                secondaryQuantity: current.secondaryQuantity,
                rateUnit: current.rateUnit,
                rate: current.rate || 0,
            });

            current.quantity = pricing.quantity;
            current.secondaryQuantity = pricing.secondaryQuantity;
            current.selectedUnit = pricing.selectedUnit;
            current.primaryRate = pricing.primaryRate;
            current.secondaryRate = pricing.secondaryRate;
            current.rate = pricing.rate;
            current.amount = pricing.amount;

            updated[index] = current;
            return updated;
        });
    };

    const handleQuantityInput = (index: number, rawVal: number) => {
        setMaterialEntries(prev => {
            const updated = [...prev];
            const current = { ...updated[index] };
            const hasSec = Boolean(current.hasSecondaryUnit && current.secondaryUnit);
            const convFactor = Number(current.conversionFactor) || 1;
            const isSec = current.rateUnit === 'secondary' && hasSec;

            if (isSec) {
                const synced = syncQuantities('secondaryQuantity', rawVal, convFactor);
                current.secondaryQuantity = synced.secondaryQuantity;
                current.quantity = synced.quantity;
            } else {
                const synced = syncQuantities('quantity', rawVal, convFactor);
                current.quantity = synced.quantity;
                if (hasSec) {
                    current.secondaryQuantity = synced.secondaryQuantity;
                }
            }

            const pricing = computeDualUomLinePricing({
                quantity: current.quantity,
                unit: current.unit,
                hasSecondaryUnit: hasSec,
                secondaryUnit: current.secondaryUnit,
                conversionFactor: convFactor,
                secondaryQuantity: current.secondaryQuantity,
                rateUnit: current.rateUnit || 'primary',
                rate: current.rate || 0,
            });

            current.quantity = pricing.quantity;
            current.secondaryQuantity = pricing.secondaryQuantity;
            current.selectedUnit = pricing.selectedUnit;
            current.primaryRate = pricing.primaryRate;
            current.secondaryRate = pricing.secondaryRate;
            current.rate = pricing.rate;
            current.amount = pricing.amount;

            updated[index] = current;
            return updated;
        });
    };

    const handleRateInput = (index: number, rawRate: number) => {
        setMaterialEntries(prev => {
            const updated = [...prev];
            const current = { ...updated[index] };
            const hasSec = Boolean(current.hasSecondaryUnit && current.secondaryUnit);
            const convFactor = Number(current.conversionFactor) || 1;
            const isSec = current.rateUnit === 'secondary' && hasSec;

            current.rate = rawRate;
            if (isSec) {
                current.secondaryRate = rawRate;
                current.primaryRate = parseFloat((rawRate * convFactor).toFixed(3));
            } else {
                current.primaryRate = rawRate;
                current.secondaryRate = hasSec ? parseFloat((rawRate / convFactor).toFixed(3)) : rawRate;
            }

            const pricing = computeDualUomLinePricing({
                quantity: current.quantity,
                unit: current.unit,
                hasSecondaryUnit: hasSec,
                secondaryUnit: current.secondaryUnit,
                conversionFactor: convFactor,
                secondaryQuantity: current.secondaryQuantity,
                rateUnit: current.rateUnit || 'primary',
                rate: current.rate || 0,
            });

            current.amount = pricing.amount;
            updated[index] = current;
            return updated;
        });
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
                    updated[index].hsnCode = (selectedMaterial as any).hsnCode || (selectedMaterial as any).hsn || '';

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

                    const hasSec = Boolean(selectedMaterial.hasSecondaryUnit);
                    const secUnit = selectedMaterial.secondaryUnit || '';
                    const convFactor = Number(selectedMaterial.conversionFactor) || 0;
                    const curStock = Number(selectedMaterial.quantity ?? (selectedMaterial as any).currentStock ?? 0);
                    const secStock = hasSec && convFactor ? curStock * convFactor : 0;
                    const priQty = Number(updated[index].quantity) || 0;
                    const secQty = hasSec && convFactor ? parseFloat((priQty * convFactor).toFixed(4)) : 0;

                    updated[index].hasSecondaryUnit = hasSec;
                    updated[index].secondaryUnit = secUnit;
                    updated[index].conversionFactor = convFactor;
                    updated[index].currentStock = curStock;
                    updated[index].secondaryCurrentStock = secStock;
                    updated[index].secondaryQuantity = secQty;
                    updated[index].selectedUnit = unitVal || 'PCS';
                    updated[index].rateUnit = 'primary';
                    const curRate = Number(updated[index].rate) || 0;
                    updated[index].primaryRate = curRate;
                    updated[index].secondaryRate = (hasSec && convFactor) ? parseFloat((curRate / convFactor).toFixed(3)) : curRate;

                    const pricing = computeDualUomLinePricing({
                        quantity: priQty,
                        unit: unitVal || 'PCS',
                        hasSecondaryUnit: hasSec,
                        secondaryUnit: secUnit,
                        conversionFactor: convFactor,
                        secondaryQuantity: secQty,
                        rateUnit: 'primary',
                        rate: curRate,
                    });
                    updated[index].amount = pricing.amount;

                    // If creating new GRN and choosing first item, auto-align type with itemType if mismatched
                    if (!isEditing && prev.length === 1) {
                        const matItemType = ((selectedMaterial as any).itemType || '').toLowerCase();
                        if (matItemType.includes('bought') && grnType === 'rm') {
                            handleSwitchType('bo');
                        } else if (matItemType.includes('raw') && grnType === 'bo') {
                            handleSwitchType('rm');
                        }
                    }
                }
            } else if (field === 'quantity') {
                const pVal = Number(value) || 0;
                const convFactor = Number(updated[index].conversionFactor) || 1;
                const hasSec = Boolean(updated[index].hasSecondaryUnit && updated[index].secondaryUnit);
                const synced = syncQuantities('quantity', pVal, convFactor);
                updated[index].quantity = synced.quantity;
                if (hasSec) {
                    updated[index].secondaryQuantity = synced.secondaryQuantity;
                }
                const pricing = computeDualUomLinePricing({
                    quantity: updated[index].quantity,
                    unit: updated[index].unit,
                    hasSecondaryUnit: hasSec,
                    secondaryUnit: updated[index].secondaryUnit,
                    conversionFactor: convFactor,
                    secondaryQuantity: updated[index].secondaryQuantity,
                    rateUnit: updated[index].rateUnit || 'primary',
                    rate: updated[index].rate || 0,
                });
                updated[index].amount = pricing.amount;
            } else if (field === 'secondaryQuantity') {
                const sVal = Number(value) || 0;
                const convFactor = Number(updated[index].conversionFactor) || 1;
                const hasSec = Boolean(updated[index].hasSecondaryUnit && updated[index].secondaryUnit);
                const synced = syncQuantities('secondaryQuantity', sVal, convFactor);
                updated[index].secondaryQuantity = synced.secondaryQuantity;
                if (hasSec) {
                    updated[index].quantity = synced.quantity;
                }
                const pricing = computeDualUomLinePricing({
                    quantity: updated[index].quantity,
                    unit: updated[index].unit,
                    hasSecondaryUnit: hasSec,
                    secondaryUnit: updated[index].secondaryUnit,
                    conversionFactor: convFactor,
                    secondaryQuantity: updated[index].secondaryQuantity,
                    rateUnit: updated[index].rateUnit || 'primary',
                    rate: updated[index].rate || 0,
                });
                updated[index].amount = pricing.amount;
            } else if (field === 'rate') {
                const rVal = Math.max(0, Number(value) || 0);
                const convFactor = Number(updated[index].conversionFactor) || 1;
                const hasSec = Boolean(updated[index].hasSecondaryUnit && updated[index].secondaryUnit);
                const isSec = updated[index].rateUnit === 'secondary' && hasSec;
                updated[index].rate = rVal;
                if (isSec) {
                    updated[index].secondaryRate = rVal;
                    updated[index].primaryRate = parseFloat((rVal * convFactor).toFixed(3));
                } else {
                    updated[index].primaryRate = rVal;
                    updated[index].secondaryRate = hasSec ? parseFloat((rVal / convFactor).toFixed(3)) : rVal;
                }
                const pricing = computeDualUomLinePricing({
                    quantity: updated[index].quantity,
                    unit: updated[index].unit,
                    hasSecondaryUnit: hasSec,
                    secondaryUnit: updated[index].secondaryUnit,
                    conversionFactor: convFactor,
                    secondaryQuantity: updated[index].secondaryQuantity,
                    rateUnit: updated[index].rateUnit || 'primary',
                    rate: rVal,
                });
                updated[index].amount = pricing.amount;
            } else if (field === 'selectedUnit') {
                const hasSec = Boolean(updated[index].hasSecondaryUnit && updated[index].secondaryUnit);
                const isSec = hasSec && value === updated[index].secondaryUnit;
                const convFactor = Number(updated[index].conversionFactor) || 1;
                const targetRateUnit: 'primary' | 'secondary' = isSec ? 'secondary' : 'primary';
                updated[index].rateUnit = targetRateUnit;
                updated[index].selectedUnit = value;
                updated[index].rate = switchRateUnit(
                    targetRateUnit,
                    updated[index].rate || 0,
                    updated[index].primaryRate,
                    updated[index].secondaryRate,
                    convFactor
                );
                const pricing = computeDualUomLinePricing({
                    quantity: updated[index].quantity,
                    unit: updated[index].unit,
                    hasSecondaryUnit: hasSec,
                    secondaryUnit: updated[index].secondaryUnit,
                    conversionFactor: convFactor,
                    secondaryQuantity: updated[index].secondaryQuantity,
                    rateUnit: targetRateUnit,
                    rate: updated[index].rate || 0,
                });
                updated[index].primaryRate = pricing.primaryRate;
                updated[index].secondaryRate = pricing.secondaryRate;
                updated[index].amount = pricing.amount;
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
        if (grnType !== 'inhouse' && grnType !== 'fg' && !supplierId) {
            errors.supplier = "Supplier / Vendor is required";
        }

        if ((grnType === 'inhouse' || grnType === 'fg') && isMrpRequired && !mrpPlan) {
            errors.mrpPlan = "Please select an Open Production MRP Plan";
        }

        materialEntries.forEach((entry, idx) => {
            if (!entry.material && !entry.materialName?.trim()) {
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

        const items = materialEntries.map(entry => {
            let matId = entry.material;
            // If matId is empty, try to resolve from safeMaterials by name
            if (!matId && entry.materialName) {
                const matched = safeMaterials.find((m: any) => m.name && m.name.toLowerCase().trim() === entry.materialName!.toLowerCase().trim());
                if (matched) matId = String(matched._id);
            }

            const priQty = Number(entry.quantity) || 0;
            const hasSec = Boolean(entry.hasSecondaryUnit);
            const secUnit = entry.secondaryUnit || '';
            const convFactor = Number(entry.conversionFactor) || 0;
            const secQty = hasSec ? Number(entry.secondaryQuantity || (priQty * convFactor)) : 0;
            const isSecSelected = Boolean(hasSec && (entry.rateUnit === 'secondary' || entry.selectedUnit === secUnit));
            const billingQty = isSecSelected ? secQty : priQty;
            const itemRate = Number(entry.rate) || 0;
            const itemAmount = entry.amount !== undefined && entry.amount !== null && !isNaN(entry.amount) && entry.amount > 0
                ? entry.amount
                : Number((billingQty * itemRate).toFixed(2));

            return {
                material: matId || undefined,
                consumable: matId || undefined,
                fgItem: matId || undefined,
                materialName: entry.materialName || 'Material Item',
                description: entry.description || '',
                descriptions: entry.description || '',
                hsnCode: entry.hsnCode || '',
                quantity: priQty,
                unit: entry.unit || 'PCS',
                hasSecondaryUnit: hasSec,
                secondaryUnit: secUnit,
                conversionFactor: convFactor,
                secondaryQuantity: secQty,
                secondaryReceivedQuantity: secQty,
                selectedUnit: entry.selectedUnit || entry.unit || 'PCS',
                rateUnit: entry.rateUnit || (isSecSelected ? 'secondary' : 'primary'),
                primaryRate: entry.primaryRate,
                secondaryRate: entry.secondaryRate,
                category: entry.category,
                locationId: entry.locationId || undefined,
                rate: itemRate,
                amount: itemAmount,
            };
        });

        const formData = new FormData();
        formData.append('grnNumber', grnNumber);
        formData.append('date', date);
        formData.append('type', grnType);
        formData.append('qcRequired', String(qcRequired));
        formData.append('items', JSON.stringify(items));

        const isCommercialGRN = grnType !== 'inhouse' && grnType !== 'fg';
        const subtotalCalc = items.reduce((sum, it) => sum + (it.amount || 0), 0);
        const taxRateToSave = isCommercialGRN ? Number(globalTaxRate) || 0 : 0;
        const taxAmountCalc = (subtotalCalc * taxRateToSave) / 100;
        const transportCalc = Math.max(0, Number(transportationCharges) || 0);
        const packingCalc = Math.max(0, Number(packingCharges) || 0);

        const rounding = computeProfessionalTotalWithRoundOff({
            subtotal: subtotalCalc,
            totalTax: taxAmountCalc,
            transportationCharges: transportCalc,
            packagingCharges: packingCalc,
            isRoundOffEnabled,
            roundingMode
        });

        formData.append('taxRate', String(taxRateToSave));
        formData.append('subtotal', String(subtotalCalc));
        formData.append('taxAmount', String(taxAmountCalc));
        formData.append('transportationCharges', String(transportCalc));
        formData.append('packingCharges', String(packingCalc));
        formData.append('preRoundTotal', String(rounding.preRoundTotal));
        formData.append('isRoundOff', String(rounding.isRoundOffEnabled));
        formData.append('roundOff', String(rounding.roundOff));
        formData.append('roundingMode', String(rounding.roundingMode));
        formData.append('totalAmount', String(rounding.roundedGrandTotal));

        if (grnType !== 'inhouse' && grnType !== 'fg') {
            formData.append('supplier', supplierId);
            if (selectedPO) formData.append('purchaseOrder', selectedPO);
            if (invoiceNumber) formData.append('invoiceNumber', invoiceNumber);
            if (poNumber) formData.append('poNumber', poNumber);
            formData.append('poReference', invoiceNumber || poNumber || poReference || '');
            if (pdfFile) formData.append('pdf', pdfFile);
            photoFiles.forEach(photo => formData.append('photos', photo));
            if (isEditing) formData.append('existingPhotos', JSON.stringify(existingPhotos));
        } else {
            if (isMrpRequired && mrpPlan) formData.append('mrpPlan', mrpPlan);
            if (isMrpRequired && mrpNumber) formData.append('mrpNumber', mrpNumber);
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
                invoiceNumber: invoiceNumber || '',
                poNumber: poNumber || '',
                poReference: invoiceNumber || poNumber || poReference || selectedPO,
                items,
                photos: [...existingPhotos, ...localPhotoUrls],
                pdfName: pdfFile?.name,
                qcRequired,
                qcStatus: qcRequired ? 'Pending QC' : 'Passed',
                taxRate: taxRateToSave,
                subtotal: subtotalCalc,
                taxAmount: taxAmountCalc,
                transportationCharges: transportCalc,
                packingCharges: packingCalc,
                totalQuantity: items.reduce((sum, it) => sum + it.quantity, 0),
                totalAmount: rounding.roundedGrandTotal,
                preRoundTotal: rounding.preRoundTotal,
                isRoundOff: rounding.isRoundOffEnabled,
                roundOff: rounding.roundOff,
                roundingMode: rounding.roundingMode
            });
        } catch (err: any) {
            console.error("GRN submission error:", err);
        }
    };

    // Helper to calculate row total based on active selected unit
    const getItemRowTotal = (entry: MaterialEntry) => {
        if (entry.amount !== undefined && entry.amount !== null && !isNaN(entry.amount) && entry.amount > 0) {
            return entry.amount;
        }
        const isSec = Boolean(entry.hasSecondaryUnit && (entry.rateUnit === 'secondary' || entry.selectedUnit === entry.secondaryUnit));
        const billingQty = isSec ? (Number(entry.secondaryQuantity) || 0) : (Number(entry.quantity) || 0);
        return Number((billingQty * (Number(entry.rate) || 0)).toFixed(2));
    };

    // Calculate totals
    const isCommercialGRN = grnType !== 'inhouse' && grnType !== 'fg';
    const totalItemsCount = materialEntries.filter(m => m.material || m.materialName?.trim()).length;
    const totalQuantity = materialEntries.reduce((sum, m) => sum + (Number(m.quantity) || 0), 0);
    const subtotal = materialEntries.reduce((sum, m) => sum + getItemRowTotal(m), 0);
    const taxAmount = isCommercialGRN ? (subtotal * (Number(globalTaxRate) || 0)) / 100 : 0;
    const transportAmount = Number(transportationCharges) || 0;
    const packingAmount = Number(packingCharges) || 0;
    const rounding = useMemo(() => {
        return computeProfessionalTotalWithRoundOff({
            subtotal,
            totalTax: taxAmount,
            transportationCharges: transportAmount,
            packagingCharges: packingAmount,
            isRoundOffEnabled,
            roundingMode
        });
    }, [subtotal, taxAmount, transportAmount, packingAmount, isRoundOffEnabled, roundingMode]);
    const grandTotalWithTax = rounding.roundedGrandTotal;

    const theme = {
        title: grnType === 'inhouse' || grnType === 'fg' 
            ? 'Finished Goods / In-House GRN' 
            : (grnType === 'consumable' ? 'Consumable Items GRN' : (grnType === 'bo' ? 'Bought Out (BO) GRN' : 'Raw Material (RM) GRN')),
        badgeBg: grnType === 'inhouse' || grnType === 'fg' 
            ? 'bg-purple-100 text-purple-800' 
            : (grnType === 'consumable' ? 'bg-amber-100 text-amber-800' : (grnType === 'bo' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800')),
        itemLabel: grnType === 'inhouse' || grnType === 'fg' 
            ? 'Finished Good' 
            : (grnType === 'consumable' ? 'Consumable Material' : (grnType === 'bo' ? 'Bought Out Item' : 'Raw Material')),
        buttonBg: grnType === 'inhouse' || grnType === 'fg' 
            ? 'bg-purple-600 hover:bg-purple-700' 
            : (grnType === 'consumable' ? 'bg-amber-600 hover:bg-amber-700' : (grnType === 'bo' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'))
    };

    if (!isOpen) return null;

    // Post-Submission Success & Preview Screen
    if (createdGRNData) {
        return (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl lg:max-w-4xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh]">
                    
                    {/* Header (Clean light/neutral theme) */}
                    <div className="px-4 sm:px-5 py-3.5 bg-slate-50/95 dark:bg-slate-800/95 text-slate-900 dark:text-slate-100 flex justify-between items-center flex-shrink-0 border-b border-slate-200 dark:border-slate-700/80 backdrop-blur-md">
                        <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center border border-emerald-200 dark:border-emerald-800 shrink-0">
                                <CheckCircle2 className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-sm sm:text-base font-bold tracking-tight flex items-center gap-2">
                                    <span>GRN Generated Successfully</span>
                                    <span className="bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-700 text-[10px] uppercase font-black px-2 py-0.5 rounded-md">
                                        {createdGRNData.grnNumber}
                                    </span>
                                </h2>
                                <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">Goods receipt and inventory balances updated.</p>
                            </div>
                        </div>

                        <button
                            onClick={onClose}
                            className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700/70 dark:hover:bg-slate-600/70 border border-slate-200 dark:border-slate-600 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 transition-all flex items-center justify-center cursor-pointer"
                            title="Close"
                        >
                            <X size={15} />
                        </button>
                    </div>

                    {/* Content Body */}
                    <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
                        
                        {/* Summary Metrics Bar */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
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
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Subtotal</span>
                                <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">₹{(createdGRNData.subtotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                            </div>
                            {createdGRNData.taxRate > 0 && (
                                <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">GST ({createdGRNData.taxRate}%)</span>
                                    <p className="font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">+ ₹{(createdGRNData.taxAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                                </div>
                            )}
                            {createdGRNData.transportationCharges > 0 && (
                                <div>
                                    <span className="text-[10px] font-bold text-blue-500 uppercase">🚚 Transport</span>
                                    <p className="font-bold text-blue-600 dark:text-blue-400 mt-0.5">+ ₹{(createdGRNData.transportationCharges || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                                </div>
                            )}
                            {createdGRNData.packingCharges > 0 && (
                                <div>
                                    <span className="text-[10px] font-bold text-amber-500 uppercase">📦 Packing</span>
                                    <p className="font-bold text-amber-600 dark:text-amber-400 mt-0.5">+ ₹{(createdGRNData.packingCharges || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                                </div>
                            )}
                            <div>
                                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">Grand Total</span>
                                <p className="font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">₹{createdGRNData.totalAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                            </div>
                        </div>

                        {/* Items Table with Descriptions */}
                        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                            <div className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-300 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                                <Layers size={13} className="text-indigo-600" />
                                <span>Materials Received & Inspected</span>
                            </div>
                            <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                                {createdGRNData.items?.map((item: any, idx: number) => {
                                    const disp = resolveGrnLineItemDisplay(item);
                                    return (
                                        <div key={idx} className="p-3 flex items-start justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                            <div className="flex-1">
                                                <div className="font-bold text-slate-900 dark:text-slate-100">{item.materialName}</div>
                                                {item.description && (
                                                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium italic">
                                                        📝 {item.description}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="text-right whitespace-nowrap">
                                                <span className="font-bold text-slate-800 dark:text-slate-200">
                                                    {disp.displayQty} {disp.displayUnit}
                                                    {disp.hasSecondaryUnit && (
                                                        <span className="text-[11px] text-indigo-600 font-semibold ml-1">
                                                            (≈ {disp.isSecondary ? `${disp.baseQty} ${disp.baseUnit}` : `${disp.secondaryQty} ${disp.secondaryUnit}`})
                                                        </span>
                                                    )}
                                                </span>
                                                {disp.displayRate > 0 && (
                                                    <div className="text-[10px] text-slate-400">
                                                        @ ₹{disp.displayRate} / {disp.displayUnit} = ₹{disp.lineAmount.toFixed(2)}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
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
                                onClick={() => generateFrontendGrnPDF({ grn: createdGRNData, companyInfo })}
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
        <>
            <div className="fixed inset-0 z-[150] flex flex-col justify-end sm:justify-center sm:items-center p-0 sm:p-4 md:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto sm:overflow-hidden">
            <div className="bg-white dark:bg-slate-900 rounded-t-[28px] sm:rounded-2xl shadow-2xl w-full max-w-full sm:max-w-[96vw] xl:max-w-7xl 2xl:max-w-[1550px] overflow-hidden border-t sm:border border-slate-200 dark:border-slate-800 flex flex-col h-[94vh] sm:h-auto sm:max-h-[92vh] animate-in slide-in-from-bottom-6 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
                
                {/* Mobile Drawer Drag Handle Indicator */}
                <div className="sm:hidden flex justify-center pt-2.5 pb-1 bg-slate-50/95 dark:bg-slate-800/95 border-b border-slate-100 dark:border-slate-700/50">
                    <div className="w-12 h-1 bg-slate-300 dark:bg-slate-600 rounded-full" />
                </div>

                {/* Clean Light / Neutral Header (Top dark theme removed) */}
                <div className="px-3.5 sm:px-5 py-2.5 sm:py-3 bg-slate-50/95 dark:bg-slate-800/95 text-slate-900 dark:text-slate-100 flex flex-wrap justify-between items-center gap-2 sm:gap-3 flex-shrink-0 border-b border-slate-200 dark:border-slate-700/80 backdrop-blur-md">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800/80 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                            <Upload className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-sm sm:text-base font-bold tracking-tight flex items-center gap-2 truncate">
                                <span className="truncate">{isEditing ? `Edit ${theme.title}` : `New ${theme.title}`}</span>
                                <span className="bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-700 text-[10px] uppercase font-black px-2 py-0.5 rounded-md shrink-0">
                                    {grnType.toUpperCase()}
                                </span>
                            </h2>
                        </div>
                    </div>

                    {!isEditing && (
                        <div className="flex items-center gap-1 bg-slate-200/70 dark:bg-slate-700/60 p-1 rounded-xl border border-slate-300/60 dark:border-slate-600/60 overflow-x-auto max-w-full custom-scrollbar">
                            {[
                                { id: 'rm', label: 'RM', fullLabel: 'Raw Material (RM)', activeClass: 'bg-blue-600 text-white shadow-xs' },
                                { id: 'bo', label: 'BO', fullLabel: 'Bought Out (BO)', activeClass: 'bg-emerald-600 text-white shadow-xs' },
                                { id: 'consumable', label: 'Consumable', fullLabel: 'Consumable', activeClass: 'bg-amber-600 text-white shadow-xs' },
                                { id: 'inhouse', label: 'FG', fullLabel: 'Finished Goods (FG)', activeClass: 'bg-purple-600 text-white shadow-xs' },
                            ].map((t) => (
                                <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => handleSwitchType(t.id)}
                                    className={`px-2 sm:px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                                        grnType === t.id
                                            ? t.activeClass
                                            : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-600/60'
                                    }`}
                                >
                                    <span className="hidden sm:inline">{t.fullLabel}</span>
                                    <span className="sm:hidden">{t.label}</span>
                                </button>
                            ))}
                        </div>
                    )}

                    <button
                        onClick={onClose}
                        className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700/70 dark:hover:bg-slate-600/70 border border-slate-200 dark:border-slate-600 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 transition-all flex items-center justify-center cursor-pointer ml-auto sm:ml-0"
                        title="Close"
                    >
                        <X size={15} />
                    </button>
                </div>

                {/* Form Body with Scrollable Content and Sticky Bottom Action Footer */}
                <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    
                    {/* Scrollable Content Area */}
                    <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-3.5">
                    
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
                            {grnType !== 'inhouse' && grnType !== 'fg' && (
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

                            {/* For FG / InHouse GRN: Simple MRP Compulsory Toggle & Simple QC Check Toggle */}
                            {(grnType === 'inhouse' || grnType === 'fg') && (
                                <>
                                    {/* Simple MRP Compulsory Toggle */}
                                    <div className="flex flex-col justify-center">
                                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                            MRP Compulsory
                                        </span>
                                        <div className="h-9 flex items-center">
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input 
                                                    type="checkbox" 
                                                    checked={isMrpRequired} 
                                                    onChange={(e) => {
                                                        const checked = e.target.checked;
                                                        setIsMrpRequired(checked);
                                                        if (!checked) {
                                                            setMrpPlan('');
                                                            setMrpNumber('');
                                                            clearError('mrpPlan');
                                                        }
                                                    }} 
                                                    className="sr-only peer" 
                                                />
                                                <div className="w-10 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-purple-600"></div>
                                                <span className="ml-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                                                    {isMrpRequired ? 'Required' : 'Direct Inward'}
                                                </span>
                                            </label>
                                        </div>
                                    </div>

                                    {/* Simple QC Check Toggle for FG */}
                                    <div className="flex flex-col justify-center">
                                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                            QC Check Required
                                        </span>
                                        <div className="h-9 flex items-center">
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input 
                                                    type="checkbox" 
                                                    checked={qcRequired} 
                                                    onChange={(e) => setQcRequired(e.target.checked)} 
                                                    className="sr-only peer" 
                                                />
                                                <div className="w-10 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
                                                <span className="ml-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                                                    {qcRequired ? 'Pending QC' : 'Direct Inward'}
                                                </span>
                                            </label>
                                        </div>
                                    </div>

                                    {/* Open Production MRP Plan Dropdown - Shown ONLY if MRP is Compulsory */}
                                    {isMrpRequired && (
                                        <div className="col-span-1 sm:col-span-2 lg:col-span-4 p-3 bg-purple-50/70 dark:bg-purple-950/40 rounded-xl border border-purple-200 dark:border-purple-800/80" data-has-error={!!formErrors.mrpPlan}>
                                            <label className="block text-[11px] font-bold text-purple-900 dark:text-purple-300 mb-1 flex items-center justify-between">
                                                <span>Open Production MRP Plan <span className="text-red-500">*</span></span>
                                                {formErrors.mrpPlan ? (
                                                    <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold">{formErrors.mrpPlan}</span>
                                                ) : (
                                                    <span className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold">({openMrpPlans.length} Open MRP{openMrpPlans.length !== 1 ? 's' : ''})</span>
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
                                                        : 'bg-white dark:bg-slate-900 border-purple-300 dark:border-purple-800 text-purple-950 dark:text-purple-200 focus:ring-purple-500'
                                                }`}
                                            >
                                                <option value="">-- Select Open Purchase MRP Plan * --</option>
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
                                    )}
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

                            {/* PO Number */}
                            {type !== 'inhouse' && type !== 'fg' && (
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                                        <span>PO Number</span>
                                        {selectedPO && <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">Linked</span>}
                                    </label>
                                    <input
                                        type="text"
                                        value={poNumber}
                                        onChange={(e) => {
                                            setPoNumber(e.target.value);
                                            setPoReference(e.target.value);
                                        }}
                                        readOnly={!!selectedPO}
                                        placeholder={selectedPO ? "From selected PO" : "Direct / Offline PO"}
                                        className={`w-full h-9 px-2.5 border rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 ${
                                            selectedPO 
                                                ? 'bg-indigo-50/50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800 text-indigo-950 dark:text-indigo-200 font-semibold cursor-not-allowed'
                                                : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700'
                                        }`}
                                    />
                                </div>
                            )}

                            {/* Invoice Number */}
                            {type !== 'inhouse' && type !== 'fg' && (
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        Invoice Number
                                    </label>
                                    <input
                                        type="text"
                                        value={invoiceNumber}
                                        onChange={(e) => {
                                            setInvoiceNumber(e.target.value);
                                            if (!poNumber) setPoReference(e.target.value);
                                        }}
                                        placeholder="e.g. INV-2024-001"
                                        className="w-full h-9 px-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                            )}

                            {/* Quality Check (QC Required) Toggle Bar for RM/BO */}
                            {type !== 'inhouse' && type !== 'fg' && (
                                <div className="col-span-1 sm:col-span-2 lg:col-span-4 flex items-center justify-between p-2.5 sm:p-3 bg-indigo-50/70 dark:bg-slate-800/80 rounded-xl border border-indigo-200 dark:border-slate-700 mt-1">
                                    <div className="flex items-center gap-2.5">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 ${qcRequired ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                                            <ShieldCheck className="w-4 h-4" />
                                        </div>
                                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                            <span>Quality Check (QC) Required</span>
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${qcRequired ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
                                                {qcRequired ? 'Send to Incoming QC' : 'Direct Inward'}
                                            </span>
                                        </div>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-2">
                                        <input 
                                            type="checkbox" 
                                            checked={qcRequired} 
                                            onChange={(e) => setQcRequired(e.target.checked)} 
                                            className="sr-only peer" 
                                        />
                                        <div className="w-10 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
                                    </label>
                                </div>
                            )}
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
                        <div className="px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                                <Layers className="w-4 h-4 text-indigo-600 shrink-0" />
                                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 truncate">
                                    <span>Item Details</span>
                                    <span className="hidden sm:inline"> & Descriptions</span>
                                </h3>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shrink-0">
                                    {materialEntries.length} <span className="hidden sm:inline">Item(s)</span>
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => handleOpenQuickMasterModal()}
                                    className="p-1.5 sm:px-3 sm:py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                                    title="Item not in master? Click to register a new master item on the fly"
                                    aria-label="Add New Master Item"
                                >
                                    <PackagePlus className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                                    <span className="hidden sm:inline">+ Add New Master Item</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleAddMaterial()}
                                    className="p-1.5 sm:px-3 sm:py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1"
                                    title="Add Row"
                                    aria-label="Add Row"
                                >
                                    <Plus className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                                    <span className="hidden sm:inline">Add Row</span>
                                </button>
                            </div>
                        </div>

                        {/* Desktop View: Wide Responsive Table with Upward Dropdowns */}
                        <div className="hidden md:block overflow-x-auto min-h-[220px] custom-scrollbar">
                            <table className="w-full text-left border-collapse table-auto">
                                <thead>
                                    <tr className="bg-slate-100/75 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                                        <th className="py-2.5 px-3 w-12 text-center shrink-0">#</th>
                                        <th className="py-2.5 px-3 min-w-[260px] lg:min-w-[340px]">{theme.itemLabel} & Description <span className="text-red-500">*</span></th>
                                        <th className="py-2.5 px-2.5 w-28 lg:w-32 text-center shrink-0">HSN/SAC</th>
                                        <th className="py-2.5 px-3 w-32 lg:w-36 text-center shrink-0">Unit & Stock</th>
                                        <th className="py-2.5 px-3 w-36 lg:w-40 shrink-0">Qty Received <span className="text-red-500">*</span></th>
                                        <th className="py-2.5 px-3 w-32 lg:w-36 shrink-0">Rate (₹ / Unit)</th>
                                        <th className="py-2.5 px-3 w-36 lg:w-44 text-right shrink-0 whitespace-nowrap">Total (₹)</th>
                                        <th className="py-2.5 px-3 w-20 text-center shrink-0">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                                    {materialEntries.map((entry, index) => {
                                        const isSecSelected = Boolean(entry.hasSecondaryUnit && (entry.rateUnit === 'secondary' || entry.selectedUnit === entry.secondaryUnit));
                                        const rowTotal = getItemRowTotal(entry);
                                        const activeUnit = isSecSelected ? (entry.secondaryUnit || '') : (entry.unit || 'PCS');
                                        const activeQty = isSecSelected ? (Number(entry.secondaryQuantity) || 0) : (Number(entry.quantity) || 0);
                                        const hasMaterialError = !!formErrors[`item_${index}_material`];
                                        const hasQuantityError = !!formErrors[`item_${index}_quantity`];

                                        return (
                                            <tr key={index} className="hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 transition-colors">
                                                <td className="py-2 px-3 text-center text-slate-400 font-bold shrink-0">
                                                    {index + 1}
                                                </td>
                                                <td className="py-2 px-3 min-w-0" data-has-error={hasMaterialError}>
                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                        <div className="flex-1 min-w-0">
                                                            <SearchableSelect
                                                                options={materialOptions}
                                                                value={entry.material}
                                                                displayLabel={entry.materialName ? (entry.description ? `${entry.materialName} — ${entry.description}` : entry.materialName) : undefined}
                                                                allowCustom={true}
                                                                onCreateCustom={(typedQuery) => handleOpenQuickMasterModal(typedQuery, index)}
                                                                hasError={hasMaterialError}
                                                                onChange={(val: any) => {
                                                                    handleMaterialChange(index, 'material', val);
                                                                    if (val) clearError(`item_${index}_material`);
                                                                }}
                                                                placeholder={`Search ${theme.itemLabel}...`}
                                                                dropdownPosition="auto"
                                                            />
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenQuickMasterModal('', index)}
                                                            className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-900/60 rounded-lg border border-emerald-200 dark:border-emerald-800 transition-colors shrink-0 cursor-pointer"
                                                            title="Add new item to Master"
                                                        >
                                                            <PackagePlus size={14} />
                                                        </button>
                                                    </div>
                                                    {hasMaterialError && (
                                                        <div className="text-[10px] text-rose-600 dark:text-rose-400 font-bold mt-0.5 flex items-center gap-1">
                                                            <span>⚠️</span>
                                                            <span>{formErrors[`item_${index}_material`]}</span>
                                                        </div>
                                                    )}
                                                    {entry.description && !hasMaterialError && (
                                                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate mt-1 flex items-center gap-1 min-w-0" title={entry.description}>
                                                            <span className="shrink-0">📝</span>
                                                            <span className="truncate italic">{entry.description}</span>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="py-2 px-2.5 w-28 lg:w-32 shrink-0">
                                                    <input
                                                        type="text"
                                                        value={entry.hsnCode || ''}
                                                        onChange={(e) => handleMaterialChange(index, 'hsnCode', e.target.value)}
                                                        placeholder="HSN Code"
                                                        className="w-full h-9 px-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono text-center focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-200"
                                                    />
                                                </td>

                                                {/* Column 4: Unit & Stock (Swapped to come before Qty Received) */}
                                                <td className="py-2 px-3 w-32 lg:w-36 text-center shrink-0">
                                                    <div className="flex flex-col items-center gap-1">
                                                        {entry.hasSecondaryUnit && entry.secondaryUnit ? (
                                                            <div className="w-full space-y-1">
                                                                <div className="flex items-center p-0.5 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleUnitToggle(index, 'primary')}
                                                                        className={`flex-1 py-1 px-1 rounded-lg text-[10.5px] font-extrabold transition-all cursor-pointer text-center truncate ${
                                                                            entry.rateUnit !== 'secondary'
                                                                                ? 'bg-indigo-600 text-white shadow-xs'
                                                                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                                                        }`}
                                                                        title={`Receive and Rate in Base Unit: ${entry.unit}`}
                                                                    >
                                                                        {entry.unit}
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleUnitToggle(index, 'secondary')}
                                                                        className={`flex-1 py-1 px-1 rounded-lg text-[10.5px] font-extrabold transition-all cursor-pointer text-center truncate ${
                                                                            entry.rateUnit === 'secondary'
                                                                                ? 'bg-purple-600 text-white shadow-xs'
                                                                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                                                        }`}
                                                                        title={`Receive and Rate in Secondary Unit: ${entry.secondaryUnit}`}
                                                                    >
                                                                        {entry.secondaryUnit}
                                                                    </button>
                                                                </div>
                                                                <div className="text-[9.5px] font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                                                                    1 {entry.unit} = {entry.conversionFactor} {entry.secondaryUnit}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <span className="inline-block px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-[11px] font-bold border border-slate-200 dark:border-slate-700">
                                                                {entry.unit || 'PCS'}
                                                            </span>
                                                        )}
                                                        {entry.material && (
                                                            <div className="text-[9.5px] text-slate-400 mt-0.5" title="Live Stock in Store">
                                                                Stock: {entry.currentStock || 0} {entry.unit}
                                                                {entry.hasSecondaryUnit && entry.secondaryUnit && (
                                                                    <div>({(Number(entry.secondaryCurrentStock) || 0).toFixed(2)} {entry.secondaryUnit})</div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Column 5: Single Adaptive Quantity Received */}
                                                <td className="py-2 px-3 w-36 lg:w-40 shrink-0" data-has-error={hasQuantityError}>
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-1.5">
                                                            <input
                                                                type="number"
                                                                min="0.0001"
                                                                step="any"
                                                                value={
                                                                    (entry.rateUnit === 'secondary' && entry.hasSecondaryUnit
                                                                        ? entry.secondaryQuantity
                                                                        : entry.quantity) || ''
                                                                }
                                                                onChange={(e) => {
                                                                    const val = parseFloat(e.target.value) || 0;
                                                                    handleQuantityInput(index, val);
                                                                    if (val > 0) clearError(`item_${index}_quantity`);
                                                                }}
                                                                placeholder="0.00"
                                                                className={`w-full h-9 px-2.5 border rounded-xl text-xs font-bold text-center outline-none transition-all font-mono ${
                                                                    hasQuantityError
                                                                        ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-100 ring-1 ring-rose-400 focus:ring-rose-500'
                                                                        : (entry.rateUnit === 'secondary' && entry.hasSecondaryUnit)
                                                                            ? 'bg-white dark:bg-slate-900 border-purple-300 dark:border-purple-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-purple-500'
                                                                            : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500'
                                                                }`}
                                                            />
                                                            <span className={`px-2 py-1 rounded-lg text-[10.5px] font-mono font-bold shrink-0 border ${
                                                                (entry.rateUnit === 'secondary' && entry.hasSecondaryUnit)
                                                                    ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800'
                                                                    : 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800'
                                                            }`}>
                                                                {entry.rateUnit === 'secondary' && entry.hasSecondaryUnit ? entry.secondaryUnit : (entry.unit || 'PCS')}
                                                            </span>
                                                        </div>
                                                        {hasQuantityError && (
                                                            <div className="text-[9px] text-rose-600 dark:text-rose-400 font-bold mt-0.5 text-center">
                                                                {formErrors[`item_${index}_quantity`]}
                                                            </div>
                                                        )}

                                                        {/* Real-time Auto-Conversion Preview */}
                                                        {entry.hasSecondaryUnit && (entry.conversionFactor || 0) > 0 && (
                                                            <div className="text-[10px] font-semibold text-center whitespace-nowrap font-mono">
                                                                {entry.rateUnit === 'secondary' ? (
                                                                    <span className="text-indigo-600 dark:text-indigo-400">≈ <strong className="font-bold">{entry.quantity || 0}</strong> {entry.unit}</span>
                                                                ) : (
                                                                    <span className="text-purple-600 dark:text-purple-400">≈ <strong className="font-bold">{entry.secondaryQuantity || 0}</strong> {entry.secondaryUnit}</span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Column 6: Rate (₹ / Unit) */}
                                                <td className="py-2 px-3 w-32 lg:w-36 shrink-0">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="any"
                                                        value={entry.rate || ''}
                                                        onChange={(e) => handleRateInput(index, parseFloat(e.target.value) || 0)}
                                                        placeholder="0.00"
                                                        className="w-full h-9 px-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                                                    />
                                                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5 truncate" title={`Rate applied per ${activeUnit}`}>
                                                        ₹ / {activeUnit}
                                                    </div>
                                                    {entry.hasSecondaryUnit && (entry.conversionFactor || 0) > 0 && (Number(entry.rate) || 0) > 0 && (
                                                        <div className="text-[9.5px] text-indigo-600 dark:text-indigo-400 font-medium truncate">
                                                            {entry.rateUnit === 'secondary' 
                                                                ? `(Eq: ₹${((entry.rate || 0) * entry.conversionFactor!).toFixed(2)} / ${entry.unit})`
                                                                : `(Eq: ₹${((entry.rate || 0) / entry.conversionFactor!).toFixed(2)} / ${entry.secondaryUnit})`
                                                            }
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="py-2 px-3 w-36 lg:w-44 text-right font-mono font-bold text-slate-900 dark:text-slate-100 shrink-0 whitespace-nowrap">
                                                    <div>₹{rowTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                                    {activeQty > 0 && (Number(entry.rate) || 0) > 0 && (
                                                        <div className="text-[9.5px] font-normal text-slate-400 font-sans mt-0.5">
                                                            {activeQty} {activeUnit} × ₹{entry.rate}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="py-2 px-3 w-20 text-center shrink-0">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleAddMaterial(index)}
                                                            className="p-1 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/60 rounded-lg transition-colors cursor-pointer"
                                                            title="Add new item below"
                                                        >
                                                            <Plus className="w-4 h-4" />
                                                        </button>
                                                        {materialEntries.length > 1 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveMaterial(index)}
                                                                className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
                                                                title="Delete row"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
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
                                const isSecSelected = Boolean(entry.hasSecondaryUnit && (entry.rateUnit === 'secondary' || entry.selectedUnit === entry.secondaryUnit));
                                const rowTotal = getItemRowTotal(entry);
                                const activeUnit = isSecSelected ? (entry.secondaryUnit || '') : (entry.selectedUnit || entry.unit || 'Unit');
                                const activeQty = isSecSelected ? (Number(entry.secondaryQuantity) || 0) : (Number(entry.quantity) || 0);
                                const hasMaterialError = !!formErrors[`item_${index}_material`];
                                const hasQuantityError = !!formErrors[`item_${index}_quantity`];

                                return (
                                    <div key={index} className={`bg-white dark:bg-slate-900 p-3 rounded-xl border shadow-2xs space-y-2.5 transition-all ${hasMaterialError || hasQuantityError ? 'border-rose-300 dark:border-rose-800 bg-rose-50/20' : 'border-slate-200 dark:border-slate-700'}`}>
                                        
                                        {/* Card Header: Index & Actions */}
                                        <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
                                            <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-100 dark:border-indigo-800">
                                                Item #{index + 1}
                                            </span>
                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => handleAddMaterial(index)}
                                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50/80 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 px-2 py-0.5 rounded-lg border border-indigo-200 dark:border-indigo-800 transition-colors cursor-pointer"
                                                    title="Add item below"
                                                >
                                                    <Plus className="w-3 h-3" />
                                                    <span>Add</span>
                                                </button>
                                                {materialEntries.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveMaterial(index)}
                                                        className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 p-1 rounded-lg transition-colors cursor-pointer"
                                                        title="Delete this item"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Material Selection with Description */}
                                        <div data-has-error={hasMaterialError}>
                                            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1 flex items-center justify-between">
                                                <span>{theme.itemLabel} <span className="text-red-500">*</span></span>
                                                {hasMaterialError && <span className="text-rose-600 dark:text-rose-400 font-bold">{formErrors[`item_${index}_material`]}</span>}
                                            </label>
                                            <div className="flex items-center gap-1.5">
                                                <div className="flex-1">
                                                    <SearchableSelect
                                                        options={materialOptions}
                                                        value={entry.material}
                                                        displayLabel={entry.materialName ? `${entry.materialName}${entry.description ? ` — ${entry.description}` : ''}` : undefined}
                                                        allowCustom={true}
                                                        onCreateCustom={(typedQuery) => handleOpenQuickMasterModal(typedQuery, index)}
                                                        hasError={hasMaterialError}
                                                        onChange={(val: any) => {
                                                            handleMaterialChange(index, 'material', val);
                                                            if (val) clearError(`item_${index}_material`);
                                                        }}
                                                        placeholder={`Select ${theme.itemLabel}...`}
                                                        dropdownPosition="auto"
                                                    />
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenQuickMasterModal('', index)}
                                                    className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 rounded-lg border border-emerald-200 dark:border-emerald-800 transition-colors shrink-0 cursor-pointer"
                                                    title="Add new item to Master"
                                                >
                                                    <PackagePlus size={14} />
                                                </button>
                                            </div>
                                            {entry.description && !hasMaterialError && (
                                                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate mt-1">
                                                    📝 {entry.description}
                                                </div>
                                            )}
                                        </div>

                                        {/* HSN/SAC Code */}
                                        <div>
                                            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                                                HSN/SAC Code
                                            </label>
                                            <input
                                                type="text"
                                                value={entry.hsnCode || ''}
                                                onChange={(e) => handleMaterialChange(index, 'hsnCode', e.target.value)}
                                                placeholder="HSN Code"
                                                className="w-full h-8 px-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono text-center outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-200"
                                            />
                                        </div>

                                        {/* Qty, Unit & Rate Grid (Unit FIRST, then Qty, then Rate) */}
                                        <div className="grid grid-cols-3 gap-2 items-start">
                                            {/* 1. Unit Selector First */}
                                            <div className="col-span-1">
                                                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                                                    Unit
                                                </label>
                                                {entry.hasSecondaryUnit && entry.secondaryUnit ? (
                                                    <div className="flex items-center p-0.5 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs h-9">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleUnitToggle(index, 'primary')}
                                                            className={`flex-1 h-full rounded-lg text-[10px] font-extrabold transition-all cursor-pointer text-center truncate ${
                                                                entry.rateUnit !== 'secondary'
                                                                    ? 'bg-indigo-600 text-white shadow-xs'
                                                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                                            }`}
                                                            title={`Receive in ${entry.unit}`}
                                                        >
                                                            {entry.unit}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleUnitToggle(index, 'secondary')}
                                                            className={`flex-1 h-full rounded-lg text-[10px] font-extrabold transition-all cursor-pointer text-center truncate ${
                                                                entry.rateUnit === 'secondary'
                                                                    ? 'bg-purple-600 text-white shadow-xs'
                                                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                                            }`}
                                                            title={`Receive in ${entry.secondaryUnit}`}
                                                        >
                                                            {entry.secondaryUnit}
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="w-full h-9 flex items-center justify-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300">
                                                        {entry.unit || 'PCS'}
                                                    </div>
                                                )}
                                                {entry.hasSecondaryUnit && (
                                                    <div className="text-[8.5px] font-bold text-indigo-600 dark:text-indigo-400 mt-1 truncate">
                                                        1 {entry.unit} = {entry.conversionFactor} {entry.secondaryUnit}
                                                    </div>
                                                )}
                                            </div>

                                            {/* 2. Adaptive Quantity Received */}
                                            <div className="col-span-1" data-has-error={hasQuantityError}>
                                                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1 flex items-center justify-between">
                                                    <span>Qty <span className="text-red-500">*</span></span>
                                                    {hasQuantityError && <span className="text-rose-600 font-bold">Req</span>}
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0.0001"
                                                    step="any"
                                                    value={
                                                        (entry.rateUnit === 'secondary' && entry.hasSecondaryUnit
                                                            ? entry.secondaryQuantity
                                                            : entry.quantity) || ''
                                                    }
                                                    onChange={(e) => {
                                                        const val = parseFloat(e.target.value) || 0;
                                                        handleQuantityInput(index, val);
                                                        if (val > 0) clearError(`item_${index}_quantity`);
                                                    }}
                                                    placeholder="Qty"
                                                    className={`w-full h-9 px-2 border rounded-xl text-xs font-bold text-center outline-none transition-all font-mono ${
                                                        hasQuantityError
                                                            ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-100 ring-1 ring-rose-400 focus:ring-rose-500'
                                                            : (entry.rateUnit === 'secondary' && entry.hasSecondaryUnit)
                                                                ? 'bg-white dark:bg-slate-900 border-purple-300 dark:border-purple-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-purple-500'
                                                                : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500'
                                                    }`}
                                                />
                                                {entry.hasSecondaryUnit && (entry.conversionFactor || 0) > 0 && (
                                                    <div className="text-[9px] font-semibold text-center mt-1 truncate font-mono">
                                                        {entry.rateUnit === 'secondary' ? (
                                                            <span className="text-indigo-600 dark:text-indigo-400">≈ <strong className="font-bold">{entry.quantity || 0}</strong> {entry.unit}</span>
                                                        ) : (
                                                            <span className="text-purple-600 dark:text-purple-400">≈ <strong className="font-bold">{entry.secondaryQuantity || 0}</strong> {entry.secondaryUnit}</span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* 3. Dynamic Rate */}
                                            <div className="col-span-1">
                                                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1 truncate">
                                                    Rate (₹/{activeUnit})
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="any"
                                                    value={entry.rate || ''}
                                                    onChange={(e) => handleRateInput(index, parseFloat(e.target.value) || 0)}
                                                    placeholder="Rate"
                                                    className="w-full h-9 px-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                                                />
                                                {entry.hasSecondaryUnit && (entry.conversionFactor || 0) > 0 && (Number(entry.rate) || 0) > 0 && (
                                                    <div className="text-[8.5px] text-indigo-600 dark:text-indigo-400 font-medium mt-1 truncate">
                                                        {entry.rateUnit === 'secondary' 
                                                            ? `Eq: ₹${((entry.rate || 0) * entry.conversionFactor!).toFixed(2)}/${entry.unit}`
                                                            : `Eq: ₹${((entry.rate || 0) / entry.conversionFactor!).toFixed(2)}/${entry.secondaryUnit}`
                                                        }
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Mobile Stock Info */}
                                        {entry.material && (
                                            <div className="text-[10px] text-slate-500 flex justify-between bg-slate-50 dark:bg-slate-800/60 p-1.5 rounded-lg border border-slate-100 dark:border-slate-800">
                                                <span>Live Stock:</span>
                                                <span className="font-semibold text-slate-700 dark:text-slate-300">
                                                    {entry.currentStock || 0} {entry.unit}
                                                    {entry.hasSecondaryUnit && entry.secondaryUnit && ` (${(Number(entry.secondaryCurrentStock) || 0).toFixed(2)} ${entry.secondaryUnit})`}
                                                </span>
                                            </div>
                                        )}

                                        {/* Total Amount Bar */}
                                        <div className="flex items-center justify-between pt-1 text-xs">
                                            <div className="flex flex-col">
                                                <span className="text-slate-500 font-semibold">Row Total:</span>
                                                {activeQty > 0 && (Number(entry.rate) || 0) > 0 && (
                                                    <span className="text-[9.5px] text-slate-400 font-normal">
                                                        {activeQty} {activeUnit} × ₹{entry.rate}
                                                    </span>
                                                )}
                                            </div>
                                            <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                                                ₹{rowTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Mobile "+ Add Another Item" Button */}
                            <button
                                type="button"
                                onClick={() => handleAddMaterial()}
                                className="w-full py-2.5 px-3 border-2 border-dashed border-indigo-300 dark:border-indigo-800/80 hover:border-indigo-500 dark:hover:border-indigo-600 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                            >
                                <Plus className="w-4 h-4" />
                                <span>+ Add Another {theme.itemLabel}</span>
                            </button>
                        </div>

                        {/* Global Tax Rate Selector Bar (for RM, BO, Consumables) */}
                        {isCommercialGRN && (
                            <div className="p-3 bg-gradient-to-r from-slate-50 via-indigo-50/40 to-slate-50 dark:from-slate-900/80 dark:via-indigo-950/20 dark:to-slate-900/80 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                                <div className="flex items-center gap-2.5 flex-wrap">
                                    <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-200">
                                        <Percent size={14} className="text-indigo-600 dark:text-indigo-400" />
                                        <span>Global Tax / GST Rate:</span>
                                    </div>
                                    
                                    {/* Preset Buttons */}
                                    <div className="inline-flex items-center rounded-xl bg-slate-200/80 dark:bg-slate-800 p-0.5 gap-1 border border-slate-300/80 dark:border-slate-700 shadow-2xs">
                                        {[0, 5, 12, 18, 28].map((rate) => {
                                            const isActive = Number(globalTaxRate) === rate;
                                            return (
                                                <button
                                                    key={rate}
                                                    type="button"
                                                    onClick={() => setGlobalTaxRate(rate)}
                                                    className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                                                        isActive
                                                            ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-500 scale-[1.02]'
                                                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/70 dark:hover:bg-slate-700/60'
                                                    }`}
                                                >
                                                    {rate}%
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* Custom Tax Rate Input */}
                                    <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-2 py-0.5 shadow-2xs focus-within:ring-2 focus-within:ring-indigo-500">
                                        <span className="text-[11px] text-slate-400 font-semibold">Custom:</span>
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            step="0.1"
                                            value={globalTaxRate === 0 && ![0, 5, 12, 18, 28].includes(globalTaxRate) ? '' : globalTaxRate}
                                            onChange={(e) => {
                                                const val = parseFloat(e.target.value);
                                                setGlobalTaxRate(isNaN(val) ? 0 : Math.max(0, Math.min(100, val)));
                                            }}
                                            placeholder="0"
                                            className="w-10 bg-transparent text-center font-bold text-slate-800 dark:text-slate-200 outline-none text-xs"
                                        />
                                        <span className="text-xs font-black text-slate-500">%</span>
                                    </div>
                                </div>

                                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                    {globalTaxRate > 0 ? (
                                        <span className="text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1">
                                            <CheckCircle2 size={12} />
                                            {globalTaxRate}% GST applied globally
                                        </span>
                                    ) : (
                                        <span className="text-slate-400 italic">0% GST (Tax Exempt / Non-GST)</span>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Additional Charges Bar (Transportation & Packing) */}
                        {isCommercialGRN && (
                            <div className="p-3 bg-slate-50/90 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                                <div className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-200">
                                    <Truck size={15} className="text-blue-600 dark:text-blue-400" />
                                    <span>Additional Charges:</span>
                                </div>

                                <div className="flex items-center gap-4 flex-wrap">
                                    {/* Transportation Charges Input */}
                                    <div className="flex items-center gap-2">
                                        <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                                            <Truck size={13} className="text-blue-500" />
                                            Transportation (₹):
                                        </span>
                                        <input
                                            type="number"
                                            min="0"
                                            step="any"
                                            value={transportationCharges === 0 ? '' : transportationCharges}
                                            onChange={(e) => {
                                                const val = parseFloat(e.target.value);
                                                setTransportationCharges(isNaN(val) ? 0 : Math.max(0, val));
                                            }}
                                            placeholder="0.00"
                                            className="w-28 h-8 px-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-right font-mono"
                                        />
                                    </div>

                                    {/* Packing Charges Input */}
                                    <div className="flex items-center gap-2">
                                        <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                                            <Package size={13} className="text-amber-500" />
                                            Packing (₹):
                                        </span>
                                        <input
                                            type="number"
                                            min="0"
                                            step="any"
                                            value={packingCharges === 0 ? '' : packingCharges}
                                            onChange={(e) => {
                                                const val = parseFloat(e.target.value);
                                                setPackingCharges(isNaN(val) ? 0 : Math.max(0, val));
                                            }}
                                            placeholder="0.00"
                                            className="w-28 h-8 px-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-amber-500 outline-none text-right font-mono"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Summary Bar with Full GST Breakdown */}
                        <div className="p-3.5 bg-slate-100 dark:bg-slate-800/90 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
                            <div className="flex items-center gap-4 text-slate-600 dark:text-slate-400 font-medium">
                                <div>Items: <span className="font-bold text-slate-900 dark:text-slate-100">{totalItemsCount}</span></div>
                                <div>Total Qty: <span className="font-bold text-slate-900 dark:text-slate-100">{totalQuantity}</span></div>
                            </div>

                            <div className="flex items-center gap-3 flex-wrap">
                                {isCommercialGRN && (
                                    <>
                                        <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Subtotal:</span>
                                            <span className="font-bold text-slate-900 dark:text-slate-100">
                                                ₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                                            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-500">GST ({globalTaxRate}%):</span>
                                            <span className="font-bold text-indigo-600 dark:text-indigo-400">
                                                + ₹{taxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </div>

                                        {transportationCharges > 0 && (
                                            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                                                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-500">Transport:</span>
                                                <span className="font-bold text-blue-600 dark:text-blue-400">
                                                    + ₹{transportationCharges.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        )}

                                        {packingCharges > 0 && (
                                            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                                                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-500">Packing:</span>
                                                <span className="font-bold text-amber-600 dark:text-amber-400">
                                                    + ₹{packingCharges.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        )}
                                    </>
                                )}

                                <div className="flex items-center gap-2 pl-2 border-l border-slate-300 dark:border-slate-700">
                                    <label className="flex items-center gap-1.5 cursor-pointer font-bold text-slate-700 dark:text-slate-300 text-xs">
                                        <input
                                            type="checkbox"
                                            checked={isRoundOffEnabled}
                                            onChange={(e) => setIsRoundOffEnabled(e.target.checked)}
                                            className="w-3.5 h-3.5 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
                                        />
                                        <span>Round Off:</span>
                                    </label>
                                    {isRoundOffEnabled && rounding.roundOff !== 0 && (
                                        <span className={`font-mono font-bold text-xs ${rounding.roundOff >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                            {rounding.roundOff > 0 ? '+' : ''}₹{rounding.roundOff.toFixed(2)}
                                        </span>
                                    )}
                                </div>

                                <div className="flex items-center gap-2 pl-2 border-l border-slate-300 dark:border-slate-700">
                                    <span className="text-slate-700 dark:text-slate-300 font-black">
                                        {isCommercialGRN ? 'Whole GRN Price (with GST & Charges):' : 'Total Value:'}
                                    </span>
                                    <span className="text-sm sm:text-base font-black text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-3.5 py-1 rounded-xl border border-emerald-300 dark:border-emerald-800 shadow-xs tracking-tight">
                                        ₹{grandTotalWithTax.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sticky Bottom Action Footer Bar */}
                <div className="px-3.5 sm:px-5 py-3 bg-white/95 dark:bg-slate-900/95 border-t border-slate-200 dark:border-slate-800 backdrop-blur-md shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
                    {/* Left: Summary Preview */}
                    <div className="flex items-center justify-between sm:justify-start gap-3">
                        <div className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                            <span className="font-bold text-slate-900 dark:text-slate-100">{totalItemsCount}</span> items | <span className="font-bold text-slate-900 dark:text-slate-100">{totalQuantity}</span> total qty
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-slate-500 uppercase sm:inline hidden">Total:</span>
                            <span className="text-sm sm:text-base font-black text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 rounded-xl border border-emerald-300 dark:border-emerald-800">
                                ₹{grandTotalWithTax.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>

                    {/* Right: Touch-Friendly Action Buttons */}
                    <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer text-center"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading || isCompressing}
                            className={`w-full sm:w-auto px-6 py-2.5 rounded-xl text-white text-xs font-bold shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 ${
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
                </div>
            </form>
            </div>
        </div>

        {/* Quick Item Master Modal for on-the-fly registration */}
        <QuickItemMasterModal
            isOpen={isQuickMasterModalOpen}
            onClose={() => {
                setIsQuickMasterModalOpen(false);
                setQuickMasterInitialName('');
                setQuickMasterTargetIndex(null);
            }}
            defaultType={type}
            initialName={quickMasterInitialName}
            categories={categories}
            locations={locations}
            onItemCreated={handleQuickItemCreated}
        />
        </>
    );
}

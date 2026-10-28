import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  User, 
  Package, 
  Check, 
  Truck, 
  ArrowRight, 
  Factory, 
  FileText, 
  FileSpreadsheet,
  AlertTriangle,
  AlertCircle,
  Lock
} from 'lucide-react';
import { Vendor, RmBoItem, JobWorkFormData, JobWorkSupplier, JobWorkReturningItem, JobWorkAssemblyOutputItem, JobWorkAssemblyGroup, JOB_WORK_PURPOSES } from "@/src/features/store/types/store.types";
import { apiGet, apiPost, apiPut } from '@/src/lib/api';
import { generateDocument } from '@/src/utils/documentHelper';
import { getItemDescription } from '@/src/utils/itemDisplayHelper';
import SearchableSelect from '../SearchableSelect';

export const DEFAULT_JOB_WORK_NOTES: string[] = [
    "Material sent on Returnable Delivery Challan for job-work processing only and not for sale.",
    "Please process and return the finished items on or before the agreed expected delivery date.",
    "Process scrap, turnings, and rejections (if any) must be accounted for and returned along with the processed goods.",
    "Kindly quote our Delivery Challan number and date on all your return challans, delivery notes, and service invoices.",
    "The subcontractor/consignee shall be held liable for any loss, damage, or shortage while the material is under custody."
];

interface JobWorkFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    onError: (msg: string) => void;
    vendors?: Vendor[];
    jobWorkSuppliers?: JobWorkSupplier[];
    rawMaterials?: any[];
    boughtOuts?: any[];
    materials?: RmBoItem[];
    consumables?: any[];
    inventoryList?: any[];
    inHouseItems?: any[];
    mrpPlans?: any[];
    initialData?: Partial<JobWorkFormData> & { _id?: string };
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
    rawMaterials = [],
    boughtOuts = [],
    materials = [],
    consumables = [],
    inventoryList = [],
    inHouseItems = [],
    mrpPlans = [],
    initialData,
    isModal = true,
    token,
    companyInfo
}: JobWorkFormProps) {
    const [loading, setLoading] = useState(false);
    const [successData, setSuccessData] = useState<any>(null);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});

    const clearError = (key: string) => {
        setFormErrors(prev => {
            if (!prev[key]) return prev;
            const next = { ...prev };
            delete next[key];
            return next;
        });
    };

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
        jobWorkType: 'store-conversion',
        purpose: 'Machining',
        otherPurpose: '',
        operationMode: 'discrete',
        assemblyOutputItem: {
            item: '',
            itemName: '',
            itemType: 'fg',
            quantityToBeReceived: 1,
            receivingUnit: 'PCS',
            processType: 'Assembly',
            processRate: 0,
            processAmount: 0,
            description: ''
        },
        assemblyGroups: [
            {
                groupName: 'Assembly Line Item #1',
                items: [
                    {
                        item: '',
                        itemName: '',
                        itemType: 'rm',
                        quantitySent: 1,
                        unit: 'PCS',
                        processType: 'Welding & Assembly',
                        unitPrice: 0,
                        processRate: 0,
                        processAmount: 0,
                        description: '',
                        returningItems: []
                    }
                ],
                assemblyOutputItem: {
                    item: '',
                    itemName: '',
                    itemType: 'fg',
                    quantityToBeReceived: 1,
                    receivingUnit: 'PCS',
                    processType: 'Welding & Assembly',
                    processRate: 0,
                    processAmount: 0,
                    description: ''
                }
            }
        ],
        mrpNumber: '',
        mrpPlan: '',
        items: [
            {
                item: '',
                itemName: '',
                itemType: 'rm',
                quantitySent: 1,
                unit: 'PCS',
                processType: 'Machining',
                unitPrice: 0,
                description: '',
                returningItems: [
                    {
                        receivedItem: '',
                        receivedItemName: '',
                        receivedItemType: 'rm',
                        quantityToBeReceived: 1,
                        receivingUnit: 'PCS'
                    }
                ]
            }
        ],
        notes: (initialData?.notes && initialData.notes.length > 0) ? initialData.notes : [...DEFAULT_JOB_WORK_NOTES]
    });

    const [wipRmItems, setWipRmItems] = useState<any[]>([]);
    const [wipBoItems, setWipBoItems] = useState<any[]>([]);
    const [wipFgItems, setWipFgItems] = useState<any[]>([]);
    const [fetchedConsumables, setFetchedConsumables] = useState<any[]>([]);

    // Fetch live Shopfloor WIP Inventory for RM, BO, and FG (strictly Shopfloor WIP stock)
    useEffect(() => {
        if (isOpen && token) {
            apiGet('/api/store/wip/inventory?type=rm', token)
                .then((res: any) => {
                    if (res?.wipItems && Array.isArray(res.wipItems)) {
                        setWipRmItems(res.wipItems);
                    }
                })
                .catch((err: any) => console.warn("Failed to fetch WIP RM inventory in JobWorkForm:", err));

            apiGet('/api/store/wip/inventory?type=bo', token)
                .then((res: any) => {
                    if (res?.wipItems && Array.isArray(res.wipItems)) {
                        setWipBoItems(res.wipItems);
                    }
                })
                .catch((err: any) => console.warn("Failed to fetch WIP BO inventory in JobWorkForm:", err));

            apiGet('/api/store/wip/inventory?type=fg', token)
                .then((res: any) => {
                    if (res?.wipItems && Array.isArray(res.wipItems)) {
                        setWipFgItems(res.wipItems);
                    }
                })
                .catch((err: any) => console.warn("Failed to fetch WIP FG inventory in JobWorkForm:", err));

            // Fallback fetch for consumables if not provided by parent
            if (!consumables || consumables.length === 0) {
                apiGet('/api/store/consumable-item', token)
                    .then((res: any) => {
                        const list = Array.isArray(res) ? res : (res?.consumableItems || res?.data || []);
                        if (list.length > 0) setFetchedConsumables(list);
                    })
                    .catch((err: any) => console.warn("Failed to fetch consumables in JobWorkForm:", err));
            }
        }
    }, [isOpen, token, consumables]);

    const effectiveConsumables = useMemo(() => {
        return (consumables && consumables.length > 0) ? consumables : fetchedConsumables;
    }, [consumables, fetchedConsumables]);

    // Helper to get available stock from WIP inventory (for WIP-to-WIP) or Main Store (for Store flows)
    const getItemStock = useCallback((itemId: string, itemType?: string): number => {
        if (!itemId) return 0;
        const cleanId = (val: any) => {
            if (!val) return '';
            const s = typeof val === 'object' && val !== null ? (val._id || val.id || '') : String(val);
            return s.includes('_') ? s.split('_').slice(1).join('_') : s;
        };
        const targetClean = cleanId(itemId);

        // If in WIP-to-WIP workflow, all outward materials come strictly from Shopfloor WIP stock!
        if (formData.jobWorkType === 'wip-to-wip') {
            if (itemType === 'rm') {
                const wip = wipRmItems.find((r: any) => cleanId(r.materialId || r._id || r.id) === targetClean);
                return Number(wip?.shopfloorWipQty) || 0;
            }
            if (itemType === 'bo') {
                const wip = wipBoItems.find((b: any) => cleanId(b.materialId || b._id || b.id) === targetClean);
                return Number(wip?.shopfloorWipQty) || 0;
            }
            if (itemType === 'fg') {
                const wip = wipFgItems.find((f: any) => cleanId(f.materialId || f._id || f.id) === targetClean);
                return Number(wip?.shopfloorWipQty) || 0;
            }
            if (itemType === 'consumable') {
                const inv = (inventoryList || []).find((i: any) => cleanId(i.materialId || i._id) === targetClean);
                if (inv) return Number(inv.currentStock ?? inv.quantity ?? 0);
                const cons = (effectiveConsumables || []).find((c: any) => cleanId(c._id || c.id) === targetClean);
                return Number(cons?.currentStock ?? cons?.quantity ?? 0);
            }
            // If itemType not specified, check across WIP collections
            const wipRm = wipRmItems.find((r: any) => cleanId(r.materialId || r._id || r.id) === targetClean);
            if (wipRm) return Number(wipRm.shopfloorWipQty) || 0;
            const wipBo = wipBoItems.find((b: any) => cleanId(b.materialId || b._id || b.id) === targetClean);
            if (wipBo) return Number(wipBo.shopfloorWipQty) || 0;
            const wipFg = wipFgItems.find((f: any) => cleanId(f.materialId || f._id || f.id) === targetClean);
            if (wipFg) return Number(wipFg.shopfloorWipQty) || 0;
            return 0;
        }

        // 1. For Finished Goods (FG / WIP Components), query strictly from Shopfloor WIP stock
        if (itemType === 'fg') {
            if (wipFgItems && wipFgItems.length > 0) {
                const wip = wipFgItems.find((f: any) => cleanId(f.materialId || f.id || f._id) === targetClean);
                if (wip) {
                    return Number(wip.shopfloorWipQty) || 0;
                }
            }
            const comp = (inHouseItems || []).find((f: any) => cleanId(f._id || f.id) === targetClean);
            if (comp) {
                return Number(comp.quantity ?? comp.currentStock ?? 0);
            }
            return 0;
        }

        // 2. Check inventoryList for RM / BO / Consumables in Main Store
        if (inventoryList && inventoryList.length > 0) {
            const inv = inventoryList.find((i: any) => {
                const mId = typeof i.materialId === 'object' && i.materialId ? i.materialId._id : i.materialId;
                return cleanId(mId) === targetClean || cleanId(i._id) === targetClean;
            });
            if (inv) {
                if (inv.currentStock !== undefined) return Number(inv.currentStock) || 0;
                if (inv.quantity !== undefined) return Number(inv.quantity) || 0;
            }
        }

        // 3. Fallback to master collections for RM / BO / Consumables in Main Store
        if (itemType === 'rm') {
            const rm = (rawMaterials.length > 0 ? rawMaterials : materials).find((m: any) => cleanId(m._id || m.id) === targetClean);
            if (rm) {
                if (rm.quantity !== undefined) return Number(rm.quantity) || 0;
                if (rm.currentStock !== undefined) return Number(rm.currentStock) || 0;
            }
        } else if (itemType === 'bo') {
            const bo = (boughtOuts.length > 0 ? boughtOuts : materials).find((m: any) => cleanId(m._id || m.id) === targetClean);
            if (bo) {
                if (bo.quantity !== undefined) return Number(bo.quantity) || 0;
                if (bo.currentStock !== undefined) return Number(bo.currentStock) || 0;
            }
        } else if (itemType === 'consumable') {
            const cons = (effectiveConsumables || []).find((c: any) => cleanId(c._id || c.id) === targetClean);
            if (cons) {
                if (cons.quantity !== undefined) return Number(cons.quantity) || 0;
                if (cons.currentStock !== undefined) return Number(cons.currentStock) || 0;
            }
        }
        return 0;
    }, [formData.jobWorkType, inventoryList, rawMaterials, boughtOuts, materials, inHouseItems, effectiveConsumables, wipRmItems, wipBoItems, wipFgItems]);

    // Helper to get quantity originally sent in this DC (for initialData when editing)
    const getInitialItemQuantity = useCallback((itemId: string): number => {
        if (!initialData || !itemId) return 0;
        const cleanId = (val: any) => {
            if (!val) return '';
            const s = typeof val === 'object' && val !== null ? (val._id || val.id || '') : String(val);
            return s.includes('_') ? s.split('_').slice(1).join('_') : s;
        };
        const targetClean = cleanId(itemId);
        let totalQty = 0;

        if (initialData.operationMode === 'assembly' && Array.isArray((initialData as any).assemblyGroups)) {
            (initialData as any).assemblyGroups.forEach((grp: any) => {
                (grp.items || []).forEach((it: any) => {
                    const itClean = cleanId(it.item);
                    if (itClean === targetClean || String(it.item) === String(itemId)) {
                        totalQty += Number(it.quantitySent) || 0;
                    }
                });
            });
        }

        if (Array.isArray(initialData.items)) {
            initialData.items.forEach((it: any) => {
                const itClean = cleanId(it.item);
                if (itClean === targetClean || String(it.item) === String(itemId)) {
                    totalQty += Number(it.quantitySent) || 0;
                }
            });
        }

        return totalQty;
    }, [initialData]);

    // Helper to get effective available stock: Live stock + quantity already allocated in this DC (if editing)
    const getEffectiveAvailableStock = useCallback((itemId: string, itemType: string): number => {
        const liveStock = getItemStock(itemId, itemType);
        const inDcQty = getInitialItemQuantity(itemId);
        return liveStock + inDcQty;
    }, [getItemStock, getInitialItemQuantity]);

    // Helper to resolve Master Item with Dual UOM details
    const getMasterItem = useCallback((itemId: string, itemType: string) => {
        if (!itemId) return null;
        const cleanId = (val: any) => {
            if (!val) return '';
            const s = typeof val === 'object' && val !== null ? (val._id || val.id || '') : String(val);
            return s.includes('_') ? s.split('_').slice(1).join('_') : s;
        };
        const targetClean = cleanId(itemId);

        if (itemType === 'rm') {
            const foundWip = (wipRmItems || []).find((r: any) => cleanId(r.materialId || r._id || r.id) === targetClean);
            if (foundWip) return foundWip;
            return (rawMaterials.length > 0 ? rawMaterials : materials).find((m: any) => cleanId(m._id || m.id) === targetClean) || null;
        }
        if (itemType === 'bo') {
            const foundWip = (wipBoItems || []).find((b: any) => cleanId(b.materialId || b._id || b.id) === targetClean);
            if (foundWip) return foundWip;
            return (boughtOuts.length > 0 ? boughtOuts : materials).find((m: any) => cleanId(m._id || m.id) === targetClean) || null;
        }
        if (itemType === 'consumable') {
            return (effectiveConsumables || []).find((c: any) => cleanId(c._id || c.id) === targetClean) || null;
        }
        if (itemType === 'fg' || itemType === 'inhouse' || itemType === 'component' || itemType === 'subassembly' || itemType === 'assembly') {
            const sourceList = [...wipFgItems, ...(inHouseItems || [])];
            return sourceList.find((i: any) => cleanId(i.materialId || i.id || i._id) === targetClean) || null;
        }

        // Generic fallback lookup across all collections
        const match = (it: any) => cleanId(it._id || it.id || it.materialId) === targetClean;
        return (rawMaterials.length > 0 ? rawMaterials : materials).find(match)
            || (boughtOuts.length > 0 ? boughtOuts : materials).find(match)
            || (effectiveConsumables || []).find(match)
            || (inHouseItems || []).find(match)
            || (wipRmItems || []).find(match)
            || (wipBoItems || []).find(match)
            || (wipFgItems || []).find(match)
            || null;
    }, [wipRmItems, wipBoItems, wipFgItems, rawMaterials, boughtOuts, materials, inHouseItems, effectiveConsumables]);

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

    // Item options for Raw Materials (RM) with live stock display (accounting for current DC in edit mode)
    const rmOptions = useMemo(() => {
        const sourceList = rawMaterials.length > 0 ? rawMaterials : (materials || []).filter((m: any) => m.type !== 'bo' && m.itemType !== 'bo');
        return sourceList.map((m: any) => {
            const liveStock = getItemStock(m._id, 'rm');
            const inDcQty = getInitialItemQuantity(m._id);
            const effectiveStock = liveStock + inDcQty;
            const unit = m.unit || (m as any).categoryId?.unit || 'PCS';
            const desc = getItemDescription(m);
            const descSuffix = desc ? ` — ${desc}` : '';
            const dcSuffix = inDcQty > 0 ? ` (${inDcQty} in this DC)` : '';
            return {
                value: m._id,
                label: `${m.name || 'Raw Material'}${descSuffix} • Stock: ${effectiveStock} ${unit}${dcSuffix}`
            };
        });
    }, [rawMaterials, materials, getItemStock, getInitialItemQuantity]);

    // Item options for Bought Outs (BO) with live stock display (accounting for current DC in edit mode)
    const boOptions = useMemo(() => {
        const sourceList = boughtOuts.length > 0 ? boughtOuts : (materials || []).filter((m: any) => m.type === 'bo' || m.itemType === 'bo');
        return sourceList.map((m: any) => {
            const liveStock = getItemStock(m._id, 'bo');
            const inDcQty = getInitialItemQuantity(m._id);
            const effectiveStock = liveStock + inDcQty;
            const unit = m.unit || (m as any).categoryId?.unit || 'PCS';
            const desc = getItemDescription(m);
            const descSuffix = desc ? ` — ${desc}` : '';
            const dcSuffix = inDcQty > 0 ? ` (${inDcQty} in this DC)` : '';
            return {
                value: m._id,
                label: `${m.name || 'Bought Out Item'}${descSuffix} • Stock: ${effectiveStock} ${unit}${dcSuffix}`
            };
        });
    }, [boughtOuts, materials, getItemStock, getInitialItemQuantity]);

    // Item options for In-House / Finished Goods (FG) with live Shopfloor WIP stock display (accounting for current DC in edit mode)
    const fgOptions = useMemo(() => {
        const itemMap = new Map<string, any>();
        (inHouseItems || []).forEach((item: any) => {
            const id = String(item._id || item.id || item.materialId || '');
            if (id) itemMap.set(id, { ...item });
        });
        (wipFgItems || []).forEach((wip: any) => {
            const id = String(wip.materialId || wip._id || wip.id || '');
            if (id) {
                const existing = itemMap.get(id);
                itemMap.set(id, { ...existing, ...wip });
            }
        });
        const combined = Array.from(itemMap.values());
        const sourceList = combined.length > 0 ? combined : (wipFgItems.length > 0 ? wipFgItems : (inHouseItems || []));
        return sourceList.map((i: any) => {
            const targetId = i.materialId || i.id || i._id;
            const liveStock = i.shopfloorWipQty !== undefined ? (Number(i.shopfloorWipQty) || 0) : getItemStock(targetId, 'fg');
            const inDcQty = getInitialItemQuantity(targetId);
            const effectiveStock = liveStock + inDcQty;
            const unit = i.unit || 'PCS';
            const nameStr = i.materialName || i.name || i.componentName || 'Finished Good / Component';
            const desc = getItemDescription(i);
            const descSuffix = desc ? ` — ${desc}` : '';
            const dcSuffix = inDcQty > 0 ? ` (${inDcQty} in this DC)` : '';
            return {
                value: targetId,
                label: `${nameStr}${descSuffix} • Shopfloor WIP: ${effectiveStock} ${unit}${dcSuffix}`
            };
        });
    }, [wipFgItems, inHouseItems, getItemStock, getInitialItemQuantity]);

    // WIP-to-WIP Outward Options: items that currently have positive available Shopfloor WIP stock (> 0) OR are already allocated to this DC
    const wipRmOptions = useMemo(() => {
        return wipRmItems
            .filter((item: any) => {
                const targetId = item.materialId || item.id || item._id;
                const liveStock = Number(item.shopfloorWipQty) || 0;
                const inDcQty = getInitialItemQuantity(targetId);
                return liveStock > 0 || inDcQty > 0;
            })
            .map((item: any) => {
                const targetId = item.materialId || item.id || item._id;
                const liveStock = Number(item.shopfloorWipQty) || 0;
                const inDcQty = getInitialItemQuantity(targetId);
                const effectiveStock = liveStock + inDcQty;
                const unit = item.unit || 'PCS';
                const nameStr = item.materialName || item.name || 'Raw Material';
                const desc = getItemDescription(item);
                const descSuffix = desc ? ` — ${desc}` : '';
                const dcSuffix = inDcQty > 0 ? ` (${inDcQty} in this DC)` : '';
                return {
                    value: targetId,
                    label: `${nameStr}${descSuffix} • WIP Stock: ${effectiveStock} ${unit}${dcSuffix}`
                };
            });
    }, [wipRmItems, getInitialItemQuantity]);

    const wipBoOptions = useMemo(() => {
        return wipBoItems
            .filter((item: any) => {
                const targetId = item.materialId || item.id || item._id;
                const liveStock = Number(item.shopfloorWipQty) || 0;
                const inDcQty = getInitialItemQuantity(targetId);
                return liveStock > 0 || inDcQty > 0;
            })
            .map((item: any) => {
                const targetId = item.materialId || item.id || item._id;
                const liveStock = Number(item.shopfloorWipQty) || 0;
                const inDcQty = getInitialItemQuantity(targetId);
                const effectiveStock = liveStock + inDcQty;
                const unit = item.unit || 'PCS';
                const nameStr = item.materialName || item.name || 'Bought Out Item';
                const desc = getItemDescription(item);
                const descSuffix = desc ? ` — ${desc}` : '';
                const dcSuffix = inDcQty > 0 ? ` (${inDcQty} in this DC)` : '';
                return {
                    value: targetId,
                    label: `${nameStr}${descSuffix} • WIP Stock: ${effectiveStock} ${unit}${dcSuffix}`
                };
            });
    }, [wipBoItems, getInitialItemQuantity]);

    const wipFgOutwardOptions = useMemo(() => {
        return wipFgItems
            .filter((item: any) => {
                const targetId = item.materialId || item.id || item._id;
                const liveStock = Number(item.shopfloorWipQty) || 0;
                const inDcQty = getInitialItemQuantity(targetId);
                return liveStock > 0 || inDcQty > 0;
            })
            .map((item: any) => {
                const targetId = item.materialId || item.id || item._id;
                const liveStock = Number(item.shopfloorWipQty) || 0;
                const inDcQty = getInitialItemQuantity(targetId);
                const effectiveStock = liveStock + inDcQty;
                const unit = item.unit || 'PCS';
                const nameStr = item.materialName || item.name || item.componentName || 'Finished Good / Component';
                const desc = getItemDescription(item);
                const descSuffix = desc ? ` — ${desc}` : '';
                const dcSuffix = inDcQty > 0 ? ` (${inDcQty} in this DC)` : '';
                return {
                    value: targetId,
                    label: `${nameStr}${descSuffix} • WIP Stock: ${effectiveStock} ${unit}${dcSuffix}`
                };
            });
    }, [wipFgItems, getInitialItemQuantity]);

    // Item options for Consumables with live stock display (accounting for current DC in edit mode)
    const consumableOptions = useMemo(() => {
        return (effectiveConsumables || []).map((c: any) => {
            const liveStock = getItemStock(c._id, 'consumable');
            const inDcQty = getInitialItemQuantity(c._id);
            const effectiveStock = liveStock + inDcQty;
            const unit = c.unit || (c as any).categoryId?.unit || 'PCS';
            const desc = getItemDescription(c);
            const descSuffix = desc ? ` — ${desc}` : '';
            const dcSuffix = inDcQty > 0 ? ` (${inDcQty} in this DC)` : '';
            return {
                value: c._id,
                label: `${c.name || 'Consumable Item'}${descSuffix} • Stock: ${effectiveStock} ${unit}${dcSuffix}`
            };
        });
    }, [effectiveConsumables, getItemStock, getInitialItemQuantity]);

    // Unified materials dictionary for O(1) attribute lookup and auto-type detection
    const allMaterialsMap = useMemo(() => {
        const map = new Map<string, { item: any; itemType: 'rm' | 'bo' | 'consumable' | 'fg' }>();

        const cleanId = (val: any) => {
            if (!val) return '';
            const s = typeof val === 'object' && val !== null ? (val._id || val.id || '') : String(val);
            return s.includes('_') ? s.split('_').slice(1).join('_') : s;
        };

        // 1. Raw Materials
        const rmList = rawMaterials.length > 0 ? rawMaterials : (materials || []).filter((m: any) => m.type !== 'bo' && m.itemType !== 'bo');
        rmList.forEach((m: any) => {
            const id = cleanId(m._id || m.id);
            if (id) map.set(id, { item: m, itemType: 'rm' });
        });

        // 2. Bought Outs
        const boList = boughtOuts.length > 0 ? boughtOuts : (materials || []).filter((m: any) => m.type === 'bo' || m.itemType === 'bo');
        boList.forEach((b: any) => {
            const id = cleanId(b._id || b.id);
            if (id) map.set(id, { item: b, itemType: 'bo' });
        });

        // 3. Consumables
        (effectiveConsumables || []).forEach((c: any) => {
            const id = cleanId(c._id || c.id);
            if (id) map.set(id, { item: c, itemType: 'consumable' });
        });

        // 4. Finished Goods & In-House Components
        (inHouseItems || []).forEach((f: any) => {
            const id = cleanId(f._id || f.id || f.materialId);
            if (id) map.set(id, { item: f, itemType: 'fg' });
        });

        // 5. Shopfloor WIP Inventory Items
        (wipRmItems || []).forEach((w: any) => {
            const id = cleanId(w.materialId || w._id || w.id);
            if (id && !map.has(id)) map.set(id, { item: w, itemType: 'rm' });
        });
        (wipBoItems || []).forEach((w: any) => {
            const id = cleanId(w.materialId || w._id || w.id);
            if (id && !map.has(id)) map.set(id, { item: w, itemType: 'bo' });
        });
        (wipFgItems || []).forEach((w: any) => {
            const id = cleanId(w.materialId || w._id || w.id);
            if (id && !map.has(id)) map.set(id, { item: w, itemType: 'fg' });
        });

        return map;
    }, [rawMaterials, boughtOuts, materials, effectiveConsumables, inHouseItems, wipRmItems, wipBoItems, wipFgItems]);

    // Unified Outward Material Options list for SearchableSelect across ALL categories (RM, BO, Consumables, FG)
    const unifiedOutwardOptions = useMemo(() => {
        const list: { value: string; label: string }[] = [];
        const seen = new Set<string>();

        const addOption = (val: string, label: string) => {
            if (val && !seen.has(String(val))) {
                seen.add(String(val));
                list.push({ value: String(val), label });
            }
        };

        if (formData.jobWorkType === 'wip-to-wip') {
            wipRmOptions.forEach(opt => addOption(opt.value, `[RM] ${opt.label.replace(/^\[.*?\]\s*/, '')}`));
            wipBoOptions.forEach(opt => addOption(opt.value, `[BO] ${opt.label.replace(/^\[.*?\]\s*/, '')}`));
            wipFgOutwardOptions.forEach(opt => addOption(opt.value, `[FG] ${opt.label.replace(/^\[.*?\]\s*/, '')}`));
            consumableOptions.forEach(opt => addOption(opt.value, `[Consumable] ${opt.label.replace(/^\[.*?\]\s*/, '')}`));
        } else {
            rmOptions.forEach(opt => addOption(opt.value, `[RM] ${opt.label.replace(/^\[.*?\]\s*/, '')}`));
            boOptions.forEach(opt => addOption(opt.value, `[BO] ${opt.label.replace(/^\[.*?\]\s*/, '')}`));
            consumableOptions.forEach(opt => addOption(opt.value, `[Consumable] ${opt.label.replace(/^\[.*?\]\s*/, '')}`));
            fgOptions.forEach(opt => addOption(opt.value, `[FG] ${opt.label.replace(/^\[.*?\]\s*/, '')}`));
        }

        return list;
    }, [formData.jobWorkType, rmOptions, boOptions, consumableOptions, fgOptions, wipRmOptions, wipBoOptions, wipFgOutwardOptions]);

    const [fetchedMrpPlans, setFetchedMrpPlans] = useState<any[]>([]);

    // Fetch Open MRP Plans with keyword support
    useEffect(() => {
        if (isOpen && token) {
            apiGet('/api/purchase/mrp', token)
                .then((res: any) => {
                    const plans = res?.mrps || res?.data || (Array.isArray(res) ? res : []);
                    if (plans.length > 0) {
                        setFetchedMrpPlans(plans);
                    } else {
                        // Fallback to WIP MRP buckets
                        apiGet('/api/store/wip/inventory?type=mrp-buckets', token)
                            .then((wipRes: any) => {
                                if (wipRes?.mrpBuckets) setFetchedMrpPlans(wipRes.mrpBuckets);
                            })
                            .catch((err: any) => console.warn("Failed to fetch MRP buckets:", err));
                    }
                })
                .catch(() => {
                    apiGet('/api/store/wip/inventory?type=mrp-buckets', token)
                        .then((wipRes: any) => {
                            if (wipRes?.mrpBuckets) setFetchedMrpPlans(wipRes.mrpBuckets);
                        })
                        .catch((err: any) => console.warn("Failed to fetch MRP buckets:", err));
                });
        }
    }, [isOpen, token]);

    // Searchable Open MRP Plans options list
    const mrpOptions = useMemo(() => {
        const sourceList = (mrpPlans && mrpPlans.length > 0) ? mrpPlans : fetchedMrpPlans;
        return sourceList
            .filter((m: any) => {
                const status = (m.status || '').toLowerCase();
                return status !== 'completed' && status !== 'cancelled' && status !== 'closed';
            })
            .map((m: any) => {
                const num = m.mrpNumber || m.planNumber || m.code || (m._id ? `MRP-${m._id?.slice(-6)}` : 'MRP');
                const cust = m.customerName || m.customer?.name || m.remarks || '';
                const fgName = m.productName || m.finishedGood || m.fgItemName || '';
                const status = m.status || 'In Production';
                return {
                    value: num,
                    id: m._id || m.id,
                    code: num,
                    label: `${num} ${cust ? `• ${cust}` : ''} ${fgName ? `• FG: ${fgName}` : ''} (${status})`,
                    description: cust ? `Customer: ${cust}` : undefined
                };
            });
    }, [mrpPlans, fetchedMrpPlans]);

    // Pre-fill form
    useEffect(() => {
        if (isOpen && initialData) {
            const { _id, items, vendor, ...rest } = initialData;
            const vendorId = typeof vendor === 'object' && vendor !== null ? ((vendor as any)._id || '') : (vendor || '');

            const rawPurpose = (initialData as any).purpose || (initialData as any).items?.[0]?.processType || 'Machining';
            const isStandardPurpose = (JOB_WORK_PURPOSES as readonly string[]).includes(rawPurpose);
            const resolvedPurpose = isStandardPurpose ? rawPurpose : 'Others';
            const resolvedOtherPurpose = (initialData as any).otherPurpose || (!isStandardPurpose ? rawPurpose : '');

            // Hydrate assembly groups if present
            const hydratedAssemblyGroups = Array.isArray((initialData as any).assemblyGroups) && (initialData as any).assemblyGroups.length > 0
                ? (initialData as any).assemblyGroups.map((grp: any, gIdx: number) => {
                    const grpItems = (grp.items || []).map((gIt: any) => {
                        const gItId = typeof gIt.item === 'object' && gIt.item !== null ? (gIt.item._id || '') : (gIt.item || '');
                        const gMaster = getMasterItem(gItId, gIt.itemType || 'rm');
                        const gHasSec = Boolean(gIt.hasSecondaryUnit ?? gMaster?.hasSecondaryUnit ?? (gMaster?.secondaryUnit && Number(gMaster?.conversionFactor) > 0));
                        const gSecUnit = gIt.secondaryUnit || gMaster?.secondaryUnit || '';
                        const gConv = Number(gIt.conversionFactor || gMaster?.conversionFactor) || 1;
                        const gPriUnit = gIt.unit || gMaster?.unit || (gMaster as any)?.categoryId?.unit || 'PCS';
                        const gSelectedUnit = gIt.selectedUnit || (gHasSec && gIt.secondaryQuantitySent && !gIt.quantitySent ? gSecUnit : gPriUnit);
                        const gSentQty = Number(gIt.quantitySent != null ? gIt.quantitySent : 1);
                        const gSecQty = Number(gIt.secondaryQuantitySent != null ? gIt.secondaryQuantitySent : (gHasSec ? (gSentQty * gConv) : 0));
                        const gRate = Number(gIt.processRate != null ? gIt.processRate : gIt.unitPrice) || 0;
                        const gIsSec = Boolean(gHasSec && gSecUnit && gSelectedUnit === gSecUnit);
                        const gActiveQty = gIsSec ? gSecQty : gSentQty;
                        const gAmt = gIt.processAmount != null && !isNaN(Number(gIt.processAmount)) && Number(gIt.processAmount) > 0
                            ? Number(gIt.processAmount)
                            : parseFloat((gActiveQty * gRate).toFixed(2));
                        return {
                            ...gIt,
                            item: gItId,
                            itemName: gIt.itemName || gMaster?.name || gMaster?.materialName || '',
                            itemType: gIt.itemType || 'rm',
                            unit: gPriUnit,
                            hasSecondaryUnit: gHasSec,
                            secondaryUnit: gSecUnit,
                            conversionFactor: gConv,
                            secondaryQuantitySent: gSecQty,
                            selectedUnit: gSelectedUnit,
                            quantitySent: gSentQty,
                            processRate: gRate,
                            unitPrice: gRate,
                            processAmount: gAmt,
                            description: gIt.description || gMaster?.descriptions || gMaster?.description || ''
                        };
                    });

                    const grpOut = grp.assemblyOutputItem || {};
                    const outId = typeof grpOut.item === 'object' && grpOut.item !== null ? (grpOut.item._id || '') : (grpOut.item || '');
                    const outMaster = getMasterItem(outId, grpOut.itemType || 'fg');
                    const outHasSec = Boolean(grpOut.hasSecondaryUnit ?? outMaster?.hasSecondaryUnit ?? (outMaster?.secondaryUnit && Number(outMaster?.conversionFactor) > 0));
                    const outSecUnit = grpOut.secondaryUnit || outMaster?.secondaryUnit || '';
                    const outConv = Number(grpOut.conversionFactor || outMaster?.conversionFactor) || 1;
                    const outPriUnit = grpOut.receivingUnit || outMaster?.unit || 'PCS';
                    const outSelectedUnit = grpOut.selectedUnit || (outHasSec && grpOut.secondaryQuantityToBeReceived && !grpOut.quantityToBeReceived ? outSecUnit : outPriUnit);
                    const outQty = Number(grpOut.quantityToBeReceived != null ? grpOut.quantityToBeReceived : 1);
                    const outSecQty = Number(grpOut.secondaryQuantityToBeReceived != null ? grpOut.secondaryQuantityToBeReceived : (outHasSec ? (outQty * outConv) : 0));
                    const outRate = Number(grpOut.processRate != null ? grpOut.processRate : 0);
                    const outIsSec = Boolean(outHasSec && outSecUnit && outSelectedUnit === outSecUnit);
                    const outActiveQty = outIsSec ? outSecQty : outQty;
                    const outAmt = grpOut.processAmount != null && !isNaN(Number(grpOut.processAmount)) && Number(grpOut.processAmount) > 0
                        ? Number(grpOut.processAmount)
                        : parseFloat((outActiveQty * outRate).toFixed(2));

                    return {
                        ...grp,
                        groupName: grp.groupName || `Assembly Line Item #${gIdx + 1}`,
                        items: grpItems,
                        assemblyOutputItem: {
                            ...grpOut,
                            item: outId,
                            itemName: grpOut.itemName || outMaster?.name || outMaster?.componentName || '',
                            itemType: grpOut.itemType || 'fg',
                            receivingUnit: outPriUnit,
                            hasSecondaryUnit: outHasSec,
                            secondaryUnit: outSecUnit,
                            conversionFactor: outConv,
                            quantityToBeReceived: outQty,
                            secondaryQuantityToBeReceived: outSecQty,
                            selectedUnit: outSelectedUnit,
                            processRate: outRate,
                            processAmount: outAmt,
                            description: grpOut.description || outMaster?.description || ''
                        }
                    };
                })
                : undefined;

            // Hydrate standalone assemblyOutputItem
            let hydratedAssemblyOutput = (initialData as any).assemblyOutputItem;
            if (hydratedAssemblyOutput) {
                const outId = typeof hydratedAssemblyOutput.item === 'object' && hydratedAssemblyOutput.item !== null ? (hydratedAssemblyOutput.item._id || '') : (hydratedAssemblyOutput.item || '');
                const outMaster = getMasterItem(outId, hydratedAssemblyOutput.itemType || 'fg');
                const outHasSec = Boolean(hydratedAssemblyOutput.hasSecondaryUnit ?? outMaster?.hasSecondaryUnit ?? (outMaster?.secondaryUnit && Number(outMaster?.conversionFactor) > 0));
                const outSecUnit = hydratedAssemblyOutput.secondaryUnit || outMaster?.secondaryUnit || '';
                const outConv = Number(hydratedAssemblyOutput.conversionFactor || outMaster?.conversionFactor) || 1;
                const outPriUnit = hydratedAssemblyOutput.receivingUnit || outMaster?.unit || 'PCS';
                const outSelectedUnit = hydratedAssemblyOutput.selectedUnit || (outHasSec && hydratedAssemblyOutput.secondaryQuantityToBeReceived && !hydratedAssemblyOutput.quantityToBeReceived ? outSecUnit : outPriUnit);
                const outQty = Number(hydratedAssemblyOutput.quantityToBeReceived != null ? hydratedAssemblyOutput.quantityToBeReceived : 1);
                const outSecQty = Number(hydratedAssemblyOutput.secondaryQuantityToBeReceived != null ? hydratedAssemblyOutput.secondaryQuantityToBeReceived : (outHasSec ? (outQty * outConv) : 0));
                const outRate = Number(hydratedAssemblyOutput.processRate != null ? hydratedAssemblyOutput.processRate : 0);
                const outIsSec = Boolean(outHasSec && outSecUnit && outSelectedUnit === outSecUnit);
                const outActiveQty = outIsSec ? outSecQty : outQty;
                const outAmt = hydratedAssemblyOutput.processAmount != null && !isNaN(Number(hydratedAssemblyOutput.processAmount)) && Number(hydratedAssemblyOutput.processAmount) > 0
                    ? Number(hydratedAssemblyOutput.processAmount)
                    : parseFloat((outActiveQty * outRate).toFixed(2));

                hydratedAssemblyOutput = {
                    ...hydratedAssemblyOutput,
                    item: outId,
                    itemName: hydratedAssemblyOutput.itemName || outMaster?.name || outMaster?.componentName || '',
                    itemType: hydratedAssemblyOutput.itemType || 'fg',
                    receivingUnit: outPriUnit,
                    hasSecondaryUnit: outHasSec,
                    secondaryUnit: outSecUnit,
                    conversionFactor: outConv,
                    quantityToBeReceived: outQty,
                    secondaryQuantityToBeReceived: outSecQty,
                    selectedUnit: outSelectedUnit,
                    processRate: outRate,
                    processAmount: outAmt,
                    description: hydratedAssemblyOutput.description || outMaster?.description || ''
                };
            }

            const hydratedItems = (items || []).map((it: any) => {
                const itId = typeof it.item === 'object' && it.item !== null ? (it.item._id || '') : (it.item || '');
                const master = getMasterItem(itId, it.itemType || 'rm');
                const hasSec = Boolean(it.hasSecondaryUnit ?? master?.hasSecondaryUnit ?? (master?.secondaryUnit && Number(master?.conversionFactor) > 0));
                const secUnit = it.secondaryUnit || master?.secondaryUnit || '';
                const convFactor = Number(it.conversionFactor || master?.conversionFactor) || 1;
                const priUnit = it.unit || master?.unit || (master as any)?.categoryId?.unit || 'PCS';
                const selectedUnit = it.selectedUnit || (hasSec && it.secondaryQuantitySent && !it.quantitySent ? secUnit : priUnit);
                const sentQty = Number(it.quantitySent != null ? it.quantitySent : 1);
                const secQtySent = Number(it.secondaryQuantitySent != null ? it.secondaryQuantitySent : (hasSec ? (sentQty * convFactor) : 0));
                const rateVal = Number(it.processRate != null ? it.processRate : it.unitPrice) || 0;
                const isSec = Boolean(hasSec && secUnit && selectedUnit === secUnit);
                const activeSentQty = isSec ? secQtySent : sentQty;
                const itemProcessAmount = it.processAmount != null && !isNaN(Number(it.processAmount)) && Number(it.processAmount) > 0
                    ? Number(it.processAmount)
                    : parseFloat((activeSentQty * rateVal).toFixed(2));

                let retItems: JobWorkReturningItem[] = [];
                if (Array.isArray(it.returningItems) && it.returningItems.length > 0) {
                    retItems = it.returningItems.map((r: any) => {
                        const retId = typeof r.receivedItem === 'object' && r.receivedItem !== null ? (r.receivedItem._id || '') : (r.receivedItem || '');
                        const retMaster = getMasterItem(retId, r.receivedItemType || 'fg');
                        const retHasSec = Boolean(r.hasSecondaryUnit ?? retMaster?.hasSecondaryUnit ?? (retMaster?.secondaryUnit && Number(retMaster?.conversionFactor) > 0));
                        const retSecUnit = r.secondaryUnit || retMaster?.secondaryUnit || '';
                        const retConv = Number(r.conversionFactor || retMaster?.conversionFactor) || 1;
                        const retPriUnit = r.receivingUnit || retMaster?.unit || 'PCS';
                        const retSelectedUnit = r.selectedUnit || (retHasSec && r.secondaryQuantityToBeReceived && !r.quantityToBeReceived ? retSecUnit : retPriUnit);
                        const retQty = Number(r.quantityToBeReceived != null ? r.quantityToBeReceived : 1);
                        const retSecQty = Number(r.secondaryQuantityToBeReceived != null ? r.secondaryQuantityToBeReceived : (retHasSec ? (retQty * retConv) : 0));
                        const retRate = Number(r.processRate != null ? r.processRate : (r.rate != null ? r.rate : 0)) || 0;
                        const isRetSec = Boolean(retHasSec && retSecUnit && retSelectedUnit === retSecUnit);
                        const activeRetQty = isRetSec ? retSecQty : retQty;
                        const retAmount = Number(r.processAmount) != null && !isNaN(Number(r.processAmount)) && Number(r.processAmount) > 0
                            ? Number(r.processAmount)
                            : parseFloat((activeRetQty * retRate).toFixed(2));
                        return {
                            receivedItem: retId,
                            receivedItemName: r.receivedItemName || r.itemName || retMaster?.name || retMaster?.componentName || '',
                            receivedItemType: r.receivedItemType || 'fg',
                            quantityToBeReceived: retQty,
                            receivingUnit: retPriUnit,
                            hasSecondaryUnit: retHasSec,
                            secondaryUnit: retSecUnit,
                            conversionFactor: retConv,
                            secondaryQuantityToBeReceived: retSecQty,
                            selectedUnit: retSelectedUnit,
                            processRate: retRate,
                            processAmount: retAmount,
                            description: r.description || retMaster?.descriptions || retMaster?.description || ''
                        };
                    });
                } else {
                    const legacyRetId = typeof it.receivedItem === 'object' && it.receivedItem !== null ? (it.receivedItem._id || '') : (it.receivedItem || '');
                    const legacyRetMaster = getMasterItem(legacyRetId, it.receivedItemType || 'fg');
                    const retHasSec = Boolean(it.hasSecondaryUnit ?? legacyRetMaster?.hasSecondaryUnit ?? (legacyRetMaster?.secondaryUnit && Number(legacyRetMaster?.conversionFactor) > 0));
                    const retSecUnit = it.secondaryUnit || legacyRetMaster?.secondaryUnit || '';
                    const retConv = Number(it.conversionFactor || legacyRetMaster?.conversionFactor) || 1;
                    const retPriUnit = it.receivingUnit || it.unit || legacyRetMaster?.unit || 'PCS';
                    const retSelectedUnit = it.selectedUnit || (retHasSec && it.secondaryQuantityToBeReceived && !it.quantityToBeReceived ? retSecUnit : retPriUnit);
                    const retQty = Number(it.quantityToBeReceived != null ? it.quantityToBeReceived : (it.quantitySent || 1));
                    const retSecQty = Number(it.secondaryQuantityToBeReceived != null ? it.secondaryQuantityToBeReceived : (retHasSec ? (retQty * retConv) : 0));
                    const legacyRate = Number(it.processRate != null ? it.processRate : 0);
                    const isRetSec = Boolean(retHasSec && retSecUnit && retSelectedUnit === retSecUnit);
                    const activeRetQty = isRetSec ? retSecQty : retQty;

                    retItems = [{
                        receivedItem: legacyRetId,
                        receivedItemName: it.receivedItemName || it.itemToBeReceived || it.itemName || legacyRetMaster?.name || '',
                        receivedItemType: it.receivedItemType || 'fg',
                        quantityToBeReceived: retQty,
                        receivingUnit: retPriUnit,
                        hasSecondaryUnit: retHasSec,
                        secondaryUnit: retSecUnit,
                        conversionFactor: retConv,
                        secondaryQuantityToBeReceived: retSecQty,
                        selectedUnit: retSelectedUnit,
                        processRate: legacyRate,
                        processAmount: parseFloat((activeRetQty * legacyRate).toFixed(2)),
                        description: it.description || legacyRetMaster?.descriptions || legacyRetMaster?.description || ''
                    }];
                }

                // Check if 1:1 auto-synced return item
                const isSame = it.isSameItemReturning !== undefined
                    ? Boolean(it.isSameItemReturning)
                    : (retItems.length === 1 && (
                        !retItems[0].receivedItem ||
                        String(retItems[0].receivedItem) === String(itId) ||
                        retItems[0].receivedItemName === it.itemName
                    ));

                if (isSame && retItems.length > 0) {
                    retItems[0] = {
                        ...retItems[0],
                        receivedItem: itId,
                        receivedItemName: it.itemName || retItems[0].receivedItemName,
                        receivedItemType: it.itemType || 'rm',
                        quantityToBeReceived: sentQty,
                        receivingUnit: priUnit,
                        hasSecondaryUnit: hasSec,
                        secondaryUnit: secUnit,
                        conversionFactor: convFactor,
                        secondaryQuantityToBeReceived: secQtySent,
                        selectedUnit: selectedUnit,
                        processRate: Number(retItems[0].processRate != null ? retItems[0].processRate : rateVal),
                        processAmount: parseFloat((activeSentQty * (Number(retItems[0].processRate != null ? retItems[0].processRate : rateVal))).toFixed(2)),
                        description: it.description || retItems[0].description
                    };
                }

                return {
                    item: itId,
                    itemName: it.itemName || master?.name || master?.materialName || '',
                    itemType: it.itemType || 'rm',
                    quantitySent: sentQty,
                    unit: priUnit,
                    hasSecondaryUnit: hasSec,
                    secondaryUnit: secUnit,
                    conversionFactor: convFactor,
                    secondaryQuantitySent: secQtySent,
                    selectedUnit: selectedUnit,
                    processType: it.processType || (resolvedPurpose === 'Others' ? (resolvedOtherPurpose || 'Job Work') : resolvedPurpose),
                    purpose: it.purpose || resolvedPurpose,
                    processRate: rateVal,
                    processAmount: itemProcessAmount,
                    unitPrice: rateVal,
                    description: it.description || master?.descriptions || master?.description || '',
                    isSameItemReturning: isSame,
                    returningItems: retItems
                };
            });

            setFormData(prev => ({
                ...prev,
                ...rest,
                vendor: vendorId,
                jobWorkType: (initialData as any).jobWorkType || 'store-conversion',
                purpose: resolvedPurpose,
                otherPurpose: resolvedOtherPurpose,
                mrpNumber: (initialData as any).mrpNumber || '',
                mrpPlan: (initialData as any).mrpPlan || '',
                ewayBillNo: (initialData as any).ewayBillNo || prev.ewayBillNo || '',
                notes: (initialData as any).notes && Array.isArray((initialData as any).notes) && (initialData as any).notes.length > 0 ? (initialData as any).notes : [...DEFAULT_JOB_WORK_NOTES],
                items: hydratedItems,
                assemblyGroups: hydratedAssemblyGroups || prev.assemblyGroups,
                assemblyOutputItem: hydratedAssemblyOutput || prev.assemblyOutputItem
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
                jobWorkType: 'store-conversion',
                purpose: 'Machining',
                otherPurpose: '',
                operationMode: 'discrete',
                assemblyOutputItem: {
                    item: '',
                    itemName: '',
                    itemType: 'fg',
                    quantityToBeReceived: 1,
                    receivingUnit: 'PCS',
                    processType: 'Assembly',
                    processRate: 0,
                    processAmount: 0,
                    description: ''
                },
                assemblyGroups: [
                    {
                        groupName: 'Assembly Line Item #1',
                        items: [
                            {
                                item: '',
                                itemName: '',
                                itemType: 'rm',
                                quantitySent: 1,
                                unit: 'PCS',
                                processType: 'Welding & Assembly',
                                unitPrice: 0,
                                processRate: 0,
                                processAmount: 0,
                                description: '',
                                returningItems: []
                            }
                        ],
                        assemblyOutputItem: {
                            item: '',
                            itemName: '',
                            itemType: 'fg',
                            quantityToBeReceived: 1,
                            receivingUnit: 'PCS',
                            processType: 'Welding & Assembly',
                            processRate: 0,
                            processAmount: 0,
                            description: ''
                        }
                    }
                ],
                mrpNumber: '',
                mrpPlan: '',
                items: [
                    {
                        item: '',
                        itemName: '',
                        itemType: 'rm',
                        quantitySent: 1,
                        unit: 'PCS',
                        processType: 'Machining',
                        unitPrice: 0,
                        description: '',
                        returningItems: [
                            {
                                receivedItem: '',
                                receivedItemName: '',
                                receivedItemType: 'rm',
                                quantityToBeReceived: 1,
                                receivingUnit: 'PCS'
                            }
                        ]
                    }
                ],
                notes: [...DEFAULT_JOB_WORK_NOTES]
            });
        }
    }, [isOpen, initialData]);

    // Helper to auto-sync 1:1 same returning item across all workflow types (Store Conversion, Store-to-WIP, WIP-to-WIP)
    const syncSameReturningItem = (item: any): JobWorkReturningItem[] => {
        const existingRet = (item.returningItems && item.returningItems[0]) || {};
        const rate = Number(existingRet.processRate != null ? existingRet.processRate : (item.processRate || 0));
        const priQty = Number(item.quantitySent) || 0;
        const secQty = Number(item.secondaryQuantitySent) || 0;
        const isSec = Boolean(item.hasSecondaryUnit && item.secondaryUnit && item.selectedUnit === item.secondaryUnit);
        const activeQty = isSec ? secQty : priQty;
        return [{
            receivedItem: item.item || '',
            receivedItemName: item.itemName || '',
            receivedItemType: item.itemType || 'rm',
            quantityToBeReceived: priQty,
            receivingUnit: item.unit || 'PCS',
            hasSecondaryUnit: Boolean(item.hasSecondaryUnit),
            secondaryUnit: item.secondaryUnit || '',
            conversionFactor: Number(item.conversionFactor) || 1,
            selectedUnit: item.selectedUnit || item.unit || 'PCS',
            secondaryQuantityToBeReceived: secQty,
            processRate: rate,
            processAmount: parseFloat((activeQty * rate).toFixed(2)),
            description: item.description || ''
        }];
    };

    // Toggle Same Material Returning for a discrete outward line
    const handleToggleSameItemReturning = (itemIdx: number, checked: boolean) => {
        const newItems = [...formData.items];
        const current = { ...newItems[itemIdx], isSameItemReturning: checked };
        if (checked) {
            current.returningItems = syncSameReturningItem(current);
        } else {
            if (!current.returningItems || current.returningItems.length === 0) {
                current.returningItems = [{
                    receivedItem: '',
                    receivedItemName: '',
                    receivedItemType: current.itemType || 'rm',
                    quantityToBeReceived: Number(current.quantitySent) || 0,
                    receivingUnit: current.unit || 'PCS',
                    processRate: 0,
                    processAmount: 0,
                    description: ''
                }];
            }
        }
        current.processAmount = (current.returningItems || []).reduce((sum, r) => sum + (Number(r.processAmount) || 0), 0);
        newItems[itemIdx] = current;

        const totalJW = newItems.reduce((acc, it) => {
            const lineCharges = (it.returningItems || []).reduce((subAcc: number, r: any) => subAcc + (Number(r.processAmount) || 0), 0);
            return acc + lineCharges;
        }, 0);

        setFormData(prev => ({
            ...prev,
            items: newItems,
            totalJobWorkCharges: parseFloat(totalJW.toFixed(2))
        }));
    };

    // Handle Workflow DC Type Switch
    const handleDcTypeChange = (type: 'store-conversion' | 'store-to-wip' | 'wip-to-wip') => {
        const isWipToWip = type === 'wip-to-wip';
        const updatedItems = formData.items.map(item => {
            let defaultSentType = item.itemType;
            if (type === 'store-conversion' || type === 'store-to-wip') {
                defaultSentType = (item.itemType === 'bo' || item.itemType === 'rm') ? item.itemType : 'rm';
            } else if (type === 'wip-to-wip') {
                defaultSentType = (item.itemType === 'bo' || item.itemType === 'fg' || item.itemType === 'rm') ? item.itemType : 'rm';
            }

            const isSame = isWipToWip ? (item.isSameItemReturning !== undefined ? item.isSameItemReturning : true) : Boolean(item.isSameItemReturning);

            let updatedRetItems = (item.returningItems || []).map(r => {
                let retType = r.receivedItemType || 'rm';
                if (type === 'store-conversion') {
                    retType = 'rm'; // Strictly RM Conversion
                } else if (type === 'store-to-wip') {
                    retType = 'fg'; // Store-to-WIP strictly returns FG
                } else if (isWipToWip) {
                    retType = isSame ? defaultSentType : (r.receivedItemType || defaultSentType);
                }
                return {
                    ...r,
                    receivedItemType: retType
                };
            });

            const updatedItem = {
                ...item,
                itemType: defaultSentType,
                isSameItemReturning: isSame,
                returningItems: updatedRetItems
            };

            if (isSame && updatedItem.item) {
                updatedItem.returningItems = syncSameReturningItem(updatedItem);
            }

            return updatedItem;
        });

        const updatedGroups = (formData.assemblyGroups || []).map(grp => {
            const updatedGrpItems = (grp.items || []).map((it: any) => ({
                ...it,
                itemType: type === 'wip-to-wip' ? ((it.itemType === 'bo' || it.itemType === 'fg' || it.itemType === 'rm') ? it.itemType : 'rm') : ((it.itemType === 'bo' || it.itemType === 'rm') ? it.itemType : 'rm')
            }));
            const updatedOut = {
                ...(grp.assemblyOutputItem || {}),
                itemType: type === 'store-conversion' ? 'rm' : 'fg'
            };
            return {
                ...grp,
                items: updatedGrpItems,
                assemblyOutputItem: updatedOut as any
            };
        });

        setFormData({
            ...formData,
            jobWorkType: type,
            items: updatedItems,
            assemblyOutputItem: {
                ...(formData.assemblyOutputItem || {
                    item: '',
                    itemName: '',
                    itemType: 'fg',
                    quantityToBeReceived: 1,
                    receivingUnit: 'PCS'
                }),
                itemType: type === 'store-conversion' ? 'rm' : 'fg'
            },
            assemblyGroups: updatedGroups.length > 0 ? updatedGroups : formData.assemblyGroups
        });
    };

    // Handle Sent Item Field Changes
    const handleSentItemChange = (itemIdx: number, field: string, value: any) => {
        const newItems = [...formData.items];
        const current = { ...newItems[itemIdx], [field]: value };

        if (field === 'item') {
            const selectedId = value;
            const resolved = allMaterialsMap.get(String(selectedId));
            const resolvedType = resolved?.itemType || current.itemType || 'rm';
            current.itemType = resolvedType;

            let foundMat = resolved?.item || null;
            if (!foundMat) {
                foundMat = getMasterItem(selectedId, resolvedType);
            }

            if (foundMat) {
                current.itemName = foundMat.materialName || foundMat.name || foundMat.componentName || (resolvedType === 'rm' ? 'Raw Material' : resolvedType === 'bo' ? 'Bought Out' : resolvedType === 'consumable' ? 'Consumable Item' : 'Finished Good');
                current.unit = foundMat.unit || (foundMat as any).categoryId?.unit || 'PCS';
                current.description = foundMat.descriptions || foundMat.description || foundMat.specification || '';
                const hasSec = Boolean(foundMat.hasSecondaryUnit || (foundMat.secondaryUnit && Number(foundMat.conversionFactor) > 0));
                current.hasSecondaryUnit = hasSec;
                current.secondaryUnit = foundMat.secondaryUnit || '';
                current.conversionFactor = Number(foundMat.conversionFactor) || 1;
                current.selectedUnit = current.unit;

                // Auto-populate Quantity Sent with Available Stock in store/WIP (accounting for current DC in edit mode)
                const availStock = getEffectiveAvailableStock(selectedId, resolvedType);
                const initQty = availStock > 0 ? availStock : (Number(current.quantitySent) || 0);
                current.quantitySent = initQty;
                current.secondaryQuantitySent = hasSec ? parseFloat((initQty * current.conversionFactor).toFixed(4)) : 0;
                
                const rateVal = Number(foundMat.pricePerUnit || (foundMat as any).rate || (foundMat as any).standardCost || 0);
                if (!current.processRate || current.processRate === 0) {
                    current.processRate = rateVal;
                }
                current.unitPrice = current.processRate;
                current.processAmount = (Number(current.quantitySent) || 0) * (Number(current.processRate) || 0);
            }

            // Auto-sync first returning item if toggle is active across all DC types
            if (current.isSameItemReturning !== false) {
                current.returningItems = syncSameReturningItem(current);
            } else if (current.returningItems && current.returningItems.length > 0 && !current.returningItems[0].receivedItemName) {
                current.returningItems[0].receivedItemName = current.itemName || '';
                if (!current.returningItems[0].quantityToBeReceived) {
                    current.returningItems[0].quantityToBeReceived = Number(current.quantitySent) || 0;
                }
            }
        }

        if (field === 'itemType') {
            current.item = '';
            current.itemName = '';
            current.hasSecondaryUnit = false;
            current.secondaryUnit = '';
            current.conversionFactor = 1;
            current.secondaryQuantitySent = 0;
            current.description = '';
            if (current.isSameItemReturning !== false) {
                current.returningItems = syncSameReturningItem(current);
            }
        }

        if (field === 'selectedUnit') {
            current.selectedUnit = value;
            const isSec = Boolean(current.hasSecondaryUnit && current.secondaryUnit && value === current.secondaryUnit);
            const activeQty = isSec ? (Number(current.secondaryQuantitySent) || 0) : (Number(current.quantitySent) || 0);
            const currentRate = Number(current.processRate != null ? current.processRate : current.unitPrice) || 0;
            current.processAmount = parseFloat((activeQty * currentRate).toFixed(2));
            if (current.isSameItemReturning !== false) {
                current.returningItems = syncSameReturningItem(current);
            }
        }

        if (field === 'purpose') {
            current.purpose = value;
            current.processType = value === 'Others' ? (formData.otherPurpose || 'Job Work') : value;
        }

        if (field === 'processRate' || field === 'unitPrice') {
            current.processRate = value;
            current.unitPrice = value;
            const isSec = Boolean(current.hasSecondaryUnit && current.secondaryUnit && current.selectedUnit === current.secondaryUnit);
            const activeQty = isSec ? (Number(current.secondaryQuantitySent) || 0) : (Number(current.quantitySent) || 0);
            current.processAmount = parseFloat((activeQty * (Number(value) || 0)).toFixed(2));
            if (current.isSameItemReturning !== false) {
                current.returningItems = syncSameReturningItem(current);
            }
        }

        if (field === 'quantitySent') {
            const num = Number(value) || 0;
            current.quantitySent = value;
            if (current.hasSecondaryUnit && Number(current.conversionFactor) > 0) {
                current.secondaryQuantitySent = parseFloat((num * Number(current.conversionFactor)).toFixed(4));
            }
            const currentRate = Number(current.processRate != null ? current.processRate : current.unitPrice) || 0;
            const isSec = Boolean(current.hasSecondaryUnit && current.secondaryUnit && current.selectedUnit === current.secondaryUnit);
            const activeQty = isSec ? (Number(current.secondaryQuantitySent) || 0) : num;
            current.processAmount = parseFloat((activeQty * currentRate).toFixed(2));
            if (current.isSameItemReturning !== false) {
                current.returningItems = syncSameReturningItem(current);
            }
        }

        if (field === 'secondaryQuantitySent') {
            const secNum = Number(value) || 0;
            current.secondaryQuantitySent = value;
            const conv = Number(current.conversionFactor) || 1;
            const priVal = (conv > 0 && secNum > 0) ? parseFloat((secNum / conv).toFixed(4)) : 0;
            current.quantitySent = priVal;
            const currentRate = Number(current.processRate != null ? current.processRate : current.unitPrice) || 0;
            const isSec = Boolean(current.hasSecondaryUnit && current.secondaryUnit && current.selectedUnit === current.secondaryUnit);
            const activeQty = isSec ? secNum : priVal;
            current.processAmount = parseFloat((activeQty * currentRate).toFixed(2));
            if (current.isSameItemReturning !== false) {
                current.returningItems = syncSameReturningItem(current);
            }
        }

        newItems[itemIdx] = current;

        // Calculate total estimated process price
        const totalProcPrice = newItems.reduce((acc, it) => {
            const r = Number(it.processRate != null ? it.processRate : it.unitPrice) || 0;
            const isSec = Boolean(it.hasSecondaryUnit && it.secondaryUnit && it.selectedUnit === it.secondaryUnit);
            const q = isSec ? (Number(it.secondaryQuantitySent) || 0) : (Number(it.quantitySent) || 0);
            return acc + (q * r);
        }, 0);

        const totalJW = newItems.reduce((acc, it) => {
            const lineCharges = (it.returningItems || []).reduce((subAcc: number, r: any) => subAcc + (Number(r.processAmount) || 0), 0);
            return acc + lineCharges;
        }, 0);

        setFormData({ 
            ...formData, 
            items: newItems,
            estimatedPrice: totalProcPrice > 0 ? totalProcPrice : formData.estimatedPrice,
            totalJobWorkCharges: parseFloat(totalJW.toFixed(2))
        });
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
            let found: any = null;
            if (type === 'rm') {
                found = [...wipRmItems, ...(rawMaterials.length > 0 ? rawMaterials : materials)].find((m: any) => String(m._id || m.materialId || m.id) === String(selectedId));
            } else if (type === 'bo') {
                found = [...wipBoItems, ...(boughtOuts.length > 0 ? boughtOuts : materials)].find((m: any) => String(m._id || m.materialId || m.id) === String(selectedId));
            } else if (type === 'fg') {
                const sourceList = [...wipFgItems, ...(inHouseItems || [])];
                found = sourceList.find((i: any) => 
                    String(i.materialId) === String(selectedId) || 
                    String(i.id) === String(selectedId) || 
                    String(i._id) === String(selectedId)
                );
            }
            if (found) {
                currentRet.receivedItemName = found.materialName || found.name || found.componentName || 'Returning Material';
                currentRet.receivingUnit = found.unit || (found as any).categoryId?.unit || 'PCS';
                currentRet.description = found.descriptions || found.description || found.specification || '';
                const hasSec = Boolean(found.hasSecondaryUnit || (found.secondaryUnit && Number(found.conversionFactor) > 0));
                currentRet.hasSecondaryUnit = hasSec;
                currentRet.secondaryUnit = found.secondaryUnit || '';
                currentRet.conversionFactor = Number(found.conversionFactor) || 1;
                currentRet.selectedUnit = currentRet.receivingUnit;
                const priQty = Number(currentRet.quantityToBeReceived) || 1;
                currentRet.secondaryQuantityToBeReceived = hasSec ? parseFloat((priQty * currentRet.conversionFactor).toFixed(4)) : 0;
            } else if (value) {
                currentRet.receivedItemName = String(value);
                currentRet.receivingUnit = currentRet.receivingUnit || 'PCS';
            }
        }

        if (field === 'selectedUnit') {
            currentRet.selectedUnit = value;
            const isSec = Boolean(currentRet.hasSecondaryUnit && currentRet.secondaryUnit && value === currentRet.secondaryUnit);
            const activeQty = isSec ? (Number(currentRet.secondaryQuantityToBeReceived) || 0) : (Number(currentRet.quantityToBeReceived) || 0);
            const r = Number(currentRet.processRate) || 0;
            currentRet.processAmount = parseFloat((activeQty * r).toFixed(2));
        }

        if (field === 'processRate') {
            const r = Number(value) || 0;
            currentRet.processRate = r;
            const isSec = Boolean(currentRet.hasSecondaryUnit && currentRet.secondaryUnit && currentRet.selectedUnit === currentRet.secondaryUnit);
            const activeQty = isSec ? (Number(currentRet.secondaryQuantityToBeReceived) || 0) : (Number(currentRet.quantityToBeReceived) || 0);
            currentRet.processAmount = parseFloat((activeQty * r).toFixed(2));
        }

        if (field === 'quantityToBeReceived') {
            const num = Number(value) || 0;
            currentRet.quantityToBeReceived = value;
            if (currentRet.hasSecondaryUnit && Number(currentRet.conversionFactor) > 0) {
                currentRet.secondaryQuantityToBeReceived = parseFloat((num * Number(currentRet.conversionFactor)).toFixed(4));
            }
            const r = Number(currentRet.processRate) || 0;
            const isSec = Boolean(currentRet.hasSecondaryUnit && currentRet.secondaryUnit && currentRet.selectedUnit === currentRet.secondaryUnit);
            const activeQty = isSec ? (Number(currentRet.secondaryQuantityToBeReceived) || 0) : num;
            currentRet.processAmount = parseFloat((activeQty * r).toFixed(2));
        }

        if (field === 'secondaryQuantityToBeReceived') {
            const secNum = Number(value) || 0;
            currentRet.secondaryQuantityToBeReceived = value;
            const conv = Number(currentRet.conversionFactor) || 1;
            const priVal = (conv > 0 && secNum > 0) ? parseFloat((secNum / conv).toFixed(4)) : 0;
            currentRet.quantityToBeReceived = priVal;
            const r = Number(currentRet.processRate) || 0;
            const isSec = Boolean(currentRet.hasSecondaryUnit && currentRet.secondaryUnit && currentRet.selectedUnit === currentRet.secondaryUnit);
            const activeQty = isSec ? secNum : priVal;
            currentRet.processAmount = parseFloat((activeQty * r).toFixed(2));
        }

        if (field === 'receivedItemType') {
            currentRet.receivedItem = '';
            currentRet.receivedItemName = '';
            currentRet.hasSecondaryUnit = false;
            currentRet.secondaryUnit = '';
            currentRet.conversionFactor = 1;
            currentRet.secondaryQuantityToBeReceived = 0;
            currentRet.processRate = 0;
            currentRet.processAmount = 0;
        }

        newRetList[retIdx] = currentRet;
        currentSent.returningItems = newRetList;

        // Sum returning items JW amounts for this sent item
        currentSent.processAmount = newRetList.reduce((sum, r) => sum + (Number(r.processAmount) || 0), 0);
        newItems[itemIdx] = currentSent;

        // Calculate total JW charges across all items
        const totalJW = newItems.reduce((acc, it) => {
            const lineCharges = (it.returningItems || []).reduce((subAcc: number, r: any) => subAcc + (Number(r.processAmount) || 0), 0);
            return acc + lineCharges;
        }, 0);

        setFormData(prev => ({ 
            ...prev, 
            items: newItems,
            totalJobWorkCharges: parseFloat(totalJW.toFixed(2))
        }));
    };

    // Synchronize assemblyGroups with formData (flattened items and estimatedPrice)
    const updateFormDataWithAssemblyGroups = (groups: JobWorkAssemblyGroup[]) => {
        const flattenedItems: any[] = [];
        let totalEstPrice = 0;

        groups.forEach((g) => {
            (g.items || []).forEach((it) => {
                flattenedItems.push({
                    ...it,
                    returningItems: []
                });
            });
            const outAmount = Number(g.assemblyOutputItem?.processAmount) || 0;
            if (outAmount > 0) {
                totalEstPrice += outAmount;
            } else {
                const grpItemsTotal = (g.items || []).reduce((acc, it) => acc + (Number(it.processAmount) || 0), 0);
                totalEstPrice += grpItemsTotal;
            }
        });

        setFormData(prev => ({
            ...prev,
            assemblyGroups: groups,
            items: flattenedItems.length > 0 ? flattenedItems : prev.items,
            assemblyOutputItem: groups[0]?.assemblyOutputItem || prev.assemblyOutputItem,
            estimatedPrice: totalEstPrice > 0 ? totalEstPrice : prev.estimatedPrice
        }));
    };

    const addAssemblyGroup = () => {
        const nextIndex = (formData.assemblyGroups?.length || 0) + 1;
        const defaultSentType = formData.jobWorkType === 'wip-to-wip' ? 'fg' : 'rm';
        const newGroup: JobWorkAssemblyGroup = {
            groupName: `Assembly Line Item #${nextIndex}`,
            items: [
                {
                    item: '',
                    itemName: '',
                    itemType: defaultSentType as any,
                    quantitySent: 1,
                    unit: 'PCS',
                    processType: 'Welding & Assembly',
                    unitPrice: 0,
                    processRate: 0,
                    processAmount: 0,
                    description: '',
                    returningItems: []
                }
            ],
            assemblyOutputItem: {
                item: '',
                itemName: '',
                itemType: 'fg',
                quantityToBeReceived: 1,
                receivingUnit: 'PCS',
                processType: 'Welding & Assembly',
                processRate: 0,
                processAmount: 0,
                description: ''
            }
        };

        const currentGroups = (formData.assemblyGroups && formData.assemblyGroups.length > 0)
            ? formData.assemblyGroups
            : [
                {
                    groupName: 'Assembly Line Item #1',
                    items: formData.items || [],
                    assemblyOutputItem: formData.assemblyOutputItem || newGroup.assemblyOutputItem
                }
            ];

        const updated = [...currentGroups, newGroup];
        updateFormDataWithAssemblyGroups(updated);
    };

    const removeAssemblyGroup = (grpIdx: number) => {
        if (!formData.assemblyGroups || formData.assemblyGroups.length <= 1) return;
        const updated = formData.assemblyGroups.filter((_, idx) => idx !== grpIdx);
        updateFormDataWithAssemblyGroups(updated);
    };

    const addOutwardItemToGroup = (grpIdx: number) => {
        const currentGroups = [...(formData.assemblyGroups || [])];
        if (!currentGroups[grpIdx]) return;
        const defaultSentType = formData.jobWorkType === 'wip-to-wip' ? 'fg' : 'rm';
        const newItem = {
            item: '',
            itemName: '',
            itemType: defaultSentType as any,
            quantitySent: 1,
            unit: 'PCS',
            processType: 'Welding & Assembly',
            unitPrice: 0,
            processRate: 0,
            processAmount: 0,
            description: '',
            returningItems: []
        };
        currentGroups[grpIdx] = {
            ...currentGroups[grpIdx],
            items: [...(currentGroups[grpIdx].items || []), newItem]
        };
        updateFormDataWithAssemblyGroups(currentGroups);
    };

    const removeOutwardItemFromGroup = (grpIdx: number, itemIdx: number) => {
        const currentGroups = [...(formData.assemblyGroups || [])];
        if (!currentGroups[grpIdx] || currentGroups[grpIdx].items.length <= 1) return;
        currentGroups[grpIdx] = {
            ...currentGroups[grpIdx],
            items: currentGroups[grpIdx].items.filter((_, idx) => idx !== itemIdx)
        };
        updateFormDataWithAssemblyGroups(currentGroups);
    };

    const handleGroupOutwardItemChange = (grpIdx: number, itemIdx: number, field: string, value: any) => {
        const currentGroups = [...(formData.assemblyGroups || [])];
        if (!currentGroups[grpIdx] || !currentGroups[grpIdx].items[itemIdx]) return;
        const currentItem = { ...currentGroups[grpIdx].items[itemIdx], [field]: value };

        if (field === 'itemType') {
            currentItem.item = '';
            currentItem.itemName = '';
            currentItem.unit = 'PCS';
            currentItem.hasSecondaryUnit = false;
            currentItem.secondaryUnit = '';
            currentItem.conversionFactor = 1;
            currentItem.secondaryQuantitySent = 0;
            currentItem.selectedUnit = 'PCS';
            currentItem.unitPrice = 0;
            currentItem.processRate = 0;
            currentItem.processAmount = 0;
        }

        if (field === 'item') {
            const selectedId = value;
            const resolved = allMaterialsMap.get(String(selectedId));
            const resolvedType = resolved?.itemType || currentItem.itemType || 'rm';
            currentItem.itemType = resolvedType;

            let foundMat = resolved?.item || null;
            if (!foundMat) {
                foundMat = getMasterItem(selectedId, resolvedType);
            }

            if (foundMat) {
                currentItem.itemName = foundMat.materialName || foundMat.name || foundMat.componentName || (resolvedType === 'rm' ? 'Raw Material' : resolvedType === 'bo' ? 'Bought Out' : resolvedType === 'consumable' ? 'Consumable Item' : 'Material');
                currentItem.unit = foundMat.unit || (foundMat as any).categoryId?.unit || 'PCS';
                currentItem.description = foundMat.descriptions || foundMat.description || foundMat.specification || '';
                const hasSec = Boolean(foundMat.hasSecondaryUnit || (foundMat.secondaryUnit && Number(foundMat.conversionFactor) > 0));
                currentItem.hasSecondaryUnit = hasSec;
                currentItem.secondaryUnit = foundMat.secondaryUnit || '';
                currentItem.conversionFactor = Number(foundMat.conversionFactor) || 1;
                currentItem.selectedUnit = currentItem.unit;

                // Auto-populate Quantity Sent with Available Stock in store/WIP (accounting for current DC in edit mode)
                const availStock = getEffectiveAvailableStock(selectedId, resolvedType);
                const initQty = availStock > 0 ? availStock : (Number(currentItem.quantitySent) || 0);
                currentItem.quantitySent = initQty;
                currentItem.secondaryQuantitySent = hasSec ? parseFloat((initQty * currentItem.conversionFactor).toFixed(4)) : 0;

                currentItem.unitPrice = Number(foundMat.pricePerUnit || (foundMat as any).rate || (foundMat as any).standardCost || 0);
                if (!currentItem.processRate || currentItem.processRate === 0) {
                    currentItem.processRate = currentItem.unitPrice;
                }
                currentItem.processAmount = (Number(currentItem.quantitySent) || 0) * (Number(currentItem.processRate) || 0);
            }
        }

        if (field === 'selectedUnit') {
            currentItem.selectedUnit = value;
            const isSec = Boolean(currentItem.hasSecondaryUnit && currentItem.secondaryUnit && value === currentItem.secondaryUnit);
            const activeQty = isSec ? (Number(currentItem.secondaryQuantitySent) || 0) : (Number(currentItem.quantitySent) || 0);
            const r = Number(currentItem.processRate != null ? currentItem.processRate : currentItem.unitPrice) || 0;
            currentItem.processAmount = parseFloat((activeQty * r).toFixed(2));
        }

        if (field === 'secondaryQuantitySent') {
            const secNum = Number(value) || 0;
            currentItem.secondaryQuantitySent = value;
            const conv = Number(currentItem.conversionFactor) || 1;
            const priVal = (conv > 0 && secNum > 0) ? parseFloat((secNum / conv).toFixed(4)) : 0;
            currentItem.quantitySent = priVal;
            const r = Number(currentItem.processRate != null ? currentItem.processRate : currentItem.unitPrice) || 0;
            const isSec = Boolean(currentItem.hasSecondaryUnit && currentItem.secondaryUnit && currentItem.selectedUnit === currentItem.secondaryUnit);
            const activeQty = isSec ? secNum : priVal;
            currentItem.processAmount = parseFloat((activeQty * r).toFixed(2));
        }

        if (field === 'quantitySent') {
            const q = Number(value) || 0;
            currentItem.quantitySent = value;
            if (currentItem.hasSecondaryUnit && Number(currentItem.conversionFactor) > 0) {
                currentItem.secondaryQuantitySent = parseFloat((q * Number(currentItem.conversionFactor)).toFixed(4));
            }
            const r = Number(currentItem.processRate != null ? currentItem.processRate : currentItem.unitPrice) || 0;
            const isSec = Boolean(currentItem.hasSecondaryUnit && currentItem.secondaryUnit && currentItem.selectedUnit === currentItem.secondaryUnit);
            const activeQty = isSec ? (Number(currentItem.secondaryQuantitySent) || 0) : q;
            currentItem.processAmount = parseFloat((activeQty * r).toFixed(2));
        }

        if (field === 'processRate' || field === 'unitPrice') {
            const r = Number(value) || 0;
            currentItem.processRate = value;
            currentItem.unitPrice = value;
            const isSec = Boolean(currentItem.hasSecondaryUnit && currentItem.secondaryUnit && currentItem.selectedUnit === currentItem.secondaryUnit);
            const activeQty = isSec ? (Number(currentItem.secondaryQuantitySent) || 0) : (Number(currentItem.quantitySent) || 0);
            currentItem.processAmount = parseFloat((activeQty * r).toFixed(2));
        }

        if (field === 'purpose') {
            currentItem.purpose = value;
            currentItem.processType = value === 'Others' ? (formData.otherPurpose || 'Job Work') : value;
        }

        const newItems = [...currentGroups[grpIdx].items];
        newItems[itemIdx] = currentItem;
        currentGroups[grpIdx] = {
            ...currentGroups[grpIdx],
            items: newItems
        };
        updateFormDataWithAssemblyGroups(currentGroups);
    };

    const handleGroupAssemblyOutputChange = (grpIdx: number, field: string, value: any) => {
        const currentGroups = [...(formData.assemblyGroups || [])];
        if (!currentGroups[grpIdx]) return;
        const baseOut = currentGroups[grpIdx].assemblyOutputItem || {
            item: '',
            itemName: '',
            itemType: 'fg',
            quantityToBeReceived: 1,
            receivingUnit: 'PCS',
            processType: 'Welding & Assembly',
            processRate: 0,
            processAmount: 0,
            description: '',
        };
        const currentOut: JobWorkAssemblyOutputItem = {
            ...baseOut,
            [field]: value
        };

        if (field === 'item') {
            const selectedId = value;
            const sourceList = [...wipFgItems, ...(inHouseItems || [])];
            const foundFg = sourceList.find((i: any) => 
                String(i.materialId) === String(selectedId) || 
                String(i.id) === String(selectedId) || 
                String(i._id) === String(selectedId)
            );
            if (foundFg) {
                currentOut.itemName = foundFg.materialName || foundFg.name || foundFg.componentName || 'Assembled Product';
                currentOut.receivingUnit = foundFg.unit || 'PCS';
                currentOut.itemType = 'fg';
                const hasSec = Boolean(foundFg.hasSecondaryUnit || (foundFg.secondaryUnit && Number(foundFg.conversionFactor) > 0));
                currentOut.hasSecondaryUnit = hasSec;
                currentOut.secondaryUnit = foundFg.secondaryUnit || '';
                currentOut.conversionFactor = Number(foundFg.conversionFactor) || 1;
                currentOut.selectedUnit = currentOut.receivingUnit;
                const priQty = Number(currentOut.quantityToBeReceived) || 1;
                currentOut.secondaryQuantityToBeReceived = hasSec ? parseFloat((priQty * currentOut.conversionFactor).toFixed(4)) : 0;
            } else {
                const foundMat = [...rawMaterials, ...boughtOuts, ...(materials || [])].find((m: any) => String(m._id) === String(selectedId));
                if (foundMat) {
                    currentOut.itemName = foundMat.name || 'Converted Material';
                    currentOut.receivingUnit = foundMat.unit || (foundMat as any).categoryId?.unit || 'PCS';
                    currentOut.itemType = (foundMat.type === 'bo' || foundMat.itemType === 'bo') ? 'bo' : 'rm';
                    const hasSec = Boolean(foundMat.hasSecondaryUnit || (foundMat.secondaryUnit && Number(foundMat.conversionFactor) > 0));
                    currentOut.hasSecondaryUnit = hasSec;
                    currentOut.secondaryUnit = foundMat.secondaryUnit || '';
                    currentOut.conversionFactor = Number(foundMat.conversionFactor) || 1;
                    currentOut.selectedUnit = currentOut.receivingUnit;
                    const priQty = Number(currentOut.quantityToBeReceived) || 1;
                    currentOut.secondaryQuantityToBeReceived = hasSec ? parseFloat((priQty * currentOut.conversionFactor).toFixed(4)) : 0;
                } else if (value) {
                    currentOut.itemName = String(value);
                    currentOut.receivingUnit = currentOut.receivingUnit || 'PCS';
                    currentOut.itemType = formData.jobWorkType === 'store-conversion' ? 'rm' : 'fg';
                }
            }
        }

        if (field === 'selectedUnit') {
            currentOut.selectedUnit = value;
            const isSec = Boolean(currentOut.hasSecondaryUnit && currentOut.secondaryUnit && value === currentOut.secondaryUnit);
            const activeQty = isSec ? (Number(currentOut.secondaryQuantityToBeReceived) || 0) : (Number(currentOut.quantityToBeReceived) || 1);
            const r = Number(currentOut.processRate) || 0;
            currentOut.processAmount = parseFloat((activeQty * r).toFixed(2));
        }

        if (field === 'processRate') {
            const r = Number(value) || 0;
            currentOut.processRate = r;
            const isSec = Boolean(currentOut.hasSecondaryUnit && currentOut.secondaryUnit && currentOut.selectedUnit === currentOut.secondaryUnit);
            const activeQty = isSec ? (Number(currentOut.secondaryQuantityToBeReceived) || 0) : (Number(currentOut.quantityToBeReceived) || 1);
            currentOut.processAmount = parseFloat((activeQty * r).toFixed(2));
        }

        if (field === 'quantityToBeReceived') {
            const q = Number(value) || 0;
            currentOut.quantityToBeReceived = value;
            if (currentOut.hasSecondaryUnit && Number(currentOut.conversionFactor) > 0) {
                currentOut.secondaryQuantityToBeReceived = parseFloat((q * Number(currentOut.conversionFactor)).toFixed(4));
            }
            const r = Number(currentOut.processRate) || 0;
            const isSec = Boolean(currentOut.hasSecondaryUnit && currentOut.secondaryUnit && currentOut.selectedUnit === currentOut.secondaryUnit);
            const activeQty = isSec ? (Number(currentOut.secondaryQuantityToBeReceived) || 0) : q;
            currentOut.processAmount = parseFloat((activeQty * r).toFixed(2));
        }

        if (field === 'secondaryQuantityToBeReceived') {
            const secNum = Number(value) || 0;
            currentOut.secondaryQuantityToBeReceived = value;
            const conv = Number(currentOut.conversionFactor) || 1;
            currentOut.quantityToBeReceived = (conv > 0 && secNum > 0) ? parseFloat((secNum / conv).toFixed(4)) : 0;
            const r = Number(currentOut.processRate) || 0;
            const isSec = Boolean(currentOut.hasSecondaryUnit && currentOut.secondaryUnit && currentOut.selectedUnit === currentOut.secondaryUnit);
            const activeQty = isSec ? secNum : (Number(currentOut.quantityToBeReceived) || 0);
            currentOut.processAmount = parseFloat((activeQty * r).toFixed(2));
        }

        currentGroups[grpIdx] = {
            ...currentGroups[grpIdx],
            assemblyOutputItem: currentOut
        };
        updateFormDataWithAssemblyGroups(currentGroups);
    };

    // Handle Assembly Output Item Changes (Legacy single output handler)
    const handleAssemblyOutputChange = (field: string, value: any) => {
        if (formData.assemblyGroups && formData.assemblyGroups.length > 0) {
            handleGroupAssemblyOutputChange(0, field, value);
            return;
        }
        const currentOut: JobWorkAssemblyOutputItem = {
            item: '',
            itemName: '',
            itemType: 'fg',
            quantityToBeReceived: 1,
            receivingUnit: 'PCS',
            processType: 'Assembly',
            processRate: 0,
            processAmount: 0,
            description: '',
            ...(formData.assemblyOutputItem || {}),
            [field]: value
        };

        if (field === 'item') {
            const selectedId = value;
            const sourceList = [...wipFgItems, ...(inHouseItems || [])];
            const foundFg = sourceList.find((i: any) => 
                String(i.materialId) === String(selectedId) || 
                String(i.id) === String(selectedId) || 
                String(i._id) === String(selectedId)
            );
            if (foundFg) {
                currentOut.itemName = foundFg.materialName || foundFg.name || foundFg.componentName || 'Assembled Product';
                currentOut.receivingUnit = foundFg.unit || 'PCS';
                currentOut.itemType = 'fg';
            } else {
                const foundMat = [...rawMaterials, ...boughtOuts, ...(materials || [])].find((m: any) => String(m._id) === String(selectedId));
                if (foundMat) {
                    currentOut.itemName = foundMat.name || 'Converted Material';
                    currentOut.receivingUnit = foundMat.unit || (foundMat as any).categoryId?.unit || 'PCS';
                    currentOut.itemType = (foundMat.type === 'bo' || foundMat.itemType === 'bo') ? 'bo' : 'rm';
                } else if (value) {
                    currentOut.itemName = String(value);
                    currentOut.receivingUnit = currentOut.receivingUnit || 'PCS';
                    currentOut.itemType = formData.jobWorkType === 'store-conversion' ? 'rm' : 'fg';
                }
            }
        }

        if (field === 'processRate') {
            const r = Number(value) || 0;
            currentOut.processRate = r;
            currentOut.processAmount = (Number(currentOut.quantityToBeReceived) || 1) * r;
        }

        if (field === 'quantityToBeReceived') {
            const q = Number(value) || 0;
            const r = Number(currentOut.processRate) || 0;
            currentOut.processAmount = q * r;
        }

        setFormData({
            ...formData,
            assemblyOutputItem: currentOut,
            estimatedPrice: currentOut.processAmount && currentOut.processAmount > 0 ? currentOut.processAmount : formData.estimatedPrice
        });
    };

    // Important Notes / Remarks handlers (Serial-wise)
    const handleNoteChange = (idx: number, value: string) => {
        const nextNotes = [...(formData.notes || [])];
        nextNotes[idx] = value;
        setFormData(prev => ({ ...prev, notes: nextNotes }));
    };

    const addNoteRow = () => {
        const nextNotes = [...(formData.notes || []), ''];
        setFormData(prev => ({ ...prev, notes: nextNotes }));
    };

    const removeNoteRow = (idx: number) => {
        const nextNotes = (formData.notes || []).filter((_, i) => i !== idx);
        setFormData(prev => ({ ...prev, notes: nextNotes }));
    };

    const resetDefaultNotes = () => {
        setFormData(prev => ({ ...prev, notes: [...DEFAULT_JOB_WORK_NOTES] }));
    };

    // Handle Operation Mode Switch (Discrete vs Assembly/Welding)
    const handleOperationModeChange = (mode: 'discrete' | 'assembly') => {
        if (mode === 'assembly') {
            const initialGrpItems = formData.items && formData.items.length > 0
                ? formData.items.map(it => ({
                    ...it,
                    processType: it.processType === 'Machining' ? 'Welding & Assembly' : it.processType
                }))
                : [
                    {
                        item: '',
                        itemName: '',
                        itemType: (formData.jobWorkType === 'wip-to-wip' ? 'fg' : 'rm') as any,
                        quantitySent: 1,
                        unit: 'PCS',
                        processType: 'Welding & Assembly',
                        unitPrice: 0,
                        processRate: 0,
                        processAmount: 0,
                        description: '',
                        returningItems: []
                    }
                ];

            const existingGroups = (formData.assemblyGroups && formData.assemblyGroups.length > 0)
                ? formData.assemblyGroups
                : [
                    {
                        groupName: 'Assembly Line Item #1',
                        items: initialGrpItems,
                        assemblyOutputItem: formData.assemblyOutputItem || {
                            item: '',
                            itemName: '',
                            itemType: 'fg',
                            quantityToBeReceived: 1,
                            receivingUnit: 'PCS',
                            processType: 'Welding & Assembly',
                            processRate: 0,
                            processAmount: 0,
                            description: ''
                        }
                    }
                ];

            updateFormDataWithAssemblyGroups(existingGroups);
            setFormData(prev => ({
                ...prev,
                operationMode: 'assembly'
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                operationMode: 'discrete'
            }));
        }
    };

    // Add / Remove Sent Material Lines
    const addSentItemRow = () => {
        const isWipToWip = formData.jobWorkType === 'wip-to-wip';
        const defaultSentType = isWipToWip ? 'rm' : 'rm';
        const defaultRetType = formData.jobWorkType === 'store-conversion' ? 'rm' : (isWipToWip ? 'rm' : 'fg');
        setFormData({
            ...formData,
            items: [
                ...formData.items,
                {
                    item: '',
                    itemName: '',
                    itemType: defaultSentType,
                    quantitySent: 1,
                    unit: 'PCS',
                    processType: formData.operationMode === 'assembly' ? 'Welding & Assembly' : 'Machining',
                    processRate: 0,
                    processAmount: 0,
                    unitPrice: 0,
                    description: '',
                    isSameItemReturning: isWipToWip,
                    returningItems: [
                        {
                            receivedItem: '',
                            receivedItemName: '',
                            receivedItemType: defaultRetType,
                            quantityToBeReceived: 1,
                            receivingUnit: 'PCS'
                        }
                    ]
                }
            ]
        });
    };

    const removeSentItemRow = (index: number) => {
        if (formData.items.length <= 1) return;
        const newItems = formData.items.filter((_, i) => i !== index);
        setFormData({ ...formData, items: newItems });
    };

    // Add / Remove Returning Items Sub-Rows
    const addReturningItemSubRow = (itemIdx: number) => {
        const newItems = [...formData.items];
        const currentSent = { ...newItems[itemIdx] };
        const defaultRetType = formData.jobWorkType === 'store-conversion' ? 'rm' : 'fg';
        currentSent.returningItems = [
            ...currentSent.returningItems,
            {
                receivedItem: '',
                receivedItemName: '',
                receivedItemType: defaultRetType,
                quantityToBeReceived: 1,
                receivingUnit: currentSent.unit || 'PCS',
                processRate: 0,
                processAmount: 0,
                description: ''
            }
        ];
        newItems[itemIdx] = currentSent;
        setFormData({ ...formData, items: newItems });
    };

    const removeReturningItemSubRow = (itemIdx: number, retIdx: number) => {
        const newItems = [...formData.items];
        const currentSent = { ...newItems[itemIdx] };
        if (currentSent.returningItems.length <= 1) return;
        currentSent.returningItems = currentSent.returningItems.filter((_, i) => i !== retIdx);
        currentSent.processAmount = currentSent.returningItems.reduce((sum, r) => sum + (Number(r.processAmount) || 0), 0);
        newItems[itemIdx] = currentSent;
        const totalJW = newItems.reduce((acc, it) => {
            const lineCharges = (it.returningItems || []).reduce((subAcc: number, r: any) => subAcc + (Number(r.processAmount) || 0), 0);
            return acc + lineCharges;
        }, 0);
        setFormData(prev => ({ 
            ...prev, 
            items: newItems,
            totalJobWorkCharges: parseFloat(totalJW.toFixed(2))
        }));
    };

    // Form Submission with Strict Stock Validation & Real-Time Error Mapping
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!token) return;

        const errors: Record<string, string> = {};

        // Validation 1: Supplier selection
        if (!formData.vendor) {
            errors.vendor = 'Subcontractor / Vendor is required';
        }

        // Validation 2: Challan Date
        if (!formData.date) {
            errors.date = 'Challan date is required';
        }

        // Validation: Purpose of Outward Movement
        if (!formData.purpose) {
            errors.purpose = 'Purpose of outward movement is required';
        } else if (formData.purpose === 'Others' && !formData.otherPurpose?.trim()) {
            errors.otherPurpose = 'Please specify custom purpose';
        }

        // Validation 3: MRP Number requirement for WIP flows
        if ((formData.jobWorkType === 'store-to-wip' || formData.jobWorkType === 'wip-to-wip') && !formData.mrpNumber?.trim()) {
            errors.mrpNumber = 'MRP Plan is required for Store to WIP and WIP to WIP';
        }

        // Validation for Outward items and Returning items
        if (formData.operationMode === 'assembly') {
            const groups = formData.assemblyGroups || [];
            if (groups.length === 0) {
                errors.assembly_groups = 'At least one assembly set is required';
            } else {
                for (let g = 0; g < groups.length; g++) {
                    const grp = groups[g];
                    if (!grp.items || grp.items.length === 0) {
                        errors[`grp_${g}_items`] = 'At least one outward material is required for this set';
                    } else {
                        for (let i = 0; i < grp.items.length; i++) {
                            const it = grp.items[i];
                            if (!it.item && !it.itemName) {
                                errors[`grp_${g}_item_${i}_item`] = 'Outward material is required';
                            }
                            if (!it.quantitySent || Number(it.quantitySent) <= 0) {
                                errors[`grp_${g}_item_${i}_quantitySent`] = 'Quantity sent must be > 0';
                            } else if (it.item) {
                                const availStock = getEffectiveAvailableStock(it.item, it.itemType);
                                const reqQty = Number(it.quantitySent) || 0;
                                if (availStock <= 0) {
                                    errors[`grp_${g}_item_${i}_quantitySent`] = `Out of stock`;
                                } else if (reqQty > availStock) {
                                    errors[`grp_${g}_item_${i}_quantitySent`] = `Exceeds stock (${availStock})`;
                                }
                            }
                        }
                    }

                    const out = grp.assemblyOutputItem;
                    if (!out?.item && !out?.itemName?.trim()) {
                        errors[`grp_${g}_output_item`] = 'Assembled / Welded item is required';
                    }
                    if (!out?.quantityToBeReceived || Number(out.quantityToBeReceived) <= 0) {
                        errors[`grp_${g}_output_qty`] = 'Expected return quantity must be > 0';
                    }
                }
            }
        } else {
            // Validation 4: Outward item existence, quantity sent, and stock balance (discrete mode)
            for (let i = 0; i < formData.items.length; i++) {
                const item = formData.items[i];
                if (!item.item && !item.itemName) {
                    errors[`item_${i}_item`] = 'Outward material is required';
                }
                if (!item.quantitySent || Number(item.quantitySent) <= 0) {
                    errors[`item_${i}_quantitySent`] = 'Quantity sent must be > 0';
                } else if (item.item) {
                    const availStock = getEffectiveAvailableStock(item.item, item.itemType);
                    const reqQty = Number(item.quantitySent) || 0;

                    if (availStock <= 0) {
                        errors[`item_${i}_quantitySent`] = `Out of stock (Avail: 0)`;
                    } else if (reqQty > availStock) {
                        errors[`item_${i}_quantitySent`] = `Exceeds stock (Avail: ${availStock})`;
                    }
                }

                // In discrete mode, ensure same item returning is strictly synced across all workflow types
                if (item.isSameItemReturning !== false && item.item) {
                    item.returningItems = syncSameReturningItem(item);
                }

                // Validate returning items for each line
                if (Array.isArray(item.returningItems)) {
                    item.returningItems.forEach((ret, r) => {
                        if (!ret.receivedItem && !ret.receivedItemName) {
                            errors[`item_${i}_ret_${r}_item`] = 'Converted return item is required';
                        }
                        if (!ret.quantityToBeReceived || Number(ret.quantityToBeReceived) <= 0) {
                            errors[`item_${i}_ret_${r}_quantity`] = 'Return qty must be > 0';
                        }
                    });
                }
            }
        }

        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            const targetForm = e.currentTarget as HTMLElement;
            if (targetForm) {
                setTimeout(() => {
                    const firstInvalid = targetForm.querySelector('[data-has-error="true"]');
                    if (firstInvalid) {
                        firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 50);
            }
            return;
        }

        setFormErrors({});

        try {
            setLoading(true);

            // Prepare items for payload
            let submitItems: any[] = [];
            if (formData.operationMode === 'assembly' && formData.assemblyGroups && formData.assemblyGroups.length > 0) {
                formData.assemblyGroups.forEach((g) => {
                    (g.items || []).forEach((it: any) => {
                        submitItems.push({
                            ...it,
                            processType: it.processType || (it.purpose === 'Others' ? (formData.otherPurpose || 'Job Work') : (it.purpose || formData.purpose || 'Welding & Assembly')),
                            returningItems: []
                        });
                    });
                });
            } else {
                submitItems = formData.items.map(it => {
                    const itemCopy = { ...it };
                    if (itemCopy.purpose === 'Others' && !itemCopy.processType) {
                        itemCopy.processType = formData.otherPurpose || 'Job Work';
                    }
                    if (itemCopy.isSameItemReturning !== false && itemCopy.item) {
                        itemCopy.returningItems = syncSameReturningItem(itemCopy);
                    }
                    return itemCopy;
                });
            }

            const calculatedTotalCharges = formData.operationMode === 'assembly'
                ? (formData.assemblyGroups || []).reduce((acc, g) => acc + (Number(g.assemblyOutputItem?.processAmount) || 0), 0)
                : (formData.items || []).reduce((acc, it) => acc + (it.returningItems || []).reduce((subAcc: number, r: any) => subAcc + (Number(r.processAmount) || 0), 0), 0);

            const payload: any = {
                ...formData,
                items: submitItems,
                assemblyGroups: formData.operationMode === 'assembly' ? formData.assemblyGroups : undefined,
                assemblyOutputItem: formData.operationMode === 'assembly' && formData.assemblyGroups && formData.assemblyGroups.length > 0
                    ? formData.assemblyGroups[0].assemblyOutputItem
                    : undefined,
                totalJobWorkCharges: calculatedTotalCharges > 0 ? calculatedTotalCharges : (formData.totalJobWorkCharges || 0),
                mrpPlan: formData.mrpPlan ? formData.mrpPlan : undefined,
                mrpNumber: formData.mrpNumber ? formData.mrpNumber : undefined,
            };

            if (formData.operationMode !== 'assembly') {
                delete payload.assemblyOutputItem;
                delete payload.assemblyGroups;
            } else if (payload.assemblyOutputItem && (!payload.assemblyOutputItem.item || String(payload.assemblyOutputItem.item).trim() === '')) {
                payload.assemblyOutputItem = {
                    ...payload.assemblyOutputItem,
                    item: undefined
                };
            }

            let res;
            if (initialData && (initialData as any)._id) {
                res = await apiPut(`/api/store/jobwork/update/${(initialData as any)._id}`, payload, token);
            } else {
                res = await apiPost('/api/store/jobwork/create', payload, token);
            }

            setSuccessData(res.jobWork || res);
            onSuccess();
        } catch (err: any) {
            console.error(err);
            onError(err.message || 'Failed to save Job Work Challan');
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadPDF = async () => {
        try {
            const allVendors = [...(jobWorkSuppliers || []), ...(vendors || [])];
            await generateDocument('pdf', 'returnable_dc', { doc: successData, companyInfo, vendors: allVendors });
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
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg p-6 border border-slate-200 dark:border-slate-800 text-center relative">
                    <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-indigo-200 dark:border-indigo-800 shadow-xs">
                        <Check className="w-7 h-7 stroke-[3px]" />
                    </div>
                    <h2 className="text-xl font-black text-slate-900 dark:text-white mb-1 tracking-tight">
                        Challan Generated Successfully
                    </h2>
                    <p className="text-slate-500 text-xs mb-5">
                        Returnable DC <strong className="text-indigo-600 dark:text-indigo-400">{successData.challanNumber}</strong> is ready for print.
                    </p>

                    <div className="grid grid-cols-2 gap-3 mb-6 bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-left text-xs">
                        <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Vendor</span>
                            <p className="font-bold text-slate-800 dark:text-slate-200 truncate">{successData.vendor?.name || 'Supplier'}</p>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase">DC Type</span>
                            <p className="font-bold text-indigo-600 dark:text-indigo-400 uppercase">{successData.jobWorkType || 'Conversion'}</p>
                        </div>
                    </div>

                    <div className="flex gap-2.5 justify-center">
                        <button
                            onClick={handleDownloadPDF}
                            className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                        >
                            <FileText size={15} />
                            Download 3-Copy PDF
                        </button>
                        <button
                            onClick={handleDownloadExcel}
                            className="py-2.5 px-4 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                            <FileSpreadsheet size={15} />
                            Excel
                        </button>
                    </div>

                    <button
                        onClick={onClose}
                        className="mt-4 text-xs text-slate-400 hover:text-slate-600 font-semibold cursor-pointer"
                    >
                        Close & Return to List
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-2 sm:p-4 bg-slate-950/75 backdrop-blur-md overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-[96vw] xl:max-w-7xl 2xl:max-w-[1650px] my-auto overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[94vh] animate-in fade-in zoom-in-95 duration-200">
                
                {/* Thin, Compact Header */}
                <div className="px-5 py-3.5 bg-slate-900 text-white flex justify-between items-center flex-shrink-0 border-b border-slate-800">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-indigo-600/30 rounded-xl flex items-center justify-center border border-indigo-500/40">
                            <Factory className="text-indigo-400 w-4 h-4" />
                        </div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-sm sm:text-base font-black tracking-tight">
                                {initialData ? "Edit Returnable DC" : "New Outward Returnable DC"}
                            </h2>
                            <span className="bg-indigo-900/80 text-indigo-200 border border-indigo-700 text-[10px] uppercase font-black px-2 py-0.5 rounded-md">
                                Job-Work
                            </span>
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
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
                    
                    {/* Visual Error Summary Alert Banner */}
                    {Object.keys(formErrors).length > 0 && (
                        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 rounded-xl flex items-center justify-between gap-2.5 text-rose-800 dark:text-rose-300 animate-in fade-in duration-150 shadow-2xs">
                            <div className="flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                                <span className="text-xs font-bold">
                                    {initialData 
                                        ? `Please correct the highlighted field${Object.keys(formErrors).length > 1 ? 's' : ''} before updating Challan.` 
                                        : `Please fill in the highlighted compulsory field${Object.keys(formErrors).length > 1 ? 's' : ''} before creating Challan.`}
                                </span>
                            </div>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-200 dark:bg-rose-900 text-rose-900 dark:text-rose-200">
                                {Object.keys(formErrors).length} required
                            </span>
                        </div>
                    )}

                    {/* Segmented Returnable DC Type Bar with Clear Direction Subtitles */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 gap-1.5 relative">
                        {initialData && (
                            <div className="sm:col-span-3 pb-1 text-center flex items-center justify-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                                <Lock size={12} className="text-indigo-500" />
                                <span>Workflow type is locked when editing an existing Returnable DC</span>
                            </div>
                        )}
                        <button
                            type="button"
                            disabled={!!initialData}
                            onClick={() => !initialData && handleDcTypeChange('store-conversion')}
                            title={initialData ? "Workflow type cannot be modified after DC creation" : undefined}
                            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex flex-col items-center justify-center gap-0.5 text-center ${
                                initialData ? 'cursor-not-allowed' : 'cursor-pointer'
                            } ${
                                (formData.jobWorkType || 'store-conversion') === 'store-conversion'
                                    ? 'bg-indigo-600 text-white shadow-xs'
                                    : initialData 
                                        ? 'text-slate-400 dark:text-slate-600 opacity-60'
                                        : 'text-slate-600 dark:text-slate-400 hover:bg-white/80 dark:hover:bg-slate-700'
                            }`}
                        >
                            <span className="font-extrabold text-xs flex items-center gap-1">
                                🏭 RM Conversion
                                {initialData && (formData.jobWorkType || 'store-conversion') === 'store-conversion' && <Lock size={10} />}
                            </span>
                            <span className={`text-[10px] font-medium leading-tight ${
                                (formData.jobWorkType || 'store-conversion') === 'store-conversion'
                                    ? 'text-indigo-100'
                                    : 'text-slate-500 dark:text-slate-400'
                            }`}>
                                Main Store RM ➔ Main Store RM
                            </span>
                        </button>

                        <button
                            type="button"
                            disabled={!!initialData}
                            onClick={() => !initialData && handleDcTypeChange('store-to-wip')}
                            title={initialData ? "Workflow type cannot be modified after DC creation" : undefined}
                            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex flex-col items-center justify-center gap-0.5 text-center ${
                                initialData ? 'cursor-not-allowed' : 'cursor-pointer'
                            } ${
                                formData.jobWorkType === 'store-to-wip'
                                    ? 'bg-indigo-600 text-white shadow-xs'
                                    : initialData 
                                        ? 'text-slate-400 dark:text-slate-600 opacity-60'
                                        : 'text-slate-600 dark:text-slate-400 hover:bg-white/80 dark:hover:bg-slate-700'
                            }`}
                        >
                            <span className="font-extrabold text-xs flex items-center gap-1">
                                🔄 Store to WIP
                                {initialData && formData.jobWorkType === 'store-to-wip' && <Lock size={10} />}
                            </span>
                            <span className={`text-[10px] font-medium leading-tight ${
                                formData.jobWorkType === 'store-to-wip'
                                    ? 'text-indigo-100'
                                    : 'text-slate-500 dark:text-slate-400'
                            }`}>
                                Main Store RM & BO ➔ Shopfloor WIP (FG)
                            </span>
                        </button>

                        <button
                            type="button"
                            disabled={!!initialData}
                            onClick={() => !initialData && handleDcTypeChange('wip-to-wip')}
                            title={initialData ? "Workflow type cannot be modified after DC creation" : undefined}
                            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex flex-col items-center justify-center gap-0.5 text-center ${
                                initialData ? 'cursor-not-allowed' : 'cursor-pointer'
                            } ${
                                formData.jobWorkType === 'wip-to-wip'
                                    ? 'bg-indigo-600 text-white shadow-xs'
                                    : initialData 
                                        ? 'text-slate-400 dark:text-slate-600 opacity-60'
                                        : 'text-slate-600 dark:text-slate-400 hover:bg-white/80 dark:hover:bg-slate-700'
                            }`}
                        >
                            <span className="font-extrabold text-xs flex items-center gap-1">
                                📦 WIP to WIP
                                {initialData && formData.jobWorkType === 'wip-to-wip' && <Lock size={10} />}
                            </span>
                            <span className={`text-[10px] font-medium leading-tight ${
                                formData.jobWorkType === 'wip-to-wip'
                                    ? 'text-indigo-100'
                                    : 'text-slate-500 dark:text-slate-400'
                            }`}>
                                Shopfloor WIP (RM, BO, FG) ➔ Shopfloor WIP (FG)
                            </span>
                        </button>
                    </div>

                    {/* Section 1: Subcontractor & Dispatch Info */}
                    <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            {/* Vendor Selection */}
                            <div className="lg:col-span-2" data-has-error={!!formErrors.vendor}>
                                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1 flex items-center justify-between">
                                    <span>Subcontractor / Vendor <span className="text-red-500">*</span></span>
                                    {formErrors.vendor && <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold">{formErrors.vendor}</span>}
                                </label>
                                <SearchableSelect
                                    options={supplierOptions}
                                    value={typeof formData.vendor === 'object' && formData.vendor !== null ? ((formData.vendor as any)._id || '') : (formData.vendor || '')}
                                    hasError={!!formErrors.vendor}
                                    onChange={(val) => {
                                        setFormData({ ...formData, vendor: val });
                                        if (val) clearError('vendor');
                                    }}
                                    placeholder="Search Job-Work Vendor..."
                                />
                            </div>

                            {/* MRP Plan Selector */}
                            <div className="lg:col-span-2" data-has-error={!!formErrors.mrpNumber}>
                                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1 flex items-center justify-between">
                                    <span className="flex items-center gap-1">
                                        <span>MRP Plan #</span>
                                        {(formData.jobWorkType === 'store-to-wip' || formData.jobWorkType === 'wip-to-wip') && (
                                            <span className="text-red-500">*</span>
                                        )}
                                    </span>
                                    {formErrors.mrpNumber && <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold">{formErrors.mrpNumber}</span>}
                                </label>
                                <SearchableSelect
                                    options={mrpOptions}
                                    value={formData.mrpNumber || ''}
                                    placeholder={formData.jobWorkType === 'store-conversion' ? "Search open MRP #, customer, FG..." : "Search and select open MRP plan..."}
                                    allowCustom={true}
                                    hasError={!!formErrors.mrpNumber}
                                    onChange={(val) => {
                                        const found = mrpOptions.find(m => m.value === val);
                                        setFormData({ 
                                            ...formData, 
                                            mrpNumber: val, 
                                            mrpPlan: found?.id || '' 
                                        });
                                        if (val) clearError('mrpNumber');
                                    }}
                                />
                            </div>

                            {/* Purpose of Outward Movement / Processing */}
                            <div className={formData.purpose === 'Others' ? "lg:col-span-2" : "lg:col-span-2"} data-has-error={!!formErrors.purpose}>
                                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1 flex items-center justify-between">
                                    <span className="flex items-center gap-1">
                                        <span>Purpose of Outward Movement</span>
                                        <span className="text-red-500">*</span>
                                    </span>
                                    {formErrors.purpose && <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold">{formErrors.purpose}</span>}
                                </label>
                                <select
                                    value={formData.purpose || 'Machining'}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setFormData(prev => ({
                                            ...prev,
                                            purpose: val,
                                            items: prev.items.map(it => ({
                                                ...it,
                                                processType: val === 'Others' ? (prev.otherPurpose || 'Job Work') : val,
                                                purpose: val
                                            })),
                                            assemblyOutputItem: prev.assemblyOutputItem ? {
                                                ...prev.assemblyOutputItem,
                                                processType: val === 'Others' ? (prev.otherPurpose || 'Job Work') : val
                                            } : prev.assemblyOutputItem,
                                            assemblyGroups: prev.assemblyGroups?.map(g => ({
                                                ...g,
                                                assemblyOutputItem: {
                                                    ...g.assemblyOutputItem,
                                                    processType: val === 'Others' ? (prev.otherPurpose || 'Job Work') : val
                                                }
                                            }))
                                        }));
                                        if (val) clearError('purpose');
                                    }}
                                    className="w-full h-9 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500/20 outline-none cursor-pointer"
                                >
                                    {JOB_WORK_PURPOSES.map((p) => (
                                        <option key={p} value={p}>{p}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Conditional: Specify Purpose if "Others" */}
                            {formData.purpose === 'Others' && (
                                <div className="lg:col-span-2 animate-in fade-in slide-in-from-top-1 duration-200" data-has-error={!!formErrors.otherPurpose}>
                                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1 flex items-center justify-between">
                                        <span className="flex items-center gap-1">
                                            <span>Specify Custom Purpose</span>
                                            <span className="text-red-500">*</span>
                                        </span>
                                        {formErrors.otherPurpose && <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold">{formErrors.otherPurpose}</span>}
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Laser Engraving, Electroplating, Deburring..."
                                        value={formData.otherPurpose || ''}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setFormData(prev => ({
                                                ...prev,
                                                otherPurpose: val,
                                                items: prev.items.map(it => ({
                                                    ...it,
                                                    processType: val || 'Job Work',
                                                    purpose: 'Others'
                                                })),
                                                assemblyOutputItem: prev.assemblyOutputItem ? {
                                                    ...prev.assemblyOutputItem,
                                                    processType: val || 'Job Work'
                                                } : prev.assemblyOutputItem
                                            }));
                                            if (val.trim()) clearError('otherPurpose');
                                        }}
                                        className={`w-full h-9 px-3 border rounded-xl text-xs font-semibold focus:ring-2 outline-none transition-all ${
                                            formErrors.otherPurpose
                                                ? 'bg-rose-50/50 dark:bg-rose-950/40 border-rose-500 text-rose-900 dark:text-rose-100 ring-1 ring-rose-400 focus:ring-rose-500'
                                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus:ring-indigo-500/20 text-slate-800 dark:text-slate-200'
                                        }`}
                                    />
                                </div>
                            )}

                            {/* Challan Date */}
                            <div data-has-error={!!formErrors.date}>
                                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1 flex items-center justify-between">
                                    <span>Challan Date <span className="text-red-500">*</span></span>
                                    {formErrors.date && <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold">{formErrors.date}</span>}
                                </label>
                                <input
                                    type="date"
                                    value={formData.date ? formData.date.split('T')[0] : ''}
                                    onChange={(e) => {
                                        setFormData({ ...formData, date: e.target.value });
                                        if (e.target.value) clearError('date');
                                    }}
                                    className={`w-full h-9 px-3 border rounded-xl text-xs font-medium focus:ring-2 outline-none cursor-pointer transition-all ${
                                        formErrors.date
                                            ? 'bg-rose-50/50 dark:bg-rose-950/40 border-rose-500 text-rose-900 dark:text-rose-100 ring-1 ring-rose-400 focus:ring-rose-500'
                                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus:ring-indigo-500/20'
                                    }`}
                                />
                            </div>

                            {/* Expected Return Date */}
                            <div>
                                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                                    Expected Return
                                </label>
                                <input
                                    type="date"
                                    value={formData.expectedReturnDate ? formData.expectedReturnDate.split('T')[0] : ''}
                                    onChange={(e) => setFormData({ ...formData, expectedReturnDate: e.target.value })}
                                    className="w-full h-9 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500/20 outline-none cursor-pointer"
                                />
                            </div>

                            {/* Vehicle No */}
                            <div>
                                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                                    Vehicle No
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. MH-12-AB-1234"
                                    value={formData.vehicleNo || ''}
                                    onChange={(e) => setFormData({ ...formData, vehicleNo: e.target.value })}
                                    className="w-full h-9 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium uppercase focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                />
                            </div>

                            {/* E-Way Bill */}
                            <div>
                                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                                    E-Way Bill #
                                </label>
                                <input
                                    type="text"
                                    placeholder="12-digit E-Way..."
                                    value={formData.ewayBillNo || ''}
                                    onChange={(e) => setFormData({ ...formData, ewayBillNo: e.target.value })}
                                    className="w-full h-9 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Materials Sent & Inward Items */}
                    <div className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                            {/* Section Title */}
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                                <Package size={14} className="text-indigo-600" />
                                {formData.operationMode === 'assembly' ? 'Outward Materials' : 'Materials Sent & Inward Returns'}
                            </span>

                            {/* Simple Toggle Switch: ON = One to Many (Default), OFF = Many to One */}
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                    <span className={`text-xs transition-colors ${formData.operationMode === 'assembly' ? 'font-black text-indigo-600 dark:text-indigo-400' : 'font-semibold text-slate-400'}`}>
                                        Many to One
                                    </span>
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={formData.operationMode !== 'assembly'}
                                        onClick={() => handleOperationModeChange(formData.operationMode === 'assembly' ? 'discrete' : 'assembly')}
                                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                            formData.operationMode !== 'assembly' ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                                        }`}
                                        title={formData.operationMode !== 'assembly' ? 'One to Many' : 'Many to One'}
                                    >
                                        <span
                                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                                formData.operationMode !== 'assembly' ? 'translate-x-5' : 'translate-x-0'
                                            }`}
                                        />
                                    </button>
                                    <span className={`text-xs transition-colors ${formData.operationMode !== 'assembly' ? 'font-black text-indigo-600 dark:text-indigo-400' : 'font-semibold text-slate-400'}`}>
                                        One to Many
                                    </span>
                                </div>

                                <button
                                    type="button"
                                    onClick={formData.operationMode === 'assembly' ? addAssemblyGroup : addSentItemRow}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 rounded-lg text-xs font-bold border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 transition-colors cursor-pointer"
                                >
                                    <Plus size={13} /> {formData.operationMode === 'assembly' ? 'Add Assembly Set' : 'Add Line'}
                                </button>
                            </div>
                        </div>

                        {/* Section 2 Body */}
                        {formData.operationMode === 'assembly' ? (
                            /* Assembly Mode: Multiple Assembly Sets (Line Items) */
                            <div className="space-y-5">
                                {(formData.assemblyGroups || []).map((group, grpIdx) => (
                                    <div 
                                        key={grpIdx} 
                                        className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-indigo-200 dark:border-indigo-900/80 p-4 sm:p-5 shadow-xs space-y-4"
                                    >
                                        {/* Assembly Set Header */}
                                        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-indigo-100 dark:border-indigo-950">
                                            <div className="flex items-center gap-2.5">
                                                <span className="w-7 h-7 rounded-xl bg-indigo-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
                                                    #{grpIdx + 1}
                                                </span>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                                                            {group.groupName || `Assembly Line Item #${grpIdx + 1}`}
                                                        </h3>
                                                        <span className="bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider border border-indigo-200 dark:border-indigo-800">
                                                            Many ➔ 1 Return
                                                        </span>
                                                    </div>
                                                    <p className="text-[11px] text-slate-500 font-medium">
                                                        Multiple outward materials combined into 1 welded / assembled return product
                                                    </p>
                                                </div>
                                            </div>

                                            {(formData.assemblyGroups?.length || 0) > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeAssemblyGroup(grpIdx)}
                                                    className="px-2.5 py-1 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg text-xs font-bold border border-rose-200 dark:border-rose-900 transition-colors flex items-center gap-1 cursor-pointer"
                                                    title="Delete this entire assembly set"
                                                >
                                                    <Trash2 size={13} />
                                                    <span>Delete Set</span>
                                                </button>
                                            )}
                                        </div>

                                        {/* Sub-Section 1: Outward Materials for this Set */}
                                        <div className="space-y-2.5">
                                            <div className="flex items-center justify-between">
                                                <label className="text-[11px] font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-tight flex items-center gap-1.5">
                                                    <ArrowRight size={13} className="text-indigo-600" />
                                                    Outward Materials ({group.items.length} {group.items.length === 1 ? 'item' : 'items'} going for weld/assembly)
                                                </label>
                                                <button
                                                    type="button"
                                                    onClick={() => addOutwardItemToGroup(grpIdx)}
                                                    className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                                                >
                                                    <Plus size={12} /> Add Outward Material
                                                </button>
                                            </div>

                                            {/* Outward Materials Rows */}
                                            <div className="space-y-2">
                                                {group.items.map((sentItem, itemIdx) => {
                                                    const isWipToWip = formData.jobWorkType === 'wip-to-wip';
                                                    const stock = getItemStock(sentItem.item || '', sentItem.itemType);
                                                    const isShortage = Boolean(sentItem.item && (Number(sentItem.quantitySent) || 0) > stock);

                                                    return (
                                                        <div 
                                                            key={itemIdx}
                                                            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 items-end"
                                                        >
                                                            {/* Outward Item Selector */}
                                                            <div className="sm:col-span-2 lg:col-span-4" data-has-error={!!formErrors[`grp_${grpIdx}_item_${itemIdx}_item`]}>
                                                                <label className="block text-[10px] font-semibold text-slate-500 mb-1 flex items-center justify-between">
                                                                    <span>Outward Item (RM, BO, Consumable, FG) <span className="text-red-500">*</span></span>
                                                                    {formErrors[`grp_${grpIdx}_item_${itemIdx}_item`] && (
                                                                        <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold">
                                                                            {formErrors[`grp_${grpIdx}_item_${itemIdx}_item`]}
                                                                        </span>
                                                                    )}
                                                                </label>
                                                                <SearchableSelect
                                                                    options={unifiedOutwardOptions}
                                                                    value={sentItem.item || ''}
                                                                    hasError={!!formErrors[`grp_${grpIdx}_item_${itemIdx}_item`]}
                                                                    onChange={(val) => {
                                                                        handleGroupOutwardItemChange(grpIdx, itemIdx, 'item', val);
                                                                        if (val) clearError(`grp_${grpIdx}_item_${itemIdx}_item`);
                                                                    }}
                                                                    placeholder={isWipToWip ? "Select item from WIP stock..." : "Select outward material..."}
                                                                />
                                                                {sentItem.item && (
                                                                    <div className="mt-1 flex flex-wrap items-center justify-between gap-1 text-[10px] font-bold">
                                                                        <div className="flex items-center gap-1.5">
                                                                            <span className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-extrabold border ${
                                                                                sentItem.itemType === 'bo'
                                                                                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                                                                    : sentItem.itemType === 'consumable'
                                                                                    ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                                                                                    : sentItem.itemType === 'fg'
                                                                                    ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                                                                                    : 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                                                                            }`}>
                                                                                {sentItem.itemType === 'bo' 
                                                                                    ? '🟢 BO' 
                                                                                    : sentItem.itemType === 'consumable' 
                                                                                    ? '🟡 Consumable' 
                                                                                    : sentItem.itemType === 'fg' 
                                                                                    ? '🟣 FG' 
                                                                                    : '🔵 RM'}
                                                                            </span>
                                                                            <span className={`px-1.5 py-0.5 rounded text-[9px] ${
                                                                                stock > 0 
                                                                                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300' 
                                                                                    : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300'
                                                                            }`}>
                                                                                {isWipToWip ? 'WIP Stock' : 'Stock'}: {stock} {sentItem.unit || 'PCS'}
                                                                            </span>
                                                                        </div>
                                                                        {isShortage && (
                                                                            <span className="text-rose-600 dark:text-rose-400 text-[9px]">
                                                                                Exceeds {isWipToWip ? 'WIP stock' : 'stock'}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Purpose of Outward */}
                                                            <div className="sm:col-span-2 lg:col-span-2">
                                                                <label className="block text-[10px] font-semibold text-slate-500 mb-1 flex items-center justify-between">
                                                                    <span>Purpose</span>
                                                                </label>
                                                                <select
                                                                    value={sentItem.purpose || formData.purpose || 'Machining'}
                                                                    onChange={(e) => handleGroupOutwardItemChange(grpIdx, itemIdx, 'purpose', e.target.value)}
                                                                    className="w-full h-9 px-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500/20 outline-none cursor-pointer"
                                                                >
                                                                    {JOB_WORK_PURPOSES.map((p) => (
                                                                        <option key={p} value={p}>{p}</option>
                                                                    ))}
                                                                </select>
                                                                {((sentItem.purpose || formData.purpose) === 'Others') && (
                                                                    <input
                                                                        type="text"
                                                                        value={sentItem.processType || ''}
                                                                        placeholder={formData.otherPurpose || "Custom process name..."}
                                                                        onChange={(e) => handleGroupOutwardItemChange(grpIdx, itemIdx, 'processType', e.target.value)}
                                                                        className="w-full h-7 px-2 mt-1 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-lg text-[11px] font-semibold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                                                    />
                                                                )}
                                                            </div>

                                                            {/* Unit (Dual-Unit Aware) */}
                                                            <div className="sm:col-span-1 lg:col-span-1">
                                                                <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                                                                    Unit
                                                                </label>
                                                                {sentItem.hasSecondaryUnit && sentItem.secondaryUnit ? (
                                                                    <select
                                                                        value={sentItem.selectedUnit || sentItem.unit || 'PCS'}
                                                                        onChange={(e) => handleGroupOutwardItemChange(grpIdx, itemIdx, 'selectedUnit', e.target.value)}
                                                                        className="w-full h-9 px-1 border border-indigo-300 dark:border-indigo-700 rounded-xl text-xs font-bold text-center bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 focus:ring-2 focus:ring-indigo-500/20 outline-none cursor-pointer"
                                                                    >
                                                                        <option value={sentItem.unit}>{sentItem.unit} (Pri)</option>
                                                                        <option value={sentItem.secondaryUnit}>{sentItem.secondaryUnit} (Sec)</option>
                                                                    </select>
                                                                ) : (
                                                                    <input
                                                                        type="text"
                                                                        value={sentItem.unit || 'PCS'}
                                                                        onChange={(e) => handleGroupOutwardItemChange(grpIdx, itemIdx, 'unit', e.target.value)}
                                                                        className="w-full h-9 px-2 border rounded-xl text-xs font-bold text-center bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 uppercase"
                                                                    />
                                                                )}
                                                            </div>

                                                            {/* Quantity Sent (Dual-Unit Aware) */}
                                                            <div className="sm:col-span-1 lg:col-span-1" data-has-error={!!formErrors[`grp_${grpIdx}_item_${itemIdx}_quantitySent`]}>
                                                                <label className="block text-[10px] font-semibold text-slate-500 mb-1 flex items-center justify-between">
                                                                    <span>Qty</span>
                                                                    {formErrors[`grp_${grpIdx}_item_${itemIdx}_quantitySent`] && (
                                                                        <span className="text-[9px] text-rose-600 font-bold">Req</span>
                                                                    )}
                                                                </label>
                                                                <input
                                                                    type="number"
                                                                    min="0.0001"
                                                                    step="any"
                                                                    value={
                                                                        (sentItem.hasSecondaryUnit && sentItem.selectedUnit === sentItem.secondaryUnit)
                                                                            ? (sentItem.secondaryQuantitySent !== undefined ? sentItem.secondaryQuantitySent : '')
                                                                            : (sentItem.quantitySent !== undefined ? sentItem.quantitySent : '')
                                                                    }
                                                                    onChange={(e) => {
                                                                        const raw = e.target.value;
                                                                        if (sentItem.hasSecondaryUnit && sentItem.selectedUnit === sentItem.secondaryUnit) {
                                                                            handleGroupOutwardItemChange(grpIdx, itemIdx, 'secondaryQuantitySent', raw);
                                                                        } else {
                                                                            handleGroupOutwardItemChange(grpIdx, itemIdx, 'quantitySent', raw);
                                                                        }
                                                                        if (Number(raw) > 0) clearError(`grp_${grpIdx}_item_${itemIdx}_quantitySent`);
                                                                    }}
                                                                    className="w-full h-9 px-2 border rounded-xl text-xs font-bold text-center bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                                                                />
                                                                {sentItem.hasSecondaryUnit && sentItem.secondaryUnit && (
                                                                    <div className="text-[9px] font-mono font-semibold text-indigo-600 dark:text-indigo-400 mt-1 truncate">
                                                                        {sentItem.selectedUnit === sentItem.secondaryUnit ? (
                                                                            <span>↳ = {sentItem.quantitySent || 0} {sentItem.unit || 'PCS'}</span>
                                                                        ) : (
                                                                            <span>↳ = {sentItem.secondaryQuantitySent || 0} {sentItem.secondaryUnit}</span>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Process Price (₹) */}
                                                            <div className="sm:col-span-1 lg:col-span-1">
                                                                <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                                                                    Price (₹/{sentItem.hasSecondaryUnit && sentItem.selectedUnit === sentItem.secondaryUnit ? sentItem.secondaryUnit : (sentItem.unit || 'unit')})
                                                                </label>
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    step="any"
                                                                    value={sentItem.processRate !== undefined ? sentItem.processRate : ''}
                                                                    onChange={(e) => handleGroupOutwardItemChange(grpIdx, itemIdx, 'processRate', e.target.value)}
                                                                    placeholder="0.00"
                                                                    className="w-full h-9 px-2 border rounded-xl text-xs font-bold text-right bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                                                                />
                                                            </div>

                                                            {/* Amount */}
                                                            <div className="sm:col-span-1 lg:col-span-1 flex flex-col justify-center">
                                                                <label className="block text-[9px] font-semibold text-slate-400 uppercase tracking-tight mb-1 text-right">
                                                                    Amount
                                                                </label>
                                                                <div className="h-9 flex items-center justify-end font-mono font-bold text-xs text-slate-700 dark:text-slate-200 truncate">
                                                                    ₹{(sentItem.processAmount !== undefined 
                                                                        ? Number(sentItem.processAmount) 
                                                                        : (((sentItem.hasSecondaryUnit && sentItem.selectedUnit === sentItem.secondaryUnit ? Number(sentItem.secondaryQuantitySent) : Number(sentItem.quantitySent)) || 0) * (Number(sentItem.processRate != null ? sentItem.processRate : sentItem.unitPrice) || 0))
                                                                    ).toFixed(2)}
                                                                </div>
                                                            </div>

                                                            {/* Trash Button */}
                                                            <div className="sm:col-span-1 lg:col-span-1 flex items-end justify-center pb-0.5">
                                                                {group.items.length > 1 && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => removeOutwardItemFromGroup(grpIdx, itemIdx)}
                                                                        className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer"
                                                                        title="Remove outward material"
                                                                    >
                                                                        <Trash2 size={15} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Sub-Section 2: Inward Welded / Assembled Item for this Set */}
                                        <div className="bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/60 dark:from-slate-900 dark:via-indigo-950/20 dark:to-slate-900 p-3.5 rounded-2xl border-2 border-indigo-300 dark:border-indigo-800 space-y-3">
                                            <div className="flex items-center justify-between border-b border-indigo-200 dark:border-indigo-800/80 pb-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-5 h-5 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold shadow-xs">
                                                        <ArrowRight size={12} />
                                                    </div>
                                                    <h4 className="text-xs font-black text-indigo-950 dark:text-indigo-200 uppercase tracking-wide">
                                                        Inward Welded Item (Coming back from above materials)
                                                    </h4>
                                                </div>
                                                <span className="bg-indigo-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                                                    1 Welded Return
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 pt-1">
                                                {/* Assembled Product Selector */}
                                                <div className="sm:col-span-2 lg:col-span-5" data-has-error={!!formErrors[`grp_${grpIdx}_output_item`]}>
                                                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                                                        <span>Assembled / Welded Item <span className="text-red-500">*</span></span>
                                                        {formErrors[`grp_${grpIdx}_output_item`] && (
                                                            <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold">
                                                                {formErrors[`grp_${grpIdx}_output_item`]}
                                                            </span>
                                                        )}
                                                    </label>
                                                    <SearchableSelect
                                                        options={formData.jobWorkType === 'store-conversion' ? [...rmOptions, ...boOptions] : fgOptions}
                                                        value={group.assemblyOutputItem?.item || ''}
                                                        hasError={!!formErrors[`grp_${grpIdx}_output_item`]}
                                                        allowCustom={true}
                                                        onChange={(val) => {
                                                            handleGroupAssemblyOutputChange(grpIdx, 'item', val);
                                                            if (val) clearError(`grp_${grpIdx}_output_item`);
                                                        }}
                                                        placeholder="Select or enter assembled / welded item..."
                                                    />
                                                </div>

                                                {/* Quantity to receive */}
                                                <div className="sm:col-span-1 lg:col-span-2" data-has-error={!!formErrors[`grp_${grpIdx}_output_qty`]}>
                                                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                                                        <span>Return Qty <span className="text-red-500">*</span></span>
                                                        {formErrors[`grp_${grpIdx}_output_qty`] && (
                                                            <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold">Req</span>
                                                        )}
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min="0.01"
                                                        step="any"
                                                        value={group.assemblyOutputItem?.quantityToBeReceived || ''}
                                                        onChange={(e) => {
                                                            const val = Number(e.target.value);
                                                            handleGroupAssemblyOutputChange(grpIdx, 'quantityToBeReceived', val);
                                                            if (val > 0) clearError(`grp_${grpIdx}_output_qty`);
                                                        }}
                                                        className="w-full h-9 px-2 border-2 border-indigo-400 dark:border-indigo-600 rounded-xl text-xs font-black text-center bg-white dark:bg-slate-900 text-indigo-950 dark:text-white"
                                                    />
                                                </div>

                                                {/* Receiving Unit */}
                                                <div className="sm:col-span-1 lg:col-span-1">
                                                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                                        Unit {group.assemblyOutputItem?.hasSecondaryUnit && <span className="text-[9px] text-amber-600 font-bold">(Dual)</span>}
                                                    </label>
                                                    {group.assemblyOutputItem?.hasSecondaryUnit && group.assemblyOutputItem?.secondaryUnit ? (
                                                        <select
                                                            value={group.assemblyOutputItem?.selectedUnit || group.assemblyOutputItem?.receivingUnit || 'PCS'}
                                                            onChange={(e) => handleGroupAssemblyOutputChange(grpIdx, 'selectedUnit', e.target.value)}
                                                            className="w-full h-9 px-1 border border-indigo-300 dark:border-indigo-700 rounded-xl text-xs font-bold text-center bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 focus:ring-2 focus:ring-indigo-500/20 outline-none cursor-pointer"
                                                        >
                                                            <option value={group.assemblyOutputItem?.receivingUnit}>{group.assemblyOutputItem?.receivingUnit} (Pri)</option>
                                                            <option value={group.assemblyOutputItem?.secondaryUnit}>{group.assemblyOutputItem?.secondaryUnit} (Sec)</option>
                                                        </select>
                                                    ) : (
                                                        <input
                                                            type="text"
                                                            value={group.assemblyOutputItem?.receivingUnit || 'PCS'}
                                                            onChange={(e) => handleGroupAssemblyOutputChange(grpIdx, 'receivingUnit', e.target.value)}
                                                            className="w-full h-9 px-2 border rounded-xl text-xs font-bold text-center bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 uppercase"
                                                        />
                                                    )}
                                                </div>

                                                {/* Process Type */}
                                                <div className="sm:col-span-1 lg:col-span-2">
                                                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                                        Process
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={group.assemblyOutputItem?.processType || 'Welding & Assembly'}
                                                        onChange={(e) => handleGroupAssemblyOutputChange(grpIdx, 'processType', e.target.value)}
                                                        className="w-full h-9 px-2 border rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                                                    />
                                                </div>

                                                {/* Process Rate */}
                                                <div className="sm:col-span-1 lg:col-span-2">
                                                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                                        Rate (₹/{group.assemblyOutputItem?.hasSecondaryUnit && group.assemblyOutputItem?.selectedUnit === group.assemblyOutputItem?.secondaryUnit ? group.assemblyOutputItem?.secondaryUnit : (group.assemblyOutputItem?.receivingUnit || 'unit')})
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="any"
                                                        value={group.assemblyOutputItem?.processRate !== undefined ? group.assemblyOutputItem.processRate : ''}
                                                        onChange={(e) => handleGroupAssemblyOutputChange(grpIdx, 'processRate', e.target.value)}
                                                        placeholder="0.00"
                                                        className="w-full h-9 px-2 border rounded-xl text-xs font-bold text-right bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                                                    />
                                                </div>

                                                {/* Description */}
                                                <div className="sm:col-span-2 lg:col-span-12">
                                                    <input
                                                        type="text"
                                                        value={group.assemblyOutputItem?.description || ''}
                                                        onChange={(e) => handleGroupAssemblyOutputChange(grpIdx, 'description', e.target.value)}
                                                        placeholder="Assembly specifications, technical drawing notes, or welding remarks..."
                                                        className="w-full h-8 px-3 border rounded-xl text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 italic"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {/* Add Another Assembly Line Item (Set) Button */}
                                <div className="pt-1">
                                    <button
                                        type="button"
                                        onClick={addAssemblyGroup}
                                        className="w-full py-3 px-4 rounded-2xl border-2 border-dashed border-indigo-400 dark:border-indigo-700 hover:border-indigo-600 hover:bg-indigo-50/60 dark:hover:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
                                    >
                                        <Plus size={16} />
                                        <span>+ Add Another Assembly Line Item / Set (e.g. 3 materials ➔ 1 welded item)</span>
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* Discrete 1-to-many items */
                            <>
                                <div className="space-y-3.5">
                                    {formData.items.map((sentItem, itemIdx) => {
                                        const isWipToWip = formData.jobWorkType === 'wip-to-wip';
                                        const isStoreConversion = formData.jobWorkType === 'store-conversion';
                                        const stock = getItemStock(sentItem.item || '', sentItem.itemType);
                                        const isOutOfStock = Boolean(sentItem.item && stock <= 0);
                                        const isShortage = Boolean(sentItem.item && (Number(sentItem.quantitySent) || 0) > stock);

                                        return (
                                            <div
                                                key={itemIdx}
                                                className={`bg-white dark:bg-slate-900 rounded-xl p-3.5 sm:p-4 border transition-all shadow-xs space-y-3 ${
                                                    isShortage && !isWipToWip
                                                        ? 'border-red-300 dark:border-red-800 bg-red-50/10'
                                                        : 'border-slate-200 dark:border-slate-800'
                                                }`}
                                            >
                                                {/* Sent Item Top Header */}
                                                <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="w-5 h-5 rounded-full bg-slate-800 text-white text-[11px] font-black flex items-center justify-center">
                                                            {itemIdx + 1}
                                                        </span>
                                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
                                                            Outward Material Line
                                                        </span>
                                                    </div>

                                                    {formData.items.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => removeSentItemRow(itemIdx)}
                                                            className="text-red-500 hover:text-red-700 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                                                        >
                                                            <Trash2 size={13} /> Remove
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Sent Item Inputs Grid */}
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 bg-slate-50/70 dark:bg-slate-800/40 p-3 rounded-lg border border-slate-200/80 dark:border-slate-700/60">
                                                    {/* Outward Item Selector + Live Stock Badge */}
                                                    <div className="sm:col-span-2 lg:col-span-5 xl:col-span-5" data-has-error={!!formErrors[`item_${itemIdx}_item`]}>
                                                        <label className="block text-[10px] font-semibold text-slate-500 mb-1 flex items-center justify-between">
                                                            <span>Item Name (RM, BO, Consumable, FG) <span className="text-red-500">*</span></span>
                                                            {formErrors[`item_${itemIdx}_item`] && (
                                                                <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold">
                                                                    {formErrors[`item_${itemIdx}_item`]}
                                                                </span>
                                                            )}
                                                        </label>
                                                        <SearchableSelect
                                                            options={unifiedOutwardOptions}
                                                            value={sentItem.item || ''}
                                                            hasError={!!formErrors[`item_${itemIdx}_item`]}
                                                            onChange={(val) => {
                                                                handleSentItemChange(itemIdx, 'item', val);
                                                                if (val) clearError(`item_${itemIdx}_item`);
                                                            }}
                                                            placeholder={
                                                                formData.jobWorkType === 'wip-to-wip'
                                                                    ? "Search & select item from WIP stock (RM, BO, FG, Consumables)..."
                                                                    : "Search & select item (RM, BO, Consumables, FG)..."
                                                            }
                                                        />

                                                        {/* Live Stock Display Pill & Auto-Detected Type Badge */}
                                                        {sentItem.item && (
                                                            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1.5 text-[10px] font-bold">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className={`px-2 py-0.5 rounded-md uppercase text-[10px] font-extrabold border ${
                                                                        sentItem.itemType === 'bo'
                                                                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                                                            : sentItem.itemType === 'consumable'
                                                                            ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                                                                            : sentItem.itemType === 'fg'
                                                                            ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                                                                            : 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                                                                    }`}>
                                                                        {sentItem.itemType === 'bo' 
                                                                            ? '🟢 Bought Out' 
                                                                            : sentItem.itemType === 'consumable' 
                                                                            ? '🟡 Consumable' 
                                                                            : sentItem.itemType === 'fg' 
                                                                            ? '🟣 Finished Good' 
                                                                            : '🔵 Raw Material'}
                                                                    </span>
                                                                    <span className={`px-2 py-0.5 rounded-md flex items-center gap-1 ${
                                                                        stock > 0 
                                                                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' 
                                                                            : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
                                                                    }`}>
                                                                        {stock > 0 ? '🟢' : '🔴'} {isWipToWip ? 'WIP Stock:' : 'Stock:'} {stock} {sentItem.unit || 'PCS'}
                                                                    </span>
                                                                </div>
                                                                {isShortage && (
                                                                    <span className="text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 px-2 py-0.5 rounded-md border border-red-200 dark:border-red-800 flex items-center gap-1">
                                                                        <AlertTriangle size={11} />
                                                                        Exceeds by {(Number(sentItem.quantitySent) - stock).toFixed(2)}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Purpose of Outward (Dropdown) */}
                                                    <div className="sm:col-span-2 lg:col-span-2 xl:col-span-2">
                                                        <label className="block text-[10px] font-semibold text-slate-500 mb-1 flex items-center justify-between">
                                                            <span>Purpose</span>
                                                        </label>
                                                        <select
                                                            value={sentItem.purpose || formData.purpose || 'Machining'}
                                                            onChange={(e) => handleSentItemChange(itemIdx, 'purpose', e.target.value)}
                                                            className="w-full h-9 px-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500/20 outline-none cursor-pointer"
                                                        >
                                                            {JOB_WORK_PURPOSES.map((p) => (
                                                                <option key={p} value={p}>{p}</option>
                                                            ))}
                                                        </select>
                                                        {((sentItem.purpose || formData.purpose) === 'Others') && (
                                                            <input
                                                                type="text"
                                                                value={sentItem.processType || ''}
                                                                placeholder={formData.otherPurpose || "Custom process name..."}
                                                                onChange={(e) => handleSentItemChange(itemIdx, 'processType', e.target.value)}
                                                                className="w-full h-7 px-2 mt-1 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-lg text-[11px] font-semibold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                                            />
                                                        )}
                                                    </div>

                                                    {/* Unit (Dual-Unit Aware) */}
                                                    <div className="sm:col-span-1 lg:col-span-1 xl:col-span-1">
                                                        <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                                                            Unit
                                                        </label>
                                                        {sentItem.hasSecondaryUnit && sentItem.secondaryUnit ? (
                                                            <select
                                                                value={sentItem.selectedUnit || sentItem.unit || 'PCS'}
                                                                onChange={(e) => handleSentItemChange(itemIdx, 'selectedUnit', e.target.value)}
                                                                className="w-full h-9 px-1 border border-indigo-300 dark:border-indigo-700 rounded-xl text-xs font-bold text-center bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 focus:ring-2 focus:ring-indigo-500/20 outline-none cursor-pointer"
                                                            >
                                                                <option value={sentItem.unit}>{sentItem.unit} (Pri)</option>
                                                                <option value={sentItem.secondaryUnit}>{sentItem.secondaryUnit} (Sec)</option>
                                                            </select>
                                                        ) : (
                                                            <input
                                                                type="text"
                                                                value={sentItem.unit || 'PCS'}
                                                                onChange={(e) => handleSentItemChange(itemIdx, 'unit', e.target.value)}
                                                                className="w-full h-9 px-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-center bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 uppercase focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                                            />
                                                        )}
                                                    </div>

                                                    {/* Quantity Sent (Dual-Unit Aware) */}
                                                    <div className="sm:col-span-1 lg:col-span-2 xl:col-span-2" data-has-error={!!formErrors[`item_${itemIdx}_quantitySent`]}>
                                                        <label className="block text-[10px] font-semibold text-slate-500 mb-1 flex items-center justify-between">
                                                            <span className="flex items-center gap-1">
                                                                <span>Qty ({sentItem.hasSecondaryUnit && sentItem.selectedUnit === sentItem.secondaryUnit ? sentItem.secondaryUnit : (sentItem.unit || 'PCS')})</span>
                                                                {sentItem.hasSecondaryUnit && sentItem.selectedUnit === sentItem.secondaryUnit && (
                                                                    <span className="text-[9px] font-extrabold px-1 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">2nd</span>
                                                                )}
                                                                <span className="text-red-500">*</span>
                                                            </span>
                                                            {formErrors[`item_${itemIdx}_quantitySent`] && (
                                                                <span className="text-[9px] text-rose-600 dark:text-rose-400 font-bold truncate">
                                                                    {formErrors[`item_${itemIdx}_quantitySent`]}
                                                                </span>
                                                            )}
                                                        </label>
                                                        <input
                                                            type="number"
                                                            min="0.0001"
                                                            step="any"
                                                            value={
                                                                (sentItem.hasSecondaryUnit && sentItem.selectedUnit === sentItem.secondaryUnit)
                                                                    ? (sentItem.secondaryQuantitySent !== undefined ? sentItem.secondaryQuantitySent : '')
                                                                    : (sentItem.quantitySent !== undefined ? sentItem.quantitySent : '')
                                                            }
                                                            onChange={(e) => {
                                                                const raw = e.target.value;
                                                                if (sentItem.hasSecondaryUnit && sentItem.selectedUnit === sentItem.secondaryUnit) {
                                                                    handleSentItemChange(itemIdx, 'secondaryQuantitySent', raw);
                                                                } else {
                                                                    handleSentItemChange(itemIdx, 'quantitySent', raw);
                                                                }
                                                                if (Number(raw) > 0) clearError(`item_${itemIdx}_quantitySent`);
                                                            }}
                                                            className={`w-full h-9 px-2 border rounded-xl text-xs font-bold text-center outline-none transition-all ${
                                                                formErrors[`item_${itemIdx}_quantitySent`]
                                                                    ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-100 ring-1 ring-rose-400 focus:ring-rose-500'
                                                                    : isShortage 
                                                                        ? 'border-red-400 text-red-600 focus:border-red-500 bg-white dark:bg-slate-900' 
                                                                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500/20'
                                                            }`}
                                                        />
                                                        {sentItem.hasSecondaryUnit && sentItem.secondaryUnit && (
                                                            <div className="text-[9px] font-mono font-semibold text-indigo-600 dark:text-indigo-400 mt-1 truncate">
                                                                {sentItem.selectedUnit === sentItem.secondaryUnit ? (
                                                                    <span>↳ = {sentItem.quantitySent || 0} {sentItem.unit || 'PCS'}</span>
                                                                ) : (
                                                                    <span>↳ = {sentItem.secondaryQuantitySent || 0} {sentItem.secondaryUnit}</span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Material Value (₹) - Sent Item Declared / Transit Valuation */}
                                                    <div className="sm:col-span-1 lg:col-span-1 xl:col-span-1">
                                                        <label className="block text-[10px] font-semibold text-slate-500 mb-1 flex items-center justify-between" title="Material value declared for transit insurance / E-Way Bill">
                                                            <span>Mat Value</span>
                                                            <span className="text-[9px] text-slate-400 font-normal">
                                                                ₹/{sentItem.hasSecondaryUnit && sentItem.selectedUnit === sentItem.secondaryUnit ? sentItem.secondaryUnit : (sentItem.unit || 'unit')}
                                                            </span>
                                                        </label>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="any"
                                                            value={sentItem.unitPrice !== undefined ? sentItem.unitPrice : (sentItem.processRate !== undefined ? sentItem.processRate : '')}
                                                            onChange={(e) => handleSentItemChange(itemIdx, 'unitPrice', e.target.value)}
                                                            placeholder="0.00"
                                                            title="Declared Material Value for Transit / Insurance"
                                                            className="w-full h-9 px-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-right bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                                        />
                                                    </div>

                                                    {/* Material Value Subtotal */}
                                                    <div className="sm:col-span-2 lg:col-span-1 xl:col-span-1 flex flex-col justify-center">
                                                        <label className="block text-[9px] font-semibold text-slate-400 uppercase tracking-tight mb-1 text-right" title="Material Declared Value">
                                                            Mat Value
                                                        </label>
                                                        <div className="h-9 flex items-center justify-end font-mono font-bold text-xs text-slate-700 dark:text-slate-200 truncate">
                                                            ₹{(
                                                                ((sentItem.hasSecondaryUnit && sentItem.selectedUnit === sentItem.secondaryUnit ? Number(sentItem.secondaryQuantitySent) : Number(sentItem.quantitySent)) || 0) * 
                                                                (Number(sentItem.unitPrice != null ? sentItem.unitPrice : sentItem.processRate) || 0)
                                                            ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Sub-Section: Expected Returning Items (Discrete Mode) */}
                                                <div className="pl-3 border-l-2 border-indigo-200 dark:border-indigo-800 space-y-2">
                                                    <div className="flex flex-wrap justify-between items-center gap-2">
                                                        <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase flex items-center gap-1">
                                                            <ArrowRight size={12} className="text-indigo-600" />
                                                            Expected Returning Inward Item(s)
                                                        </span>

                                                        <div className="flex items-center gap-3">
                                                            {/* Same Material Returning Toggle */}
                                                            <label className={`flex items-center gap-2 cursor-pointer select-none px-2.5 py-1 rounded-lg border transition-all ${
                                                                sentItem.isSameItemReturning !== false
                                                                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 shadow-2xs'
                                                                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                                                            }`}>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={sentItem.isSameItemReturning !== false}
                                                                    onChange={(e) => handleToggleSameItemReturning(itemIdx, e.target.checked)}
                                                                    className="w-3.5 h-3.5 accent-emerald-600 rounded cursor-pointer"
                                                                />
                                                                <span className="text-[11px] font-bold flex items-center gap-1">
                                                                    <span>Same Material Returning</span>
                                                                    {sentItem.isSameItemReturning !== false && (
                                                                        <span className="text-[9px] px-1.5 py-0.2 bg-emerald-200/60 dark:bg-emerald-800/60 text-emerald-800 dark:text-emerald-200 rounded font-black">
                                                                            Auto 1:1
                                                                        </span>
                                                                    )}
                                                                </span>
                                                            </label>

                                                            {sentItem.isSameItemReturning === false && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => addReturningItemSubRow(itemIdx)}
                                                                    className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                                                                >
                                                                    <Plus size={12} /> Add Return
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {sentItem.isSameItemReturning !== false ? (
                                                        <div className="p-3 bg-emerald-50/40 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-800/60 space-y-2">
                                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                                <div className="flex items-center gap-2">
                                                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                                                        sentItem.itemType === 'rm' ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300' :
                                                                        sentItem.itemType === 'bo' ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300' :
                                                                        'bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300'
                                                                    }`}>
                                                                        {sentItem.itemType === 'rm' ? '🔵 RM' : sentItem.itemType === 'bo' ? '🟢 BO' : '🟣 WIP FG'}
                                                                    </span>
                                                                    <div>
                                                                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                                                            {sentItem.itemName || 'Same Material as Outward'}
                                                                        </div>
                                                                        {sentItem.description && (
                                                                            <div className="text-[11px] text-slate-500 italic mt-0.5 line-clamp-1">
                                                                                {sentItem.description}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                <div className="text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-1 bg-emerald-100/60 dark:bg-emerald-900/40 px-2 py-0.5 rounded-md">
                                                                    <Check size={12} className="text-emerald-600" />
                                                                    <span>Auto-synced Return Qty & Unit</span>
                                                                </div>
                                                            </div>

                                                            {(() => {
                                                                const isSecSelected = Boolean(sentItem.hasSecondaryUnit && sentItem.secondaryUnit && sentItem.selectedUnit === sentItem.secondaryUnit);
                                                                const activeQty = isSecSelected ? (sentItem.secondaryQuantitySent ?? 0) : (sentItem.quantitySent ?? 0);
                                                                const activeUnit = isSecSelected ? sentItem.secondaryUnit : (sentItem.unit || 'PCS');
                                                                const altQty = isSecSelected ? (sentItem.quantitySent ?? 0) : (sentItem.secondaryQuantitySent ?? 0);
                                                                const altUnit = isSecSelected ? (sentItem.unit || 'PCS') : sentItem.secondaryUnit;

                                                                return (
                                                                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end pt-1">
                                                                        {/* Return Qty display (in Selected UOM) */}
                                                                        <div className="sm:col-span-4 lg:col-span-4">
                                                                            <label className="block text-[10px] font-semibold text-slate-500 mb-1 flex items-center justify-between">
                                                                                <span>Returning Quantity (1:1 with Sent Qty)</span>
                                                                                <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                                                                                    In {activeUnit}
                                                                                </span>
                                                                            </label>
                                                                            <div className="h-9 px-3 bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center justify-between shadow-2xs">
                                                                                <span className="text-emerald-700 dark:text-emerald-300 font-extrabold">{activeQty} {activeUnit}</span>
                                                                                {sentItem.hasSecondaryUnit && sentItem.secondaryUnit && (
                                                                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                                                                                        ({altQty} {altUnit})
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        </div>

                                                                        {/* Job Work Rate (₹/activeUnit) */}
                                                                        <div className="sm:col-span-4 lg:col-span-4">
                                                                            <label className="block text-[10px] font-semibold text-slate-500 mb-1 flex items-center justify-between">
                                                                                <span>Job Work Rate</span>
                                                                                <span className="text-[9px] text-slate-400 font-mono">₹/{activeUnit}</span>
                                                                            </label>
                                                                            <input
                                                                                type="number"
                                                                                min="0"
                                                                                step="any"
                                                                                value={(sentItem.returningItems?.[0]?.processRate !== undefined) ? sentItem.returningItems[0].processRate : ''}
                                                                                onChange={(e) => handleReturningItemChange(itemIdx, 0, 'processRate', e.target.value)}
                                                                                placeholder="0.00"
                                                                                className="w-full h-9 px-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-right bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                                                            />
                                                                        </div>

                                                                        {/* Job Work Amount Subtotal */}
                                                                        <div className="sm:col-span-4 lg:col-span-4 flex flex-col justify-center">
                                                                            <label className="block text-[9px] font-semibold text-slate-400 uppercase tracking-tight mb-1 text-right">
                                                                                JW Amount
                                                                            </label>
                                                                            <div className="h-9 flex items-center justify-end font-mono font-bold text-xs text-indigo-600 dark:text-indigo-400">
                                                                                ₹{((Number(activeQty) || 0) * (Number(sentItem.returningItems?.[0]?.processRate) || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })()}
                                                        </div>
                                                    ) : (
                                                        /* Returning Item Sub-Rows when Toggle is OFF */
                                                        <div className="space-y-2">
                                                            {sentItem.returningItems.map((retItem, retIdx) => (
                                                                <div 
                                                                    key={retIdx}
                                                                    className="grid grid-cols-1 sm:grid-cols-12 gap-2 p-2.5 bg-indigo-50/30 dark:bg-indigo-950/20 rounded-lg border border-indigo-100 dark:border-indigo-900/40 items-end"
                                                                >
                                                                    {/* Return Type */}
                                                                    <div className="sm:col-span-3 lg:col-span-2">
                                                                        <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                                                                            Return Type
                                                                        </label>
                                                                        <div className="flex bg-white dark:bg-slate-900 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold">
                                                                            {isStoreConversion ? (
                                                                                <button
                                                                                    type="button"
                                                                                    className="flex-1 py-1 rounded-md bg-blue-600 text-white font-bold cursor-default text-center text-[11px] whitespace-nowrap"
                                                                                >
                                                                                    🔵 RM
                                                                                </button>
                                                                            ) : isWipToWip ? (
                                                                                <>
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => handleReturningItemChange(itemIdx, retIdx, 'receivedItemType', 'rm')}
                                                                                        className={`flex-1 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                                                                                            (retItem.receivedItemType || 'rm') === 'rm'
                                                                                                ? 'bg-blue-600 text-white shadow-xs'
                                                                                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                                                                                        }`}
                                                                                        title="Raw Material Return"
                                                                                    >
                                                                                        🔵 RM
                                                                                    </button>
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => handleReturningItemChange(itemIdx, retIdx, 'receivedItemType', 'bo')}
                                                                                        className={`flex-1 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                                                                                            retItem.receivedItemType === 'bo'
                                                                                                ? 'bg-emerald-600 text-white shadow-xs'
                                                                                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                                                                                        }`}
                                                                                        title="Bought Out Return"
                                                                                    >
                                                                                        🟢 BO
                                                                                    </button>
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => handleReturningItemChange(itemIdx, retIdx, 'receivedItemType', 'fg')}
                                                                                        className={`flex-1 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                                                                                            retItem.receivedItemType === 'fg'
                                                                                                ? 'bg-purple-600 text-white shadow-xs'
                                                                                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                                                                                        }`}
                                                                                        title="Finished Good / Component Return"
                                                                                    >
                                                                                        🟣 FG
                                                                                    </button>
                                                                                </>
                                                                            ) : (
                                                                                <button
                                                                                    type="button"
                                                                                    className="flex-1 py-1 rounded-md bg-purple-600 text-white font-bold cursor-default text-center text-[11px] whitespace-nowrap"
                                                                                >
                                                                                    🟣 WIP FG
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                    {/* Return Item Selector */}
                                                                    <div className="sm:col-span-4 lg:col-span-3" data-has-error={!!formErrors[`item_${itemIdx}_ret_${retIdx}_item`]}>
                                                                        <label className="block text-[10px] font-semibold text-slate-500 mb-1 flex items-center justify-between">
                                                                            <span>Returning Item <span className="text-red-500">*</span></span>
                                                                            {formErrors[`item_${itemIdx}_ret_${retIdx}_item`] && (
                                                                                <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold">
                                                                                    {formErrors[`item_${itemIdx}_ret_${retIdx}_item`]}
                                                                                </span>
                                                                            )}
                                                                        </label>
                                                                        <SearchableSelect
                                                                            options={
                                                                                retItem.receivedItemType === 'rm' ? (isWipToWip && wipRmOptions.length > 0 ? wipRmOptions : rmOptions) :
                                                                                retItem.receivedItemType === 'bo' ? (isWipToWip && wipBoOptions.length > 0 ? wipBoOptions : boOptions) :
                                                                                fgOptions
                                                                            }
                                                                            value={retItem.receivedItem || ''}
                                                                            hasError={!!formErrors[`item_${itemIdx}_ret_${retIdx}_item`]}
                                                                            allowCustom={true}
                                                                            onChange={(val) => {
                                                                                handleReturningItemChange(itemIdx, retIdx, 'receivedItem', val);
                                                                                if (val) clearError(`item_${itemIdx}_ret_${retIdx}_item`);
                                                                            }}
                                                                            placeholder="Select Returning Item..."
                                                                        />
                                                                        {retItem.description && (
                                                                            <div className="text-[10px] text-slate-500 italic mt-0.5 line-clamp-1">
                                                                                {retItem.description}
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                    {/* Receiving Unit Selector / Display */}
                                                                    <div className="sm:col-span-2 lg:col-span-1">
                                                                        <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                                                                            Unit {retItem.hasSecondaryUnit && <span className="text-[9px] text-amber-600 font-bold">(Dual)</span>}
                                                                        </label>
                                                                        {retItem.hasSecondaryUnit && retItem.secondaryUnit ? (
                                                                            <select
                                                                                value={retItem.selectedUnit || retItem.receivingUnit || 'PCS'}
                                                                                onChange={(e) => handleReturningItemChange(itemIdx, retIdx, 'selectedUnit', e.target.value)}
                                                                                className="w-full h-9 px-1 border border-amber-300 dark:border-amber-600 bg-amber-50/50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 rounded-xl text-xs font-bold outline-none cursor-pointer"
                                                                            >
                                                                                <option value={retItem.receivingUnit || 'PCS'}>Pri: {retItem.receivingUnit || 'PCS'}</option>
                                                                                <option value={retItem.secondaryUnit}>Sec: {retItem.secondaryUnit}</option>
                                                                            </select>
                                                                        ) : (
                                                                            <input
                                                                                type="text"
                                                                                value={retItem.receivingUnit || 'PCS'}
                                                                                onChange={(e) => handleReturningItemChange(itemIdx, retIdx, 'receivingUnit', e.target.value)}
                                                                                className="w-full h-9 px-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-center bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 uppercase focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                                                            />
                                                                        )}
                                                                    </div>

                                                                    {/* Quantity To Receive with Dual Unit live conversion */}
                                                                    <div className="sm:col-span-2 lg:col-span-2" data-has-error={!!formErrors[`item_${itemIdx}_ret_${retIdx}_quantity`]}>
                                                                        <label className="block text-[10px] font-semibold text-slate-500 mb-1 flex items-center justify-between">
                                                                            <span>Return Qty <span className="text-red-500">*</span></span>
                                                                            {formErrors[`item_${itemIdx}_ret_${retIdx}_quantity`] && (
                                                                                <span className="text-[9px] text-rose-600 dark:text-rose-400 font-bold">
                                                                                    Req
                                                                                </span>
                                                                            )}
                                                                        </label>
                                                                        {retItem.hasSecondaryUnit && retItem.secondaryUnit && retItem.selectedUnit === retItem.secondaryUnit ? (
                                                                            <div>
                                                                                <input
                                                                                    type="number"
                                                                                    min="0.0001"
                                                                                    step="any"
                                                                                    value={retItem.secondaryQuantityToBeReceived || ''}
                                                                                    onChange={(e) => {
                                                                                        const val = Number(e.target.value);
                                                                                        handleReturningItemChange(itemIdx, retIdx, 'secondaryQuantityToBeReceived', val);
                                                                                        if (val > 0) clearError(`item_${itemIdx}_ret_${retIdx}_quantity`);
                                                                                    }}
                                                                                    placeholder={`In ${retItem.secondaryUnit}`}
                                                                                    className="w-full h-9 px-2 border border-amber-300 dark:border-amber-600 rounded-xl text-xs font-bold text-center bg-amber-50/30 dark:bg-amber-950/20 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500/30 outline-none"
                                                                                />
                                                                                <div className="text-[10px] text-amber-600 dark:text-amber-400 font-mono mt-0.5 text-right font-medium">
                                                                                    ↳ = {retItem.quantityToBeReceived || 0} {retItem.receivingUnit || 'PCS'}
                                                                                </div>
                                                                            </div>
                                                                        ) : (
                                                                            <div>
                                                                                <input
                                                                                    type="number"
                                                                                    min="0.01"
                                                                                    step="any"
                                                                                    value={retItem.quantityToBeReceived || ''}
                                                                                    onChange={(e) => {
                                                                                        const val = Number(e.target.value);
                                                                                        handleReturningItemChange(itemIdx, retIdx, 'quantityToBeReceived', val);
                                                                                        if (val > 0) clearError(`item_${itemIdx}_ret_${retIdx}_quantity`);
                                                                                    }}
                                                                                    placeholder={retItem.hasSecondaryUnit ? `In ${retItem.receivingUnit || 'PCS'}` : ''}
                                                                                    className="w-full h-9 px-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-center bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                                                                />
                                                                                {retItem.hasSecondaryUnit && retItem.secondaryUnit && (
                                                                                    <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono mt-0.5 text-right font-medium">
                                                                                        ↳ = {retItem.secondaryQuantityToBeReceived || 0} {retItem.secondaryUnit}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                    {/* Job Work Rate (₹/unit) for this Returning Item */}
                                                                    <div className="sm:col-span-2 lg:col-span-2">
                                                                        <label className="block text-[10px] font-semibold text-slate-500 mb-1 flex items-center justify-between">
                                                                            <span>JW Rate</span>
                                                                            <span className="text-[9px] text-slate-400 font-mono">
                                                                                ₹/{retItem.hasSecondaryUnit && retItem.selectedUnit === retItem.secondaryUnit ? retItem.secondaryUnit : (retItem.receivingUnit || 'unit')}
                                                                            </span>
                                                                        </label>
                                                                        <input
                                                                            type="number"
                                                                            min="0"
                                                                            step="any"
                                                                            value={retItem.processRate !== undefined ? retItem.processRate : ''}
                                                                            onChange={(e) => handleReturningItemChange(itemIdx, retIdx, 'processRate', e.target.value)}
                                                                            placeholder="0.00"
                                                                            className="w-full h-9 px-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-right bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                                                        />
                                                                    </div>

                                                                    {/* Job Work Amount Subtotal */}
                                                                    <div className="sm:col-span-2 lg:col-span-1 flex flex-col justify-center">
                                                                        <label className="block text-[9px] font-semibold text-slate-400 uppercase tracking-tight mb-1 text-right">
                                                                            JW Amount
                                                                        </label>
                                                                        <div className="h-9 flex items-center justify-end font-mono font-bold text-xs text-indigo-600 dark:text-indigo-400 truncate">
                                                                            ₹{(retItem.processAmount !== undefined 
                                                                                ? Number(retItem.processAmount) 
                                                                                : (((retItem.hasSecondaryUnit && retItem.selectedUnit === retItem.secondaryUnit ? Number(retItem.secondaryQuantityToBeReceived) : Number(retItem.quantityToBeReceived)) || 0) * (Number(retItem.processRate) || 0))
                                                                            ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                        </div>
                                                                    </div>

                                                                    {/* Action Delete */}
                                                                    <div className="sm:col-span-1 lg:col-span-1 flex items-center justify-center">
                                                                        {sentItem.returningItems.length > 1 && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => removeReturningItemSubRow(itemIdx, retIdx)}
                                                                                className="p-2 text-slate-400 hover:text-red-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                                                                title="Remove Return Item"
                                                                            >
                                                                                <Trash2 size={14} />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Add Another Outward Material Line Button */}
                                <div className="pt-1">
                                    <button
                                        type="button"
                                        onClick={addSentItemRow}
                                        className="w-full py-2.5 px-4 rounded-xl border-2 border-dashed border-indigo-300 dark:border-indigo-800 hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs"
                                    >
                                        <Plus size={15} />
                                        <span>+ Add Another Outward Material Line</span>
                                    </button>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Section 3: Logistics & Valuation */}
                    <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            <div>
                                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                                    Freight Terms
                                </label>
                                <select
                                    value={formData.freightType || 'To pay'}
                                    onChange={(e) => setFormData({ ...formData, freightType: e.target.value as any })}
                                    className="w-full h-9 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500/20 outline-none cursor-pointer"
                                >
                                    <option value="To pay">To Pay</option>
                                    <option value="Paid">Paid</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                                    Est. Weight (Kgs)
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    placeholder="e.g. 150"
                                    value={formData.estimatedWeight || ''}
                                    onChange={(e) => setFormData({ ...formData, estimatedWeight: Number(e.target.value) })}
                                    className="w-full h-9 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1" title="Declared Value for Transit / Insurance">
                                    Est. Material Valuation (₹)
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    placeholder="e.g. 25000"
                                    value={formData.estimatedPrice || ''}
                                    onChange={(e) => setFormData({ ...formData, estimatedPrice: Number(e.target.value) })}
                                    className="w-full h-9 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 mb-1 flex items-center justify-between">
                                    <span>Total Job Work Charges</span>
                                    <span className="text-[10px] text-indigo-500 font-bold">Auto</span>
                                </label>
                                <div className="w-full h-9 px-3 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs font-mono font-black text-indigo-700 dark:text-indigo-300 flex items-center justify-end">
                                    ₹{(Number(formData.totalJobWorkCharges) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section 4: Important Notes & Delivery Challan Remarks (Serial-Wise) */}
                    <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700/60 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
                            <div className="flex items-center gap-2">
                                <FileText size={15} className="text-indigo-600 dark:text-indigo-400" />
                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                    Important Notes & Delivery Challan Remarks
                                </span>
                                <span className="text-[10px] text-slate-400 font-medium">
                                    (Prints serial-wise at end of Returnable DC PDF)
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={resetDefaultNotes}
                                    className="text-[10px] font-semibold text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-300 underline cursor-pointer"
                                    title="Restore standard demo remarks"
                                >
                                    Reset to Demo Notes
                                </button>
                                <button
                                    type="button"
                                    onClick={addNoteRow}
                                    className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                                >
                                    <Plus size={12} />
                                    <span>Add Note</span>
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            {(formData.notes && formData.notes.length > 0) ? (
                                formData.notes.map((note, idx) => (
                                    <div key={idx} className="flex items-center gap-2">
                                        <div className="w-7 h-8 flex items-center justify-center font-mono font-bold text-xs bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-700 shrink-0 shadow-2xs">
                                            {idx + 1}.
                                        </div>
                                        <input
                                            type="text"
                                            value={note}
                                            onChange={(e) => handleNoteChange(idx, e.target.value)}
                                            placeholder={`Important note / condition #${idx + 1}...`}
                                            className="flex-1 h-8 px-3 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none text-slate-800 dark:text-slate-200 font-medium"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => removeNoteRow(idx)}
                                            className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                            title="Delete note"
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-2 text-xs text-slate-400 italic">
                                    No custom notes added. Click "+ Add Note" or "Reset to Demo Notes".
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Form Action Buttons */}
                    <div className="flex gap-2.5 justify-end pt-3 border-t border-slate-200 dark:border-slate-800">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition-all cursor-pointer"
                        >
                            Cancel
                        </button>

                        <button
                            type="submit"
                            disabled={loading}
                            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                            {loading ? (
                                <>
                                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    <span>Generating...</span>
                                </>
                            ) : (
                                <>
                                    <Truck size={14} />
                                    <span>{initialData ? "Update Returnable DC" : "Generate Returnable DC"}</span>
                                </>
                            )}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}

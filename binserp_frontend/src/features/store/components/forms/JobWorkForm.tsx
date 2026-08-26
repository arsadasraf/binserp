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
  AlertCircle
} from 'lucide-react';
import { Vendor, RmBoItem, JobWorkFormData, JobWorkSupplier, JobWorkReturningItem } from "@/src/features/store/types/store.types";
import { apiGet, apiPost, apiPut } from '@/src/lib/api';
import { generateDocument } from '@/src/utils/documentHelper';
import SearchableSelect from '../SearchableSelect';

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
        ]
    });

    const [wipFgItems, setWipFgItems] = useState<any[]>([]);

    // Fetch live Shopfloor WIP FG Inventory (excludes Job Work and Main FG Store)
    useEffect(() => {
        if (isOpen && token) {
            apiGet('/api/store/wip/inventory?type=fg', token)
                .then((res: any) => {
                    if (res?.wipItems && Array.isArray(res.wipItems)) {
                        setWipFgItems(res.wipItems);
                    }
                })
                .catch((err: any) => console.warn("Failed to fetch WIP FG inventory in JobWorkForm:", err));
        }
    }, [isOpen, token]);

    // Helper to get available stock from inventoryList or master items
    const getItemStock = useCallback((itemId: string, itemType: string): number => {
        if (!itemId) return 0;

        // 1. For Finished Goods (FG / WIP Components), query strictly from Shopfloor WIP stock
        if (itemType === 'fg') {
            if (wipFgItems && wipFgItems.length > 0) {
                const wip = wipFgItems.find((f: any) => 
                    String(f.materialId) === String(itemId) || 
                    String(f.id) === String(itemId) || 
                    String(f._id) === String(itemId)
                );
                if (wip) {
                    return Number(wip.shopfloorWipQty) || 0;
                }
            }
            const comp = (inHouseItems || []).find((f: any) => String(f._id) === String(itemId));
            if (comp && comp.isInventoryItem === false) {
                return Number(comp.quantity) || 0;
            }
            return 0;
        }

        // 2. Check inventoryList for RM / BO
        if (inventoryList && inventoryList.length > 0) {
            const inv = inventoryList.find((i: any) => {
                const mId = typeof i.materialId === 'object' && i.materialId ? i.materialId._id : i.materialId;
                return String(mId) === String(itemId) || String(i._id) === String(itemId);
            });
            if (inv) {
                if (inv.currentStock !== undefined) return Number(inv.currentStock) || 0;
                if (inv.quantity !== undefined) return Number(inv.quantity) || 0;
            }
        }

        // 3. Fallback to master collections for RM / BO
        if (itemType === 'rm') {
            const rm = (rawMaterials.length > 0 ? rawMaterials : materials).find((m: any) => String(m._id) === String(itemId));
            if (rm) {
                if (rm.quantity !== undefined) return Number(rm.quantity) || 0;
                if (rm.currentStock !== undefined) return Number(rm.currentStock) || 0;
            }
        } else if (itemType === 'bo') {
            const bo = (boughtOuts.length > 0 ? boughtOuts : materials).find((m: any) => String(m._id) === String(itemId));
            if (bo) {
                if (bo.quantity !== undefined) return Number(bo.quantity) || 0;
                if (bo.currentStock !== undefined) return Number(bo.currentStock) || 0;
            }
        }
        return 0;
    }, [inventoryList, rawMaterials, boughtOuts, materials, inHouseItems, wipFgItems]);

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

    // Item options for Raw Materials (RM) with live stock display
    const rmOptions = useMemo(() => {
        const sourceList = rawMaterials.length > 0 ? rawMaterials : (materials || []).filter((m: any) => m.type !== 'bo' && m.itemType !== 'bo');
        return sourceList.map((m: any) => {
            const stock = getItemStock(m._id, 'rm');
            const unit = m.unit || (m as any).categoryId?.unit || 'PCS';
            return {
                value: m._id,
                label: `${m.name ? `${m.name} ${m.code ? `[${m.code}]` : ''}` : 'Raw Material'} • Stock: ${stock} ${unit}`
            };
        });
    }, [rawMaterials, materials, getItemStock]);

    // Item options for Bought Outs (BO) with live stock display
    const boOptions = useMemo(() => {
        const sourceList = boughtOuts.length > 0 ? boughtOuts : (materials || []).filter((m: any) => m.type === 'bo' || m.itemType === 'bo');
        return sourceList.map((m: any) => {
            const stock = getItemStock(m._id, 'bo');
            const unit = m.unit || (m as any).categoryId?.unit || 'PCS';
            return {
                value: m._id,
                label: `${m.name ? `${m.name} ${m.code ? `[${m.code}]` : ''}` : 'Bought Out Item'} • Stock: ${stock} ${unit}`
            };
        });
    }, [boughtOuts, materials, getItemStock]);

    // Item options for In-House / Finished Goods (FG) with live Shopfloor WIP stock display (strictly excluding Job Work and Main Store FG stock)
    const fgOptions = useMemo(() => {
        const sourceList = wipFgItems.length > 0 ? wipFgItems : (inHouseItems || []);
        return sourceList.map((i: any) => {
            const stock = i.shopfloorWipQty !== undefined ? (Number(i.shopfloorWipQty) || 0) : getItemStock(i._id || i.materialId, 'fg');
            const unit = i.unit || 'PCS';
            const nameStr = i.materialName || i.name || i.componentName || 'Finished Good / Component';
            const codeStr = i.materialCode || i.componentCode || i.code ? ` [${i.materialCode || i.componentCode || i.code}]` : '';
            return {
                value: i.materialId || i.id || i._id,
                label: `${nameStr}${codeStr} • Shopfloor WIP: ${stock} ${unit}`
            };
        });
    }, [wipFgItems, inHouseItems, getItemStock]);

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

            setFormData(prev => ({
                ...prev,
                ...rest,
                vendor: vendorId,
                jobWorkType: (initialData as any).jobWorkType || 'store-conversion',
                mrpNumber: (initialData as any).mrpNumber || '',
                mrpPlan: (initialData as any).mrpPlan || '',
                ewayBillNo: (initialData as any).ewayBillNo || prev.ewayBillNo || '',
                items: (items || []).map((it: any) => {
                    let retItems: JobWorkReturningItem[] = [];
                    const itId = typeof it.item === 'object' && it.item !== null ? (it.item._id || '') : (it.item || '');

                    if (Array.isArray(it.returningItems) && it.returningItems.length > 0) {
                        retItems = it.returningItems.map((r: any) => {
                            const retId = typeof r.receivedItem === 'object' && r.receivedItem !== null ? (r.receivedItem._id || '') : (r.receivedItem || '');
                            return {
                                receivedItem: retId,
                                receivedItemName: r.receivedItemName || r.itemName || '',
                                receivedItemType: r.receivedItemType || 'fg',
                                quantityToBeReceived: Number(r.quantityToBeReceived) || 1,
                                receivingUnit: r.receivingUnit || 'PCS'
                            };
                        });
                    } else {
                        const legacyRetId = typeof it.receivedItem === 'object' && it.receivedItem !== null ? (it.receivedItem._id || '') : (it.receivedItem || '');
                        retItems = [{
                            receivedItem: legacyRetId,
                            receivedItemName: it.receivedItemName || it.itemToBeReceived || it.itemName || '',
                            receivedItemType: it.receivedItemType || 'fg',
                            quantityToBeReceived: Number(it.quantityToBeReceived) || Number(it.quantitySent) || 1,
                            receivingUnit: it.receivingUnit || it.unit || 'PCS'
                        }];
                    }

                    const rateVal = Number(it.processRate != null ? it.processRate : it.unitPrice) || 0;
                    const sentQty = Number(it.quantitySent) || 1;

                    return {
                        item: itId,
                        itemName: it.itemName || '',
                        itemType: it.itemType || 'rm',
                        quantitySent: sentQty,
                        unit: it.unit || 'PCS',
                        processType: it.processType || 'Job Work',
                        processRate: rateVal,
                        processAmount: sentQty * rateVal,
                        unitPrice: rateVal,
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
                jobWorkType: 'store-conversion',
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
                ]
            });
        }
    }, [isOpen, initialData]);

    // Handle Workflow DC Type Switch
    const handleDcTypeChange = (type: 'store-conversion' | 'store-to-wip' | 'wip-to-wip') => {
        const updatedItems = formData.items.map(item => {
            let defaultSentType = item.itemType;
            if (type === 'store-conversion' || type === 'store-to-wip') {
                defaultSentType = 'rm';
            } else if (type === 'wip-to-wip') {
                defaultSentType = 'fg';
            }

            const updatedRetItems = (item.returningItems || []).map(r => {
                let retType = r.receivedItemType || 'rm';
                if (type === 'store-conversion') {
                    retType = 'rm'; // Strictly RM Conversion
                } else {
                    retType = 'fg';
                }
                return {
                    ...r,
                    receivedItemType: retType
                };
            });

            return {
                ...item,
                itemType: defaultSentType,
                returningItems: updatedRetItems
            };
        });

        setFormData({
            ...formData,
            jobWorkType: type,
            items: updatedItems
        });
    };

    // Handle Sent Item Field Changes
    const handleSentItemChange = (itemIdx: number, field: string, value: any) => {
        const newItems = [...formData.items];
        const current = { ...newItems[itemIdx], [field]: value };

        if (field === 'item') {
            const selectedId = value;
            const type = current.itemType;
            if (type === 'rm') {
                const found = (rawMaterials.length > 0 ? rawMaterials : materials).find((m: any) => m._id === selectedId);
                if (found) {
                    current.itemName = found.name;
                    current.unit = found.unit || (found as any).categoryId?.unit || 'PCS';
                }
            } else if (type === 'bo') {
                const found = (boughtOuts.length > 0 ? boughtOuts : materials).find((m: any) => m._id === selectedId);
                if (found) {
                    current.itemName = found.name;
                    current.unit = found.unit || (found as any).categoryId?.unit || 'PCS';
                }
            } else if (type === 'fg') {
                const sourceList = [...wipFgItems, ...(inHouseItems || [])];
                const found = sourceList.find((i: any) => 
                    String(i.materialId) === String(selectedId) || 
                    String(i.id) === String(selectedId) || 
                    String(i._id) === String(selectedId)
                );
                if (found) {
                    current.itemName = found.materialName || found.name || found.componentName || 'Finished Good / Component';
                    current.unit = found.unit || 'PCS';
                }
            }

            // Auto-sync first returning item name if blank
            if (current.returningItems && current.returningItems.length > 0 && !current.returningItems[0].receivedItemName) {
                current.returningItems[0].receivedItemName = current.itemName || '';
            }
        }

        if (field === 'itemType') {
            current.item = '';
            current.itemName = '';
        }

        if (field === 'processRate') {
            current.unitPrice = value;
            current.processAmount = (Number(current.quantitySent) || 0) * (Number(value) || 0);
        }

        if (field === 'quantitySent') {
            const currentRate = Number(current.processRate != null ? current.processRate : current.unitPrice) || 0;
            current.processAmount = (Number(value) || 0) * currentRate;
        }

        newItems[itemIdx] = current;

        // Calculate total estimated process price
        const totalProcPrice = newItems.reduce((acc, it) => {
            const r = Number(it.processRate != null ? it.processRate : it.unitPrice) || 0;
            const q = Number(it.quantitySent) || 0;
            return acc + (q * r);
        }, 0);

        setFormData({ 
            ...formData, 
            items: newItems,
            estimatedPrice: totalProcPrice > 0 ? totalProcPrice : formData.estimatedPrice
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
            if (type === 'rm') {
                const found = (rawMaterials.length > 0 ? rawMaterials : materials).find((m: any) => m._id === selectedId);
                if (found) {
                    currentRet.receivedItemName = found.name;
                    currentRet.receivingUnit = found.unit || (found as any).categoryId?.unit || 'PCS';
                }
            } else if (type === 'bo') {
                const found = (boughtOuts.length > 0 ? boughtOuts : materials).find((m: any) => m._id === selectedId);
                if (found) {
                    currentRet.receivedItemName = found.name;
                    currentRet.receivingUnit = found.unit || (found as any).categoryId?.unit || 'PCS';
                }
            } else if (type === 'fg') {
                const sourceList = [...wipFgItems, ...(inHouseItems || [])];
                const found = sourceList.find((i: any) => 
                    String(i.materialId) === String(selectedId) || 
                    String(i.id) === String(selectedId) || 
                    String(i._id) === String(selectedId)
                );
                if (found) {
                    currentRet.receivedItemName = found.materialName || found.name || found.componentName || 'Finished Good / Component';
                    currentRet.receivingUnit = found.unit || 'PCS';
                }
            }
        }

        if (field === 'receivedItemType') {
            currentRet.receivedItem = '';
            currentRet.receivedItemName = '';
        }

        newRetList[retIdx] = currentRet;
        currentSent.returningItems = newRetList;
        newItems[itemIdx] = currentSent;
        setFormData({ ...formData, items: newItems });
    };

    // Add / Remove Sent Material Lines
    const addSentItemRow = () => {
        const defaultSentType = formData.jobWorkType === 'wip-to-wip' ? 'fg' : 'rm';
        const defaultRetType = formData.jobWorkType === 'store-conversion' ? 'rm' : 'fg';
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
                    processType: 'Machining',
                    processRate: 0,
                    processAmount: 0,
                    unitPrice: 0,
                    description: '',
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
                receivingUnit: currentSent.unit || 'PCS'
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
        newItems[itemIdx] = currentSent;
        setFormData({ ...formData, items: newItems });
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

        // Validation 3: MRP Number requirement for WIP flows
        if ((formData.jobWorkType === 'store-to-wip' || formData.jobWorkType === 'wip-to-wip') && !formData.mrpNumber?.trim()) {
            errors.mrpNumber = 'MRP Plan is required for Store to WIP and WIP to WIP';
        }

        // Validation 4: Outward item existence, quantity sent, stock balance, and returning item rows
        for (let i = 0; i < formData.items.length; i++) {
            const item = formData.items[i];
            if (!item.item && !item.itemName) {
                errors[`item_${i}_item`] = 'Outward material is required';
            }
            if (!item.quantitySent || Number(item.quantitySent) <= 0) {
                errors[`item_${i}_quantitySent`] = 'Quantity sent must be > 0';
            } else if (item.item) {
                const availStock = getItemStock(item.item, item.itemType);
                const reqQty = Number(item.quantitySent) || 0;

                if (availStock <= 0) {
                    errors[`item_${i}_quantitySent`] = `Out of stock (Avail: 0)`;
                } else if (reqQty > availStock) {
                    errors[`item_${i}_quantitySent`] = `Exceeds stock (Avail: ${availStock})`;
                }
            }

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
            const payload = {
                ...formData,
                mrpPlan: formData.mrpPlan ? formData.mrpPlan : undefined,
                mrpNumber: formData.mrpNumber ? formData.mrpNumber : undefined,
            };

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
            await generateDocument('pdf', 'Returnable DC', [{ doc: successData, companyInfo }]);
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
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-5xl xl:max-w-6xl my-auto overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[94vh] animate-in fade-in zoom-in-95 duration-200">
                
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
                                    Please fill in the highlighted compulsory field{Object.keys(formErrors).length > 1 ? 's' : ''} before creating Challan.
                                </span>
                            </div>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-200 dark:bg-rose-900 text-rose-900 dark:text-rose-200">
                                {Object.keys(formErrors).length} required
                            </span>
                        </div>
                    )}

                    {/* Small & Thin Segmented Returnable DC Type Bar */}
                    <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 gap-1">
                        <button
                            type="button"
                            onClick={() => handleDcTypeChange('store-conversion')}
                            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                                (formData.jobWorkType || 'store-conversion') === 'store-conversion'
                                    ? 'bg-indigo-600 text-white shadow-xs'
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-white/80 dark:hover:bg-slate-700'
                            }`}
                        >
                            <span>🏭 RM Conversion</span>
                            <span className="text-[10px] opacity-80 font-normal hidden sm:inline">(RM ➔ RM Conversion)</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => handleDcTypeChange('store-to-wip')}
                            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                                formData.jobWorkType === 'store-to-wip'
                                    ? 'bg-indigo-600 text-white shadow-xs'
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-white/80 dark:hover:bg-slate-700'
                            }`}
                        >
                            <span>🔄 Store to WIP</span>
                            <span className="text-[10px] opacity-80 font-normal hidden sm:inline">(RM ➔ MRP WIP)</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => handleDcTypeChange('wip-to-wip')}
                            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                                formData.jobWorkType === 'wip-to-wip'
                                    ? 'bg-indigo-600 text-white shadow-xs'
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-white/80 dark:hover:bg-slate-700'
                            }`}
                        >
                            <span>📦 WIP to WIP</span>
                            <span className="text-[10px] opacity-80 font-normal hidden sm:inline">(Coating / Treatment)</span>
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
                                        <span className="text-[10px] font-normal text-slate-400">
                                            {formData.jobWorkType === 'store-conversion' ? '(Optional)' : '(Required)'}
                                        </span>
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

                    {/* Section 2: Materials Sent & Expected Returning Items */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                                <Package size={14} className="text-indigo-600" />
                                Material Lines Sent & Expected Inward Returns
                            </span>

                            <button
                                type="button"
                                onClick={addSentItemRow}
                                className="flex items-center gap-1 px-3 py-1 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 rounded-lg text-xs font-bold border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 transition-colors cursor-pointer"
                            >
                                <Plus size={13} /> Add Line
                            </button>
                        </div>

                        {/* Sent Items Cards */}
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
                                            
                                            {/* Outward Material Type (RM or WIP FG) */}
                                            <div className="sm:col-span-2 lg:col-span-3">
                                                <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                                                    Material Type
                                                </label>
                                                <div className="flex bg-white dark:bg-slate-900 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold">
                                                    {!isWipToWip ? (
                                                        <button
                                                            type="button"
                                                            className="flex-1 py-1 rounded-md bg-blue-600 text-white font-bold cursor-default text-center"
                                                        >
                                                            🔵 RM (Raw Material)
                                                        </button>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            className="flex-1 py-1 rounded-md bg-purple-600 text-white font-bold cursor-default text-center"
                                                        >
                                                            🟣 WIP FG
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Outward Item Selector + Live Stock Badge */}
                                            <div className="sm:col-span-2 lg:col-span-4" data-has-error={!!formErrors[`item_${itemIdx}_item`]}>
                                                <label className="block text-[10px] font-semibold text-slate-500 mb-1 flex items-center justify-between">
                                                    <span>Item Name <span className="text-red-500">*</span></span>
                                                    {formErrors[`item_${itemIdx}_item`] && (
                                                        <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold">
                                                            {formErrors[`item_${itemIdx}_item`]}
                                                        </span>
                                                    )}
                                                </label>
                                                <SearchableSelect
                                                    options={
                                                        sentItem.itemType === 'rm' ? rmOptions :
                                                        sentItem.itemType === 'bo' ? boOptions :
                                                        fgOptions
                                                    }
                                                    value={sentItem.item || ''}
                                                    hasError={!!formErrors[`item_${itemIdx}_item`]}
                                                    onChange={(val) => {
                                                        handleSentItemChange(itemIdx, 'item', val);
                                                        if (val) clearError(`item_${itemIdx}_item`);
                                                    }}
                                                    placeholder="Select Item..."
                                                />

                                                {/* Live Stock Display Pill */}
                                                {sentItem.item && (
                                                    <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1 text-[10px] font-bold">
                                                        <span className={`px-2 py-0.5 rounded-md flex items-center gap-1 ${
                                                            stock > 0 
                                                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' 
                                                                : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
                                                        }`}>
                                                            {stock > 0 ? '🟢 Store Stock:' : '🔴 Out of Stock:'} {stock} {sentItem.unit || 'PCS'}
                                                        </span>
                                                        {isShortage && !isWipToWip && (
                                                            <span className="text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 px-2 py-0.5 rounded-md border border-red-200 dark:border-red-800 flex items-center gap-1">
                                                                <AlertTriangle size={11} />
                                                                Exceeds by {(Number(sentItem.quantitySent) - stock).toFixed(2)}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Quantity Sent */}
                                            <div className="sm:col-span-1 lg:col-span-2" data-has-error={!!formErrors[`item_${itemIdx}_quantitySent`]}>
                                                <label className="block text-[10px] font-semibold text-slate-500 mb-1 flex items-center justify-between">
                                                    <span>Qty Sent <span className="text-red-500">*</span></span>
                                                    {formErrors[`item_${itemIdx}_quantitySent`] && (
                                                        <span className="text-[9px] text-rose-600 dark:text-rose-400 font-bold truncate">
                                                            {formErrors[`item_${itemIdx}_quantitySent`]}
                                                        </span>
                                                    )}
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0.01"
                                                    step="any"
                                                    value={sentItem.quantitySent || ''}
                                                    onChange={(e) => {
                                                        const val = Number(e.target.value);
                                                        handleSentItemChange(itemIdx, 'quantitySent', val);
                                                        if (val > 0) clearError(`item_${itemIdx}_quantitySent`);
                                                    }}
                                                    className={`w-full h-9 px-2.5 border rounded-xl text-xs font-bold text-center outline-none transition-all ${
                                                        formErrors[`item_${itemIdx}_quantitySent`]
                                                            ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-100 ring-1 ring-rose-400 focus:ring-rose-500'
                                                            : isShortage && !isWipToWip 
                                                                ? 'border-red-400 text-red-600 focus:border-red-500 bg-white dark:bg-slate-900' 
                                                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500/20'
                                                    }`}
                                                />
                                            </div>

                                            {/* Unit */}
                                            <div className="sm:col-span-1 lg:col-span-1">
                                                <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                                                    Unit
                                                </label>
                                                <input
                                                    type="text"
                                                    value={sentItem.unit || 'PCS'}
                                                    onChange={(e) => handleSentItemChange(itemIdx, 'unit', e.target.value)}
                                                    className="w-full h-9 px-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-center uppercase focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                                />
                                            </div>

                                            {/* Process / Operation */}
                                            <div className="sm:col-span-2 lg:col-span-2">
                                                <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                                                    Process / Operation
                                                </label>
                                                <input
                                                    type="text"
                                                    placeholder="e.g. Machining, Coating"
                                                    value={sentItem.processType || ''}
                                                    onChange={(e) => handleSentItemChange(itemIdx, 'processType', e.target.value)}
                                                    className="w-full h-9 px-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                                />
                                            </div>

                                            {/* Process Rate (₹ / Unit) */}
                                            <div className="sm:col-span-2 lg:col-span-2">
                                                <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                                                    Process Rate (₹)
                                                </label>
                                                <div className="relative">
                                                    <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">₹</span>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="any"
                                                        placeholder="0.00"
                                                        value={sentItem.processRate !== undefined ? sentItem.processRate : (sentItem.unitPrice || '')}
                                                        onChange={(e) => {
                                                            const val = parseFloat(e.target.value) || 0;
                                                            handleSentItemChange(itemIdx, 'processRate', val);
                                                        }}
                                                        className="w-full h-9 pl-6 pr-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-indigo-600 dark:text-indigo-400 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                                    />
                                                </div>
                                            </div>

                                            {/* Process Value Subtotal */}
                                            <div className="sm:col-span-2 lg:col-span-1 flex flex-col justify-center">
                                                <label className="block text-[9px] font-semibold text-slate-400 uppercase tracking-tight mb-1 text-right">
                                                    Amount
                                                </label>
                                                <div className="h-9 flex items-center justify-end font-mono font-bold text-xs text-slate-700 dark:text-slate-200 truncate">
                                                    ₹{((Number(sentItem.quantitySent) || 0) * (Number(sentItem.processRate != null ? sentItem.processRate : sentItem.unitPrice) || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Sub-Section: Expected Converted Returning Items */}
                                        <div className="pl-3 border-l-2 border-indigo-200 dark:border-indigo-800 space-y-2">
                                            <div className="flex justify-between items-center">
                                                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase flex items-center gap-1">
                                                    <ArrowRight size={12} className="text-indigo-600" />
                                                    Expected Returning Inward Item(s)
                                                </span>

                                                <button
                                                    type="button"
                                                    onClick={() => addReturningItemSubRow(itemIdx)}
                                                    className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                                                >
                                                    <Plus size={12} /> Add Return
                                                </button>
                                            </div>

                                            {/* Returning Item Sub-Rows */}
                                            <div className="space-y-2">
                                                {sentItem.returningItems.map((retItem, retIdx) => (
                                                    <div 
                                                        key={retIdx}
                                                        className="grid grid-cols-1 sm:grid-cols-12 gap-2 p-2.5 bg-indigo-50/30 dark:bg-indigo-950/20 rounded-lg border border-indigo-100 dark:border-indigo-900/40 items-end"
                                                    >
                                                        {/* Return Material Type */}
                                                        <div className="sm:col-span-3">
                                                            <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                                                                Return Type
                                                            </label>
                                                            <div className="flex bg-white dark:bg-slate-900 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold">
                                                                {isStoreConversion ? (
                                                                    <button
                                                                        type="button"
                                                                        className="flex-1 py-1 rounded-md bg-blue-600 text-white font-bold cursor-default text-center"
                                                                    >
                                                                        🔵 RM (Raw Material)
                                                                    </button>
                                                                ) : (
                                                                    <button
                                                                        type="button"
                                                                        className="flex-1 py-1 rounded-md bg-purple-600 text-white font-bold cursor-default text-center"
                                                                    >
                                                                        🟣 WIP FG
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Return Item Selector */}
                                                        <div className="sm:col-span-5" data-has-error={!!formErrors[`item_${itemIdx}_ret_${retIdx}_item`]}>
                                                            <label className="block text-[10px] font-semibold text-slate-500 mb-1 flex items-center justify-between">
                                                                <span>Converted Returning Item <span className="text-red-500">*</span></span>
                                                                {formErrors[`item_${itemIdx}_ret_${retIdx}_item`] && (
                                                                    <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold">
                                                                        {formErrors[`item_${itemIdx}_ret_${retIdx}_item`]}
                                                                    </span>
                                                                )}
                                                            </label>
                                                            <SearchableSelect
                                                                options={
                                                                    retItem.receivedItemType === 'rm' ? rmOptions :
                                                                    retItem.receivedItemType === 'bo' ? boOptions :
                                                                    fgOptions
                                                                }
                                                                value={retItem.receivedItem || ''}
                                                                hasError={!!formErrors[`item_${itemIdx}_ret_${retIdx}_item`]}
                                                                onChange={(val) => {
                                                                    handleReturningItemChange(itemIdx, retIdx, 'receivedItem', val);
                                                                    if (val) clearError(`item_${itemIdx}_ret_${retIdx}_item`);
                                                                }}
                                                                placeholder="Select Converted Item..."
                                                            />
                                                        </div>

                                                        {/* Quantity To Receive */}
                                                        <div className="sm:col-span-2" data-has-error={!!formErrors[`item_${itemIdx}_ret_${retIdx}_quantity`]}>
                                                            <label className="block text-[10px] font-semibold text-slate-500 mb-1 flex items-center justify-between">
                                                                <span>Return Qty <span className="text-red-500">*</span></span>
                                                                {formErrors[`item_${itemIdx}_ret_${retIdx}_quantity`] && (
                                                                    <span className="text-[9px] text-rose-600 dark:text-rose-400 font-bold">
                                                                        Req
                                                                    </span>
                                                                )}
                                                            </label>
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
                                                                className={`w-full h-9 px-2.5 border rounded-xl text-xs font-bold text-center outline-none transition-all ${
                                                                    formErrors[`item_${itemIdx}_ret_${retIdx}_quantity`]
                                                                        ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-100 ring-1 ring-rose-400 focus:ring-rose-500'
                                                                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500/20'
                                                                }`}
                                                            />
                                                        </div>

                                                        {/* Return Unit & Delete */}
                                                        <div className="sm:col-span-2 flex items-center gap-1.5">
                                                            <div className="flex-1">
                                                                <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                                                                    Unit
                                                                </label>
                                                                <input
                                                                    type="text"
                                                                    value={retItem.receivingUnit || 'PCS'}
                                                                    onChange={(e) => handleReturningItemChange(itemIdx, retIdx, 'receivingUnit', e.target.value)}
                                                                    className="w-full h-9 px-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-center uppercase focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                                                />
                                                            </div>
                                                            {sentItem.returningItems.length > 1 && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => removeReturningItemSubRow(itemIdx, retIdx)}
                                                                    className="text-red-500 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                                                                    title="Remove return item"
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
                                );
                            })}
                        </div>
                    </div>

                    {/* Section 3: Logistics & Valuation */}
                    <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
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

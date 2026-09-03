"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { 
    X, Plus, Trash2, Package, User, Calendar, Hash, FileText, 
    Truck, Box, Calculator, Layers, Sparkles, ChevronDown, Check, ArrowRight, ShieldCheck, Info, Percent,
    Search, Copy, AlertCircle, ArrowUpRight
} from 'lucide-react';
import { POModalProps } from "@/src/features/store/types/store.types";
import SearchableSelect from '../SearchableSelect';
import { apiGet } from '@/src/lib/api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export type POItemCategoryType = 'rm' | 'bo' | 'consumable';

export interface POLineItemEntry {
    itemType: POItemCategoryType;
    material?: string;
    component?: string;
    materialName: string;
    description: string;
    hsnCode: string;
    pieceCount: number; // Informational count/pieces (e.g. 10 Pcs when buying 500 KG)
    quantity: number;
    unit: string;
    rate: number;
    amount: number; // Actual amount WITHOUT tax: quantity * rate
    category: string;
}

// Steel Shapes for RM Calculator
type SteelShape = 'plate' | 'round_bar' | 'pipe' | 'square_tube' | 'flat_bar' | 'angle';

interface SteelCalcState {
    shape: SteelShape;
    materialType: string;
    density: number; // in g/cm³ (kg/dm³)
    lengthMm: number;
    widthMm: number;
    thicknessMm: number;
    outerDiaMm: number;
    heightMm: number;
    pieces: number;
    ratePerKg: number;
}

interface ItemValidationError {
    materialName?: boolean;
    quantity?: boolean;
    unit?: boolean;
    rate?: boolean;
}

export default function POModal({
    isOpen,
    onClose,
    onSubmit,
    materials = [],
    vendors = [],
    inHouseItems = [],
    priceLists = [],
    loading,
    initialData,
    isEditing = false,
}: POModalProps) {
    // Form state
    const [poNumber, setPoNumber] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [vendor, setVendor] = useState('');
    const [vendorName, setVendorName] = useState('');
    const [remarks, setRemarks] = useState('');
    const [status, setStatus] = useState('Released');
    const [fetchedPriceLists, setFetchedPriceLists] = useState<any[]>([]);

    // Single Material Type per PO (RM, BO, or Consumable)
    const [poCategory, setPoCategory] = useState<POItemCategoryType>('rm');

    // Bottom single GST tax rate applied to entire PO
    const [taxRate, setTaxRate] = useState<number>(18);
    const [gstType, setGstType] = useState<'intra_state' | 'inter_state'>('intra_state');

    // 3 distinct inventory feeds
    const [rawMaterialsList, setRawMaterialsList] = useState<any[]>([]);
    const [boughtOutsList, setBoughtOutsList] = useState<any[]>([]);
    const [consumablesList, setConsumablesList] = useState<any[]>([]);

    // Logistics & Packaging state
    const [transportType, setTransportType] = useState('Road Freight');
    const [transportCharge, setTransportCharge] = useState<number>(0);
    const [packingType, setPackingType] = useState('Standard Packaging');
    const [packingCharge, setPackingCharge] = useState<number>(0);

    // Filter/Search within Line Items for 100+ items performance & ease
    const [itemSearchQuery, setItemSearchQuery] = useState('');

    // Validation state
    const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
    const [validationErrorList, setValidationErrorList] = useState<string[]>([]);
    const [firstErrorRowIndex, setFirstErrorRowIndex] = useState<number | null>(null);

    // Steel RM Weight Calculator state
    const [showSteelCalc, setShowSteelCalc] = useState(false);
    const [steelCalc, setSteelCalc] = useState<SteelCalcState>({
        shape: 'plate',
        materialType: 'Mild Steel (MS)',
        density: 7.85,
        lengthMm: 1000,
        widthMm: 1000,
        thicknessMm: 10,
        outerDiaMm: 50,
        heightMm: 50,
        pieces: 1,
        ratePerKg: 75,
    });

    const [materialEntries, setMaterialEntries] = useState<POLineItemEntry[]>([{
        itemType: 'rm',
        material: '',
        materialName: '',
        description: '',
        hsnCode: '',
        pieceCount: 0,
        quantity: 0,
        unit: 'KG',
        rate: 0,
        amount: 0,
        category: '',
    }]);

    // Fetch store prefix and inventory feeds
    useEffect(() => {
        if (isOpen) {
            const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
            if (!token) return;

            Promise.all([
                apiGet('/api/store/raw-material', token).catch(() => []),
                apiGet('/api/store/bought-out', token).catch(() => []),
                apiGet('/api/store/consumable-item', token).catch(() => []),
                apiGet('/api/purchase/price-list', token).catch(() => ({ data: [] })),
                apiGet('/api/store/prefix', token).catch(() => null),
            ]).then(([rmRes, boRes, conRes, plRes, prefixRes]) => {
                setRawMaterialsList(Array.isArray(rmRes) ? rmRes : (rmRes?.rawMaterials || []));
                setBoughtOutsList(Array.isArray(boRes) ? boRes : (boRes?.boughtOuts || []));
                setConsumablesList(Array.isArray(conRes) ? conRes : (conRes?.consumables || conRes?.consumableItems || []));
                const pl = Array.isArray(plRes?.data) ? plRes.data : (Array.isArray(plRes) ? plRes : []);
                setFetchedPriceLists(pl);

                // If not editing, generate fresh PO number using outward prefix setting
                if (!initialData) {
                    const settings = prefixRes?.settings || {};
                    const prefix = settings.outwardPoPrefix || settings.outgoingPoPrefix || settings.poPrefix || 'PO-OUT';
                    const now = new Date();
                    const year = now.getFullYear();
                    const month = String(now.getMonth() + 1).padStart(2, '0');
                    const day = String(now.getDate()).padStart(2, '0');
                    const hours = String(now.getHours()).padStart(2, '0');
                    const minutes = String(now.getMinutes()).padStart(2, '0');
                    const seconds = String(now.getSeconds()).padStart(2, '0');
                    setPoNumber(`${prefix}/${year}${month}${day}-${hours}${minutes}${seconds}`);
                }
            }).catch(e => {
                console.error("Failed to load store data for PO Modal:", e);
            });
        }
    }, [isOpen, initialData]);

    // Handle Edit vs Create Initial Data Population
    useEffect(() => {
        if (isOpen) {
            setHasAttemptedSubmit(false);
            setValidationErrorList([]);
            setFirstErrorRowIndex(null);
            setItemSearchQuery('');

            if (initialData) {
                // Populate existing PO cleanly without resetting to empty
                setPoNumber(initialData.poNumber || '');
                setDate(initialData.date ? new Date(initialData.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
                
                const vId = typeof initialData.vendor === 'object' ? (initialData.vendor as any)?._id : (initialData.vendor || '');
                const vName = (initialData as any).vendorName || (initialData.vendor as any)?.name || '';
                setVendor(vId);
                setVendorName(vName);
                setRemarks(initialData.remarks || (initialData as any).termsAndConditions || '');
                setStatus(initialData.status || 'Released');
                setGstType((initialData as any).gstType || 'intra_state');
                setTaxRate(initialData.taxRate != null ? Number(initialData.taxRate) : 18);
                setTransportType(initialData.transportType || 'Road Freight');
                setTransportCharge(initialData.transportCharge || 0);
                setPackingType(initialData.packingType || 'Standard Packaging');
                setPackingCharge(initialData.packingCharge || 0);

                // Detect PO Category from items or category field
                let detectedCategory: POItemCategoryType = 'rm';
                if (initialData.items && initialData.items.length > 0) {
                    const first = initialData.items[0];
                    const firstType = (first.itemType || first.category || '').toLowerCase();
                    if (firstType.includes('bo') || firstType.includes('bought')) detectedCategory = 'bo';
                    else if (firstType.includes('consumable')) detectedCategory = 'consumable';
                } else if ((initialData as any).category) {
                    const cat = String((initialData as any).category).toLowerCase();
                    if (cat.includes('bo') || cat.includes('bought')) detectedCategory = 'bo';
                    else if (cat.includes('consumable')) detectedCategory = 'consumable';
                }
                setPoCategory(detectedCategory);

                if (initialData.items && initialData.items.length > 0) {
                    setMaterialEntries(initialData.items.map((item: any) => {
                        const qty = Number(item.quantity) || Number(item.shortage) || Number(item.requiredQuantity) || 0;
                        const rate = Number(item.rate || item.unitPrice) || 0;
                        const lineSub = Number(item.amount) || (qty * rate);
                        const matVal = typeof item.material === 'object' 
                            ? item.material?._id 
                            : (item.material || item.materialId || item.materialKey || '');
                        
                        const savedName = item.materialName || item.material?.name || item.itemName || '';
                        const savedDesc = item.description || item.itemDescription || item.remarks || item.specifications || '';
                        const savedHsn = item.hsnCode || item.hsn || item.material?.hsnCode || '';
                        const savedUnit = item.unit || item.uom || item.material?.unit || (detectedCategory === 'rm' ? 'KG' : 'PCS');
                        const savedCat = item.category || (typeof item.material?.category === 'object' ? item.material?.category?.name : item.material?.category) || '';

                        return {
                            itemType: detectedCategory,
                            material: matVal,
                            component: item.component || '',
                            materialName: savedName || 'Material Item',
                            description: savedDesc,
                            hsnCode: savedHsn,
                            pieceCount: Number(item.pieceCount || item.count || 0),
                            quantity: qty,
                            unit: savedUnit,
                            rate: rate,
                            amount: lineSub,
                            category: savedCat,
                        };
                    }));
                } else if ((initialData as any).material || (initialData as any).materialName) {
                    const legacy = initialData as any;
                    const qty = Number(legacy.quantity) || 0;
                    const rate = Number(legacy.rate) || 0;
                    const lineSub = qty * rate;
                    const matVal = typeof legacy.material === 'object' ? legacy.material?._id : (legacy.material || '');
                    const savedName = legacy.materialName || legacy.material?.name || 'Material Item';
                    const savedDesc = legacy.description || '';
                    const savedHsn = legacy.hsnCode || legacy.hsn || legacy.material?.hsnCode || '';
                    const savedUnit = legacy.unit || legacy.material?.unit || 'KG';

                    setMaterialEntries([{
                        itemType: detectedCategory,
                        material: matVal,
                        component: legacy.component || '',
                        materialName: savedName,
                        description: savedDesc,
                        hsnCode: savedHsn,
                        pieceCount: Number(legacy.pieceCount || 0),
                        quantity: qty,
                        unit: savedUnit,
                        rate: rate,
                        amount: lineSub,
                        category: legacy.category || '',
                    }]);
                }
            } else {
                setPoCategory('rm');
                setDate(new Date().toISOString().split('T')[0]);
                setVendor('');
                setVendorName('');
                setRemarks('');
                setStatus('Released');
                setGstType('intra_state');
                setTaxRate(18);
                setTransportType('Road Freight');
                setTransportCharge(0);
                setPackingType('Standard Packaging');
                setPackingCharge(0);
                setMaterialEntries([{
                    itemType: 'rm',
                    material: '',
                    materialName: '',
                    description: '',
                    hsnCode: '',
                    pieceCount: 0,
                    quantity: 0,
                    unit: 'KG',
                    rate: 0,
                    amount: 0,
                    category: '',
                }]);
            }
        }
    }, [isOpen, initialData, isEditing]);

    // Handle PO Category Change at Top
    const handlePoCategoryChange = (newCategory: POItemCategoryType) => {
        setPoCategory(newCategory);
        setMaterialEntries(prev => prev.map(entry => ({
            ...entry,
            itemType: newCategory,
            unit: entry.unit || (newCategory === 'rm' ? 'KG' : 'PCS'),
        })));
    };

    // Vendor options
    const vendorOptions = useMemo(() => {
        const list: any[] = [];
        const seen = new Set<string>();
        (vendors || []).forEach((v: any) => {
            const val = v._id || v.id;
            const name = v.name || v.companyName || 'Vendor';
            const city = v.city || (v.address ? v.address.split(',')[0] : '');
            const label = city ? `${name} (${city})` : name;
            if (val && !seen.has(val)) {
                seen.add(val);
                list.push({ value: val, label });
            }
        });
        return list;
    }, [vendors]);

    // Material Dropdown Options: Show Material Name with Description (No code)
    const rmOptions = useMemo(() => {
        return rawMaterialsList.map(item => ({
            value: item._id,
            label: `${item.name || 'Raw Material'}${item.description || item.descriptions ? ` — ${item.description || item.descriptions}` : ''}`
        }));
    }, [rawMaterialsList]);

    const boOptions = useMemo(() => {
        return boughtOutsList.map(item => ({
            value: item._id,
            label: `${item.name || 'Bought Out'}${item.description || item.descriptions ? ` — ${item.description || item.descriptions}` : ''}`
        }));
    }, [boughtOutsList]);

    const consumableOptions = useMemo(() => {
        return consumablesList.map(item => ({
            value: item._id,
            label: `${item.name || 'Consumable'}${item.description || item.descriptions ? ` — ${item.description || item.descriptions}` : ''}`
        }));
    }, [consumablesList]);

    const currentOptionsToUse = useMemo(() => {
        if (poCategory === 'bo') return boOptions;
        if (poCategory === 'consumable') return consumableOptions;
        return rmOptions;
    }, [poCategory, rmOptions, boOptions, consumableOptions]);

    const handleMaterialSelect = (index: number, selectedId: string) => {
        const currentEntry = materialEntries[index];

        let foundItem: any = null;
        if (poCategory === 'rm') {
            foundItem = rawMaterialsList.find(m => m._id === selectedId);
        } else if (poCategory === 'bo') {
            foundItem = boughtOutsList.find(m => m._id === selectedId);
        } else if (poCategory === 'consumable') {
            foundItem = consumablesList.find(m => m._id === selectedId);
        }

        const activePriceLists = (priceLists && priceLists.length > 0) ? priceLists : fetchedPriceLists;
        const priceConfig = activePriceLists.find((p: any) => 
            (p.material?._id || p.material)?.toString() === selectedId
        );

        const autoRate = priceConfig && priceConfig.price != null ? Number(priceConfig.price) : 0;
        const autoUnit = (foundItem as any)?.unit || (typeof foundItem?.category === 'object' ? foundItem?.category?.unit : '') || currentEntry.unit || (poCategory === 'rm' ? 'KG' : 'PCS');
        const autoCat = typeof foundItem?.category === 'object' ? foundItem?.category?.name : (foundItem?.category || currentEntry.category || '');
        const autoDesc = foundItem?.description || foundItem?.descriptions || foundItem?.specifications || currentEntry.description || '';
        const autoHsn = foundItem?.hsnCode || foundItem?.hsn || foundItem?.sacCode || currentEntry.hsnCode || '';
        const autoName = foundItem?.name || currentEntry.materialName || '';

        setMaterialEntries(prev => {
            const updated = [...prev];
            const qty = updated[index].quantity || 0;
            const rate = autoRate || updated[index].rate || 0;
            const sub = qty * rate; // Actual amount without tax

            updated[index] = {
                ...updated[index],
                material: selectedId,
                materialName: autoName,
                description: autoDesc,
                hsnCode: autoHsn,
                unit: autoUnit,
                rate: rate,
                amount: sub,
                category: autoCat,
            };
            return updated;
        });
    };

    const updateEntry = (index: number, field: keyof POLineItemEntry, value: any) => {
        setMaterialEntries(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };

            if (field === 'quantity' || field === 'rate') {
                const qty = field === 'quantity' ? Number(value) : (updated[index].quantity || 0);
                const rate = field === 'rate' ? Number(value) : (updated[index].rate || 0);
                updated[index].amount = qty * rate; // Actual amount without tax
            }
            return updated;
        });
    };

    const handleAddEntry = () => {
        const newRow: POLineItemEntry = {
            itemType: poCategory,
            material: '',
            materialName: '',
            description: '',
            hsnCode: '',
            pieceCount: 0,
            quantity: 0,
            unit: poCategory === 'rm' ? 'KG' : 'PCS',
            rate: 0,
            amount: 0,
            category: '',
        };
        setMaterialEntries(prev => [...prev, newRow]);
    };

    const handleDuplicateEntry = (index: number) => {
        setMaterialEntries(prev => {
            const source = prev[index];
            const duplicate: POLineItemEntry = {
                ...source,
                itemType: poCategory,
                amount: (Number(source.quantity) || 0) * (Number(source.rate) || 0),
            };
            const updated = [...prev];
            updated.splice(index + 1, 0, duplicate);
            return updated;
        });
    };

    const handleRemoveEntry = (index: number) => {
        if (materialEntries.length > 1) {
            setMaterialEntries(prev => prev.filter((_, i) => i !== index));
        }
    };

    const handleRemoveEmptyEntries = () => {
        const nonEmpty = materialEntries.filter(m => (m.materialName && m.materialName.trim()) || (Number(m.quantity) > 0) || (Number(m.rate) > 0));
        if (nonEmpty.length === 0) {
            setMaterialEntries([{
                itemType: poCategory,
                material: '',
                materialName: '',
                description: '',
                hsnCode: '',
                pieceCount: 0,
                quantity: 0,
                unit: poCategory === 'rm' ? 'KG' : 'PCS',
                rate: 0,
                amount: 0,
                category: '',
            }]);
        } else {
            setMaterialEntries(nonEmpty);
        }
    };

    // Filter items when searching among 100+ items
    const visibleEntriesWithIndex = useMemo(() => {
        if (!itemSearchQuery.trim()) {
            return materialEntries.map((item, idx) => ({ item, index: idx }));
        }
        const query = itemSearchQuery.toLowerCase().trim();
        return materialEntries
            .map((item, idx) => ({ item, index: idx }))
            .filter(({ item, index }) => 
                String(index + 1).includes(query) ||
                (item.materialName || '').toLowerCase().includes(query) ||
                (item.description || '').toLowerCase().includes(query) ||
                (item.hsnCode || '').toLowerCase().includes(query) ||
                (item.unit || '').toLowerCase().includes(query)
            );
    }, [materialEntries, itemSearchQuery]);

    // Steel RM Calculator Calculations
    const calculatedSteelResult = useMemo(() => {
        const { shape, density, lengthMm, widthMm, thicknessMm, outerDiaMm, heightMm, pieces } = steelCalc;
        const L_m = lengthMm / 1000;
        const W_m = widthMm / 1000;
        const T_m = thicknessMm / 1000;
        const OD_m = outerDiaMm / 1000;
        const H_m = heightMm / 1000;
        const rho = density * 1000; // convert g/cm³ to kg/m³

        let singleWeightKg = 0;
        let specString = '';

        if (shape === 'plate') {
            singleWeightKg = L_m * W_m * T_m * rho;
            specString = `Sheet/Plate ${lengthMm} x ${widthMm} x ${thicknessMm}mm`;
        } else if (shape === 'round_bar') {
            const radius_m = OD_m / 2;
            singleWeightKg = Math.PI * Math.pow(radius_m, 2) * L_m * rho;
            specString = `Round Bar Dia Ø${outerDiaMm}mm x ${lengthMm}mm Length`;
        } else if (shape === 'pipe') {
            singleWeightKg = Math.PI * (OD_m - T_m) * T_m * L_m * rho;
            specString = `Round Pipe OD Ø${outerDiaMm}mm x ${thicknessMm}mm Wall x ${lengthMm}mm`;
        } else if (shape === 'square_tube') {
            singleWeightKg = 2 * (W_m + H_m - (2 * T_m)) * T_m * L_m * rho;
            specString = `Square/Rect Tube ${widthMm} x ${heightMm} x ${thicknessMm}mm Wall x ${lengthMm}mm`;
        } else if (shape === 'flat_bar') {
            singleWeightKg = W_m * T_m * L_m * rho;
            specString = `Flat Bar ${widthMm}mm Width x ${thicknessMm}mm Thk x ${lengthMm}mm Length`;
        } else if (shape === 'angle') {
            singleWeightKg = (W_m + H_m - T_m) * T_m * L_m * rho;
            specString = `Equal Angle ${widthMm} x ${heightMm} x ${thicknessMm}mm x ${lengthMm}mm`;
        }

        const totalWeightKg = singleWeightKg * (pieces || 1);

        return {
            singleWeightKg: Math.max(0, singleWeightKg),
            totalWeightKg: Math.max(0, totalWeightKg),
            specString: `${steelCalc.materialType} ${specString}`,
        };
    }, [steelCalc]);

    const handleApplySteelCalculation = () => {
        const { totalWeightKg, specString } = calculatedSteelResult;
        const formattedWeight = parseFloat(totalWeightKg.toFixed(3));
        const rate = Number(steelCalc.ratePerKg) || 0;
        const lineSub = formattedWeight * rate;

        const newEntry: POLineItemEntry = {
            itemType: 'rm',
            material: '',
            materialName: `${steelCalc.materialType} (${steelCalc.shape.replace('_', ' ').toUpperCase()})`,
            description: `${specString} | Dimensions: L=${steelCalc.lengthMm}mm, W=${steelCalc.widthMm}mm, T=${steelCalc.thicknessMm}mm`,
            hsnCode: '7208',
            pieceCount: Number(steelCalc.pieces) || 1,
            quantity: formattedWeight,
            unit: 'KG',
            rate: rate,
            amount: lineSub, // Actual amount without tax
            category: 'Raw Material',
        };

        if (materialEntries.length === 1 && !materialEntries[0].material && !materialEntries[0].materialName && materialEntries[0].quantity === 0) {
            setMaterialEntries([newEntry]);
        } else {
            setMaterialEntries(prev => [...prev, newEntry]);
        }

        setShowSteelCalc(false);
    };

    // Subtotal: sum of all line item pure amounts without tax
    const subtotal = materialEntries.reduce((sum, item) => sum + ((Number(item.quantity) || 0) * (Number(item.rate) || 0)), 0);
    const totalLogistics = (Number(transportCharge) || 0) + (Number(packingCharge) || 0);
    
    // Total Taxable Base Amount (Items Subtotal + Freight + Packaging)
    const taxableAmount = subtotal + totalLogistics;
    
    // Tax is applied on the full taxable amount (composite supply) based on overall taxRate %
    const totalTax = taxableAmount * (Number(taxRate) / 100);
    
    // Exact rates for each GST component
    const cgstRate = gstType === 'intra_state' ? (taxRate / 2) : 0;
    const sgstRate = gstType === 'intra_state' ? (taxRate / 2) : 0;
    const igstRate = gstType === 'inter_state' ? taxRate : 0;

    // Amounts for each GST component
    const cgstAmount = gstType === 'intra_state' ? (totalTax / 2) : 0;
    const sgstAmount = gstType === 'intra_state' ? (totalTax / 2) : 0;
    const igstAmount = gstType === 'inter_state' ? totalTax : 0;
    const grandTotal = taxableAmount + totalTax;

    // Validation logic for rows
    const getItemErrors = (entry: POLineItemEntry): ItemValidationError => {
        const errors: ItemValidationError = {};
        if (!entry.materialName || !entry.materialName.trim()) {
            errors.materialName = true;
        }
        if (!entry.quantity || Number(entry.quantity) <= 0 || isNaN(Number(entry.quantity))) {
            errors.quantity = true;
        }
        if (!entry.unit || !entry.unit.trim()) {
            errors.unit = true;
        }
        if (entry.rate < 0 || isNaN(Number(entry.rate))) {
            errors.rate = true;
        }
        return errors;
    };

    // Duplicate Item Detection (maps row index to other duplicate row indices)
    const duplicateMap = useMemo(() => {
        const map = new Map<number, number[]>();
        const seen = new Map<string, number>();

        materialEntries.forEach((entry, idx) => {
            const idKey = entry.material ? `id:${entry.material}` : '';
            const nameKey = entry.materialName ? `name:${entry.materialName.trim().toLowerCase()}` : '';
            const key = idKey || nameKey;
            if (!key) return;

            if (seen.has(key)) {
                const firstIdx = seen.get(key)!;
                if (!map.has(firstIdx)) map.set(firstIdx, []);
                if (!map.get(firstIdx)!.includes(idx)) map.get(firstIdx)!.push(idx);

                if (!map.has(idx)) map.set(idx, []);
                if (!map.get(idx)!.includes(firstIdx)) map.get(idx)!.push(firstIdx);
            } else {
                seen.set(key, idx);
            }
        });

        return map;
    }, [materialEntries]);

    const scrollToRow = (index: number) => {
        const el = document.getElementById(`po-item-row-${index}`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('animate-pulse');
            setTimeout(() => el.classList.remove('animate-pulse'), 1500);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setHasAttemptedSubmit(true);

        const errors: string[] = [];
        let firstInvalidIndex: number | null = null;

        if (!date) {
            errors.push("PO Date is required.");
        }
        if (!vendor) {
            errors.push("Vendor / Supplier selection is required.");
        }

        if (materialEntries.length === 0) {
            errors.push("At least one purchase line item is required.");
        }

        // Check for duplicate items
        if (duplicateMap.size > 0) {
            duplicateMap.forEach((dupIndices, idx) => {
                const rowNum = idx + 1;
                const otherRows = dupIndices.map(i => `#${i + 1}`).join(', ');
                const matName = materialEntries[idx].materialName || 'Item';
                errors.push(`Row #${rowNum}: "${matName}" is entered multiple times (also in Row ${otherRows}). Please combine quantities.`);
                if (firstInvalidIndex === null) firstInvalidIndex = idx;
            });
        }

        materialEntries.forEach((entry, idx) => {
            const rowErr = getItemErrors(entry);
            const rowNum = idx + 1;
            if (rowErr.materialName) {
                errors.push(`Row #${rowNum}: Material Name is missing.`);
                if (firstInvalidIndex === null) firstInvalidIndex = idx;
            }
            if (rowErr.quantity) {
                errors.push(`Row #${rowNum}: Quantity must be greater than 0.`);
                if (firstInvalidIndex === null) firstInvalidIndex = idx;
            }
            if (rowErr.unit) {
                errors.push(`Row #${rowNum}: Unit is required.`);
                if (firstInvalidIndex === null) firstInvalidIndex = idx;
            }
        });

        setValidationErrorList(errors);
        setFirstErrorRowIndex(firstInvalidIndex);

        if (errors.length > 0) {
            if (firstInvalidIndex !== null) {
                setTimeout(() => scrollToRow(firstInvalidIndex!), 100);
            }
            return;
        }

        const selectedVendorObj = (vendors || []).find((v: any) => (v._id || v.id) === vendor);

        const payload = {
            poNumber,
            date,
            vendor,
            vendorName: selectedVendorObj?.name || vendorName,
            category: poCategory === 'rm' ? 'Raw Material' : poCategory === 'bo' ? 'Bought Out' : 'Consumable',
            status,
            remarks,
            gstType,
            taxRate: Number(taxRate),
            cgstRate,
            sgstRate,
            igstRate,
            cgstAmount,
            sgstAmount,
            igstAmount,
            transportType,
            transportCharge: Number(transportCharge) || 0,
            packingType,
            packingCharge: Number(packingCharge) || 0,
            subtotal,
            totalTax,
            grandTotal,
            items: materialEntries.map(item => ({
                itemType: poCategory,
                material: item.material || undefined,
                component: item.component || undefined,
                materialName: item.materialName.trim(),
                description: item.description || '',
                hsnCode: item.hsnCode || '',
                pieceCount: Number(item.pieceCount) || 0,
                quantity: Number(item.quantity),
                unit: item.unit ? item.unit.trim() : (poCategory === 'rm' ? 'KG' : 'PCS'),
                rate: Number(item.rate) || 0,
                taxRate: Number(taxRate),
                amount: Number(item.amount) || ((Number(item.quantity) || 0) * (Number(item.rate) || 0)), // Pure amount without tax
                category: item.category || (poCategory === 'rm' ? 'Raw Material' : poCategory === 'bo' ? 'Bought Out' : 'Consumable'),
            })),
            totalAmount: grandTotal,
        };

        onSubmit(payload);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-1 sm:p-3 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-[98vw] max-w-[1750px] max-h-[97vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">
                
                {/* Modal Header */}
                <div className="px-6 py-4 bg-gradient-to-r from-cyan-950 via-slate-900 to-indigo-950 text-white flex items-center justify-between shrink-0 border-b border-cyan-800/40">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-cyan-500/15 border border-cyan-400/30 rounded-2xl flex items-center justify-center text-cyan-400">
                            <FileText className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-base sm:text-lg font-extrabold tracking-tight text-white flex items-center gap-2">
                                {isEditing ? `Edit Outward PO #${poNumber}` : 'Create Outward Purchase Order'}
                            </h2>
                            <p className="text-xs text-cyan-300/80 font-medium">
                                Supplier Procurement • {poCategory === 'rm' ? 'Raw Material (RM)' : poCategory === 'bo' ? 'Bought Out (BO)' : 'Consumable Item'} PO • {materialEntries.length} Items Configured
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Validation Error Alert Banner */}
                {hasAttemptedSubmit && validationErrorList.length > 0 && (
                    <div className="bg-rose-50 dark:bg-rose-950/70 border-b border-rose-200 dark:border-rose-900/80 p-3 sm:px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-rose-900 dark:text-rose-200 animate-in slide-in-from-top-1 duration-150">
                        <div className="flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                            <span className="font-bold">
                                Please correct {validationErrorList.length} required field issue{validationErrorList.length > 1 ? 's' : ''} before saving:
                            </span>
                            <span className="hidden md:inline font-medium text-rose-700 dark:text-rose-300">
                                {validationErrorList.slice(0, 3).join(" • ")}
                                {validationErrorList.length > 3 && ` (+${validationErrorList.length - 3} more)`}
                            </span>
                        </div>
                        {firstErrorRowIndex !== null && (
                            <button
                                type="button"
                                onClick={() => scrollToRow(firstErrorRowIndex!)}
                                className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold flex items-center gap-1 shrink-0 transition-colors cursor-pointer shadow-xs text-[11px]"
                            >
                                Jump to Error Row #{firstErrorRowIndex + 1}
                                <ArrowUpRight size={13} />
                            </button>
                        )}
                    </div>
                )}

                {/* Modal Body */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-slate-50/70 dark:bg-slate-950/60 custom-scrollbar">
                    
                    {/* Top Details Grid */}
                    <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
                        
                        {/* Primary PO Material Category Selector (Enforces 1 Material Type per PO) */}
                        <div className="bg-slate-50 dark:bg-slate-800/70 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <Package className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                                <div>
                                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-white">
                                        PO Material Category <span className="text-rose-500">*</span>
                                    </h4>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                        Select the single category for all materials in this Outward PO
                                    </p>
                                </div>
                            </div>

                            {/* Segmented Category Selector Buttons */}
                            <div className="flex items-center p-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs w-full sm:w-auto">
                                <button
                                    type="button"
                                    onClick={() => handlePoCategoryChange('rm')}
                                    className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                                        poCategory === 'rm'
                                            ? 'bg-cyan-600 text-white shadow-sm'
                                            : 'text-slate-600 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400'
                                    }`}
                                >
                                    <span>Raw Material (RM)</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handlePoCategoryChange('bo')}
                                    className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                                        poCategory === 'bo'
                                            ? 'bg-indigo-600 text-white shadow-sm'
                                            : 'text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400'
                                    }`}
                                >
                                    <span>Bought Out (BO)</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handlePoCategoryChange('consumable')}
                                    className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                                        poCategory === 'consumable'
                                            ? 'bg-emerald-600 text-white shadow-sm'
                                            : 'text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400'
                                    }`}
                                >
                                    <span>Consumable Item</span>
                                </button>
                            </div>
                        </div>

                        {/* Top Info Inputs Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                                    <Hash size={13} className="text-cyan-600" />
                                    Outward PO Number
                                </label>
                                <input
                                    type="text"
                                    value={poNumber}
                                    readOnly
                                    className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-mono text-xs font-bold select-all cursor-not-allowed"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                                    <Calendar size={13} className="text-cyan-600" />
                                    PO Date <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    required
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className={`w-full px-3 py-2 bg-white dark:bg-slate-800 border rounded-xl text-xs font-bold text-slate-900 dark:text-slate-100 outline-none transition-all ${
                                        hasAttemptedSubmit && !date 
                                            ? 'border-rose-500 bg-rose-50/40 dark:bg-rose-950/30 ring-2 ring-rose-400' 
                                            : 'border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-cyan-500'
                                    }`}
                                />
                                {hasAttemptedSubmit && !date && (
                                    <p className="text-[11px] font-semibold text-rose-600 mt-1">PO Date is required.</p>
                                )}
                            </div>

                            <div className="sm:col-span-2">
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                                    <User size={13} className="text-cyan-600" />
                                    Vendor / Supplier <span className="text-rose-500">*</span>
                                </label>
                                <SearchableSelect
                                    options={vendorOptions}
                                    value={vendor}
                                    displayLabel={vendorName || undefined}
                                    onChange={(val: any) => {
                                        setVendor(val);
                                        const found = vendorOptions.find(o => o.value === val);
                                        if (found) setVendorName(found.label);
                                    }}
                                    hasError={hasAttemptedSubmit && !vendor}
                                    placeholder="Search and Select Vendor / Supplier..."
                                />
                                {hasAttemptedSubmit && !vendor && (
                                    <p className="text-[11px] font-semibold text-rose-600 mt-1">Please select a vendor / supplier.</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Items Section Header & Control Toolbar */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                        <div className="p-4 bg-slate-50/90 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5">
                                <div className="p-1.5 bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300 rounded-lg">
                                    <Layers className="w-4 h-4" />
                                </div>
                                <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                                    {poCategory === 'rm' ? 'Raw Material (RM)' : poCategory === 'bo' ? 'Bought Out (BO)' : 'Consumable'} Line Items
                                </h3>
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300">
                                    {materialEntries.length} Item{materialEntries.length > 1 ? 's' : ''}
                                </span>
                            </div>

                            {/* In-Modal Quick Filter for 100+ items */}
                            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                                <div className="relative flex-1 sm:w-64">
                                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                    <input
                                        type="text"
                                        placeholder="Find row, name, desc, HSN..."
                                        value={itemSearchQuery}
                                        onChange={(e) => setItemSearchQuery(e.target.value)}
                                        className="w-full pl-8 pr-7 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-cyan-500"
                                    />
                                    {itemSearchQuery && (
                                        <button
                                            type="button"
                                            onClick={() => setItemSearchQuery('')}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                        >
                                            <X size={13} />
                                        </button>
                                    )}
                                </div>

                                {poCategory === 'rm' && (
                                    <button
                                        type="button"
                                        onClick={() => setShowSteelCalc(!showSteelCalc)}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                                            showSteelCalc 
                                                ? 'bg-amber-500 text-white border-amber-600 shadow-sm' 
                                                : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800 hover:bg-amber-100'
                                        }`}
                                    >
                                        <Calculator size={14} />
                                        {showSteelCalc ? 'Hide Steel Calc' : 'Steel / RM Calc'}
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Interactive Steel Weight Calculation Panel (Active for RM) */}
                        {showSteelCalc && poCategory === 'rm' && (
                            <div className="p-4 sm:p-5 bg-gradient-to-br from-amber-50/90 via-orange-50/40 to-amber-50/80 dark:from-amber-950/30 dark:to-slate-900 border-b border-amber-200/80 dark:border-amber-900/60 space-y-4 animate-in slide-in-from-top-2 duration-200">
                                <div className="flex items-center justify-between pb-2 border-b border-amber-200/60 dark:border-amber-800/40">
                                    <div className="flex items-center gap-2">
                                        <Sparkles className="w-4 h-4 text-amber-600" />
                                        <h4 className="text-xs sm:text-sm font-extrabold text-amber-950 dark:text-amber-300">
                                            Raw Material (RM) Steel Weight & Dimensions Calculator
                                        </h4>
                                    </div>
                                    <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/50 px-2 py-0.5 rounded-md">
                                        Auto-computes weight & transfers piece count
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
                                    <div className="col-span-2 sm:col-span-1">
                                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Steel Shape / Form</label>
                                        <select
                                            value={steelCalc.shape}
                                            onChange={(e) => setSteelCalc({ ...steelCalc, shape: e.target.value as SteelShape })}
                                            className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-800 rounded-xl font-bold text-slate-900 dark:text-slate-100"
                                        >
                                            <option value="plate">Plate / Sheet</option>
                                            <option value="round_bar">Round Bar / Rod</option>
                                            <option value="pipe">Round Pipe / Tube</option>
                                            <option value="square_tube">Square / Rect Tube</option>
                                            <option value="flat_bar">Flat Bar</option>
                                            <option value="angle">Equal Angle</option>
                                        </select>
                                    </div>

                                    <div className="col-span-2 sm:col-span-1">
                                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Material Density</label>
                                        <select
                                            value={steelCalc.density}
                                            onChange={(e) => {
                                                const d = parseFloat(e.target.value);
                                                let matName = 'Mild Steel (MS)';
                                                if (d === 8.0) matName = 'Stainless Steel (SS 304/316)';
                                                else if (d === 2.7) matName = 'Aluminium';
                                                else if (d === 8.5) matName = 'Brass / Copper';
                                                setSteelCalc({ ...steelCalc, density: d, materialType: matName });
                                            }}
                                            className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-800 rounded-xl font-bold text-slate-900 dark:text-slate-100"
                                        >
                                            <option value={7.85}>Mild Steel / MS (7.85 g/cm³)</option>
                                            <option value={8.0}>Stainless Steel / SS (8.00 g/cm³)</option>
                                            <option value={2.7}>Aluminium (2.70 g/cm³)</option>
                                            <option value={8.5}>Brass / Copper (8.50 g/cm³)</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Length (mm)</label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={steelCalc.lengthMm || ''}
                                            onChange={(e) => setSteelCalc({ ...steelCalc, lengthMm: parseFloat(e.target.value) || 0 })}
                                            className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-800 rounded-xl font-bold"
                                            placeholder="1000"
                                        />
                                    </div>

                                    {(steelCalc.shape === 'plate' || steelCalc.shape === 'flat_bar' || steelCalc.shape === 'square_tube' || steelCalc.shape === 'angle') && (
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Width (mm)</label>
                                            <input
                                                type="number"
                                                min="1"
                                                value={steelCalc.widthMm || ''}
                                                onChange={(e) => setSteelCalc({ ...steelCalc, widthMm: parseFloat(e.target.value) || 0 })}
                                                className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-800 rounded-xl font-bold"
                                                placeholder="1000"
                                            />
                                        </div>
                                    )}

                                    {(steelCalc.shape === 'round_bar' || steelCalc.shape === 'pipe') && (
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Outer Dia Ø (mm)</label>
                                            <input
                                                type="number"
                                                min="1"
                                                value={steelCalc.outerDiaMm || ''}
                                                onChange={(e) => setSteelCalc({ ...steelCalc, outerDiaMm: parseFloat(e.target.value) || 0 })}
                                                className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-800 rounded-xl font-bold"
                                                placeholder="50"
                                            />
                                        </div>
                                    )}

                                    {(steelCalc.shape === 'plate' || steelCalc.shape === 'pipe' || steelCalc.shape === 'square_tube' || steelCalc.shape === 'flat_bar' || steelCalc.shape === 'angle') && (
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Thickness (mm)</label>
                                            <input
                                                type="number"
                                                min="0.1"
                                                step="any"
                                                value={steelCalc.thicknessMm || ''}
                                                onChange={(e) => setSteelCalc({ ...steelCalc, thicknessMm: parseFloat(e.target.value) || 0 })}
                                                className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-800 rounded-xl font-bold"
                                                placeholder="10"
                                            />
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Pieces / Count</label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={steelCalc.pieces || ''}
                                            onChange={(e) => setSteelCalc({ ...steelCalc, pieces: parseInt(e.target.value) || 1 })}
                                            className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-800 rounded-xl font-bold"
                                            placeholder="1"
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 bg-white/70 dark:bg-slate-900/70 p-3 rounded-xl border border-amber-200 dark:border-amber-900">
                                    <div className="flex items-center gap-3">
                                        <div className="text-xs">
                                            <span className="text-slate-500 dark:text-slate-400 font-semibold block">Specification:</span>
                                            <span className="font-bold text-slate-900 dark:text-white font-mono">{calculatedSteelResult.specString}</span>
                                        </div>
                                        <div className="h-8 w-px bg-amber-200 dark:bg-amber-800 hidden sm:block" />
                                        <div className="text-xs">
                                            <span className="text-slate-500 dark:text-slate-400 font-semibold block">Total Weight:</span>
                                            <span className="font-extrabold text-amber-700 dark:text-amber-400 font-mono text-sm">
                                                {calculatedSteelResult.totalWeightKg.toFixed(3)} Kg
                                            </span>
                                            <span className="text-[10px] text-slate-400 ml-1.5">
                                                ({steelCalc.pieces} Pcs @ {calculatedSteelResult.singleWeightKg.toFixed(3)} Kg/pc)
                                            </span>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={handleApplySteelCalculation}
                                        className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                                    >
                                        <Plus size={14} /> Insert as RM Item
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Desktop Line Items Table: Spacious, Persistent Names, Amount Excl. Tax */}
                        <div className="hidden lg:block overflow-x-auto pb-4">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-100/75 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                                        <th className="py-3 px-3 w-12 text-center">#</th>
                                        <th className="py-3 px-3 min-w-[360px]">Material Name & Description <span className="text-rose-500">*</span></th>
                                        <th className="py-3 px-3 w-36 min-w-[130px] text-center">HSN / SAC</th>
                                        <th className="py-3 px-3 w-28 min-w-[100px] text-center" title="Informational Piece/Count tracking">Count (Pcs)</th>
                                        <th className="py-3 px-3 w-36 min-w-[140px] text-center">Quantity <span className="text-rose-500">*</span></th>
                                        <th className="py-3 px-3 w-24 min-w-[90px] text-center">Unit <span className="text-rose-500">*</span></th>
                                        <th className="py-3 px-3 w-32 min-w-[130px] text-right">Rate (₹)</th>
                                        <th className="py-3 px-3 w-36 min-w-[140px] text-right">Amount (₹)</th>
                                        <th className="py-3 px-3 w-20 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                                    {visibleEntriesWithIndex.map(({ item: entry, index }) => {
                                        const rowErrors = hasAttemptedSubmit ? getItemErrors(entry) : {};
                                        const hasRowError = Boolean(rowErrors.materialName || rowErrors.quantity || rowErrors.unit);
                                        const isDuplicate = duplicateMap.has(index);
                                        const duplicateIndices = duplicateMap.get(index) || [];

                                        return (
                                            <tr 
                                                key={index} 
                                                id={`po-item-row-${index}`}
                                                className={`transition-colors ${
                                                    hasRowError 
                                                        ? 'bg-rose-50/40 dark:bg-rose-950/20' 
                                                        : isDuplicate
                                                            ? 'bg-amber-50/70 dark:bg-amber-950/30'
                                                            : 'hover:bg-cyan-50/30 dark:hover:bg-slate-800/50'
                                                }`}
                                            >
                                                <td className="py-2.5 px-3 text-center font-bold font-mono">
                                                    <span className={isDuplicate ? 'text-amber-700 dark:text-amber-400 font-extrabold' : 'text-slate-400'}>
                                                        {index + 1}
                                                    </span>
                                                </td>

                                                {/* Material Selection / Name with Description - Always persistent and editable */}
                                                <td className="py-2.5 px-3 space-y-1.5">
                                                    <div className="flex gap-1.5 items-center">
                                                        <div className="flex-1">
                                                            <SearchableSelect
                                                                options={currentOptionsToUse}
                                                                value={entry.material || ''}
                                                                displayLabel={entry.materialName || undefined}
                                                                onChange={(val: any) => handleMaterialSelect(index, val)}
                                                                hasError={Boolean(rowErrors.materialName || isDuplicate)}
                                                                placeholder={`Select or search ${poCategory === 'rm' ? 'Raw Material' : poCategory === 'bo' ? 'Bought Out' : 'Consumable'}...`}
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* Duplicate Item Real-time Warning Badge */}
                                                    {isDuplicate && (
                                                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-100/90 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 text-[11px] font-bold border border-amber-300 dark:border-amber-700 animate-pulse shadow-2xs">
                                                            <AlertCircle size={13} className="text-amber-600 dark:text-amber-400 shrink-0" />
                                                            <span>Duplicate of Row #{duplicateIndices.map(i => i + 1).join(', #')} — Please combine quantity or remove</span>
                                                        </div>
                                                    )}

                                                    {/* Editable Description */}
                                                    <input
                                                        type="text"
                                                        placeholder="Description / Specification / Grade / Size..."
                                                        value={entry.description}
                                                        onChange={(e) => updateEntry(index, 'description', e.target.value)}
                                                        className="w-full px-3 py-1 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-lg text-[11px] font-medium text-slate-600 dark:text-slate-300 focus:ring-1 focus:ring-cyan-500"
                                                    />

                                                    {rowErrors.materialName && (
                                                        <p className="text-[10px] font-bold text-rose-600">Material Name is compulsory.</p>
                                                    )}
                                                </td>

                                                {/* Dedicated Wider HSN / SAC Code Column */}
                                                <td className="py-2.5 px-3">
                                                    <input
                                                        type="text"
                                                        placeholder="e.g. 720838"
                                                        value={entry.hsnCode}
                                                        onChange={(e) => updateEntry(index, 'hsnCode', e.target.value)}
                                                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-800 dark:text-slate-200 text-center focus:ring-2 focus:ring-cyan-500"
                                                    />
                                                </td>

                                                {/* Dedicated Count / Pcs Column */}
                                                <td className="py-2.5 px-3">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={entry.pieceCount || ''}
                                                        onChange={(e) => updateEntry(index, 'pieceCount', parseInt(e.target.value) || 0)}
                                                        placeholder="0"
                                                        className="w-full px-2 py-1.5 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 rounded-xl text-xs font-bold text-amber-900 dark:text-amber-200 text-center"
                                                        title="Informational Piece / Count tracking (e.g. 10 Pcs)"
                                                    />
                                                </td>

                                                {/* Dedicated Wider Quantity Column */}
                                                <td className="py-2.5 px-3">
                                                    <input
                                                        type="number"
                                                        min="0.0001"
                                                        step="any"
                                                        required
                                                        value={entry.quantity || ''}
                                                        onChange={(e) => updateEntry(index, 'quantity', parseFloat(e.target.value) || 0)}
                                                        placeholder="0.00"
                                                        className={`w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border rounded-xl text-xs font-bold text-slate-900 dark:text-white text-center font-mono ${
                                                            rowErrors.quantity 
                                                                ? 'border-rose-500 bg-rose-50/40 dark:bg-rose-950/30 ring-1 ring-rose-400' 
                                                                : 'border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-cyan-500'
                                                        }`}
                                                    />
                                                    {rowErrors.quantity && (
                                                        <p className="text-[10px] font-bold text-rose-600 text-center mt-0.5">Qty &gt; 0 req.</p>
                                                    )}
                                                </td>

                                                {/* Unit */}
                                                <td className="py-2.5 px-3">
                                                    <input
                                                        type="text"
                                                        required
                                                        value={entry.unit}
                                                        onChange={(e) => updateEntry(index, 'unit', e.target.value)}
                                                        placeholder={poCategory === 'rm' ? 'KG' : 'PCS'}
                                                        className={`w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 text-center ${
                                                            rowErrors.unit 
                                                                ? 'border-rose-500 bg-rose-50/40' 
                                                                : 'border-slate-200 dark:border-slate-700'
                                                        }`}
                                                    />
                                                </td>

                                                {/* Rate */}
                                                <td className="py-2.5 px-3">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="any"
                                                        value={entry.rate || ''}
                                                        onChange={(e) => updateEntry(index, 'rate', parseFloat(e.target.value) || 0)}
                                                        placeholder="0.00"
                                                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white text-right font-mono focus:ring-2 focus:ring-cyan-500"
                                                    />
                                                </td>

                                                {/* Line Amount (Pure Actual Amount WITHOUT Tax) */}
                                                <td className="py-2.5 px-3 text-right font-mono font-extrabold text-slate-900 dark:text-white">
                                                    ₹{entry.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>

                                                {/* Actions: Duplicate & Trash */}
                                                <td className="py-2.5 px-3 text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDuplicateEntry(index)}
                                                            className="p-1.5 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-950/40 rounded-lg transition-colors cursor-pointer"
                                                            title="Duplicate this row"
                                                        >
                                                            <Copy className="w-3.5 h-3.5" />
                                                        </button>
                                                        {materialEntries.length > 1 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveEntry(index)}
                                                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                                                                title="Delete this row"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
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

                        {/* Mobile Touch-Friendly Card View */}
                        <div className="block lg:hidden p-3 space-y-3 bg-slate-50 dark:bg-slate-900/60">
                            {visibleEntriesWithIndex.map(({ item: entry, index }) => {
                                const rowErrors = hasAttemptedSubmit ? getItemErrors(entry) : {};
                                const isDuplicate = duplicateMap.has(index);
                                const duplicateIndices = duplicateMap.get(index) || [];

                                return (
                                    <div 
                                        key={index} 
                                        id={`po-item-row-${index}`}
                                        className={`p-3.5 rounded-2xl border shadow-xs space-y-2.5 ${
                                            Object.keys(rowErrors).length > 0 
                                                ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-300 dark:border-rose-900' 
                                                : isDuplicate
                                                    ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700'
                                                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-700">
                                            <span className="text-xs font-bold text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950/60 px-2.5 py-0.5 rounded-lg">
                                                Item #{index + 1}
                                            </span>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => handleDuplicateEntry(index)}
                                                    className="p-1 text-slate-400 hover:text-cyan-600"
                                                    title="Duplicate"
                                                >
                                                    <Copy className="w-3.5 h-3.5" />
                                                </button>
                                                {materialEntries.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveEntry(index)}
                                                        className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Material Selection */}
                                        <div>
                                            <label className="block text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">
                                                Material Name <span className="text-rose-500">*</span>
                                            </label>
                                            <SearchableSelect
                                                options={currentOptionsToUse}
                                                value={entry.material || ''}
                                                displayLabel={entry.materialName || undefined}
                                                onChange={(val: any) => handleMaterialSelect(index, val)}
                                                hasError={Boolean(rowErrors.materialName || isDuplicate)}
                                                placeholder={`Select ${poCategory.toUpperCase()}...`}
                                            />
                                        </div>

                                        {/* Duplicate Warning in Mobile */}
                                        {isDuplicate && (
                                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-100/90 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 text-[11px] font-bold border border-amber-300 dark:border-amber-700">
                                                <AlertCircle size={13} className="text-amber-600 shrink-0" />
                                                <span>Duplicate of Row #{duplicateIndices.map(i => i + 1).join(', #')}</span>
                                            </div>
                                        )}

                                        {/* Description */}
                                        <div>
                                            <input
                                                type="text"
                                                placeholder="Description / Specification..."
                                                value={entry.description}
                                                onChange={(e) => updateEntry(index, 'description', e.target.value)}
                                                className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-700 dark:text-slate-300"
                                            />
                                        </div>

                                        {/* HSN, Count, Qty, Unit, Rate Grid */}
                                        <div className="grid grid-cols-5 gap-1.5">
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 mb-1">HSN</label>
                                                <input
                                                    type="text"
                                                    value={entry.hsnCode}
                                                    onChange={(e) => updateEntry(index, 'hsnCode', e.target.value)}
                                                    placeholder="7208"
                                                    className="w-full px-1.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-center font-bold"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-amber-700 dark:text-amber-400 mb-1" title="Pieces Count">Count</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={entry.pieceCount || ''}
                                                    onChange={(e) => updateEntry(index, 'pieceCount', parseInt(e.target.value) || 0)}
                                                    placeholder="0"
                                                    className="w-full px-1.5 py-1 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 rounded-lg text-xs font-bold text-center text-amber-900 dark:text-amber-200"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 mb-1">Qty *</label>
                                                <input
                                                    type="number"
                                                    min="0.0001"
                                                    step="any"
                                                    value={entry.quantity || ''}
                                                    onChange={(e) => updateEntry(index, 'quantity', parseFloat(e.target.value) || 0)}
                                                    className={`w-full px-1.5 py-1 bg-white dark:bg-slate-900 border rounded-lg text-xs font-bold text-center font-mono ${
                                                        rowErrors.quantity ? 'border-rose-500 ring-1 ring-rose-400' : 'border-slate-200'
                                                    }`}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 mb-1">Unit *</label>
                                                <input
                                                    type="text"
                                                    value={entry.unit}
                                                    onChange={(e) => updateEntry(index, 'unit', e.target.value)}
                                                    className="w-full px-1 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-center"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 mb-1">Rate (₹)</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="any"
                                                    value={entry.rate || ''}
                                                    onChange={(e) => updateEntry(index, 'rate', parseFloat(e.target.value) || 0)}
                                                    className="w-full px-1.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-right font-mono"
                                                />
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-700 text-xs">
                                            <span className="text-slate-500 font-semibold">Amount (Excl. Tax):</span>
                                            <span className="font-mono font-extrabold text-slate-900 dark:text-white">
                                                ₹{entry.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Add Item Action Bar */}
                        <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleAddEntry}
                                    className="px-5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                                >
                                    <Plus size={16} /> Add Item
                                </button>
                            </div>

                            {materialEntries.length > 5 && (
                                <button
                                    type="button"
                                    onClick={handleRemoveEmptyEntries}
                                    className="px-3 py-2 text-slate-500 hover:text-rose-600 dark:text-slate-400 text-xs font-semibold transition-colors cursor-pointer"
                                    title="Clean up empty rows"
                                >
                                    Clear Empty Rows
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Logistics, Tax, and Financial Summary Section */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        
                        {/* Left: Logistics & Packaging Charges & Notes */}
                        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                                <Truck className="w-4 h-4 text-cyan-600" />
                                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                                    Logistics, Packaging & Notes
                                </h4>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Freight / Transport Mode</label>
                                    <input
                                        type="text"
                                        value={transportType}
                                        onChange={(e) => setTransportType(e.target.value)}
                                        placeholder="Road Freight, Door Delivery..."
                                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Freight Charges (₹)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="any"
                                        value={transportCharge || ''}
                                        onChange={(e) => setTransportCharge(parseFloat(e.target.value) || 0)}
                                        placeholder="0.00"
                                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono font-bold"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Packaging Type</label>
                                    <input
                                        type="text"
                                        value={packingType}
                                        onChange={(e) => setPackingType(e.target.value)}
                                        placeholder="Standard Wooden Box..."
                                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Packaging Charges (₹)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="any"
                                        value={packingCharge || ''}
                                        onChange={(e) => setPackingCharge(parseFloat(e.target.value) || 0)}
                                        placeholder="0.00"
                                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono font-bold"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Terms & Conditions / Remarks</label>
                                <textarea
                                    rows={2}
                                    value={remarks}
                                    onChange={(e) => setRemarks(e.target.value)}
                                    placeholder="Payment terms, delivery schedule, test certificates required..."
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium resize-none"
                                />
                            </div>
                        </div>

                        {/* Right: Consolidated GST Tax & Grand Total */}
                        <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white p-5 rounded-2xl border border-indigo-900/60 shadow-lg flex flex-col justify-between space-y-4">
                            <div>
                                <div className="flex items-center justify-between pb-3 border-b border-indigo-800/60">
                                    <div className="flex items-center gap-2">
                                        <Percent className="w-4 h-4 text-cyan-400" />
                                        <h4 className="text-xs font-extrabold uppercase tracking-wider text-cyan-200">
                                            Consolidated GST & Grand Total
                                        </h4>
                                    </div>
                                    <span className="text-[10px] font-bold text-cyan-300 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800/60">
                                        Applied once on Subtotal
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-3 pt-3 text-xs">
                                    <div>
                                        <label className="block text-[11px] font-bold text-indigo-200 mb-1">GST Tax Type</label>
                                        <select
                                            value={gstType}
                                            onChange={(e) => setGstType(e.target.value as any)}
                                            className="w-full px-2.5 py-1.5 bg-indigo-950/80 border border-indigo-700/80 rounded-xl text-xs font-bold text-white cursor-pointer"
                                        >
                                            <option value="intra_state">Intra-State (CGST + SGST)</option>
                                            <option value="inter_state">Inter-State (IGST)</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-bold text-indigo-200 mb-1">GST Tax Rate (%)</label>
                                        <select
                                            value={taxRate}
                                            onChange={(e) => setTaxRate(Number(e.target.value))}
                                            className="w-full px-2.5 py-1.5 bg-indigo-950/80 border border-indigo-700/80 rounded-xl text-xs font-bold text-white cursor-pointer"
                                        >
                                            <option value={0}>0% (Exempted / Nil)</option>
                                            <option value={5}>5% GST</option>
                                            <option value={12}>12% GST</option>
                                            <option value={18}>18% GST (Standard)</option>
                                            <option value={28}>28% GST</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Summary Price Breakdown */}
                            <div className="space-y-2 pt-3 border-t border-indigo-800/60 text-xs">
                                <div className="flex justify-between text-indigo-200">
                                    <span>Items Subtotal:</span>
                                    <span className="font-mono font-bold text-white">
                                        ₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>

                                {totalLogistics > 0 && (
                                    <div className="flex justify-between text-indigo-300/90 text-[11px]">
                                        <span>Freight & Packaging:</span>
                                        <span className="font-mono">₹{totalLogistics.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                )}

                                {totalLogistics > 0 && (
                                    <div className="flex justify-between text-cyan-300 font-bold border-t border-indigo-800/40 pt-1 text-[11px]">
                                        <span>Taxable Base Amount:</span>
                                        <span className="font-mono">₹{taxableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                )}

                                {gstType === 'intra_state' ? (
                                    <>
                                        <div className="flex justify-between text-indigo-300/80 text-[11px]">
                                            <span>CGST ({cgstRate}% on Taxable Base):</span>
                                            <span className="font-mono">₹{cgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        </div>
                                        <div className="flex justify-between text-indigo-300/80 text-[11px]">
                                            <span>SGST ({sgstRate}% on Taxable Base):</span>
                                            <span className="font-mono">₹{sgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex justify-between text-indigo-300/80 text-[11px]">
                                        <span>IGST ({igstRate}% on Taxable Base):</span>
                                        <span className="font-mono">₹{igstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                )}

                                <div className="flex justify-between items-baseline pt-2 border-t border-indigo-700/80 text-sm font-extrabold text-white">
                                    <span className="text-cyan-300 uppercase tracking-wider">Grand Total (Incl. GST):</span>
                                    <span className="text-xl font-mono text-cyan-400">
                                        ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Form Action Footer */}
                    <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3 shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-700 hover:to-indigo-700 text-white text-xs font-extrabold shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                            {loading ? (
                                <span>Saving...</span>
                            ) : (
                                <>
                                    <Check size={16} />
                                    <span>{isEditing ? 'Update Outward PO' : 'Create & Release Outward PO'}</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

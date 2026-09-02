"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { 
    X, Plus, Trash2, Package, User, Calendar, Hash, FileText, 
    Truck, Box, Calculator, Layers, Sparkles, ChevronDown, Check, ArrowRight, ShieldCheck, Info, Percent
} from 'lucide-react';
import { POModalProps } from "@/src/features/store/types/store.types";
import SearchableSelect from '../SearchableSelect';
import { apiGet } from '@/src/lib/api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export interface POLineItemEntry {
    itemType: 'rm' | 'bo' | 'consumable' | 'custom';
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
            if (initialData) {
                // Populate existing PO cleanly without resetting to empty
                setPoNumber(initialData.poNumber || '');
                setDate(initialData.date ? new Date(initialData.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
                
                const vId = typeof initialData.vendor === 'object' ? (initialData.vendor as any)?._id : (initialData.vendor || '');
                setVendor(vId);
                setVendorName((initialData as any).vendorName || (initialData.vendor as any)?.name || '');
                setRemarks(initialData.remarks || (initialData as any).termsAndConditions || '');
                setStatus(initialData.status || 'Released');
                setGstType((initialData as any).gstType || 'intra_state');
                setTaxRate(initialData.taxRate != null ? Number(initialData.taxRate) : 18);
                setTransportType(initialData.transportType || 'Road Freight');
                setTransportCharge(initialData.transportCharge || 0);
                setPackingType(initialData.packingType || 'Standard Packaging');
                setPackingCharge(initialData.packingCharge || 0);

                if (initialData.items && initialData.items.length > 0) {
                    setMaterialEntries(initialData.items.map((item: any) => {
                        const qty = Number(item.quantity) || Number(item.shortage) || Number(item.requiredQuantity) || 1;
                        const rate = Number(item.rate || item.unitPrice) || 0;
                        const lineSub = qty * rate; // Actual amount without tax
                        const matVal = typeof item.material === 'object' 
                            ? item.material?._id 
                            : (item.material || item.materialId || item.materialKey || '');

                        return {
                            itemType: (item.itemType || 'rm').toLowerCase().includes('bo') || (item.category || '').toLowerCase().includes('bought') ? 'bo' : 
                                      (item.itemType || '').toLowerCase().includes('consumable') ? 'consumable' : 'rm',
                            material: matVal,
                            component: item.component || '',
                            materialName: item.materialName || item.material?.name || item.itemName || 'Material Item',
                            description: item.description || item.itemDescription || item.remarks || item.specifications || '',
                            hsnCode: item.hsnCode || item.hsn || item.material?.hsnCode || '',
                            pieceCount: Number(item.pieceCount || item.count || 0),
                            quantity: qty,
                            unit: item.unit || item.uom || 'KG',
                            rate: rate,
                            amount: lineSub, // Pure amount without tax
                            category: item.category || '',
                        };
                    }));
                } else if ((initialData as any).material || (initialData as any).materialName) {
                    const legacy = initialData as any;
                    const qty = Number(legacy.quantity) || 1;
                    const rate = Number(legacy.rate) || 0;
                    const lineSub = qty * rate;
                    setMaterialEntries([{
                        itemType: 'rm',
                        material: typeof legacy.material === 'object' ? legacy.material?._id : (legacy.material || ''),
                        component: legacy.component || '',
                        materialName: legacy.materialName || legacy.material?.name || 'Material Item',
                        description: legacy.description || '',
                        hsnCode: legacy.hsnCode || '',
                        pieceCount: Number(legacy.pieceCount || 0),
                        quantity: qty,
                        unit: legacy.unit || 'KG',
                        rate: rate,
                        amount: lineSub,
                        category: legacy.category || '',
                    }]);
                }
            } else {
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

    const handleItemTypeChange = (index: number, newType: 'rm' | 'bo' | 'consumable' | 'custom') => {
        setMaterialEntries(prev => {
            const updated = [...prev];
            updated[index] = {
                ...updated[index],
                itemType: newType,
                material: '',
                materialName: '',
                description: '',
                hsnCode: '',
                rate: 0,
                amount: 0,
            };
            return updated;
        });
    };

    const handleMaterialSelect = (index: number, selectedId: string) => {
        const currentEntry = materialEntries[index];
        const entryType = currentEntry.itemType;

        let foundItem: any = null;
        if (entryType === 'rm') {
            foundItem = rawMaterialsList.find(m => m._id === selectedId);
        } else if (entryType === 'bo') {
            foundItem = boughtOutsList.find(m => m._id === selectedId);
        } else if (entryType === 'consumable') {
            foundItem = consumablesList.find(m => m._id === selectedId);
        }

        const activePriceLists = (priceLists && priceLists.length > 0) ? priceLists : fetchedPriceLists;
        const priceConfig = activePriceLists.find((p: any) => 
            (p.material?._id || p.material)?.toString() === selectedId
        );

        const autoRate = priceConfig && priceConfig.price != null ? Number(priceConfig.price) : 0;
        const autoUnit = (foundItem as any)?.unit || (typeof foundItem?.category === 'object' ? foundItem?.category?.unit : '') || 'KG';
        const autoCat = typeof foundItem?.category === 'object' ? foundItem?.category?.name : (foundItem?.category || '');
        const autoDesc = foundItem?.description || foundItem?.descriptions || foundItem?.specifications || '';
        const autoHsn = foundItem?.hsnCode || foundItem?.hsn || foundItem?.sacCode || '';

        setMaterialEntries(prev => {
            const updated = [...prev];
            const qty = updated[index].quantity || 0;
            const rate = autoRate || updated[index].rate || 0;
            const sub = qty * rate; // Actual amount without tax

            updated[index] = {
                ...updated[index],
                material: selectedId,
                materialName: foundItem?.name || '',
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
        setMaterialEntries(prev => [...prev, {
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
    };

    const handleRemoveEntry = (index: number) => {
        if (materialEntries.length > 1) {
            setMaterialEntries(prev => prev.filter((_, i) => i !== index));
        }
    };

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
    
    // Tax is applied once at the bottom based on overall taxRate %
    const totalTax = subtotal * (Number(taxRate) / 100);
    const totalLogistics = (Number(transportCharge) || 0) + (Number(packingCharge) || 0);
    
    // Exact rates for each GST component
    const cgstRate = gstType === 'intra_state' ? (taxRate / 2) : 0;
    const sgstRate = gstType === 'intra_state' ? (taxRate / 2) : 0;
    const igstRate = gstType === 'inter_state' ? taxRate : 0;

    // Amounts for each GST component
    const cgstAmount = gstType === 'intra_state' ? (totalTax / 2) : 0;
    const sgstAmount = gstType === 'intra_state' ? (totalTax / 2) : 0;
    const igstAmount = gstType === 'inter_state' ? totalTax : 0;
    const grandTotal = subtotal + totalTax + totalLogistics;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const invalid = materialEntries.filter(m => (!m.material && !m.materialName) || Number(m.quantity) <= 0);
        if (invalid.length > 0) {
            alert("Please ensure every item has a material selected/specified and a quantity greater than 0.");
            return;
        }

        const selectedVendorObj = (vendors || []).find((v: any) => (v._id || v.id) === vendor);

        const payload = {
            poNumber,
            date,
            vendor,
            vendorName: selectedVendorObj?.name || vendorName,
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
                itemType: item.itemType,
                material: item.material || undefined,
                component: item.component || undefined,
                materialName: item.materialName,
                description: item.description,
                hsnCode: item.hsnCode,
                pieceCount: Number(item.pieceCount) || 0,
                quantity: Number(item.quantity),
                unit: item.unit || 'KG',
                rate: Number(item.rate),
                taxRate: Number(taxRate),
                amount: Number(item.amount), // Pure amount without tax
                category: item.category,
            })),
            totalAmount: grandTotal,
        };

        onSubmit(payload);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-7xl max-h-[94vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">
                
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
                                Supplier Procurement Order • Item Amounts (Excl. Tax) • Consolidated GST at Bottom
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

                {/* Modal Body */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-slate-50/70 dark:bg-slate-950/60">
                    
                    {/* Top Details Grid */}
                    <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
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
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-cyan-500 outline-none"
                                />
                            </div>

                            <div className="sm:col-span-2">
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                                    <User size={13} className="text-cyan-600" />
                                    Vendor / Supplier <span className="text-rose-500">*</span>
                                </label>
                                <SearchableSelect
                                    options={vendorOptions}
                                    value={vendor}
                                    onChange={(val: any) => setVendor(val)}
                                    placeholder="Search and Select Vendor / Supplier..."
                                />
                            </div>
                        </div>
                    </div>

                    {/* Items Section Header with Steel RM Calculator */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                        <div className="p-4 bg-slate-50/90 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5">
                                <div className="p-1.5 bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300 rounded-lg">
                                    <Layers className="w-4 h-4" />
                                </div>
                                <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                                    Purchase Line Items
                                </h3>
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300">
                                    {materialEntries.length} Item{materialEntries.length > 1 ? 's' : ''}
                                </span>
                            </div>

                            <div className="flex items-center gap-2">
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
                                    {showSteelCalc ? 'Hide Steel Calculator' : 'Steel / RM Weight Calculator'}
                                </button>
                            </div>
                        </div>

                        {/* Interactive Steel Weight Calculation Panel */}
                        {showSteelCalc && (
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

                        {/* Desktop Line Items Table: Distinct HSN & Count Columns, Amount Excl. Tax */}
                        <div className="hidden lg:block overflow-x-auto pb-4">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-100/75 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                                        <th className="py-3 px-3 w-10 text-center">#</th>
                                        <th className="py-3 px-3 w-36">Category Type</th>
                                        <th className="py-3 px-3 min-w-[240px]">Material Name & Description</th>
                                        <th className="py-3 px-3 w-28 text-center">HSN / SAC</th>
                                        <th className="py-3 px-3 w-24 text-center" title="Informational Piece/Count tracking">Count (Pcs)</th>
                                        <th className="py-3 px-3 w-24 text-center">Quantity</th>
                                        <th className="py-3 px-3 w-20 text-center">Unit</th>
                                        <th className="py-3 px-3 w-28 text-right">Rate (₹)</th>
                                        <th className="py-3 px-3 w-32 text-right">Amount (₹)</th>
                                        <th className="py-3 px-3 w-10 text-center"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                                    {materialEntries.map((entry, index) => {
                                        let optionsToUse = rmOptions;
                                        if (entry.itemType === 'bo') optionsToUse = boOptions;
                                        else if (entry.itemType === 'consumable') optionsToUse = consumableOptions;

                                        return (
                                            <tr key={index} className="hover:bg-cyan-50/30 dark:hover:bg-slate-800/50 transition-colors">
                                                <td className="py-2.5 px-3 text-center text-slate-400 font-bold">
                                                    {index + 1}
                                                </td>

                                                {/* Inventory Type Selector */}
                                                <td className="py-2.5 px-3">
                                                    <select
                                                        value={entry.itemType}
                                                        onChange={(e) => handleItemTypeChange(index, e.target.value as any)}
                                                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-cyan-500 cursor-pointer"
                                                    >
                                                        <option value="rm">Raw Material (RM)</option>
                                                        <option value="bo">Bought Out (BO)</option>
                                                        <option value="consumable">Consumable</option>
                                                        <option value="custom">Custom / Service</option>
                                                    </select>
                                                </td>

                                                {/* Material Selection / Name with Description */}
                                                <td className="py-2.5 px-3 space-y-1.5">
                                                    {entry.itemType === 'custom' ? (
                                                        <input
                                                            type="text"
                                                            required
                                                            placeholder="Material Name..."
                                                            value={entry.materialName}
                                                            onChange={(e) => updateEntry(index, 'materialName', e.target.value)}
                                                            className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-cyan-500 text-slate-900 dark:text-white"
                                                        />
                                                    ) : (
                                                        <SearchableSelect
                                                            options={optionsToUse}
                                                            value={entry.material || ''}
                                                            onChange={(val: any) => handleMaterialSelect(index, val)}
                                                            placeholder={`Select ${entry.itemType === 'rm' ? 'Raw Material' : entry.itemType === 'bo' ? 'Bought Out' : 'Consumable'}...`}
                                                        />
                                                    )}

                                                    <input
                                                        type="text"
                                                        placeholder="Description / Specification..."
                                                        value={entry.description}
                                                        onChange={(e) => updateEntry(index, 'description', e.target.value)}
                                                        className="w-full px-3 py-1 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-lg text-[11px] font-medium text-slate-600 dark:text-slate-300 focus:ring-1 focus:ring-cyan-500"
                                                    />
                                                </td>

                                                {/* Dedicated Separate HSN Code Column */}
                                                <td className="py-2.5 px-3">
                                                    <input
                                                        type="text"
                                                        placeholder="e.g. 7208"
                                                        value={entry.hsnCode}
                                                        onChange={(e) => updateEntry(index, 'hsnCode', e.target.value)}
                                                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-semibold text-slate-800 dark:text-slate-200 text-center"
                                                    />
                                                </td>

                                                {/* Dedicated Separate Count / Pcs Column */}
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

                                                {/* Qty */}
                                                <td className="py-2.5 px-3">
                                                    <input
                                                        type="number"
                                                        min="0.001"
                                                        step="any"
                                                        required
                                                        value={entry.quantity || ''}
                                                        onChange={(e) => updateEntry(index, 'quantity', parseFloat(e.target.value) || 0)}
                                                        placeholder="0"
                                                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white text-center focus:ring-2 focus:ring-cyan-500"
                                                    />
                                                </td>

                                                {/* Unit */}
                                                <td className="py-2.5 px-3">
                                                    <input
                                                        type="text"
                                                        value={entry.unit}
                                                        onChange={(e) => updateEntry(index, 'unit', e.target.value)}
                                                        className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 text-center"
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
                                                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white text-right focus:ring-2 focus:ring-cyan-500"
                                                    />
                                                </td>

                                                {/* Line Amount (Pure Actual Amount WITHOUT Tax) */}
                                                <td className="py-2.5 px-3 text-right font-mono font-extrabold text-slate-900 dark:text-white">
                                                    ₹{entry.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>

                                                {/* Trash */}
                                                <td className="py-2.5 px-3 text-center">
                                                    {materialEntries.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveEntry(index)}
                                                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
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

                        {/* Mobile Touch-Friendly Card View */}
                        <div className="block lg:hidden p-3 space-y-3 bg-slate-50 dark:bg-slate-900/60">
                            {materialEntries.map((entry, index) => {
                                let optionsToUse = rmOptions;
                                if (entry.itemType === 'bo') optionsToUse = boOptions;
                                else if (entry.itemType === 'consumable') optionsToUse = consumableOptions;

                                return (
                                    <div key={index} className="bg-white dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-2.5">
                                        <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-700">
                                            <span className="text-xs font-bold text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950/60 px-2.5 py-0.5 rounded-lg">
                                                Item #{index + 1}
                                            </span>
                                            {materialEntries.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveEntry(index)}
                                                    className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>

                                        {/* Type Selector */}
                                        <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 dark:bg-slate-700/60 rounded-xl text-[11px] font-bold">
                                            <button
                                                type="button"
                                                onClick={() => handleItemTypeChange(index, 'rm')}
                                                className={`py-1 rounded-lg transition-all ${entry.itemType === 'rm' ? 'bg-cyan-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-300'}`}
                                            >
                                                RM
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleItemTypeChange(index, 'bo')}
                                                className={`py-1 rounded-lg transition-all ${entry.itemType === 'bo' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-300'}`}
                                            >
                                                BO
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleItemTypeChange(index, 'consumable')}
                                                className={`py-1 rounded-lg transition-all ${entry.itemType === 'consumable' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-300'}`}
                                            >
                                                Consumable
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleItemTypeChange(index, 'custom')}
                                                className={`py-1 rounded-lg transition-all ${entry.itemType === 'custom' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-300'}`}
                                            >
                                                Custom
                                            </button>
                                        </div>

                                        {/* Material Selection */}
                                        <div>
                                            <label className="block text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">
                                                Material Name
                                            </label>
                                            {entry.itemType === 'custom' ? (
                                                <input
                                                    type="text"
                                                    required
                                                    placeholder="Custom item name..."
                                                    value={entry.materialName}
                                                    onChange={(e) => updateEntry(index, 'materialName', e.target.value)}
                                                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white"
                                                />
                                            ) : (
                                                <SearchableSelect
                                                    options={optionsToUse}
                                                    value={entry.material || ''}
                                                    onChange={(val: any) => handleMaterialSelect(index, val)}
                                                    placeholder={`Select ${entry.itemType.toUpperCase()}...`}
                                                />
                                            )}
                                        </div>

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
                                                    className="w-full px-1.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-center"
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
                                                <label className="block text-[10px] font-bold text-slate-500 mb-1">Qty</label>
                                                <input
                                                    type="number"
                                                    min="0.001"
                                                    step="any"
                                                    value={entry.quantity || ''}
                                                    onChange={(e) => updateEntry(index, 'quantity', parseFloat(e.target.value) || 0)}
                                                    className="w-full px-1.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-center"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 mb-1">Unit</label>
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
                                                    className="w-full px-1.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-right"
                                                />
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-700 text-xs">
                                            <span className="text-slate-500">Amount (Excl. Tax):</span>
                                            <span className="font-mono font-extrabold text-slate-900 dark:text-white">
                                                ₹{entry.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Add Item Button at the Bottom of List */}
                        <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-700 flex items-center justify-center">
                            <button
                                type="button"
                                onClick={handleAddEntry}
                                className="w-full sm:w-auto px-6 py-2.5 bg-white dark:bg-slate-800 hover:bg-cyan-50 dark:hover:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 font-extrabold text-xs rounded-xl border border-dashed border-cyan-400 dark:border-cyan-700 shadow-2xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                            >
                                <Plus size={16} /> Add Another Material / Line Item
                            </button>
                        </div>
                    </div>

                    {/* Bottom Logistics & Single Consolidated GST Breakdown Summary */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                        
                        {/* Logistics, Packaging & Remarks */}
                        <div className="lg:col-span-7 bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                <Truck className="w-4 h-4 text-cyan-600" />
                                Logistics, Packaging & Instructions
                            </h4>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">Transport Mode</label>
                                    <select
                                        value={transportType}
                                        onChange={(e) => setTransportType(e.target.value)}
                                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium"
                                    >
                                        <option value="Road Freight">Road Freight</option>
                                        <option value="Air Cargo">Air Cargo</option>
                                        <option value="Courier Express">Courier Express</option>
                                        <option value="Self Pickup">Self Pickup</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">Transport Charges (₹)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="any"
                                        value={transportCharge || ''}
                                        onChange={(e) => setTransportCharge(parseFloat(e.target.value) || 0)}
                                        placeholder="0.00"
                                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold font-mono"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">Packaging Mode</label>
                                    <select
                                        value={packingType}
                                        onChange={(e) => setPackingType(e.target.value)}
                                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium"
                                    >
                                        <option value="Standard Packaging">Standard Packaging</option>
                                        <option value="Wooden Crate">Wooden Crate</option>
                                        <option value="Bubble Wrap & Box">Bubble Wrap & Box</option>
                                        <option value="Pallet Packing">Pallet Packing</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">Packaging Charges (₹)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="any"
                                        value={packingCharge || ''}
                                        onChange={(e) => setPackingCharge(parseFloat(e.target.value) || 0)}
                                        placeholder="0.00"
                                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold font-mono"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">Purchase Order Remarks & Terms</label>
                                <textarea
                                    rows={2}
                                    value={remarks}
                                    onChange={(e) => setRemarks(e.target.value)}
                                    placeholder="Enter delivery terms, payment terms, or instructions..."
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-cyan-500"
                                />
                            </div>
                        </div>

                        {/* Separate & Prominent GST Breakdown with Rates & Grand Total Card */}
                        <div className="lg:col-span-5 bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 text-white p-5 rounded-3xl border border-slate-800 shadow-xl flex flex-col justify-between space-y-4">
                            
                            {/* GST Mode & Tax Rate Controls */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                                        <ShieldCheck size={14} /> GST Tax Nature
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-800/80 rounded-xl border border-slate-700 text-xs font-bold">
                                    <button
                                        type="button"
                                        onClick={() => setGstType('intra_state')}
                                        className={`py-1.5 rounded-lg transition-all cursor-pointer text-center ${
                                            gstType === 'intra_state'
                                                ? 'bg-cyan-500 text-slate-950 shadow-md font-extrabold'
                                                : 'text-slate-300 hover:text-white'
                                        }`}
                                    >
                                        Intra-State (CGST + SGST)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setGstType('inter_state')}
                                        className={`py-1.5 rounded-lg transition-all cursor-pointer text-center ${
                                            gstType === 'inter_state'
                                                ? 'bg-cyan-500 text-slate-950 shadow-md font-extrabold'
                                                : 'text-slate-300 hover:text-white'
                                        }`}
                                    >
                                        Inter-State (IGST)
                                    </button>
                                </div>

                                {/* Single Tax Rate Selector */}
                                <div className="flex items-center justify-between bg-slate-800/60 p-2.5 rounded-xl border border-slate-700 text-xs">
                                    <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                                        <Percent size={13} className="text-cyan-400" /> Apply GST Rate:
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                        {[0, 5, 12, 18, 28].map(r => (
                                            <button
                                                key={r}
                                                type="button"
                                                onClick={() => setTaxRate(r)}
                                                className={`px-2 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                                                    taxRate === r 
                                                        ? 'bg-cyan-500 text-slate-950 shadow-xs' 
                                                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                                }`}
                                            >
                                                {r}%
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Detailed & Separate GST Summary Breakdown with Explicit Rates */}
                            <div className="space-y-2 text-xs border-t border-slate-800 pt-3">
                                <div className="flex items-center justify-between text-slate-300">
                                    <span>Taxable Subtotal (Actual Amount):</span>
                                    <span className="font-mono font-bold text-white text-sm">
                                        ₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>

                                {totalLogistics > 0 && (
                                    <div className="flex items-center justify-between text-slate-300">
                                        <span>Logistics & Packaging:</span>
                                        <span className="font-mono font-bold text-white">
                                            ₹{totalLogistics.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                )}

                                {/* Distinct Separate GST Rows with Specific Rate % */}
                                {gstType === 'intra_state' ? (
                                    <div className="space-y-1.5 pt-1 border-t border-slate-800/80">
                                        <div className="flex items-center justify-between bg-cyan-950/40 border border-cyan-800/40 px-3 py-1.5 rounded-xl">
                                            <span className="text-cyan-300 font-bold flex items-center gap-1.5">
                                                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                                                Central GST (CGST @ {cgstRate}%):
                                            </span>
                                            <span className="font-mono font-extrabold text-cyan-200">
                                                ₹{cgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between bg-indigo-950/40 border border-indigo-800/40 px-3 py-1.5 rounded-xl">
                                            <span className="text-indigo-300 font-bold flex items-center gap-1.5">
                                                <span className="w-2 h-2 rounded-full bg-indigo-400" />
                                                State GST (SGST @ {sgstRate}%):
                                            </span>
                                            <span className="font-mono font-extrabold text-indigo-200">
                                                ₹{sgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="pt-1 border-t border-slate-800/80">
                                        <div className="flex items-center justify-between bg-purple-950/40 border border-purple-800/40 px-3 py-2 rounded-xl">
                                            <span className="text-purple-300 font-bold flex items-center gap-1.5">
                                                <span className="w-2 h-2 rounded-full bg-purple-400" />
                                                Integrated GST (IGST @ {igstRate}%):
                                            </span>
                                            <span className="font-mono font-extrabold text-purple-200 text-sm">
                                                ₹{igstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-center justify-between text-slate-300 pt-1.5 border-t border-slate-800">
                                    <span className="font-semibold">Total GST Amount ({taxRate}%):</span>
                                    <span className="font-mono font-bold text-cyan-400">
                                        ₹{totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>

                            {/* Grand Total */}
                            <div className="pt-3 border-t border-slate-700 flex items-center justify-between">
                                <div>
                                    <span className="font-extrabold text-white text-sm block">Grand Total</span>
                                    <span className="text-[10px] text-slate-400">Taxable Amount + All Taxes & Charges</span>
                                </div>
                                <span className="text-lg sm:text-xl font-extrabold text-cyan-300 bg-cyan-950/80 px-3.5 py-1.5 rounded-2xl border border-cyan-500/40 shadow-inner font-mono">
                                    ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Modal Footer Actions */}
                    <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-7 py-2.5 rounded-xl text-white text-xs font-extrabold shadow-lg bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
                        >
                            {loading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    <span>Saving Order...</span>
                                </>
                            ) : (
                                <span>{isEditing ? 'Update Purchase Order' : 'Generate & Release Outward PO'}</span>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

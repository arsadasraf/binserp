"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Plus, Trash2, Package, User, Calendar, Hash, FileText, 
  Truck, Calculator, Layers, Sparkles, Check, ArrowRight, ShieldCheck, 
  Info, Percent, Search, AlertCircle, Wrench, Clock
} from 'lucide-react';
import SearchableSelect from '../SearchableSelect';
import { formatItemSelectLabel, getItemDescription, ItemNameAndDescription } from '@/src/utils/itemDisplayHelper';
import { apiPost, apiPut } from '@/src/lib/api';

const COMMON_PROCESSES = [
  "CNC Machining / Milling",
  "Heat Treatment & Annealing",
  "Powder Coating & Painting",
  "Zinc / Chrome / Nickel Plating",
  "Anodizing (Hard / Natural)",
  "Surface Grinding & Lapping",
  "Laser Cutting & CNC Bending",
  "TIG / MIG Welding & Fabrication",
  "Shot Blasting & Sanding",
  "Wire EDM & Spark Erosion",
  "Assembly & Testing"
];

interface JobWorkLineItem {
  id: string;
  material?: string;
  materialName: string;
  description: string;
  processType: string;
  processNote: string;
  quantity: number;
  unit: string;
  rate: number;
  taxRate: number;
  amount: number;
}

interface JobWorkPOModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  vendors?: any[];
  materials?: any[];
  inHouseItems?: any[];
  initialData?: any;
  isEditing?: boolean;
}

export default function JobWorkPOModal({
  isOpen,
  onClose,
  onSuccess,
  vendors = [],
  materials = [],
  inHouseItems = [],
  initialData,
  isEditing = false
}: JobWorkPOModalProps) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';

  // Form States
  const [poNumber, setPoNumber] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState<string>('');
  const [selectedVendorId, setSelectedVendorId] = useState<string>('');
  const [selectedVendorObj, setSelectedVendorObj] = useState<any>(null);
  const [processType, setProcessType] = useState<string>(COMMON_PROCESSES[0]);
  const [customProcess, setCustomProcess] = useState<string>('');
  const [sacCode, setSacCode] = useState<string>('9988');
  const [gstType, setGstType] = useState<'intra_state' | 'inter_state'>('intra_state');
  const [transportType, setTransportType] = useState<string>('Road Freight');
  const [transportCharge, setTransportCharge] = useState<number>(0);
  const [packingType, setPackingType] = useState<string>('Standard Packaging');
  const [packingCharge, setPackingCharge] = useState<number>(0);
  const [remarks, setRemarks] = useState<string>('');

  // Line Items
  const [items, setItems] = useState<JobWorkLineItem[]>([
    {
      id: 'jw-item-1',
      materialName: '',
      description: '',
      processType: COMMON_PROCESSES[0],
      processNote: '',
      quantity: 1,
      unit: 'PCS',
      rate: 0,
      taxRate: 18,
      amount: 0
    }
  ]);

  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Combine items for selector: Raw Materials, Bought Outs, FG items
  const allSelectableItems = useMemo(() => {
    const combined: any[] = [];
    const seen = new Set<string>();

    [...materials, ...inHouseItems].forEach(it => {
      const id = it._id || it.id;
      if (id && !seen.has(String(id))) {
        seen.add(String(id));
        combined.push(it);
      }
    });

    return combined;
  }, [materials, inHouseItems]);

  const itemOptions = useMemo(() => {
    return allSelectableItems.map(it => ({
      value: it._id || it.id,
      label: formatItemSelectLabel(it)
    }));
  }, [allSelectableItems]);

  // Vendor options
  const vendorOptions = useMemo(() => {
    return vendors.map(v => {
      const id = v._id || v.id;
      const name = v.name || v.vendorName || 'Vendor';
      const city = v.address?.city || v.city || '';
      return {
        value: id,
        label: city ? `${name} (${city})` : name
      };
    });
  }, [vendors]);

  // Process type options for SearchableSelect
  const processOptions = useMemo(() => {
    return COMMON_PROCESSES.map(p => ({
      value: p,
      label: p
    }));
  }, []);

  // Initialize or Reset
  useEffect(() => {
    if (initialData && isEditing) {
      setPoNumber(initialData.poNumber || '');
      setDate(initialData.date ? new Date(initialData.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
      setExpectedDeliveryDate(initialData.expectedDeliveryDate ? new Date(initialData.expectedDeliveryDate).toISOString().slice(0, 10) : '');
      const vId = initialData.vendor?._id || initialData.vendor || '';
      setSelectedVendorId(vId);
      const vObj = vendors.find(v => (v._id || v.id) === vId) || initialData.vendor;
      setSelectedVendorObj(vObj);
      setProcessType(initialData.processType || COMMON_PROCESSES[0]);
      setSacCode(initialData.sacCode || '9988');
      setGstType(initialData.gstType || 'intra_state');
      setTransportCharge(Number(initialData.transportCharge) || 0);
      setPackingCharge(Number(initialData.packingCharge) || 0);
      setRemarks(initialData.remarks || initialData.description || '');

      if (Array.isArray(initialData.items) && initialData.items.length > 0) {
        setItems(initialData.items.map((it: any, idx: number) => ({
          id: `jw-item-${idx}-${Date.now()}`,
          material: it.material?._id || it.material || undefined,
          materialName: it.materialName || it.material?.name || '',
          description: it.description || it.descriptions || it.material?.descriptions || '',
          processType: it.processType || initialData.processType || COMMON_PROCESSES[0],
          processNote: it.processNote || '',
          quantity: Number(it.quantity) || 1,
          unit: it.unit || 'PCS',
          rate: Number(it.rate) || 0,
          taxRate: Number(it.taxRate) || 18,
          amount: Number(it.amount) || ((Number(it.quantity) || 1) * (Number(it.rate) || 0))
        })));
      }
    } else {
      // Auto-generate PO number
      const now = new Date();
      const yr = now.getFullYear().toString().slice(-2);
      const mo = String(now.getMonth() + 1).padStart(2, '0');
      const rand = Math.floor(1000 + Math.random() * 9000);
      setPoNumber(`JW-PO-${yr}${mo}-${rand}`);
      setDate(new Date().toISOString().slice(0, 10));
      const exp = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
      setExpectedDeliveryDate(exp.toISOString().slice(0, 10));
      setSelectedVendorId('');
      setSelectedVendorObj(null);
      setProcessType(COMMON_PROCESSES[0]);
      setSacCode('9988');
      setGstType('intra_state');
      setTransportCharge(0);
      setPackingCharge(0);
      setRemarks('');
      setItems([
        {
          id: 'jw-item-1',
          materialName: '',
          description: '',
          processType: COMMON_PROCESSES[0],
          processNote: '',
          quantity: 1,
          unit: 'PCS',
          rate: 0,
          taxRate: 18,
          amount: 0
        }
      ]);
    }
    setErrorMessage('');
  }, [initialData, isEditing, isOpen, vendors]);

  // Update item line
  const handleUpdateItem = (index: number, field: keyof JobWorkLineItem, value: any) => {
    setItems(prev => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };

      if (field === 'quantity' || field === 'rate') {
        const qty = field === 'quantity' ? Number(value) || 0 : Number(item.quantity) || 0;
        const rate = field === 'rate' ? Number(value) || 0 : Number(item.rate) || 0;
        item.amount = Number((qty * rate).toFixed(2));
      }

      updated[index] = item;
      return updated;
    });
  };

  // Select Item from master
  const handleSelectItem = (index: number, itemId: string) => {
    const selected = allSelectableItems.find(it => (it._id || it.id) === itemId);
    if (!selected) return;

    const name = selected.name || selected.materialName || 'Item';
    const desc = getItemDescription(selected);
    const unit = selected.unit || 'PCS';

    setItems(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        material: selected._id || selected.id,
        materialName: name,
        description: desc,
        unit: unit
      };
      return updated;
    });
  };

  // Add Item Line
  const handleAddItem = () => {
    const finalProcess = processType || COMMON_PROCESSES[0];
    setItems(prev => [
      ...prev,
      {
        id: `jw-item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        materialName: '',
        description: '',
        processType: finalProcess,
        processNote: '',
        quantity: 1,
        unit: 'PCS',
        rate: 0,
        taxRate: 18,
        amount: 0
      }
    ]);
  };

  // Insert Item Line Below specific row
  const handleInsertItemBelow = (index: number) => {
    const finalProcess = processType || COMMON_PROCESSES[0];
    const newItem: JobWorkLineItem = {
      id: `jw-item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      materialName: '',
      description: '',
      processType: finalProcess,
      processNote: '',
      quantity: 1,
      unit: 'PCS',
      rate: 0,
      taxRate: 18,
      amount: 0
    };
    setItems(prev => {
      const copy = [...prev];
      copy.splice(index + 1, 0, newItem);
      return copy;
    });
  };

  // Bulk Apply Header Process to All Line Items
  const handleApplyProcessToAll = () => {
    const finalProcess = processType || COMMON_PROCESSES[0];
    if (!finalProcess) return;
    setItems(prev => prev.map(it => ({ ...it, processType: finalProcess })));
  };

  // Remove Item Line
  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  // Totals calculation
  const subtotal = useMemo(() => {
    return items.reduce((acc, it) => acc + (Number(it.amount) || 0), 0);
  }, [items]);

  const taxAmount = useMemo(() => {
    // 18% standard GST on Job Work (SAC 9988)
    const base = subtotal + transportCharge + packingCharge;
    return Number((base * 0.18).toFixed(2));
  }, [subtotal, transportCharge, packingCharge]);

  const cgstAmount = gstType === 'intra_state' ? Number((taxAmount / 2).toFixed(2)) : 0;
  const sgstAmount = gstType === 'intra_state' ? Number((taxAmount / 2).toFixed(2)) : 0;
  const igstAmount = gstType === 'inter_state' ? taxAmount : 0;

  const grandTotal = useMemo(() => {
    return Number((subtotal + transportCharge + packingCharge + taxAmount).toFixed(2));
  }, [subtotal, transportCharge, packingCharge, taxAmount]);

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!poNumber.trim()) {
      setErrorMessage('PO Number is required');
      return;
    }

    if (!selectedVendorId) {
      setErrorMessage('Please select a subcontractor / vendor');
      return;
    }

    const validItems = items.filter(it => it.materialName.trim() && it.quantity > 0);
    if (validItems.length === 0) {
      setErrorMessage('Please add at least one valid item with name and quantity');
      return;
    }

    const finalProcess = processType || COMMON_PROCESSES[0];

    const payload = {
      poNumber: poNumber.trim(),
      poType: 'jobwork',
      date: date || new Date(),
      expectedDeliveryDate: expectedDeliveryDate || undefined,
      vendor: selectedVendorId,
      vendorName: selectedVendorObj?.name || selectedVendorObj?.vendorName || '',
      processType: finalProcess,
      sacCode: sacCode || '9988',
      gstType,
      taxRate: 18,
      cgstRate: gstType === 'intra_state' ? 9 : 0,
      sgstRate: gstType === 'intra_state' ? 9 : 0,
      igstRate: gstType === 'inter_state' ? 18 : 0,
      cgstAmount,
      sgstAmount,
      igstAmount,
      transportType,
      transportCharge,
      packingType,
      packingCharge,
      subtotal,
      totalTax: taxAmount,
      grandTotal,
      remarks: remarks.trim(),
      items: validItems.map(it => ({
        material: it.material,
        materialName: it.materialName,
        description: it.description,
        processType: it.processType || finalProcess,
        processNote: it.processNote,
        quantity: it.quantity,
        unit: it.unit,
        rate: it.rate,
        amount: it.amount
      }))
    };

    setLoading(true);
    try {
      if (isEditing && initialData?._id) {
        await apiPut(`/api/purchase/po/${initialData._id}`, payload, token);
      } else {
        await apiPost('/api/purchase/po', payload, token);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save Job Work PO');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 lg:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-6xl xl:max-w-7xl 2xl:max-w-[1550px] max-h-[94vh] flex flex-col bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-indigo-50/70 to-blue-50/70 dark:from-slate-800/80 dark:to-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-500/25">
              <Wrench size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>{isEditing ? 'Edit Job Work Outward PO' : 'New Job Work Outward PO'}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                  SAC 9988
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Subcontracting & process work purchase order with technical specs
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-white dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Error Banner */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form Body (Scrollable) */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          
          {/* Top Section: PO Number, Date, Vendor & Process */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* PO Number */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                PO Number <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={poNumber}
                  onChange={e => setPoNumber(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
            </div>

            {/* PO Date */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                PO Date
              </label>
              <div className="relative">
                <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Expected Delivery Date */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Expected Delivery Date
              </label>
              <div className="relative">
                <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  value={expectedDeliveryDate}
                  onChange={e => setExpectedDeliveryDate(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Subcontractor / Vendor */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Job Worker / Vendor <span className="text-rose-500">*</span>
              </label>
              <SearchableSelect
                options={vendorOptions}
                value={selectedVendorId}
                onChange={val => {
                  setSelectedVendorId(val);
                  const found = vendors.find(v => (v._id || v.id) === val);
                  setSelectedVendorObj(found);
                }}
                placeholder="Select subcontractor..."
                className="text-xs"
              />
            </div>
          </div>

          {/* Process & Operation Row */}
          <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-slate-800/50 border border-indigo-100 dark:border-slate-700/60 space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <label className="block text-xs font-black text-indigo-950 dark:text-indigo-200">
                    Default Process / Operation Type
                  </label>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                    Auto-fills New Lines
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Select common process for newly added rows or click "Apply to All" below
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleApplyProcessToAll}
                  className="px-3 py-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 rounded-xl hover:bg-indigo-50 dark:hover:bg-slate-700 transition-all shadow-2xs active:scale-95 cursor-pointer"
                  title="Apply this process type to all item rows"
                >
                  ⚡ Apply to All Items
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">SAC Code:</span>
                  <input
                    type="text"
                    value={sacCode}
                    onChange={e => setSacCode(e.target.value)}
                    className="w-20 px-2 py-1 text-xs font-bold text-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* Searchable Dropdown for Default Process */}
            <div className="max-w-md">
              <SearchableSelect
                options={processOptions}
                value={processType}
                onChange={val => setProcessType(val)}
                allowCustom={true}
                customActionLabel={(q) => `Use "${q}" as process`}
                placeholder="Search or select default process type (e.g. CNC, Plating, Annealing)..."
                className="text-xs"
              />
            </div>
          </div>

          {/* Line Items Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Job Work Items & Rates ({items.length})
              </h3>
              <button
                type="button"
                onClick={handleAddItem}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 rounded-xl hover:bg-indigo-100 transition-colors cursor-pointer"
              >
                <Plus size={14} />
                <span>Add Item</span>
              </button>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3 w-8 text-center">#</th>
                    <th className="py-2.5 px-3 min-w-[220px]">Item Name & Technical Description</th>
                    <th className="py-2.5 px-3 min-w-[210px]">Process / Operation Type</th>
                    <th className="py-2.5 px-3 min-w-[140px]">Process Spec / Drawing No</th>
                    <th className="py-2.5 px-3 w-28">Quantity</th>
                    <th className="py-2.5 px-3 w-24">Unit</th>
                    <th className="py-2.5 px-3 w-28">Process Rate (₹)</th>
                    <th className="py-2.5 px-3 w-28 text-right">Amount (₹)</th>
                    <th className="py-2.5 px-2 w-16 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {items.map((item, index) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-2.5 px-3 text-center text-slate-400 font-bold">{index + 1}</td>
                      
                      {/* Item Selector & Name */}
                      <td className="py-2.5 px-3">
                        <div className="space-y-1">
                          <SearchableSelect
                            options={itemOptions}
                            value={item.material || ''}
                            onChange={val => handleSelectItem(index, val)}
                            placeholder="Select material / component..."
                            className="text-xs"
                          />
                          {item.materialName && (
                            <ItemNameAndDescription
                              name={item.materialName}
                              description={item.description}
                            />
                          )}
                        </div>
                      </td>

                      {/* Process / Operation Type (Searchable) */}
                      <td className="py-2.5 px-3 min-w-[210px]">
                        <SearchableSelect
                          options={processOptions}
                          value={item.processType || processType || COMMON_PROCESSES[0]}
                          onChange={val => handleUpdateItem(index, 'processType', val)}
                          allowCustom={true}
                          customActionLabel={(q) => `Use "${q}" as process`}
                          placeholder="Search or type process..."
                          className="text-xs"
                        />
                      </td>

                      {/* Process Note / Drawing No */}
                      <td className="py-2.5 px-3">
                        <input
                          type="text"
                          value={item.processNote}
                          onChange={e => handleUpdateItem(index, 'processNote', e.target.value)}
                          placeholder="e.g. DWG-042 / 55 HRC"
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        />
                      </td>

                      {/* Quantity */}
                      <td className="py-2.5 px-3">
                        <input
                          type="number"
                          min="0.001"
                          step="any"
                          value={item.quantity || ''}
                          onChange={e => handleUpdateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                          className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        />
                      </td>

                      {/* Unit */}
                      <td className="py-2.5 px-3">
                        <select
                          value={item.unit}
                          onChange={e => handleUpdateItem(index, 'unit', e.target.value)}
                          className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        >
                          <option value="PCS">PCS</option>
                          <option value="KG">KG</option>
                          <option value="SET">SET</option>
                          <option value="MTR">MTR</option>
                          <option value="NOS">NOS</option>
                          <option value="LOT">LOT</option>
                        </select>
                      </td>

                      {/* Rate */}
                      <td className="py-2.5 px-3">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={item.rate || ''}
                          onChange={e => handleUpdateItem(index, 'rate', parseFloat(e.target.value) || 0)}
                          className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        />
                      </td>

                      {/* Amount */}
                      <td className="py-2.5 px-3 text-right font-black text-slate-900 dark:text-white">
                        ₹{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>

                      {/* Actions: Add Line Below & Delete */}
                      <td className="py-2.5 px-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleInsertItemBelow(index)}
                            title="Add line below"
                            className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 rounded-lg transition-all active:scale-90 cursor-pointer"
                          >
                            <Plus size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            disabled={items.length <= 1}
                            title="Delete line"
                            className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-all active:scale-90 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottom Financial & Terms Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
            
            {/* Left: Remarks & Instructions */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Technical Instructions & Remarks
                </label>
                <textarea
                  rows={4}
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  placeholder="Material supplied on Returnable DC. Subcontractor must account for scrap, return all turnings and rejected parts. Tolerance ±0.02 mm."
                  className="w-full p-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* GST Type Selector */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">GST Classification:</span>
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="radio"
                    name="gstType"
                    checked={gstType === 'intra_state'}
                    onChange={() => setGstType('intra_state')}
                    className="text-indigo-600"
                  />
                  <span>Intra-State (CGST 9% + SGST 9%)</span>
                </label>
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="radio"
                    name="gstType"
                    checked={gstType === 'inter_state'}
                    onChange={() => setGstType('inter_state')}
                    className="text-indigo-600"
                  />
                  <span>Inter-State (IGST 18%)</span>
                </label>
              </div>
            </div>

            {/* Right: Summary Card */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2.5">
              <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                <span>Process Subtotal:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  ₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {/* Transport & Packing Charges */}
              <div className="flex justify-between items-center text-xs text-slate-600 dark:text-slate-400">
                <span>Transport Charges:</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={transportCharge || ''}
                  onChange={e => setTransportCharge(parseFloat(e.target.value) || 0)}
                  className="w-24 px-2 py-1 text-xs text-right font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div className="flex justify-between items-center text-xs text-slate-600 dark:text-slate-400">
                <span>Packaging Charges:</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={packingCharge || ''}
                  onChange={e => setPackingCharge(parseFloat(e.target.value) || 0)}
                  className="w-24 px-2 py-1 text-xs text-right font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              {/* GST Breakdown */}
              <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                <span>
                  {gstType === 'intra_state' ? 'GST (CGST 9% + SGST 9%):' : 'IGST (18%):'}
                </span>
                <span className="font-bold text-slate-900 dark:text-white">
                  ₹{taxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                <span className="text-sm font-black text-slate-900 dark:text-white">Grand Total:</span>
                <span className="text-base font-black text-indigo-600 dark:text-indigo-400">
                  ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Footer Submit */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-500/25 transition-all cursor-pointer flex items-center gap-2 active:scale-95"
            >
              {loading && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              <span>{isEditing ? 'Update Job Work PO' : 'Release Job Work PO'}</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}

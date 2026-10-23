"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Plus, Trash2, Truck, FileCheck2, Calculator, IndianRupee, 
  Calendar, Hash, User, AlertCircle, Percent, Clock, CheckCircle2,
  Layers, ArrowRight
} from 'lucide-react';
import SearchableSelect from '../SearchableSelect';
import { ItemNameAndDescription } from '@/src/utils/itemDisplayHelper';
import { API_BASE_URL } from '@/src/utils/config';
import { apiGet, apiPost } from '@/src/lib/api';

const COMMON_PROCESSES = [
  "CNC Turning & Milling",
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

interface JobWorkBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  vendors?: any[];
}

interface BillLineItem {
  id: string;
  name: string;
  description: string;
  processType?: string;
  sacCode: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
  taxRate: number;
  taxAmount: number;
}

export default function JobWorkBillModal({
  isOpen,
  onClose,
  onSuccess,
  vendors = []
}: JobWorkBillModalProps) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';

  // Linkage Mode: 'challan' (From Returnable Challan) | 'po' (From Job Work PO) | 'direct' (Direct Service Bill)
  const [linkMode, setLinkMode] = useState<'challan' | 'po' | 'direct'>('challan');

  // Common Bill States
  const [selectedVendorId, setSelectedVendorId] = useState<string>('');
  const [selectedVendorObj, setSelectedVendorObj] = useState<any>(null);
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState<string>('');
  const [billDate, setBillDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [paymentTerms, setPaymentTerms] = useState<string>('30 Days Net');
  const [creditDays, setCreditDays] = useState<number>(30);
  const [dueDate, setDueDate] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');

  // Linked Docs
  const [unbilledChallans, setUnbilledChallans] = useState<any[]>([]);
  const [selectedChallanId, setSelectedChallanId] = useState<string>('');
  const [selectedChallanDoc, setSelectedChallanDoc] = useState<any | null>(null);

  const [activePOs, setActivePOs] = useState<any[]>([]);
  const [selectedPOId, setSelectedPOId] = useState<string>('');
  const [selectedPODoc, setSelectedPODoc] = useState<any | null>(null);

  // Taxes & TDS
  const [gstRate, setGstRate] = useState<number>(18);
  const [tdsApplicable, setTdsApplicable] = useState<boolean>(true);
  const [tdsSection, setTdsSection] = useState<string>('194C');
  const [tdsRate, setTdsRate] = useState<number>(2); // 2% for companies, 1% for individuals

  // Default Process & SAC Code
  const [defaultProcessType, setDefaultProcessType] = useState<string>(COMMON_PROCESSES[0]);
  const [defaultSacCode, setDefaultSacCode] = useState<string>('9988');

  // Items
  const [items, setItems] = useState<BillLineItem[]>([
    {
      id: 'jw-bill-1',
      name: '',
      description: '',
      processType: COMMON_PROCESSES[0],
      sacCode: '9988',
      quantity: 1,
      unit: 'PCS',
      rate: 0,
      amount: 0,
      taxRate: 18,
      taxAmount: 0
    }
  ]);

  const [loadingDocs, setLoadingDocs] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Auto-calculate Due Date
  useEffect(() => {
    if (billDate) {
      const bDate = new Date(billDate);
      if (!isNaN(bDate.getTime())) {
        const calculated = new Date(bDate.getTime() + (Number(creditDays) || 0) * 24 * 60 * 60 * 1000);
        setDueDate(calculated.toISOString().slice(0, 10));
      }
    }
  }, [billDate, creditDays]);

  // Vendor options for SearchableSelect
  const vendorOptions = useMemo(() => {
    return vendors.map(v => {
      const id = v._id || v.id;
      const name = v.name || v.vendorName || 'Vendor';
      return {
        value: id,
        label: name
      };
    });
  }, [vendors]);

  // Process options for SearchableSelect
  const processOptions = useMemo(() => {
    return COMMON_PROCESSES.map(p => ({
      value: p,
      label: p
    }));
  }, []);

  // Fetch unbilled Challans and active Job Work POs when Vendor changes
  useEffect(() => {
    if (!token || !selectedVendorId) {
      setUnbilledChallans([]);
      setSelectedChallanId('');
      setSelectedChallanDoc(null);
      setActivePOs([]);
      setSelectedPOId('');
      setSelectedPODoc(null);
      return;
    }

    setLoadingDocs(true);

    // Fetch unbilled challans
    const fetchChallansPromise = apiGet(`/api/purchase/bill/unbilled-docs?vendorId=${selectedVendorId}`, token)
      .then(res => {
        const jwList = res?.data?.unbilledJobWorks || [];
        setUnbilledChallans(jwList);
      })
      .catch(err => {
        console.error("Failed to fetch unbilled challans:", err);
        setUnbilledChallans([]);
      });

    // Fetch active job work POs
    const fetchPOsPromise = apiGet(`/api/purchase/po?poType=jobwork`, token)
      .then(res => {
        const poList = res?.pos || res?.data || (Array.isArray(res) ? res : []);
        // Filter by selected vendor
        const vendorPOs = poList.filter((p: any) => {
          const pVid = p.vendor?._id || p.vendor;
          return pVid === selectedVendorId;
        });
        setActivePOs(vendorPOs);
      })
      .catch(err => {
        console.error("Failed to fetch active job work POs:", err);
        setActivePOs([]);
      });

    Promise.all([fetchChallansPromise, fetchPOsPromise]).finally(() => {
      setLoadingDocs(false);
    });
  }, [token, selectedVendorId]);

  // Handle Challan Selection
  const handleSelectChallan = (challanId: string) => {
    setSelectedChallanId(challanId);
    if (!challanId) {
      setSelectedChallanDoc(null);
      return;
    }

    const challan = unbilledChallans.find(c => c._id === challanId);
    if (!challan) return;
    setSelectedChallanDoc(challan);

    // Pre-fill bill items from challan
    const newItems: BillLineItem[] = [];
    if (Array.isArray(challan.items) && challan.items.length > 0) {
      challan.items.forEach((it: any, idx: number) => {
        const qty = Number(it.quantity || it.receivedQuantity || 1);
        const rate = Number(it.rate || it.jobWorkRate || 0);
        const amt = Number((qty * rate).toFixed(2));
        newItems.push({
          id: `challan-it-${idx}`,
          name: it.materialName || it.material?.name || 'Job Work Processing',
          description: it.description || it.descriptions || `Job Work Service against Challan ${challan.challanNumber}`,
          processType: it.processType || challan.processType || defaultProcessType || COMMON_PROCESSES[0],
          sacCode: it.sacCode || challan.sacCode || defaultSacCode || '9988',
          quantity: qty,
          unit: it.unit || 'PCS',
          rate: rate,
          amount: amt,
          taxRate: 18,
          taxAmount: Number((amt * 0.18).toFixed(2))
        });
      });
    }

    if (newItems.length > 0) {
      setItems(newItems);
    } else {
      // Fallback: Total job work charges from challan
      const totalCharge = Number(challan.totalJobWorkCharges || 0);
      setItems([
        {
          id: 'challan-total-1',
          name: `Job Work Processing Service (${challan.purpose || 'Job Work'})`,
          description: `Processing charges against Returnable Challan: ${challan.challanNumber}`,
          processType: challan.processType || defaultProcessType || COMMON_PROCESSES[0],
          sacCode: challan.sacCode || defaultSacCode || '9988',
          quantity: 1,
          unit: 'Job',
          rate: totalCharge,
          amount: totalCharge,
          taxRate: 18,
          taxAmount: Number((totalCharge * 0.18).toFixed(2))
        }
      ]);
    }
  };

  // Handle PO Selection
  const handleSelectPO = (poId: string) => {
    setSelectedPOId(poId);
    if (!poId) {
      setSelectedPODoc(null);
      return;
    }

    const po = activePOs.find(p => p._id === poId);
    if (!po) return;
    setSelectedPODoc(po);

    // Pre-fill items from PO
    const newItems: BillLineItem[] = [];
    if (Array.isArray(po.items) && po.items.length > 0) {
      po.items.forEach((it: any, idx: number) => {
        const qty = Number(it.quantity || 1);
        const rate = Number(it.rate || 0);
        const amt = Number((qty * rate).toFixed(2));
        newItems.push({
          id: `po-it-${idx}`,
          name: it.materialName || it.material?.name || po.processType || 'Job Work Process',
          description: it.description || it.processNote || `Job Work Operation (${po.processType || 'SAC 9988'})`,
          processType: it.processType || po.processType || defaultProcessType || COMMON_PROCESSES[0],
          sacCode: po.sacCode || it.sacCode || defaultSacCode || '9988',
          quantity: qty,
          unit: it.unit || 'PCS',
          rate: rate,
          amount: amt,
          taxRate: 18,
          taxAmount: Number((amt * 0.18).toFixed(2))
        });
      });
    }

    if (newItems.length > 0) {
      setItems(newItems);
    }
  };

  // Update item
  const handleUpdateItem = (index: number, field: keyof BillLineItem, value: any) => {
    setItems(prev => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };

      if (field === 'quantity' || field === 'rate') {
        const qty = field === 'quantity' ? Number(value) || 0 : Number(item.quantity) || 0;
        const rate = field === 'rate' ? Number(value) || 0 : Number(item.rate) || 0;
        item.amount = Number((qty * rate).toFixed(2));
        item.taxAmount = Number((item.amount * ((item.taxRate || 18) / 100)).toFixed(2));
      }

      updated[index] = item;
      return updated;
    });
  };

  // Add Item
  const handleAddItem = () => {
    setItems(prev => [
      ...prev,
      {
        id: `jw-bill-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: '',
        description: '',
        processType: defaultProcessType || COMMON_PROCESSES[0],
        sacCode: defaultSacCode || '9988',
        quantity: 1,
        unit: 'PCS',
        rate: 0,
        amount: 0,
        taxRate: gstRate,
        taxAmount: 0
      }
    ]);
  };

  // Insert Item Below specific row
  const handleInsertItemBelow = (index: number) => {
    const newItem: BillLineItem = {
      id: `jw-bill-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: '',
      description: '',
      processType: defaultProcessType || COMMON_PROCESSES[0],
      sacCode: defaultSacCode || '9988',
      quantity: 1,
      unit: 'PCS',
      rate: 0,
      amount: 0,
      taxRate: gstRate,
      taxAmount: 0
    };
    setItems(prev => {
      const copy = [...prev];
      copy.splice(index + 1, 0, newItem);
      return copy;
    });
  };

  // Apply default process to all items
  const handleApplyProcessToAll = () => {
    if (!defaultProcessType) return;
    setItems(prev => prev.map(it => ({
      ...it,
      processType: defaultProcessType,
      sacCode: it.sacCode || defaultSacCode || '9988'
    })));
  };

  // Remove Item
  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  // Calculations
  const subtotal = useMemo(() => {
    return items.reduce((acc, it) => acc + (Number(it.amount) || 0), 0);
  }, [items]);

  const totalTax = useMemo(() => {
    return Number((subtotal * (gstRate / 100)).toFixed(2));
  }, [subtotal, gstRate]);

  const grandTotal = useMemo(() => {
    return Number((subtotal + totalTax).toFixed(2));
  }, [subtotal, totalTax]);

  const tdsAmount = useMemo(() => {
    if (!tdsApplicable) return 0;
    // TDS u/s 194C is calculated on the taxable subtotal (excluding GST)
    return Number((subtotal * (tdsRate / 100)).toFixed(2));
  }, [subtotal, tdsApplicable, tdsRate]);

  const netPayableAmount = useMemo(() => {
    return Number((grandTotal - tdsAmount).toFixed(2));
  }, [grandTotal, tdsAmount]);

  // Submit Bill
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!selectedVendorId) {
      setErrorMsg('Please select a subcontractor / vendor');
      return;
    }

    if (!supplierInvoiceNumber.trim()) {
      setErrorMsg('Please enter the Subcontractor Invoice / Bill Number');
      return;
    }

    const validItems = items.filter(it => it.name.trim() && it.quantity > 0);
    if (validItems.length === 0) {
      setErrorMsg('Please add at least one valid job work line item');
      return;
    }

    const payload: any = {
      billType: 'job-work-service',
      serviceCategory: 'Subcontract Job Work',
      supplierInvoiceNumber: supplierInvoiceNumber.trim(),
      date: billDate,
      vendor: selectedVendorId,
      vendorName: selectedVendorObj?.name || selectedVendorObj?.vendorName || '',
      sacCode: defaultSacCode || '9988',
      items: validItems.map(it => ({
        materialName: it.name,
        serviceName: it.name,
        description: it.description,
        processType: it.processType || defaultProcessType || COMMON_PROCESSES[0],
        sacCode: it.sacCode || defaultSacCode || '9988',
        quantity: it.quantity,
        unit: it.unit,
        rate: it.rate,
        amount: it.amount,
        taxRate: gstRate,
        taxAmount: Number((it.amount * (gstRate / 100)).toFixed(2))
      })),
      subtotal,
      taxRate: gstRate,
      taxAmount: totalTax,
      totalTax,
      grandTotal,
      tdsApplicable,
      tdsSection: tdsApplicable ? tdsSection : '',
      tdsRate: tdsApplicable ? tdsRate : 0,
      tdsAmount: tdsApplicable ? tdsAmount : 0,
      netPayableAmount,
      paymentTerms,
      creditDays,
      dueDate,
      remarks: remarks.trim()
    };

    if (linkMode === 'challan' && selectedChallanDoc) {
      payload.jobWorkChallan = selectedChallanDoc._id;
      payload.jobWorkChallanNumber = selectedChallanDoc.challanNumber;
    } else if (linkMode === 'po' && selectedPODoc) {
      payload.poReference = selectedPODoc._id;
      payload.poNumber = selectedPODoc.poNumber;
    }

    setSubmitting(true);
    try {
      await apiPost('/api/purchase/bill', payload, token);
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to record Job Work Bill');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-6xl xl:max-w-7xl 2xl:max-w-[1550px] max-h-[94vh] flex flex-col bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-emerald-50/70 to-teal-50/70 dark:from-slate-800/80 dark:to-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-500/25">
              <IndianRupee size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>Record Job Work Service Bill</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  Dual Linkage & TDS 194C
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Invoice against returned Challans, Job Work Outward POs, or direct subcontract services
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

        {/* Error Alert */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          
          {/* Linkage Mode Switcher Tabs */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl gap-1">
            <button
              type="button"
              onClick={() => {
                setLinkMode('challan');
                if (selectedPODoc) setSelectedPODoc(null);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                linkMode === 'challan'
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-300 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Truck size={14} />
              <span>Link Returnable Challan</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setLinkMode('po');
                if (selectedChallanDoc) setSelectedChallanDoc(null);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                linkMode === 'po'
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-300 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FileCheck2 size={14} />
              <span>Link Job Work PO</span>
            </button>

            <button
              type="button"
              onClick={() => setLinkMode('direct')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                linkMode === 'direct'
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-300 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <IndianRupee size={14} />
              <span>Direct Process Invoice</span>
            </button>
          </div>

          {/* Top Form Grid: Vendor, Invoice Number, Bill Date, Linked Doc */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Vendor Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Subcontractor / Vendor <span className="text-rose-500">*</span>
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

            {/* Supplier Invoice Number */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Vendor Bill / Invoice # <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={supplierInvoiceNumber}
                  onChange={e => setSupplierInvoiceNumber(e.target.value)}
                  placeholder="e.g. INV-2026-904"
                  className="w-full pl-8 pr-3 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>
            </div>

            {/* Bill Date */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Invoice Date
              </label>
              <div className="relative">
                <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  value={billDate}
                  onChange={e => setBillDate(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Linked Document Selector */}
            <div>
              {linkMode === 'challan' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Select Unbilled Challan
                  </label>
                  <select
                    value={selectedChallanId}
                    onChange={e => handleSelectChallan(e.target.value)}
                    disabled={loadingDocs || unbilledChallans.length === 0}
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white disabled:opacity-50"
                  >
                    <option value="">
                      {loadingDocs ? 'Loading challans...' : unbilledChallans.length === 0 ? 'No unbilled challans' : '-- Select Challan --'}
                    </option>
                    {unbilledChallans.map(c => (
                      <option key={c._id} value={c._id}>
                        {c.challanNumber} ({c.purpose || 'Job Work'})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {linkMode === 'po' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Select Job Work PO
                  </label>
                  <select
                    value={selectedPOId}
                    onChange={e => handleSelectPO(e.target.value)}
                    disabled={loadingDocs || activePOs.length === 0}
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white disabled:opacity-50"
                  >
                    <option value="">
                      {loadingDocs ? 'Loading POs...' : activePOs.length === 0 ? 'No active job work POs' : '-- Select Job Work PO --'}
                    </option>
                    {activePOs.map(p => (
                      <option key={p._id} value={p._id}>
                        {p.poNumber} - {p.processType || 'Process'}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {linkMode === 'direct' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Process Category
                  </label>
                  <div className="px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    Subcontract Job Work (SAC 9988)
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Default Process / Operation Type Header Bar */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-50/80 via-teal-50/50 to-indigo-50/60 dark:from-slate-800/90 dark:to-slate-800/50 border border-emerald-200/70 dark:border-slate-700 shadow-2xs space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <label className="block text-xs font-black text-emerald-950 dark:text-emerald-200">
                    Default Process / Operation Type
                  </label>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    Auto-fills New Lines
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Select default job work operation or click "Apply to All" below
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleApplyProcessToAll}
                  className="px-3 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-800 rounded-xl hover:bg-emerald-50 dark:hover:bg-slate-700 transition-all shadow-2xs active:scale-95 cursor-pointer"
                  title="Apply this process type to all bill line items"
                >
                  ⚡ Apply to All Items
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">SAC Code:</span>
                  <input
                    type="text"
                    value={defaultSacCode}
                    onChange={e => setDefaultSacCode(e.target.value)}
                    className="w-20 px-2 py-1 text-xs font-bold text-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* Searchable Dropdown for Default Process */}
            <div className="max-w-md">
              <SearchableSelect
                options={processOptions}
                value={defaultProcessType}
                onChange={val => setDefaultProcessType(val)}
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
                Service Line Items ({items.length})
              </h3>
              <button
                type="button"
                onClick={handleAddItem}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 rounded-xl hover:bg-emerald-100 transition-colors cursor-pointer"
              >
                <Plus size={14} />
                <span>Add Service Item</span>
              </button>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3 w-8 text-center">#</th>
                    <th className="py-2.5 px-3 min-w-[220px]">Service Item & Description</th>
                    <th className="py-2.5 px-3 min-w-[200px]">Process / Operation Type</th>
                    <th className="py-2.5 px-3 w-20 text-center">SAC</th>
                    <th className="py-2.5 px-3 w-24">Quantity</th>
                    <th className="py-2.5 px-3 w-20">Unit</th>
                    <th className="py-2.5 px-3 w-28">Process Rate (₹)</th>
                    <th className="py-2.5 px-3 w-28 text-right">Amount (₹)</th>
                    <th className="py-2.5 px-2 w-16 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {items.map((item, index) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-2.5 px-3 text-center text-slate-400 font-bold">{index + 1}</td>
                      
                      {/* Name & Description */}
                      <td className="py-2.5 px-3">
                        <div className="space-y-1">
                          <input
                            type="text"
                            value={item.name}
                            onChange={e => handleUpdateItem(index, 'name', e.target.value)}
                            placeholder="e.g. CNC Turning & Milling Charges"
                            className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                          />
                          <input
                            type="text"
                            value={item.description}
                            onChange={e => handleUpdateItem(index, 'description', e.target.value)}
                            placeholder="Technical description / drawing ref..."
                            className="w-full px-2.5 py-1 text-[11px] text-slate-500 rounded-lg border border-slate-100 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800"
                          />
                        </div>
                      </td>

                      {/* Process / Operation Type (Searchable) */}
                      <td className="py-2.5 px-3 min-w-[200px]">
                        <SearchableSelect
                          options={processOptions}
                          value={item.processType || defaultProcessType || COMMON_PROCESSES[0]}
                          onChange={val => handleUpdateItem(index, 'processType', val)}
                          allowCustom={true}
                          customActionLabel={(q) => `Use "${q}" as process`}
                          placeholder="Search or type process..."
                          className="text-xs"
                        />
                      </td>

                      {/* SAC */}
                      <td className="py-2.5 px-3">
                        <input
                          type="text"
                          value={item.sacCode}
                          onChange={e => handleUpdateItem(index, 'sacCode', e.target.value)}
                          className="w-full px-2 py-1.5 text-xs text-center font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
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
                          <option value="JOB">JOB</option>
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
                            className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 rounded-lg transition-all active:scale-90 cursor-pointer"
                          >
                            <Plus size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            disabled={items.length <= 1}
                            title="Delete line item"
                            className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
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

          {/* Bottom Grid: TDS u/s 194C, Payment Terms, and Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
            
            {/* Left Column: TDS 194C & Payment Terms */}
            <div className="space-y-4">
              
              {/* TDS Section 194C Card */}
              <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={tdsApplicable}
                      onChange={e => setTdsApplicable(e.target.checked)}
                      className="w-4 h-4 text-amber-600 rounded"
                    />
                    <span className="text-xs font-black text-amber-950 dark:text-amber-200">
                      Deduct TDS u/s 194C (Subcontract Work)
                    </span>
                  </label>
                  <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/60 px-2 py-0.5 rounded-full">
                    Sec 194C
                  </span>
                </div>

                {tdsApplicable && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <span className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Subcontractor Type:
                      </span>
                      <select
                        value={tdsRate}
                        onChange={e => setTdsRate(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-amber-200 dark:border-amber-900 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      >
                        <option value={2}>Company / Firm (2%)</option>
                        <option value={1}>Individual / HUF (1%)</option>
                      </select>
                    </div>

                    <div>
                      <span className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        TDS Amount:
                      </span>
                      <div className="px-2.5 py-1.5 text-xs font-black text-rose-600 dark:text-rose-400 bg-white dark:bg-slate-800 rounded-lg border border-amber-200 dark:border-amber-900">
                        - ₹{tdsAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Payment Terms & Credit Days */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Payment Terms
                  </label>
                  <select
                    value={paymentTerms}
                    onChange={e => setPaymentTerms(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="Immediate">Immediate</option>
                    <option value="15 Days Net">15 Days Net</option>
                    <option value="30 Days Net">30 Days Net</option>
                    <option value="45 Days Net">45 Days Net</option>
                    <option value="60 Days Net">60 Days Net</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Bill Remarks
                </label>
                <textarea
                  rows={2}
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  placeholder="Service verified, accepted in QA/QC."
                  className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

            </div>

            {/* Right Column: Financial Summary Card */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2.5 flex flex-col justify-between">
              <div className="space-y-2.5">
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                  <span>Job Work Subtotal:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    ₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs text-slate-600 dark:text-slate-400">
                  <span>GST Rate (SAC 9988):</span>
                  <select
                    value={gstRate}
                    onChange={e => setGstRate(Number(e.target.value))}
                    className="px-2 py-1 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  >
                    <option value={18}>18% (Standard)</option>
                    <option value={12}>12%</option>
                    <option value={5}>5%</option>
                    <option value={0}>0% (Exempt)</option>
                  </select>
                </div>

                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                  <span>Total GST ({gstRate}%):</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    ₹{totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex justify-between text-xs font-bold text-slate-800 dark:text-slate-200 pt-1 border-t border-slate-200 dark:border-slate-700">
                  <span>Gross Invoice Total:</span>
                  <span>₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>

                {tdsApplicable && (
                  <div className="flex justify-between text-xs text-rose-600 dark:text-rose-400 font-bold">
                    <span>Less: TDS u/s 194C ({tdsRate}%):</span>
                    <span>- ₹{tdsAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t-2 border-slate-200 dark:border-slate-700 flex justify-between items-center">
                <span className="text-sm font-black text-slate-900 dark:text-white">Net Payable Amount:</span>
                <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                  ₹{netPayableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

          </div>

          {/* Submit Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md shadow-emerald-500/25 transition-all cursor-pointer flex items-center gap-2 active:scale-95"
            >
              {submitting && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              <span>Save & Record Job Work Bill</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}

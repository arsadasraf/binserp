import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  Layers, 
  FileText, 
  IndianRupee, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  Wrench, 
  RefreshCw,
  Percent,
  Clock,
  Briefcase
} from 'lucide-react';
import SearchableSelect from '../SearchableSelect';
import { formatItemSelectLabel, getItemDescription, ItemNameAndDescription } from '@/src/utils/itemDisplayHelper';
import { API_BASE_URL } from '@/src/utils/config';

interface CreateServiceBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  vendors?: any[];
}

interface ServiceLineItem {
  id: string;
  name: string;
  description: string;
  sacCode?: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
  taxRate: number;
  taxAmount: number;
  processType?: string;
}

const SERVICE_CATEGORIES = [
  "Subcontract Job Work",
  "Freight & Logistics",
  "Machinery Repair & Maintenance",
  "Electricity & Utilities",
  "QC Calibration & Testing",
  "Tooling & Die Maintenance",
  "Consulting & Professional Services",
  "Security & Housekeeping",
  "IT & Software Subscription",
  "General Service & Miscellaneous"
];

const PAYMENT_TERMS_OPTIONS = [
  "Immediate",
  "Advance",
  "15 Days Net",
  "30 Days Net",
  "45 Days Net",
  "60 Days Net",
  "Against Delivery"
];

const UNIT_OPTIONS = ["Nos", "Hours", "Trips", "Days", "Months", "Kg", "Set", "Lot / Job"];

export default function CreateServiceBillModal({
  isOpen,
  onClose,
  onSuccess,
  vendors = []
}: CreateServiceBillModalProps) {
  const [activeTab, setActiveTab] = useState<'jobwork' | 'other'>('jobwork');
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';

  // Common Form States
  const [selectedVendorId, setSelectedVendorId] = useState<string>('');
  const [customVendorName, setCustomVendorName] = useState<string>('');
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState<string>('');
  const [invoiceDate, setInvoiceDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [paymentTerms, setPaymentTerms] = useState<string>('30 Days Net');
  const [creditDays, setCreditDays] = useState<number>(30);
  const [dueDate, setDueDate] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');

  // Tax & TDS States
  const [globalTaxRate, setGlobalTaxRate] = useState<number>(18);
  const [tdsApplicable, setTdsApplicable] = useState<boolean>(false);
  const [tdsSection, setTdsSection] = useState<string>('194C');
  const [tdsRate, setTdsRate] = useState<number>(2);

  // Tab 1: Job Work Specific States
  const [unbilledChallans, setUnbilledChallans] = useState<any[]>([]);
  const [loadingChallans, setLoadingChallans] = useState<boolean>(false);
  const [selectedChallanId, setSelectedChallanId] = useState<string>('');
  const [selectedChallanDoc, setSelectedChallanDoc] = useState<any | null>(null);
  const [jobWorkItems, setJobWorkItems] = useState<ServiceLineItem[]>([]);

  // Tab 2: Other Service Specific States
  const [serviceCategory, setServiceCategory] = useState<string>('Freight & Logistics');
  const [otherServiceItems, setOtherServiceItems] = useState<ServiceLineItem[]>([
    {
      id: 'item-1',
      name: '',
      description: '',
      sacCode: '9965',
      quantity: 1,
      unit: 'Trip',
      rate: 0,
      amount: 0,
      taxRate: 18,
      taxAmount: 0
    }
  ]);

  // Loading & Submission States
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Calculate Due Date based on Invoice Date & Credit Days
  useEffect(() => {
    if (invoiceDate) {
      const invDate = new Date(invoiceDate);
      if (!isNaN(invDate.getTime())) {
        const calculated = new Date(invDate.getTime() + (Number(creditDays) || 0) * 24 * 60 * 60 * 1000);
        setDueDate(calculated.toISOString().slice(0, 10));
      }
    }
  }, [invoiceDate, creditDays]);

  // Vendor options for SearchableSelect
  const vendorOptions = useMemo(() => {
    const list = [{ value: '', label: '-- Select Vendor / Subcontractor --' }];
    vendors.forEach((v: any) => {
      const id = v._id || v.id;
      if (!id) return;
      const name = v.name || v.vendorName || 'Unknown Vendor';
      const type = v.vendorType ? ` (${v.vendorType})` : '';
      list.push({
        value: id,
        label: `${name}${type}`
      });
    });
    return list;
  }, [vendors]);

  // Fetch Unbilled Job Work Challans when Vendor changes in Job Work Tab
  useEffect(() => {
    if (!token || !selectedVendorId || activeTab !== 'jobwork') {
      setUnbilledChallans([]);
      setSelectedChallanId('');
      setSelectedChallanDoc(null);
      setJobWorkItems([]);
      return;
    }

    setLoadingChallans(true);
    fetch(`${API_BASE_URL}/api/purchase/bill/unbilled-docs?vendorId=${selectedVendorId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(json => {
        const jwList = json?.data?.unbilledJobWorks || [];
        setUnbilledChallans(jwList);
      })
      .catch(err => {
        console.error("Failed to fetch unbilled job work challans:", err);
        setUnbilledChallans([]);
      })
      .finally(() => {
        setLoadingChallans(false);
      });
  }, [token, selectedVendorId, activeTab]);

  // Handle Job Work Challan Selection
  const handleSelectChallan = (challanId: string) => {
    setSelectedChallanId(challanId);
    if (!challanId) {
      setSelectedChallanDoc(null);
      setJobWorkItems([]);
      return;
    }

    const challan = unbilledChallans.find((c: any) => String(c._id) === String(challanId));
    if (!challan) return;
    setSelectedChallanDoc(challan);

    // Populate service line items from receiveHistory or items/assemblyGroups
    const lineItems: ServiceLineItem[] = [];

    if (Array.isArray(challan.receiveHistory) && challan.receiveHistory.length > 0) {
      challan.receiveHistory.forEach((rec: any, idx: number) => {
        const qty = Number(rec.acceptedQuantity || rec.quantity || 0);
        const rate = Number(rec.rate || 0);
        const amt = Number(rec.amount || (qty * rate).toFixed(2));
        const taxAmt = Number(((amt * globalTaxRate) / 100).toFixed(2));

        lineItems.push({
          id: `rec-${idx}-${Date.now()}`,
          name: rec.itemName || "Returned Subcontract Component",
          description: rec.rejectionReason || rec.batchNumber ? `Batch: ${rec.batchNumber || '-'} | GRN: ${rec.grnNumber || '-'}` : "Processed Job Work Component",
          sacCode: "9988",
          quantity: qty,
          unit: "PCS",
          rate: rate,
          amount: amt,
          taxRate: globalTaxRate,
          taxAmount: taxAmt,
          processType: "Machining & Subcontracting"
        });
      });
    }

    // Fallback to challan items if no inward receive history recorded yet
    if (lineItems.length === 0 && Array.isArray(challan.items)) {
      challan.items.forEach((it: any, idx: number) => {
        const qty = Number(it.quantityReceived || it.quantitySent || 0);
        const rate = Number(it.processRate || 0);
        const amt = Number(it.processAmount || (qty * rate).toFixed(2));
        const taxAmt = Number(((amt * globalTaxRate) / 100).toFixed(2));

        lineItems.push({
          id: `item-${idx}-${Date.now()}`,
          name: it.itemName || "Job Work Service",
          description: getItemDescription(it) || it.purpose || `Process: ${it.processType || 'Machining'}`,
          sacCode: "9988",
          quantity: qty,
          unit: it.unit || "PCS",
          rate: rate,
          amount: amt,
          taxRate: globalTaxRate,
          taxAmount: taxAmt,
          processType: it.processType || "Machining"
        });
      });
    }

    setJobWorkItems(lineItems);
  };

  // Add Item in Other Services
  const handleAddOtherServiceItem = () => {
    setOtherServiceItems(prev => [
      ...prev,
      {
        id: `item-${Date.now()}`,
        name: '',
        description: '',
        sacCode: serviceCategory === 'Freight & Logistics' ? '9965' : '9987',
        quantity: 1,
        unit: 'Nos',
        rate: 0,
        amount: 0,
        taxRate: globalTaxRate,
        taxAmount: 0
      }
    ]);
  };

  // Remove Item
  const handleRemoveItem = (id: string, isJobWork: boolean) => {
    if (isJobWork) {
      setJobWorkItems(prev => prev.filter(it => it.id !== id));
    } else {
      setOtherServiceItems(prev => prev.filter(it => it.id !== id));
    }
  };

  // Update Item field
  const handleUpdateItem = (
    id: string, 
    field: keyof ServiceLineItem, 
    value: any, 
    isJobWork: boolean
  ) => {
    const updateList = (list: ServiceLineItem[]) =>
      list.map(it => {
        if (it.id !== id) return it;
        const updated = { ...it, [field]: value };

        if (field === 'quantity' || field === 'rate' || field === 'taxRate') {
          const q = Number(field === 'quantity' ? value : updated.quantity) || 0;
          const r = Number(field === 'rate' ? value : updated.rate) || 0;
          const amt = Number((q * r).toFixed(2));
          const tRate = Number(field === 'taxRate' ? value : updated.taxRate) || 0;
          const tAmt = Number(((amt * tRate) / 100).toFixed(2));
          updated.amount = amt;
          updated.taxAmount = tAmt;
        }

        return updated;
      });

    if (isJobWork) {
      setJobWorkItems(updateList);
    } else {
      setOtherServiceItems(updateList);
    }
  };

  // Active items based on current tab
  const currentItems = activeTab === 'jobwork' ? jobWorkItems : otherServiceItems;

  // Financial Computations
  const subtotal = useMemo(() => {
    return currentItems.reduce((acc, it) => acc + (Number(it.amount) || 0), 0);
  }, [currentItems]);

  const totalTax = useMemo(() => {
    return currentItems.reduce((acc, it) => acc + (Number(it.taxAmount) || 0), 0);
  }, [currentItems]);

  const grandTotal = useMemo(() => {
    return Number((subtotal + totalTax).toFixed(2));
  }, [subtotal, totalTax]);

  const computedTdsAmount = useMemo(() => {
    if (!tdsApplicable) return 0;
    return Number(((subtotal * (Number(tdsRate) || 0)) / 100).toFixed(2));
  }, [subtotal, tdsApplicable, tdsRate]);

  const netPayable = useMemo(() => {
    return Math.max(0, Number((grandTotal - computedTdsAmount).toFixed(2)));
  }, [grandTotal, computedTdsAmount]);

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    // Validation
    const effectiveVendorId = selectedVendorId;
    const selectedVendorObj = vendors.find((v: any) => String(v._id || v.id) === String(selectedVendorId));
    const effectiveVendorName = selectedVendorObj?.name || selectedVendorObj?.vendorName || customVendorName.trim();

    if (!effectiveVendorName) {
      setErrorMsg('Please select or specify a Supplier / Service Provider.');
      return;
    }

    if (!supplierInvoiceNumber.trim()) {
      setErrorMsg('Please enter the Supplier / Subcontractor Invoice Number.');
      return;
    }

    if (currentItems.length === 0) {
      setErrorMsg('Please add at least one bill item / process charge.');
      return;
    }

    const invalidItem = currentItems.find(it => !it.name.trim() || it.amount <= 0);
    if (invalidItem) {
      setErrorMsg('All items must have a valid Name, Quantity, and Rate greater than 0.');
      return;
    }

    setSubmitting(true);

    try {
      const payload: any = {
        supplierInvoiceNumber: supplierInvoiceNumber.trim(),
        date: invoiceDate ? new Date(invoiceDate) : new Date(),
        vendorName: effectiveVendorName,
        vendor: effectiveVendorId || undefined,
        billType: activeTab === 'jobwork' ? 'job-work-service' : 'other-service',
        serviceCategory: activeTab === 'jobwork' ? 'Subcontract Job Work' : serviceCategory,
        sacCode: currentItems[0]?.sacCode || '9988',
        jobWorkChallan: selectedChallanDoc?._id || undefined,
        jobWorkChallanNumber: selectedChallanDoc?.challanNumber || undefined,
        jobWorkGrnNumber: selectedChallanDoc?.receiveHistory?.[0]?.grnNumber || '',
        items: currentItems.map(it => ({
          materialName: it.name,
          serviceName: it.name,
          description: it.description || '',
          sacCode: it.sacCode || '',
          hsnCode: it.sacCode || '',
          quantity: it.quantity,
          unit: it.unit || 'PCS',
          rate: it.rate,
          amount: it.amount,
          taxRate: it.taxRate,
          taxAmount: it.taxAmount
        })),
        subtotal: subtotal,
        taxRate: globalTaxRate,
        taxAmount: totalTax,
        totalTax: totalTax,
        grandTotal: grandTotal,
        tdsApplicable: tdsApplicable,
        tdsSection: tdsApplicable ? tdsSection : '',
        tdsRate: tdsApplicable ? tdsRate : 0,
        tdsAmount: computedTdsAmount,
        netPayableAmount: netPayable,
        paymentTerms: paymentTerms,
        creditDays: creditDays,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        remarks: remarks.trim()
      };

      const res = await fetch(`${API_BASE_URL}/api/purchase/bill`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const json = await res.json();

      if (res.ok) {
        onSuccess();
        onClose();
      } else {
        setErrorMsg(json.message || 'Failed to create Service Bill.');
      }
    } catch (err: any) {
      console.error('Error creating service bill:', err);
      setErrorMsg(err.message || 'Error communicating with server.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400">
              <Briefcase size={20} />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-slate-100">
                Create Purchase Service Bill
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Record subcontractor Returnable Job Work Invoices & general service expense bills
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 pt-3 pb-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('jobwork')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'jobwork'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            <Wrench size={14} />
            <span>⚙️ Returnable Job Work Invoice</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('other')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'other'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            <FileText size={14} />
            <span>🛠️ Other Service Bill</span>
          </button>
        </div>

        {/* Body Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
          {errorMsg && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Section 1: Vendor & Document Reference */}
          <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3.5">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
              1. Supplier & Invoice Information
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Vendor Selector */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Subcontractor / Supplier <span className="text-rose-500">*</span>
                </label>
                <SearchableSelect
                  options={vendorOptions}
                  value={selectedVendorId}
                  onChange={(val) => setSelectedVendorId(val)}
                  placeholder="Select Vendor"
                  className="w-full text-xs"
                  innerClassName="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              {/* Supplier Invoice Number */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Supplier Tax Invoice # <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={supplierInvoiceNumber}
                  onChange={(e) => setSupplierInvoiceNumber(e.target.value)}
                  placeholder="e.g. INV-2026-901"
                  required
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 font-mono outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Invoice Date */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Invoice Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Job Work Specific Challan Selector */}
            {activeTab === 'jobwork' && (
              <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Select Returnable Job Work Challan (DC) <span className="text-rose-500">*</span>
                </label>
                {loadingChallans ? (
                  <div className="text-xs text-slate-400 py-1.5 flex items-center gap-1.5">
                    <RefreshCw size={13} className="animate-spin text-indigo-500" />
                    <span>Loading unbilled Job Work Challans...</span>
                  </div>
                ) : unbilledChallans.length === 0 ? (
                  <div className="text-xs text-amber-600 dark:text-amber-400 py-1 font-medium">
                    {selectedVendorId ? "No unbilled Job Work Challans found for this subcontractor." : "Please select a subcontractor above to view unbilled Challans."}
                  </div>
                ) : (
                  <select
                    value={selectedChallanId}
                    onChange={(e) => handleSelectChallan(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- Choose Challan / Returnable DC --</option>
                    {unbilledChallans.map((c: any) => (
                      <option key={c._id} value={c._id}>
                        {c.challanNumber} | {new Date(c.date).toLocaleDateString()} | Type: {c.jobWorkType || 'Conversion'} | {c.items?.length || 0} item(s)
                      </option>
                    ))}
                  </select>
                )}

                {selectedChallanDoc && (
                  <div className="mt-2 p-2.5 bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 rounded-lg text-xs text-indigo-700 dark:text-indigo-300 flex items-center justify-between">
                    <span>
                      Linked Challan: <strong>{selectedChallanDoc.challanNumber}</strong> ({selectedChallanDoc.receiveHistory?.length || 0} inward receipt records found)
                    </span>
                    <span className="font-mono text-[11px] font-bold">
                      Charges: ₹{Number(selectedChallanDoc.totalJobWorkCharges || 0).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Other Services: Service Category Selector */}
            {activeTab === 'other' && (
              <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Service Expense Category
                  </label>
                  <select
                    value={serviceCategory}
                    onChange={(e) => setServiceCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none"
                  >
                    {SERVICE_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    GST Rate Applicable (%)
                  </label>
                  <select
                    value={globalTaxRate}
                    onChange={(e) => setGlobalTaxRate(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none"
                  >
                    <option value={0}>0% (Exempt)</option>
                    <option value={5}>5% GST</option>
                    <option value={12}>12% GST</option>
                    <option value={18}>18% GST (Standard Services)</option>
                    <option value={28}>28% GST</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Line Items & Process Rates (Strict AGENTS.md compliance: Name & Description) */}
          <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                2. Service Line Items & Process Charges ({currentItems.length})
              </div>
              {activeTab === 'other' && (
                <button
                  type="button"
                  onClick={handleAddOtherServiceItem}
                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Plus size={13} />
                  <span>Add Line Item</span>
                </button>
              )}
            </div>

            <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-700">
                    <th className="py-2.5 px-3 w-8 text-center">#</th>
                    <th className="py-2.5 px-3 min-w-[220px]">Service / Component Name & Description</th>
                    <th className="py-2.5 px-2.5 w-24 text-center">SAC Code</th>
                    <th className="py-2.5 px-2.5 w-24 text-center">Qty</th>
                    <th className="py-2.5 px-2.5 w-24 text-center">Unit</th>
                    <th className="py-2.5 px-3 w-28 text-right">Process Rate (₹)</th>
                    <th className="py-2.5 px-3 w-32 text-right">Amount (₹)</th>
                    <th className="py-2.5 px-2.5 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {currentItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400 text-xs">
                        {activeTab === 'jobwork' 
                          ? "Select an unbilled Job Work Challan above to auto-populate returned service items."
                          : "No line items added. Click 'Add Line Item' above to record services."}
                      </td>
                    </tr>
                  ) : (
                    currentItems.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 text-center text-slate-400 font-bold">{idx + 1}</td>
                        
                        {/* Name and Technical Description */}
                        <td className="py-2.5 px-3">
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => handleUpdateItem(item.id, 'name', e.target.value, activeTab === 'jobwork')}
                            placeholder="Service / Process Name (e.g. Turning, Machining)"
                            className="w-full px-2 py-1 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 outline-none"
                            required
                          />
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => handleUpdateItem(item.id, 'description', e.target.value, activeTab === 'jobwork')}
                            placeholder="Technical description / specification (italicized)"
                            className="w-full px-2 py-0.5 mt-1 text-[11px] italic bg-transparent border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 outline-none"
                          />
                        </td>

                        {/* SAC Code */}
                        <td className="py-2.5 px-2.5 text-center">
                          <input
                            type="text"
                            value={item.sacCode || ''}
                            onChange={(e) => handleUpdateItem(item.id, 'sacCode', e.target.value, activeTab === 'jobwork')}
                            placeholder="SAC"
                            className="w-full px-1.5 py-1 text-center font-mono text-[11px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 outline-none"
                          />
                        </td>

                        {/* Quantity */}
                        <td className="py-2.5 px-2.5 text-center">
                          <input
                            type="number"
                            min="0.01"
                            step="any"
                            value={item.quantity}
                            onChange={(e) => handleUpdateItem(item.id, 'quantity', parseFloat(e.target.value) || 0, activeTab === 'jobwork')}
                            className="w-full px-1.5 py-1 text-center font-bold text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 outline-none"
                            required
                          />
                        </td>

                        {/* Unit */}
                        <td className="py-2.5 px-2.5 text-center">
                          <select
                            value={item.unit}
                            onChange={(e) => handleUpdateItem(item.id, 'unit', e.target.value, activeTab === 'jobwork')}
                            className="w-full px-1 py-1 text-center text-[11px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 outline-none"
                          >
                            {UNIT_OPTIONS.map(u => (
                              <option key={u} value={u}>{u}</option>
                            ))}
                          </select>
                        </td>

                        {/* Process Rate */}
                        <td className="py-2.5 px-3 text-right">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.rate}
                            onChange={(e) => handleUpdateItem(item.id, 'rate', parseFloat(e.target.value) || 0, activeTab === 'jobwork')}
                            className="w-full px-1.5 py-1 text-right font-mono font-bold text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 outline-none"
                            required
                          />
                        </td>

                        {/* Total Line Amount */}
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                          ₹{Number(item.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>

                        {/* Delete action */}
                        <td className="py-2.5 px-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id, activeTab === 'jobwork')}
                            className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                            title="Remove row"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3: TDS (Tax Deducted at Source) & Financial Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* TDS Deduction Settings */}
            <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Percent size={13} className="text-indigo-500" />
                  <span>TDS (Tax Deducted at Source)</span>
                </span>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tdsApplicable}
                    onChange={(e) => setTdsApplicable(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                  />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Deduct TDS</span>
                </label>
              </div>

              {tdsApplicable && (
                <div className="space-y-2.5 pt-1 animate-in fade-in duration-100">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] text-slate-400 font-semibold block mb-0.5">TDS Section</label>
                      <select
                        value={tdsSection}
                        onChange={(e) => {
                          setTdsSection(e.target.value);
                          if (e.target.value === '194C-1') setTdsRate(1);
                          else if (e.target.value === '194C-2') setTdsRate(2);
                          else if (e.target.value === '194J') setTdsRate(10);
                        }}
                        className="w-full px-2 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 outline-none"
                      >
                        <option value="194C-1">194C - Individual / HUF (1%)</option>
                        <option value="194C-2">194C - Company / Firm (2%)</option>
                        <option value="194J">194J - Professional / Technical (10%)</option>
                        <option value="194I">194I - Plant / Machinery Rent (2%)</option>
                        <option value="Custom">Custom TDS Rate</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 font-semibold block mb-0.5">TDS Rate (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="30"
                        step="0.1"
                        value={tdsRate}
                        onChange={(e) => setTdsRate(parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1 text-xs font-mono font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 outline-none"
                      />
                    </div>
                  </div>
                  <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
                    TDS Amount: -₹{computedTdsAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} deducted from total payable.
                  </div>
                </div>
              )}

              {/* Payment Terms & Credit Days */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700 grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-slate-400 font-semibold block mb-0.5">Payment Terms</label>
                  <select
                    value={paymentTerms}
                    onChange={(e) => {
                      setPaymentTerms(e.target.value);
                      if (e.target.value === 'Immediate') setCreditDays(0);
                      else if (e.target.value === '15 Days Net') setCreditDays(15);
                      else if (e.target.value === '30 Days Net') setCreditDays(30);
                      else if (e.target.value === '45 Days Net') setCreditDays(45);
                      else if (e.target.value === '60 Days Net') setCreditDays(60);
                    }}
                    className="w-full px-2 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 outline-none"
                  >
                    {PAYMENT_TERMS_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 font-semibold block mb-0.5">Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-2 py-1 text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Financial Breakdown Totals Card */}
            <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                3. Financial Breakdown
              </div>

              <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                <span>Services Subtotal:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                  ₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                <span>GST Tax Total:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                  ₹{totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex justify-between items-center text-slate-700 dark:text-slate-300 pt-1.5 border-t border-slate-200 dark:border-slate-700">
                <span className="font-bold">Total Bill Value:</span>
                <span className="font-mono font-black text-slate-900 dark:text-slate-100">
                  ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {tdsApplicable && (
                <div className="flex justify-between items-center text-rose-600 dark:text-rose-400">
                  <span>Less TDS ({tdsRate}%):</span>
                  <span className="font-mono font-bold">
                    -₹{computedTdsAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center text-indigo-700 dark:text-indigo-400 pt-2 border-t border-slate-200 dark:border-slate-700 text-sm font-black">
                <span>Net Payable Balance:</span>
                <span className="font-mono">
                  ₹{netPayable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Remarks & Accounting Notes
            </label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={2}
              placeholder="Internal processing remarks or jobwork details..."
              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 outline-none"
            />
          </div>

          {/* Footer Controls */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <RefreshCw size={13} className="animate-spin" />
                  <span>Recording Bill...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={14} />
                  <span>Record Service Bill</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

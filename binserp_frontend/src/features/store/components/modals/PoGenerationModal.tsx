"use client";

import React, { useState, useEffect } from "react";
import { X, ShoppingCart, Plus, Trash2, CheckCircle2, Building2, Calendar, FileText } from "lucide-react";
import SearchableSelect from "../SearchableSelect";

interface PoGenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (poPayload: any) => Promise<void>;
  quotation: any;
  vendors?: any[];
  submitting?: boolean;
}

export default function PoGenerationModal({
  isOpen,
  onClose,
  onSubmit,
  quotation,
  vendors = [],
  submitting = false,
}: PoGenerationModalProps) {
  const [poNumber, setPoNumber] = useState("");
  const [date, setDate] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [remarks, setRemarks] = useState("");
  const [status, setStatus] = useState("Released");
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen && quotation) {
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      setPoNumber(`PO-${dateStr}-${randomNum}`);
      setDate(new Date().toISOString().slice(0, 10));

      const vId = typeof quotation.vendor === 'object' ? quotation.vendor?._id : (quotation.vendor || quotation.vendorId || '');
      setVendorId(vId);
      setVendorName(quotation.vendorName || quotation.vendor?.name || 'Supplier');
      setRemarks(quotation.termsAndConditions || '');
      setStatus("Released");

      const formattedItems = (quotation.items || []).map((it: any) => ({
        materialId: it.materialId || it.material,
        materialName: it.materialName || 'Material Item',
        quantity: Number(it.quantity) || 1,
        unit: it.unit || it.uom || 'PCS',
        rate: Number(it.unitPrice || it.rate) || 0,
        tax: Number(it.tax) || 18,
        amount: Number(it.total) || ((Number(it.quantity) || 1) * (Number(it.unitPrice || it.rate) || 0))
      }));

      setItems(formattedItems.length > 0 ? formattedItems : [{
        materialId: '',
        materialName: 'Item',
        quantity: 1,
        unit: 'PCS',
        rate: 0,
        tax: 18,
        amount: 0
      }]);
    }
  }, [isOpen, quotation]);

  if (!isOpen || !quotation) return null;

  const handleItemChange = (index: number, field: string, value: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };

    if (field === 'quantity' || field === 'rate' || field === 'tax') {
      const qty = Number(updated[index].quantity) || 0;
      const rate = Number(updated[index].rate) || 0;
      const tax = Number(updated[index].tax) || 0;
      updated[index].amount = (qty * rate) * (1 + tax / 100);
    }

    setItems(updated);
  };

  const handleAddItem = () => {
    setItems([...items, {
      materialId: '',
      materialName: 'Custom Material',
      quantity: 1,
      unit: 'PCS',
      rate: 0,
      tax: 18,
      amount: 0
    }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const subtotal = items.reduce((acc, item) => acc + ((Number(item.quantity) || 0) * (Number(item.rate) || 0)), 0);
  const totalTax = items.reduce((acc, item) => acc + (((Number(item.quantity) || 0) * (Number(item.rate) || 0)) * ((Number(item.tax) || 0) / 100)), 0);
  const grandTotal = subtotal + totalTax;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      poNumber,
      date,
      vendor: vendorId || undefined,
      vendorName,
      quotation: quotation._id,
      quotationNumber: quotation.quotationNumber,
      rfqNumber: quotation.rfqNumber || '',
      status,
      remarks,
      items: items.map(it => ({
        material: it.materialId || undefined,
        materialName: it.materialName,
        quantity: Number(it.quantity) || 1,
        unit: it.unit || 'PCS',
        rate: Number(it.rate) || 0,
        amount: Number(it.amount) || ((Number(it.quantity) || 1) * (Number(it.rate) || 0))
      })),
      totalAmount: grandTotal
    };

    onSubmit(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 bg-cyan-950 text-white flex justify-between items-center flex-shrink-0 border-b border-cyan-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-cyan-900 rounded-xl flex items-center justify-center border border-cyan-700">
              <ShoppingCart size={20} className="text-cyan-300" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold tracking-tight">Generate Outward Purchase Order</h2>
              <p className="text-xs text-cyan-300/80 mt-0.5">
                From Quotation: <span className="font-mono font-bold text-white">{quotation.quotationNumber}</span>
                {quotation.rfqNumber && ` | RFQ: ${quotation.rfqNumber}`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-cyan-900 hover:bg-cyan-800 flex items-center justify-center text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-6">
          
          {/* Logistics & Vendor Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                PO Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={poNumber}
                onChange={(e) => setPoNumber(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-cyan-600 dark:text-cyan-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                PO Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Target Vendor
              </label>
              <input
                type="text"
                readOnly
                value={vendorName}
                className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                PO Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200"
              >
                <option value="Released">Released</option>
                <option value="Approved">Approved</option>
                <option value="Draft">Draft</option>
              </select>
            </div>
          </div>

          {/* Items Table */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                PO Materials & Agreed Rates (Pre-Filled from Quotation)
              </h3>
              <button
                type="button"
                onClick={handleAddItem}
                className="text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:underline bg-cyan-50 dark:bg-cyan-950/60 px-3 py-1 rounded-lg border border-cyan-200 dark:border-cyan-800"
              >
                + Add Material Item
              </button>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 dark:bg-slate-800 font-bold text-slate-600 dark:text-slate-400 uppercase border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="px-4 py-3">Material Name</th>
                    <th className="px-4 py-3 text-center w-28">Quantity</th>
                    <th className="px-4 py-3 text-center w-24">Unit</th>
                    <th className="px-4 py-3 text-right w-32">Agreed Rate (₹)</th>
                    <th className="px-4 py-3 text-center w-20">GST %</th>
                    <th className="px-4 py-3 text-right w-36">Total Amount (₹)</th>
                    <th className="px-3 py-3 text-center w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                  {items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={item.materialName}
                          onChange={(e) => handleItemChange(idx, 'materialName', e.target.value)}
                          className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-slate-900 dark:text-white"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min="0.01"
                          step="any"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                          className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-center font-bold"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={item.unit}
                          onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                          className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-center"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={item.rate}
                          onChange={(e) => handleItemChange(idx, 'rate', e.target.value)}
                          className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-right font-bold"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={item.tax}
                          onChange={(e) => handleItemChange(idx, 'tax', e.target.value)}
                          className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-center"
                        />
                      </td>
                      <td className="px-4 py-3 text-right font-extrabold text-cyan-600 font-mono">
                        ₹{Number(item.amount || 0).toLocaleString()}
                      </td>
                      <td className="px-2 py-2 text-center">
                        {items.length > 1 && (
                          <button type="button" onClick={() => handleRemoveItem(idx)} className="p-1 text-red-500 hover:bg-red-50 rounded-lg">
                            <Trash2 size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Remarks & Total Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Terms & Conditions / Special Instructions
              </label>
              <textarea
                rows={3}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Payment terms, delivery schedule, warranty conditions..."
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
              />
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600 dark:text-slate-400"><span>Items Subtotal:</span> <span className="font-bold">₹{subtotal.toLocaleString()}</span></div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400"><span>Estimated GST Tax:</span> <span className="font-bold">₹{totalTax.toLocaleString()}</span></div>
              <div className="flex justify-between text-sm font-extrabold text-slate-900 dark:text-white pt-1 border-t border-slate-200 dark:border-slate-700">
                <span>Grand Total PO Value:</span> <span className="text-cyan-600 font-mono">₹{grandTotal.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 flex-shrink-0">
            <button type="button" onClick={onClose} className="px-5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 font-semibold text-sm">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-cyan-600/20 flex items-center gap-2"
            >
              <ShoppingCart size={16} />
              {submitting ? 'Generating PO...' : 'Confirm & Generate Outward PO'}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}

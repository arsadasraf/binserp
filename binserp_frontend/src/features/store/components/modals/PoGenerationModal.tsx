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

      const formattedItems = (quotation.items || []).map((it: any) => {
        const qty = Number(it.quantity) || 1;
        const rate = Number(it.unitPrice || it.rate) || 0;
        const hasSec = Boolean(it.hasSecondaryUnit && it.secondaryUnit);
        const secUnit = hasSec ? it.secondaryUnit : '';
        const convFactor = Number(it.conversionFactor) || 1;
        const secQty = hasSec ? (Number(it.secondaryQuantity) || (qty * convFactor)) : undefined;
        const rateUnit = (it.rateUnit === 'secondary' && hasSec) ? 'secondary' : 'primary';
        const primaryRate = Number(it.primaryRate) || (rateUnit === 'primary' ? rate : (qty > 0 && secQty ? (secQty * rate) / qty : (convFactor > 0 ? rate / convFactor : rate)));
        const secondaryRate = Number(it.secondaryRate) || (rateUnit === 'secondary' ? rate : (qty > 0 && secQty ? (qty * rate) / secQty : (convFactor > 0 ? rate * convFactor : rate)));
        const lineSubtotal = (rateUnit === 'secondary' && hasSec && secQty) ? (secQty * rate) : (qty * rate);
        const taxPct = Number(it.tax) || 18;
        const lineTotal = lineSubtotal * (1 + taxPct / 100);

        return {
          materialId: it.materialId || it.material,
          materialName: it.materialName || 'Material Item',
          description: it.description || '',
          quantity: qty,
          unit: it.unit || it.uom || 'PCS',
          hasSecondaryUnit: hasSec,
          secondaryUnit: secUnit,
          conversionFactor: convFactor,
          secondaryQuantity: secQty,
          rateUnit,
          primaryRate,
          secondaryRate,
          rate,
          tax: taxPct,
          amount: lineTotal,
          subtotal: lineSubtotal
        };
      });

      setItems(formattedItems.length > 0 ? formattedItems : [{
        materialId: '',
        materialName: 'Item',
        description: '',
        quantity: 1,
        unit: 'PCS',
        hasSecondaryUnit: false,
        secondaryUnit: '',
        conversionFactor: 1,
        secondaryQuantity: undefined,
        rateUnit: 'primary',
        primaryRate: 0,
        secondaryRate: 0,
        rate: 0,
        tax: 18,
        amount: 0,
        subtotal: 0
      }]);
    }
  }, [isOpen, quotation]);

  if (!isOpen || !quotation) return null;

  const handleItemChange = (index: number, field: string, value: any) => {
    const updated = [...items];
    const current = { ...updated[index], [field]: value };
    const hasSec = Boolean(current.hasSecondaryUnit && current.secondaryUnit);
    const convFactor = Number(current.conversionFactor) || 1;

    if (field === 'quantity') {
      const qtyVal = Number(value) || 0;
      if (hasSec && convFactor > 0 && !current.secondaryQuantity) {
        current.secondaryQuantity = parseFloat((qtyVal * convFactor).toFixed(3));
      }
    } else if (field === 'secondaryQuantity') {
      const secVal = Number(value) || 0;
      if (hasSec && convFactor > 0 && !current.quantity) {
        current.quantity = parseFloat((secVal / convFactor).toFixed(3));
      }
    }

    const qty = Number(current.quantity) || 0;
    const secQty = Number(current.secondaryQuantity) || 0;
    const rate = Number(current.rate) || 0;
    const rateUnit = (current.rateUnit === 'secondary' && hasSec) ? 'secondary' : 'primary';
    const tax = Number(current.tax) || 0;

    let primaryRate = Number(current.primaryRate || 0);
    let secondaryRate = Number(current.secondaryRate || 0);
    let lineSubtotal = 0;

    if (rateUnit === 'secondary' && hasSec) {
      secondaryRate = rate;
      primaryRate = (qty > 0 && secQty > 0) ? ((secQty * rate) / qty) : (convFactor > 0 ? rate / convFactor : rate);
      const activeQty = secQty > 0 ? secQty : (qty * convFactor);
      lineSubtotal = activeQty * rate;
    } else {
      primaryRate = rate;
      secondaryRate = (qty > 0 && secQty > 0) ? ((qty * rate) / secQty) : (convFactor > 0 ? rate * convFactor : rate);
      lineSubtotal = qty * rate;
    }

    current.rateUnit = rateUnit;
    current.primaryRate = primaryRate;
    current.secondaryRate = secondaryRate;
    current.subtotal = lineSubtotal;
    current.amount = lineSubtotal * (1 + tax / 100);

    updated[index] = current;
    setItems(updated);
  };

  const handleAddItem = () => {
    setItems([...items, {
      materialId: '',
      materialName: 'Custom Material',
      description: '',
      quantity: 1,
      unit: 'PCS',
      hasSecondaryUnit: false,
      secondaryUnit: '',
      conversionFactor: 1,
      secondaryQuantity: undefined,
      rateUnit: 'primary',
      primaryRate: 0,
      secondaryRate: 0,
      rate: 0,
      tax: 18,
      amount: 0,
      subtotal: 0
    }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const subtotal = items.reduce((acc, item) => acc + (Number(item.subtotal || ((Number(item.quantity) || 0) * (Number(item.rate) || 0)))), 0);
  const totalTax = items.reduce((acc, item) => acc + ((Number(item.subtotal || ((Number(item.quantity) || 0) * (Number(item.rate) || 0)))) * ((Number(item.tax) || 0) / 100)), 0);
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
        description: it.description || '',
        quantity: Number(it.quantity) || 1,
        unit: it.unit || 'PCS',
        hasSecondaryUnit: Boolean(it.hasSecondaryUnit && it.secondaryUnit),
        secondaryUnit: it.secondaryUnit || '',
        conversionFactor: Number(it.conversionFactor) || 1,
        secondaryQuantity: it.hasSecondaryUnit ? Number(it.secondaryQuantity || 0) : undefined,
        rateUnit: (it.rateUnit === 'secondary' && it.hasSecondaryUnit) ? 'secondary' : 'primary',
        primaryRate: Number(it.primaryRate) || Number(it.rate),
        secondaryRate: Number(it.secondaryRate) || Number(it.rate),
        rate: Number(it.rate) || 0,
        amount: Number(it.subtotal || it.amount) || ((Number(it.quantity) || 1) * (Number(it.rate) || 0))
      })),
      totalAmount: grandTotal
    };

    onSubmit(payload);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh]">
        
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
                        {item.description && (
                          <div className="text-[10px] text-slate-400 italic mt-0.5">{item.description}</div>
                        )}
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
                        {item.hasSecondaryUnit && item.secondaryUnit && (
                          <div className="mt-1 flex items-center gap-1 text-[10px]">
                            <input
                              type="number"
                              step="any"
                              value={item.secondaryQuantity || ''}
                              onChange={(e) => handleItemChange(idx, 'secondaryQuantity', e.target.value)}
                              placeholder="Sec"
                              className="w-full px-1 py-0.5 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded text-center font-mono font-bold text-indigo-900 dark:text-indigo-200"
                              title={`Secondary Quantity in ${item.secondaryUnit}`}
                            />
                            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 shrink-0">{item.secondaryUnit}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={item.unit}
                          onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                          className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-center"
                        />
                        {item.hasSecondaryUnit && item.secondaryUnit && (
                          <div className="text-[9px] text-indigo-500 font-semibold text-center mt-1">
                            Sec: {item.secondaryUnit}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.rate}
                            onChange={(e) => handleItemChange(idx, 'rate', e.target.value)}
                            className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-right font-bold"
                          />
                          {item.hasSecondaryUnit && item.secondaryUnit ? (
                            <button
                              type="button"
                              onClick={() => handleItemChange(idx, 'rateUnit', item.rateUnit === 'secondary' ? 'primary' : 'secondary')}
                              className={`px-1.5 py-1 rounded text-[10px] font-bold border transition-colors cursor-pointer shrink-0 ${
                                item.rateUnit === 'secondary'
                                  ? 'bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950 dark:text-indigo-300'
                                  : 'bg-cyan-100 text-cyan-800 border-cyan-300 dark:bg-cyan-950 dark:text-cyan-300'
                              }`}
                              title="Toggle Rate Unit between Primary and Secondary"
                            >
                              /{item.rateUnit === 'secondary' ? item.secondaryUnit : item.unit}
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-bold shrink-0">/{item.unit}</span>
                          )}
                        </div>
                        {item.hasSecondaryUnit && item.secondaryUnit && Number(item.rate) > 0 && (
                          <div className="text-[9px] text-slate-400 font-mono text-right italic mt-0.5">
                            {item.rateUnit === 'secondary'
                              ? `≈ ₹${Number(item.primaryRate || 0).toFixed(2)}/${item.unit}`
                              : `≈ ₹${Number(item.secondaryRate || 0).toFixed(2)}/${item.secondaryUnit}`}
                          </div>
                        )}
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
                        <div className="flex items-center justify-center gap-1">
                          {idx === items.length - 1 && (
                            <button
                              type="button"
                              onClick={handleAddItem}
                              className="p-1 text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-950/40 rounded-lg transition-colors cursor-pointer"
                              title="Add Next Material Item"
                            >
                              <Plus size={16} />
                            </button>
                          )}
                          {items.length > 1 && (
                            <button type="button" onClick={() => handleRemoveItem(idx)} className="p-1 text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer" title="Remove Item">
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Bottom Add Line Item Bar */}
            <div className="pt-1">
              <button
                type="button"
                onClick={handleAddItem}
                className="w-full py-2.5 px-4 border-2 border-dashed border-cyan-200 hover:border-cyan-500 dark:border-cyan-800/80 dark:hover:border-cyan-500 bg-cyan-50/40 hover:bg-cyan-50 dark:bg-cyan-950/20 dark:hover:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 font-bold rounded-2xl text-xs flex items-center justify-center gap-2 transition-all shadow-2xs cursor-pointer active:scale-[0.99] group"
              >
                <Plus size={15} className="text-cyan-600 dark:text-cyan-400 group-hover:scale-110 transition-transform" />
                <span>+ Add Material Item</span>
              </button>
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

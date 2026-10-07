"use client";

import React, { useState, useEffect } from "react";
import { X, ShoppingCart, Plus, Trash2, CheckCircle2, Building2, Calendar, FileText } from "lucide-react";
import SearchableSelect from "../SearchableSelect";
import { computeDualUomLinePricing, syncQuantities, switchRateUnit, computePOTaxAndGrandTotals } from "@/src/utils/dualUomHelper";

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
  const [isRoundOffEnabled, setIsRoundOffEnabled] = useState<boolean>(true);
  const [roundingMode, setRoundingMode] = useState<'nearest' | 'floor' | 'ceil' | 'none'>('nearest');

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

        const pricing = computeDualUomLinePricing({
          quantity: qty,
          unit: it.unit || it.uom || 'PCS',
          hasSecondaryUnit: hasSec,
          secondaryUnit: secUnit,
          conversionFactor: convFactor,
          secondaryQuantity: secQty,
          rateUnit,
          rate,
        });

        const taxPct = Number(it.tax) || 18;
        const lineTotal = parseFloat((pricing.amount * (1 + taxPct / 100)).toFixed(2));

        return {
          materialId: it.materialId || it.material,
          materialName: it.materialName || 'Material Item',
          description: it.description || '',
          quantity: pricing.quantity,
          unit: it.unit || it.uom || 'PCS',
          hasSecondaryUnit: hasSec,
          secondaryUnit: secUnit,
          conversionFactor: convFactor,
          secondaryQuantity: pricing.secondaryQuantity,
          rateUnit: pricing.rateUnit,
          selectedUnit: pricing.selectedUnit,
          primaryRate: pricing.primaryRate,
          secondaryRate: pricing.secondaryRate,
          rate: pricing.rate,
          tax: taxPct,
          amount: pricing.amount,
          subtotal: pricing.amount,
          total: lineTotal
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
        subtotal: 0,
        total: 0
      }]);
    }
  }, [isOpen, quotation]);

  if (!isOpen || !quotation) return null;

  const handleItemChange = (index: number, field: string, value: any) => {
    const updated = [...items];
    const current = { ...updated[index], [field]: value };
    const hasSec = Boolean(current.hasSecondaryUnit && current.secondaryUnit);
    const convFactor = Number(current.conversionFactor) || 1;

    if (field === 'rateUnit') {
      const targetRateUnit = (value === 'secondary' && hasSec) ? 'secondary' : 'primary';
      current.rateUnit = targetRateUnit;
      current.rate = switchRateUnit(
        targetRateUnit,
        current.rate,
        current.primaryRate,
        current.secondaryRate,
        convFactor
      );
    } else if (field === 'quantity') {
      const synced = syncQuantities('quantity', value, convFactor);
      current.quantity = synced.quantity;
      if (hasSec) {
        current.secondaryQuantity = synced.secondaryQuantity;
      }
    } else if (field === 'secondaryQuantity') {
      const synced = syncQuantities('secondaryQuantity', value, convFactor);
      current.secondaryQuantity = synced.secondaryQuantity;
      if (hasSec) {
        current.quantity = synced.quantity;
      }
    } else {
      (current as any)[field] = value;
    }

    const pricing = computeDualUomLinePricing({
      quantity: current.quantity,
      unit: current.unit,
      hasSecondaryUnit: hasSec,
      secondaryUnit: current.secondaryUnit,
      conversionFactor: convFactor,
      secondaryQuantity: current.secondaryQuantity,
      rateUnit: current.rateUnit,
      rate: current.rate,
    });

    const tax = Number(current.tax) || 0;

    current.quantity = pricing.quantity;
    current.secondaryQuantity = pricing.secondaryQuantity;
    current.rateUnit = pricing.rateUnit;
    current.selectedUnit = pricing.selectedUnit;
    current.primaryRate = pricing.primaryRate;
    current.secondaryRate = pricing.secondaryRate;
    current.rate = pricing.rate;
    current.subtotal = pricing.amount;
    current.amount = pricing.amount;
    current.total = parseFloat((pricing.amount * (1 + tax / 100)).toFixed(2));

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
      subtotal: 0,
      total: 0
    }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const poTotals = computePOTaxAndGrandTotals(
    items,
    0,
    0,
    items.length > 0 ? Number(items[0].tax || 18) : 18,
    false,
    isRoundOffEnabled,
    roundingMode
  );
  const subtotal = poTotals.subtotal;
  const totalTax = poTotals.totalTax;
  const grandTotal = poTotals.grandTotal;

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
      preRoundTotal: poTotals.preRoundTotal,
      isRoundOff: isRoundOffEnabled,
      roundOff: poTotals.roundOff,
      roundingMode,
      items: items.map(it => {
        const hasSec = Boolean(it.hasSecondaryUnit && it.secondaryUnit);
        const convFactor = Number(it.conversionFactor) || 1;
        const pricing = computeDualUomLinePricing({
          quantity: Number(it.quantity) || 1,
          unit: it.unit || 'PCS',
          hasSecondaryUnit: hasSec,
          secondaryUnit: it.secondaryUnit || '',
          conversionFactor: convFactor,
          secondaryQuantity: hasSec ? Number(it.secondaryQuantity) : undefined,
          rateUnit: it.rateUnit,
          rate: Number(it.rate) || 0,
        });

        const itemTaxRate = Number(it.tax) || 0;
        const itemTaxAmount = parseFloat(((pricing.amount * itemTaxRate) / 100).toFixed(2));

        return {
          material: it.materialId || undefined,
          materialName: it.materialName,
          description: it.description || '',
          quantity: pricing.quantity,
          unit: it.unit || 'PCS',
          hasSecondaryUnit: hasSec,
          secondaryUnit: it.secondaryUnit || '',
          conversionFactor: convFactor,
          secondaryQuantity: pricing.secondaryQuantity,
          rateUnit: pricing.rateUnit,
          selectedUnit: pricing.selectedUnit,
          primaryRate: pricing.primaryRate,
          secondaryRate: pricing.secondaryRate,
          rate: pricing.rate,
          taxRate: itemTaxRate,
          taxAmount: itemTaxAmount,
          subtotal: pricing.amount,
          amount: pricing.amount
        };
      }),
      subtotal: parseFloat(subtotal.toFixed(2)),
      totalTax: parseFloat(totalTax.toFixed(2)),
      totalAmount: parseFloat(grandTotal.toFixed(2)),
      grandTotal: parseFloat(grandTotal.toFixed(2)),
      gstType: 'intra_state',
      taxRate: items.length > 0 ? Number(items[0].tax || 18) : 18,
      cgstAmount: parseFloat((totalTax / 2).toFixed(2)),
      sgstAmount: parseFloat((totalTax / 2).toFixed(2)),
      igstAmount: 0
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
                    <th className="px-3 py-3 w-64 min-w-[200px] max-w-[260px]">Material Name</th>
                    <th className="px-4 py-3 text-center w-28">Quantity</th>
                    <th className="px-4 py-3 text-center w-32">Billing Unit</th>
                    <th className="px-3 py-3 text-right w-48 min-w-[190px]">Agreed Rate (₹)</th>
                    <th className="px-4 py-3 text-center w-20">GST %</th>
                    <th className="px-4 py-3 text-right w-36">Taxable Amount (₹)</th>
                    <th className="px-3 py-3 text-center w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                  {items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="px-3 py-2 w-64 min-w-[200px] max-w-[260px]">
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
                      <td className="px-3 py-2 min-w-[120px]">
                        {item.hasSecondaryUnit && item.secondaryUnit ? (
                          <div className="space-y-1">
                            <div className="flex items-center p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs">
                              <button
                                type="button"
                                onClick={() => handleItemChange(idx, 'rateUnit', 'primary')}
                                className={`flex-1 py-1 px-1 rounded text-[10px] font-extrabold transition-all cursor-pointer ${
                                  item.rateUnit !== 'secondary'
                                    ? 'bg-cyan-600 text-white shadow-xs'
                                    : 'text-slate-600 dark:text-slate-400'
                                }`}
                                title={`Rate charged on Primary Unit: ${item.unit}`}
                              >
                                {item.unit}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleItemChange(idx, 'rateUnit', 'secondary')}
                                className={`flex-1 py-1 px-1 rounded text-[10px] font-extrabold transition-all cursor-pointer ${
                                  item.rateUnit === 'secondary'
                                    ? 'bg-indigo-600 text-white shadow-xs'
                                    : 'text-slate-600 dark:text-slate-400'
                                }`}
                                title={`Rate charged on Secondary Unit: ${item.secondaryUnit}`}
                              >
                                {item.secondaryUnit}
                              </button>
                            </div>
                            <div className="text-[9px] text-center font-bold">
                              Rate: <span className={item.rateUnit === 'secondary' ? 'text-indigo-600' : 'text-cyan-600'}>{item.rateUnit === 'secondary' ? item.secondaryUnit : item.unit}</span>
                            </div>
                          </div>
                        ) : (
                          <input
                            type="text"
                            value={item.unit}
                            onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                            className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-center"
                          />
                        )}
                      </td>
                      <td className="px-3 py-2 w-48 min-w-[190px]">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={item.rate}
                              onChange={(e) => handleItemChange(idx, 'rate', e.target.value)}
                              className="w-full min-w-[90px] px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-right font-bold"
                            />
                            <span className={`px-2 py-1 rounded text-[10px] font-bold border shrink-0 ${
                              item.rateUnit === 'secondary'
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300'
                                : 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950 dark:text-cyan-300'
                            }`}>
                              /{item.rateUnit === 'secondary' && item.secondaryUnit ? item.secondaryUnit : item.unit}
                            </span>
                          </div>
                          {item.hasSecondaryUnit && item.secondaryUnit && Number(item.rate) > 0 && (
                            <div className="text-[9px] text-slate-400 font-mono text-right italic">
                              {item.rateUnit === 'secondary'
                                ? `≈ ₹${Number(item.primaryRate || 0).toFixed(2)}/${item.unit}`
                                : `≈ ₹${Number(item.secondaryRate || 0).toFixed(2)}/${item.secondaryUnit}`}
                            </div>
                          )}
                        </div>
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
                      <td className="px-4 py-3 text-right font-mono">
                        <div className="font-extrabold text-cyan-600 dark:text-cyan-400">
                          ₹{Number(item.amount || item.subtotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Total: ₹{Number((Number(item.amount || item.subtotal || 0) * (1 + (Number(item.tax) || 0) / 100))).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
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
              <div className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-700">
                <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={isRoundOffEnabled}
                    onChange={(e) => setIsRoundOffEnabled(e.target.checked)}
                    className="w-3.5 h-3.5 text-cyan-600 rounded focus:ring-cyan-500 cursor-pointer"
                  />
                  <span>Round Off Total</span>
                </label>
                {isRoundOffEnabled && poTotals.roundOff !== 0 && (
                  <span className={`font-mono font-bold ${poTotals.roundOff >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                    {poTotals.roundOff > 0 ? '+' : ''}₹{poTotals.roundOff.toFixed(2)}
                  </span>
                )}
              </div>
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

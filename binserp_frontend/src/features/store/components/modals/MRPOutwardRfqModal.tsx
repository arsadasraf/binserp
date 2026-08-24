import React, { useState, useEffect, useMemo } from 'react';
import { X, Send, Plus, Trash2, Package, Calendar, Clock, Check, Building2, AlertCircle } from 'lucide-react';
import { apiGet, apiPost, apiPut } from '@/src/lib/api';
import Swal from 'sweetalert2';

interface MRPOutwardRfqModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  initialItems?: Array<{
    planId?: string;
    material?: string;
    materialId?: string;
    materialName: string;
    materialCode?: string;
    description?: string;
    quantity: number;
    unit?: string;
    itemType?: string;
    category?: string;
    targetPrice?: number | string;
    sourceMRP?: string;
  }>;
  onSuccess?: () => void;
}

export default function MRPOutwardRfqModal({
  isOpen,
  onClose,
  token,
  initialItems = [],
  onSuccess
}: MRPOutwardRfqModalProps) {
  const [loadingVendors, setLoadingVendors] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [vendors, setVendors] = useState<any[]>([]);
  const [vendorSearchTerm, setVendorSearchTerm] = useState('');
  const [selectedVendorIds, setSelectedVendorIds] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [remarks, setRemarks] = useState('');
  const [rfqNumber, setRfqNumber] = useState('');

  const [items, setItems] = useState<Array<{
    planId?: string;
    sourceMRP?: string;
    materialId: string;
    materialName: string;
    materialCode?: string;
    description: string;
    quantity: number;
    unit: string;
    itemType: string;
    targetPrice: string | number;
  }>>([]);

  const generateRfqNumber = () => {
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    return `RFQ-${dateStr}-${randomNum}`;
  };

  useEffect(() => {
    if (isOpen) {
      setRfqNumber(generateRfqNumber());
      setSelectedVendorIds([]);
      setVendorSearchTerm('');
      setRemarks('');
      const d = new Date();
      d.setDate(d.getDate() + 7);
      setDueDate(d.toISOString().split('T')[0]);

      if (initialItems && initialItems.length > 0) {
        setItems(initialItems.map(item => ({
          planId: item.planId,
          sourceMRP: item.sourceMRP,
          materialId: item.materialId || item.material || '',
          materialName: item.materialName || '',
          materialCode: item.materialCode || '',
          description: item.description || (item.sourceMRP ? `From MRP: ${item.sourceMRP}` : ''),
          quantity: Number(item.quantity) || 1,
          unit: item.unit || 'PCS',
          itemType: (item.itemType || 'rm').toLowerCase().includes('bo') || (item.category || '').toLowerCase().includes('bought') ? 'bo' : 'rm',
          targetPrice: item.targetPrice || ''
        })));
      } else {
        setItems([{
          materialId: '',
          materialName: '',
          materialCode: '',
          description: '',
          quantity: 1,
          unit: 'PCS',
          itemType: 'rm',
          targetPrice: ''
        }]);
      }

      // Fetch vendors
      if (token) {
        setLoadingVendors(true);
        apiGet('/api/store/vendor', token)
          .then((res: any) => {
            const list = Array.isArray(res?.vendors) ? res.vendors : (Array.isArray(res) ? res : []);
            setVendors(list);
          })
          .catch((err) => {
            console.error('Failed to load vendors for RFQ Modal:', err);
          })
          .finally(() => {
            setLoadingVendors(false);
          });
      }
    }
  }, [isOpen, initialItems, token]);

  const filteredVendors = useMemo(() => {
    if (!vendorSearchTerm.trim()) return vendors;
    const lower = vendorSearchTerm.toLowerCase();
    return (vendors || []).filter(v =>
      (v.name && v.name.toLowerCase().includes(lower)) ||
      (v.companyName && v.companyName.toLowerCase().includes(lower)) ||
      (v.code && v.code.toLowerCase().includes(lower)) ||
      (v.city && v.city.toLowerCase().includes(lower))
    );
  }, [vendors, vendorSearchTerm]);

  const toggleVendorSelection = (vId: string) => {
    setSelectedVendorIds(prev =>
      prev.includes(vId) ? prev.filter(id => id !== vId) : [...prev, vId]
    );
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    setItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleAddItem = () => {
    setItems(prev => [
      ...prev,
      {
        materialId: '',
        materialName: '',
        materialCode: '',
        description: '',
        quantity: 1,
        unit: 'PCS',
        itemType: 'rm',
        targetPrice: ''
      }
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedVendorIds || selectedVendorIds.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Vendor Required',
        text: 'Please select at least one vendor to send the Outward RFQ to.'
      });
      return;
    }

    if (!items || items.length === 0 || items.some(it => !it.materialName.trim() || Number(it.quantity) <= 0)) {
      Swal.fire({
        icon: 'warning',
        title: 'Invalid Items',
        text: 'Please ensure all items have a valid material name and quantity greater than 0.'
      });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        rfqNumber: rfqNumber.trim(),
        date: new Date(),
        dueDate: dueDate ? new Date(dueDate) : undefined,
        vendorIds: selectedVendorIds,
        remarks: remarks.trim(),
        items: items.map(it => ({
          materialId: it.materialId || undefined,
          materialName: it.materialName.trim(),
          materialCode: it.materialCode || undefined,
          description: it.description.trim(),
          quantity: Number(it.quantity),
          unit: it.unit || 'PCS',
          itemType: it.itemType || 'rm',
          targetPrice: it.targetPrice ? Number(it.targetPrice) : undefined
        }))
      };

      await apiPost('/api/purchase/rfq', payload, token);

      // Update MRP Requirement item status to "RFQ Raised"
      try {
        const updateItems = items.map(it => ({
          planId: it.planId,
          mrpNumber: it.sourceMRP,
          materialId: it.materialId,
          materialName: it.materialName,
          materialCode: it.materialCode,
          status: 'RFQ Raised'
        }));
        await apiPut('/api/purchase/mrp/update-item-status', { items: updateItems, status: 'RFQ Raised' }, token);
      } catch (statusErr) {
        console.warn('Could not update MRP requirement item status:', statusErr);
      }

      Swal.fire({
        icon: 'success',
        title: 'RFQ Created!',
        text: `Outward RFQ ${rfqNumber} generated successfully for ${selectedVendorIds.length} vendor(s). Status updated to 'RFQ Raised'.`,
        timer: 2500
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to create Outward RFQ:', err);
      Swal.fire({
        icon: 'error',
        title: 'Error Creating RFQ',
        text: err.message || 'Failed to submit Outward RFQ'
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-5 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-cyan-900 via-slate-900 to-slate-900 text-white flex justify-between items-center shrink-0 border-b border-cyan-800/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-cyan-500/20 text-cyan-300 rounded-2xl border border-cyan-400/30">
              <Send size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white">Create Outward RFQ from MRP</h3>
                <span className="px-2.5 py-0.5 bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded-lg text-xs font-mono font-bold">
                  {rfqNumber}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Generate and send request for quotation for {items.length} material requirement(s)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          
          {/* Top Form Row: Due Date, Remarks */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Calendar size={14} className="text-cyan-600" /> Quotation Due Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                required
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Remarks / Instructions
              </label>
              <input
                type="text"
                placeholder="e.g. Urgent delivery required for Production Plan..."
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
              />
            </div>
          </div>

          {/* Vendor Selection Section */}
          <div className="bg-slate-50/70 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-3">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
              <div>
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Building2 size={15} className="text-cyan-600 dark:text-cyan-400" /> Select Recipient Vendor(s) <span className="text-rose-500">*</span>
                </h4>
                <p className="text-[11px] text-slate-500">Selected vendors will receive this RFQ demand</p>
              </div>
              <div className="text-xs font-bold text-cyan-600 dark:text-cyan-400">
                {selectedVendorIds.length} Vendor(s) Selected
              </div>
            </div>

            {/* Vendor search input */}
            <input
              type="text"
              placeholder="Search vendor name, code, city..."
              value={vendorSearchTerm}
              onChange={e => setVendorSearchTerm(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
            />

            {/* Vendor Chips / Checklist */}
            {loadingVendors ? (
              <div className="py-4 text-center text-xs text-slate-400">Loading vendors...</div>
            ) : filteredVendors.length === 0 ? (
              <div className="py-3 text-center text-xs text-slate-400 italic">No matching vendors found</div>
            ) : (
              <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-1">
                {filteredVendors.map(vendor => {
                  const vId = vendor._id || vendor.id;
                  const isSelected = selectedVendorIds.includes(vId);
                  return (
                    <button
                      key={vId}
                      type="button"
                      onClick={() => toggleVendorSelection(vId)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border cursor-pointer ${
                        isSelected
                          ? 'bg-cyan-600 text-white border-cyan-600 shadow-xs'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-cyan-400'
                      }`}
                    >
                      {isSelected && <Check size={12} />}
                      <span>{vendor.name || vendor.companyName}</span>
                      {vendor.city && <span className="text-[10px] opacity-70">({vendor.city})</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Materials Table Section */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Package size={15} className="text-cyan-600 dark:text-cyan-400" /> Material Line Items ({items.length})
                </h4>
                <p className="text-[11px] text-slate-500">Verify material specifications and required quantities</p>
              </div>
              <button
                type="button"
                onClick={handleAddItem}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Plus size={13} /> Add Item
              </button>
            </div>

            <div className="border border-slate-200 dark:border-slate-700/80 rounded-2xl overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 dark:bg-slate-800 font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="px-3 py-2.5">Material Name</th>
                      <th className="px-3 py-2.5 w-24">Type</th>
                      <th className="px-3 py-2.5 w-28">Quantity</th>
                      <th className="px-3 py-2.5 w-20">Unit</th>
                      <th className="px-3 py-2.5 w-28">Target Price</th>
                      <th className="px-3 py-2.5">Description / Ref</th>
                      <th className="px-3 py-2.5 w-10 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                    {items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={item.materialName}
                            onChange={e => handleItemChange(idx, 'materialName', e.target.value)}
                            required
                            placeholder="Material Name"
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold text-slate-800 dark:text-slate-200"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={item.itemType}
                            onChange={e => handleItemChange(idx, 'itemType', e.target.value)}
                            className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium text-slate-700 dark:text-slate-300"
                          >
                            <option value="rm">RM</option>
                            <option value="bo">BO</option>
                            <option value="consumable">Consumable</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min="0.01"
                            step="any"
                            value={item.quantity}
                            onChange={e => handleItemChange(idx, 'quantity', parseFloat(e.target.value) || 0)}
                            required
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold text-indigo-600 dark:text-indigo-400"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={item.unit}
                            onChange={e => handleItemChange(idx, 'unit', e.target.value)}
                            className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium text-slate-600 dark:text-slate-400"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            step="any"
                            placeholder="Optional ₹"
                            value={item.targetPrice}
                            onChange={e => handleItemChange(idx, 'targetPrice', e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            placeholder="Specifications or Source MRP"
                            value={item.description}
                            onChange={e => handleItemChange(idx, 'description', e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          {items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors cursor-pointer"
                              title="Remove item"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Footer Submit Buttons */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></div>
                  Generating RFQ...
                </>
              ) : (
                <>
                  <Send size={14} /> Submit & Generate Outward RFQ
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { X, Printer, IndianRupee, Truck, Package, MessageSquare, Send, CheckCircle2, History, AlertCircle, FileText } from 'lucide-react';
import { PurchaseBill } from '@/src/features/purchase/types/purchaseBill.types';
import { API_BASE_URL } from '@/src/utils/config';

interface PurchaseBillDetailModalProps {
  bill: PurchaseBill;
  isOpen: boolean;
  onClose: () => void;
  onRefresh?: () => void;
  onOpenRecordPayment?: () => void;
}

export default function PurchaseBillDetailModal({
  bill,
  isOpen,
  onClose,
  onRefresh,
  onOpenRecordPayment
}: PurchaseBillDetailModalProps) {
  const [newComment, setNewComment] = useState("");
  const [loadingComment, setLoadingComment] = useState(false);

  if (!isOpen || !bill) return null;

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setLoadingComment(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/purchase/bill/${bill._id}/comment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ comment: newComment.trim() })
      });

      if (res.ok) {
        setNewComment("");
        if (onRefresh) onRefresh();
      }
    } catch (err) {
      console.error("Failed to add comment:", err);
    } finally {
      setLoadingComment(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400">
              <FileText size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-slate-900 dark:text-slate-100 font-mono">
                  {bill.billNumber}
                </h2>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  bill.paymentStatus === 'Paid'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                    : bill.paymentStatus === 'Partially Paid'
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                    : bill.paymentStatus === 'Overdue'
                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300'
                    : 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                }`}>
                  {bill.paymentStatus}
                </span>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  {bill.grnCategory?.toUpperCase() || 'RM'}
                </span>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Date: {new Date(bill.date).toLocaleDateString()} • GRN: <strong className="font-mono text-slate-700 dark:text-slate-200">{bill.grnNumber || 'N/A'}</strong>
                {bill.poNumber && <span> • PO: <span className="font-mono text-slate-700 dark:text-slate-200">{bill.poNumber}</span></span>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
              title="Print Bill"
            >
              <Printer size={15} />
              <span className="hidden sm:inline">Print</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-6">
          {/* Vendor & Invoice Metadata Box */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs">
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">
                Supplier / Vendor Information
              </div>
              <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {bill.vendorName}
              </div>
              {bill.vendorAddress && (
                <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                  {bill.vendorAddress}
                </div>
              )}
              {bill.vendorGst && (
                <div className="text-slate-600 dark:text-slate-300 mt-1 font-mono">
                  GSTIN: <strong>{bill.vendorGst}</strong>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-700 pt-2 md:pt-0 md:pl-4">
              <div>
                <div className="text-[10px] text-slate-400 font-bold uppercase">Supplier Invoice #</div>
                <div className="font-semibold text-slate-800 dark:text-slate-200 font-mono mt-0.5">
                  {bill.supplierInvoiceNumber || '-'}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 font-bold uppercase">Payment Terms</div>
                <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                  {bill.paymentTerms || `${bill.creditDays || 30} Days Net`}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 font-bold uppercase">Credit Period</div>
                <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                  {bill.creditDays !== undefined ? `${bill.creditDays} Days` : '30 Days'}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 font-bold uppercase">Due Date</div>
                <div className="font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
                  {bill.dueDate ? new Date(bill.dueDate).toLocaleDateString() : '-'}
                </div>
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Bill Items ({bill.items?.length || 0})
            </div>
            <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-700">
                    <th className="py-2.5 px-3 w-10 text-center">#</th>
                    <th className="py-2.5 px-3 min-w-[200px]">Item Name & Description</th>
                    <th className="py-2.5 px-2.5 w-24 text-center">HSN/SAC</th>
                    <th className="py-2.5 px-3 w-28 text-center">Quantity</th>
                    <th className="py-2.5 px-3 w-28 text-right">Rate (₹)</th>
                    <th className="py-2.5 px-3 w-32 text-right">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {bill.items?.map((item, idx) => {
                    const isSecSelected = Boolean(item.secondaryUnit && item.selectedUnit === item.secondaryUnit);
                    const activeUnit = isSecSelected ? item.secondaryUnit : (item.selectedUnit || item.unit || 'PCS');
                    const activeQty = isSecSelected ? Number(item.secondaryQuantity || 0) : Number(item.quantity || 0);

                    return (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 text-center text-slate-400 font-bold">{idx + 1}</td>
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-800 dark:text-slate-100">
                            {item.materialName || 'Item'}
                          </div>
                          {item.description && (
                            <div className="text-[11px] text-slate-500 italic mt-0.5 line-clamp-2">
                              📝 {item.description}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-2.5 text-center font-mono text-slate-600 dark:text-slate-300">
                          {item.hsnCode || '-'}
                        </td>
                        <td className="py-2.5 px-3 text-center font-semibold text-slate-800 dark:text-slate-200">
                          {activeQty} {activeUnit}
                          {item.secondaryUnit && !isSecSelected && Number(item.secondaryQuantity || 0) > 0 && (
                            <div className="text-[10px] text-indigo-600 dark:text-indigo-400">
                              ({item.secondaryQuantity} {item.secondaryUnit})
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-700 dark:text-slate-300">
                          ₹{Number(item.rate || 0).toFixed(2)}
                          <div className="text-[9px] text-slate-400">/{activeUnit}</div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                          ₹{Number(item.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Financial Breakdown & Charges */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Payment & Credit Status Summary */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Payment Tracking</span>
                {onOpenRecordPayment && bill.balanceAmount > 0 && (
                  <button
                    onClick={() => {
                      onClose();
                      onOpenRecordPayment();
                    }}
                    className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    + Record Payment
                  </button>
                )}
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                  <span>Total Bill Amount:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    ₹{Number(bill.grandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400">
                  <span>Paid Amount:</span>
                  <span className="font-bold">
                    ₹{Number(bill.paidAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center text-rose-600 dark:text-rose-400 border-t border-slate-200 dark:border-slate-700 pt-1.5 font-bold">
                  <span>Remaining Balance:</span>
                  <span className="text-sm font-black">
                    ₹{Number(bill.balanceAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Subtotal, Tax & Charges Totals */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                <span>Items Subtotal:</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  ₹{Number(bill.subtotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {Number(bill.taxAmount || 0) > 0 && (
                <div className="flex justify-between items-center text-indigo-600 dark:text-indigo-400">
                  <span>GST ({bill.taxRate || 0}%):</span>
                  <span className="font-semibold">
                    + ₹{Number(bill.taxAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              {Number(bill.transportationCharges || 0) > 0 && (
                <div className="flex justify-between items-center text-blue-600 dark:text-blue-400">
                  <span className="flex items-center gap-1"><Truck size={12} /> Transportation Charges:</span>
                  <span className="font-semibold">
                    + ₹{Number(bill.transportationCharges || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              {Number(bill.packingCharges || 0) > 0 && (
                <div className="flex justify-between items-center text-amber-600 dark:text-amber-400">
                  <span className="flex items-center gap-1"><Package size={12} /> Packing Charges:</span>
                  <span className="font-semibold">
                    + ₹{Number(bill.packingCharges || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center border-t-2 border-slate-300 dark:border-slate-700 pt-2 text-slate-900 dark:text-slate-100 font-black">
                <span className="text-sm">Grand Total:</span>
                <span className="text-base text-emerald-700 dark:text-emerald-300">
                  ₹{Number(bill.grandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Payment History */}
          {bill.paymentHistory && bill.paymentHistory.length > 0 && (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2.5">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <History size={14} className="text-indigo-500" />
                <span>Recorded Payments ({bill.paymentHistory.length})</span>
              </div>
              <div className="space-y-2">
                {bill.paymentHistory.map((p, idx) => (
                  <div key={idx} className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-emerald-600 dark:text-emerald-400">
                        ₹{Number(p.amountPaid || 0).toLocaleString()} via {p.paymentMode}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {p.transactionRef && <span>Ref: {p.transactionRef} • </span>}
                        {new Date(p.paymentDate).toLocaleDateString()} by {p.recordedByName || 'User'}
                      </div>
                      {p.notes && <div className="text-[10px] text-slate-500 italic mt-0.5">"{p.notes}"</div>}
                    </div>
                    <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* User Notes & Comments Section */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <MessageSquare size={14} className="text-indigo-500" />
              <span>Notes & Comments ({bill.comments?.length || 0})</span>
            </div>

            {/* Add Comment Input */}
            <form onSubmit={handleAddComment} className="flex gap-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a note or comment on this bill..."
                className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={loadingComment || !newComment.trim()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              >
                <Send size={13} />
                <span>Add Note</span>
              </button>
            </form>

            {/* Comments List */}
            <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
              {bill.comments && bill.comments.length > 0 ? (
                bill.comments.map((c, i) => (
                  <div key={i} className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-indigo-700 dark:text-indigo-400">
                        👤 {c.userName || 'User'}
                      </span>
                      <span className="text-slate-400 text-[10px]">
                        {new Date(c.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-slate-700 dark:text-slate-300">
                      {c.comment}
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-3 text-center text-xs text-slate-400 italic">
                  No notes or comments added yet.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

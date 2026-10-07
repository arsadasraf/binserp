import React, { useState } from 'react';
import { X, CheckCircle2, Clock, AlertCircle, IndianRupee, CreditCard, Calendar, MessageSquare, Send, History } from 'lucide-react';
import { PurchaseBill } from '@/src/features/purchase/types/purchaseBill.types';
import { API_BASE_URL } from '@/src/utils/config';

interface RecordPaymentModalProps {
  bill: PurchaseBill;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const PAYMENT_TERMS_OPTIONS = [
  "Immediate",
  "Advance",
  "15 Days Net",
  "30 Days Net",
  "45 Days Net",
  "60 Days Net",
  "Against Delivery"
];

const PAYMENT_MODES = [
  "Bank Transfer",
  "NEFT",
  "RTGS",
  "UPI",
  "Cheque",
  "Cash",
  "Other"
];

export default function RecordPaymentModal({ bill, isOpen, onClose, onSuccess }: RecordPaymentModalProps) {
  const [activeTab, setActiveTab] = useState<'payment' | 'terms' | 'comments'>('payment');
  
  // Payment Form States
  const [amountPaid, setAmountPaid] = useState<number | ''>(bill.balanceAmount > 0 ? bill.balanceAmount : '');
  const [paymentMode, setPaymentMode] = useState<string>("Bank Transfer");
  const [transactionRef, setTransactionRef] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [paymentNotes, setPaymentNotes] = useState<string>("");

  // Terms Form States
  const [paymentTerms, setPaymentTerms] = useState<string>(bill.paymentTerms || "30 Days Net");
  const [creditDays, setCreditDays] = useState<number>(bill.creditDays !== undefined ? bill.creditDays : 30);
  const [dueDate, setDueDate] = useState<string>(bill.dueDate ? new Date(bill.dueDate).toISOString().slice(0, 10) : "");

  // Comment State
  const [newComment, setNewComment] = useState<string>("");

  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  if (!isOpen || !bill) return null;

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';

  const handleCreditDaysChange = (days: number) => {
    setCreditDays(days);
    const bDate = bill.date ? new Date(bill.date) : new Date();
    const calculated = new Date(bDate.getTime() + days * 24 * 60 * 60 * 1000);
    setDueDate(calculated.toISOString().slice(0, 10));
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      const payload: any = {
        paymentTerms,
        creditDays,
        dueDate: dueDate ? new Date(dueDate) : undefined,
      };

      if (Number(amountPaid) > 0) {
        payload.amountPaid = Number(amountPaid);
        payload.paymentMode = paymentMode;
        payload.transactionRef = transactionRef;
        payload.notes = paymentNotes;
        payload.paymentDate = paymentDate ? new Date(paymentDate) : new Date();
      }

      const res = await fetch(`${API_BASE_URL}/api/purchase/bill/${bill._id}/payment`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to record payment");
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch(`${API_BASE_URL}/api/purchase/bill/${bill._id}/comment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ comment: newComment.trim() })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to add comment");
      }

      setNewComment("");
      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to add comment");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/50">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-black text-indigo-600 dark:text-indigo-400 text-sm">
                {bill.billNumber}
              </span>
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
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Vendor: <strong className="text-slate-700 dark:text-slate-200">{bill.vendorName}</strong>
              {bill.grnNumber && <span> • GRN: <span className="font-mono font-semibold">{bill.grnNumber}</span></span>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Financial Summary Card */}
        <div className="p-4 bg-slate-100/70 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 grid grid-cols-3 gap-3 text-center">
          <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 shadow-2xs">
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Bill</div>
            <div className="text-sm font-black text-slate-800 dark:text-slate-100 mt-0.5">
              ₹{Number(bill.grandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 shadow-2xs">
            <div className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 tracking-wider">Paid</div>
            <div className="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
              ₹{Number(bill.paidAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 shadow-2xs">
            <div className="text-[10px] uppercase font-bold text-rose-600 dark:text-rose-400 tracking-wider">Balance</div>
            <div className="text-sm font-black text-rose-600 dark:text-rose-400 mt-0.5">
              ₹{Number(bill.balanceAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 text-xs font-bold px-4 bg-white dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setActiveTab('payment')}
            className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'payment'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <CreditCard size={14} />
            <span>Record Payment</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('terms')}
            className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'terms'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Calendar size={14} />
            <span>Credit & Terms</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('comments')}
            className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'comments'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <MessageSquare size={14} />
            <span>Notes & Comments ({bill.comments?.length || 0})</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1 custom-scrollbar space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {activeTab === 'payment' && (
            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Amount to Pay (₹) <span className="text-red-500">*</span>
                  </label>
                  {bill.balanceAmount > 0 && (
                    <button
                      type="button"
                      onClick={() => setAmountPaid(bill.balanceAmount)}
                      className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      Pay Full Balance (₹{bill.balanceAmount.toFixed(2)})
                    </button>
                  )}
                </div>
                <div className="relative">
                  <IndianRupee size={15} className="absolute left-3 top-3 text-slate-400" />
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    placeholder="0.00"
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Payment Mode
                  </label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
                  >
                    {PAYMENT_MODES.map((mode) => (
                      <option key={mode} value={mode}>{mode}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Payment Date
                  </label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Transaction / UTR Reference #
                </label>
                <input
                  type="text"
                  value={transactionRef}
                  onChange={(e) => setTransactionRef(e.target.value)}
                  placeholder="e.g. UTR84920492 / Cheque # 102934"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-800 dark:text-slate-200 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Payment Notes / Remarks
                </label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="Optional notes for accounts"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading || Number(amountPaid) <= 0}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={16} />
                <span>{loading ? "Recording..." : `Confirm Payment of ₹${Number(amountPaid || 0).toLocaleString()}`}</span>
              </button>
            </form>
          )}

          {activeTab === 'terms' && (
            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Payment Terms
                </label>
                <div className="flex gap-2">
                  <select
                    value={paymentTerms}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPaymentTerms(val);
                      if (val === "15 Days Net") handleCreditDaysChange(15);
                      else if (val === "30 Days Net") handleCreditDaysChange(30);
                      else if (val === "45 Days Net") handleCreditDaysChange(45);
                      else if (val === "60 Days Net") handleCreditDaysChange(60);
                      else if (val === "Immediate" || val === "Advance") handleCreditDaysChange(0);
                    }}
                    className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none"
                  >
                    {PAYMENT_TERMS_OPTIONS.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                    <option value="Custom">Custom Terms</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Credit Period (Days)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={creditDays}
                    onChange={(e) => handleCreditDaysChange(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none"
                  />
                </div>
              </div>

              <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-xl border border-indigo-100 dark:border-indigo-900/40 text-xs text-indigo-700 dark:text-indigo-300">
                💡 <strong>Credit Policy:</strong> Based on the bill date ({new Date(bill.date).toLocaleDateString()}) + {creditDays} credit days, the due date is set to <strong>{dueDate || 'N/A'}</strong>.
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={16} />
                <span>{loading ? "Updating..." : "Save Terms & Due Date"}</span>
              </button>
            </form>
          )}

          {activeTab === 'comments' && (
            <div className="space-y-4">
              {/* Add Comment Input */}
              <form onSubmit={handleAddComment} className="flex gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add note / comment regarding this bill..."
                  className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  disabled={loading || !newComment.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                >
                  <Send size={13} />
                  <span>Add Note</span>
                </button>
              </form>

              {/* Comments Timeline */}
              <div className="space-y-2.5 max-h-56 overflow-y-auto custom-scrollbar">
                {bill.comments && bill.comments.length > 0 ? (
                  bill.comments.map((c, i) => (
                    <div key={i} className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800 text-xs space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-indigo-700 dark:text-indigo-400">
                          👤 {c.userName || 'User'}
                        </span>
                        <span className="text-slate-400 text-[10px]">
                          {new Date(c.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-slate-700 dark:text-slate-300 font-medium">
                        {c.comment}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-6 text-center text-xs text-slate-400 italic">
                    No notes or comments added yet for this bill.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Payment History Log (Always visible underneath if any exist) */}
          {bill.paymentHistory && bill.paymentHistory.length > 0 && (
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                <History size={14} className="text-indigo-500" />
                <span>Payment History</span>
              </div>
              <div className="space-y-2">
                {bill.paymentHistory.map((p, idx) => (
                  <div key={idx} className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
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
        </div>
      </div>
    </div>
  );
}

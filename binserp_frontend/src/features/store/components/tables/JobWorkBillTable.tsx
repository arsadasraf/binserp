"use client";

import React, { useState, useMemo } from 'react';
import { 
  Search, Plus, Filter, Calendar, Download, Eye, CreditCard, 
  Trash2, RefreshCw, AlertCircle, CheckCircle2, Clock, IndianRupee,
  FileCheck2, Truck, Receipt, MessageSquare, LayoutDashboard, ChevronDown, ChevronUp
} from 'lucide-react';
import { PurchaseBill, PurchaseBillMetrics } from '@/src/features/purchase/types/purchaseBill.types';
import { ItemNameAndDescription } from '@/src/utils/itemDisplayHelper';
import { isSpaceFreeMatch } from '@/src/utils/spaceFreeSearchHelper';
import RecordPaymentModal from '../modals/RecordPaymentModal';
import PurchaseBillDetailModal from '../modals/PurchaseBillDetailModal';
import JobWorkBillModal from '../modals/JobWorkBillModal';
import { showDestructiveConfirm, showSuccessToast, showErrorDialog } from '@/src/features/store/utils/storeDialogHelper';
import { apiDelete } from '@/src/lib/api';

const formatDateTime = (dateStr?: string | Date): string => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

interface JobWorkBillTableProps {
  bills: PurchaseBill[];
  metrics?: PurchaseBillMetrics;
  loading: boolean;
  onRefresh: () => void;
  vendors?: any[];
}

export default function JobWorkBillTable({
  bills = [],
  metrics: serverMetrics,
  loading,
  onRefresh,
  vendors = []
}: JobWorkBillTableProps) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';

  // Filter States
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [vendorFilter, setVendorFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [showDashboard, setShowDashboard] = useState<boolean>(false);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [paymentModalBill, setPaymentModalBill] = useState<PurchaseBill | null>(null);
  const [detailModalBill, setDetailModalBill] = useState<PurchaseBill | null>(null);

  // Filtered Bills
  const filteredBills = useMemo(() => {
    return bills.filter(bill => {
      // Payment Status
      if (statusFilter !== 'all' && (bill.paymentStatus || 'Unpaid').toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }

      // Vendor Filter
      if (vendorFilter !== 'all') {
        const vId = bill.vendor?._id || bill.vendor;
        if (vId !== vendorFilter) return false;
      }

      // Date Filter
      if (dateFilter) {
        const bDate = bill.date ? new Date(bill.date).toISOString().slice(0, 10) : '';
        if (bDate !== dateFilter) return false;
      }

      // Search (Space-free across billNumber, invoice, vendor, items, challan, po)
      if (searchTerm.trim()) {
        const vendorName = bill.vendorName || bill.vendor?.name || '';
        const itemsText = (bill.items || []).map((it: any) => `${it.materialName || ''} ${it.serviceName || ''} ${it.description || ''}`).join(' ');
        const combined = `${bill.billNumber || ''} ${bill.supplierInvoiceNumber || ''} ${vendorName} ${bill.jobWorkChallanNumber || ''} ${bill.poNumber || ''} ${itemsText}`;
        if (!isSpaceFreeMatch(combined, searchTerm)) {
          return false;
        }
      }

      return true;
    });
  }, [bills, statusFilter, vendorFilter, dateFilter, searchTerm]);

  // Financial Metrics
  const calculatedMetrics = useMemo(() => {
    let totalBilled = 0;
    let totalPaid = 0;
    let totalOutstanding = 0;
    let overdueCount = 0;
    let overdueAmount = 0;
    let unpaidCount = 0;
    let paidCount = 0;

    bills.forEach(b => {
      const gTotal = Number(b.netPayableAmount || b.grandTotal || 0);
      const paid = Number(b.paidAmount || 0);
      const balance = Number(b.balanceAmount !== undefined ? b.balanceAmount : gTotal - paid);

      totalBilled += gTotal;
      totalPaid += paid;
      totalOutstanding += balance;

      const st = (b.paymentStatus || 'Unpaid').toLowerCase();
      if (st === 'overdue') {
        overdueCount++;
        overdueAmount += balance;
      } else if (st === 'paid') {
        paidCount++;
      } else {
        unpaidCount++;
      }
    });

    return {
      totalBills: bills.length,
      totalBilled,
      totalPaid,
      totalOutstanding,
      overdueCount,
      overdueAmount,
      unpaidCount,
      paidCount
    };
  }, [bills]);

  // Delete Bill
  const handleDeleteBill = async (bill: PurchaseBill) => {
    const confirmed = await showDestructiveConfirm({
      title: `Delete Job Work Bill ${bill.billNumber}?`,
      text: "Are you sure you want to delete this bill? This will rollback the billed status on any linked Job Work Challan.",
      confirmButtonText: "Yes, Delete Bill"
    });
    if (!confirmed) return;
    try {
      await apiDelete(`/api/purchase/bill/${bill._id}`, token);
      showSuccessToast("Job Work Bill deleted successfully");
      onRefresh();
    } catch (err: any) {
      showErrorDialog("Error", err.message || "Failed to delete bill");
    }
  };

  return (
    <div className="space-y-4">
      
      {/* Financial KPI Cards (Collapsible, hidden by default) */}
      {showDashboard && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
          
          {/* Total Billed */}
          <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Total Billed</div>
            <div className="text-xl font-black text-slate-900 dark:text-white mt-1">
              ₹{calculatedMetrics.totalBilled.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">{calculatedMetrics.totalBills} Job Work Invoices</div>
          </div>

          {/* Paid Amount */}
          <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-100 dark:border-emerald-950/60 shadow-2xs">
            <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">Paid Amount</div>
            <div className="text-xl font-black text-emerald-700 dark:text-emerald-300 mt-1">
              ₹{calculatedMetrics.totalPaid.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div className="text-[10px] text-emerald-500/70 mt-0.5">{calculatedMetrics.paidCount} Fully Paid</div>
          </div>

          {/* Outstanding Balance */}
          <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-amber-100 dark:border-amber-950/60 shadow-2xs">
            <div className="text-[11px] font-bold text-amber-600 dark:text-amber-400">Balance Payable</div>
            <div className="text-xl font-black text-amber-700 dark:text-amber-300 mt-1">
              ₹{calculatedMetrics.totalOutstanding.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div className="text-[10px] text-amber-500/70 mt-0.5">{calculatedMetrics.unpaidCount} Pending Payments</div>
          </div>

          {/* Overdue Amount */}
          <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-rose-100 dark:border-rose-950/60 shadow-2xs">
            <div className="text-[11px] font-bold text-rose-600 dark:text-rose-400">Overdue Liabilities</div>
            <div className="text-xl font-black text-rose-700 dark:text-rose-300 mt-1">
              ₹{calculatedMetrics.overdueAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div className="text-[10px] text-rose-500/70 mt-0.5">{calculatedMetrics.overdueCount} Overdue Bills</div>
          </div>

          {/* Total Bills Count */}
          <div className="hidden lg:block p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-950/60 shadow-2xs">
            <div className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">Invoice Registry</div>
            <div className="text-xl font-black text-indigo-700 dark:text-indigo-300 mt-1">
              {calculatedMetrics.totalBills}
            </div>
            <div className="text-[10px] text-indigo-500/70 mt-0.5">TDS 194C Compliant</div>
          </div>

        </div>
      )}

      {/* Action Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
        
        {/* Left: Filters */}
        <div className="flex flex-wrap items-center gap-2 flex-1">
          
          {/* Search */}
          <div className="relative min-w-[200px] flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search bill #, invoice, vendor..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Payment Status Filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
          >
            <option value="all">All Payment Status</option>
            <option value="unpaid">Unpaid</option>
            <option value="partially paid">Partially Paid</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
          </select>

          {/* Vendor Filter */}
          <select
            value={vendorFilter}
            onChange={e => setVendorFilter(e.target.value)}
            className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 max-w-[180px] truncate"
          >
            <option value="all">All Vendors</option>
            {vendors.map(v => (
              <option key={v._id || v.id} value={v._id || v.id}>
                {v.name || v.vendorName}
              </option>
            ))}
          </select>

          {/* Date Picker */}
          <div className="flex items-center gap-1">
            <input
              type="date"
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
              className="px-2 py-1 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
            />
            {dateFilter && (
              <button
                onClick={() => setDateFilter('')}
                className="p-1 text-slate-400 hover:text-slate-600 text-xs"
                title="Clear date"
              >
                ✕
              </button>
            )}
          </div>

          {/* Dashboard Expand/Collapse Toggle */}
          <button
            onClick={() => setShowDashboard(prev => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
              showDashboard
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-300'
                : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
            title="Toggle Financial Dashboard"
          >
            <LayoutDashboard size={13} />
            <span>Financials</span>
            {showDashboard ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>

          {/* Refresh */}
          <button
            onClick={onRefresh}
            className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 cursor-pointer"
            title="Refresh bills"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        {/* Right: Record Bill Button */}
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-500/25 transition-all active:scale-95 cursor-pointer shrink-0"
        >
          <Plus size={15} />
          <span>Record Job Work Bill</span>
        </button>
      </div>

      {/* Main Bills Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-3.5">Bill # & Date</th>
                <th className="py-3 px-3.5">Vendor / Subcontractor</th>
                <th className="py-3 px-3.5">Linked Reference</th>
                <th className="py-3 px-3.5 min-w-[200px]">Service Items</th>
                <th className="py-3 px-3.5 text-right">Invoice Total</th>
                <th className="py-3 px-3.5 text-right">Net Payable / Balance</th>
                <th className="py-3 px-3.5 text-center">Status</th>
                <th className="py-3 px-3.5 text-right min-w-[140px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredBills.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <IndianRupee size={32} className="text-slate-300 dark:text-slate-700" />
                      <p className="font-semibold text-xs">No Job Work Bills found</p>
                      <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="mt-1 text-xs text-emerald-600 font-bold hover:underline cursor-pointer"
                      >
                        Record your first Job Work Bill
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredBills.map(bill => {
                  const status = bill.paymentStatus || 'Unpaid';
                  const isPaid = status.toLowerCase() === 'paid';
                  const isPartially = status.toLowerCase() === 'partially paid';
                  const isOverdue = status.toLowerCase() === 'overdue';

                  const badgeClass = isPaid
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900'
                    : isOverdue
                    ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-900'
                    : isPartially
                    ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900'
                    : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-900';

                  const netPayable = Number(bill.netPayableAmount || bill.grandTotal || 0);
                  const paid = Number(bill.paidAmount || 0);
                  const balance = Number(bill.balanceAmount !== undefined ? bill.balanceAmount : netPayable - paid);

                  return (
                    <tr key={bill._id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      
                      {/* Bill # & Date */}
                      <td className="py-3 px-3.5">
                        <div className="font-black text-slate-900 dark:text-white">
                          {bill.billNumber}
                        </div>
                        {bill.supplierInvoiceNumber && (
                          <div className="text-[11px] text-slate-500 font-medium">
                            Inv: {bill.supplierInvoiceNumber}
                          </div>
                        )}
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {formatDateTime(bill.date)}
                        </div>
                      </td>

                      {/* Vendor */}
                      <td className="py-3 px-3.5">
                        <div className="font-bold text-slate-800 dark:text-slate-200">
                          {bill.vendorName || bill.vendor?.name || 'Subcontractor'}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {bill.vendor?.gstNumber || bill.vendor?.gst || ''}
                        </div>
                      </td>

                      {/* Linked Reference */}
                      <td className="py-3 px-3.5">
                        {bill.jobWorkChallanNumber ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-900">
                            <Truck size={11} />
                            <span>DC: {bill.jobWorkChallanNumber}</span>
                          </span>
                        ) : bill.poNumber ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900">
                            <FileCheck2 size={11} />
                            <span>PO: {bill.poNumber}</span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">
                            Direct Service
                          </span>
                        )}
                      </td>

                      {/* Items (Item Name & Description & Process Type & SAC) */}
                      <td className="py-3 px-3.5">
                        <div className="space-y-1 max-w-sm">
                          {(bill.items || []).slice(0, 2).map((it, idx) => (
                            <div key={idx} className="space-y-0.5">
                              <ItemNameAndDescription
                                name={it.materialName || it.serviceName || 'Service Item'}
                                description={it.description || ''}
                              />
                              {(it.processType || it.sacCode) && (
                                <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-[10px]">
                                  {it.processType && (
                                    <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold border border-emerald-200/50">
                                      {it.processType}
                                    </span>
                                  )}
                                  {it.sacCode && (
                                    <span className="text-slate-400 font-mono">
                                      SAC: {it.sacCode}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                          {(bill.items || []).length > 2 && (
                            <span className="text-[10px] font-bold text-slate-400">
                              +{(bill.items || []).length - 2} more items
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Invoice Total & TDS */}
                      <td className="py-3 px-3.5 text-right">
                        <div className="font-black text-slate-900 dark:text-white">
                          ₹{Number(bill.grandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                        {bill.tdsApplicable && Number(bill.tdsAmount || 0) > 0 && (
                          <div className="text-[10px] text-rose-500 font-semibold mt-0.5">
                            TDS 194C: -₹{Number(bill.tdsAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </div>
                        )}
                      </td>

                      {/* Net Payable & Balance */}
                      <td className="py-3 px-3.5 text-right">
                        <div className="font-black text-emerald-600 dark:text-emerald-400">
                          ₹{netPayable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                          Bal: ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3.5 text-center">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${badgeClass}`}>
                          {status}
                        </span>
                        {bill.dueDate && (
                          <div className="text-[10px] text-slate-400 mt-1">
                            Due: {formatDateTime(bill.dueDate)}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          
                          {/* Record Payment Button */}
                          {!isPaid && (
                            <button
                              onClick={() => setPaymentModalBill(bill)}
                              title="Record Payment"
                              className="px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 rounded-lg transition-colors flex items-center gap-1 cursor-pointer active:scale-95"
                            >
                              <CreditCard size={12} />
                              <span>Pay</span>
                            </button>
                          )}

                          {/* View Detail & Notes */}
                          <button
                            onClick={() => setDetailModalBill(bill)}
                            title="View Details & Comments"
                            className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                          >
                            <Eye size={14} />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => handleDeleteBill(bill)}
                            title="Delete Bill"
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>

                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Job Work Bill Modal */}
      {isCreateModalOpen && (
        <JobWorkBillModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            showSuccessToast("Job Work Bill recorded successfully");
            onRefresh();
          }}
          vendors={vendors}
        />
      )}

      {/* Record Payment Modal */}
      {paymentModalBill && (
        <RecordPaymentModal
          bill={paymentModalBill}
          isOpen={Boolean(paymentModalBill)}
          onClose={() => setPaymentModalBill(null)}
          onSuccess={() => {
            showSuccessToast("Payment recorded successfully");
            setPaymentModalBill(null);
            onRefresh();
          }}
        />
      )}

      {/* Bill Detail / View Modal */}
      {detailModalBill && (
        <PurchaseBillDetailModal
          bill={detailModalBill}
          isOpen={Boolean(detailModalBill)}
          onClose={() => setDetailModalBill(null)}
          onRefresh={onRefresh}
          onOpenRecordPayment={() => {
            const b = detailModalBill;
            setDetailModalBill(null);
            setPaymentModalBill(b);
          }}
        />
      )}

    </div>
  );
}

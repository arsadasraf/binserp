"use client";

import React, { useState, useMemo } from 'react';
import { 
  Calendar, 
  Download, 
  Printer, 
  Search, 
  Filter, 
  Package, 
  Layers, 
  ShoppingCart, 
  Boxes, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  User, 
  Building2, 
  FileText,
  Eye,
  RefreshCw
} from 'lucide-react';
import { generateMaterialRequestReportPDF } from '@/src/utils/generateMaterialRequestReportPDF';

interface MaterialRequestLedgerTableProps {
  requests: any[];
  onView: (req: any) => void;
  loading?: boolean;
}

export default function MaterialRequestLedgerTable({
  requests,
  onView,
  loading
}: MaterialRequestLedgerTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [userFilter, setUserFilter] = useState<string>('All');
  const [departmentFilter, setDepartmentFilter] = useState<string>('All');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'yesterday' | '7days' | 'thisMonth' | 'custom'>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Extract unique users and departments for dropdowns
  const uniqueUsers = useMemo(() => {
    const map = new Map<string, string>();
    requests.forEach(r => {
      const uId = r.requestedBy?._id || r.requestedBy?.userId || r.createdBy;
      const uName = r.requestedBy?.name || r.createdByName;
      if (uId && uName) map.set(String(uId), uName);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [requests]);

  const uniqueDepartments = useMemo(() => {
    const set = new Set<string>();
    requests.forEach(r => {
      const dept = r.department || r.requestedBy?.department;
      if (dept) set.add(dept);
    });
    return Array.from(set);
  }, [requests]);

  // Date Filtering Helper
  const isDateInRange = (dateStr?: string) => {
    if (!dateStr || dateFilter === 'all') return true;
    const d = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (dateFilter === 'today') {
      const reqD = new Date(d);
      reqD.setHours(0, 0, 0, 0);
      return reqD.getTime() === today.getTime();
    }
    if (dateFilter === 'yesterday') {
      const yest = new Date(today);
      yest.setDate(yest.getDate() - 1);
      const reqD = new Date(d);
      reqD.setHours(0, 0, 0, 0);
      return reqD.getTime() === yest.getTime();
    }
    if (dateFilter === '7days') {
      const past7 = new Date(today);
      past7.setDate(past7.getDate() - 7);
      return d >= past7;
    }
    if (dateFilter === 'thisMonth') {
      return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
    }
    if (dateFilter === 'custom') {
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        if (d < start) return false;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (d > end) return false;
      }
      return true;
    }
    return true;
  };

  // Filtered requests list
  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      // 1. Search filter
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const reqNum = (req.requestNumber || '').toLowerCase();
        const reqBy = (req.requestedBy?.name || req.createdByName || '').toLowerCase();
        const mrp = (req.mrpNumber || '').toLowerCase();
        const itemsMatch = (req.items || []).some((it: any) => 
          (it.materialName || '').toLowerCase().includes(q) ||
          (it.materialCode || '').toLowerCase().includes(q) ||
          (it.purpose || '').toLowerCase().includes(q)
        );
        if (!reqNum.includes(q) && !reqBy.includes(q) && !mrp.includes(q) && !itemsMatch) {
          return false;
        }
      }

      // 2. Type filter
      if (typeFilter !== 'All') {
        const norm = (req.type || 'rm').toLowerCase();
        const t = typeFilter.toLowerCase();
        if (t === 'rm' && norm !== 'rm' && norm !== 'raw-material') return false;
        if (t === 'bo' && norm !== 'bo' && norm !== 'bought-out') return false;
        if (t === 'consumable' && norm !== 'consumable') return false;
        if (t === 'fg' && norm !== 'fg' && norm !== 'inhouse') return false;
      }

      // 3. Status filter
      if (statusFilter !== 'All' && req.status !== statusFilter) {
        return false;
      }

      // 4. User filter
      if (userFilter !== 'All') {
        const uId = req.requestedBy?._id || req.requestedBy?.userId || req.createdBy;
        if (String(uId) !== String(userFilter)) return false;
      }

      // 5. Department filter
      if (departmentFilter !== 'All') {
        const dept = req.department || req.requestedBy?.department;
        if (dept !== departmentFilter) return false;
      }

      // 6. Date filter
      if (!isDateInRange(req.createdAt)) {
        return false;
      }

      return true;
    });
  }, [requests, searchTerm, typeFilter, statusFilter, userFilter, departmentFilter, dateFilter, startDate, endDate]);

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredRequests.length === 0) {
      alert("No records to export.");
      return;
    }

    const headers = [
      "Request Number",
      "Date",
      "Type",
      "Status",
      "Requested By",
      "Department",
      "Item Name",
      "Item Code",
      "Quantity",
      "Unit",
      "Purpose",
      "Issued By",
      "Issue Date"
    ];

    const rows: string[][] = [];
    filteredRequests.forEach(req => {
      const dateStr = req.createdAt ? new Date(req.createdAt).toISOString().split('T')[0] : '';
      const requester = req.requestedBy?.name || req.createdByName || 'User';
      const dept = req.department || req.requestedBy?.department || 'General';
      const status = req.status || 'Pending';
      const type = (req.type || 'rm').toUpperCase();
      const issuer = req.issuedByName || req.issuedBy?.name || '';
      const issueDate = req.issuedAt ? new Date(req.issuedAt).toISOString().split('T')[0] : '';

      (req.items || []).forEach((item: any) => {
        rows.push([
          `"${req.requestNumber}"`,
          `"${dateStr}"`,
          `"${type}"`,
          `"${status}"`,
          `"${requester}"`,
          `"${dept}"`,
          `"${(item.materialName || item.name || '').replace(/"/g, '""')}"`,
          `"${item.materialCode || ''}"`,
          `"${item.quantity || 0}"`,
          `"${item.unit || 'PCS'}"`,
          `"${(item.purpose || '').replace(/"/g, '""')}"`,
          `"${issuer}"`,
          `"${issueDate}"`
        ]);
      });
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Material_Requests_Ledger_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print PDF Report
  const handlePrintReport = () => {
    generateMaterialRequestReportPDF(filteredRequests, {
      type: typeFilter,
      status: statusFilter,
      department: departmentFilter,
      startDate,
      endDate
    });
  };

  // KPIs
  const totalRequests = filteredRequests.length;
  const pendingCount = filteredRequests.filter(r => r.status === 'Pending').length;
  const approvedCount = filteredRequests.filter(r => r.status === 'Approved').length;
  const issuedCount = filteredRequests.filter(r => r.status === 'Issued').length;
  const rejectedCount = filteredRequests.filter(r => r.status === 'Rejected').length;

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Requisitions</div>
          <div className="text-xl font-black text-slate-900 dark:text-white mt-1">{totalRequests}</div>
        </div>
        <div className="bg-amber-50 dark:bg-amber-950/40 p-3.5 rounded-2xl border border-amber-200 dark:border-amber-900/60 shadow-2xs">
          <div className="text-[11px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1">
            <Clock size={13} /> Pending
          </div>
          <div className="text-xl font-black text-amber-700 dark:text-amber-300 mt-1">{pendingCount}</div>
        </div>
        <div className="bg-indigo-50 dark:bg-indigo-950/40 p-3.5 rounded-2xl border border-indigo-200 dark:border-indigo-900/60 shadow-2xs">
          <div className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider flex items-center gap-1">
            <CheckCircle2 size={13} /> Approved
          </div>
          <div className="text-xl font-black text-indigo-700 dark:text-indigo-300 mt-1">{approvedCount}</div>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-950/40 p-3.5 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 shadow-2xs">
          <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1">
            <Package size={13} /> Issued
          </div>
          <div className="text-xl font-black text-emerald-700 dark:text-emerald-300 mt-1">{issuedCount}</div>
        </div>
        <div className="bg-rose-50 dark:bg-rose-950/40 p-3.5 rounded-2xl border border-rose-200 dark:border-rose-900/60 shadow-2xs col-span-2 sm:col-span-1">
          <div className="text-[11px] font-bold text-rose-700 dark:text-rose-300 uppercase tracking-wider flex items-center gap-1">
            <XCircle size={13} /> Rejected
          </div>
          <div className="text-xl font-black text-rose-700 dark:text-rose-300 mt-1">{rejectedCount}</div>
        </div>
      </div>

      {/* Action Toolbar & Filters */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search by Req #, item name, code, purpose, user..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Quick Date Range Pills */}
          <div className="flex flex-wrap items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            {(['all', 'today', 'yesterday', '7days', 'thisMonth', 'custom'] as const).map(pill => (
              <button
                key={pill}
                type="button"
                onClick={() => setDateFilter(pill)}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  dateFilter === pill
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {pill === 'all' && 'All Time'}
                {pill === 'today' && 'Today'}
                {pill === 'yesterday' && 'Yesterday'}
                {pill === '7days' && 'Last 7 Days'}
                {pill === 'thisMonth' && 'This Month'}
                {pill === 'custom' && 'Custom'}
              </button>
            ))}
          </div>

          {/* Export & Print Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrintReport}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
              title="Print / Save PDF Report"
            >
              <Printer size={15} /> Print Report
            </button>
            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors cursor-pointer shadow-xs"
              title="Export to CSV"
            >
              <Download size={15} /> Export CSV
            </button>
          </div>
        </div>

        {/* Custom Date Pickers if 'custom' is active */}
        {dateFilter === 'custom' && (
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500">From:</span>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500">To:</span>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white"
              />
            </div>
          </div>
        )}

        {/* Filter Dropdowns Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          {/* Type Filter */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Type</label>
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold dark:text-white"
            >
              <option value="All">All Types (RM/BO/Cons/FG)</option>
              <option value="consumable">Consumables Only</option>
              <option value="rm">Raw Materials (RM) Only</option>
              <option value="bo">Bought-Out (BO) Only</option>
              <option value="fg">Finished Goods (FG) Only</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold dark:text-white"
            >
              <option value="All">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Issued">Issued</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          {/* User Filter */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Requested By</label>
            <select
              value={userFilter}
              onChange={e => setUserFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold dark:text-white"
            >
              <option value="All">All Users</option>
              {uniqueUsers.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          {/* Department Filter */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Department</label>
            <select
              value={departmentFilter}
              onChange={e => setDepartmentFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold dark:text-white"
            >
              <option value="All">All Departments</option>
              {uniqueDepartments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="p-3.5">Req # & Date</th>
                <th className="p-3.5">Type</th>
                <th className="p-3.5">Requester / Dept</th>
                <th className="p-3.5">Item(s) Details</th>
                <th className="p-3.5 text-center">Req Qty</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5 text-center">Fulfillment</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    <FileText className="mx-auto mb-2 text-slate-300 dark:text-slate-600" size={32} />
                    <p className="font-semibold">No material requests found</p>
                    <p className="text-[11px] text-slate-400">Try adjusting your filters or date range</p>
                  </td>
                </tr>
              ) : (
                filteredRequests.map(req => {
                  const dateStr = req.createdAt ? new Date(req.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
                  const normType = (req.type || 'rm').toLowerCase();
                  const requester = req.requestedBy?.name || req.createdByName || 'User';
                  const dept = req.department || req.requestedBy?.department || 'General';

                  return (
                    <tr 
                      key={req._id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                      onClick={() => onView(req)}
                    >
                      <td className="p-3.5">
                        <div className="font-mono font-bold text-blue-600 dark:text-blue-400">{req.requestNumber}</div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Calendar size={11} /> {dateStr}
                        </div>
                      </td>
                      <td className="p-3.5">
                        {normType === 'consumable' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60">
                            <Package size={11} /> Consumable
                          </span>
                        ) : normType === 'bo' || normType === 'bought-out' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60">
                            <ShoppingCart size={11} /> Bought Out
                          </span>
                        ) : normType === 'fg' || normType === 'inhouse' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-900/60">
                            <Boxes size={11} /> FG
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/60">
                            <Layers size={11} /> Raw Material
                          </span>
                        )}
                      </td>
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1">
                          <User size={12} className="text-slate-400" /> {requester}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Building2 size={11} /> {dept}
                        </div>
                      </td>
                      <td className="p-3.5">
                        <div className="space-y-1">
                          {(req.items || []).slice(0, 2).map((it: any, iIdx: number) => (
                            <div key={iIdx} className="text-xs">
                              <span className="font-semibold text-slate-800 dark:text-slate-200">{it.materialName || it.name}</span>
                              {it.materialCode && <span className="text-[10px] text-slate-400 font-mono ml-1">({it.materialCode})</span>}
                            </div>
                          ))}
                          {(req.items?.length || 0) > 2 && (
                            <span className="text-[10px] text-blue-600 font-bold">
                              +{(req.items?.length || 0) - 2} more items
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3.5 text-center">
                        <div className="font-mono font-bold text-slate-800 dark:text-slate-200">
                          {(req.items || []).reduce((acc: number, it: any) => acc + (Number(it.quantity) || 0), 0)}
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {req.items?.[0]?.unit || 'Units'}
                        </span>
                      </td>
                      <td className="p-3.5 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                          req.status === 'Issued' ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' :
                          req.status === 'Approved' ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800' :
                          req.status === 'Rejected' ? 'bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800' :
                          'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                        }`}>
                          {req.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-center text-[11px]">
                        {req.status === 'Issued' ? (
                          <div>
                            <span className="font-semibold text-emerald-700 dark:text-emerald-300">{req.issuedByName || req.issuedBy?.name || 'Store'}</span>
                            <div className="text-[10px] text-slate-400">
                              {req.issuedAt ? new Date(req.issuedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : ''}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">-</span>
                        )}
                      </td>
                      <td className="p-3.5 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onView(req);
                          }}
                          className="px-2.5 py-1 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1"
                        >
                          <Eye size={12} /> View
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

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
  RefreshCw,
  ChevronRight,
  SlidersHorizontal,
  Hash
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
  const [showFiltersMobile, setShowFiltersMobile] = useState<boolean>(false);

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
        const so = (req.soNumber || req.salesOrder?.orderNumber || '').toLowerCase();
        const itemsMatch = (req.items || []).some((it: any) => 
          (it.materialName || '').toLowerCase().includes(q) ||
          (it.materialDescription || it.description || '').toLowerCase().includes(q) ||
          (it.purpose || '').toLowerCase().includes(q)
        );
        if (!reqNum.includes(q) && !reqBy.includes(q) && !mrp.includes(q) && !so.includes(q) && !itemsMatch) {
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
      "Target MRP / SO",
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
      const targetDoc = req.mrpNumber ? `MRP: ${req.mrpNumber}` : (req.soNumber || req.salesOrder?.orderNumber ? `SO: ${req.soNumber || req.salesOrder?.orderNumber}` : 'General');
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
          `"${targetDoc}"`,
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

  const renderTypeBadge = (rawType?: string) => {
    const norm = (rawType || 'rm').toLowerCase();
    if (norm === 'consumable') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60">
          <Package size={11} /> Consumable
        </span>
      );
    }
    if (norm === 'bo' || norm === 'bought-out') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60">
          <ShoppingCart size={11} /> Bought Out
        </span>
      );
    }
    if (norm === 'fg' || norm === 'inhouse') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-900/60">
          <Boxes size={11} /> FG
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/60">
        <Layers size={11} /> Raw Material
      </span>
    );
  };

  const renderStatusBadge = (status?: string) => {
    const st = status || 'Pending';
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold border ${
        st === 'Issued' ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' :
        st === 'Approved' ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800' :
        st === 'Rejected' ? 'bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800' :
        'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
      }`}>
        {st === 'Issued' && <CheckCircle2 size={11} />}
        {st === 'Approved' && <CheckCircle2 size={11} />}
        {st === 'Rejected' && <XCircle size={11} />}
        {st === 'Pending' && <Clock size={11} />}
        <span>{st}</span>
      </span>
    );
  };

  const activeFiltersCount = (typeFilter !== 'All' ? 1 : 0) +
    (statusFilter !== 'All' ? 1 : 0) +
    (userFilter !== 'All' ? 1 : 0) +
    (departmentFilter !== 'All' ? 1 : 0) +
    (dateFilter !== 'all' ? 1 : 0);

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 sm:gap-3">
        <div className="bg-white dark:bg-slate-900 p-3 sm:p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Requisitions</div>
          <div className="text-lg sm:text-xl font-black text-slate-900 dark:text-white mt-1">{totalRequests}</div>
        </div>
        <div className="bg-amber-50 dark:bg-amber-950/40 p-3 sm:p-3.5 rounded-2xl border border-amber-200 dark:border-amber-900/60 shadow-2xs">
          <div className="text-[10px] sm:text-[11px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1">
            <Clock size={12} /> Pending
          </div>
          <div className="text-lg sm:text-xl font-black text-amber-700 dark:text-amber-300 mt-1">{pendingCount}</div>
        </div>
        <div className="bg-indigo-50 dark:bg-indigo-950/40 p-3 sm:p-3.5 rounded-2xl border border-indigo-200 dark:border-indigo-900/60 shadow-2xs">
          <div className="text-[10px] sm:text-[11px] font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider flex items-center gap-1">
            <CheckCircle2 size={12} /> Approved
          </div>
          <div className="text-lg sm:text-xl font-black text-indigo-700 dark:text-indigo-300 mt-1">{approvedCount}</div>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-950/40 p-3 sm:p-3.5 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 shadow-2xs">
          <div className="text-[10px] sm:text-[11px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1">
            <Package size={12} /> Issued
          </div>
          <div className="text-lg sm:text-xl font-black text-emerald-700 dark:text-emerald-300 mt-1">{issuedCount}</div>
        </div>
        <div className="bg-rose-50 dark:bg-rose-950/40 p-3 sm:p-3.5 rounded-2xl border border-rose-200 dark:border-rose-900/60 shadow-2xs col-span-2 sm:col-span-1">
          <div className="text-[10px] sm:text-[11px] font-bold text-rose-700 dark:text-rose-300 uppercase tracking-wider flex items-center gap-1">
            <XCircle size={12} /> Rejected
          </div>
          <div className="text-lg sm:text-xl font-black text-rose-700 dark:text-rose-300 mt-1">{rejectedCount}</div>
        </div>
      </div>

      {/* Action Toolbar & Filters */}
      <div className="bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row gap-2.5 sm:gap-3 items-stretch lg:items-center justify-between">
          {/* Search Input & Mobile Filter Toggle */}
          <div className="flex items-center gap-2 flex-1">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
              <input
                type="text"
                placeholder="Search by Req #, item, code, user, SO/MRP..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 sm:py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            {/* Mobile Filter Toggle Button */}
            <button
              type="button"
              onClick={() => setShowFiltersMobile(!showFiltersMobile)}
              className={`lg:hidden flex items-center gap-1.5 px-3 py-1.5 sm:py-2 text-xs font-bold rounded-xl border transition-colors cursor-pointer shrink-0 ${
                showFiltersMobile || activeFiltersCount > 0
                  ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400'
                  : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              <SlidersHorizontal size={14} />
              <span>Filters</span>
              {activeFiltersCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold">
                  {activeFiltersCount}
                </span>
              )}
            </button>
          </div>

          {/* Quick Date Range Pills (Horizontal Scroll on Mobile) */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl overflow-x-auto no-scrollbar pb-1 sm:pb-1">
            {(['all', 'today', 'yesterday', '7days', 'thisMonth', 'custom'] as const).map(pill => (
              <button
                key={pill}
                type="button"
                onClick={() => setDateFilter(pill)}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
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
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 sm:py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
              title="Print / Save PDF Report"
            >
              <Printer size={14} /> <span>Print</span>
            </button>
            <button
              type="button"
              onClick={handleExportCSV}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 sm:py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors cursor-pointer shadow-xs"
              title="Export to CSV"
            >
              <Download size={14} /> <span>Export CSV</span>
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

        {/* Filter Dropdowns (Always shown on desktop, collapsible on mobile) */}
        <div className={`grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs ${showFiltersMobile ? 'grid' : 'hidden lg:grid'}`}>
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

      {/* Content Section: Empty State OR (Desktop Table + Mobile Cards) */}
      {filteredRequests.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 sm:p-12 text-center border border-slate-200 dark:border-slate-800 shadow-2xs">
          <FileText className="mx-auto mb-2 text-slate-300 dark:text-slate-600" size={36} />
          <h4 className="font-bold text-slate-700 dark:text-slate-300 text-sm">No Material Requests Found</h4>
          <p className="text-xs text-slate-400 mt-0.5">Try adjusting your search query, date filter, or categories</p>
        </div>
      ) : (
        <>
          {/* 1. DESKTOP TABLE VIEW (Visible on >= md screens) */}
          <div className="hidden md:block bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="p-3.5">Req # & Date</th>
                    <th className="p-3.5">Type</th>
                    <th className="p-3.5">Target SO / MRP</th>
                    <th className="p-3.5">Requester / Dept</th>
                    <th className="p-3.5">Item(s) Details</th>
                    <th className="p-3.5 text-center">Req Qty</th>
                    <th className="p-3.5 text-center">Status</th>
                    <th className="p-3.5 text-center">Fulfillment</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {filteredRequests.map(req => {
                    const dateStr = req.createdAt ? new Date(req.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
                    const requester = req.requestedBy?.name || req.createdByName || 'User';
                    const dept = req.department || req.requestedBy?.department || 'General';
                    const itemsCount = req.items?.length || 0;
                    const totalQty = (req.items || []).reduce((acc: number, it: any) => acc + (Number(it.quantity) || 0), 0);

                    return (
                      <tr 
                        key={req._id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group"
                        onClick={() => onView(req)}
                      >
                        <td className="p-3.5">
                          <div className="font-mono font-bold text-blue-600 dark:text-blue-400 group-hover:underline">{req.requestNumber}</div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <Calendar size={11} /> {dateStr}
                          </div>
                        </td>
                        <td className="p-3.5">
                          {renderTypeBadge(req.type)}
                        </td>
                        <td className="p-3.5 whitespace-nowrap font-mono text-[11px]">
                          {req.mrpNumber ? (
                            <span className="text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                              MRP: {req.mrpNumber}
                            </span>
                          ) : req.soNumber || req.salesOrder?.orderNumber ? (
                            <span className="text-slate-700 dark:text-slate-300 font-semibold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                              SO: {req.soNumber || req.salesOrder?.orderNumber}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">General Store</span>
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
                            {(req.items || []).slice(0, 2).map((it: any, iIdx: number) => {
                              const desc = it.materialDescription || it.description || it.specification || '';
                              return (
                                <div key={iIdx} className="text-xs">
                                  <span className="font-semibold text-slate-800 dark:text-slate-200">{it.materialName || it.name}</span>
                                  {desc && (
                                    <div className="text-[10.5px] text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
                                      {desc}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                            {itemsCount > 2 && (
                              <span className="text-[10px] text-blue-600 font-bold">
                                +{itemsCount - 2} more items
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3.5 text-center">
                          <div className="font-mono font-bold text-slate-800 dark:text-slate-200">
                            {totalQty}
                          </div>
                          <span className="text-[10px] text-slate-400">
                            {req.items?.[0]?.unit || 'Units'}
                          </span>
                        </td>
                        <td className="p-3.5 text-center">
                          {renderStatusBadge(req.status)}
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
                        <td className="p-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => onView(req)}
                            className="px-2.5 py-1 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1"
                          >
                            <Eye size={12} /> View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 2. MOBILE CARD VIEW (Visible on < md screens) */}
          <div className="md:hidden space-y-3">
            {filteredRequests.map(req => {
              const dateStr = req.createdAt ? new Date(req.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
              const requester = req.requestedBy?.name || req.createdByName || 'User';
              const dept = req.department || req.requestedBy?.department || 'General';
              const itemsCount = req.items?.length || 0;
              const totalQty = (req.items || []).reduce((acc: number, it: any) => acc + (Number(it.quantity) || 0), 0);

              return (
                <div
                  key={req._id}
                  onClick={() => onView(req)}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-2xs hover:border-blue-400 dark:hover:border-blue-600 transition-all cursor-pointer space-y-3"
                >
                  {/* Top Card Row: Req #, Date & Badges */}
                  <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
                    <div>
                      <div className="font-mono font-black text-sm text-blue-600 dark:text-blue-400">
                        {req.requestNumber}
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <Calendar size={11} /> {dateStr}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      {renderStatusBadge(req.status)}
                      <div className="scale-95 origin-right">
                        {renderTypeBadge(req.type)}
                      </div>
                    </div>
                  </div>

                  {/* Context: Target MRP/SO & Requester */}
                  <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                    <div className="flex items-center gap-1 font-semibold">
                      <User size={13} className="text-slate-400 shrink-0" />
                      <span className="truncate max-w-[140px]">{requester}</span>
                      {dept && (
                        <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                          {dept}
                        </span>
                      )}
                    </div>

                    {/* Target SO / MRP if exists */}
                    {req.mrpNumber ? (
                      <span className="font-mono text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                        MRP: {req.mrpNumber}
                      </span>
                    ) : (req.soNumber || req.salesOrder?.orderNumber) ? (
                      <span className="font-mono text-[10px] font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                        SO: {req.soNumber || req.salesOrder?.orderNumber}
                      </span>
                    ) : null}
                  </div>

                  {/* Items Preview List Box */}
                  <div className="bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 text-xs space-y-1.5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between pb-1 border-b border-slate-200/60 dark:border-slate-700/60">
                      <span>Requested Item(s)</span>
                      <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                        Total Qty: {totalQty} {req.items?.[0]?.unit || 'Units'}
                      </span>
                    </div>

                    {(req.items || []).slice(0, 3).map((it: any, iIdx: number) => {
                      const desc = it.materialDescription || it.description || it.specification || '';
                      return (
                        <div key={iIdx} className="flex justify-between items-start text-xs">
                          <div className="truncate max-w-[70%]">
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              • {it.materialName || it.name}
                            </span>
                            {desc && (
                              <span className="text-[10.5px] text-slate-500 dark:text-slate-400 block ml-2">
                                {desc}
                              </span>
                            )}
                          </div>
                          <span className="font-mono font-bold text-slate-900 dark:text-white text-[11px] shrink-0">
                            {it.quantity} {it.unit || 'PCS'}
                          </span>
                        </div>
                      );
                    })}

                    {itemsCount > 3 && (
                      <div className="text-[10px] text-blue-600 dark:text-blue-400 font-bold pt-0.5">
                        +{itemsCount - 3} more item(s)
                      </div>
                    )}
                  </div>

                  {/* Fulfillment info if Issued */}
                  {req.status === 'Issued' && (
                    <div className="flex items-center justify-between text-[11px] bg-emerald-50/80 dark:bg-emerald-950/40 p-2 rounded-lg border border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-200">
                      <span className="flex items-center gap-1 font-medium">
                        <CheckCircle2 size={12} className="text-emerald-600 dark:text-emerald-400" />
                        Issued by <strong className="font-bold">{req.issuedByName || req.issuedBy?.name || 'Store'}</strong>
                      </span>
                      {req.issuedAt && (
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
                          {new Date(req.issuedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Bottom Action Footer */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 font-medium">
                      {itemsCount} item{itemsCount !== 1 ? 's' : ''} in request
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onView(req);
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 hover:bg-blue-100 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                    >
                      <Eye size={13} />
                      <span>View Details</span>
                      <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

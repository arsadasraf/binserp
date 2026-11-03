"use client";

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Search, Plus, Filter, Calendar, Download, Eye, Edit2, Trash2, 
  Truck, CheckCircle2, Clock, AlertCircle, Wrench, RefreshCw, 
  ExternalLink, Layers, ArrowUpRight, IndianRupee, FileText,
  LayoutDashboard, ChevronDown, ChevronUp, RotateCcw
} from 'lucide-react';
import { ItemNameAndDescription } from '@/src/utils/itemDisplayHelper';
import { isSpaceFreeMatch } from '@/src/utils/spaceFreeSearchHelper';
import { generateDocument } from '@/src/utils/documentHelper';
import JobWorkPOModal from '../modals/JobWorkPOModal';
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

type ExcelColKey = 'poNumber' | 'vendor' | 'process' | 'items' | 'progress' | 'total' | 'status';

interface JobWorkPOTableProps {
  data: any[];
  vendors?: any[];
  materials?: any[];
  inHouseItems?: any[];
  rawMaterials?: any[];
  boughtOuts?: any[];
  consumables?: any[];
  inventoryList?: any[];
  mrpPlans?: any[];
  companyInfo?: any;
  loading: boolean;
  onRefresh: () => void;
}

export default function JobWorkPOTable({
  data = [],
  vendors = [],
  materials = [],
  inHouseItems = [],
  companyInfo,
  loading,
  onRefresh
}: JobWorkPOTableProps) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';

  // Filter States
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [vendorFilter, setVendorFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [showDashboard, setShowDashboard] = useState<boolean>(false);

  // Excel Column Filter States (one per column)
  const [tableDropdownCol, setTableDropdownCol] = useState<ExcelColKey | null>(null);
  const [tableDropdownSearch, setTableDropdownSearch] = useState<string>('');
  const tableDropdownRef = useRef<HTMLDivElement | null>(null);

  const [selectedPoNumbers, setSelectedPoNumbers] = useState<string[]>([]);
  const [selectedExcelVendors, setSelectedExcelVendors] = useState<string[]>([]);
  const [selectedProcesses, setSelectedProcesses] = useState<string[]>([]);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [selectedProgress, setSelectedProgress] = useState<string[]>([]);
  const [selectedTotals, setSelectedTotals] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);

  // Modal States
  const [isPOModalOpen, setIsPOModalOpen] = useState<boolean>(false);
  const [editingPO, setEditingPO] = useState<any | null>(null);

  // Close Excel filter dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (tableDropdownRef.current && !tableDropdownRef.current.contains(e.target as Node)) {
        setTableDropdownCol(null);
        setTableDropdownSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Helper to extract display values per column for a PO row
  const getPoColValues = (po: any, colKey: ExcelColKey): string[] => {
    switch (colKey) {
      case 'poNumber': {
        const vals = [po.poNumber || '-'];
        if (po.challanNumber) vals.push(`DC: ${po.challanNumber}`);
        return vals;
      }
      case 'vendor':
        return [po.vendorName || po.vendor?.name || 'Subcontractor'];
      case 'process':
        return [`${po.processType || 'Standard Job Work'} (SAC: ${po.sacCode || '9988'})`];
      case 'items': {
        const poItems = Array.isArray(po.items) ? po.items : [];
        if (poItems.length === 0) return ['No Items'];
        return poItems.map((it: any) => it.materialName || it.material?.name || 'Process Item');
      }
      case 'progress': {
        const poItems = Array.isArray(po.items) ? po.items : [];
        const totalOrd = poItems.reduce((acc: number, it: any) => acc + (Number(it.quantity) || 0), 0);
        const totalRec = poItems.reduce((acc: number, it: any) => acc + (Number(it.receivedQuantity) || 0), 0);
        return [`${totalRec} / ${totalOrd}`];
      }
      case 'total': {
        const amt = Number(po.grandTotal) || Number(po.totalAmount) || 0;
        return [`₹${amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`];
      }
      case 'status':
        return [po.status || 'Released'];
    }
  };

  // Unique values per column for Excel Filter
  const uniqueColValues = useMemo(() => {
    const map: Record<ExcelColKey, string[]> = {
      poNumber: [],
      vendor: [],
      process: [],
      items: [],
      progress: [],
      total: [],
      status: []
    };
    const sets: Record<ExcelColKey, Set<string>> = {
      poNumber: new Set(),
      vendor: new Set(),
      process: new Set(),
      items: new Set(),
      progress: new Set(),
      total: new Set(),
      status: new Set()
    };

    data.forEach(po => {
      (Object.keys(sets) as ExcelColKey[]).forEach(col => {
        getPoColValues(po, col).forEach(v => {
          if (v) sets[col].add(v);
        });
      });
    });

    (Object.keys(sets) as ExcelColKey[]).forEach(col => {
      map[col] = Array.from(sets[col]).sort((a, b) => a.localeCompare(b));
    });
    return map;
  }, [data]);

  const getSelectedForCol = (colKey: ExcelColKey): string[] => {
    switch (colKey) {
      case 'poNumber': return selectedPoNumbers;
      case 'vendor': return selectedExcelVendors;
      case 'process': return selectedProcesses;
      case 'items': return selectedItems;
      case 'progress': return selectedProgress;
      case 'total': return selectedTotals;
      case 'status': return selectedStatuses;
    }
  };

  const setSelectedForCol = (colKey: ExcelColKey, next: string[]) => {
    switch (colKey) {
      case 'poNumber': setSelectedPoNumbers(next); break;
      case 'vendor': setSelectedExcelVendors(next); break;
      case 'process': setSelectedProcesses(next); break;
      case 'items': setSelectedItems(next); break;
      case 'progress': setSelectedProgress(next); break;
      case 'total': setSelectedTotals(next); break;
      case 'status': setSelectedStatuses(next); break;
    }
  };

  const getValueCount = (colKey: ExcelColKey, val: string): number => {
    return data.filter(po => getPoColValues(po, colKey).includes(val)).length;
  };

  const handleToggleExcelValue = (colKey: ExcelColKey, val: string) => {
    const curr = getSelectedForCol(colKey);
    const next = curr.includes(val) ? curr.filter(v => v !== val) : [...curr, val];
    setSelectedForCol(colKey, next);
  };

  const handleSelectAllExcel = (colKey: ExcelColKey, allValues: string[]) => {
    const curr = getSelectedForCol(colKey);
    if (curr.length === allValues.length) {
      setSelectedForCol(colKey, []);
    } else {
      setSelectedForCol(colKey, [...allValues]);
    }
  };

  const handleClearAllExcelFilters = () => {
    setSelectedPoNumbers([]);
    setSelectedExcelVendors([]);
    setSelectedProcesses([]);
    setSelectedItems([]);
    setSelectedProgress([]);
    setSelectedTotals([]);
    setSelectedStatuses([]);
  };

  const hasAnyExcelFilter =
    selectedPoNumbers.length > 0 ||
    selectedExcelVendors.length > 0 ||
    selectedProcesses.length > 0 ||
    selectedItems.length > 0 ||
    selectedProgress.length > 0 ||
    selectedTotals.length > 0 ||
    selectedStatuses.length > 0;

  // Filtered Data
  const filteredData = useMemo(() => {
    return data.filter(po => {
      // Top-bar Status Filter
      if (statusFilter !== 'all' && (po.status || 'Released').toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }

      // Top-bar Vendor Filter
      if (vendorFilter !== 'all') {
        const vId = po.vendor?._id || po.vendor;
        if (vId !== vendorFilter) return false;
      }

      // Top-bar Date Filter
      if (dateFilter) {
        const poDate = po.date ? new Date(po.date).toISOString().slice(0, 10) : '';
        if (poDate !== dateFilter) return false;
      }

      // Excel Column Filters
      if (selectedPoNumbers.length > 0 && !getPoColValues(po, 'poNumber').some(v => selectedPoNumbers.includes(v))) {
        return false;
      }
      if (selectedExcelVendors.length > 0 && !getPoColValues(po, 'vendor').some(v => selectedExcelVendors.includes(v))) {
        return false;
      }
      if (selectedProcesses.length > 0 && !getPoColValues(po, 'process').some(v => selectedProcesses.includes(v))) {
        return false;
      }
      if (selectedItems.length > 0 && !getPoColValues(po, 'items').some(v => selectedItems.includes(v))) {
        return false;
      }
      if (selectedProgress.length > 0 && !getPoColValues(po, 'progress').some(v => selectedProgress.includes(v))) {
        return false;
      }
      if (selectedTotals.length > 0 && !getPoColValues(po, 'total').some(v => selectedTotals.includes(v))) {
        return false;
      }
      if (selectedStatuses.length > 0 && !getPoColValues(po, 'status').some(v => selectedStatuses.includes(v))) {
        return false;
      }

      // Search Term (Space-free across poNumber, challanNumber, vendorName, processType, and items)
      if (searchTerm.trim()) {
        const vendorName = po.vendorName || po.vendor?.name || '';
        const itemNames = (po.items || []).map((it: any) => `${it.materialName || ''} ${it.description || ''}`).join(' ');
        const combined = `${po.poNumber || ''} ${po.challanNumber || ''} ${vendorName} ${po.processType || ''} ${po.sacCode || ''} ${itemNames}`;
        if (!isSpaceFreeMatch(combined, searchTerm)) {
          return false;
        }
      }

      return true;
    });
  }, [
    data,
    statusFilter,
    vendorFilter,
    dateFilter,
    searchTerm,
    selectedPoNumbers,
    selectedExcelVendors,
    selectedProcesses,
    selectedItems,
    selectedProgress,
    selectedTotals,
    selectedStatuses
  ]);

  // Operational Metrics
  const metrics = useMemo(() => {
    const totalPOs = data.length;
    let releasedPOs = 0;
    let partiallyReceived = 0;
    let completedPOs = 0;
    let totalOrderedValue = 0;
    let totalReceivedValue = 0;
    let totalPendingValue = 0;

    data.forEach(po => {
      const st = (po.status || 'Released').toLowerCase();
      if (st === 'completed') completedPOs++;
      else if (st === 'partially received') partiallyReceived++;
      else releasedPOs++;

      const poTotal = Number(po.grandTotal || po.totalAmount || 0);
      totalOrderedValue += poTotal;

      // Item level received/pending
      if (Array.isArray(po.items) && po.items.length > 0) {
        po.items.forEach((it: any) => {
          const qty = Number(it.quantity || 0);
          const recQty = Number(it.receivedQuantity || 0);
          const rate = Number(it.rate || 0);
          totalReceivedValue += recQty * rate;
          totalPendingValue += Math.max(0, qty - recQty) * rate;
        });
      } else {
        totalPendingValue += poTotal;
      }
    });

    return {
      totalPOs,
      releasedPOs,
      partiallyReceived,
      completedPOs,
      totalOrderedValue,
      totalReceivedValue,
      totalPendingValue
    };
  }, [data]);

  // Handle Edit PO
  const handleEdit = (po: any) => {
    setEditingPO(po);
    setIsPOModalOpen(true);
  };

  // Handle Delete PO
  const handleDelete = async (po: any) => {
    const confirmed = await showDestructiveConfirm({
      title: `Delete Job Work PO ${po.poNumber}?`,
      text: "Are you sure you want to delete this Job Work Purchase Order? This action cannot be undone.",
      confirmButtonText: "Yes, Delete PO"
    });
    if (!confirmed) return;
    try {
      await apiDelete(`/api/purchase/po/${po._id}`, token);
      showSuccessToast("Job Work PO deleted successfully");
      onRefresh();
    } catch (err: any) {
      showErrorDialog("Error", err.message || "Failed to delete PO");
    }
  };

  // Handle Download PDF
  const handleDownloadPDF = (po: any) => {
    generateDocument('pdf', 'po', { po, companyInfo });
  };

  // Excel-Style Column Header Renderer
  const renderExcelHeader = (
    colKey: ExcelColKey,
    title: string,
    align: 'left' | 'center' | 'right' = 'left',
    extraClass: string = ''
  ) => {
    const selectedValues = getSelectedForCol(colKey);
    const isFiltered = selectedValues.length > 0;
    const isOpen = tableDropdownCol === colKey;
    const allValues = uniqueColValues[colKey] || [];
    const filteredDropdownValues = allValues.filter(v =>
      v.toLowerCase().includes(tableDropdownSearch.toLowerCase().trim())
    );
    const isAllSelected = selectedValues.length === allValues.length && allValues.length > 0;

    const justifyClass =
      align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-between';

    return (
      <th className={`py-3 px-3.5 text-${align} relative select-none ${extraClass}`}>
        <div className={`flex items-center gap-1.5 ${justifyClass} group`}>
          <span>{title}</span>
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              if (isOpen) {
                setTableDropdownCol(null);
                setTableDropdownSearch('');
              } else {
                setTableDropdownCol(colKey);
                setTableDropdownSearch('');
              }
            }}
            className={`p-1 rounded-md transition-all cursor-pointer shrink-0 ${
              isFiltered
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
            title={`Filter by ${title} (Excel Filter)`}
          >
            <Filter size={11} className={isFiltered ? 'fill-current' : ''} />
          </button>
        </div>

        {/* Excel Filter Dropdown Popover */}
        {isOpen && (
          <div
            ref={tableDropdownRef}
            onClick={e => e.stopPropagation()}
            className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} top-full mt-1.5 w-64 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 p-2.5 z-50 normal-case font-normal text-left animate-in fade-in zoom-in-95 duration-100`}
          >
            {/* Search inside Dropdown */}
            <div className="relative mb-2">
              <Search size={12} className="absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder={`Search ${title}...`}
                value={tableDropdownSearch}
                onChange={e => setTableDropdownSearch(e.target.value)}
                className="w-full pl-7 pr-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-200 font-medium"
                autoFocus
              />
            </div>

            {/* Select All Toggle */}
            <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-100 dark:border-slate-800 text-xs font-semibold">
              <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={() => handleSelectAllExcel(colKey, allValues)}
                  className="rounded text-indigo-600 focus:ring-0 cursor-pointer"
                />
                <span>(Select All)</span>
              </label>
              {isFiltered && (
                <button
                  type="button"
                  onClick={() => setSelectedForCol(colKey, [])}
                  className="text-[10px] text-rose-600 dark:text-rose-400 font-bold hover:underline cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Value List */}
            <div className="max-h-48 overflow-y-auto space-y-0.5 pr-1 text-xs">
              {filteredDropdownValues.length === 0 ? (
                <div className="p-3 text-center text-slate-400 text-xs font-medium">No matching values</div>
              ) : (
                filteredDropdownValues.map(val => {
                  const isChecked = selectedValues.includes(val);
                  const count = getValueCount(colKey, val);
                  return (
                    <label
                      key={val}
                      className="flex items-center justify-between gap-2 px-1.5 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer text-slate-800 dark:text-slate-200 text-xs"
                      title={val}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleExcelValue(colKey, val)}
                          className="rounded text-indigo-600 focus:ring-0 shrink-0 cursor-pointer"
                        />
                        <span className="truncate">{val}</span>
                      </div>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 shrink-0">
                        {count}
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </div>
        )}
      </th>
    );
  };

  return (
    <div className="space-y-4">
      
      {/* KPI Cards Row (Collapsible, hidden by default) */}
      {showDashboard && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
          
          {/* Total POs */}
          <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Total JW POs</div>
            <div className="text-xl font-black text-slate-900 dark:text-white mt-1">{metrics.totalPOs}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Subcontracting orders</div>
          </div>

          {/* Released / Active */}
          <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-blue-100 dark:border-blue-950/60 shadow-2xs">
            <div className="text-[11px] font-bold text-blue-600 dark:text-blue-400">Released / Active</div>
            <div className="text-xl font-black text-blue-700 dark:text-blue-300 mt-1">{metrics.releasedPOs}</div>
            <div className="text-[10px] text-blue-500/70 mt-0.5">Awaiting processing</div>
          </div>

          {/* Partially Received */}
          <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-amber-100 dark:border-amber-950/60 shadow-2xs">
            <div className="text-[11px] font-bold text-amber-600 dark:text-amber-400">Partially Received</div>
            <div className="text-xl font-black text-amber-700 dark:text-amber-300 mt-1">{metrics.partiallyReceived}</div>
            <div className="text-[10px] text-amber-500/70 mt-0.5">Inward in progress</div>
          </div>

          {/* Completed */}
          <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-100 dark:border-emerald-950/60 shadow-2xs">
            <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">Completed</div>
            <div className="text-xl font-black text-emerald-700 dark:text-emerald-300 mt-1">{metrics.completedPOs}</div>
            <div className="text-[10px] text-emerald-500/70 mt-0.5">Fully returned</div>
          </div>

          {/* Total Ordered Value */}
          <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-950/60 shadow-2xs">
            <div className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">Total Value</div>
            <div className="text-lg font-black text-indigo-700 dark:text-indigo-300 mt-1">
              ₹{metrics.totalOrderedValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div className="text-[10px] text-indigo-500/70 mt-0.5">Contracted process charges</div>
          </div>

          {/* Pending Process Value */}
          <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-purple-100 dark:border-purple-950/60 shadow-2xs">
            <div className="text-[11px] font-bold text-purple-600 dark:text-purple-400">Pending Value</div>
            <div className="text-lg font-black text-purple-700 dark:text-purple-300 mt-1">
              ₹{metrics.totalPendingValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div className="text-[10px] text-purple-500/70 mt-0.5">Open subcontract liability</div>
          </div>

        </div>
      )}

      {/* Action Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
        
        {/* Left: Search & Filters */}
        <div className="flex flex-wrap items-center gap-2 flex-1">
          
          {/* Search Input */}
          <div className="relative min-w-[200px] flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search PO #, DC #, vendor, process..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
          >
            <option value="all">All Statuses</option>
            <option value="released">Released</option>
            <option value="partially received">Partially Received</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
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

          {/* Date Picker Filter */}
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
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950/60 dark:border-indigo-800 dark:text-indigo-300'
                : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
            title={showDashboard ? "Hide Metrics Dashboard" : "Show Metrics Dashboard"}
          >
            <LayoutDashboard size={14} className={showDashboard ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500"} />
            <span className="hidden sm:inline">{showDashboard ? "Hide Dashboard" : "Dashboard"}</span>
            {showDashboard ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 cursor-pointer"
            title="Refresh POs"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        {/* Right: Primary Action Button */}
        <button
          onClick={() => {
            setEditingPO(null);
            setIsPOModalOpen(true);
          }}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-500/25 transition-all active:scale-95 cursor-pointer shrink-0"
        >
          <Plus size={15} />
          <span>New Job Work PO</span>
        </button>
      </div>

      {/* Active Excel Column Filters Banner */}
      {hasAnyExcelFilter && (
        <div className="px-3.5 py-2 bg-indigo-50/80 dark:bg-indigo-950/40 rounded-xl border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-between text-xs animate-in fade-in flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
              <Filter size={12} className="text-indigo-600 dark:text-indigo-400" />
              Active Column Filters:
            </span>
            {selectedPoNumbers.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 font-semibold text-[11px]">
                <span>PO/DC: {selectedPoNumbers.length}</span>
                <button type="button" onClick={() => setSelectedPoNumbers([])} className="hover:text-rose-500 cursor-pointer ml-0.5 font-bold">✕</button>
              </span>
            )}
            {selectedExcelVendors.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 font-semibold text-[11px]">
                <span>Vendor: {selectedExcelVendors.length}</span>
                <button type="button" onClick={() => setSelectedExcelVendors([])} className="hover:text-rose-500 cursor-pointer ml-0.5 font-bold">✕</button>
              </span>
            )}
            {selectedProcesses.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 font-semibold text-[11px]">
                <span>Process: {selectedProcesses.length}</span>
                <button type="button" onClick={() => setSelectedProcesses([])} className="hover:text-rose-500 cursor-pointer ml-0.5 font-bold">✕</button>
              </span>
            )}
            {selectedItems.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 font-semibold text-[11px]">
                <span>Items: {selectedItems.length}</span>
                <button type="button" onClick={() => setSelectedItems([])} className="hover:text-rose-500 cursor-pointer ml-0.5 font-bold">✕</button>
              </span>
            )}
            {selectedProgress.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-100 dark:bg-cyan-900 text-cyan-800 dark:text-cyan-200 font-semibold text-[11px]">
                <span>Progress: {selectedProgress.length}</span>
                <button type="button" onClick={() => setSelectedProgress([])} className="hover:text-rose-500 cursor-pointer ml-0.5 font-bold">✕</button>
              </span>
            )}
            {selectedTotals.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-200 font-semibold text-[11px]">
                <span>Total: {selectedTotals.length}</span>
                <button type="button" onClick={() => setSelectedTotals([])} className="hover:text-rose-500 cursor-pointer ml-0.5 font-bold">✕</button>
              </span>
            )}
            {selectedStatuses.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 font-semibold text-[11px]">
                <span>Status: {selectedStatuses.length}</span>
                <button type="button" onClick={() => setSelectedStatuses([])} className="hover:text-rose-500 cursor-pointer ml-0.5 font-bold">✕</button>
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={handleClearAllExcelFilters}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
          >
            <RotateCcw size={11} /> Clear Filters
          </button>
        </div>
      )}

      {/* Main Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto min-h-[260px]">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
              <tr>
                {renderExcelHeader('poNumber', 'PO Number & Date', 'left')}
                {renderExcelHeader('vendor', 'Subcontractor / Vendor', 'left')}
                {renderExcelHeader('process', 'Process / SAC', 'left')}
                {renderExcelHeader('items', 'Items & Specifications', 'left', 'min-w-[220px]')}
                {renderExcelHeader('progress', 'Progress (Rec / Ord)', 'center')}
                {renderExcelHeader('total', 'Grand Total (₹)', 'right')}
                {renderExcelHeader('status', 'Status', 'center')}
                <th className="py-3 px-3.5 text-right min-w-[110px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Wrench size={32} className="text-slate-300 dark:text-slate-700" />
                      <p className="font-semibold text-xs">No Job Work Outward POs found</p>
                      <button
                        onClick={() => { setEditingPO(null); setIsPOModalOpen(true); }}
                        className="mt-1 text-xs text-indigo-600 font-bold hover:underline cursor-pointer"
                      >
                        Create your first Job Work PO
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredData.map(po => {
                  const status = po.status || 'Released';
                  const isCompleted = status.toLowerCase() === 'completed';
                  const isPartially = status.toLowerCase() === 'partially received';

                  const badgeClass = isCompleted
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900'
                    : isPartially
                    ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900'
                    : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-900';

                  const poItems = po.items || [];
                  const totalOrderedQty = poItems.reduce((acc: number, it: any) => acc + (Number(it.quantity) || 0), 0);
                  const totalReceivedQty = poItems.reduce((acc: number, it: any) => acc + (Number(it.receivedQuantity) || 0), 0);

                  return (
                    <tr key={po._id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      
                      {/* PO Number & Date */}
                      <td className="py-3 px-3.5">
                        <div className="font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span>{po.poNumber}</span>
                        </div>
                        {po.challanNumber && (
                          <div className="mt-1">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
                              <span>DC: {po.challanNumber}</span>
                            </span>
                          </div>
                        )}
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {formatDateTime(po.date)}
                        </div>
                        {po.expectedDeliveryDate && (
                          <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-0.5 flex items-center gap-1">
                            <Clock size={10} />
                            <span>Exp: {formatDateTime(po.expectedDeliveryDate)}</span>
                          </div>
                        )}
                      </td>

                      {/* Subcontractor / Vendor */}
                      <td className="py-3 px-3.5">
                        <div className="font-bold text-slate-800 dark:text-slate-200">
                          {po.vendorName || po.vendor?.name || 'Subcontractor'}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {po.vendor?.address?.city || po.vendor?.city || po.vendor?.gst || ''}
                        </div>
                      </td>

                      {/* Process & SAC */}
                      <td className="py-3 px-3.5">
                        <div className="font-semibold text-indigo-700 dark:text-indigo-300">
                          {po.processType || 'Standard Job Work'}
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                          SAC: {po.sacCode || '9988'}
                        </div>
                      </td>

                      {/* Items Display (AGENTS.md Item Name & Description) */}
                      <td className="py-3 px-3.5">
                        <div className="space-y-1.5 max-w-sm">
                          {poItems.slice(0, 2).map((it: any, idx: number) => {
                            const desc = it.description || it.descriptions || it.material?.descriptions || it.material?.description || '';
                            const activeUnit = it.selectedUnit || it.unit || 'PCS';
                            const activeQty = it.rateUnit === 'secondary' && it.secondaryQuantity ? it.secondaryQuantity : it.quantity;
                            return (
                              <div key={idx} className="text-[11px]">
                                <ItemNameAndDescription
                                  name={it.materialName || it.material?.name || 'Process Item'}
                                  description={desc}
                                />
                                <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                  <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">
                                    Qty: {activeQty} {activeUnit}
                                  </span>
                                  {it.processType && (
                                    <span className="text-[10.5px] font-semibold text-indigo-700 dark:text-indigo-300">
                                      • {it.processType}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                          {poItems.length > 2 && (
                            <span className="text-[10px] font-bold text-slate-400">
                              +{poItems.length - 2} more items
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Progress (Received / Ordered) */}
                      <td className="py-3 px-3.5 text-center">
                        <div className="font-bold text-slate-700 dark:text-slate-300">
                          {totalReceivedQty} / {totalOrderedQty}
                        </div>
                        <div className="w-20 bg-slate-100 dark:bg-slate-700 rounded-full h-1.5 mx-auto mt-1 overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${isCompleted ? 'bg-emerald-500' : 'bg-indigo-600'}`}
                            style={{ width: `${totalOrderedQty > 0 ? Math.min(100, (totalReceivedQty / totalOrderedQty) * 100) : 0}%` }}
                          />
                        </div>
                      </td>

                      {/* Grand Total */}
                      <td className="py-3 px-3.5 text-right">
                        <div className="font-black text-slate-900 dark:text-white">
                          ₹{(Number(po.grandTotal) || Number(po.totalAmount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Incl. GST
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td className="py-3 px-3.5 text-center">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${badgeClass}`}>
                          {status}
                        </span>
                      </td>

                      {/* Actions (Download PDF, Edit, Delete) */}
                      <td className="py-3 px-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          
                          {/* Download PDF */}
                          <button
                            onClick={() => handleDownloadPDF(po)}
                            title="Download PDF"
                            className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors cursor-pointer border border-blue-200 dark:border-blue-800"
                          >
                            <FileText size={14} />
                          </button>

                          {/* Edit PO */}
                          <button
                            onClick={() => handleEdit(po)}
                            title="Edit PO"
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit2 size={14} />
                          </button>

                          {/* Delete PO */}
                          <button
                            onClick={() => handleDelete(po)}
                            title="Delete PO"
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

      {/* PO Modal */}
      {isPOModalOpen && (
        <JobWorkPOModal
          isOpen={isPOModalOpen}
          onClose={() => {
            setIsPOModalOpen(false);
            setEditingPO(null);
          }}
          onSuccess={() => {
            showSuccessToast(editingPO ? "Job Work PO updated successfully" : "Job Work PO released successfully");
            onRefresh();
          }}
          vendors={vendors}
          materials={materials}
          inHouseItems={inHouseItems}
          initialData={editingPO}
          isEditing={Boolean(editingPO)}
        />
      )}

    </div>
  );
}

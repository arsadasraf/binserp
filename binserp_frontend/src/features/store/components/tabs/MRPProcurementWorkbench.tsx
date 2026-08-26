import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingCart, RefreshCw, AlertTriangle, CheckCircle2, 
  Layers, Filter, Search, ArrowRight, ArrowLeft, Building2, Truck, 
  Plus, CheckSquare, Square, ChevronDown, ChevronRight,
  TrendingDown, FileText, Sparkles, Send, Boxes, GitBranch,
  Factory, Package, Check, Eye, Clock, Calendar, Download, Printer, Tag, X
} from 'lucide-react';
import { apiGet, apiPost, apiPut, apiPatch } from '@/src/lib/api';
import { generateNestedBOMPDF } from '@/src/utils/generateNestedBOMPDF';
import Swal from 'sweetalert2';

interface MRPProcurementWorkbenchProps {
  token: string;
  onOpenRfqModal?: (items: any[]) => void;
  onOpenPoModal?: (initialData: any) => void;
  onRefreshPlans?: () => void;
}

const STATUS_OPTIONS = [
  'Pending',
  'Raised RFQ',
  'PO Sent',
  'Material Received',
  'Issued for Production',
  'Completed'
];

export default function MRPProcurementWorkbench({
  token,
  onOpenRfqModal,
  onOpenPoModal,
  onRefreshPlans
}: MRPProcurementWorkbenchProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [selectedPlan, setSelectedPlan] = useState<any | null>(null);
  const [viewMode, setViewMode] = useState<'nested-tree' | 'consolidated-types'>('nested-tree');
  const [activeTypeTab, setActiveTypeTab] = useState<'rm' | 'bo' | 'component' | 'subassembly' | 'assembly'>('rm');
  const [searchTerm, setSearchTerm] = useState('');
  const [onlyShortages, setOnlyShortages] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [submittingPO, setSubmittingPO] = useState(false);
  const [submittingPPC, setSubmittingPPC] = useState(false);
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'yesterday' | '7days' | 'thisMonth' | 'custom'>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [dateType, setDateType] = useState<'created' | 'target'>('created');
  const [companyInfo, setCompanyInfo] = useState<any>(null);

  const fetchWorkbenchData = async (planId?: string) => {
    if (!token) return;
    setLoading(true);
    try {
      const url = planId 
        ? `/api/purchase/mrp/procurement-workbench?mrpId=${planId}`
        : '/api/purchase/mrp/procurement-workbench';
      const [res, compRes] = await Promise.all([
        apiGet(url, token),
        apiGet('/api/store/company-info', token).catch(() => null)
      ]);

      if (res?.data) {
        setData(res.data);
        if (planId) {
          const found = (res.data.mrpTreeList || []).find((p: any) => p._id === planId);
          if (found) setSelectedPlan(found);
        }
      }
      if (compRes?.companyInfo) {
        setCompanyInfo(compRes.companyInfo);
      }
    } catch (err: any) {
      console.error("Failed to load MRP Procurement Workbench:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkbenchData();
  }, [token]);

  const mrpTreeList = data?.mrpTreeList || [];
  const classifiedLists = data?.classifiedLists || {
    rmList: [],
    boList: [],
    componentList: [],
    subAssemblyList: [],
    assemblyList: []
  };

  // Filtered MRP list for the initial selection view
  const filteredMrpList = useMemo(() => {
    const today = new Date();
    const isSameDay = (d1: Date, d2: Date) => 
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate();

    return (mrpTreeList || []).filter((plan: any) => {
      // Date Resolution
      const rawDate = dateType === 'target' 
        ? (plan.targetDate || plan.deliveryDate || plan.createdAt) 
        : (plan.createdAt || plan.planDate || plan.date || plan.targetDate);
      const planDate = new Date(rawDate || Date.now());

      let matchesDate = true;
      if (dateFilter === 'today') {
        matchesDate = isSameDay(planDate, today);
      } else if (dateFilter === 'yesterday') {
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);
        matchesDate = isSameDay(planDate, yesterday);
      } else if (dateFilter === '7days') {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(today.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0);
        matchesDate = planDate >= sevenDaysAgo && planDate <= today;
      } else if (dateFilter === 'thisMonth') {
        matchesDate = planDate.getMonth() === today.getMonth() && planDate.getFullYear() === today.getFullYear();
      } else if (dateFilter === 'custom') {
        if (startDate && endDate) {
          const s = new Date(startDate);
          s.setHours(0, 0, 0, 0);
          const e = new Date(endDate);
          e.setHours(23, 59, 59, 999);
          matchesDate = planDate >= s && planDate <= e;
        } else if (startDate) {
          const s = new Date(startDate);
          matchesDate = isSameDay(planDate, s) || planDate >= s;
        } else if (endDate) {
          const e = new Date(endDate);
          matchesDate = isSameDay(planDate, e) || planDate <= e;
        }
      }

      if (!matchesDate) return false;

      const s = searchTerm.toLowerCase();
      return !searchTerm ||
        plan.mrpNumber.toLowerCase().includes(s) ||
        (plan.customerName && plan.customerName.toLowerCase().includes(s)) ||
        (plan.customerPoNumber && plan.customerPoNumber.toLowerCase().includes(s));
    });
  }, [mrpTreeList, searchTerm, dateFilter, startDate, endDate, dateType]);

  // Active items for classification view inside selected MRP
  const currentTypeList = useMemo(() => {
    switch (activeTypeTab) {
      case 'rm': return classifiedLists.rmList || [];
      case 'bo': return classifiedLists.boList || [];
      case 'component': return classifiedLists.componentList || [];
      case 'subassembly': return classifiedLists.subAssemblyList || [];
      case 'assembly': return classifiedLists.assemblyList || [];
      default: return classifiedLists.rmList || [];
    }
  }, [classifiedLists, activeTypeTab]);

  const filteredConsolidatedList = useMemo(() => {
    return currentTypeList.filter((item: any) => {
      const s = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm ||
        item.materialName.toLowerCase().includes(s) ||
        (item.materialCode && item.materialCode.toLowerCase().includes(s)) ||
        (item.bestVendor?.vendorName && item.bestVendor.vendorName.toLowerCase().includes(s));
      const matchesShortage = !onlyShortages || item.netShortage > 0;
      return matchesSearch && matchesShortage;
    });
  }, [currentTypeList, searchTerm, onlyShortages]);

  // Selection toggle (Exclusively in Types Classification View)
  const toggleSelect = (key: string) => {
    const next = new Set(selectedKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelectedKeys(next);
  };

  const toggleSelectAll = () => {
    if (selectedKeys.size === filteredConsolidatedList.length && filteredConsolidatedList.length > 0) {
      setSelectedKeys(new Set());
    } else {
      setSelectedKeys(new Set(filteredConsolidatedList.map((i: any) => i.materialKey)));
    }
  };

  const toggleExpandNode = (nodeKey: string) => {
    const next = new Set(expandedNodes);
    if (next.has(nodeKey)) next.delete(nodeKey);
    else next.add(nodeKey);
    setExpandedNodes(next);
  };

  const selectedItems = useMemo(() => {
    return filteredConsolidatedList.filter((item: any) => selectedKeys.has(item.materialKey));
  }, [filteredConsolidatedList, selectedKeys]);

  // PDF Export for Multi-Level Nested BOM Tree
  const handleExportBOMPDF = () => {
    if (!selectedPlan) return;
    generateNestedBOMPDF({
      mrpNumber: selectedPlan.mrpNumber,
      customerName: selectedPlan.customerName,
      customerPoNumber: selectedPlan.customerPoNumber,
      targetDate: selectedPlan.targetDate,
      status: selectedPlan.status,
      fgItems: selectedPlan.fgItems || [],
      companyInfo
    });
  };

  // Open Manual Outward PO Modal prefilled with selected items
  const handleOpenManualPO = () => {
    if (selectedItems.length === 0) {
      Swal.fire('No Items Selected', 'Please select items to create an Outward Purchase Order.', 'info');
      return;
    }

    if (onOpenPoModal) {
      const poItems = selectedItems.map((it: any) => {
        const qty = Number(it.netShortage || it.requiredQuantity) || 1;
        const rate = Number(it.bestVendor?.rate || it.estimatedRate || 0);
        const taxRate = 18;
        const lineSub = qty * rate;
        const lineTax = (lineSub * taxRate) / 100;

        return {
          material: it.materialId || '',
          materialName: it.materialName,
          materialCode: it.materialCode || '',
          itemType: (it.itemType || 'rm').toLowerCase().includes('bo') ? 'bo' : 'rm',
          category: it.category || '',
          quantity: qty,
          unit: it.unit || 'PCS',
          rate: rate,
          taxRate: taxRate,
          taxAmount: lineTax,
          amount: lineSub + lineTax,
          description: `MRP Requirement for ${it.mrpSources?.map((s: any) => s.mrpNumber).join(', ') || it.parentMRP || selectedPlan?.mrpNumber || 'MRP'}`
        };
      });

      const firstVendorId = selectedItems.find((i: any) => i.bestVendor?.vendorId)?.bestVendor?.vendorId || '';

      onOpenPoModal({
        vendor: firstVendorId,
        items: poItems,
        remarks: `Generated from MRP Procurement Workbench (${selectedPlan?.mrpNumber || 'MRP'})`
      });
    }
  };

  // 1-Click Auto PO generation
  const handleBulkGeneratePO = async () => {
    if (selectedItems.length === 0) {
      Swal.fire('No Items Selected', 'Please select material shortages to generate Purchase Orders.', 'info');
      return;
    }

    const unassigned = selectedItems.filter((i: any) => !i.bestVendor?.vendorId);
    if (unassigned.length > 0) {
      const result = await Swal.fire({
        title: 'Preferred Vendor Not Mapped',
        html: `<p class="text-xs text-slate-600 dark:text-slate-300"><b>${unassigned.length}</b> selected item(s) do not have a preferred vendor in price lists.<br/><br/>Would you like to open the <b>Outward PO Form</b> to select vendors manually, or create an <b>RFQ</b>?</p>`,
        icon: 'info',
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonColor: '#059669',
        denyButtonColor: '#4f46e5',
        confirmButtonText: '📝 Open Outward PO Form',
        denyButtonText: '📑 Create Outward RFQ',
        cancelButtonText: 'Cancel'
      });

      if (result.isConfirmed) {
        handleOpenManualPO();
        return;
      } else if (result.isDenied) {
        handleCreateRFQ();
        return;
      } else {
        return;
      }
    }

    const confirm = await Swal.fire({
      title: 'Generate Consolidated POs?',
      html: `Generate Purchase Orders for <b>${selectedItems.length}</b> shortage item(s) grouped by preferred suppliers.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#059669',
      confirmButtonText: '⚡ Generate POs'
    });

    if (!confirm.isConfirmed) return;

    setSubmittingPO(true);
    try {
      const payload = {
        items: selectedItems.map((it: any) => ({
          materialName: it.materialName,
          materialCode: it.materialCode,
          itemType: it.itemType,
          orderQuantity: it.netShortage || it.requiredQuantity,
          unit: it.unit,
          rate: it.bestVendor?.rate || it.estimatedRate || 0,
          vendorId: it.bestVendor?.vendorId,
          sourceMRPs: it.mrpSources?.map((s: any) => s.mrpNumber) || [it.parentMRP || selectedPlan?.mrpNumber]
        }))
      };

      const res = await apiPost('/api/purchase/mrp/bulk-generate-po', payload, token);
      Swal.fire({
        icon: 'success',
        title: 'Purchase Orders Created!',
        text: res.message || `Successfully created Purchase Order(s).`,
        timer: 3000
      });

      setSelectedKeys(new Set());
      if (selectedPlan) {
        fetchWorkbenchData(selectedPlan._id);
      } else {
        fetchWorkbenchData();
      }
      if (onRefreshPlans) onRefreshPlans();
    } catch (err: any) {
      Swal.fire('Error', err.message || 'Failed to generate Purchase Orders', 'error');
    } finally {
      setSubmittingPO(false);
    }
  };

  // 1-Click RFQ generation
  const handleCreateRFQ = () => {
    if (selectedItems.length === 0) {
      Swal.fire('No Items Selected', 'Please select material shortages to create an RFQ.', 'info');
      return;
    }

    if (onOpenRfqModal) {
      const rfqItems = selectedItems.map((it: any) => ({
        materialName: it.materialName,
        materialCode: it.materialCode,
        category: it.category,
        itemType: (it.itemType || 'rm').toLowerCase(),
        requiredQuantity: it.netShortage || it.requiredQuantity,
        currentStock: it.currentPhysicalStock,
        shortage: it.netShortage || it.requiredQuantity,
        unit: it.unit,
        description: `Consolidated MRP Shortage (${it.mrpSources?.map((s: any) => s.mrpNumber).join(', ') || it.parentMRP || selectedPlan?.mrpNumber || ''})`
      }));
      onOpenRfqModal(rfqItems);
    }
  };

  // 1-Click Send to PPC Intake Bucket (for Components, Sub-Assemblies, Assemblies)
  const handleSendToPPC = async () => {
    if (selectedItems.length === 0) {
      Swal.fire('No Items Selected', 'Please select components or assemblies to send to PPC Order Intake.', 'info');
      return;
    }

    const confirm = await Swal.fire({
      title: 'Send to PPC Intake Bucket?',
      html: `Dispatch <b>${selectedItems.length}</b> component/assembly item(s) to <b>PPC Order Intake</b> for in-house shopfloor manufacturing and route card scheduling.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#7c3aed',
      confirmButtonText: '🏭 ⚡ Yes, Send to PPC'
    });

    if (!confirm.isConfirmed) return;

    setSubmittingPPC(true);
    try {
      const payload = {
        mrpPlanId: selectedPlan?._id,
        mrpNumber: selectedPlan?.mrpNumber,
        customerName: selectedPlan?.customerName,
        customerPoNumber: selectedPlan?.customerPoNumber,
        items: selectedItems.map((it: any) => ({
          materialName: it.materialName,
          materialCode: it.materialCode,
          itemType: it.itemType,
          quantity: it.netShortage || it.requiredQuantity,
          unit: it.unit,
          targetDate: selectedPlan?.targetDate
        }))
      };

      const res = await apiPost('/api/purchase/mrp/send-to-ppc', payload, token);
      Swal.fire({
        icon: 'success',
        title: 'Sent to PPC Intake Bucket!',
        text: res.message || `Dispatched to PPC Order Intake for shopfloor routing.`,
        timer: 3000
      });

      setSelectedKeys(new Set());
    } catch (err: any) {
      Swal.fire('Error', err.message || 'Failed to dispatch to PPC', 'error');
    } finally {
      setSubmittingPPC(false);
    }
  };

  // Manual Status Update (Single or Bulk)
  const handleUpdateItemStatus = async (newStatus: string, specificItem?: any) => {
    if (!selectedPlan) return;
    const targetItems = specificItem ? [specificItem] : selectedItems;
    if (targetItems.length === 0) {
      Swal.fire('No Items Selected', 'Please select items to update status.', 'info');
      return;
    }

    try {
      const payload = {
        items: targetItems.map((i: any) => ({
          materialKey: i.materialKey,
          materialName: i.materialName,
          materialCode: i.materialCode,
          status: newStatus
        })),
        status: newStatus
      };

      await apiPut(`/api/purchase/mrp/plan/${selectedPlan._id}/item-status`, payload, token);
      
      // Update local state instantly for fast UX
      if (data?.classifiedLists) {
        const updateList = (list: any[]) =>
          (list || []).map((item: any) => {
            const isMatch = targetItems.some((ti: any) => ti.materialKey === item.materialKey);
            return isMatch ? { ...item, status: newStatus } : item;
          });

        setData((prev: any) => ({
          ...prev,
          classifiedLists: {
            rmList: updateList(prev?.classifiedLists?.rmList),
            boList: updateList(prev?.classifiedLists?.boList),
            componentList: updateList(prev?.classifiedLists?.componentList),
            subAssemblyList: updateList(prev?.classifiedLists?.subAssemblyList),
            assemblyList: updateList(prev?.classifiedLists?.assemblyList)
          }
        }));
      }

      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: `Status: "${newStatus}"`,
        showConfirmButton: false,
        timer: 2000
      });

      if (!specificItem) setSelectedKeys(new Set());
    } catch (err: any) {
      Swal.fire('Error', err.message || 'Failed to update item status', 'error');
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'Raised RFQ':
      case 'RFQ Raised':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300';
      case 'PO Sent':
      case 'PO Raised':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-300';
      case 'Material Received':
        return 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 border-teal-300';
      case 'Issued for Production':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border-purple-300';
      case 'Completed':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300';
      case 'Pending':
      default:
        return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300';
    }
  };

  const handleSelectPlan = (plan: any) => {
    setSelectedPlan(plan);
    setSelectedKeys(new Set());
    fetchWorkbenchData(plan._id);
  };

  const handleBackToList = () => {
    setSelectedPlan(null);
    setSelectedKeys(new Set());
    fetchWorkbenchData();
  };

  // Is active tab eligible for PPC dispatch
  const isPpcEligibleTab = activeTypeTab === 'component' || activeTypeTab === 'subassembly' || activeTypeTab === 'assembly';

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      
      {/* ========================================================================= */}
      {/* VIEW 1: INITIAL MRP NUMBERS LIST (Click on an MRP number to view BOM)     */}
      {/* ========================================================================= */}
      {!selectedPlan && (
        <div className="space-y-4">
          
          {/* Header & Search */}
          <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <ShoppingCart className="text-emerald-600 w-5 h-5" />
                <span>Procurement Workbench</span>
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-2.5 text-slate-400 w-3.5 h-3.5" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search MRP #, Customer..."
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none"
                />
              </div>

              <button
                onClick={() => fetchWorkbenchData()}
                className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl cursor-pointer"
                title="Refresh"
              >
                <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              </button>
            </div>
          </div>

          {/* Date & Day Filter Bar */}
          <div className="bg-white dark:bg-slate-900 p-2.5 sm:p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-2.5">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full lg:w-auto flex-wrap sm:flex-nowrap">
              
              {/* Date Type Selector */}
              <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-[11px] font-bold shrink-0 mr-1">
                <button
                  onClick={() => setDateType('created')}
                  className={`px-2 py-0.8 rounded-md transition-all cursor-pointer ${
                    dateType === 'created' ? 'bg-white dark:bg-slate-900 text-emerald-600 shadow-2xs font-bold' : 'text-slate-500'
                  }`}
                >
                  Plan Date
                </button>
                <button
                  onClick={() => setDateType('target')}
                  className={`px-2 py-0.8 rounded-md transition-all cursor-pointer ${
                    dateType === 'target' ? 'bg-white dark:bg-slate-900 text-emerald-600 shadow-2xs font-bold' : 'text-slate-500'
                  }`}
                >
                  Target Date
                </button>
              </div>

              {[
                { id: 'all', label: 'All Dates' },
                { id: 'today', label: 'Today' },
                { id: 'yesterday', label: 'Yesterday' },
                { id: '7days', label: 'Last 7 Days' },
                { id: 'thisMonth', label: 'This Month' },
                { id: 'custom', label: 'Custom Range' },
              ].map((df) => (
                <button
                  key={df.id}
                  onClick={() => setDateFilter(df.id as any)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    dateFilter === df.id
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {df.label}
                </button>
              ))}
            </div>

            {/* Custom Date Range Inputs */}
            {dateFilter === 'custom' && (
              <div className="flex items-center gap-1.5 w-full lg:w-auto flex-wrap sm:flex-nowrap">
                <span className="text-[11px] text-slate-400 font-semibold">From:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold outline-none text-slate-700 dark:text-slate-200"
                />
                <span className="text-[11px] text-slate-400 font-semibold">To:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold outline-none text-slate-700 dark:text-slate-200"
                />
                {(startDate || endDate) && (
                  <button 
                    onClick={() => { setStartDate(''); setEndDate(''); }}
                    className="p-1 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                    title="Clear Dates"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* MRP Numbers Table */}
          {loading ? (
            <div className="p-16 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
              <RefreshCw className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-2" />
              <p className="text-xs text-slate-400 font-semibold">Loading MRP Demand Plans...</p>
            </div>
          ) : filteredMrpList.length === 0 ? (
            <div className="p-16 text-center bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
              <Package className="w-10 h-10 text-slate-300 mx-auto mb-2 opacity-60" />
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">No MRP Plans Found</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Create an MRP Demand Plan in Tab 1 to start procurement.</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-3.5">MRP Number</th>
                      <th className="p-3.5">Customer & PO Ref</th>
                      <th className="p-3.5">Finished Goods (FG) Demand</th>
                      <th className="p-3.5 text-center">Live Shortages</th>
                      <th className="p-3.5 text-center">In-Transit POs</th>
                      <th className="p-3.5 text-center">Procurement Status</th>
                      <th className="p-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredMrpList.map((plan: any) => {
                      const fgCount = (plan.fgItems || []).length;
                      const firstFG = (plan.fgItems || [])[0];

                      return (
                        <tr 
                          key={plan._id}
                          onClick={() => handleSelectPlan(plan)}
                          className="hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 cursor-pointer transition-colors"
                        >
                          {/* MRP Number */}
                          <td className="p-3.5">
                            <span className="font-mono text-xs font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
                              {plan.mrpNumber}
                            </span>
                          </td>

                          {/* Customer & PO */}
                          <td className="p-3.5">
                            <strong className="text-slate-900 dark:text-white block">{plan.customerName || "Internal Demand"}</strong>
                            {plan.customerPoNumber && (
                              <span className="font-mono text-[10px] text-slate-400">PO: {plan.customerPoNumber}</span>
                            )}
                          </td>

                          {/* FG Summary */}
                          <td className="p-3.5">
                            <div className="font-semibold text-slate-800 dark:text-slate-200">
                              {firstFG?.fgItemName || "Finished Good"}
                              {fgCount > 1 && <span className="text-slate-400 font-normal ml-1">+{fgCount - 1} more</span>}
                            </div>
                            <span className="text-[10px] text-slate-400 block font-mono">
                              {fgCount} FG Item{fgCount > 1 ? 's' : ''} planned
                            </span>
                          </td>

                          {/* Live Shortages */}
                          <td className="p-3.5 text-center">
                            {plan.planTotalShortages > 0 ? (
                              <span className="inline-flex items-center gap-1 font-bold text-red-600 bg-red-50 dark:bg-red-950 px-2 py-0.5 rounded text-[11px]">
                                <AlertTriangle size={11} /> {plan.planTotalShortages} Shortage Units
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded text-[11px]">
                                <CheckCircle2 size={11} /> Stock Covered
                              </span>
                            )}
                          </td>

                          {/* In-Transit POs */}
                          <td className="p-3.5 text-center">
                            {plan.planTotalInTransit > 0 ? (
                              <span className="font-bold text-blue-600 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded text-[11px]">
                                {plan.planTotalInTransit} Units In-Transit
                              </span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>

                          {/* Procurement Status */}
                          <td className="p-3.5 text-center">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              plan.isProcurementFulfilled 
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            }`}>
                              {plan.isProcurementFulfilled ? '✅ Procurement Fulfilled' : '⏳ Shortages Pending'}
                            </span>
                          </td>

                          {/* Open BOM Trigger Button */}
                          <td className="p-3.5 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectPlan(plan);
                              }}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1 ml-auto cursor-pointer"
                            >
                              <span>View Nested BOM</span>
                              <ChevronRight size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: SELECTED MRP PLAN WORKBENCH WITH NESTED BOM & CLASSIFICATIONS     */}
      {/* ========================================================================= */}
      {selectedPlan && (
        <div className="space-y-4">
          
          {/* Top Header Bar with Navigation and PDF Export */}
          <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3">
            
            <div className="flex items-center gap-3">
              <button
                onClick={handleBackToList}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-1 text-xs font-bold cursor-pointer"
              >
                <ArrowLeft size={14} />
                <span>All MRPs</span>
              </button>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs font-mono font-black">
                    {selectedPlan.mrpNumber}
                  </span>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {selectedPlan.customerName}
                  </span>
                  {selectedPlan.customerPoNumber && (
                    <span className="text-[10px] text-slate-400 font-mono">PO: {selectedPlan.customerPoNumber}</span>
                  )}
                </div>
              </div>
            </div>

            {/* View Mode Switcher & Top Actions */}
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-between sm:justify-end">
              
              {/* Mode Toggle: Nested Tree vs Type Classification */}
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
                <button
                  onClick={() => {
                    setViewMode('nested-tree');
                    setSelectedKeys(new Set());
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    viewMode === 'nested-tree'
                      ? 'bg-white dark:bg-slate-900 text-emerald-600 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <GitBranch size={13} />
                  <span>Nested BOM Tree</span>
                </button>

                <button
                  onClick={() => {
                    setViewMode('consolidated-types');
                    setSelectedKeys(new Set());
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    viewMode === 'consolidated-types'
                      ? 'bg-white dark:bg-slate-900 text-emerald-600 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Layers size={13} />
                  <span>Type Classification</span>
                </button>
              </div>

              {/* PDF Export Button (Visible on Tree view) */}
              {viewMode === 'nested-tree' && (
                <button
                  onClick={handleExportBOMPDF}
                  className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                  title="Export Multi-Level BOM PDF"
                >
                  <Download size={13} />
                  <span>Export BOM PDF</span>
                </button>
              )}

              <button
                onClick={() => fetchWorkbenchData(selectedPlan._id)}
                className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl cursor-pointer"
                title="Refresh Live Stock"
              >
                <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-2xl shadow-xs">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Finished Goods</span>
              <div className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
                {(selectedPlan.fgItems || []).length} <span className="text-xs font-semibold text-slate-400">items</span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-2xl shadow-xs">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-red-500">Net Shortages</span>
              <div className="text-xl font-black text-red-600 dark:text-red-400 mt-0.5">
                {selectedPlan.planTotalShortages} <span className="text-xs font-semibold text-slate-400">units</span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-2xl shadow-xs">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-500">In-Transit Open POs</span>
              <div className="text-xl font-black text-blue-600 mt-0.5">
                {selectedPlan.planTotalInTransit} <span className="text-xs font-semibold text-slate-400">units</span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-2xl shadow-xs">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600">Procurement Status</span>
              <div className="mt-1">
                {selectedPlan.isProcurementFulfilled ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    ✅ Fulfilled
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    ⏳ Shortages Pending
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* TAB 1: NESTED MULTI-LEVEL BOM TREE VIEW (CLEAN HIERARCHY - NO SELECTION)  */}
          {/* ========================================================================= */}
          {viewMode === 'nested-tree' && (
            <div className="space-y-3">
              {(selectedPlan.fgItems || []).map((fg: any, fgIdx: number) => {
                const fgKey = `${selectedPlan._id}_fg_${fgIdx}`;
                const isExpanded = expandedNodes.has(fgKey) || true;

                return (
                  <div key={fgIdx} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
                    
                    {/* Level 1: Finished Good / Assembly Header */}
                    <div 
                      onClick={() => toggleExpandNode(fgKey)}
                      className="p-3.5 bg-slate-50 dark:bg-slate-800/60 flex justify-between items-center cursor-pointer hover:bg-slate-100/60 transition-colors border-b border-slate-200 dark:border-slate-700"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="p-1 rounded bg-emerald-600 text-white text-[9px] font-black uppercase">
                          Level 1: Assembly / FG
                        </span>
                        <span className="font-bold text-sm text-slate-900 dark:text-white">
                          {fg.fgItemName}
                        </span>
                        {fg.fgItemCode && <span className="text-[11px] font-mono text-slate-400">({fg.fgItemCode})</span>}
                        {fg.bomNumber && (
                          <span className="px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-mono text-[9px]">
                            {fg.bomNumber}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs">
                        <span className="font-bold text-slate-600 dark:text-slate-300">
                          Order Target: <strong>{fg.quantity} {fg.unit}</strong>
                        </span>
                        <span className="font-bold text-teal-600">
                          GRN Received: <strong>{fg.receivedQuantity} {fg.unit}</strong>
                        </span>
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </div>
                    </div>

                    {/* Level 2, 3, 4: Nested Child Materials Table (Clean View) */}
                    {isExpanded && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-50/50 dark:bg-slate-800/40 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-700">
                            <tr>
                              <th className="p-3">Nested Component / Material</th>
                              <th className="p-3">Classification Type</th>
                              <th className="p-3 text-center">Req / FG</th>
                              <th className="p-3 text-center">Total Req</th>
                              <th className="p-3 text-center">Live Stock</th>
                              <th className="p-3 text-center">In-Transit PO</th>
                              <th className="p-3 text-center">True Net Shortage</th>
                              <th className="p-3">Best Vendor Quote</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {(fg.nestedMaterials || []).map((nMat: any, nIdx: number) => {
                              const levelIndent = nMat.level ? (nMat.level - 1) * 16 : 0;

                              return (
                                <tr key={nIdx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                                  <td className="p-3">
                                    <div style={{ paddingLeft: `${levelIndent}px` }} className="flex items-center gap-1.5">
                                      {nMat.level > 1 && <span className="text-slate-300 font-mono">↳</span>}
                                      <div>
                                        <span className="font-bold text-slate-800 dark:text-slate-200">{nMat.materialName}</span>
                                        {nMat.materialCode && <span className="block font-mono text-[9px] text-slate-400">{nMat.materialCode}</span>}
                                      </div>
                                    </div>
                                  </td>

                                  <td className="p-3">
                                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                                      nMat.itemType === 'SubAssembly' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300' :
                                      nMat.itemType === 'Component' ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300' :
                                      nMat.itemType === 'BO' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' :
                                      nMat.itemType === 'Assembly' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' :
                                      'bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300'
                                    }`}>
                                      {nMat.itemType || "RM"}
                                    </span>
                                  </td>

                                  <td className="p-3 text-center font-mono text-slate-600 dark:text-slate-400">
                                    {nMat.quantityPerFG || 1} {nMat.unit}
                                  </td>

                                  <td className="p-3 text-center font-bold text-slate-800 dark:text-slate-200">
                                    {nMat.totalRequired || nMat.requiredQuantity} {nMat.unit}
                                  </td>

                                  <td className="p-3 text-center font-semibold text-slate-600 dark:text-slate-400">
                                    {nMat.currentPhysicalStock} {nMat.unit}
                                  </td>

                                  <td className="p-3 text-center">
                                    {nMat.totalInTransitPO > 0 ? (
                                      <span className="font-bold text-blue-600 bg-blue-50 dark:bg-blue-950 px-1.5 py-0.5 rounded text-[10px]">
                                        {nMat.totalInTransitPO} {nMat.unit}
                                      </span>
                                    ) : (
                                      <span className="text-slate-300">-</span>
                                    )}
                                  </td>

                                  <td className="p-3 text-center">
                                    {nMat.netShortage > 0 ? (
                                      <span className="font-black text-red-600 text-xs">
                                        {nMat.netShortage} {nMat.unit}
                                      </span>
                                    ) : (
                                      <span className="text-emerald-600 font-bold text-[11px]">Covered</span>
                                    )}
                                  </td>

                                  <td className="p-3">
                                    {nMat.bestVendor ? (
                                      <div className="text-[11px]">
                                        <span className="font-bold text-slate-700 dark:text-slate-300">{nMat.bestVendor.vendorName}</span>
                                        <span className="text-slate-400 block text-[10px]">₹{nMat.bestVendor.rate}/{nMat.unit}</span>
                                      </div>
                                    ) : (
                                      <span className="text-slate-400 italic text-[10px]">No vendor quote</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: TYPES CLASSIFICATION VIEW (SELECTION, MANUAL STATUS & ACTIONS)      */}
          {/* ========================================================================= */}
          {viewMode === 'consolidated-types' && (
            <div className="space-y-3">
              
              {/* Type Switcher Pills */}
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold overflow-x-auto no-scrollbar gap-1">
                <button
                  onClick={() => {
                    setActiveTypeTab('rm');
                    setSelectedKeys(new Set());
                  }}
                  className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTypeTab === 'rm'
                      ? 'bg-white dark:bg-slate-900 text-cyan-600 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <Package size={13} />
                  <span>🔩 Raw Materials ({classifiedLists.rmList?.length || 0})</span>
                </button>

                <button
                  onClick={() => {
                    setActiveTypeTab('bo');
                    setSelectedKeys(new Set());
                  }}
                  className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTypeTab === 'bo'
                      ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <Boxes size={13} />
                  <span>📦 Bought Out Items ({classifiedLists.boList?.length || 0})</span>
                </button>

                <button
                  onClick={() => {
                    setActiveTypeTab('component');
                    setSelectedKeys(new Set());
                  }}
                  className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTypeTab === 'component'
                      ? 'bg-white dark:bg-slate-900 text-purple-600 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <Factory size={13} />
                  <span>⚙️ Components ({classifiedLists.componentList?.length || 0})</span>
                </button>

                <button
                  onClick={() => {
                    setActiveTypeTab('subassembly');
                    setSelectedKeys(new Set());
                  }}
                  className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTypeTab === 'subassembly'
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <GitBranch size={13} />
                  <span>🧩 Sub-Assemblies ({classifiedLists.subAssemblyList?.length || 0})</span>
                </button>

                <button
                  onClick={() => {
                    setActiveTypeTab('assembly');
                    setSelectedKeys(new Set());
                  }}
                  className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTypeTab === 'assembly'
                      ? 'bg-white dark:bg-slate-900 text-emerald-600 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <CheckCircle2 size={13} />
                  <span>🏆 Assemblies ({classifiedLists.assemblyList?.length || 0})</span>
                </button>
              </div>

              {/* Action Toolbar for Selected Items */}
              <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {selectedKeys.size} item(s) selected in {activeTypeTab.toUpperCase()}
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-between sm:justify-end">
                  
                  {/* Manual Status Bulk Dropdown */}
                  <div className="flex items-center">
                    <select
                      disabled={selectedKeys.size === 0}
                      onChange={(e) => {
                        if (e.target.value) {
                          handleUpdateItemStatus(e.target.value);
                          e.target.value = '';
                        }
                      }}
                      defaultValue=""
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs disabled:opacity-30 transition-all cursor-pointer outline-none border border-slate-200 dark:border-slate-700"
                    >
                      <option value="" disabled>🏷️ Set Status ({selectedKeys.size})</option>
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>

                  {/* Common Purchasing Actions: RFQ & PO */}
                  <button
                    onClick={handleCreateRFQ}
                    disabled={selectedKeys.size === 0}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs disabled:opacity-30 transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <FileText size={12} />
                    <span>Create RFQ ({selectedKeys.size})</span>
                  </button>

                  <button
                    onClick={handleOpenManualPO}
                    disabled={selectedKeys.size === 0}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs disabled:opacity-30 transition-all flex items-center gap-1.5 cursor-pointer"
                    title="Open Outward PO Form prefilled with selected items"
                  >
                    <ShoppingCart size={12} />
                    <span>📝 Create Outward PO ({selectedKeys.size})</span>
                  </button>

                  {/* Dual Action: Send to PPC Intake Bucket (Only for Components, Sub-Assemblies, Assemblies) */}
                  {isPpcEligibleTab && (
                    <button
                      onClick={handleSendToPPC}
                      disabled={selectedKeys.size === 0 || submittingPPC}
                      className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs disabled:opacity-30 transition-all flex items-center gap-1.5 cursor-pointer"
                      title="Dispatch to PPC Order Intake for in-house manufacturing"
                    >
                      <Factory size={12} />
                      <span>{submittingPPC ? "Sending to PPC..." : `🏭 ⚡ Send to PPC Intake (${selectedKeys.size})`}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Table with Selection Checkboxes & Inline Status Selector */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="p-3 w-8 text-center">
                          <button onClick={toggleSelectAll} className="text-slate-400 hover:text-emerald-600">
                            {selectedKeys.size === filteredConsolidatedList.length && filteredConsolidatedList.length > 0 ? (
                              <CheckSquare size={14} className="text-emerald-600" />
                            ) : (
                              <Square size={14} />
                            )}
                          </button>
                        </th>
                        <th className="p-3">Material Name & Code</th>
                        <th className="p-3 text-center">Gross Required</th>
                        <th className="p-3 text-center">Live Stock</th>
                        <th className="p-3 text-center">In-Transit PO</th>
                        <th className="p-3 text-center">True Net Shortage</th>
                        <th className="p-3">Preferred Supplier</th>
                        <th className="p-3 text-center">BOM Item Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredConsolidatedList.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-slate-400">
                            No {activeTypeTab.toUpperCase()} items found for this plan.
                          </td>
                        </tr>
                      ) : (
                        filteredConsolidatedList.map((item: any) => {
                          const isSelected = selectedKeys.has(item.materialKey);
                          const currentStatus = item.status || 'Pending';

                          return (
                            <tr key={item.materialKey} className={`hover:bg-slate-50 dark:hover:bg-slate-800/60 ${isSelected ? "bg-emerald-50/50 dark:bg-emerald-950/20" : ""}`}>
                              <td className="p-3 text-center">
                                <button onClick={() => toggleSelect(item.materialKey)} className="text-slate-400 hover:text-emerald-600">
                                  {isSelected ? <CheckSquare size={14} className="text-emerald-600" /> : <Square size={14} />}
                                </button>
                              </td>

                              <td className="p-3">
                                <div className="font-bold text-slate-900 dark:text-white">{item.materialName}</div>
                                {item.materialCode && <span className="font-mono text-[10px] text-slate-400">{item.materialCode}</span>}
                              </td>

                              <td className="p-3 text-center font-bold text-slate-800 dark:text-slate-200">
                                {item.grossRequired || item.requiredQuantity} {item.unit}
                              </td>

                              <td className="p-3 text-center font-semibold text-slate-600 dark:text-slate-400">
                                {item.currentPhysicalStock} {item.unit}
                              </td>

                              <td className="p-3 text-center">
                                {item.totalInTransitPO > 0 ? (
                                  <span className="font-bold text-blue-600 bg-blue-50 dark:bg-blue-950 px-1.5 py-0.5 rounded text-[10px]">
                                    {item.totalInTransitPO} {item.unit}
                                  </span>
                                ) : (
                                  <span className="text-slate-300">-</span>
                                )}
                              </td>

                              <td className="p-3 text-center">
                                {item.netShortage > 0 ? (
                                  <span className="font-black text-red-600 text-xs">
                                    {item.netShortage} {item.unit}
                                  </span>
                                ) : (
                                  <span className="text-emerald-600 font-bold text-[11px]">Covered</span>
                                )}
                              </td>

                              <td className="p-3">
                                {item.bestVendor ? (
                                  <div className="text-[11px]">
                                    <span className="font-bold text-slate-800 dark:text-slate-200">{item.bestVendor.vendorName}</span>
                                    <span className="text-slate-400 block text-[10px]">₹{item.bestVendor.rate}/{item.unit}</span>
                                  </div>
                                ) : (
                                  <span className="text-slate-400 italic text-[10px]">No vendor quote</span>
                                )}
                              </td>

                              {/* Interactive Manual Status Selector (Last Column) */}
                              <td className="p-3 text-center">
                                <div className="inline-block relative">
                                  <select
                                    value={currentStatus}
                                    onChange={(e) => handleUpdateItemStatus(e.target.value, item)}
                                    className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold border outline-none cursor-pointer appearance-none pr-5 text-center transition-all ${getStatusBadgeClass(currentStatus)}`}
                                  >
                                    {STATUS_OPTIONS.map((opt) => (
                                      <option key={opt} value={opt} className="text-slate-800 bg-white dark:bg-slate-900 dark:text-slate-200">
                                        {opt}
                                      </option>
                                    ))}
                                  </select>
                                  <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
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
            </div>
          )}

        </div>
      )}

    </div>
  );
}

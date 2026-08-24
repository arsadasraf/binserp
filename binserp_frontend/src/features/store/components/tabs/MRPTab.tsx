import React, { useState, useEffect, useMemo } from 'react';
import { 
  Layers, Plus, Search, Calendar, User, Eye, Trash2, Package, 
  CheckCircle2, Clock, Filter, ArrowRight, X, Building2, Printer, 
  LayoutGrid, List, Edit2, ShieldCheck, Download, ShoppingCart, 
  Sparkles, RefreshCw, FileText, AlertCircle, Send, CheckSquare, Square,
  Check, Boxes, ChevronRight
} from 'lucide-react';
import Link from 'next/link';
import { apiGet, apiPost, apiPut, apiDelete } from '@/src/lib/api';
import Swal from 'sweetalert2';
import MRPModal from '../modals/MRPModal';
import MRPDetailsModal from '../modals/MRPDetailsModal';
import MRPOutwardRfqModal from '../modals/MRPOutwardRfqModal';
import POModal from '../modals/POModal';

interface MRPTabProps {
  token?: string | null;
  onError?: (msg: string) => void;
  onSuccess?: (msg: string) => void;
}

export interface SelectedMaterialItem {
  id: string; // unique composite key: planId + materialId/code/name
  planId?: string;
  material?: string;
  materialId?: string;
  materialName: string;
  materialCode?: string;
  category?: string;
  itemType: 'rm' | 'bo' | 'fg' | 'consumable' | string;
  requiredQuantity: number;
  currentStock: number;
  shortage: number;
  unit: string;
  sourceMRP?: string;
  customerName?: string;
  targetDate?: string | Date;
  description?: string;
  status?: string;
}

export default function MRPTab({ token: propToken, onError, onSuccess }: MRPTabProps) {
  const [loading, setLoading] = useState(true);
  const [mrpPlans, setMrpPlans] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [activeSubTab, setActiveSubTab] = useState<'plans' | 'rm' | 'bo' | 'fg'>('plans');
  const [onlyShortages, setOnlyShortages] = useState(false);

  // Multi-selection state
  const [selectedItems, setSelectedItems] = useState<SelectedMaterialItem[]>([]);

  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  // RFQ & PO Modal States for MRP
  const [isRfqModalOpen, setIsRfqModalOpen] = useState(false);
  const [rfqModalItems, setRfqModalItems] = useState<any[]>([]);
  const [isPoModalOpen, setIsPoModalOpen] = useState(false);
  const [poInitialData, setPoInitialData] = useState<any>(null);

  // Store data for PO modal
  const [vendors, setVendors] = useState<any[]>([]);
  const [allMaterials, setAllMaterials] = useState<any[]>([]);

  const token = propToken || (typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '');

  const fetchData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [mrpRes, venRes, rmRes, boRes] = await Promise.all([
        apiGet('/api/purchase/mrp/plans', token).catch(() => ({ mrpPlans: [] })),
        apiGet('/api/store/vendor', token).catch(() => []),
        apiGet('/api/store/raw-material', token).catch(() => []),
        apiGet('/api/store/bought-out', token).catch(() => [])
      ]);

      setMrpPlans(mrpRes.mrpPlans || []);
      const vList = Array.isArray(venRes?.vendors) ? venRes.vendors : (Array.isArray(venRes) ? venRes : []);
      setVendors(vList);
      const rmList = Array.isArray(rmRes) ? rmRes : (rmRes?.rawMaterials || []);
      const boList = Array.isArray(boRes) ? boRes : (boRes?.boughtOuts || []);
      setAllMaterials([...rmList, ...boList]);
    } catch (err: any) {
      console.error('Failed to fetch MRP data:', err);
      if (onError) onError(err.message || 'Failed to fetch MRP plans');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  const handleDeletePlan = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const confirm = await Swal.fire({
      title: 'Delete MRP Plan?',
      text: 'Are you sure you want to remove this MRP demand plan and all its exploded requirements?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, Delete'
    });

    if (!confirm.isConfirmed) return;

    try {
      await apiDelete(`/api/purchase/mrp/plan/${id}`, token);
      Swal.fire({
        icon: 'success',
        title: 'Deleted',
        text: 'MRP Plan removed successfully',
        timer: 2000
      });
      if (onSuccess) onSuccess('MRP Plan deleted successfully');
      setSelectedItems(prev => prev.filter(item => !item.id.startsWith(id)));
      fetchData();
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: err.message || 'Failed to delete MRP plan'
      });
      if (onError) onError(err.message || 'Failed to delete MRP plan');
    }
  };

  const handleOpenDetails = (plan: any) => {
    setSelectedPlan(plan);
    setIsDetailsModalOpen(true);
  };

  // Filtered MRP Plans
  const filteredPlans = useMemo(() => {
    return (Array.isArray(mrpPlans) ? mrpPlans : []).filter((plan: any) => {
      const s = searchTerm.toLowerCase();
      const matchSearch =
        (plan.mrpNumber && plan.mrpNumber.toLowerCase().includes(s)) ||
        (plan.customerName && plan.customerName.toLowerCase().includes(s)) ||
        (plan.remarks && plan.remarks.toLowerCase().includes(s)) ||
        (plan.fgItems && plan.fgItems.some((f: any) => 
          (f.fgItemName && f.fgItemName.toLowerCase().includes(s)) ||
          (f.description && f.description.toLowerCase().includes(s))
        ));

      const matchStatus = filterStatus === 'All' || plan.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [mrpPlans, searchTerm, filterStatus]);

  // Aggregated RM List across all filtered plans
  const aggregatedRMList = useMemo(() => {
    const list: SelectedMaterialItem[] = [];
    filteredPlans.forEach(plan => {
      (plan.rmRequirements || []).forEach((mat: any, idx: number) => {
        const itemShortage = Number(mat.shortage) || 0;
        if (onlyShortages && itemShortage <= 0) return;

        const s = searchTerm.toLowerCase();
        const matchesSearch = !searchTerm || 
          (mat.materialName && mat.materialName.toLowerCase().includes(s)) ||
          (mat.materialCode && mat.materialCode.toLowerCase().includes(s)) ||
          (plan.mrpNumber && plan.mrpNumber.toLowerCase().includes(s)) ||
          (plan.customerName && plan.customerName.toLowerCase().includes(s));

        if (!matchesSearch) return;

        list.push({
          id: `${plan._id}-rm-${mat.material || mat.materialCode || mat.materialName}-${idx}`,
          planId: plan._id,
          material: mat.material?._id || mat.material,
          materialId: mat.material?._id || mat.material,
          materialName: mat.materialName,
          materialCode: mat.materialCode,
          category: mat.category || 'Raw Material',
          itemType: 'rm',
          requiredQuantity: Number(mat.requiredQuantity) || 0,
          currentStock: Number(mat.currentStock) || 0,
          shortage: itemShortage,
          unit: mat.unit || 'PCS',
          sourceMRP: plan.mrpNumber,
          customerName: plan.customerName,
          targetDate: plan.targetDate,
          description: `MRP ${plan.mrpNumber} - ${plan.customerName || 'Internal'}`,
          status: mat.status || 'Pending'
        });
      });
    });
    return list;
  }, [filteredPlans, onlyShortages, searchTerm]);

  // Aggregated BO List across all filtered plans
  const aggregatedBOList = useMemo(() => {
    const list: SelectedMaterialItem[] = [];
    filteredPlans.forEach(plan => {
      (plan.boRequirements || []).forEach((mat: any, idx: number) => {
        const itemShortage = Number(mat.shortage) || 0;
        if (onlyShortages && itemShortage <= 0) return;

        const s = searchTerm.toLowerCase();
        const matchesSearch = !searchTerm || 
          (mat.materialName && mat.materialName.toLowerCase().includes(s)) ||
          (mat.materialCode && mat.materialCode.toLowerCase().includes(s)) ||
          (plan.mrpNumber && plan.mrpNumber.toLowerCase().includes(s)) ||
          (plan.customerName && plan.customerName.toLowerCase().includes(s));

        if (!matchesSearch) return;

        list.push({
          id: `${plan._id}-bo-${mat.material || mat.materialCode || mat.materialName}-${idx}`,
          planId: plan._id,
          material: mat.material?._id || mat.material,
          materialId: mat.material?._id || mat.material,
          materialName: mat.materialName,
          materialCode: mat.materialCode,
          category: mat.category || 'Bought Out',
          itemType: 'bo',
          requiredQuantity: Number(mat.requiredQuantity) || 0,
          currentStock: Number(mat.currentStock) || 0,
          shortage: itemShortage,
          unit: mat.unit || 'PCS',
          sourceMRP: plan.mrpNumber,
          customerName: plan.customerName,
          targetDate: plan.targetDate,
          description: `MRP ${plan.mrpNumber} - ${plan.customerName || 'Internal'}`,
          status: mat.status || 'Pending'
        });
      });
    });
    return list;
  }, [filteredPlans, onlyShortages, searchTerm]);

  // Aggregated FG List across all filtered plans
  const aggregatedFGList = useMemo(() => {
    const list: any[] = [];
    filteredPlans.forEach(plan => {
      (plan.fgItems || []).forEach((fg: any, idx: number) => {
        const s = searchTerm.toLowerCase();
        const matchesSearch = !searchTerm || 
          (fg.fgItemName && fg.fgItemName.toLowerCase().includes(s)) ||
          (fg.fgItemCode && fg.fgItemCode.toLowerCase().includes(s)) ||
          (plan.mrpNumber && plan.mrpNumber.toLowerCase().includes(s)) ||
          (plan.customerName && plan.customerName.toLowerCase().includes(s));

        if (!matchesSearch) return;

        const plannedQty = Number(fg.quantity) || 0;
        const receivedQty = Number(fg.receivedQuantity) || 0;
        const pendingQty = Math.max(0, plannedQty - receivedQty);

        if (onlyShortages && pendingQty <= 0) return;

        list.push({
          id: `${plan._id}-fg-${fg.fgItem || fg.fgItemCode || fg.fgItemName}-${idx}`,
          planId: plan._id,
          fgItemId: fg.fgItem?._id || fg.fgItem,
          fgItemName: fg.fgItemName,
          fgItemCode: fg.fgItemCode,
          description: fg.description,
          plannedQuantity: plannedQty,
          receivedQuantity: receivedQty,
          pendingQuantity: pendingQty,
          unit: fg.unit || 'PCS',
          targetDate: fg.targetDate || plan.targetDate,
          sourceMRP: plan.mrpNumber,
          customerName: plan.customerName,
          bomNumber: fg.bomNumber || 'BOM-Default',
          planStatus: plan.status || 'Planned'
        });
      });
    });
    return list;
  }, [filteredPlans, onlyShortages, searchTerm]);

  // Current active dataset for selection
  const currentTabItems = useMemo(() => {
    if (activeSubTab === 'rm') return aggregatedRMList;
    if (activeSubTab === 'bo') return aggregatedBOList;
    return [];
  }, [activeSubTab, aggregatedRMList, aggregatedBOList]);

  // Check if item is selected
  const isItemSelected = (id: string) => {
    return selectedItems.some(it => it.id === id);
  };

  // Toggle single item selection
  const toggleItemSelection = (item: SelectedMaterialItem) => {
    setSelectedItems(prev => {
      const exists = prev.some(it => it.id === item.id);
      if (exists) {
        return prev.filter(it => it.id !== item.id);
      } else {
        return [...prev, item];
      }
    });
  };

  // Select all / Deselect all in current active tab
  const toggleSelectAllCurrentTab = () => {
    if (currentTabItems.length === 0) return;
    const allSelected = currentTabItems.every(it => isItemSelected(it.id));
    if (allSelected) {
      const currentIds = new Set(currentTabItems.map(it => it.id));
      setSelectedItems(prev => prev.filter(it => !currentIds.has(it.id)));
    } else {
      const toAdd = currentTabItems.filter(it => !isItemSelected(it.id));
      setSelectedItems(prev => [...prev, ...toAdd]);
    }
  };

  // Clear all selections
  const handleClearSelection = () => {
    setSelectedItems([]);
  };

  // Open Outward RFQ Modal with selected items
  const handleOpenRfqForSelected = (customItems?: SelectedMaterialItem[]) => {
    const itemsToProcure = customItems || selectedItems;
    if (itemsToProcure.length === 0) {
      Swal.fire({
        icon: 'info',
        title: 'Select Materials',
        text: 'Please select at least one RM or BO material to generate an Outward RFQ.'
      });
      return;
    }

    setRfqModalItems(itemsToProcure.map(it => ({
      planId: it.planId,
      materialId: it.materialId || it.material,
      materialName: it.materialName,
      materialCode: it.materialCode,
      quantity: it.shortage > 0 ? it.shortage : it.requiredQuantity,
      unit: it.unit || 'PCS',
      itemType: it.itemType || 'rm',
      category: it.category || 'RM',
      sourceMRP: it.sourceMRP,
      description: `Demand from MRP ${it.sourceMRP || ''} (${it.customerName || 'Internal'})`
    })));
    setIsRfqModalOpen(true);
  };

  // Open Outward PO Modal with selected items
  const handleOpenPoForSelected = (customItems?: SelectedMaterialItem[]) => {
    const itemsToProcure = customItems || selectedItems;
    if (itemsToProcure.length === 0) {
      Swal.fire({
        icon: 'info',
        title: 'Select Materials',
        text: 'Please select at least one RM or BO material to generate an Outward PO.'
      });
      return;
    }

    const poItems = itemsToProcure.map(it => {
      const qty = it.shortage > 0 ? it.shortage : it.requiredQuantity;
      return {
        planId: it.planId,
        sourceMRP: it.sourceMRP,
        itemType: (it.itemType || 'rm') as any,
        material: it.materialId || it.material,
        materialName: it.materialName,
        materialCode: it.materialCode,
        description: `Demand from MRP ${it.sourceMRP || ''} (${it.customerName || 'Internal'})`,
        quantity: qty,
        unit: it.unit || 'PCS',
        rate: 0,
        taxRate: 18,
        taxAmount: 0,
        amount: 0,
        category: it.category || 'RM'
      };
    });

    setPoInitialData({
      items: poItems,
      remarks: `Purchase Order raised from MRP calculation (${itemsToProcure.length} items)`
    });
    setIsPoModalOpen(true);
  };

  // Submit PO directly
  const handlePOSubmit = async (formData: any) => {
    try {
      await apiPost('/api/purchase/po', formData, token);

      // Update MRP requirement items status to "PO Raised"
      try {
        const updateItems = (poInitialData?.items || []).map((it: any) => ({
          planId: it.planId,
          mrpNumber: it.sourceMRP,
          materialId: it.material || it.materialId,
          materialName: it.materialName,
          materialCode: it.materialCode,
          status: 'PO Raised'
        }));
        if (updateItems.length > 0) {
          await apiPut('/api/purchase/mrp/update-item-status', { items: updateItems, status: 'PO Raised' }, token);
        }
      } catch (statusErr) {
        console.warn('Could not update MRP requirement item status after PO:', statusErr);
      }

      Swal.fire({
        icon: 'success',
        title: 'Purchase Order Created!',
        text: `PO ${formData.poNumber || ''} created successfully with ${formData.items?.length || 1} line item(s). Status updated to 'PO Raised'.`,
        timer: 2500
      });
      if (onSuccess) onSuccess('Purchase Order created successfully');
      setIsPoModalOpen(false);
      setPoInitialData(null);
      setSelectedItems([]);
      fetchData();
    } catch (err: any) {
      console.error('Failed to create PO from MRP:', err);
      Swal.fire({
        icon: 'error',
        title: 'Error Creating PO',
        text: err.message || 'Failed to submit Purchase Order'
      });
      if (onError) onError(err.message || 'Failed to submit Purchase Order');
    }
  };

  const renderStatusBadge = (status?: string, shortage?: number) => {
    if (status === 'PO Raised') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
          <ShoppingCart size={11} /> PO Raised
        </span>
      );
    }
    if (status === 'RFQ Raised') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
          <Send size={11} /> RFQ Raised
        </span>
      );
    }
    if (status === 'Completed') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
          <CheckCircle2 size={11} /> Completed
        </span>
      );
    }
    if (shortage && shortage > 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
          <Clock size={11} /> Pending
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
        In Stock
      </span>
    );
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      
      {/* Search, Sub-tab switcher & Action Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col xl:flex-row justify-between items-stretch xl:items-center gap-3">
        
        {/* Left Side: Sub-tab switcher and search box */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3 flex-1 min-w-0">
          
          {/* Sub-tab Switcher: Plans | RM | BO | FG */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold overflow-x-auto no-scrollbar max-w-full shrink-0">
            <button
              onClick={() => setActiveSubTab('plans')}
              className={`px-3.5 py-1.5 rounded-lg whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                activeSubTab === 'plans' 
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-sm font-bold' 
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FileText size={14} /> MRP Plans ({mrpPlans.length})
            </button>

            <button
              onClick={() => setActiveSubTab('rm')}
              className={`px-3.5 py-1.5 rounded-lg whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                activeSubTab === 'rm' 
                  ? 'bg-white dark:bg-slate-900 text-cyan-600 shadow-sm font-bold' 
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Package size={14} /> Raw Materials (RM) ({aggregatedRMList.length})
            </button>

            <button
              onClick={() => setActiveSubTab('bo')}
              className={`px-3.5 py-1.5 rounded-lg whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                activeSubTab === 'bo' 
                  ? 'bg-white dark:bg-slate-900 text-purple-600 shadow-sm font-bold' 
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Boxes size={14} /> Bought Out (BO) ({aggregatedBOList.length})
            </button>

            <button
              onClick={() => setActiveSubTab('fg')}
              className={`px-3.5 py-1.5 rounded-lg whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                activeSubTab === 'fg' 
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 shadow-sm font-bold' 
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Layers size={14} /> Finished Goods (FG) ({aggregatedFGList.length})
            </button>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder={
                activeSubTab === 'plans' ? "Search MRP #, Customer, or FG Item..." :
                activeSubTab === 'rm' ? "Search Raw Material, Code, or Source MRP..." :
                activeSubTab === 'bo' ? "Search Bought Out item, Code, or MRP..." :
                "Search FG Item Name, Code, or Customer..."
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-slate-50/50 dark:bg-slate-800/50"
            />
          </div>
        </div>

        {/* Right Side: Filters + Actions */}
        <div className="flex flex-wrap sm:flex-nowrap items-center justify-between sm:justify-end gap-2 shrink-0">
          
          {/* Shortage Toggle for RM, BO, FG */}
          {activeSubTab !== 'plans' && (
            <button
              onClick={() => setOnlyShortages(!onlyShortages)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border cursor-pointer ${
                onlyShortages 
                  ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800 shadow-2xs' 
                  : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 hover:bg-slate-200'
              }`}
              title="Filter items that have shortages"
            >
              <AlertCircle size={14} className={onlyShortages ? "text-rose-600" : "text-slate-400"} />
              <span>{onlyShortages ? "Showing Shortages Only" : "Show All (Including In-Stock)"}</span>
            </button>
          )}

          {/* Status Filter Pills for Plans */}
          {activeSubTab === 'plans' && (
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold overflow-x-auto no-scrollbar max-w-full shrink-0">
              {['All', 'Planned', 'In Production', 'Partially Completed', 'In Procurement', 'Completed'].map(status => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`px-2.5 py-1.5 rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                    filterStatus === status 
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-sm font-bold' 
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={fetchData}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center text-xs font-bold bg-white dark:bg-slate-900 cursor-pointer"
              title="Refresh MRP Plans"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            </button>

            {activeSubTab === 'plans' && (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Plus size={15} /> Create MRP Plan
              </button>
            )}
          </div>
        </div>
      </div>

      {/* FLOATING MULTI-SELECTION ACTION BAR (Appears when items are selected) */}
      {selectedItems.length > 0 && (
        <div className="sticky top-14 z-30 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-3.5 sm:p-4 rounded-2xl shadow-xl border border-indigo-500/30 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 animate-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 text-indigo-300 rounded-xl border border-indigo-400/30">
              <CheckSquare size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-white">
                  {selectedItems.length} Material{selectedItems.length > 1 ? 's' : ''} Selected
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-500/30 text-indigo-300 border border-indigo-400/30">
                  Ready for Procurement
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Generate bulk Outward RFQ or Purchase Order for selected items
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleOpenRfqForSelected()}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Send size={14} /> Create Outward RFQ ({selectedItems.length})
            </button>

            <button
              onClick={() => handleOpenPoForSelected()}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <ShoppingCart size={14} /> Create Outward PO ({selectedItems.length})
            </button>

            <button
              onClick={handleClearSelection}
              className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
              title="Clear Selection"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {loading ? (
        <div className="flex justify-center p-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <>
          {/* TAB 1: ALL MRP DEMAND PLANS */}
          {activeSubTab === 'plans' && (
            <>
              {filteredPlans.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                  <Layers className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No MRP Plans Found</h3>
                  <p className="text-xs text-slate-500 mt-1 mb-4">Create an MRP Plan to calculate material requirements for your Finished Goods.</p>
                  <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
                  >
                    + Create First MRP Plan
                  </button>
                </div>
              ) : (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                  
                  {/* Desktop Table View */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                        <tr>
                          <th className="px-4 py-3.5">MRP Number</th>
                          <th className="px-4 py-3.5">Customer</th>
                          <th className="px-4 py-3.5">FG Items</th>
                          <th className="px-4 py-3.5 text-center">Due Date</th>
                          <th className="px-4 py-3.5 text-center">RM / BO Materials</th>
                          <th className="px-4 py-3.5 text-center">Status</th>
                          <th className="px-4 py-3.5 text-center">Created By</th>
                          <th className="px-4 py-3.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {filteredPlans.map((plan) => {
                          const fgSummary = plan.fgItems?.map((f: any) => `${f.fgItemName} (${f.receivedQuantity || 0}/${f.quantity})`).join(', ') || '-';
                          const allMats = [...(plan.rmRequirements || []), ...(plan.boRequirements || [])];
                          const totalMats = allMats.length;
                          const shortages = allMats.filter((m: any) => m.shortage > 0).length;

                          return (
                            <tr
                              key={plan._id || plan.mrpNumber}
                              onClick={() => handleOpenDetails(plan)}
                              className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                            >
                              <td className="px-4 py-3.5 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                {plan.mrpNumber}
                                <span className="block text-[10px] text-slate-400 font-sans font-normal">
                                  {new Date(plan.createdAt || Date.now()).toLocaleDateString('en-GB')}
                                </span>
                              </td>

                              <td className="px-4 py-3.5 font-bold text-slate-800 dark:text-slate-200">
                                {plan.customerName || <span className="text-slate-400 font-normal italic">Internal Plan</span>}
                              </td>

                              <td className="px-4 py-3.5 max-w-[200px] truncate text-slate-700 dark:text-slate-300 font-medium" title={fgSummary}>
                                {Array.isArray(plan.fgItems) && plan.fgItems.length > 0 ? (
                                  <div>
                                    {plan.fgItems[0]?.fgItemName} ({plan.fgItems[0]?.receivedQuantity || 0}/{plan.fgItems[0]?.quantity} {plan.fgItems[0]?.unit || 'PCS'})
                                    {plan.fgItems.length > 1 && (
                                      <span className="text-xs text-slate-400 font-normal ml-1">+{plan.fgItems.length - 1} more</span>
                                    )}
                                  </div>
                                ) : '-'}
                              </td>

                              <td className="px-4 py-3.5 text-center font-bold text-slate-700 dark:text-slate-300 text-xs">
                                {plan.targetDate ? new Date(plan.targetDate).toLocaleDateString('en-GB') : 'N/A'}
                              </td>

                              <td className="px-4 py-3.5 text-center font-bold">
                                <span className="bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 px-2.5 py-1 rounded-lg text-xs font-mono">
                                  {totalMats} Items {shortages > 0 && <span className="text-rose-600 font-extrabold ml-1">({shortages} Short)</span>}
                                </span>
                              </td>

                              <td className="px-4 py-3.5 text-center">
                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                                  plan.status === 'Completed' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' :
                                  plan.status === 'In Production' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300' :
                                  plan.status === 'Partially Completed' ? 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300' :
                                  plan.status === 'In Procurement' ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300' :
                                  'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                }`}>
                                  {plan.status || 'Planned'}
                                </span>
                              </td>

                              <td className="px-4 py-3.5 text-center text-xs text-slate-500 font-medium">
                                {plan.createdByName || plan.createdBy?.name || 'User'}
                              </td>

                              <td className="px-4 py-3.5 text-right">
                                <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    onClick={() => handleOpenDetails(plan)}
                                    className="p-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950 rounded-lg transition-colors cursor-pointer"
                                    title="View MRP Details"
                                  >
                                    <Eye size={16} />
                                  </button>
                                  <button
                                    onClick={(e) => handleDeletePlan(plan._id, e)}
                                    className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-lg transition-colors cursor-pointer"
                                    title="Delete MRP Plan"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Card View */}
                  <div className="block md:hidden p-3 space-y-3 pb-28 bg-slate-50/50 dark:bg-slate-900/40">
                    {filteredPlans.map((plan) => {
                      const allMats = [...(plan.rmRequirements || []), ...(plan.boRequirements || [])];
                      const totalMats = allMats.length;
                      const shortages = allMats.filter((m: any) => m.shortage > 0).length;

                      return (
                        <div
                          key={plan._id || plan.mrpNumber}
                          className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">{plan.mrpNumber}</span>
                              <h4 className="font-bold text-slate-900 dark:text-white text-sm mt-0.5">
                                {plan.customerName || 'Internal MRP Plan'}
                              </h4>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              plan.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' :
                              plan.status === 'In Procurement' ? 'bg-purple-100 text-purple-800' :
                              'bg-amber-100 text-amber-800'
                            }`}>
                              {plan.status || 'Planned'}
                            </span>
                          </div>

                          <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl text-xs space-y-1 border border-slate-100 dark:border-slate-800">
                            <div className="flex justify-between">
                              <span className="text-slate-500">FG Products:</span>
                              <span className="font-bold text-slate-800 dark:text-slate-200">{plan.fgItems?.length || 0} Items</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Materials Needed:</span>
                              <span className="font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                                {totalMats} Items {shortages > 0 && `(${shortages} Short)`}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Target Date:</span>
                              <span className="font-semibold text-slate-700 dark:text-slate-300">
                                {plan.targetDate ? new Date(plan.targetDate).toLocaleDateString('en-GB') : 'N/A'}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 pt-1">
                            <button
                              onClick={() => handleOpenDetails(plan)}
                              className="flex-1 py-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center gap-1 border border-indigo-200 dark:border-indigo-800 cursor-pointer"
                            >
                              <Eye size={13} /> View Plan
                            </button>
                            <button
                              onClick={(e) => handleDeletePlan(plan._id, e)}
                              className="py-1.5 px-2.5 text-xs font-bold text-rose-600 bg-rose-50 dark:bg-rose-900/30 rounded-lg border border-rose-200 dark:border-rose-800 cursor-pointer"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                </div>
              )}
            </>
          )}

          {/* TAB 2: DEDICATED RAW MATERIALS (RM) TAB */}
          {activeSubTab === 'rm' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
              {aggregatedRMList.length === 0 ? (
                <div className="p-16 text-center text-slate-400 text-xs">
                  No Raw Material (RM) requirements found across active MRP plans matching the current filters.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="px-3.5 py-3.5 w-10 text-center">
                          <button
                            type="button"
                            onClick={toggleSelectAllCurrentTab}
                            className="text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer"
                            title="Select All RM in view"
                          >
                            {aggregatedRMList.length > 0 && aggregatedRMList.every(it => isItemSelected(it.id)) ? (
                              <CheckSquare size={16} className="text-indigo-600" />
                            ) : (
                              <Square size={16} />
                            )}
                          </button>
                        </th>
                        <th className="px-4 py-3.5">Raw Material Name</th>
                        <th className="px-4 py-3.5">Source MRP / Customer</th>
                        <th className="px-4 py-3.5 text-center">Gross Required</th>
                        <th className="px-4 py-3.5 text-center">In-Stock</th>
                        <th className="px-4 py-3.5 text-center">Net Shortage</th>
                        <th className="px-4 py-3.5 text-center">Procure Status</th>
                        <th className="px-4 py-3.5 text-right">Quick Procure</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {aggregatedRMList.map((mat) => {
                        const isSelected = isItemSelected(mat.id);
                        return (
                          <tr 
                            key={mat.id} 
                            onClick={() => toggleItemSelection(mat)}
                            className={`transition-colors cursor-pointer ${
                              isSelected 
                                ? 'bg-cyan-50/60 dark:bg-cyan-950/40' 
                                : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/50'
                            }`}
                          >
                            <td className="px-3.5 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => toggleItemSelection(mat)}
                                className="text-slate-400 hover:text-cyan-600 transition-colors cursor-pointer"
                              >
                                {isSelected ? (
                                  <CheckSquare size={16} className="text-cyan-600" />
                                ) : (
                                  <Square size={16} />
                                )}
                              </button>
                            </td>

                            <td className="px-4 py-3.5">
                              <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                <span>{mat.materialName}</span>
                                <span className="px-2 py-0.5 rounded bg-cyan-100 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 text-[10px] font-bold">
                                  RM
                                </span>
                              </div>
                              {mat.materialCode && (
                                <span className="block text-[11px] text-slate-400 font-mono font-normal">
                                  {mat.materialCode}
                                </span>
                              )}
                            </td>

                            <td className="px-4 py-3.5">
                              <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 block text-xs">
                                {mat.sourceMRP}
                              </span>
                              <span className="text-[11px] text-slate-500">
                                {mat.customerName || 'Internal Plan'}
                              </span>
                            </td>

                            <td className="px-4 py-3.5 text-center font-bold text-slate-800 dark:text-slate-200 text-xs">
                              {mat.requiredQuantity} {mat.unit || 'PCS'}
                            </td>

                            <td className="px-4 py-3.5 text-center font-semibold text-slate-600 dark:text-slate-400 text-xs">
                              {mat.currentStock} {mat.unit || 'PCS'}
                            </td>

                            <td className="px-4 py-3.5 text-center font-extrabold font-mono text-xs">
                              {mat.shortage > 0 ? (
                                <span className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                                  -{mat.shortage} {mat.unit || 'PCS'} Short
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                  In Stock
                                </span>
                              )}
                            </td>

                            <td className="px-4 py-3.5 text-center">
                              {renderStatusBadge(mat.status, mat.shortage)}
                            </td>

                            <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenRfqForSelected([mat])}
                                  className="px-2.5 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-bold text-[11px] transition-colors inline-flex items-center gap-1 shadow-2xs cursor-pointer"
                                  title="Create Outward RFQ for this item"
                                >
                                  <Send size={12} /> RFQ
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenPoForSelected([mat])}
                                  className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold text-[11px] transition-colors inline-flex items-center gap-1 shadow-2xs cursor-pointer"
                                  title="Create Outward PO for this item"
                                >
                                  <ShoppingCart size={12} /> PO
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: DEDICATED BOUGHT OUT (BO) TAB */}
          {activeSubTab === 'bo' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
              {aggregatedBOList.length === 0 ? (
                <div className="p-16 text-center text-slate-400 text-xs">
                  No Bought Out (BO) requirements found across active MRP plans matching the current filters.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="px-3.5 py-3.5 w-10 text-center">
                          <button
                            type="button"
                            onClick={toggleSelectAllCurrentTab}
                            className="text-slate-500 hover:text-purple-600 transition-colors cursor-pointer"
                            title="Select All BO in view"
                          >
                            {aggregatedBOList.length > 0 && aggregatedBOList.every(it => isItemSelected(it.id)) ? (
                              <CheckSquare size={16} className="text-purple-600" />
                            ) : (
                              <Square size={16} />
                            )}
                          </button>
                        </th>
                        <th className="px-4 py-3.5">Bought Out Item Name</th>
                        <th className="px-4 py-3.5">Source MRP / Customer</th>
                        <th className="px-4 py-3.5 text-center">Gross Required</th>
                        <th className="px-4 py-3.5 text-center">In-Stock</th>
                        <th className="px-4 py-3.5 text-center">Net Shortage</th>
                        <th className="px-4 py-3.5 text-center">Procure Status</th>
                        <th className="px-4 py-3.5 text-right">Quick Procure</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {aggregatedBOList.map((mat) => {
                        const isSelected = isItemSelected(mat.id);
                        return (
                          <tr 
                            key={mat.id} 
                            onClick={() => toggleItemSelection(mat)}
                            className={`transition-colors cursor-pointer ${
                              isSelected 
                                ? 'bg-purple-50/60 dark:bg-purple-950/40' 
                                : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/50'
                            }`}
                          >
                            <td className="px-3.5 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => toggleItemSelection(mat)}
                                className="text-slate-400 hover:text-purple-600 transition-colors cursor-pointer"
                              >
                                {isSelected ? (
                                  <CheckSquare size={16} className="text-purple-600" />
                                ) : (
                                  <Square size={16} />
                                )}
                              </button>
                            </td>

                            <td className="px-4 py-3.5">
                              <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                <span>{mat.materialName}</span>
                                <span className="px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 text-[10px] font-bold">
                                  BO
                                </span>
                              </div>
                              {mat.materialCode && (
                                <span className="block text-[11px] text-slate-400 font-mono font-normal">
                                  {mat.materialCode}
                                </span>
                              )}
                            </td>

                            <td className="px-4 py-3.5">
                              <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 block text-xs">
                                {mat.sourceMRP}
                              </span>
                              <span className="text-[11px] text-slate-500">
                                {mat.customerName || 'Internal Plan'}
                              </span>
                            </td>

                            <td className="px-4 py-3.5 text-center font-bold text-slate-800 dark:text-slate-200 text-xs">
                              {mat.requiredQuantity} {mat.unit || 'PCS'}
                            </td>

                            <td className="px-4 py-3.5 text-center font-semibold text-slate-600 dark:text-slate-400 text-xs">
                              {mat.currentStock} {mat.unit || 'PCS'}
                            </td>

                            <td className="px-4 py-3.5 text-center font-extrabold font-mono text-xs">
                              {mat.shortage > 0 ? (
                                <span className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                                  -{mat.shortage} {mat.unit || 'PCS'} Short
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                  In Stock
                                </span>
                              )}
                            </td>

                            <td className="px-4 py-3.5 text-center">
                              {renderStatusBadge(mat.status, mat.shortage)}
                            </td>

                            <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenRfqForSelected([mat])}
                                  className="px-2.5 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-bold text-[11px] transition-colors inline-flex items-center gap-1 shadow-2xs cursor-pointer"
                                  title="Create Outward RFQ for this item"
                                >
                                  <Send size={12} /> RFQ
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenPoForSelected([mat])}
                                  className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold text-[11px] transition-colors inline-flex items-center gap-1 shadow-2xs cursor-pointer"
                                  title="Create Outward PO for this item"
                                >
                                  <ShoppingCart size={12} /> PO
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: DEDICATED FINISHED GOODS (FG) TAB */}
          {activeSubTab === 'fg' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
              {aggregatedFGList.length === 0 ? (
                <div className="p-16 text-center text-slate-400 text-xs">
                  No Finished Goods (FG) demands found across active MRP plans matching the current filters.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="px-4 py-3.5">Finished Good (FG) Product</th>
                        <th className="px-4 py-3.5">Source MRP / Customer</th>
                        <th className="px-4 py-3.5 text-center">BOM Ref</th>
                        <th className="px-4 py-3.5 text-center">Planned Qty</th>
                        <th className="px-4 py-3.5 text-center">Produced / Recv</th>
                        <th className="px-4 py-3.5 text-center">Pending Qty</th>
                        <th className="px-4 py-3.5 text-center">Target Due Date</th>
                        <th className="px-4 py-3.5 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {aggregatedFGList.map((fg) => {
                        const progressPct = fg.plannedQuantity > 0 
                          ? Math.min(100, Math.round((fg.receivedQuantity / fg.plannedQuantity) * 100)) 
                          : 0;

                        return (
                          <tr key={fg.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="px-4 py-3.5">
                              <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                <span>{fg.fgItemName}</span>
                                <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                                  FG
                                </span>
                              </div>
                              {fg.fgItemCode && (
                                <span className="block text-[11px] text-slate-400 font-mono font-normal">
                                  {fg.fgItemCode}
                                </span>
                              )}
                            </td>

                            <td className="px-4 py-3.5">
                              <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 block text-xs">
                                {fg.sourceMRP}
                              </span>
                              <span className="text-[11px] text-slate-500">
                                {fg.customerName || 'Internal Plan'}
                              </span>
                            </td>

                            <td className="px-4 py-3.5 text-center font-mono text-xs font-semibold text-slate-600 dark:text-slate-400">
                              {fg.bomNumber}
                            </td>

                            <td className="px-4 py-3.5 text-center font-bold text-slate-800 dark:text-slate-200 text-xs">
                              {fg.plannedQuantity} {fg.unit || 'PCS'}
                            </td>

                            <td className="px-4 py-3.5 text-center font-semibold text-slate-600 dark:text-slate-400 text-xs">
                              {fg.receivedQuantity} {fg.unit || 'PCS'}
                              <div className="w-16 mx-auto bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden mt-1">
                                <div 
                                  className="bg-emerald-500 h-full rounded-full transition-all" 
                                  style={{ width: `${progressPct}%` }}
                                ></div>
                              </div>
                            </td>

                            <td className="px-4 py-3.5 text-center font-extrabold font-mono text-xs">
                              {fg.pendingQuantity > 0 ? (
                                <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                  {fg.pendingQuantity} {fg.unit || 'PCS'} Left
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                  Fulfilled
                                </span>
                              )}
                            </td>

                            <td className="px-4 py-3.5 text-center text-xs font-medium text-slate-600 dark:text-slate-400">
                              {fg.targetDate ? new Date(fg.targetDate).toLocaleDateString('en-GB') : 'N/A'}
                            </td>

                            <td className="px-4 py-3.5 text-center">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                                fg.planStatus === 'Completed' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' :
                                fg.planStatus === 'In Production' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300' :
                                fg.planStatus === 'In Procurement' ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300' :
                                'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                              }`}>
                                {fg.planStatus}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </>
      )}

      {/* MRP Create Modal */}
      {isCreateModalOpen && (
        <MRPModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={fetchData}
          token={token}
        />
      )}

      {/* MRP Details Modal */}
      {isDetailsModalOpen && selectedPlan && (
        <MRPDetailsModal
          isOpen={isDetailsModalOpen}
          onClose={() => setIsDetailsModalOpen(false)}
          mrpPlan={selectedPlan}
        />
      )}

      {/* MRP Outward RFQ Creation Modal */}
      {isRfqModalOpen && (
        <MRPOutwardRfqModal
          isOpen={isRfqModalOpen}
          onClose={() => setIsRfqModalOpen(false)}
          token={token}
          initialItems={rfqModalItems}
          onSuccess={() => {
            fetchData();
            setSelectedItems([]);
          }}
        />
      )}

      {/* Outward PO Creation Modal */}
      {isPoModalOpen && (
        <POModal
          isOpen={isPoModalOpen}
          loading={false}
          onClose={() => {
            setIsPoModalOpen(false);
            setPoInitialData(null);
          }}
          onSubmit={handlePOSubmit}
          materials={allMaterials as any}
          vendors={vendors as any}
          initialData={poInitialData}
        />
      )}

    </div>
  );
}
